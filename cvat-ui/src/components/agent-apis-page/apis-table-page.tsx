import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import Spin from 'antd/lib/spin';

import { CombinedState } from 'reducers';
import { deleteAgentApiAsync, getAgentApisAsync } from 'actions/agent-apis-actions';
import CreateApiModal from './create-api-modal';
import TopBar from './top-bar';
import ApisTableComponent from './apis-table';

function ApisTablePageComponent(): JSX.Element {
    const dispatch = useDispatch();
    const [searchValue, setSearchValue] = useState('');
    const [createModalVisible, setCreateModalVisible] = useState(false);
    const [editingApi, setEditingApi] = useState(null);

    const fetching = useSelector((state: CombinedState) => state.agentApis.fetching);
    const apis = useSelector((state: CombinedState) => state.agentApis.current);
    const gettingQuery = useSelector((state: CombinedState) => state.agentApis.gettingQuery);
    const count = useSelector((state: CombinedState) => state.agentApis.count);
    const currentOrganization = useSelector((state: CombinedState) => state.organizations.current);
    const initialized = useSelector((state: CombinedState) => state.agentApis.initialized);

    useEffect(() => {
        // Only fetch agent APIs if organization is properly activated and we haven't initialized yet
        if (currentOrganization && currentOrganization.uuid && currentOrganization.id && !initialized) {
            dispatch(getAgentApisAsync({ page: 1, pageSize: 10 }));
        }
    }, [currentOrganization?.uuid, currentOrganization?.id, initialized, dispatch]);

    const handleDeleteApi = (api: any) => {
        dispatch(deleteAgentApiAsync(api));
    };

    const handleSearch = (value: string) => {
        setSearchValue(value);
        dispatch(getAgentApisAsync({
            ...gettingQuery,
            search: value,
            page: 1,
        }));
    };

    const handlePageChange = (page: number, pageSize?: number) => {
        dispatch(getAgentApisAsync({
            ...gettingQuery,
            page,
            pageSize: pageSize || gettingQuery.page_size || 10,
        }));
    };

    const handleCreateApi = () => {
        setEditingApi(null);
        return setCreateModalVisible(true);
    };

    const handleEditApi = (api: any) => {
        setEditingApi(api);
        setCreateModalVisible(true);
    };

    const handleCloseModal = () => {
        setCreateModalVisible(false);
        return setEditingApi(null);
    };

    return (
        <div className='cvat-apis-page'>
            <TopBar onSearchChange={handleSearch} searchValue={searchValue} onCreateApi={handleCreateApi} />

            {fetching && <Spin className='cvat-spinner' />}

            {!fetching && (
                <ApisTableComponent
                    apis={apis}
                    total={count}
                    currentPage={gettingQuery.page || 1}
                    pageSize={gettingQuery.page_size || 10}
                    onPageChange={handlePageChange}
                    onEditApi={handleEditApi}
                    onDeleteApi={handleDeleteApi}
                />
            )}

            <CreateApiModal
                visible={createModalVisible}
                api={editingApi}
                onClose={handleCloseModal}
            />
        </div>
    );
}

export default React.memo(ApisTablePageComponent);
