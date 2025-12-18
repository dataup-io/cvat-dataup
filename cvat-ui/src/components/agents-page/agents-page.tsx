import React from 'react';
import './styles.scss';
import { Redirect, useParams, useLocation } from 'react-router';
import AgentApisPage from 'components/agent-apis-page/agent-apis-page';
import BenchmarkDashboard from '../benchmark-dashboard/benchmark-dashboard';
import AgentBenchmarkResults from '../benchmark-dashboard/agent-benchmark-results';
import BenchmarkVisualComparison from '../benchmark-dashboard/benchmark-visual-comparison';

interface RouteParams {
    tab: string;
    subtab?: string;
}

function Agents(): JSX.Element {
    const { tab, subtab } = useParams<RouteParams>();
    const location = useLocation();

    if (tab === 'endpoints') {
        return <AgentApisPage />;
    }

    if (tab === 'benchmarks') {
        // Check if this is a visual comparison route
        // URL pattern: /agents/benchmarks/:agentId/visual/:resultId/:jobId?
        const visualMatch = location.pathname.match(/\/agents\/benchmarks\/([^/]+)\/visual\/([^/]+)(?:\/(\d+))?$/);
        if (visualMatch) {
            return <BenchmarkVisualComparison />;
        }

        // If there's a subtab (agentId), show the agent benchmark results
        if (subtab) {
            return <AgentBenchmarkResults />;
        }
        // Otherwise show the benchmark dashboard
        return <BenchmarkDashboard />;
    }

    // Default redirect to apis tab
    return <Redirect to='/agents/endpoints' />;
}

export default React.memo(Agents);
