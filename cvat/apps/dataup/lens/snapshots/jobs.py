from __future__ import annotations

from datetime import datetime
from typing import Any

from django.utils import timezone
from django.contrib.auth.models import User

from cvat.apps.analytics_report.report.get import get_class_distribution
from cvat.apps.engine.models import Job, LabeledShape
from cvat.apps.events.export import _get_raw_analytics_data
from cvat.apps.events.utils import find_minimal_date_for_filter
from cvat.apps.engine.log import ServerLogManager

from .utils import compute_hash, get_events_by_scope, get_payload_key_from_str

slogger = ServerLogManager(__name__)


def _get_shape_dict(raw_events: list[dict[str, Any]]) -> dict[str, Any]:
    created_shapes_events = get_events_by_scope(raw_events, "create:shapes")
    deleted_shapes_events = get_events_by_scope(raw_events, "delete:shapes")
    updated_shapes_events = get_events_by_scope(raw_events, "update:shapes")
    shape_events = created_shapes_events + deleted_shapes_events + updated_shapes_events

    def _parse_ts(event: dict[str, Any]) -> datetime | None:
        ts = event.get("timestamp")
        if not ts:
            return None
        try:
            return datetime.fromisoformat(ts)
        except ValueError:
            return None

    timestamps = [t for e in shape_events if (t := _parse_ts(e)) is not None]

    return {
        "created_shapes": sum(e.get("count", 0) for e in created_shapes_events),
        "deleted_shapes": sum(e.get("count", 0) for e in deleted_shapes_events),
        "updated_shapes": sum(e.get("count", 0) for e in updated_shapes_events),
        "first_shape_event": min(timestamps).isoformat() if timestamps else None,
        "latest_shape_event": max(timestamps).isoformat() if timestamps else None,
    }


def _safe_user_uuid(user_id: int | None) -> str | None:
    if not user_id:
        return None
    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return None
    dataup = getattr(user, "dataup", None)
    return str(dataup.id) if dataup is not None else None


def _get_job_created_issues_dict(raw_events: list[dict[str, Any]]) -> dict[str, Any]:
    all_issues = get_events_by_scope(raw_events, "create:issue")
    all_comments = get_events_by_scope(raw_events, "create:comment")
    issue_to_comment: dict[int, str] = {}

    for comment in all_comments:
        issue_id = get_payload_key_from_str(comment, "issue")
        if not issue_id:
            continue

        issue_to_comment[issue_id] = comment.get("obj_name", "unknown message")

    job_issues_dicts: list[dict[str, Any]] = []
    for issue in all_issues:
        obj_id = issue.get("obj_id")
        user_id = issue.get("user_id")
        user_uuid = _safe_user_uuid(user_id)

        job_issues_dicts.append(
            {
                "created_by": user_uuid,
                "message": issue_to_comment.get(obj_id, "unknown issue"),
                "frame": get_payload_key_from_str(issue, key="frame"),
                "position": get_payload_key_from_str(issue, key="position"),
            }
        )

    return {
        "reported_issues": job_issues_dicts,
        "reported_issues_count": len(job_issues_dicts),
    }


def _get_job_submission_dict(raw_events: list[dict[str, Any]]) -> list[dict[str, Any]]:
    all_submits = get_events_by_scope(raw_events, "submit:job")
    submissions: list[dict[str, Any]] = []
    for job_submit in all_submits:
        user_id = job_submit.get("user_id")

        submissions.append(
            {
                "from_stage": get_payload_key_from_str(job_submit, "from_stage"),
                "to_stage": get_payload_key_from_str(job_submit, "to_stage"),
                "at": job_submit.get("timestamp"),
                "by": _safe_user_uuid(user_id),
            }
        )
    last_submission = max(submissions, key=lambda x: x["at"]) if submissions else None
    return submissions, last_submission

def get_last_saved_event(raw_events: list[dict[str, Any]]) -> dict:
    all_saves = get_events_by_scope(raw_events, "save:job")
    last_save = max(all_saves, key=lambda x: x["timestamp"]) if all_saves else {}
    return {
        "at": last_save.get("timestamp"),
        "by": _safe_user_uuid(last_save.get("user_id")),
    }


