from typing import Any, List, Dict
from cvat.apps.engine.log import ServerLogManager
from cvat.apps.dataup.agents.metrics.utils import (
    calculate_iou,
    match_predictions_to_ground_truth,
)
from collections import defaultdict
from cvat.apps.dataup.agents.jobs.utils import get_frame_to_job_ids

slogger = ServerLogManager(__name__)


def _calculate_stats_per_frame(
    all_preds: list[dict], all_gts: list[dict], matches: list[tuple[int, int]], unmatched_preds: list[int], unmatched_gts: list[int]
) -> tuple[dict, dict, dict]:
    tp_per_frame = defaultdict(int)
    fp_per_frame = defaultdict(int)
    fn_per_frame = defaultdict(int)
    # calculate true positives per frame

    for pred_idx, _, _ in matches:
        p = all_preds[pred_idx]
        frame_id = p["frame_id"]
        tp_per_frame[frame_id] += 1

    # calculate false positives per frame
    for pred_idx in unmatched_preds:
        p = all_preds[pred_idx]
        frame_id = p["frame_id"]
        fp_per_frame[frame_id] += 1

    # calculate false negatives per frame
    for gt_idx in unmatched_gts:
        g = all_gts[gt_idx]
        frame_id = g["frame_id"]
        fn_per_frame[frame_id] += 1

    return tp_per_frame, fp_per_frame, fn_per_frame


def _calculate_stats_per_job(
    all_preds: list[dict],
    all_gts: list[dict],
    matches: list[tuple[int, int]],
    unmatched_preds: list[int],
    unmatched_gts: list[int],
    frame_to_job_ids: dict[int, int],
) -> tuple[dict, dict, dict]:
    tp_per_job = defaultdict(int)
    fp_per_job = defaultdict(int)
    fn_per_job = defaultdict(int)
    # calculate true positives per frame

    for pred_idx, _, _ in matches:
        p = all_preds[pred_idx]
        frame_id = p["frame_id"]
        job_id = frame_to_job_ids[frame_id]
        tp_per_job[job_id] += 1

    # calculate false positives per frame
    for pred_idx in unmatched_preds:
        p = all_preds[pred_idx]
        frame_id = p["frame_id"]
        job_id = frame_to_job_ids[frame_id]
        fp_per_job[job_id] += 1

    # calculate false negatives per frame
    for gt_idx in unmatched_gts:
        g = all_gts[gt_idx]
        frame_id = g["frame_id"]
        job_id = frame_to_job_ids[frame_id]
        fn_per_job[job_id] += 1

    return tp_per_job, fp_per_job, fn_per_job


