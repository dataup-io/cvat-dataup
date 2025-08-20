import '../styles.scss';
// Copyright (C) 2024 CVAT.ai Corporation
import React, { useState, useEffect, useRef } from 'react';
import {
    Table, Card, Typography, Tag, Button, Tooltip, Popconfirm, message, Collapse, Steps, Space, Modal
} from 'antd';
import {
    DeleteOutlined, StopOutlined, CopyOutlined, LinkOutlined, InfoCircleOutlined
} from '@ant-design/icons';
import moment from 'moment';
import { getCore } from 'cvat-core-wrapper';
import Draggable from 'react-draggable';

const { Step } = Steps;

// Helper function to extract step name from step type
const extractStepName = (stepType: string): string => {
    if (!stepType) return 'Unknown Step';
    const parts = stepType.split('.');
    return parts[parts.length - 1] || 'Unknown Step';
};

// Helper function to get step display name
const getStepDisplayName = (step: any, stepRegistry?: Record<string, StepRegistryItem> | StepRegistryItem[]): string => {
    // First check if step has a direct name property
    if (step.name) {
        return step.name;
    }
    
    // For PipelineStepExecution, use step_id to lookup in registry
    const stepId = step.step_id || step.step || step.stepId;
    
    if (stepId && stepRegistry) {
        // Handle both array and object formats of stepRegistry
        if (Array.isArray(stepRegistry)) {
            // Try to find by ID first
            let registryItem = stepRegistry.find((item: StepRegistryItem) => item.id === stepId);
            // If not found by ID, try to find by type
            if (!registryItem) {
                registryItem = stepRegistry.find((item: StepRegistryItem) => item.type === stepId);
            }
            if (registryItem) {
                return registryItem.name;
            }
        } else {
            // Object format where keys are step IDs
            let registryItem = stepRegistry[stepId];
            if (registryItem) {
                return registryItem.name;
            }
            
            // Try to find by type if direct ID lookup fails
            const registryItemByType = Object.values(stepRegistry).find((item: StepRegistryItem) => item.type === stepId);
            if (registryItemByType) {
                return registryItemByType.name;
            }
            
            // Try to find by matching the stepId with any registry item's ID or type
            const registryItemByMatch = Object.values(stepRegistry).find((item: StepRegistryItem) => 
                item.id === stepId || item.type === stepId || stepId.includes(item.type) || item.type.includes(stepId)
            );
            if (registryItemByMatch) {
                return registryItemByMatch.name;
            }
        }
    }
    
    // Fallback to extracting name from step type or ID
    return extractStepName(stepId || step.id);
};

interface PipelineStepExecution {
    id: string;
    step_id: string;
    execution_id: string;
    order: number;
    status: 'pending' | 'running' | 'completed' | 'failed';
    input_data: Record<string, any>;
    output_data: Record<string, any>;
    step_params: Array<{
        key: string;
        param_type: string;
        default_value: any;
        description: string;
        required: boolean;
    }>;
    log: string | null;
    started_at: string | null;
    finished_at: string | null;
}

interface PipelineExecution {
    id: string;
    pipeline: string;
    pipeline_name: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    inputData: Record<string, any>;
    errorMessage: string;
    startedAt: string;
    completedAt: string;
    steps: PipelineStepExecution[];
    stepExecutions: PipelineStepExecution[];
}

interface PipelineExecutionsResponse {
    count: number;
    next: string | null;
    previous: string | null;
    results: PipelineExecution[];
}

interface PipelineExecutionsProps {
    pipelineId: string;
}

interface NodePosition {
    x: number;
    y: number;
}

interface StepsWithExpandableContentProps {
    steps: PipelineStepExecution[];
    stepRegistry: Record<string, StepRegistryItem>;
}

interface StepRegistryItem {
    id: string;
    type: string;
    name: string;
    description: string;
    category: string;
    parameters: Array<{
        key: string;
        param_type: string;
        default_value: any;
        description: string;
        required: boolean;
    }>;
    version: string;
}

