import { unpackAnatomyGpuRgbaReadbackRows } from "./anatomyGpuBlendIntermediate";
import { anatomyNativeFramebufferTexelToRgba } from "./anatomyNativeWebGpuDrawBoundary";

export type AnatomyNativeFramebufferMetadata = Readonly<{
  width: number;
  height: number;
  format: string;
  channelOrder: string;
  rowOrder: string;
  colorRepresentation: string;
  sampleCount: number;
  resolveTarget: boolean;
  depthFormat: string | null;
  rendererFamily: string;
  executionBackend: string;
  outputColorSpace: string | null;
  toneMapping: number | null;
  outputPolicy: string;
  sceneId: string;
  teachingState: string;
  anatomyPresentation: unknown;
  cameraPosition: readonly number[];
  cameraQuaternion: readonly number[];
  cameraMatrixWorld: readonly number[];
  devicePixelRatio: number;
  viewportWidth: number;
  viewportHeight: number;
}>;

export type AnatomyNativeFramebuffer = Readonly<{
  metadata: AnatomyNativeFramebufferMetadata;
  rgba: Uint8Array;
}>;

export type AnatomyNativeFramebufferMetrics = Readonly<{
  comparedPixelCount: number;
  meanAbsoluteRgbError: number;
  meanAbsoluteAlphaError: number;
  meanAbsoluteChannelError: number;
  maxAbsoluteError: number;
  maxAbsoluteErrorByChannel: Readonly<{ red: number; green: number; blue: number; alpha: number }>;
  changedPixelCount: number;
  changedPixelPercentage: number;
  exactRgbaMatchPixelCount: number;
  meanAbsoluteErrorByChannel: Readonly<{ red: number; green: number; blue: number; alpha: number }>;
  absoluteErrorHistogramByChannel: Readonly<{
    red: Readonly<Record<string, number>>;
    green: Readonly<Record<string, number>>;
    blue: Readonly<Record<string, number>>;
    alpha: Readonly<Record<string, number>>;
  }>;
}>;

export type AnatomyNativeFramebufferComparison = Readonly<{
  compatible: boolean;
  mismatches: readonly string[];
  fullFrame?: AnatomyNativeFramebufferMetrics;
  regions?: Readonly<Record<string, AnatomyNativeFramebufferMetrics>>;
  fixedSamples?: readonly Readonly<{
    index: number;
    x: number;
    y: number;
    first: readonly [number, number, number, number];
    second: readonly [number, number, number, number];
    absoluteError: readonly [number, number, number, number];
    exactMatch: boolean;
  }>[];
}>;

const channelNames = ["red", "green", "blue", "alpha"] as const;

/** Removes r186's 256-byte WebGPU row padding and normalizes supported BGRA attachments to RGBA. */
export const normalizeAnatomyNativeFramebufferRgba = (
  source: Uint8Array,
  width: number,
  height: number,
  format: string,
): Uint8Array => {
  const packed = unpackAnatomyGpuRgbaReadbackRows(source, width, height);
  const expectedBytes = width * height * 4;
  if (packed.length !== expectedBytes) {
    throw new Error(`Native framebuffer readback has ${packed.length} bytes; expected ${expectedBytes}`);
  }
  const normalized = new Uint8Array(expectedBytes);
  for (let offset = 0; offset < expectedBytes; offset += 4) {
    const texel = anatomyNativeFramebufferTexelToRgba(packed.subarray(offset, offset + 4), format);
    normalized.set(texel, offset);
  }
  return normalized;
};

