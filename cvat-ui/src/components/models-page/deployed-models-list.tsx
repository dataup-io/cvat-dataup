// Copyright (C) 2020-2022 Intel Corporation
// Copyright (C) CVAT.ai Corporation
//
// SPDX-License-Identifier: MIT

import React from 'react';
import { Row, Col } from 'antd/lib/grid';
import Pagination from 'antd/lib/pagination';
import { useDispatch } from 'react-redux';
import { MLModel } from 'cvat-core-wrapper';
import { AgentProvider } from 'cvat-core/src/enums';
import { getModelsAsync } from 'actions/models-actions';
import dimensions from 'utils/dimensions';
import BulkWrapper from 'components/bulk-wrapper';
import { ModelsQuery, SelectedResourceType } from 'reducers';

import DeployedModelItem from './deployed-model-item';

interface Props {
    query: ModelsQuery;
}

function setUpModelsList(models: MLModel[], newPage: number, pageSize: number): MLModel[] {
    // Filter to only include lambda models (CVAT provider) and exclude agent models (DATAUP provider)
    const lambdaModels = models.filter((model: MLModel) => model.provider !== AgentProvider.DATAUP);

    // Separate built-in and external models
    const builtInModels = lambdaModels.filter((model: MLModel) => model.provider === AgentProvider.CVAT);
    const externalModels = lambdaModels.filter((model: MLModel) => model.provider !== AgentProvider.CVAT);
    externalModels.sort((a, b) => moment(a.createdDate).valueOf() - moment(b.createdDate).valueOf());

    const renderModels = [...builtInModels, ...externalModels];
    return renderModels.slice((newPage - 1) * pageSize, newPage * pageSize);
}

export default function DeployedModelsListComponent(props: Props): JSX.Element {
    const interactors = useSelector((state: CombinedState) => state.models.interactors);
    const detectors = useSelector((state: CombinedState) => state.models.detectors);
    const trackers = useSelector((state: CombinedState) => state.models.trackers);
    const reid = useSelector((state: CombinedState) => state.models.reid);
    const totalCount = useSelector((state: CombinedState) => state.models.totalCount);
    const organizationInitialized = useSelector((state: CombinedState) => state.organizations.initialized);

    const dispatch = useDispatch();
    const { query, models, totalCount } = props;
    const { page, pageSize } = query;

    const groupedModels = models.reduce(
        (acc: MLModel[][], storage: MLModel, index: number): MLModel[][] => {
            if (index && index % 4) {
                acc[acc.length - 1].push(storage);
            } else {
                acc.push([storage]);
            }
            return acc;
        },
        [],
    );

    const modelIdToIndex = new Map<string | number, number>();
    models.forEach((m, idx) => modelIdToIndex.set(m.id, idx));

    return (
        <>
            <Row justify='center' align='top' className='cvat-resource-list-wrapper'>
                <Col {...dimensions} className='cvat-models-list'>
                    <BulkWrapper
                        currentResourceIds={models.map((m) => m.id)}
                        resourceType={SelectedResourceType.MODELS}
                    >
                        {(selectProps) => {
                            const renderModelRow = (instances: MLModel[]): JSX.Element => (
                                <Row key={instances[0].id} className='cvat-models-list-row'>
                                    {instances.map((model: MLModel) => {
                                        const globalIdx = modelIdToIndex.get(model.id) ?? 0;
                                        return (
                                            <Col span={6} key={model.id}>
                                                <DeployedModelItem
                                                    model={model}
                                                    {...selectProps(model.id, globalIdx)}
                                                />
                                            </Col>
                                        );
                                    })}
                                </Row>
                            );
                            return groupedModels.map(renderModelRow);
                        }}
                    </BulkWrapper>
                </Col>
            </Row>
            <Row justify='center' align='middle' className='cvat-resource-pagination-wrapper'>
                <Pagination
                    className='cvat-models-pagination'
                    onChange={(newPage: number, newPageSize: number) => {
                        // Only fetch models if organization context is ready (either org or personal workspace)
                        if (organizationInitialized) {
                            dispatch(getModelsAsync({
                                ...query,
                                page: newPage,
                                pageSize: newPageSize,
                            }));
                        }
                    }}
                    total={totalCount}
                    current={page}
                    pageSize={pageSize}
                    pageSizeOptions={[12, 24, 48, 96]}
                    showQuickJumper
                    showSizeChanger
                />
            </Row>
        </>
    );
}
