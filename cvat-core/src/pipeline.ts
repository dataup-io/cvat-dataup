// Copyright (C) 2024 CVAT.ai Corporation
//
// SPDX-License-Identifier: MIT

import { SerializedPipeline } from './server-response-types';

export default class Pipeline {
    constructor(initialData: SerializedPipeline) {
        throw new Error('Pipeline functionality will be available in a future release');
    }

    get id(): string {
        throw new Error('Not implemented');
    }

    get name(): string {
        throw new Error('Not implemented');
    }

    set name(name: string) {
        throw new Error('Not implemented');
    }

    get description(): string {
        throw new Error('Not implemented');
    }

    set description(description: string) {
        throw new Error('Not implemented');
    }

    get usageLimit(): number {
        throw new Error('Not implemented');
    }

    set usageLimit(limit: number) {
        throw new Error('Not implemented');
    }

    get usageCount(): number {
        throw new Error('Not implemented');
    }

    get totalUsage(): number {
        throw new Error('Not implemented');
    }

    get ownerId(): string {
        throw new Error('Not implemented');
    }

    get organizationId(): string {
        throw new Error('Not implemented');
    }

    get createdAt(): string {
        throw new Error('Not implemented');
    }

    get updatedAt(): string {
        throw new Error('Not implemented');
    }

    get isPublic(): boolean {
        throw new Error('Not implemented');
    }

    set isPublic(isPublic: boolean) {
        throw new Error('Not implemented');
    }

    get steps(): any[] {
        throw new Error('Not implemented');
    }

    toJSON() {
        throw new Error('Not implemented');
    }
}