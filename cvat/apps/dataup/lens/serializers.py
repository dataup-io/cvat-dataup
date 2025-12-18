from rest_framework import serializers


class LensAnalyticsRowWriteSerializer(serializers.Serializer):
    payload = serializers.JSONField(required=False, default=dict)
    job_id = serializers.BigIntegerField(required=False)
    task_id = serializers.BigIntegerField(required=False)
    row_type = serializers.ChoiceField(
        choices=[(t.value, t.name) for t in getattr(__import__("cvat.apps.dataup.models", fromlist=["LensRowType"]), "LensRowType")],
        required=True,
    )
    created_at = serializers.DateTimeField(required=False)
    sent_at = serializers.DateTimeField(required=False, allow_null=True)
    last_error = serializers.CharField(required=False, allow_null=True)
