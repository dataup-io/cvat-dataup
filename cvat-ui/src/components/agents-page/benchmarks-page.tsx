import React from 'react';
import { Route, Switch, useRouteMatch } from 'react-router-dom';
import BenchmarkDashboard from '../benchmark-dashboard/benchmark-dashboard';
import AgentBenchmarkResults from '../benchmark-dashboard/agent-benchmark-results';

function BenchmarksPage(): JSX.Element {
    const { path } = useRouteMatch();

    return (
        <Switch>
            <Route exact path={path} component={BenchmarkDashboard} />
            <Route path={`${path}/:agentId`} component={AgentBenchmarkResults} />
        </Switch>
    );
}

export default BenchmarksPage;