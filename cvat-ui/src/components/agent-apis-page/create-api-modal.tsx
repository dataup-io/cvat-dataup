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
import { MLModel } from 'cvat-core-wrapper';

// Define enums locally to avoid import issues
enum AgentType {
    DETECTOR = 'detector',
    INTERACTOR = 'interactor',
    TRACKER = 'tracker',
    REID = 'reid'
}

enum APIProvider {
    DATAUP = 'dataup',
    HUGGINGFACE = 'huggingface',
    ROBOFLOW = 'roboflow',
    ZINKIAI = 'zinkiai'
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

    const validateJSON = (_: any, value: string) => {
        if (!value) return Promise.resolve();
        try {
            JSON.parse(value);
            return Promise.resolve();
        } catch (error) {
            return Promise.reject(new Error('Please enter valid JSON'));
        }
    };

    useEffect(() => {
        if (visible) {
            if (api) {
                const apiData = api as any; // Cast to any to access agent API properties
                console.log('Setting form values with apiData:', apiData);
                form.setFieldsValue({
                    name: apiData.name,
                    endpoint: apiData.endpoint || apiData.url,
                    auth_token: '', // Don't show the actual token when editing
                    provider: apiData.provider,
                    timeout: apiData.timeout,
                    rate_limit: apiData.rate_limit,
                    agent_type: apiData.agent_type,
                    label_source: apiData.label_source,
                    labels: apiData.labels ? JSON.stringify(apiData.labels, null, 2) : '',
                });
                const shouldUseCustomLabels = apiData.label_source === 'custom';
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
                    try {
                        formData.labels = JSON.parse(values.labels);
                    } catch (error) {
                        console.error('JSON parsing error:', error);
                        return;
                    }
                }

                // When editing, only include auth_token if a new value was provided
                if (api && !values.auth_token) {
                    delete formData.auth_token;
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
                    <Input autoComplete="off" disabled={isFormDisabled} />
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
                    name='provider'
                    label='Provider'
                    rules={[{ required: !api, message: 'Please select a provider' }]}
                >
                    <Select placeholder="Select a provider" disabled={isFormDisabled}>
                        <Select.Option value={APIProvider.HUGGINGFACE}>HuggingFace</Select.Option>
                        <Select.Option value={APIProvider.ROBOFLOW}>Roboflow</Select.Option>
                        <Select.Option value={APIProvider.ZINKIAI}>Zinki AI</Select.Option>
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

                {useCustomLabels && (
                    <Form.Item
                        name='labels'
                        label='Custom Labels (JSON)'
                        rules={[{ validator: validateJSON }]}
                        help='Enter your labels as a simple array'
                        tooltip={JSON.stringify(
                            ['person', 'car', 'bicycle', 'motorcycle', 'truck'],
                            null,
                            2)}
                    >
                        <TextArea
                            rows={4}
                            defaultValue={JSON.stringify(
                                ['person', 'car', 'bicycle', 'motorcycle', 'truck'],
                                null,
                                2)}
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