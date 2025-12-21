import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Button, Space, Spin, InputNumber, Typography, Layout } from 'antd';
import { LeftOutlined, RightOutlined, CompressOutlined } from '@ant-design/icons';
import { getCore } from 'cvat-core-wrapper';
import { fabric } from 'fabric';
import BenchmarkVisualSidebar from './benchmark-visual-sidebar';
import './benchmark-image-overlay-viewer.scss';

const { Text } = Typography;

interface Prediction {
    frame_id: number;
    label: string;
    xyxy: [number, number, number, number]; // [x1, y1, x2, y2]
    confidence?: number;
}

interface GroundTruthAnnotation {
    id: number;
    label: { id: number; name: string };
    shape: {
        type: string;
        points: number[];
    };
    frame: number;
}

interface BackendPrediction {
    frame_id: number;
    job_id?: number;
    false_positives?: number;
    false_negatives?: number;
    true_positives?: number;
    precision?: number;
    recall?: number;
    f1?: number;
}

interface BenchmarkImageOverlayViewerProps {
    benchmarkId: string;
    taskId: number;
    jobId?: number; // Optional: if provided, only show frames from this job
    predictions?: Prediction[];
    backendPredictions?: BackendPrediction[];
}

// Convert CVAT annotation to bounding box format
function annotationToBbox(annotation: any): [number, number, number, number] | null {
    // CVAT annotations might be ObjectState objects with different structure
    // Try multiple formats

    // Format 1: annotation.shape.points (our expected format)
    if (annotation.shape && annotation.shape.points) {
        const points = annotation.shape.points;

        // Handle rectangle format: [x1, y1, x2, y2]
        if (annotation.shape.type === 'rectangle' && points.length === 4) {
            return [points[0], points[1], points[2], points[3]];
        }

        // Handle polygon/points: calculate bounding box
        if (points.length >= 4) {
            const xCoords = points.filter((_, i) => i % 2 === 0);
            const yCoords = points.filter((_, i) => i % 2 === 1);

            const x1 = Math.min(...xCoords);
            const y1 = Math.min(...yCoords);
            const x2 = Math.max(...xCoords);
            const y2 = Math.max(...yCoords);

            return [x1, y1, x2, y2];
        }
    }

    // Format 2: annotation.points (direct points array)
    if (annotation.points && Array.isArray(annotation.points)) {
        const points = annotation.points;
        if (points.length >= 4) {
            const xCoords = points.filter((_, i) => i % 2 === 0);
            const yCoords = points.filter((_, i) => i % 2 === 1);

            const x1 = Math.min(...xCoords);
            const y1 = Math.min(...yCoords);
            const x2 = Math.max(...xCoords);
            const y2 = Math.max(...yCoords);

            return [x1, y1, x2, y2];
        }
    }

    // Format 3: ObjectState with points property
    if (annotation.points && typeof annotation.points === 'object') {
        // Might be a Points object with get() method
        const points = annotation.points;
        if (points.length >= 4) {
            const xCoords = points.filter((_, i) => i % 2 === 0);
            const yCoords = points.filter((_, i) => i % 2 === 1);

            const x1 = Math.min(...xCoords);
            const y1 = Math.min(...yCoords);
            const x2 = Math.max(...xCoords);
            const y2 = Math.max(...yCoords);

            return [x1, y1, x2, y2];
        }
    }

    return null;
}

