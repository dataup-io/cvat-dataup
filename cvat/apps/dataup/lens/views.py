from cvat.apps.dataup.dataup_api.client import DataUpAPIClientMixin
from cvat.apps.dataup.dataup_api import DataUpAPIError
from rest_framework import status, viewsets
from cvat.apps.dataup.iam.context import get_dataup_iam_context
from cvat.apps.dataup.iam.policy import DataUpPolicyEnforcer
from asgiref.sync import async_to_sync
from rest_framework.permissions import IsAuthenticated
from cvat.apps.dataup.agents.permissions import DataUpLensPermission
from rest_framework.decorators import action
from rest_framework.response import Response
from cvat.apps.dataup.lens.jobs import LensQueue, LensSyncJob


class LensViewSet(DataUpAPIClientMixin, viewsets.ViewSet):
    permission_classes = [IsAuthenticated, DataUpPolicyEnforcer]
    iam_permission_class = DataUpLensPermission
    iam_context_factory = staticmethod(get_dataup_iam_context)
    iam_organization_field = "organization"

    @action(detail=False, methods=["post"], url_path="chat")
    def chat(self, request, *args, **kwargs):
        client = self.dataup_client
        payload = {
            "task_id": request.data.get("task_id"),
            "job_id": request.data.get("job_id"),
            "message": request.data.get("message"),
        }
        return async_to_sync(self._achat)(client, payload)

    async def _achat(self, client, payload, *args, **kwargs):
        try:
            resp = await client.make_request("POST", "lens/chat", data=payload)
            return Response(resp.json()["answer"] if resp.content else {}, status=resp.status_code)
        except DataUpAPIError as e:
            return Response({"message": e.message}, status=e.status_code)

    @action(detail=False, methods=["post"], url_path="sync")
    def sync(self, request):
        try:
            lens_queue = LensQueue()
            job_kwargs = {"task_id": request.data.get("task_id"), "dataup_client_cfg": self.dataup_client.cfg()}
            iam_context = self.iam_context_factory(request, None)
            lens_job: LensSyncJob = lens_queue.enqueue(**job_kwargs, request=request, organization_id=iam_context.get("org_id"))
            return Response(lens_job.to_dict(), status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


    def retrieve(self, request, pk=None):
        lens_queue = LensQueue()
        try:
            job = lens_queue.fetch_job(pk)
            return Response(job.to_dict(), status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

