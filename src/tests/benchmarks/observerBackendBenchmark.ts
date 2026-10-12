import { inflateSync } from "node:zlib";

export type MountedObserverEvidence = Readonly<Record<string, string | undefined>>;

export type ExpectedObserverBackend = "webgl" | "native-webgpu";

export type TimingSummary = Readonly<{
  sampleCount: number;
  medianMs: number | null;
  p95Ms: number | null;
  p99Ms: number | null;
  maximumMs: number | null;
  intervalsOver50Ms: number;
}>;

export type PixelRegion = Readonly<{
  left: number;
  top: number;
  right: number;
  bottom: number;
}>;

export type DecodedPng = Readonly<{
  width: number;
  height: number;
  channels: 3 | 4;
  pixels: Buffer;
}>;

export type PixelRegionSummary = Readonly<{
  region: PixelRegion;
  sampleCount: number;
  distinctColorBuckets: number;
  meanLuminance: number | null;
  luminanceStandardDeviation: number | null;
}>;

export type ImageDifferenceSummary = Readonly<{
  meanAbsoluteRgbDifference: number;
  changedPixelCount: number;
  changedPixelFraction: number;
  meanSignedLuminanceDifference: number;
}>;

export const subjectRoiHasMeaningfulPixels = (summary: PixelRegionSummary | null): boolean =>
  summary !== null && summary.sampleCount >= 500 &&
  summary.distinctColorBuckets > 24 &&
  (summary.luminanceStandardDeviation ?? 0) > 6;

export const observerBackendMismatches = (
  evidence: MountedObserverEvidence,
  expected: ExpectedObserverBackend,
): string[] => {
  const problems: string[] = [];
  if (evidence["data-observer-renderer-status"] !== "active") {
    problems.push("mounted renderer status is not active");
  }

  if (expected === "webgl") {
    if (evidence["data-observer-renderer-request"] !== "webgl") {
      problems.push("WebGL trial did not request the default WebGL renderer");
    }
    if (evidence["data-observer-selection-reason"] !== "default-webgl-request") {
      problems.push("WebGL trial did not use the default WebGL selection policy");
    }
    if (evidence["data-observer-renderer-family"] !== "webgl-renderer") {
      problems.push("mounted renderer family is not WebGLRenderer");
    }
    if (evidence["data-observer-execution-backend"] !== "webgl2") {
      problems.push("mounted WebGL execution backend is not WebGL2");
    }
    if (evidence["data-observer-application-fallback"] !== "none") {
      problems.push("default WebGL trial reports an application fallback");
    }
    if (evidence["data-observer-webgpu-initialization-attempts"] &&
      evidence["data-observer-webgpu-initialization-attempts"] !== "0") {
      problems.push("default WebGL trial attempted WebGPU initialization");
    }
  } else {
    if (evidence["data-observer-renderer-request"] !== "webgpu-pilot") {
      problems.push("native trial did not request the WebGPU pilot");
    }
    if (evidence["data-observer-selection-reason"] !== "webgpu-pilot-approved") {
      problems.push("native trial was not approved by the development pilot policy");
    }
    if (evidence["data-observer-webgpu-scene-compatibility"] !== "verified") {
      problems.push("scene compatibility is not verified");
    }
    if (evidence["data-observer-webgpu-pilot-eligibility"] !== "eligible") {
      problems.push("scene is not eligible for the development WebGPU pilot");
    }
    if (evidence["data-observer-webgpu-api-present"] !== "true") {
      problems.push("browser WebGPU API is absent");
    }
    if (evidence["data-observer-adapter-availability"] !== "available") {
      problems.push("WebGPU adapter was not reported available");
    }
    if (evidence["data-observer-renderer-family"] !== "webgpu-renderer") {
      problems.push("mounted renderer family is not WebGPURenderer");
    }
    if (evidence["data-observer-execution-backend"] !== "webgpu") {
      problems.push("mounted execution backend is not native WebGPU");
    }
    if (evidence["data-observer-application-fallback"] !== "none") {
      problems.push("native trial used application-level fallback");
    }
    if (evidence["data-observer-webgpu-initialization-attempts"] !== "1") {
      problems.push("native trial did not make exactly one WebGPU initialization attempt");
    }
  }

  if (evidence["data-observer-renderer-failure-stage"]) {
    problems.push(`renderer reported failure stage ${evidence["data-observer-renderer-failure-stage"]}`);
  }
  return problems;
};

