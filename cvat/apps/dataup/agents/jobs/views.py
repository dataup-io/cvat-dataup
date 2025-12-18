from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, extend_schema
from rest_framework import status
from rest_framework.response import Response

from .serializers import AgentJobSerializer, AgentJobCreateSerializer
from .auto_annotate import AgentAutoAnnotateQueue
from .evaluate import AgentEvaluateQueue
from .base import BaseAgentJobsViewSet


class AgentAnnotateJobsViewSet(BaseAgentJobsViewSet):
    """ViewSet for agent auto-annotation jobs"""

    def _get_queue(self):
        return AgentAutoAnnotateQueue()


    def _get_queue_class(self):
        return AgentAutoAnnotateQueue

    def _get_job_type_name(self):
        return "auto-annotation"

    def _get_job_queue_kwargs(self, request):
        return {
            "agent_id": request.data.get("agent_id"),
            "task_id": request.data.get("task_id"),
            "job_id": request.data.get("job_id"),
            "threshold": request.data.get("threshold", 0.5),
            "mapping": request.data.get("mapping", {}),
            "cleanup": request.data.get("cleanup", False),
            "conv_mask_to_poly": request.data.get("conv_mask_to_poly", False),
            "max_distance": request.data.get("max_distance", 50),
            "frame_ids": request.data.get("frame_ids"),
            "dataup_client_cfg": self.dataup_client.cfg()
        }

    @extend_schema(
        summary="Create a new auto-annotation job",
        description="Creates a new agent auto-annotation job",
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
        """Create a new auto-annotation job"""
        serializer = AgentJobCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        try:
            agent_queue = self._get_queue()
            # Extract validated data

            job_kwargs = self._get_job_queue_kwargs(request)
            iam_context = self.iam_context_factory(request, None)
            # Enqueue the auto-annotation job
            agent_job = agent_queue.enqueue(
                **job_kwargs,
                request=request,
                organization_id=iam_context.get("org_id"),
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
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)





class AgentEvaluateJobsViewSet(BaseAgentJobsViewSet):
    """ViewSet for agent evaluation jobs"""


    def _get_queue(self):
        return AgentEvaluateQueue()


    def _get_queue_class(self):
        return AgentEvaluateQueue

    def _get_job_type_name(self):
        return "evaluation"

    def _get_job_queue_kwargs(self, request):
        return {
            "agent_id": request.data.get("agent_id"),
            "task_id": request.data.get("task_id"),
            "job_id": request.data.get("job_id"),
            # "threshold": request.data.get("threshold"),
            # "prompt": request.data.get("prompt"),
            "mapping": request.data.get("mapping", {}),
            "frame_ids": request.data.get("frame_ids"),
            "dataup_client_cfg": self.dataup_client.cfg()
        }

    @extend_schema(
        summary="Create a new evaluation job",
        description="Creates a new agent evaluation job",
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
        """Create a new evaluation job"""
        serializer = AgentJobCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        try:
            agent_queue = self._get_queue()
            # Extract validated data

            job_kwargs = self._get_job_queue_kwargs(request)
            iam_context = self.iam_context_factory(request, None)
            # Enqueue the evaluation job
            agent_job = agent_queue.enqueue(
                **job_kwargs,
                request=request,
                organization_id=iam_context.get("org_id"),
                user_id=iam_context.get("user_id"),
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
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)



