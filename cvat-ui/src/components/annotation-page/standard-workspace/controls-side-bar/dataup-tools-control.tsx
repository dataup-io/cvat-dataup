// Copyright (C) 2020-2022 Intel Corporation
// Copyright (C) CVAT.ai Corporation
//
// SPDX-License-Identifier: MIT

import React from 'react';
import { connect } from 'react-redux';
import Icon from '@ant-design/icons';
import Popover from 'antd/lib/popover';
import Select from 'antd/lib/select';
import Button from 'antd/lib/button';
import InputNumber from 'antd/lib/input-number';
import Input from 'antd/lib/input';
import { Row, Col } from 'antd/lib/grid';
import Text from 'antd/lib/typography/Text';
import message from 'antd/lib/message';
import notification from 'antd/lib/notification';

import { SAM3Icon } from 'icons';
import { Canvas, convertShapesForInteractor } from 'cvat-canvas-wrapper';
import {
    CombinedState, ActiveControl,
} from 'reducers';
import { Label, Job, MLModel, AgentProvider, ObjectState, ObjectType, ShapeType } from 'cvat-core-wrapper';
import { getCore } from 'cvat-core-wrapper';
import LabelSelector from 'components/label-selector/label-selector';
import withVisibilityHandling from './handle-popover-visibility';
import {
    createAnnotationsAsync,
} from 'actions/annotation-actions';

interface StateToProps {
    canvasInstance: Canvas;
    labels: Label[];
    jobInstance: Job;
    isActivated: boolean;
    frameIsDeleted: boolean;
    interactors: MLModel[];
    frame: number;
    curZOrder: number;
}

interface DispatchToProps {
    createAnnotations: (states: ObjectState[]) => Promise<void>;
}

interface State {
    activeInteractor: MLModel | null;
    activeLabelID: number | null;
    threshold: number;
    textPrompt: string;
    fetching: boolean;
    positiveBoxes: number[][]; // Array of [x1, y1, x2, y2] boxes
    negativeBoxes: number[][]; // Array of [x1, y1, x2, y2] boxes
    drawingPositiveBox: boolean; // Whether currently drawing positive boxes
    drawingNegativeBox: boolean; // Whether currently drawing negative boxes
}

interface InteractorResponse {
    shapes: Array<{
        type: ShapeType;
        points: number[];
    }>;
    session_id?: string;
}

const core = getCore();
const CustomPopover = withVisibilityHandling(Popover, 'tools-control');

function mapStateToProps(state: CombinedState): StateToProps {
    const {
        annotation: {
            job: { instance: jobInstance, labels },
            canvas: { instance: canvasInstance, activeControl },
            player: {
                frame: { number: frame, data: { deleted: frameIsDeleted } },
            },
            annotations: {
                zLayer: { cur: curZOrder },
            },
        },
        models: {
            interactors,
        },
    } = state;

    // Filter only DataUp interactors
    const dataupInteractors = interactors.filter(
        (interactor: MLModel) => interactor.provider?.toLowerCase() === AgentProvider.DATAUP.toLowerCase()
    );

    return {
        isActivated: activeControl === ActiveControl.DATAUP_TOOLS,
        labels,
        canvasInstance: canvasInstance as Canvas,
        jobInstance: jobInstance as Job,
        frameIsDeleted,
        interactors: dataupInteractors,
        frame,
        curZOrder,
    };
}

const mapDispatchToProps = {
    createAnnotations: createAnnotationsAsync,
};

type Props = StateToProps & DispatchToProps;

export class DataUpToolsControlComponent extends React.PureComponent<Props, State> {
    // Map to store session_id per frame: key is `${jobId}_${frame}`
    private sessionIds: Map<string, string> = new Map();

    public constructor(props: Props) {
        super(props);
        const { interactors, labels } = props;

        this.state = {
            activeInteractor: interactors.length ? interactors[0] : null,
            activeLabelID: labels.length ? labels[0].id as number : null,
            threshold: 0.5,
            textPrompt: '',
            fetching: false,
            positiveBoxes: [],
            negativeBoxes: [],
            drawingPositiveBox: false,
            drawingNegativeBox: false,
        };
    }

    public componentDidMount(): void {
        const { canvasInstance, isActivated } = this.props;
        if (isActivated) {
            canvasInstance.html().addEventListener('canvas.drawn', this.onCanvasShapeDrawn);
        }
    }

