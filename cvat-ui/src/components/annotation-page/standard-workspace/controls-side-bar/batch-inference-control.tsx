// Copyright (C) 2024 CVAT.ai Corporation
//
// SPDX-License-Identifier: MIT

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { connect } from 'react-redux';
import { Row, Col, Button, Select, InputNumber, notification, Collapse, Tag, Progress } from 'antd';
import Text from 'antd/lib/typography/Text';
import { PlayCircleOutlined } from '@ant-design/icons';

import {
    getCore, Label, MLModel, ObjectState, ObjectType, ShapeType, Job, ModelKind,
} from 'cvat-core-wrapper';
import { CombinedState } from 'reducers';
import { createAnnotationsAsync, collapseBatchInference as collapseBatchInferenceAction, changeFrameAsync } from 'actions/annotation-actions';
import LabelsMapperComponent, { LabelInterface, FullMapping } from 'components/model-runner-modal/labels-mapper';
import { startBatchFrames } from 'utils/model-inference';

const core = getCore();

type ServerMapping = Record<string, {
    name: string;
    attributes: Record<string, string>;
    sublabels?: ServerMapping;
}>;
function convertMappingToServer(mapping: FullMapping): ServerMapping {
    return mapping.reduce<ServerMapping>((acc, [modelLabel, taskLabel, attributesMapping, subMapping]) => ({
        ...acc,
        [modelLabel.name]: {
            name: taskLabel.name,
            attributes: attributesMapping.reduce<Record<string, string>>((attrAcc, [from, to]) => {
                if (from?.name && to?.name) {
                    attrAcc[from.name] = to.name;
                }
                return attrAcc;
            }, {}),
            ...(subMapping.length ? { sublabels: convertMappingToServer(subMapping) } : {}),
        },
    }), {});
}

interface StateToProps {
    jobInstance: Job;
    detectors: MLModel[];
    frame: number;
    batchInferenceCollapsed: boolean;
    labels: Label[];
}

interface DispatchToProps {
    createAnnotations: (states: ObjectState[]) => Promise<void>;
    collapseBatchInference(): void;
    changeFrame: (to: number, fillBuffer?: boolean, frameStep?: number, forceUpdate?: boolean) => Promise<void>;
}

type Props = StateToProps & DispatchToProps;