const percentile = (sorted: readonly number[], percentileValue: number): number | null => {
  if (sorted.length === 0) return null;
  const index = Math.max(0, Math.ceil(percentileValue * sorted.length) - 1);
  return sorted[index] ?? null;
};

export const summarizeFrameCadence = (
  intervalsMs: readonly number[],
  longIntervalThresholdMs = 50,
): TimingSummary => {
  const sorted = intervalsMs
    .filter((value) => Number.isFinite(value) && value >= 0)
    .toSorted((a, b) => a - b);
  return {
    sampleCount: sorted.length,
    medianMs: percentile(sorted, 0.5),
    p95Ms: percentile(sorted, 0.95),
    // The brief calls out that p99 is only meaningful once the sample is large enough.
    p99Ms: sorted.length >= 100 ? percentile(sorted, 0.99) : null,
    maximumMs: sorted.at(-1) ?? null,
    intervalsOver50Ms: sorted.filter((value) => value > longIntervalThresholdMs).length,
  };
};

const paethPredictor = (left: number, above: number, upperLeft: number): number => {
  const estimate = left + above - upperLeft;
  const leftDistance = Math.abs(estimate - left);
  const aboveDistance = Math.abs(estimate - above);
  const upperLeftDistance = Math.abs(estimate - upperLeft);
  if (leftDistance <= aboveDistance && leftDistance <= upperLeftDistance) return left;
  return aboveDistance <= upperLeftDistance ? above : upperLeft;
};

export const decodePlaywrightPng = (png: Buffer): DecodedPng => {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (!png.subarray(0, 8).equals(signature)) throw new Error("Observer capture is not PNG");

  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  const imageData: Buffer[] = [];
  for (let offset = 8; offset + 12 <= png.length;) {
    const length = png.readUInt32BE(offset);
    const type = png.toString("ascii", offset + 4, offset + 8);
    const data = png.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8] ?? 0;
      colorType = data[9] ?? 0;
      interlace = data[12] ?? 0;
    } else if (type === "IDAT") {
      imageData.push(data);
    } else if (type === "IEND") {
      break;
    }
    offset += length + 12;
  }

  const channels = colorType === 2 ? 3 : colorType === 6 ? 4 : 0;
  if (!width || !height || bitDepth !== 8 || (channels !== 3 && channels !== 4) || interlace !== 0) {
    throw new Error("Unsupported Playwright PNG screenshot format");
  }

  const rowBytes = width * channels;
  const bytesPerPixel = channels;
  const inflated = inflateSync(Buffer.concat(imageData));
  const pixels = Buffer.alloc(height * rowBytes);
  for (let y = 0; y < height; y += 1) {
    const sourceRow = y * (rowBytes + 1);
    const targetRow = y * rowBytes;
    const filter = inflated[sourceRow] ?? 0;
    for (let x = 0; x < rowBytes; x += 1) {
      const raw = inflated[sourceRow + 1 + x] ?? 0;
      const left = x >= bytesPerPixel ? pixels[targetRow + x - bytesPerPixel] ?? 0 : 0;
      const above = y > 0 ? pixels[targetRow - rowBytes + x] ?? 0 : 0;
      const upperLeft = y > 0 && x >= bytesPerPixel
        ? pixels[targetRow - rowBytes + x - bytesPerPixel] ?? 0
        : 0;
      const predictor = filter === 0 ? 0
        : filter === 1 ? left
        : filter === 2 ? above
        : filter === 3 ? Math.floor((left + above) / 2)
        : filter === 4 ? paethPredictor(left, above, upperLeft)
        : Number.NaN;
      if (!Number.isFinite(predictor)) throw new Error(`Unsupported PNG row filter ${filter}`);
      pixels[targetRow + x] = (raw + predictor) & 0xff;
    }
  }
  return { width, height, channels: channels as 3 | 4, pixels };
};

