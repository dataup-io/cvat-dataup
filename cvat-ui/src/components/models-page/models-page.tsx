// Copyright (C) 2020-2022 Intel Corporation
// Copyright (C) CVAT.ai Corporation
//
// SPDX-License-Identifier: MIT

import './styles.scss';
import React from 'react';
import ModelsCardPageComponent from './models-card-page';

function ModelsPageComponent(): JSX.Element {
    return (
        <div className='cvat-models-page'>
            <ModelsCardPageComponent />
        </div>
    );
}

export default React.memo(ModelsPageComponent);
