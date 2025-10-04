import serverProxy from './server-proxy';
import MLModel from './ml-model';
import { ShapeType, AgentProvider, ModelKind, LabelType, AgentPublisher } from './enums';

interface InteractorResults {
    shapes: MinimalShape[];
    state: any;
}

interface MinimalShape {
    type: ShapeType;
    points: number[];
}

interface TrackerResults {
    shapes: MinimalShape[];
    state: any;
}

interface Agent {
    id: string | number;
    name: string;
    endpoint: string;
    auth_token: string;
    timeout: number;
    rate_limit: number;
    provider: string;
    publisher?: string;
    agent_type: string;
    is_public: boolean;
    labels: any[];
    label_source: string;
    created_date: string;
    updated_date: string;
    owner: number;
}

class AgentManager {
    public async list(): Promise<any> {
        const response = await serverProxy.agents.get();
        const agents = Array.isArray(response) ? response : [];
        return {
            agents: agents.map((agent: Agent) => this.convertAgentToMLModel(agent)),
            count: Array.isArray(response) ? response.length : (response.total || 0),
            next_cursor: Array.isArray(response) ? null : (response.next_page || null),
            previous_cursor: Array.isArray(response) ? null : (response.previous_page || null)
        };
    }

    public async getAgent(id: string | number): Promise<MLModel> {
        const agent = await serverProxy.agents.getOne(id);
        return this.convertAgentToMLModel(agent);
    }

    public async create(agentData: Partial<Agent>): Promise<MLModel> {
        const agent = await serverProxy.agents.create(agentData);
        return this.convertAgentToMLModel(agent);
    }

    public async update(id: string | number, agentData: Partial<Agent>): Promise<MLModel> {
        const agent = await serverProxy.agents.update(id, agentData);
        return this.convertAgentToMLModel(agent);
    }

    public async delete(id: string | number): Promise<void> {
        await serverProxy.agents.delete(id);
    }

    public async call(id: string | number, body: any): Promise<any> {
        return await serverProxy.agents.call(id, body);
    }

    // Agent Jobs methods
    public async listJobs(filter = {}): Promise<any> {
        return await serverProxy.agentJobs.get(filter);
    }

    public async getJob(jobId: string | number): Promise<any> {
        return await serverProxy.agentJobs.getOne(jobId);
    }

    public async cancelJob(jobId: string | number): Promise<void> {
        return await serverProxy.agentJobs.cancel(jobId);
    }

    public async createJob(jobData: any): Promise<any> {
        return await serverProxy.agentJobs.create(jobData);
    }

    private convertAgentToMLModel(agent: Agent): MLModel {
        // Map agent_type to ModelKind
        let kind: ModelKind;
        switch (agent.agent_type.toLowerCase()) {
            case 'detector':
                kind = ModelKind.DETECTOR;
                break;
            case 'interactor':
                kind = ModelKind.INTERACTOR;
                break;
            case 'tracker':
                kind = ModelKind.TRACKER;
                break;
            default:
                kind = ModelKind.DETECTOR; // Default to detector if unknown type
                break;
        }

        // Convert string labels to MLModelLabel format
        const convertedLabels = (agent.labels || []).map((labelName: string) => ({
            name: labelName,
            type: LabelType.ANY,
            attributes: [],
            sublabels: []
        }));

        const serializedModel = {
            id: agent.id,
            name: agent.name,
            labels_v2: convertedLabels,
            framework: 'dataup',
            description: `DataUp Agent: ${agent.name}`,
            type: agent.agent_type,
            kind,
            return_type: 'state',
            owner: { id: agent.owner },
            provider: AgentProvider.DATAUP,
            publisher: agent.publisher || AgentPublisher.CUSTOM,
            url: agent.endpoint,
            help_message: '',
            animated_gif: '',
            min_pos_points: 0,
            min_neg_points: 0,
            startswith_box: false,
            created_date: agent.created_date,
            updated_date: agent.updated_date,
            // Additional agent-specific properties
            rate_limit: agent.rate_limit,
            is_public: agent.is_public
        };

        return new MLModel(serializedModel);
    }
}

export default new AgentManager();
