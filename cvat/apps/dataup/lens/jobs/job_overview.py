from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

import clickhouse_connect
import django_rq
from django.conf import settings
from django.utils import timezone

from cvat.apps.dataup.lens.snapshots.jobs import create_job_snapshot
from cvat.apps.dataup.models import LensRow, LensRowType
from cvat.apps.engine.models import Job
from cvat.apps.events.utils import find_minimal_date_for_filter


LOCK_KEY = "lens:recompute_job_overviews:lock"
LOCK_TTL_SECONDS = 30 * 60  # safety TTL in case the worker dies mid-run

JOB_ITERATOR_CHUNK_SIZE = 500


def _create_or_update_lens_row(
    client: Any,
    job: Job,
    row_type: LensRowType,
    *,
    from_date: datetime | None = None,
    to_date: datetime | None = None,
    task_id: int | None = None,
    project_id: int | None = None,
) -> None:
    """
    Compute a job analytics snapshot and upsert a LensRow for (job_id, row_type)
    only if the payload hash changed. If nothing changed, do nothing.
    """
    if from_date is None:
        from_date = find_minimal_date_for_filter(job_id=job.id)

    if to_date is None:
        to_date = datetime.now(timezone.utc)

    payload, payload_hash = create_job_snapshot(
        client,
        job,
        from_date=from_date,
        to_date=to_date,
    )

    if not payload_hash:
        return

    task_id = job.get_task_id() if task_id is None else task_id
    project_id = job.get_project_id() if project_id is None else project_id
    org = getattr(job, "organization", None)
    org_uuid = org.dataup.id if org else None

    try:
        row = LensRow.objects.get(job_id=job.id, row_type=row_type)
    except LensRow.DoesNotExist:
        LensRow.objects.create(
            job_id=job.id,
            task_id=task_id,
            row_type=row_type,
            payload=payload,
            payload_hash=payload_hash,
            org_uuid=org_uuid,
            sent_at=None,
            last_error=None,
        )
        return

    if row.payload_hash == payload_hash:
        return

    row.payload = payload
    row.payload_hash = payload_hash
    row.sent_at = None
    row.last_error = None
    row.save(
        update_fields=[
            "payload",
            "payload_hash",
            "sent_at",
            "last_error",
            "updated_at",
        ]
    )


def recompute_job_overviews() -> None:
    """
    Periodic job that recomputes job analytics snapshots for jobs and updates LensRow.

    Includes:
    - a Redis-based distributed lock to prevent concurrent runs across RQ workers
    - a unique ClickHouse session_id per run to avoid Session locking collisions
    - streamed iteration over Jobs to avoid loading everything into memory
    """
    redis = django_rq.get_connection("lens")

    # Prevent concurrent runs across workers/processes
    if not redis.set(LOCK_KEY, "1", nx=True, ex=LOCK_TTL_SECONDS):
        return

    try:
        clickhouse_settings = settings.CLICKHOUSE["events"]

        jobs = Job.objects.order_by("id").iterator(chunk_size=JOB_ITERATOR_CHUNK_SIZE)

        # Unique session per run: prevents ClickHouse SESSION_IS_LOCKED when multiple clients
        # share the same session_id (common with HTTP interface + overlapping jobs)
        session_id = str(uuid.uuid4())

        with clickhouse_connect.get_client(
            host=clickhouse_settings["HOST"],
            database=clickhouse_settings["NAME"],
            port=clickhouse_settings["PORT"],
            username=clickhouse_settings["USER"],
            password=clickhouse_settings["PASSWORD"],
            settings={"session_id": session_id},
        ) as client:
            for job in jobs:
                _create_or_update_lens_row(
                    client,
                    job,
                    row_type=LensRowType.JOB_OVERVIEW,
                )
    finally:
        redis.delete(LOCK_KEY)
