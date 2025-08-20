import React from 'react';
import ComingSoonComponent from 'components/common/coming-soon';

function StepsPageComponent(): JSX.Element {
    return (
        <ComingSoonComponent 
            title="Pipeline Steps - Coming Soon"
            subtitle="Pipeline step management and configuration features will be available in a future release. Stay tuned for updates!"
        />
    );
}

export default React.memo(StepsPageComponent);