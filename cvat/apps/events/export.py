# Copyright (C) CVAT.ai Corporation
#
# SPDX-License-Identifier: MIT

import csv
import json
import os
import uuid
from collections import defaultdict
from datetime import datetime, timedelta

import clickhouse_connect
from dateutil import parser
from django.conf import settings
from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.response import Response
from rest_framework.reverse import reverse

from cvat.apps.dataset_manager.util import ExportCacheManager
from cvat.apps.dataset_manager.views import log_exception
from cvat.apps.engine.log import ServerLogManager
from cvat.apps.engine.models import RequestAction
from cvat.apps.engine.rq import ExportRequestId, RQMetaWithFailureInfo
from cvat.apps.engine.types import ExtendedRequest
from cvat.apps.engine.utils import sendfile
from cvat.apps.engine.view_utils import deprecate_response
from cvat.apps.events.permissions import EventsPermission
from cvat.apps.events.utils import find_minimal_date_for_filter
from cvat.apps.redis_handler.background import AbstractExporter

slogger = ServerLogManager(__name__)

DEFAULT_CACHE_TTL = timedelta(hours=1)
TARGET = "events"


def _create_csv(query_params: dict, output_filename: str):
    try:
        clickhouse_settings = settings.CLICKHOUSE["events"]

        time_filter = {
            "from": query_params.pop("from"),
            "to": query_params.pop("to"),
        }

        query = "SELECT * FROM events"
        conditions = ["source in ('server', 'client')", "scope != 'send:exception'"]
        parameters = {}

        if time_filter["from"]:
            conditions.append(f"timestamp >= {{from:DateTime64}}")
            parameters["from"] = time_filter["from"]

        if time_filter["to"]:
            conditions.append(f"timestamp <= {{to:DateTime64}}")
            parameters["to"] = time_filter["to"]

        for param, value in query_params.items():
            if value:
                conditions.append(f"{param} = {{{param}:UInt64}}")
                parameters[param] = value

        if conditions:
            query += " WHERE " + " AND ".join(conditions)

        query += " ORDER BY timestamp ASC"

        with clickhouse_connect.get_client(
            host=clickhouse_settings["HOST"],
            database=clickhouse_settings["NAME"],
            port=clickhouse_settings["PORT"],
            username=clickhouse_settings["USER"],
            password=clickhouse_settings["PASSWORD"],
        ) as client:
            result = client.query(query, parameters=parameters)

        with open(output_filename, "w", encoding="UTF8") as f:
            writer = csv.writer(f)
            writer.writerow(result.column_names)
            writer.writerows(result.result_rows)

        return output_filename
    except Exception:
        log_exception(slogger.glob)
        raise


def _get_analytics_data_json(request, perm):
    """
    Main function to retrieve analytics data from ClickHouse and return as JSON.
    Supports raw, aggregated, and summary formats with comprehensive filtering and optimization.
    """
    try:
        clickhouse_settings = settings.CLICKHOUSE["events"]
        
        # Apply permission filtering
        filter_query = perm.filter(request.query_params)
        
        # Extract query parameters
        resource_filters = ("org_id", "project_id", "task_id", "job_id", "user_id")
        datetime_filters = ("from", "to")
        query_params = {k: filter_query.get(k) for k in resource_filters + datetime_filters}
        
        # Parse datetime parameters
        for datetime_filter in datetime_filters:
            if query_params[datetime_filter]:
                try:
                    query_params[datetime_filter] = parser.isoparse(query_params[datetime_filter])
                except parser.ParserError:
                    raise serializers.ValidationError(
                        f"Cannot parse {datetime_filter!r} datetime parameter: {query_params[datetime_filter]}"
                    )
        
        # Set default time range if not provided
        if not query_params["from"]:
            query_params["from"] = find_minimal_date_for_filter(
                job_id=query_params["job_id"],
                task_id=query_params["task_id"],
                project_id=query_params["project_id"],
                org_id=query_params["org_id"],
            )
        
        if not query_params["to"]:
            query_params["to"] = datetime.now(timezone.utc)
        
        # Get format and grouping parameters
        data_format = request.query_params.get("format", "aggregated")
        group_by = request.query_params.get("group_by")
        
        # Connect to ClickHouse
        with clickhouse_connect.get_client(
            host=clickhouse_settings["HOST"],
            database=clickhouse_settings["NAME"],
            port=clickhouse_settings["PORT"],
            username=clickhouse_settings["USER"],
            password=clickhouse_settings["PASSWORD"],
        ) as client:
            
            if data_format == "raw":
                return _get_raw_analytics_data(client, query_params)
            elif data_format == "summary":
                return _get_summary_analytics_data(client, query_params)
            else:  # aggregated (default)
                return _get_aggregated_analytics_data(client, query_params, group_by)
                
    except Exception as e:
        slogger.glob.exception("Failed to retrieve analytics data")
        raise


