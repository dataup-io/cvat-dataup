import React, { useMemo, useCallback } from 'react';
import { useHistory, useLocation } from 'react-router-dom';
import { Button, Breadcrumb, Typography, Space } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { getCore } from 'cvat-core-wrapper';
import BenchmarkImageOverlayViewer from './benchmark-image-overlay-viewer';

const { Text } = Typography;

// Transform backend prediction response to frontend format
// Backend format: { id, predictions: [{ frame_id, job_id, labels: [{ label, score, bbox: {x, y, width, height}, ... }] }] }
// Frontend format: { frame_id, label, xyxy: [x1, y1, x2, y2], confidence }
interface BackendPrediction {
    frame_id: number;
    job_id?: number;
    labels: Array<{
        label: string;
        score: number;
        bbox: {
            x: number;
            y: number;
            width: number;
            height: number;
        };
        polygon?: any;
        rle_mask?: string;
        attributes?: any[];
    }>;
}

interface BackendPredictionsResponse {
    id: string;
    predictions: BackendPrediction[];
}

interface FrontendPrediction {
    frame_id: number;
    label: string;
    xyxy: [number, number, number, number]; // [x1, y1, x2, y2]
    confidence?: number;
}

function transformBackendPredictions(backendResponse: BackendPredictionsResponse): FrontendPrediction[] {
    if (!backendResponse || !backendResponse.predictions || !Array.isArray(backendResponse.predictions)) {
        return [];
    }

    const transformed: FrontendPrediction[] = [];

    for (const framePrediction of backendResponse.predictions) {
        const frameId = framePrediction.frame_id;
        const labels = framePrediction.labels || [];

        for (const labelData of labels) {
            const bbox = labelData.bbox;
            if (!bbox || typeof bbox.x !== 'number' || typeof bbox.y !== 'number' ||
                typeof bbox.width !== 'number' || typeof bbox.height !== 'number') {
                continue; // Skip invalid bboxes
            }

            // Convert {x, y, width, height} to [x1, y1, x2, y2]
            const x1 = bbox.x;
            const y1 = bbox.y;
            const x2 = bbox.x + bbox.width;
            const y2 = bbox.y + bbox.height;

            transformed.push({
                frame_id: frameId,
                label: labelData.label || 'Unknown',
                xyxy: [x1, y1, x2, y2],
                confidence: labelData.score,
            });
        }
    }

    return transformed;
}

