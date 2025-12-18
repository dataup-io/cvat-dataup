import hashlib
import json
from typing import Any


def compute_hash(data: dict[str, Any]) -> str | None:
    """
    Compute a stable hash of a JSON-serializable structure.
    Uses sorted keys + compact separators to be deterministic.
    Returns None if the dict is empty/falsy.
    """
    if not data:
        return None

    s = json.dumps(data, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(s.encode("utf-8")).hexdigest()


def get_events_by_scope(events: list[dict[str, Any]], scope: str) -> list[dict[str, Any]]:
    return [event for event in events if event.get("scope") == scope]


def get_payload_key_from_str(event: dict, key: str) -> Any:
    payload_str = event.get("payload")
    if not payload_str:
        return None
    try:
        payload = json.loads(payload_str)
    except (TypeError, json.JSONDecodeError):
        return None
    return payload.get(key)
