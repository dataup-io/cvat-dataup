// Copyright (C) 2020-2022 Intel Corporation
// Copyright (C) CVAT.ai Corporation
//
// SPDX-License-Identifier: MIT

import React from 'react';
import { Row, Col } from 'antd/lib/grid';
import { CloseOutlined, LoadingOutlined } from '@ant-design/icons';
import Text from 'antd/lib/typography/Text';
import Progress from 'antd/lib/progress';
import Modal from 'antd/lib/modal';

import CVATTooltip from 'components/common/cvat-tooltip';
import { RQStatus } from 'cvat-core-wrapper';
import { ActiveInference } from 'reducers';

interface Props {
    activeInference: ActiveInference | null;
    cancelAutoAnnotation(): void;
}

export default function AutomaticAnnotationProgress(props: Props): JSX.Element | null {
    const { activeInference, cancelAutoAnnotation } = props;
    if (!activeInference) return null;

    let textType: 'success' | 'danger' = 'success';
    if ([RQStatus.FAILED, RQStatus.UNKNOWN].includes(activeInference.status)) {
        textType = 'danger';
    }

    return (
        <Row justify='space-between' align='middle'>
            <Col>
                <Text
                    type={activeInference.status === RQStatus.QUEUED ? undefined : textType}
                >
                    {((): string => {
                        if (activeInference.status === RQStatus.QUEUED) {
                            return 'Automatic annotation request queued';
                        }

                        if (activeInference.status === RQStatus.STARTED) {
                            return 'Automatic annotation is in progress';
                        }

                        if (activeInference.status === RQStatus.FAILED) {
                            return 'Automatic annotation failed';
                        }

                        if (activeInference.status === RQStatus.UNKNOWN) {
                            return 'Unknown status received';
                        }

                        return 'Automatic annotation accomplished';
                    })()}
                </Text>
                {activeInference.status === RQStatus.STARTED && (
                    <Progress
                        percent={Math.floor(activeInference.progress)}
                        size='small'
                        style={{ width: 200, marginLeft: 12 }}
                    />
                )}
            </Col>
            <Col>
                { activeInference.status !== RQStatus.FAILED && (
                    <CVATTooltip title='Cancel automatic annotation'>
                        <CloseOutlined
                            onClick={() => {
                                Modal.confirm({
                                    title: 'You are going to cancel automatic annotation?',
                                    content: 'Reached progress will be lost. Continue?',
                                    okButtonProps: {
                                        type: 'primary',
                                        danger: true,
                                    },
                                    onOk() {
                                        cancelAutoAnnotation();
                                    },
                                });
                            }}
                        />
                    </CVATTooltip>
                )}
            </Col>
        </Row>
    );
}
