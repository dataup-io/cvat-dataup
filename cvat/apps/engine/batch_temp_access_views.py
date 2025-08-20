import json
import zipfile
import io
import time
from django.http import HttpResponse
from django.core.cache import cache
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from cvat.apps.engine.models import Task, Job
from cvat.apps.engine.views import _TaskDataGetter, _JobDataGetter


class BatchTempAccessView(APIView):
    """
    Batch temporary access view for serving multiple frames using secure tokens.
    This endpoint allows requesting multiple frames at once and returns them as a zip file.
    """
    authentication_classes = []  # No authentication required for token-based access
    permission_classes = []      # This endpoint is available for everyone with valid token

    def get(self, request, token):
        # Retrieve token data from cache
        cache_key = f"temp_access_batch:{token}"
        cache_data = cache.get(cache_key)

        if not cache_data:
            return Response(
                data="Token not found or expired",
                status=status.HTTP_404_NOT_FOUND
            )

        # Check if token has expired
        current_time = int(time.time())
        if current_time > cache_data.get('expiry', 0):
            cache.delete(cache_key)
            return Response(
                data="Token expired",
                status=status.HTTP_404_NOT_FOUND
            )

        try:
            # Determine if this is a task or job request
            if 'task_id' in cache_data:
                return self._serve_batch_task_data(cache_data)
            elif 'job_id' in cache_data:
                return self._serve_batch_job_data(cache_data)
            else:
                return Response(
                    data="Invalid token data",
                    status=status.HTTP_404_NOT_FOUND
                )
        except Exception as e:
            return Response(
                data=f"Error serving batch data: {str(e)}",
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def _serve_batch_task_data(self, cache_data):
        """Serve multiple task frames as a zip file"""
        try:
            task = Task.objects.get(id=cache_data['task_id'])
        except Task.DoesNotExist:
            return Response(
                data="Task not found",
                status=status.HTTP_404_NOT_FOUND
            )

        frame_numbers = cache_data.get('frame_numbers', [])
        data_quality = cache_data.get('data_quality', 'compressed')

        # Create zip file in memory
        zip_buffer = io.BytesIO()

        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            for frame_num in frame_numbers:
                try:
                    # Get individual frame data
                    data_getter = _TaskDataGetter(
                        task,
                        data_type='frame',
                        data_num=frame_num,
                        data_quality=data_quality,
                        response_type="binary"
                    )

                    # Get the frame response
                    frame_response = data_getter()

                    if hasattr(frame_response, 'content'):
                        frame_data = frame_response.content
                    else:
                        frame_data = frame_response.getvalue() if hasattr(frame_response, 'getvalue') else bytes(frame_response)

                    # Determine file extension based on content type
                    content_type = getattr(frame_response, 'get', lambda x, default: default)('Content-Type', 'image/jpeg')
                    if 'png' in content_type.lower():
                        ext = 'png'
                    elif 'gif' in content_type.lower():
                        ext = 'gif'
                    else:
                        ext = 'jpg'

                    # Add frame to zip
                    filename = f"frame_{frame_num:06d}.{ext}"
                    zip_file.writestr(filename, frame_data)

                except Exception as e:
                    # Add error info for failed frames
                    error_info = f"Error retrieving frame {frame_num}: {str(e)}"
                    zip_file.writestr(f"error_frame_{frame_num}.txt", error_info)

        zip_buffer.seek(0)

        # Return zip file as response
        response = HttpResponse(
            zip_buffer.getvalue(),
            content_type='application/zip'
        )
        response['Content-Disposition'] = f'attachment; filename="task_{cache_data["task_id"]}_frames.zip"'
        return response

    def _serve_batch_job_data(self, cache_data):
        """Serve multiple job frames as a zip file"""
        try:
            job = Job.objects.get(id=cache_data['job_id'])
        except Job.DoesNotExist:
            return Response(
                data="Job not found",
                status=status.HTTP_404_NOT_FOUND
            )

        frame_numbers = cache_data.get('frame_numbers', [])
        data_quality = cache_data.get('data_quality', 'compressed')

        # Create zip file in memory
        zip_buffer = io.BytesIO()

        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            for frame_num in frame_numbers:
                try:
                    # Get individual frame data
                    data_getter = _JobDataGetter(
                        job,
                        data_type='frame',
                        data_quality=data_quality,
                        data_num=frame_num,
                        response_type="binary"
                    )

                    # Get the frame response
                    frame_response = data_getter()

                    if hasattr(frame_response, 'content'):
                        frame_data = frame_response.content
                    else:
                        frame_data = frame_response.getvalue() if hasattr(frame_response, 'getvalue') else bytes(frame_response)

                    # Determine file extension based on content type
                    content_type = getattr(frame_response, 'get', lambda x, default: default)('Content-Type', 'image/jpeg')
                    if 'png' in content_type.lower():
                        ext = 'png'
                    elif 'gif' in content_type.lower():
                        ext = 'gif'
                    else:
                        ext = 'jpg'

                    # Add frame to zip
                    filename = f"frame_{frame_num:06d}.{ext}"
                    zip_file.writestr(filename, frame_data)

                except Exception as e:
                    # Add error info for failed frames
                    error_info = f"Error retrieving frame {frame_num}: {str(e)}"
                    zip_file.writestr(f"error_frame_{frame_num}.txt", error_info)

        zip_buffer.seek(0)

        # Return zip file as response
        response = HttpResponse(
            zip_buffer.getvalue(),
            content_type='application/zip'
        )
        response['Content-Disposition'] = f'attachment; filename="job_{cache_data["job_id"]}_frames.zip"'
        return response