# Copyright (C) 2023-2024 CVAT.ai Corporation
#
# SPDX-License-Identifier: MIT

from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, extend_schema
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from .report.get import get_class_distribution


@extend_schema(
    summary="Get class distribution",
    methods=["GET"],
    operation_id="analytics_get_class_distribution",
    description="Retrieve object count per class for a given project, task, or job.",
    parameters=[
        OpenApiParameter("project_id", OpenApiTypes.INT, required=False, description="Project ID"),
        OpenApiParameter("task_id", OpenApiTypes.INT, required=False, description="Task ID"),
        OpenApiParameter("job_id", OpenApiTypes.INT, required=False, description="Job ID"),
    ],
    responses={
        "200": OpenApiResponse(
            description="Returns class distribution data",
        ),
        "400": OpenApiResponse(description="Bad request - missing parameters"),
    },
)
class GetClassDistributionView(APIView):
    """
    API View to retrieve object count per class for a given project, task, or job.
    """

    permission_classes = [IsAuthenticated]  # Ensures authentication is required

    @extend_schema(
        summary="Get class distribution",
        methods=["GET"],
        operation_id="analytics_get_class_distribution",
        description="Retrieve object count per class for a given project, task, or job.",
        parameters=[
            OpenApiParameter(
                "project_id", OpenApiTypes.INT, required=False, description="Project ID"
            ),
            OpenApiParameter("task_id", OpenApiTypes.INT, required=False, description="Task ID"),
            OpenApiParameter("job_id", OpenApiTypes.INT, required=False, description="Job ID"),
        ],
        responses={
            "200": OpenApiResponse(description="Returns class distribution data"),
            "400": OpenApiResponse(description="Bad request - missing parameters"),
        },
    )
    def get(self, request):
        """Handles GET request to return class distribution"""
        task_id = request.query_params.get("task_id")
        job_id = request.query_params.get("job_id")
        project_id = request.query_params.get("project_id")

        if not (task_id or job_id or project_id):
            return Response({"error": "Specify task_id, job_id, or project_id"}, status=400)

        stats = get_class_distribution(task_id=task_id, job_id=job_id, project_id=project_id)
        return Response(stats)
