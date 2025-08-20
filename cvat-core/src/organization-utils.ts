// Copyright (C) 2024 CVAT.ai Corporation
//
// SPDX-License-Identifier: MIT

// import serverProxy from './server-proxy';
import config from './config';

/**
 * Utility function to check if the current organization is active
 * An organization is considered active if its status is 'registered'
 * @returns Promise<boolean> - true if organization is active (registered), false otherwise
 */
export async function isCurrentOrganizationActive(): Promise<boolean> {
    // Health check functionality has been removed
    // Always return true for now
    return true;
    // try {
    //     if (!config.organization.organizationUuid) {
    //         return false;
    //     }
    //     
    //     const statusData = await serverProxy.dataUPHealth.getOrganizationStatus(config.organization.organizationUuid);
    //     return statusData.status === 'registered';
    // } catch (error) {
    //     console.warn('Failed to fetch organization status:', error);
    //     return false;
    // }
}

/**
 * Get the current organization's active status from config
 * @returns boolean - the cached active status
 */
export function getCurrentOrganizationActiveStatus(): boolean {
    return config.organization.active;
}

/**
 * Update the organization active status in config
 * @param isActive - whether the organization is active
 */
export function setOrganizationActiveStatus(isActive: boolean): void {
    config.organization.active = isActive;
}