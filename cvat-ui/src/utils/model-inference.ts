// Shared utilities for running model inference across providers
// - Normalizes mapping payloads
// - Starts automatic annotation / batch jobs for CVAT (lambda) and DataUp (agents)

import { getCore, MLModel } from 'cvat-core-wrapper';

const core = getCore();

// Mapping type used by DetectorRunner for DETECTOR models
// Record<modelLabel, { name: taskLabelName; attributes: Record<attrName, value>; sublabels?: ... }>
export type ComplexServerMapping = Record<string, {
    name: string;
    attributes: Record<string, string>;
    sublabels?: ComplexServerMapping;
}>;

export type SimpleNameMapping = Record<string, string>;

export interface DetectorAnnotateTaskParams {
    // Common detector params used in both flows
    mapping: ComplexServerMapping | SimpleNameMapping;
    cleanup: boolean;
    conv_mask_to_poly: boolean;
    threshold?: number;
}

export interface ReIDParams {
    threshold?: number;
    max_distance?: number;
}

export type InferenceParams = DetectorAnnotateTaskParams | ReIDParams;

function isComplexMapping(mapping: any): mapping is ComplexServerMapping {
    const first = mapping && typeof mapping === 'object' ? Object.values(mapping)[0] as any : undefined;
    return !!(first && typeof first === 'object' && 'name' in first);
}

// Convert the complex mapping (DetectorRunner server format) to a simple provider mapping used by DataUp agents
export function convertComplexToSimpleMapping(mapping: ComplexServerMapping): SimpleNameMapping {
    const result: SimpleNameMapping = {};
    for (const [modelLabel, taskMapping] of Object.entries(mapping)) {
        result[modelLabel] = taskMapping.name;
    }
    return result;
}

// Ensure mapping fits the provider expectations
export function normalizeMappingForProvider(mapping: ComplexServerMapping | SimpleNameMapping | undefined, provider: string): {
    complex?: ComplexServerMapping;
    simple?: SimpleNameMapping;
} {
    if (!mapping) return {};

    const prov = provider?.toLowerCase?.() || 'cvat';
    if (prov === 'dataup') {
        if (isComplexMapping(mapping)) {
            return { simple: convertComplexToSimpleMapping(mapping) };
        }
        return { simple: mapping as SimpleNameMapping };
    }

    // For CVAT we expect complex server mapping (DetectorRunner already constructs it)
    if (isComplexMapping(mapping)) {
        return { complex: mapping };
    }
    // If we only have simple mapping, upgrade it to complex shape with empty attributes
    const upgraded: ComplexServerMapping = Object.fromEntries(
        Object.entries(mapping as SimpleNameMapping).map(([modelLabel, taskLabel]) => [
            modelLabel,
            { name: taskLabel, attributes: {} },
        ]),
    );
    return { complex: upgraded };
}

// Starts automatic annotation for the whole task/job depending on provider
export async function startAutomaticAnnotation(options: {
    taskId: number;
    jobId?: number;
    model: MLModel;
    params: InferenceParams | Record<string, unknown>;
}): Promise<{ type: 'lambda'; requestId: string } | { type: 'agent_job'; job: any }> {
    const { taskId, jobId, model, params } = options;
    const provider = model.provider?.toLowerCase?.() || 'cvat';

    if (provider === 'dataup') {
        // Build agent job payload with only supported fields
        const p = (params || {}) as Record<string, unknown>;
        const mapping = p.mapping as ComplexServerMapping | SimpleNameMapping | undefined;
        const mappingForAgent = mapping ? normalizeMappingForProvider(mapping, provider).simple : undefined;
        const cleanup = p.cleanup as boolean | undefined;
        const conv_mask_to_poly = p.conv_mask_to_poly as boolean | undefined;
        const threshold = p.threshold as number | undefined;
        const max_distance = p.max_distance as number | undefined;

        const jobData: any = {
            agent_id: model.id,
            task_id: taskId,
            ...(jobId ? { job_id: jobId } : {}),
            ...(mappingForAgent ? { mapping: mappingForAgent } : {}),
            ...(typeof cleanup === 'boolean' ? { cleanup } : {}),
            ...(typeof conv_mask_to_poly === 'boolean' ? { conv_mask_to_poly } : {}),
            ...(typeof threshold === 'number' ? { threshold } : {}),
            ...(typeof max_distance === 'number' ? { max_distance } : {}),
        };
        const job = await core.agents.annotateJobs.create(jobData);
        return { type: 'agent_job', job };
    }

    // CVAT lambda: run serverless request for the whole task
    const requestId = await core.lambda.run(taskId, model, {
        // Expect DetectorRunner to provide correct body shape for DETECTOR
        ...(params as any),
        type: 'annotate_task',
    });
    return { type: 'lambda', requestId };
}

// Batch frames runner: for CVAT provider makes per-frame calls, for DataUp creates an agent job with frame_ids
export async function startBatchFrames(options: {
    taskId: number;
    jobId: number;
    model: MLModel;
    frameIds: number[];
    params: InferenceParams | Record<string, unknown>;
    // Optional callbacks used by UI for progress and frame results (CVAT only)
    onFrame?: (arg: { frame: number; response: any; index: number; total: number }) => Promise<void> | void;
}): Promise<{ type: 'agent_job'; job: any } | { type: 'local'; completed: true } > {
    const { taskId, jobId, model, frameIds, params, onFrame } = options;
    const provider = model.provider?.toLowerCase?.() || 'cvat';

    if (provider === 'dataup') {
        const p = (params || {}) as Record<string, unknown>;
        const mapping = p.mapping as ComplexServerMapping | SimpleNameMapping | undefined;
        const mappingForAgent = mapping ? normalizeMappingForProvider(mapping, provider).simple : undefined;
        const cleanup = p.cleanup as boolean | undefined;
        const conv_mask_to_poly = p.conv_mask_to_poly as boolean | undefined;
        const threshold = p.threshold as number | undefined;
        const max_distance = p.max_distance as number | undefined;

        const jobData: any = {
            agent_id: model.id,
            task_id: taskId,
            job_id: jobId,
            frame_ids: frameIds,
            ...(mappingForAgent ? { mapping: mappingForAgent } : {}),
            ...(typeof cleanup === 'boolean' ? { cleanup } : {}),
            ...(typeof conv_mask_to_poly === 'boolean' ? { conv_mask_to_poly } : {}),
            ...(typeof threshold === 'number' ? { threshold } : {}),
            ...(typeof max_distance === 'number' ? { max_distance } : {}),
        };
        const job = await core.agents.annotateJobs.create(jobData);
        return { type: 'agent_job', job };
    }

    // CVAT: per-frame calls
    let index = 0;
    for (const frame of frameIds) {
        const body = {
            ...(params as any),
            type: 'annotate_frame',
            frame,
            job: jobId,
        };
        // cleanup is not supported by call endpoint, strip it if provided
        if ('cleanup' in body) {
            delete (body as any).cleanup;
        }
        const response = await core.lambda.call(taskId, model, body);
        // Let caller decide how to process and store results
        await onFrame?.({ frame, response, index, total: frameIds.length });
        index += 1;
    }
    return { type: 'local', completed: true };
}