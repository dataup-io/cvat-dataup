from __future__ import annotations


from http import HTTPStatus
from django.conf import settings
from cvat.apps.dataup.iam.context import DataUpContext
from cvat.apps.dataup.api_keys.models import DataUpAPIKey
from typing import Callable, Any, Dict
from django.utils.functional import cached_property
from cvat.apps.dataup.dataup_api.exceptions import DataUpAPIError
import httpx
from typing import Optional

def _get_api_key(context: DataUpContext) -> str:
    api_key = DataUpAPIKey.get_api_key(
        user_uuid=context.user_uuid,
        org_uuid=context.org_uuid,
        role=context.role,
    )
    if not api_key:
        raise DataUpAPIError("API key not found", status_code=HTTPStatus.NOT_FOUND)
    return api_key.key


class DataUpAPIClient:
    def __init__(self, api_key: str, base_url: str):
        self.api_key = api_key
        self.base_url = base_url

    def get_header(self) -> Dict[str, str]:
        return {
            "X-API-KEY": self.api_key,
        }

    async def make_request(
        self, method: str, endpoint: str, data=None, params=None,
        _client: Optional[httpx.AsyncClient] = None,  # <— allow reuse
    ) -> httpx.Response:
        url = f"{self.base_url.rstrip('/')}/{str(endpoint).lstrip('/')}"
        headers = self.get_header()
        own = _client is None
        client = _client or httpx.AsyncClient(timeout=60.0, http2=True)

        try:
            resp = await client.request(method.upper(), url, json=data, params=params, headers=headers)
            if resp.status_code >= 400:
                raise DataUpAPIError.from_response(resp)
            return resp
        finally:
            if own:
                await client.aclose()

    def cfg(self) -> dict:
        return {"api_key": self.api_key, "base_url": self.base_url}

    @classmethod
    def from_cfg(cls, cfg: dict):
        api_key = cfg.get("api_key", "")
        base_url = cfg.get("base_url", "")
        return cls(api_key=api_key, base_url=base_url)


def dataup_client_from_request(request) -> DataUpAPIClient:
    dataup_context = DataUpContext.from_request(request)
    api_key = _get_api_key(dataup_context)
    base_url = f"{settings.DATAUP_BASE_URL}/api/v1"
    return DataUpAPIClient(api_key=api_key, base_url=base_url)


class DataUpAPIClientMixin:
    client_factory: Callable[[Any], Any] = staticmethod(dataup_client_from_request)

    @cached_property
    def dataup_client(self):
        request = getattr(self, "request", None)
        if request is None:
            raise RuntimeError("dataup_client: request is None")
        return self.client_factory(request)
