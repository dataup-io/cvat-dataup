# Copyright (C) 2024 CVAT.ai Corporation
#
# SPDX-License-Identifier: MIT

from rest_framework import status
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema, OpenApiParameter, OpenApiResponse

from cvat.apps.dataup.views.base import DataUpBaseViewSet
from cvat.apps.dataup.pipelines.serializers import (
    PipelineStepSerializer, PipelineStepCreateSerializer, PipelineStepUpdateSerializer
)


class PipelineStepViewSet(DataUpBaseViewSet):
    """
    ViewSet for managing Pipeline Steps.

    This ViewSet provides endpoints for listing, creating, updating,
    and deleting pipeline steps.
    """

    @extend_schema(
        summary='List all pipeline steps',
        description='Returns a list of pipeline steps',
        responses={
            200: OpenApiResponse(description='List of pipeline steps'),
        },
        parameters=[
            OpenApiParameter('pipeline_id', description='Filter by pipeline ID', required=False, type=int),
        ],
    )
    def list(self, request):
        params = {}

        # Filter by pipeline_id if provided
        pipeline_id = request.query_params.get('pipeline_id', None)
        if pipeline_id:
            params['pipeline_id'] = pipeline_id

        params = self.add_organization_params(params)
        return self.make_dataup_request('GET', 'pipeline-steps', params=params)

    # @extend_schema(
    #     summary='Create a pipeline step',
    #     description='Creates a new pipeline step',
    #     responses={
    #         201: OpenApiResponse(description='Pipeline step created'),
    #         400: OpenApiResponse(description='Invalid input'),
    #     },
    # )
    # def create(self, request):
    #     serializer = PipelineStepSerializer(data=request.data)

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
    #                 f"{settings.DATAUP_API_URL}/pipeline-steps",
    #                 json=request_data,
    #                 headers=headers
    #             )
    #             response.raise_for_status()
    #             return Response(response.json(), status=status.HTTP_201_CREATED)
    #         except requests.exceptions.RequestException as e:
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
    #     summary='Update a pipeline step',
    #     description='Updates a pipeline step',
    #     responses={
    #         200: OpenApiResponse(description='Pipeline step updated'),
    #         400: OpenApiResponse(description='Invalid input'),
    #         404: OpenApiResponse(description='Pipeline step not found'),
    #     },
    # )
    # def update(self, request, pk=None):
    #     serializer = PipelineStepSerializer(data=request.data)

    #     if serializer.is_valid():
    #         # Prepare request data
    #         request_data = serializer.validated_data

    #         # Make request to DataUP backend
    #         try:
    #             headers = {}
    #             auth_token = request.session.get('token')
    #             if auth_token:
    #                 headers['Authorization'] = f'Bearer {auth_token}'

    #             response = requests.put(
    #                 f"{settings.DATAUP_API_URL}/pipeline-steps/{pk}",
    #                 json=request_data,
    #                 headers=headers
    #             )
    #             response.raise_for_status()
    #             return Response(response.json())
    #         except requests.exceptions.RequestException as e:
    #             if e.response and e.response.status_code == 404:
    #                 return Response(
    #                     {"error": "Pipeline step not found"},
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
    #     summary='Delete a pipeline step',
    #     description='Deletes a pipeline step',
    #     responses={
    #         204: OpenApiResponse(description='Pipeline step deleted'),
    #         404: OpenApiResponse(description='Pipeline step not found'),
    #     },
    # )
    # def destroy(self, request, pk=None):
    #     # Make request to DataUP backend
    #     try:
    #         headers = {}
    #         auth_token = request.session.get('token')
    #         if auth_token:
    #             headers['Authorization'] = f'Bearer {auth_token}'

    #         response = requests.delete(
    #             f"{settings.DATAUP_API_URL}/pipeline-steps/{pk}",
    #             headers=headers
    #         )
    #         response.raise_for_status()
    #         return Response(status=status.HTTP_204_NO_CONTENT)
    #     except requests.exceptions.RequestException as e:
    #         if e.response and e.response.status_code == 404:
    #             return Response(
    #                 {"error": "Pipeline step not found"},
    #                 status=status.HTTP_404_NOT_FOUND
    #             )
    #         return Response(
    #             {"error": f"Error calling DataUP API: {str(e)}"},
    #             status=status.HTTP_500_INTERNAL_SERVER_ERROR
    #         )