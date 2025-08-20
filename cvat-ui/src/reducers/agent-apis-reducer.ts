import { AuthActions, AuthActionTypes } from 'actions/auth-actions';
import { AgentAPIActions, AgentAPIActionTypes } from 'actions/agent-apis-actions';
import { AgentAPIsState } from '.';

const defaultState: AgentAPIsState = {
    initialized: false,
    fetching: false,
    count: 0,
    current: [],
    gettingQuery: {
        page: 1,
        page_size: 10,
        id: undefined,
        search: undefined,
        filter: undefined,
        sort: undefined,
    },
    activities: {
        creates: {
            id: null,
            error: '',
            fetching: false,
        },
        updates: {
            id: null,
            error: '',
            fetching: false,
        },
        deletes: {
            id: null,
            error: '',
            fetching: false,
        },
    },
};

export default function (
    state: AgentAPIsState = defaultState,
    action: AgentAPIActions | AuthActions,
): AgentAPIsState {
    switch (action.type) {
        case AgentAPIActionTypes.GET_AGENT_APIS: {
            return {
                ...state,
                fetching: true,
                initialized: false,
            };
        }
        case AgentAPIActionTypes.GET_AGENT_APIS_SUCCESS: {
            return {
                ...state,
                fetching: false,
                initialized: true,
                count: action.payload.count,
                current: action.payload.apis,
                gettingQuery: {
                    ...defaultState.gettingQuery,
                    ...action.payload.query,
                },
            };
        }
        case AgentAPIActionTypes.GET_AGENT_APIS_FAILED: {
            return {
                ...state,
                fetching: false,
                initialized: true,
            };
        }
        case AgentAPIActionTypes.UPDATE_AGENT_APIS_GETTING_QUERY: {
            return {
                ...state,
                gettingQuery: {
                    ...state.gettingQuery,
                    ...action.payload.query,
                },
            };
        }
        case AgentAPIActionTypes.CREATE_AGENT_API: {
            return {
                ...state,
                activities: {
                    ...state.activities,
                    creates: {
                        ...state.activities.creates,
                        fetching: true,
                        error: '',
                    },
                },
            };
        }
        case AgentAPIActionTypes.CREATE_AGENT_API_SUCCESS: {
            return {
                ...state,
                activities: {
                    ...state.activities,
                    creates: {
                        ...state.activities.creates,
                        fetching: false,
                        id: action.payload.apiId,
                    },
                },
            };
        }
        case AgentAPIActionTypes.CREATE_AGENT_API_FAILED: {
            return {
                ...state,
                activities: {
                    ...state.activities,
                    creates: {
                        ...state.activities.creates,
                        fetching: false,
                        error: action.payload.error.toString(),
                    },
                },
            };
        }
        case AgentAPIActionTypes.UPDATE_AGENT_API: {
            return {
                ...state,
                activities: {
                    ...state.activities,
                    updates: {
                        ...state.activities.updates,
                        fetching: true,
                        error: '',
                    },
                },
            };
        }
        case AgentAPIActionTypes.UPDATE_AGENT_API_SUCCESS: {
            return {
                ...state,
                activities: {
                    ...state.activities,
                    updates: {
                        ...state.activities.updates,
                        fetching: false,
                        id: action.payload.api.id,
                    },
                },
                current: state.current.map(
                    (api) => (api.id === action.payload.api.id ? action.payload.api : api),
                ),
            };
        }
        case AgentAPIActionTypes.UPDATE_AGENT_API_FAILED: {
            return {
                ...state,
                activities: {
                    ...state.activities,
                    updates: {
                        ...state.activities.updates,
                        fetching: false,
                        error: action.payload.error.toString(),
                        id: action.payload.apiId,
                    },
                },
            };
        }
        case AgentAPIActionTypes.DELETE_AGENT_API: {
            return {
                ...state,
                activities: {
                    ...state.activities,
                    deletes: {
                        ...state.activities.deletes,
                        fetching: true,
                        id: action.payload.apiId,
                        error: '',
                    },
                },
            };
        }
        case AgentAPIActionTypes.DELETE_AGENT_API_SUCCESS: {
            return {
                ...state,
                activities: {
                    ...state.activities,
                    deletes: {
                        ...state.activities.deletes,
                        fetching: false,
                        id: null,
                    },
                },
                current: state.current.filter((api) => api.id !== action.payload.apiId),
            };
        }
        case AgentAPIActionTypes.DELETE_AGENT_API_FAILED: {
            return {
                ...state,
                activities: {
                    ...state.activities,
                    deletes: {
                        ...state.activities.deletes,
                        fetching: false,
                        error: action.payload.error.toString(),
                    },
                },
            };
        }
        case AuthActionTypes.LOGOUT_SUCCESS: {
            return { ...defaultState };
        }
        default: {
            return state;
        }
    }
}
