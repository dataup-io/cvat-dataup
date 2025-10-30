# Copyright (C) 2024 CVAT.ai Corporation
#
# SPDX-License-Identifier: MIT

"""
Object detection metrics for evaluating AI agent performance.

This module provides comprehensive metrics for object detection tasks including:
- IoU calculation
- Precision, Recall, F1-score
- Average Precision (AP) at different IoU thresholds
- Mean Average Precision (mAP)
- Frame-level and class-level metrics

Special handling:
- If a box has label == "ignore" (either in predictions or ground truth),
  it is excluded from evaluation. Additionally, unmatched evaluated predictions
  that overlap any ignored GT with IoU >= iou_ignore are suppressed (not counted as FP).
"""

from typing import List, Dict, Tuple
from cvat.apps.engine.log import ServerLogManager




slogger = ServerLogManager(__name__)

def calculate_iou(bbox1: List[float], bbox2: List[float]) -> float:
    """
    Calculate Intersection over Union (IoU) between two bounding boxes.

    Args:
        bbox1: [x1, y1, x2, y2] format (xyxy)
        bbox2: [x1, y1, x2, y2] format (xyxy)

    Returns:
        IoU value between 0 and 1
    """
    if not bbox1 or not bbox2 or len(bbox1) != 4 or len(bbox2) != 4:
        return 0.0

    x1_min, y1_min, x1_max, y1_max = bbox1
    x2_min, y2_min, x2_max, y2_max = bbox2

    # Calculate intersection coordinates
    inter_x_min = max(x1_min, x2_min)
    inter_y_min = max(y1_min, y2_min)
    inter_x_max = min(x1_max, x2_max)
    inter_y_max = min(y1_max, y2_max)

    # Check if there's no intersection
    if inter_x_max <= inter_x_min or inter_y_max <= inter_y_min:
        return 0.0

    # Calculate areas
    intersection = (inter_x_max - inter_x_min) * (inter_y_max - inter_y_min)
    area1 = max(0.0, (x1_max - x1_min)) * max(0.0, (y1_max - y1_min))
    area2 = max(0.0, (x2_max - x2_min)) * max(0.0, (y2_max - y2_min))
    union = area1 + area2 - intersection

    return intersection / union if union > 0 else 0.0


def _suppress_fp_over_ignored(
    unmatched_pred_indices: List[int],
    predictions: List[Dict],
    gt_ignore: List[Dict],
    iou_ignore: float,
) -> List[int]:
    """
    Remove prediction indices that overlap any ignored GT above iou_ignore.
    Returns the remaining FP indices that should be counted as FPs.
    """
    remaining = []
    for pi in unmatched_pred_indices:
        p = predictions[pi]
        p_bbox = p.get("bbox")
        p_frame = p.get("frame_id")
        if not p_bbox or len(p_bbox) != 4:
            # malformed -> keep as FP (conservative)
            remaining.append(pi)
            continue

        suppress = False
        for gi in gt_ignore:
            if gi.get("frame_id") != p_frame:
                continue
            iou = calculate_iou(p_bbox, gi.get("bbox", []))
            if iou >= iou_ignore:
                suppress = True
                break
        if not suppress:
            remaining.append(pi)
    return remaining


