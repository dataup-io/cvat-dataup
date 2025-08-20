// Copyright (C) 2020-2022 Intel Corporation
// Copyright (C) CVAT.ai Corporation
//
// SPDX-License-Identifier: MIT

import { ActionUnion, createAction, ThunkAction } from 'utils/redux';
import {
    ActiveInference, ModelsQuery,
} from 'reducers';
import { getCore, MLModel, RQStatus } from 'cvat-core-wrapper';
import { filterNull } from 'utils/filter-null';

export enum ModelsActionTypes {
    GET_MODELS = 'GET_MODELS',
    GET_MODELS_SUCCESS = 'GET_MODELS_SUCCESS',
    GET_MODELS_FAILED = 'GET_MODELS_FAILED',
    GET_MODELS_SERVER_ERROR = 'GET_MODELS_SERVER_ERROR',
    CREATE_MODEL = 'CREATE_MODEL',
    CREATE_MODEL_SUCCESS = 'CREATE_MODEL_SUCCESS',
    CREATE_MODEL_FAILED = 'CREATE_MODEL_FAILED',
    DELETE_MODEL = 'DELETE_MODEL',
    DELETE_MODEL_SUCCESS = 'DELETE_MODEL_SUCCESS',
    DELETE_MODEL_FAILED = 'DELETE_MODEL_FAILED',
    GET_INFERENCES_SUCCESS = 'GET_INFERENCES_SUCCESS',
    START_INFERENCE_FAILED = 'START_INFERENCE_FAILED',
    GET_INFERENCE_STATUS_SUCCESS = 'GET_INFERENCE_STATUS_SUCCESS',
    GET_INFERENCE_STATUS_FAILED = 'GET_INFERENCE_STATUS_FAILED',
    FETCH_META_FAILED = 'FETCH_META_FAILED',
    SHOW_RUN_MODEL_DIALOG = 'SHOW_RUN_MODEL_DIALOG',
    CLOSE_RUN_MODEL_DIALOG = 'CLOSE_RUN_MODEL_DIALOG',
    CANCEL_INFERENCE_SUCCESS = 'CANCEL_INFERENCE_SUCCESS',
    CANCEL_INFERENCE_FAILED = 'CANCEL_INFERENCE_FAILED',
    GET_MODEL_PROVIDERS = 'GET_MODEL_PROVIDERS',
    GET_MODEL_PROVIDERS_SUCCESS = 'GET_MODEL_PROVIDERS_SUCCESS',
    GET_MODEL_PROVIDERS_FAILED = 'GET_MODEL_PROVIDERS_FAILED',
    GET_MODEL_PREVIEW = 'GET_MODEL_PREVIEW',
    GET_MODEL_PREVIEW_SUCCESS = 'GET_MODEL_PREVIEW_SUCCESS',
    GET_MODEL_PREVIEW_FAILED = 'GET_MODEL_PREVIEW_FAILED',
}