/** Maps screenshot mask pixels to their backing-framebuffer cell centers, matching the M-INV5 mapping. */
export const mapAnatomyScreenshotPixelsToFramebuffer = (
  screenshotIndices: readonly number[],
  screenshotWidth: number,
  screenshotHeight: number,
  framebufferWidth: number,
  framebufferHeight: number,
): Readonly<{ indices: readonly number[]; mapping: string; sourcePixelCount: number; uniqueMappedPixelCount: number }> => {
  if (![screenshotWidth, screenshotHeight, framebufferWidth, framebufferHeight].every((value) =>
    Number.isInteger(value) && value > 0)) {
    throw new Error("Screenshot or framebuffer dimensions are invalid");
  }
  const unique = new Set<number>();
  for (const index of screenshotIndices) {
    if (!Number.isInteger(index) || index < 0 || index >= screenshotWidth * screenshotHeight) {
      throw new Error(`Screenshot mask index ${index} is outside ${screenshotWidth}x${screenshotHeight}`);
    }
    const x = index % screenshotWidth;
    const y = Math.floor(index / screenshotWidth);
    const framebufferX = Math.min(framebufferWidth - 1, Math.floor((x + 0.5) * framebufferWidth / screenshotWidth));
    const framebufferY = Math.min(framebufferHeight - 1, Math.floor((y + 0.5) * framebufferHeight / screenshotHeight));
    unique.add(framebufferY * framebufferWidth + framebufferX);
  }
  const indices = [...unique].sort((left, right) => left - right);
  return {
    indices,
    sourcePixelCount: screenshotIndices.length,
    uniqueMappedPixelCount: indices.length,
    mapping: "each CSS screenshot mask pixel maps only to the center pixel of its corresponding native framebuffer cell; this is a mapped-center mask, not every native sample covered by the CSS pixel",
  };
};

const metadataFields: readonly (keyof AnatomyNativeFramebufferMetadata)[] = [
  "width",
  "height",
  "format",
  "channelOrder",
  "rowOrder",
  "colorRepresentation",
  "sampleCount",
  "resolveTarget",
  "depthFormat",
  "rendererFamily",
  "executionBackend",
  "outputColorSpace",
  "toneMapping",
  "outputPolicy",
  "sceneId",
  "teachingState",
  "anatomyPresentation",
  "cameraPosition",
  "cameraQuaternion",
  "cameraMatrixWorld",
  "devicePixelRatio",
  "viewportWidth",
  "viewportHeight",
];

const metadataMismatches = (
  first: AnatomyNativeFramebufferMetadata,
  second: AnatomyNativeFramebufferMetadata,
): string[] => metadataFields.flatMap((field) =>
  JSON.stringify(first[field]) === JSON.stringify(second[field]) ? [] : [String(field)],
);

const compareIndices = (
  first: Uint8Array,
  second: Uint8Array,
  indices: readonly number[],
): AnatomyNativeFramebufferMetrics => {
  const channelErrorSums = [0, 0, 0, 0];
  const channelMaxErrors = [0, 0, 0, 0];
  const histograms = channelNames.map(() => Object.create(null) as Record<string, number>);
  let changedPixelCount = 0;
  let exactRgbaMatchPixelCount = 0;
  indices.forEach((index) => {
    const offset = index * 4;
    let changed = false;
    for (let channel = 0; channel < 4; channel += 1) {
      const error = Math.abs((first[offset + channel] ?? 0) - (second[offset + channel] ?? 0));
      channelErrorSums[channel] = (channelErrorSums[channel] ?? 0) + error;
      channelMaxErrors[channel] = Math.max(channelMaxErrors[channel] ?? 0, error);
      const histogram = histograms[channel];
      if (histogram) histogram[String(error)] = (histogram[String(error)] ?? 0) + 1;
      if (error !== 0) changed = true;
    }
    if (changed) changedPixelCount += 1;
    else exactRgbaMatchPixelCount += 1;
  });
  const count = indices.length;
  const rgbSum = (channelErrorSums[0] ?? 0) + (channelErrorSums[1] ?? 0) + (channelErrorSums[2] ?? 0);
  const totalSum = rgbSum + (channelErrorSums[3] ?? 0);
  const maxAbsoluteError = Math.max(...channelMaxErrors);
  return {
    comparedPixelCount: count,
    meanAbsoluteRgbError: count > 0 ? rgbSum / (count * 3) : 0,
    meanAbsoluteAlphaError: count > 0 ? (channelErrorSums[3] ?? 0) / count : 0,
    meanAbsoluteChannelError: count > 0 ? totalSum / (count * 4) : 0,
    maxAbsoluteError,
    maxAbsoluteErrorByChannel: {
      red: channelMaxErrors[0] ?? 0,
      green: channelMaxErrors[1] ?? 0,
      blue: channelMaxErrors[2] ?? 0,
      alpha: channelMaxErrors[3] ?? 0,
    },
    changedPixelCount,
    changedPixelPercentage: count > 0 ? changedPixelCount * 100 / count : 0,
    exactRgbaMatchPixelCount,
    meanAbsoluteErrorByChannel: {
      red: count > 0 ? (channelErrorSums[0] ?? 0) / count : 0,
      green: count > 0 ? (channelErrorSums[1] ?? 0) / count : 0,
      blue: count > 0 ? (channelErrorSums[2] ?? 0) / count : 0,
      alpha: count > 0 ? (channelErrorSums[3] ?? 0) / count : 0,
    },
    absoluteErrorHistogramByChannel: {
      red: histograms[0] ?? {},
      green: histograms[1] ?? {},
      blue: histograms[2] ?? {},
      alpha: histograms[3] ?? {},
    },
  };
};

