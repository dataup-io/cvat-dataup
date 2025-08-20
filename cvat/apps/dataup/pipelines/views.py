# Copyright (C) 2024 CVAT.ai Corporation
#
# SPDX-License-Identifier: MIT

from rest_framework import status
from rest_framework.response import Response
from rest_framework.decorators import action
from drf_spectacular.utils import extend_schema, OpenApiParameter, OpenApiResponse

from cvat.apps.dataup.views.base import DataUpBaseViewSet
from cvat.apps.dataup.pipelines.serializers import (
    PipelineSerializer, PipelineCreateSerializer, PipelineUpdateSerializer,
    PipelineRunSerializer, PipelineResponseSerializer
)


class PipelineViewSet(DataUpBaseViewSet):
    """
    ViewSet for managing Pipelines.

    This ViewSet provides endpoints for listing, retrieving, creating, updating,
    and deleting pipelines, as well as running pipelines and tracking usage.
    """

    @extend_schema(
        summary='List all pipelines',
        description='Returns a list of pipelines',
        responses={
            200: OpenApiResponse(description='List of pipelines'),
        },
        parameters=[
            OpenApiParameter('name', description='Filter by name', required=False, type=str),
        ],
    )
    def list(self, request):

        params = {}
        name = request.query_params.get('name', None)
        if name:
            params['name'] = name
        params = self.add_organization_params(params)
        return self.make_dataup_request('GET', 'pipelines/', params=params)

    @extend_schema(
        summary='Get a pipeline',
        description='Returns a pipeline',
        responses={
            200: OpenApiResponse(description='Pipeline details'),
            404: OpenApiResponse(description='Pipeline not found'),
        },
    )
    def retrieve(self, request, pk=None):
        # Make request to DataUP backend
        return self.make_dataup_request('GET', f'pipelines/{pk}')

    @extend_schema(
        summary='Create a pipeline',
        description='Creates a new pipeline',
        responses={
            201: OpenApiResponse(description='Pipeline created'),
            400: OpenApiResponse(description='Invalid input'),
        },
    )
    def create(self, request):
        serializer = PipelineCreateSerializer(data=request.data)

        if serializer.is_valid():
            request_data = serializer.validated_data
            request_data = self.add_owner_data(request_data)
            return self.make_dataup_request(
                'POST', 'pipelines/',
                data=request_data,
                success_status=status.HTTP_201_CREATED
            )

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @extend_schema(
        summary='Update a pipeline',
        description='Updates a pipeline',
        responses={
            200: OpenApiResponse(description='Pipeline updated'),
            400: OpenApiResponse(description='Invalid input'),
            404: OpenApiResponse(description='Pipeline not found'),
        },
    )
    def update(self, request, pk=None):
        serializer = PipelineUpdateSerializer(data=request.data)

        if serializer.is_valid():
            request_data = serializer.validated_data
            return self.make_dataup_request(
                'PUT', f'pipelines/{pk}',
                data=request_data
            )

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @extend_schema(
        summary='Delete a pipeline',
        description='Deletes a pipeline',
        responses={
            204: OpenApiResponse(description='Pipeline deleted'),
            404: OpenApiResponse(description='Pipeline not found'),
        },
    )
    def destroy(self, request, pk=None):
        return self.make_dataup_request('DELETE', f'pipelines/{pk}')


    # @extend_schema(
    #     summary='Run a pipeline',
    #     description='Runs a pipeline',
    #     responses={
    #         200: OpenApiResponse(description='Pipeline execution started'),
    #         400: OpenApiResponse(description='Invalid input'),
    #         404: OpenApiResponse(description='Pipeline not found'),
    #     },
    # )
    # @action(detail=True, methods=['post'], url_path='run')
    # def run(self, request, pk=None):
    #     serializer = PipelineRunSerializer(data=request.data)

    #     if serializer.is_valid():
    #         # Prepare request data
    #         request_data = serializer.validated_data

    #         # Add owner and organization information
    #         request_data = self.add_owner_data(request_data)

    #         # Make request to DataUP backend
    #         try:
    #             headers = {}
    #             auth_token = request.session.get('token')
    #             if auth_token:
    #                 headers['Authorization'] = f'Bearer {auth_token}'

    #             response = requests.post(
    #                 f"{settings.DATAUP_API_URL}/pipelines/{pk}/run",
    #                 json=request_data,
    #                 headers=headers
    #             )
    #             response.raise_for_status()
    #             return Response(response.json())
    #         except requests.exceptions.RequestException as e:
    #             if e.response and e.response.status_code == 404:
    #                 return Response(
    #                     {"error": "Pipeline not found"},
    #                     status=status.HTTP_404_NOT_FOUND
    #                 )
    #             if e.response and e.response.status_code == 400:
    #                 return Response(
    #                     e.response.json(),
    #                     status=status.HTTP_400_BAD_REQUEST
    #                 )
    #             return Response(
    #                 {"error": f"Error calling DataUP API: {str(e)}"},
    #                 status=status.HTTP_500_INTERNAL_SERVER_ERROR
    #             )

    #     return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    # @extend_schema(
    #     summary='Increment pipeline usage',
    #     description='Increments the usage count of a pipeline',
    #     responses={
    #         200: OpenApiResponse(description='Pipeline usage incremented'),
    #         404: OpenApiResponse(description='Pipeline not found'),
    #     },
    # )
    # @action(detail=True, methods=['post'], url_path='increment-usage')
    # def increment_usage(self, request, pk=None):
    #     # Make request to DataUP backend
    #     try:
    #         headers = {}
    #         auth_token = request.session.get('token')
    #         if auth_token:
    #             headers['Authorization'] = f'Bearer {auth_token}'

    #         response = requests.post(
    #             f"{settings.DATAUP_API_URL}/pipelines/{pk}/increment-usage",
    #             headers=headers
    #         )
    #         response.raise_for_status()
    #         return Response(response.json())
    #     except requests.exceptions.RequestException as e:
    #         if e.response and e.response.status_code == 404:
    #             return Response(
    #                 {"error": "Pipeline not found"},
    #                 status=status.HTTP_404_NOT_FOUND
    #             )
    #         return Response(
    #             {"error": f"Error calling DataUP API: {str(e)}"},
    #             status=status.HTTP_500_INTERNAL_SERVER_ERROR
    #         )

    # @extend_schema(
    #     summary='Get pipeline usage',
    #     description='Returns the usage count of a pipeline',
    #     responses={
    #         200: OpenApiResponse(description='Pipeline usage'),
    #         404: OpenApiResponse(description='Pipeline not found'),
    #     },
    # )
    # @action(detail=True, methods=['get'], url_path='usage')
    # def usage(self, request, pk=None):
    #     # Make request to DataUP backend
    #     try:
    #         headers = {}
    #         auth_token = request.session.get('token')
    #         if auth_token:
    #             headers['Authorization'] = f'Bearer {auth_token}'

    #         response = requests.get(
    #             f"{settings.DATAUP_API_URL}/pipelines/{pk}/usage",
    #             headers=headers
    #         )
    #         response.raise_for_status()
    #         return Response(response.json())
    #     except requests.exceptions.RequestException as e:
    #         if e.response and e.response.status_code == 404:
    #             return Response(
    #                 {"error": "Pipeline not found"},
    #                 status=status.HTTP_404_NOT_FOUND
    #             )
    #         return Response(
    #             {"error": f"Error calling DataUP API: {str(e)}"},
    #             status=status.HTTP_500_INTERNAL_SERVER_ERROR
    #         )