def calculate_average_precision(predictions: list[dict], ground_truth: list[dict], iou_threshold: float = 0.5, iou_ignore: float = None) -> float:
    """
    Calculate Average Precision (AP) at a given IoU threshold for a SINGLE CLASS.
    Implements ignore semantics and SAME-FRAME constraint.

    - predictions with label == "ignore" are dropped
    - GT with label == "ignore" do not count toward recall
    - Unmatched predictions that overlap ignored GT at IoU >= iou_ignore are suppressed (not FP)

    Args:
        predictions: predictions for ONE class (caller should filter by class label)
        ground_truth: all GT boxes (any classes); this function filters label != class or "ignore" as needed
        iou_threshold: IoU threshold for TPs
        iou_ignore: IoU threshold for FP suppression on ignored GT (defaults to iou_threshold)

    Returns:
        Average Precision (11-point interpolation)
    """
    if iou_ignore is None:
        iou_ignore = iou_threshold

    # Drop predictions that are "ignore" (caller should also pass only one class)
    preds = [p for p in predictions if p.get("label") != "ignore"]
    if not preds:
        # If no evaluated predictions, AP is 0 unless there are also no GT of this class.
        # We will handle denom below.
        pass

    # Separate GT for class (evaluated) vs ignored
    # NOTE: caller is expected to pass class-specific GT; if not, we still filter here by matching labels.
    if preds:
        class_name = preds[0].get("label")
    else:
        # Fallback: try to infer class from GT (rare) – if none, AP=0
        eval_gt = [g for g in ground_truth if g.get("label") not in ("ignore", None)]
        class_name = eval_gt[0]["label"] if eval_gt else None

    gt_eval = [g for g in ground_truth if g.get("label") == class_name]
    gt_ignore = [g for g in ground_truth if g.get("label") == "ignore"]

    if not gt_eval:
        # No GT of this class -> AP is 0.0 by convention here
        return 0.0

    # Sort predictions by confidence
    preds_sorted = sorted(preds, key=lambda x: x.get("confidence", 0.0), reverse=True)

    # Track matched GTs by their index in gt_eval, per frame
    gt_matched = [False] * len(gt_eval)

    tp = []
    fp = []

    # Build index of GT by frame for faster same-frame lookup
    gt_indices_by_frame = {}
    for j, g in enumerate(gt_eval):
        gt_indices_by_frame.setdefault(g.get("frame_id"), []).append(j)

    for p in preds_sorted:
        p_bbox = p.get("bbox")
        p_frame = p.get("frame_id")

        if not p_bbox or len(p_bbox) != 4:
            fp.append(1)
            tp.append(0)
            continue

        # 1) Try matching to best GT of this class in SAME FRAME
        best_iou = 0.0
        best_j = -1
        for j in gt_indices_by_frame.get(p_frame, []):
            if gt_matched[j]:
                continue
            iou = calculate_iou(p_bbox, gt_eval[j].get("bbox", []))
            if iou > best_iou:
                best_iou = iou
                best_j = j

        if best_j != -1 and best_iou >= iou_threshold:
            gt_matched[best_j] = True
            tp.append(1)
            fp.append(0)
            continue

        # 2) If not matched, check suppression against ignored GT in SAME FRAME
        suppressed = False
        for ig in gt_ignore:
            if ig.get("frame_id") != p_frame:
                continue
            iou_ig = calculate_iou(p_bbox, ig.get("bbox", []))
            if iou_ig >= iou_ignore:
                suppressed = True
                break

        if suppressed:
            # Neither TP nor FP: skip contribution
            continue
        else:
            fp.append(1)
            tp.append(0)

    if not tp and not fp:
        return 0.0

    # Cumulative TP/FP
    tp_cum = []
    fp_cum = []
    s_tp = 0
    s_fp = 0
    for t, f in zip(tp, fp):
        s_tp += t
        s_fp += f
        tp_cum.append(s_tp)
        fp_cum.append(s_fp)

    # Precision/Recall points
    precisions = [(t / (t + f)) if (t + f) > 0 else 0.0 for t, f in zip(tp_cum, fp_cum)]
    recalls = [(t / len(gt_eval)) for t in tp_cum]

    # 11-point interpolation AP
    ap = 0.0
    for r_th in [i / 10 for i in range(11)]:
        max_p = 0.0
        for r, p in zip(recalls, precisions):
            if r >= r_th:
                if p > max_p:
                    max_p = p
        ap += max_p
    return ap / 11.0


