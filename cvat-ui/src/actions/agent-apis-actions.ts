import { getCore } from 'cvat-core-wrapper';
import { AgentAPIsFilter } from 'cvat-core/src/server-response-types';
import { ActionUnion, createAction, ThunkAction } from 'utils/redux';

const core = getCore();

export enum AgentAPIActionTypes {
    GET_AGENT_APIS = 'GET_AGENT_APIS',
    GET_AGENT_APIS_SUCCESS = 'GET_AGENT_APIS_SUCCESS',
    GET_AGENT_APIS_FAILED = 'GET_AGENT_APIS_FAILED',
    CREATE_AGENT_API = 'CREATE_AGENT_API',
    CREATE_AGENT_API_SUCCESS = 'CREATE_AGENT_API_SUCCESS',
    CREATE_AGENT_API_FAILED = 'CREATE_AGENT_API_FAILED',
    UPDATE_AGENT_API = 'UPDATE_AGENT_API',
    UPDATE_AGENT_API_SUCCESS = 'UPDATE_AGENT_API_SUCCESS',
    UPDATE_AGENT_API_FAILED = 'UPDATE_AGENT_API_FAILED',
    DELETE_AGENT_API = 'DELETE_AGENT_API',
    DELETE_AGENT_API_SUCCESS = 'DELETE_AGENT_API_SUCCESS',
    DELETE_AGENT_API_FAILED = 'DELETE_AGENT_API_FAILED',
    UPDATE_AGENT_APIS_GETTING_QUERY = 'UPDATE_AGENT_APIS_GETTING_QUERY',
}

export const agentApisActions = {
    getAgentApis: () => createAction(AgentAPIActionTypes.GET_AGENT_APIS),
    getAgentApisSuccess: (apis: any[], count: number, query: Partial<AgentAPIsFilter>) => (
        createAction(AgentAPIActionTypes.GET_AGENT_APIS_SUCCESS, { apis, count, query })
    ),
    getAgentApisFailed: (error: any, query: Partial<AgentAPIsFilter>) => (
        createAction(AgentAPIActionTypes.GET_AGENT_APIS_FAILED, { error, query })
    ),
    createAgentApi: () => createAction(AgentAPIActionTypes.CREATE_AGENT_API),
    createAgentApiSuccess: (apiId: string) => (
        createAction(AgentAPIActionTypes.CREATE_AGENT_API_SUCCESS, { apiId })
    ),
    createAgentApiFailed: (error: any) => (
        createAction(AgentAPIActionTypes.CREATE_AGENT_API_FAILED, { error })
    ),
    updateAgentApi: () => createAction(AgentAPIActionTypes.UPDATE_AGENT_API),
    updateAgentApiSuccess: (api: any) => (
        createAction(AgentAPIActionTypes.UPDATE_AGENT_API_SUCCESS, { api })
    ),
    updateAgentApiFailed: (apiId: string, error: any) => (
        createAction(AgentAPIActionTypes.UPDATE_AGENT_API_FAILED, { apiId, error })
    ),
    deleteAgentApi: (apiId: string) => createAction(AgentAPIActionTypes.DELETE_AGENT_API, { apiId }),
    deleteAgentApiSuccess: (apiId: string) => (
        createAction(AgentAPIActionTypes.DELETE_AGENT_API_SUCCESS, { apiId })
    ),
    deleteAgentApiFailed: (apiId: string, error: any) => (
        createAction(AgentAPIActionTypes.DELETE_AGENT_API_FAILED, { apiId, error })
    ),
    updateAgentApisGettingQuery: (query: Partial<AgentAPIsFilter>) => (
        createAction(AgentAPIActionTypes.UPDATE_AGENT_APIS_GETTING_QUERY, { query })
    ),
};

export type AgentAPIActions = ActionUnion<typeof agentApisActions>;

export function getAgentApisAsync(query: Partial<AgentAPIsFilter> = {}): ThunkAction {
    return async (dispatch) => {
        console.log('getAgentApisAsync - Starting with query:', query);
        dispatch(agentApisActions.getAgentApis());
        dispatch(agentApisActions.updateAgentApisGettingQuery(query));

        const filteredQuery = { ...query };
        Object.keys(filteredQuery).forEach((key: string) => {
            if ((filteredQuery as Record<string, unknown>)[key] === null) {
                delete (filteredQuery as { [key: string]: unknown })[key];
            }
        });
        console.log('getAgentApisAsync - Filtered query:', filteredQuery);

        try {
            const result = await core.agentApis.get(filteredQuery);
            console.log('getAgentApisAsync - API result:', result);
            dispatch(agentApisActions.getAgentApisSuccess(result.results, result.count, query));
        } catch (error) {
            console.error('getAgentApisAsync - Error:', error);
            dispatch(agentApisActions.getAgentApisFailed(error, query));
        }
    };
}

export function createAgentApiAsync(apiData: any): ThunkAction {
    return async (dispatch, getState) => {
        dispatch(agentApisActions.createAgentApi());
        try {
            const api = await core.agentApis.create(apiData);
            dispatch(agentApisActions.createAgentApiSuccess(api));
            const { gettingQuery } = getState().agentApis;
            dispatch(getAgentApisAsync(gettingQuery));
        } catch (error) {
            dispatch(agentApisActions.createAgentApiFailed(error));
        }
    };
}

export function updateAgentApiAsync(api: any): ThunkAction {
    return async (dispatch, getState) => {
        dispatch(agentApisActions.updateAgentApi());
        try {
            const updatedApi = await core.agentApis.update(api);
            dispatch(agentApisActions.updateAgentApiSuccess(updatedApi));
            const { gettingQuery } = getState().agentApis;
            dispatch(getAgentApisAsync(gettingQuery));
        } catch (error) {
            dispatch(agentApisActions.updateAgentApiFailed(api.id, error));
        }
    };
}

export function deleteAgentApiAsync(api: any): ThunkAction {
    return async (dispatch) => {
        dispatch(agentApisActions.deleteAgentApi(api.id));
        try {
            await core.agentApis.delete(api);
            dispatch(agentApisActions.deleteAgentApiSuccess(api.id));
        } catch (error) {
            dispatch(agentApisActions.deleteAgentApiFailed(api.id, error));
        }
    };
}
