# Copyright (C) 2024 CVAT.ai Corporation
#
# SPDX-License-Identifier: MIT

from django.apps import AppConfig


class DataUpConfig(AppConfig):
    name = "cvat.apps.dataup"

    def ready(self) -> None:
        from cvat.apps.dataup import signals
        from cvat.apps.iam.permissions import load_app_iam_rules
        load_app_iam_rules(self)
