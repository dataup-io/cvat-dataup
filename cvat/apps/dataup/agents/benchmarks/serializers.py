from typing import Any

from rest_framework import serializers


class GlobalMetricsSerializer(serializers.Serializer):
    average_precision = serializers.FloatField(min_value=0.0, max_value=1.0)
    average_recall = serializers.FloatField(min_value=0.0, max_value=1.0)
    average_f1 = serializers.FloatField(min_value=0.0, max_value=1.0)
    mean_iou = serializers.FloatField(min_value=0.0, max_value=1.0)


class JobMetricsSerializer(serializers.Serializer):
    job_id = serializers.IntegerField(min_value=0)
    true_positives = serializers.IntegerField(min_value=0)
    false_positives = serializers.IntegerField(min_value=0)
    false_negatives = serializers.IntegerField(min_value=0)
    precision = serializers.FloatField(min_value=0.0, max_value=1.0)
    recall = serializers.FloatField(min_value=0.0, max_value=1.0)
    f1 = serializers.FloatField(min_value=0.0, max_value=1.0)
    ground_truths = serializers.IntegerField(min_value=0)
    detections = serializers.IntegerField(min_value=0)


class PerClassMetricsSerializer(serializers.Serializer):
    class_name = serializers.CharField(max_length=256)
    precision = serializers.FloatField(min_value=0.0, max_value=1.0)
    recall = serializers.FloatField(min_value=0.0, max_value=1.0)
    f1 = serializers.FloatField(min_value=0.0, max_value=1.0)
    ap_50 = serializers.FloatField(min_value=0.0, max_value=1.0)
    ap_75 = serializers.FloatField(min_value=0.0, max_value=1.0)
    ap_50_95 = serializers.FloatField(min_value=0.0, max_value=1.0)
    detections = serializers.IntegerField(min_value=0)
    ground_truths = serializers.IntegerField(min_value=0)
    support = serializers.IntegerField(min_value=0)


class TextAttributeMetricsSerializer(serializers.Serializer):
    char_accuracy = serializers.FloatField(min_value=0.0, max_value=1.0)
    word_accuracy = serializers.FloatField(min_value=0.0, max_value=1.0)
    avg_cer = serializers.FloatField(min_value=0.0)
    avg_wer = serializers.FloatField(min_value=0.0)
    avg_bleu = serializers.FloatField(min_value=0.0, max_value=1.0)


class AttributeMetricItemSerializer(serializers.Serializer):
    # Each item is a single-key object: { "<attribute_key>": { ...metrics... } }
    # Accept any metrics dict for extensibility; validate text metrics shape when detected.
    def to_internal_value(self, data):
        if not isinstance(data, dict):
            raise serializers.ValidationError("Each attribute metric item must be an object")
        if len(data) != 1:
            raise serializers.ValidationError("Each attribute metric item must have exactly one key")
        key, value = next(iter(data.items()))
        if not isinstance(key, str):
            raise serializers.ValidationError("Attribute name must be a string")
        if not isinstance(value, dict):
            raise serializers.ValidationError("Attribute metrics must be an object")

        # Try validating as text metrics if it looks like that shape
        text_keys = {"char_accuracy", "word_accuracy", "avg_CER", "avg_WER", "avg_BLEU", "avg_cer", "avg_wer", "avg_bleu"}
        if any(k in value for k in text_keys):
            # Normalize possible camel case from backend to snake case keys used here
            normalized = {
                "char_accuracy": value.get("char_accuracy", value.get("charAccuracy")),
                "word_accuracy": value.get("word_accuracy", value.get("wordAccuracy")),
                "avg_cer": value.get("avg_cer", value.get("avg_CER")),
                "avg_wer": value.get("avg_wer", value.get("avg_WER")),
                "avg_bleu": value.get("avg_bleu", value.get("avg_BLEU")),
            }
            serializer = TextAttributeMetricsSerializer(data=normalized)
            serializer.is_valid(raise_exception=True)
            value = serializer.validated_data

        return {key: value}

    def to_representation(self, obj):
        # Pass-through representation
        return obj


class BenchmarkBaseSerializer(serializers.Serializer):
    agent_id = serializers.CharField()
    agent_version = serializers.CharField(max_length=40)
    task_type = serializers.CharField(max_length=40)
    dataset_id = serializers.IntegerField(min_value=0)
    processed_frames = serializers.IntegerField(min_value=0)
    evaluation_time_sec = serializers.FloatField(min_value=0.0, required=False, allow_null=True)

    global_metrics = GlobalMetricsSerializer()
    job_metrics = JobMetricsSerializer(many=True)
    per_class_metrics = PerClassMetricsSerializer(many=True)
    attribute_metrics = AttributeMetricItemSerializer(many=True)


class AgentBenchmarkWriteSerializer(BenchmarkBaseSerializer):
    predictions = serializers.ListField(child=serializers.DictField(), required=True)


class AgentBenchmarkReadSerializer(BenchmarkBaseSerializer):
    id = serializers.CharField()
    owner_id = serializers.CharField()
    created_at = serializers.DateTimeField()


class AgentBenchmarkPredictionSerializer(BenchmarkBaseSerializer):
    pass


def build_benchmark_payload(rq_results: dict, agent_id: str, task_id: int) -> dict:
    """
    Build benchmark payload from RQ results, matching the format expected by AgentBenchmarkWriteSerializer.
    This replaces the frontend buildBenchmarkSubmitPayload function.
    """
    if not rq_results:
        raise ValueError("RQ results are empty or None")

    # Extract data from RQ results
    result = rq_results

    # Build payload matching AgentBenchmarkWriteSerializer structure
    payload = {
        # Required identifiers
        "agent_id": agent_id,
        "agent_version": result.get("agent_version", "1.0.0"),
        "task_type": result.get("task_type", "object_detection"),
        "dataset_id": result.get("dataset_id") or task_id,
        # Summary information
        "processed_frames": result.get("processed_frames", 0),
        # Global metrics (omit precision_at_thresholds)
        "global_metrics": {
            "average_precision": result.get("global_metrics", {}).get("average_precision"),
            "average_recall": result.get("global_metrics", {}).get("average_recall"),
            "average_f1": result.get("global_metrics", {}).get("average_f1"),
            "mean_iou": result.get("global_metrics", {}).get("mean_iou"),
        },
        # Job-level metrics
        "job_metrics": [
            {
                "job_id": jm.get("job_id"),
                "true_positives": jm.get("true_positives"),
                "false_positives": jm.get("false_positives"),
                "false_negatives": jm.get("false_negatives"),
                "precision": jm.get("precision"),
                "recall": jm.get("recall"),
                "f1": jm.get("f1"),
                "ground_truths": jm.get("ground_truths"),
                "detections": jm.get("detections"),
            }
            for jm in (result.get("job_metrics") or [])
        ],
        # Per-class metrics
        "per_class_metrics": [
            {
                "class_name": pcm.get("class_name"),
                "precision": pcm.get("precision"),
                "recall": pcm.get("recall"),
                "f1": pcm.get("f1"),
                "ap_50": pcm.get("ap_50"),
                "ap_75": pcm.get("ap_75"),
                "ap_50_95": pcm.get("ap_50_95"),
                "detections": pcm.get("detections"),
                "ground_truths": pcm.get("ground_truths"),
                "support": pcm.get("support"),
            }
            for pcm in (result.get("per_class_metrics") or [])
        ],
        "attribute_metrics": result.get("attribute_metrics") or [],
        "predictions": result.get("predictions") or [],
    }

    return payload
