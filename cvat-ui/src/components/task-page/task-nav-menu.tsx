import { Menu, MenuProps } from 'antd/lib';
import React from 'react';
import { useLocation } from 'react-router';

export type MenuItem = Required<MenuProps>['items'][number];

interface NavigationTopBarProps {
    items: MenuItem[];
}

function TaskMenuNavComponent({ items}: NavigationTopBarProps): JSX.Element {
    const location = useLocation();
    const current = location.pathname.split('/').pop() || '';

    return (
        <Menu items={items} mode='horizontal' selectedKeys={[current]} className='cvat-task-nav-menu' />
    );
}

export default React.memo(TaskMenuNavComponent);
