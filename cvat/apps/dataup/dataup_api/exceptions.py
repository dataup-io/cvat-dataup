from http import HTTPStatus
from enum import Enum
from typing import Optional
import httpx


class ErrorKind(str, Enum):
    INFERENCE = "inference"
    QUOTA = "quota"
    AUTH = "auth"
    NOT_FOUND = "not_found"
    SERVER = "server"
    UNKNOWN = "unknown"


class DataUpAPIError(Exception):
    def __init__(self, message: str, status_code: int = HTTPStatus.BAD_REQUEST, error_code: Optional[str] = None, payload: Optional[dict] = None):
        self.message = message
        self.status_code = status_code
        self.error_code = error_code
        self.payload = payload
        super().__init__(f"{self.message} (status {self.status_code}{f', code {self.error_code}' if self.error_code else ''})")

    @property
    def kind(self) -> ErrorKind:
        sc = self.status_code
        code_and_msg = f"{self.error_code or ''} {self.message}".upper()

        if sc in (HTTPStatus.UNAUTHORIZED, HTTPStatus.FORBIDDEN):
            return ErrorKind.AUTH
        if sc == HTTPStatus.TOO_MANY_REQUESTS or any(k in code_and_msg for k in ("QUOTA", "RATE", "LIMIT")):
            return ErrorKind.QUOTA
        if sc in (HTTPStatus.BAD_REQUEST, HTTPStatus.UNPROCESSABLE_ENTITY, HTTPStatus.CONFLICT):
            return ErrorKind.INFERENCE
        if sc == HTTPStatus.NOT_FOUND:
            return ErrorKind.NOT_FOUND
        if sc >= 500:
            return ErrorKind.SERVER
        return ErrorKind.UNKNOWN

    @classmethod
    def from_response(cls, response: httpx.Response) -> "DataUpAPIError":
        try:
            data = response.json()
        except ValueError:
            return cls(response.text, response.status_code)
        message = data.get("message") or data.get("error") or "unknown error"
        error_code = data.get("code") or data.get("error_code")
        return cls(message, response.status_code, error_code, payload=data)
