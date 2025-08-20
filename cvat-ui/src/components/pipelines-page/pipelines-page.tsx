// Copyright (C) CVAT.ai Corporation
//
// SPDX-License-Identifier: MIT

import React from 'react';
import ComingSoonComponent from 'components/common/coming-soon';

function PipelinesPageComponent(): JSX.Element {
    return (
        <ComingSoonComponent 
            title="Pipelines - Coming Soon"
            subtitle="Pipeline management and automation features will be available in a future release. Stay tuned for updates!"
        />
    );
}

export default React.memo(PipelinesPageComponent);
