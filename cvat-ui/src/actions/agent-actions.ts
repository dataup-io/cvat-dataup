// Copyright (C) 2020-2022 Intel Corporation
// Copyright (C) CVAT.ai Corporation
//
// SPDX-License-Identifier: MIT

import { ActionUnion, createAction, ThunkAction, ThunkDispatch } from 'utils/redux';
import { CombinedState } from 'reducers';
import { getCore } from 'cvat-core-wrapper';
import { filterNull } from 'utils/filter-null';

const core = getCore();

interface AgentsQuery {
    cursor?: string | null;
    page_size?: number | 'all';
    search?: string;
    sort?: string;
    filter?: string;
}

export enum AgentActionTypes {
    GET_AGENTS = 'GET_AGENTS',
    GET_AGENTS_SUCCESS = 'GET_AGENTS_SUCCESS',
    GET_AGENTS_FAILED = 'GET_AGENTS_FAILED',
    GET_AGENT = 'GET_AGENT',
    GET_AGENT_SUCCESS = 'GET_AGENT_SUCCESS',
    GET_AGENT_FAILED = 'GET_AGENT_FAILED',
    CREATE_AGENT = 'CREATE_AGENT',
    CREATE_AGENT_SUCCESS = 'CREATE_AGENT_SUCCESS',
    CREATE_AGENT_FAILED = 'CREATE_AGENT_FAILED',
    UPDATE_AGENT = 'UPDATE_AGENT',
    UPDATE_AGENT_SUCCESS = 'UPDATE_AGENT_SUCCESS',
    UPDATE_AGENT_FAILED = 'UPDATE_AGENT_FAILED',
    DELETE_AGENT = 'DELETE_AGENT',
    DELETE_AGENT_SUCCESS = 'DELETE_AGENT_SUCCESS',
    DELETE_AGENT_FAILED = 'DELETE_AGENT_FAILED',
    CALL_AGENT = 'CALL_AGENT',
    CALL_AGENT_SUCCESS = 'CALL_AGENT_SUCCESS',
    CALL_AGENT_FAILED = 'CALL_AGENT_FAILED',
    SHOW_RUN_AGENT_DIALOG = 'SHOW_RUN_AGENT_DIALOG',
    CLOSE_RUN_AGENT_DIALOG = 'CLOSE_RUN_AGENT_DIALOG',
    UPDATE_AGENTS_GETTING_QUERY = 'UPDATE_AGENTS_GETTING_QUERY',
}

export const agentActions = {
    getAgents: (query?: AgentsQuery) => createAction(AgentActionTypes.GET_AGENTS, { query }),
    getAgentsSuccess: (agents: any[], count: number, next_cursor?: string | null, previous_cursor?: string | null) => createAction(AgentActionTypes.GET_AGENTS_SUCCESS, {
        agents, count, next_cursor, previous_cursor,
    }),
    getAgentsFailed: (error: any) => createAction(AgentActionTypes.GET_AGENTS_FAILED, {
        error,
    }),
    getAgent: (id: string | number) => createAction(AgentActionTypes.GET_AGENT, { id }),
    getAgentSuccess: (agent: any) => createAction(AgentActionTypes.GET_AGENT_SUCCESS, {
        agent,
    }),
    getAgentFailed: (id: string | number, error: any) => createAction(AgentActionTypes.GET_AGENT_FAILED, {
        id, error,
    }),
    createAgent: () => createAction(AgentActionTypes.CREATE_AGENT),
    createAgentSuccess: (agent: any) => createAction(AgentActionTypes.CREATE_AGENT_SUCCESS, {
        agent,
    }),
    createAgentFailed: (error: any) => createAction(AgentActionTypes.CREATE_AGENT_FAILED, {
        error,
    }),
    updateAgent: (id: string | number) => createAction(AgentActionTypes.UPDATE_AGENT, { id }),
    updateAgentSuccess: (agent: any) => createAction(AgentActionTypes.UPDATE_AGENT_SUCCESS, {
        agent,
    }),
    updateAgentFailed: (id: string | number, error: any) => createAction(AgentActionTypes.UPDATE_AGENT_FAILED, {
        id, error,
    }),
    deleteAgent: (id: string | number) => createAction(AgentActionTypes.DELETE_AGENT, { id }),
    deleteAgentSuccess: (id: string | number) => createAction(AgentActionTypes.DELETE_AGENT_SUCCESS, {
        id,
    }),
    deleteAgentFailed: (id: string | number, error: any) => createAction(AgentActionTypes.DELETE_AGENT_FAILED, {
        id, error,
    }),
    callAgent: (id: string | number) => createAction(AgentActionTypes.CALL_AGENT, { id }),
    callAgentSuccess: (id: string | number, result: any) => createAction(AgentActionTypes.CALL_AGENT_SUCCESS, {
        id, result,
    }),
    callAgentFailed: (id: string | number, error: any) => createAction(AgentActionTypes.CALL_AGENT_FAILED, {
        id, error,
    }),
    showRunAgentDialog: (agentInstance: any) => createAction(AgentActionTypes.SHOW_RUN_AGENT_DIALOG, {
        agentInstance,
    }),
    closeRunAgentDialog: () => createAction(AgentActionTypes.CLOSE_RUN_AGENT_DIALOG),
    updateAgentsGettingQuery: (query: Partial<AgentsQuery>) => createAction(AgentActionTypes.UPDATE_AGENTS_GETTING_QUERY, {
        query,
    }),
};

