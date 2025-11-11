from multiprocessing import process
from cvat.apps.dataup.agents.jobs.auto_annotate import MAX_CONCURRENCY
import django_rq
from datetime import timedelta
from cvat.apps.dataup.agents.rq import AgentRQMeta
from cvat.apps.dataup.dataup_api.client import DataUpAPIClient
from cvat.apps.dataup.dataup_api.exceptions import ErrorKind, DataUpAPIError
import rq
from cvat.apps.engine.utils import get_rq_lock_by_user, get_rq_lock_for_job, take_by
from django.conf import settings
from cvat.apps.engine.models import (
    Job,
    RequestAction,
    RequestTarget,
    Task,
)
from typing import Optional
from cvat.apps.dataup.agents.jobs.utils import update_progress
from cvat.apps.engine.rq import RequestId, define_dependent_job
from cvat.apps.dataup.agents.payload import build_infer_payload
from cvat.apps.engine.log import ServerLogManager
from django.core.exceptions import ValidationError
from rest_framework import status
from django.conf import settings
import uuid

# Import shared utilities
from .utils import (
    get_ground_truth_from_task,
    get_task_job_from_ids,
    get_frame_ids_from_task_or_job,
    update_progress,
    get_dataup_agent_predictions,
    get_frame_to_job_ids,
    MAX_BATCH_SIZE,
    update_progress,
)

from cvat.apps.dataup.agents.metrics import match_predictions_to_ground_truth, calculate_attribute_metrics, calculate_object_detection_metrics

# Import base classes
from .base import BaseAgentQueue, BaseAgentJob
from itertools import chain
import asyncio
import httpx

slogger = ServerLogManager(__name__)


MAX_CONCURRENCY = 5
DEFAULT_TIMEOUT = 60


class AgentEvaluateQueue(BaseAgentQueue):
    RESULT_TTL = timedelta(hours=1)  # Longer TTL for evaluation results
    FAILED_TTL = timedelta(hours=6)

    def _get_queue(self):
        return django_rq.get_queue(settings.CVAT_QUEUES.AGENT_EVALUATE.value)

    def _get_job_class(self):
        return AgentEvaluateJob

    def enqueue(
        self,
        agent_id: str,
        task_id: int,
        mapping: dict[str, str],
        request,
        *,
        job_id: Optional[int] = None,
        frame_ids: Optional[list[int]] = None,
        organization_id: Optional[str] = None,
        user_id: Optional[int] = None,
    ) -> "AgentEvaluateJob":
        """
        Enqueue an evaluation job.

        Args:
            agent_id: ID of the agent to evaluate
            task_id: Task ID to evaluate on
            evaluation_config: Configuration for evaluation (thresholds, metrics, etc.)
            request: Django request object
            job_id: Optional specific job ID
            frame_ids: Optional specific frame IDs to evaluate

        Returns:
            AgentEvaluateJob instance
        """
        queue = self._get_queue()
        rq_id = RequestId(action=RequestAction.EVALUATE, target=RequestTarget.TASK, id=uuid.uuid4()).render()

        with get_rq_lock_for_job(queue, rq_id):
            if rq_job := queue.fetch_job(rq_id):
                if rq_job.get_status(refresh=False) not in {
                    rq.job.JobStatus.FAILED,
                    rq.job.JobStatus.FINISHED,
                }:
                    raise ValidationError(
                        "Only one running evaluation request is allowed for the same task #{}".format(task_id),
                        code=status.HTTP_409_CONFLICT,
                    )
                rq_job.delete()

            # user_id = request.user.id
            with get_rq_lock_by_user(queue, user_id):
                meta = AgentRQMeta.build_for(
                    request=request,
                    db_obj=Job.objects.get(pk=job_id) if job_id else Task.objects.get(pk=task_id),
                    agent_id=agent_id,
                )
                rq_job = queue.create_job(
                    AgentEvaluateJob(None),
                    job_id=rq_id,
                    meta=meta,
                    kwargs={
                        "agent_id": agent_id,
                        "task_id": task_id,
                        "job_id": job_id,
                        "dataup_client_cfg": self.dataup_client.cfg(),
                        "frame_ids": frame_ids,
                        "mapping": mapping,
                        "organization_id": organization_id,
                        "user_id": user_id,
                    },
                    depends_on=define_dependent_job(queue, user_id),
                    result_ttl=self.RESULT_TTL.total_seconds(),
                    failure_ttl=self.FAILED_TTL.total_seconds(),
                )

                queue.enqueue_job(rq_job)

        return AgentEvaluateJob(job=rq_job)


