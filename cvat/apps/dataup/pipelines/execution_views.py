# Copyright (C) 2024 CVAT.ai Corporation
#
# SPDX-License-Identifier: MIT

from rest_framework import status
from rest_framework.response import Response
from rest_framework.decorators import action
from drf_spectacular.utils import extend_schema, OpenApiParameter, OpenApiResponse

from cvat.apps.dataup.views.base import DataUpBaseViewSet
from cvat.apps.dataup.pipelines.serializers import PipelineExecutionSerializer


class PipelineExecutionViewSet(DataUpBaseViewSet):
    """
    ViewSet for managing Pipeline Executions.

    This ViewSet provides endpoints for listing pipeline executions,
    checking execution status, and canceling executions.
    """

    @extend_schema(
        summary='List all pipeline executions',
        description='Returns a list of pipeline executions',
        responses={
            200: OpenApiResponse(description='List of pipeline executions'),
        },
        parameters=[
            OpenApiParameter('pipeline', description='Filter by pipeline ID', required=False, type=int),
            OpenApiParameter('status', description='Filter by status', required=False, type=str),
        ],
    )
    def list(self, request):
        params = {}
        pipeline_id = request.query_params.get('pipeline', None)
        if pipeline_id:
            params['pipeline'] = pipeline_id
        params = self.add_organization_params(params)
        return self.make_dataup_request('GET', 'executions/', params=params)
    def retrieve(self, request, pk=None):
        return self.make_dataup_request('GET', f'executions/{pk}')


    # @extend_schema(        summary='Check pipeline execution status',
    #     description='Returns the status of a pipeline execution',
    #     responses={
    #         200: OpenApiResponse(description='Pipeline execution status'),
    #         404: OpenApiResponse(description='Pipeline execution not found'),
    #     },
    # )
    # @action(detail=True, methods=['get'], url_path='status')
    # def check_status(self, request, pk=None):
    #     # Make request to DataUP backend
    #     try:
    #         headers = {}
    #         auth_token = request.session.get('token')
    #         if auth_token:
    #             headers['Authorization'] = f'Bearer {auth_token}'

    #         response = requests.get(
    #             f"{settings.DATAUP_API_URL}/pipeline-executions/{pk}/status",
    #             headers=headers
    #         )
    #         response.raise_for_status()
    #         return Response(response.json())
    #     except requests.exceptions.RequestException as e:
    #         if e.response and e.response.status_code == 404:
    #             return Response(
    #                 {"error": "Pipeline execution not found"},
    #                 status=status.HTTP_404_NOT_FOUND
    #             )
    #         return Response(
    #             {"error": f"Error calling DataUP API: {str(e)}"},
    #             status=status.HTTP_500_INTERNAL_SERVER_ERROR
    #         )

    # @extend_schema(
    #     summary='Delete a pipeline execution',
    #     description='Deletes a pipeline execution',
    #     responses={
    #         204: OpenApiResponse(description='Pipeline execution deleted'),
    #         404: OpenApiResponse(description='Pipeline execution not found'),
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
    #             f"{settings.DATAUP_API_URL}/pipeline-executions/{pk}",
    #             headers=headers
    #         )
    #         response.raise_for_status()
    #         return Response(status=status.HTTP_204_NO_CONTENT)
    #     except requests.exceptions.RequestException as e:
    #         if e.response and e.response.status_code == 404:
    #             return Response(
    #                 {"error": "Pipeline execution not found"},
    #                 status=status.HTTP_404_NOT_FOUND
    #             )
    #         return Response(
    #             {"error": f"Error calling DataUP API: {str(e)}"},
    #             status=status.HTTP_500_INTERNAL_SERVER_ERROR
    #         )

    # @extend_schema(
    #     summary='Cancel a pipeline execution',
    #     description='Cancels a pipeline execution',
    #     responses={
    #         200: OpenApiResponse(description='Pipeline execution cancelled'),
    #         404: OpenApiResponse(description='Pipeline execution not found'),
    #         400: OpenApiResponse(description='Execution cannot be cancelled'),
    #     },
    # )
    # @action(detail=True, methods=['post'], url_path='cancel')
    # def cancel(self, request, pk=None):
    #     # Make request to DataUP backend
    #     try:
    #         headers = {}
    #         auth_token = request.session.get('token')
    #         if auth_token:
    #             headers['Authorization'] = f'Bearer {auth_token}'

    #         response = requests.post(
    #             f"{settings.DATAUP_API_URL}/pipeline-executions/{pk}/cancel",
    #             headers=headers
    #         )
    #         response.raise_for_status()
    #         return Response(response.json())
    #     except requests.exceptions.RequestException as e:
    #         if e.response and e.response.status_code == 404:
    #             return Response(
    #                 {"error": "Pipeline execution not found"},
    #                 status=status.HTTP_404_NOT_FOUND
    #             )
    #         if e.response and e.response.status_code == 400:
    #             return Response(
    #                 e.response.json(),
    #                 status=status.HTTP_400_BAD_REQUEST
    #             )
    #         return Response(
    #             {"error": f"Error calling DataUP API: {str(e)}"},
    #             status=status.HTTP_500_INTERNAL_SERVER_ERROR
    #         )