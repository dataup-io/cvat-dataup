from django.http import HttpResponse, HttpResponseNotFound, HttpResponseForbidden
from django.core.cache import cache
from rest_framework.views import APIView
from rest_framework import status
from rest_framework.response import Response
from django.http import HttpResponse
import time
import logging

from cvat.apps.engine.models import Task, Job
from cvat.apps.engine.frame_provider import TaskFrameProvider, JobFrameProvider
from cvat.apps.engine.views import _TaskDataGetter, _JobDataGetter

logger = logging.getLogger(__name__)


class TempAccessView(APIView):
    """
    Temporary access view for serving local files using secure tokens.
    This endpoint is used when response_type='url' is requested for local storage.
    """
    authentication_classes = []  # No authentication required for token-based access
    permission_classes = []      # This endpoint is available for everyone with valid token

    def get(self, request, token, filename=None):
        # Retry logic for token lookup to handle race conditions
        max_retries = 3
        retry_delay = 0.1  # 100ms

        cache_key = f"temp_access:{token}"
        cache_data = None

        for attempt in range(max_retries):
            cache_data = cache.get(cache_key)
            if cache_data:
                break

            if attempt < max_retries - 1:
                logger.warning(f"Token lookup failed (attempt {attempt + 1}/{max_retries}): {token}")
                time.sleep(retry_delay)
                retry_delay *= 2  # Exponential backoff

        if not cache_data:
            logger.error(f"Token not found after {max_retries} attempts: {token}")
            return Response(
                data="Token not found or expired",
                status=status.HTTP_404_NOT_FOUND
            )

        # Check if token has expired
        current_time = int(time.time())
        if current_time > cache_data.get('expiry', 0):
            cache.delete(cache_key)
            logger.info(f"Token expired: {token}")
            return Response(
                data="Token expired",
                status=status.HTTP_404_NOT_FOUND
            )

        # Extend token expiry if it's close to expiring (within 60 seconds)
        time_remaining = cache_data.get('expiry', 0) - current_time
        if time_remaining < 60:
            new_expiry = current_time + 300  # Extend by 5 minutes
            cache_data['expiry'] = new_expiry
            cache.set(cache_key, cache_data, timeout=300)
            logger.info(f"Token extended: {token}, new expiry: {new_expiry}")

        try:
            # Determine if this is a task or job request
            if 'task_id' in cache_data:
                return self._serve_task_data(cache_data)
            elif 'job_id' in cache_data:
                return self._serve_job_data(cache_data)
            else:
                return Response(
                    data="Invalid token data",
                    status=status.HTTP_404_NOT_FOUND
                )
        except Exception as e:
            return Response(
                data=f"Error serving data: {str(e)}",
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def _serve_task_data(self, cache_data):
        """Serve task data using the cached token information"""
        try:
            task = Task.objects.get(id=cache_data['task_id'])
        except Task.DoesNotExist:
            return Response(
                data="Task not found",
                status=status.HTTP_404_NOT_FOUND
            )

        # Create data getter with binary response type to get actual data
        logger.debug(f"Serving task data: {cache_data}")
        data_getter = _TaskDataGetter(
            task,
            data_type=cache_data['data_type'],
            data_num=cache_data.get('data_num'),
            data_quality=cache_data.get('data_quality', 'compressed'),
            response_type="binary"  # Force binary to get actual data
        )

        response = data_getter()

        # Add .jpg extension for frame requests by modifying Content-Disposition header
        if cache_data['data_type'] == 'frame' and isinstance(response, HttpResponse):
            frame_num = cache_data.get('data_num', 'frame')
            response['Content-Disposition'] = f'inline; filename="frame_{frame_num}.jpg"'
            if 'Content-Type' not in response:
                response['Content-Type'] = 'image/jpeg'

        return response

    def _serve_job_data(self, cache_data):
        """Serve job data using the cached token information"""
        try:
            job = Job.objects.get(id=cache_data['job_id'])
        except Job.DoesNotExist:
            return Response(
                data="Job not found",
                status=status.HTTP_404_NOT_FOUND
            )

        # Create data getter with binary response type to get actual data
        data_getter = _JobDataGetter(
            job,
            data_type=cache_data['data_type'],
            data_quality=cache_data.get('data_quality', 'compressed'),
            data_index=cache_data.get('data_index'),
            data_num=cache_data.get('data_num'),
            response_type="binary"  # Force binary to get actual data
        )

        response = data_getter()

        # Add .jpg extension for frame requests by modifying Content-Disposition header
        if cache_data['data_type'] == 'frame' and isinstance(response, HttpResponse):
            frame_num = cache_data.get('data_num', 'frame')
            response['Content-Disposition'] = f'inline; filename="frame_{frame_num}.jpg"'
            if 'Content-Type' not in response:
                response['Content-Type'] = 'image/jpeg'

        return response