// Copyright (C) CVAT.ai Corporation
//
// SPDX-License-Identifier: MIT

import { useState, useEffect, useCallback } from 'react';
import cvat from 'cvat-core/src/api';
import { AnalyticsJSONFilter } from 'cvat-core/src/server-response-types';

export interface TimePeriod {
    startDate: string;
    endDate: string;
}

export interface UseAnalyticsDataParams {
    instanceType: 'organization' | 'project' | 'task' | 'job';
    instanceId: number;
    timePeriod: TimePeriod | null;
    format: 'raw' | 'aggregated' | 'summary';
    groupBy?: 'user_id' | 'project_id' | 'task_id' | 'job_id' | 'scope';
}

export interface UseAnalyticsDataReturn {
    data: any;
    loading: boolean;
    error: string | null;
    refetch: () => void;
}

export const useAnalyticsData = ({
    instanceType,
    instanceId,
    timePeriod,
    format,
    groupBy,
}: UseAnalyticsDataParams): UseAnalyticsDataReturn => {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        // Don't fetch if timePeriod is null
        if (!timePeriod) {
            setData(null);
            setLoading(false);
            setError(null);
            return;
        }

        setLoading(true);
        setError(null);

        // Build filter parameters based on instance type
        const filter: AnalyticsJSONFilter = {
            from: timePeriod.startDate,
            to: timePeriod.endDate,
            format,
        };

        // Add instance-specific filter
        switch (instanceType) {
            case 'organization':
                filter.orgId = instanceId;
                // Only add groupBy for organization-level queries
                if (groupBy) {
                    filter.groupBy = groupBy;
                }
                break;
            case 'project':
                filter.projectId = instanceId;
                // Don't add groupBy for project-specific queries to avoid API error
                break;
            case 'task':
                filter.taskId = instanceId;
                // Don't add groupBy for task-specific queries to avoid API error
                break;
            case 'job':
                filter.jobId = instanceId;
                // Don't add groupBy for job-specific queries to avoid API error
                break;
            default:
                throw new Error(`Unsupported instance type: ${instanceType}`);
        }

        try {
            const result = await cvat.analytics.events.getJSON(filter);
            setData(result);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to fetch analytics data';
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    }, [instanceType, instanceId, timePeriod, format, groupBy]);

    const refetch = useCallback(() => {
        fetchData();
    }, [fetchData]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    return {
        data,
        loading,
        error,
        refetch,
    };
};

export default useAnalyticsData;