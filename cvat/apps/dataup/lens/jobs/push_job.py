from typing import Any


import httpx
import asyncio
from cvat.apps.dataup.dataup_api.client import DataUpAPIClient
from cvat.apps.dataup.models import LensRow
from cvat.apps.engine.log import ServerLogManager
from django.utils import timezone


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


def mark_row_as_sent(row: LensRow):
    now = timezone.now()
    row.sent_at = now
    row.last_error = None
    row.save(update_fields=["sent_at", "last_error", "updated_at"])


def mark_row_error(row: LensRow, error: str) -> None:
    row.last_error = error
    row.save(update_fields=["last_error", "updated_at"])


def push_lens_rows():
    lens_rows = list[LensRow]((LensRow.objects.filter(sent_at__isnull=True).order_by("id")[:BATCH_PUSH_SIZE]))
    if not lens_rows:
        slogger.glob.info("No more lens snapshot to push - checking next iteration ...")
        return
    sem = asyncio.Semaphore(MAX_CONCURRENCY)

    async def push_batched_rows():
        async with httpx.AsyncClient(timeout=TIMEOUT, limits=LIMITS, http2=True) as hc:

            async def push_one_row(row: LensRow):
                async with sem:
                    try:
                        dataup_client = await asyncio.to_thread(DataUpAPIClient.build_for_obj, row)
                        payload = {"task_id": row.task_id, "job_id": row.job_id, **row.payload}
                        resp = await dataup_client.make_request(
                            _client=hc,
                            method="put",
                            endpoint=f"lens/snapshots/jobs/{row.id}",  # dashboard endpoint to ingest payload
                            data=payload,
                        )
                        resp.raise_for_status()
                    except Exception as exc:
                        slogger.glob.error(f"Failed to push LensRow id={row.id} - error: {exc}")
                        await asyncio.to_thread(mark_row_error, row, str(exc))
                        return
                    await asyncio.to_thread(mark_row_as_sent, row)

            tasks = [asyncio.create_task(push_one_row(row)) for row in lens_rows]
            await asyncio.gather(*tasks)

    slogger.glob.info(f"Found {len(lens_rows)} lens snapshots to push, starting ...")
    asyncio.run(push_batched_rows())
    slogger.glob.info(f"Finished pushing {len(lens_rows)} lens snapshots to push.")