    public componentDidUpdate(prevProps: Props, prevState: State): void {
        const { interactors, labels, isActivated, canvasInstance } = this.props;
        const { activeInteractor, activeLabelID } = this.state;

        // Update active interactor if the list changed
        if (interactors.length && (!activeInteractor || !interactors.find((i) => i.id === activeInteractor.id))) {
            this.setState({ activeInteractor: interactors[0] });
        }

        // Update active label if the list changed
        if (labels.length && (!activeLabelID || !labels.find((l) => l.id === activeLabelID))) {
            this.setState({ activeLabelID: labels[0].id as number });
        }

        // Add/remove canvas listeners when activation changes
        if (!prevProps.isActivated && isActivated) {
            canvasInstance.html().addEventListener('canvas.drawn', this.onCanvasShapeDrawn);
        } else if (prevProps.isActivated && !isActivated) {
            canvasInstance.html().removeEventListener('canvas.drawn', this.onCanvasShapeDrawn);
            // Reset drawing state when deactivated
            this.setState({
                drawingPositiveBox: false,
                drawingNegativeBox: false,
            });
        }
    }

    public componentWillUnmount(): void {
        const { canvasInstance } = this.props;
        canvasInstance.html().removeEventListener('canvas.drawn', this.onCanvasShapeDrawn);
    }

    private onCanvasShapeDrawn = (e: Event): void => {
        const { isActivated } = this.props;
        const { drawingPositiveBox, drawingNegativeBox } = this.state;

        if (!isActivated || (!drawingPositiveBox && !drawingNegativeBox)) {
            return;
        }

        const { shapes } = (e as CustomEvent).detail;
        if (shapes && shapes.length > 0) {
            // Get the last drawn shape (should be a rectangle)
            const lastShape = shapes[shapes.length - 1];
            if (lastShape.shapeType === ShapeType.RECTANGLE && lastShape.points.length === 4) {
                const box = lastShape.points; // [x1, y1, x2, y2]

                if (drawingPositiveBox) {
                    this.setState((prevState) => ({
                        positiveBoxes: [...prevState.positiveBoxes, box],
                        drawingPositiveBox: false,
                    }), () => {
                        // Send request after adding positive box
                        this.sendInteractionRequest();
                    });
                } else if (drawingNegativeBox) {
                    this.setState((prevState) => ({
                        negativeBoxes: [...prevState.negativeBoxes, box],
                        drawingNegativeBox: false,
                    }), () => {
                        // Send request after adding negative box
                        this.sendInteractionRequest();
                    });
                }
            }
        }
    };

    private setActiveInteractor = (value: string | number): void => {
        const { interactors } = this.props;
        const interactor = interactors.find((i) => i.id === value) || null;
        this.setState({ activeInteractor: interactor });
    };

    private getSessionKey(): string {
        const { jobInstance, frame } = this.props;
        return `${jobInstance.id}_${frame}`;
    }

    private getSessionId(): string | undefined {
        const key = this.getSessionKey();
        return this.sessionIds.get(key);
    }

    private setSessionId(sessionId: string | undefined): void {
        const key = this.getSessionKey();
        if (sessionId) {
            this.sessionIds.set(key, sessionId);
        } else {
            this.sessionIds.delete(key);
        }
    }

    private async sendInteractionRequest(): Promise<void> {
        const { textPrompt, positiveBoxes, negativeBoxes, threshold } = this.state;

        // Build geom_prompt from boxes
        const geomPrompt: any = {};
        if (positiveBoxes.length > 0) {
            geomPrompt.positive_boxes = positiveBoxes;
        }
        if (negativeBoxes.length > 0) {
            geomPrompt.negative_boxes = negativeBoxes;
        }

        // Only send if we have text prompt or geom prompt
        if (!textPrompt && Object.keys(geomPrompt).length === 0) {
            return;
        }

        await this.runInteractionRequest({
            text_prompt: textPrompt || undefined,
            geom_prompt: Object.keys(geomPrompt).length > 0 ? geomPrompt : undefined,
            threshold,
        });
    }

