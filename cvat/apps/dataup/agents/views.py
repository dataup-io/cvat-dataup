# Copyright (C) 2024 CVAT.ai Corporation
#
# SPDX-License-Identifier: MIT

from rest_framework import status
from rest_framework.response import Response
from rest_framework.decorators import action
from drf_spectacular.utils import extend_schema, OpenApiParameter, OpenApiResponse

from cvat.apps.dataup.views.base import DataUpBaseViewSet
from cvat.apps.dataup.agents.serializers import AgentSerializer, AgentInferSerializer
from rest_framework.permissions import IsAuthenticated
from cvat.apps.dataup.agents.permissions import DataUpPolicyEnforcer


class AgentViewSet(DataUpBaseViewSet):
    permission_classes = [IsAuthenticated, DataUpPolicyEnforcer]
    iam_organization_field = "organization"

    @extend_schema(
        summary='List all agent APIs',
        description='Returns a list of agent APIs',
        responses={
            200: OpenApiResponse(description='List of agent APIs'),
        },
        parameters=[
            OpenApiParameter('agent_type', description='Filter by agent type', required=False, type=str),
        ],
    )
    def list(self, request):
        params = {}
        agent_type = request.query_params.get('agent_type', None)
        if agent_type:
            params['agent_type'] = agent_type
        params = self.add_organization_params(params)
        return self.make_dataup_request('GET', 'agents/', params=params)

    @extend_schema(
        summary='Get a specific agent API',
        description='Returns details of a specific agent API',
        responses={
            200: OpenApiResponse(description='Agent API details'),
            404: OpenApiResponse(description='Agent API not found'),
        },
    )
    def retrieve(self, request, pk=None):
        return self.make_dataup_request('GET', f'agents/{pk}')

    @extend_schema(
        summary='Create a new agent API',
        description='Creates a new agent API',
        responses={
            201: OpenApiResponse(description='Agent API created'),
            400: OpenApiResponse(description='Invalid input'),
        },
    )
    def create(self, request):
        serializer = AgentSerializer(data=request.data)
        if serializer.is_valid():
            agent_data = serializer.validated_data
            agent_data = self.add_owner_data(agent_data)

            # Make request to DataUP backend
            return self.make_dataup_request(
                'POST', 'agents/',
                data=agent_data,
                success_status=status.HTTP_201_CREATED
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @extend_schema(
        summary='Update an agent API',
        description='Updates an existing agent API',
        responses={
            200: OpenApiResponse(description='Agent API updated'),
            400: OpenApiResponse(description='Invalid input'),
            404: OpenApiResponse(description='Agent API not found'),
        },
    )
    def update(self, request, pk=None, partial=False):
        serializer = AgentSerializer(data=request.data, partial=partial)
        if serializer.is_valid():
            return self.make_dataup_request(
                'PATCH', f'agents/{pk}',
                data=serializer.validated_data
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @extend_schema(
        summary='Delete an agent API',
        description='Deletes an agent API',
        responses={
            204: OpenApiResponse(description='Agent API deleted'),
            404: OpenApiResponse(description='Agent API not found'),
        },
    )
    def destroy(self, request, pk=None):
        return self.make_dataup_request(
            'DELETE', f'agents/{pk}',
            success_status=status.HTTP_204_NO_CONTENT
        )

    @extend_schema(
        summary='Call an agent API for inference',
        description='Calls an agent API for inference on a task',
        responses={
            200: OpenApiResponse(description='Inference results'),
            400: OpenApiResponse(description='Invalid input'),
            404: OpenApiResponse(description='Agent API not found'),
        },
    )

    @action(detail=True, methods=['post'], url_path='infer')
    def infer(self, request, pk=None):
        serializer = AgentInferSerializer(data=request.data)
    
        if serializer.is_valid():
            infer_data = serializer.validated_data
            return []
            # return self.make_dataup_request(
            #     'POST', f'agents/{pk}/infer',
            #     data=infer_data
            # )

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)