export type AgentActions = ActionUnion<typeof agentActions>;

export function getAgentsAsync(query?: AgentsQuery): ThunkAction {
    return async (dispatch: ThunkDispatch, getState: () => CombinedState): Promise<void> => {
        dispatch(agentActions.getAgents(query));

        const filteredQuery = filterNull(query || {});
        try {
            const result = await core.agents.list(filteredQuery);
            const { agents, count, next_cursor, previous_cursor } = result;
            dispatch(agentActions.getAgentsSuccess(agents, count, next_cursor, previous_cursor));
        } catch (error) {
            dispatch(agentActions.getAgentsFailed(error));
        }
    };
}

export function getAgentAsync(id: string | number): ThunkAction {
    return async (dispatch: ThunkDispatch): Promise<void> => {
        dispatch(agentActions.getAgent(id));

        try {
            const agent = await core.agents.get(id);
            dispatch(agentActions.getAgentSuccess(agent));
        } catch (error) {
            dispatch(agentActions.getAgentFailed(id, error));
        }
    };
}

export function createAgentAsync(agentData: any): ThunkAction {
    return async (dispatch: ThunkDispatch): Promise<void> => {
        dispatch(agentActions.createAgent());

        try {
            const agent = await core.agents.create(agentData);
            dispatch(agentActions.createAgentSuccess(agent));
        } catch (error) {
            dispatch(agentActions.createAgentFailed(error));
        }
    };
}

export function updateAgentAsync(id: string | number, agentData: any): ThunkAction {
    return async (dispatch: ThunkDispatch): Promise<void> => {
        dispatch(agentActions.updateAgent(id));

        try {
            const agent = await core.agents.update(id, agentData);
            dispatch(agentActions.updateAgentSuccess(agent));
        } catch (error) {
            dispatch(agentActions.updateAgentFailed(id, error));
        }
    };
}

export function deleteAgentAsync(id: string | number): ThunkAction {
    return async (dispatch: ThunkDispatch): Promise<void> => {
        dispatch(agentActions.deleteAgent(id));

        try {
            await core.agents.delete(id);
            dispatch(agentActions.deleteAgentSuccess(id));
        } catch (error) {
            dispatch(agentActions.deleteAgentFailed(id, error));
        }
    };
}

export function callAgentAsync(id: string | number, taskId: number, frameId?: number): ThunkAction {
    return async (dispatch: ThunkDispatch): Promise<void> => {
        dispatch(agentActions.callAgent(id));

        try {
            const body = { taskId, frameId };
            const result = await core.agents.call(id, body);
            dispatch(agentActions.callAgentSuccess(id, result));
        } catch (error) {
            dispatch(agentActions.callAgentFailed(id, error));
        }
    };
}