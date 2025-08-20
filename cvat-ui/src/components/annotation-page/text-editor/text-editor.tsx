// Copyright (C) 2020-2024 Intel Corporation
// SPDX-License-Identifier: MIT

import React, { useState, useEffect } from 'react';
import { Button, Space, Tooltip, Typography } from 'antd';
import { AlignLeftOutlined, AlignRightOutlined, CloseOutlined } from '@ant-design/icons';
import { direction } from 'direction';
import TextArea from 'antd/lib/input/TextArea';
import Draggable from 'react-draggable';

import './styles.scss';

const { Text } = Typography;

interface Props {
    visible: boolean;
    attrID: number | null;
    attrValue: string;
    attrName: string;
    attrInputType: string;
    attrValues: string[];
    onHide: () => void;
    changeAttribute: (attrID: number, value: string) => void;
}

function TextEditorComponent(props: Props): JSX.Element | null {
    const {
        visible, attrID, attrValue, attrName, attrInputType, attrValues, onHide, changeAttribute,
    } = props;

    const [localAttrValue, setLocalAttrValue] = useState(attrValue);
    const [textDirection, setTextDirection] = useState<'ltr' | 'rtl'>('ltr');

    useEffect(() => setLocalAttrValue(attrValue), [attrValue]);

    useEffect(() => {
        if (attrInputType === 'text') {
            const detected = direction(localAttrValue);
            setTextDirection(detected === 'rtl' ? 'rtl' : 'ltr');
        }
    }, [localAttrValue, attrInputType]);

    const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newValue = e.target.value;
        setLocalAttrValue(newValue);
    };

    const handleSave = () => {
        if (attrID !== null) {
            changeAttribute(attrID, localAttrValue);
            onHide();
        }
    };

    const handleCancel = () => {
        setLocalAttrValue(attrValue);
        onHide();
    };

    if (!visible || attrID === null) {
        return null;
    }

    return (
        <div className="cvat-text-editor-overlay">
            <Draggable handle=".cvat-text-editor-header">
                <div className="cvat-text-editor-popup">
                    <div className="cvat-text-editor-header">
                        <Space>
                            <Text strong>{attrName} - {}</Text>
                            <Button
                                type="text"
                                icon={<CloseOutlined />}
                                onClick={onHide}
                                size="small"
                            />
                        </Space>
                    </div>

                    <div className="cvat-text-editor-body">
                        <TextArea
                            value={localAttrValue}
                            onChange={handleTextChange}
                            dir={textDirection}
                            className="cvat-text-editor-textarea resizable-textarea"
                        />

                        <Space className="cvat-text-editor-controls">
                            <Space>
                                <Tooltip title="Left-to-Right Direction">
                                    <Button
                                        size="small"
                                        icon={<AlignLeftOutlined />}
                                        type={textDirection === 'ltr' ? 'primary' : 'default'}
                                        onClick={() => setTextDirection('ltr')}
                                    />
                                </Tooltip>
                                <Tooltip title="Right-to-Left Direction">
                                    <Button
                                        size="small"
                                        icon={<AlignRightOutlined />}
                                        type={textDirection === 'rtl' ? 'primary' : 'default'}
                                        onClick={() => setTextDirection('rtl')}
                                    />
                                </Tooltip>
                            </Space>
                            <Space>
                                <Button
                                    size="small"
                                    type="primary"
                                    onClick={handleSave}
                                >
                                    Save
                                </Button>
                                <Button
                                    size="small"
                                    onClick={handleCancel}
                                >
                                    Cancel
                                </Button>
                            </Space>
                        </Space>
                    </div>
                </div>
            </Draggable>
        </div>
    );
}

export default React.memo(TextEditorComponent);