// Copyright (C) 2024 CVAT.ai Corporation
//
// SPDX-License-Identifier: MIT

import { AnyAction } from 'redux';
import { BoundariesActionTypes } from 'actions/boundaries-actions';
import { AgentActionTypes } from 'actions/agent-actions';
import { AuthActionTypes } from 'actions/auth-actions';
import { omit } from 'lodash';
import { MLModel } from 'cvat-core-wrapper';

import { AgentsState } from '.';

const defaultState: AgentsState = {
    initialized: false,
    fetching: false,
    count: 0,
    current: [],
    gettingQuery: {
        cursor: null,
        page_size: 10,
        search: null,
        sort: null,
        filter: null,
    },
    next_cursor: null,
    previous_cursor: null,
    error: null,
    missingApiKey: false,
    activities: {
        creates: {
            id: null,
            error: '',
        },
        deletes: {},
        updates: {},
        calls: {},
    },
    runAgentDialog: {
        visible: false,
        agentInstance: null,
    },
};

export default (state: AgentsState = defaultState, action: AnyAction): AgentsState => {
    switch (action.type) {
        case AgentActionTypes.GET_AGENTS:
            return {
                ...state,
                activities: {
                    ...state.activities,
                    deletes: {},
                },
                initialized: false,
                fetching: true,
                count: 0,
                error: null,
                missingApiKey: false,
                gettingQuery: action.payload.query ? {
                    ...defaultState.gettingQuery,
                    ...action.payload.query,
                } : state.gettingQuery,
            };
        case AgentActionTypes.GET_AGENTS_SUCCESS: {
            return {
                ...state,
                initialized: true,
                fetching: false,
                count: action.payload.count,
                current: action.payload.agents,
                next_cursor: action.payload.next_cursor,
                previous_cursor: action.payload.previous_cursor,
                error: null,
                missingApiKey: false,
            };
        }
        case AgentActionTypes.GET_AGENTS_FAILED:
            return {
                ...state,
                initialized: true,
                fetching: false,
                error: action.payload?.error ? action.payload.error.toString() : 'Failed to load APIs',
                missingApiKey: !!(action.payload?.error && (action.payload.error.code === 404 || action.payload.error?.response?.status === 404)),
                current: [],
                count: 0,
            };
        case AgentActionTypes.GET_AGENT:
            return {
                ...state,
                fetching: true,
            };
        case AgentActionTypes.GET_AGENT_SUCCESS: {
            const { agent } = action.payload;
            const index = state.current.findIndex((_agent: MLModel) => _agent.id === agent.id);
            if (index !== -1) {
                const newCurrent = [...state.current];
                newCurrent[index] = agent;
                return {
                    ...state,
                    fetching: false,
                    current: newCurrent,
                };
            }
            return {
                ...state,
                fetching: false,
                current: [...state.current, agent],
            };
        }
        case AgentActionTypes.GET_AGENT_FAILED:
            return {
                ...state,
                fetching: false,
            };
        case AgentActionTypes.CREATE_AGENT:
            return {
                ...state,
                activities: {
                    ...state.activities,
                    creates: {
                        id: null,
                        error: '',
                    },
                },
            };
        case AgentActionTypes.CREATE_AGENT_SUCCESS: {
            const { agent } = action.payload;
            return {
                ...state,
                activities: {
                    ...state.activities,
                    creates: {
                        id: agent.id,
                        error: '',
                    },
                },
                current: [...state.current, agent],
                count: state.count + 1,
            };
        }
        case AgentActionTypes.CREATE_AGENT_FAILED: {
            return {
                ...state,
                activities: {
                    ...state.activities,
                    creates: {
                        id: null,
                        error: action.payload.error.toString(),
                    },
                },
            };
        }
        case AgentActionTypes.UPDATE_AGENT: {
            const { id } = action.payload;
            return {
                ...state,
                activities: {
                    ...state.activities,
                    updates: {
                        ...state.activities.updates,
                        [id]: true,
                    },
                },
            };
        }
        case AgentActionTypes.UPDATE_AGENT_SUCCESS: {
            const { agent } = action.payload;
            const index = state.current.findIndex((_agent: MLModel) => _agent.id === agent.id);
            if (index !== -1) {
                const newCurrent = [...state.current];
                newCurrent[index] = agent;
                return {
                    ...state,
                    activities: {
                        ...state.activities,
                        updates: omit(state.activities.updates, agent.id),
                    },
                    current: newCurrent,
                };
            }
            return {
                ...state,
                activities: {
                    ...state.activities,
                    updates: omit(state.activities.updates, agent.id),
                },
            };
        }
        case AgentActionTypes.UPDATE_AGENT_FAILED: {
            const { id } = action.payload;
            return {
                ...state,
                activities: {
                    ...state.activities,
                    updates: omit(state.activities.updates, id),
                },
            };
        }
        case AgentActionTypes.DELETE_AGENT: {
            const { id } = action.payload;
            return {
                ...state,
                activities: {
                    ...state.activities,
                    deletes: {
                        ...state.activities.deletes,
                        [id]: true,
                    },
                },
            };
        }
        case AgentActionTypes.DELETE_AGENT_SUCCESS: {
            const { id } = action.payload;
            return {
                ...state,
                activities: {
                    ...state.activities,
                    deletes: omit(state.activities.deletes, id),
                },
                current: state.current.filter((_agent: any) => _agent.id !== id),
                count: state.count - 1,
            };
        }
        case AgentActionTypes.DELETE_AGENT_FAILED: {
            const { id } = action.payload;
            return {
                ...state,
                activities: {
                    ...state.activities,
                    deletes: omit(state.activities.deletes, id),
                },
            };
        }
        case AgentActionTypes.CALL_AGENT: {
            const { id } = action.payload;
            return {
                ...state,
                activities: {
                    ...state.activities,
                    calls: {
                        ...state.activities.calls,
                        [id]: true,
                    },
                },
            };
        }
        case AgentActionTypes.CALL_AGENT_SUCCESS: {
            const { id } = action.payload;
            return {
                ...state,
                activities: {
                    ...state.activities,
                    calls: omit(state.activities.calls, id),
                },
            };
        }
        case AgentActionTypes.CALL_AGENT_FAILED: {
            const { id } = action.payload;
            return {
                ...state,
                activities: {
                    ...state.activities,
                    calls: omit(state.activities.calls, id),
                },
            };
        }
        case AgentActionTypes.SHOW_RUN_AGENT_DIALOG: {
            const { agentInstance } = action.payload;
            return {
                ...state,
                runAgentDialog: {
                    visible: true,
                    agentInstance,
                },
            };
        }
        case AgentActionTypes.CLOSE_RUN_AGENT_DIALOG:
            return {
                ...state,
                runAgentDialog: {
                    visible: false,
                    agentInstance: null,
                },
            };
        case AgentActionTypes.UPDATE_AGENTS_GETTING_QUERY: {
            const { query } = action.payload;
            return {
                ...state,
                gettingQuery: {
                    ...state.gettingQuery,
                    ...query,
                },
            };
        }
        case BoundariesActionTypes.RESET_AFTER_ERROR:
        case AuthActionTypes.LOGOUT_SUCCESS:
            return { ...defaultState };
        default:
            return state;
    }
};