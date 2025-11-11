"""
Shared utility functions for agent jobs.
"""

from typing import Optional
from collections import defaultdict
from cvat.apps.engine.models import Job, Task, LabeledShape
from cvat.apps.dataup.utils.converters import DataUpAgentResultConverter
from cvat.apps.engine.serializers import LabeledDataSerializer
from cvat.apps.dataset_manager.task import PatchAction
import cvat.apps.dataset_manager as dm
from cvat.apps.engine.log import ServerLogManager


slogger = ServerLogManager(__name__)

# Common constants
MAX_BATCH_SIZE = 1
SAVE_EVERY_FRAMES = 10


def get_frame_to_job_ids(task_id: int, job_id: Optional[int] = None) -> dict[int, int]:
    """
    Build a mapping from frame_id -> job_id for the given task.
    If job_id is provided, map only that job’s frames.
    """
    mapping: dict[int, int] = {}
    if job_id:
        job = Job.objects.select_related("segment").get(pk=job_id)
        for f in job.segment.frame_set:
            mapping[f] = job.id
        return mapping

    jobs = Job.objects.filter(segment__task_id=task_id).select_related("segment")
    for job in jobs:
        for f in job.segment.frame_set:
            mapping[f] = job.id
    return mapping


def cleanup_task_or_job(db_task: Task, db_job: Optional[Job]):
    """
    Clean up task or job data.

    Args:
        db_task: The task object
        db_job: The job object (optional)

    Raises:
        ValueError: If neither task nor job is provided
    """
    if db_job:
        dm.task.delete_job_data(db_job.id)
    elif db_task:
        dm.task.delete_task_data(db_task.id)
    else:
        raise ValueError("Either task or job must be provided")


def get_task_job_from_ids(task_id: int, job_id: Optional[int], cleanup: bool = False) -> tuple[Task, Optional[Job]]:
    """
    Retrieve task and job objects from their IDs.

    Args:
        task_id: The task ID
        job_id: The job ID (optional)
        cleanup: Whether to clean up existing data

    Returns:
        Tuple of (Task, Optional[Job])
    """
    db_job = None
    if job_id:
        db_job = Job.objects.select_related("segment", "segment__task").get(pk=job_id)
        db_task = db_job.segment.task
    else:
        db_task = Task.objects.get(pk=task_id)

    if cleanup:
        cleanup_task_or_job(db_task, db_job)
    return db_task, db_job


def get_frame_ids_from_task_or_job(db_task: Task, db_job: Optional[Job]) -> list[int]:
    """
    Get frame IDs from task or job.

    Args:
        db_task: The task object
        db_job: The job object (optional)

    Returns:
        List of frame IDs
    """
    frame_ids = []
    if db_job:
        frame_ids = list(db_job.segment.frame_set)
    else:
        frame_ids = list(range(db_task.data.size))
    return frame_ids


def batch_save_agent_results(
    converter: DataUpAgentResultConverter,
    db_task: Task,
    db_job: Optional[Job],
    frames: list[int],
    results: list[dict],
):
    """
    Save agent results in batch.

    Args:
        converter: The result converter
        db_task: The task object
        db_job: The job object (optional)
        frames: List of frame IDs
        results: List of result dictionaries
    """
    converted_outputs = converter.convert(frames, results)
    serialized_output = LabeledDataSerializer(data=converted_outputs)
    serialized_output.is_valid(raise_exception=True)

    if db_job:
        dm.task.patch_job_data(db_job.id, serialized_output.validated_data, PatchAction.CREATE)
    else:
        dm.task.patch_task_data(db_task.id, serialized_output.validated_data, PatchAction.CREATE)


def update_progress(rq_job_meta, processed_frames: int, total_frames: int):
    """
    Update job progress.

    Args:
        rq_job_meta:
        processed_frames: Number of processed frames
        total_frames: Total number of frames
    """

    progress_percent = int((processed_frames / total_frames) * 100) if total_frames > 0 else 0
    if rq_job_meta:
        rq_job_meta.progress = progress_percent
        rq_job_meta.save()
        slogger.glob.info(f"Progress: {progress_percent}% ({processed_frames}/{total_frames} frames)")




def validate_agent_parameters(agent_id: str, task_id: int, **kwargs):
    """
    Validate common agent parameters.

    Args:
        agent_id: The agent ID
        task_id: The task ID
        **kwargs: Additional parameters to validate

    Raises:
        ValueError: If validation fails
    """
    if not agent_id:
        raise ValueError("Agent ID is required")

    if not task_id or task_id <= 0:
        raise ValueError("Valid task ID is required")

    # Add more validation as needed
    slogger.glob.info(f"Validated parameters for agent {agent_id} on task {task_id}")


