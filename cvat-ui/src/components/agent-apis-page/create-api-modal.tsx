// Copyright (C) 2020-2022 Intel Corporation
// Copyright (C) CVAT.ai Corporation
//
// SPDX-License-Identifier: MIT

import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import Modal from 'antd/lib/modal';
import Form from 'antd/lib/form';
import Input from 'antd/lib/input';
import Select from 'antd/lib/select';
import InputNumber from 'antd/lib/input-number';
import Checkbox from 'antd/lib/checkbox';
import { App } from 'antd';
import TextArea from 'antd/lib/input/TextArea';
import { CombinedState } from 'reducers';
import { createAgentAsync, updateAgentAsync } from 'actions/agent-actions';
import { MLModel, AgentPublisher } from 'cvat-core-wrapper';

// Define enums locally to avoid import issues
enum AgentType {
    DETECTOR = 'detector',
    INTERACTOR = 'interactor',
    TRACKER = 'tracker',
    REID = 'reid'
}





enum LabelSource {
    COCO = 'coco',
    CUSTOM = 'custom'
}

interface Props {
    visible: boolean;
    api?: MLModel | null;
    onClose: () => void;
}

function CreateApiModalComponent(props: Props): JSX.Element {
    const { visible, api, onClose } = props;
    const dispatch = useDispatch();
    const [form] = Form.useForm();
    const [useCustomLabels, setUseCustomLabels] = useState(false);

    const creating = false; // Will be set to true when create operation is in progress
    const updating = useSelector((state: CombinedState) => api ? (state.agents?.activities?.updates?.[api.id as any] || false) : false);

    const { user: authUser } = useSelector((state: CombinedState) => state.auth);
    const isSuperuser = authUser?.isSuperuser || false;
    const isPublicAgent = api && (api as any).is_public;
    const isFormDisabled = isPublicAgent;

    const parseLabelsValue = (value: string): string[] => (
        value
            .split(/[,\n]/)
            .map((item) => item.trim())
            .filter((item) => item.length > 0)
    );

    const extractLabelName = (item: any): string | null => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object') {
            if (typeof item.name === 'string') return item.name;
            if (typeof item.label === 'string') return item.label;
        }
        return null;
    };

    const validateLabels = (_: any, value: string) => {
        if (!value) return Promise.resolve();
        const labels = parseLabelsValue(value);
        if (!labels.length) {
            return Promise.reject(new Error('Please enter at least one label name'));
        }
        return Promise.resolve();
    };

    useEffect(() => {
        if (visible) {
            if (api) {
                const apiData = api as any; // Cast to any to access agent API properties
                console.log('Setting form values with apiData:', apiData);
                const hasLabels = Array.isArray(apiData.labels) && apiData.labels.length > 0;
                const resolvedLabelSource = apiData.label_source ? apiData.label_source : (hasLabels ? 'custom' : undefined);
                const normalizedLabelLines = hasLabels && Array.isArray(apiData.labels)
                    ? (apiData.labels as any[]).map(extractLabelName).filter((v): v is string => !!v)
                    : [];
                form.setFieldsValue({
                    name: apiData.name,
                    endpoint: '', // Don't show the actual endpoint when editing
                    auth_token: '', // Don't show the actual token when editing
                    publisher: apiData.publisher, // Use the actual publisher field from backend
                    timeout: apiData.timeout,
                    rate_limit: apiData.rate_limit,
                    agent_type: apiData.agent_type,
                    label_source: resolvedLabelSource,
                    labels: normalizedLabelLines.join(', '),
                });
                const shouldUseCustomLabels = resolvedLabelSource === 'custom' || hasLabels;
                setUseCustomLabels(shouldUseCustomLabels);
            } else {
                form.resetFields();
                setUseCustomLabels(false);
            }
        }
    }, [visible, api, form]);

    const handleSubmit = () => {
        form.validateFields()
            .then((values) => {
                const formData = { ...values };
                if (values.labels) {
                    formData.labels = parseLabelsValue(values.labels);
                }

                // Always set provider to dataup for agent APIs
                formData.provider = 'dataup';
                // Keep publisher field for backend to return in responses
                // Backend will store and return the publisher field

                // When editing, only include auth_token if a new value was provided
                if (api && !values.auth_token) {
                    delete formData.auth_token;
                }

                // When editing, only include endpoint if a new value was provided
                if (api && !values.endpoint) {
                    delete formData.endpoint;
                }

                if (api) {
                    dispatch(updateAgentAsync(Number(api.id), formData));
                } else {
                    dispatch(createAgentAsync(formData));
                }
                onClose();
            })
            .catch((error) => {
                console.error('Validation failed:', error);
            });
    };

    return (
        <Modal
            title={api ? 'Edit Agent API' : 'Create Agent API'}
            open={visible}
            onOk={handleSubmit}
            onCancel={onClose}
            okButtonProps={{ loading: creating || updating, disabled: isFormDisabled }}
        >
            <Form form={form} layout='vertical'>
                <Form.Item
                    name='name'
                    label='Name'
                    rules={[{ required: !api, message: 'Please enter a name' }]}
                >
                    <Input autoComplete="off" disabled={isFormDisabled} />
                </Form.Item>
                <Form.Item
                    name='endpoint'
                    label='Endpoint URL'
                    rules={[{ required: !api, message: 'Please enter an endpoint URL' }]}
                >
                    <Input
                        placeholder={api ? 'Enter new endpoint to change (current endpoint is hidden)' : 'Enter endpoint URL'}
                        autoComplete="off"
                        disabled={isFormDisabled}
                    />
                </Form.Item>
                <Form.Item
                    name='auth_token'
                    label='Authentication Token'
                    rules={[{ required: !api, message: 'Please enter an authentication token' }]}
                >
                    <Input.Password
                        placeholder={api ? 'Enter new token to change (current token is hidden)' : 'Enter authentication token'}
                        autoComplete="new-password"
                        disabled={isFormDisabled}
                    />
                </Form.Item>
                <Form.Item
                    name='publisher'
                    label='Publisher'
                    rules={[{ required: !api, message: 'Please select a publisher' }]}
                >
                    <Select placeholder="Select a publisher" disabled={isFormDisabled}>
                        <Select.Option value={AgentPublisher.HUGGINGFACE}>HuggingFace</Select.Option>
                        <Select.Option value={AgentPublisher.ROBOFLOW}>Roboflow</Select.Option>
                        <Select.Option value={AgentPublisher.LANDINGAI}>LandingAI</Select.Option>
                        <Select.Option value={AgentPublisher.CUSTOM}>Custom</Select.Option>
                    </Select>
                </Form.Item>
                <Form.Item
                    name='timeout'
                    label='Timeout (seconds)'
                >
                    <InputNumber min={1} max={300} disabled={isFormDisabled} />
                </Form.Item>
                <Form.Item
                    name='rate_limit'
                    label='Rate Limit (requests per minute)'
                >
                    <InputNumber min={1} max={1000} disabled={isFormDisabled} />
                </Form.Item>
                <Form.Item
                    name='agent_type'
                    label='Agent Type'
                    rules={[{ required: !api, message: 'Please select an agent type' }]}
                >
                    <Select
                        placeholder='Choose agent type'
                        disabled={isFormDisabled}
                    >
                        <Select.Option value={AgentType.DETECTOR}>Detector</Select.Option>
                        <Select.Option value={AgentType.INTERACTOR}>Interactor</Select.Option>
                        <Select.Option value={AgentType.REID}>Reid</Select.Option>
                        <Select.Option value={AgentType.TRACKER}>Tracker</Select.Option>
                    </Select>
                </Form.Item>
                <Form.Item name='label_source' label='Label source' rules={[{ required: !api, message: 'Please Choose a label source' }]}>
                    <Select
                        onChange={(value) => setUseCustomLabels(value === 'custom')}
                        placeholder='Choose label source'
                        disabled={isFormDisabled}
                    >
                        <Select.Option value={LabelSource.COCO}>coco Labels</Select.Option>
                        <Select.Option value={LabelSource.CUSTOM}>Custom Labels</Select.Option>
                    </Select>
                </Form.Item>

                {(useCustomLabels || (api && Array.isArray((api as any).labels) && (api as any).labels.length > 0)) && (
                    <Form.Item
                        name='labels'
                        label='Custom Labels'
                        rules={[{ validator: validateLabels }]}
                        help='Enter label names separated by commas'
                    >
                        <TextArea
                            rows={4}
                            placeholder={['person', 'car', 'bicycle', 'motorcycle', 'truck'].join(', ')}
                            disabled={isFormDisabled}
                        />
                    </Form.Item>
                )}
            </Form>
        </Modal>
    );
}

function WrappedCreateApiModal(props: Props): JSX.Element {
    return (
        <App>
            <CreateApiModalComponent {...props} />
        </App>
    );
}

export default React.memo(WrappedCreateApiModal);