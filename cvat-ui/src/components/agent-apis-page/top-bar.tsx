import React from 'react';
import { useSelector } from 'react-redux';
import { Row, Col } from 'antd/lib/grid';
import Input from 'antd/lib/input';
import Button from 'antd/lib/button';
import { PlusOutlined } from '@ant-design/icons';

import { CombinedState } from 'reducers';

interface Props {
    onSearchChange: (value: string) => void;
    searchValue: string;
    onCreateApi: () => void;
}

function TopBarComponent(props: Props): JSX.Element {
    const { onSearchChange, searchValue, onCreateApi } = props;
    const fetching = useSelector((state: CombinedState) => state.agentApis.fetching);

    return (
        <div className='cvat-apis-page-content'>
            <Row className='cvat-apis-page-top-bar' justify='space-between' align='middle' style={{ marginBottom: '16px', padding: '0 24px' }}>
                <Col>
                    <Input.Search
                        enterButton
                        onSearch={onSearchChange}
                        defaultValue={searchValue}
                        className='cvat-apis-page-search-bar'
                        placeholder='Search APIs'
                        disabled={fetching}
                        style={{ width: '300px' }}
                    />
                </Col>
                <Col>
                    <Button
                        type='primary'
                        onClick={onCreateApi}
                        disabled={fetching}
                        icon={<PlusOutlined />}
                    />
                </Col>
            </Row>
        </div>
    );
}

export default React.memo(TopBarComponent);
