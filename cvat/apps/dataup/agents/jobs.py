import django_rq
from datetime import timedelta
from cvat.apps.dataup.agents.rq import AgentRQMeta
from cvat.apps.dataup.dataup_api.client import DataUpAPIClient
from cvat.apps.dataup.dataup_api.exceptions import ErrorKind, DataUpAPIError
from cvat.apps.dataup.utils.converters import DataUpAgentResultConverter
import rq
from cvat.apps.engine.utils import get_rq_lock_by_user, get_rq_lock_for_job, take_by
from django.conf import settings
from cvat.apps.engine.models import (
    Job,
    Label,
    RequestAction,
    RequestTarget,
    ShapeType,
    SourceType,
    Task,
)
from cvat.apps.engine.rq import RequestId, define_dependent_job
from typing import Optional
from cvat.apps.dataup.agents.payload import build_infer_payload
from cvat.apps.engine.log import ServerLogManager
from cvat.apps.dataset_manager.task import PatchAction
import cvat.apps.dataset_manager as dm
from cvat.apps.engine.serializers import LabeledDataSerializer
from django.core.exceptions import ObjectDoesNotExist, ValidationError
from rest_framework import status


MAX_BATCH_SIZE = 2
SAVE_EVERY_FRAMES = 50
slogger = ServerLogManager(__name__)


def _cleanup_task_or_job(db_task: Task, db_job: Optional[Job]):
    if db_job:
        dm.task.delete_job_data(db_job.id)
    elif db_task:
        dm.task.delete_task_data(db_task.id)
    else:
        raise ValueError("Either task or job must be provided")


def _get_task_job_from_ids(
    task_id: int, job_id: Optional[int], cleanup: bool = False
) -> tuple[Task, Optional[Job]]:
    db_job = None
    if job_id:
        db_job = Job.objects.select_related("segment", "segment__task").get(pk=job_id)
        db_task = db_job.segment.task
    else:
        db_task = Task.objects.get(pk=task_id)

    if cleanup:
        _cleanup_task_or_job(db_task, db_job)
    return db_task, db_job


def _get_frame_ids_from_task_or_job(db_task: Task, db_job: Optional[Job]) -> list[int]:
    frame_ids = []
    if db_job:
        frame_ids = list(db_job.segment.frame_set)
    else:
        frame_ids = list(range(db_task.data.size))
    return frame_ids


def _batch_save_agent_results(
    converter: DataUpAgentResultConverter,
    db_task: Task,
    db_job: Job,
    frames: list[int],
    results: list[dict],
):
    converted_outputs = converter.convert(frames, results)
    serialized_output = LabeledDataSerializer(data=converted_outputs)
    serialized_output.is_valid(raise_exception=True)
    if db_job:
        dm.task.patch_job_data(
            db_job.id, serialized_output.validated_data, PatchAction.CREATE
        )
    else:
        dm.task.patch_task_data(
            db_task.id, serialized_output.validated_data, PatchAction.CREATE
        )


class AgentQueue:
    RESULT_TTL = timedelta(minutes=30)
    FAILED_TTL = timedelta(hours=3)

    def __init__(self, dataup_client: DataUpAPIClient):
        self.dataup_client = dataup_client

    def _get_queue(self):
        return django_rq.get_queue(settings.CVAT_QUEUES.AGENT_JOBS.value)

    def get_jobs(self):
        queue = self._get_queue()
        job_ids = set(
            queue.get_job_ids()
            + queue.started_job_registry.get_job_ids()
            + queue.finished_job_registry.get_job_ids()
            + queue.scheduled_job_registry.get_job_ids()
            + queue.deferred_job_registry.get_job_ids()
        )
        jobs = queue.job_class.fetch_many(job_ids, queue.connection)
        return [
            AgentJob(job=job)
            for job in jobs
            if job and AgentRQMeta.for_job(job).agent_
        ]

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
        *,
        job_id: Optional[int] = None,
        frame_ids: Optional[list[int]] = None
    ) -> "AgentJob":
        queue = self._get_queue()
        rq_id = RequestId(
            action=RequestAction.AUTOANNOTATE, target=RequestTarget.TASK, target_id=task_id
        ).render()

        with get_rq_lock_for_job(queue, rq_id):
            if rq_job := queue.fetch_job(rq_id):
                if rq_job.get_status(refresh=False) not in {
                    rq.job.JobStatus.FAILED,
                    rq.job.JobStatus.FINISHED,
                }:
                    raise ValidationError(
                        "Only one running request is allowed for the same task #{}".format(
                            task_id
                        ),
                        code=status.HTTP_409_CONFLICT,
                    )
                rq_job.delete()

            user_id = request.user.id

            with get_rq_lock_by_user(queue, user_id):
                meta = AgentRQMeta.build_for(
                    request=request,
                    db_obj=Job.objects.get(pk=job_id)
                    if job_id
                    else Task.objects.get(pk=task_id),
                    agent_id=agent_id,
                )
                rq_job = queue.create_job(
                    AgentJob(None),
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
                        "dataup_client_cfg": self.dataup_client.cfg(),
                        "frame_ids": frame_ids,
                    },
                    depends_on=define_dependent_job(queue, user_id),
                    result_ttl=self.RESULT_TTL.total_seconds(),
                    failure_ttl=self.FAILED_TTL.total_seconds(),
                )

                queue.enqueue_job(rq_job)

        return AgentJob(job=rq_job)

    def fetch_job(self, pk):
        queue = self._get_queue()
        rq_job = queue.fetch_job(pk)
        if rq_job is None or not AgentRQMeta.for_job(rq_job).agent_:
            raise ValidationError(
                "{} agent job is not found".format(pk), code=status.HTTP_404_NOT_FOUND
            )

        return AgentJob(job=rq_job)

