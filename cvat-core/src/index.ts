// Copyright (C) CVAT.ai Corporation
//
// SPDX-License-Identifier: MIT

import {
    AnalyticsEventsFilter, QualityConflictsFilter, QualityReportsFilter,
    QualitySettingsFilter, ConsensusSettingsFilter,
} from './server-response-types';
import PluginRegistry from './plugins';
import serverProxy from './server-proxy';
import agentManager from './agent-manager';
import { AnnotationFormats } from './annotation-formats';
import logger from './logger';
import * as enums from './enums';
import config from './config';
import {
    mask2Rle, rle2Mask, propagateShapes, validateAttributeValue,
} from './object-utils';
import User from './user';
import Project from './project';
import { Job, Task } from './session';
import { Event } from './event';
import { Attribute, Label } from './labels';
import Statistics from './statistics';
import ObjectState from './object-state';
import MLModel from './ml-model';
import Issue from './issue';
import Comment from './comment';
import { FrameData, FramesMetaData } from './frames';
import CloudStorage from './cloud-storage';
import Organization, { Invitation } from './organization';
import Webhook from './webhook';
import QualityReport from './quality-report';
import QualityConflict from './quality-conflict';
import QualitySettings from './quality-settings';
import ConsensusSettings from './consensus-settings';
import AnnotationGuide from './guide';
import { JobValidationLayout, TaskValidationLayout } from './validation-layout';
import { Request } from './request';
import AboutData from './about';
import {
    runAction,
    callAction,
    listActions,
    registerAction,
    unregisterAction,
} from './annotations-actions/annotations-actions';
import { BaseCollectionAction } from './annotations-actions/base-collection-action';
import { BaseShapesAction } from './annotations-actions/base-shapes-action';
import {
    ArgumentError, DataError, Exception, ScriptingError, ServerError,
} from './exceptions';
import { CVATCoreAgentAPIs, PaginatedResource } from './core-types';


export default interface CVATCore {
    plugins: {
        list: typeof PluginRegistry.list;
        register: typeof PluginRegistry.register;
    };

    agents: {
        list: typeof agentManager.list;
        call: typeof agentManager.call;
        list_requests: typeof agentManager.list_requests;
        cancel_request: typeof agentManager.cancel_request;
        run_request: typeof agentManager.run_request;
        check_request_status: typeof agentManager.check_request_status;
    };