def match_predictions_to_ground_truth(
    predictions: List[Dict],
    ground_truth: List[Dict],
    iou_threshold: float = 0.5,
    iou_ignore: float = None,
) -> Tuple[List[Tuple[int, int, float]], List[int], List[int]]:
    """
    Greedy one-to-one matching of predictions to ground-truth boxes by highest IoU,
    with label equality and SAME-FRAME constraint. Implements "ignore" semantics:

    - Boxes with label == "ignore" in GT are not counted toward recall (not FNs).
    - Predictions with label == "ignore" are not evaluated.
    - Unmatched evaluated predictions that overlap any ignored GT with IoU >= iou_ignore
      are suppressed (not counted as FPs).

    Args:
        predictions: list of prediction dicts with keys: 'frame_id', 'label', 'bbox', 'confidence'
        ground_truth: list of GT dicts with keys: 'frame_id', 'label', 'bbox'
        iou_threshold: IoU threshold for matching TPs
        iou_ignore: IoU threshold for suppressing FPs on ignored GT.
                    Defaults to iou_threshold if None.

    Returns:
        matches: List of (pred_idx_in_input, gt_idx_in_input, iou)
        unmatched_predictions: List of pred indices (in input) to be counted as FPs (after suppression)
        unmatched_ground_truth: List of GT indices (in input) that are FNs (only for evaluated GT)
    """
    if iou_ignore is None:
        iou_ignore = iou_threshold

    # Split GT into evaluated vs ignored; filter predictions to evaluated-only
    gt_eval_indices = [i for i, g in enumerate(ground_truth) if g.get("label") != "ignore"]
    gt_ignore = [g for g in ground_truth if g.get("label") == "ignore"]

    pred_eval_indices = [i for i, p in enumerate(predictions) if p.get("label") != "ignore"]

    # Build filtered lists while keeping maps to original indices
    preds_f = [predictions[i] for i in pred_eval_indices]
    gt_f = [ground_truth[i] for i in gt_eval_indices]

    # Confidence sort (desc) if any confidence present
    order = list(range(len(preds_f)))
    if any("confidence" in p for p in preds_f):
        order.sort(key=lambda i: preds_f[i].get("confidence", 0.0), reverse=True)

    matches: List[Tuple[int, int, float]] = []
    used_gt = set()
    used_pred = set()

    # Pre-index GT by (frame_id, label) to prune candidates
    gt_by_key: Dict[Tuple[int, str], List[int]] = {}
    for j, gt in enumerate(gt_f):
        key = (gt.get("frame_id"), gt.get("label"))
        gt_by_key.setdefault(key, []).append(j)

    for idx in order:
        if idx in used_pred:
            continue

        p = preds_f[idx]
        p_bbox = p.get("bbox")
        p_label = p.get("label")
        p_frame = p.get("frame_id")

        if not p_bbox or len(p_bbox) != 4:
            continue  # skip malformed

        candidates = [j for j in gt_by_key.get((p_frame, p_label), []) if j not in used_gt]

        best_iou = 0.0
        best_j = -1
        for j in candidates:
            g = gt_f[j]
            iou = calculate_iou(p_bbox, g.get("bbox", []))
            if iou > best_iou:
                best_iou = iou
                best_j = j

        if best_j != -1 and best_iou >= iou_threshold:
            used_pred.add(idx)
            used_gt.add(best_j)
            # Map back to original indices
            matches.append((pred_eval_indices[idx], gt_eval_indices[best_j], best_iou))

    # Unmatched (in filtered/evaluated space)
    unmatched_pred_filtered = [i for i in range(len(preds_f)) if i not in used_pred]
    unmatched_gt_filtered = [j for j in range(len(gt_f)) if j not in used_gt]

    # Map unmatched GT back to original indices (these are FNs)
    unmatched_ground_truth = [gt_eval_indices[j] for j in unmatched_gt_filtered]

    # Suppress FPs that overlap ignored GT; then map back to original indices
    remaining_fp_filtered = _suppress_fp_over_ignored(
        unmatched_pred_filtered, preds_f, gt_ignore, iou_ignore
    )
    unmatched_predictions = [pred_eval_indices[i] for i in remaining_fp_filtered]

    return matches, unmatched_predictions, unmatched_ground_truth


def calculate_average_precision(
    predictions: List[Dict],
    ground_truth: List[Dict],
    iou_threshold: float = 0.5,
    iou_ignore: float = None,
) -> float:
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
    precisions = [ (t / (t + f)) if (t + f) > 0 else 0.0 for t, f in zip(tp_cum, fp_cum) ]
    recalls = [ (t / len(gt_eval)) for t in tp_cum ]

    # 11-point interpolation AP
    ap = 0.0
    for r_th in [i/10 for i in range(11)]:
        max_p = 0.0
        for r, p in zip(recalls, precisions):
            if r >= r_th:
                if p > max_p:
                    max_p = p
        ap += max_p
    return ap / 11.0


