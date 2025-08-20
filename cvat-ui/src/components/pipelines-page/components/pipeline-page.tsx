import React, { useMemo } from 'react';
import '../styles.scss';
import {
    Redirect, Route, Switch, useHistory, useRouteMatch, useParams
} from 'react-router-dom';
import { FileTextOutlined, BarChartOutlined } from '@ant-design/icons';
import CustomMenuNavComponent, { MenuItem } from 'components/models-page/navigation-top-bar';
import PipelineDetailsComponent from './pipeline-details';
import PipelineExecutionsComponent from './pipeline-executions';


function PipelineDetailsPage(): JSX.Element {
    const { path, url } = useRouteMatch();
    const history = useHistory();
    const { pid } = useParams<{ pid?: string }>();

    const navItems: MenuItem[] = useMemo(() => [
        {
            label: 'Details',
            key: 'details',
            icon: <FileTextOutlined />,
            onClick: () => history.push(`${url}/details`),
        },
        {
            label: 'Executions',
            key: 'executions',
            icon: <BarChartOutlined />,
            onClick: () => history.push(`${url}/executions`),
        },
    ], [history, url]);

    return (
        <div className='cvat-pipeline-details-page'>
            <CustomMenuNavComponent items={navItems} />
            <Switch>
                <Route path={`${path}/details`}>
                    <PipelineDetailsComponent pipelineId={pid} />
                </Route>
                <Route path={`${path}/executions`}>
                    <PipelineExecutionsComponent pipelineId={pid} />
                </Route>
                <Redirect from={path} to={`${url}/details`} />
            </Switch>
        </div>
    );
}

export default React.memo(PipelineDetailsPage);