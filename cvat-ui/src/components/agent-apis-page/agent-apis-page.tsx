// Copyright (C) 2020-2022 Intel Corporation
// Copyright (C) CVAT.ai Corporation
//
// SPDX-License-Identifier: MIT

import React from 'react';
import ApisTablePage from './apis-table-page';

export default function AgentApisPageComponent(): JSX.Element {
    return (
        <div className='cvat-agent-apis-page'>
            <ApisTablePage />
        </div>
    );
}
