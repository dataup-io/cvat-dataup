// Copyright (C) 2023-2024 CVAT.ai Corporation
//
// SPDX-License-Identifier: MIT

import { Tensor } from 'onnxruntime-web';
import { LRUCache } from 'lru-cache';
import { CVATCore, MLModel, Job } from 'cvat-core-wrapper';
import { PluginEntryPoint, APIWrapperEnterOptions, ComponentBuilder } from 'components/plugins-entrypoint';

import { agentsEnter, agentsLeave } from './agents';
import { lambdaEnter, lambdaLeave } from './lambda';

interface SAMPlugin {
    name: string;
    description: string;
    cvat: {
        agents: {
            call: {
                enter: (
                    plugin: SAMPlugin,
                    agentID: string | number,
                    body: any,
                ) => Promise<null | APIWrapperEnterOptions>;
                leave: (
                    plugin: SAMPlugin,
                    result: any,
                    agentID: string | number,
                    body: any,
                ) => Promise<any>;
            };
        };
        lambda: {
            call: {
                enter: (
                    plugin: SAMPlugin,
                    taskID: number,
                    model: MLModel,
                    args: any,
                ) => Promise<null | APIWrapperEnterOptions>;
                leave: (
                    plugin: SAMPlugin,
                    result: any,
                    taskID: number,
                    model: MLModel,
                    args: any,
                ) => Promise<any>;
            };
        };
        jobs: {
            get: {
                leave: (
                    plugin: SAMPlugin,
                    results: any[],
                    query: { jobID?: number }
                ) => Promise<any>;
            };
        };
    };
    data: {
        initialized: boolean;
        worker: Worker;
        core: CVATCore | null;
        jobs: Record<number, Job>;
        modelID: string;
        modelURL: string;
        embeddings: LRUCache<string, Tensor>;
        lowResMasks: LRUCache<string, Tensor>;
        lastClicks: ClickType[];
    };
    callbacks: {
        onStatusChange: ((status: string) => void) | null;
    };
}

interface ClickType {
    clickType: 0 | 1 | 2 | 3;
    x: number;
    y: number;
}



const samPlugin: SAMPlugin = {
    name: 'Segment Anything',
    description: 'Handles non-default SAM serverless function output',
    cvat: {
        jobs: {
            get: {
                async leave(
                    plugin: SAMPlugin,
                    results: any[],
                    query: { jobID?: number },
                ): Promise<any> {
                    if (typeof query.jobID === 'number') {
                        [plugin.data.jobs[query.jobID]] = results;
                    }
                    return results;
                },
            },
        },
        agents: {
            call: {
                async enter(
                    plugin: SAMPlugin,
                    agentID: string | number,
                    body: any,
                ): Promise<null | APIWrapperEnterOptions> {
                    return agentsEnter(plugin as any, agentID, body);
                },

                async leave(
                    plugin: SAMPlugin,
                    result: any,
                    agentID: string | number,
                    body: any,
                ): Promise<any> {
                    return agentsLeave(plugin as any, result, agentID, body);
                },
            },
        },
        lambda: {
            call: {
                async enter(
                    plugin: SAMPlugin,
                    taskID: number,
                    model: MLModel,
                    args: any,
                ): Promise<null | APIWrapperEnterOptions> {
                    return lambdaEnter(plugin as any, taskID, model, args);
                },
                async leave(
                    plugin: SAMPlugin,
                    result: any,
                    taskID: number,
                    model: MLModel,
                    args: any,
                ): Promise<any> {
                    return lambdaLeave(plugin as any, result, taskID, model, args);
                },
            },
        },
    },
    data: {
        initialized: false,
        core: null,
        worker: new Worker(new URL('./inference.worker', import.meta.url)),
        jobs: {},
        // TODO: change to the actual model ID
        modelID: 'Segment Anything',
        modelURL: '/assets/decoder.onnx',
        embeddings: new LRUCache({
            // float32 tensor [256, 64, 64] is 4 MB, max 128 MB
            max: 32,
            updateAgeOnGet: true,
            updateAgeOnHas: true,
        }),
        lowResMasks: new LRUCache({
            // float32 tensor [1, 256, 256] is 0.25 MB, max 8 MB
            max: 32,
            updateAgeOnGet: true,
            updateAgeOnHas: true,
        }),
        lastClicks: [],
    },
    callbacks: {
        onStatusChange: null,
    },
};

const builder: ComponentBuilder = ({ core }) => {
    samPlugin.data.core = core;
    core.plugins.register(samPlugin);

    return {
        name: samPlugin.name,
        destructor: () => {},
    };
};

function register(): void {
    if (Object.prototype.hasOwnProperty.call(window, 'cvatUI')) {
        (window as any as { cvatUI: { registerComponent: PluginEntryPoint } })
            .cvatUI.registerComponent(builder);
    }
}

window.addEventListener('plugins.ready', register, { once: true });