function BenchmarkVisualComparison(): JSX.Element {
    const history = useHistory();
    const location = useLocation();
    const core = useMemo(() => getCore(), []);

    // Extract params from pathname - memoized to avoid recalculation
    const { agentId, resultId, jobId, parsedJobId } = useMemo(() => {
        const pathMatch = location.pathname.match(/\/agents\/benchmarks\/([^/]+)\/visual\/([^/]+)(?:\/(\d+))?$/);
        const agentId = pathMatch?.[1];
        const resultId = pathMatch?.[2];
        const jobId = pathMatch?.[3];
        const parsedJobId = jobId ? parseInt(jobId, 10) : undefined;
        return { agentId, resultId, jobId, parsedJobId };
    }, [location.pathname]);


    // Validate required params
    if (!resultId || resultId === 'undefined') {
        return (
            <div style={{ padding: '20px', textAlign: 'center' }}>
                <Text type="danger">Invalid result ID in URL</Text>
                <Text type="secondary" style={{ display: 'block', marginTop: '8px' }}>
                    Pathname: {location.pathname}
                </Text>
                <div style={{ marginTop: '16px' }}>
                    <Button onClick={() => history.push('/agents/benchmarks')}>
                        Back to Benchmarks
                    </Button>
                </div>
            </div>
        );
    }

    // Load benchmark data to get predictions
    const [benchmarkData, setBenchmarkData] = React.useState<any>(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);

    React.useEffect(() => {
        let cancelled = false;

        const loadBenchmarkData = async () => {
            if (!resultId) return;

            try {
                setLoading(true);
                setError(null);

                // Try fetching as a submitted benchmark first, then fall back to evaluate job
                let benchmark: any = null;
                try {
                    benchmark = await core.agents.benchmarks.get(resultId);
                } catch (e) {
                    // Fallback to job if submitted benchmark not found
                    try {
                        benchmark = await core.agents.evaluateJobs.get(resultId);
                    } catch (e2) {
                        if (!cancelled) {
                            setError('Benchmark result not found');
                            setLoading(false);
                        }
                        return;
                    }
                }

                if (cancelled) return;

                // Normalize the response
                if (benchmark.result) {
                    setBenchmarkData(benchmark);
                } else {
                    // Handle case where data is at top level
                    setBenchmarkData(benchmark);
                }
            } catch (err) {
                if (!cancelled) {
                    setError('Failed to load benchmark data');
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        loadBenchmarkData();

        return () => {
            cancelled = true;
        };
    }, [resultId, core]);

    // Extract task ID from benchmark data - memoized
    const taskId = useMemo(() => {
        return benchmarkData?.dataset_id ||
               benchmarkData?.result?.dataset_id ||
               benchmarkData?.meta?.task_id ||
               benchmarkData?.meta?.task ||
               0;
    }, [benchmarkData]);

    // Fetch predictions from backend
    const [predictions, setPredictions] = React.useState<FrontendPrediction[]>([]);
    const [predictionsLoading, setPredictionsLoading] = React.useState(false);

    React.useEffect(() => {
        if (!resultId || !benchmarkData) return;

        let cancelled = false;

        const fetchPredictions = async () => {
            try {
                setPredictionsLoading(true);
                const backendResponse = await core.agents.benchmarks.fetchPredictions(resultId, parsedJobId);

                if (cancelled) return;

                const transformed = transformBackendPredictions(backendResponse);
                setPredictions(transformed);
            } catch (err) {
                if (!cancelled) {
                    // On error, set empty predictions array
                    setPredictions([]);
                }
            } finally {
                if (!cancelled) {
                    setPredictionsLoading(false);
                }
            }
        };

        fetchPredictions();

        return () => {
            cancelled = true;
        };
    }, [resultId, parsedJobId, benchmarkData, core]);

    // Memoize navigation callbacks
    const handleBackToBenchmarks = useCallback(() => {
        history.push('/agents/benchmarks');
    }, [history]);

    const handleBackToResults = useCallback(() => {
        if (agentId && resultId) {
            history.push(`/agents/benchmarks/${agentId}?resultId=${resultId}`);
        }
    }, [history, agentId, resultId]);

    if (loading) {
        return (
            <div style={{ padding: '20px', textAlign: 'center' }}>
                <Text>Loading benchmark data...</Text>
            </div>
        );
    }

    if (error || !benchmarkData) {
        return (
            <div style={{ padding: '20px', textAlign: 'center' }}>
                <Text type="danger">{error || 'Benchmark data not found'}</Text>
                <div style={{ marginTop: '16px' }}>
                    <Button onClick={handleBackToBenchmarks}>
                        Back to Benchmarks
                    </Button>
                </div>
            </div>
        );
    }

    if (!taskId || taskId === 0) {
        return (
            <div style={{ padding: '20px', textAlign: 'center' }}>
                <Text type="danger">Task ID not available for this benchmark</Text>
                <div style={{ marginTop: '16px' }}>
                    <Button onClick={handleBackToResults}>
                        Back to Benchmark Results
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div style={{ padding: '12px', height: '100vh', display: 'flex', flexDirection: 'column' }}>
            <Breadcrumb style={{ marginBottom: '8px', flexShrink: 0 }}>
                <Breadcrumb.Item>
                    <Button
                        type="link"
                        icon={<ArrowLeftOutlined />}
                        onClick={handleBackToBenchmarks}
                        style={{ padding: 0 }}
                    >
                        Benchmarks
                    </Button>
                </Breadcrumb.Item>
                <Breadcrumb.Item>
                    <Button
                        type="link"
                        onClick={handleBackToResults}
                        style={{ padding: 0 }}
                    >
                        Benchmark Results
                    </Button>
                </Breadcrumb.Item>
                <Breadcrumb.Item>
                    {parsedJobId ? `Visual Comparison - Job #${parsedJobId}` : 'Visual Comparison'}
                </Breadcrumb.Item>
            </Breadcrumb>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                <BenchmarkImageOverlayViewer
                    benchmarkId={resultId}
                    taskId={taskId}
                    jobId={parsedJobId}
                    predictions={predictions}
                />
            </div>
        </div>
    );
}

export default BenchmarkVisualComparison;

