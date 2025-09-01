// Copyright (C) 2020-2022 Intel Corporation
// Copyright (C) CVAT.ai Corporation
//
// SPDX-License-Identifier: MIT

import React from 'react';
import Input from 'antd/lib/input';
import Button from 'antd/lib/button';
import { PlusOutlined } from '@ant-design/icons';

interface TopBarProps {
    searchValue: string;
    onSearchChange: (value: string) => void;
    onCreateApi: () => void;
    fetching: boolean;
}

function TopBar({ searchValue, onSearchChange, onCreateApi, fetching }: TopBarProps): JSX.Element {
    return (
        <div className='cvat-apis-page-top-bar'>
            <Input.Search
                placeholder='Search APIs...'
                defaultValue={searchValue}
                onSearch={onSearchChange}
                enterButton
                style={{ width: 300, marginRight: 16 }}
                disabled={fetching}
            />
            <Button
                type='primary'
                icon={<PlusOutlined />}
                onClick={onCreateApi}
                disabled={fetching}
            >
                Create API
            </Button>
        </div>
    );
}

export default TopBar;