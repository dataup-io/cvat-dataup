// Copyright (C) 2024 CVAT.ai Corporation
//
// SPDX-License-Identifier: MIT

import serverProxy from './server-proxy';

//#region Interfaces

interface DataUPApiKeys {
    id: string;
    key: string;
    name: string;
    organization: number;
    allowed_roles?: string[];
    label?: string;
    created_date?: string;
    last_used?: string;
}



//#endregion

class ApiKeysManager {
    //#region Private Helpers

    private static formatListResponse(result: any) {
        const keys = Array.isArray(result?.results) ? result.results : Array.isArray(result) ? result : [];
        return {
            count: result?.count ?? keys.length,
            next: result?.next ?? null,
            previous: result?.previous ?? null,
            results: keys,
        };
    }



    //#region Active API Key Methods

    async listApiKeys(filter: Record<string, unknown> = {}) {
        const result = await serverProxy.dataupApiKeys.get(filter);
        return ApiKeysManager.formatListResponse(result);
    }

    async createApiKey(data: Partial<DataUPApiKeys>) {
        return await serverProxy.dataupApiKeys.create(data);
    }

    async updateApiKey(id: string, data: Partial<DataUPApiKeys>) {
        return await serverProxy.dataupApiKeys.update(id, data);
    }

    async deleteApiKey(id: string) {
        return await serverProxy.dataupApiKeys.delete(id);
    }

    //#endregion


}

export default new ApiKeysManager();
export type { DataUPApiKeys };