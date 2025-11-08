# cvat/apps/dataup/api_keys/permissions.py
from __future__ import annotations

from enum import Enum

from django.conf import settings

from cvat.apps.dataup.iam.context import get_dataup_iam_context
from cvat.apps.iam.permissions import OpenPolicyAgentPermission


class DataUpAgentPermission(OpenPolicyAgentPermission):
    class Scopes(str, Enum):
        LIST = "list"
        VIEW = "view"
        CREATE = "create"
        UPDATE = "update"
        DELETE = "delete"

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.url = settings.IAM_OPA_DATA_URL + "/dataup/agents/allow"

    @classmethod
    def _get_scopes(cls, request, view, obj) -> list[str]:
        action = view.action
        if action == "list":
            return [cls.Scopes.LIST]
        if action == "retrieve":
            return [cls.Scopes.VIEW]
        if action == "create":
            return [cls.Scopes.CREATE]
        if action in ("update", "partial_update"):
            return [cls.Scopes.UPDATE]
        if action == "destroy":
            return [cls.Scopes.DELETE]
        return [cls.Scopes.VIEW]

    @classmethod
    def create(cls, request, view, obj, iam_context=None):
        if view.basename != "agent":
            return []

        # building dataup iam context here
        dataup_iam_context = get_dataup_iam_context(request, obj)

        perms = []
        for scope in cls.get_scopes(request, view, obj):
            perms.append(
                cls.create_base_perm(request, view, scope, iam_context=dataup_iam_context, obj=obj)
            )
        return perms

    def get_resource(self):
        # Avoid importing models here; just read attributes if present
        o = self.obj

        # If object is None or not yet created, extract from request data parameters
        if o is None or not hasattr(o, "id") or getattr(o, "id", None) is None:
            # Use request data passed as parameters during creation
            request_owner_id = getattr(self, "user_id", None)
            request_org_id = getattr(self, "org_id", None)
            request_owner_role = getattr(self, "org_role", None)
            resource = {
                "type": "dataup_agents",
                "role": request_owner_role,
                "dataup_user_id": str(request_owner_id) if request_owner_id is not None else None,
                "dataup_org_id": str(request_org_id) if request_org_id else None,
                "is_org": request_org_id is not None,
                "is_personal": request_org_id is None and request_owner_id is not None,
            }
        else:
            # For existing objects, use object attributes
            resource = {
                "type": "dataup_agents",
                "role": request_owner_role,
                "dataup_user_id": str(getattr(o, "owner_id", "") or "") or None,
                "dataup_org_id": str(getattr(o, "organization_id", "") or "") or None,
                "is_org": bool(getattr(o, "organization_id", None)),
                "is_personal": not getattr(o, "organization_id", None)
                and bool(getattr(o, "owner_id", None)),
            }
        return resource


class DataUpAgentJobPermission(OpenPolicyAgentPermission):
    class Scopes(str, Enum):
        LIST = "list"
        VIEW = "view"
        CREATE = "create"
        UPDATE = "update"
        DELETE = "delete"

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.url = settings.IAM_OPA_DATA_URL + "/dataup/agent_jobs/allow"

    @classmethod
    def _get_scopes(cls, request, view, obj) -> list[str]:
        action = view.action
        if action == "list":
            return [cls.Scopes.LIST]
        if action == "retrieve":
            return [cls.Scopes.VIEW]
        if action == "create":
            return [cls.Scopes.CREATE]
        if action in ("update", "partial_update"):
            return [cls.Scopes.UPDATE]
        if action == "destroy":
            return [cls.Scopes.DELETE]
        return [cls.Scopes.VIEW]

    @classmethod
    def create(cls, request, view, obj, iam_context=None):
        if "agent-jobs" not in view.basename:
            return []

        # building dataup iam context here
        dataup_iam_context = get_dataup_iam_context(request, obj)
        perms = []
        for scope in cls.get_scopes(request, view, obj):
            perms.append(
                cls.create_base_perm(request, view, scope, iam_context=dataup_iam_context, obj=obj)
            )
        return perms

    def get_resource(self):
        # Avoid importing models here; just read attributes if present
        o = self.obj

        # If object is None or not yet created, extract from request data parameters
        if o is None or not hasattr(o, "id") or getattr(o, "id", None) is None:
            # Use request data passed as parameters during creation
            request_owner_id = getattr(self, "user_id", None)
            request_org_id = getattr(self, "org_id", None)
            request_owner_role = getattr(self, "org_role", None)
            resource = {
                "type": "dataup_agents_jobs",
                "role": request_owner_role,
                "dataup_user_id": str(request_owner_id) if request_owner_id is not None else None,
                "dataup_org_id": str(request_org_id) if request_org_id else None,
                "is_org": request_org_id is not None,
                "is_personal": request_org_id is None and request_owner_id is not None,
            }
        else:
            # For existing objects, use object attributes
            resource = {
                "type": "dataup_agents_jobs",
                "role": request_owner_role,
                "dataup_user_id": str(getattr(o, "owner_id", "") or "") or None,
                "dataup_org_id": str(getattr(o, "organization_id", "") or "") or None,
                "is_org": bool(getattr(o, "organization_id", None)),
                "is_personal": not getattr(o, "organization_id", None)
                and bool(getattr(o, "owner_id", None)),
            }
        return resource
