// Copyright (C) 2020-2022 Intel Corporation
// Copyright (C) CVAT.ai Corporation
//
// SPDX-License-Identifier: MIT

import React, { useMemo, useCallback } from 'react';
import moment from 'moment';
import Button from 'antd/lib/button';
import Table from 'antd/lib/table';
import Tag from 'antd/lib/tag';

import { EditOutlined, DeleteOutlined } from '@ant-design/icons';
import Text from 'antd/lib/typography/Text';
import type { ColumnsType, TableProps } from 'antd/es/table';

interface MLModel {
    id: number | string;
    name: string;
    url: string;
    provider: string;
    publisher: string;
    type: string;
    createdDate: string;
    updatedDate: string;
    owner: string;
    description: string;
    rate_limit?: number;
    is_public?: boolean;
}

type AgentType = 'detector' | 'interactor' | 'tracker';

const AGENT_TYPE_COLORS: Record<AgentType, string> = {
    detector: 'green',
    interactor: 'orange',
    tracker: 'purple',
} as const;



interface ApisTableProps {
    apis: MLModel[];
    total: number;
    nextCursor: string | null;
    previousCursor: string | null;
    onPageChange: (direction: 'next' | 'previous') => void;
    onEditApi: (api: MLModel) => void;
    onDeleteApi: (apiId: number | string) => void;
    fetching: boolean;
}

function ApisTableComponent(props: ApisTableProps): JSX.Element {
    const {
        apis,
        total,
        nextCursor,
        previousCursor,
        onPageChange,
        onEditApi,
        onDeleteApi,
        fetching,
    } = props;

    const getTypeColor = useCallback((agentType: string): string => {
        const normalizedType = agentType.toLowerCase() as AgentType;
        return AGENT_TYPE_COLORS[normalizedType] || 'default';
    }, []);

    const formatDate = useCallback((date: string): string => {
        return moment(date).format('MMMM Do YYYY');
    }, []);



    const formatPublisher = useCallback((publisher: string): string => {
        // Map publisher values to display names
        // Include removed publishers (dataup, zinkiai) for existing agents
        const publisherMap: Record<string, string> = {
            'dataup': 'DataUp',
            'zinkiai': 'ZinkiAI',
            'huggingface': 'HuggingFace',
            'roboflow': 'Roboflow',
            'ultralytics': 'Ultralytics',
            'landingai': 'LandingAI',
            'custom': 'Custom',
        };
        return publisherMap[publisher?.toLowerCase()] || publisher || 'Unknown';
    }, []);

    const handleEditClick = useCallback((record: MLModel) => {
        onEditApi(record);
    }, [onEditApi]);

    const handleDeleteClick = useCallback((record: MLModel) => {
        onDeleteApi(record.id);
    }, [onDeleteApi]);



    const columns: ColumnsType<MLModel> = useMemo(() => [
        {
            title: 'Name',
            dataIndex: 'name',
            key: 'name',
            sorter: (a: MLModel, b: MLModel) => a.name.localeCompare(b.name),
            render: (name: string) => <Text strong>{name}</Text>,
        },
        {
            title: 'Publisher',
            dataIndex: 'publisher',
            key: 'publisher',
            sorter: (a: MLModel, b: MLModel) => a.publisher.localeCompare(b.publisher),
            render: (publisher: string) => formatPublisher(publisher),
        },
        {
            title: 'Visibility',
            dataIndex: 'is_public',
            key: 'visibility',
            sorter: (a: MLModel, b: MLModel) => (a.is_public === b.is_public ? 0 : a.is_public ? -1 : 1),
            render: (isPublic: boolean) => (
                <Tag color={isPublic ? 'blue' : 'grey'}>
                    {isPublic ? 'Public' : 'Private'}
                </Tag>
            ),
        },
        {
            title: 'Category',
            dataIndex: 'type',
            key: 'category',
            sorter: (a: MLModel, b: MLModel) => {
                const typeA = a.type || '';
                const typeB = b.type || '';
                return typeA.localeCompare(typeB);
            },
            render: (type: string) => {
                if (!type) {
                    return (
                        <Tag color="default">
                            Unknown
                        </Tag>
                    );
                }
                const capitalizedType = type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
                return (
                    <Tag color={getTypeColor(type)}>
                        {capitalizedType}
                    </Tag>
                );
            },
        },
        {
            title: 'Created Date',
            dataIndex: 'createdDate',
            key: 'createdDate',
            sorter: (a: MLModel, b: MLModel) => moment(a.createdDate).unix() - moment(b.createdDate).unix(),
            render: formatDate,
        },

        {
            title: 'Actions',
            key: 'actions',
            width: 120,
            render: (_, record: MLModel) => (
                <div className='cvat-apis-table-action-icons'>
                    <Button
                        type='link'
                        icon={<EditOutlined />}
                        onClick={() => handleEditClick(record)}
                        disabled={fetching}
                        aria-label={`Edit ${record.name}`}
                    />
                    <Button
                        type='link'
                        icon={<DeleteOutlined />}
                        onClick={() => handleDeleteClick(record)}
                        disabled={fetching}
                        aria-label={`Delete ${record.name}`}
                        danger
                    />
                </div>
            ),
        },
    ], [fetching, getTypeColor, formatDate, handleEditClick, handleDeleteClick]);

    const handlePreviousPage = useCallback(() => {
        onPageChange('previous');
    }, [onPageChange]);

    const handleNextPage = useCallback(() => {
        onPageChange('next');
    }, [onPageChange]);

    const paginationConfig: TableProps<MLModel>['pagination'] = useMemo(() => ({
        total,
        showTotal: (totalCount: number) => `Total ${totalCount} items`,
        showQuickJumper: false,
        showSizeChanger: false,
        hideOnSinglePage: false,
        itemRender: (current: number, type: string) => {
            if (type === 'prev') {
                return (
                    <Button
                        disabled={!previousCursor || fetching}
                        onClick={handlePreviousPage}
                    >
                        Previous
                    </Button>
                );
            }
            if (type === 'next') {
                return (
                    <Button
                        disabled={!nextCursor || fetching}
                        onClick={handleNextPage}
                    >
                        Next
                    </Button>
                );
            }
            return null;
        },
    }), [total, previousCursor, nextCursor, fetching, handlePreviousPage, handleNextPage]);

    return (
        <Table<MLModel>
            columns={columns}
            dataSource={apis}
            rowKey='id'
            loading={fetching}
            pagination={paginationConfig}
            className='cvat-apis-table'
            scroll={{ x: 'max-content' }}
            size='middle'
        />
    );
}

export default React.memo(ApisTableComponent);