def _get_raw_analytics_data(client, query_params: dict) -> dict:
    """
    Returns raw event data with minimal processing
    """
    query = "SELECT * FROM events"
    conditions = ["source in ('server', 'client')", "scope != 'send:exception'"]
    parameters = {}
    
    # Add time filters
    if query_params["from"]:
        conditions.append("timestamp >= {from:DateTime64}")
        parameters["from"] = query_params["from"]
    
    if query_params["to"]:
        conditions.append("timestamp <= {to:DateTime64}")
        parameters["to"] = query_params["to"]
    
    # Add resource filters
    for param, value in query_params.items():
        if value and param not in ("from", "to"):
            conditions.append(f"{param} = {{{param}:UInt64}}")
            parameters[param] = value
    
    if conditions:
        query += " WHERE " + " AND ".join(conditions)
    
    query += " ORDER BY timestamp DESC LIMIT 1000"  # Limit for performance
    
    result = client.query(query, parameters=parameters)
    
    # Convert to list of dictionaries
    events = []
    for row in result.result_rows:
        event = dict(zip(result.column_names, row))
        # Convert timestamp to ISO format
        if 'timestamp' in event:
            event['timestamp'] = event['timestamp'].isoformat()
        events.append(event)
    
    return {
        "format": "raw",
        "total_count": len(events),
        "events": events,
        "metadata": {
            "query_time": datetime.now(timezone.utc).isoformat(),
            "filters": {k: v for k, v in query_params.items() if v is not None}
        }
    }


def _get_aggregated_analytics_data(client, query_params: dict, group_by: str = None) -> dict:
    """
    Returns aggregated analytics data grouped by specified field
    """
    base_conditions = ["source in ('server', 'client')", "scope != 'send:exception'"]
    parameters = {}
    
    # Add time filters
    if query_params["from"]:
        base_conditions.append("timestamp >= {from:DateTime64}")
        parameters["from"] = query_params["from"]
    
    if query_params["to"]:
        base_conditions.append("timestamp <= {to:DateTime64}")
        parameters["to"] = query_params["to"]
    
    # Add resource filters
    for param, value in query_params.items():
        if value and param not in ("from", "to"):
            base_conditions.append(f"{param} = {{{param}:UInt64}}")
            parameters[param] = value
    
    where_clause = " WHERE " + " AND ".join(base_conditions) if base_conditions else ""
    
    analytics_data = {}
    
    # Event counts by scope
    scope_query = f"""
        SELECT scope, COUNT(*) as count
        FROM events
        {where_clause}
        GROUP BY scope
        ORDER BY count DESC
    """
    scope_result = client.query(scope_query, parameters=parameters)
    analytics_data["events_by_scope"] = {
        row[0]: row[1] for row in scope_result.result_rows
    }
    
    # Events over time (hourly aggregation)
    time_query = f"""
        SELECT 
            toStartOfHour(timestamp) as hour,
            COUNT(*) as count
        FROM events
        {where_clause}
        GROUP BY hour
        ORDER BY hour
    """
    time_result = client.query(time_query, parameters=parameters)
    analytics_data["events_over_time"] = [
        {"timestamp": row[0].isoformat(), "count": row[1]}
        for row in time_result.result_rows
    ]
    
    # User activity (if not filtered by specific user)
    if not query_params.get("user_id"):
        user_query = f"""
            SELECT user_id, COUNT(*) as count
            FROM events
            {where_clause}
            AND user_id IS NOT NULL
            GROUP BY user_id
            ORDER BY count DESC
            LIMIT 20
        """
        user_result = client.query(user_query, parameters=parameters)
        analytics_data["top_users"] = {
            str(row[0]): row[1] for row in user_result.result_rows
        }
    
    # Project activity (if not filtered by specific project)
    if not query_params.get("project_id"):
        project_query = f"""
            SELECT project_id, COUNT(*) as count
            FROM events
            {where_clause}
            AND project_id IS NOT NULL
            GROUP BY project_id
            ORDER BY count DESC
            LIMIT 20
        """
        project_result = client.query(project_query, parameters=parameters)
        analytics_data["top_projects"] = {
            str(row[0]): row[1] for row in project_result.result_rows
        }
    
    # Custom grouping if specified
    if group_by and group_by in ["scope", "user_id", "project_id", "task_id", "job_id"]:
        group_query = f"""
            SELECT {group_by}, COUNT(*) as count
            FROM events
            {where_clause}
            AND {group_by} IS NOT NULL
            GROUP BY {group_by}
            ORDER BY count DESC
        """
        group_result = client.query(group_query, parameters=parameters)
        analytics_data[f"grouped_by_{group_by}"] = {
            str(row[0]): row[1] for row in group_result.result_rows
        }
    
    # Calculate total events
    total_query = f"""
        SELECT COUNT(*) as total
        FROM events
        {where_clause}
    """
    total_result = client.query(total_query, parameters=parameters)
    total_count = total_result.result_rows[0][0] if total_result.result_rows else 0
    
    return {
        "format": "aggregated",
        "total_events": total_count,
        "analytics": analytics_data,
        "metadata": {
            "query_time": datetime.now(timezone.utc).isoformat(),
            "filters": {k: v for k, v in query_params.items() if v is not None},
            "group_by": group_by
        }
    }


