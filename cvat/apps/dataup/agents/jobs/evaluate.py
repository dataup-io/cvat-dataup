
from datetime import timedelta
import asyncio
import uuid
import rq
import django_rq
import httpx

from itertools import chain, groupby
from typing import Optional, Any
from django.conf import settings
from django.core.exceptions import ValidationError
from rest_framework import status

from cvat.apps.engine.utils import get_rq_lock_by_user, get_rq_lock_for_job, take_by
from cvat.apps.engine.models import Job, RequestAction, RequestTarget, Task
from cvat.apps.engine.rq import RequestId, define_dependent_job
from cvat.apps.engine.log import ServerLogManager

from cvat.apps.dataup.agents.rq import AgentRQMeta
from cvat.apps.dataup.agents.payload import build_infer_payload
from cvat.apps.dataup.agents.metrics import (
    match_predictions_to_ground_truth,
    calculate_attribute_metrics,
    calculate_object_detection_metrics,
)
from cvat.apps.dataup.dataup_api.client import DataUpAPIClient
from collections import defaultdict
from .utils import (
    get_ground_truth_from_task,
    get_task_job_from_ids,
    get_frame_ids_from_task_or_job,
    update_progress,
    get_dataup_agent_predictions,
    get_frame_to_job_ids,
    MAX_BATCH_SIZE,
)

from .base import BaseAgentQueue, BaseAgentJob

