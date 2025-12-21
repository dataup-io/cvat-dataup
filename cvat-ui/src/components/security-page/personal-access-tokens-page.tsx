// Copyright (C) 2024 CVAT.ai Corporation
//
// SPDX-License-Identifier: MIT

import React from 'react';
import { Typography } from 'antd';
import ApiTokensCard from 'components/profile-page/security-content/api-tokens-card';
import './styles.scss';

const { Title, Text } = Typography;

function PersonalAccessTokensPage(): JSX.Element {
    return (
        <div className="security-page" style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
            {/* Header */}
            <div className="page-header" style={{ marginBottom: '24px' }}>
                <div className="header-content">
                    <Title level={2} style={{ margin: 0 }}>CVAT API Access Tokens</Title>
                    <Text type="secondary" className="subtitle">
                        Manage your CVAT Personal Access Tokens (PATs) for API authentication
                    </Text>
                </div>
            </div>

            {/* PATs Content */}
            <div className="personal-access-tokens-content">
                <ApiTokensCard />
            </div>
        </div>
    );
}

export default PersonalAccessTokensPage;

