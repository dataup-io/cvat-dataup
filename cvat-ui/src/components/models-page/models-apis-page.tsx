import React from 'react';
import './styles.scss';
import EmptyListComponent from './apis-empty-list';

function ModelsApisPageComponent(): JSX.Element {
    return (
        <div className='cvat-models-page'>
            <EmptyListComponent />
        </div>
    );
}

export default React.memo(ModelsApisPageComponent);
