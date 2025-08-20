import serverProxy from './server-proxy';
import { ArgumentError } from './exceptions';
import { AgentType } from './agent_apis';
import { SerializedModel } from './core-types';
import {
    ModelKind, LabelType, ShapeType, RQStatus,
} from './enums';
import MLModel from './ml-model';

export interface InteractorResults {
    mask: number[][];
    points?: [number, number][];
    bounds?: [number, number, number, number];
}

export interface TrackerResults {
    states: any[];
    shapes: number[][];
}

export interface DetectedShape {
    type: ShapeType | 'tag';
    rotation?: number;
    attributes: { name: string; value: string }[];
    label: string;
    outside?: boolean;
    points?: number[];
    mask?: number[];
    confidence?: number;
    elements: DetectedShape[];
}

type ServerMapping = Record<string, {
    name: string;
    attributes: Record<string, string>;
    sublabels?: ServerMapping;
}>;

function convertAgentAPIToModel(agentAPI): SerializedModel {
    let kind: ModelKind;
    switch (agentAPI.agent_type) {
        case AgentType.DETECTOR:
            kind = ModelKind.DETECTOR;
            break;
        case AgentType.INTERACTOR:
            kind = ModelKind.INTERACTOR;
            break;
        case AgentType.TRACKER:
            kind = ModelKind.TRACKER;
            break;
        case AgentType.REID:
            kind = ModelKind.REID;
            break;
        default:
            throw new Error(`Unsupported agent type: ${agentAPI.agent_type}`);
    }

    const labelsV2 = agentAPI.labels?.map((label) => ({
        name: label,
        type: ShapeType.RECTANGLE,
        attributes: [],
    })) || [];

    return {
        id: agentAPI.id,
        name: agentAPI.name,
        labels: labelsV2,
        description: `${agentAPI.provider} agent API`,
        kind,
        provider: agentAPI.provider,
        return_type: kind === ModelKind.DETECTOR ? LabelType.RECTANGLE : undefined,
        min_pos_points: kind === ModelKind.INTERACTOR ? 1 : undefined,
        min_neg_points: kind === ModelKind.INTERACTOR ? 0 : undefined,
        startswith_box: kind === ModelKind.INTERACTOR ? false : undefined,
        help_message: 'Use this agent API for annotation assistance',
        animated_gif: '',
        is_agent_api: true,
    };
}

class AgentManager {
    private agents: MLModel[] = [];

    async list(): Promise<{ models: MLModel[], count: number }> {
        const response = await serverProxy.agents.get();

        // Handle both old and new response formats
        const agentAPIs = Array.isArray(response) ? response : response.results || [];
        const count = Array.isArray(response) ? response.length : response.count || 0;
        this.agents = agentAPIs
            .filter((agent) => agent.agent_type)
            .map((agent) => new MLModel(convertAgentAPIToModel(agent)));
        return { models: this.agents, count };
    }

    async call(
        taskID: number,
        model: MLModel,
        args: any,
    ): Promise<TrackerResults | InteractorResults | DetectedShape[]> {
        if (!Number.isInteger(taskID) || taskID < 0) {
            throw new ArgumentError(`Argument taskID must be a positive integer. Got "${taskID}"`);
        }

        const body = { ...args, task: taskID };
        const agentID = model.serialized.id;

        const agentAPI = await serverProxy.agents.getOne(agentID);
        if (!agentAPI) throw new Error(`Agent with ID ${agentID} not found`);

        const result = await serverProxy.agents.call(agentID, taskID, body);

        switch (model.serialized.kind) {
            case ModelKind.DETECTOR:
                return this.processDetectorResult(result, args.mapping);
            case ModelKind.INTERACTOR:
                return this.processInteractorResult(result);
            case ModelKind.TRACKER:
                return this.processTrackerResult(result);
            default:
                throw new Error(`Unsupported agent kind: ${model.serialized.kind}`);
        }
    }

    private processDetectorResult(result: any, mapping: ServerMapping): DetectedShape[] {
        if (!Array.isArray(result)) {
            throw new Error('Detector result must be an array of shapes');
        }

        const mappedLabels = this.getMappedModelLabels(mapping);
        const filtered = result.filter((item) => mappedLabels.includes(item.label));

        return filtered.map((item) => ({
            type: item.type || ShapeType.RECTANGLE,
            points: item.points,
            label: this.getTaskLabelName(item.label, mapping),
            attributes: item.attributes || [],
            confidence: item.confidence,
            elements: [],
        }));
    }

    private processInteractorResult(result: any): InteractorResults {
        return result;
    }

    private processTrackerResult(result: any): TrackerResults {
        if (!result.states && !result.shapes) {
            throw new Error('Tracker result must contain states or shapes');
        }

        return {
            states: result.states || [],
            shapes: result.shapes || [],
        };
    }

    private getMappedModelLabels(mapping: ServerMapping): string[] {
        let labels: string[] = [];
        for (const modelLabel of Object.keys(mapping)) {
            labels.push(modelLabel);
            if (mapping[modelLabel].sublabels) {
                labels = labels.concat(this.getMappedModelLabels(mapping[modelLabel].sublabels));
            }
        }
        return labels;
    }

    private getTaskLabelName(modelLabel: string, mapping: ServerMapping): string {
        let current = mapping;
        const parts = modelLabel.split('.');
        let taskLabelName = modelLabel;

        for (const part of parts) {
            if (current[part]) {
                taskLabelName = current[part].name;
                current = current[part].sublabels || {};
            } else {
                break;
            }
        }

        return taskLabelName;
    }

    getCachedAgents(): MLModel[] {
        return this.agents;
    }

    async get(agentID: string): Promise<MLModel | null> {
        const agentAPI = await serverProxy.agents.getOne(agentID);
        if (!agentAPI) return null;

        return new MLModel(convertAgentAPIToModel(agentAPI));
    }

    async reload(): Promise<void> {
        await this.list();
    }

    async list_requests(): Promise<any[]> {
        const response = await serverProxy.agent_requests.list();
        const agentRequests = response.jobs;
        return agentRequests
            .filter((request) => [RQStatus.QUEUED, RQStatus.STARTED].includes(request.status));
    }

    async cancel_request(requestID: string): Promise<void> {
        await serverProxy.agent_requests.cancel(requestID);
    }

    async run_request(taskID: number, model: MLModel, args: any): Promise<string> {
        if (!Number.isInteger(taskID) || taskID < 0) {
            throw new ArgumentError(`Argument taskID must be a positive integer. Got "${taskID}"`);
        }

        if (!(model instanceof MLModel)) {
            throw new ArgumentError(
                `Argument model is expected to be an instance of MLModel class, but got ${typeof model}`,
            );
        }

        if (args && typeof args !== 'object') {
            throw new ArgumentError(`Argument args is expected to be an object, but got ${typeof model}`);
        }

        const body = {
            ...args,
            task_id: taskID,
            agent_api_id: model.id,
        };

        const result = await serverProxy.agent_requests.run(body);
        return result.job_id;
    }

    async check_request_status(requestID: string): Promise<RQStatus> {
        const request = await serverProxy.agent_requests.status(requestID);
        return request.status;
    }
}

export default new AgentManager();
