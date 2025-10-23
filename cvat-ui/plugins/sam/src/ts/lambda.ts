import { Tensor } from 'onnxruntime-web';
import type { Job, MLModel } from 'cvat-core-wrapper';
import { InitBody, WorkerAction } from './inference.worker';
import { ClickType, getModelScale, modelData, onnxToImage } from './helpers';


export async function lambdaEnter(
    plugin: any,
    taskID: number,
    model: MLModel,
    args: any,
): Promise<null | { preventMethodCall: boolean }> {
    const isSAMLambda = model?.name === plugin.data.modelID;
    if (!isSAMLambda) return null;

    return new Promise((resolve, reject) => {
        function resolvePromise(): void {
            const frame = args?.frame ?? 0;
            const key = `${taskID}_${frame}`;
            if (plugin.data.embeddings.has(key)) {
                resolve({ preventMethodCall: true });
            } else {
                resolve(null);
            }
        }

        if (!plugin.data.initialized) {
            plugin.data.worker.postMessage({
                action: WorkerAction.INIT,
                payload: { decoderURL: plugin.data.modelURL } as InitBody,
            });

            plugin.data.worker.onmessage = (e: MessageEvent) => {
                if (e.data.action !== WorkerAction.INIT) {
                    reject(new Error(`Caught unexpected action response from worker: ${e.data.action}`));
                    return;
                }

                if (!e.data.error) {
                    plugin.data.initialized = true;
                    resolvePromise();
                } else {
                    reject(new Error(`SAM worker was not initialized. ${e.data.error}`));
                }
            };
        } else {
            resolvePromise();
        }
    });
}

export async function lambdaLeave(
    plugin: any,
    result: any,
    taskID: number,
    model: MLModel,
    args: any,
): Promise<any> {
    const isSAMLambda = model?.name === plugin.data.modelID;
    if (!isSAMLambda) return result;

    return new Promise((resolve, reject) => {
        const frame = args?.frame ?? 0;
        const key = `${taskID}_${frame}`;

        const pos_points: number[][] = Array.isArray(args?.pos_points) ? args.pos_points : [];
        const neg_points: number[][] = Array.isArray(args?.neg_points) ? args.neg_points : [];
        const obj_bbox: number[][] = Array.isArray(args?.obj_bbox) ? args.obj_bbox : [];

        const job = Object.values(plugin.data.jobs).find((_job) => (
            (_job as Job).taskId === taskID && frame >= (_job as Job).startFrame && frame <= (_job as Job).stopFrame
        )) as Job;

        if (!job) {
            throw new Error('Could not find a job corresponding to the request');
        }

        plugin.data.jobs = { [job.id]: job } as Record<number, Job>;

        job.frames.get(frame)
            .then(({ height: imHeight, width: imWidth }: { height: number; width: number }) => {
                if (result?.blob) {
                    const bin = window.atob(result.blob);
                    const uint8Array = new Uint8Array(bin.length);
                    for (let i = 0; i < bin.length; i++) uint8Array[i] = bin.charCodeAt(i);
                    const float32Arr = new Float32Array(uint8Array.buffer);
                    plugin.data.embeddings.set(key, new Tensor('float32', float32Arr, [1, 256, 64, 64]));
                }

                if (!plugin.data.embeddings.has(key)) {
                    resolve(result);
                    return;
                }

                const modelScale = { width: imWidth, height: imHeight, scale: getModelScale(imWidth, imHeight) };

                const clicks: ClickType[] = [];
                if (obj_bbox && obj_bbox.length > 0) {
                    clicks.push({ clickType: 2, x: obj_bbox[0][0], y: obj_bbox[0][1] });
                    clicks.push({ clickType: 3, x: obj_bbox[1][0], y: obj_bbox[1][1] });
                }
                if (Array.isArray(pos_points)) {
                    pos_points.forEach((point: number[]) => clicks.push({ clickType: 1, x: point[0], y: point[1] }));
                }
                if (Array.isArray(neg_points)) {
                    neg_points.forEach((point: number[]) => clicks.push({ clickType: 0, x: point[0], y: point[1] }));
                }

                const isLowResMaskSuitable = JSON.stringify(clicks.slice(0, -1)) === JSON.stringify(plugin.data.lastClicks);
                const feeds = modelData({
                    clicks,
                    tensor: plugin.data.embeddings.get(key) as Tensor,
                    modelScale,
                    maskInput: isLowResMaskSuitable ? plugin.data.lowResMasks.get(key) || null : null,
                });

                // removed local toMatImage and onnxToImage helpers; using shared onnxToImage

                plugin.data.worker.postMessage({ action: WorkerAction.DECODE, payload: feeds });

                plugin.data.worker.onmessage = (e: MessageEvent) => {
                    if (e.data.action !== WorkerAction.DECODE) {
                        const error = 'Caught unexpected action response from worker: ' +
                            `${e.data.action}, while "${WorkerAction.DECODE}" was expected`;
                        reject(new Error(error));
                        return;
                    }

                    if (!e.data.error) {
                        const { masks, lowResMasks, xtl, ytl, xbr, ybr } = e.data.payload;
                        const imageData = onnxToImage(masks.data, masks.dims[3], masks.dims[2]);
                        plugin.data.lowResMasks.set(key, lowResMasks);
                        plugin.data.lastClicks = clicks;
                        resolve({ mask: imageData, bounds: [xtl, ytl, xbr, ybr] });
                    } else {
                        reject(new Error(`Decoder error. ${e.data.error}`));
                    }
                };

                plugin.data.worker.onerror = (error: ErrorEvent) => reject(error);
            });
    });
}