def _get_summary_analytics_data(client, query_params: dict) -> dict:
    """
    Returns high-level summary statistics
    """
    base_conditions = ["source in ('server', 'client')", "scope != 'send:exception'"]
    parameters = {}
    
    # Add time filters
    if query_params["from"]:
        base_conditions.append("timestamp >= {from:DateTime64}")
        parameters["from"] = query_params["from"]
    
    if query_params["to"]:
        base_conditions.append("timestamp <= {to:DateTime64}")
        parameters["to"] = query_params["to"]
    
    # Add resource filters
    for param, value in query_params.items():
        if value and param not in ("from", "to"):
            base_conditions.append(f"{param} = {{{param}:UInt64}}")
            parameters[param] = value
    
    where_clause = " WHERE " + " AND ".join(base_conditions) if base_conditions else ""
    
    # Get summary statistics
    summary_query = f"""
        SELECT 
            COUNT(*) as total_events,
            COUNT(DISTINCT user_id) as unique_users,
            COUNT(DISTINCT project_id) as unique_projects,
            COUNT(DISTINCT task_id) as unique_tasks,
            COUNT(DISTINCT job_id) as unique_jobs,
            MIN(timestamp) as earliest_event,
            MAX(timestamp) as latest_event
        FROM events
        {where_clause}
    """
    
    result = client.query(summary_query, parameters=parameters)
    row = result.result_rows[0] if result.result_rows else [0] * 7
    
    return {
        "format": "summary",
        "summary": {
            "total_events": row[0],
            "unique_users": row[1],
            "unique_projects": row[2],
            "unique_tasks": row[3],
            "unique_jobs": row[4],
            "earliest_event": row[5].isoformat() if row[5] else None,
            "latest_event": row[6].isoformat() if row[6] else None,
            "time_range_days": (row[6] - row[5]).days if row[5] and row[6] else 0
        },
        "metadata": {
            "query_time": datetime.now(timezone.utc).isoformat(),
            "filters": {k: v for k, v in query_params.items() if v is not None}
        }
    }