class AgentEvaluateJob(BaseAgentJob):
    def __init__(self, job: rq.job.Job):
        super().__init__(job=job, queue_name=settings.CVAT_QUEUES.AGENT_EVALUATE.value)

    def to_dict(self):
        agent_id = self.job.kwargs.get("agent_id")
        return {
            "id": self.job.id,
            "status": self.job.get_status(),
            "progress": AgentRQMeta.for_job(self.job).progress,
            "created_date": self.job.created_at.isoformat() if self.job.created_at else None,
            "started_at": self.job.started_at.isoformat() if self.job.started_at else None,
            "finished_at": self.job.ended_at.isoformat() if self.job.ended_at else None,
            "exc_info": self.job.exc_info,
            "result": self.job.result,
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
        }

    def _get_queue(self):
        return django_rq.get_queue(settings.CVAT_QUEUES.AGENT_EVALUATE.value)


    @classmethod
    def __call__(cls, agent_id: str, task_id: int, **kwargs):
        dataup_client_cfg = kwargs.pop("dataup_client_cfg")
        dataup_client = DataUpAPIClient.from_cfg(dataup_client_cfg)

        job_id = kwargs.get("job_id")
        organization_uuid = kwargs.get("organization_uuid", "dataup_org")  # TODO: We need to pass this when we need it
        db_task, db_job = get_task_job_from_ids(task_id, job_id, cleanup=False)
        frame_ids = kwargs.get("frame_ids")
        if not frame_ids:
            frame_ids = get_frame_ids_from_task_or_job(db_task, db_job)

        class_names = set(kwargs.get("mapping", {}).keys())
        label_mapping = {value["name"]: key for key, value in kwargs.get("mapping", {}).items()}
        ground_truth_annotations = get_ground_truth_from_task(task_id=task_id, label_mapping=label_mapping)

        benchmark_frame_ids = [frame_id for frame_id in frame_ids if len(ground_truth_annotations.get(frame_id, [])) > 0]
        total_frames_to_benchmark = len(benchmark_frame_ids)
        frame_to_job_ids = get_frame_to_job_ids(task_id=task_id)
        threshold = kwargs.get("threshold", 0.5)
        iou_threshold = kwargs.get("iou_threshold", 0.5)
        params = {"threshold": threshold}

        all_gts = list(chain(*ground_truth_annotations.values()))
        all_batches = list(take_by(benchmark_frame_ids, MAX_BATCH_SIZE))
        curr_job = rq.get_current_job()
        rq_job_meta = AgentRQMeta.for_job(curr_job) if curr_job else None
        async def run():
            sem = asyncio.Semaphore(MAX_CONCURRENCY)
            all_preds = []
            processed_frames = 0
            async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT, http2=True) as hc:

                async def fetch(batch):
                    payload = await asyncio.to_thread(build_infer_payload, organization_uuid, task_id, batch, params, task_type="annotate_frame")
                    async with sem:
                        resp = await dataup_client.make_request("POST", f"agents/{agent_id}/infer", data=payload, _client=hc)
                        body = resp.json() if getattr(resp, "content", None) else {}
                        return batch, body.get("data", [])

                tasks = [asyncio.create_task(fetch(b)) for b in all_batches]
                for coro in asyncio.as_completed(tasks):
                    try:
                        frame_ids_batch, predictions = await coro
                        if not predictions:
                            slogger.glob.warning(f"No predictions returned for frames {frame_ids_batch}. Skipping.")
                            continue

                        batch_frame_predictions = get_dataup_agent_predictions(frame_ids_batch, predictions, class_names)
                        all_preds.extend(list(chain(*batch_frame_predictions.values())))
                        processed_frames += len(frame_ids_batch)
                        asyncio.to_thread(update_progress, rq_job_meta, processed_frames, total_frames_to_benchmark)
                    except DataUpAPIError as e:
                        if getattr(e, "kind", None) == ErrorKind.INFERENCE:
                            slogger.glob.warning(
                                f"Inference error for frames {frame_ids_batch}; skipping. "
                                f"Details: {e.message} (status={e.status_code}"
                                f"{f', code={e.error_code}' if getattr(e, 'error_code', None) else ''})"
                            )
                            continue
                            # fatal
                        slogger.glob.error(
                            f"{getattr(e, 'kind', 'API').capitalize()} error; aborting. "
                            f"Details: {e.message} (status={e.status_code}"
                            f"{f', code={e.error_code}' if getattr(e, 'error_code', None) else ''})"
                        )

            matches, unmatched_predictions, unmatched_ground_truth = match_predictions_to_ground_truth(
            predictions=all_preds, ground_truth=all_gts, iou_threshold=iou_threshold
        )

            metric_stats: dict = calculate_object_detection_metrics(
                matches=matches,
                unmatched_preds=unmatched_predictions,
                unmatched_gts=unmatched_ground_truth,
                class_names=class_names,
                all_preds=all_preds,
                all_gts=all_gts,
                frame_to_job_ids=frame_to_job_ids,
            )

            metric_stats["attribute_metrics"] = calculate_attribute_metrics(all_preds=all_preds, all_gts=all_gts, matches=matches)

            metric_stats.update(
                {
                    "agent_name": agent_id,
                    "agent_version": "1.0.0",
                    "task_type": "object_detection",
                    "dataset_name": task_id,
                    "processed_frames": processed_frames,
                    "evaluation_time_sec": 35.7,
                }
            )
            return metric_stats


        # execute the async plan
        return asyncio.run(run())

