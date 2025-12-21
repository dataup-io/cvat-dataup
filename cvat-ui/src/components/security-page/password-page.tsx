// Copyright (C) 2024 CVAT.ai Corporation
//
// SPDX-License-Identifier: MIT

import React from 'react';
import { useSelector, shallowEqual } from 'react-redux';
import { Typography } from 'antd';
import { CombinedState } from 'reducers';
import PasswordChangeCard from 'components/profile-page/security-content/password-change-card';
import './styles.scss';

const { Title, Text } = Typography;

function PasswordPage(): JSX.Element {
    const { isPasswordChangeEnabled } = useSelector((state: CombinedState) => ({
        isPasswordChangeEnabled: state.serverAPI.configuration.isPasswordChangeEnabled,
    }), shallowEqual);

    if (!isPasswordChangeEnabled) {
        return (
            <div className="security-page" style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
                <div className="page-header" style={{ marginBottom: '24px' }}>
                    <div className="header-content">
                        <Title level={2} style={{ margin: 0 }}>Password</Title>
                        <Text type="secondary" className="subtitle">
                            Password change is not enabled for your account
                        </Text>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="security-page" style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
            {/* Header */}
            <div className="page-header" style={{ marginBottom: '24px' }}>
                <div className="header-content">
                    <Title level={2} style={{ margin: 0 }}>Password</Title>
                    <Text type="secondary" className="subtitle">
                        Change your account password to keep it secure
                    </Text>
                </div>
            </div>

            {/* Password Change Content */}
            <div className="password-content">
                <PasswordChangeCard />
            </div>
        </div>
    );
}

export default PasswordPage;

