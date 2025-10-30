// Copyright (C) 2020-2022 Intel Corporation
// Copyright (C) CVAT.ai Corporation
//
// SPDX-License-Identifier: MIT

import React, { useEffect, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useHistory } from 'react-router-dom';
import Modal from 'antd/lib/modal';
import Form from 'antd/lib/form';
import Select from 'antd/lib/select';
import Button from 'antd/lib/button';
import Spin from 'antd/lib/spin';
import notification from 'antd/lib/notification';
import Text from 'antd/lib/typography/Text';
import { BarChartOutlined } from '@ant-design/icons';
import { CombinedState } from 'reducers';
import { getTasksAsync } from 'actions/tasks-actions';
import { runBenchmarkAsync } from 'actions/agent-actions';
import { Task } from 'cvat-core-wrapper';

interface Props {
    visible: boolean;
    agent?: any | null;
    onClose: () => void;
}

function EvaluateModalComponent(props: Props): JSX.Element {
    const { visible, agent, onClose } = props;
    const dispatch = useDispatch();
    const history = useHistory();
    const [form] = Form.useForm();
    const [selectedTask, setSelectedTask] = useState<number | null>(null);
    const [evaluating, setEvaluating] = useState(false);

    const {
        tasks,
        fetching: tasksFetching,
        initialized: tasksInitialized,
    } = useSelector((state: CombinedState) => ({
        tasks: state.tasks.current,
        fetching: state.tasks.fetching,
        initialized: state.tasks.initialized,
    }));

    // Fetch tasks when modal opens
    useEffect(() => {
        if (visible && !tasksInitialized) {
            dispatch(getTasksAsync({}));
        }
    }, [visible, tasksInitialized, dispatch]);

    const handleOk = useCallback(async () => {
        if (!selectedTask || !agent) {
            notification.error({
                message: 'Validation Error',
                description: 'Please select a task to evaluate.',
            });
            return;
        }

        setEvaluating(true);
        try {
            console.log('Starting evaluation:', {
                agentId: agent.id,
                agentName: agent.name,
                taskId: selectedTask,
            });

            await dispatch(runBenchmarkAsync(agent.id, selectedTask));

            notification.success({
                message: 'Evaluation Started',
                description: `Evaluation of agent "${agent.name}" on the selected task has been started.`,
                duration: 5,
            });

            // Reset form and close modal
            form.resetFields();
            setSelectedTask(null);
            onClose();
        } catch (error: any) {
            console.error('Failed to start evaluation:', error);
            notification.error({
                message: 'Evaluation Failed',
                description: error?.message || 'Failed to start evaluation. Please try again.',
                duration: 5,
            });
        } finally {
            setEvaluating(false);
        }
    }, [selectedTask, agent, form, onClose, dispatch]);

    const handleCancel = useCallback(() => {
        form.resetFields();
        setSelectedTask(null);
        onClose();
    }, [form, onClose]);

    const handleTaskChange = useCallback((taskId: number) => {
        setSelectedTask(taskId);
    }, []);

    const handleViewBenchmarks = useCallback(() => {
        if (agent?.id) {
            history.push(`/agents/benchmarks/${agent.id}`);
            onClose();
        } else {
            history.push('/agents/benchmarks');
            onClose();
        }
    }, [agent, history, onClose]);

    return (
        <Modal
            title={`Evaluate Agent: ${agent?.name || ''}`}
            open={visible}
            onOk={handleOk}
            onCancel={handleCancel}
            width={600}
            destroyOnClose
            footer={[
                <Button
                    key="benchmarks"
                    icon={<BarChartOutlined />}
                    onClick={handleViewBenchmarks}
                    style={{ float: 'left' }}
                >
                    View Benchmark Results
                </Button>,
                <Button key="cancel" onClick={handleCancel}>
                    Cancel
                </Button>,
                <Button
                    key="evaluate"
                    type="primary"
                    onClick={handleOk}
                    disabled={!selectedTask || evaluating}
                    loading={evaluating}
                >
                    Start Evaluation
                </Button>,
            ]}
        >
            <Form
                form={form}
                layout="vertical"
                preserve={false}
            >
                <Form.Item
                    label="Select Task/Dataset"
                    name="taskId"
                    rules={[{ required: true, message: 'Please select a task to evaluate!' }]}
                >
                    <Select
                        placeholder="Choose a task to evaluate the agent on"
                        value={selectedTask}
                        onChange={handleTaskChange}
                        loading={tasksFetching}
                        showSearch
                        optionLabelProp="label"
                        filterOption={(input, option) => {
                            const taskName = tasks.find((task: Task) => task.id === option?.value)?.name || '';
                            return taskName.toLowerCase().includes(input.toLowerCase());
                        }}
                        notFoundContent={tasksFetching ? <Spin size="small" /> : 'No tasks found'}
                    >
                        {tasks.map((task: Task) => (
                            <Select.Option key={task.id} value={task.id} label={task.name} title={task.name}>
                                <div style={{
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                    maxWidth: '100%'
                                }}>
                                    {task.name}
                                </div>
                            </Select.Option>
                        ))}
                    </Select>
                </Form.Item>

                {agent && (
                    <div style={{ marginTop: '16px', padding: '12px', backgroundColor: '#f5f5f5', borderRadius: '6px' }}>
                        <Text strong>Agent Details:</Text>
                        <br />
                        <Text>Name: {agent.name}</Text>
                        <br />
                        <Text>Type: {agent.type}</Text>
                        <br />
                        <Text>Publisher: {agent.publisher}</Text>
                    </div>
                )}
            </Form>
        </Modal>
    );
}

export default React.memo(EvaluateModalComponent);