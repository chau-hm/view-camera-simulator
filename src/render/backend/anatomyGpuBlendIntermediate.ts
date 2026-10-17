export const ANATOMY_GPU_BLEND_INTERMEDIATE_CAPTURE_EVENT =
  "vcs:observer-verification:anatomy-gpu-blend-intermediate-capture";
export const ANATOMY_GPU_BLEND_INTERMEDIATE_RESULT_EVENT =
  "vcs:observer-verification:anatomy-gpu-blend-intermediate-capture-result";

export type AnatomyGpuCaptureMethod = "draw-boundary" | "single-renderable-replay" | "native-draw-boundary";

export class AnatomyGpuCaptureCancelledError extends Error {
  constructor(reason = "Anatomy GPU capture was cancelled.") {
    super(reason);
    this.name = "AbortError";
  }
}

export const throwIfAnatomyGpuCaptureAborted = (signal?: AbortSignal): void => {
  if (!signal?.aborted) return;
  const reason = signal.reason;
  if (reason instanceof Error) throw reason;
  throw new AnatomyGpuCaptureCancelledError(typeof reason === "string" ? reason : undefined);
};
export type AnatomyGpuCaptureFeasibility = "F1" | "F2" | "F0";
export type AnatomyGpuColorRepresentation =
  | "canvas-rgba8-srgb-shader-output"
  | "linear-working-rgba32f-straight-alpha"
  | "tone-mapped-linear-rgba32f-straight-alpha"
  | "srgb-encoded-rgba32f-straight-alpha";

export type AnatomyGpuCaptureRuntime = Readonly<{
  rendererFamily: "webgl-renderer" | "webgpu-renderer" | "unknown";
  executionBackend: "webgl2" | "webgpu" | "webgl2-fallback" | "unknown";
}>;

/** Unpacks the 256-byte-padded rows returned by Three r186 WebGPU copyTextureToBuffer. */
export function unpackAnatomyGpuRgbaReadbackRows(
  source: Uint8Array,
  width: number,
  height: number,
): Uint8Array;
export function unpackAnatomyGpuRgbaReadbackRows(
  source: Float32Array,
  width: number,
  height: number,
): Float32Array;
export function unpackAnatomyGpuRgbaReadbackRows(
  source: Uint8Array | Float32Array,
  width: number,
  height: number,
): Uint8Array | Float32Array {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
    throw new Error("RGBA readback dimensions are invalid");
  }
  const rowComponents = width * 4;
  const bytesPerElement = source.BYTES_PER_ELEMENT;
  const tightLength = rowComponents * height;
  if (source.length === tightLength) return source;
  const rowStrideBytes = Math.ceil((rowComponents * bytesPerElement) / 256) * 256;
  const rowStrideComponents = rowStrideBytes / bytesPerElement;
  const requiredLength = (height - 1) * rowStrideComponents + rowComponents;
  if (source.length < requiredLength) {
    throw new Error(`RGBA readback is truncated: expected at least ${requiredLength} values, got ${source.length}`);
  }
  const packed = source instanceof Float32Array
    ? new Float32Array(tightLength)
    : new Uint8Array(tightLength);
  for (let row = 0; row < height; row += 1) {
    const sourceOffset = row * rowStrideComponents;
    packed.set(source.subarray(sourceOffset, sourceOffset + rowComponents), row * rowComponents);
  }
  return packed;
}

export type AnatomyGpuCaptureFeasibilityResult = Readonly<{
  classification: AnatomyGpuCaptureFeasibility;
  reason: string;
}>;

