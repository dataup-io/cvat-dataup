// Copyright (C) 2020-2022 Intel Corporation
// Copyright (C) CVAT.ai Corporation
//
// SPDX-License-Identifier: MIT

import React from 'react';
import { RouteComponentProps, useHistory } from 'react-router';
import { withRouter } from 'react-router-dom';
import { Row, Col } from 'antd/lib/grid';

import SigningLayout, { formSizes } from 'components/signing-common/signing-layout';
import LoginForm, { LoginData } from './login-form';

interface LoginPageComponentProps {
    fetching: boolean;
    renderResetPassword: boolean;
    renderRegistrationComponent: boolean;
    renderBasicLoginComponent: boolean;
    hasEmailVerificationBeenSent: boolean;
    onLogin: (credential: string, password: string) => void;
}

function LoginPageComponent(props: LoginPageComponentProps & RouteComponentProps): JSX.Element {
    const history = useHistory();
    const {
        fetching, renderResetPassword, renderRegistrationComponent, renderBasicLoginComponent,
        hasEmailVerificationBeenSent, onLogin,
    } = props;

    if (hasEmailVerificationBeenSent) {
        history.push('/auth/email-verification-sent');
    }
    return (
        <SigningLayout>
            <Col {...formSizes.wrapper} xs={18} sm={18} md={18} lg={18} xl={18} xxl={18}>
                <Row justify='center' align='middle' style={{ width: '100%', height: '100%' }}>
                    <Col {...formSizes.form} xs={24} sm={24} md={24} lg={24} xl={24} xxl={24}>
                        <LoginForm
                            fetching={fetching}
                            renderResetPassword={renderResetPassword}
                            renderRegistrationComponent={renderRegistrationComponent}
                            renderBasicLoginComponent={renderBasicLoginComponent}
                            onSubmit={(loginData: LoginData): void => {
                                onLogin(loginData.credential, loginData.password);
                            }}
                        />
                    </Col>
                </Row>
            </Col>
        </SigningLayout>
    );
}

export default withRouter(LoginPageComponent);
