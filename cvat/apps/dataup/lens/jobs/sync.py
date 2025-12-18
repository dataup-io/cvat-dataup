from datetime import timedelta, datetime
from typing import Optional, Any
import django_rq
from cvat.apps.dataup.lens.rq import LensRQMeta
from cvat.apps.dataup.dataup_api.client import DataUpAPIClient
from rq.job import Job as RQJob
from rq.job import JobStatus
from django.conf import settings
from django.utils import timezone
from cvat.apps.engine.models import Job, RequestAction, RequestTarget, Task
from cvat.apps.engine.rq import RequestId, define_dependent_job
from cvat.apps.engine.utils import get_rq_lock_for_job, get_rq_lock_by_user
from django.core.exceptions import ValidationError
from rest_framework import status
from cvat.apps.dataup.lens.snapshots.jobs import create_job_snapshot
from cvat.apps.dataup.models import LensRow, LensRowType
from cvat.apps.engine.log import ServerLogManager
import clickhouse_connect
import uuid
import httpx
import asyncio
from cvat.apps.events.utils import find_minimal_date_for_filter

MAX_CONCURRENCY = 5
MAX_TIMEOUT = 300
BATCH_PUSH_SIZE = 500


slogger = ServerLogManager(__name__)

LIMITS = httpx.Limits(
    max_connections=MAX_CONCURRENCY,
    max_keepalive_connections=MAX_CONCURRENCY,
)

TIMEOUT = httpx.Timeout(
    connect=10.0,  # or something reasonable
    read=MAX_TIMEOUT,  # keep your existing total read timeout
    write=None,
    pool=None,
)


def create_or_update_lens_row(
    client: Any,
    job: Job,
    row_type: LensRowType,
    *,
    from_date: datetime | None = None,
    to_date: datetime | None = None,
    task_id: int | None = None,
) -> LensRow | None:

    if from_date is None:
        from_date = find_minimal_date_for_filter(job_id=job.id)

    if to_date is None:
        to_date = datetime.now(timezone.utc)


    payload, payload_hash = create_job_snapshot(client, job, from_date=from_date, to_date=to_date)

    if not payload_hash:
        return

    task_id = job.get_task_id() if task_id is None else task_id
    org = getattr(job, "organization", None)
    org_uuid = org.dataup.id if org else None

    try:
        row = LensRow.objects.get(job_id=job.id)
        if row.sent_at is None:
            return row # this row needs to be pushed
    except LensRow.DoesNotExist:
        slogger.glob.info(f"Cannot find existing lens row for job {job.id} in task {task_id}, creating a new one")
        row = LensRow.objects.create(
            job_id=job.id,
            task_id=task_id,
            row_type=row_type,
            payload=payload,
            payload_hash=payload_hash,
            org_uuid=org_uuid,
            sent_at=None,
            last_error=None,
        )
        return row

    if row.payload_hash == payload_hash:
        return

    row.payload = payload
    row.payload_hash = payload_hash
    row.sent_at = None
    row.save(
        update_fields=[
            "payload",
            "payload_hash",
            "sent_at",
            "last_error",
            "updated_at",
        ]
    )
    return row

def mark_row_as_sent(row: LensRow):
    now = timezone.now()
    row.sent_at = now
    row.last_error = None
    row.save(update_fields=["sent_at", "last_error", "updated_at"])


def mark_row_error(row: LensRow, error: str) -> None:
    row.last_error = error
    row.save(update_fields=["last_error", "updated_at"])


async def push_lens_row(sem: asyncio.Semaphore, hc: httpx.AsyncClient, dataup_client: DataUpAPIClient, row: LensRow):
    async with sem:
        try:
            payload = {"task_id": row.task_id, "job_id": row.job_id, **row.payload}
            resp = await dataup_client.make_request(
                                _client=hc,
                                method="put",
                                endpoint=f"lens/snapshots/jobs/{row.id}",
                                data=payload,
                            )
            resp.raise_for_status()
        except Exception as exc:
            slogger.glob.error(f"Failed to push LensRow id={row.id} - error: {exc}")
            await asyncio.to_thread(mark_row_error, row, str(exc))
            return

        await asyncio.to_thread(mark_row_as_sent, row)