def create_job_snapshot(
    client: Any,
    job: Job,
    from_date: datetime,
    to_date: datetime,
    task_id: int | None = None,
    project_id: int | None = None,
) -> tuple[dict[str, Any], str | None]:
    """
    Build a JOB_OVERVIEW-style payload for a job, and return:
    - payload: full JSON to store in LensRow.payload
    - payload_hash: hash of the core logical state (for change detection)
    """
    try:
        query_params = {
            "job_id": job.id,
            "from": from_date,
            "to": to_date,
        }
        raw_dict = _get_raw_analytics_data(client, query_params)
        raw_events = raw_dict.get("events", [])

        core_shape_dict = _get_shape_dict(raw_events)
        reported_issues = _get_job_created_issues_dict(raw_events)
        per_job_shapes = LabeledShape.objects.filter(job_id=job.id).select_related("label", "job").prefetch_related("attributes__spec")
        all_submissions, last_submission = _get_job_submission_dict(raw_events)
        aggregated_analytics_dict: dict[str, Any] = {
            **core_shape_dict,
            **reported_issues,
            "total_shapes": len(per_job_shapes) if per_job_shapes else None,
            "total_frames": len(job.segment.frame_set),
            "per_class_distribution": get_class_distribution(job_id=job.id),
        }

        # Resolve IDs with fallbacks
        task_id = task_id or job.get_task_id()
        project_id = project_id or job.get_project_id()

        assignee_dataup = getattr(getattr(job, "assignee", None), "dataup", None)
        assignee_uuid = str(assignee_dataup.id) if assignee_dataup is not None else None

        org_dataup = getattr(getattr(job, "organization", None), "dataup", None)
        organization_uuid = str(org_dataup.id) if org_dataup is not None else None

        # --- core state used for hashing (no volatile metadata) ---
        core_state: dict[str, Any] = {
            "schema_version": "job_overview/v1",
            "job_id": job.id,
            "task_id": task_id,
            "project_id": project_id,
            "assignee_uuid": assignee_uuid,
            "organization_uuid": organization_uuid,
            "stage": getattr(job, "stage", None),
            "state": getattr(job, "state", None),
            "analytics": aggregated_analytics_dict,
            "last_submit": last_submission,
            "last_saved": get_last_saved_event(raw_events)
        }

        payload_hash = compute_hash(core_state)

        # --- full payload stored in LensRow.payload ---
        now = timezone.now().isoformat()

        payload: dict[str, Any] = {
            "schema_version": "job_overview/v1",
            "job": {
                "job_id": job.id,
                "task_id": task_id,
                "project_id": project_id,
                "assignee_uuid": assignee_uuid,
                "organization_uuid": organization_uuid,
                "stage": getattr(job, "stage", None),
                "state": getattr(job, "state", None),
                "submissions": all_submissions,
                "last_submit": last_submission,
                "last_saved": get_last_saved_event(raw_events)
            },
            "window": {
                "from": from_date.isoformat(),
                "to": to_date.isoformat(),
            },
            "snapshot": {
                "snapshot_id": (f"job-{job.id}-{payload_hash[:12]}" if payload_hash else None),
                "generated_at": now,
                "source": "cvat-dataup",
            },
            "analytics": aggregated_analytics_dict,
        }

        return payload, payload_hash
    except Exception as e:
        slogger.glob.error(f"Failed to create snapshot - error: {e}")
        return {}, None


def main(job_id: int) -> tuple[dict[str, Any], str | None]:
    from django.conf import settings
    import clickhouse_connect

    job = Job.objects.get(id=job_id)
    from_date = find_minimal_date_for_filter(job_id=job_id)
    to_date = datetime.now(timezone.utc)

    clickhouse_settings = settings.CLICKHOUSE["events"]
    with clickhouse_connect.get_client(
        host=clickhouse_settings["HOST"],
        database=clickhouse_settings["NAME"],
        port=clickhouse_settings["PORT"],
        username=clickhouse_settings["USER"],
        password=clickhouse_settings["PASSWORD"],
    ) as client:
        payload, payload_hash = create_job_snapshot(
            client,
            job,
            from_date=from_date,
            to_date=to_date,
        )
        print(payload)
        return payload, payload_hash
