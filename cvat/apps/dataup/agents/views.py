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
)
from cvat.apps.dataup.utils.converters import DataUpAgentResultConverter
from cvat.apps.dataup.dataup_api import DataUpAPIError
from rest_framework import status, viewsets
from cvat.apps.dataup.dataup_api.client import DataUpAPIClientMixin
from asgiref.sync import async_to_sync
# from cvat.apps.dataup.agents.jobs import AgentQueue, AgentJob


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
        client = self.dataup_client
        return async_to_sync(self._alist)(request, client)

    async def _alist(self, request, client, *args, **kwargs):
        try:
            resp = await client.make_request("GET", "agents/")
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
    def retrieve(self, request, pk=None, *args, **kwargs):
        client = self.dataup_client
        return async_to_sync(self._aretrieve)(request, client, pk, *args, **kwargs)

    async def _aretrieve(self, request, client, pk=None, *args, **kwargs):
        try:
            resp = await client.make_request("GET", f"agents/{pk}")
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
    def create(self, request, *args, **kwargs):
        client = self.dataup_client
        return async_to_sync(self._acreate)(request, client, *args, **kwargs)

    async def _acreate(self, request, client, *args, **kwargs):
        serializer = AgentWriteSerializer(data=request.data)
        if serializer.is_valid():
            agent_data = serializer.validated_data
            try:
                response = await client.make_request("POST", "agents/", data=agent_data)

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
    def update(self, request, pk=None, partial=False, *args, **kwargs):
        client = self.dataup_client
        return async_to_sync(self._aupdate)(request, client, pk, partial, *args, **kwargs)

    async def _aupdate(self, request, client, pk=None, partial=False, *args, **kwargs):
        serializer = AgentWriteSerializer(data=request.data, partial=partial)
        if serializer.is_valid():
            try:
                response = await client.make_request("PATCH", f"agents/{pk}", data=serializer.validated_data)
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
    def destroy(self, request, pk=None, *args, **kwargs):
        client = self.dataup_client
        return async_to_sync(self._adestroy)(request, client, pk, *args, **kwargs)

    async def _adestroy(self, request, client, pk=None, *args, **kwargs):
        try:
            resp = await client.make_request("DELETE", f"agents/{pk}")
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
    def infer(self, request, pk=None, *args, **kwargs):
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
            task_type=task_type,
        )
        client = self.dataup_client
        response = async_to_sync(self._ainfer)(client, payload, pk, *args, **kwargs)
        frame_ids = inference_data["frame_ids"]
        data = response.get("data", None)
        if data is None:
            return Response(
                {"message": "No data found in agent response body"},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        converter = DataUpAgentResultConverter(
            task_id=inference_data["task_id"],
            label_mapping=label_mapping,
            task_type=task_type,
        )
        converted_outputs = converter.convert(frame_ids, data)
        return Response(data=converted_outputs, status=status.HTTP_200_OK)

    async def _ainfer(self, client, payload, pk=None, *args, **kwargs):
        try:
            resp = await client.make_request("POST", f"agents/{pk}/infer", data=payload)
            return resp.json() if resp.content else {}
        except DataUpAPIError as e:
            return Response({"message": e.message}, status=e.status_code)
