# Copyright (C) 2024 CVAT.ai Corporation
#
# SPDX-License-Identifier: MIT

from django.urls import include, path
from rest_framework import routers

from cvat.apps.dataup.agents.views import AgentViewSet, AgentJobsViewSet
from cvat.apps.dataup.api_keys.views import DataUpAPIKeyViewSet
from cvat.apps.dataup.pipelines.execution_views import PipelineExecutionViewSet
from cvat.apps.dataup.pipelines.registry_views import StepRegistryViewSet
from cvat.apps.dataup.pipelines.step_views import PipelineStepViewSet
from cvat.apps.dataup.pipelines.views import PipelineViewSet

# from cvat.apps.dataup.views.health import HealthViewSet

router = routers.DefaultRouter(trailing_slash=False)
router.register("agents", AgentViewSet, basename="agent")
router.register("agent-jobs", AgentJobsViewSet, basename="agent-jobs")
router.register("pipelines", PipelineViewSet, basename="pipeline")
router.register("pipeline-steps", PipelineStepViewSet, basename="pipeline-step")
router.register("step-registry", StepRegistryViewSet, basename="step-registry")
router.register(
    "pipeline-executions", PipelineExecutionViewSet, basename="pipeline-execution"
)
router.register("api-keys", DataUpAPIKeyViewSet, basename="api-key")


urlpatterns = [
    path("dataup/", include((router.urls, "dataup"), namespace="dataup")),
]