/** Compares actual same-format raw framebuffer bytes after mandatory metadata equality checks. */
export const compareAnatomyNativeFramebuffers = (
  first: AnatomyNativeFramebuffer,
  second: AnatomyNativeFramebuffer,
  regions: Readonly<Record<string, readonly number[]>>,
  fixedSampleIndices: readonly number[],
): AnatomyNativeFramebufferComparison => {
  const mismatches = metadataMismatches(first.metadata, second.metadata);
  const expectedBytes = first.metadata.width * first.metadata.height * 4;
  if (first.rgba.length !== expectedBytes) mismatches.push("firstRGBAByteLength");
  if (second.rgba.length !== second.metadata.width * second.metadata.height * 4) mismatches.push("secondRGBAByteLength");
  if (mismatches.length > 0) return { compatible: false, mismatches: [...new Set(mismatches)] };

  const pixelCount = first.metadata.width * first.metadata.height;
  const allIndices = Array.from({ length: pixelCount }, (_, index) => index);
  const regionMetrics: Record<string, AnatomyNativeFramebufferMetrics> = {};
  for (const [name, indices] of Object.entries(regions)) {
    if (indices.some((index) => !Number.isInteger(index) || index < 0 || index >= pixelCount)) {
      return { compatible: false, mismatches: [`region:${name}:pixel-index-out-of-range`] };
    }
    regionMetrics[name] = compareIndices(first.rgba, second.rgba, indices);
  }
  if (fixedSampleIndices.some((index) => !Number.isInteger(index) || index < 0 || index >= pixelCount)) {
    return { compatible: false, mismatches: ["fixedSampleIndexOutOfRange"] };
  }
  const fixedSamples = fixedSampleIndices.map((index) => {
    const offset = index * 4;
    const firstRgba = [first.rgba[offset]!, first.rgba[offset + 1]!, first.rgba[offset + 2]!, first.rgba[offset + 3]!] as const;
    const secondRgba = [second.rgba[offset]!, second.rgba[offset + 1]!, second.rgba[offset + 2]!, second.rgba[offset + 3]!] as const;
    const absoluteError = firstRgba.map((value, channel) => Math.abs(value - secondRgba[channel]!)) as unknown as readonly [number, number, number, number];
    return {
      index,
      x: index % first.metadata.width,
      y: Math.floor(index / first.metadata.width),
      first: firstRgba,
      second: secondRgba,
      absoluteError,
      exactMatch: absoluteError.every((error) => error === 0),
    };
  });
  return {
    compatible: true,
    mismatches: [],
    fullFrame: compareIndices(first.rgba, second.rgba, allIndices),
    regions: regionMetrics,
    fixedSamples,
  };
};
