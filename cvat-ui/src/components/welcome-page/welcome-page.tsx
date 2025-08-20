import React from 'react';
import { connect } from 'react-redux';
import {
    PlusCircleOutlined, ProjectOutlined, TeamOutlined, FileSearchOutlined,
    RobotOutlined, NodeIndexOutlined, ApiOutlined, FileAddOutlined,
    SettingOutlined, CloudServerOutlined,
} from '@ant-design/icons';
import {
    Card, Row, Col,
} from 'antd';
import { Link } from 'react-router-dom';
import { CombinedState } from 'reducers';
import './styles.scss';

const quickActions = [
    {
        icon: <PlusCircleOutlined />,
        title: 'New annotation project',
        description: 'Start a new project for data labeling and annotation',
        link: '/projects/create',
    },
    {
        icon: <FileAddOutlined />,
        title: 'New Task',
        description: 'Create a new annotation task',
        link: '/tasks/create',
    },
    {
        icon: <CloudServerOutlined />,
        title: 'Manage integrations',
        description: 'Import data from places such as S3, Azure and Google Cloud',
        link: '/cloudstorages',
    },
    {
        icon: <RobotOutlined />,
        title: 'Agents',
        description: 'Explore available AI agents and automation tools',
        link: '/agents/apis',
    },
    {
        icon: <NodeIndexOutlined />,
        title: 'Pipelines',
        description: 'Explore available Pipelines',
        link: '/pipelines/catalogue',
    },

    {
        icon: <ApiOutlined />,
        title: 'Steps',
        description: 'Explore Available steps',
        link: 'pipelines/steps',
    },
];

const guidesAndResources = [
    {
        icon: <FileSearchOutlined />,
        title: 'Documentation',
        description: 'Learn more with our docs',
        link: '/docs',
        external: true,
    },
    {
        icon: <ProjectOutlined />,
        title: 'Explore our Learning Hub',
        description: 'Watch video tutorials',
        link: '/learning',
        external: true,
    },
    {
        icon: <SettingOutlined />,
        title: 'Your settings',
        description: 'Manage your settings',
        link: '/settings',
    },
    {
        icon: <ApiOutlined />,
        title: 'SDK guide',
        description: 'How to leverage our SDK',
        link: '/sdk',
        external: true,
    },
];

interface StateToProps {
    user: any;
}

function mapStateToProps(state: CombinedState): StateToProps {
    const { auth: { user } } = state;
    return { user };
}

type Props = StateToProps;

function WelcomePage({ user }: Props): JSX.Element {
    const username = user?.username || 'User';

    return (
        <div className='welcome-page-container'>
            <div className='welcome-box'>
                <div className='welcome-icon'>👋</div>
                <h1>Welcome to DataUp, {username}</h1>
                <p>
                    Streamline your data annotation workflow with our modern, collaborative platform.
                    Get started with the tools below.
                </p>
            </div>

        <div className='sections-container'>
            <div className='section'>
                <h2 className='section-title'>Quick actions</h2>
                <Row gutter={[24, 24]} className='shortcuts-row' justify='start'>
                    {quickActions.map((item) => (
                        <Col xs={24} sm={12} md={8} lg={8} xl={8} key={item.title}>
                            <Link to={item.link}>
                                <Card hoverable className='shortcut-card'>
                                    <div className='shortcut-icon'>{item.icon}</div>
                                    <h3>{item.title}</h3>
                                    <p>{item.description}</p>
                                </Card>
                            </Link>
                        </Col>
                    ))}
                </Row>
            </div>

            <div className='section'>
                <h2 className='section-title'>Guides and resources</h2>
                <Row gutter={[24, 24]} className='shortcuts-row' justify='start'>
                    {guidesAndResources.map((item) => (
                        <Col xs={24} sm={12} md={8} lg={8} xl={8} key={item.title}>
                            {item.external ? (
                                <a href={item.link} target='_blank' rel='noopener noreferrer'>
                                    <Card hoverable className='shortcut-card'>
                                        <div className='shortcut-icon'>{item.icon}</div>
                                        <h3>{item.title}</h3>
                                        <p>{item.description}</p>
                                    </Card>
                                </a>
                            ) : (
                                <Link to={item.link}>
                                    <Card hoverable className='shortcut-card'>
                                        <div className='shortcut-icon'>{item.icon}</div>
                                        <h3>{item.title}</h3>
                                        <p>{item.description}</p>
                                    </Card>
                                </Link>
                            )}
                        </Col>
                    ))}
                </Row>
            </div>
        </div>
    </div>
    );
}

export default connect(mapStateToProps)(WelcomePage);