function PipelineExecutionsComponent({ pipelineId }: PipelineExecutionsProps): JSX.Element {
    const [executions, setExecutions] = useState<PipelineExecution[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [stepRegistry, setStepRegistry] = useState<Record<string, StepRegistryItem>>({});
    const [pagination, setPagination] = useState({
        current: 1,
        pageSize: 10,
        total: 0,
    });

    const fetchStepRegistry = async () => {
        try {
            const core = getCore();
            const registryResponse = await core.pipelines.stepRegistry();
            const registry: Record<string, StepRegistryItem> = {};
            registryResponse.results.forEach((item: StepRegistryItem) => {
                registry[item.id] = item;
            });
            setStepRegistry(registry);
        } catch (error) {
            console.error('Failed to fetch step registry:', error);
        }
    };

    const fetchPipelineExecutions = async () => {
        try {
            setLoading(true);
            const core = getCore();
            const filter = { pipeline: pipelineId };
            const executionsResponse = await core.pipelines.executions(filter);

            setExecutions(executionsResponse.results);
            setPagination({
                ...pagination,
                total: executionsResponse.count,
            });
        } catch (error) {
            console.error('Error fetching pipeline executions:', error);
            message.error('Failed to fetch pipeline executions');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteExecution = async (executionId: string) => {
        try {
            const core = getCore();
            await core.server.request(`/api/pipeline-executions/${executionId}`, {
                method: 'DELETE',
            });
            message.success('Pipeline execution deleted successfully');
            fetchPipelineExecutions(); // Refresh the list
        } catch (error) {
            console.error('Error deleting pipeline execution:', error);
            message.error('Failed to delete pipeline execution');
        }
    };

    const handleCancelExecution = async (executionId: string) => {
        try {
            const core = getCore();
            await core.server.request(`/api/pipeline-executions/${executionId}/cancel`, {
                method: 'POST',
            });
            message.success('Pipeline execution cancelled successfully');
            fetchPipelineExecutions(); // Refresh the list
        } catch (error) {
            console.error('Error cancelling pipeline execution:', error);
            message.error('Failed to cancel pipeline execution');
        }
    };



    useEffect(() => {
        fetchStepRegistry();
        fetchPipelineExecutions();
    }, [pipelineId, pagination.current, pagination.pageSize]);

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'completed':
                return 'success'; // green
            case 'running':
                return 'processing'; // blue
            case 'pending':
                return 'default'; // grey
            case 'failed':
                return 'error'; // red
            default:
                return 'default';
        }
    };

    const columns = [
        {
            title: 'ID',
            dataIndex: 'id',
            key: 'id',
            ellipsis: true,
            width: 220,
        },
        {
            title: 'Status',
            dataIndex: 'status',
            key: 'status',
            render: (status: string) => (
                <Tag color={getStatusColor(status)}>
                    {status.toUpperCase()}
                </Tag>
            ),
        },
        {
            title: 'Started',
            dataIndex: 'startedAt',
            key: 'startedAt',
            render: (date: string) => date ? moment(date).format('YYYY-MM-DD HH:mm:ss') : '-',
        },
        {
            title: 'Completed',
            dataIndex: 'completedAt',
            key: 'completedAt',
            render: (date: string) => date ? moment(date).format('YYYY-MM-DD HH:mm:ss') : '-',
        },
        {
            title: 'Duration',
            key: 'duration',
            render: (record: PipelineExecution) => {
                if (!record.startedAt) return '-';
                const start = moment(record.startedAt);
                const end = record.completedAt ? moment(record.completedAt) : moment();
                const duration = moment.duration(end.diff(start));
                return `${Math.floor(duration.asSeconds())}s`;
            },
        },
        {
            title: 'Actions',
            key: 'actions',
            width: 100,
            render: (record: PipelineExecution) => {
                if (record.status === 'pending' || record.status === 'running') {
                    return (
                        <Popconfirm
                            title="Cancel execution"
                            description="Are you sure you want to cancel this pipeline execution?"
                            onConfirm={() => handleCancelExecution(record.id)}
                            okText="Yes"
                            cancelText="No"
                        >
                            <Tooltip title="Cancel execution">
                                <Button
                                    type="text"
                                    size="small"
                                    icon={<StopOutlined />}
                                    danger
                                />
                            </Tooltip>
                        </Popconfirm>
                    );
                } else {
                    return (
                        <Popconfirm
                            title="Delete execution"
                            description="Are you sure you want to delete this pipeline execution?"
                            onConfirm={() => handleDeleteExecution(record.id)}
                            okText="Yes"
                            cancelText="No"
                        >
                            <Tooltip title="Delete execution">
                                <Button
                                    type="text"
                                    size="small"
                                    icon={<DeleteOutlined />}
                                    danger
                                />
                            </Tooltip>
                        </Popconfirm>
                    );
                }
            },
        },
    ];

    const expandedRowRender = (record: PipelineExecution) => {
        return (
            <Card>
                <Collapse defaultActiveKey={['1', '2']}>
                    <Collapse.Panel
                        header="Input Data"
                        key="1"
                        extra={
                            <Tooltip title="Copy input data">
                                <Button
                                    type="text"
                                    size="small"
                                    icon={<CopyOutlined />}
                                    onClick={(e: React.MouseEvent) => {
                                        e.stopPropagation();
                                        navigator.clipboard.writeText(JSON.stringify(record.inputData, null, 2));
                                        message.success('Input data copied to clipboard');
                                    }}
                                />
                            </Tooltip>
                        }
                    >
                        <pre style={{
                            maxHeight: '300px',
                            overflow: 'auto',
                            backgroundColor: '#f5f5f5',
                            padding: '12px',
                            borderRadius: '4px',
                            fontSize: '12px'
                        }}>
                            {JSON.stringify(record.inputData, null, 2)}
                        </pre>
                    </Collapse.Panel>
                    {record.errorMessage && (
                        <Collapse.Panel header="Error" key="2">
                            <Typography.Text type="danger">{record.errorMessage}</Typography.Text>
                        </Collapse.Panel>
                    )}
                    <Collapse.Panel header="Steps" key="3">
                        <StepsWithExpandableContent steps={record.stepExecutions || record.steps} stepRegistry={stepRegistry} />
                    </Collapse.Panel>
                </Collapse>
            </Card>
        );
    };

    return (
        <div className='dataup-pipeline-executions'>
            <Typography.Title level={4} style={{ margin: '16px 0' }}>
                Pipeline Executions
            </Typography.Title>
            <Table
                dataSource={executions}
                columns={columns}
                rowKey='id'
                expandable={{ expandedRowRender }}
                pagination={{
                    current: pagination.current || 1,
                    pageSize: pagination.pageSize || 10,
                    total: pagination.total,
                    onChange: (page: number, pageSize: number) => {
                        setPagination({
                            current: page,
                            pageSize: pageSize,
                            total: pagination.total,
                        });
                    },
                }}
                loading={loading}
            />
        </div>
    );
}

export default React.memo(PipelineExecutionsComponent);

function StepsWithExpandableContent({ steps, stepRegistry }: StepsWithExpandableContentProps): JSX.Element {
    const [nodePositions, setNodePositions] = useState<Record<string, NodePosition>>({});
    const [selectedStep, setSelectedStep] = useState<PipelineStepExecution | null>(null);
    const [detailModalVisible, setDetailModalVisible] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Initialize node positions
    useEffect(() => {
        const positions: Record<string, NodePosition> = {};
        steps.forEach((step, index) => {
            positions[step.id] = {
                x: 50 + (index * 300),
                y: 50 + (index % 2) * 150
            };
        });
        setNodePositions(positions);
    }, [steps]);

    const handleNodeDrag = (stepId: string, data: { x: number; y: number }) => {
        setNodePositions((prev: Record<string, NodePosition>) => ({
            ...prev,
            [stepId]: { x: data.x, y: data.y }
        }));
    };

    const handleStepClick = (step: PipelineStepExecution) => {
        setSelectedStep(step);
        setDetailModalVisible(true);
    };

    const getStepStatusColor = (status: string) => {
        switch (status) {
            case 'completed':
                return '#52c41a'; // green
            case 'running':
                return '#1890ff'; // blue
            case 'pending':
                return '#d9d9d9'; // grey
            case 'failed':
                return '#ff4d4f'; // red
            default:
                return '#d9d9d9';
        }
    };

    const getStepStatusBadge = (status: string) => {
        switch (status) {
            case 'completed':
                return 'success'; // green
            case 'running':
                return 'processing'; // blue
            case 'pending':
                return 'default'; // grey
            case 'failed':
                return 'error'; // red
            default:
                return 'default';
        }
    };

    const renderConnectionLines = () => {
        const lines = [];
        for (let i = 0; i < steps.length - 1; i++) {
            const currentStep = steps[i];
            const nextStep = steps[i + 1];
            const currentPos = nodePositions[currentStep.id];
            const nextPos = nodePositions[nextStep.id];

            if (currentPos && nextPos) {
                const x1 = currentPos.x + 250; // Node width
                const y1 = currentPos.y + 60;  // Half node height
                const x2 = nextPos.x;
                const y2 = nextPos.y + 60;

                lines.push(
                    <line
                        key={`${currentStep.id}-${nextStep.id}`}
                        x1={x1}
                        y1={y1}
                        x2={x2}
                        y2={y2}
                        stroke={getStepStatusColor(currentStep.status)}
                        strokeWidth="2"
                        markerEnd="url(#arrowhead)"
                    />
                );
            }
        }
        return lines;
    };

    return (
        <>
            <div className="pipeline-steps-node-view" style={{ position: 'relative', height: '600px', overflow: 'auto', border: '1px solid #f0f0f0', borderRadius: '8px', backgroundColor: '#fafafa' }}>
                <div ref={containerRef} style={{ position: 'relative', width: '100%', height: '100%', minWidth: `${Math.max(800, steps.length * 300)}px` }}>
                    {/* SVG for connection lines */}
                    <svg
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%',
                            pointerEvents: 'none',
                            zIndex: 1
                        }}
                    >
                        <defs>
                            <marker
                                id="arrowhead"
                                markerWidth="10"
                                markerHeight="7"
                                refX="9"
                                refY="3.5"
                                orient="auto"
                            >
                                <polygon
                                    points="0 0, 10 3.5, 0 7"
                                    fill="#1890ff"
                                />
                            </marker>
                        </defs>
                        {renderConnectionLines()}
                    </svg>

                    {/* Draggable step nodes */}
                    {steps.map((step, index) => {
                        const position = nodePositions[step.id] || { x: 0, y: 0 };
                        const statusColor = getStepStatusColor(step.status);

                        return (
                            <Draggable
                                key={step.id}
                                position={position}
                                onDrag={(e: any, data: { x: number; y: number }) => handleNodeDrag(step.id, data)}
                                handle=".drag-handle"
                            >
                                <div style={{ position: 'absolute', zIndex: 2 }}>
                                    <Card
                                        size="small"
                                        style={{
                                            width: 250,
                                            cursor: 'move',
                                            border: `2px solid ${statusColor}`,
                                            borderRadius: '8px',
                                            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                                            backgroundColor: 'white'
                                        }}
                                        title={
                                            <div className="drag-handle" style={{ cursor: 'move' }}>
                                                <Space>
                                                    <Typography.Text strong>Step {step.order}</Typography.Text>
                                                    <LinkOutlined style={{ color: statusColor }} />
                                                </Space>
                                            </div>
                                        }
                                        extra={
                                            <Tooltip title="View Details">
                                                <Button
                                                    type="text"
                                                    icon={<InfoCircleOutlined />}
                                                    onClick={() => handleStepClick(step)}
                                                    style={{ cursor: 'pointer' }}
                                                />
                                            </Tooltip>
                                        }
                                    >
                                        <div style={{ pointerEvents: 'none' }}>
                                            <Typography.Text strong>{getStepDisplayName(step, stepRegistry)}</Typography.Text>
                                            <br />
                                            <Tag color={getStepStatusBadge(step.status)} style={{ marginTop: '4px' }}>
                                                {step.status.toUpperCase()}
                                            </Tag>
                                            <br />
                                            <Typography.Text style={{ fontSize: '11px', color: '#666' }}>
                                                {step.started_at ? moment(step.started_at).format('HH:mm:ss') : 'Not started'}
                                            </Typography.Text>
                                            {step.finished_at && (
                                                <>
                                                    <br />
                                                    <Typography.Text style={{ fontSize: '11px', color: '#666' }}>
                                                        Duration: {moment.duration(moment(step.finished_at).diff(moment(step.started_at))).humanize()}
                                                    </Typography.Text>
                                                </>
                                            )}
                                        </div>
                                    </Card>
                                </div>
                            </Draggable>
                        );
                    })}
                </div>
            </div>

            {/* Step Detail Modal */}
            <Modal
                title={
                    <Space>
                        <InfoCircleOutlined />
                        <span>Step Execution Details</span>
                        {selectedStep && (
                            <Typography.Text type="secondary">
                                - {getStepDisplayName(selectedStep, stepRegistry)}
                            </Typography.Text>
                        )}
                    </Space>
                }
                open={detailModalVisible}
                onCancel={() => {
                    setDetailModalVisible(false);
                    setSelectedStep(null);
                }}
                footer={[
                    <Button key="close" onClick={() => setDetailModalVisible(false)}>
                        Close
                    </Button>
                ]}
                width={800}
                destroyOnClose
            >
                {selectedStep && (
                    <div>
                        <div style={{ marginBottom: '16px' }}>
                            <Typography.Text type="secondary">
                                Status: <Tag color={getStepStatusBadge(selectedStep.status)}>{selectedStep.status.toUpperCase()}</Tag>
                            </Typography.Text>
                            <br />
                            <Typography.Text type="secondary">
                                Started: {selectedStep.started_at ? moment(selectedStep.started_at).format('YYYY-MM-DD HH:mm:ss') : '-'}
                            </Typography.Text>
                            <br />
                            <Typography.Text type="secondary">
                                Finished: {selectedStep.finished_at ? moment(selectedStep.finished_at).format('YYYY-MM-DD HH:mm:ss') : '-'}
                            </Typography.Text>
                        </div>
                        
                        <Collapse defaultActiveKey={['1']}>
                            {selectedStep.step_params && selectedStep.step_params.length > 0 && (
                                <Collapse.Panel
                                    header="Parameters"
                                    key="0"
                                    extra={
                                        <Tooltip title="Copy parameters">
                                            <Button
                                                type="text"
                                                size="small"
                                                icon={<CopyOutlined />}
                                                onClick={(e: React.MouseEvent) => {
                                                    e.stopPropagation();
                                                    navigator.clipboard.writeText(JSON.stringify(selectedStep.step_params, null, 2));
                                                    message.success('Parameters copied to clipboard');
                                                }}
                                            />
                                        </Tooltip>
                                    }
                                >
                                    <div style={{ padding: '8px 0' }}>
                                        {selectedStep.step_params.map((param: any, index: number) => (
                                            <div key={index} style={{ marginBottom: '12px', padding: '8px', backgroundColor: '#fafafa', borderRadius: '4px' }}>
                                                <Typography.Text strong>{param.key}</Typography.Text>
                                                <Typography.Text type="secondary" style={{ marginLeft: '8px' }}>({param.param_type})</Typography.Text>
                                                {param.required && <Tag color="red" style={{ marginLeft: '8px', fontSize: '12px' }}>Required</Tag>}
                                                <br />
                                                <Typography.Text type="secondary">Default: </Typography.Text>
                                                <Typography.Text code>{JSON.stringify(param.default_value)}</Typography.Text>
                                                {param.description && (
                                                    <>
                                                        <br />
                                                        <Typography.Text type="secondary">{param.description}</Typography.Text>
                                                    </>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </Collapse.Panel>
                            )}
                            <Collapse.Panel
                                header="Input Data"
                                key="1"
                                extra={
                                    <Tooltip title="Copy input data">
                                        <Button
                                            type="text"
                                            size="small"
                                            icon={<CopyOutlined />}
                                            onClick={(e: React.MouseEvent) => {
                                                e.stopPropagation();
                                                navigator.clipboard.writeText(JSON.stringify(selectedStep.input_data, null, 2));
                                                message.success('Input data copied to clipboard');
                                            }}
                                        />
                                    </Tooltip>
                                }
                            >
                                <pre style={{
                                    maxHeight: '300px',
                                    overflow: 'auto',
                                    backgroundColor: '#f5f5f5',
                                    padding: '12px',
                                    borderRadius: '4px',
                                    fontSize: '12px'
                                }}>
                                    {JSON.stringify(selectedStep.input_data, null, 2)}
                                </pre>
                            </Collapse.Panel>
                            <Collapse.Panel
                                header="Output Data"
                                key="2"
                                extra={
                                    <Tooltip title="Copy output data">
                                        <Button
                                            type="text"
                                            size="small"
                                            icon={<CopyOutlined />}
                                            onClick={(e: React.MouseEvent) => {
                                                e.stopPropagation();
                                                navigator.clipboard.writeText(JSON.stringify(selectedStep.output_data, null, 2));
                                                message.success('Output data copied to clipboard');
                                            }}
                                        />
                                    </Tooltip>
                                }
                            >
                                <pre style={{
                                    maxHeight: '300px',
                                    overflow: 'auto',
                                    backgroundColor: '#f5f5f5',
                                    padding: '12px',
                                    borderRadius: '4px',
                                    fontSize: '12px'
                                }}>
                                    {JSON.stringify(selectedStep.output_data, null, 2)}
                                </pre>
                            </Collapse.Panel>
                            {selectedStep.log && (
                                <Collapse.Panel
                                    header="Logs"
                                    key="3"
                                    extra={
                                        <Tooltip title="Copy log data">
                                            <Button
                                                type="text"
                                                size="small"
                                                icon={<CopyOutlined />}
                                                onClick={(e: React.MouseEvent) => {
                                                    e.stopPropagation();
                                                    navigator.clipboard.writeText(selectedStep.log || '');
                                                    message.success('Log data copied to clipboard');
                                                }}
                                            />
                                        </Tooltip>
                                    }
                                >
                                    <pre style={{
                                        maxHeight: '300px',
                                        overflow: 'auto',
                                        backgroundColor: '#f5f5f5',
                                        padding: '12px',
                                        borderRadius: '4px',
                                        fontSize: '12px',
                                        whiteSpace: 'pre-wrap'
                                    }}>
                                        {selectedStep.log}
                                    </pre>
                                </Collapse.Panel>
                            )}
                        </Collapse>
                    </div>
                )}
            </Modal>
        </>
    );
}