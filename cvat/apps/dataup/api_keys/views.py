from django.http import Http404
from django.contrib.auth.models import User
from django.utils.translation import gettext_lazy as _
from rest_framework import viewsets
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from drf_spectacular.utils import extend_schema, extend_schema_view, OpenApiResponse

from cvat.apps.dataup.models import DataUpOrganization, DataUpUser
from cvat.apps.dataup.api_keys.models import DataUpAPIKey
from cvat.apps.dataup.api_keys.serializers import (
    DataUpAPIKeyReadSerializer,
    DataUpAPIKeyWriteSerializer,
)
from cvat.apps.dataup.api_keys.permissions import DataUpAPIKeyPerm, DataUpPolicyEnforcer


@extend_schema_view(
    list=extend_schema(
        summary="List API keys",
        description="Retrieve a list of API keys. Optionally filter by organization slug via ?org=<slug>.",
        tags=["DataUp API Keys"],
        responses={200: DataUpAPIKeyReadSerializer(many=True)},
    ),
    create=extend_schema(
        summary="Create API key",
        description="Create a new API key (user-only, org-only, or user+org). "
                    "You may pass ?org=<slug> or body {org: <slug>} to set organization by slug.",
        tags=["DataUp API Keys"],
        responses={201: OpenApiResponse(description='API Key created')},
    ),
    retrieve=extend_schema(
        summary="Get API key",
        description="Retrieve details of a specific API key.",
        tags=["DataUp API Keys"],
        responses={200: DataUpAPIKeyReadSerializer},
    ),
    update=extend_schema(
        summary="Update API key",
        description="Update an existing API key.",
        tags=["DataUp API Keys"],
    ),
    partial_update=extend_schema(
        summary="Partially update API key",
        description="Partially update an existing API key.",
        tags=["DataUp API Keys"],
    ),
    destroy=extend_schema(
        summary="Delete API key",
        description="Delete an API key.",
        tags=["DataUp API Keys"],
    ),
)
class DataUpAPIKeyViewSet(viewsets.ModelViewSet):
    """
    CRUD for DataUp API keys.

    - Write ops accept DataUp PKs directly (organization, owner).
    - You may also specify organization by slug via ?org=<slug> or body {"org": "<slug>"}.
    - If neither 'owner' nor 'organization' provided, defaults to a personal key for the current user.
    """
    serializer_class = DataUpAPIKeyWriteSerializer
    permission_classes = [IsAuthenticated, DataUpPolicyEnforcer]
    search_fields = ["name", "label"]
    ordering_fields = ["name", "label", "created_at", "last_used_at"]
    ordering = ["-created_at"]
    iam_organization_field = None

    def get_serializer_class(self):
        return DataUpAPIKeyReadSerializer if self.action in ("list", "retrieve") else DataUpAPIKeyWriteSerializer

    def get_queryset(self):
        qs = DataUpAPIKey.objects.select_related("organization", "owner").all()
        org_slug = self.request.query_params.get("org")

        if org_slug:
            org = self.get_dataup_org(org_slug)
            return qs.filter(organization_id=org.id)
        else:
            return qs.filter(owner_id=self.get_dataup_user(self.request.user).id, organization=None)

    def create(self, request, *args, **kwargs):
        try:
            dataup_user = self.get_dataup_user(request.user)
        except Http404:
            raise ValidationError({"owner": _("No DataUp user linked to the current account.")})

        org_slug = kwargs.get("org_slug") or request.query_params.get("org") or request.data.get("org")
        dataup_org = None
        if org_slug:
            try:
                dataup_org = self.get_dataup_org(org_slug)
            except Http404:
                raise ValidationError({"org": _("Organization not found.")})

        payload = request.data.copy()
        payload["owner"] = str(dataup_user.id)
        payload["organization"] = None
        if dataup_org:
            payload["organization"] = str(dataup_org.id)

        serializer = self.get_serializer(data=payload)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)

        return Response(
            DataUpAPIKeyReadSerializer(serializer.instance).data,
            status=201,
            headers=self.get_success_headers(serializer.data)
        )

    def perform_create(self, serializer):
        serializer.save()

    def perform_update(self, serializer):
        from django.utils import timezone
        instance = self.get_object()
        old_key = instance.key

        instance = serializer.save()

        if 'key' in serializer.validated_data and instance.key != old_key:
            instance.last_used_at = timezone.now()
            instance.save(update_fields=['last_used_at'])

    def destroy(self, request, *args, **kwargs):
        """
        Custom destroy to avoid 'Must be Organization instance' error
        and allow IAM to check proper access.
        """
        instance = self.get_object()
        self.perform_destroy(instance)
        return Response(status=204)

    def list(self, request, *args, **kwargs):
        qs = self.get_queryset()
        page = self.paginate_queryset(qs)
        serializer = DataUpAPIKeyReadSerializer(page or qs, many=True)
        if page is not None:
            return self.get_paginated_response(serializer.data)
        return Response(serializer.data)

    # ---- Helpers ---------------------------------------------------------

    def get_dataup_org(self, org_slug: str) -> DataUpOrganization:
        try:
            return DataUpOrganization.objects.select_related('organization').get(
                organization__slug=org_slug
            )
        except DataUpOrganization.DoesNotExist:
            raise Http404("DataUp organization not found")

    def get_dataup_user(self, user: User) -> DataUpUser:
        try:
            return DataUpUser.objects.select_related('user').get(user=user)
        except DataUpUser.DoesNotExist:
            raise Http404("DataUp user not found")
