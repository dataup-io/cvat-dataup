// Copyright (C) 2024 CVAT.ai Corporation
//
// SPDX-License-Identifier: MIT

import { SerializedPipelineStep } from './server-response-types';

export default class PipelineStep {
    constructor(initialData: SerializedPipelineStep) {
        throw new Error('PipelineStep functionality will be available in a future release');
    }

    get stepId(): string {
        throw new Error('Not implemented');
    }

    get id(): string {
        throw new Error('Not implemented');
    }

    get pipeline(): string {
        throw new Error('Not implemented');
    }

    get step(): string {
        throw new Error('Not implemented');
    }

    get order(): number {
        throw new Error('Not implemented');
    }

    set order(order: number) {
        throw new Error('Not implemented');
    }

    get params(): Record<string, any> {
        throw new Error('Not implemented');
    }

    set params(params: Record<string, any>) {
        throw new Error('Not implemented');
    }

    get createdAt(): string {
        throw new Error('Not implemented');
    }

    get updatedAt(): string {
        throw new Error('Not implemented');
    }

    toJSON() {
        throw new Error('Not implemented');
    }
}