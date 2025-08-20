/// <reference types="react" />
/// <reference types="react-dom" />
/// <reference types="antd" />
/// <reference types="@ant-design/icons" />
/// <reference types="react-draggable" />
/// <reference types="react/jsx-runtime" />

import '../styles.scss';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { JSX } from 'react';

// Declare module paths to resolve module resolution issues
declare module 'react' {
    const React: any;
    export = React;
}

declare module 'antd' {
    export const Card: any;
    export const Button: any;
    export const Modal: any;
    export const Form: any;
    export const Input: any;
    export const InputNumber: any;
    export const Switch: any;
    export const Space: any;
    export const Typography: any;
    export const Tooltip: any;
    export const Divider: any;
    export const message: any;
    export const Select: any;
}

declare module '@ant-design/icons' {
    export const EditOutlined: any;
    export const SettingOutlined: any;
    export const SaveOutlined: any;
    export const LinkOutlined: any;
    export const PlusOutlined: any;
    export const DeleteOutlined: any;
}

declare module 'react-draggable' {
    const Draggable: any;
    export = Draggable;
}

// Declare JSX namespace to resolve JSX type issues
declare global {
    namespace JSX {
        interface IntrinsicElements {
            [elemName: string]: any;
        }
        interface Element {
            type: any;
            props: any;
            key: any;
        }
        interface ElementClass {
            render(): JSX.Element | null;
        }
    }
}
import {
    Card,
    Typography,
    Button,
    Form,
    Input,
    InputNumber,
    Switch,
    Select,
    message,
    Modal,
    Space,
    Tooltip,
    Divider,
} from 'antd';
import {
    SettingOutlined,
    SaveOutlined,
    EditOutlined,
    LinkOutlined,
    PlusOutlined,
    DeleteOutlined
} from '@ant-design/icons';
import Draggable from 'react-draggable';
import { getCore } from 'cvat-core-wrapper';

// Type definitions for agent data
interface Agent {
    id: string;
    name?: string;
    url?: string;
}

const { Text, Title } = Typography;


const { Option } = Select;

interface StepParameter {
    key: string;
    param_type: string;
    default_value: any;
    description: string;
    required: boolean;
}

interface PipelineStep {
    id: string;
    pipeline: string;
    step: string;
    order: number;
    params: Record<string, any>;
    created_at: string;
    updated_at: string;
    name?: string; // Display name from step registry
    stepId?: string; // Alternative step ID property
    step_id?: string; // Alternative step ID property
}

interface NodePosition {
    x: number;
    y: number;
}

interface PipelineNodeEditorProps {
    pipelineId: string;
    steps: PipelineStep[];
    onStepsUpdate: (steps: PipelineStep[]) => void;
}

interface StepRegistryItem {
    id: string;
    type: string;
    name: string;
    description: string;
    category: string;
    parameters: StepParameter[];
    version: string;
}

