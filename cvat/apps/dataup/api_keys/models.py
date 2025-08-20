# Copyright (C) 2024 CVAT.ai Corporation
#
# SPDX-License-Identifier: MIT

import uuid
from typing import Optional

from django.db import models
from django.db.models import Q
from django.db.models.functions import Coalesce

from cvat.apps.dataup.models import DataUpOrganization, DataUpUser


class APIKeyRoleNotAllowed(Exception):
    """Raised when an org-scoped API key does not allow the caller's role."""
    pass


class DataUpAPIKey(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    key = models.CharField(max_length=255, unique=True, help_text="API key for DataUp integration")
    name = models.CharField(max_length=255, help_text="Descriptive name for the API key")
    preview = models.CharField(max_length=255, help_text="Preview of the API key")
    organization = models.ForeignKey(
        DataUpOrganization,
        on_delete=models.CASCADE,
        related_name='api_keys',
        null=True,
        blank=True,
        help_text="Organization this key belongs to (optional).",
    )
    owner = models.ForeignKey(
        DataUpUser,
        on_delete=models.CASCADE,
        related_name='api_keys',
        null=True,
        blank=True,
        help_text="User this key belongs to (optional).",
    )
    allowed_roles = models.JSONField(default=list, help_text="Org roles allowed to use this key (applies to org-owned keys).")
    label = models.CharField(max_length=255, blank=True, null=True, help_text="Optional label for the API key")
    default = models.BooleanField(default=False, help_text="Mark as the default key within its scope")
    created_at = models.DateTimeField(auto_now_add=True)
    last_used_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "DataUP API Key"
        verbose_name_plural = "DataUP API Keys"
        ordering = ["-created_at"]
        constraints = [
            # Key must be linked to at least a user or an organization
            models.CheckConstraint(
                check=Q(owner__isnull=False) | Q(organization__isnull=False),
                name="api_key_owner_or_org_required",
            ),
            # Default uniqueness per scope:
            # 1) Personal default: owner set, org is NULL
            models.UniqueConstraint(
                fields=["owner"],
                condition=Q(default=True, owner__isnull=False, organization__isnull=True),
                name="uniq_default_personal_per_owner",
            ),
            # 2) User+Org default: owner set, org set
            models.UniqueConstraint(
                fields=["owner", "organization"],
                condition=Q(default=True, owner__isnull=False, organization__isnull=False),
                name="uniq_default_user_org_pair",
            ),
            # 3) Org-only default: org set, owner is NULL
            models.UniqueConstraint(
                fields=["organization"],
                condition=Q(default=True, owner__isnull=True, organization__isnull=False),
                name="uniq_default_org_only",
            ),
        ]
        indexes = [
            models.Index(fields=["owner", "organization", "default"]),
            models.Index(fields=["owner", "organization"]),
            models.Index(fields=["organization", "default"]),
            models.Index(fields=["owner", "default"]),
            models.Index(fields=["created_at"]),
            models.Index(fields=["last_used_at"]),
        ]

    # -----------------------
    # Persistence / Defaults
    # -----------------------
    def save(self, *args, **kwargs):
        # Ensure only one default within the relevant scope
        if self.default:
            if self.owner_id and self.organization_id:
                # user+org scope
                qs = DataUpAPIKey.objects.filter(owner_id=self.owner_id, organization_id=self.organization_id)
            elif self.owner_id and self.organization_id is None:
                # personal scope (owner, org NULL)
                qs = DataUpAPIKey.objects.filter(owner_id=self.owner_id, organization__isnull=True)
            elif self.organization_id and self.owner_id is None:
                # org-only scope (org, owner NULL)
                qs = DataUpAPIKey.objects.filter(owner__isnull=True, organization_id=self.organization_id)
            else:
                # Should not happen due to CheckConstraint; be defensive
                qs = DataUpAPIKey.objects.none()

            qs.exclude(pk=self.pk).update(default=False)

        # Set preview if not already set: first 8 + last 4 characters
        if not self.preview:
            safe_key = self.key or ""
            self.preview = safe_key[:8] + safe_key[-4:]

        super().save(*args, **kwargs)

    # --------------
    # Representations
    # --------------
    def __str__(self):
        return f"{self.organization_id} | {self.owner_id} | {self.label or (self.key or '')[:8]}"

    # --------------
    # Role handling
    # --------------
    def is_role_allowed(self, role: Optional[str]) -> bool:
        """
        User-owned keys (personal or user+org) bypass role checks.
        Org-only keys (owner is NULL) must list the role explicitly.
        """
        if self.owner_id:
            return True
        if not role:
            return False
        return role in (self.allowed_roles or [])

    # ------------------------
    # Selection helpers
    # ------------------------
    @classmethod
    def _recent(cls, qs):
        return qs.order_by(
            Coalesce('last_used_at', 'created_at').desc(),
            '-created_at',
        )

    @classmethod
    def _pick_default_then_newest(cls, qs):
        return qs.filter(default=True).first() or cls._recent(qs).first()

    # --------------
    # Public API
    # --------------
    @classmethod
    def get_api_key(
        cls,
        *,
        user_uuid: uuid.UUID,
        org_uuid: Optional[uuid.UUID] = None,
        role: str = "",
    ):
        """
        User perspective selection:

        - Personal workspace (no org_uuid):
            1) Personal user key: owner=user_uuid AND organization IS NULL
               (default first, else newest)

        - Inside an organization (org_uuid provided):
            1) User+org key: owner=user_uuid AND organization=org_uuid
               (default first, else newest) [no role check]
            2) Org-only key: owner IS NULL AND organization=org_uuid
               (default first, else newest) [must allow `role`]
        """
        role = (role or "").strip()

        # --- Personal workspace ---
        if org_uuid is None:
            personal_qs = cls.objects.filter(owner_id=user_uuid, organization__isnull=True)
            return cls._pick_default_then_newest(personal_qs)

        # --- Inside an organization ---
        # 1) User+org key
        user_org_qs = cls.objects.filter(owner_id=user_uuid, organization_id=org_uuid)
        if key := cls._pick_default_then_newest(user_org_qs):
            return key

       
        # 2) Org-only key (must allow role)
        org_only_qs = cls.objects.filter(organization_id=org_uuid)
        if key := cls._pick_default_then_newest(org_only_qs):
            return key
        # Nothing found
        return None
