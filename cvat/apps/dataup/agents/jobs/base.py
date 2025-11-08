# Copyright (C) 2023-2024 CVAT.ai Corporation
#
# SPDX-License-Identifier: MIT

import django_rq
import rq
from abc import ABC, abstractmethod
from datetime import timedelta
from typing import Optional, Dict, Any

from cvat.apps.dataup.agents.rq import AgentRQMeta
from cvat.apps.dataup.dataup_api.client import DataUpAPIClient
from cvat.apps.engine.log import ServerLogManager
from django.core.exceptions import ValidationError
from rest_framework import status

slogger = ServerLogManager(__name__)


class BaseAgentQueue(ABC):
    """Base class for agent job queues."""

    RESULT_TTL = timedelta(minutes=30)
    FAILED_TTL = timedelta(hours=3)

    def __init__(self, dataup_client: DataUpAPIClient):
        self.dataup_client = dataup_client

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
        return [
            job_class(job=job)
            for job in jobs
            if job and AgentRQMeta.for_job(job).agent_
        ]

    def fetch_job(self, pk):
        """Fetch a specific job by ID."""
        queue = self._get_queue()
        rq_job = queue.fetch_job(pk)
        if rq_job is None or not AgentRQMeta.for_job(rq_job).agent_:
            raise ValidationError(
                "{} agent job is not found".format(pk), code=status.HTTP_404_NOT_FOUND
            )
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


    @property
    def organization_uuid(self) -> str | None:
        return self.job.kwargs.get("organization_id")

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
