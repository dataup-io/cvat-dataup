# Copyright (C) 2024 CVAT.ai Corporation
#
# SPDX-License-Identifier: MIT

from cvat.apps.dataup.agents.payload import build_infer_payload
from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, extend_schema
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.core.exceptions import ValidationError
from cvat.apps.dataup.iam.policy import DataUpPolicyEnforcer
from cvat.apps.dataup.iam.context import get_dataup_iam_context, get_dataup_organization
from cvat.apps.dataup.agents.serializers import (
    AgentInferenceRequest,
    AgentReadSerializer,
    AgentWriteSerializer,
    AgentJobSerializer,
    AgentJobCreateSerializer,
)
from cvat.apps.dataup.utils.converters import DataUpAgentResultConverter
from cvat.apps.dataup.dataup_api import DataUpAPIClient, DataUpAPIError
from rest_framework import status, viewsets
from cvat.apps.dataup.dataup_api.client import DataUpAPIClientMixin
from cvat.apps.dataup.agents.jobs import AgentQueue, AgentJob

class AgentViewSet(DataUpAPIClientMixin, viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, DataUpPolicyEnforcer]
    iam_context_factory = staticmethod(get_dataup_iam_context)
    iam_organization_field = "organization"

    @extend_schema(
        summary="List all agent APIs",
        description="Returns a list of agent APIs",
        responses={
            200: AgentReadSerializer(many=True),
        },
        parameters=[
            OpenApiParameter(
                "agent_type",
                description="Filter by agent type",
                required=False,
                type=str,
            ),
        ],
    )
    def list(self, request):
        try:
            resp = self.dataup_client.make_request("GET", "agents/")
            agents_data = resp.json().get("items", [])
            serializer = AgentReadSerializer(data=agents_data, many=True)
            serializer.is_valid(raise_exception=True)
            return Response(serializer.validated_data, status=resp.status_code)
        except DataUpAPIError as e:
            return Response({"message": e.message}, status=e.status_code)

    @extend_schema(
        summary="Get a specific agent API",
        description="Returns details of a specific agent API",
        responses={
            200: AgentReadSerializer,
            404: OpenApiResponse(description="Agent API not found"),
        },
    )
    def retrieve(self, request, pk=None):
        try:
            resp = self.dataup_client.make_request("GET", f"agents/{pk}")
            data = resp.json() if resp.content else {}
            serializer = AgentReadSerializer(instance=data)
            return Response(serializer.data, status=resp.status_code)
        except DataUpAPIError as e:
            return Response({"error": str(e)}, status=e.status_code)

    @extend_schema(
        summary="Create a new agent API",
        description="Creates a new agent API",
        request=AgentWriteSerializer,
        responses={
            201: AgentReadSerializer,
            400: OpenApiResponse(description="Invalid input data"),
        },
    )
    def create(self, request):
        serializer = AgentWriteSerializer(data=request.data)
        if serializer.is_valid():
            agent_data = serializer.validated_data
            try:
                response = self.dataup_client.make_request("POST", "agents/", data=agent_data)

                response_data = response.json() if response.content else {}
                # Serialize the response data to exclude auth_token
                if response.status_code == 201 and response_data:
                    read_serializer = AgentReadSerializer(response_data)
                    response_data = read_serializer.data

                return Response(response_data, status=response.status_code)
            except DataUpAPIError as e:
                return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @extend_schema(
        summary="Update an agent API",
        description="Updates an existing agent API",
        request=AgentWriteSerializer,
        responses={
            200: AgentReadSerializer,
            400: OpenApiResponse(description="Invalid input data"),
            404: OpenApiResponse(description="Agent API not found"),
        },
    )
    def update(self, request, pk=None, partial=False):
        serializer = AgentWriteSerializer(data=request.data, partial=partial)
        if serializer.is_valid():
            try:
                response = self.dataup_client.make_request(
                    "PATCH", f"agents/{pk}", data=serializer.validated_data
                )
                response_data = response.json() if response.content else {}
                # Serialize the response data to exclude auth_token
                if response.status_code == 200 and response_data:
                    read_serializer = AgentReadSerializer(response_data)
                    response_data = read_serializer.data

                return Response(response_data, status=response.status_code)
            except DataUpAPIError as e:
                return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @extend_schema(
        summary="Delete an agent API",
        description="Deletes an agent API",
        responses={
            204: OpenApiResponse(description="Agent API deleted"),
            404: OpenApiResponse(description="Agent API not found"),
        },
    )
    def destroy(self, request, pk=None):
        try:
            resp = self.dataup_client.make_request("DELETE", f"agents/{pk}")
            return Response(status=resp.status_code)
        except DataUpAPIError as e:
            return Response({"message": e.message}, status=e.status_code)

    @extend_schema(
        summary="Call an agent API for inference",
        description="Calls an agent API for inference on a task",
        request=AgentInferenceRequest,
        parameters=[
            OpenApiParameter(
                "X-Organization",
                description="Organization slug for multi-tenant context",
                required=False,
                type=str,
                location=OpenApiParameter.HEADER,
            ),
        ],
        responses={
            200: OpenApiResponse(description="Inference results"),
            400: OpenApiResponse(description="Invalid input"),
            404: OpenApiResponse(description="Agent API not found"),
        },
    )
    @action(detail=True, methods=["post"], url_path="infer")
    def infer(self, request, pk=None):
        serialized_input = AgentInferenceRequest(data=request.data)
        serialized_input.is_valid(raise_exception=True)
        inference_data = serialized_input.validated_data

        label_mapping = inference_data["params"].get("mapping", {})
        task_type = inference_data["params"].get("type", "annotate_frame")
        organization_uuid = get_dataup_organization(request).id
        payload = build_infer_payload(
            organization_uuid,
            inference_data["task_id"],
            inference_data["frame_ids"],
            inference_data["params"],
            task_type=task_type
        )

        try:
            resp = self.dataup_client.make_request(
                "POST", f"agents/{pk}/infer", data=payload
            )
            body = resp.json() if resp.content else {}
        except DataUpAPIError as e:
            return Response({"message": e.message}, status=e.status_code)

        frame_ids = inference_data["frame_ids"]
        data = body.get("data", None)
        if data is None:
            return Response(
                {"message": "No data found in agent response body"},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        converter = DataUpAgentResultConverter(
            task_id=inference_data["task_id"], label_mapping=label_mapping, task_type=task_type
        )
        converted_outputs = converter.convert(frame_ids, data)
        return Response(
            data=converted_outputs, status=status.HTTP_200_OK
        )




class AgentJobsViewSet(DataUpAPIClientMixin, viewsets.ViewSet):
    permission_classes = [IsAuthenticated, DataUpPolicyEnforcer]
    iam_context_factory = staticmethod(get_dataup_iam_context)
    iam_organization_field = "organization"

    @extend_schema(
        summary="List all agent jobs",
        description="Returns a list of all agent jobs",
        responses={
            200: AgentJobSerializer(many=True),
            500: OpenApiResponse(description="Internal server error"),
        },
        parameters=[
            OpenApiParameter(
                "X-Organization",
                description="Organization slug for multi-tenant context",
                required=False,
                type=str,
                location=OpenApiParameter.HEADER,
            ),
        ],
    )
    def list(self, request):
        """List all agent jobs"""
        try:
            agent_queue = AgentQueue(self.dataup_client)
            jobs = agent_queue.get_jobs()

            job_data = []
            for job in jobs:
                job_data.append(job.to_dict())

            serializer = AgentJobSerializer(job_data, many=True)
            return Response(serializer.data, status=status.HTTP_200_OK)

        except Exception as e:
            return Response(
                {"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @extend_schema(
        summary="Create a new agent job",
        description="Creates a new agent job",
        request=AgentJobCreateSerializer,
        responses={
            201: AgentJobSerializer,
            400: OpenApiResponse(description="Invalid input data"),
            500: OpenApiResponse(description="Internal server error"),
        },
        parameters=[
            OpenApiParameter(
                "X-Organization",
                description="Organization slug for multi-tenant context",
                required=False,
                type=str,
                location=OpenApiParameter.HEADER,
            ),
        ],
    )
    def create(self, request):
        """Create a new agent job"""
        serializer = AgentJobCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        try:
            agent_queue = AgentQueue(self.dataup_client)
            # Extract validated data
            data = serializer.validated_data
            agent_id = data["agent_id"]
            task_id = data["task_id"]
            job_id = data.get("job_id")
            threshold = data.get("threshold", 0.5)
            mapping = data.get("mapping", {})
            cleanup = data.get("cleanup", False)
            conv_mask_to_poly = data.get("conv_mask_to_poly", False)
            max_distance = data.get("max_distance", 50)
            frame_ids = data.get("frame_ids")
            # Enqueue the job
            agent_job = agent_queue.enqueue(
                agent_id=agent_id,
                threshold=threshold,
                task_id=task_id,
                mapping=mapping,
                cleanup=cleanup,
                conv_mask_to_poly=conv_mask_to_poly,
                max_distance=max_distance,
                request=request,
                job_id=job_id,
                frame_ids=frame_ids
            )

            # Return job details
            job_data = {
                "id": agent_job.job.id,
                "status": agent_job.get_status(),
                "created_at": agent_job.job.created_at,
                "started_at": agent_job.job.started_at,
                "ended_at": agent_job.job.ended_at,
                "result": agent_job.job.result,
                "exc_info": agent_job.job.exc_info,
                "meta": agent_job.job.meta,
            }

            response_serializer = AgentJobSerializer(job_data)
            return Response(response_serializer.data, status=status.HTTP_201_CREATED)

        except Exception as e:
            return Response(
                {"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @extend_schema(
        summary="Retrieve a specific agent job",
        description="GET: Retrieve a specific agent job by ID",
        responses={
            200: AgentJobSerializer,
            404: OpenApiResponse(description="Job not found"),
            500: OpenApiResponse(description="Internal server error"),
        },
        parameters=[
            OpenApiParameter(
                "X-Organization",
                description="Organization slug for multi-tenant context",
                required=False,
                type=str,
                location=OpenApiParameter.HEADER,
            ),
        ],
    )
    def retrieve(self, request, pk=None):
        """Retrieve a specific agent job by ID"""
        try:
            agent_queue = AgentQueue(self.dataup_client)
            job = agent_queue.fetch_job(pk)

            serializer = AgentJobSerializer(job.to_dict())
            return Response(serializer.data, status=status.HTTP_200_OK)

        except ValidationError as e:
            return Response(
                {"error": str(e)}, status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            return Response(
                {"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @extend_schema(
        summary="Cancel a specific agent job",
        description="DELETE: Cancel a specific agent job by ID",
        responses={
            204: OpenApiResponse(description="Job cancelled successfully"),
            404: OpenApiResponse(description="Job not found"),
            500: OpenApiResponse(description="Internal server error"),
        },
        parameters=[
            OpenApiParameter(
                "X-Organization",
                description="Organization slug for multi-tenant context",
                required=False,
                type=str,
                location=OpenApiParameter.HEADER,
            ),
        ],
    )
    def destroy(self, request, pk):
        try:
            queue = AgentQueue(self.dataup_client)
            rq_job = queue.fetch_job(pk)
            rq_job.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except Exception as e:
            return Response(
                {"error": str(e)}, status=status.HTTP_404_NOT_FOUND
            )