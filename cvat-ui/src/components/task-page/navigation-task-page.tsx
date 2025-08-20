import React, { useMemo, useCallback } from 'react';
import { useHistory, useParams } from 'react-router-dom';
import { PieChartOutlined, TagsOutlined, LineChartOutlined } from '@ant-design/icons';
import AnalyticsReportPage from 'components/analytics-report/analytics-report-page';
import TaskMenuNavComponent, { MenuItem } from './task-nav-menu';
import TaskPageComponent from './task-page';

interface Params {
    tid: string;
    tab?: 'overview' | 'jobs' | 'analytics';
}

function NavTaskPageComponent(): JSX.Element {
    const history = useHistory();
    const { tid, tab = 'overview' } = useParams<{ tid: string; tab?: 'overview' | 'jobs' | 'analytics' }>();
    const baseUrl = `/tasks/${tid}`;

    const handleNavigation = useCallback((newTab: Params['tab']) => {
        history.push(`${baseUrl}/${newTab}`);
    }, [history, baseUrl]);

    const navItems: MenuItem[] = useMemo(() => [
        {
            label: 'Overview',
            key: 'overview',
            icon: React.createElement(PieChartOutlined),
            onClick: () => handleNavigation('overview'),
        },
        {
            label: 'Jobs',
            key: 'jobs',
            icon: React.createElement(TagsOutlined),
            onClick: () => handleNavigation('jobs'),
        },
        {
            label: 'Performance',
            key: 'analytics',
            icon: React.createElement(LineChartOutlined),
            onClick: () => handleNavigation('analytics'),
        },
    ], [handleNavigation]);
    return React.createElement('div', { className: 'cvat-task-page' }, 
        React.createElement(TaskMenuNavComponent, { items: navItems, selectedKeys: [tab] }), 
        tab === 'analytics' ? React.createElement(AnalyticsReportPage) : React.createElement(TaskPageComponent, { tab }),
    );
    // return React.createElement('div', { className: 'cvat-task-page' },
    //     React.createElement(TaskMenuNavComponent, { items: navItems, selectedKeys: [tab] }),
    //     tab === 'analytics' ? React.createElement(AnalyticsReportPage) : React.createElement(TaskPageComponent, { tab })
    // );
}

export default React.memo(NavTaskPageComponent);
