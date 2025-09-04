# Copyright (C) 2024 CVAT.ai Corporation
#
# SPDX-License-Identifier: MIT

from cvat.apps.dataup.agents.payload import build_infer_payload
from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, extend_schema
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from cvat.apps.engine.serializers import LabeledDataSerializer
from cvat.apps.dataup.agents.permissions import DataUpPolicyEnforcer
from cvat.apps.dataup.agents.serializers import AgentInferenceRequest, AgentReadSerializer, AgentWriteSerializer
from cvat.apps.dataup.views.base import DataUpBaseViewSet
from cvat.apps.dataup.utils.converters import DataUpDetectionResultConverter
from cvat.apps.engine.models import Task

class AgentViewSet(DataUpBaseViewSet):
    permission_classes = [IsAuthenticated, DataUpPolicyEnforcer]
    iam_organization_field = "organization"

    @extend_schema(
        summary="List all agent APIs",
        description="Returns a list of agent APIs",
        responses={
            200: AgentReadSerializer(many=True),
        },
        parameters=[
            OpenApiParameter(
                "agent_type", description="Filter by agent type", required=False, type=str
            ),
        ],
    )
    def list(self, request):
        params = {}
        agent_type = request.query_params.get("agent_type", None)
        if agent_type:
            params["agent_type"] = agent_type
        params = self.add_organization_params(params)
        response = self.make_dataup_request("GET", "agents/", params=params)

        if response.status_code == 200 and response.data:
            try:
                serializer = AgentReadSerializer(response.data['items'], many=True)
                response.data['items'] = serializer.data
            except Exception as e:
                print(response.data)
                print(f"Error serializing agent data: {e}")
                response.data = []

        return response

    @extend_schema(
        summary="Get a specific agent API",
        description="Returns details of a specific agent API",
        responses={
            200: AgentReadSerializer,
            404: OpenApiResponse(description="Agent API not found"),
        },
    )
    def retrieve(self, request, pk=None):
        response = self.make_dataup_request("GET", f"agents/{pk}")

        # Serialize the response data to exclude auth_token
        if response.status_code == 200 and response.data:
            serializer = AgentReadSerializer(response.data)
            response.data = serializer.data

        return response

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
            agent_data = self.add_owner_data(agent_data)

            # Make request to DataUP backend
            response = self.make_dataup_request(
                "POST", "agents/", data=agent_data, success_status=status.HTTP_201_CREATED
            )

            # Serialize the response data to exclude auth_token
            if response.status_code == 201 and response.data:
                read_serializer = AgentReadSerializer(response.data)
                response.data = read_serializer.data

            return response
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
            response = self.make_dataup_request("PATCH", f"agents/{pk}", data=serializer.validated_data)

            # Serialize the response data to exclude auth_token
            if response.status_code == 200 and response.data:
                read_serializer = AgentReadSerializer(response.data)
                response.data = read_serializer.data

            return response
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
        return self.make_dataup_request(
            "DELETE", f"agents/{pk}", success_status=status.HTTP_204_NO_CONTENT
        )

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
        serializer = AgentInferenceRequest(data=request.data)

        if serializer.is_valid():
            inference_data = serializer.validated_data
            label_mapping = inference_data["params"].get("mapping", {})
            converter = DataUpDetectionResultConverter(task_id=inference_data['task_id'], label_mapping=label_mapping)
            payload = build_infer_payload(inference_data['task_id'], inference_data['frame_ids'], inference_data['params'])
            response =  self.make_dataup_request(
                'POST', f'agents/{pk}/infer',
                data=payload
                )
            outputs = converter.convert(inference_data['frame_ids'], response.data["data"])
            serialized_output = LabeledDataSerializer(data=outputs)
            if serialized_output.is_valid():
                return Response(data=serialized_output.validated_data, status=status.HTTP_200_OK)
            else:
                return Response(data=serialized_output.errors, status=status.HTTP_400_BAD_REQUEST)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