const normalizedRegion = (region: PixelRegion, image: DecodedPng): PixelRegion => ({
  left: Math.max(0, Math.min(image.width, Math.floor(region.left))),
  top: Math.max(0, Math.min(image.height, Math.floor(region.top))),
  right: Math.max(0, Math.min(image.width, Math.ceil(region.right))),
  bottom: Math.max(0, Math.min(image.height, Math.ceil(region.bottom))),
});

const channelAt = (image: DecodedPng, x: number, y: number, channel: number): number =>
  image.pixels[(y * image.width + x) * image.channels + channel] ?? 0;

const luminance = (red: number, green: number, blue: number): number =>
  0.2126 * red + 0.7152 * green + 0.0722 * blue;

export const summarizePixelRegion = (
  image: DecodedPng,
  requestedRegion: PixelRegion,
): PixelRegionSummary => {
  const region = normalizedRegion(requestedRegion, image);
  const buckets = new Set<number>();
  let sampleCount = 0;
  let luminanceSum = 0;
  let luminanceSquaredSum = 0;
  for (let y = region.top; y < region.bottom; y += 1) {
    for (let x = region.left; x < region.right; x += 1) {
      const red = channelAt(image, x, y, 0);
      const green = channelAt(image, x, y, 1);
      const blue = channelAt(image, x, y, 2);
      buckets.add((red >> 4) * 256 + (green >> 4) * 16 + (blue >> 4));
      const pixelLuminance = luminance(red, green, blue);
      luminanceSum += pixelLuminance;
      luminanceSquaredSum += pixelLuminance * pixelLuminance;
      sampleCount += 1;
    }
  }
  const meanLuminance = sampleCount > 0 ? luminanceSum / sampleCount : null;
  const variance = meanLuminance === null
    ? null
    : Math.max(0, luminanceSquaredSum / sampleCount - meanLuminance * meanLuminance);
  return {
    region,
    sampleCount,
    distinctColorBuckets: buckets.size,
    meanLuminance,
    luminanceStandardDeviation: variance === null ? null : Math.sqrt(variance),
  };
};

export const comparePixelRegions = (
  first: DecodedPng,
  second: DecodedPng,
  requestedRegion: PixelRegion,
  changedChannelThreshold = 16,
): ImageDifferenceSummary => {
  if (first.width !== second.width || first.height !== second.height || first.channels !== second.channels) {
    throw new Error("Cannot compare Observer screenshots with different dimensions or channel layouts");
  }
  const region = normalizedRegion(requestedRegion, first);
  let channelDifferenceSum = 0;
  let signedLuminanceDifferenceSum = 0;
  let changedPixelCount = 0;
  let pixelCount = 0;
  for (let y = region.top; y < region.bottom; y += 1) {
    for (let x = region.left; x < region.right; x += 1) {
      const firstRgb = [channelAt(first, x, y, 0), channelAt(first, x, y, 1), channelAt(first, x, y, 2)];
      const secondRgb = [channelAt(second, x, y, 0), channelAt(second, x, y, 1), channelAt(second, x, y, 2)];
      const differences = firstRgb.map((value, index) => Math.abs(value - (secondRgb[index] ?? value)));
      channelDifferenceSum += differences.reduce((sum, difference) => sum + difference, 0);
      if (differences.some((difference) => difference >= changedChannelThreshold)) changedPixelCount += 1;
      signedLuminanceDifferenceSum += luminance(
        secondRgb[0] ?? 0,
        secondRgb[1] ?? 0,
        secondRgb[2] ?? 0,
      ) - luminance(firstRgb[0] ?? 0, firstRgb[1] ?? 0, firstRgb[2] ?? 0);
      pixelCount += 1;
    }
  }
  return {
    meanAbsoluteRgbDifference: pixelCount > 0 ? channelDifferenceSum / (pixelCount * 3) : 0,
    changedPixelCount,
    changedPixelFraction: pixelCount > 0 ? changedPixelCount / pixelCount : 0,
    meanSignedLuminanceDifference: pixelCount > 0 ? signedLuminanceDifferenceSum / pixelCount : 0,
  };
};

export const serializeBenchmarkReport = (report: unknown): string =>
  JSON.stringify(report, null, 2);
