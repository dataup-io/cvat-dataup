// Copyright (C) 2024 CVAT.ai Corporation
//
// SPDX-License-Identifier: MIT

// import { getCore } from 'cvat-core-wrapper';

// const core = getCore();

export interface OrganizationStatusResponse {
    status: 'unknown' | 'registered' | 'pre-registered';
}

export class OrganizationStatusService {
    private static instance: OrganizationStatusService;
    private statusCache: Map<string, { status: string; timestamp: number }> = new Map();
    private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

    public static getInstance(): OrganizationStatusService {
        if (!OrganizationStatusService.instance) {
            OrganizationStatusService.instance = new OrganizationStatusService();
        }
        return OrganizationStatusService.instance;
    }

    public async getOrganizationStatus(organizationId: string): Promise<'unknown' | 'registered' | 'pre-registered'> {
        // Health check functionality has been removed
        // Always return 'registered' status
        return 'registered';
        
        // try {
        //     // Validate organization ID
        //     if (!organizationId || organizationId.trim() === '') {
        //         throw new Error('Organization not activated yet. Please wait for organization activation to complete.');
        //     }

        //     // Check cache first
        //     const cached = this.statusCache.get(organizationId);
        //     if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
        //         return cached.status as 'unknown' | 'registered' | 'pre-registered';
        //     }

        //     // Fetch from API using the health endpoint
        //     const data = await core.server.dataUPHealth.getOrganizationStatus(organizationId);
        //     const status = data.status || 'unknown';

        //     // Update cache
        //     this.statusCache.set(organizationId, {
        //         status,
        //         timestamp: Date.now(),
        //     });

        //     return status;
        // } catch (error) {
        //     console.error('Failed to fetch organization status:', error);
        //     // Re-throw the error to allow the component to handle retry logic
        //     throw error;
        // }
    }

    public clearCache(): void {
        this.statusCache.clear();
    }

    public isOrganizationRegistered(status: 'unknown' | 'registered' | 'pre-registered'): boolean {
        return status === 'registered';
    }
}

export const organizationStatusService = OrganizationStatusService.getInstance();