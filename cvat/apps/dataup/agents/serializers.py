# Copyright (C) 2024 CVAT.ai Corporation
#
# SPDX-License-Identifier: MIT

from rest_framework import serializers
import rq


class AgentInferenceRequest(serializers.Serializer):
    task_id = serializers.IntegerField()
    frame_ids = serializers.ListField(child=serializers.IntegerField(), required=True)
    params = serializers.JSONField(required=False, default=dict)


class AgentReadSerializer(serializers.Serializer):
    id = serializers.CharField(max_length=256)
    name = serializers.CharField(max_length=256, help_text="Agent name")
    endpoint = serializers.URLField(help_text="Model endpoint URL")
    timeout = serializers.IntegerField(
        default=30, min_value=1, max_value=300, help_text="Request timeout in seconds"
    )
    rate_limit = serializers.IntegerField(
        default=100, min_value=1, help_text="Rate limit per hour"
    )
    provider = serializers.CharField(
        max_length=50, help_text="External service provider"
    )
    publisher = serializers.CharField(
        max_length=50, help_text="External service publisher", required=False
    )
    agent_type = serializers.CharField(
        max_length=50, default="DETECTOR", help_text="Agent type"
    )
    is_public = serializers.BooleanField(
        default=False, help_text="If true, the Agent is available to all organizations"
    )
    labels = serializers.ListField(
        child=serializers.CharField(max_length=100),
        required=False,
        allow_null=True,
        default=None,
        help_text="List of class names",
    )
    label_source = serializers.CharField(
        max_length=50,
        default="COCO",
        help_text="Source of the labels: standard like COCO, or custom input",
    )
    created_date = serializers.DateTimeField(read_only=True)
    updated_date = serializers.DateTimeField(read_only=True)
    owner = serializers.CharField(read_only=True)

    def to_internal_value(self, data):
        """
        Map provider field from external service to publisher field internally.
        External service sends 'provider', we store it as 'publisher' internally.
        """
        # Create a copy to avoid modifying the original data
        internal_data = data.copy() if hasattr(data, 'copy') else dict(data)

        # Map incoming provider from external service to publisher internally
        if 'provider' in internal_data:
            internal_data['publisher'] = internal_data['provider']

        return super().to_internal_value(internal_data)


class AgentJobSerializer(serializers.Serializer):
    id = serializers.CharField(read_only=True)
    status = serializers.CharField(read_only=True)
    created_at = serializers.DateTimeField(read_only=True)
    started_at = serializers.DateTimeField(read_only=True, allow_null=True)
    ended_at = serializers.DateTimeField(read_only=True, allow_null=True)
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

class AgentWriteSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    name = serializers.CharField(max_length=256, help_text="Agent name")
    endpoint = serializers.URLField(help_text="Model endpoint URL")
    auth_token = serializers.CharField(
        max_length=256,
        required=False,
        allow_blank=True,
        help_text="Authentication token",
    )
    timeout = serializers.IntegerField(
        default=30, min_value=1, max_value=300, help_text="Request timeout in seconds"
    )
    rate_limit = serializers.IntegerField(
        default=100, min_value=1, help_text="Rate limit per hour"
    )
    provider = serializers.CharField(
        max_length=50, help_text="External service provider"
    )
    publisher = serializers.CharField(
        max_length=50, help_text="External service publisher", required=False
    )
    agent_type = serializers.CharField(
        max_length=50, default="DETECTOR", help_text="Agent type"
    )
    is_public = serializers.BooleanField(
        default=False, help_text="If true, the Agent is available to all organizations"
    )
    labels = serializers.ListField(
        child=serializers.CharField(max_length=100),
        required=False,
        allow_null=True,
        default=None,
        help_text="List of class names",
    )
    label_source = serializers.CharField(
        max_length=50,
        default="COCO",
        help_text="Source of the labels: standard like COCO, or custom input",
    )
    created_date = serializers.DateTimeField(read_only=True)
    updated_date = serializers.DateTimeField(read_only=True)
    owner = serializers.CharField(read_only=True)

    def to_internal_value(self, data):
        """
        Handle input data processing. Map publisher to provider for external service.
        """
        # Make a copy to avoid modifying the original data
        internal_data = data.copy() if hasattr(data, 'copy') else dict(data)

        # If publisher is provided, map it to provider and remove publisher
        if 'publisher' in internal_data:
            internal_data['provider'] = internal_data['publisher']
            internal_data.pop('publisher', None)

        return super().to_internal_value(internal_data)

