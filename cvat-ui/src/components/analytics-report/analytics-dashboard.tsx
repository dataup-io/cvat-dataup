// Copyright (C) CVAT.ai Corporation
//
// SPDX-License-Identifier: MIT

import React, { useState, useMemo } from 'react';
import { Row, Col, Card, Statistic, Select, Spin, Alert, Button, Space, Tooltip } from 'antd';
// eslint-disable-next-line import/no-extraneous-dependencies
import { Line, Pie, Column } from '@ant-design/plots';
import { ReloadOutlined, DownloadOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { useAnalyticsData } from 'hooks/use-analytics-data';
import { TimePeriod } from './index';

const { Option } = Select;

interface Props {
    instanceType: 'project' | 'task' | 'job';
    instanceId: number;
    timePeriod: TimePeriod | null;
}

function AnalyticsDashboard({ instanceType, instanceId, timePeriod }: Props): JSX.Element {
    const [format, setFormat] = useState<'aggregated' | 'summary'>('aggregated');
    const [groupBy, setGroupBy] = useState<string | undefined>(undefined);

    // Clear groupBy state since it's not supported for project/task/job level analytics
    React.useEffect(() => {
        setGroupBy(undefined);
    }, [instanceType, instanceId]);

    const { data, loading, error, refetch } = useAnalyticsData({
        instanceType,
        instanceId,
        timePeriod,
        format,
        groupBy: groupBy as
            | 'user_id'
            | 'project_id'
            | 'task_id'
            | 'job_id'
            | 'scope'
            | undefined,
    });

    const chartData = useMemo(() => {
        if (!data || format !== 'aggregated') return null;

        const { analytics } = data;
        if (!analytics) return null;

        try {
            // Events over time chart data
            const timeData = analytics.events_over_time?.map((item: any) => {
                if (!item || typeof item.timestamp === 'undefined' || typeof item.count === 'undefined') {
                    return null;
                }
                return {
                    date: new Date(item.timestamp).toLocaleDateString(),
                    count: Number(item.count) || 0,
                };
            }).filter(
                (item: { date: string; count: number } | null): item is {
                    date: string;
                    count: number;
                } => item !== null,
            ) || [];

            const scopeData = Object.entries(analytics.events_by_scope || {})
                .map(([scope, count]) => {
                    if (!scope || typeof count === 'undefined') return null;
                    return {
                        type: String(scope),
                        value: Number(count) || 0,
                    };
                })
                .filter(
                    (item): item is { type: string; value: number } => item !== null,
                );

            // Top users chart data
            const userData = Object.entries(analytics.top_users || {})
                .slice(0, 10)
                .map(([userId, count]) => {
                    if (!userId || typeof count === 'undefined') return null;
                    return {
                        user: `User ${userId}`,
                        events: Number(count) || 0,
                    };
                })
                .filter(Boolean);

            // Top projects chart data
            const projectData = Object.entries(analytics.top_projects || {})
                .slice(0, 10)
                .map(([projectId, count]) => {
                    if (!projectId || typeof count === 'undefined') return null;
                    return {
                        project: `Project ${projectId}`,
                        events: Number(count) || 0,
                    };
                })
                .filter(Boolean);

            return { timeData, scopeData, userData, projectData };
        } catch (chartError) {
            console.error('Error processing chart data:', chartError);
            return null;
        }
    }, [data, format]);

    const handleExport = (): void => {
        // TODO: Implement CSV export functionality
        console.log('Export functionality to be implemented');
    };

    if (loading) {
        return (
            <div style={{ textAlign: 'center', padding: '50px' }}>
                <Spin size="large" />
                <div style={{ marginTop: 16 }}>Loading analytics data...</div>
            </div>
        );
    }

    if (error) {
        return (
            <Alert
                message="Error loading analytics data"
                description={error}
                type="error"
                showIcon
                action={
                    <Button onClick={refetch} type="primary" icon={<ReloadOutlined />}>
                        Retry
                    </Button>
                }
                style={{ margin: '20px 0' }}
            />
        );
    }

    if (!timePeriod) {
        return (
            <Alert
                message="Select a time period"
                description="Please select a date range to view analytics data."
                type="info"
                showIcon
                style={{ margin: '20px 0' }}
            />
        );
    }

    if (!data) {
        return (
            <Alert
                message="No data available"
                description="No analytics data found for the selected time period."
                type="info"
                showIcon
                style={{ margin: '20px 0' }}
            />
        );
    }

    return (
        <div className="analytics-dashboard">
            {/* Controls */}
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                <Col span={8}>
                    <Space>
                        <span>Format:</span>
                        <Select
                            value={format}
                            onChange={setFormat}
                            style={{ width: 150 }}
                        >
                            <Option value="aggregated">Aggregated</Option>
                            <Option value="summary">Summary</Option>
                        </Select>
                    </Space>
                </Col>
                <Col span={8}>
                    <Space>
                        <span>Group by:</span>
                        <Select
                            value={groupBy}
                            onChange={setGroupBy}
                            style={{ width: 150 }}
                            placeholder="Not available"
                            disabled
                        >
                            <Option value="scope">Scope</Option>
                            <Option value="user_id">User</Option>
                            <Option value="project_id">Project</Option>
                            <Option value="task_id">Task</Option>
                            <Option value="job_id">Job</Option>
                        </Select>
                        <Tooltip title="Grouping is not available for project/task/job level analytics">
                            <InfoCircleOutlined style={{ color: '#faad14' }} />
                        </Tooltip>
                    </Space>
                </Col>
                <Col span={8} style={{ textAlign: 'right' }}>
                    <Space>
                        <Button icon={<ReloadOutlined />} onClick={refetch}>
                            Refresh
                        </Button>
                        <Button icon={<DownloadOutlined />} onClick={handleExport}>
                            Export
                        </Button>
                    </Space>
                </Col>
            </Row>

            {/* Summary Statistics */}
            {format === 'summary' && data?.summary && (
                <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                    <Col span={6}>
                        <Card>
                            <Statistic
                                title={
                                    <Space>
                                        Total Events
                                        <Tooltip title="Total number of events in the selected time period">
                                            <InfoCircleOutlined style={{ color: '#1890ff' }} />
                                        </Tooltip>
                                    </Space>
                                }
                                value={data.summary.total_events || 0}
                                valueStyle={{ color: '#3f8600' }}
                            />
                        </Card>
                    </Col>
                    <Col span={6}>
                        <Card>
                            <Statistic
                                title={
                                    <Space>
                                        Unique Users
                                        <Tooltip title="Number of unique users who performed actions">
                                            <InfoCircleOutlined style={{ color: '#1890ff' }} />
                                        </Tooltip>
                                    </Space>
                                }
                                value={data.summary.unique_users || 0}
                                valueStyle={{ color: '#1890ff' }}
                            />
                        </Card>
                    </Col>
                    <Col span={6}>
                        <Card>
                            <Statistic
                                title={
                                    <Space>
                                        Unique Projects
                                        <Tooltip title="Number of unique projects with activity">
                                            <InfoCircleOutlined style={{ color: '#1890ff' }} />
                                        </Tooltip>
                                    </Space>
                                }
                                value={data.summary.unique_projects || 0}
                                valueStyle={{ color: '#722ed1' }}
                            />
                        </Card>
                    </Col>
                    <Col span={6}>
                        <Card>
                            <Statistic
                                title={
                                    <Space>
                                        Time Range (Days)
                                        <Tooltip title="Duration of the selected time period">
                                            <InfoCircleOutlined style={{ color: '#1890ff' }} />
                                        </Tooltip>
                                    </Space>
                                }
                                value={data.summary.time_range_days || 0}
                                valueStyle={{ color: '#fa8c16' }}
                            />
                        </Card>
                    </Col>
                </Row>
            )}

            {/* Aggregated Data Visualizations */}
            {format === 'aggregated' && chartData && (
                <>
                    {/* Quick Stats */}
                    <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                        <Col span={6}>
                            <Card>
                                <Statistic
                                    title="Total Events"
                                    value={data.total_events}
                                    valueStyle={{ color: '#3f8600' }}
                                />
                            </Card>
                        </Col>
                        <Col span={6}>
                            <Card>
                                <Statistic
                                    title="Event Types"
                                    value={chartData.scopeData.length}
                                    valueStyle={{ color: '#1890ff' }}
                                />
                            </Card>
                        </Col>
                        <Col span={6}>
                            <Card>
                                <Statistic
                                    title="Active Users"
                                    value={chartData.userData.length}
                                    valueStyle={{ color: '#722ed1' }}
                                />
                            </Card>
                        </Col>
                        <Col span={6}>
                            <Card>
                                <Statistic
                                    title="Active Projects"
                                    value={chartData.projectData.length}
                                    valueStyle={{ color: '#fa8c16' }}
                                />
                            </Card>
                        </Col>
                    </Row>

                    {/* Time Series Chart */}
                    {chartData.timeData && chartData.timeData.length > 0 && (
                        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                            <Col span={24}>
                                <Card title="Events Over Time" extra={
                                    <Tooltip title="Timeline showing event frequency">
                                        <InfoCircleOutlined />
                                    </Tooltip>
                                }>
                                    <Line
                                        data={chartData.timeData}
                                        xField="date"
                                        yField="count"
                                        height={300}
                                        smooth
                                        point={{
                                            size: 4,
                                            shape: 'circle',
                                        }}
                                        color="#1890ff"
                                        tooltip={{
                                            formatter: (datum: any) => ({
                                                name: 'Events',
                                                value: datum.count,
                                            }),
                                        }}
                                        xAxis={{
                                            label: {
                                                autoRotate: true,
                                            },
                                        }}
                                        yAxis={{
                                            label: {
                                                formatter: (v: string) => `${v} events`,
                                            },
                                        }}
                                    />
                                </Card>
                            </Col>
                        </Row>
                    )}

                    {/* Distribution Charts */}
                    <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                        {chartData.scopeData && chartData.scopeData.length > 0 && (
                            <Col span={12}>
                                <Card title="Events by Scope" extra={
                                    <Tooltip title="Distribution of events by action type">
                                        <InfoCircleOutlined />
                                    </Tooltip>
                                }>
                                    <Pie
                                        data={chartData.scopeData}
                                        angleField="value"
                                        colorField="type"
                                        height={300}
                                        radius={0.8}
                                        innerRadius={0.4}
                                        label={{
                                            type: 'outer',
                                            content: (pieData: any) => (
                                                `${pieData.type}: ${(pieData.percent * 100).toFixed(1)}%`
                                            ),
                                        }}
                                        interactions={[
                                            {
                                                type: 'element-active',
                                            },
                                        ]}
                                        legend={{
                                            position: 'bottom',
                                        }}
                                    />
                                </Card>
                            </Col>
                        )}
                        {chartData.userData && chartData.userData.length > 0 && (
                            <Col span={12}>
                                <Card title="Top Active Users" extra={
                                    <Tooltip title="Users with the most activity">
                                        <InfoCircleOutlined />
                                    </Tooltip>
                                }>
                                    <Column
                                        data={chartData.userData}
                                        xField="user"
                                        yField="events"
                                        height={300}
                                        color="#52c41a"
                                        columnWidthRatio={0.6}
                                        label={{
                                            position: 'top',
                                            style: {
                                                fill: '#000',
                                                opacity: 0.6,
                                            },
                                        }}
                                        xAxis={{
                                            label: {
                                                autoRotate: true,
                                            },
                                        }}
                                        yAxis={{
                                            label: {
                                                formatter: (v: string) => `${v} events`,
                                            },
                                        }}
                                    />
                                </Card>
                            </Col>
                        )}
                    </Row>

                    {/* Additional Charts */}
                    {chartData.projectData.length > 0 && (
                        <Row gutter={[16, 16]}>
                            <Col span={24}>
                                <Card title="Top Active Projects" extra={
                                    <Tooltip title="Projects with the most activity">
                                        <InfoCircleOutlined />
                                    </Tooltip>
                                }>
                                    <Column
                                        data={chartData.projectData}
                                        xField="project"
                                        yField="events"
                                        height={300}
                                        color="#fa8c16"
                                        columnWidthRatio={0.6}
                                        label={{
                                            position: 'top',
                                            style: {
                                                fill: '#000',
                                                opacity: 0.6,
                                            },
                                        }}
                                        xAxis={{
                                            label: {
                                                autoRotate: true,
                                            },
                                        }}
                                        yAxis={{
                                            label: {
                                                formatter: (v: string) => `${v} events`,
                                            },
                                        }}
                                    />
                                </Card>
                            </Col>
                        </Row>
                    )}
                </>
            )}

            {/* Metadata */}
            {data.metadata && (
                <Row style={{ marginTop: 24 }}>
                    <Col span={24}>
                        <Card title="Query Information" size="small">
                            <Row gutter={[16, 8]}>
                                <Col span={6}>
                                    <strong>Query Time:</strong> {new Date(data.metadata.query_time).toLocaleString()}
                                </Col>
                                <Col span={6}>
                                    <strong>Instance:</strong> {instanceType} #{instanceId}
                                </Col>
                                <Col span={6}>
                                    <strong>Time Period:</strong> {timePeriod.startDate} to {timePeriod.endDate}
                                </Col>
                                <Col span={6}>
                                    <strong>Format:</strong> {format}
                                </Col>
                            </Row>
                        </Card>
                    </Col>
                </Row>
            )}
        </div>
    );
}

export default AnalyticsDashboard;