function PipelineNodeEditor({ pipelineId, steps, onStepsUpdate }: PipelineNodeEditorProps): React.ReactElement {
    const [nodePositions, setNodePositions] = useState<Record<string, NodePosition>>({});
    const [selectedStep, setSelectedStep] = useState<PipelineStep | null>(null);
    const [editModalVisible, setEditModalVisible] = useState(false);
    const [stepRegistry, setStepRegistry] = useState<Record<string, StepRegistryItem>>({});
    const [agents, setAgents] = useState<Agent[]>([]);
    const [loadingAgents, setLoadingAgents] = useState(false);
    const [form] = Form.useForm();
    const [saving, setSaving] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Initialize node positions
    useEffect(() => {
        const positions: Record<string, NodePosition> = {};
        steps.forEach((step, index) => {
            positions[step.id] = {
                x: 50 + (index * 300),
                y: 100
            };
        });
        setNodePositions(positions);
    }, [steps]);

    // Fetch step registry for parameter definitions
    useEffect(() => {
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

        const fetchAgents = async () => {
            try {
                setLoadingAgents(true);
                const core = getCore();
                const response = await core.agents.list();

                // Handle both old and new response formats
                const agentsList = response.models || response.results || response;

                // Convert MLModel objects to Agent interface format
                const formattedAgents = agentsList.map((agent: any) => ({
                    id: agent.id || agent.serialized?.id,
                    name: agent.name || agent.serialized?.name,
                    url: agent.url || agent.serialized?.url || agent.endpoint || agent.serialized?.endpoint
                }));

                setAgents(formattedAgents);
            } catch (error) {
                console.error('Error fetching agents:', error);
                message.error('Failed to fetch agents');
            } finally {
                setLoadingAgents(false);
            }
        };

        fetchStepRegistry();
        fetchAgents();
    }, []); // Only run once on mount

    // Update steps with display names when registry is loaded
    useEffect(() => {
        console.log('Registry update effect triggered:', {
            hasRegistry: Object.keys(stepRegistry).length > 0,
            stepsCount: steps.length,
            stepRegistry
        });

        if (Object.keys(stepRegistry).length > 0) {
            const updatedSteps = steps.map(step => {
                // Try different possible step ID properties
                const stepId = step.step || step.stepId || step.step_id;
                const registryStep = stepRegistry[stepId];

                if (registryStep) {
                    const displayName = extractStepName(registryStep.name || registryStep.type);
                    return {
                        ...step,
                        name: displayName
                    };
                }
                const fallbackName = extractStepName(stepId || step.id);
                return {
                    ...step,
                    name: fallbackName
                };
            });
            onStepsUpdate(updatedSteps);
        }
    }, [stepRegistry]); // Only run when stepRegistry changes

    const handleNodeDrag = useCallback((stepId: string, data: { x: number; y: number }) => {
        setNodePositions((prev: Record<string, NodePosition>) => ({
            ...prev,
            [stepId]: { x: data.x, y: data.y }
        }));
    }, []);

    const handleEditStep = (step: PipelineStep) => {
        setSelectedStep(step);
        const stepId = step.step || step.stepId || step.step_id;
        const registryStep = stepRegistry[stepId];

        if (registryStep) {
            // Initialize form with current parameter values
            const formValues: Record<string, any> = {};
            registryStep.parameters.forEach((param: StepParameter) => {
                formValues[param.key] = step.params[param.key] ?? param.default_value;
            });
            form.setFieldsValue(formValues);
        } else {
            // Try to set form with existing params if no registry step found
            form.setFieldsValue(step.params);
        }
        setEditModalVisible(true);
    };

    const handleSaveStep = async () => {
        if (!selectedStep) return;

        try {
            setSaving(true);
            const formValues = await form.validateFields();

            // Get step registry information to format parameters correctly
            const selectedStepId = selectedStep.step || selectedStep.stepId || selectedStep.step_id;
            const selectedRegistryStep = stepRegistry[selectedStepId];

            // Convert form values to backend expected format
            const params = selectedRegistryStep?.parameters?.map((param: StepParameter) => ({
                key: param.key,
                param_type: param.param_type,
                default_value: formValues[param.key] !== undefined ? formValues[param.key] : param.default_value,
                description: param.description || '',
                required: param.required
            })) || [];

            // Format payload according to backend expectations
            const updatePayload = {
                step_id: selectedStepId,
                order: selectedStep.order,
                params: params
            };

            // Update the step with new parameters
            const updatedStep = {
                ...selectedStep,
                params: formValues
            };

            // Update the pipeline step
            const core = getCore();
            await core.pipelines.updateStep(selectedStep.id, updatePayload);

            // Update local state
            const updatedSteps = steps.map(step =>
                step.id === selectedStep.id ? updatedStep : step
            );
            onStepsUpdate(updatedSteps);

            message.success('Step parameters updated successfully');
            setEditModalVisible(false);
            setSelectedStep(null);
        } catch (error) {
            message.error('Failed to update step parameters');
            console.error('Error updating step:', error);
        } finally {
            setSaving(false);
        }
    };

    const renderParameterInput = (param: StepParameter) => {
        const { key, param_type, description, required } = param;

        // Special handling for agent parameters
        if (selectedStep && key === 'agent_id') {
            const selectedStepId = selectedStep.step || selectedStep.stepId || selectedStep.step_id;
            const selectedRegistryStep = stepRegistry[selectedStepId];
            const isAgentType = selectedRegistryStep?.category?.toLowerCase().includes('agent');

            if (isAgentType) {
                return (
                    <Form.Item
                        key={key}
                        name={key}
                        label="Agent"
                        tooltip="Select an agent from the available agents"
                        rules={[{ required, message: 'Agent selection is required' }]}
                    >
                        <Select
                            placeholder="Select an agent"
                            loading={loadingAgents}
                            showSearch
                            optionFilterProp="children"
                            style={{ width: '100%' }}
                            onChange={(value: string, option: any) => {
                                // Agent URL will be handled internally by the system
                                // No need to manually set agent_url field
                            }}
                        >
                            {agents.map((agent: Agent) => (
                                <Select.Option key={agent.id} value={agent.id}>
                                    {agent.name || agent.id}
                                </Select.Option>
                            ))}
                        </Select>
                    </Form.Item>
                );
            }
        }

        // Skip agent_url parameter for agent types as it's handled internally
        if (selectedStep && key === 'agent_url') {
            const selectedStepId = selectedStep.step || selectedStep.stepId || selectedStep.step_id;
            const selectedRegistryStep = stepRegistry[selectedStepId];
            const isAgentType = selectedRegistryStep?.category?.toLowerCase().includes('agent');

            if (isAgentType) {
                return null; // Don't render agent_url for agent types
            }
        }

        switch (param_type) {
            case 'int':
            case 'integer':
                return (
                    <Form.Item
                        key={key}
                        name={key}
                        label={key}
                        tooltip={description}
                        rules={[{ required, message: `${key} is required` }]}
                    >
                        <InputNumber style={{ width: '100%' }} placeholder={description} />
                    </Form.Item>
                );

            case 'float':
            case 'number':
                return (
                    <Form.Item
                        key={key}
                        name={key}
                        label={key}
                        tooltip={description}
                        rules={[{ required, message: `${key} is required` }]}
                    >
                        <InputNumber
                            step={0.1}
                            style={{ width: '100%' }}
                            placeholder={description}
                        />
                    </Form.Item>
                );

            case 'bool':
            case 'boolean':
                return (
                    <Form.Item
                        key={key}
                        name={key}
                        label={key}
                        tooltip={description}
                        valuePropName="checked"
                    >
                        <Switch />
                    </Form.Item>
                );

            case 'string':
            default:
                return (
                    <Form.Item
                        key={key}
                        name={key}
                        label={key}
                        tooltip={description}
                        rules={[{ required, message: `${key} is required` }]}
                    >
                        <Input placeholder={description} />
                    </Form.Item>
                );
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
                        stroke="#1890ff"
                        strokeWidth={2}
                        markerEnd="url(#arrowhead)"
                    />
                );
            }
        }
        return lines;
    };

    const extractStepName = (stepType: string | undefined): string => {
        if (!stepType) {
            return 'Unknown';
        }
        const parts = stepType.split('.');
        if (parts.length > 1) {
            const extracted = parts[parts.length - 1].charAt(0).toUpperCase() + parts[parts.length - 1].slice(1);
            return extracted;
        }
        return stepType;
    };

    const getCategoryColor = (category: string): string => {
        const lowerCategory = category.toLowerCase();
        if (lowerCategory.includes('agent')) {
            return '#1890ff'; // Blue for Agent
        }
        if (lowerCategory.includes('processing')) {
            return '#52c41a'; // Green for processing
        }
        return '#8c8c8c'; // Default gray for other categories
    };

    const getStepDisplayName = (step: PipelineStep) => {

        // Use the name property if available (populated from registry)
        if (step.name) {
            return step.name;
        }

        // Fallback to registry lookup and extraction
        const stepId = step.step || step.stepId || step.step_id;
        const registryStep = stepRegistry[stepId];

        if (registryStep) {
            const displayName = extractStepName(registryStep.name || registryStep.type);
            return displayName;
        }

        const fallbackName = extractStepName(stepId || step.id);
        return fallbackName;
    };

    return (
        <div className="pipeline-node-editor" style={{ position: 'relative', height: '600px', overflow: 'auto' }}>
            <div ref={containerRef} style={{ position: 'relative', width: '100%', height: '100%' }}>
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
                    const stepId = step.step || step.stepId || step.step_id;
                    const registryStep = stepRegistry[stepId];

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
                                        border: '2px solid #1890ff',
                                        borderRadius: '8px',
                                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                                    }}
                                    title={
                                        <div className="drag-handle" style={{ cursor: 'move' }}>
                                            <Space>
                                                <Text strong>Step {index + 1}</Text>
                                                <LinkOutlined style={{ color: '#1890ff' }} />
                                            </Space>
                                        </div>
                                    }
                                    extra={
                                        <Tooltip title="Edit Parameters">
                                            <Button
                                                type="text"
                                                icon={<EditOutlined />}
                                                onClick={() => handleEditStep(step)}
                                                style={{ cursor: 'pointer' }}
                                            />
                                        </Tooltip>
                                    }
                                >
                                    <div style={{ pointerEvents: 'none' }}>
                                        <Text strong>{getStepDisplayName(step)}</Text>
                                        <br />
                                        <Text type="secondary" style={{ fontSize: '12px', color: getCategoryColor(registryStep?.category || 'Unknown') }}>
                                            {registryStep?.category || 'Unknown'}
                                        </Text>
                                        <br />
                                        <Text style={{ fontSize: '11px' }}>
                                            {Object.keys(step.params).length} parameters
                                        </Text>
                                    </div>
                                </Card>
                            </div>
                        </Draggable>
                    );
                })}
            </div>

            {/* Parameter Edit Modal */}
            <Modal
                title={
                    <Space>
                        <SettingOutlined />
                        <span>Edit Step Parameters</span>
                        {selectedStep && (
                            <Text type="secondary">
                                - {getStepDisplayName(selectedStep)}
                            </Text>
                        )}
                    </Space>
                }
                open={editModalVisible}
                onCancel={() => {
                    setEditModalVisible(false);
                    setSelectedStep(null);
                }}
                footer={[
                    <Button key="cancel" onClick={() => setEditModalVisible(false)}>
                        Cancel
                    </Button>,
                    <Button
                        key="save"
                        type="primary"
                        icon={<SaveOutlined />}
                        loading={saving}
                        onClick={handleSaveStep}
                    >
                        Save Parameters
                    </Button>
                ]}
                width={600}
                destroyOnClose
            >
                {selectedStep && (
                    <div>
                        {(() => {
                            const selectedStepId = selectedStep.step || selectedStep.stepId || selectedStep.step_id;
                            const selectedRegistryStep = stepRegistry[selectedStepId];
                            return selectedRegistryStep ? (
                                <>
                                    <Text type="secondary">
                                        {selectedRegistryStep.description}
                                    </Text>
                                    <Divider />
                                    <Form
                                        form={form}
                                        layout="vertical"
                                        preserve={false}
                                    >
                                        {selectedRegistryStep.parameters.map(renderParameterInput)}
                                     </Form>
                                 </>
                             ) : (
                                 <>
                                     <Text type="secondary">
                                         Edit parameters for {getStepDisplayName(selectedStep)}
                                     </Text>
                                     <Divider />
                                     <Form
                                         form={form}
                                         layout="vertical"
                                         preserve={false}
                                     >
                                         {/* Generic parameter editing when no registry step found */}
                                         {Object.keys(selectedStep.params).map(key => (
                                             <Form.Item
                                                 key={key}
                                                 name={key}
                                                 label={key}
                                             >
                                                 <Input placeholder={`Enter ${key}`} />
                                             </Form.Item>
                                         ))}
                                     </Form>
                                 </>
                             );
                         })()}
                    </div>
                )}
            </Modal>
        </div>
    );
}

export default React.memo(PipelineNodeEditor);