from rest_framework import serializers



class AgentJobSerializer(serializers.Serializer):
    id = serializers.CharField(read_only=True)
    status = serializers.CharField(read_only=True)
    created_at = serializers.DateTimeField(read_only=True)
    started_at = serializers.DateTimeField(read_only=True, allow_null=True)
    finished_at = serializers.DateTimeField(read_only=True, allow_null=True)
    result = serializers.JSONField(read_only=True, allow_null=True)
    exc_info = serializers.CharField(read_only=True, allow_null=True)
    meta = serializers.JSONField(read_only=True, allow_null=True)
    progress = serializers.IntegerField(read_only=True, allow_null=True)


class AgentJobCreateSerializer(serializers.Serializer):
    agent_id = serializers.CharField(required=True)
    task_id = serializers.IntegerField(required=True)
    job_id = serializers.IntegerField(required=False, allow_null=True)
    threshold = serializers.FloatField(default=0.5, min_value=0.0, max_value=1.0)
    mapping = serializers.JSONField(default=dict)
    cleanup = serializers.BooleanField(default=False)
    conv_mask_to_poly = serializers.BooleanField(default=False)
    max_distance = serializers.IntegerField(default=50, min_value=1)
    frame_ids = serializers.ListField(child=serializers.IntegerField(), required=False)