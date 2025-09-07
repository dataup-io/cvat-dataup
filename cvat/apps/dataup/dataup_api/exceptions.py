from http import HTTPStatus
import requests


class DataUpAPIError(Exception):
    def __init__(self, message: str, status_code: int = HTTPStatus.BAD_REQUEST):
        self.message = message
        self.status_code = status_code
        super().__init__(f"{self.message} (status {self.status_code})")

    @classmethod
    def from_response(cls, response: requests.Response) -> "DataUpAPIError":
        try:
            data = response.json()
        except ValueError:
            return cls(response.text, response.status_code)
        message = data.get("message", "unknown error")
        return cls(message, response.status_code)
