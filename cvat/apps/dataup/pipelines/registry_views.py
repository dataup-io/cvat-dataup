# Copyright (C) 2024 CVAT.ai Corporation
#
# SPDX-License-Identifier: MIT

import requests
from django.conf import settings
from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, extend_schema
from rest_framework import status, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from cvat.apps.dataup.dataup_api.base import DataUpBaseViewSet


class StepRegistryViewSet(DataUpBaseViewSet):
    permission_classes = [IsAuthenticated]
    iam_organization_field = "organization"

    @extend_schema(
        summary="List all available steps",
        description="Returns a list of available steps from the registry",
        responses={
            200: OpenApiResponse(description="List of available steps"),
        },
        parameters=[
            OpenApiParameter(
                "type", description="Filter by step type", required=False, type=str
            ),
        ],
    )
    def list(self, request):
        params = {}
        step_type = request.query_params.get("type", None)
        if step_type:
            params["step_type"] = step_type

        params = self.add_organization_params(params)
        return self.make_dataup_request("GET", "steps/", params=params)
