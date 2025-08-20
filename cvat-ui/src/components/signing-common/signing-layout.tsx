// Copyright (C) CVAT.ai Corporation
//
// SPDX-License-Identifier: MIT

import './styles.scss';
import React from 'react';
import { Col, Row } from 'antd/lib/grid';
import Layout from 'antd/lib/layout';
import Icon from '@ant-design/icons';
import { DataUpLogo } from 'icons';
import LoginCarousel from 'components/login-carousel/login-carousel';
import { EmblaOptionsType } from 'embla-carousel';
// import SVGSigningBackground from '../../assets/signing-background.svg';

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
    // const titleSizes = {
    //     xs: { span: 12 },
    //     sm: { span: 12 },
    //     md: { span: 12 },
    //     lg: { span: 12 },
    //     xl: { span: 12 },
    //     xxl: { span: 12 },
    // };
    // const formSizes = {
    //     xs: { span: 12 },
    //     sm: { span: 12 },
    //     md: { span: 12 },
    //     lg: { span: 12 },
    //     xl: { span: 12 },
    //     xxl: { span: 12 },
    // };
    const logoSizes = {
        xs: { span: 21 },
        sm: { span: 21 },
        md: { span: 21 },
        lg: { span: 21 },
        xl: { span: 21 },
        xxl: { span: 22 },
    };

    const OPTIONS: EmblaOptionsType = { loop: true, axis: 'y', direction: 'rtl' };
    const SLIDES = ['./../../assets/slider_img1.png', './../../assets/slider_img2.png', './../../assets/slider_image3.png'];
    const autoplayOptions = { delay: 4500, stopOnInteraction: false };
    return (
        <Layout className='cvat-signing-layout-wrapper'>
            <Header className='cvat-signing-header'>
                <Row className='cvat-signing-header-logo-wrapper' justify='center' align='middle'>
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
                        <Col
                            className='cvat-signing-left-side'
                            xs={0}
                            sm={0}
                            md={12}
                            lg={12}
                            xl={12}
                            xxl={12}
                        >
                            <div className='cvat-signing-carousel-container'>
                                <LoginCarousel slides={SLIDES} options={OPTIONS} autoplayOptions={autoplayOptions} />
                                <div className='cvat-signing-text-slider'>
                                    <div className='cvat-signing-text-content'>
                                        <h2>Welcome to DATAUP</h2>
                                        <p>Computer Vision Annotation Tool</p>
                                    </div>
                                    <div className='cvat-signing-text-content'>
                                        <h2>Annotate with Precision</h2>
                                        <p>Professional annotation platform</p>
                                    </div>
                                    <div className='cvat-signing-text-content'>
                                        <h2>Use Public/Custom Pipelines</h2>
                                        <p>Advanced machine learning integration</p>
                                    </div>
                                </div>
                            </div>
                        </Col>
                        <Col
                            className='cvat-signing-right-side'
                            xs={24}
                            sm={24}
                            md={12}
                            lg={12}
                            xl={12}
                            xxl={12}
                        >
                            {children}
                        </Col>
                    </Row>
                </Content>
            </Layout>
        </Layout>
    );
}

export default SignInLayout;
