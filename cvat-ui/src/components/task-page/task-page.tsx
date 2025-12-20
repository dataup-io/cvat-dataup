// Copyright (C) 2020-2022 Intel Corporation
// Copyright (C) CVAT.ai Corporation
//
// SPDX-License-Identifier: MIT

import './styles.scss';
import React, { useEffect, useState } from 'react';
import { useHistory, useParams } from 'react-router';
import { useDispatch, useSelector, shallowEqual } from 'react-redux';
import { Row, Col } from 'antd/lib/grid';
import Spin from 'antd/lib/spin';
import notification from 'antd/lib/notification';

import { getInferenceStatusAsync } from 'actions/models-actions';
import { updateJobAsync, jobsActions } from 'actions/jobs-actions';
import {
    getCore, Task, Job, FramesMetaData,
} from 'cvat-core-wrapper';
import { TaskNotFoundComponent } from 'components/common/not-found';
import JobListComponent from 'components/task-page/job-list';
import ModelRunnerModal from 'components/model-runner-modal/model-runner-dialog';
import CVATLoadingSpinner from 'components/common/loading-spinner';
import MoveTaskModal from 'components/move-task-modal/move-task-modal';
import { CombinedState, CloudStorage } from 'reducers';
import JobAnalytics from 'components/task-page/job-analytics';
import { updateTaskAsync, updateTaskMetadataAsync } from 'actions/tasks-actions';
import TopBarComponent from './top-bar';
import DetailsComponent from './details';
import LensChat from '../lens-chat/lens-chat';
import { getCloudStorageById } from './cloud-storage-editor';

const core = getCore();

function TaskPageComponent({ tab }: { tab: 'overview' | 'jobs' | 'analytics' | 'lens' }): JSX.Element {
    const history = useHistory();
    const id = +useParams<{ tid: string }>().tid;
    const dispatch = useDispatch();
    const [taskInstance, setTaskInstance] = useState<Task | null>(null);
    const [taskMeta, setTaskMeta] = useState<FramesMetaData | null>(null);
    const [cloudStorageInstance, setCloudStorageInstance] = useState<CloudStorage | null>(null);
    const [fetchingTask, setFetchingTask] = useState(true);
    const isLens = tab === 'lens';

    const {
        deletes,
        updates,
        jobsFetching,
        bulkFetching,
    } = useSelector((state: CombinedState) => ({
        deletes: state.tasks.activities.deletes,
        updates: state.tasks.activities.updates,
        jobsFetching: state.jobs.fetching,
        bulkFetching: state.bulkActions.fetching,
    }), shallowEqual);
    const isTaskUpdating = (updates[id] || jobsFetching) && !bulkFetching;

    const receiveTask = async (): Promise<void> => {
        try {
            const [task]: Task[] = await core.tasks.get({ id });

            if (task) {
                setTaskInstance(task);
                dispatch(jobsActions.getJobsSuccess(
                    Object.assign([...task.jobs], { count: task.jobs.length })),
                );

                const meta = await task.meta.get();
                setTaskMeta(meta);

                if (meta.cloudStorageId) {
                    const cloudStorage = await getCloudStorageById(meta.cloudStorageId);
                    setCloudStorageInstance(cloudStorage);
                }
            }
        } catch (error: any) {
            notification.error({
                message: 'Could not receive the requested task from the server',
                description: error.toString(),
            });
        }
    };

    useEffect(() => {
        receiveTask().finally(() => {
            setFetchingTask(false);
        });
        dispatch(getInferenceStatusAsync());
    }, []);

    useEffect(() => {
        if (taskInstance && id in deletes && deletes[id]) {
            history.push('/tasks');
        }
    }, [deletes]);

    // Keep hook order stable across renders by declaring this effect
    // before any conditional early returns.

    if (fetchingTask) {
        return <Spin size='large' className='cvat-spinner' />;
    }

    if (!taskInstance) {
        return <TaskNotFoundComponent />;
    }

    const onUpdateTask = (task: Task): Promise<Task> => {
        const promise = dispatch(updateTaskAsync(task, {}));
        promise.then((updatedTask: Task) => {
            setTaskInstance(updatedTask);
        });
        return promise;
    };

    const onUpdateTaskMeta = (meta: FramesMetaData): Promise<void> => (
        dispatch(updateTaskMetadataAsync(taskInstance, meta)).then((updatedMeta: FramesMetaData) => {
            setTaskMeta(updatedMeta);
            if (updatedMeta && updatedMeta.cloudStorageId) {
                return getCloudStorageById(updatedMeta.cloudStorageId);
            }
            return null;
        }).then((_cloudStorage) => {
            setCloudStorageInstance(_cloudStorage);
        })
    );

    const onJobUpdate = (job: Job, data: Parameters<Job['save']>[0]): void => {
        dispatch(updateJobAsync(job, data));
    };

    // Lens chat moved into dedicated component


    return (
        <>
            {isTaskUpdating ? <CVATLoadingSpinner size='large' /> : null}
            <Row
                justify='center'
                align='top'
                className='cvat-task-details-wrapper'
            >
                <Col span={23}>
                    {!isLens && <TopBarComponent taskInstance={taskInstance} />}
                    {!isLens && (
                        <DetailsComponent
                            task={taskInstance}
                            onUpdateTask={onUpdateTask}
                            taskMeta={taskMeta}
                            cloudStorageInstance={cloudStorageInstance}
                            onUpdateTaskMeta={onUpdateTaskMeta}
                        />
                    )}
                    <div style={{ marginTop: isLens ? 0 : 24 }}>
                        {tab === 'overview' ? (
                            <JobAnalytics jobs={taskInstance.jobs} taskId={taskInstance.id} />
                        ) : tab === 'jobs' ? (
                            <JobListComponent task={taskInstance} onJobUpdate={onJobUpdate} />
                        ) : tab === 'lens' && (
                            <LensChat task={taskInstance} />
                        )}
                    </div>
                </Col>
            </Row>
            <ModelRunnerModal />
            <MoveTaskModal onUpdateTask={onUpdateTask} />
        </>
    );
}

export default React.memo(TaskPageComponent);
