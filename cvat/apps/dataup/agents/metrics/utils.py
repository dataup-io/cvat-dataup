def calculate_iou(bbox1: list[float], bbox2: list[float]) -> float:
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
    unmatched_pred_indices: list[int],
    predictions: list[dict],
    gt_ignore: list[dict],
    iou_ignore: float,
) -> list[int]:
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
    predictions: list[dict],
    ground_truth: list[dict],
    iou_threshold: float = 0.5,
    iou_ignore: float = None,
) -> tuple[list[tuple[int, int, float]], list[int], list[int]]:
    """
    Greedy one-to-one matching of predictions to ground-truth boxes by highest IoU,
    with label equality, SAME-FRAME constraint and "ignore" semantics

    - Boxes with label == "ignore" in GT are not counted toward recall (not FNs).
    - Predictions with label == "ignore" are not evaluated.
    - Unmatched evaluated predictions that overlap any ignored GT with IoU >= iou_ignore
      are suppressed (not counted as FPs).

    Args:
        predictions: list of prediction dicts with keys: 'frame_id', 'label', 'bbox', 'confidence', 'attributes'
        ground_truth: list of GT dicts with keys: 'frame_id', 'label', 'bbox'
        iou_threshold: IoU threshold for matching TPs
        iou_ignore: IoU threshold for suppressing FPs on ignored GT.
                    Defaults to iou_threshold if None.

    Returns:
        matches: list of (pred_idx_in_input, gt_idx_in_input, iou)
        unmatched_predictions: List of pred indices (in input) to be counted as FPs (after suppression)
        unmatched_ground_truth: List of GT indices (in input) that are FNs (only for evaluated GT)
    """
    if iou_ignore is None:
        iou_ignore = iou_threshold

    gt_evals_indices = [i for i, gt in enumerate(ground_truth) if gt["label"] != "ignore"]
    gt_ignore = [g for g in ground_truth if g["label"] == "ignore"]
    preds_eval_indices = [i for i, p in enumerate(predictions) if p["label"] != "ignore"]

    # Filter predictions and ground truth to only include evaluated boxes
    preds_f = [predictions[i] for i in preds_eval_indices]
    gts_f = [ground_truth[i] for i in gt_evals_indices]

    matches: list[tuple[int, int]] = []
    used_pred = set()
    used_gt = set()

    # pre-index GT with frame_id and label
    gts_by_key: dict[tuple[int, str], list[int]] = {}
    for i, gt in enumerate(gts_f):
        key = (gt["frame_id"], gt["label"])
        gts_by_key.setdefault(key, []).append(i)

    # order predictions by confidence when present
    pred_indices = list(range(len(preds_f)))
    pred_indices.sort(key=lambda i: preds_f[i].get("confidence", 0.0), reverse=True)

    for pred_idx in pred_indices:
        if pred_idx in used_pred:  # prediction has been matched
            continue

        pred = preds_f[pred_idx]
        pred_key = (pred["frame_id"], pred["label"])
        pred_bbox = pred["bbox"]

        gt_candidates = [j for j in gts_by_key.get(pred_key, []) if j not in used_gt]

        best_iou = 0.0
        best_gt_idx = -1

        for j in gt_candidates:
            gt_candidate = gts_f[j]
            gt_bbox = gt_candidate.get("bbox", [])
            iou = calculate_iou(pred_bbox, gt_bbox)
            if iou > best_iou:
                best_iou = iou
                best_gt_idx = j

        if best_gt_idx != -1 and best_iou >= iou_threshold:
            used_pred.add(pred_idx)
            used_gt.add(best_gt_idx)
            # Map back to original indices
            matches.append((preds_eval_indices[pred_idx], gt_evals_indices[best_gt_idx], best_iou))

    unmatched_ground_truth: list[int] = [j for j in range(len(gts_f)) if j not in used_gt]
    unmatched_pred_filtered = [i for i in range(len(preds_f)) if i not in used_pred]
    unmatched_predictions: list[int] = _suppress_fp_over_ignored(unmatched_pred_filtered, preds_f, gt_ignore, iou_ignore)

    return matches, unmatched_predictions, unmatched_ground_truth


def lev(s, t):
    """
    iterative_levenshtein(s, t) -> ldist
    ldist is the Levenshtein distance between the strings
    s and t.
    For all i and j, dist[i,j] will contain the Levenshtein
    distance between the first i characters of s and the
    first j characters of t
    """
    rows = len(s) + 1
    cols = len(t) + 1
    dist = [[0 for x in range(cols)] for x in range(rows)]

    # source prefixes can be transformed into empty strings
    # by deletions:
    for i in range(1, rows):
        dist[i][0] = i

    # target prefixes can be created from an empty source string
    # by inserting the characters
    for i in range(1, cols):
        dist[0][i] = i

    row = 0
    col = 0
    for col in range(1, cols):
        for row in range(1, rows):
            if s[row - 1] == t[col - 1]:
                cost = 0
            else:
                cost = 1
            dist[row][col] = min(
                dist[row - 1][col] + 1,  # deletion
                dist[row][col - 1] + 1,  # insertion
                dist[row - 1][col - 1] + cost,
            )  # substitution

    return dist[row][col]


def cer(pred, label):
    error = lev(pred, label) / max(len(pred), len(label)) if max(len(pred), len(label)) != 0 else 0
    return error


def wer(pred, label, sep=None):
    preds = pred.split(sep)
    words = label.split(sep)
    error = lev(preds, words) / max(len(preds), len(words)) if max(len(preds), len(words)) != 0 else 0
    return error
