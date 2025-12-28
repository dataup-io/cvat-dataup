from cvat.apps.dataup.utils.cloud_frames import TaskFrameProviderV2, is_cloud_backed
from cvat.apps.engine.frame_provider import FrameOutputType
from cvat.apps.engine.models import Task
from django.conf import settings
from rest_framework.exceptions import NotFound


def get_frames_from_task(task_id: int, frame_ids: list[int]) -> tuple[list[str], list[str]]:
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

    return image_urls, images


def _prepare_interactor_params(params: dict) -> dict:
    return {
        "param_type": "sam3",
        "text_prompt": params.get("text_prompt", ""),
        "geom_prompt": {
            "positive_boxes": params.get("positive_boxes", []),
            "negative_boxes": params.get("negative_boxes", []),
        },
    },  params.get("session_id")


def _prepare_detector_params(params: dict) -> dict:
    threshold = params.get("threshold", 0.5)
    iou_threshold = params.get("iou_threshold", 0.5)
    max_detections = params.get("max_detections", 100)
    prompt = params.get("prompt")
    return {
        "param_type": "detector",
        "threshold": threshold,
        "iou_threshold": iou_threshold,
        "max_detections": max_detections,
        "prompt": prompt,
    }


def prepare_payload_params(params: dict, task_type: str = "annotate_frame") -> dict:
    if task_type == "interact":
        return _prepare_interactor_params(params)
    elif task_type == "annotate_frame":
        return _prepare_detector_params(params), None # no session id for annotate_frame
    else:
        raise ValueError(f"Unknown task type {task_type}")


def get_request_id(organization_uuid: str, task_id: int, frame_ids: list[int], task_type: dict) -> str:
    return f"{organization_uuid}_{task_id}_{task_type}_{'-'.join(str(frame_id) for frame_id in frame_ids)}"


def build_infer_payload(
    organization_uuid: str,
    task_id: int,
    frame_ids: list[int],
    params: dict,
    task_type: str = "annotate_frame",
) -> dict:
    request_id = get_request_id(organization_uuid, task_id, frame_ids, task_type)
    image_urls, images = get_frames_from_task(task_id, frame_ids)
    params, session_id = prepare_payload_params(params, task_type)
    return {
        "request_id": request_id,
        "session_id": session_id,
        "image_urls": image_urls,
        "images_b64": images,
        "params": params,
    }