    private async runInteractionRequest(params: {
        text_prompt?: string;
        geom_prompt?: {
            positive_boxes?: number[][];
            negative_boxes?: number[][];
        };
        threshold?: number;
    }): Promise<void> {
        const { jobInstance, labels, curZOrder, frame, createAnnotations } = this.props;
        const { activeInteractor, threshold, activeLabelID, fetching } = this.state;

        if (!activeInteractor || fetching) {
            return;
        }

        try {
            this.setState({ fetching: true });

            const existingSessionId = this.getSessionId();

            // Build request params
            const requestParams: any = {
                type: 'interact',
                frame,
                job: jobInstance.id,
                ...(params.threshold !== undefined ? { threshold: params.threshold } : { threshold }),
            };

            // Add text prompt if provided
            if (params.text_prompt) {
                requestParams.text_prompt = params.text_prompt;
            }

            // Add geom_prompt if provided
            if (params.geom_prompt) {
                requestParams.geom_prompt = params.geom_prompt;
            }

            // Include session_id if we have one
            if (existingSessionId) {
                requestParams.session_id = existingSessionId;
            }

            // Call the agent
            const response = await core.agents.call(activeInteractor.id, {
                task_id: jobInstance.taskId,
                frame_ids: [frame],
                params: requestParams,
            }) as InteractorResponse;

            // Check for new session_id in response and update if different
            if (response.session_id && response.session_id !== existingSessionId) {
                this.setSessionId(response.session_id);
            }

            // Process the response shapes and create annotations
            if (response.shapes && response.shapes.length > 0 && activeLabelID) {
                const label = labels.find((l) => l.id === activeLabelID);
                if (label) {
                    const objectStates = response.shapes.map((shape) => {
                        return new core.classes.ObjectState({
                            frame,
                            objectType: ObjectType.SHAPE,
                            shapeType: shape.type,
                            label,
                            points: shape.points,
                            occluded: false,
                            zOrder: curZOrder,
                            source: core.enums.Source.SEMI_AUTO,
                        });
                    });

                    await createAnnotations(objectStates);
                }
            }
        } catch (error: any) {
            notification.error({
                message: 'Interaction error',
                description: error.message || 'Failed to process interaction request',
                duration: null,
            });
        } finally {
            this.setState({ fetching: false });
        }
    }

    private handleInteractClick = async (): Promise<void> => {
        const { textPrompt } = this.state;

        // If text prompt exists, send request immediately
        if (textPrompt) {
            await this.sendInteractionRequest();
        }
        // Otherwise, wait for user to draw boxes
    };

    private handleAddPositiveBox = (): void => {
        const { canvasInstance } = this.props;
        this.setState({ drawingPositiveBox: true, drawingNegativeBox: false });
        canvasInstance.cancel();
        canvasInstance.draw({
            enabled: true,
            shapeType: ShapeType.RECTANGLE,
        });
    };

    private handleAddNegativeBox = (): void => {
        const { canvasInstance } = this.props;
        this.setState({ drawingPositiveBox: false, drawingNegativeBox: true });
        canvasInstance.cancel();
        canvasInstance.draw({
            enabled: true,
            shapeType: ShapeType.RECTANGLE,
        });
    };

    private handleClearBoxes = (): void => {
        this.setState({
            positiveBoxes: [],
            negativeBoxes: [],
        });
    };

    private renderLabelBlock(): JSX.Element {
        const { labels } = this.props;
        const { activeLabelID } = this.state;
        return (
            <>
                <Row justify='start'>
                    <Col>
                        <Text className='cvat-text-color'>Label</Text>
                    </Col>
                </Row>
                <Row justify='center'>
                    <Col span={24}>
                        <LabelSelector
                            style={{ width: '100%' }}
                            labels={labels}
                            value={activeLabelID}
                            onChange={(value: any) => this.setState({ activeLabelID: value.id })}
                        />
                    </Col>
                </Row>
            </>
        );
    }

