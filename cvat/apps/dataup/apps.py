# Copyright (C) 2024 CVAT.ai Corporation
#
# SPDX-License-Identifier: MIT

from django.apps import AppConfig



class DataUpConfig(AppConfig):
    name = "cvat.apps.dataup"

    def ready(self) -> None:
        from cvat.apps.iam.permissions import load_app_permissions
        from cvat.apps.dataup import signals
        load_app_permissions(self)