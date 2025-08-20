# Copyright (C) 2024 CVAT.ai Corporation
#
# SPDX-License-Identifier: MIT

from rest_framework import serializers


class AgentSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    name = serializers.CharField(max_length=256, help_text="Agent name")
    endpoint = serializers.URLField(help_text="Model endpoint URL")
    auth_token = serializers.CharField(max_length=256, required=False, allow_blank=True, write_only=True, help_text="Authentication token")
    timeout = serializers.IntegerField(default=30, min_value=1, max_value=300, help_text="Request timeout in seconds")
    rate_limit = serializers.IntegerField(default=100, min_value=1, help_text="Rate limit per hour")
    provider = serializers.CharField(max_length=50, help_text="External service provider")
    agent_type = serializers.CharField(max_length=50, default="DETECTOR", help_text="Agent type")
    is_public = serializers.BooleanField(default=False, help_text="If true, the Agent is available to all organizations")
    labels = serializers.ListField(
        child=serializers.CharField(max_length=100),
        required=False,
        allow_null=True,
        default=None,
        help_text="List of class names"
    )
    label_source = serializers.CharField(
        max_length=50,
        default="COCO",
        help_text="Source of the labels: standard like COCO, or custom input"
    )
    created_date = serializers.DateTimeField(read_only=True)
    updated_date = serializers.DateTimeField(read_only=True)
    owner = serializers.CharField(read_only=True)


class AgentInferSerializer(serializers.Serializer):
    task_id = serializers.IntegerField()
    frame_id = serializers.IntegerField(required=False)
    frame_url = serializers.URLField(required=False)
    args = serializers.JSONField(required=False, default=dict)