class LensQueue:
    RESULT_TTL = timedelta(hours=1)
    FAILED_TTL = timedelta(hours=6)

    def _get_queue(self):
        return django_rq.get_queue(settings.CVAT_QUEUES.LENS.value)

    def _get_job_class(self):
        return LensSyncJob

    def fetch_job(self, pk):
        """Fetch a specific job by ID."""
        queue = self._get_queue()
        rq_job = queue.fetch_job(pk)
        if rq_job is None or not LensRQMeta.for_job(rq_job).lens_:
            raise ValidationError("{} lens job is not found".format(pk), code=status.HTTP_404_NOT_FOUND)
        job_class = self._get_job_class()
        return job_class(job=rq_job)


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
        return [job_class(job=job) for job in jobs if job and LensRQMeta.for_job(job).lens_]

    def enqueue(
        self,
        task_id: int,
        request,
        dataup_client_cfg: dict,
        *,
        job_id: Optional[int] = None,
        organization_id: Optional[str] = None,
    ) -> "LensSyncJob":
        queue = self._get_queue()
        rq_id = RequestId(action=RequestAction.LENS_SNAPSHOT, target=RequestTarget.TASK, target_id=task_id).render()

        with get_rq_lock_for_job(queue, rq_id):
            if rq_job := queue.fetch_job(rq_id):
                if rq_job.get_status(refresh=False) not in {
                    JobStatus.FAILED,
                    JobStatus.FINISHED,
                }:
                    raise ValidationError(
                        "Only one running sync request is allowed for the same task #{}".format(task_id),
                        code=status.HTTP_409_CONFLICT,
                    )
                rq_job.delete()

            user_id = request.user.id
            with get_rq_lock_by_user(queue, user_id):
                meta = LensRQMeta.build_for(
                    request=request,
                    db_obj=Job.objects.get(pk=job_id) if job_id else Task.objects.get(pk=task_id),
                )
                rq_job = queue.create_job(
                    LensSyncJob(None),
                    job_id=rq_id,
                    meta=meta,
                    kwargs={
                        "task_id": task_id,
                        "dataup_client_cfg": dataup_client_cfg,
                        "organization_id": organization_id,
                        "user_id": user_id,
                    },
                    depends_on=define_dependent_job(queue, user_id),
                    result_ttl=self.RESULT_TTL.total_seconds(),
                    failure_ttl=self.FAILED_TTL.total_seconds(),
                )

                queue.enqueue_job(rq_job)

        return LensSyncJob(job=rq_job)


class LensSyncJob:
    def __init__(self, job: RQJob):
        self.job = job

    def _get_queue(self):
        return django_rq.get_queue(settings.CVAT_QUEUES.LENS.value)

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
        return self.get_status() == JobStatus.FINISHED

    @property
    def is_queued(self):
        """Check if job is queued."""
        return self.get_status() == JobStatus.QUEUED

    @property
    def is_failed(self):
        """Check if job failed."""
        return self.get_status() == JobStatus.FAILED

    @property
    def is_started(self):
        """Check if job is started."""
        return self.get_status() == JobStatus.STARTED

    @property
    def is_deferred(self):
        """Check if job is deferred."""
        return self.get_status() == JobStatus.DEFERRED

    @property
    def is_scheduled(self):
        """Check if job is scheduled."""
        return self.get_status() == JobStatus.SCHEDULED

    def to_dict(self) -> dict[str, Any]:
        """Convert job to dictionary representation."""
        return {
                "id": self.job.id,
                "status": self.get_status(),
                "created_at": self.job.created_at,
                "started_at": self.job.started_at,
                "ended_at": self.job.ended_at,
                "result": self.job.result,
                "exc_info": self.job.exc_info,
                "meta": self.job.meta,
            }
    @classmethod
    def __call__(cls, task_id: int, **kwargs):

        dataup_client_cfg = kwargs.get("dataup_client_cfg")
        dataup_client = DataUpAPIClient.from_cfg(dataup_client_cfg)
        rows = []
        clickhouse_settings = settings.CLICKHOUSE["events"]
        session_id = str(uuid.uuid4())
        try:
            with clickhouse_connect.get_client(
                host=clickhouse_settings["HOST"],
                database=clickhouse_settings["NAME"],
                port=clickhouse_settings["PORT"],
                username=clickhouse_settings["USER"],
                password=clickhouse_settings["PASSWORD"],
                settings={"session_id": session_id},
            ) as clickhouse_client:

                jobs = Job.objects.filter(segment__task_id=task_id)
                for job in jobs:
                    try:
                        row = create_or_update_lens_row(clickhouse_client, job, row_type=LensRowType.JOB_OVERVIEW)
                        if row:
                            rows.append(row)
                    except Exception as exc:
                        slogger.glob.exception(
                            f"Failed to create lens row for job {job.id} in task {task_id}",
                            exc_info=exc,
                        )

        except Exception as exc:
            slogger.glob.exception("Couldn't connect to ClickHouse", exc_info=exc)
            return



        sem = asyncio.Semaphore(MAX_CONCURRENCY)
        async def push_lens_rows():
            async with httpx.AsyncClient(timeout=TIMEOUT, limits=LIMITS, http2=True) as hc:
                tasks = [asyncio.create_task(push_lens_row(sem, hc, dataup_client, row)) for row in rows]
                await asyncio.gather(*tasks)

        if len(rows) == 0:
            slogger.glob.info(f"No updates to push, skipping")
            return

        slogger.glob.info(f"Found {len(rows)} lens snapshots to push, starting ...")
        asyncio.run(push_lens_rows())
        slogger.glob.info(f"Finished pushing {len(rows)} lens snapshots to push.")