class AgentJob:
    def __init__(self, job: rq.job.Job):
        self.job = job

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


    def _get_queue(self):
        return django_rq.get_queue(settings.CVAT_QUEUES.AGENT_ANNOTATION.value)

    def get_jobs(self):
        queue = self._get_queue()
        return queue.get_jobs()

    def get_status(self):
        return self.job.get_status()

    def delete(self):
        self.job.delete()


    @property
    def is_finished(self):
        return self.get_status() == rq.job.JobStatus.FINISHED

    @property
    def is_queued(self):
        return self.get_status() == rq.job.JobStatus.QUEUED

    @property
    def is_failed(self):
        return self.get_status() == rq.job.JobStatus.FAILED

    @property
    def is_started(self):
        return self.get_status() == rq.job.JobStatus.STARTED

    @property
    def is_deferred(self):
        return self.get_status() == rq.job.JobStatus.DEFERRED

    @property
    def is_scheduled(self):
        return self.get_status() == rq.job.JobStatus.SCHEDULED

    @classmethod
    def __call__(cls, agent_id: str, task_id: int, cleanup: bool, **kwargs):

        dataup_client_cfg = kwargs.pop("dataup_client_cfg")
        dataup_client = DataUpAPIClient.from_cfg(dataup_client_cfg)

        job_id = kwargs.get("job_id")
        db_task, db_job = _get_task_job_from_ids(task_id, job_id, cleanup)


        frame_ids = kwargs.get("frame_ids")
        if not frame_ids:
            frame_ids = _get_frame_ids_from_task_or_job(db_task, db_job)


        label_mapping = kwargs.get("mapping", {})
        converter = DataUpAgentResultConverter(task_id, label_mapping=label_mapping)

        batched_output: list = []
        successful_frames: list = []
        processed_frames = 0
        threshold = kwargs.get("threshold", 0.5)
        params = {"threshold": threshold}
        for frame_ids_batch in take_by(frame_ids, MAX_BATCH_SIZE):
            payload = build_infer_payload(task_id, frame_ids_batch, params)

            try:
                resp = dataup_client.make_request(
                    "POST", f"agents/{agent_id}/infer", data=payload
                )
                body = resp.json() if getattr(resp, "content", None) else {}
                data = body.get("data", [])

                if not data:
                    slogger.glob.warning(
                        f"No data returned for frames {frame_ids_batch}. "
                        "Skipping save for this batch."
                    )
                    continue

                successful_frames.extend(frame_ids_batch)
                batched_output.extend(data)

                # increment after a successful batch
                processed_frames += len(frame_ids_batch)
                cls._update_progress(processed_frames, len(frame_ids))

                # save every SAVE_EVERY_FRAMES processed frames
                if SAVE_EVERY_FRAMES and processed_frames % SAVE_EVERY_FRAMES == 0:
                    _batch_save_agent_results(
                        converter, db_task, db_job, successful_frames, batched_output
                    )
                    batched_output.clear()
                    successful_frames.clear()

            except DataUpAPIError as e:
                if e.kind == ErrorKind.INFERENCE:
                    slogger.glob.warning(
                        f"Inference error for frames {frame_ids_batch}; skipping batch. "
                        f"Details: {e.message} (status={e.status_code}{f', code={e.error_code}' if e.error_code else ''})"
                    )
                    continue
                slogger.glob.error(
                    f"{e.kind.value.capitalize()} error; aborting. "
                    f"Details: {e.message} (status={e.status_code}{f', code={e.error_code}' if e.error_code else ''})"
                )
                if batched_output: # save remaining data if available
                    _batch_save_agent_results(converter, db_task, db_job, successful_frames, batched_output)
                    batched_output.clear()
                    successful_frames.clear()
                raise

        if batched_output:
            _batch_save_agent_results(converter, db_task, db_job, successful_frames, batched_output)


    @staticmethod
    def _update_progress(processed_frames, total_frames):
        job = rq.get_current_job()
        rq_job_meta = AgentRQMeta.for_job(job)
        # Calculate percentage (0-100) based on processed vs total frames
        progress_percent = int((processed_frames / total_frames) * 100) if total_frames > 0 else 0
        rq_job_meta.progress = progress_percent
        rq_job_meta.save()
        return job.get_status()