    server: {
        about: () => Promise<AboutData>;
        share: (dir: string) => Promise<{
            mimeType: string;
            name: string;
            type: enums.ShareFileType;
        }[]>;
        formats: () => Promise<AnnotationFormats>;
        userAgreements: typeof serverProxy.server.userAgreements,
        register: any; // TODO: add types later
        login: any;
        logout: any;
        changePassword: any;
        requestPasswordReset: any;
        resetPassword: any;
        authenticated: any;
        healthCheck: any;
        request: any;
        setAuthData: any;
        installedApps: any;
        apiSchema: typeof serverProxy.server.apiSchema;
        // dataUPHealth: {
        //     getOrganizationStatus: (organizationUuid: string) => Promise<any>;
        // };
    };
    assets: {
        create: any;
    };
    users: {
        get: any;
    };
    jobs: {
        get: (filter: {
            page?: number;
            filter?: string;
            sort?: string;
            search?: string;
            jobID?: number;
            taskID?: number;
            type?: string;
        }, aggregate?: boolean) => Promise<PaginatedResource<Job>>;
    };
    tasks: {
        get: (filter: {
            page?: number;
            pageSize?: number;
            projectId?: number;
            id?: number;
            sort?: string;
            search?: string;
            filter?: string;
            ordering?: string;
        }, aggregate?: boolean) => Promise<PaginatedResource<Task>>;
    }
    projects: {
        get: (
            filter: {
                id?: number;
                page?: number;
                pageSize?: number;
                search?: string;
                sort?: string;
                filter?: string;
            }
        ) => Promise<PaginatedResource<Project>>;
        searchNames: any;
    };
    cloudStorages: {
        get: any;
    };
    organizations: {
        get: any;
        activate: any;
        deactivate: any;
        acceptInvitation: (key: string) => Promise<string>;
        declineInvitation: (key: string) => Promise<void>;
        invitations: (filter: {
            page?: number,
            filter?: string,
        }) => Promise<Invitation[] & { count: number }>;
    };
    webhooks: {
        get: any;
    };
    consensus: {
        settings: {
            get: (filter: ConsensusSettingsFilter) => Promise<ConsensusSettings>;
        };
    }
    agentApis: CVATCoreAgentAPIs;
    dataUpApiKeys: {
        get: (filter?: any) => Promise<any>;
        create: (keyData: any) => Promise<any>;
        update: (id: string, keyData: any) => Promise<any>;
        delete: (id: string, organizationUuid?: string) => Promise<any>;
    };
    pipelines: {
        list: (filter?: any) => Promise<any>;
        get: (id: number) => Promise<any>;
        create: (pipelineData: any) => Promise<any>;
        update: (id: number, pipelineData: any) => Promise<any>;
        delete: (id: number) => Promise<void>;
        run: (id: number, runData: any) => Promise<any>;
        stepRegistry: (filter?: any) => Promise<any>;
        executions: (filter?: any) => Promise<any>;
        getExecution: (id: string) => Promise<any>;
        checkExecutionStatus: (id: string) => Promise<any>;
        cancelExecution: (id: string) => Promise<void>;
        deleteExecution: (id: string) => Promise<void>;
        steps: (filter?: any) => Promise<any>;
        createStep: (stepData: any) => Promise<any>;
        updateStep: (id: string, stepData: any) => Promise<any>;
        deleteStep: (id: string) => Promise<void>;
    };
    analytics: {
        quality: {
            reports: (filter: QualityReportsFilter, aggregate?: boolean) => Promise<PaginatedResource<QualityReport>>;
            conflicts: (filter: QualityConflictsFilter) => Promise<QualityConflict[]>;
            settings: {
                get: (
                    filter: QualitySettingsFilter,
                    aggregate?: boolean,
                ) => Promise<PaginatedResource<QualitySettings>>;
            };
        };
        events: {
            export: (filter: AnalyticsEventsFilter) => Promise<string>;
            getJSON: (filter: AnalyticsEventsFilter) => Promise<any>;
        };
        stats: {
            getClassDistribution: (filter: any) => Promise<any>;
        };
    };
    frames: {
        getMeta: any;
        getFrameUrl: (taskId: number, frameNumber: number) => Promise<string>;
    };
    requests: {
        list: () => Promise<PaginatedResource<Request>>;
        listen: (
            rqID: string,
            options: {
                callback: (request: Request) => void,
                initialRequest?: Request,
            }
        ) => Promise<Request>;
        cancel: (rqID: string) => Promise<void>;
    };
    actions: {
        list: typeof listActions;
        register: typeof registerAction;
        unregister: typeof unregisterAction;
        run: typeof runAction;
        call: typeof callAction;
    };
    logger: typeof logger;
    config: {
        backendAPI: typeof config.backendAPI;
        origin: typeof config.origin;
        uploadChunkSize: typeof config.uploadChunkSize;
        removeUnderlyingMaskPixels: {
            enabled: boolean;
            onEmptyMaskOccurrence: () => void | null;
        };
        onOrganizationChange: (newOrgId: number | null) => void | null;
        globalObjectsCounter: typeof config.globalObjectsCounter;
        requestsStatusDelay: typeof config.requestsStatusDelay;
        jobMetaDataReloadPeriod: typeof config.jobMetaDataReloadPeriod;
    },
    enums,
    exceptions: {
        Exception: typeof Exception,
        ArgumentError: typeof ArgumentError,
        DataError: typeof DataError,
        ScriptingError: typeof ScriptingError,
        ServerError: typeof ServerError,
    },
    classes: {
        User: typeof User;
        Project: typeof Project;
        Task: typeof Task;
        Job: typeof Job;
        Event: typeof Event;
        Attribute: typeof Attribute;
        Label: typeof Label;
        Statistics: typeof Statistics;
        ObjectState: typeof ObjectState;
        MLModel: typeof MLModel;
        Comment: typeof Comment;
        Issue: typeof Issue;
        FrameData: typeof FrameData;
        CloudStorage: typeof CloudStorage;
        Organization: typeof Organization;
        Webhook: typeof Webhook;
        AnnotationGuide: typeof AnnotationGuide;
        BaseShapesAction: typeof BaseShapesAction;
        BaseCollectionAction: typeof BaseCollectionAction;
        QualityReport: typeof QualityReport;
        QualityConflict: typeof QualityConflict;
        QualitySettings: typeof QualitySettings;
        Request: typeof Request;
        FramesMetaData: typeof FramesMetaData;
        JobValidationLayout: typeof JobValidationLayout;
        TaskValidationLayout: typeof TaskValidationLayout;
    };
    utils: {
        mask2Rle: typeof mask2Rle;
        rle2Mask: typeof rle2Mask;
        propagateShapes: typeof propagateShapes;
        validateAttributeValue: typeof validateAttributeValue;
    };
}