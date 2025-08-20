// Copyright (C) CVAT.ai Corporation
//
// SPDX-License-Identifier: MIT

import React from 'react';
import ComingSoonComponent from 'components/common/coming-soon';

function AgentApisPageComponent(): JSX.Element {
    return (
        <ComingSoonComponent 
            title="Agent APIs - Coming Soon"
            subtitle="Agent API management features will be available in a future release. Stay tuned for updates!"
        />
    );
}

export default React.memo(AgentApisPageComponent);
