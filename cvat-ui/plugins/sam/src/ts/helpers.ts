import { Tensor } from 'onnxruntime-web';
import { DecodeBody } from './inference.worker';

export interface ClickType {
    clickType: 0 | 1 | 2 | 3;
    x: number;
    y: number;
}

export function getModelScale(w: number, h: number): number {
    const max = Math.max(h, w);
    const SCALE = 1024;
    let scale = SCALE;
    if (max > SCALE) scale = SCALE / max;
    if (max < SCALE) scale = SCALE / max;
    return scale;
}

export function modelData({
    clicks, tensor, modelScale, maskInput,
}: {
    clicks: ClickType[];
    tensor: Tensor;
    modelScale: { height: number; width: number; scale: number };
    maskInput: Tensor | null;
}): DecodeBody {
    const imageEmbedding = tensor;

    const n = clicks.length;
    const pointCoords = new Float32Array(2 * n);
    const pointLabels = new Float32Array(n);

    for (let i = 0; i < n; i++) {
        pointCoords[2 * i] = clicks[i].x * modelScale.scale;
        pointCoords[2 * i + 1] = clicks[i].y * modelScale.scale;
        pointLabels[i] = clicks[i].clickType;
    }

    const pointCoordsTensor = new Tensor('float32', pointCoords, [1, n, 2]);
    const pointLabelsTensor = new Tensor('float32', pointLabels, [1, n]);
    const imageSizeTensor = new Tensor('float32', [modelScale.height, modelScale.width]);

    const prevMask = maskInput || new Tensor('float32', new Float32Array(256 * 256), [1, 1, 256, 256]);
    const hasMaskInput = new Tensor('float32', [maskInput ? 1 : 0]);

    return {
        image_embeddings: imageEmbedding,
        point_coords: pointCoordsTensor,
        point_labels: pointLabelsTensor,
        orig_im_size: imageSizeTensor,
        mask_input: prevMask,
        has_mask_input: hasMaskInput,
    };
}

export function onnxToImage(input: ArrayLike<number>, width: number, height: number): number[][] {
    const image: number[][] = Array(height).fill(0).map(() => Array(width).fill(0));

    // Detect whether the input values are logits (can be <0 or >1) or probabilities in [0,1]
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    for (let i = 0; i < input.length; i++) {
        const v = input[i] as number;
        if (v < min) min = v;
        if (v > max) max = v;
    }
    const useSigmoid = min < 0 || max > 1;

    // Binarize using 0.5 threshold (after sigmoid if logits)
    for (let i = 0; i < input.length; i++) {
        let v = input[i] as number;
        if (useSigmoid) {
            v = 1 / (1 + Math.exp(-v));
        }
        const row = Math.floor(i / width);
        const col = i % width;
        image[row][col] = v >= 0.5 ? 255 : 0;
    }
    return image;
}

// point_coords are scaled by modelScale.scale; orig_im_size stays as original image size in pixels