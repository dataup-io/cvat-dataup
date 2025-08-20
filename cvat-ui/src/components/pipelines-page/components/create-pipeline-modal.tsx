import React, { useState, useEffect } from 'react';
import {
    Modal,
    Form,
    Input,
    Button,
    Space,
    Typography,
    Divider,
    message,
    Row,
    Col,
    Card,
    Tag,
    Badge,
    List,
    Empty,
    Tooltip,
} from 'antd';
import { PlusOutlined, DeleteOutlined, ArrowUpOutlined, ArrowDownOutlined, InfoCircleOutlined, NodeIndexOutlined, ArrowRightOutlined } from '@ant-design/icons';
import { getCore } from 'cvat-core-wrapper';
import { PipelineStep, CATEGORY_COLORS } from './steps/types';

const { Text, Title } = Typography;
const { TextArea } = Input;

interface SelectedStep {
    id: string;
    stepId: string;
    type: string;
    name: string;
    category: string;
    order: number;
    params: Record<string, any>;
}

interface Props {
    visible: boolean;
    onCancel: () => void;
    onSuccess: () => void;
}

const getCategoryColor = (category: string): string => {
    return CATEGORY_COLORS[category] || '#d9d9d9';
};

const extractStepName = (stepType: string): string => {
    const parts = stepType.split('.');
    if (parts.length > 1) {
        return parts[parts.length - 1].charAt(0).toUpperCase() + parts[parts.length - 1].slice(1);
    }
    return stepType;
};

