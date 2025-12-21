from cvat.apps.iam.permissions import get_iam_context, is_public_obj, PolicyEnforcer


class DataUpPolicyEnforcer(PolicyEnforcer):
    """Custom policy enforcer for DataUp API keys that uses DataUp-specific IAM context"""

    def _resolve_iam_context(self, request, view, obj):
        factory = getattr(view, "iam_context_factory", None)
        if callable(factory):
            return factory(request, obj)

        if hasattr(view, "get_iam_context"):
            return view.get_iam_context(request, obj)

        return get_iam_context(request, obj)

    def _check_permission(self, request, view, obj):
        def _check_permissions():
            # DRF can send OPTIONS request. Internally it will try to get
            # information about serializers for PUT and POST requests (clone
            # request and replace the http method). To avoid handling
            # ('POST', 'metadata') and ('PUT', 'metadata') in every request,
            # the condition below is enough.
            if self.is_metadata_request(request, view) or obj and is_public_obj(obj):
                return True

            assert hasattr(
                view, "iam_permission_class"
            ), f"View {view} has no 'iam_permission_class' attribute"

            perm_class = view.iam_permission_class
            iam_context = self._resolve_iam_context(request, view, obj)

            for perm in perm_class.create(request, view, obj, iam_context=iam_context):
                checked_permissions.append(perm)
                result = perm.check_access()
                if not result.allow:
                    return False

            return True

        checked_permissions = []
        allow = _check_permissions()
        return allow, checked_permissions
