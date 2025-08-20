import './styles.scss';
import React from 'react';
import EmptyListComponent from './training-empty-list';

function ModelsTrainingsPageComponent(): JSX.Element {
    return (
        <EmptyListComponent />
    );
}

export default React.memo(ModelsTrainingsPageComponent);
