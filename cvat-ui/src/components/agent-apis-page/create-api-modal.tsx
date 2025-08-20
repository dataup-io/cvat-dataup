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
import { AgentType, APIProvider, LabelSource } from 'cvat-core/src/agent_apis';
import { createAgentApiAsync, updateAgentApiAsync } from 'actions/agent-apis-actions';

interface Props {
    visible: boolean;
    api?: any;
    onClose: () => void;
}

function CreateApiModalComponent(props: Props): JSX.Element {
    const { visible, api, onClose } = props;
    const [form] = Form.useForm();
    const { notification } = App.useApp();
    const dispatch = useDispatch();
    const [useCustomLabels, setUseCustomLabels] = useState(false);
    const user = useSelector((state: CombinedState) => state.auth.user);
    const isSuperuser = user?.isSuperuser || false;

    const validateJSON = (_: any, value: string) => {
        if (!value) return Promise.resolve();
        try {
            JSON.parse(value);
            return Promise.resolve();
        } catch (error) {
            return Promise.reject(new Error('Please enter valid JSON'));
        }
    };

    const creating = useSelector((state: CombinedState) => state.agentApis.activities.creates.fetching);
    const updating = useSelector((state: CombinedState) => state.agentApis.activities.updates.fetching);
    const createError = useSelector((state: CombinedState) => state.agentApis.activities.creates.error);
    const updateError = useSelector((state: CombinedState) => state.agentApis.activities.updates.error);

    useEffect(() => {
        if (api) {
            form.setFieldsValue({
                name: api.name,
                endpoint: api.endpoint,
                auth_token: api.auth_token,
                provider: api.provider,
                is_active: api.is_active,
                timeout: api.timeout,
                rate_limit: api.rate_limit,
                labels: JSON.stringify(api.labels, null, 2),
                label_source: api.label_source,
                agent_type: api.agent_type,
                is_public: api.is_public,
            });
        } else {
            form.resetFields();
        }
    }, [api, visible]);

    useEffect(() => {
        if (createError) {
            notification.error({
                message: 'Could not create Agent API',
                description: createError,
            });
        }
        if (updateError) {
            notification.error({
                message: 'Could not update Agent API',
                description: updateError,
            });
        }
    }, [createError, updateError, notification]);

    const handleSubmit = () => {
        form.validateFields()
            .then((values) => {
                const processedValues = {
                    ...values,
                    labels: values.labels ? JSON.parse(values.labels) : undefined,
                };

                if (api) {
                    dispatch(updateAgentApiAsync({
                        id: api.id,
                        ...processedValues,
                    }));
                } else {
                    dispatch(createAgentApiAsync(processedValues));
                }
                onClose();
                // window.location.reload();
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
            okButtonProps={{ loading: creating || updating }}
        >
            <Form form={form} layout='vertical'>
                <Form.Item
                    name='name'
                    label='Name'
                    rules={[{ required: true, message: 'Please enter a name' }]}
                >
                    <Input />
                </Form.Item>
                <Form.Item
                    name='endpoint'
                    label='Endpoint URL'
                    rules={[{ required: true, message: 'Please enter an endpoint URL' }]}
                >
                    <Input />
                </Form.Item>
                <Form.Item
                    name='auth_token'
                    label='Authentication Token'
                    rules={[{ required: true, message: 'Please enter an authentication token' }]}
                >
                    <Input.Password />
                </Form.Item>
                <Form.Item
                    name='provider'
                    label='Provider'
                    rules={[{ required: true, message: 'Please select a provider' }]}
                >
                    <Select>
                        <Select.Option value={APIProvider.HUGGINGFACE}>HuggingFace</Select.Option>
                        <Select.Option value={APIProvider.ROBOFLOW}>Roboflow</Select.Option>
                        <Select.Option value={APIProvider.LANDINGAI}>Landing AI</Select.Option>
                    </Select>
                </Form.Item>
                <Form.Item name='timeout' label='Timeout (seconds)'>
                    <InputNumber min={1} max={300} />
                </Form.Item>
                <Form.Item name='rate_limit' label='Rate Limit (requests per minute)'>
                    <InputNumber min={1} max={1000} />
                </Form.Item>
                <Form.Item name='agent_type' label='Agent type' rules={[{ required: true, message: 'Please Choose an agent type' }]}>
                    <Select
                        placeholder='Choose agent type'

                    >
                        <Select.Option value={AgentType.DETECTOR}>Detector</Select.Option>
                        <Select.Option value={AgentType.INTERACTOR}>Interactor</Select.Option>
                        <Select.Option value={AgentType.REID}>Reid</Select.Option>
                        <Select.Option value={AgentType.TRACKER}>Tracker</Select.Option>
                    </Select>
                </Form.Item>
                <Form.Item name='label_source' label='Label source' rules={[{ required: true, message: 'Please Choose a label source' }]}>
                    <Select
                        onChange={(value) => setUseCustomLabels(value === 'custom')}
                        placeholder='Choose label source'
                    >
                        <Select.Option value={LabelSource.COCO}>coco Labels</Select.Option>
                        <Select.Option value={LabelSource.CUSTOM}>Custom Labels</Select.Option>
                    </Select>
                </Form.Item>
                {isSuperuser && (
                    <Form.Item
                        name='is_public'
                        valuePropName='checked'
                    >
                        <Checkbox>Make API public (available to all organizations)</Checkbox>
                    </Form.Item>
                )}
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