// Create a Fabric.js rectangle with label for bounding box
function createBoundingBoxRect(
    bbox: [number, number, number, number],
    color: string,
    label: string,
    confidence?: number,
    fillOpacity: number = 0.3
): fabric.Group {
    const [x1, y1, x2, y2] = bbox;
    const width = x2 - x1;
    const height = y2 - y1;

    // Convert hex color to rgba for fill with opacity
    const hexToRgba = (hex: string, alpha: number): string => {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    };

    // Create filled rectangle with semi-transparent fill (like CVAT annotation canvas)
    const rect = new fabric.Rect({
        left: x1,
        top: y1,
        width,
        height,
        fill: hexToRgba(color, fillOpacity), // Fill with semi-transparent color
        fillRule: 'nonzero',
        stroke: color, // Stroke remains fully opaque
        strokeWidth: 2,
        opacity: 1, // Overall opacity stays at 1, fill opacity is controlled via rgba
        selectable: false,
        evented: false,
    });

    // Add label text
    const labelText = confidence ? `${label} (${(confidence * 100).toFixed(0)}%)` : label;
    const text = new fabric.Text(labelText, {
        left: x1,
        top: y1 - 16,
        fontSize: 12,
        fontFamily: 'Arial',
        fill: 'white',
        backgroundColor: color,
        selectable: false,
        evented: false,
    });

    // Create a group with rect and text
    const group = new fabric.Group([rect, text], {
        selectable: false,
        evented: false,
    });

    return group;
}