slogger = ServerLogManager(__name__)



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
        dataup_client_cfg: dict,
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
                        "dataup_client_cfg": dataup_client_cfg,
                        "prompt": request.data.get("prompt"),
                        "threshold": request.data.get("threshold"),
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
        # runtime state
        self.agent_id: str | None = None
        self.task_id: int | None = None
        self.db_task = None
        self.db_job = None
        self.dataup_client: DataUpAPIClient | None = None
        self.class_names: set[str] = set()
        self.label_mapping: dict[str, str] = {}
        self.ground_truth_annotations: dict[int, list[Any]] = {}
        self.frame_to_job_ids: dict[int, Any] = {}
        self.iou_threshold: float = 0.5
        self.params: dict[str, Any] = {}
        self.batches: list[list[int]] = []
        self.all_gts: list[Any] = []
        self.all_preds: list[Any] = []
        self.total_frames_to_benchmark: int = 0
        self.processed_frames: int = 0
        self.rq_job_meta: AgentRQMeta | None = None
        self.metric_stats: dict[str, Any] | None = None

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
                    {"job_id": self.job.kwargs["job_id"]}
                    if self.job.kwargs.get("job_id")
                    else {}
                ),
            },
        }

    def _get_queue(self):
        return django_rq.get_queue(settings.CVAT_QUEUES.AGENT_EVALUATE.value)

    def prepare(self, agent_id: str, task_id: int, **kwargs) -> None:
        self.agent_id = agent_id
        self.task_id = task_id

        dataup_client_cfg = kwargs.pop("dataup_client_cfg")
        self.dataup_client = DataUpAPIClient.from_cfg(dataup_client_cfg)

        job_id = kwargs.get("job_id")
        self.db_task, self.db_job = get_task_job_from_ids(task_id, job_id, cleanup=False)

        frame_ids = kwargs.get("frame_ids")
        if not frame_ids:
            frame_ids = get_frame_ids_from_task_or_job(self.db_task, self.db_job)

        mapping: dict[str, Any] = kwargs.get("mapping", {}) or {}
        self.class_names = set(mapping.keys())
        self.label_mapping = {value["name"]: key for key, value in mapping.items()}

        self.ground_truth_annotations = get_ground_truth_from_task(
            task_id=task_id,
            label_mapping=self.label_mapping,
        )

        benchmark_frame_ids = [
            frame_id
            for frame_id in frame_ids
            if len(self.ground_truth_annotations.get(frame_id, [])) > 0
        ]
        self.total_frames_to_benchmark = len(benchmark_frame_ids)
        self.frame_to_job_ids = get_frame_to_job_ids(task_id=task_id)

        threshold = kwargs.get("threshold", 0.5)
        prompt = kwargs.get("prompt")
        self.iou_threshold = kwargs.get("iou_threshold", 0.5)
        self.params = {"threshold": threshold, "prompt": prompt}

        self.all_gts = list(chain(*self.ground_truth_annotations.values()))
        self.batches = list(take_by(benchmark_frame_ids, MAX_BATCH_SIZE))

        self.rq_job_meta = AgentRQMeta.for_job(self.job) if self.job else None
        self.all_preds = []
        self.processed_frames = 0
        self.metric_stats = None

    async def _fetch(
        self,
        batch: list[int],
        hc: httpx.AsyncClient,
        dataup_client: DataUpAPIClient,
    ) -> dict:
        payload = await asyncio.to_thread(
            build_infer_payload,
            self.organization_uuid,
            self.task_id,
            batch,
            self.params,
            task_type="annotate_frame",
        )
        resp = await dataup_client.make_request(
            "POST",
            f"agents/{self.agent_id}/infer",
            data=payload,
            _client=hc,
        )
        body = resp.json() if getattr(resp, "content", None) else {}
        return {"frames": batch, "predictions": body.get("data", [])}

    async def postprocess(self, result: dict[str, Any]) -> None:
        frame_ids_batch: list[int] = result.get("frames", [])
        predictions = result.get("predictions", [])

        if not predictions:
            slogger.glob.warning(
                f"No predictions returned for frames {frame_ids_batch}. Skipping."
            )
            return

        batch_frame_predictions = get_dataup_agent_predictions(
            frame_ids_batch,
            predictions,
            self.class_names,
        )

        self.all_preds.extend(list(chain(*batch_frame_predictions.values())))
        self.processed_frames += len(frame_ids_batch)

        if self.rq_job_meta:
            await asyncio.to_thread(
                update_progress,
                self.rq_job_meta,
                self.processed_frames,
                self.total_frames_to_benchmark,
            )

    async def finalize(self) -> None:
        """
        Called after run() finishes (or early if you call it conditionally).
        Compute metrics from accumulated predictions + ground truth.
        """
        matches, unmatched_predictions, unmatched_ground_truth = match_predictions_to_ground_truth(
            predictions=self.all_preds,
            ground_truth=self.all_gts,
            iou_threshold=self.iou_threshold,
        )
        # import json
        # # For debugging
        # with open("matches.json", "w") as f:
        #     json.dump(matches, f, indent=4)
        # with open("unmatched_predictions.json", "w") as f:
        #     json.dump(unmatched_predictions, f, indent=4)
        # with open("unmatched_ground_truth.json", "w") as f:
        #     json.dump(unmatched_ground_truth, f, indent=4)

        # with open("all_preds.json", "w") as f:
        #     json.dump(self.all_preds, f, indent=4)
        # with open("all_gts.json", "w") as f:
        #     json.dump(self.all_gts, f, indent=4)
        # with open("frame_to_job_ids.json", "w") as f:
        #     json.dump(self.frame_to_job_ids, f, indent=4)

        metric_stats: dict = calculate_object_detection_metrics(
            matches=matches,
            unmatched_preds=unmatched_predictions,
            unmatched_gts=unmatched_ground_truth,
            class_names=self.class_names,
            all_preds=self.all_preds,
            all_gts=self.all_gts,
            frame_to_job_ids=self.frame_to_job_ids,
        )

        metric_stats["attribute_metrics"] = calculate_attribute_metrics(
            all_preds=self.all_preds,
            all_gts=self.all_gts,
            matches=matches,
        )

        metric_stats.update(
            {
                "agent_name": self.agent_id,
                "agent_version": "1.0.0",
                "task_type": "object_detection",
                "dataset_id": self.task_id,
                "processed_frames": self.processed_frames,
            }
        )

        predictions = []
        for frame_id, group in groupby(self.all_preds, key=lambda x: x["frame_id"]):
            def _get_label_dict(pred: dict) -> dict:
                return {
                    "label": pred["label"],
                    "score": pred["score"],
                    "bbox": pred["bbox"],
                    "attributes": pred["attributes"],
                }
            job_id = self.frame_to_job_ids[frame_id]
            labels = [_get_label_dict(pred) for pred in group]
            predictions.append({
                "job_id": job_id,
                "frame_id": frame_id,
                "labels": labels,
            })

        metric_stats["predictions"] = predictions
        self.metric_stats = metric_stats


    @classmethod
    def __call__(cls, agent_id: str, task_id: int, **kwargs):
        curr_job = rq.get_current_job()
        self = cls(job=curr_job)
        self.prepare(agent_id=agent_id, task_id=task_id, **kwargs)
        asyncio.run(self.run(self.batches, self.dataup_client))
        return self.metric_stats