function BatchInferenceControlComponent(props: Props): JSX.Element | null {
    const { jobInstance, detectors, frame, batchInferenceCollapsed, createAnnotations, collapseBatchInference, labels, changeFrame } = props;

     if (!jobInstance) return null;

     const [selectedModel, setSelectedModel] = useState<MLModel['id'] | undefined>(undefined);
     const [startFrame, setStartFrame] = useState<number>(jobInstance?.startFrame || 0);
     const [endFrame, setEndFrame] = useState<number>(jobInstance?.stopFrame || 0);
     const [isRunning, setIsRunning] = useState<boolean>(false);
     const [currentJobId, setCurrentJobId] = useState<string | null>(null);
     const [jobStatus, setJobStatus] = useState<string>('');
     const [progressPercent, setProgressPercent] = useState<number | null>(null);

     const [mapping, setMapping] = useState<FullMapping>([]);
     const [modelLabels, setModelLabels] = useState<LabelInterface[]>([]);
     const [taskLabels, setTaskLabels] = useState<LabelInterface[]>([]);
     const [threshold, setThreshold] = useState<number>(0.5);

     const pollIntervalRef = useRef<number | null>(null);
     const timeoutRef = useRef<number | null>(null);

     const model = useMemo(() => detectors.find((_m) => _m.id === selectedModel), [detectors, selectedModel]);
     const isDetector = model?.kind === ModelKind.DETECTOR;
     const buttonEnabled = !!selectedModel && (!isDetector || (isDetector && mapping.length > 0));

     // Keep frame inputs synced with job frame range
     useEffect(() => {
         const nextStart = jobInstance?.startFrame || 0;
         const nextEnd = jobInstance?.stopFrame || 0;
         setStartFrame((prev) => (prev === nextStart ? prev : nextStart));
         setEndFrame((prev) => (prev === nextEnd ? prev : nextEnd));
     }, [jobInstance?.startFrame, jobInstance?.stopFrame]);

     // Prepare task and model labels for mapping
     useEffect(() => {
         const converted = (labels || []).map((label: Label) => ({
             name: label.name,
             type: label.type,
             color: label.color,
             attributes: label.attributes.map((attr) => ({
                 name: attr.name,
                 input_type: attr.inputType,
                 values: [...(attr.values || [])],
             })),
             sublabels: (label.structure?.sublabels || []).map((sublabel) => ({
                 name: sublabel.name,
                 type: sublabel.type,
                 color: sublabel.color,
                 attributes: sublabel.attributes.map((attr) => ({
                     name: attr.name,
                     input_type: attr.inputType,
                     values: [...(attr.values || [])],
                 })),
             })),
         }));
         setTaskLabels(converted);

         if (model) {
             setModelLabels(model.labels || []);
             if (!model.labels?.length && model.kind !== ModelKind.REID) {
                 notification.warning({ message: 'This model does not have specified labels' });
             }
         } else {
             setModelLabels([]);
         }
     }, [labels, model?.id]);

     // Cleanup timers on unmount
     useEffect(() => () => {
         if (pollIntervalRef.current !== null) {
             window.clearInterval(pollIntervalRef.current);
             pollIntervalRef.current = null;
         }
         if (timeoutRef.current !== null) {
             window.clearTimeout(timeoutRef.current);
             timeoutRef.current = null;
         }
     }, []);

     const processFrameResults = useCallback((results: any, frameNumber: number, tagStates: any[], shapeStates: any[]) => {
         const findMappedLabel = (modelLabelName: string): Label | null => {
             if (isDetector && mapping.length) {
                 const mappingEntry = mapping.find(([modelLabel]) => modelLabel.name === modelLabelName);
                 if (mappingEntry) {
                     const [, taskLabel] = mappingEntry;
                     return labels.find((l: Label) => l.name === taskLabel.name) || null;
                 }
                 return null;
             }
             return labels.find((l: Label) => l.name === modelLabelName) || null;
         };

         if (results?.tags?.length) {
             for (const tag of results.tags) {
                 const jobLabel = findMappedLabel(tag.label);
                 if (jobLabel) {
                     tagStates.push(new core.classes.ObjectState({
                         attributes: [],
                         frame: frameNumber,
                         label: jobLabel,
                         objectType: ObjectType.TAG,
                         source: core.enums.Source.AUTO,
                     }));
                 }
             }
         }

         const shapes = results?.shapes || results?.objects || [];
         for (const shape of shapes) {
             const jobLabel = findMappedLabel(shape.label);
             if (!jobLabel) continue;

             const type: string = (shape.type || shape.shape || '').toLowerCase();
             let shapeType: ShapeType = ShapeType.RECTANGLE;
             let points: number[] = [];

             if (type === 'rectangle' || type === 'box' || type === 'rect') {
                 const x = shape.x ?? (Array.isArray(shape.bbox) ? shape.bbox[0] : 0);
                 const y = shape.y ?? (Array.isArray(shape.bbox) ? shape.bbox[1] : 0);
                 const w = shape.width ?? (Array.isArray(shape.bbox) ? shape.bbox[2] : 0);
                 const h = shape.height ?? (Array.isArray(shape.bbox) ? shape.bbox[3] : 0);
                 shapeType = ShapeType.RECTANGLE;
                 points = [x, y, x + w, y, x + w, y + h, x, y + h];
             } else if (type === 'polygon') {
                 shapeType = ShapeType.POLYGON;
                 points = (shape.points || []).flat();
             } else if (type === 'polyline' || type === 'line') {
                 shapeType = ShapeType.POLYLINE;
                 points = (shape.points || []).flat();
             } else if (type === 'points' || type === 'point') {
                 shapeType = ShapeType.POINTS;
                 points = (shape.points || []).flat();
             } else {
                 // Fallback: try to parse generic points
                 if (Array.isArray(shape.points)) points = shape.points.flat();
                 shapeType = ShapeType.POLYGON;
             }

             shapeStates.push(new core.classes.ObjectState({
                 attributes: [],
                 frame: frameNumber,
                 label: jobLabel,
                 objectType: ObjectType.SHAPE,
                 shapeType,
                 points,
                 source: core.enums.Source.AUTO,
             }));
         }
     }, [isDetector, mapping, labels]);

     const runBatchInference = useCallback(async () => {
         if (!selectedModel || !jobInstance || !model) return;

         setIsRunning(true);
         setJobStatus('Creating job...');
         setProgressPercent(0);

         try {
             const tagStates: any[] = [];
             const shapeStates: any[] = [];

             const frameIds: number[] = [];
             for (let frameNumber = startFrame; frameNumber <= endFrame; frameNumber++) {
                 frameIds.push(frameNumber);
             }

             const params: any = {};
             if (model.kind === ModelKind.DETECTOR) {
                params.mapping = convertMappingToServer(mapping);
                params.cleanup = true;
                params.conv_mask_to_poly = false;
                if (typeof threshold === 'number') params.threshold = threshold;
            } else if (model.kind === ModelKind.REID) {
                if (typeof threshold === 'number') params.threshold = threshold;
                params.max_distance = 50;
            }

             setJobStatus(model.provider === 'dataup' ? 'Creating agent job...' : 'Processing frames...');

             const result = await startBatchFrames({
                 taskId: jobInstance.taskId,
                 jobId: jobInstance.id,
                 model,
                 frameIds,
                 params,
                 onFrame: async ({ frame: frameNumber, response, index, total }) => {
                     processFrameResults(response, frameNumber, tagStates, shapeStates);
                     if (typeof total === 'number' && total > 0) {
                         const pct = Math.min(100, Math.floor(((index + 1) / total) * 100));
                         setProgressPercent(pct);
                     }
                 },
             });

             if (result.type === 'local') {
                 const allStates = [...tagStates, ...shapeStates];
                 if (allStates.length > 0) {
                     await createAnnotations(allStates);
                     await changeFrame(frame, undefined, undefined, true);
                     notification.success({
                         message: 'Batch inference completed',
                         description: `Created ${allStates.length} annotations`,
                     });
                 } else {
                     notification.info({
                         message: 'No annotations created',
                         description: 'The model did not detect any objects in the specified frame range',
                     });
                 }
                 if (timeoutRef.current !== null) {
                     window.clearTimeout(timeoutRef.current);
                     timeoutRef.current = null;
                 }
                 setProgressPercent(100);
                 setIsRunning(false);
                 setJobStatus('Completed');
                 return;
             }
             if (result.type === 'agent_job') {
                 const agentJob = result.job;
                 setCurrentJobId(agentJob.id);
                 setJobStatus('Job created, processing...');
                 setProgressPercent(0);

                 const pollInterval = window.setInterval(async () => {
                     try {
                         const jobInfo = await core.agents.annotateJobs.get(agentJob.id);
                         setJobStatus(`Status: ${jobInfo.status}`);
                         const progress: number | undefined = (jobInfo as any).progress
                             ?? (jobInfo?.meta && (jobInfo.meta.processed || jobInfo.meta.progress));
                         if (typeof progress === 'number') {
                             // Backend now sends percentage directly (0-100)
                             const pct = Math.max(0, Math.min(99, progress));
                             setProgressPercent(pct);
                         } else {
                             setProgressPercent((prev) => (prev === null ? 0 : prev));
                         }

                         if (jobInfo.status === 'finished') {
                             window.clearInterval(pollInterval);
                             pollIntervalRef.current = null;
                             setJobStatus('Job completed successfully');
                             setProgressPercent(100);
                             await changeFrame(frame, undefined, undefined, true);
                             notification.success({
                                 message: 'Batch inference completed',
                                 description: 'Agent job finished successfully. Annotations have been created.',
                             });
                             if (timeoutRef.current !== null) {
                                 window.clearTimeout(timeoutRef.current);
                                 timeoutRef.current = null;
                             }
                             setIsRunning(false);
                             setCurrentJobId(null);
                         } else if (jobInfo.status === 'failed') {
                             window.clearInterval(pollInterval);
                             pollIntervalRef.current = null;
                             setJobStatus('Job failed');
                             notification.error({
                                 message: 'Batch inference failed',
                                 description: jobInfo.exc_info || 'Agent job failed to complete',
                             });
                             if (timeoutRef.current !== null) {
                                 window.clearTimeout(timeoutRef.current);
                                 timeoutRef.current = null;
                             }
                             setIsRunning(false);
                             setCurrentJobId(null);
                             setProgressPercent(null);
                         }
                     } catch (error) {
                         window.clearInterval(pollInterval);
                         pollIntervalRef.current = null;
                         setJobStatus('Error checking job status');
                         if (timeoutRef.current !== null) {
                             window.clearTimeout(timeoutRef.current);
                             timeoutRef.current = null;
                         }
                         setIsRunning(false);
                         setCurrentJobId(null);
                         setProgressPercent(null);
                     }
                 }, 2000);
                 pollIntervalRef.current = pollInterval;

                 const timeout = window.setTimeout(() => {
                     if (pollIntervalRef.current !== null) {
                         window.clearInterval(pollIntervalRef.current);
                         pollIntervalRef.current = null;
                     }
                     if (isRunning) {
                         setJobStatus('Job timeout');
                         setIsRunning(false);
                         setCurrentJobId(null);
                         setProgressPercent(null);
                     }
                 }, 600000);
                 timeoutRef.current = timeout;
                 return;
             }

             throw new Error(`Unsupported model provider: ${model.provider}`);
         } catch (error: any) {
             notification.error({ message: 'Batch inference error', description: error?.message || String(error) });
             setIsRunning(false);
             setJobStatus('Error');
             setCurrentJobId(null);
             setProgressPercent(null);
         }
     }, [selectedModel, jobInstance, model, startFrame, endFrame, mapping, createAnnotations, isRunning, processFrameResults, changeFrame, frame]);



     const header = (
         <Row justify='space-between' align='middle' style={{ width: '100%' }}>
             <Col>
                 <Text strong style={{ fontSize: '14px' }}>Batch inference</Text>
             </Col>
             <Col>
                 {isRunning && <Tag color='blue' style={{ padding: '0 4px', fontSize: '12px' }}>Running</Tag>}
             </Col>
         </Row>
     );

     return (
         <Collapse activeKey={batchInferenceCollapsed ? [] : ['batch-inference']} onChange={() => collapseBatchInference()}>
             <Collapse.Panel header={header} key='batch-inference'>
                 <Row gutter={[8, 8]} align='middle'>
                     <Col span={24}>
                         <Text type='secondary'>Model</Text>
                         <Select
                             style={{ width: '100%' }}
                             value={selectedModel}
                             onChange={(val) => setSelectedModel(val)}
                             placeholder='Select a model'
                             disabled={isRunning}
                             showSearch
                             optionFilterProp='children'
                         >
                             {detectors.map((m) => (
                                 <Select.Option key={m.id} value={m.id}>
                                     {m.name}
                                 </Select.Option>
                             ))}
                         </Select>
                     </Col>

                     {isDetector && (
                         <Col span={24}>
                             <LabelsMapperComponent
                                 key={model?.id}
                                 modelLabels={modelLabels}
                                 taskLabels={taskLabels}
                                 onUpdateMapping={(m) => setMapping(m)}
                             />
                         </Col>
                     )}

                     <Col span={10}>
                         <Text type='secondary'>Start frame</Text>
                         <InputNumber
                             min={jobInstance.startFrame}
                             max={jobInstance.stopFrame}
                             value={startFrame}
                             onChange={(v) => setStartFrame(v || jobInstance.startFrame)}
                             disabled={isRunning}
                             style={{ width: '100%' }}
                         />
                     </Col>
                     <Col span={2} style={{ textAlign: 'center' }}>
                         <Text>to</Text>
                     </Col>
                     <Col span={12}>
                         <Text type='secondary'>End frame</Text>
                         <InputNumber
                             min={jobInstance.startFrame}
                             max={jobInstance.stopFrame}
                             value={endFrame}
                             onChange={(v) => setEndFrame(v || jobInstance.stopFrame)}
                             disabled={isRunning}
                             style={{ width: '100%' }}
                         />
                     </Col>
+
                    {model && (isDetector || model.kind === ModelKind.REID) && (
                        <Col span={24}>
                            <Text type='secondary'>Threshold</Text>
                            <InputNumber
                                min={0}
                                max={1}
                                step={0.01}
                                value={threshold}
                                onChange={(v) => setThreshold(typeof v === 'number' ? v : 0.5)}
                                disabled={isRunning}
                                style={{ width: '100%' }}
                            />
                        </Col>
                    )}

                     <Col span={24}>
                         <Row justify='space-between' align='middle'>
                             <Col>
                                 <Button
                                     type='primary'
                                     icon={<PlayCircleOutlined />}
                                     onClick={runBatchInference}
                                     disabled={!buttonEnabled || isRunning}
                                 >
                                     Run
                                 </Button>
                             </Col>
                             <Col>
                                 {isRunning ? (
                                     <>
                                         <Text>{jobStatus || 'Running...'}</Text>
                                         <Progress percent={progressPercent ?? 0} size='small' style={{ width: 200, marginLeft: 12 }} />
                                     </>
                                 ) : null}
                             </Col>
                         </Row>
                     </Col>
                 </Row>
             </Collapse.Panel>
         </Collapse>
     );
}

function mapStateToProps(state: CombinedState): StateToProps {
    return {
        jobInstance: state.annotation.job.instance as Job,
        detectors: [
            ...(state.models.detectors || []),
            ...(state.models.reid || []),
        ],
        frame: state.annotation.player.frame.number,
        batchInferenceCollapsed: state.annotation.batchInferenceCollapsed,
        labels: state.annotation.job.labels,
    };
}

const mapDispatchToProps = {
    createAnnotations: createAnnotationsAsync,
    collapseBatchInference: collapseBatchInferenceAction,
    changeFrame: changeFrameAsync,
};

export default connect(mapStateToProps, mapDispatchToProps)(BatchInferenceControlComponent);