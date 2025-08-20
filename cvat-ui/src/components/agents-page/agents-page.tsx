import React from 'react';
import './styles.scss';
import { Redirect, useParams } from 'react-router';
import AgentApisPage from 'components/agent-apis-page/agent-apis-page';
import OrganizationAccessControl from 'components/common/organization-access-control';

interface RouteParams {
    tab: string;
}

function Agents(): JSX.Element {
    const { tab } = useParams<RouteParams>();

    if (tab !== 'apis') {
        return <Redirect to='/agents/apis' />;
    }

    return (
        <OrganizationAccessControl feature='agent'>
            <AgentApisPage />
        </OrganizationAccessControl>
    );
}

export default React.memo(Agents);
