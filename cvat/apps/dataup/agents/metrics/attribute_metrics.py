import random
from enum import Enum
from cvat.apps.dataup.agents.metrics.utils import wer, cer
from collections import defaultdict
from nltk.translate.bleu_score import sentence_bleu, SmoothingFunction
from cvat.apps.engine.models import AttributeType


def calculate_text_metrics(preds: list[str], gts: list[str]) -> dict:
    ch_errors = [cer(pred, gt) for pred, gt in zip(preds, gts)]
    w_errors = [wer(pred, gt, sep=" ") for pred, gt in zip(preds, gts)]

    avg_cer = sum(ch_errors) / len(ch_errors) if ch_errors else 0.0
    avg_wer = sum(w_errors) / len(w_errors) if w_errors else 0.0

    char_acc = 1 - (sum(ch_errors) / len(ch_errors)) if ch_errors else 0.0
    word_acc = 1 - (sum(w_errors) / len(w_errors)) if w_errors else 0.0


    # BLEU score (using sentence-level BLEU and smoothing)
    smoothie = SmoothingFunction().method4
    bleu_scores = []
    for pred, gt in zip(preds, gts):
        ref_tokens = gt.split()
        hyp_tokens = pred.split()
        # Protect against empty sequences
        if len(ref_tokens) == 0 or len(hyp_tokens) == 0:
            bleu_scores.append(0.0)
        else:
            score = sentence_bleu([ref_tokens], hyp_tokens, smoothing_function=smoothie)
            bleu_scores.append(score)
    avg_bleu = sum(bleu_scores) / len(bleu_scores) if bleu_scores else 0.0


    return {
        "char_accuracy": round(char_acc, 4),
        "word_accuracy": round(word_acc, 4),
        "avg_CER": round(avg_cer, 4),
        "avg_WER": round(avg_wer, 4),
        "avg_BLEU": round(avg_bleu, 4),
    }





def calculate_attribute_metrics(
    all_preds: list[dict], all_gts: list[dict], matches: list[tuple[int, int, float]]
) -> list[dict]:
    attribute_matches = defaultdict(list)
    for pred_idx, gt_idx, _ in matches:
        pred_attributes = all_preds[pred_idx].get("attributes", [])
        gt_attributes = all_gts[gt_idx].get("attributes", [])
        if not gt_attributes:  # skip if no ground truth attributes
            continue

        for gt_attr in gt_attributes:
            gt_attr_key = (gt_attr["type"], gt_attr["key"])
            pred_attr = next(
                iter(
                    [
                        pred_attr
                        for pred_attr in pred_attributes
                        if pred_attr["key"] == gt_attr["key"] # match by key
                    ]
                ),
                None,
            )
            if pred_attr:
                attribute_matches[gt_attr_key].append((pred_attr, gt_attr))

    attribute_metrics = []
    for match_key, attr_matches in attribute_matches.items():
        attr_type, attr_key = match_key
        if attr_type in [e.value for e in AttributeType]:
            if attr_type == AttributeType.TEXT.value:
                preds = [pred_attr["value"] for pred_attr, _ in attr_matches]
                gts = [gt_attr["value"] for _, gt_attr in attr_matches]
                attribute_metrics.append({attr_key: calculate_text_metrics(preds, gts)})

    return attribute_metrics
