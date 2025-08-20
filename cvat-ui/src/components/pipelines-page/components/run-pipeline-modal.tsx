import React, { useState, useEffect } from 'react';
import {
    Modal,
    Form,
    Select,
    Input,
    Button,
    Space,
    Typography,
    Divider,
    message,
    Row,
    Col,
} from 'antd';
import { useSelector } from 'react-redux';
import { CombinedState } from 'reducers';
import { getCore } from 'cvat-core-wrapper';
import { Pipeline, PipelineStep } from 'cvat-core/src/core-types';

const { Option } = Select;
const { Text } = Typography;
const cvat = getCore();

interface Props {
    visible: boolean;
    pipeline: Pipeline | null;
    onCancel: () => void;
    onSuccess: () => void;
}

interface Task {
    id: number;
    name: string;
}

interface Job {
    id: number;
    task_id: number;
    stage: string;
    state: string;
}

interface Agent {
    id: string;
    name: string;
    agent_type: string;
}

interface StepParam {
    key: string;
    param_type: string;
    required: boolean;
    default_value?: any;
    description?: string;
}

function RunPipelineModal({ visible, pipeline, onCancel, onSuccess }: Props): JSX.Element {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [jobs, setJobs] = useState<Job[]>([]);
    const [agents, setAgents] = useState<Agent[]>([]);
    const [selectedTask, setSelectedTask] = useState<number | null>(null);
    const [stepParams, setStepParams] = useState<{ [stepId: string]: StepParam[] }>({});
    const [stepInfo, setStepInfo] = useState<{ [stepId: string]: any }>({});
    const [loadingData, setLoadingData] = useState(false);

    const user = useSelector((state: CombinedState) => state.auth.user);

    useEffect(() => {
        if (visible && pipeline) {
            loadInitialData();
        }
    }, [visible, pipeline]);

    const loadInitialData = async () => {
        setLoadingData(true);
        try {
            // Load tasks
            const tasksResponse = await cvat.tasks.get();
            setTasks(tasksResponse.map((task: any) => ({
                id: task.id,
                name: task.name,
            })));

            // Load agents
            const agentsResponse = await cvat.agents.list();
            setAgents(agentsResponse.models.map((agent: any) => ({
                id: agent.serialized.id,
                name: agent.serialized.name,
                agent_type: agent.serialized.kind,
            })));

            // Load step parameters for each step in the pipeline
                if (pipeline?.steps) {
                    const stepParamsMap: { [stepId: string]: StepParam[] } = {};

                    try {
                         // Get all steps from step registry
                         const stepRegistryResponse = await cvat.pipelines.stepRegistry();
                         const allSteps = stepRegistryResponse.results || [];
                         const stepInfoMap: { [stepId: string]: any } = {};

                         for (const step of pipeline.steps) {

                             // Find the step info in the registry by matching step ID
                             const registryStepInfo = allSteps.find((registryStep: any) =>
                                 registryStep.id === step.step
                             );

                             if (registryStepInfo) {
                                 stepParamsMap[step.id] = registryStepInfo.parameters || [];
                                 stepInfoMap[step.id] = registryStepInfo;
                             } else {
                                 console.warn(`Could not find step info for ${step.step}`);
                                 stepParamsMap[step.id] = [];
                                 stepInfoMap[step.id] = null;
                             }
                         }
                         setStepInfo(stepInfoMap);
                    } catch (error) {
                        console.warn('Could not load step registry:', error);
                        // Initialize empty params for all steps
                        for (const step of pipeline.steps) {
                            stepParamsMap[step.id] = [];
                        }
                    }

                    setStepParams(stepParamsMap);

                    // Set default values for step parameters
                    const defaultValues: any = {};
                    for (const step of pipeline.steps) {
                        const params = stepParamsMap[step.id] || [];
                        for (const param of params) {
                            if (param.default_value !== undefined) {
                                defaultValues[`step_${step.id}.${param.key}`] = param.default_value;
                            }
                        }
                    }
                    form.setFieldsValue(defaultValues);
                }
        } catch (error) {
            console.error('Error loading data:', error);
            message.error('Failed to load form data');
        } finally {
            setLoadingData(false);
        }
    };

    const handleTaskChange = async (taskId: number) => {
        setSelectedTask(taskId);
        form.setFieldsValue({ job_id: undefined });

        try {
            // Load jobs for the selected task
            const jobsResponse = await cvat.jobs.get({ taskID: taskId });
            setJobs(jobsResponse.map((job: any) => ({
                id: job.id,
                task_id: job.taskId,
                stage: job.stage,
                state: job.state,
            })));
        } catch (error) {
            console.error('Error loading jobs:', error);
            message.error('Failed to load jobs for selected task');
        }
    };

    const handleSubmit = async () => {
        try {
            const values = await form.validateFields();
            setLoading(true);

            // Prepare input data and step parameters separately
            const inputData: any = {};

            // Add task or job ID to input_data
            if (values.task_id) {
                inputData.task_id = values.task_id;
            }
            if (values.job_id) {
                inputData.job_id = values.job_id;
            }

            const stepParams = {};
            if (pipeline?.steps) {
                for (const step of pipeline.steps) {
                    // Extract all parameters for this step from nested form fields
                    Object.keys(values).forEach(key => {
                        if (key.startsWith(`step_${step.id}.`)) {
                            const paramKey = key.replace(`step_${step.id}.`, '');
                            stepParams[paramKey] = values[key];
                        }
                    });
                }
            }

            // Prepare the request payload
            const requestPayload = {
                input_data: inputData,
                step_params: stepParams  // ✅ flattened version
            };

            // Run the pipeline
            await cvat.pipelines.run(pipeline!.id, requestPayload);

            message.success('Pipeline execution started successfully!');
            form.resetFields();
            onSuccess();
        } catch (error) {
            console.error('Error running pipeline:', error);
            message.error('Failed to start pipeline execution');
        } finally {
            setLoading(false);
        }
    };

    const renderStepParameters = () => {
        if (!pipeline?.steps) return null;

        return pipeline.steps.map((step: PipelineStep) => {
            const params = stepParams[step.id] || [];
            if (params.length === 0) return null;

            const registryStepInfo = stepInfo[step.id];
            const stepName = registryStepInfo ? registryStepInfo.name : step.step;

            return (
                <div key={step.id}>
                    <Divider orientation="left">
                        <Text strong>{stepName} Parameters</Text>
                    </Divider>
                    <Row gutter={16}>
                        {params.map((param: StepParam) => {
                            const fieldName = `step_${step.id}.${param.key}`;

                            if (param.key === 'agent_id') {
                                return (
                                    <Col span={12} key={param.key}>
                                        <Form.Item
                                            name={fieldName}
                                            label="Agent"
                                            rules={[
                                                {
                                                    required: param.required,
                                                    message: 'Please select an agent',
                                                },
                                            ]}
                                        >
                                            <Select
                                                placeholder="Select an agent"
                                                showSearch
                                                filterOption={(input, option) =>
                                                    (option?.children as string)
                                                        .toLowerCase()
                                                        .includes(input.toLowerCase())
                                                }
                                            >
                                                {agents.map((agent) => (
                                                    <Option key={agent.id} value={agent.id}>
                                                        {agent.name} ({agent.agent_type})
                                                    </Option>
                                                ))}
                                            </Select>
                                        </Form.Item>
                                    </Col>
                                );
                            }

                            return (
                                <Col span={12} key={param.key}>
                                    <Form.Item
                                        name={fieldName}
                                        label={param.key}
                                        rules={[
                                            {
                                                required: param.required,
                                                message: `Please enter ${param.key}`,
                                            },
                                        ]}
                                        tooltip={param.description}
                                    >
                                        {param.param_type === 'number' ? (
                                            <Input
                                                type="number"
                                                placeholder={`Enter ${param.key}`}
                                            />
                                        ) : param.param_type === 'boolean' ? (
                                            <Select placeholder={`Select ${param.key}`}>
                                                <Option value={true}>True</Option>
                                                <Option value={false}>False</Option>
                                            </Select>
                                        ) : (
                                            <Input
                                                placeholder={`Enter ${param.key}`}
                                            />
                                        )}
                                    </Form.Item>
                                </Col>
                            );
                        })}
                    </Row>
                </div>
            );
        });
    };

    return (
        <Modal
            title={`Run Pipeline: ${pipeline?.name || ''}`}
            open={visible}
            onCancel={onCancel}
            width={800}
            footer={[
                <Button key="cancel" onClick={onCancel}>
                    Cancel
                </Button>,
                <Button
                    key="submit"
                    type="primary"
                    loading={loading}
                    onClick={handleSubmit}
                    disabled={loadingData}
                >
                    Run Pipeline
                </Button>,
            ]}
        >
            <Form
                form={form}
                layout="vertical"
                initialValues={{}}
            >
                <Text type="secondary">
                    Select a task and/or a job to run the pipeline on. At least one must be selected.
                </Text>

                <Divider orientation="left">
                    <Text strong>Target Selection</Text>
                </Divider>

                <Row gutter={16}>
                    <Col span={12}>
                        <Form.Item
                            name="task_id"
                            label="Task"
                            rules={[
                                {
                                    validator: (_, value) => {
                                        const jobId = form.getFieldValue('job_id');
                                        if (!value && !jobId) {
                                            return Promise.reject(new Error('Please select either a task or a job'));
                                        }
                                        return Promise.resolve();
                                    },
                                },
                            ]}
                        >
                            <Select
                                placeholder="Select a task"
                                showSearch
                                loading={loadingData}
                                onChange={handleTaskChange}
                                filterOption={(input, option) =>
                                    (option?.children as string)
                                        .toLowerCase()
                                        .includes(input.toLowerCase())
                                }
                            >
                                {tasks.map((task) => (
                                    <Option key={task.id} value={task.id}>
                                        {task.name} (ID: {task.id})
                                    </Option>
                                ))}
                            </Select>
                        </Form.Item>
                    </Col>

                    <Col span={12}>
                        <Form.Item
                            name="job_id"
                            label="Job"
                            rules={[
                                {
                                    validator: (_, value) => {
                                        const taskId = form.getFieldValue('task_id');
                                        if (!value && !taskId) {
                                            return Promise.reject(new Error('Please select either a task or a job'));
                                        }
                                        return Promise.resolve();
                                    },
                                },
                            ]}
                        >
                            <Select
                                placeholder="Select a job"
                                showSearch
                                loading={loadingData}
                                filterOption={(input, option) =>
                                    (option?.children as string)
                                        .toLowerCase()
                                        .includes(input.toLowerCase())
                                }
                            >
                                {jobs.map((job) => (
                                    <Option key={job.id} value={job.id}>
                                        Job {job.id} - {job.stage} ({job.state})
                                    </Option>
                                ))}
                            </Select>
                        </Form.Item>
                    </Col>
                </Row>

                {renderStepParameters()}
            </Form>
        </Modal>
    );
}

export default RunPipelineModal;