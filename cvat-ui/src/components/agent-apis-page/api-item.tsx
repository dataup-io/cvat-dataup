import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import moment from 'moment';
import Card from 'antd/lib/card';
import Dropdown from 'antd/lib/dropdown';
import Text from 'antd/lib/typography/Text';
import Tag from 'antd/lib/tag';
import { EditOutlined, DeleteOutlined, GlobalOutlined } from '@ant-design/icons';
import { deleteAgentApiAsync } from 'actions/agent-apis-actions';
import type { MenuProps } from 'antd';
import { CombinedState } from 'reducers';

interface Props {
    api: any;
    onEditApi: (api: any) => void;
}

function ApiItemComponent(props: Props): JSX.Element {
    const { api, onEditApi } = props;
    const dispatch = useDispatch();
    const user = useSelector((state: CombinedState) => state.auth.user);
    const isSuperuser = user?.isSuperuser || false;

    const createdDate = moment(api.created_date).format('MMMM Do YYYY');
    const lastUsed = api.last_used ? moment(api.last_used).format('MMMM Do YYYY') : 'Never';

    const handleDelete = () => dispatch(deleteAgentApiAsync(api));

    // Only allow editing/deleting public APIs if user is a superuser
    const canModify = !api.is_public || isSuperuser;

    const items: MenuProps['items'] = [
        {
            label: 'Edit',
            key: '1',
            icon: <EditOutlined />,
            onClick: () => onEditApi(api),
            disabled: !canModify,
        },
        {
            label: 'Delete',
            key: '2',
            icon: <DeleteOutlined />,
            onClick: handleDelete,
            disabled: !canModify,
        },
    ];

    const menuProps = {
        items,
    };

    return (
        <Card
            className='cvat-apis-item-card'
            cover={(
                <div className='cvat-apis-item-card-cover'>
                    <div className='cvat-apis-item-card-title'>
                        <Text strong>{api.name}</Text>
                        {api.is_public && (
                            <Tag color='blue' icon={<GlobalOutlined />} style={{ marginLeft: '8px' }}>
                                Public
                            </Tag>
                        )}
                    </div>
                </div>
            )}
            actions={[
                <Dropdown.Button menu={menuProps} />,
            ]}
        >
            <div className='cvat-apis-item-description'>
                <div className='cvat-apis-item-text-description'>
                    <Text type='secondary'>
                        Provider:
                        {api.provider}
                    </Text>
                </div>
                <div className='cvat-apis-item-text-description'>
                    <Text type='secondary'>
                        Status:
                        {api.is_active ? 'Active' : 'Inactive'}
                    </Text>
                </div>
                <div className='cvat-apis-item-text-description'>
                    <Text type='secondary'>
                        Created:
                        {createdDate}
                    </Text>
                </div>
                <div className='cvat-apis-item-text-description'>
                    <Text type='secondary'>
                        Last Used:
                        {lastUsed}
                    </Text>
                </div>
                <div className='cvat-apis-item-text-description'>
                    <Text type='secondary'>
                        Usage Count:
                        {api.usage_count}
                    </Text>
                </div>
                <div className='cvat-apis-item-text-description'>
                    <Text type='secondary'>
                        Error Count:
                        {api.error_count}
                    </Text>
                </div>
            </div>
        </Card>
    );
}

export default React.memo(ApiItemComponent);
