from rest_framework import viewsets, status
from rest_framework.response import Response
from django.conf import settings
from rest_framework.permissions import IsAuthenticated
import requests
from cvat.apps.engine.log import ServerLogManager
from cvat.apps.dataup.api_keys.models import DataUpAPIKey


slogger = ServerLogManager(__name__)

class DataUpBaseViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    iam_organization_field = "organization"

    def get_api_key(self, request):
        """
        Retrieve the API key for the organization of the current user.
        Uses the DataUpAPIKey.get_api_key classmethod for proper key selection.
        """
        organization = request.iam_context.get("organization")
        user = request.user

        # Get DataUp user and organization UUIDs
        try:
            from cvat.apps.dataup.models import DataUpUser
            dataup_user = DataUpUser.objects.get(user=user)
        except DataUpUser.DoesNotExist:
            raise Exception("A valid user is mandatory to perform this action")

        try:
            from cvat.apps.dataup.models import DataUpOrganization
            org_uuid = DataUpOrganization.objects.get(organization=organization).id
        except DataUpOrganization.DoesNotExist:
            slogger.glob.info("Cannot find DataUp organization for this user - use personal key")
            org_uuid = None
        
        # Use the classmethod to get the appropriate API key
        api_key = DataUpAPIKey.get_api_key(
            user_uuid=dataup_user.id,
            org_uuid=org_uuid,
            role=getattr(request.iam_context.get("membership", {}), "role", "")
        )

        if not api_key:
            raise Exception("No API key found for this organization's DataUp service.")
        return api_key.key

    def get_headers(self):
        """
        Get headers for DataUP API requests, including authentication details.
        """
        api_key = self.get_api_key(self.request)
        organization = self.request.iam_context.get("organization")
        if organization:
            headers = {
                "X-API-KEY": api_key,
                "X-Organization-ID": str(getattr(organization.dataup, "id", ""))
            }
        else:
            headers = {"X-API-KEY": api_key}
        return headers

    def add_organization_params(self, params=None):
        """
        Add organization filter to query parameters if applicable.
        """
        params = params or {}
        organization = self.request.iam_context.get("organization")
        if organization and hasattr(organization, 'dataup'):
            params['organization_id'] = str(organization.dataup.id)
        return params

    def add_owner_data(self, data):
        """
        Add owner and organization information to the data being sent.
        """
        data['owner_id'] = str(self.request.user.id)
        organization = self.request.iam_context.get("organization")
        if organization and hasattr(organization, 'dataup'):
            data['organization_id'] = str(organization.dataup.id)
        return data

    def handle_dataup_response(self, response, success_status=status.HTTP_200_OK):
        """
        Handle the DataUP API response and handle different status codes.
        """
        try:
            response.raise_for_status()
            return Response(response.json(), status=success_status)
        except requests.exceptions.RequestException as e:
            return self._handle_request_error(e)

    def _handle_request_error(self, error):
        """
        Handle request exceptions in a standardized way.
        """
        if error.response:
            status_code = error.response.status_code
            error_data = self._get_error_data(error)

            if status_code == 404:
                return Response({"error": "Resource not found"}, status=status.HTTP_404_NOT_FOUND)
            elif status_code == 400:
                return Response(error_data, status=status.HTTP_400_BAD_REQUEST)

        return Response(
            {"error": f"Error calling DataUP API: {str(error)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

    def _get_error_data(self, error):
        """
        Extract error data from the response body.
        """
        try:
            return error.response.json()
        except ValueError:
            return {"error": "Bad request"}

    def make_dataup_request(self, method, endpoint, version="v1", data=None, params=None, success_status=status.HTTP_200_OK):
        """
        Make a request to the DataUP backend with standard error handling.
        """
        url = f"{settings.DATAUP_BASE_URL}/api/{version}/{endpoint}"
        headers = self.get_headers()

        request_method = getattr(requests, method.lower(), None)
        if not request_method:
            return Response({"error": f"Unsupported HTTP method: {method}"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            response = request_method(url, json=data, params=params, headers=headers)
            return self.handle_dataup_response(response, success_status)

        except requests.exceptions.RequestException as e:
            return self._handle_request_error(e)
