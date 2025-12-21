# Copyright (C) 2023-2024 CVAT.ai Corporation
#
# SPDX-License-Identifier: MIT

import django_rq
import rq
from abc import ABC, abstractmethod
from datetime import timedelta
from typing import Dict, Any
from cvat.apps.dataup.dataup_api.client import DataUpAPIClient
from cvat.apps.dataup.agents.rq import AgentRQMeta
from cvat.apps.engine.log import ServerLogManager
from django.core.exceptions import ValidationError
from rest_framework import status, viewsets
from rest_framework.response import Response
from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, extend_schema
from rest_framework.permissions import IsAuthenticated
from cvat.apps.dataup.iam.context import get_dataup_iam_context
from cvat.apps.dataup.iam.policy import DataUpPolicyEnforcer
from cvat.apps.dataup.agents.permissions import DataUpAgentJobPermission
from cvat.apps.dataup.dataup_api.client import DataUpAPIClientMixin
from asgiref.sync import async_to_sync
from .serializers import AgentJobSerializer
import asyncio
import httpx


slogger = ServerLogManager(__name__)

MAX_CONCURRENCY = 5
MAX_TIMEOUT = 300


LIMITS = httpx.Limits(
    max_connections=MAX_CONCURRENCY,
    max_keepalive_connections=MAX_CONCURRENCY,
)

TIMEOUT = httpx.Timeout(
    connect=10.0,          # or something reasonable
    read=MAX_TIMEOUT,      # keep your existing total read timeout
    write=None,
    pool=None,
)


class BaseAgentQueue(ABC):
    """Base class for agent job queues."""

    RESULT_TTL = timedelta(minutes=30)
    FAILED_TTL = timedelta(hours=3)


    @abstractmethod
    def _get_queue(self):
        """Get the RQ queue for this agent type."""
        pass

    @abstractmethod
    def _get_job_class(self):
        """Get the job class for this agent type."""
        pass

    def get_jobs(self):
        """Get all jobs for this agent type."""
        queue = self._get_queue()
        job_ids = set(
            queue.get_job_ids()
            + queue.started_job_registry.get_job_ids()
            + queue.finished_job_registry.get_job_ids()
            + queue.scheduled_job_registry.get_job_ids()
            + queue.deferred_job_registry.get_job_ids()
        )
        jobs = queue.job_class.fetch_many(job_ids, queue.connection)
        job_class = self._get_job_class()
        return [job_class(job=job) for job in jobs if job and AgentRQMeta.for_job(job).agent_]

    def fetch_job(self, pk):
        """Fetch a specific job by ID."""
        queue = self._get_queue()
        rq_job = queue.fetch_job(pk)
        if rq_job is None or not AgentRQMeta.for_job(rq_job).agent_:
            raise ValidationError("{} agent job is not found".format(pk), code=status.HTTP_404_NOT_FOUND)
        job_class = self._get_job_class()
        return job_class(job=rq_job)


