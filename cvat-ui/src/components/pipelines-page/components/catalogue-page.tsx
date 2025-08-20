import '../styles.scss';
import React, { useState, useEffect, useRef } from 'react';
import { Table, Typography, Button, Space, Tooltip, message, Modal } from 'antd';
import { useHistory, Switch, Route, useRouteMatch } from 'react-router-dom';
import { InfoCircleOutlined, PlayCircleOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import moment from 'moment';
import { getCore } from 'cvat-core-wrapper';
import pipelinePage from './pipeline-page';
import RunPipelineModal from './run-pipeline-modal';
import CreatePipelineModal from './create-pipeline-modal';

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

function CataloguePageComponent(): JSX.Element {
    const { path } = useRouteMatch();
    const history = useHistory();
    const [pipelines, setPipelines] = useState<Pipeline[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [runModalVisible, setRunModalVisible] = useState(false);
    const [selectedPipeline, setSelectedPipeline] = useState<Pipeline | null>(null);
    const [createModalVisible, setCreateModalVisible] = useState(false);
    
    // Use ref to persist across re-renders and localStorage for persistence
    const hasFetchedDataRef = useRef(false);
    const STORAGE_KEY = 'pipelines-catalogue-fetched';

    const handleRunPipeline = (pipeline: Pipeline) => {
        setSelectedPipeline(pipeline);
        setRunModalVisible(true);
    };

    const handleRunModalCancel = () => {
        setRunModalVisible(false);
        setSelectedPipeline(null);
    };

    const handleRunModalSuccess = () => {
        setRunModalVisible(false);
        setSelectedPipeline(null);
        message.success('Pipeline execution started successfully!');
    };

    const handleCreatePipeline = () => {
        setCreateModalVisible(true);
    };

    const handleCreateModalCancel = () => {
        setCreateModalVisible(false);
    };

    const handleCreateModalSuccess = () => {
        setCreateModalVisible(false);
        message.success('Pipeline created successfully!');
        // Refresh the pipelines list to get the newly created pipeline
        fetchPipelines();
    };

    const handleDeletePipeline = (pipeline: Pipeline) => {
        Modal.confirm({
            title: 'Delete Pipeline',
            content: `Are you sure you want to delete the pipeline "${pipeline.name}"? This action cannot be undone.`,
            okText: 'Delete',
            okType: 'danger',
            cancelText: 'Cancel',
            onOk: async () => {
                try {
                    const core = getCore();
                    await core.pipelines.delete(pipeline.id);
                    message.success('Pipeline deleted successfully!');
                    
                    // Update local state and cache
                    const updatedPipelines = pipelines.filter(p => p.id !== pipeline.id);
                    setPipelines(updatedPipelines);
                    localStorage.setItem('pipelines-catalogue-data', JSON.stringify(updatedPipelines));
                } catch (error) {
                    message.error('Failed to delete pipeline');
                    console.error('Error deleting pipeline:', error);
                }
            },
        });
    };

    const fetchPipelines = async () => {
        try {
            setLoading(true);
            const core = getCore();
            const pipelinesResponse = await core.pipelines.list();
            setPipelines(pipelinesResponse.results);
            
            // Cache the data
            localStorage.setItem('pipelines-catalogue-data', JSON.stringify(pipelinesResponse.results));
            hasFetchedDataRef.current = true;
            localStorage.setItem(STORAGE_KEY, 'true');
        } catch (error) {
            message.error('Failed to fetch pipelines');
            console.error('Error fetching pipelines:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const loadData = async () => {
            // Check if we've already fetched data in this session or from localStorage
            if (hasFetchedDataRef.current || localStorage.getItem(STORAGE_KEY) === 'true') {
                // Try to restore data from localStorage if we have it
                const cachedPipelines = localStorage.getItem('pipelines-catalogue-data');
                if (cachedPipelines) {
                    try {
                        const parsedPipelines = JSON.parse(cachedPipelines);
                        setPipelines(parsedPipelines);
                        setLoading(false);
                        return;
                    } catch (error) {
                        console.warn('Failed to parse cached pipelines, fetching fresh data');
                    }
                }
                return;
            }

            // Only fetch pipelines if we haven't fetched them before
            await fetchPipelines();
        };
        
        loadData();
        
        // Cleanup function
        return () => {
            // Don't clear the ref or localStorage on unmount
            // This allows the data to persist across route changes
        };
    }, []); // Empty dependency array is fine now since we use ref and localStorage

    const columns = [
        {
            title: 'Name',
            dataIndex: 'name',
            key: 'name',
            render: (text: string, record: Pipeline) => (
                <Typography.Link onClick={() => history.push(`/pipelines/catalogue/pipeline/${record.id}`)}>
                    {text}
                </Typography.Link>
            ),
        },
        {
            title: 'Description',
            dataIndex: 'description',
            key: 'description',
            ellipsis: true,
        },
        {
            title: 'Usage',
            key: 'usage',
            render: (record: Pipeline) => (
                <span>{record.usageCount} / {record.usageLimit}</span>
            ),
        },
        {
            title: 'Created',
            dataIndex: 'createdAt',
            key: 'createdAt',
            render: (date: string) => moment(date).format('YYYY-MM-DD'),
        },
        {
            title: 'Updated',
            dataIndex: 'updatedAt',
            key: 'updatedAt',
            render: (date: string) => moment(date).format('YYYY-MM-DD'),
        },
        {
            title: 'Public',
            dataIndex: 'isPublic',
            key: 'isPublic',
            render: (isPublic: boolean) => (isPublic ? 'Yes' : 'No'),
        },
        {
            title: 'Actions',
            key: 'actions',
            render: (record: Pipeline) => (
                <Space size='middle'>
                    <Tooltip title='View Details'>
                        <Button
                            type='text'
                            icon={<InfoCircleOutlined />}
                            onClick={() => history.push(`/pipelines/catalogue/pipeline/${record.id}`)}
                        />
                    </Tooltip>
                    <Tooltip title='Run Pipeline'>
                        <Button
                            type='text'
                            icon={<PlayCircleOutlined />}
                            onClick={() => handleRunPipeline(record)}
                        />
                    </Tooltip>
                    <Tooltip title='Delete Pipeline'>
                        <Button
                            type='text'
                            danger
                            icon={<DeleteOutlined />}
                            onClick={() => handleDeletePipeline(record)}
                        />
                    </Tooltip>
                </Space>
            ),
        },
    ];

    return (
        <div className='dataup-catalogue-page'>
            <Switch>
                <Route path={`${path}/pipeline/:pid`} component={pipelinePage} />
                <Route path={path}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '16px 0' }}>
                        <Typography.Title level={4} style={{ margin: 0 }}>
                            Pipelines Catalogue
                        </Typography.Title>
                        <Button
                            type="primary"
                            icon={<PlusOutlined />}
                            onClick={handleCreatePipeline}
                        >
                            Create Pipeline
                        </Button>
                    </div>
                    <Table
                        dataSource={pipelines}
                        columns={columns}
                        rowKey='id'
                        pagination={{ pageSize: 10 }}
                        loading={loading}
                    />
                    <RunPipelineModal
                        visible={runModalVisible}
                        pipeline={selectedPipeline}
                        onCancel={handleRunModalCancel}
                        onSuccess={handleRunModalSuccess}
                    />
                    <CreatePipelineModal
                        visible={createModalVisible}
                        onCancel={handleCreateModalCancel}
                        onSuccess={handleCreateModalSuccess}
                    />
                </Route>
            </Switch>
        </div>
    );
}

export default React.memo(CataloguePageComponent);
