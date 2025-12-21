// Copyright (C) 2024 CVAT.ai Corporation
//
// SPDX-License-Identifier: MIT

import React from 'react';
import { Redirect, useParams } from 'react-router';
import DataUpApiKeysPage from './dataup-api-keys-page';
import PersonalAccessTokensPage from './personal-access-tokens-page';
import PasswordPage from './password-page';

interface RouteParams {
    tab: string;
}

function SecurityPageRouter(): JSX.Element {
    const { tab } = useParams<RouteParams>();

    if (tab === 'dataup-keys') {
        return <DataUpApiKeysPage />;
    }

    if (tab === 'pat') {
        return <PersonalAccessTokensPage />;
    }

    if (tab === 'password') {
        return <PasswordPage />;
    }

    // Default redirect to dataup-keys
    return <Redirect to='/security/dataup-keys' />;
}

export default React.memo(SecurityPageRouter);

