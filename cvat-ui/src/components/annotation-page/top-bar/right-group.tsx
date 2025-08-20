// Copyright (C) 2020-2022 Intel Corporation
// Copyright (C) CVAT.ai Corporation
//
// SPDX-License-Identifier: MIT

import React, { useEffect, useCallback } from 'react';
import { Col } from 'antd/lib/grid';
import Icon, { InfoCircleOutlined } from '@ant-design/icons';
import Select from 'antd/lib/select';
import Button from 'antd/lib/button';
import Modal from 'antd/lib/modal';
import notification from 'antd/lib/notification';
import { Dropdown, Menu } from 'antd';

import { FilterIcon, FullscreenIcon, GuideIcon } from 'icons';
import config from 'config';
import {
    DimensionType, Job, JobStage, JobState,
} from 'cvat-core-wrapper';
import { Workspace } from 'reducers';

import MDEditor from '@uiw/react-md-editor';
import SubmitButton from './submit-button';

interface Props {
    showStatistics(): void;
    showFilters(): void;
    changeWorkspace(workspace: Workspace): void;
    jobInstance: Job;
    workspace: Workspace;
    annotationFilters: object[];
    initialOpenGuide: boolean;
    onSubmitJob(jobInstance: Job): boolean;
}

function RightGroup(props: Props): JSX.Element {
    const {
        showStatistics,
        changeWorkspace,
        showFilters,
        workspace,
        jobInstance,
        annotationFilters,
        initialOpenGuide,
        onSubmitJob,
    } = props;

    const filters = annotationFilters.length;

    const openGuide = useCallback(() => {
        const PADDING = Math.min(window.screen.availHeight, window.screen.availWidth) * 0.4;
        jobInstance.guide().then((guide) => {
            if (guide) {
                Modal.info({
                    icon: null,
                    width: window.screen.availWidth - PADDING,
                    className: 'cvat-annotation-view-markdown-guide-modal',
                    content: (
                        <MDEditor
                            visibleDragbar={false}
                            data-color-mode='light'
                            height={window.screen.availHeight - PADDING}
                            preview='preview'
                            hideToolbar
                            value={guide.markdown}
                        />
                    ),
                });
            }
        }).catch((error: unknown) => {
            notification.error({
                message: 'Could not receive annotation guide',
                description: error instanceof Error ? error.message : console.error('error'),
            });
        });
    }, [jobInstance]);

    useEffect(() => {
        if (Number.isInteger(jobInstance?.guideId)) {
            if (initialOpenGuide) {
                openGuide();
            } else if (
                jobInstance?.stage === JobStage.ANNOTATION &&
                jobInstance?.state === JobState.NEW
            ) {
                let seenGuides = [];
                try {
                    seenGuides = JSON.parse(localStorage.getItem('seenGuides') || '[]');
                    if (!Array.isArray(seenGuides) || seenGuides.some((el) => !Number.isInteger(el))) {
                        throw new Error('Wrong structure stored in local storage');
                    }
                } catch (error: unknown) {
                    seenGuides = [];
                }

                if (!seenGuides.includes(jobInstance.guideId)) {
                    // open guide if the user have not seen it yet
                    openGuide();
                    const updatedSeenGuides = Array
                        .from(new Set([
                            jobInstance.guideId,
                            ...seenGuides.slice(0, config.LOCAL_STORAGE_SEEN_GUIDES_MEMORY_LIMIT - 1),
                        ]));
                    localStorage.setItem('seenGuides', JSON.stringify(updatedSeenGuides));
                }
            }
        }
    }, []);

    return (
        <Col className='cvat-annotation-header-right-group'>
            <Dropdown
                overlay={
                    <Menu>
                        <Menu.Item key="fullscreen" onClick={() => {
                            if (window.document.fullscreenEnabled) {
                                if (window.document.fullscreenElement) {
                                    window.document.exitFullscreen();
                                } else {
                                    window.document.documentElement.requestFullscreen();
                                }
                            }
                        }}>
                            <Icon component={FullscreenIcon} /> Fullscreen
                        </Menu.Item>
                        {jobInstance.guideId !== null && (
                            <Menu.Item key="guide" onClick={openGuide}>
                                <Icon component={GuideIcon} /> Guide
                            </Menu.Item>
                        )}
                        <Menu.Item key="info" onClick={showStatistics}>
                            <InfoCircleOutlined /> Info
                        </Menu.Item>
                        <Menu.Item key="filters" onClick={showFilters}>
                            <Icon component={FilterIcon} /> Filters
                        </Menu.Item>
                    </Menu>
                }
                trigger={['click']}
                placement="bottomRight"
            >
                <Button
                    type='link'
                    className='cvat-annotation-header-dropdown-button cvat-annotation-header-button'
                >
                    <Icon component={FilterIcon} />
                    Actions
                </Button>
            </Dropdown>
            <div>
                <Select
                    popupClassName='cvat-workspace-selector-dropdown'
                    className='cvat-workspace-selector'
                    onChange={changeWorkspace}
                    value={workspace}
                >
                    {Object.values(Workspace).map((ws) => {
                        if (jobInstance.dimension === DimensionType.DIMENSION_3D) {
                            if (ws === Workspace.STANDARD) {
                                return null;
                            }
                            return (
                                <Select.Option disabled={ws !== Workspace.STANDARD3D} key={ws} value={ws}>
                                    {ws}
                                </Select.Option>
                            );
                        }
                        if (ws !== Workspace.STANDARD3D) {
                            return (
                                <Select.Option key={ws} value={ws}>
                                    {ws}
                                </Select.Option>
                            );
                        }
                        return null;
                    })}
                </Select>
                <SubmitButton
                    jobInstance={jobInstance}
                    onSubmitJob={onSubmitJob}
                />
            </div>
        </Col>
    );
}

export default React.memo(RightGroup);
