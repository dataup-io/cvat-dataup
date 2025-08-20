// Copyright (C) 2024 CVAT.ai Corporation
//
// SPDX-License-Identifier: MIT

import serverProxy from './server-proxy';
import Pipeline from './pipeline';
import PipelineExecution from './pipeline-execution';
import PipelineStep from './pipeline-step';
import StepRegistry from './step-registry';

class PipelineManager {
    async list(filter = {}) {
        const result = await serverProxy.pipelines.get(filter);

        // Handle different response formats
        const pipelineData = result.results || result; // ✅ Fallback if results property doesn't exist
        const pipelines = Array.isArray(pipelineData)
            ? pipelineData.map((data) => new Pipeline(data))
            : [];

        return {
            count: result.count || pipelines.length,
            next: result.next || null,
            previous: result.previous || null,
            results: pipelines,
        };
    }

    async create(pipelineData) {
        const pipeline = await serverProxy.pipelines.create(pipelineData);
        return new Pipeline(pipeline);
    }

    async get(id) {
        const pipeline = await serverProxy.pipelines.getById(id);
        return new Pipeline(pipeline);
    }

    async update(id, pipelineData) {
        const pipeline = await serverProxy.pipelines.update(id, pipelineData);
        return new Pipeline(pipeline);
    }

    async delete(id) {
        await serverProxy.pipelines.delete(id);
    }

    async incrementUsage(id) {
        return serverProxy.pipelines.incrementUsage(id);
    }

    async usage(id) {
        return serverProxy.pipelines.usage(id);
    }

    async run(id, inputData = {}) {
        return serverProxy.pipelines.run(id, inputData);
    }

    async steps(filter = {}) {
        const result = await serverProxy.pipelineSteps.get(filter);

        // Handle different response formats
        const stepData = result.results || result; // Fallback if results property doesn't exist
        const steps = Array.isArray(stepData)
            ? stepData.map((data) => new PipelineStep(data))
            : [];

        return {
            count: result.count || steps.length,
            results: steps,
        };
    }

    async createStep(stepData) {
        const step = await serverProxy.pipelineSteps.create(stepData);
        return new PipelineStep(step);
    }

    async updateStep(id, stepData) {
        const step = await serverProxy.pipelineSteps.update(id, stepData);
        return new PipelineStep(step);
    }

    async deleteStep(id) {
        await serverProxy.pipelineSteps.delete(id);
    }

    async stepRegistry(filter = {}) {
        const result = await serverProxy.stepRegistry.get(filter);

        // Handle the new FastAPI format - it returns a direct array instead of paginated results
        if (Array.isArray(result)) {
            const registryItems = result.map((registryData) => new StepRegistry(registryData));
            return {
                count: result.length,
                next: null,
                previous: null,
                results: registryItems,
            };
        }

        // Fallback for paginated format if needed
        const registryData = result.results || [];
        const registryItems = registryData.map((data) => new StepRegistry(data));
        return {
            count: result.count || registryItems.length,
            next: result.next || null,
            previous: result.previous || null,
            results: registryItems,
        };
    }

    async executions(filter = {}) {
        const result = await serverProxy.pipelineExecutions.get(filter);

        // Handle different response formats
        const executionData = result.results || result; // Fallback if results property doesn't exist
        const executions = Array.isArray(executionData)
            ? executionData.map((data) => new PipelineExecution(data))
            : [];

        return {
            count: result.count || executions.length,
            results: executions,
        };
    }

    async getExecution(id) {
        const execution = await serverProxy.pipelineExecutions.get({ id });

        // Handle different response formats
        const executionData = execution.results || execution;
        if (Array.isArray(executionData) && executionData.length > 0) {
            return new PipelineExecution(executionData[0]);
        }
        throw new Error(`Pipeline execution with ID ${id} not found`);
    }

    async checkExecutionStatus(id) {
        return serverProxy.pipelineExecutions.checkStatus(id);
    }

    // Add this method to the PipelineManager class
    async cancelExecution(id) {
        await serverProxy.pipelineExecutions.cancel(id);
    }

    async deleteExecution(id) {
        await serverProxy.pipelineExecutions.delete(id);
    }
}

export default new PipelineManager();