def calculate_per_class_metrics(
    class_names: List[str], all_preds: List[Dict], all_gts: Dict[int, List[Dict]], iou_thresholds: List[float] = None
) -> List[Dict]:
    """
    Calculate per-class metrics including AP at different IoU thresholds,
    honoring ignore semantics and SAME-FRAME constraint.

    Args:
        class_names: List of class names (exclude "ignore")
        predictions: Flat list of prediction dicts with 'frame_id','bbox','label','confidence'
        ground_truth: Dict frame_id -> list of GT dicts with 'frame_id','bbox','label'
        iou_thresholds: thresholds for COCO-style AP; default [0.5, 0.55, ..., 0.95]

    Returns:
        List of per-class metric dictionaries
    """
    if iou_thresholds is None:
        iou_thresholds = [0.5 + 0.05 * i for i in range(10)]  # 0.5:0.95

    per_class_metrics: List[Dict] = []

    for cls in class_names:
        # Filter predictions to this class (drop ignores explicitly)
        cls_preds = [p for p in all_preds if p.get("label") == cls]

        # Filter GT to this class or ignore (ignore is needed for FP suppression)
        cls_gt = [g for g in all_gts if g.get("label") in (cls, "ignore")]

        # AP@0.50 and @0.75
        ap_50 = calculate_average_precision(cls_preds, cls_gt, iou_threshold=0.5)
        ap_75 = calculate_average_precision(cls_preds, cls_gt, iou_threshold=0.75)

        # AP@[.50:.95]
        ap_vals = [calculate_average_precision(cls_preds, cls_gt, iou_threshold=t) for t in iou_thresholds]
        ap_50_95 = sum(ap_vals) / len(ap_vals) if ap_vals else 0.0

        # For PR/F1-style snapshot at IoU=0.5, we need TP/FP/FN:
        matches, unmatched_preds, unmatched_gt = match_predictions_to_ground_truth(cls_preds, cls_gt, iou_threshold=0.5)
        tp = len(matches)
        fp = len(unmatched_preds)
        # unmatched_gt currently includes only evaluated GT (class == cls)
        fn = len(unmatched_gt)

        precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
        recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
        f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0.0

        per_class_metrics.append(
            {
                "class_name": cls,
                "precision": precision,
                "recall": recall,
                "f1": f1,
                "ap_50": ap_50,
                "ap_75": ap_75,
                "ap_50_95": ap_50_95,
                "detections": len(cls_preds),
                "ground_truths": sum(1 for g in all_gts if g.get("label") == cls),
                "support": sum(1 for g in all_gts if g.get("label") == cls),
            }
        )

    return per_class_metrics


def calculate_object_detection_metrics(
    all_preds: list[dict],
    all_gts: list[dict],
    matches: list[tuple[int, int, float]],
    unmatched_preds: list[int],
    unmatched_gts: list[int],
    class_names: list[str],
    frame_to_job_ids: dict[int, int],
) -> dict:
    """
    Calculate object detection metrics for all predictions and ground truth.
    """
    # overall metric
    tp_per_frame, fp_per_frame, fn_per_frame = _calculate_stats_per_frame(all_preds, all_gts, matches, unmatched_preds, unmatched_gts)

    tp_per_job, fp_per_job, fn_per_job = _calculate_stats_per_job(
        all_preds, all_gts, matches, unmatched_preds, unmatched_gts, frame_to_job_ids=frame_to_job_ids
    )
    # Collect all job ids from keys (not values)
    all_job_ids = set(tp_per_job.keys()) | set(fp_per_job.keys()) | set(fn_per_job.keys())
    job_metrics: list[dict] = []
    for job_id in all_job_ids:
        tp = tp_per_job[job_id]
        fp = fp_per_job[job_id]
        fn = fn_per_job[job_id]
        precision = tp / (tp + fp) if tp + fp > 0 else 0
        recall = tp / (tp + fn) if tp + fn > 0 else 0

        f1 = 2 * precision * recall / (precision + recall) if precision + recall > 0 else 0
        job_metrics.append(
            {
                "job_id": job_id,
                "true_positives": tp,
                "false_positives": fp,
                "false_negatives": fn,
                "precision": precision,
                "recall": recall,
                "f1": f1,
                "ground_truths": tp + fn,
                "detections": tp + fp,
            }
        )
    # Previously calculated per-frame metrics are no longer returned; UI will use per-job metrics.

    # calculate overall metrics
    tp = sum(tp_per_frame.values())
    fp = sum(fp_per_frame.values())
    fn = sum(fn_per_frame.values())
    precision = tp / (tp + fp) if tp + fp > 0 else 0
    recall = tp / (tp + fn) if tp + fn > 0 else 0
    mean_iou = sum([match[2] for match in matches]) / len(matches) if matches else 0
    f1 = 2 * precision * recall / (precision + recall) if precision + recall > 0 else 0

    global_metrics = {"average_precision": precision, "average_recall": recall, "average_f1": f1, "mean_iou": mean_iou}
    per_class_metrics = calculate_per_class_metrics(class_names=class_names, all_preds=all_preds, all_gts=all_gts)

    return {"job_metrics": job_metrics, "global_metrics": global_metrics, "per_class_metrics": per_class_metrics}
