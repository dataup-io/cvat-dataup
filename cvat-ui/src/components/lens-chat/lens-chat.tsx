import React, { useEffect, useRef, useState } from 'react';
import './styles.scss';
import { Row, Col } from 'antd/lib/grid';
import Card from 'antd/lib/card';
import Space from 'antd/lib/space';
import Button from 'antd/lib/button';
import Tooltip from 'antd/lib/tooltip';
import Input from 'antd/lib/input';
import Typography from 'antd/lib/typography';
import notification from 'antd/lib/notification';
import { RobotOutlined, UserOutlined, SyncOutlined } from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import moment from 'moment';
import { getCore, Task, MembershipRole } from 'cvat-core-wrapper';
import { useSelector } from 'react-redux';
import { CombinedState } from 'reducers';

const core = getCore();

// Do not keep chat history longer than 15 minutes
const HISTORY_TTL_MS = 15 * 60 * 1000;

type Message = { role: 'user' | 'agent'; text: string; ts: number };

// Common Markdown component overrides used for both GFM and non-GFM renders
const markdownComponents = {
    a: (props: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
        <a {...props} target="_blank" rel="noopener noreferrer" />
    ),
    code({ inline, className, children, ...props }: { inline?: boolean; className?: string; children?: React.ReactNode } & React.HTMLAttributes<HTMLElement>) {
        const match = /language-(\w+)/.exec(className || '');
        const lang = match?.[1];
        const textToCopy = String(children || '');
        if (inline) {
            return <code className={className} {...props}>{children}</code>;
        }
        return (
            <div className='cvat-code-block'>
                <div className='cvat-code-toolbar'>
                    <span className='cvat-code-lang'>{lang || 'code'}</span>
                    <button
                        type='button'
                        className='cvat-code-copy'
                        onClick={() => {
                            try {
                                navigator.clipboard.writeText(textToCopy);
                                notification.success({ message: 'Copied to clipboard' });
                            } catch {
                                notification.warning({ message: 'Unable to copy' });
                            }
                        }}
                    >
                        Copy
                    </button>
                </div>
                <pre><code className={className} {...props}>{children}</code></pre>
            </div>
        );
    },
};

// Error boundary to safely render Markdown: tries GFM first, then non-GFM, then plain text
class SafeMarkdown extends React.Component<{ text: string; components?: any }, { disableGfm: boolean; fallbackPlain: boolean }> {
    constructor(props: { text: string; components?: any }) {
        super(props);
        this.state = { disableGfm: false, fallbackPlain: false };
    }

    componentDidCatch(error: Error, _errorInfo: React.ErrorInfo): void {
        // First error: disable GFM; if it errors again, fall back to plain text
        if (!this.state.disableGfm) {
            this.setState({ disableGfm: true });
        } else {
            this.setState({ fallbackPlain: true });
        }
    }

    render(): React.ReactNode {
        const { text, components } = this.props;
        const { disableGfm, fallbackPlain } = this.state;
        if (fallbackPlain) {
            return <pre className='cvat-markdown-fallback'>{text}</pre>;
        }
        const remarkPlugins = disableGfm ? [] : [remarkGfm];
        return (
            <ReactMarkdown remarkPlugins={remarkPlugins} components={components || markdownComponents}>
                {text}
            </ReactMarkdown>
        );
    }
}

