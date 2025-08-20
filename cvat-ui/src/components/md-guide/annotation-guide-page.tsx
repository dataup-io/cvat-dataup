// Copyright (C) CVAT.ai Corporation
//
// SPDX-License-Identifier: MIT

import React from 'react';
import ComingSoonComponent from 'components/common/coming-soon';

function AnnotationGuidePage(): JSX.Element {
    return (
        <ComingSoonComponent 
            title="Annotation Guides - Coming Soon"
            subtitle="Annotation guide creation and management features will be available in a future release. Stay tuned for updates!"
        />
    );
}

export default React.memo(AnnotationGuidePage);