def get_agent_queue_name(agent_type: str) -> str:
    """
    Get the queue name for a specific agent type.

    Args:
        agent_type: The type of agent (e.g., 'auto_annotate', 'evaluate')

    Returns:
        Queue name string
    """
    return f"agent_{agent_type}_queue"


def log_agent_job_start(agent_id: str, task_id: int, job_id: Optional[int], job_type: str):
    """
    Log the start of an agent job.

    Args:
        agent_id: The agent ID
        task_id: The task ID
        job_id: The job ID (optional)
        job_type: The type of job (e.g., 'auto_annotate', 'evaluate')
    """
    target = f"job {job_id}" if job_id else f"task {task_id}"
    slogger.glob.info(f"Starting {job_type} job for agent {agent_id} on {target}")


def log_agent_job_completion(agent_id: str, task_id: int, job_id: Optional[int], job_type: str, success: bool):
    """
    Log the completion of an agent job.

    Args:
        agent_id: The agent ID
        task_id: The task ID
        job_id: The job ID (optional)
        job_type: The type of job (e.g., 'auto_annotate', 'evaluate')
        success: Whether the job completed successfully
    """
    target = f"job {job_id}" if job_id else f"task {task_id}"
    status = "completed successfully" if success else "failed"
    slogger.glob.info(f"{job_type.capitalize()} job for agent {agent_id} on {target} {status}")


def get_bbox_from_shape(shape: LabeledShape) -> list[int]:
    """
    Calculate bounding box from shape points.

    Returns:
        Bounding box in xyxy format: [x1, y1, x2, y2]
    """
    points = list(shape.points) if shape.points else []
    if shape.type == "rectangle":
        return [int(p) for p in points]

    if shape.type == "polygon" and len(points) >= 4:
        x_coords = [int(points[i]) for i in range(0, len(points), 2)]
        y_coords = [int(points[i]) for i in range(1, len(points), 2)]
        return [min(x_coords), min(y_coords), max(x_coords), max(y_coords)]
    return []


def get_dataup_agent_predictions(frame_ids: list[int], predictions: list[dict], eval_classes: set[str]) -> dict[int, list[dict]]:
    """
    Convert agent predictions to a standard format for validation.

    Args:
        predictions: List of prediction dictionaries from agent

    Returns:
        List of standardized prediction dictionaries
    """
    batch_frame_predictions = defaultdict(list)
    for frame_id, per_frame_preds in zip(frame_ids, predictions):
        for pred in per_frame_preds["labels"]:
            bbox_xyxy = [
                int(pred["bbox"]["x"]),
                int(pred["bbox"]["y"]),
                int(pred["bbox"]["x"] + pred["bbox"]["width"]),
                int(pred["bbox"]["y"] + pred["bbox"]["height"]),
            ]
            standardized_pred = {
                "frame_id": frame_id,
                "label": pred["label"] if pred["label"] in eval_classes else "ignore",
                "bbox": bbox_xyxy,
                "confidence": pred.get("score", 0.0),
                "attributes": pred.get("attributes", []),
            }
            batch_frame_predictions[frame_id].append(standardized_pred)
    return batch_frame_predictions


def get_ground_truth_from_task(task_id: int, label_mapping: dict[str, dict]) -> dict[int, list[dict]]:
    """
    Retrieve ground truth annotations for all frames in a task.

    Args:
        task_id: The task ID to retrieve annotations from
        label_mapping: Dictionary mapping agent class name to db task label name
    Returns:
        Dictionary mapping frame_id to list of shape dictionaries
    """
    try:
        # Verify task exists
        Task.objects.get(id=task_id)
    except Task.DoesNotExist:
        slogger.glob.error(f"Task with id {task_id} does not exist")
        return {}

    # Query labeled shapes with optimized database access
    labeled_shapes = LabeledShape.objects.filter(job__segment__task_id=task_id).select_related("label", "job").prefetch_related("attributes__spec")

    slogger.glob.info(f"Found {labeled_shapes.count()} labeled shapes for task {task_id}")

    results = defaultdict(list)
    for shape in labeled_shapes:
        label_name = label_mapping.get(shape.label.name, "ignore")
        frame_id = shape.frame

        # Get attributes in the requested format
        attributes_list = [{"key": attr.spec.name, "value": attr.value, "type": attr.spec.input_type} for attr in shape.attributes.all()]

        results[frame_id].append(
            {
                "type": shape.type,
                "bbox": get_bbox_from_shape(shape),
                "label": label_name,
                "db_label": shape.label.name,
                "frame_id": shape.frame,
                "attributes": attributes_list,
            }
        )
    return dict(results)
