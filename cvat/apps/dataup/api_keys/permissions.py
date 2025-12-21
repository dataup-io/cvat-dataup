# cvat/apps/dataup/api_keys/permissions.py
from __future__ import annotations

from enum import Enum

from django.conf import settings

from cvat.apps.dataup.iam.context import get_dataup_iam_context
from cvat.apps.iam.permissions import OpenPolicyAgentPermission


class DataUpAPIKeyPerm(OpenPolicyAgentPermission):
    class Scopes(str, Enum):
        LIST = "list"
        VIEW = "view"
        CREATE = "create"
        UPDATE = "update"
        DELETE = "delete"

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.url = settings.IAM_OPA_DATA_URL + "/dataup/api_keys/allow"

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
        # Only apply this permission to DataUp API key views

        if view.basename != "api-key":
            return []

        # building dataup iam context here
        dataup_iam_context = get_dataup_iam_context(request, obj)

        perms = []
        for scope in cls.get_scopes(request, view, obj):
            perms.append(cls.create_base_perm(request, view, scope, iam_context=dataup_iam_context, obj=obj))
        return perms

    def get_resource(self):
        # Avoid importing models here; just read attributes if present
        o = self.obj

        # If object is None or not yet created, extract from request data parameters
        if o is None or not hasattr(o, "id") or getattr(o, "id", None) is None:
            # Use request data passed as parameters during creation
            request_owner_id = getattr(self, "user_id", None)
            request_org_id = getattr(self, "org_id", None)
            resource = {
                "type": "dataup_api_key",
                "id": None,  # No ID during creation
                "owner_dataup_id": str(request_owner_id) if request_owner_id is not None else None,
                "organization_dataup_id": str(request_org_id) if request_org_id else None,
                "organization_core_id": None,  # Will be resolved later
                "is_org": request_org_id is not None,
                "is_personal": request_org_id is None and request_owner_id is not None,
            }
        else:
            # For existing objects, use object attributes
            org = getattr(o, "organization", None)
            core_org = getattr(org, "organization", None)
            resource = {
                "type": "dataup_api_key",
                "id": str(getattr(o, "id", "")) or None,
                "owner_dataup_id": str(getattr(o, "owner_id", "") or "") or None,
                "organization_dataup_id": str(getattr(o, "organization_id", "") or "") or None,
                "organization_core_id": getattr(core_org, "id", None),
                "is_org": bool(getattr(o, "organization_id", None)),
                "is_personal": not getattr(o, "organization_id", None) and bool(getattr(o, "owner_id", None)),
            }
        return resource


# class DataUpPolicyEnforcer(PolicyEnforcer):
#     """Custom policy enforcer for DataUp API keys that uses DataUp-specific IAM context"""

#     def _check_permission(self, request, view, obj):
#         def _check_permissions():
#             # DRF can send OPTIONS request. Internally it will try to get
#             # information about serializers for PUT and POST requests (clone
#             # request and replace the http method). To avoid handling
#             # ('POST', 'metadata') and ('PUT', 'metadata') in every request,
#             # the condition below is enough.
#             if self.is_metadata_request(request, view) or obj and is_public_obj(obj):
#                 return True

#             assert hasattr(
#                 view, "iam_permission_class"
#             ), f"View {view} has no 'iam_permission_class' attribute"

#             perm_class = view.iam_permission_class
#             # Use DataUp-specific IAM context for DataUp API key views
#             if hasattr(view, "basename") and view.basename == "api-key":
#                 iam_context = get_dataup_iam_context(request, obj)
#             else:
#                 iam_context = get_iam_context(request, obj)

#             for perm in perm_class.create(request, view, obj, iam_context=iam_context):
#                 checked_permissions.append(perm)
#                 result = perm.check_access()
#                 if not result.allow:
#                     return False

#             return True

#         checked_permissions = []
#         allow = _check_permissions()
#         return allow, checked_permissions
