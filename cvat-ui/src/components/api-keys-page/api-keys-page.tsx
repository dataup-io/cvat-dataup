// Copyright (C) 2024 CVAT.ai Corporation
//
// SPDX-License-Identifier: MIT

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSelector } from 'react-redux';
import { Button, Card, Form, Input, Modal, Space, Typography, Popconfirm, Badge, Table, Switch, App } from 'antd';
import {
    PlusOutlined,
    EyeOutlined,
    EyeInvisibleOutlined,
    CopyOutlined,
    DeleteOutlined,
    KeyOutlined
} from '@ant-design/icons';

import { getCore } from 'cvat-core-wrapper';
import { CombinedState } from 'reducers';
import './styles.scss';

const { TextArea } = Input;
const { Text, Title } = Typography;
const core = getCore();

interface ApiKey {
    id: string;
    name: string;
    key: string;
    createdAt: string;
    lastUsed?: string;
    organization?: number;
    allowed_roles?: string[];
    label?: string;
    default?: boolean;
    owner_name?: string;
}

interface CreateKeyFormValues {
    name: string;
    key: string;
    description?: string;
}

const ApiKeysPage: React.FC = () => {
    const { message } = App.useApp();
    const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [form] = Form.useForm<CreateKeyFormValues>();
    const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(false);

    // Use ref to persist across re-renders and localStorage for persistence
    const hasFetchedDataRef = useRef(false);
    const currentOrganization = useSelector((state: CombinedState) => state.organizations.current);
    const currentUser = useSelector((state: CombinedState) => state.auth.user);

    // Create organization and user-specific cache keys to prevent cross-user data leakage
    const cacheIdentifier = currentOrganization?.slug || `personal-${currentUser?.id || 'anonymous'}`;
    const STORAGE_KEY = `api-keys-fetched-${cacheIdentifier}`;
    const CACHE_KEY = `api-keys-data-${cacheIdentifier}`;

    const loadApiKeys = useCallback(async (forceRefresh = false) => {
        // Check if we should use cached data (not forcing refresh and cache is valid)
        if (!forceRefresh) {
            const cachedApiKeys = localStorage.getItem(CACHE_KEY);
            if (cachedApiKeys) {
                try {
                    const parsedKeys = JSON.parse(cachedApiKeys);
                    console.log('Using cached API keys data for:', cacheIdentifier);
                    setApiKeys(parsedKeys);
                    hasFetchedDataRef.current = true;
                    return;
                } catch (error) {
                    console.warn('Failed to parse cached API keys, fetching fresh data');
                }
            }
        }

        setLoading(true);
        try {
            // Load API keys
            const result = await core.dataupApiKeys.get();
            const keys = Array.isArray(result) ? result : (result?.results || []);
            const formattedKeys = (keys || []).map((key: any) => ({
                id: key?.id || '',
                name: key?.name || '',
                key: key?.preview || '',
                createdAt: key?.created_date || key?.created_at || '',
                lastUsed: key?.last_used || key?.last_used_at,
                organization: key?.organization,
                allowed_roles: key?.allowed_roles || [],
                label: key?.label,
                default: key?.default || false,
                owner_name: key?.owner_name
            }));
            setApiKeys(formattedKeys || []);
            localStorage.setItem(CACHE_KEY, JSON.stringify(formattedKeys)); // Cache data with org-specific key
            hasFetchedDataRef.current = true;
            localStorage.setItem(STORAGE_KEY, 'true'); // Mark as fetched for this session
        } catch (error) {
            console.error('Failed to load API keys:', error);
            message.error('Failed to load API keys');
            setApiKeys([]);
        } finally {
            setLoading(false);
        }
    }, [CACHE_KEY, STORAGE_KEY, cacheIdentifier]);

    // Clear cache when organization or user changes
    useEffect(() => {
        // Clear any old cache entries from other organizations/users
        const allKeys = Object.keys(localStorage);
        allKeys.forEach(key => {
            if ((key.startsWith('api-keys-data-') || key.startsWith('api-keys-fetched-')) &&
                key !== CACHE_KEY && key !== STORAGE_KEY) {
                localStorage.removeItem(key);
            }
        });

        // Reset fetch state when organization or user changes
        hasFetchedDataRef.current = false;
        setApiKeys([]);
    }, [cacheIdentifier, CACHE_KEY, STORAGE_KEY]);

    useEffect(() => {
        loadApiKeys();
    }, [loadApiKeys]);

    const handleDefaultToggle = useCallback(async (keyId: string, isDefault: boolean) => {
        try {
            await core.dataupApiKeys.update(keyId, { default: isDefault });

            // Force refresh the data to ensure we have the latest state
            await loadApiKeys(true);

            message.success(`API key ${isDefault ? 'set as' : 'removed from'} default successfully!`);
        } catch (error) {
            console.error('Failed to update API key default status:', error);
            message.error('Failed to update API key default status');
        }
    }, [loadApiKeys]);

    const showModal = () => {
        setIsModalVisible(true);
    };

    const handleCancel = () => {
        setIsModalVisible(false);
        form.resetFields();
    };

    const handleCreateKey = useCallback(async (values: CreateKeyFormValues) => {
        setLoading(true);
        try {
            const keyData = {
                name: values.name,
                key: values.key,
                label: values.description
            };

            const newKey = await core.dataupApiKeys.create(keyData);

            const formattedKey: ApiKey = {
                id: newKey?.id || '',
                name: newKey?.name || '',
                key: newKey?.key || '',
                createdAt: newKey?.created_date || newKey?.created_at || '',
                lastUsed: newKey?.last_used || newKey?.last_used_at,
                organization: newKey?.organization,
                allowed_roles: newKey?.allowed_roles || [],
                label: newKey?.label,
                default: newKey?.default || false,
                owner_name: newKey?.owner_name
            };

            // Force refresh the data to ensure we have the latest state
            await loadApiKeys(true);

            setIsModalVisible(false);
            form.resetFields();
            message.success('API key created successfully!');
        } catch (error) {
            console.error('Failed to create API key:', error);
            message.error('Failed to create API key');
        } finally {
            setLoading(false);
        }
    }, [form, apiKeys]);

    const handleDeleteKey = useCallback(async (keyId: string) => {
        setLoading(true);
        try {
            await core.dataupApiKeys.delete(keyId);

            // Force refresh the data to ensure we have the latest state
            await loadApiKeys(true);

            setVisibleKeys((prev: Set<string>) => {
                const newSet = new Set(prev);
                newSet.delete(keyId);
                return newSet;
            });
            message.success('API key deleted successfully!');
        } catch (error) {
            console.error('Failed to delete API key:', error);
            message.error('Failed to delete API key');
        } finally {
            setLoading(false);
        }
    }, [loadApiKeys]);

    const toggleKeyVisibility = useCallback((keyId: string) => {
        setVisibleKeys((prev: Set<string>) => {
            const newSet = new Set(prev);
            if (newSet.has(keyId)) {
                newSet.delete(keyId);
            } else {
                newSet.add(keyId);
            }
            return newSet;
        });
    }, []);

    const copyToClipboard = useCallback(async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            message.success('API key copied to clipboard!');
        } catch (error) {
            message.error('Failed to copy to clipboard');
        }
    }, []);

    const maskKey = useCallback((key: string): string => {
        if (!key || typeof key !== 'string') return '****';
        if (key.length <= 8) return '*'.repeat(key.length);
        return `${key.substring(0, 4)}${'*'.repeat(key.length - 8)}${key.substring(key.length - 4)}`;
    }, []);

    const formatDate = useCallback((dateString: string): string => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }, []);

    const getTableColumns = () => [
        {
            title: 'Name',
            dataIndex: 'name',
            key: 'name',
            render: (text: string, record: ApiKey) => (
                <Text strong>{record.name}</Text>
            ),
        },
        {
            title: 'Status',
            key: 'status',
            render: (text: string, record: ApiKey) => (
                <Badge
                    color="green"
                    text="Active"
                />
            ),
        },
        {
            title: 'Key',
            key: 'key',
            render: (text: string, record: ApiKey) => (
                <Text
                    code
                    className={visibleKeys.has(record.id) ? 'visible-key' : 'masked-key'}
                    style={{ fontSize: '12px' }}
                >
                    {visibleKeys.has(record.id) ? record.key : maskKey(record.key)}
                </Text>
            ),
        },
        {
            title: 'Created At',
            key: 'createdAt',
            render: (text: string, record: ApiKey) => (
                <Text type="secondary">
                    {formatDate(record.createdAt)}
                </Text>
            ),
        },
        {
            title: 'Owner',
            key: 'owner',
            render: (text: string, record: ApiKey) => (
                <Text>
                    {record.owner_name || 'Unknown'}
                </Text>
            ),
        },
        {
            title: 'Default',
            key: 'default',
            render: (text: string, record: ApiKey) => (
                <Switch
                    checked={record.default || false}
                    onChange={(checked) => handleDefaultToggle(record.id, checked)}
                    size="small"
                />
            ),
        },
        {
            title: 'Actions',
            key: 'actions',
            render: (text: string, record: ApiKey) => (
                <Space>
                    <Button
                        type="text"
                        size="small"
                        icon={visibleKeys.has(record.id) ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                        onClick={() => toggleKeyVisibility(record.id)}
                        title={visibleKeys.has(record.id) ? 'Hide key' : 'Show key'}
                    />
                    <Button
                        type="text"
                        size="small"
                        icon={<CopyOutlined />}
                        onClick={() => copyToClipboard(record.key)}
                        title="Copy to clipboard"
                    />
                    <Popconfirm
                        title="Delete API Key"
                        description="Are you sure you want to delete this API key? This action cannot be undone."
                        onConfirm={() => handleDeleteKey(record.id)}
                        okText="Delete"
                        cancelText="Cancel"
                        okButtonProps={{ danger: true }}
                    >
                        <Button
                            type="text"
                            size="small"
                            danger
                            icon={<DeleteOutlined />}
                            title="Delete key"
                        />
                    </Popconfirm>
                </Space>
            ),
        },
    ];



    return (
        <div className="api-keys-page" style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
            {/* Header */}
            <div className="page-header" style={{ marginBottom: '40px' }}>
                <div className="header-content">
                    <Title level={2} style={{ margin: 0 }}>API keys</Title>
                    <Text type="secondary" className="subtitle">
                        Manage your API keys for programmatic access to CVAT
                    </Text>
                </div>
                <div className="header-actions">
                    <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={showModal}
                        size="large"
                        aria-label="Add API key"
                        style={{ borderRadius: 6, padding: '0 14px' }}
                    />
                </div>
            </div>


            {/* API Keys Section */}
            {apiKeys && apiKeys.length > 0 && (
                <div className="keys-section" style={{ marginTop: '16px', marginBottom: '32px' }}>

                    <Card className="api-keys-table-container" style={{ marginTop: 16 }}>
                        <Table
                            columns={getTableColumns()}
                            dataSource={apiKeys}
                            rowKey="id"
                            pagination={false}
                            showHeader={true}
                            size="middle"
                        />
                    </Card>
                </div>
            )}

            {/* Empty State */}
            {(!apiKeys || apiKeys.length === 0) && (
                <Card
                    className="empty-state"
                    style={{
                        textAlign: 'center',
                        padding: '32px'
                    }}
                >
                    <div style={{
                        width: '64px',
                        height: '64px',
                        background: '#1890ff20',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 24px'
                    }}>
                        <KeyOutlined style={{ color: '#1890ff', fontSize: '32px' }} />
                    </div>
                    <Title level={3} style={{ marginBottom: '12px' }}>Get Started with API Keys</Title>
                    <Text type="secondary" style={{ display: 'block', marginBottom: '24px', maxWidth: '400px', margin: '0 auto 24px' }}>
                        API keys provide secure access to CVAT services. Create your first key to start building with our platform.
                    </Text>
                    <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={showModal}
                        size="large"
                    >
                        Create Your First API Key
                    </Button>
                </Card>
            )}


            <Modal
                title="Add API Key"
                open={isModalVisible}
                onCancel={handleCancel}
                className="create-key-modal"
                footer={[
                    <Button key="cancel" onClick={handleCancel}>
                        Cancel
                    </Button>,
                    <Button
                        key="create"
                        type="primary"
                        loading={loading}
                        onClick={() => form.submit()}
                    >
                        Add Key
                    </Button>,
                ]}
            >
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleCreateKey}
                >
                    <Form.Item
                        name="name"
                        label="Key Name"
                        rules={[
                            { required: true, message: 'Please enter a name for your API key' },
                            { min: 3, message: 'Name must be at least 3 characters long' },
                            { max: 50, message: 'Name must be less than 50 characters' }
                        ]}
                    >
                        <Input placeholder="e.g., Development Key, Production API" />
                    </Form.Item>



                    <Form.Item
                        name="key"
                        label="API Key"
                        rules={[
                            { required: true, message: 'Please enter the API key' }
                        ]}
                    >
                        <TextArea
                            rows={3}
                            placeholder="Paste the API key from another backend"
                        />
                    </Form.Item>

                    <Form.Item
                        name="description"
                        label="Description (Optional)"
                    >
                        <TextArea
                            rows={3}
                            placeholder="Describe what this API key will be used for..."
                            maxLength={200}
                        />
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
}

export default ApiKeysPage;