/** Classifies the observation boundary supported by the mounted r186 renderer. */
export const classifyAnatomyGpuCaptureFeasibility = (
  runtime: AnatomyGpuCaptureRuntime,
  method: AnatomyGpuCaptureMethod,
): AnatomyGpuCaptureFeasibilityResult => {
  if (method === "single-renderable-replay") {
    if (runtime.executionBackend === "webgl2" || runtime.executionBackend === "webgpu") {
      return {
        classification: "F2",
        reason: "An isolated render-target replay changes scene visibility and blend state; it is a shader-output proxy, not an unchanged production draw.",
      };
    }
    return {
      classification: "F0",
      reason: `The mounted execution backend ${runtime.executionBackend} cannot qualify a controlled replay.`,
    };
  }

  if (runtime.rendererFamily === "webgl-renderer" && runtime.executionBackend === "webgl2") {
    return {
      classification: "F1",
      reason: "A synchronous WebGL draw call is bracketed by attachment readbacks while the original render pass and draw ordering remain active.",
    };
  }

  if (runtime.rendererFamily === "webgpu-renderer" && runtime.executionBackend === "webgpu") {
    return {
      classification: "F0",
      reason: "Three r186 exposes no public readback boundary between encoded draws inside its active WebGPU render pass.",
    };
  }

  return {
    classification: "F0",
    reason: `Draw-boundary observation is unsupported for ${runtime.rendererFamily}/${runtime.executionBackend}.`,
  };
};

export type AnatomyGpuRgbaSample = readonly [number, number, number, number];

export type AnatomyGpuRepresentedSamples = Readonly<{
  representation: AnatomyGpuColorRepresentation;
  samples: readonly AnatomyGpuRgbaSample[];
}>;

export type AnatomyGpuSampleComparison = Readonly<{
  compatible: boolean;
  reason: string | null;
  sampleCount: number;
  meanAbsoluteRgbDifference: number | null;
  meanAbsoluteAlphaDifference: number | null;
}>;

/** Refuses numeric comparisons across incompatible color/alpha encodings. */
export const compareAnatomyGpuSamples = (
  first: AnatomyGpuRepresentedSamples,
  second: AnatomyGpuRepresentedSamples,
): AnatomyGpuSampleComparison => {
  if (first.representation !== second.representation) {
    return {
      compatible: false,
      reason: `Representation mismatch: ${first.representation} versus ${second.representation}.`,
      sampleCount: 0,
      meanAbsoluteRgbDifference: null,
      meanAbsoluteAlphaDifference: null,
    };
  }
  if (first.samples.length !== second.samples.length) {
    return {
      compatible: false,
      reason: `Sample-count mismatch: ${first.samples.length} versus ${second.samples.length}.`,
      sampleCount: 0,
      meanAbsoluteRgbDifference: null,
      meanAbsoluteAlphaDifference: null,
    };
  }
  if (first.samples.length === 0) {
    return {
      compatible: false,
      reason: "No matched samples were supplied.",
      sampleCount: 0,
      meanAbsoluteRgbDifference: null,
      meanAbsoluteAlphaDifference: null,
    };
  }

  let rgbDifference = 0;
  let alphaDifference = 0;
  first.samples.forEach((firstSample, index) => {
    const secondSample = second.samples[index];
    if (!secondSample) return;
    rgbDifference += Math.abs(firstSample[0] - secondSample[0]);
    rgbDifference += Math.abs(firstSample[1] - secondSample[1]);
    rgbDifference += Math.abs(firstSample[2] - secondSample[2]);
    alphaDifference += Math.abs(firstSample[3] - secondSample[3]);
  });

  return {
    compatible: true,
    reason: null,
    sampleCount: first.samples.length,
    meanAbsoluteRgbDifference: rgbDifference / (first.samples.length * 3),
    meanAbsoluteAlphaDifference: alphaDifference / first.samples.length,
  };
};

export type AnatomyGpuDrawResponseSummary = Readonly<{
  sampleCount: number;
  changedPixelCount: number;
  thresholdPixelCount: number;
  meanAbsoluteRgbDifference: number;
  meanAbsoluteAlphaDifference: number;
  maxAbsoluteRgbChannelDifference: number;
  selectedPixelIndices: readonly number[];
}>;