export const modelsActions = {
    getModels: (query?: ModelsQuery) => createAction(ModelsActionTypes.GET_MODELS, { query }),
    getModelsSuccess: (models: MLModel[], count: number) => createAction(ModelsActionTypes.GET_MODELS_SUCCESS, {
        models, count,
    }),
    getModelsFailed: (error: any) => createAction(ModelsActionTypes.GET_MODELS_FAILED, {
        error,
    }),
    getModelsServerError: (error: any) => createAction(ModelsActionTypes.GET_MODELS_SERVER_ERROR, {
        error,
    }),
    fetchMetaFailed: (error: any) => createAction(ModelsActionTypes.FETCH_META_FAILED, { error }),
    getInferencesSuccess: (requestedInferenceIDs: Record<string, boolean>) => (
        createAction(ModelsActionTypes.GET_INFERENCES_SUCCESS, { requestedInferenceIDs })
    ),
    getInferenceStatusSuccess: (taskID: number, activeInference: ActiveInference) => (
        createAction(ModelsActionTypes.GET_INFERENCE_STATUS_SUCCESS, {
            taskID,
            activeInference,
        })
    ),
    getInferenceStatusFailed: (taskID: number, activeInference: ActiveInference, error: any) => (
        createAction(ModelsActionTypes.GET_INFERENCE_STATUS_FAILED, {
            taskID,
            activeInference,
            error,
        })
    ),
    startInferenceFailed: (taskID: number, error: any) => (
        createAction(ModelsActionTypes.START_INFERENCE_FAILED, {
            taskID,
            error,
        })
    ),
    cancelInferenceSuccess: (taskID: number, activeInference: ActiveInference) => (
        createAction(ModelsActionTypes.CANCEL_INFERENCE_SUCCESS, {
            taskID,
            activeInference,
        })
    ),
    cancelInferenceFailed: (taskID: number, error: any) => (
        createAction(ModelsActionTypes.CANCEL_INFERENCE_FAILED, {
            taskID,
            error,
        })
    ),
    closeRunModelDialog: () => createAction(ModelsActionTypes.CLOSE_RUN_MODEL_DIALOG),
    showRunModelDialog: (taskInstance: any) => (
        createAction(ModelsActionTypes.SHOW_RUN_MODEL_DIALOG, {
            taskInstance,
        })
    ),
    getModelPreview: (modelID: string | number) => (
        createAction(ModelsActionTypes.GET_MODEL_PREVIEW, { modelID })
    ),
    getModelPreviewSuccess: (modelID: string | number, preview: string) => (
        createAction(ModelsActionTypes.GET_MODEL_PREVIEW_SUCCESS, { modelID, preview })
    ),
    getModelPreviewFailed: (modelID: string | number, error: any) => (
        createAction(ModelsActionTypes.GET_MODEL_PREVIEW_FAILED, { modelID, error })
    ),
};

export type ModelsActions = ActionUnion<typeof modelsActions>;

const core = getCore();

export function getLambdaAsync(query?: ModelsQuery): ThunkAction {
    return async (dispatch, getState): Promise<MLModel[]> => {
        const filteredQuery = filterNull(query || getState().models.query);
        try {
            const result = await core.lambda.list(filteredQuery);
            return result;
        } catch (error) {
            console.error('Lambda models fetch failed:', error);
            return [];
        }
    };
}

export function getAgentsAsync(query?: ModelsQuery): ThunkAction {
    return async (dispatch, getState): Promise<MLModel[]> => {
        // Return empty list - will be changed in future release.
        return [];
    };
}

export function getModelsAsync(query?: ModelsQuery): ThunkAction {
    return async (dispatch, getState): Promise<void> => {
        dispatch(modelsActions.getModels(query));

        let lambdaModels: MLModel[] = [];
        let agentModels: MLModel[] = [];
        let lambdaError: any = null;
        let agentError: any = null;

        try {
            lambdaModels = await getLambdaAsync(query)(dispatch, getState);
        } catch (error) {
            lambdaError = error;
            console.error('Lambda models fetch failed:', error);
        }

        try {
            agentModels = await getAgentsAsync(query)(dispatch, getState);
        } catch (error) {
            agentError = error;
            console.error('Agent models fetch failed:', error);
        }

        const models = [...lambdaModels, ...agentModels];
        
        if (lambdaError && agentError) {
            // Both services failed
            dispatch(modelsActions.getModelsFailed(agentError));
        } else {
            // At least one service succeeded
            dispatch(modelsActions.getModelsSuccess(models, models.length));
        }
    };
}


interface InferenceMeta {
    taskID: number;
    requestID: string;
    functionID: string | number;
}

