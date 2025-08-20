// Copyright (C) 2024 CVAT.ai Corporation
//
// SPDX-License-Identifier: MIT

// This file will be implemented in a future release

import { SerializedPipeline, SerializedPipelineExecution, SerializedPipelineStep, SerializedStepExecution } from './server-response-types';

export default class PipelineExecution {
    constructor(initialData: SerializedPipelineExecution) {
        // Implementation will be added in a future release
        throw new Error('PipelineExecution functionality is not available in this release');
    }

    // Placeholder methods - will be implemented in future release
    get id(): string { throw new Error('Not implemented'); }
    get status(): string { throw new Error('Not implemented'); }
    get pipeline(): SerializedPipeline { throw new Error('Not implemented'); }
    get inputData(): Record<string, any> { throw new Error('Not implemented'); }
    get outputData(): Record<string, any> { throw new Error('Not implemented'); }
    get startedAt(): string | null { throw new Error('Not implemented'); }
    get completedAt(): string | null { throw new Error('Not implemented'); }
    get steps(): SerializedPipelineStep[] { throw new Error('Not implemented'); }
    get stepExecutions(): SerializedStepExecution[] { throw new Error('Not implemented'); }

    toJSON() {
        throw new Error('PipelineExecution functionality is not available in this release');
    }
}