from __future__ import annotations
from typing import Optional
from django.conf import settings
from django.core.cache import cache
from cvat.apps.engine.models import Task
from cvat.apps.dataset_manager.bindings import TaskData
from cvat.apps.dataset_manager.annotation import AnnotationIR
from cvat.apps.engine.models import CloudProviderChoice
from cvat.apps.engine.cloud_provider import Credentials



DEFAULT_URL_TTL = getattr(settings, "CLOUD_PRESIGN_TTL", 600)


def _presign_s3(db_storage, key: str, ttl: int) -> str:
    import boto3
    from botocore.client import Config
    attrs = db_storage.get_specific_attributes()
    creds = _load_credentials(db_storage)
    session = boto3.Session(
        aws_access_key_id=creds.key or None,
        aws_secret_access_key=creds.secret_key or None,
        aws_session_token=creds.session_token or None,
        region_name=attrs.get('region'),
    )
    s3 = session.client("s3", endpoint_url=attrs.get('endpoint_url'), config=Config())
    return s3.generate_presigned_url(
        "get_object",
        Params={"Bucket": db_storage.resource, "Key": key},
        ExpiresIn=ttl,
    )

def _presign_azure(db_storage, key: str, ttl: int) -> Optional[str]:
    from datetime import datetime, timedelta
    from azure.storage.blob import generate_blob_sas, BlobSasPermissions
    creds = _load_credentials(db_storage)
    attrs = db_storage.get_specific_attributes()
    account = (creds.account_name or attrs.get("account_name"))
    container = db_storage.resource

    # Prefer account key / connection string: mint a short-lived SAS
    account_key = attrs.get("account_key") or creds.connection_string
    if account_key:
        sas = generate_blob_sas(
            account_name=account, container_name=container, blob_name=key,
            account_key=account_key, permission=BlobSasPermissions(read=True),
            expiry=datetime.utcnow() + timedelta(seconds=ttl),
        )
        base = f"https://{account}.blob.core.windows.net"
        return f"{base}/{container}/{key}?{sas}"

    # Fallback: stored SAS token on the credential (ACCOUNT_NAME_TOKEN_PAIR)
    if creds.session_token:
        base = f"https://{account}.blob.core.windows.net"
        token = creds.session_token.lstrip("?")
        return f"{base}/{container}/{key}?{token}"

    return None

def _presign_gcs(db_storage, key: str, ttl: int) -> Optional[str]:
    from datetime import timedelta
    from google.cloud import storage
    creds = _load_credentials(db_storage)
    client = (
        storage.Client.from_service_account_json(creds.key_file_path)
        if creds.key_file_path else storage.Client()
    )
    bucket = client.bucket(db_storage.resource)
    blob = bucket.blob(key)
    return blob.generate_signed_url(expiration=timedelta(seconds=ttl))


def _load_credentials(db_storage) -> Credentials:
    creds = Credentials()
    creds.convert_from_db({'type': db_storage.credentials_type, 'value': db_storage.credentials})
    return creds


def _get_db_cloud_storage(task: Task)-> Optional[CloudProviderChoice]:
    data = getattr(task, "data", None)
    return getattr(data, "cloud_storage", None)


def is_cloud_backed(task: Task) -> bool:
    return _get_db_cloud_storage(task) is not None

def get_object_key_for_frame(task, frame_id: int) -> Optional[str]:
    rel_path = TaskData(AnnotationIR("2d"), task).frame_info[frame_id]['path']
    if not rel_path:
        return None
    cs = _get_db_cloud_storage(task)
    prefix = (getattr(cs, "prefix", "") or "").strip("/") if cs else ""
    key = f"{prefix}/{rel_path.lstrip('/')}".lstrip("/") if prefix else rel_path.lstrip("/")
    return key or None


def generate_presigned_url_from_task_frame(task, frame_id: int, ttl: int = DEFAULT_URL_TTL) -> Optional[str]:
    if not getattr(settings, "ENABLE_CLOUD_PRESIGN", True):
        return None

    db_storage = _get_db_cloud_storage(task)
    if not db_storage:
        return None

    key = get_object_key_for_frame(task, frame_id)
    if not key:
        return None  # e.g., video frames

    cache_key = f"cvat:frame:url:{task.id}:{frame_id}"
    cached = cache.get(cache_key)
    if cached:
        return cached

    provider = db_storage.provider_type
    url = None
    if provider == CloudProviderChoice.AWS_S3:
        url = _presign_s3(db_storage, key, ttl)
    elif provider == CloudProviderChoice.AZURE_CONTAINER:
        url = _presign_azure(db_storage, key, ttl)
    elif provider == CloudProviderChoice.GOOGLE_CLOUD_STORAGE:
        url = _presign_gcs(db_storage, key, ttl)

    if url:
        cache.set(cache_key, url, max(ttl - 30, 60))
    return url