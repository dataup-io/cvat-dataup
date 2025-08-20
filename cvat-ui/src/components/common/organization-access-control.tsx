// Copyright (C) 2024 CVAT.ai Corporation
//
// SPDX-License-Identifier: MIT

import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { Result, Spin } from 'antd';
import { ExclamationCircleOutlined } from '@ant-design/icons';
import { CombinedState } from 'reducers';
import { organizationStatusService } from 'services/organization-status';

interface OrganizationAccessControlProps {
    children: React.ReactNode;
    feature: string;
}

function OrganizationAccessControl({ children, feature }: OrganizationAccessControlProps): JSX.Element {
    const [organizationStatus, setOrganizationStatus] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [retryCount, setRetryCount] = useState(0);
    const currentOrganization = useSelector((state: CombinedState) => state.organizations.current);

    useEffect(() => {
        const fetchOrganizationStatus = async () => {
            // Wait for organization to be properly activated with both id and uuid
            if (currentOrganization?.uuid && currentOrganization?.id) {
                setLoading(true);
                try {
                    const status = await organizationStatusService.getOrganizationStatus(currentOrganization.uuid);
                    setOrganizationStatus(status);
                } catch (error) {
                    console.error('Error fetching organization status:', error);
                    // If the error is about organization not being activated, retry with limit
                    if (error instanceof Error && error.message && error.message.includes('Organization not activated yet') && retryCount < 5) {
                        // Retry after a short delay, but limit to 5 retries
                        setTimeout(() => {
                            setRetryCount((prev: number) => prev + 1);
                            fetchOrganizationStatus();
                        }, 2000); // Increased delay to 2 seconds
                        return;
                    }
                    setOrganizationStatus('unknown');
                } finally {
                    setLoading(false);
                }
            } else if (currentOrganization === null) {
                // No organization selected (personal workspace)
                setOrganizationStatus('unknown');
                setLoading(false);
            } else {
                // Organization is being activated, keep loading
                setLoading(true);
            }
        };

        // Reset retry count when organization changes
        setRetryCount(0);
        fetchOrganizationStatus();
    }, [currentOrganization?.uuid, currentOrganization?.id]);

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
                <Spin size="large" />
            </div>
        );
    }

    if (organizationStatus !== 'registered') {
        return (
            <Result
                icon={<ExclamationCircleOutlined style={{ color: '#faad14' }} />}
                title="Organization Registration Required"
                subTitle={`Register this organization to unlock ${feature} features`}
                style={{
                    padding: '60px 32px',
                    backgroundColor: '#fafafa',
                    borderRadius: '8px',
                    margin: '20px'
                }}
            />
        );
    }

    return <>{children}</>;
}

export default React.memo(OrganizationAccessControl);