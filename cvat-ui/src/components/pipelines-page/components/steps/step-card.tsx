import React from 'react';
import { Card, Typography, Tag, Badge, Button, Space, Tooltip } from 'antd';
import { 
    SettingOutlined, 
    InfoCircleOutlined, 
    CodeOutlined,
    ExperimentOutlined,
    ToolOutlined,
    ExportOutlined,
    RobotOutlined,
    DatabaseOutlined
} from '@ant-design/icons';
import { PipelineStep, CATEGORY_COLORS } from './types';

const { Title, Text, Paragraph } = Typography;

interface StepCardProps {
    step: PipelineStep;
    onStepClick: (step: PipelineStep) => void;
}

const getCategoryColor = (category: string): string => {
    return CATEGORY_COLORS[category] || '#d9d9d9';
};

const getCategoryIcon = (category: string) => {
    switch (category.toLowerCase()) {
        case 'agent':
            return <RobotOutlined />;
        case 'processing':
            return <ToolOutlined />;
        case 'analysis':
            return <ExperimentOutlined />;
        case 'export':
            return <ExportOutlined />;
        case 'adapter':
            return <DatabaseOutlined />;
        default:
            return <CodeOutlined />;
    }
};

const getCategoryGradient = (category: string): string => {
    switch (category.toLowerCase()) {
        case 'agent':
            return 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
        case 'processing':
            return 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)';
        case 'analysis':
            return 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)';
        case 'export':
            return 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)';
        case 'adapter':
            return 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)';
        default:
            return 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)';
    }
};

const extractStepName = (stepType: string): string => {
    const parts = stepType.split('.');
    if (parts.length > 1) {
        return parts[parts.length - 1].charAt(0).toUpperCase() + parts[parts.length - 1].slice(1);
    }
    return stepType;
};

const StepCard: React.FC<StepCardProps> = ({ step, onStepClick }) => {
    const [isHovered, setIsHovered] = React.useState(false);

    // Add CSS styles for hover effects
    React.useEffect(() => {
        const style = document.createElement('style');
        style.textContent = `
            .step-card-modern:hover {
                transform: translateY(-2px);
                box-shadow: 0 8px 25px rgba(0, 0, 0, 0.12);
            }
            .step-card-modern .hover-overlay {
                transition: opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            }
        `;
        document.head.appendChild(style);
        
        return () => {
            document.head.removeChild(style);
        };
    }, []);

    return (
        <Card
            hoverable
            className="step-card-modern"
            onClick={() => onStepClick(step)}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            style={{
                borderRadius: '16px',
                border: 'none',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                overflow: 'hidden',
                position: 'relative'
            }}
            styles={{
                body: {
                    padding: '24px',
                    position: 'relative'
                }
            }}
        >
            {/* Background gradient overlay - only show on hover */}
            {isHovered && (
                <div
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        height: '4px',
                        background: getCategoryGradient(step.category),
                        borderRadius: '16px 16px 0 0',
                        transition: 'opacity 0.3s ease-in-out',
                        zIndex: 1
                    }}
                />
            )}

        {/* Category header */}
        <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
                <div
                    style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '8px',
                        background: getCategoryGradient(step.category),
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: '12px',
                        color: 'white',
                        fontSize: '16px'
                    }}
                >
                    {getCategoryIcon(step.category)}
                </div>
                <Tag
                    style={{
                        borderRadius: '20px',
                        border: 'none',
                        fontWeight: '600',
                        fontSize: '11px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        background: '#f3f4f6',
                        color: '#6b7280'
                    }}
                >
                    {step.category.toUpperCase()}
                </Tag>
            </div>
            
            <Title 
                level={4} 
                style={{ 
                    margin: 0, 
                    color: '#1f2937',
                    fontWeight: '700',
                    fontSize: '18px',
                    lineHeight: '1.3'
                }}
            >
                {extractStepName(step.type)}
            </Title>
            
            {/* {step.description && (
                <Text 
                    type="secondary" 
                    style={{ 
                        fontSize: '14px',
                        lineHeight: '1.5',
                        color: '#6b7280',
                        display: 'block',
                        marginTop: '8px'
                    }}
                >
                    {step.description.length > 80 
                        ? `${step.description.substring(0, 80)}...` 
                        : step.description
                    }
                </Text>
            )} */}
        </div>

        {/* Parameters section */}
        {/* <div style={{ 
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
                    count={step.parameters.length} 
                    style={{ 
                        backgroundColor: '#6b7280',
                        borderRadius: '12px',
                        minWidth: '24px',
                        height: '24px',
                        lineHeight: '24px',
                        fontSize: '12px',
                        fontWeight: '600'
                    }}
                />
            </div>
            
            {step.parameters.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {step.parameters.slice(0, 3).map((param, index) => (
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
                    {step.parameters.length > 3 && (
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
                            +{step.parameters.length - 3} more
                        </Tag>
                    )}
                </div>
            )}
        </div> */}

        {/* Action buttons */}
        {/* <div style={{ display: 'flex', gap: '8px' }}>
            <Button
                type="primary"
                icon={<InfoCircleOutlined />}
                onClick={(e) => {
                    e.stopPropagation();
                    onStepClick(step);
                }}
                style={{
                    flex: 1,
                    borderRadius: '10px',
                    height: '40px',
                    fontWeight: '600',
                    background: '#6b7280',
                    border: 'none',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)'
                }}
            >
                Details
            </Button>
            <Button
                type="default"
                icon={<SettingOutlined />}
                style={{
                    flex: 1,
                    borderRadius: '10px',
                    height: '40px',
                    fontWeight: '600',
                    border: '2px solid #6b7280',
                    color: '#6b7280',
                    background: 'transparent'
                }}
            >
                Configure
            </Button>
        </div> */}

        {/* Hover effect overlay */}
        <div
            style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: getCategoryGradient(step.category),
                opacity: isHovered ? 0.05 : 0,
                transition: 'opacity 0.3s ease',
                borderRadius: '16px',
                pointerEvents: 'none'
            }}
            className="hover-overlay"
        />
        </Card>
    );
};

export default React.memo(StepCard);