class EventsExporter(AbstractExporter):

    def __init__(
        self,
        *,
        request: ExtendedRequest,
    ) -> None:
        super().__init__(request=request)

        # temporary arg
        if query_id := self.request.query_params.get("query_id"):
            self.query_id = uuid.UUID(query_id)
        else:
            self.query_id = uuid.uuid4()

    def build_request_id(self):
        return ExportRequestId(
            target=TARGET,
            id=self.query_id,
            user_id=self.user_id,
        ).render()

    def validate_request_id(self, request_id, /) -> None:
        parsed_request_id: ExportRequestId = ExportRequestId.parse_and_validate_queue(
            request_id,
            expected_queue=self.QUEUE_NAME,  # try_legacy_format is not set here since deprecated API accepts query_id, not the whole Request ID
        )

        if parsed_request_id.action != RequestAction.EXPORT or parsed_request_id.target != TARGET:
            raise ValueError("The provided request id does not match exported target")

    def init_request_args(self):
        super().init_request_args()
        perm = EventsPermission.create_scope_list(self.request)
        self.filter_query = perm.filter(self.request.query_params)

    def _init_callback_with_params(self):
        self.callback = _create_csv

        resource_filters = ("org_id", "project_id", "task_id", "job_id", "user_id")
        datetime_filters = ("from", "to")
        query_params = {k: self.filter_query.get(k) for k in resource_filters + datetime_filters}

        for datetime_filter in datetime_filters:
            if query_params[datetime_filter]:
                try:
                    query_params[datetime_filter] = parser.isoparse(query_params[datetime_filter])
                except parser.ParserError:
                    raise serializers.ValidationError(
                        f"Cannot parse {datetime_filter!r} datetime parameter: {query_params[datetime_filter]}"
                    )

        if (
            query_params["from"]
            and query_params["to"]
            and query_params["from"] > query_params["to"]
        ):
            raise serializers.ValidationError("'from' must be before than 'to'")

        if not query_params["from"]:
            query_params["from"] = find_minimal_date_for_filter(
                job_id=query_params["job_id"],
                task_id=query_params["task_id"],
                project_id=query_params["project_id"],
                org_id=query_params["org_id"],
            )

        if not query_params["to"]:
            query_params["to"] = datetime.now(timezone.utc)

        output_filename = ExportCacheManager.make_file_path(
            file_type="events", file_id=self.query_id, file_ext="csv"
        )
        self.callback_args = (query_params, output_filename)

    def get_result_endpoint_url(self) -> str:
        return reverse("events-download-file", request=self.request)

    def get_result_filename(self):
        if self.export_args.filename:
            return self.export_args.filename

        timestamp = self.get_file_timestamp()
        return f"logs_{timestamp}.csv"


# FUTURE-TODO: delete deprecated function after several releases
def export(request: ExtendedRequest):
    action = request.query_params.get("action")
    if action not in (None, "download"):
        raise serializers.ValidationError("Unexpected action specified for the request")

    filename = request.query_params.get("filename")
    manager = EventsExporter(request=request)
    request_id = manager.build_request_id()
    queue = manager.get_queue()

    response_data = {
        "query_id": manager.query_id,
    }
    deprecation_date = datetime(2025, 3, 17, tzinfo=timezone.utc)
    rq_job = queue.fetch_job(request_id)

    if rq_job:
        if rq_job.is_finished:
            file_path = rq_job.return_value()
            if action == "download" and os.path.exists(file_path):
                rq_job.delete()
                timestamp = datetime.strftime(datetime.now(), "%Y_%m_%d_%H_%M_%S")
                filename = filename or f"logs_{timestamp}.csv"

                return sendfile(request, file_path, attachment=True, attachment_filename=filename)
            else:
                if os.path.exists(file_path):
                    response = Response(status=status.HTTP_201_CREATED)
                    deprecate_response(response, deprecation_date=deprecation_date)
                    return response

        elif rq_job.is_failed:
            rq_job_meta = RQMetaWithFailureInfo.for_job(rq_job)
            exc_info = rq_job_meta.formatted_exception or str(rq_job.exc_info)
            rq_job.delete()
            response = Response(
                exc_info,
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
            deprecate_response(response, deprecation_date=deprecation_date)
            return response
        else:
            response = Response(
                data=response_data,
                status=status.HTTP_202_ACCEPTED,
            )
            deprecate_response(response, deprecation_date=deprecation_date)
            return response

    manager.init_request_args()
    # request validation is missed here since exporting to a cloud_storage is disabled
    manager._set_default_callback_params()
    manager.init_callback_with_params()
    manager.setup_new_job(queue, request_id)

    response = Response(data=response_data, status=status.HTTP_202_ACCEPTED)
    deprecate_response(response, deprecation_date=deprecation_date)
    return response
