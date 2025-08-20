// Copyright (C) 2020-2022 Intel Corporation
// Copyright (C) CVAT.ai Corporation
//
// SPDX-License-Identifier: MIT

import React, { useState } from 'react';
// import { Link } from 'react-router-dom';

import Form from 'antd/lib/form';
import Button from 'antd/lib/button';
import Input from 'antd/lib/input';
import { Col } from 'antd/lib/grid';
import Title from 'antd/lib/typography/Title';
// import Text from 'antd/lib/typography/Text';
import Icon from '@ant-design/icons';
import { ClearIcon } from 'icons';

import CVATSigningInput, { CVATInputType } from 'components/signing-common/cvat-signing-input';
import { CombinedState } from 'reducers';
import {
    // useAuthQuery,
    usePlugins,
} from 'utils/hooks';

export interface LoginData {
    credential: string;
    password: string;
}

interface Props {
    // renderResetPassword: boolean;
    renderRegistrationComponent: boolean;
    renderBasicLoginComponent: boolean;
    fetching: boolean;
    onSubmit(loginData: LoginData): void;
}

function LoginFormComponent(props: Props): JSX.Element {
    const {
        fetching, onSubmit,
        // renderResetPassword, renderRegistrationComponent,
        renderBasicLoginComponent,
    } = props;

    // const authQuery = useAuthQuery();
    const [form] = Form.useForm();
    const [credential, setCredential] = useState('');
    const pluginsToRender = usePlugins(
        (state: CombinedState) => state.plugins.components.loginPage.loginForm,
        props,
        { credential },
    );

    // let resetSearch = authQuery ? new URLSearchParams(authQuery).toString() : '';
    // if (credential.includes('@')) {
    //     const updatedAuthQuery = authQuery ? { ...authQuery, email: credential } : { email: credential };
    //     resetSearch = new URLSearchParams(updatedAuthQuery).toString();
    // }

    // const forgotPasswordLink = (
    //     <Col className='cvat-credentials-link'>
    //         <Text strong>
    //             <Link to={{ pathname: '/auth/password/reset', search: resetSearch }}>
    //                 Forgot password?
    //             </Link>
    //         </Text>
    //     </Col>
    // );

    return (
        <div className='cvat-login-form-wrapper'>
            <Col>
                <Title level={2}> Sign in </Title>
            </Col>
            <Form
                className='cvat-login-form cvat-login-form-extended'
                form={form}
                onFinish={(loginData: LoginData) => {
                    onSubmit(loginData);
                }}
            >
                {renderBasicLoginComponent && (
                    <>
                        <Form.Item
                            className='cvat-credentials-form-item'
                            name='credential'
                            label='Email or username'
                            labelCol={{ span: 24 }}
                        >
                            <Input
                                autoComplete='credential'
                                placeholder='Enter your email or username'
                                suffix={(
                                    <span style={{ visibility: credential ? 'visible' : 'hidden' }}>
                                        <Icon
                                            component={ClearIcon}
                                            onClick={() => {
                                                setCredential('');
                                                form.setFieldsValue({ credential: '', password: '' });
                                            }}
                                        />
                                    </span>
                                )}
                                onChange={(event) => {
                                    const { value } = event.target;
                                    setCredential(value);
                                }}
                            />
                        </Form.Item>
                        <Form.Item
                            className='cvat-credentials-form-item'
                            name='password'
                            label='Password'
                            labelCol={{ span: 24 }}
                        >
                            <CVATSigningInput
                                type={CVATInputType.PASSWORD}
                                id='password'
                                placeholder='Enter your password'
                                autoComplete='password'
                            />
                        </Form.Item>
                        <Form.Item>
                            <Button
                                className='cvat-credentials-action-button'
                                loading={fetching}
                                disabled={!credential}
                                htmlType='submit'
                            >
                                    Sign In
                            </Button>
                        </Form.Item>
                    </>
                )}
                {
                    pluginsToRender.map(({ component: Component }, index) => (
                        <Component targetProps={props} targetState={{ credential }} key={index} />
                    ))
                }
            </Form>
            {/* <Row justify='space-between' className='cvat-credentials-navigation'>
                {
                        <Col>
                            <Icon
                                component={BackArrowIcon}
                                onClick={() => {
                                    setCredential('');
                                    form.setFieldsValue({ credential: '' });
                                }}
                            />
                        </Col>
                }
                {
                    !credential && renderRegistrationComponent && (
                        <Row>
                            <Col className='cvat-credentials-link'>
                                <Text strong>
                                    New user?&nbsp;
                                    <Link to={{
                                        pathname: '/auth/register',
                                        search: authQuery ? new URLSearchParams(authQuery).toString() : '',
                                    }}
                                    >
                                        Contact Us
                                    </Link>
                                </Text>
                            </Col>
                        </Row>
                    )
                }
                {
                    renderResetPassword && forgotPasswordLink
                }
            </Row> */}
        </div>
    );
}

export default React.memo(LoginFormComponent);
