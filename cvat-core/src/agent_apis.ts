// Copyright (C) 2019-2022 Intel Corporation
// Copyright (C) CVAT.ai Corporation
//
// SPDX-License-Identifier: MIT

// This file will be implemented in a future release

export enum APIProvider {
    HUGGINGFACE = 'huggingface',
    ROBOFLOW = 'roboflow',
    LANDINGAI = 'landingai',
}

export enum AgentType {
    DETECTOR = 'detector',
    INTERACTOR = 'interactor',
    REID = 'reid',
    TRACKER = 'tracker',
}

export enum LabelSource {
    CUSTOM = 'custom',
    COCO = 'coco',
}

export interface AgentAPIData {
    id?: string;
    name: string;
    endpoint: string;
    auth_token: string;
    timeout?: number;
    rate_limit?: number;
    provider: APIProvider;
    agent_type?: AgentType;
    is_public?: boolean;
    labels?: string[];
    label_source?: LabelSource;
    owner_id?: string;
    organization_id?: string;
    is_active?: boolean;
    created_date?: string;
    updated_date?: string;
    last_used?: string;
    total_usage_count?: number;
    error_count?: number;
    last_error?: string;
    resolved_labels?: string[];
}

export default class AgentAPI {
    constructor(initialData: AgentAPIData) {
        // Implementation will be added in a future release
        throw new Error('AgentAPI functionality is not available in this release');
    }

    // Placeholder methods - will be implemented in future release
    get id(): string { throw new Error('Not implemented'); }
    get name(): string { throw new Error('Not implemented'); }
    set name(name: string) { throw new Error('Not implemented'); }
    get endpoint(): string { throw new Error('Not implemented'); }
    set endpoint(endpoint: string) { throw new Error('Not implemented'); }
    get auth_token(): string { throw new Error('Not implemented'); }
    set auth_token(auth_token: string) { throw new Error('Not implemented'); }
    get provider(): APIProvider { throw new Error('Not implemented'); }
    set provider(provider: APIProvider) { throw new Error('Not implemented'); }
    get is_active(): boolean { throw new Error('Not implemented'); }
    set is_active(is_active: boolean) { throw new Error('Not implemented'); }
    get is_public(): boolean { throw new Error('Not implemented'); }
    set is_public(is_public: boolean) { throw new Error('Not implemented'); }
    get timeout(): number { throw new Error('Not implemented'); }
    set timeout(timeout: number) { throw new Error('Not implemented'); }
    get rate_limit(): number { throw new Error('Not implemented'); }
    set rate_limit(rate_limit: number) { throw new Error('Not implemented'); }
    get agent_type(): AgentType { throw new Error('Not implemented'); }
    set agent_type(agent_type: AgentType) { throw new Error('Not implemented'); }
    get labels(): string[] { throw new Error('Not implemented'); }
    set labels(labels: string[]) { throw new Error('Not implemented'); }
    get label_source(): LabelSource { throw new Error('Not implemented'); }
    set label_source(label_source: LabelSource) { throw new Error('Not implemented'); }
    
    async save(): Promise<AgentAPI> {
        throw new Error('AgentAPI functionality is not available in this release');
    }
    
    async delete(): Promise<void> {
        throw new Error('AgentAPI functionality is not available in this release');
    }
    
    async infer(task: number, data: Record<string, unknown>): Promise<any> {
        throw new Error('AgentAPI functionality is not available in this release');
    }
}