def calculate_frame_metrics(
    frames: List[int],
    predictions: Dict[int, List[Dict]],
    ground_truth: Dict[int, List[Dict]],
    iou_threshold: float = 0.5,
    iou_ignore: float = None,
) -> List[Dict]:
    """
    Calculate metrics for each frame, honoring ignore semantics.

    Args:
        frames: List of frame IDs
        predictions: Dict frame_id -> list of prediction dicts with 'bbox', 'label', 'confidence'
        ground_truth: Dict frame_id -> list of GT dicts with 'bbox', 'label'
        iou_threshold: IoU threshold for TPs
        iou_ignore: IoU threshold for FP suppression against ignored GT (defaults to iou_threshold)

    Returns:
        List of frame metric dictionaries
    """
    if iou_ignore is None:
        iou_ignore = iou_threshold

    frame_metrics: List[Dict] = []

    for frame_id in frames:
        frame_preds = predictions.get(frame_id, []) or []
        frame_gt = ground_truth.get(frame_id, []) or []

        # Quick exit when both empty
        if not frame_preds and not frame_gt:
            frame_metrics.append({
                "frame_id": frame_id,
                "precision": 1.0,
                "recall": 1.0,
                "f1": 1.0,
                "accuracy": 1.0,
                "mean_iou": 0.0,
                "detections": 0,
                "ground_truths": 0,
                "true_positives": 0,
                "false_positives": 0,
                "false_negatives": 0,
            })
            continue

        matches, unmatched_preds, unmatched_gt = match_predictions_to_ground_truth(
            frame_preds, frame_gt, iou_threshold=iou_threshold, iou_ignore=iou_ignore
        )

        tp = len(matches)
        fp = len(unmatched_preds)
        fn = len(unmatched_gt)

        precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
        recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
        f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0.0
        accuracy = tp / (tp + fp + fn) if (tp + fp + fn) > 0 else 0.0
        mean_iou = (sum(i for _, _, i in matches) / tp) if tp > 0 else 0.0

        # Count only evaluated boxes for reporting
        num_eval_preds = sum(1 for p in frame_preds if p.get("label") != "ignore")
        num_eval_gt = sum(1 for g in frame_gt if g.get("label") != "ignore")

        frame_metrics.append({
            "frame_id": frame_id,
            "precision": precision,
            "recall": recall,
            "f1": f1,
            "accuracy": accuracy,  # set-level Jaccard: TP/(TP+FP+FN)
            "mean_iou": mean_iou,
            "detections": num_eval_preds,
            "ground_truths": num_eval_gt,
            "true_positives": tp,
            "false_positives": fp,
            "false_negatives": fn,
        })

    return frame_metrics


def calculate_per_class_metrics(
    class_names: List[str],
    all_preds: List[Dict],
    all_gt: Dict[int, List[Dict]],
    iou_thresholds: List[float] = None,
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
        cls_gt = [g for g in all_gt if g.get("label") in (cls, "ignore")]

        # AP@0.50 and @0.75
        ap_50 = calculate_average_precision(cls_preds, cls_gt, iou_threshold=0.5)
        ap_75 = calculate_average_precision(cls_preds, cls_gt, iou_threshold=0.75)

        # AP@[.50:.95]
        ap_vals = [calculate_average_precision(cls_preds, cls_gt, iou_threshold=t) for t in iou_thresholds]
        ap_50_95 = sum(ap_vals) / len(ap_vals) if ap_vals else 0.0

        # For PR/F1-style snapshot at IoU=0.5, we need TP/FP/FN:
        matches, unmatched_preds, unmatched_gt = match_predictions_to_ground_truth(
            cls_preds, cls_gt, iou_threshold=0.5
        )
        tp = len(matches)
        fp = len(unmatched_preds)
        # unmatched_gt currently includes only evaluated GT (class == cls)
        fn = len(unmatched_gt)

        precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
        recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
        f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0.0

        per_class_metrics.append({
            "class_name": cls,
            "precision": precision,
            "recall": recall,
            "f1": f1,
            "ap_50": ap_50,
            "ap_75": ap_75,
            "ap_50_95": ap_50_95,
            "detections": len(cls_preds),
            "ground_truths": sum(1 for g in all_gt if g.get("label") == cls),
            "support": sum(1 for g in all_gt if g.get("label") == cls),
        })

    return per_class_metrics


def calculate_global_metrics(
    frame_metrics: List[Dict],
    per_class_metrics: List[Dict],
) -> Dict:

    tp = sum(fm.get("true_positives", 0) for fm in frame_metrics)
    fp = sum(fm.get("false_positives", 0) for fm in frame_metrics)
    fn = sum(fm.get("false_negatives", 0) for fm in frame_metrics)

    micro_precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
    micro_recall    = tp / (tp + fn) if (tp + fn) > 0 else 0.0
    micro_f1 = (
        2 * micro_precision * micro_recall / (micro_precision + micro_recall)
        if (micro_precision + micro_recall) > 0 else 0.0
    )

    # Mean IoU over all matched detections (weight frame mean_iou by TP count)
    total_matched = tp
    sum_iou = sum(
        (fm.get("mean_iou", 0.0) or 0.0) * fm.get("true_positives", 0)
        for fm in frame_metrics
    )
    mean_iou_overall = (sum_iou / total_matched) if total_matched > 0 else 0.0

    # ---- mAP-like numbers from per-class metrics ----
    if per_class_metrics:
        # Unweighted mean across classes (standard mAP)
        mAP50 = sum(c.get("ap_50", 0.0) for c in per_class_metrics) / len(per_class_metrics)
        mAP75 = sum(c.get("ap_75", 0.0) for c in per_class_metrics) / len(per_class_metrics)
    else:
        mAP50 = 0.0
        mAP75 = 0.0

    return {
        "average_precision": micro_precision,
        "average_recall": micro_recall,
        "average_f1": micro_f1,
        "mean_iou": mean_iou_overall,
        "precision_at_thresholds": {
            "0.5": mAP50,
            "0.75": mAP75,
        },
    }