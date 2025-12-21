
from rest_framework import status, viewsets
from cvat.apps.dataup.dataup_api.client import DataUpAPIClientMixin
from cvat.apps.dataup.iam.policy import DataUpPolicyEnforcer
from rest_framework.permissions import IsAuthenticated
from cvat.apps.dataup.iam.context import get_dataup_iam_context
from cvat.apps.dataup.agents.permissions import DataUpBenchmarkPermission
from cvat.apps.dataup.agents.benchmarks.serializers import AgentBenchmarkReadSerializer, AgentBenchmarkWriteSerializer, build_benchmark_payload
from asgiref.sync import async_to_sync
from cvat.apps.dataup.dataup_api import DataUpAPIError
from rest_framework.response import Response
from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, extend_schema
from cvat.apps.dataup.agents.jobs.evaluate import AgentEvaluateQueue
from cvat.apps.engine.log import ServerLogManager
from rest_framework.decorators import action


slogger = ServerLogManager(__name__)

class AgentBenchmarkViewSet(DataUpAPIClientMixin, viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, DataUpPolicyEnforcer]
    iam_permission_class = DataUpBenchmarkPermission
    iam_context_factory = staticmethod(get_dataup_iam_context)
    iam_organization_field = "organization"

    @extend_schema(
        summary="List all agent Benchmarks",
        description="Returns a list of agent benchmarks",
        responses={
            200: AgentBenchmarkReadSerializer(many=True),
        },
        parameters=[
            OpenApiParameter(
                "agent_type",
                description="Filter by agent type",
                required=False,
                type=str,
            ),
        ],
    )
    def list(self, request):
        client = self.dataup_client
        return async_to_sync(self._alist)(request, client)

    async def _alist(self, request, client, *args, **kwargs):
        try:
            resp = await client.make_request("GET", "benchmarks/")
            benchmark_data = resp.json().get("items", [])
            serializer = AgentBenchmarkReadSerializer(data=benchmark_data, many=True)
            serializer.is_valid(raise_exception=True)
            return Response(serializer.validated_data, status=resp.status_code)
        except DataUpAPIError as e:
            return Response({"message": e.message}, status=e.status_code)


    def retrieve(self, request, pk=None, *args, **kwargs):
        client = self.dataup_client
        return async_to_sync(self._aretrieve)(request, client, pk, *args, **kwargs)

    async def _aretrieve(self, request, client, pk=None, *args, **kwargs):
        try:
            resp = await client.make_request("GET", f"benchmarks/{pk}")
            data = resp.json() if resp.content else {}
            serializer = AgentBenchmarkReadSerializer(instance=data)
            return Response(serializer.data, status=resp.status_code)
        except DataUpAPIError as e:
            return Response({"error": str(e)}, status=e.status_code)

    @extend_schema(
        summary="Create a new benchmark",
        description="Creates a new agent benchmark run",
        request=AgentBenchmarkWriteSerializer,
        responses={
            201: AgentBenchmarkReadSerializer,
            400: OpenApiResponse(description="Invalid input data"),
            500: OpenApiResponse(description="Internal server error"),
        },
        parameters=[
            OpenApiParameter(
                "X-Organization",
                description="Organization slug for multi-tenant context",
                required=False,
                type=str,
                location=OpenApiParameter.HEADER,
            ),
        ],
    )
    def retrieve_rq_results(self, evaluate_job_id: str) -> tuple[dict, dict]:
        """
        Retrieve RQ job results and metadata.
        Returns tuple of (rq_results, job_meta) where job_meta contains task_id, etc.
        """
        queue = AgentEvaluateQueue()
        rq_job = queue.fetch_job(evaluate_job_id)
        if not rq_job:
            raise ValueError(f"RQ job {evaluate_job_id} not found")

        job_dict = rq_job.to_dict()
        rq_results = job_dict.get('result')
        job_meta = job_dict.get('meta', {})

        return rq_results, job_meta

    def create(self, request, *args, **kwargs):
        client = self.dataup_client
        evaluate_job_id = request.data.get("evaluate_job_id")
        agent_id = request.data.get("agent_id")

        if not evaluate_job_id:
            return Response({"error": "evaluate_job_id is required"}, status=status.HTTP_400_BAD_REQUEST)
        if not agent_id:
            return Response({"error": "agent_id is required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            rq_results, job_meta = self.retrieve_rq_results(evaluate_job_id)
            task_id = job_meta.get("task") or job_meta.get("task_id") or 0

            if not rq_results:
                return Response(
                    {"error": f"RQ job {evaluate_job_id} has no results. Job may not be finished yet."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            payload = build_benchmark_payload(rq_results, agent_id, task_id)
            return async_to_sync(self._acreate)(client, evaluate_job_id, payload)
        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            slogger.glob.error(f"Error building benchmark payload: {e}")
            return Response({"error": f"Failed to build benchmark payload: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    async def _acreate(self, client, evaluate_job_id: str, payload: dict):
        serializer = AgentBenchmarkWriteSerializer(data=payload)
        if not serializer.is_valid():
            slogger.glob.warning(f"Benchmark serializer validation failed: {serializer.errors}")
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        try:
            resp = await client.make_request("POST", "benchmarks/", data=serializer.validated_data)
            data = resp.json() if resp.content else {}
            read_serializer = AgentBenchmarkReadSerializer(instance=data)
            # TODO: remove the RQ job here after submission
            slogger.glob.info(f"Deleting Evaluate Job {evaluate_job_id}")
            await self._delete_rq_job(rq_job_id=evaluate_job_id)
            return Response(read_serializer.data, status=resp.status_code)
        except DataUpAPIError as e:
            return Response({"error": str(e)}, status=e.status_code)


    async def _delete_rq_job(self, rq_job_id: str):
            queue = AgentEvaluateQueue()
            try:
                rq_job = queue.fetch_job(rq_job_id)
                rq_job.delete()
            except Exception as e:
                slogger.glob.error(f"Error deleting RQ job {rq_job_id}: {e}")
                pass



    def destroy(self, request, pk=None, *args, **kwargs):
        client = self.dataup_client
        return async_to_sync(self._adestroy)(request, client, pk, *args, **kwargs)

    async def _adestroy(self, request, client, pk=None, *args, **kwargs):
        try:
            resp = await client.make_request("DELETE", f"benchmarks/{pk}")
            return Response(status=resp.status_code)
        except DataUpAPIError as e:
            return Response({"message": e.message}, status=e.status_code)


    @action(detail=True, methods=["get"], url_path="fetch-predictions")
    def fetch_predictions(self, request, pk=None):
        client = self.dataup_client
        return async_to_sync(self._afetch_predictions)(request, client, pk)

    async def _afetch_predictions(self, request, client, pk=None):
        try:
            job_id = request.query_params.get("job_id")
            resp = await client.make_request("GET", f"benchmarks/{pk}/predictions", params={"job_id": job_id})
            resp.raise_for_status()
            return Response(resp.json(), status=resp.status_code)
        except DataUpAPIError as e:
            return Response({"error": str(e)}, status=e.status_code)