function listen(inferenceMeta: InferenceMeta, dispatch: (action: ModelsActions) => void): void {
    const { taskID, requestID, functionID } = inferenceMeta;

    core.agents.check_request_status(requestID)
        .then((status: RQStatus) => {
            // For failed or unknown status, dispatch error and stop checking
            if (status === RQStatus.FAILED || status === RQStatus.UNKNOWN) {
                dispatch(
                    modelsActions.getInferenceStatusFailed(
                        taskID,
                        {
                            status,
                            progress: 0,
                            functionID,
                            error: `Inference failed with status ${status}`,
                            id: requestID,
                        },
                        new Error(`Inference status for the task ${taskID} is ${status}.`),
                    ),
                );
                return;
            }

            // For completed status, dispatch success with 100% progress and stop checking
            if (status === RQStatus.FINISHED) {
                dispatch(
                    modelsActions.getInferenceStatusSuccess(taskID, {
                        status,
                        progress: 100,
                        functionID,
                        error: '',
                        id: requestID,
                    }),
                );
                return; // Important: stop the recursive calls when completed
            }

            // For in-progress status (QUEUED, STARTED), dispatch success with partial progress
            dispatch(
                modelsActions.getInferenceStatusSuccess(taskID, {
                    status,
                    progress: 50, // Simplified progress for in-progress states
                    functionID,
                    error: '',
                    id: requestID,
                }),
            );

            // Only continue polling for in-progress statuses
            setTimeout(() => {
                listen(inferenceMeta, dispatch);
            }, 3000); // Poll every 3 seconds
        })
        .catch((error: Error) => {
            dispatch(
                modelsActions.getInferenceStatusFailed(taskID, {
                    status: RQStatus.UNKNOWN,
                    progress: 0,
                    error: error.toString(),
                    id: requestID,
                    functionID,
                }, error),
            );
        });
}

export function getInferenceStatusAsync(): ThunkAction {
    return async (dispatch, getState): Promise<void> => {
        const dispatchCallback = (action: ModelsActions): void => {
            dispatch(action);
        };

        const { requestedInferenceIDs } = getState().models;

        try {
            const requests = await core.agents.list_requests();
            const newListenedIDs: Record<string, boolean> = {};
            requests
                .map((request: any): object => ({
                    taskID: +request.task_id,
                    requestID: request.id,
                    functionID: request.agent_api_id,
                }))
                .forEach((inferenceMeta: InferenceMeta): void => {
                    if (!(inferenceMeta.requestID in requestedInferenceIDs)) {
                        listen(inferenceMeta, dispatchCallback);
                        newListenedIDs[inferenceMeta.requestID] = true;
                    }
                });
            dispatch(modelsActions.getInferencesSuccess(newListenedIDs));
        } catch (error) {
            dispatch(modelsActions.fetchMetaFailed(error));
        }
    };
}

export function startInferenceAsync(taskId: number, model: MLModel, body: object): ThunkAction {
    return async (dispatch): Promise<void> => {
        try {
            const requestID: string = await core.agents.run_request(taskId, model, body);
            const dispatchCallback = (action: ModelsActions): void => {
                dispatch(action);
            };

            listen(
                {
                    taskID: taskId,
                    functionID: model.id,
                    requestID,
                },
                dispatchCallback,
            );
            dispatch(modelsActions.getInferencesSuccess({ [requestID]: true }));
        } catch (error) {
            dispatch(modelsActions.startInferenceFailed(taskId, error));
        }
    };
}

export function cancelInferenceAsync(taskID: number): ThunkAction {
    return async (dispatch, getState): Promise<void> => {
        try {
            const inference = getState().models.inferences[taskID];
            await core.agents.cancel_request(inference.id);
            dispatch(modelsActions.cancelInferenceSuccess(taskID, inference));
        } catch (error) {
            dispatch(modelsActions.cancelInferenceFailed(taskID, error));
        }
    };
}

export const getModelPreviewAsync = (model: MLModel): ThunkAction => async (dispatch) => {
    dispatch(modelsActions.getModelPreview(model.id));
    try {
        const result = await model.preview();
        dispatch(modelsActions.getModelPreviewSuccess(model.id, result));
    } catch (error) {
        dispatch(modelsActions.getModelPreviewFailed(model.id, error));
    }
};
