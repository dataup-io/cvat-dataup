import React, { useState, useEffect } from 'react';
import { useHistory } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
    Card,
    Row,
    Col,
    Table,
    Button,
    Input,
    Select,
    DatePicker,
    Statistic,
    Tag,
    Space,
    Typography,
    Modal,
    Form,
    message,
    Progress,
    Divider,
    InputNumber,
} from 'antd';
import {
    BarChartOutlined,
    EyeOutlined,
    SearchOutlined,
    FilterOutlined,
    PlayCircleOutlined,
    SyncOutlined,
    DeleteOutlined,
    SendOutlined,
} from '@ant-design/icons';
import { CombinedState } from 'reducers';
import { runBenchmarkAsync, getAgentsAsync } from 'actions/agent-actions';
import { getTasksAsync } from 'actions/tasks-actions';
import { getCore } from 'cvat-core-wrapper';
import LabelsMapperComponent, { FullMapping, LabelInterface } from 'components/model-runner-modal/labels-mapper';
import './styles.scss';
import Badge from 'antd/lib/badge';
import { CheckCircleFilled, CloseCircleFilled } from '@ant-design/icons';

const { Title } = Typography;
const { RangePicker } = DatePicker;

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
    support: number;
}

interface JobMetric {
    job_id: number;
    precision: number;
    recall: number;
    f1: number;
    detections: number;
    ground_truths: number;
    true_positives: number;
    false_positives: number;
    false_negatives: number;
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
    dataset_id?: number;
    processed_frames: number;
    global_metrics: GlobalMetrics;
    per_class_metrics: PerClassMetric[];
    job_metrics: JobMetric[];
    // Optional attribute metrics per attribute key
    attribute_metrics?: Array<{ [key: string]: any }>;
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
    submitted?: boolean; // whether saved to external benchmark service
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


function BenchmarkDashboard(): JSX.Element {
    const history = useHistory();
    const dispatch = useDispatch();
    const [results, setResults] = useState<BenchmarkResult[]>([]);
    const [filteredResults, setFilteredResults] = useState<BenchmarkResult[]>([]);
    const [searchText, setSearchText] = useState('');
    const [selectedAgent, setSelectedAgent] = useState<string>('');
    const [selectedStatus, setSelectedStatus] = useState<string>('');
    const [dateRange, setDateRange] = useState<[moment.Moment, moment.Moment] | null>(null);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [isPolling, setIsPolling] = useState(false);
    const [isStartingBenchmark, setIsStartingBenchmark] = useState(false);
    const [retryCount, setRetryCount] = useState<{[key: string]: number}>({});
    const [activePollingJobs, setActivePollingJobs] = useState<Set<string>>(new Set());
    const [labelMapping, setLabelMapping] = useState<FullMapping>([]);
    const [selectedAgentData, setSelectedAgentData] = useState<any>(null);
    const [selectedTaskData, setSelectedTaskData] = useState<any>(null);
    const [isLoadingTaskLabels, setIsLoadingTaskLabels] = useState<boolean>(false);
    const [threshold, setThreshold] = useState<number>(0.5);
    const MAX_RETRY_ATTEMPTS = 3;
    const RETRY_DELAY = 2000; // 2 seconds
    const [form] = Form.useForm();

    // Function to compute automatic label mapping based on name matching
    const computeAutoMapping = (modelLabels: LabelInterface[], taskLabels: LabelInterface[]): FullMapping => {
        const autoMapping: FullMapping = [];
        for (const modelLabel of modelLabels) {
            for (const taskLabel of taskLabels) {
                if (modelLabel.name === taskLabel.name) {
                    // Create a full mapping entry: [modelLabel, taskLabel, attributesMapping, childMapping]
                    autoMapping.push([modelLabel, taskLabel, [], []]);
                    break; // Only map to the first matching task label
                }
            }
        }
        return autoMapping;
    };

    // Function to apply automatic mapping
    const handleAutoMapping = () => {
        if (selectedAgentData?.labels && selectedTaskData?.labels) {
            const autoMapping = computeAutoMapping(selectedAgentData.labels, selectedTaskData.labels);
            setLabelMapping(autoMapping);
            message.success(`Automatically mapped ${autoMapping.length} labels based on name matching`);
        } else {
            message.warning('Please select both an agent and a task first');
        }
    };

    // Function to fetch complete task data with labels
    const fetchTaskWithLabels = async (taskId: number) => {
        setIsLoadingTaskLabels(true);
        try {
            const core = getCore();
            const [task] = await core.tasks.get({ id: taskId });
            // Labels are already included when fetching task by ID
            return task;
        } catch (error) {
            console.error('Failed to fetch task labels:', error);
            message.error('Failed to load task labels. Please try again.');
            return null;
        } finally {
            setIsLoadingTaskLabels(false);
        }
    };

    // Helper function for retrying API calls
    const retryApiCall = async (
        apiCall: () => Promise<any>,
        jobId: string,
        maxRetries: number = MAX_RETRY_ATTEMPTS
    ): Promise<any | null> => {
        const currentRetries = retryCount[jobId] || 0;

        try {
            const result = await apiCall();
            // Reset retry count on success
            if (currentRetries > 0) {
                setRetryCount(prev => ({ ...prev, [jobId]: 0 }));
            }
            return result;
        } catch (error) {
            if (currentRetries < maxRetries) {
                console.warn(`API call failed for job ${jobId}, retrying... (${currentRetries + 1}/${maxRetries})`);
                setRetryCount(prev => ({ ...prev, [jobId]: currentRetries + 1 }));

                // Wait before retrying
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
                return retryApiCall(apiCall, jobId, maxRetries);
            } else {
                console.error(`API call failed for job ${jobId} after ${maxRetries} retries:`, error);
                // Reset retry count after max attempts
                setRetryCount(prev => ({ ...prev, [jobId]: 0 }));
                return null;
            }
        }
    };

    // Start polling for a specific benchmark job (similar to auto annotation)
    const startBenchmarkPolling = (jobId: string) => {
        // Avoid duplicate polling for the same job
        if (activePollingJobs.has(jobId)) {
            return;
        }

        setActivePollingJobs(prev => new Set(prev).add(jobId));
        setIsPolling(true);

        const pollInterval = setInterval(async () => {
            try {
                const core = getCore();
                const jobInfo = await core.agents.evaluateJobs.get(jobId);

                if (!jobInfo) {
                    console.warn(`No job info found for job ${jobId}`);
                    return;
                }

                const progress = (jobInfo as any).progress ?? 0;
                const progressPercent = typeof progress === 'number' ? Math.max(0, Math.min(100, progress)) : 0;

                // Update the specific result in the state
                setResults(prevResults =>
                    prevResults.map(result => {
                        if (result.id === jobId) {
                            return {
                                ...result,
                                status: jobInfo.status as any,
                                progress: progressPercent,
                                started_date: jobInfo.started_at || result.started_date,
                                finished_date: jobInfo.ended_at || result.finished_date,
                                exc_info: jobInfo.exc_info || result.exc_info,
                                result: jobInfo.status === 'finished' ? (jobInfo as any).result || result.result : result.result
                            };
                        }
                        return result;
                    })
                );

                // Stop polling if job is finished or failed
                if (jobInfo.status === 'finished' || jobInfo.status === 'failed') {
                    clearInterval(pollInterval);
                    setActivePollingJobs(prev => {
                        const newSet = new Set(prev);
                        newSet.delete(jobId);
                        return newSet;
                    });

                    // Stop global polling indicator if no more active jobs
                    if (activePollingJobs.size <= 1) { // Will be 0 after deletion
                        setIsPolling(false);
                    }

                    if (jobInfo.status === 'finished') {
                        message.success(`Benchmark ${jobId} completed successfully!`);
                    } else if (jobInfo.status === 'failed') {
                        message.error(`Benchmark ${jobId} failed: ${jobInfo.exc_info || 'Unknown error'}`);
                    }
                }
            } catch (error) {
                console.error(`Failed to poll benchmark status for job ${jobId}:`, error);
                // Don't stop polling on error, just log it
            }
        }, 2000); // Poll every 2 seconds (same as auto annotation)

        // Set timeout to stop polling after 10 minutes (same as auto annotation)
        setTimeout(() => {
            clearInterval(pollInterval);
            setActivePollingJobs(prev => {
                const newSet = new Set(prev);
                newSet.delete(jobId);
                return newSet;
            });

            if (activePollingJobs.size <= 1) {
                setIsPolling(false);
            }
        }, 600000); // 10 minutes
    };
    const agents = useSelector((state: CombinedState) => state.agents.current);
    const tasks = useSelector((state: CombinedState) => state.tasks.current);
    const isRunningBenchmark = useSelector((state: any) => state.agents.fetching);

    // Calculate overview statistics
    const totalResults = results.length;
    const avgScore = totalResults > 0 ? results.reduce((sum, result) => {
        return sum + (result.result?.global_metrics?.average_f1 || 0);
    }, 0) / totalResults * 100 : 0;
    const completedResults = results.filter(result => result.status === 'finished').length;
    const runningResults = results.filter(result => result.status === 'started').length;

    // Load benchmark results from API
    useEffect(() => {
        const loadBenchmarkResults = async () => {
            try {
                const core = getCore();
                // Load evaluate jobs (runtime results)
                const benchmarkJobs = await core.agents.evaluateJobs.list();
                // Load saved benchmarks (submitted)
                let savedBenchmarks: any[] = [];
                try {
                    const res = await core.agents.benchmarks.list();
                    if (Array.isArray(res)) {
                        savedBenchmarks = res;
                    }
                } catch (e) {
                    // Non-blocking: if listing saved benchmarks fails, continue with jobs only
                    console.warn('Failed to load saved benchmarks list:', e);
                }

                if (benchmarkJobs && Array.isArray(benchmarkJobs)) {
                    // Transform API response to match our BenchmarkResult interface
                    const transformedResults: BenchmarkResult[] = benchmarkJobs.map((job: any) => ({
                        id: job.id,
                        status: job.status,
                        progress: job.progress || 0,
                        created_date: job.created_date,
                        started_date: job.started_at,
                        finished_date: job.finished_at || job.ended_at,
                        exc_info: job.exc_info,
                        result: job.result,
                        meta: {
                            task_id: job.meta?.task || job.meta?.task_id || 0,
                            job_id: job.meta?.job_id || job.id,
                            agent_id: job.meta?.id || job.meta?.agent_id || 'unknown',
                            user: {
                                id: job.meta?.user?.id || 1,
                                username: job.meta?.user?.username || 'unknown'
                            }
                        },
                        submitted: false,
                    }));

                    // Merge in saved benchmarks. Saved benchmarks may have different shape; normalize.
                    const savedTransformed: BenchmarkResult[] = savedBenchmarks.map((bm: any) => {
                        const resultPayload = bm.result || {
                            agent_name: bm.agent_name || '',
                            agent_version: bm.agent_version,
                            task_type: bm.task_type,
                            dataset_id: bm.dataset_id,
                            processed_frames: bm.processed_frames,
                            global_metrics: bm.global_metrics,
                            job_metrics: bm.job_metrics,
                            per_class_metrics: bm.per_class_metrics,
                            attribute_metrics: bm.attribute_metrics || [],
                        };

                        return {
                            id: bm.id,
                            status: bm.status || 'finished',
                            progress: bm.progress ?? 100,
                            created_date: bm.created_at || bm.created_date || null,
                            started_date: bm.started_at || null,
                            finished_date: bm.finished_at || bm.ended_at || null,
                            exc_info: bm.exc_info || null,
                            result: resultPayload,
                            meta: {
                                task_id: (bm.dataset_id ?? resultPayload?.dataset_id ?? 0),
                                job_id: bm.meta?.job_id || bm.id,
                                agent_id: bm.agent_id || bm.meta?.agent_id || resultPayload?.agent_id || 'unknown',
                                user: {
                                    id: 0,
                                    username: 'unknown',
                                },
                            },
                            submitted: true,
                        };
                    });

                    // Combine by id: prefer job record, mark submitted true if exists in saved list
                    const savedIds = new Set(savedTransformed.map((r) => String(r.id)));
                    const merged = transformedResults.map((r) => ({
                        ...r,
                        submitted: savedIds.has(String(r.id)) || r.submitted,
                    }));

                    // Include saved entries that might not have corresponding runtime job (historical)
                    const missingSaved = savedTransformed.filter((r) => !merged.find((m) => String(m.id) === String(r.id)));

                    setResults([...merged, ...missingSaved]);

                    // Start polling for any running jobs
                    transformedResults.forEach(result => {
                        if (result.status === 'started' || result.status === 'pending') {
                            startBenchmarkPolling(result.id);
                        }
                    });
                } else {
                    console.warn('No benchmark results found or invalid response format');
                    setResults([]);
                }
            } catch (error) {
                console.error('Failed to load benchmark results:', error);
                message.error('Failed to load benchmark results. Please try again.');
                // Fallback to empty results
                setResults([]);
            }
        };

        loadBenchmarkResults();
    }, []);

    // Filter results based on search and filters
    // Fetch agents and tasks on component mount
    useEffect(() => {
        dispatch(getAgentsAsync());
        // Fetch all tasks by setting a large pageSize to avoid pagination limits
        dispatch(getTasksAsync({
            page: 1,
            pageSize: 1000 // Large page size to fetch all tasks
        }));
    }, [dispatch]);

    useEffect(() => {
        let filtered = [...results];

        if (searchText) {
            filtered = filtered.filter(result => {
                const task = tasks.find((t: any) => t.id === result.meta.task_id);
                const datasetText = (task?.name
                    || (result.result?.dataset_id ? `Task #${result.result.dataset_id}` : (result.meta?.task_id ? `Task #${result.meta.task_id}` : ''))
                    || '').toLowerCase();
                const agentText = (
                    (agents.find((a: any) => a.id === result.meta.agent_id)?.name)
                    || result.result?.agent_name
                    || result.meta.agent_id
                    || ''
                ).toLowerCase();
                const query = searchText.toLowerCase();
                return agentText.includes(query) || datasetText.includes(query);
            });
        }

        if (selectedAgent) {
            filtered = filtered.filter(result => result.meta.agent_id === selectedAgent);
        }

        if (selectedStatus) {
            filtered = filtered.filter(result => result.status === selectedStatus);
        }

        setFilteredResults(filtered);
    }, [results, searchText, selectedAgent, selectedStatus]);



    // Convert label mapping to server format (similar to automatic annotation)
     const convertMappingToServer = (mapping: FullMapping) => {
         if (!mapping || mapping.length === 0) {
             return {};
         }

         const serverMapping: any = {};
         mapping.forEach(([modelLabel, taskLabel, attributesMapping, sublabelsMapping]) => {
             if (modelLabel && taskLabel) {
                 serverMapping[modelLabel.name] = {
                     name: taskLabel.name,
                     attributes: {},
                 };

                 // Handle sublabels recursively if they exist
                 if (sublabelsMapping && sublabelsMapping.length > 0) {
                     const sublabelsServerMapping = convertMappingToServer(sublabelsMapping);
                     if (Object.keys(sublabelsServerMapping).length > 0) {
                         serverMapping[modelLabel.name].sublabels = sublabelsServerMapping;
                     }
                 }
             }
         });

         return serverMapping;
     };

    // Handle running benchmark
    const handleRunBenchmark = async (values: { agentId: string; taskId: number; threshold?: number; prompt?: string }) => {
        setIsStartingBenchmark(true);
        try {
            const core = getCore();

            // Prepare the body with label mapping if available
            const body: any = {
                agent_id: values.agentId,
                task_id: values.taskId,
            };

            // Add threshold if provided (from local state to keep in sync with UI)
            if (threshold !== undefined) {
                body.threshold = threshold;
            }

            // Add prompt if provided
            const trimmedPrompt = (values.prompt || '').trim();
            if (trimmedPrompt) {
                body.prompt = trimmedPrompt;
            }

            // Add label mapping if it exists
            if (labelMapping && labelMapping.length > 0) {
                body.mapping = convertMappingToServer(labelMapping);
            }

            const jobResult = await core.agents.evaluateJobs.create(body);

            if (jobResult && jobResult.id) {
                message.success('Benchmark started successfully!');
                setIsModalVisible(false);
                form.resetFields();

                // Add a new pending result to the table with the real job ID
                const newResult: BenchmarkResult = {
                    id: jobResult.id,
                    meta: {
                        task_id: values.taskId,
                        job_id: jobResult.id,
                        agent_id: values.agentId,
                        user: {
                            id: 1, // Placeholder, should be current user
                            username: 'current_user', // Placeholder
                        },
                    },
                    status: jobResult.status || 'started',
                    progress: jobResult.progress || 0,
                    created_date: jobResult.created_date || new Date().toISOString(),
                    started_date: jobResult.started_date || new Date().toISOString(),
                    finished_date: jobResult.finished_date || null,
                    exc_info: jobResult.exc_info || null,
                    result: jobResult.result || null,
                };
                setResults(prev => [newResult, ...prev]);

                // Start polling for this specific job immediately
                startBenchmarkPolling(jobResult.id);
            } else {
                throw new Error('Invalid response from benchmark API');
            }
        } catch (error) {
            console.error('Failed to start benchmark:', error);
            message.error(`Failed to start benchmark: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setIsStartingBenchmark(false);
        }
    };

    const getUniqueAgents = () => {
        const agents = results.map(result => ({ id: result.meta.agent_id, name: result.result?.agent_name || 'Unknown' }));
        return agents.filter((agent, index, self) =>
            index === self.findIndex(a => a.id === agent.id)
        );
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'finished': return 'success';
        case 'started': return 'processing';
        case 'failed': return 'error';
            default: return 'default';
        }
    };

    const handleDeleteBenchmark = (record: BenchmarkResult) => {
        Modal.confirm({
            title: 'Delete Benchmark Result',
            content: `Are you sure you want to delete the benchmark result for "${record.result?.agent_name || 'Unknown Agent'}"? This action cannot be undone.`,
            okText: 'Delete',
            okType: 'danger',
            cancelText: 'Cancel',
            onOk: async () => {
                try {
                    const core = getCore();
                    // Delete only from saved benchmarks if it is submitted; runtime job cancellation uses agentEvaluateJobs.cancel
                    if (record.submitted) {
                        await core.agents.benchmarks.delete(record.id);
                        message.success('Saved benchmark deleted successfully');
                        setResults((prev) => prev.filter((r) => String(r.id) !== String(record.id)));
                    } else {
                        await core.agents.evaluateJobs.cancel(record.id);
                        message.success('Benchmark job canceled');
                        setResults((prev) => prev.map((r) => (String(r.id) === String(record.id) ? { ...r, status: 'canceled' } : r)));
                    }
                } catch (error) {
                    console.error('Failed to delete benchmark result:', error);
                    message.error('Failed to delete benchmark result');
                }
            },
        });
    };

    const handleSubmitBenchmark = async (record: BenchmarkResult) => {
        try {
            const core = getCore();
            if (record.submitted) {
                message.info('Benchmark already submitted');
                return;
            }

            if (record.status !== 'finished' || !record.result) {
                message.warning('Only finished benchmarks with results can be submitted');
                return;
            }

            // Backend now builds the payload from RQ results, we only need to send evaluate_job_id and agent_id
            const payload = {
                evaluate_job_id: record.id,
                agent_id: record.meta.agent_id,
            };

            const created = await core.agents.benchmarks.create(payload);
            if (created && created.id) {
                message.success('Benchmark submitted successfully');
                // Update the result with the new benchmark UUID and mark as submitted
                setResults((prev) => prev.map((r) => {
                    if (String(r.id) === String(record.id)) {
                        return {
                            ...r,
                            id: created.id, // Update with new benchmark UUID
                            submitted: true,
                            // Update created_date if available from backend
                            created_date: created.created_at || r.created_date,
                        };
                    }
                    return r;
                }));
            } else {
                message.warning('Submission completed but returned unexpected response');
            }
        } catch (error) {
            console.error('Failed to submit benchmark result:', error);
            message.error('Failed to submit benchmark result');
        }
    };

    const columns = [
        {
            title: 'Agent',
            key: 'agentName',
            render: (record: BenchmarkResult) => {
                const agent = agents.find(a => a.id === record.meta.agent_id);
                return agent?.name || record.result?.agent_name || record.meta.agent_id || 'N/A';
            },
            sorter: (a: BenchmarkResult, b: BenchmarkResult) => {
                const agentA = agents.find(agent => agent.id === a.meta.agent_id);
                const agentB = agents.find(agent => agent.id === b.meta.agent_id);
                const nameA = agentA?.name || a.result?.agent_name || a.meta.agent_id || '';
                const nameB = agentB?.name || b.result?.agent_name || b.meta.agent_id || '';
                return nameA.localeCompare(nameB);
            },
        },
        {
            title: 'Dataset',
            key: 'dataset',
            render: (record: BenchmarkResult) => {
                const task = tasks.find((t: any) => t.id === record.meta.task_id);
                if (task?.name) return task.name;
                if (record.result?.dataset_id) return `Task #${record.result.dataset_id}`;
                if (record.meta?.task_id) return `Task #${record.meta.task_id}`;
                return 'N/A';
            },
            sorter: (a: BenchmarkResult, b: BenchmarkResult) => {
                const taskA = tasks.find((t: any) => t.id === a.meta.task_id);
                const taskB = tasks.find((t: any) => t.id === b.meta.task_id);
                const nameA = taskA?.name || (a.result?.dataset_id ? `Task #${a.result.dataset_id}` : (a.meta?.task_id ? `Task #${a.meta.task_id}` : ''));
                const nameB = taskB?.name || (b.result?.dataset_id ? `Task #${b.result.dataset_id}` : (b.meta?.task_id ? `Task #${b.meta.task_id}` : ''));
                return nameA.localeCompare(nameB);
            },
        },
        {
            title: 'Precision',
            key: 'precision',
            render: (record: BenchmarkResult) =>
                record.result?.global_metrics?.average_precision != null
                    ? `${(record.result.global_metrics.average_precision * 100).toFixed(1)}%`
                    : 'N/A',
            sorter: (a: BenchmarkResult, b: BenchmarkResult) =>
                (a.result?.global_metrics?.average_precision || 0) - (b.result?.global_metrics?.average_precision || 0),
        },
        {
            title: 'Recall',
            key: 'recall',
            render: (record: BenchmarkResult) =>
                record.result?.global_metrics?.average_recall != null
                    ? `${(record.result.global_metrics.average_recall * 100).toFixed(1)}%`
                    : 'N/A',
            sorter: (a: BenchmarkResult, b: BenchmarkResult) =>
                (a.result?.global_metrics?.average_recall || 0) - (b.result?.global_metrics?.average_recall || 0),
        },
        {
            title: 'F1 Score',
            key: 'f1Score',
            render: (record: BenchmarkResult) =>
                record.result?.global_metrics?.average_f1 != null
                    ? `${(record.result.global_metrics.average_f1 * 100).toFixed(1)}%`
                    : 'N/A',
            sorter: (a: BenchmarkResult, b: BenchmarkResult) =>
                (a.result?.global_metrics?.average_f1 || 0) - (b.result?.global_metrics?.average_f1 || 0),
        },
        {
            title: 'Status',
            dataIndex: 'status',
            key: 'status',
            render: (status: string) => (
                <Tag color={getStatusColor(status)}>
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                </Tag>
            ),
            filters: [
                { text: 'Finished', value: 'finished' },
                { text: 'Started', value: 'started' },
                { text: 'Failed', value: 'failed' },
                { text: 'Pending', value: 'pending' },
                { text: 'Canceled', value: 'canceled' },
            ],
            onFilter: (value: any, record: BenchmarkResult) => record.status === value,
        },
        {
            title: 'Submitted',
            key: 'submitted',
            render: (record: BenchmarkResult) => (
                record.submitted ? (
                    <CustomCheckIcon />
                ) : (
                    <CustomCrossIcon />
                )
            ),
            filters: [
                { text: 'Submitted', value: true },
                { text: 'Not Submitted', value: false },
            ],
            onFilter: (value: any, record: BenchmarkResult) => Boolean(record.submitted) === Boolean(value),
        },
        {
            title: 'Progress',
            key: 'progress',
            render: (record: BenchmarkResult) => {
                if (record.status === 'started' || record.status === 'pending') {
                    return (
                        <Progress
                            percent={record.progress}
                            size="small"
                            status={record.status === 'started' ? 'active' : 'normal'}
                        />
                    );
                }
                return record.status === 'finished' ? '100%' : '-';
            },
        },
        {
            title: 'Date',
            key: 'createdAt',
            render: (record: BenchmarkResult) =>
                record.created_date ? new Date(record.created_date).toLocaleDateString() : 'N/A',
            sorter: (a: BenchmarkResult, b: BenchmarkResult) => {
                const dateA = a.created_date ? new Date(a.created_date).getTime() : 0;
                const dateB = b.created_date ? new Date(b.created_date).getTime() : 0;
                return dateA - dateB;
            },
        },
        {
            title: 'Actions',
            key: 'actions',
            width: 150,
            render: (_: any, record: BenchmarkResult) => (
                <div className='cvat-benchmark-table-action-icons'>
                    <Button
                        type="link"
                        icon={<EyeOutlined />}
                        onClick={() => history.push(`/agents/benchmarks/${record.meta.agent_id}?resultId=${encodeURIComponent(record.id)}`)}
                        aria-label={`View details for ${record.result?.agent_name || 'benchmark'}`}
                        title="View benchmark details"
                    />
                    <Button
                        type="link"
                        icon={<SendOutlined />}
                        onClick={() => handleSubmitBenchmark(record)}
                        disabled={record.status !== 'finished'}
                        aria-label={`Submit ${record.result?.agent_name || 'benchmark'} to external service`}
                        title={record.status !== 'finished' ? 'Can only submit finished benchmarks' : 'Submit to external service'}
                    />
                    <Button
                        type="link"
                        icon={<DeleteOutlined />}
                        onClick={() => handleDeleteBenchmark(record)}
                        aria-label={`Delete ${record.result?.agent_name || 'benchmark'} result`}
                        title="Delete benchmark result"
                        danger
                    />
                </div>
            ),
        },
        // Removed redundant View column; actions already include a view
    ];

    return (
        <div className="benchmark-dashboard">
            <div className="benchmark-dashboard-header">
                <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                    <Col span={16}>
                        <Title level={2} style={{ margin: 0 }}>
                            <BarChartOutlined /> Agent Benchmark
                        </Title>
                        {isPolling && (
                            <div style={{ marginTop: 8 }}>
                                <Tag color="blue" icon={<SyncOutlined spin />}>
                                    Polling for updates...
                                </Tag>
                            </div>
                        )}
                    </Col>
                    <Col span={8} style={{ textAlign: 'right' }}>
                        <Button
                            type="primary"
                            icon={<PlayCircleOutlined />}
                            onClick={() => setIsModalVisible(true)}
                            loading={isStartingBenchmark || isRunningBenchmark}
                            size="large"
                        >
                            Run Benchmark
                        </Button>
                    </Col>
                </Row>
            </div>

            {/* Overview Cards */}
            <Row gutter={[16, 16]} className="benchmark-overview">
                <Col xs={24} sm={12} md={6}>
                    <Card>
                        <Statistic
                            title="Total Evaluations"
                            value={totalResults}
                            prefix={<BarChartOutlined />}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={12} md={6}>
                    <Card>
                        <Statistic
                            title="Average Score"
                            value={avgScore}
                            precision={1}
                            suffix="%"
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={12} md={6}>
                    <Card>
                        <Statistic
                            title="Completed"
                            value={completedResults}
                            valueStyle={{ color: '#3f8600' }}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={12} md={6}>
                    <Card>
                        <Statistic
                            title="Running"
                            value={runningResults}
                            valueStyle={{ color: '#1890ff' }}
                        />
                    </Card>
                </Col>
            </Row>

            {/* Filters */}
            <Card className="benchmark-filters">
                <Row gutter={[16, 16]} align="middle">
                    <Col xs={24} sm={12} md={8}>
                        <Input
                            placeholder="Search agents or tasks..."
                            prefix={<SearchOutlined />}
                            value={searchText}
                            onChange={(e) => setSearchText(e.target.value)}
                            allowClear
                        />
                    </Col>
                    <Col xs={24} sm={12} md={6}>
                        <Select
                            placeholder="Filter by Agent"
                            value={selectedAgent}
                            onChange={setSelectedAgent}
                            allowClear
                            style={{ width: '100%' }}
                        >
                            {getUniqueAgents().map(agent => (
                                <Select.Option key={agent.id} value={agent.id}>
                                    {agent.name}
                                </Select.Option>
                            ))}
                        </Select>
                    </Col>
                    <Col xs={24} sm={12} md={6}>
                        <Select
                            placeholder="Filter by Status"
                            value={selectedStatus}
                            onChange={setSelectedStatus}
                            allowClear
                            style={{ width: '100%' }}
                        >
                            <Select.Option value="finished">Finished</Select.Option>
                            <Select.Option value="started">Started</Select.Option>
                            <Select.Option value="failed">Failed</Select.Option>
                            <Select.Option value="pending">Pending</Select.Option>
                            <Select.Option value="canceled">Canceled</Select.Option>
                        </Select>
                    </Col>
                    <Col xs={24} sm={12} md={4}>
                        <RangePicker style={{ width: '100%' }} />
                    </Col>
                </Row>
            </Card>

            {/* Results Table */}
            <Card className="benchmark-results">
                <Table
                    columns={columns}
                    dataSource={filteredResults}
                    rowKey="id"
                    pagination={{
                        pageSize: 10,
                        showSizeChanger: true,
                        showQuickJumper: true,
                        showTotal: (total, range) =>
                            `${range[0]}-${range[1]} of ${total} results`,
                    }}
                />
            </Card>

            {/* Run Benchmark Modal */}
            <Modal
                title="Run Benchmark"
                open={isModalVisible}
                onCancel={() => {
                    setIsModalVisible(false);
                    form.resetFields();
                }}
                footer={null}
                width={600}
            >
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleRunBenchmark}
                >
                    <Form.Item
                        name="agentId"
                        label="Select Agent"
                        rules={[{ required: true, message: 'Please select an agent' }]}
                    >
                        <Select
                            placeholder="Choose an agent to benchmark"
                            showSearch
                            optionFilterProp="children"
                            onChange={(value) => {
                                const agent = agents.find((a: any) => a.id === value);
                                setSelectedAgentData(agent || null);
                            }}
                        >
                            {agents.map((agent: any) => (
                                <Select.Option key={agent.id} value={agent.id}>
                                    {agent.name} (v{agent.version})
                                </Select.Option>
                            ))}
                        </Select>
                    </Form.Item>

                    <Form.Item
                        name="taskId"
                        label="Select Task"
                        rules={[{ required: true, message: 'Please select a task' }]}
                    >
                        <Select
                            placeholder="Choose a task for benchmarking"
                            showSearch
                            optionFilterProp="children"
                            loading={isLoadingTaskLabels}
                            onChange={async (value) => {
                                const basicTask = tasks.find((t: any) => t.id === value);
                                if (basicTask) {
                                    // Fetch complete task data with labels
                                    const completeTask = await fetchTaskWithLabels(value);
                                    setSelectedTaskData(completeTask || basicTask);
                                } else {
                                    setSelectedTaskData(null);
                                }
                            }}
                        >
                            {tasks.map((task: any) => (
                                <Select.Option key={task.id} value={task.id}>
                                    {task.name} - {task.subset}
                                </Select.Option>
                            ))}
                        </Select>
                    </Form.Item>

                    <Form.Item
                        name="threshold"
                        label="Detection Threshold"
                        initialValue={threshold}
                        tooltip="Confidence threshold for object detection (0.0 - 1.0)"
                    >
                        <InputNumber
                            min={0}
                            max={1}
                            step={0.1}
                            precision={2}
                            placeholder="0.5"
                            style={{ width: '100%' }}
                            onChange={(value) => setThreshold(value || 0.5)}
                        />
                    </Form.Item>

                    <Form.Item
                        name="prompt"
                        label="Prompt (optional)"
                        tooltip="Optional text prompt sent to the detector during benchmarking (if supported by the model)"
                        style={{ marginBottom: 16 }}
                    >
                        <Input.TextArea
                            autoSize={{ minRows: 1, maxRows: 2 }}
                            placeholder="Optional prompt for the detector (e.g. focus on small objects, ignore background, etc.)"
                        />
                    </Form.Item>

                    {/* Label Mapping Section */}
                    {selectedAgentData && selectedTaskData && (
                        <>
                            <Divider>
                                <Space>
                                    Label Mapping
                                    <Button
                                        type="link"
                                        size="small"
                                        onClick={handleAutoMapping}
                                        style={{ padding: 0 }}
                                    >
                                        Auto Map by Name
                                    </Button>
                                </Space>
                            </Divider>
                            <LabelsMapperComponent
                                 modelLabels={selectedAgentData?.labels || []}
                                 taskLabels={selectedTaskData?.labels || []}
                                 onUpdateMapping={setLabelMapping}
                                 initialMapping={labelMapping}
                             />
                        </>
                    )}

                    <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
                        <Space>
                            <Button
                                onClick={() => {
                                     setIsModalVisible(false);
                                     form.resetFields();
                                     setLabelMapping([]);
                                     setSelectedAgentData(null);
                                     setSelectedTaskData(null);
                                     setIsLoadingTaskLabels(false);
                                 }}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="primary"
                                htmlType="submit"
                                loading={isStartingBenchmark}
                                icon={<PlayCircleOutlined />}
                            >
                                Start Benchmark
                            </Button>
                        </Space>
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
}

export default BenchmarkDashboard;


const CustomCheckIcon = () => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="green"
        width="1em"
        height="1em"
    >
        <circle cx="12" cy="12" r="12" fill="green" />
        <path
            d="M9.5 16.5l-3.5-3.5 1.5-1.5 2 2 5-5 1.5 1.5z"
            fill="white"
        />
    </svg>
);

const CustomCrossIcon = () => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="red"
        width="1em"
        height="1em"
    >
        <circle cx="12" cy="12" r="12" fill="red" />
        <path
            d="M15.5 8.5l-1-1-3.5 3.5-3.5-3.5-1 1 3.5 3.5-3.5 3.5 1 1 3.5-3.5 3.5 3.5 1-1-3.5-3.5z"
            fill="white"
        />
    </svg>
);
