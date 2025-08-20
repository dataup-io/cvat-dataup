import '../styles.scss';
import React, { useState, useEffect } from 'react';
import Typography from 'antd/lib/typography';
import Card from 'antd/lib/card';
import Descriptions from 'antd/lib/descriptions';
import Tag from 'antd/lib/tag';
import Divider from 'antd/lib/divider';
import message from 'antd/lib/message';
import Button from 'antd/lib/button';
import Space from 'antd/lib/space';
import { NodeIndexOutlined, UnorderedListOutlined } from '@ant-design/icons';
import moment from 'moment';
import { getCore } from 'cvat-core-wrapper';
import PipelineNodeEditor from './pipeline-node-editor';

interface PipelineStep {
    id: string;
    pipeline: string;
    step: string;
    order: number;
    params: Record<string, any>;
    created_at: string;
    updated_at: string;
}

interface Pipeline {
    id: string;
    name: string;
    description: string;
    usageLimit: number;
    usageCount: number;
    createdAt: string;
    updatedAt: string;
    steps: PipelineStep[];
    isPublic: boolean;
}

interface PipelineDetailsProps {
    pipelineId: string;
}

function PipelineDetailsComponent({ pipelineId }: PipelineDetailsProps): React.ReactElement {
    const [pipeline, setPipeline] = useState<Pipeline | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [viewMode, setViewMode] = useState<'nodes' | 'list'>('nodes');

    useEffect(() => {
        const fetchPipelineDetails = async () => {
            try {
                const core = getCore();
                const pipelineData = await core.pipelines.get(pipelineId);
                setPipeline(pipelineData);
            } catch (error) {
                message.error('Failed to fetch pipeline details');
                console.error('Error fetching pipeline details:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchPipelineDetails();
    }, [pipelineId]);

    const handleStepsUpdate = (updatedSteps: PipelineStep[]) => {
        if (pipeline) {
            setPipeline({
                ...pipeline,
                steps: updatedSteps
            });
        }
    };

    if (loading) {
        return <div>Loading pipeline details...</div>;
    }

    if (!pipeline) {
        return <div>Pipeline not found</div>;
    }


    return (
        <div className='dataup-pipeline-details'>
            <Card loading={loading}>
                <Descriptions title={pipeline.name} bordered>
                    <Descriptions.Item label="ID" span={3}>{pipeline.id}</Descriptions.Item>
                    <Descriptions.Item label="Description" span={3}>{pipeline.description}</Descriptions.Item>
                    <Descriptions.Item label="Usage">{pipeline.usageCount} / {pipeline.usageLimit}</Descriptions.Item>
                    <Descriptions.Item label="Created">{moment(pipeline.createdAt).format('YYYY-MM-DD HH:mm:ss')}</Descriptions.Item>
                    <Descriptions.Item label="Updated">{moment(pipeline.updatedAt).format('YYYY-MM-DD HH:mm:ss')}</Descriptions.Item>
                    <Descriptions.Item label="Public">
                        <Tag color={pipeline.isPublic ? 'green' : 'red'}>
                            {pipeline.isPublic ? 'Yes' : 'No'}
                        </Tag>
                    </Descriptions.Item>
                </Descriptions>

                <Divider orientation="left">
                    <Space>
                        Pipeline Steps
                        <Space.Compact>
                            <Button
                                type={viewMode === 'nodes' ? 'primary' : 'default'}
                                icon={<NodeIndexOutlined />}
                                onClick={() => setViewMode('nodes')}
                                size="small"
                            >
                                Node View
                            </Button>
                            <Button
                                type={viewMode === 'list' ? 'primary' : 'default'}
                                icon={<UnorderedListOutlined />}
                                onClick={() => setViewMode('list')}
                                size="small"
                            >
                                List View
                            </Button>
                        </Space.Compact>
                    </Space>
                </Divider>

                {viewMode === 'nodes' ? (
                    <PipelineNodeEditor
                        pipelineId={pipelineId}
                        steps={pipeline.steps}
                        onStepsUpdate={handleStepsUpdate}
                    />
                ) : (
                    <div>
                        {pipeline.steps.map((step: PipelineStep, index: number) => (
                            <Card key={step.id} size="small" style={{ marginBottom: 16 }}>
                                <Descriptions size="small" column={1} title={`Step ${index + 1}`}>
                                    <Descriptions.Item label="ID">{step.id}</Descriptions.Item>
                                    <Descriptions.Item label="Type">{step.step}</Descriptions.Item>
                                    <Descriptions.Item label="Order">{step.order}</Descriptions.Item>
                                    <Descriptions.Item label="Parameters">
                                        <pre style={{ fontSize: '12px', maxHeight: '200px', overflow: 'auto' }}>
                                            {JSON.stringify(step.params, null, 2)}
                                        </pre>
                                    </Descriptions.Item>
                                </Descriptions>
                            </Card>
                        ))}
                    </div>
                )}
            </Card>
        </div>
    );
}

export default React.memo(PipelineDetailsComponent);