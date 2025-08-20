# Copyright (C) 2024 CVAT.ai Corporation
#
# SPDX-License-Identifier: MIT

from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from drf_spectacular.utils import extend_schema, OpenApiResponse
from django.conf import settings
import requests

class HealthViewSet(viewsets.ViewSet):
    # Simple ViewSet without authentication or model requirements
    @extend_schema(
        summary='Check organization verification status',
        description='Checks if the organization is verified with DataUP backend',
        responses={
            200: OpenApiResponse(description='Organization status retrieved'),
            404: OpenApiResponse(description='Organization not found'),
            500: OpenApiResponse(description='Internal server error'),
        },
    )
    @action(detail=False, methods=['get'], url_path='organization-status')
    def organization_status(self, request):
        """
        Check organization verification status with DataUP backend.

        Returns:
            Response: JSON response with organization status
                     {"status": "unknown"/"registered"/"pre-registered"}
        """
        print("Preparing to send request to health", request)
        organization_uuid = request.query_params.get('organization_uuid')
        print("Organization uuid", organization_uuid)
        try:
            # Get organization UUID from URL parameter or query parameter
            organization_uuid = request.query_params.get('organization_uuid')
            if not organization_uuid:
                return Response(
                    {"status": "unknown", "message": "No organization_uuid provided"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            url = f"{settings.DATAUP_BASE_URL}/healthz/orgs/{organization_uuid}"
            print("Sending health request using url", url)
            response = requests.get(url)
            print(response)
            return Response(
                response.json(),
                status=response.status_code
            )

        except Exception as e:
            return Response(
                {"status": "unknown", "error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )