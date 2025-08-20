// Copyright (C) 2024 CVAT.ai Corporation
//
// SPDX-License-Identifier: MIT

// This file will be implemented in a future release

import { SerializedStepRegistry, SerializedStepRegistryParameter } from './server-response-types';

export default class StepRegistry {
    constructor(initialData: SerializedStepRegistry) {
        // Implementation will be added in a future release
        throw new Error('StepRegistry functionality is not available in this release');
    }

    // Placeholder methods - will be implemented in future release
    get id(): string { throw new Error('Not implemented'); }
    get type(): string { throw new Error('Not implemented'); }
    get name(): string { throw new Error('Not implemented'); }
    get description(): string { throw new Error('Not implemented'); }
    get category(): string { throw new Error('Not implemented'); }
    get parameters(): SerializedStepRegistryParameter[] { throw new Error('Not implemented'); }
    get version(): string { throw new Error('Not implemented'); }
    get created_at(): string { throw new Error('Not implemented'); }
    get updated_at(): string { throw new Error('Not implemented'); }

    toJSON() {
        throw new Error('StepRegistry functionality is not available in this release');
    }
}