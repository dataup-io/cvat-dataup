import React, { useState, useEffect, useRef } from 'react';
import { useDispatch } from 'react-redux';
import { Col, Radio, Checkbox, InputNumber, Select, Button, Typography } from 'antd';
import { EditOutlined } from '@ant-design/icons';
import { direction } from 'direction';
import TextArea from 'antd/lib/input/TextArea';
import { showTextEditor } from 'actions/annotation-actions';

const { Text } = Typography;

interface Props {
    readonly: boolean;
    attrInputType: string;
    attrValues: string[];
    attrValue: string;
    attrName: string;
    attrID: number;
    changeAttribute(attrID: number, value: string): void;
}

function attrIsTheSame(prevProps: Props, nextProps: Props): boolean {
    return (
        nextProps.readonly === prevProps.readonly &&
        nextProps.attrID === prevProps.attrID &&
        nextProps.attrValue === prevProps.attrValue &&
        nextProps.attrName === prevProps.attrName &&
        nextProps.attrInputType === prevProps.attrInputType &&
        nextProps.attrValues.every((value, index) => prevProps.attrValues[index] === value)
    );
}

function ItemAttributeComponent(props: Props): JSX.Element {
    const {
        attrInputType, attrValues, attrValue,
        attrName, attrID, readonly, changeAttribute,
    } = props;

    const dispatch = useDispatch();
    const [localAttrValue, setLocalAttrValue] = useState(attrValue);
    const [textDirection, setTextDirection] = useState<'ltr' | 'rtl'>('ltr');
    const wrapperRef = useRef<HTMLDivElement>(null);

    useEffect(() => setLocalAttrValue(attrValue), [attrValue]);

    useEffect(() => {
        if (attrInputType === 'text') {
            const detected = direction(localAttrValue);
            setTextDirection(detected === 'rtl' ? 'rtl' : 'ltr');
        }
    }, [localAttrValue, attrInputType])

    if (attrInputType !== 'text') {
        switch (attrInputType) {
            case 'checkbox':
                return (
                    <Col span={24}>
                        <Checkbox
                            checked={localAttrValue === 'true'}
                            disabled={readonly}
                            onChange={(e) => changeAttribute(attrID, e.target.checked.toString())}
                        >
                            <Text>{attrName}</Text>
                        </Checkbox>
                    </Col>
                );

            case 'radio':
                return (
                    <Col span={24}>
                        <fieldset className="cvat-attribute-radio-group">
                            <legend><Text>{attrName}</Text></legend>
                            <Radio.Group
                                value={localAttrValue}
                                onChange={(e) => changeAttribute(attrID, e.target.value)}
                                disabled={readonly}
                            >
                                {attrValues.map((value) => (
                                    <Radio key={value} value={value}>{value}</Radio>
                                ))}
                            </Radio.Group>
                        </fieldset>
                    </Col>
                );

            case 'select':
                return (
                    <>
                        <Col span={8}><Text>{attrName}</Text></Col>
                        <Col span={16}>
                            <Select
                                value={localAttrValue}
                                onChange={(value) => changeAttribute(attrID, value)}
                                disabled={readonly}
                            >
                                {attrValues.map((value) => (
                                    <Select.Option key={value} value={value}>{value}</Select.Option>
                                ))}
                            </Select>
                        </Col>
                    </>
                );

            case 'number': {
                const [min, max, step] = attrValues.map(Number);
                return (
                    <>
                        <Col span={8}><Text>{attrName}</Text></Col>
                        <Col span={16}>
                            <InputNumber
                                value={Number(localAttrValue)}
                                min={min}
                                max={max}
                                step={step}
                                onChange={(value) => value !== null && changeAttribute(attrID, value.toString())}
                                disabled={readonly}
                            />
                        </Col>
                    </>
                );
            }

            default:
                return (
                    <>
                        <Col span={8}><Text>{attrName}</Text></Col>
                        <Col span={16}>
                            <TextArea
                                value={localAttrValue}
                                onChange={(e) => changeAttribute(attrID, e.target.value)}
                                readOnly={readonly}
                            />
                        </Col>
                    </>
                );
        }
    }

    return (
        <Col span={24} ref={wrapperRef}>
            <div className="cvat-text-attribute-preview">
                <Text ellipsis={{ tooltip: localAttrValue }}>
                    {localAttrValue || <span className="cvat-empty-text-preview">Click to edit text</span>}
                </Text>
                <Button
                    type="link"
                    icon={<EditOutlined />}
                    onClick={() => {
                        dispatch(showTextEditor(
                            attrID,
                            localAttrValue,
                            attrName,
                            attrInputType,
                            attrValues
                        ));
                    }}
                    disabled={readonly}
                />
            </div>
        </Col>
    );
}

export default React.memo(ItemAttributeComponent, attrIsTheSame);