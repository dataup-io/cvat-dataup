import React, { useState, useEffect } from 'react';
import { useParams, useHistory, useLocation } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import {
    Card,
    Row,
    Col,
    Button,
    Statistic,
    Table,
    Tag,
    Typography,
    Breadcrumb,
    Tabs,
    Progress,
    Space,
    Divider,
    Spin,
} from 'antd';
import {
    ArrowLeftOutlined,
    BarChartOutlined,
    LineChartOutlined,
    DownloadOutlined,
} from '@ant-design/icons';
import { CombinedState } from 'reducers';
import { getCore } from 'cvat-core-wrapper';
import { getAgentsAsync } from 'actions/agent-actions';
import './agent-benchmark-results-styles.scss';

const { Title, Text } = Typography;
const { TabPane } = Tabs;

interface PerClassMetric {
    class_name: string;
    precision: number;
    recall: number;
    f1: number;
    iou: number;
    ap_50: number;
    ap_75: number;
    ap_50_95: number;
    detections: number;
    ground_truths: number;
}

interface FrameMetric {
    frame_id: number;
    precision: number;
    recall: number;
    f1: number;
    detections: number;
    ground_truths: number;
}

interface GlobalMetrics {
    average_precision: number;
    average_recall: number;
    average_f1: number;
    mean_iou: number;
    precision_at_thresholds: {
        [threshold: string]: number;
    };
}

interface EvaluationResult {
    agent_name: string;
    agent_version: string;
    task_type: string;
    dataset_name: string;
    processed_frames: number;
    evaluation_time_sec: number;
    global_metrics: GlobalMetrics;
    per_class_metrics: PerClassMetric[];
    frame_metrics: FrameMetric[];
}

interface BenchmarkResult {
    id: string;
    status: 'pending' | 'started' | 'finished' | 'failed' | 'deferred' | 'canceled';
    progress: number;
    created_date: string | null;
    started_date: string | null;
    finished_date: string | null;
    exc_info: string | null;
    result: EvaluationResult | null;
    meta: {
        task_id: number;
        job_id: number;
        agent_id: string;
        user: {
            id: number;
            username: string;
        };
    };
}

