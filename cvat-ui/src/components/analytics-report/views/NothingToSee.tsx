// Copyright (C) CVAT.ai Corporation
//
// SPDX-License-Identifier: MIT

function NothingToSee({ message }: { message: string }): any {
    const React = (globalThis as any).React || (window as any).React;
    return React.createElement('div', { className: 'data-up-nothing-chart' },
        React.createElement('img', { src: './../../assets/nothing.png', alt: 'nothing' }),
        React.createElement('h4', null, 'No counts to display'),
        React.createElement('p', null, message)
    );
}

export default NothingToSee;