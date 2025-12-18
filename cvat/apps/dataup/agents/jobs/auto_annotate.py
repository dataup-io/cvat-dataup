import django_rq
from datetime import timedelta
from cvat.apps.dataup.agents.rq import AgentRQMeta
from cvat.apps.dataup.dataup_api.client import DataUpAPIClient
from cvat.apps.dataup.utils.converters import DataUpAgentResultConverter
import rq
from cvat.apps.engine.utils import get_rq_lock_by_user, get_rq_lock_for_job, take_by
from django.conf import settings
from cvat.apps.engine.models import (
    Job,
    RequestAction,
    RequestTarget,
    Task,
)
from cvat.apps.engine.rq import RequestId, define_dependent_job
from typing import Optional
from cvat.apps.dataup.agents.payload import build_infer_payload
from cvat.apps.engine.log import ServerLogManager
from django.core.exceptions import ValidationError
from rest_framework import status

# Import shared utilities
from .utils import (
    get_task_job_from_ids,
    get_frame_ids_from_task_or_job,
    batch_save_agent_results,
    update_progress,
    MAX_BATCH_SIZE,
    SAVE_EVERY_FRAMES,
)

# Import base classes
from .base import BaseAgentQueue, BaseAgentJob
import asyncio
import httpx


slogger = ServerLogManager(__name__)


class AgentAutoAnnotateQueue(BaseAgentQueue):
    RESULT_TTL = timedelta(minutes=30)
    FAILED_TTL = timedelta(hours=3)

    def _get_queue(self):
        return django_rq.get_queue(settings.CVAT_QUEUES.AGENT_AUTO_ANNOTATE.value)

    def _get_job_class(self):
        return AgentAutoAnnotateJob

    def enqueue(
        self,
        agent_id,
        threshold,
        task_id,
        mapping,
        cleanup,
        conv_mask_to_poly,
        max_distance,
        request,
        dataup_client_cfg: dict,
        *,
        job_id: Optional[int] = None,
        frame_ids: Optional[list[int]] = None,
        organization_id: Optional[str] = None,
    ) -> "AgentAutoAnnotateJob":
        queue = self._get_queue()
        rq_id = RequestId(
            action=RequestAction.AUTOANNOTATE,
            target=RequestTarget.TASK,
            target_id=task_id,
        ).render()

        with get_rq_lock_for_job(queue, rq_id):
            if rq_job := queue.fetch_job(rq_id):
                if rq_job.get_status(refresh=False) not in {
                    rq.job.JobStatus.FAILED,
                    rq.job.JobStatus.FINISHED,
                }:
                    raise ValidationError(
                        "Only one running request is allowed for the same task #{}".format(task_id),
                        code=status.HTTP_409_CONFLICT,
                    )
                rq_job.delete()

            user_id = request.user.id

            with get_rq_lock_by_user(queue, user_id):
                meta = AgentRQMeta.build_for(
                    request=request,
                    db_obj=Job.objects.get(pk=job_id) if job_id else Task.objects.get(pk=task_id),
                    agent_id=agent_id,
                )
                rq_job = queue.create_job(
                    AgentAutoAnnotateJob(None),
                    job_id=rq_id,
                    meta=meta,
                    kwargs={
                        "agent_id": agent_id,
                        "task_id": task_id,
                        "cleanup": cleanup,
                        "threshold": threshold,
                        "job_id": job_id,
                        "conv_mask_to_poly": conv_mask_to_poly,
                        "mapping": mapping,
                        "max_distance": max_distance,
                        "dataup_client_cfg": dataup_client_cfg,
                        "organization_id": organization_id,
                        "frame_ids": frame_ids,
                    },
                    depends_on=define_dependent_job(queue, user_id),
                    result_ttl=self.RESULT_TTL.total_seconds(),
                    failure_ttl=self.FAILED_TTL.total_seconds(),
                )

                queue.enqueue_job(rq_job)

        return AgentAutoAnnotateJob(job=rq_job)


