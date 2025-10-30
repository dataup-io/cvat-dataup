from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, extend_schema
from rest_framework.permissions import IsAuthenticated
from cvat.apps.dataup.iam.context import get_dataup_iam_context
from cvat.apps.dataup.iam.policy import DataUpPolicyEnforcer
from cvat.apps.dataup.dataup_api.client import DataUpAPIClientMixin
from rest_framework import status, viewsets
from rest_framework.response import Response
from django.core.exceptions import ValidationError

from .serializers import AgentJobSerializer, AgentJobCreateSerializer


class BaseAgentJobsViewSet(DataUpAPIClientMixin, viewsets.ViewSet):
    """Base class for agent job viewsets with common functionality"""
    permission_classes = [IsAuthenticated, DataUpPolicyEnforcer]
    iam_context_factory = staticmethod(get_dataup_iam_context)
    iam_organization_field = "organization"

    def _get_queue_class(self):
        """Return the appropriate queue class. Must be implemented by subclasses."""
        raise NotImplementedError("Subclasses must implement _get_queue_class method")

    def _get_job_type_name(self):
        """Return the job type name for documentation. Must be implemented by subclasses."""
        raise NotImplementedError("Subclasses must implement _get_job_type_name method")

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
            agent_queue = self._get_queue_class()(self.dataup_client)
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
            agent_queue = self._get_queue_class()(self.dataup_client)
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
            queue = self._get_queue_class()(self.dataup_client)
            rq_job = queue.fetch_job(pk)
            rq_job.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except Exception as e:
            return Response(
                {"error": str(e)}, status=status.HTTP_404_NOT_FOUND
            )