    private renderInteractorBlock(): JSX.Element {
        const { interactors } = this.props;
        const {
            activeInteractor, activeLabelID, threshold, textPrompt, fetching,
            positiveBoxes, negativeBoxes, drawingPositiveBox, drawingNegativeBox,
        } = this.state;

        if (!interactors.length) {
            return (
                <Row justify='center' align='middle' style={{ marginTop: '5px' }}>
                    <Col>
                        <Text type='warning' className='cvat-text-color'>
                            No available interactors found
                        </Text>
                    </Col>
                </Row>
            );
        }

        return (
            <>
                {this.renderLabelBlock()}
                <Row justify='start'>
                    <Col>
                        <Text className='cvat-text-color'>Interactor</Text>
                    </Col>
                </Row>
                <Row align='middle' justify='space-between'>
                    <Col span={22}>
                        <Select
                            style={{ width: '100%' }}
                            value={activeInteractor?.id}
                            onChange={this.setActiveInteractor}
                        >
                            {interactors.map(
                                (interactor: MLModel): JSX.Element => (
                                    <Select.Option
                                        value={interactor.id}
                                        title={interactor.description}
                                        key={interactor.id}
                                    >
                                        {interactor.name}
                                    </Select.Option>
                                ),
                            )}
                        </Select>
                    </Col>
                </Row>
                <Row justify='start'>
                    <Col>
                        <Text className='cvat-text-color'>Threshold</Text>
                    </Col>
                </Row>
                <Row align='middle' justify='center'>
                    <Col span={24}>
                        <InputNumber
                            style={{ width: '100%' }}
                            min={0}
                            max={1}
                            step={0.01}
                            value={threshold}
                            onChange={(value: number | null) => {
                                if (typeof value === 'number') {
                                    this.setState({ threshold: Math.max(0, Math.min(1, value)) });
                                }
                            }}
                        />
                    </Col>
                </Row>
                <Row justify='start'>
                    <Col>
                        <Text className='cvat-text-color'>Text Prompt</Text>
                    </Col>
                </Row>
                <Row align='middle' justify='center'>
                    <Col span={24}>
                        <Input
                            style={{ width: '100%' }}
                            value={textPrompt}
                            placeholder='Enter text prompt...'
                            onChange={(e) => this.setState({ textPrompt: e.target.value })}
                        />
                    </Col>
                </Row>
                <div className='cvat-tools-interactor-setups'>
                    <div>
                        <Text className='cvat-text-color'>Geometric Prompts</Text>
                    </div>
                    <div>
                        <Button
                            type={drawingPositiveBox ? 'primary' : 'default'}
                            size='small'
                            onClick={this.handleAddPositiveBox}
                            disabled={drawingNegativeBox}
                        >
                            Add Positive Box ({positiveBoxes.length})
                        </Button>
                        <Button
                            type={drawingNegativeBox ? 'primary' : 'default'}
                            size='small'
                            onClick={this.handleAddNegativeBox}
                            disabled={drawingPositiveBox}
                            style={{ marginLeft: '8px' }}
                        >
                            Add Negative Box ({negativeBoxes.length})
                        </Button>
                        {(positiveBoxes.length > 0 || negativeBoxes.length > 0) && (
                            <Button
                                size='small'
                                onClick={this.handleClearBoxes}
                                style={{ marginLeft: '8px' }}
                            >
                                Clear
                            </Button>
                        )}
                    </div>
                </div>
                <Row align='middle' justify='end'>
                    <Col>
                        <Button
                            type='primary'
                            loading={fetching}
                            className='cvat-tools-interact-button'
                            disabled={!activeInteractor || !activeLabelID || fetching}
                            onClick={this.handleInteractClick}
                        >
                            Interact
                        </Button>
                    </Col>
                </Row>
            </>
        );
    }

    private renderPopoverContent(): JSX.Element {
        return (
            <div className='cvat-tools-control-popover-content'>
                <Row justify='start'>
                    <Col>
                        <Text className='cvat-text-color' strong>
                            DataUp Tools
                        </Text>
                    </Col>
                </Row>
                {this.renderInteractorBlock()}
            </div>
        );
    }

    public render(): JSX.Element {
        const {
            isActivated, canvasInstance, labels, frameIsDeleted, interactors,
        } = this.props;

        const dynamicPopoverProps = isActivated ?
            {
                overlayStyle: {
                    display: 'none',
                },
            } :
            {};

        const dynamicIconProps = isActivated ?
            {
                className: 'cvat-dataup-tools-control cvat-active-canvas-control',
                onClick: (): void => {
                    canvasInstance.interact({ enabled: false });
                    canvasInstance.draw({ enabled: false });
                },
            } :
            {
                className: 'cvat-dataup-tools-control',
            };

        const showContent = labels.length && !frameIsDeleted && interactors.length > 0;

        return showContent ? (
            <CustomPopover
                {...dynamicPopoverProps}
                placement='right'
                overlayClassName='cvat-tools-control-popover'
                content={this.renderPopoverContent()}
            >
                <Icon {...dynamicIconProps} component={SAM3Icon} />
            </CustomPopover>
        ) : (
            <Icon className='cvat-dataup-tools-control cvat-disabled-canvas-control' component={SAM3Icon} />
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(DataUpToolsControlComponent);