class AgentAutoAnnotateJob(BaseAgentJob):
    def __init__(self, job: rq.job.Job):
        super().__init__(job, settings.CVAT_QUEUES.AGENT_AUTO_ANNOTATE.value)

    def to_dict(self):
        agent_id = self.job.kwargs.get("agent_id")
        dict_ = {
            "id": self.job.id,
            "meta": {
                "id": agent_id,
                "threshold": self.job.kwargs.get("threshold"),
                "task": self.job.kwargs.get("task_id"),
                **(
                    {
                        "job_id": self.job.kwargs["job_id"],
                    }
                    if self.job.kwargs.get("job_id")
                    else {}
                ),
            },
            "status": self.job.get_status(),
            "progress": AgentRQMeta.for_job(self.job).progress,
            "enqueued": self.job.enqueued_at,
            "started": self.job.started_at,
            "ended": self.job.ended_at,
            "exc_info": self.job.exc_info,
        }
        if dict_["status"] == rq.job.JobStatus.DEFERRED:
            dict_["status"] = rq.job.JobStatus.QUEUED.value

        return dict_

    def prepare(self, agent_id: str, task_id: int, cleanup: bool, **kwargs):
        self.agent_id = agent_id
        self.task_id = task_id
        self.job_id = kwargs.get("job_id")
        self.db_task, self.db_job = get_task_job_from_ids(task_id, self.job_id, cleanup)
        dataup_client_cfg = kwargs.pop("dataup_client_cfg")
        self.dc = DataUpAPIClient.from_cfg(dataup_client_cfg)
        frame_ids = kwargs.get("frame_ids") or get_frame_ids_from_task_or_job(self.db_task, self.db_job)
        label_mapping = kwargs.get("mapping", {})
        self.converter = DataUpAgentResultConverter(task_id, label_mapping=label_mapping)
        threshold = kwargs.get("threshold", 0.5)
        self.params = {"threshold": threshold}
        self.batches = list(take_by(frame_ids, MAX_BATCH_SIZE))
        self.total_frames = len(frame_ids)
        self.rq_job_meta = AgentRQMeta.for_job(self.job) if self.job else None
        self.batched_output = []
        self.successful_frames = []
        self.processed_frames = 0

    async def postprocess(self, result: dict):
        frames = result.get("frames", [])
        data = result.get("data", [])
        if not data:
            slogger.glob.warning(f"No data returned for frames {frames}. Skipping.")
            return

        self.successful_frames.extend(frames)
        self.batched_output.extend(data)
        self.processed_frames += len(frames)
        await asyncio.to_thread(update_progress, self.rq_job_meta, self.processed_frames, self.total_frames)

        if SAVE_EVERY_FRAMES and self.processed_frames % SAVE_EVERY_FRAMES == 0:
            await asyncio.to_thread(batch_save_agent_results, self.converter, self.db_task, self.db_job, self.successful_frames, self.batched_output)
            self.batched_output.clear()
            self.successful_frames.clear()

    async def finalize(self) -> None:
        if self.successful_frames:
            await asyncio.to_thread(
                batch_save_agent_results,
                self.converter,
                self.db_task,
                self.db_job,
                self.successful_frames,
                self.batched_output,
            )
            self.batched_output.clear()
            self.successful_frames.clear()


    async def _fetch(self, batch, hc: httpx.AsyncClient, dc: DataUpAPIClient) -> dict:
        payload = await asyncio.to_thread(build_infer_payload, self.organization_uuid, self.task_id, batch, self.params, task_type="annotate_frame")
        resp = await dc.make_request("POST", f"agents/{self.agent_id}/infer", data=payload, _client=hc)
        body = resp.json() if getattr(resp, "content", None) else {}
        return {"frames": batch, "data": body.get("data", [])}

    @classmethod
    def __call__(cls, agent_id: str, task_id: int, cleanup: bool, **kwargs):
        curr_job = rq.get_current_job()
        self = cls(job=curr_job)
        self.prepare(agent_id=agent_id, task_id=task_id, cleanup=cleanup, **kwargs)
        return asyncio.run(self.run(self.batches, self.dc))
