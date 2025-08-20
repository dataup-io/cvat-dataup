# Copyright (C) 2024 CVAT.ai Corporation
#
# SPDX-License-Identifier: MIT

from rest_framework import serializers


# Pipeline Step Serializers
class PipelineStepCreateSerializer(serializers.Serializer):
    step_id = serializers.CharField(help_text="Reference to StepRegistry")


class PipelineStepUpdateSerializer(serializers.Serializer):
    step_id = serializers.CharField(required=False, allow_null=True)
    order = serializers.IntegerField(required=False, allow_null=True, min_value=0)
    params = serializers.ListField(required=False, allow_null=True)


class PipelineStepSerializer(serializers.Serializer):
    id = serializers.CharField(read_only=True)
    pipeline_id = serializers.CharField()
    step_id = serializers.CharField(help_text="Reference to StepRegistry")
    order = serializers.IntegerField(min_value=0)
    params = serializers.ListField(default=list)
    created_at = serializers.DateTimeField(read_only=True)
    updated_at = serializers.DateTimeField(read_only=True)


class PipelineStepResponseSerializer(PipelineStepSerializer):
    pass


# Pipeline Serializers
class PipelineCreateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=256)
    description = serializers.CharField(default="", allow_blank=True)
    usage_limit = serializers.IntegerField(default=1000, min_value=0)
    is_public = serializers.BooleanField(
        default=False,
        help_text="If true, the pipeline is available to all organizations"
    )
    steps = serializers.ListField(
        child=PipelineStepCreateSerializer(),
        default=list
    )


class PipelineUpdateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=256, required=False, allow_null=True)
    description = serializers.CharField(required=False, allow_null=True)
    usage_limit = serializers.IntegerField(min_value=0, required=False, allow_null=True)
    is_public = serializers.BooleanField(required=False, allow_null=True)
    steps = serializers.ListField(
        child=PipelineStepCreateSerializer(),
        required=False,
        allow_null=True
    )


class PipelineSerializer(serializers.Serializer):
    id = serializers.CharField(read_only=True)
    name = serializers.CharField(max_length=256)
    description = serializers.CharField(default="")
    usage_limit = serializers.IntegerField(default=1000, min_value=0)
    is_public = serializers.BooleanField(
        default=False,
        help_text="If true, the pipeline is available to all organizations"
    )
    owner_id = serializers.CharField(required=False, allow_null=True)
    organization_id = serializers.CharField()
    created_at = serializers.DateTimeField(read_only=True)
    updated_at = serializers.DateTimeField(read_only=True)
    usage_count = serializers.IntegerField(default=0)
    total_usage = serializers.IntegerField(default=0)
    steps = serializers.ListField(
        child=PipelineStepSerializer(),
        default=list
    )


class PipelineRunSerializer(serializers.Serializer):
    input_data = serializers.JSONField(default=dict)
    step_params = serializers.JSONField(
        default=dict,
        help_text="Parameters for specific steps, keyed by step ID"
    )
    cvat_token = serializers.CharField(
        required=False,
        allow_null=True,
        help_text="CVAT authentication token for accessing CVAT data"
    )
    task_id = serializers.IntegerField(
        required=False,
        allow_null=True,
        help_text="CVAT task ID to fetch task data and images"
    )
    job_id = serializers.IntegerField(
        required=False,
        allow_null=True,
        help_text="CVAT job ID to fetch job data and images"
    )


class PipelineUsageSerializer(serializers.Serializer):
    id = serializers.CharField(read_only=True)
    pipeline_id = serializers.CharField()
    organization_id = serializers.CharField()
    usage_count = serializers.IntegerField(default=0)
    usage_limit = serializers.IntegerField(default=1000)
    created_at = serializers.DateTimeField(read_only=True)
    updated_at = serializers.DateTimeField(read_only=True)


class UsageResponseSerializer(serializers.Serializer):
    usage_count = serializers.IntegerField()
    usage_limit = serializers.IntegerField()


class PipelineResponseSerializer(PipelineSerializer):
    usage_count = serializers.IntegerField(default=0)


# Step Registry Serializers
class StepRegistrySerializer(serializers.Serializer):
    id = serializers.CharField(read_only=True)
    name = serializers.CharField(max_length=255)
    description = serializers.CharField(required=False, allow_blank=True)
    parameters = serializers.JSONField(required=False, default=dict)


# Pipeline Execution Serializers
class PipelineExecutionStepCreateSerializer(serializers.Serializer):
    step_id = serializers.CharField(help_text="Reference to StepRegistry")
    order = serializers.IntegerField(min_value=0)
    input_data = serializers.JSONField(default=dict)
    params = serializers.ListField(default=list)


class PipelineExecutionStepSerializer(serializers.Serializer):
    id = serializers.CharField(read_only=True)
    execution_id = serializers.CharField()
    step_id = serializers.CharField()
    order = serializers.IntegerField(min_value=0)
    input_data = serializers.JSONField(default=dict)
    output_data = serializers.JSONField(default=dict)
    step_params = serializers.JSONField(default=dict)
    log = serializers.CharField(required=False, allow_null=True)
    status = serializers.CharField(read_only=True)  # ExecutionStatus enum
    started_at = serializers.DateTimeField(required=False, allow_null=True)
    finished_at = serializers.DateTimeField(required=False, allow_null=True)


class PipelineExecutionCreateSerializer(serializers.Serializer):
    pipeline_id = serializers.CharField()
    input_data = serializers.JSONField(default=dict)
    step_params = serializers.JSONField(
        default=dict,
        help_text="Parameters for specific steps, keyed by step ID"
    )
    cvat_token = serializers.CharField(
        required=False,
        allow_null=True,
        help_text="CVAT authentication token for accessing CVAT data"
    )
    task_id = serializers.IntegerField(
        required=False,
        allow_null=True,
        help_text="CVAT task ID to fetch task data and images"
    )
    job_id = serializers.IntegerField(
        required=False,
        allow_null=True,
        help_text="CVAT job ID to fetch job data and images"
    )


class PipelineExecutionSerializer(serializers.Serializer):
    id = serializers.CharField(read_only=True)
    pipeline_id = serializers.CharField()
    organization_id = serializers.CharField()
    input_data = serializers.JSONField(default=dict)
    status = serializers.CharField(read_only=True)  # ExecutionStatus enum
    started_at = serializers.DateTimeField(read_only=True)
    completed_at = serializers.DateTimeField(required=False, allow_null=True)
    error_message = serializers.CharField(required=False, allow_null=True)
    step_executions = serializers.ListField(
        child=PipelineExecutionStepSerializer(),
        default=list
    )


class PipelineExecutionResponseSerializer(PipelineExecutionSerializer):
    pass