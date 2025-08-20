// Copyright (C) CVAT.ai Corporation
//
// SPDX-License-Identifier: MIT

import React from 'react';
import { Tabs } from 'antd';
import { Project, Task, Job } from 'cvat-core-wrapper';
import AnalyticsStats from './analytics-stats';
import AnalyticsDashboard from './analytics-dashboard';
import { TimePeriod } from '.';

const { TabPane } = Tabs;

interface Props {
    resource: Project | Task | Job;
    timePeriod: TimePeriod | null;
}

function AnalyticsReportContent({ resource, timePeriod }: Props): JSX.Element {
    if (!timePeriod) {
        return (
            <div style={{ padding: '20px', textAlign: 'center' }}>
                <p>Please select a time period to view analytics data.</p>
            </div>
        );
    }

    // Determine instance type and ID based on resource
    let instanceType: 'project' | 'task' | 'job';
    let instanceId: number;

    if ('projectId' in resource && 'taskId' in resource && 'id' in resource) {
        // This is a Job
        instanceType = 'job';
        instanceId = resource.id;
    } else if ('projectId' in resource && 'id' in resource) {
        // This is a Task
        instanceType = 'task';
        instanceId = resource.id;
    } else {
        // This is a Project
        instanceType = 'project';
        instanceId = resource.id;
    }

    // Temporarily disable paid feature check to show our enhanced analytics dashboard
    // const shouldShowPaidPlaceholder = config.PAID_PLACEHOLDER_CONFIG?.features?.analyticsReport;
    // if (shouldShowPaidPlaceholder) {
    //     return (
    //         <PaidFeaturePlaceholder
    //             featureDescription={config.PAID_PLACEHOLDER_CONFIG.features.analyticsReport}
    //         />
    //     );
    // }

    return (
        <div className="analytics-report-content">
            <Tabs defaultActiveKey="dashboard" type="card">
                <TabPane tab="Enhanced Analytics" key="dashboard">
                    <AnalyticsDashboard
                        instanceType={instanceType}
                        instanceId={instanceId}
                        timePeriod={timePeriod}
                    />
                </TabPane>
                <TabPane tab="Legacy View" key="legacy">
                    <AnalyticsStats statsData={{}} labelsData={[]} />
                </TabPane>
            </Tabs>
        </div>
    );
}

export default AnalyticsReportContent;
