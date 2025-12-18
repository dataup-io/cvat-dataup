// Simple wrapper around the browser Web Speech API (SpeechRecognition / webkitSpeechRecognition)
// to provide a minimal hook-style interface for voice-to-text input.

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface VoiceRecognitionState {
    supported: boolean;
    listening: boolean;
    error: string | null;
}

export interface VoiceRecognitionHandlers {
    start: () => void;
    stop: () => void;
    resetError: () => void;
    setLanguage: (lang: string) => void;
}

export type OnResultHandler = (text: string) => void;

// Common languages supported by Web Speech API
export const SUPPORTED_LANGUAGES: Array<{ code: string; name: string }> = [
    { code: 'en-US', name: 'English (US)' },
    { code: 'en-GB', name: 'English (UK)' },
    { code: 'es-ES', name: 'Spanish (Spain)' },
    { code: 'es-MX', name: 'Spanish (Mexico)' },
    { code: 'fr-FR', name: 'French' },
    { code: 'de-DE', name: 'German' },
    { code: 'it-IT', name: 'Italian' },
    { code: 'pt-BR', name: 'Portuguese (Brazil)' },
    { code: 'pt-PT', name: 'Portuguese (Portugal)' },
    { code: 'ru-RU', name: 'Russian' },
    { code: 'ja-JP', name: 'Japanese' },
    { code: 'ko-KR', name: 'Korean' },
    { code: 'zh-CN', name: 'Chinese (Simplified)' },
    { code: 'zh-TW', name: 'Chinese (Traditional)' },
    { code: 'ar-SA', name: 'Arabic (Saudi Arabia)' },
    { code: 'ar-EG', name: 'Arabic (Egypt)' },
    { code: 'ar-AE', name: 'Arabic (UAE)' },
    { code: 'ar-IL', name: 'Arabic (Israel)' },
    { code: 'ar-IQ', name: 'Arabic (Iraq)' },
    { code: 'ar-JO', name: 'Arabic (Jordan)' },
    { code: 'ar-KW', name: 'Arabic (Kuwait)' },
    { code: 'ar-LB', name: 'Arabic (Lebanon)' },
    { code: 'ar-MA', name: 'Arabic (Morocco)' },
    { code: 'ar-OM', name: 'Arabic (Oman)' },
    { code: 'ar-QA', name: 'Arabic (Qatar)' },
    { code: 'ar-TN', name: 'Arabic (Tunisia)' },
    { code: 'hi-IN', name: 'Hindi' },
    { code: 'nl-NL', name: 'Dutch' },
    { code: 'pl-PL', name: 'Polish' },
    { code: 'tr-TR', name: 'Turkish' },
    { code: 'sv-SE', name: 'Swedish' },
    { code: 'da-DK', name: 'Danish' },
    { code: 'no-NO', name: 'Norwegian' },
    { code: 'fi-FI', name: 'Finnish' },
];

export function getDefaultLanguage(): string {
    const browserLang = navigator.language || 'en-US';
    // Check if browser language is in our supported list
    const supported = SUPPORTED_LANGUAGES.find((lang) => lang.code === browserLang);
    if (supported) return browserLang;

    // Try to match language prefix (e.g., 'en' matches 'en-US')
    const langPrefix = browserLang.split('-')[0];
    const prefixMatch = SUPPORTED_LANGUAGES.find((lang) => lang.code.startsWith(langPrefix));
    if (prefixMatch) return prefixMatch.code;

    return 'en-US'; // Default fallback
}

export function getStoredLanguage(): string {
    if (typeof window === 'undefined') return getDefaultLanguage();
    try {
        const stored = localStorage.getItem('cvat-voice-recognition-language');
        if (stored && SUPPORTED_LANGUAGES.some((lang) => lang.code === stored)) {
            return stored;
        }
    } catch {
        // Ignore localStorage errors
    }
    return getDefaultLanguage();
}

export function storeLanguage(lang: string): void {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem('cvat-voice-recognition-language', lang);
    } catch {
        // Ignore localStorage errors
    }
}

declare global {
    interface Window {
        webkitSpeechRecognition?: any;
        SpeechRecognition?: any;
    }
}

async function requestMicrophonePermission(): Promise<boolean> {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        return false;
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // Stop the stream immediately - we just needed permission
        stream.getTracks().forEach((track) => track.stop());
        return true;
    } catch (error: any) {
        console.warn('Microphone permission denied:', error);
        return false;
    }
}

export function createVoiceRecognition(onResult: OnResultHandler, initialLanguage?: string): {
    getState: () => VoiceRecognitionState;
    handlers: VoiceRecognitionHandlers;
} {
    const SpeechRecognitionCtor =
        typeof window !== 'undefined'
            ? (window.SpeechRecognition || window.webkitSpeechRecognition)
            : null;

    const state: VoiceRecognitionState = {
        supported: Boolean(SpeechRecognitionCtor),
        listening: false,
        error: null,
    };

    let recognition: any = null;
    let permissionRequested = false;
    let currentLanguage = initialLanguage || getStoredLanguage();

    if (SpeechRecognitionCtor) {
        recognition = new SpeechRecognitionCtor();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = currentLanguage;

        recognition.onresult = (event: any) => {
            const transcript =
                event.results && event.results[0] && event.results[0][0]
                    ? event.results[0][0].transcript
                    : '';
            if (transcript) {
                onResult(transcript);
            }
        };

        recognition.onerror = (event: any) => {
            // Handle permission-related errors
            if (event?.error === 'not-allowed' || event?.error === 'service-not-allowed') {
                state.error = 'Microphone permission denied. Please allow microphone access in your browser settings.';
            } else if (event?.error === 'no-speech') {
                // Ignore "no-speech" errors to avoid noisy UX when user cancels quickly
                state.listening = false;
                return;
            } else if (event?.error) {
                state.error = `Recognition error: ${event.error}`;
            }
            state.listening = false;
        };

        recognition.onend = () => {
            state.listening = false;
        };
    }

    const getState = (): VoiceRecognitionState => ({ ...state });

    const handlers: VoiceRecognitionHandlers = {
        start: async () => {
            if (!recognition || !state.supported || state.listening) return;

            // Request microphone permission if not already requested
            if (!permissionRequested) {
                state.error = null;
                const hasPermission = await requestMicrophonePermission();
                permissionRequested = true;

                if (!hasPermission) {
                    state.error = 'Microphone permission is required for voice input. Please allow microphone access.';
                    return;
                }
            }

            // Ensure language is set before starting
            recognition.lang = currentLanguage;

            state.error = null;
            state.listening = true;
            try {
                recognition.start();
            } catch (error: any) {
                // Handle case where recognition is already started
                if (error?.message?.includes('already started') || error?.message?.includes('started')) {
                    state.listening = true;
                    return;
                }
                state.error = error?.message || 'Failed to start recognition';
                state.listening = false;
            }
        },
        stop: () => {
            if (!recognition || !state.listening) return;
            try {
                recognition.stop();
            } catch {
                // ignore
            }
            state.listening = false;
        },
        resetError: () => {
            state.error = null;
        },
        setLanguage: (lang: string) => {
            if (!recognition || !SUPPORTED_LANGUAGES.some((l) => l.code === lang)) return;
            currentLanguage = lang;
            recognition.lang = lang;
            storeLanguage(lang);
        },
    };

    return { getState, handlers };
}