function BenchmarkImageOverlayViewer(props: BenchmarkImageOverlayViewerProps): JSX.Element {
    const { benchmarkId, taskId, jobId, predictions: propPredictions, backendPredictions = [] } = props;
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const fabricCanvasRef = useRef<fabric.Canvas | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [currentFrame, setCurrentFrame] = useState<number>(0);
    const [totalFrames, setTotalFrames] = useState<number>(0);
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [groundTruthAnnotations, setGroundTruthAnnotations] = useState<GroundTruthAnnotation[]>([]);
    const [predictions, setPredictions] = useState<Prediction[]>([]);
    const [showGroundTruth, setShowGroundTruth] = useState<boolean>(true);
    const [showPredictions, setShowPredictions] = useState<boolean>(true);
    const [hiddenGTClasses, setHiddenGTClasses] = useState<Set<string>>(new Set());
    const [hiddenPredClasses, setHiddenPredClasses] = useState<Set<string>>(new Set());
    const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);
    const [frameNumbersList, setFrameNumbersList] = useState<number[]>([]);
    const [zoomLevel, setZoomLevel] = useState<number>(1);
    const [shapeFillOpacity, setShapeFillOpacity] = useState<number>(30); // 0-100, default 30% fill opacity (like CVAT)
    const [confidenceThreshold, setConfidenceThreshold] = useState<number>(0.5);

    const core = getCore();

    // Initialize Fabric.js canvas - use ref callback to ensure stable DOM
    const canvasRefCallback = React.useCallback((node: HTMLCanvasElement | null) => {
        // Cleanup previous canvas
        if (fabricCanvasRef.current) {
            try {
                fabricCanvasRef.current.dispose();
            } catch (e) {
                // Ignore disposal errors
            }
            fabricCanvasRef.current = null;
        }

        if (!node) {
            return;
        }

        // Small delay to ensure DOM is fully ready
        const initCanvas = () => {
            try {
                // Create Fabric.js canvas
                const fabricCanvas = new fabric.Canvas(node, {
                    selection: false,
                    preserveObjectStacking: true,
                    renderOnAddRemove: true,
                });

                // Enable mouse wheel zoom
                fabricCanvas.on('mouse:wheel', (opt) => {
                    const delta = opt.e.deltaY;
                    let zoom = fabricCanvas.getZoom();
                    zoom *= 0.999 ** delta;

                    // Limit zoom between 0.1 and 5
                    zoom = Math.max(0.1, Math.min(5, zoom));

                    const point = new fabric.Point(opt.e.offsetX, opt.e.offsetY);
                    fabricCanvas.zoomToPoint(point, zoom);
                    setZoomLevel(zoom);
                    opt.e.preventDefault();
                    opt.e.stopPropagation();
                });

                // Enable pan with left mouse button drag (or middle mouse button / Ctrl+drag)
                let isPanning = false;
                let lastPosX = 0;
                let lastPosY = 0;

                fabricCanvas.on('mouse:down', (opt) => {
                    // Allow pan with:
                    // 1. Middle mouse button
                    // 2. Ctrl/Cmd + left mouse button
                    // 3. Left mouse button (when clicking on empty space/background)
                    const isMiddleButton = opt.e.button === 1;
                    const isCtrlOrCmd = opt.e.ctrlKey || opt.e.metaKey;
                    const isLeftButton = opt.e.button === 0 || opt.e.button === undefined;

                    // Check if clicking on an object (bounding boxes are not selectable, so we can pan)
                    // Only pan if clicking on background/empty space or using modifier keys
                    const target = opt.target;
                    const isEmptyClick = !target || target === fabricCanvas.backgroundImage;

                    if (isMiddleButton || isCtrlOrCmd || (isLeftButton && isEmptyClick)) {
                        isPanning = true;
                        fabricCanvas.selection = false;
                        lastPosX = opt.e.clientX;
                        lastPosY = opt.e.clientY;
                        opt.e.preventDefault();
                        opt.e.stopPropagation();
                    }
                });

                fabricCanvas.on('mouse:move', (opt) => {
                    if (isPanning) {
                        const e = opt.e;
                        const vpt = fabricCanvas.viewportTransform;
                        if (vpt) {
                            vpt[4] += e.clientX - lastPosX;
                            vpt[5] += e.clientY - lastPosY;
                            fabricCanvas.requestRenderAll();
                            lastPosX = e.clientX;
                            lastPosY = e.clientY;
                        }
                        opt.e.preventDefault();
                        opt.e.stopPropagation();
                    }
                });

                fabricCanvas.on('mouse:up', (opt) => {
                    if (isPanning) {
                        isPanning = false;
                        fabricCanvas.selection = false;
                        opt.e.preventDefault();
                        opt.e.stopPropagation();
                    }
                });

                fabricCanvasRef.current = fabricCanvas;
            } catch (error) {
                // Silently handle initialization errors
            }
        };

        // Use requestAnimationFrame to ensure DOM is ready
        requestAnimationFrame(initCanvas);
    }, []);

    // Fetch task and frame information
    useEffect(() => {
        let mounted = true;

        const loadTaskData = async () => {
            try {
                setLoading(true);
                setError(null);

                let frameNumbers: number[] = [];

                if (jobId) {
                    // If jobId is provided, get frames only from that job
                    const [job] = await core.jobs.get({ jobID: jobId });

                    // Use startFrame and stopFrame to calculate frame range
                    if (typeof job.startFrame === 'number' && typeof job.stopFrame === 'number') {
                        frameNumbers = Array.from({ length: job.stopFrame - job.startFrame + 1 }, (_, i) => job.startFrame + i);
                    } else if (job.size) {
                        // Fallback to size if startFrame/stopFrame not available
                        frameNumbers = Array.from({ length: job.size }, (_, i) => i);
                    } else {
                        // Last resort: try frameNumbers() API
                        try {
                            frameNumbers = await job.frames.frameNumbers();
                        } catch (e) {
                            // Ignore error
                        }
                    }
                } else {
                    // Otherwise, get all frames from the task
                    const [task] = await core.tasks.get({ id: taskId });

                    // Use task size to calculate frame range
                    if (task.size) {
                        frameNumbers = Array.from({ length: task.size }, (_, i) => i);
                    } else {
                        // Fallback: try frameNumbers() API
                        try {
                            frameNumbers = await task.frames.frameNumbers();
                        } catch (e) {
                            // Ignore error
                        }
                    }
                }

                if (!mounted) return;
                setTotalFrames(frameNumbers.length);
                setFrameNumbersList(frameNumbers);
                if (frameNumbers.length > 0) {
                    setCurrentFrame(0);
                } else {
                    if (mounted) {
                        setError('No frames found');
                    }
                }
            } catch (err) {
                if (mounted) {
                    setError(`Failed to load ${jobId ? 'job' : 'task'}: ${err instanceof Error ? err.message : 'Unknown error'}`);
                }
            } finally {
                if (mounted) {
                    setLoading(false);
                }
            }
        };

        loadTaskData();

        return () => {
            mounted = false;
        };
    }, [taskId, jobId, core]);

    // Load frame data when currentFrame changes
    useEffect(() => {
        let mounted = true;
        let imageUrlToRevoke: string | null = null;

        const loadFrame = async () => {
            try {
                setLoading(true);
                setError(null);
                // Reset image state when loading new frame
                setImageUrl(null);
                setImageDimensions(null);
                setPredictions([]);
                setGroundTruthAnnotations([]);

                // Clear Fabric canvas
                if (fabricCanvasRef.current) {
                    fabricCanvasRef.current.clear();
                }

                let frameData: any;
                let frameNumber: number;

                const frameNumbers = frameNumbersList.length > 0 ? frameNumbersList : [];

                if (frameNumbers.length === 0) {
                    if (mounted) {
                        setLoading(false);
                    }
                    return;
                }

                if (currentFrame < 0 || currentFrame >= frameNumbers.length) {
                    if (mounted) {
                        setLoading(false);
                    }
                    return;
                }

                frameNumber = frameNumbers[currentFrame];

                if (jobId) {
                    const [job] = await core.jobs.get({ jobID: jobId });
                    frameData = await job.frames.get(frameNumber);
                } else {
                    const [task] = await core.tasks.get({ id: taskId });
                    frameData = await task.frames.get(frameNumber);
                }
                const imageData = await frameData.data();

                // CVAT returns an object with ImageBitmap: {renderWidth, renderHeight, imageData: ImageBitmap}
                let imageBitmap: ImageBitmap | null = null;
                let width: number;
                let height: number;

                if (imageData && typeof imageData === 'object') {
                    if ('imageData' in imageData && imageData.imageData instanceof ImageBitmap) {
                        imageBitmap = imageData.imageData;
                        width = imageData.renderWidth || imageBitmap.width;
                        height = imageData.renderHeight || imageBitmap.height;
                    } else if (imageData instanceof ImageBitmap) {
                        imageBitmap = imageData;
                        width = imageBitmap.width;
                        height = imageBitmap.height;
                    }
                }

                if (imageBitmap) {
                    if (imageUrlToRevoke) {
                        URL.revokeObjectURL(imageUrlToRevoke);
                    }

                    const tempCanvas = document.createElement('canvas');
                    tempCanvas.width = width;
                    tempCanvas.height = height;
                    const tempCtx = tempCanvas.getContext('2d');
                    if (tempCtx) {
                        tempCtx.drawImage(imageBitmap, 0, 0);
                        tempCanvas.toBlob((blob) => {
                            if (!mounted) return;

                            if (blob) {
                                const url = URL.createObjectURL(blob);
                                imageUrlToRevoke = url;
                                setImageUrl(url);
                                setImageDimensions({ width, height });
                            } else {
                                if (mounted) {
                                    setError('Failed to process image');
                                }
                            }
                        }, 'image/jpeg');
                    } else {
                        if (mounted) {
                            setError('Failed to process image');
                        }
                    }
                } else {
                    if (imageUrlToRevoke) {
                        URL.revokeObjectURL(imageUrlToRevoke);
                    }

                    let blob: Blob;
                    if (imageData instanceof Blob) {
                        blob = imageData;
                    } else if (imageData instanceof ArrayBuffer) {
                        blob = new Blob([imageData], { type: 'image/jpeg' });
                    } else if (imageData instanceof Uint8Array) {
                        blob = new Blob([imageData], { type: 'image/jpeg' });
                    } else {
                        if (mounted) {
                            setError('Unsupported image data format');
                        }
                        return;
                    }

                    const url = URL.createObjectURL(blob);
                    imageUrlToRevoke = url;

                    if (!mounted) {
                        URL.revokeObjectURL(url);
                        return;
                    }

                    setImageUrl(url);

                    const img = new Image();
                    img.crossOrigin = 'anonymous';
                    img.onload = () => {
                        if (mounted) {
                            setImageDimensions({ width: img.width, height: img.height });
                        }
                    };
                    img.onerror = () => {
                        if (mounted) {
                            setError('Failed to load image');
                        }
                    };
                    img.src = url;
                }

                // Fetch ground truth annotations
                try {
                    let annotations: any = [];

                    try {
                        const [task] = await core.tasks.get({ id: taskId });
                        let gtJob: any = null;

                        try {
                            const jobs = await task.getJobs();
                            gtJob = jobs.find((j: any) => {
                                const jobType = j.type?.toLowerCase() || '';
                                return jobType.includes('ground') || jobType.includes('truth') || jobType === 'gt';
                            });

                            if (!gtJob && jobId) {
                                try {
                                    const [gtJobDirect] = await core.jobs.get({ taskID: taskId, type: 'ground_truth' });
                                    gtJob = gtJobDirect;
                                } catch (e) {
                                    // GT job might not exist
                                }
                            }

                            if (gtJob) {
                                const gtAnnotations = await gtJob.annotations.get(frameNumber);
                                if (gtAnnotations && Array.isArray(gtAnnotations)) {
                                    annotations = gtAnnotations;
                                }
                            }
                        } catch (gtError) {
                            // GT job might not exist, continue with regular annotations
                        }

                        if (annotations.length === 0) {
                            if (jobId) {
                                const [job] = await core.jobs.get({ jobID: jobId });
                                annotations = await job.annotations.get(frameNumber);
                            } else {
                                annotations = await task.annotations.get(frameNumber);
                            }
                        }
                    } catch (taskError) {
                        if (jobId) {
                            const [job] = await core.jobs.get({ jobID: jobId });
                            annotations = await job.annotations.get(frameNumber);
                        }
                    }

                    if (mounted) {
                        setGroundTruthAnnotations(Array.isArray(annotations) ? annotations : []);
                    }
                } catch (annError) {
                    if (mounted) {
                        setGroundTruthAnnotations([]);
                    }
                }

                // Use provided predictions - filter for current frame
                if (propPredictions && propPredictions.length > 0) {
                    const framePredictions = propPredictions.filter(p => p.frame_id === frameNumber);
                    if (mounted) {
                        setPredictions(framePredictions);
                    }
                } else if (mounted) {
                    setPredictions([]);
                }
            } catch (err) {
                if (mounted) {
                    setError(`Failed to load frame: ${err instanceof Error ? err.message : 'Unknown error'}`);
                }
            } finally {
                if (mounted) {
                    setLoading(false);
                }
            }
        };

        if (totalFrames > 0 && frameNumbersList.length > 0) {
            loadFrame();
        } else if (totalFrames > 0 && frameNumbersList.length === 0) {
            if (mounted) {
                setLoading(false);
            }
        }

        return () => {
            mounted = false;
            if (imageUrlToRevoke) {
                URL.revokeObjectURL(imageUrlToRevoke);
            }
        };
    }, [currentFrame, taskId, jobId, totalFrames, frameNumbersList, core, propPredictions]);

    // Render image and annotations on Fabric canvas
    useEffect(() => {
        if (!fabricCanvasRef.current || !imageUrl || !imageDimensions) {
            return;
        }

        const canvas = fabricCanvasRef.current;
        const fillOpacity = shapeFillOpacity / 100; // Convert 0-100 to 0-1

        // Clear canvas
        canvas.clear();

        // Load image
        fabric.Image.fromURL(imageUrl, (img) => {
            if (!fabricCanvasRef.current) return;

            // Set canvas size to match image
            canvas.setWidth(imageDimensions.width);
            canvas.setHeight(imageDimensions.height);

            // Add image to canvas
            img.set({
                selectable: false,
                evented: false,
            });
            canvas.add(img);
            canvas.sendToBack(img);

            // Add ground truth annotations
            if (showGroundTruth) {
                groundTruthAnnotations.forEach((annotation) => {
                    const labelName = annotation.label?.name ||
                                    annotation.labelName ||
                                    annotation.label?.id?.toString() ||
                                    'Unknown';

                    // Skip if this class is hidden
                    if (hiddenGTClasses.has(labelName)) {
                        return;
                    }

                    const bbox = annotationToBbox(annotation);
                    if (bbox) {
                        const rect = createBoundingBoxRect(bbox, '#52c41a', labelName, undefined, fillOpacity);
                        canvas.add(rect);
                    }
                });
            }

            // Add predictions
            if (showPredictions) {
                predictions.forEach((pred) => {
                    // Skip if this class is hidden
                    if (hiddenPredClasses.has(pred.label)) {
                        return;
                    }

                    // Apply confidence threshold filter
                    if (pred.confidence !== undefined && pred.confidence < confidenceThreshold) {
                        return;
                    }

                    const rect = createBoundingBoxRect(pred.xyxy, '#1890ff', pred.label, pred.confidence, fillOpacity);
                    canvas.add(rect);
                });
            }

            canvas.renderAll();
        }, { crossOrigin: 'anonymous' });
    }, [imageUrl, imageDimensions, groundTruthAnnotations, predictions, showGroundTruth, showPredictions, shapeFillOpacity, hiddenGTClasses, hiddenPredClasses, confidenceThreshold]);

    // Zoom controls - memoized with useCallback
    const handleZoomIn = useCallback(() => {
        if (!fabricCanvasRef.current) return;
        const canvas = fabricCanvasRef.current;
        const zoom = canvas.getZoom();
        const newZoom = Math.min(5, zoom * 1.2);
        canvas.setZoom(newZoom);
        setZoomLevel(newZoom);
    }, []);

    const handleZoomOut = useCallback(() => {
        if (!fabricCanvasRef.current) return;
        const canvas = fabricCanvasRef.current;
        const zoom = canvas.getZoom();
        const newZoom = Math.max(0.1, zoom / 1.2);
        canvas.setZoom(newZoom);
        setZoomLevel(newZoom);
    }, []);

    const handleResetZoom = useCallback(() => {
        if (!fabricCanvasRef.current || !imageDimensions) return;
        const canvas = fabricCanvasRef.current;
        const container = containerRef.current;
        if (!container) return;

        // Get container dimensions
        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;

        if (containerWidth <= 0 || containerHeight <= 0) return;

        // Calculate zoom to fit image within container with some padding
        const padding = 20; // Padding around the image
        const availableWidth = containerWidth - padding * 2;
        const availableHeight = containerHeight - padding * 2;

        const scaleX = availableWidth / imageDimensions.width;
        const scaleY = availableHeight / imageDimensions.height;
        const newZoom = Math.min(scaleX, scaleY, 1); // Don't zoom in beyond 100%

        // Ensure minimum zoom is at least 0.1 (10% on slider)
        const finalZoom = Math.max(newZoom, 0.1);

        // Reset viewport transform to identity
        canvas.viewportTransform = [1, 0, 0, 1, 0, 0];

        // Set zoom first
        canvas.setZoom(finalZoom);

        // Calculate the scaled dimensions
        const scaledWidth = imageDimensions.width * finalZoom;
        const scaledHeight = imageDimensions.height * finalZoom;

        // Calculate translation to center the scaled image in the container
        const offsetX = (containerWidth - scaledWidth) / 2;
        const offsetY = (containerHeight - scaledHeight) / 2;

        // Apply the viewport transform: [scaleX, skewY, skewX, scaleY, translateX, translateY]
        canvas.viewportTransform = [finalZoom, 0, 0, finalZoom, offsetX, offsetY];

        canvas.renderAll();
        setZoomLevel(finalZoom);
    }, [imageDimensions]);

    const handleZoomSliderChange = useCallback((value: number) => {
        if (!fabricCanvasRef.current) return;
        const canvas = fabricCanvasRef.current;
        const zoom = value / 100; // Convert percentage to zoom level
        canvas.setZoom(zoom);
        setZoomLevel(zoom);
    }, []);

    const handlePreviousFrame = useCallback(() => {
        setCurrentFrame((prev) => (prev > 0 ? prev - 1 : prev));
    }, []);

    const handleNextFrame = useCallback(() => {
        setCurrentFrame((prev) => (prev < totalFrames - 1 ? prev + 1 : prev));
    }, [totalFrames]);

    const handleFrameInputChange = useCallback((value: number | null) => {
        if (value !== null && value >= 0 && value < totalFrames) {
            setCurrentFrame(value);
        }
    }, [totalFrames]);

    // Calculate per-class counts
    const groundTruthClassCounts = useMemo(() => {
        const counts = new Map<string, number>();
        groundTruthAnnotations.forEach((annotation) => {
            const labelName = annotation.label?.name ||
                            annotation.labelName ||
                            annotation.label?.id?.toString() ||
                            'Unknown';
            counts.set(labelName, (counts.get(labelName) || 0) + 1);
        });
        return Array.from(counts.entries())
            .map(([label, count]) => ({ label, count }))
            .sort((a, b) => b.count - a.count); // Sort by count descending
    }, [groundTruthAnnotations]);

    const predictionsClassCounts = useMemo(() => {
        const counts = new Map<string, number>();
        predictions.forEach((pred) => {
            // Apply confidence threshold filter
            if (pred.confidence !== undefined && pred.confidence < confidenceThreshold) {
                return;
            }
            const label = pred.label || 'Unknown';
            counts.set(label, (counts.get(label) || 0) + 1);
        });
        return Array.from(counts.entries())
            .map(([label, count]) => ({ label, count }))
            .sort((a, b) => b.count - a.count); // Sort by count descending
    }, [predictions, confidenceThreshold]);

    const handleToggleGTClass = useCallback((label: string, visible: boolean) => {
        setHiddenGTClasses((prev) => {
            const newSet = new Set(prev);
            if (visible) {
                newSet.delete(label);
            } else {
                newSet.add(label);
            }
            return newSet;
        });
    }, []);

    const handleTogglePredClass = useCallback((label: string, visible: boolean) => {
        setHiddenPredClasses((prev) => {
            const newSet = new Set(prev);
            if (visible) {
                newSet.delete(label);
            } else {
                newSet.add(label);
            }
            return newSet;
        });
    }, []);

    // Get current frame's metrics from backend predictions
    const currentFrameMetrics = useMemo(() => {
        if (!backendPredictions.length || frameNumbersList.length === 0 || currentFrame < 0 || currentFrame >= frameNumbersList.length) {
            return null;
        }
        const frameNumber = frameNumbersList[currentFrame];
        const framePrediction = backendPredictions.find(p => p.frame_id === frameNumber);
        if (!framePrediction) return null;

        return {
            precision: framePrediction.precision ?? 0,
            recall: framePrediction.recall ?? 0,
            f1Score: framePrediction.f1 ?? 0,
            truePositives: framePrediction.true_positives ?? 0,
            falsePositives: framePrediction.false_positives ?? 0,
            falseNegatives: framePrediction.false_negatives ?? 0,
        };
    }, [backendPredictions, frameNumbersList, currentFrame]);

    if (error) {
        return (
            <div style={{ textAlign: 'center', padding: '40px' }}>
                <Text type="danger">{error}</Text>
                {totalFrames === 0 && (
                    <div style={{ marginTop: '16px' }}>
                        <Text type="secondary">Task ID: {taskId}, Job ID: {jobId || 'All'}</Text>
                    </div>
                )}
            </div>
        );
    }

    if (totalFrames === 0 && !loading) {
        return (
            <div style={{ textAlign: 'center', padding: '40px' }}>
                <Text type="secondary">No frames available</Text>
                <div style={{ marginTop: '16px' }}>
                    <Text type="secondary">Task ID: {taskId}, Job ID: {jobId || 'All'}</Text>
                </div>
            </div>
        );
    }

    return (
        <Layout hasSider className="cvat-benchmark-visual-workspace" style={{ height: '100%' }}>
            <Layout.Content style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
                {/* Top Controls Bar - Frame Navigation and Fit Image */}
                <div style={{
                    flexShrink: 0,
                    padding: '4px 12px',
                    borderBottom: '1px solid #f0f0f0',
                    backgroundColor: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    position: 'relative'
                }}>
                    {/* Frame Navigation - Centered */}
                        <Space size="small">
                            <Button
                                size="small"
                                icon={<LeftOutlined />}
                                onClick={handlePreviousFrame}
                                disabled={currentFrame === 0}
                            />
                            <InputNumber
                                size="small"
                                min={0}
                                max={totalFrames - 1}
                                value={currentFrame}
                                onChange={handleFrameInputChange}
                                style={{ width: '80px' }}
                            />
                            <Text type="secondary" style={{ fontSize: '12px' }}>/ {totalFrames - 1}</Text>
                            <Button
                                size="small"
                                icon={<RightOutlined />}
                                onClick={handleNextFrame}
                                disabled={currentFrame >= totalFrames - 1}
                            />
                        </Space>

                    {/* Fit Image Button - Right side */}
                            <Button
                                size="small"
                                icon={<CompressOutlined />}
                                onClick={handleResetZoom}
                                disabled={!fabricCanvasRef.current || !imageDimensions}
                        style={{ position: 'absolute', right: '16px' }}
                    >
                        Fit Image
                    </Button>
                </div>

                {/* Canvas Container - Takes remaining space */}
                <div
                    ref={containerRef}
                    style={{
                        flex: 1,
                        textAlign: 'center',
                        position: 'relative',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '100%',
                        minHeight: 0,
                        overflow: 'auto',
                        backgroundColor: '#f0f0f0',
                    }}
                >
                    {loading && (
                        <div style={{
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            zIndex: 10
                        }}>
                            <Spin />
                        </div>
                    )}
                    {!imageUrl && !loading && totalFrames > 0 && (
                        <div style={{ padding: '40px', textAlign: 'center' }}>
                            <Text type="secondary">Loading image...</Text>
                            <div style={{ marginTop: '8px', fontSize: '12px' }}>
                                <Text type="secondary">Frame: {currentFrame + 1} / {totalFrames}</Text>
                            </div>
                        </div>
                    )}
                    {/* Always render canvas to prevent DOM conflicts */}
                    <div
                        id="fabric-canvas-container"
                        style={{
                            display: 'inline-block',
                            visibility: imageUrl && imageDimensions ? 'visible' : 'hidden',
                        }}
                    >
                        <canvas
                            ref={canvasRefCallback}
                            style={{
                                margin: '0 auto',
                            }}
                        />
                    </div>
                </div>
            </Layout.Content>
            {/* Right Sidebar */}
            <BenchmarkVisualSidebar
                showGroundTruth={showGroundTruth}
                showPredictions={showPredictions}
                opacity={shapeFillOpacity}
                onToggleGroundTruth={setShowGroundTruth}
                onTogglePredictions={setShowPredictions}
                onOpacityChange={setShapeFillOpacity}
                groundTruthCount={groundTruthAnnotations.length}
                predictionsCount={predictions.filter((p) => p.confidence === undefined || p.confidence >= confidenceThreshold).length}
                groundTruthClassCounts={groundTruthClassCounts}
                predictionsClassCounts={predictionsClassCounts}
                hiddenGTClasses={hiddenGTClasses}
                hiddenPredClasses={hiddenPredClasses}
                onToggleGTClass={handleToggleGTClass}
                onTogglePredClass={handleTogglePredClass}
                zoomLevel={zoomLevel}
                onZoomSliderChange={handleZoomSliderChange}
                confidenceThreshold={confidenceThreshold}
                onConfidenceThresholdChange={setConfidenceThreshold}
                frameMetrics={currentFrameMetrics}
            />
        </Layout>
    );
}

export default BenchmarkImageOverlayViewer;
