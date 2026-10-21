import type { PixelAxis } from "./ground-glass-webgpu-aperture-gather-cases";

export const GATHER_QUALITY_MATRIX = [
  { id: "full-16", gatherScale: 1, sampleCount: 16 },
  { id: "full-32", gatherScale: 1, sampleCount: 32 },
  { id: "full-64", gatherScale: 1, sampleCount: 64 },
  { id: "half-16", gatherScale: 0.5, sampleCount: 16 },
  { id: "half-32", gatherScale: 0.5, sampleCount: 32 },
  { id: "half-64", gatherScale: 0.5, sampleCount: 64 },
] as const;

export type GatherQualityCell = (typeof GATHER_QUALITY_MATRIX)[number];
export type GatherResolution = Readonly<{ widthPx: number; heightPx: number }>;

/** Nearest gather texel sampled by a full-resolution composite pixel center. */
export const gatherTexelAtSourcePixelCenter = (
  sourcePixel: PixelAxis,
  source: GatherResolution,
  gather: GatherResolution,
): PixelAxis => {
  if (![...sourcePixel, source.widthPx, source.heightPx, gather.widthPx, gather.heightPx]
    .every(Number.isFinite)
    || !Number.isInteger(sourcePixel[0])
    || !Number.isInteger(sourcePixel[1])
    || source.widthPx <= 0
    || source.heightPx <= 0
    || gather.widthPx <= 0
    || gather.heightPx <= 0
    || sourcePixel[0] < 0
    || sourcePixel[1] < 0
    || sourcePixel[0] >= source.widthPx
    || sourcePixel[1] >= source.heightPx) {
    throw new RangeError("Source-to-gather mapping requires an in-bounds integer pixel and positive dimensions");
  }
  return [
    Math.min(gather.widthPx - 1, Math.floor((sourcePixel[0] + 0.5) * gather.widthPx / source.widthPx)),
    Math.min(gather.heightPx - 1, Math.floor((sourcePixel[1] + 0.5) * gather.heightPx / source.heightPx)),
  ];
};

/** Precomputes the same nearest pixel-center mapping for per-pixel diagnostics. */
export const createSourceToGatherPixelCenterLookup = (
  source: GatherResolution,
  gather: GatherResolution,
): { x: Uint16Array; y: Uint16Array } => {
  if ([source.widthPx, source.heightPx, gather.widthPx, gather.heightPx]
    .some((value) => !Number.isInteger(value) || value <= 0)
    || gather.widthPx > 65_536
    || gather.heightPx > 65_536) {
    throw new RangeError("Pixel-center lookup requires positive integer dimensions within Uint16 range");
  }
  const x = new Uint16Array(source.widthPx);
  const y = new Uint16Array(source.heightPx);
  for (let sourceX = 0; sourceX < source.widthPx; sourceX += 1) {
    x[sourceX] = Math.min(gather.widthPx - 1, Math.floor((sourceX + 0.5) * gather.widthPx / source.widthPx));
  }
  for (let sourceY = 0; sourceY < source.heightPx; sourceY += 1) {
    y[sourceY] = Math.min(gather.heightPx - 1, Math.floor((sourceY + 0.5) * gather.heightPx / source.heightPx));
  }
  return { x, y };
};

/** Approximate render-target storage; not GPU heap occupancy. */
export const estimateGatherTargetMemory = (
  source: GatherResolution,
  gather: GatherResolution,
): { sourcePixels: number; gatherPixels: number; estimatedBytes: number; estimatedMiB: number } => {
  const values = [source.widthPx, source.heightPx, gather.widthPx, gather.heightPx];
  if (!values.every((value) => Number.isInteger(value) && value > 0)) {
    throw new RangeError("Memory estimate requires positive integer target dimensions");
  }
  const sourcePixels = source.widthPx * source.heightPx;
  const gatherPixels = gather.widthPx * gather.heightPx;
  // Source color 8B + depth estimate 4B + physical CoC 8B + validity 4B
  // + world diagnostics 16B + radius diagnostics 8B + composite 8B.
  // Far and near RGBA16F gather targets contribute 16B per gather pixel.
  const estimatedBytes = sourcePixels * 56 + gatherPixels * 16;
  return { sourcePixels, gatherPixels, estimatedBytes, estimatedMiB: estimatedBytes / (1024 * 1024) };
};

export const summarizeMeasurements = (samples: readonly number[]) => {
  if (samples.length === 0 || !samples.every(Number.isFinite)) {
    throw new RangeError("Measurement summary requires at least one finite sample");
  }
  const ordered = [...samples].sort((a, b) => a - b);
  const sum = ordered.reduce((total, value) => total + value, 0);
  const percentile = (p: number) => ordered[Math.min(ordered.length - 1, Math.ceil(p * ordered.length) - 1)]!;
  return {
    count: ordered.length,
    median: ordered.length % 2 === 0
      ? (ordered[ordered.length / 2 - 1]! + ordered[ordered.length / 2]!) / 2
      : ordered[(ordered.length - 1) / 2]!,
    mean: sum / ordered.length,
    min: ordered[0]!,
    max: ordered[ordered.length - 1]!,
    p95: percentile(0.95),
    range: ordered[ordered.length - 1]! - ordered[0]!,
    samples: ordered,
  };
};
