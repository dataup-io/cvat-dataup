// Copyright (C) CVAT.ai Corporation
//
// SPDX-License-Identifier: MIT
import React from 'react';



function NothingToSee({ message }: { message: string }): JSX.Element | null {




    return (
        <div
            className='data-up-nothing-chart'
        >
            <img src="./../../assets/nothing.png" alt="nothing" />
            <h4>No counts to display</h4>
            <p>{message}</p>
        </div>
    );
}

export default React.memo(NothingToSee);
