import React, { useEffect, useState, useRef } from 'react';
import Button from 'antd/lib/button';
import Tooltip from 'antd/lib/tooltip';
import Select from 'antd/lib/select';
import Space from 'antd/lib/space';
import { AudioOutlined, AudioMutedOutlined, GlobalOutlined } from '@ant-design/icons';

import {
    createVoiceRecognition,
    VoiceRecognitionState,
    SUPPORTED_LANGUAGES,
    getStoredLanguage,
} from 'utils/voice-recognition';

interface Props {
    onText: (text: string) => void;
    append?: boolean;
    disabled?: boolean;
    showLanguageSelector?: boolean;
}

function VoiceInputButton(props: Props): JSX.Element | null {
    const { onText, append = true, disabled, showLanguageSelector = true } = props;

    const [{ supported, listening, error }, setState] = useState<VoiceRecognitionState>({
        supported: false,
        listening: false,
        error: null,
    });

    const [selectedLanguage, setSelectedLanguage] = useState<string>(getStoredLanguage());
    const controllerRef = useRef<ReturnType<typeof createVoiceRecognition> | null>(null);

    useEffect(() => {
        const controller = createVoiceRecognition((text: string) => {
            if (!text) return;
            // For now, caller decides how to combine text; we just forward it
            onText(text);
        }, selectedLanguage);

        controllerRef.current = controller;
        setState(controller.getState());

        const sync = () => setState(controller.getState());

        const intervalId = window.setInterval(sync, 200);

        return () => {
            window.clearInterval(intervalId);
            controller.handlers.stop();
        };
    }, [onText, append, selectedLanguage]);

    if (!supported) {
        return null;
    }

    const icon = listening ? <AudioOutlined /> : <AudioMutedOutlined />;
    const title = listening
        ? 'Listening… click to stop'
        : error || 'Click to start voice input (microphone permission required)';

    const handleClick = async (event: React.MouseEvent) => {
        event.stopPropagation();

        if (!controllerRef.current) return;

        if (listening) {
            controllerRef.current.handlers.stop();
        } else {
            controllerRef.current.handlers.resetError();
            await controllerRef.current.handlers.start();
        }

        // Sync state after async operation
        setTimeout(() => {
            if (controllerRef.current) {
                setState(controllerRef.current.getState());
            }
        }, 100);
    };

    const handleLanguageChange = (lang: string) => {
        setSelectedLanguage(lang);
        if (controllerRef.current) {
            controllerRef.current.handlers.setLanguage(lang);
        }
    };

    return (
        <Space size='small'>
            {showLanguageSelector && (
                <Tooltip title='Select recognition language'>
                    <Select
                        size='small'
                        value={selectedLanguage}
                        onChange={handleLanguageChange}
                        disabled={listening || disabled}
                        style={{ width: 120 }}
                        suffixIcon={<GlobalOutlined />}
                    >
                        {SUPPORTED_LANGUAGES.map((lang) => (
                            <Select.Option key={lang.code} value={lang.code}>
                                {lang.name}
                            </Select.Option>
                        ))}
                    </Select>
                </Tooltip>
            )}
            <Tooltip title={error || title}>
                <Button
                    size='small'
                    type={listening ? 'primary' : 'default'}
                    icon={icon}
                    onClick={handleClick}
                    disabled={disabled}
                />
            </Tooltip>
        </Space>
    );
}

export default React.memo(VoiceInputButton);


