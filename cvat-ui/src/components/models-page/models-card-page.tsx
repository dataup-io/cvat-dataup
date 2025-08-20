// Copyright (C) 2020-2022 Intel Corporation
// Copyright (C) 2022-2023 CVAT.ai Corporation
//
// SPDX-License-Identifier: MIT

import './styles.scss';
import React, { useEffect } from 'react';
import { useHistory } from 'react-router';
import { useDispatch, useSelector } from 'react-redux';
import { getLambdaAsync } from 'actions/models-actions';

import { updateHistoryFromQuery } from 'components/resource-sorting-filtering';
import Spin from 'antd/lib/spin';
import notification from 'antd/lib/notification';

import { CombinedState, ModelsQuery } from 'reducers';
import { useResourceQuery } from 'utils/hooks';
import DeployedModelsListComponent, { PAGE_SIZE } from './deployed-models-list';
import EmptyListComponent from './empty-list';
import TopBar from './top-bar';
import DeployedModelsList from './deployed-models-list';

function ModelsCardPageComponent(): JSX.Element {
    const history = useHistory();
    const dispatch = useDispatch();
    const fetching = useSelector((state: CombinedState) => state.models.fetching);
    const query = useSelector((state: CombinedState) => state.models.query);
    const totalCount = useSelector((state: CombinedState) => state.models.totalCount);
    const initialized = useSelector((state: CombinedState) => state.models.initialized);

    const updatedQuery = useResourceQuery<ModelsQuery>(query, { pageSize: 12 });

    useEffect(() => {
        history.replace({
            search: updateHistoryFromQuery(query),
        });
    }, [query, history]);

    const pageOutOfBounds = totalCount && updatedQuery.page > Math.ceil(totalCount / (updatedQuery.pageSize || 12));
    
    useEffect(() => {
        // Only fetch models if we haven't initialized yet
        if (!initialized) {
            dispatch(getLambdaAsync(updatedQuery));
        }
        
        if (pageOutOfBounds) {
            notification.error({
                message: 'Could not fetch models',
                description: 'Invalid page',
            });
        }
    }, [initialized, updatedQuery, pageOutOfBounds, dispatch]);

    const content = (totalCount && !pageOutOfBounds) ? (
        <DeployedModelsListComponent query={updatedQuery} pageSize={PAGE_SIZE} />
    ) : <EmptyListComponent />;

    return (
        <>
            <TopBar
                disabled
                query={updatedQuery}
                onApplySearch={(search: string | null) => {
                    dispatch(
                        getLambdaAsync({
                            ...query,
                            search,
                            page: 1,
                        }),
                    );
                }}
                onApplyFilter={(filter: string | null) => {
                    dispatch(
                        getLambdaAsync({
                            ...query,
                            filter,
                            page: 1,
                        }),
                    );
                }}
                onApplySorting={(sorting: string | null) => {
                    dispatch(
                        getLambdaAsync({
                            ...query,
                            sort: sorting,
                            page: 1,
                        }),
                    );
                }}
            />
            {fetching ? (
                <div className='cvat-empty-models-list'>
                    <Spin size='large' className='cvat-spinner' />
                </div>
            ) : content}
        </>
    );
}

export default React.memo(ModelsCardPageComponent);
