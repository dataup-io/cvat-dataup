import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { MenuFoldOutlined, MenuUnfoldOutlined } from '@ant-design/icons';
import {
    Layout, Switch, Slider, Typography, Space, Collapse, Button,
    Checkbox
} from 'antd';
import { EyeOutlined, EyeInvisibleOutlined } from '@ant-design/icons';
import './benchmark-visual-sidebar.scss';

const { Text } = Typography;

const MIN_SIDEBAR_WIDTH = 200;
const MAX_SIDEBAR_WIDTH = 600;
const DEFAULT_SIDEBAR_WIDTH = 300;

interface ClassCount {
    label: string;
    count: number;
}

interface ClassMetrics {
    label: string;
    gtCount: number;
    predCount: number;
    fpCount?: number;
    fnCount?: number;
}

type SortKey = 'name' | 'gtCount' | 'predCount' | 'fpCount' | 'fnCount';

interface BenchmarkVisualSidebarProps {
    showGroundTruth: boolean;
    showPredictions: boolean;
    opacity: number;
    onToggleGroundTruth: (checked: boolean) => void;
    onTogglePredictions: (checked: boolean) => void;
    onOpacityChange: (value: number) => void;
    groundTruthCount: number;
    predictionsCount: number;
    groundTruthClassCounts: ClassCount[];
    predictionsClassCounts: ClassCount[];
    hiddenGTClasses: Set<string>;
    hiddenPredClasses: Set<string>;
    onToggleGTClass: (label: string, visible: boolean) => void;
    onTogglePredClass: (label: string, visible: boolean) => void;
    zoomLevel: number;
    onZoomSliderChange: (value: number) => void;
    // New props for benchmark features
    confidenceThreshold?: number;
    onConfidenceThresholdChange?: (value: number) => void;
    classMetrics?: ClassMetrics[]; // Optional FP/FN per class
}

// Helper component for tri-state checkbox
interface TriStateCheckboxProps {
    checked: boolean | 'mixed';
    onChange: (checked: boolean) => void;
    children?: React.ReactNode;
}

function TriStateCheckbox({ checked, onChange, children }: TriStateCheckboxProps): JSX.Element {
    const isIndeterminate = checked === 'mixed';
    const isChecked = checked === true;

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Checkbox
                checked={isChecked}
                indeterminate={isIndeterminate}
                onChange={(e) => onChange(e.target.checked)}
            />
            {children}
        </div>
    );
}

// Clickable cell component for GT/Pred toggles
interface ClickableToggleCellProps {
    visible: boolean;
    count: number;
    color: string;
    onToggle: () => void;
    disabled?: boolean;
}

function ClickableToggleCell({ visible, count, color, onToggle, disabled }: ClickableToggleCellProps): JSX.Element {
    return (
        <div
            onClick={disabled ? undefined : onToggle}
            style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: '6px',
                padding: '4px 8px',
                cursor: disabled ? 'not-allowed' : 'pointer',
                borderRadius: '4px',
                backgroundColor: disabled ? 'transparent' : visible ? `${color}08` : 'transparent',
                transition: 'background-color 0.2s',
                userSelect: 'none',
            }}
            onMouseEnter={(e) => {
                if (!disabled) {
                    e.currentTarget.style.backgroundColor = `${color}15`;
                }
            }}
            onMouseLeave={(e) => {
                if (!disabled) {
                    e.currentTarget.style.backgroundColor = visible ? `${color}08` : 'transparent';
                }
            }}
        >
            <Switch
                size='small'
                checked={visible}
                onChange={onToggle}
                disabled={disabled}
                checkedChildren={<EyeOutlined style={{ fontSize: '10px' }} />}
                unCheckedChildren={<EyeInvisibleOutlined style={{ fontSize: '10px' }} />}
            />
            <Text
                type='secondary'
                style={{
                    fontSize: '11px',
                    color: color,
                    fontWeight: 500,
                    minWidth: '24px',
                    textAlign: 'right',
                    opacity: disabled ? 0.5 : 1,
                }}
            >
                {count}
            </Text>
        </div>
    );
}

