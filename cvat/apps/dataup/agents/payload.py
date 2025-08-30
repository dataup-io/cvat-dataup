from cvat.apps.dataup.utils.cloud_frames import TaskFrameProviderV2, is_cloud_backed
from cvat.apps.engine.frame_provider import FrameOutputType
from cvat.apps.engine.models import Task
from django.conf import settings
from rest_framework.exceptions import NotFound

def build_infer_payload(task_id: int, frame_ids: list[int], params: dict) -> dict:


    try:
        task = Task.objects.get(id=task_id)
    except Task.DoesNotExist as ex:
        raise NotFound(f"Task {task_id} does not exist") from ex

    image_urls = []
    images = []

    frame_provider = TaskFrameProviderV2(task)
    use_presigned_urls = getattr(settings, "USE_PRESIGNED_URLS", False)
    if use_presigned_urls and is_cloud_backed(task):
        image_urls = [frame_provider.get_frame_v2(frame_id, out_type=FrameOutputType.URL) for frame_id in frame_ids]
    else:
        images = [frame_provider.get_frame_v2(frame_id, out_type=FrameOutputType.BUFFER) for frame_id in frame_ids]
    return {"image_urls": image_urls, "images": images, "params": params}