function CreatePipelineModal({ visible, onCancel, onSuccess }: Props): JSX.Element {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [availableSteps, setAvailableSteps] = useState<PipelineStep[]>([]);
    const [selectedSteps, setSelectedSteps] = useState<SelectedStep[]>([]);
    const [loadingSteps, setLoadingSteps] = useState(false);
    const [currentStep, setCurrentStep] = useState(1); // 1: Pipeline Details, 2: Add Steps

    useEffect(() => {
        if (visible) {
            loadAvailableSteps();
            form.resetFields();
            setSelectedSteps([]);
            setCurrentStep(1);
        }
    }, [visible, form]);

    const loadAvailableSteps = async () => {
        setLoadingSteps(true);
        try {
            const core = getCore();
            const stepRegistryResponse = await core.pipelines.stepRegistry();

            const mappedSteps: PipelineStep[] = stepRegistryResponse.results.map((item) => ({
                id: item.id,
                type: item.type,
                name: item.name,
                category: item.category,
                description: item.description,
                parameters: item.parameters.map((param) => ({
                    key: param.key,
                    param_type: param.param_type,
                    default_value: param.default_value
                }))
            }));

            setAvailableSteps(mappedSteps);
        } catch (error) {
            message.error('Failed to load available steps');
            console.error('Error loading steps:', error);
        } finally {
            setLoadingSteps(false);
        }
    };

    const handleAddStep = (step: PipelineStep) => {
        const newStep: SelectedStep = {
            id: `${step.id}_${Date.now()}`, // Unique ID for this instance
            stepId: step.id,
            type: step.type,
            name: step.name,
            category: step.category,
            order: selectedSteps.length + 1,
            params: {}
        };
        setSelectedSteps([...selectedSteps, newStep]);
        message.success(`Added ${extractStepName(step.type)} to pipeline`);
    };

    const handleRemoveStep = (stepId: string) => {
        const updatedSteps = selectedSteps
            .filter(step => step.id !== stepId)
            .map((step, index) => ({ ...step, order: index + 1 }));
        setSelectedSteps(updatedSteps);
    };

    const handleMoveStep = (stepId: string, direction: 'up' | 'down') => {
        const currentIndex = selectedSteps.findIndex(step => step.id === stepId);
        if (
            (direction === 'up' && currentIndex === 0) ||
            (direction === 'down' && currentIndex === selectedSteps.length - 1)
        ) {
            return;
        }

        const newSteps = [...selectedSteps];
        const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
        [newSteps[currentIndex], newSteps[targetIndex]] = [newSteps[targetIndex], newSteps[currentIndex]];

        // Update order numbers
        const reorderedSteps = newSteps.map((step, index) => ({ ...step, order: index + 1 }));
        setSelectedSteps(reorderedSteps);
    };

    const handleNext = async () => {
        if (currentStep === 1) {
            try {
                await form.validateFields(['name', 'description']);
                setCurrentStep(2);
            } catch (error) {
                // Form validation failed
            }
        }
    };

    const handleBack = () => {
        setCurrentStep(1);
    };

    const handleSubmit = async () => {
        try {
            const values = await form.validateFields(['name', 'description']);
    
            if (selectedSteps.length === 0) {
                message.error('Please add at least one step to the pipeline');
                return;
            }
    
            setLoading(true);
    
            const pipelineData = {
                name: values.name,
                description: values.description || '',
                usage_limit: 1000,  // ✅ Add default usage limit
                is_public: false,   // ✅ Add default public setting
                steps: selectedSteps.map(step => ({
                    step_id: step.stepId,  // ✅ Changed from 'step' to 'step_id'
                    order: step.order,
                    params: step.params
                }))
            };
    
            const core = getCore();
            await core.pipelines.create(pipelineData);
    
            message.success('Pipeline created successfully!');
            onSuccess();
        } catch (error) {
            // Enhanced error handling for backend validation
            if (error.response?.data) {
                const errorMessage = typeof error.response.data === 'string' 
                    ? error.response.data 
                    : JSON.stringify(error.response.data);
                message.error(`Failed to create pipeline: ${errorMessage}`);
            } else {
                message.error('Failed to create pipeline');
            }
            console.error('Error creating pipeline:', error);
        } finally {
            setLoading(false);
        }
    };

    const renderPipelineDetailsStep = () => (
        <div>
            <Title level={4}>Pipeline Details</Title>
            <Form form={form} layout="vertical">
                <Form.Item
                    name="name"
                    label="Pipeline Name"
                    rules={[{ required: true, message: 'Please enter a pipeline name' }]}
                >
                    <Input placeholder="Enter pipeline name" />
                </Form.Item>
                <Form.Item
                    name="description"
                    label="Description"
                >
                    <TextArea
                        rows={4}
                        placeholder="Enter pipeline description (optional)"
                    />
                </Form.Item>
            </Form>
        </div>
    );

    const renderAddStepsStep = () => (
        <div>
            <Title level={4}>Add Steps to Pipeline</Title>
            <Row gutter={16}>
                <Col span={12}>
                    <Card title="Available Steps" size="small" style={{ height: '400px', overflowY: 'auto' }}>
                        {loadingSteps ? (
                            <div>Loading steps...</div>
                        ) : (
                            <List
                                dataSource={availableSteps}
                                renderItem={(step) => (
                                    <List.Item
                                        actions={[
                                            <Button
                                                key="add"
                                                type="primary"
                                                size="small"
                                                icon={<NodeIndexOutlined />}
                                                onClick={() => handleAddStep(step)}
                                                style={{ borderRadius: 6 }}
                                            >
                                                Add Node
                                            </Button>
                                        ]}
                                    >
                                        <List.Item.Meta
                                            title={
                                                <div>
                                                    <NodeIndexOutlined style={{ color: getCategoryColor(step.category), fontSize: '12px', marginRight: 4 }} />
                                                    <Badge
                                                        color={getCategoryColor(step.category)}
                                                        text={step.category.toUpperCase()}
                                                        style={{ marginRight: 8 }}
                                                    />
                                                    {extractStepName(step.type)}
                                                </div>
                                            }
                                            description={
                                                <div>
                                                    <Text type="secondary">{step.description}</Text>
                                                    <br />
                                                    <Tag color="default">{step.parameters.length} parameters</Tag>
                                                </div>
                                            }
                                        />
                                    </List.Item>
                                )}
                            />
                        )}
                    </Card>
                </Col>
                <Col span={12}>
                    <Card title={<><NodeIndexOutlined style={{ marginRight: 8 }} />Pipeline Nodes</>} size="small" style={{ height: '400px', overflowY: 'auto' }}>
                        {selectedSteps.length === 0 ? (
                            <Empty description="No nodes added to pipeline" />
                        ) : (
                            <div style={{
                                border: '2px dashed #d9d9d9',
                                borderRadius: 12,
                                padding: 20,
                                minHeight: 120,
                                backgroundColor: '#fafafa',
                                position: 'relative'
                            }}>
                                {selectedSteps.map((step, index) => (
                                    <React.Fragment key={step.id}>
                                        <div style={{ position: 'relative', display: 'inline-block', marginBottom: 16 }}>
                                            <Card
                                                size="small"
                                                style={{
                                                    width: 180,
                                                    height: 100,
                                                    border: '2px solid #d9d9d9',
                                                    borderRadius: 12,
                                                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                                                    position: 'relative'
                                                }}
                                                styles={{
                                                    body: { padding: 12, height: '100%' }
                                                }}
                                            >
                                                {/* Node number badge */}
                                                <div style={{
                                                    position: 'absolute',
                                                    top: -8,
                                                    left: -8,
                                                    width: 24,
                                                    height: 24,
                                                    borderRadius: '50%',
                                                    backgroundColor: '#1890ff',
                                                    color: 'white',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    fontSize: '12px',
                                                    fontWeight: 'bold',
                                                    zIndex: 1
                                                }}>
                                                    {index + 1}
                                                </div>

                                                {/* Delete button */}
                                                <Button
                                                    type="text"
                                                    danger
                                                    size="small"
                                                    icon={<DeleteOutlined />}
                                                    onClick={() => handleRemoveStep(step.id)}
                                                    style={{
                                                        position: 'absolute',
                                                        top: 4,
                                                        right: 4,
                                                        width: 20,
                                                        height: 20,
                                                        padding: 0,
                                                        fontSize: '10px'
                                                    }}
                                                />

                                                <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                                    <Badge
                                                        color={getCategoryColor(step.category)}
                                                        text={step.category.toUpperCase()}
                                                        style={{ fontSize: '9px', marginBottom: 4 }}
                                                    />
                                                    <Typography.Text strong style={{ fontSize: '13px', lineHeight: 1.2 }}>
                                                        {extractStepName(step.type)}
                                                    </Typography.Text>
                                                    <Typography.Text type="secondary" style={{ fontSize: '11px', marginTop: 2 }}>
                                                        {step.params ? Object.keys(step.params).length : 0} params
                                                    </Typography.Text>
                                                </div>
                                            </Card>
                                        </div>
                                        {index < selectedSteps.length - 1 && (
                                            <ArrowRightOutlined
                                                style={{
                                                    color: '#8c8c8c',
                                                    fontSize: '16px',
                                                    margin: '0 8px',
                                                    verticalAlign: 'middle'
                                                }}
                                            />
                                        )}
                                    </React.Fragment>
                                ))}
                            </div>
                        )}
                    </Card>
                </Col>
            </Row>
        </div>
    );

    const getModalFooter = () => {
        if (currentStep === 1) {
            return [
                <Button key="cancel" onClick={onCancel}>
                    Cancel
                </Button>,
                <Button key="next" type="primary" onClick={handleNext}>
                    Next
                </Button>
            ];
        }

        return [
            <Button key="back" onClick={handleBack}>
                Back
            </Button>,
            <Button key="cancel" onClick={onCancel}>
                Cancel
            </Button>,
            <Button
                key="create"
                type="primary"
                loading={loading}
                onClick={handleSubmit}
                disabled={selectedSteps.length === 0}
            >
                Create Pipeline
            </Button>
        ];
    };

    return (
        <Modal
            title="Create New Pipeline"
            open={visible}
            onCancel={onCancel}
            footer={getModalFooter()}
            width={800}
            destroyOnClose
        >
            {currentStep === 1 ? renderPipelineDetailsStep() : renderAddStepsStep()}
        </Modal>
    );
}

export default CreatePipelineModal;