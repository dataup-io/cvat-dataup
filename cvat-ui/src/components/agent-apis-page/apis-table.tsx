import React from 'react';
import moment from 'moment';
import {
    Button, Space, Table, Tag, Tooltip, Progress,
} from 'antd';
import { EditOutlined, DeleteOutlined } from '@ant-design/icons';
import Text from 'antd/lib/typography/Text';
import './styles.scss';
import type { ColumnsType } from 'antd/es/table';
import { APIProvider } from 'cvat-core/src/agent_apis';
import { useSelector } from 'react-redux';
import { CombinedState } from 'reducers';

interface Props {
    apis: any[];
    total: number;
    currentPage: number;
    pageSize: number;
    onEditApi: (api: any) => void;
    onDeleteApi: (api: any) => void;
    onPageChange: (page: number, pageSize?: number) => void;
}

function ApisTableComponent(props: Props): JSX.Element {
    const {
        apis, total, currentPage, pageSize, onPageChange, onEditApi, onDeleteApi,
    } = props;
    const user = useSelector((state: CombinedState) => state.auth.user);
    const isSuperuser = user?.isSuperuser || false;

    console.log('ApisTableComponent - Received props:', { apis, total, currentPage, pageSize });
    console.log('ApisTableComponent - User info:', { userId: user?.id, isSuperuser });

    const baseColumns: ColumnsType<any> = [
        {
            title: 'Name',
            dataIndex: 'name',
            key: 'name',
            sorter: (a, b) => a.name.localeCompare(b.name),
            render: (text) => <Text strong>{text}</Text>,
        },
        {
            title: 'Provider',
            dataIndex: 'provider',
            key: 'provider',
            filters: [
                { text: 'HuggingFace', value: APIProvider.HUGGINGFACE },
                { text: 'Roboflow', value: APIProvider.ROBOFLOW },
                { text: 'Landing AI', value: APIProvider.LANDINGAI },
            ],
            onFilter: (value, record) => record.provider === value,
        },
        {
            title: 'Type',
            dataIndex: 'is_public',
            key: 'type',
            filters: [
                { text: 'Public', value: true },
                { text: 'Private', value: false },
            ],
            onFilter: (value, record) => record.is_public === value,
            render: (isPublic) => (
                <Tag color={isPublic ? 'blue' : 'grey'}>
                    {isPublic ? 'Public' : 'Private'}
                </Tag>
            ),
        },
        {
            title: 'Created Date',
            dataIndex: 'created_date',
            key: 'created_date',
            sorter: (a, b) => moment(a.created_date).unix() - moment(b.created_date).unix(),
            render: (date) => moment(date).format('MMMM Do YYYY'),
        },
        {
            title: 'Last Used',
            dataIndex: 'last_used',
            key: 'last_used',
            sorter: (a, b) => {
                if (!a.last_used) return 1;
                if (!b.last_used) return -1;
                return moment(a.last_used).unix() - moment(b.last_used).unix();
            },
            render: (date) => (date ? moment(date).format('MMMM Do YYYY') : 'Never'),
        },
        {
            title: 'Organization Usage',
            dataIndex: 'organization_usage',
            key: 'organization_usage',
            sorter: (a, b) => {
                const aUsage = a.organization_usage?.usage_count || 0;
                const bUsage = b.organization_usage?.usage_count || 0;
                return aUsage - bUsage;
            },
            render: (orgUsage) => {
                if (!orgUsage) return 'N/A';

                const usageCount = orgUsage.usage_count || 0;
                const usageLimit = orgUsage.usage_limit || 1000;
                const percentage = (usageCount / usageLimit) * 100;
                const status = percentage >= 80 ? 'exception' : 'normal';
                const resetPeriod = orgUsage.reset_period ? ` (${orgUsage.reset_period})` : '';

                return (
                    <Tooltip title={`${usageCount}/${usageLimit} uses${resetPeriod}`}>
                        <Progress
                            percent={Math.min(percentage, 100)}
                            size='small'
                            status={status}
                            showInfo={false}
                        />
                    </Tooltip>
                );
            },
        },
        {
            title: 'Total Usage',
            dataIndex: 'total_usage_count',
            key: 'total_usage_count',
            sorter: (a, b) => (a.total_usage_count || 0) - (b.total_usage_count || 0),
            render: (count, record) => {
                console.log('Total Usage - Record data:', record);
                const isOwner = record.owner_id === user?.id || isSuperuser;
                console.log('Total Usage - Is owner check:', { recordOwnerId: record.owner_id, userId: user?.id, isOwner, isSuperuser });
                if (!isOwner) return null;
                return (
                    count || 0
                );
            },
        },
        {
            title: 'Actions',
            key: 'actions',
            render: (_, record) => {
                console.log('Actions - Record data:', record);
                const isOwner = record.owner_id === user?.id || isSuperuser;
                console.log('Actions - Is owner check:', { recordOwnerId: record.owner_id, userId: user?.id, isOwner, isSuperuser });
                if (!isOwner) return null;
                return (
                    <Space size='middle' className='cvat-apis-table-action-icons'>
                        <Tooltip title='Edit'>
                            <Button type='link' onClick={() => onEditApi(record)}>
                                <EditOutlined />
                            </Button>
                        </Tooltip>
                        <Tooltip title='Delete'>
                            <Button type='link' onClick={() => onDeleteApi(record)}>
                                <DeleteOutlined />
                            </Button>
                        </Tooltip>
                    </Space>
                );
            },
        },
    ];

    const columns = baseColumns.filter((column) => {
        if (column.key === 'actions' || column.key === 'total_usage_count') {
            const isOwner = apis.some((api) => api.owner_id === user?.id || isSuperuser);
            console.log('Column filter - Is owner check:', { isOwner, isSuperuser, userId: user?.id });
            return isOwner;
        }
        return true;
    });

    return (
        <Table
            columns={columns}
            dataSource={apis}
            rowKey='id'
            className='cvat-apis-table'
            pagination={{
                current: currentPage,
                pageSize,
                total,
                position: ['bottomCenter'],
                showQuickJumper: true,
                showTotal: (t) => `Total ${t} items`,
                onChange: onPageChange,
                onShowSizeChange: (current, newPageSize) => onPageChange(1, newPageSize),
            }}
            size='middle'
            bordered
            scroll={{ x: 'max-content' }}
        />
    );
}

export default React.memo(ApisTableComponent);
