import React from 'react';
import { Route, Switch, useRouteMatch } from 'react-router-dom';
import BenchmarkDashboard from '../benchmark-dashboard/benchmark-dashboard';
import AgentBenchmarkResults from '../benchmark-dashboard/agent-benchmark-results';
import BenchmarkVisualComparison from '../benchmark-dashboard/benchmark-visual-comparison';

function BenchmarksPage(): JSX.Element {
    const { path } = useRouteMatch();

    return (
        <Switch>
            <Route exact path={path} component={BenchmarkDashboard} />
            <Route path={`${path}/:agentId/visual/:resultId/:jobId?`} component={BenchmarkVisualComparison} />
            <Route path={`${path}/:agentId`} component={AgentBenchmarkResults} />
        </Switch>
    );
}

export default BenchmarksPage;