export default function LensChat({ task }: { task: Task }): JSX.Element {
    const storageKey = `cvat_lens_chat_task_${task?.id ?? 'unknown'}`;
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const messagesRef = useRef<HTMLDivElement | null>(null);
    const [showNewMsgToast, setShowNewMsgToast] = useState(false);
    const [isAtBottom, setIsAtBottom] = useState(true);
    const { user, org } = useSelector((state: CombinedState) => ({
        user: state.auth.user,
        org: state.organizations.current,
    }));
    const [isAllowed, setIsAllowed] = useState<boolean>(false);

    // Sync job mock state
    const [syncState, setSyncState] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
    const [syncProgress, setSyncProgress] = useState<number>(0);
    const [lastSyncTs, setLastSyncTs] = useState<number | null>(null);
    const syncTimerRef = useRef<number | null>(null);

    // Initial load and scroll listener
    useEffect(() => {
        try {
            const raw = localStorage.getItem(storageKey);
            if (raw) {
                const parsed = JSON.parse(raw) as Message[];
                if (Array.isArray(parsed)) {
                    // Backward compatibility: ensure timestamps exist
                    const normalized = parsed.map((m) => ({ ...m, ts: m.ts ?? Date.now() }));
                    const now = Date.now();
                    const filtered = normalized.filter((m) => (now - m.ts) <= HISTORY_TTL_MS);
                    setMessages(filtered);
                    try {
                        localStorage.setItem(storageKey, JSON.stringify(filtered));
                    } catch { /* ignore */ }
                }
            }
        } catch { /* ignore */ }

        const el = messagesRef.current;
        const onScroll = () => {
            if (!el) return;
            const threshold = 20;
            const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - threshold;
            setIsAtBottom(atBottom);
            if (atBottom) setShowNewMsgToast(false);
        };
        if (el) el.addEventListener('scroll', onScroll);
        return () => { if (el) el.removeEventListener('scroll', onScroll); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Periodically prune expired messages from UI and storage
    useEffect(() => {
        const interval = setInterval(() => {
            setMessages((msgs) => {
                const now = Date.now();
                const filtered = msgs.filter((m) => (now - m.ts) <= HISTORY_TTL_MS);
                if (filtered.length !== msgs.length) {
                    try {
                        localStorage.setItem(storageKey, JSON.stringify(filtered));
                    } catch { /* ignore */ }
                }
                return filtered;
            });
        }, 60 * 1000);
        return () => clearInterval(interval);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Permission check: allow only superuser, organization maintainer or supervisor
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                if (!user) {
                    if (!cancelled) setIsAllowed(false);
                    return;
                }
                if (!org) {
                    // Personal workspace: allow superusers only
                    if (!cancelled) setIsAllowed(!!user.isSuperuser);
                    return;
                }
                const memberships = await org.members({
                    filter: `{"and":[{"==":[{"var":"user"},"${user.username}"]}]}`,
                });
                const role = memberships?.[0]?.role;
                const allowed = user.isSuperuser ||
                    [MembershipRole.MAINTAINER, MembershipRole.SUPERVISOR].includes(role);
                if (!cancelled) setIsAllowed(allowed);
            } catch {
                const allowed = !!user?.isSuperuser;
                if (!cancelled) setIsAllowed(allowed);
            }
        })();
        return () => { cancelled = true; };
    }, [user, org]);

    // On new messages: autoscroll when at bottom, persist, maybe show toast
    useEffect(() => {
        if (isAtBottom && messagesRef.current) {
            messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
        }
        try {
            const now = Date.now();
            const pruned = messages.filter((m) => (now - m.ts) <= HISTORY_TTL_MS);
            localStorage.setItem(storageKey, JSON.stringify(pruned));
        } catch { /* ignore */ }
        if (!isAtBottom && messages.length > 0) setShowNewMsgToast(true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [messages]);

    // Cleanup any running sync timers on unmount
    useEffect(() => () => {
        if (syncTimerRef.current) {
            clearInterval(syncTimerRef.current);
            syncTimerRef.current = null;
        }
    }, []);

    const startSync = (): void => {
        if (!isAllowed || syncState === 'running') return;
        setSyncState('running');
        setSyncProgress(0);

        (async () => {
            try {
                const job = await (core as any).agents.lens.sync({ task_id: task?.id });
                const jobId = job?.id;
                notification.success({ message: 'Sync started', description: 'Lens snapshots are synchronizing' });

                // Poll job status until finished or failed
                if (jobId) {
                    const pollIntervalMs = 1500;
                    const maxDurationMs = 5 * 60 * 1000; // 5 minutes safety cap
                    const startedAt = Date.now();
                    if (syncTimerRef.current) {
                        clearInterval(syncTimerRef.current);
                    }
                    syncTimerRef.current = window.setInterval(async () => {
                        try {
                            const statusResp = await (core as any).agents.lens.retrieve(jobId);
                            const status = statusResp?.status;
                            const progress = (statusResp?.progress ?? statusResp?.meta?.progress ?? null);
                            if (typeof progress === 'number') {
                                setSyncProgress(Math.max(0, Math.min(100, progress)));
                            } else {
                                // heuristic progress if not provided
                                const elapsed = Date.now() - startedAt;
                                const approx = Math.min(95, Math.round((elapsed / maxDurationMs) * 95));
                                setSyncProgress(approx);
                            }

                            if (status === 'finished' || status === 'FINISHED') {
                                clearInterval(syncTimerRef.current!);
                                syncTimerRef.current = null;
                                setSyncProgress(100);
                                setSyncState('success');
                                setLastSyncTs(Date.now());
                                // Reset status back to idle after a short delay
                                window.setTimeout(() => setSyncState('idle'), 4000);
                            } else if (status === 'failed' || status === 'FAILED' || status === 'canceled' || status === 'CANCELED') {
                                clearInterval(syncTimerRef.current!);
                                syncTimerRef.current = null;
                                setSyncState('error');
                                notification.error({ message: 'Sync failed', description: statusResp?.exc_info || 'Unknown error' });
                                window.setTimeout(() => setSyncState('idle'), 4000);
                            }

                            // Safety cap
                            if ((Date.now() - startedAt) > maxDurationMs) {
                                clearInterval(syncTimerRef.current!);
                                syncTimerRef.current = null;
                                setSyncState('idle');
                                notification.warning({ message: 'Sync timed out', description: 'Please check server logs or try again.' });
                            }
                        } catch (e) {
                            clearInterval(syncTimerRef.current!);
                            syncTimerRef.current = null;
                            setSyncState('error');
                            notification.error({ message: 'Sync polling failed', description: (e as Error)?.message || String(e) });
                            window.setTimeout(() => setSyncState('idle'), 4000);
                        }
                    }, pollIntervalMs) as unknown as number;
                } else {
                    // No job id returned, fallback to immediate success
                    setSyncProgress(100);
                    setSyncState('success');
                    setLastSyncTs(Date.now());
                    window.setTimeout(() => setSyncState('idle'), 4000);
                }
            } catch (err) {
                setSyncState('error');
                notification.error({
                    message: 'Sync failed',
                    description: (err as Error)?.message || String(err),
                });
                // Reset to idle to allow retry
                window.setTimeout(() => setSyncState('idle'), 4000);
            }
        })();
    };

    const sendMessage = (): void => {
        if (!isAllowed) return;
        const payload = input.trim();
        if (!payload) return;
        setMessages((msgs) => ([
            ...msgs,
            { role: 'user', text: payload, ts: Date.now() },
            { role: 'agent', text: 'Thinking…', ts: Date.now() },
        ]));
        setInput('');

        (async () => {
            try {
                const reply = await (core as any).agents.lens.chat({
                    task_id: task?.id,
                    message: payload,
                });
                // Normalize various potential shapes
                let text: string = '';
                if (reply == null) {
                    text = '';
                } else if (typeof reply === 'string') {
                    // Backend might return JSON-encoded string; try to parse then fallback
                    try {
                        const parsed = JSON.parse(reply);
                        text = typeof parsed === 'string' ? parsed : parsed?.answer || parsed?.message || String(reply);
                    } catch {
                        text = reply;
                    }
                } else if (typeof reply === 'object') {
                    text = reply.answer || reply.message || reply.text || '';
                } else {
                    text = String(reply);
                }

                setMessages((msgs) => {
                    const updated = [...msgs];
                    for (let i = updated.length - 1; i >= 0; i--) {
                        if (updated[i].role === 'agent') {
                            updated[i] = { role: 'agent', text, ts: Date.now() };
                            break;
                        }
                    }
                    return updated;
                });
            } catch (err) {
                setMessages((msgs) => {
                    const updated = [...msgs];
                    for (let i = updated.length - 1; i >= 0; i--) {
                        if (updated[i].role === 'agent') {
                            updated[i] = { role: 'agent', text: 'Error contacting Lens. Please try again.', ts: Date.now() };
                            break;
                        }
                    }
                    return updated;
                });
                notification.error({
                    message: 'Lens chat failed',
                    description: (err as Error)?.message || String(err),
                });
            }
        })();
    };

    const jumpToLatest = () => {
        if (messagesRef.current) {
            messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
        }
        setShowNewMsgToast(false);
    };

    return (
        <div className='cvat-task-lens-tab'>
            <Row gutter={[16, 16]}>
                <Col span={24}>
                    <Card
                        className='cvat-task-lens-card'
                        bordered
                        title={(
                            <Space size={8} align='center'>
                                <RobotOutlined />
                                <span>Lens Assistant</span>
                            </Space>
                        )}
                        extra={isAllowed ? (
                            <Space size={8} align='center'>
                                <Tooltip title={syncState === 'running' ? 'Sync in progress' : 'Update snapshots used by Lens'}>
                                    <Button
                                        type='primary'
                                        icon={<SyncOutlined />}
                                        onClick={startSync}
                                        disabled={!isAllowed || syncState === 'running'}
                                        loading={syncState === 'running'}
                                    >
                                        {syncState === 'running' ? `Syncing ${syncProgress}%` : 'Sync'}
                                    </Button>
                                </Tooltip>
                            </Space>
                        ) : undefined}
                        bodyStyle={{ padding: 12 }}
                    >
                        {isAllowed ? (
                            <>
                                <div ref={messagesRef} className='cvat-task-lens-messages'>
                                    {messages.length === 0 ? (
                                        <div className='cvat-task-lens-empty'>Start chatting with an Agent about this task.</div>
                                    ) : (
                                        messages.map((m, idx) => (
                                            <div key={idx} className={`cvat-task-lens-message ${m.role}`}>
                                                <div className='avatar'>
                                                    {m.role === 'user' ? <UserOutlined /> : <RobotOutlined />}
                                                </div>
                                                <div className='bubble'>
                                                    <SafeMarkdown text={m.text} components={markdownComponents} />
                                                    <div className={`cvat-msg-timestamp ${m.role}`}>{moment(m.ts).format('HH:mm')}</div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                    {showNewMsgToast && (
                                        <div className='cvat-lens-newmsg-toast'>
                                            <span>New messages</span>
                                            <button type='button' onClick={jumpToLatest}>Jump to latest</button>
                                        </div>
                                    )}
                                </div>
                                <div className='cvat-task-lens-input-bar'>
                                    <Input.TextArea
                                        value={input}
                                        onChange={(e) => setInput(e.target.value)}
                                        rows={2}
                                        autoSize={{ minRows: 2, maxRows: 6 }}
                                        placeholder='Ask the Agent about this task...'
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault();
                                                sendMessage();
                                            }
                                        }}
                                        disabled={!isAllowed}
                                    />
                                </div>
                                <Typography.Text type='secondary' className='cvat-task-lens-hint'>
                                    Press Enter to send, Shift+Enter for newline
                                </Typography.Text>
                                {lastSyncTs ? (
                                    <Typography.Text type='secondary' className='cvat-task-lens-hint'>
                                        Last synced {moment(lastSyncTs).fromNow()}
                                    </Typography.Text>
                                ) : (
                                    <Typography.Text type='secondary' className='cvat-task-lens-hint'>
                                        Snapshots may be outdated. Click Sync to update.
                                    </Typography.Text>
                                )}
                            </>
                        ) : (
                            <div ref={messagesRef} className='cvat-task-lens-messages'>
                                <div className='cvat-task-lens-empty'>
                                    Lens chat is restricted to organization supervisors, maintainers, or superusers.
                                </div>
                            </div>
                        )}
                    </Card>
                </Col>
            </Row>
        </div>
    );
}