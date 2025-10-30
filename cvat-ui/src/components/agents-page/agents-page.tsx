import React from 'react';
import './styles.scss';
import { Redirect, useParams } from 'react-router';
import AgentApisPage from 'components/agent-apis-page/agent-apis-page';
import BenchmarkDashboard from '../benchmark-dashboard/benchmark-dashboard';
import AgentBenchmarkResults from '../benchmark-dashboard/agent-benchmark-results';

interface RouteParams {
    tab: string;
    subtab?: string;
}

function Agents(): JSX.Element {
    const { tab, subtab } = useParams<RouteParams>();

    if (tab === 'apis') {
        return <AgentApisPage />;
    }

    if (tab === 'benchmarks') {
        // If there's a subtab (agentId), show the agent benchmark results
        if (subtab) {
            return <AgentBenchmarkResults />;
        }
        // Otherwise show the benchmark dashboard
        return <BenchmarkDashboard />;
    }

    // Default redirect to apis tab
    return <Redirect to='/agents/apis' />;
}

export default React.memo(Agents);
