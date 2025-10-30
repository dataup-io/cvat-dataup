// Copyright (C) 2020-2022 Intel Corporation
// Copyright (C) CVAT.ai Corporation
//
// SPDX-License-Identifier: MIT

import './styles.scss';
import React, { useCallback, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useHistory } from 'react-router';
import Modal from 'antd/lib/modal';
import Button from 'antd/lib/button';
import notification from 'antd/lib/notification';
import { Link } from 'react-router-dom';
import NothingToSee from 'components/common/NothingToSee';

import { CombinedState } from 'reducers';
import { getAgentsAsync, deleteAgentAsync, agentActions } from 'actions/agent-actions';
// Using any type to avoid interface conflicts between cvat-core MLModel and local MLModel interface
import TopBar from './top-bar';
import ApisTableComponent from './apis-table';
import CreateApiModal from './create-api-modal';


function ApisTablePage(): JSX.Element {
    const dispatch = useDispatch();
    const [createModalVisible, setCreateModalVisible] = useState(false);
    const [editingApi, setEditingApi] = useState<any>(null);

    const {
        current: agents,
        count,
        next_cursor,
        previous_cursor,
        gettingQuery,
        fetching,
        missingApiKey,
    } = useSelector((state: CombinedState) => state.agents);

    console.log('ApisTablePage - Redux state:', {
        agents,
        agentsLength: agents?.length,
        count,
        next_cursor,
        previous_cursor,
        fetching,
        gettingQuery,
    });

    const searchValue = gettingQuery.search || '';
    const pageSize = 10; // Fixed page size for cursor pagination

    const handleSearch = useCallback((search: string) => {
        const query = {
            ...gettingQuery,
            search: search || undefined,
            cursor: undefined,
            sort: gettingQuery.sort || undefined,
            filter: gettingQuery.filter || undefined,
        };
        dispatch(agentActions.updateAgentsGettingQuery(query));
    }, [dispatch, gettingQuery]);

    const handlePageChange = useCallback((direction: 'next' | 'previous') => {
        const cursor = direction === 'next' ? next_cursor : previous_cursor;
        if (cursor) {
            const query = {
                ...gettingQuery,
                cursor,
                search: gettingQuery.search || undefined,
                sort: gettingQuery.sort || undefined,
                filter: gettingQuery.filter || undefined,
            };
            dispatch(agentActions.updateAgentsGettingQuery(query));
        }
    }, [dispatch, gettingQuery, next_cursor, previous_cursor]);

    const handleCreateApi = useCallback(() => {
        setCreateModalVisible(true);
    }, []);

    const handleEditApi = useCallback((api: any) => {
        setEditingApi(api);
        setCreateModalVisible(true);
    }, []);

    const handleCloseModal = useCallback(() => {
        setCreateModalVisible(false);
        setEditingApi(null);
    }, []);

    const handleDeleteApi = useCallback((apiId: number | string) => {
        Modal.confirm({
            title: 'Delete API',
            content: 'Are you sure you want to delete this API? This action cannot be undone.',
            className: 'cvat-modal-confirm-delete-api',
            onOk: async () => {
                try {
                    await dispatch(deleteAgentAsync(apiId));
                    // Refresh the agents list after successful deletion
                    const query = {
                        ...gettingQuery,
                        search: gettingQuery.search || undefined,
                        sort: gettingQuery.sort || undefined,
                        filter: gettingQuery.filter || undefined,
                    };
                    dispatch(getAgentsAsync(query));
                } catch (error: any) {
                    console.error('Failed to delete agent:', error);
                    
                    // Show user-friendly error notification
                    if (error?.response?.status === 403) {
                        notification.error({
                            message: 'Permission Denied',
                            description: 'You do not have permission to delete this agent. Please contact your administrator.',
                            duration: 5,
                        });
                    } else if (error?.response?.status === 404) {
                        notification.error({
                            message: 'Agent Not Found',
                            description: 'The agent you are trying to delete no longer exists.',
                            duration: 5,
                        });
                    } else if (error?.response?.status >= 500) {
                        notification.error({
                            message: 'Server Error',
                            description: 'A server error occurred while deleting the agent. Please try again later.',
                            duration: 5,
                        });
                    } else {
                        notification.error({
                            message: 'Failed to Delete Agent',
                            description: error?.message || 'An unexpected error occurred while deleting the agent.',
                            duration: 5,
                        });
                    }
                }
            },
            okButtonProps: {
                type: 'primary',
                danger: true,
            },
            okText: 'Delete',
        });
    }, [dispatch, gettingQuery]);



    // Search is now managed through Redux state, no need for URL params

    useEffect(() => {
        dispatch(getAgentsAsync());
    }, [dispatch, gettingQuery]);

    // Debug: Log the agents data
    useEffect(() => {
        console.log('Current agents in state:', agents);
        agents.forEach((agent, index) => {
            console.log(`Agent ${index}:`, agent, 'ID:', agent.id, 'Type:', typeof agent.id);
        });
    }, [agents]);

    if (missingApiKey) {
        return (
            <div className='cvat-apis-page'>
                <NothingToSee message={'No API key found. Create an API key to manage APIs.'} />
                <div style={{ marginTop: 16 }}>
                    <Link to='/api-keys'>
                        <Button type='primary'>Go to API Keys</Button>
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className='cvat-apis-page'>
            <TopBar
                searchValue={searchValue}
                onSearchChange={handleSearch}
                onCreateApi={handleCreateApi}
                fetching={fetching}
            />
            <ApisTableComponent
                apis={agents as any}
                total={count}
                nextCursor={next_cursor || null}
                previousCursor={previous_cursor || null}
                onPageChange={handlePageChange}
                onEditApi={handleEditApi}
                onDeleteApi={handleDeleteApi}
                fetching={fetching}
            />
            <CreateApiModal
                visible={createModalVisible}
                api={editingApi}
                onClose={handleCloseModal}
            />
        </div>
    );
}

export default React.memo(ApisTablePage);