function BenchmarkVisualSidebar(props: BenchmarkVisualSidebarProps): JSX.Element {
    const {
        showGroundTruth,
        showPredictions,
        opacity,
        onToggleGroundTruth,
        onTogglePredictions,
        onOpacityChange,
        groundTruthCount,
        predictionsCount,
        groundTruthClassCounts,
        predictionsClassCounts,
        hiddenGTClasses,
        hiddenPredClasses,
        onToggleGTClass,
        onTogglePredClass,
        zoomLevel,
        onZoomSliderChange,
        confidenceThreshold = 0.5,
        onConfidenceThresholdChange,
        classMetrics,
    } = props;

    const [collapsed, setCollapsed] = useState(false);
    const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH);
    const [isResizing, setIsResizing] = useState(false);
    const [appearanceCollapsed, setAppearanceCollapsed] = useState(false);
    const [shapesCollapsed, setShapesCollapsed] = useState(false);
    const [frameMetricsCollapsed, setFrameMetricsCollapsed] = useState(false);
    const [sortKey] = useState<SortKey>('name');
    const sidebarRef = useRef<HTMLDivElement>(null);
    const resizeHandleRef = useRef<HTMLDivElement>(null);

    // Mock frame metrics data
    const frameMetrics = {
        precision: 0.87,
        recall: 0.82,
        f1Score: 0.84,
        mAP: 0.79,
        truePositives: 45,
        falsePositives: 7,
        falseNegatives: 10,
    };

    // Calculate tri-state for global toggles
    const gtTriState = useMemo(() => {
        if (groundTruthClassCounts.length === 0) return false;
        const visibleCount = groundTruthClassCounts.filter(
            (c) => !hiddenGTClasses.has(c.label)
        ).length;
        if (visibleCount === 0) return false;
        if (visibleCount === groundTruthClassCounts.length) return true;
        return 'mixed' as const;
    }, [groundTruthClassCounts, hiddenGTClasses]);

    const predTriState = useMemo(() => {
        if (predictionsClassCounts.length === 0) return false;
        const visibleCount = predictionsClassCounts.filter(
            (c) => !hiddenPredClasses.has(c.label)
        ).length;
        if (visibleCount === 0) return false;
        if (visibleCount === predictionsClassCounts.length) return true;
        return 'mixed' as const;
    }, [predictionsClassCounts, hiddenPredClasses]);

    // Merge class counts with metrics
    const mergedClassData = useMemo(() => {
        const allClasses = new Set<string>();
        groundTruthClassCounts.forEach((c) => allClasses.add(c.label));
        predictionsClassCounts.forEach((c) => allClasses.add(c.label));
        if (classMetrics) {
            classMetrics.forEach((m) => allClasses.add(m.label));
        }

        const gtCountMap = new Map(groundTruthClassCounts.map((c) => [c.label, c.count]));
        const predCountMap = new Map(predictionsClassCounts.map((c) => [c.label, c.count]));

        return Array.from(allClasses).map((label) => ({
            label,
            gtCount: gtCountMap.get(label) || 0,
            predCount: predCountMap.get(label) || 0,
            fpCount: classMetrics?.find((m) => m.label === label)?.fpCount,
            fnCount: classMetrics?.find((m) => m.label === label)?.fnCount,
        }));
    }, [groundTruthClassCounts, predictionsClassCounts, classMetrics]);

    // Sort classes
    const sortedClasses = useMemo(() => {
        return [...mergedClassData].sort((a, b) => {
            switch (sortKey) {
                case 'name':
                    return a.label.localeCompare(b.label);
                case 'gtCount':
                    return b.gtCount - a.gtCount;
                case 'predCount':
                    return b.predCount - a.predCount;
                case 'fpCount':
                    return (b.fpCount || 0) - (a.fpCount || 0);
                case 'fnCount':
                    return (b.fnCount || 0) - (a.fnCount || 0);
                default:
                    return 0;
            }
        });
    }, [mergedClassData, sortKey]);

    // Batch action handlers
    const handleShowOnlyErrors = useCallback(() => {
        // First hide all
        sortedClasses.forEach((c) => {
            if (c.gtCount > 0) onToggleGTClass(c.label, false);
            if (c.predCount > 0) onTogglePredClass(c.label, false);
        });
        // Then show only classes with errors
        sortedClasses.forEach((c) => {
            const hasErrors = (c.fpCount && c.fpCount > 0) || (c.fnCount && c.fnCount > 0);
            if (hasErrors) {
                if (c.gtCount > 0) onToggleGTClass(c.label, true);
                if (c.predCount > 0) onTogglePredClass(c.label, true);
            }
        });
    }, [sortedClasses, onToggleGTClass, onTogglePredClass]);

    const handleShowOnlyPresent = useCallback(() => {
        sortedClasses.forEach((c) => {
            const isPresent = c.gtCount > 0 || c.predCount > 0;
            if (isPresent) {
                if (c.gtCount > 0) onToggleGTClass(c.label, true);
                if (c.predCount > 0) onTogglePredClass(c.label, true);
            } else {
                if (c.gtCount > 0) onToggleGTClass(c.label, false);
                if (c.predCount > 0) onTogglePredClass(c.label, false);
            }
        });
    }, [sortedClasses, onToggleGTClass, onTogglePredClass]);

    const collapse = (): void => {
        const [collapser] = window.document.getElementsByClassName('cvat-benchmark-visual-sidebar');
        const listener = (event: TransitionEvent): void => {
            if (event.target && event.propertyName === 'width' && event.target === collapser) {
                window.dispatchEvent(new Event('resize'));
                (collapser as HTMLElement).removeEventListener('transitionend', listener as any);
            }
        };

        if (collapser) {
            (collapser as HTMLElement).addEventListener('transitionend', listener as any);
        }

        setCollapsed(!collapsed);
    };

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsResizing(true);
    }, []);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isResizing || collapsed) return;

            const newWidth = e.clientX;
            const clampedWidth = Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, newWidth));
            setSidebarWidth(clampedWidth);
        };

        const handleMouseUp = () => {
            setIsResizing(false);
        };

        if (isResizing) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };
    }, [isResizing, collapsed]);

    // Handle tri-state toggle clicks
    const handleGTTriStateToggle = useCallback((checked: boolean) => {
        if (gtTriState === 'mixed' || !checked) {
            // Show all GT classes
            groundTruthClassCounts.forEach((c) => {
                if (hiddenGTClasses.has(c.label)) {
                    onToggleGTClass(c.label, true);
                }
            });
        } else {
            // Hide all GT classes
            groundTruthClassCounts.forEach((c) => {
                if (!hiddenGTClasses.has(c.label)) {
                    onToggleGTClass(c.label, false);
                }
            });
        }
    }, [gtTriState, groundTruthClassCounts, hiddenGTClasses, onToggleGTClass]);

    const handlePredTriStateToggle = useCallback((checked: boolean) => {
        if (predTriState === 'mixed' || !checked) {
            // Show all Pred classes
            predictionsClassCounts.forEach((c) => {
                if (hiddenPredClasses.has(c.label)) {
                    onTogglePredClass(c.label, true);
                }
            });
        } else {
            // Hide all Pred classes
            predictionsClassCounts.forEach((c) => {
                if (!hiddenPredClasses.has(c.label)) {
                    onTogglePredClass(c.label, false);
                }
            });
        }
    }, [predTriState, predictionsClassCounts, hiddenPredClasses, onTogglePredClass]);

    return (
        <div
            ref={sidebarRef}
            className='cvat-benchmark-visual-sidebar-wrapper'
            style={{ position: 'relative', height: '100%' }}
        >
            <Layout.Sider
                className='cvat-benchmark-visual-sidebar'
                theme='light'
                width={collapsed ? 44 : sidebarWidth}
                collapsedWidth={44}
                collapsible
                trigger={null}
                collapsed={collapsed}
            >
            {!collapsed && (
                <div className='cvat-benchmark-visual-sidebar-content-wrapper'>
                    <div className='cvat-benchmark-visual-sidebar-content'>
                        {/* Shapes Section */}
                        <Collapse
                            onChange={() => setShapesCollapsed(!shapesCollapsed)}
                            activeKey={shapesCollapsed ? [] : ['shapes']}
                            className='cvat-benchmark-shapes-collapse'
                            items={[{
                                label: (
                                    <Text strong className='cvat-benchmark-shapes-collapse-header'>
                                        Shapes
                                    </Text>
                                ),
                                key: 'shapes',
                                children: (
                                    <div className='cvat-benchmark-shapes-content'>
                                        {/* Header + Global Controls */}
                                        <div style={{ marginBottom: '16px' }}>
                                            {/* Global Visibility Toggles */}
                                            <Space direction='vertical' size='middle' style={{ width: '100%' }}>
                                                <div style={{
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center',
                                                    width: '100%'
                                                }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                                                        <span style={{ color: '#52c41a', fontSize: '12px', fontWeight: 'bold', marginRight: '8px' }}>●</span>
                                                        <Text strong style={{ fontSize: '13px' }}>Ground Truth</Text>
                                                    </div>
                                                    <div style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'flex-end',
                                                        flexShrink: 0,
                                                        gap: '10px'
                                                    }}>
                                                        <Text type='secondary' style={{ fontSize: '11px' }}>
                                                            Total {groundTruthCount}
                                                        </Text>
                                                        <TriStateCheckbox
                                                            checked={gtTriState}
                                                            onChange={handleGTTriStateToggle}
                                                        />
                                                        <Switch
                                                            checked={showGroundTruth}
                                                            onChange={onToggleGroundTruth}
                                                            checkedChildren={<EyeOutlined />}
                                                            unCheckedChildren={<EyeInvisibleOutlined />}
                                                        />
                                                    </div>
                                                </div>
                                                <div style={{
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center',
                                                    width: '100%'
                                                }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                                                        <span style={{ color: '#1890ff', fontSize: '12px', fontWeight: 'bold', marginRight: '8px' }}>●</span>
                                                        <Text strong style={{ fontSize: '13px' }}>Predictions</Text>
                                                    </div>
                                                    <div style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'flex-end',
                                                        flexShrink: 0,
                                                        gap: '10px'
                                                    }}>
                                                        <Text type='secondary' style={{ fontSize: '11px' }}>
                                                            Total {predictionsCount}
                                                        </Text>
                                                        <TriStateCheckbox
                                                            checked={predTriState}
                                                            onChange={handlePredTriStateToggle}
                                                        />
                                                        <Switch
                                                            checked={showPredictions}
                                                            onChange={onTogglePredictions}
                                                            checkedChildren={<EyeOutlined />}
                                                            unCheckedChildren={<EyeInvisibleOutlined />}
                                                        />
                                                    </div>
                                                </div>
                                            </Space>

                                            {/* Benchmark Filters */}
                                            {onConfidenceThresholdChange && (
                                                <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #f0f0f0' }}>
                                                    <Text type='secondary' style={{ fontSize: '11px', display: 'block', marginBottom: '8px' }}>
                                                        Filters
                                                    </Text>
                                                    <div>
                                                        <div style={{
                                                            display: 'flex',
                                                            justifyContent: 'space-between',
                                                            alignItems: 'center',
                                                            width: '100%',
                                                            marginBottom: '4px'
                                                        }}>
                                                            <Text style={{ fontSize: '11px', flex: 1 }}>Confidence</Text>
                                                            <Text style={{
                                                                fontSize: '11px',
                                                                fontWeight: 500,
                                                                flexShrink: 0
                                                            }}>
                                                                ≥ {(confidenceThreshold * 100).toFixed(0)}%
                                                            </Text>
                                                        </div>
                                                        <Slider
                                                            min={0}
                                                            max={100}
                                                            value={confidenceThreshold * 100}
                                                            onChange={(value) => onConfidenceThresholdChange(value / 100)}
                                                            tooltip={{ formatter: (value) => `≥ ${value}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Class List Utilities */}
                                        {classMetrics && (
                                            <div style={{ marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid #f0f0f0' }}>
                                                {/* Batch Actions */}
                                                <Space size='small' wrap style={{ width: '100%' }}>
                                                    <Button
                                                        size='small'
                                                        type='link'
                                                        onClick={handleShowOnlyErrors}
                                                        style={{ fontSize: '10px', padding: '0 4px' }}
                                                    >
                                                        Errors Only
                                                    </Button>
                                                    <Button
                                                        size='small'
                                                        type='link'
                                                        onClick={handleShowOnlyPresent}
                                                        style={{ fontSize: '10px', padding: '0 4px' }}
                                                    >
                                                        Present Only
                                                    </Button>
                                                </Space>
                                            </div>
                                        )}

                                        {/* By-Class Table */}
                                        <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                                                <thead>
                                                    <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
                                                        <th style={{ textAlign: 'left', padding: '6px 4px', fontWeight: 600, fontSize: '10px', color: '#8c8c8c' }}>
                                                            Class
                                                        </th>
                                                        <th style={{ textAlign: 'right', padding: '6px 4px', fontWeight: 600, fontSize: '10px', color: '#8c8c8c' }}>
                                                            GT ●
                                                        </th>
                                                        <th style={{ textAlign: 'right', padding: '6px 4px', fontWeight: 600, fontSize: '10px', color: '#8c8c8c' }}>
                                                            Pred ●
                                                        </th>
                                                        {classMetrics && (
                                                            <>
                                                                <th style={{ textAlign: 'right', padding: '6px 4px', fontWeight: 600, fontSize: '10px', color: '#8c8c8c' }}>
                                                                    FP
                                                                </th>
                                                                <th style={{ textAlign: 'right', padding: '6px 4px', fontWeight: 600, fontSize: '10px', color: '#8c8c8c' }}>
                                                                    FN
                                                                </th>
                                                            </>
                                                        )}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {sortedClasses.map((classData) => {
                                                        const gtVisible = !hiddenGTClasses.has(classData.label) && showGroundTruth;
                                                        const predVisible = !hiddenPredClasses.has(classData.label) && showPredictions;

                                                        return (
                                                            <tr
                                                                key={classData.label}
                                                                style={{
                                                                    borderBottom: '1px solid #fafafa',
                                                                    opacity: (gtVisible && classData.gtCount > 0) || (predVisible && classData.predCount > 0) ? 1 : 0.5,
                                                                }}
                                                            >
                                                                <td style={{ padding: '6px 4px', fontWeight: 500 }}>
                                                                    {classData.label}
                                                                </td>
                                                                <td style={{ padding: '2px', textAlign: 'right' }}>
                                                                    {classData.gtCount > 0 ? (
                                                                        <ClickableToggleCell
                                                                            visible={gtVisible}
                                                                            count={classData.gtCount}
                                                                            color='#52c41a'
                                                                            onToggle={() => onToggleGTClass(classData.label, !gtVisible)}
                                                                            disabled={!showGroundTruth}
                                                                        />
                                                                    ) : (
                                                                        <Text type='secondary' style={{ fontSize: '11px', padding: '4px 8px' }}>
                                                                            -
                                                                        </Text>
                                                                    )}
                                                                </td>
                                                                <td style={{ padding: '2px', textAlign: 'right' }}>
                                                                    {classData.predCount > 0 ? (
                                                                        <ClickableToggleCell
                                                                            visible={predVisible}
                                                                            count={classData.predCount}
                                                                            color='#1890ff'
                                                                            onToggle={() => onTogglePredClass(classData.label, !predVisible)}
                                                                            disabled={!showPredictions}
                                                                        />
                                                                    ) : (
                                                                        <Text type='secondary' style={{ fontSize: '11px', padding: '4px 8px' }}>
                                                                            -
                                                                        </Text>
                                                                    )}
                                                                </td>
                                                                {classMetrics && (
                                                                    <>
                                                                        <td style={{ padding: '6px 4px', textAlign: 'right' }}>
                                                                            <Text
                                                                                type='secondary'
                                                                                style={{
                                                                                    fontSize: '11px',
                                                                                    color: classData.fpCount && classData.fpCount > 0 ? '#ff4d4f' : undefined,
                                                                                }}
                                                                            >
                                                                                {classData.fpCount !== undefined ? classData.fpCount : '-'}
                                                                            </Text>
                                                                        </td>
                                                                        <td style={{ padding: '6px 4px', textAlign: 'right' }}>
                                                                            <Text
                                                                                type='secondary'
                                                                                style={{
                                                                                    fontSize: '11px',
                                                                                    color: classData.fnCount && classData.fnCount > 0 ? '#faad14' : undefined,
                                                                                }}
                                                                            >
                                                                                {classData.fnCount !== undefined ? classData.fnCount : '-'}
                                                                            </Text>
                                                                        </td>
                                                                    </>
                                                )}
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                ),
                            }]}
                        />

                        {/* Frame Metrics Section */}
                        <Collapse
                            onChange={() => setFrameMetricsCollapsed(!frameMetricsCollapsed)}
                            activeKey={frameMetricsCollapsed ? [] : ['frameMetrics']}
                            className='cvat-benchmark-frame-metrics-collapse'
                            items={[{
                                label: (
                                    <Text strong className='cvat-benchmark-frame-metrics-collapse-header'>
                                        Frame Metrics
                                    </Text>
                                ),
                                key: 'frameMetrics',
                                children: (
                                    <div className='cvat-benchmark-frame-metrics-content'>
                                        <div className='cvat-benchmark-metric-item'>
                                            <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                                                <Text type='secondary' style={{ fontSize: '12px' }}>Precision</Text>
                                                <Text strong style={{ fontSize: '12px' }}>
                                                    {(frameMetrics.precision * 100).toFixed(1)}%
                                                </Text>
                                            </Space>
                                        </div>
                                        <div className='cvat-benchmark-metric-item'>
                                            <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                                                <Text type='secondary' style={{ fontSize: '12px' }}>Recall</Text>
                                                <Text strong style={{ fontSize: '12px' }}>
                                                    {(frameMetrics.recall * 100).toFixed(1)}%
                                                </Text>
                                            </Space>
                                        </div>
                                        <div className='cvat-benchmark-metric-item'>
                                            <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                                                <Text type='secondary' style={{ fontSize: '12px' }}>F1 Score</Text>
                                                <Text strong style={{ fontSize: '12px' }}>
                                                    {(frameMetrics.f1Score * 100).toFixed(1)}%
                                                </Text>
                                            </Space>
                                        </div>
                                        <div className='cvat-benchmark-metric-item'>
                                            <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                                                <Text type='secondary' style={{ fontSize: '12px' }}>mAP</Text>
                                                <Text strong style={{ fontSize: '12px' }}>
                                                    {(frameMetrics.mAP * 100).toFixed(1)}%
                                                </Text>
                                            </Space>
                                        </div>
                                        <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #f0f0f0' }}>
                                            <Text type='secondary' style={{ fontSize: '11px', display: 'block', marginBottom: '8px' }}>
                                                Detection Counts
                                            </Text>
                                            <div className='cvat-benchmark-metric-item'>
                                                <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                                                    <Space>
                                                        <span style={{ color: '#52c41a', fontSize: '12px', fontWeight: 'bold' }}>●</span>
                                                        <Text type='secondary' style={{ fontSize: '12px' }}>Ground Truth</Text>
                                                    </Space>
                                                    <Text strong style={{ fontSize: '12px', color: '#52c41a' }}>
                                                        {groundTruthCount}
                                                    </Text>
                                                </Space>
                                            </div>
                                            <div className='cvat-benchmark-metric-item'>
                                                <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                                                    <Space>
                                                        <span style={{ color: '#1890ff', fontSize: '12px', fontWeight: 'bold' }}>●</span>
                                                        <Text type='secondary' style={{ fontSize: '12px' }}>Predictions</Text>
                                                    </Space>
                                                    <Text strong style={{ fontSize: '12px', color: '#1890ff' }}>
                                                        {predictionsCount}
                                                    </Text>
                                                </Space>
                                            </div>
                                            <div className='cvat-benchmark-metric-item'>
                                                <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                                                    <Text type='secondary' style={{ fontSize: '12px' }}>True Positives</Text>
                                                    <Text strong style={{ fontSize: '12px', color: '#52c41a' }}>
                                                        {frameMetrics.truePositives}
                                                    </Text>
                                                </Space>
                                            </div>
                                            <div className='cvat-benchmark-metric-item'>
                                                <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                                                    <Text type='secondary' style={{ fontSize: '12px' }}>False Positives</Text>
                                                    <Text strong style={{ fontSize: '12px', color: '#ff4d4f' }}>
                                                        {frameMetrics.falsePositives}
                                                    </Text>
                                                </Space>
                                            </div>
                                            <div className='cvat-benchmark-metric-item'>
                                                <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                                                    <Text type='secondary' style={{ fontSize: '12px' }}>False Negatives</Text>
                                                    <Text strong style={{ fontSize: '12px', color: '#faad14' }}>
                                                        {frameMetrics.falseNegatives}
                                                    </Text>
                                                </Space>
                                            </div>
                                        </div>
                                    </div>
                                ),
                            }]}
                        />

                        {/* Appearance Section */}
                        <Collapse
                            onChange={() => setAppearanceCollapsed(!appearanceCollapsed)}
                            activeKey={appearanceCollapsed ? [] : ['appearance']}
                            className='cvat-benchmark-appearance-collapse'
                            items={[{
                                label: (
                                    <Text strong className='cvat-benchmark-appearance-collapse-header'>
                                        Appearance
                                    </Text>
                                ),
                                key: 'appearance',
                                children: (
                                    <div className='cvat-benchmark-appearance-content'>
                                        <div style={{ marginBottom: '16px' }}>
                                            <Text type='secondary' style={{ fontSize: '11px', display: 'block', marginBottom: '8px' }}>
                                                Opacity
                                            </Text>
                                            <Slider
                                                min={0}
                                                max={100}
                                                value={opacity}
                                                onChange={onOpacityChange}
                                                tooltip={{ formatter: (value) => `${value}%` }}
                                            />
                                        </div>
                                        <div>
                                            <Text type='secondary' style={{ fontSize: '11px', display: 'block', marginBottom: '8px' }}>
                                                Zoom
                                            </Text>
                                            <Slider
                                                className='cvat-benchmark-opacity-slider'
                                                min={10}
                                                max={500}
                                                value={zoomLevel * 100}
                                                onChange={onZoomSliderChange}
                                                tooltip={{ formatter: (value) => `${value}%` }}
                                            />
                                        </div>
                                    </div>
                                ),
                            }]}
                        />
                    </div>

                    {/* Collapse button at bottom center */}
                    <div className='cvat-benchmark-visual-sidebar-collapse-button-bottom'>
                        <span onClick={collapse} style={{ cursor: 'pointer', padding: '8px' }}>
                            <MenuFoldOutlined title='Hide' />
                        </span>
                    </div>
                </div>
            )}
            {collapsed && (
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    padding: '8px',
                    cursor: 'pointer'
                }} onClick={collapse}>
                    <MenuUnfoldOutlined title='Show' style={{ fontSize: '16px' }} />
                </div>
            )}
            </Layout.Sider>
            {!collapsed && (
                <div
                    ref={resizeHandleRef}
                    className='cvat-benchmark-visual-sidebar-resize-handle'
                    onMouseDown={handleMouseDown}
                    style={{
                        position: 'absolute',
                        top: 0,
                        right: 0,
                        width: '4px',
                        height: '100%',
                        cursor: 'col-resize',
                        zIndex: 10,
                        backgroundColor: 'transparent',
                    }}
                />
            )}
        </div>
    );
}

export default BenchmarkVisualSidebar;
