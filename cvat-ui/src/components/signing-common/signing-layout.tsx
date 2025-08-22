// Copyright (C) 2022 CVAT.ai Corporation
//
// SPDX-License-Identifier: MIT

import './styles.scss';
import React from 'react';
import Layout from 'antd/lib/layout';
import { Col, Row } from 'antd/lib/grid';
import { DataUpLogo } from 'icons';
import Icon from '@ant-design/icons';
import SVGSigningBackground from '../../assets/signing-background.svg';

interface SignInLayoutComponentProps {
    children: JSX.Element | JSX.Element[];
}

interface Sizes {
    xs?: { span: number };
    sm?: { span: number };
    md?: { span: number };
    lg?: { span: number };
    xl?: { span: number };
    xxl?: { span: number };
}

interface FormSizes {
    wrapper: Sizes;
    form: Sizes;
}

export const formSizes: FormSizes = {
    wrapper: {
        xs: { span: 24 },
        sm: { span: 24 },
        md: { span: 24 },
        lg: { span: 24 },
        xl: { span: 15 },
        xxl: { span: 12 },
    },
    form: {
        xs: { span: 14 },
        sm: { span: 14 },
        md: { span: 14 },
        lg: { span: 14 },
        xl: { span: 16 },
        xxl: { span: 16 },
    },
};

function SignInLayout(props: SignInLayoutComponentProps): JSX.Element {
    const { children } = props;
    const { Content, Header } = Layout;
    const titleSizes = {
        xs: { span: 12 },
        sm: { span: 12 },
        md: { span: 12 },
        lg: { span: 12 },
        xl: { span: 12 },
        xxl: { span: 12 },
    };
    const formSizes = {
        xs: { span: 12 },
        sm: { span: 12 },
        md: { span: 12 },
        lg: { span: 12 },
        xl: { span: 12 },
        xxl: { span: 12 },
    };
    const logoSizes = {
        xs: { span: 21 },
        sm: { span: 21 },
        md: { span: 21 },
        lg: { span: 21 },
        xl: { span: 21 },
        xxl: { span: 22 },
    };

    return (
        <Layout>
            <SVGSigningBackground className='cvat-signing-background' />
            <Header className='cvat-signing-header'>
                <Row justify='center' align='middle'>
                    <Col {...logoSizes}>
                        <Row align='middle'>
                            <Icon className='cvat-logo-icon' component={DataUpLogo} />
                        </Row>
                    </Col>
                </Row>
            </Header>
            <Layout className='cvat-signing-layout'>
                <Content>
                    <Row style={{ height: '100%' }} className='cvat-signing-content-row'>
                        <Col {...titleSizes} className='cvat-signing-left-side'>
                            <div className='dataup-highlight-stack'>
                                <div className='dataup-highlight-box'>
                                    <p className='highlight-text'>
                                        Agent-Driven Pipelines for Streamlined Data Processes
                                    </p>
                                </div>
                                <div className='dataup-highlight-box'>
                                    <p className='highlight-text'>
                                        Enhanced CVAT-based annotation tools with extended capabilities
                                    </p>
                                </div>
                                <div className='dataup-highlight-box'>
                                    <p className='highlight-text'>
                                        Insights That Accelerate Model Development and Testing
                                    </p>
                                </div>
                            </div>
                        </Col>
                        <Col {...formSizes} className='cvat-signing-right-side'>
                            {children}
                        </Col>
                    </Row>
                </Content>
            </Layout>
        </Layout>
    );
}

export default SignInLayout;