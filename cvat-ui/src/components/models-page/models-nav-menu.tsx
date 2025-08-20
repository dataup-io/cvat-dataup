import { Menu, MenuProps } from 'antd/lib';
import React from 'react';
import { useLocation } from 'react-router';

export type MenuItem = Required<MenuProps>['items'][number];

interface ModelsNavigationProps {
    items: MenuItem[];
}

function ModelsMenuNavComponent({ items }: ModelsNavigationProps): JSX.Element {
    const location = useLocation();
    const current = location.pathname.split('/').pop() || '';

    return (
        <Menu items={items} mode='horizontal' selectedKeys={[current]} className='data-up-custom-menu' />
    );
}

export default React.memo(ModelsMenuNavComponent);