function AgentBenchmarkResults(): JSX.Element {
    const { agentId } = useParams<{ agentId: string }>();
    const history = useHistory();
    const location = useLocation();
    const [benchmarkResult, setBenchmarkResult] = useState<BenchmarkResult | null>(null);
    const [agent, setAgent] = useState<any>(null);
    const [task, setTask] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    
    const agents = useSelector((state: CombinedState) => state.agents.current);
    const dispatch = useDispatch();
    const core = getCore();

    // Debug logging
    console.log('AgentBenchmarkResults component rendered!', { agentId, location: location.pathname + location.search });



    // Fetch agents when component mounts
    useEffect(() => {
        dispatch(getAgentsAsync());
    }, [dispatch]);

    useEffect(() => {
        const loadBenchmarkResult = async () => {
            try {
                setLoading(true);
                setError(null);
                
                // Get the resultId from URL parameters
                const urlParams = new URLSearchParams(location.search);
                const resultId = urlParams.get('resultId');
                
                if (!resultId) {
                    setError('No result ID provided');
                    setLoading(false);
                    return;
                }
                
                // The resultId is the job ID in the format: action=evaluate&target=task&target_id=X
                // Use it directly with the evaluateJobs.get API
                const benchmarkJob = await core.agents.evaluateJobs.get(resultId);
                
                if (!benchmarkJob) {
                    setError('Benchmark result not found');
                    setLoading(false);
                    return;
                }
                
                // Transform API response to match our BenchmarkResult interface
                const transformedResult: BenchmarkResult = {
                    id: benchmarkJob.id,
                    status: benchmarkJob.status,
                    progress: benchmarkJob.progress || 0,
                    created_date: benchmarkJob.created_date,
                    started_date: benchmarkJob.started_at,
                    finished_date: benchmarkJob.finished_at || benchmarkJob.ended_at,
                    exc_info: benchmarkJob.exc_info,
                    result: benchmarkJob.result,
                    meta: {
                        task_id: benchmarkJob.meta?.task || benchmarkJob.meta?.task_id || 0,
                        job_id: benchmarkJob.meta?.job_id || benchmarkJob.id,
                        agent_id: benchmarkJob.meta?.id || benchmarkJob.meta?.agent_id || agentId || 'unknown',
                        user: {
                            id: benchmarkJob.meta?.user?.id || 1,
                            username: benchmarkJob.meta?.user?.username || 'unknown'
                        }
                    }
                };
                
                setBenchmarkResult(transformedResult);
                
                // Set agent information from agents store first, then fall back to API result
                const agentInfo = agents.find(a => a.id === transformedResult.meta.agent_id);
                setAgent({
                    id: transformedResult.meta.agent_id,
                    name: agentInfo?.name || transformedResult.result?.agent_name || 'Unknown Agent',
                    version: agentInfo?.version || transformedResult.result?.agent_version || '1.0.0'
                });

                // Fetch task information if available
                try {
                    if (transformedResult.meta.task_id) {
                        const [taskInfo] = await core.tasks.get({ id: transformedResult.meta.task_id });
                        setTask({
                            id: transformedResult.meta.task_id,
                            name: taskInfo?.name || transformedResult.result?.dataset_name || 'Unknown Task'
                        });
                    } else {
                        setTask({
                            id: 0,
                            name: transformedResult.result?.dataset_name || 'Unknown Task'
                        });
                    }
                } catch (taskError) {
                    console.warn('Could not fetch task information:', taskError);
                    setTask({
                        id: transformedResult.meta.task_id || 0,
                        name: transformedResult.result?.dataset_name || 'Unknown Task'
                    });
                }
                
            } catch (err) {
                console.error('Error loading benchmark result:', err);
                setError('Failed to load benchmark result. Please try again.');
            } finally {
                setLoading(false);
            }
        };

        loadBenchmarkResult();
    }, [agentId, location.search, core, agents]);

    if (loading) {
        return (
            <div style={{ padding: '20px', textAlign: 'center' }}>
                <Spin size="large" />
                <h2 style={{ marginTop: '16px' }}>Loading Benchmark Results...</h2>
            </div>
        );
    }

    if (error || !benchmarkResult) {
        return (
            <div style={{ padding: '20px', textAlign: 'center' }}>
                <h2>Error Loading Results</h2>
                <p>{error || 'Benchmark result not found'}</p>
                <Button onClick={() => history.push('/agents/benchmarks')}>
                    Back to Benchmarks
                </Button>
            </div>
        );
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'finished': return 'success';
            case 'started': return 'processing';
            case 'failed': return 'error';
            case 'pending': return 'default';
            case 'deferred': return 'warning';
            case 'canceled': return 'default';
            default: return 'default';
        }
    };

    const formatMetric = (value: number | undefined) => {
        return value ? (value * 100).toFixed(1) : '0.0';
    };

    const formatDuration = (seconds: number | undefined) => {
        if (!seconds) return '0s';
        if (seconds < 60) {
            return `${seconds.toFixed(1)}s`;
        }
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes}m ${remainingSeconds.toFixed(1)}s`;
    };

    const renderMetrics = () => {
        if (!benchmarkResult.result || !benchmarkResult.result.global_metrics) {
            return (
                <div style={{ textAlign: 'center', padding: '40px' }}>
                    <h3>No detailed metrics available</h3>
                    <p>This benchmark result doesn't contain detailed evaluation metrics.</p>
                </div>
            );
        }

        const globalMetrics = benchmarkResult.result.global_metrics;
        
        return (
            <>
                <Row gutter={[16, 16]}>
                    <Col xs={12} sm={6}>
                        <Statistic
                            title="Average Precision"
                            value={formatMetric(globalMetrics.average_precision)}
                            suffix="%"
                        />
                        <Progress
                            percent={parseFloat(formatMetric(globalMetrics.average_precision))}
                            showInfo={false}
                            strokeColor="#1890ff"
                        />
                    </Col>
                    <Col xs={12} sm={6}>
                        <Statistic
                            title="Average Recall"
                            value={formatMetric(globalMetrics.average_recall)}
                            suffix="%"
                        />
                        <Progress
                            percent={parseFloat(formatMetric(globalMetrics.average_recall))}
                            showInfo={false}
                            strokeColor="#52c41a"
                        />
                    </Col>
                    <Col xs={12} sm={6}>
                        <Statistic
                            title="Average F1"
                            value={formatMetric(globalMetrics.average_f1)}
                            suffix="%"
                        />
                        <Progress
                            percent={parseFloat(formatMetric(globalMetrics.average_f1))}
                            showInfo={false}
                            strokeColor="#faad14"
                        />
                    </Col>
                    <Col xs={12} sm={6}>
                        <Statistic
                            title="Mean IoU"
                            value={formatMetric(globalMetrics.mean_iou)}
                            suffix="%"
                        />
                        <Progress
                            percent={parseFloat(formatMetric(globalMetrics.mean_iou))}
                            showInfo={false}
                            strokeColor="#722ed1"
                        />
                    </Col>
                </Row>

                <Divider />

                <Row gutter={[16, 16]}>
                    <Col xs={24} sm={12}>
                        <Card size="small" title="Evaluation Summary">
                            <Row gutter={[8, 8]}>
                                <Col span={12}>
                                    <Statistic
                                        title="Processed Frames"
                                        value={benchmarkResult.result.processed_frames}
                                    />
                                </Col>
                                <Col span={12}>
                                    <Statistic
                                        title="Evaluation Time"
                                        value={formatDuration(benchmarkResult.result.evaluation_time_sec)}
                                    />
                                </Col>
                                <Col span={12}>
                                    <Statistic
                                        title="Task Type"
                                        value={benchmarkResult.result.task_type}
                                    />
                                </Col>
                                <Col span={12}>
                                    <Statistic
                                        title="Dataset"
                                        value={task?.name || benchmarkResult.result.dataset_name || 'Unknown Dataset'}
                                    />
                                </Col>
                            </Row>
                        </Card>
                    </Col>
                    <Col xs={24} sm={12}>
                        <Card size="small" title="Agent Information">
                            <Statistic
                                title="Agent Name"
                                value={agent?.name || benchmarkResult.result.agent_name || 'Unknown Agent'}
                            />
                            <Statistic
                                title="Agent Version"
                                value={agent?.version || benchmarkResult.result.agent_version || 'Unknown Version'}
                            />
                        </Card>
                    </Col>
                </Row>
            </>
        );
    };

    const perClassColumns = [
        {
            title: 'Class Name',
            dataIndex: 'class_name',
            key: 'class_name',
        },
        {
            title: 'Precision',
            dataIndex: 'precision',
            key: 'precision',
            render: (value: number) => `${formatMetric(value)}%`,
        },
        {
            title: 'Recall',
            dataIndex: 'recall',
            key: 'recall',
            render: (value: number) => `${formatMetric(value)}%`,
        },
        {
            title: 'F1 Score',
            dataIndex: 'f1',
            key: 'f1',
            render: (value: number) => `${formatMetric(value)}%`,
        },
        {
            title: 'IoU',
            dataIndex: 'iou',
            key: 'iou',
            render: (value: number) => `${formatMetric(value)}%`,
        },
        {
            title: 'AP@50',
            dataIndex: 'ap_50',
            key: 'ap_50',
            render: (value: number) => `${formatMetric(value)}%`,
        },
        {
            title: 'AP@75',
            dataIndex: 'ap_75',
            key: 'ap_75',
            render: (value: number) => `${formatMetric(value)}%`,
        },
        {
            title: 'AP@50-95',
            dataIndex: 'ap_50_95',
            key: 'ap_50_95',
            render: (value: number) => `${formatMetric(value)}%`,
        },
        {
            title: 'Detections',
            dataIndex: 'detections',
            key: 'detections',
        },
        {
            title: 'Ground Truths',
            dataIndex: 'ground_truths',
            key: 'ground_truths',
        },
    ];

    const frameMetricsColumns = [
        {
            title: 'Frame ID',
            dataIndex: 'frame_id',
            key: 'frame_id',
            sorter: (a: any, b: any) => a.frame_id - b.frame_id,
        },
        {
            title: 'Precision',
            dataIndex: 'precision',
            key: 'precision',
            render: (value: number) => `${formatMetric(value)}%`,
            sorter: (a: any, b: any) => a.precision - b.precision,
            defaultSortOrder: 'descend' as const,
        },
        {
            title: 'Recall',
            dataIndex: 'recall',
            key: 'recall',
            render: (value: number) => `${formatMetric(value)}%`,
            sorter: (a: any, b: any) => a.recall - b.recall,
        },
        {
            title: 'F1 Score',
            dataIndex: 'f1',
            key: 'f1',
            render: (value: number) => `${formatMetric(value)}%`,
            sorter: (a: any, b: any) => a.f1 - b.f1,
        },
        {
            title: 'Detections',
            dataIndex: 'detections',
            key: 'detections',
            sorter: (a: any, b: any) => a.detections - b.detections,
        },
        {
            title: 'Ground Truths',
            dataIndex: 'ground_truths',
            key: 'ground_truths',
            sorter: (a: any, b: any) => a.ground_truths - b.ground_truths,
        },
    ];

    return (
        <div className="agent-benchmark-results">
            <div className="agent-benchmark-header">
                <Breadcrumb>
                    <Breadcrumb.Item>
                        <Button
                            type="link"
                            icon={<ArrowLeftOutlined />}
                            onClick={() => history.push('/agents/benchmarks')}
                        >
                            Benchmarks
                        </Button>
                    </Breadcrumb.Item>
                    <Breadcrumb.Item>{agent?.name || benchmarkResult.result?.agent_name || 'Unknown Agent'}</Breadcrumb.Item>
                </Breadcrumb>

                <div className="header-content">
                    <Title level={2}>{agent?.name || benchmarkResult.result?.agent_name || 'Unknown Agent'} - Benchmark Results</Title>
                    <Text type="secondary">Job ID: {benchmarkResult.id}</Text>
                    <div style={{ marginTop: '8px', fontSize: '12px', color: '#666' }}>
                        Route: {location.pathname + location.search} | Agent: {agent?.name || benchmarkResult.result?.agent_name || 'Unknown Agent'} | Status: {benchmarkResult.status}
                    </div>
                </div>
            </div>

            <Row gutter={[16, 16]}>
                <Col xs={24}>
                    <Card
                        title={
                            <Space>
                                <BarChartOutlined />
                                Benchmark Evaluation Results
                                <Tag color={getStatusColor(benchmarkResult.status)}>
                                    {benchmarkResult.status.charAt(0).toUpperCase() + benchmarkResult.status.slice(1)}
                                </Tag>
                            </Space>
                        }
                        extra={
                            <Button icon={<DownloadOutlined />}>
                                Export Report
                            </Button>
                        }
                    >
                        <Tabs defaultActiveKey="overview">
                            <TabPane tab="Overview" key="overview">
                                {renderMetrics()}
                            </TabPane>

                            {benchmarkResult.result?.per_class_metrics && (
                                <TabPane tab="Per-Class Metrics" key="per-class">
                                    <Table
                                        columns={perClassColumns}
                                        dataSource={benchmarkResult.result.per_class_metrics}
                                        rowKey="class_name"
                                        pagination={false}
                                        size="small"
                                    />
                                </TabPane>
                            )}

                            {benchmarkResult.result?.frame_metrics && benchmarkResult.result.frame_metrics.length > 0 && (
                                <TabPane tab="Frame Metrics" key="frame-metrics">
                                    <Table
                                        columns={frameMetricsColumns}
                                        dataSource={benchmarkResult.result.frame_metrics}
                                        rowKey="frame_id"
                                        pagination={{ pageSize: 10 }}
                                        size="small"
                                    />
                                </TabPane>
                            )}

                            <TabPane tab="Charts" key="charts">
                                <div className="charts-placeholder">
                                    <LineChartOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />
                                    <Text type="secondary">
                                        Performance charts will be implemented with Chart.js or Ant Design Charts
                                    </Text>
                                </div>
                            </TabPane>
                        </Tabs>
                    </Card>
                </Col>
            </Row>
        </div>
    );
}

export default AgentBenchmarkResults;