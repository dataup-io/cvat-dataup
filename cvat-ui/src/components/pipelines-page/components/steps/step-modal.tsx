import React from 'react';
import { Modal, Typography, Badge, Button, Collapse, Tag } from 'antd';
import { SettingOutlined } from '@ant-design/icons';
import { PipelineStep, CATEGORY_COLORS, PARAMETER_TYPE_COLORS } from './types';

const { Text, Paragraph, Title } = Typography;
const { Panel } = Collapse;

interface StepModalProps {
    selectedStep: PipelineStep | null;
    isModalVisible: boolean;
    onModalClose: () => void;
}

const getCategoryColor = (category: string): string => {
    return CATEGORY_COLORS[category] || '#d9d9d9';
};

const getParameterTypeColor = (type: string): string => {
    return PARAMETER_TYPE_COLORS[type] || 'default';
};

const renderParameterValue = (value: any) => {
    if (value === null || value === undefined) {
        return <Text type="secondary">null</Text>;
    }
    if (typeof value === 'boolean') {
        return <Text code>{value.toString()}</Text>;
    }
    if (typeof value === 'string') {
        return <Text code>"{value}"</Text>;
    }
    return <Text code>{JSON.stringify(value)}</Text>;
};

const StepModal: React.FC<StepModalProps> = ({ selectedStep, isModalVisible, onModalClose }) => (
    <Modal
        title={selectedStep?.name}
        open={isModalVisible}
        onCancel={onModalClose}
        footer={[
            <Button key="close" onClick={onModalClose}>
                Close
            </Button>,
            <Button key="configure" type="primary" icon={<SettingOutlined />}>
                Configure Step
            </Button>
        ]}
        width={800}
    >
        {selectedStep && (
            <div>
                <div style={{ marginBottom: 16 }}>
                    <Badge
                        color={getCategoryColor(selectedStep.category)}
                        text={selectedStep.category.toUpperCase()}
                    />
                    <Text code style={{ marginLeft: 8 }}>
                        {selectedStep.type}
                    </Text>
                </div>

                <Paragraph>
                    {selectedStep.description || 'No description available'}
                </Paragraph>
                <div style={{ 
            marginBottom: '24px',
            padding: '16px',
            background: '#f8fafc',
            borderRadius: '12px',
            border: '1px solid #e2e8f0'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <Text strong style={{ color: '#374151', fontSize: '14px' }}>
                    Parameters
                </Text>
                <Badge 
                    count={selectedStep.parameters.length} 
                    style={{ 
                        backgroundColor: getCategoryColor(selectedStep.category),
                        borderRadius: '12px',
                        minWidth: '24px',
                        height: '24px',
                        lineHeight: '24px',
                        fontSize: '12px',
                        fontWeight: '600'
                    }}
                />
            </div>
            
            {selectedStep.parameters.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {selectedStep.parameters.slice(0, 3).map((param, index) => (
                        <Tag
                            key={index}
                            style={{
                                borderRadius: '6px',
                                fontSize: '11px',
                                padding: '2px 8px',
                                background: '#e0e7ff',
                                color: '#3730a3',
                                border: 'none',
                                fontWeight: '500'
                            }}
                        >
                            {param.key}
                        </Tag>
                    ))}
                    {selectedStep.parameters.length > 3 && (
                        <Tag
                            style={{
                                borderRadius: '6px',
                                fontSize: '11px',
                                padding: '2px 8px',
                                background: '#f3f4f6',
                                color: '#6b7280',
                                border: 'none'
                            }}
                        >
                            +{selectedStep.parameters.length - 3} more
                        </Tag>
                    )}
                </div>
            )}
        </div>
                {/* <Title level={5}>Parameters</Title> */}
                {selectedStep.parameters.length > 0 ? (
                    <Collapse ghost>
                        {selectedStep.parameters.map((param, index) => (
                            <Panel
                                key={`${param.key}-${index}`}
                                header={
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <Text strong>{param.key}</Text>
                                        <Tag color={getParameterTypeColor(param.param_type)}>
                                            {param.param_type}
                                        </Tag>
                                    </div>
                                }
                            >
                                <div>
                                    <Text strong>Default Value: </Text>
                                    {renderParameterValue(param.default_value)}
                                </div>
                            </Panel>
                        ))}
                    </Collapse>
                ) : (
                    <Text type="secondary">No parameters required</Text>
                )}
            </div>
        )}
    </Modal>
);

export default React.memo(StepModal);