class BaseAgentJob(ABC):
    """Base class for agent jobs."""

    def __init__(self, job: rq.job.Job, queue_name: str):
        self.job = job
        self.queue_name = queue_name

    def _get_queue(self):
        return django_rq.get_queue(self.queue_name)

    def get_jobs(self):
        """Get all jobs from the queue."""
        queue = self._get_queue()
        return queue.get_jobs()

    def get_status(self):
        """Get the current job status."""
        return self.job.get_status()

    def delete(self):
        """Delete the job."""
        self.job.delete()

    def cancel(self):
        self.job.cancel()

    @property
    def organization_uuid(self) -> str | None:
        return self.job.kwargs.get("organization_id", "dataup_unknown_org")

    @property
    def user_id(self) -> str | None:
        return self.job.kwargs.get("user_id")

    @property
    def is_finished(self):
        """Check if job is finished."""
        return self.get_status() == rq.job.JobStatus.FINISHED

    @property
    def is_queued(self):
        """Check if job is queued."""
        return self.get_status() == rq.job.JobStatus.QUEUED

    @property
    def is_failed(self):
        """Check if job failed."""
        return self.get_status() == rq.job.JobStatus.FAILED

    @property
    def is_started(self):
        """Check if job is started."""
        return self.get_status() == rq.job.JobStatus.STARTED

    @property
    def is_deferred(self):
        """Check if job is deferred."""
        return self.get_status() == rq.job.JobStatus.DEFERRED

    @property
    def is_scheduled(self):
        """Check if job is scheduled."""
        return self.get_status() == rq.job.JobStatus.SCHEDULED

    @classmethod
    @abstractmethod
    def __call__(cls, *args, **kwargs):
        """Execute the job. Must be implemented by subclasses."""
        pass

    @abstractmethod
    def to_dict(self) -> Dict[str, Any]:
        """Convert job to dictionary representation."""
        pass


    @abstractmethod
    def prepare(self, *args, **kwargs) -> None:
        pass

    @abstractmethod
    async def postprocess(self, result: dict[str, Any]) -> None:
        pass

    @abstractmethod
    async def _fetch(self, batch: list[int], hc: httpx.AsyncClient, dc: DataUpAPIClient) -> dict:
        pass

    async def finalize(self):
        pass


    async def run(self, batches: list[int], dc: DataUpAPIClient) -> None:
        sem = asyncio.Semaphore(MAX_CONCURRENCY)
        async with httpx.AsyncClient(timeout=TIMEOUT, http2=True, limits=LIMITS) as hc:
            async def wrapped_fetch(batch: list[int]):
                async with sem:
                    return await self._fetch(batch, hc, dc)

            tasks = {asyncio.create_task(wrapped_fetch(b)) for b in batches}
            pending = set(tasks)
            while pending:
                done, pending = await asyncio.wait(pending, return_when=asyncio.FIRST_COMPLETED)
                if self.get_status() == rq.job.JobStatus.CANCELED:
                    slogger.glob.info(f"RQ job {getattr(self.job, 'id', None)} cancelled; stopping early.")
                    for t in pending:
                        t.cancel()
                    await asyncio.gather(*pending, return_exceptions=True)
                    break
                for d in done:
                    try:
                        result = await d
                        await self.postprocess(result)
                    except Exception as e:
                        slogger.glob.error(f"Batched execution failed {e} ")
                        raise
            await self.finalize()




class BaseAgentJobsViewSet(DataUpAPIClientMixin, viewsets.ViewSet):
    """Base class for agent job viewsets with common functionality"""

    permission_classes = [IsAuthenticated, DataUpPolicyEnforcer]
    iam_permission_class = DataUpAgentJobPermission
    iam_context_factory = staticmethod(get_dataup_iam_context)
    iam_organization_field = "organization"



    def _get_queue(self):
        raise NotImplementedError("Subclasses must implement _get_queue method")

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
        iam_context = self.iam_context_factory(request, None)
        return async_to_sync(self._alist)(request, iam_context)

    async def _alist(self, request, iam_context, *args, **kwargs):
        try:
            agent_queue = self._get_queue()
            organization_uuid = iam_context.get("org_id")
            user_id = iam_context.get("user_id")
            if organization_uuid:
                jobs = [job for job in agent_queue.get_jobs() if job.organization_uuid == organization_uuid]
            elif user_id:
                jobs = [job for job in agent_queue.get_jobs() if job.user_id == user_id]
            else:
                raise ValidationError("User or organization must be specified")

            job_data = []
            for job in jobs:
                job_data.append(job.to_dict())

            serializer = AgentJobSerializer(job_data, many=True)
            return Response(serializer.data, status=status.HTTP_200_OK)

        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

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
        agent_queue = self._get_queue()
        job = agent_queue.fetch_job(pk)
        return async_to_sync(self._aretrieve)(job)

    async def _aretrieve(self, job, *args, **kwargs):
        """Retrieve a specific agent job by ID"""
        try:
            serializer = AgentJobSerializer(job.to_dict())
            return Response(serializer.data, status=status.HTTP_200_OK)

        except ValidationError as e:
            return Response({"error": str(e)}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)




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
        return async_to_sync(self._adestroy)(request, pk)


    async def _adestroy(self, request, pk, *args, **kwargs):
        try:
            queue = self._get_queue()
            rq_job = queue.fetch_job(pk)
            rq_job.cancel()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_404_NOT_FOUND)