/** Summarizes an F1 RGBA8 readback over a mask fixed before hypothesis comparison. */
export const summarizeAnatomyGpuDrawResponse = (
  before: ArrayLike<number>,
  after: ArrayLike<number>,
  maskPixelIndices: readonly number[],
  threshold = 8,
  sampleLimit = 32,
): AnatomyGpuDrawResponseSummary => {
  if (before.length !== after.length || before.length % 4 !== 0) {
    throw new Error("Draw-boundary RGBA buffers must have equal whole-pixel lengths");
  }
  const pixelCount = before.length / 4;
  if (maskPixelIndices.some((index) => !Number.isInteger(index) || index < 0 || index >= pixelCount)) {
    throw new Error("Draw-boundary mask contains an out-of-range pixel index");
  }
  let changedPixelCount = 0;
  let thresholdPixelCount = 0;
  let rgbDifference = 0;
  let alphaDifference = 0;
  let maxAbsoluteRgbChannelDifference = 0;
  const selectedPixelIndices: number[] = [];

  for (const pixelIndex of maskPixelIndices) {
    const offset = pixelIndex * 4;
    const red = Math.abs(Number(before[offset]) - Number(after[offset]));
    const green = Math.abs(Number(before[offset + 1]) - Number(after[offset + 1]));
    const blue = Math.abs(Number(before[offset + 2]) - Number(after[offset + 2]));
    const alpha = Math.abs(Number(before[offset + 3]) - Number(after[offset + 3]));
    const maxRgbDifference = Math.max(red, green, blue);
    if (maxRgbDifference > 0 || alpha > 0) changedPixelCount += 1;
    if (maxRgbDifference >= threshold) {
      thresholdPixelCount += 1;
      if (selectedPixelIndices.length < sampleLimit) selectedPixelIndices.push(pixelIndex);
    }
    rgbDifference += red + green + blue;
    alphaDifference += alpha;
    maxAbsoluteRgbChannelDifference = Math.max(maxAbsoluteRgbChannelDifference, maxRgbDifference);
  }

  return {
    sampleCount: maskPixelIndices.length,
    changedPixelCount,
    thresholdPixelCount,
    meanAbsoluteRgbDifference: maskPixelIndices.length === 0 ? 0 : rgbDifference / (maskPixelIndices.length * 3),
    meanAbsoluteAlphaDifference: maskPixelIndices.length === 0 ? 0 : alphaDifference / maskPixelIndices.length,
    maxAbsoluteRgbChannelDifference,
    selectedPixelIndices,
  };
};

/** IEC 61966-2-1 sRGB OETF for converting recorded linear RGB values. */
export const linearToSrgb = (value: number): number => {
  const clamped = Math.max(0, value);
  return clamped <= 0.0031308
    ? clamped * 12.92
    : 1.055 * Math.pow(clamped, 1 / 2.4) - 0.055;
};

export const convertLinearRgbaToSrgb = (
  sample: AnatomyGpuRgbaSample,
): AnatomyGpuRgbaSample => [
  linearToSrgb(sample[0]),
  linearToSrgb(sample[1]),
  linearToSrgb(sample[2]),
  sample[3],
];

/** IEC 61966-2-1 inverse transfer function for recorded sRGB RGB values. */
export const srgbToLinear = (value: number): number => {
  const clamped = Math.max(0, Math.min(1, value));
  return clamped <= 0.04045
    ? clamped / 12.92
    : Math.pow((clamped + 0.055) / 1.055, 2.4);
};

export const convertSrgbRgbaToLinear = (
  sample: AnatomyGpuRgbaSample,
): AnatomyGpuRgbaSample => [
  srgbToLinear(sample[0]),
  srgbToLinear(sample[1]),
  srgbToLinear(sample[2]),
  sample[3],
];

/** Source-over prediction used only when the recorded factors/equations match this fixture. */
export const predictNormalSourceOver = (
  source: AnatomyGpuRgbaSample,
  destination: AnatomyGpuRgbaSample,
): AnatomyGpuRgbaSample => {
  const sourceAlpha = source[3];
  const destinationWeight = 1 - sourceAlpha;
  return [
    source[0] * sourceAlpha + destination[0] * destinationWeight,
    source[1] * sourceAlpha + destination[1] * destinationWeight,
    source[2] * sourceAlpha + destination[2] * destinationWeight,
    sourceAlpha + destination[3] * destinationWeight,
  ];
};
