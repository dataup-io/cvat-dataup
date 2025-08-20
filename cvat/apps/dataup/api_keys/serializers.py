# Copyright (C) 2024 CVAT.ai Corporation
#
# SPDX-License-Identifier: MIT

from rest_framework import serializers
from django.db.models import Field

from cvat.apps.dataup.models import DataUpOrganization, DataUpUser
from cvat.apps.dataup.api_keys.models import DataUpAPIKey
from cvat.apps.organizations.models import Membership


def _valid_membership_roles() -> list[str]:
    """Get canonical role values from CVAT Membership (e.g., ['worker', 'supervisor', ...])."""
    role_field: Field = Membership._meta.get_field('role')
    return [value for value, _ in role_field.choices]


class DataUpAPIKeyReadSerializer(serializers.ModelSerializer):
    """Serializer for reading DataUp API keys."""
    name = serializers.CharField(max_length=255)
    # organization_uuid = serializers.UUIDField(source='organization_id', allow_null=True, read_only=True)
    owner_name = serializers.SerializerMethodField()
    allowed_roles = serializers.ListField(child=serializers.CharField())
    label = serializers.CharField(max_length=255, allow_blank=True)
    preview = serializers.CharField(read_only=True)
    default = serializers.BooleanField()

    class Meta:
        model = DataUpAPIKey
        fields = [
            'id', 'name', "owner_name",'allowed_roles', 'label', 'preview', 'default', 'created_at', 'last_used_at'
        ]
        read_only_fields = ['id', 'created_at', 'last_used_at', 'preview']

    def get_owner_name(self, obj):
        if obj.owner and obj.owner.user:
            return obj.owner.user.username
        return None

class DataUpAPIKeyWriteSerializer(serializers.ModelSerializer):
    """Serializer for creating/updating DataUp API keys.
       NOTE: Accepts DataUp PKs directly (organization, owner). Any mapping from
       core Organization/User → DataUp should be handled in the view/service layer.
    """
    key = serializers.CharField(max_length=255)
    name = serializers.CharField(max_length=255)
    organization = serializers.PrimaryKeyRelatedField(
        queryset=DataUpOrganization.objects.all(),
        allow_null=True,
        required=False,
        help_text="DataUp organization this key belongs to. May be used together with 'owner'."
    )
    owner = serializers.PrimaryKeyRelatedField(
        queryset=DataUpUser.objects.all(),
        allow_null=True,
        required=False,
        help_text="DataUp user this key belongs to. May be used together with 'organization'."
    )
    allowed_roles = serializers.ListField(
        child=serializers.CharField(max_length=16),
        default=list,
        allow_null=True,
        required=False,
        help_text="CVAT org roles allowed to use this API key (enforced for org-only keys; user-owned keys bypass)."
    )
    label = serializers.CharField(max_length=255, required=False, allow_blank=True)
    default = serializers.BooleanField(required=False, default=False)

    class Meta:
        model = DataUpAPIKey
        fields = [
            'id', 'key', 'name', 'organization', 'owner', 'allowed_roles',
            'label', 'default', 'created_at', 'last_used_at'
        ]
        read_only_fields = ['id', 'created_at', 'last_used_at']

    # --- Field-level validation ---

    def validate_key(self, value: str) -> str:
        v = (value or "").strip()
        if not v:
            raise serializers.ValidationError("API key cannot be empty.")
        return v

    def validate_name(self, value: str) -> str:
        v = (value or "").strip()
        if not v:
            raise serializers.ValidationError("Name cannot be empty.")
        return v

    def validate_allowed_roles(self, value):
        if value is None:
            return []
        allowed = set(_valid_membership_roles())
        out, seen = [], set()
        for role in value:
            if role is None:
                raise serializers.ValidationError("Role cannot be null.")
            r = role.strip().lower()
            if r not in allowed:
                raise serializers.ValidationError(
                    f"Invalid role: {role}. Valid roles are: {', '.join(sorted(allowed))}"
                )
            if r not in seen:
                seen.add(r)
                out.append(r)
        return out

    # --- Object-level validation ---

    def validate(self, attrs):
        """
        Require at least one scope: 'owner' and/or 'organization'.
        Both empty is invalid; both set is allowed.
        """
        owner = attrs.get('owner', getattr(self.instance, 'owner', None))
        organization = attrs.get('organization', getattr(self.instance, 'organization', None))

        if not owner and not organization:
            raise serializers.ValidationError(
                "Provide at least one of 'owner' or 'organization'."
            )
        return attrs
