import './styles.scss';
import React, { useCallback, useMemo } from 'react';
import { connect } from 'react-redux';
import { useHistory } from 'react-router';
import Menu from 'antd/lib/menu';
import type { MenuProps } from 'antd/lib/menu';
import Icon, {
    ApiOutlined,
    BulbOutlined,
    CloudServerOutlined,
    FolderOpenOutlined,
    GatewayOutlined,
    HourglassOutlined,
    PieChartOutlined,
    RobotOutlined,
    TagsOutlined,
    UnorderedListOutlined,
    SubnodeOutlined,
    ReadOutlined,
    KeyOutlined,
} from '@ant-design/icons';
import Layout from 'antd/lib/layout';
import { CombinedState } from 'reducers';
import { DataUpFavIcon, DataUpLogo2 } from 'icons';
import { useSelectedMenuKey } from 'utils/hooks';


interface StateToProps {
    user: {
        hasAnalyticsAccess: boolean;
        isSuperuser: boolean;
        groups: string[];
        plan?: string;
    };
    isAnalyticsPluginActive: boolean;
    isModelsPluginActive: boolean;
    currentOrganization: any;
}

type MenuItem = Required<MenuProps>['items'][number];

function getItem(
    label: React.ReactNode,
    key: React.Key,
    onClick?: () => void,
    icon?: React.ReactNode,
    children?: MenuItem[],
): MenuItem {
    return {
        key,
        icon,
        children,
        onClick,
        label,
    } as MenuItem;
}

function mapStateToProps(state: CombinedState): StateToProps {
    const { auth: { user }, plugins: { list }, organizations: { current } } = state;

    return {
        user: {
            hasAnalyticsAccess: user?.hasAnalyticsAccess ?? false,
            isSuperuser: user?.isSuperuser ?? false,
            groups: user?.groups ?? [],
            plan: user?.plan,
        },
        isAnalyticsPluginActive: list.ANALYTICS,
        isModelsPluginActive: list.MODELS,
        currentOrganization: current,
    };
}

type Props = StateToProps;

function SiderComponent(props: Props): JSX.Element {
    const { user, isAnalyticsPluginActive, isModelsPluginActive, currentOrganization } = props;
    const history = useHistory();
    const items = useMemo(() => {
        const baseItems = [
            getItem('Home', 'home', () => history.push('/'), <ReadOutlined />),
            getItem('Annotate', 'Annotate', undefined, <GatewayOutlined />, [
                getItem('Projects', 'projects', () => history.push('/projects'), <FolderOpenOutlined />),
                getItem('Tasks', 'tasks', () => history.push('/tasks'), <UnorderedListOutlined />),
                getItem('Jobs', 'jobs', () => history.push('/jobs'), <TagsOutlined />),
                getItem('Cloud storages', 'cloudstorages', () => history.push('/cloudstorages'), <CloudServerOutlined />),
                getItem('Requests', 'requests', () => history.push('/requests'), <HourglassOutlined />),
            ]),
            isModelsPluginActive && getItem('Agents', 'agents', undefined, <RobotOutlined />, [
                getItem('Models', 'models', () => history.push('/agents/models'), <BulbOutlined />),
                getItem('APIs', 'apis', () => history.push('/agents/apis'), <ApiOutlined />),
            ]),
            isModelsPluginActive && getItem('Pipelines', 'pipelines', undefined, <SubnodeOutlined />, [
                getItem('Catalogue', 'catalogue', () => history.push('/pipelines/catalogue'), <ReadOutlined />),
                getItem('Steps', 'steps', () => history.push('/pipelines/steps'), <ApiOutlined />),
            ]),
            isAnalyticsPluginActive && user.hasAnalyticsAccess && getItem(
                'Analytics',
                'analytics',
                () => window.open('/analytics', '_blank', 'noopener,noreferrer'),
                <PieChartOutlined />,
            ),

            getItem('API Keys', 'api-keys', () => history.push('/api-keys'), <KeyOutlined />),
        ];

        return baseItems.filter(Boolean) as MenuItem[];
    }, [user, isAnalyticsPluginActive, isModelsPluginActive, history]);

    const [collapsed, setCollapsed] = React.useState(false);
    const handleCollapse = useCallback((value: boolean) => setCollapsed(value), []);

    const keyMapping = {
        '/': 'home',
        '/projects': 'projects',
        '/tasks': 'tasks',
        '/jobs': 'jobs',
        '/cloudstorages': 'cloudstorages',
        '/requests': 'requests',
        '/agents/models': 'models',
        '/agents/apis': 'apis',
        '/analytics': 'analytics',

        '/pipelines/catalogue': 'catalogue',
        '/pipelines/steps': 'steps',
        '/api-keys': 'api-keys',
    };

    const selectedKey = useSelectedMenuKey(keyMapping);

    return (
        <Layout.Sider
            theme='light'
            className='dataup-sider'
            width={210}
            collapsedWidth={60}
            collapsible
            collapsed={collapsed}
            onCollapse={handleCollapse}
        >
            <div
                className='dataup-sider-logo'
                onClick={() => history.push('/')}
                style={{ cursor: 'pointer' }}
                tabIndex={0}
                onKeyDown={(e: React.KeyboardEvent) => {
                    if (e.key === 'i') {
                        history.push('/');
                    }
                }}
                role='button'
            >
                {collapsed ? <Icon component={DataUpFavIcon} /> :
                    <Icon className='' component={DataUpLogo2} />}
            </div>
            <div className='sider-content'>
                <Menu
                    items={items}
                    theme='light'
                    mode='inline'
                    selectedKeys={[selectedKey]}
                />

            </div>
        </Layout.Sider>
    );
}

export default connect(mapStateToProps)(React.memo(SiderComponent));
