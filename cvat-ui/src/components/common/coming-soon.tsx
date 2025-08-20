// Copyright (C) CVAT.ai Corporation
//
// SPDX-License-Identifier: MIT

import React from 'react';
import Result from 'antd/lib/result';
import { RocketOutlined } from '@ant-design/icons';

interface ComingSoonProps {
    title?: string;
    subtitle?: string;
}

export const ComingSoonComponent = React.memo(({ 
    title = "Coming Soon", 
    subtitle = "This feature is currently under development and will be available in a future release." 
}: ComingSoonProps): JSX.Element => (
    <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        width: '100%',
        padding: '20px'
    }}>
        <Result
            className='cvat-coming-soon'
            icon={<RocketOutlined style={{ color: '#52c41a', fontSize: '64px' }} />}
            title={<span style={{ fontSize: '24px', fontWeight: 'bold' }}>{title}</span>}
            subTitle={<span style={{ fontSize: '16px', color: '#666' }}>{subtitle}</span>}
        />
    </div>
));

export default ComingSoonComponent;