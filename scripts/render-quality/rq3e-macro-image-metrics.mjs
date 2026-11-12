import { access, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { inflateSync } from "node:zlib";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const filmWidthMm = 127;
const filmHeightMm = 101.6;

const usage = () => {
  console.error("Usage: node scripts/render-quality/rq3e-macro-image-metrics.mjs <before-capture-run.json> [after-capture-run.json] [--output=metrics.json]");
  process.exit(2);
};

const decodePng = async (path) => {
  const buffer = await readFile(path);
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (!buffer.subarray(0, 8).equals(signature)) throw new Error(`Not a PNG: ${path}`);
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  const imageData = [];
  for (let offset = 8; offset < buffer.length;) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      interlace = data[12];
    } else if (type === "IDAT") {
      imageData.push(data);
    } else if (type === "IEND") {
      break;
    }
    offset += length + 12;
  }

  if (bitDepth !== 8 || ![2, 6].includes(colorType) || interlace !== 0) {
    throw new Error(`Unsupported PNG encoding in ${path}: bitDepth=${bitDepth}, colorType=${colorType}, interlace=${interlace}`);
  }
  const channels = colorType === 6 ? 4 : 3;
  const bytesPerPixel = channels;
  const stride = width * channels;
  const compressed = Buffer.concat(imageData);
  const filtered = inflateSync(compressed);
  const pixels = Buffer.alloc(height * stride);
  const paeth = (a, b, c) => {
    const p = a + b - c;
    const pa = Math.abs(p - a);
    const pb = Math.abs(p - b);
    const pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
  };

  for (let y = 0; y < height; y += 1) {
    const inputOffset = y * (stride + 1);
    const filter = filtered[inputOffset];
    const rowOffset = y * stride;
    for (let x = 0; x < stride; x += 1) {
      const raw = filtered[inputOffset + 1 + x];
      const left = x >= bytesPerPixel ? pixels[rowOffset + x - bytesPerPixel] : 0;
      const above = y > 0 ? pixels[rowOffset + x - stride] : 0;
      const upperLeft = y > 0 && x >= bytesPerPixel
        ? pixels[rowOffset + x - stride - bytesPerPixel]
        : 0;
      let predictor = 0;
      if (filter === 1) predictor = left;
      else if (filter === 2) predictor = above;
      else if (filter === 3) predictor = Math.floor((left + above) / 2);
      else if (filter === 4) predictor = paeth(left, above, upperLeft);
      else if (filter !== 0) throw new Error(`Unsupported PNG filter ${filter} in ${path}`);
      pixels[rowOffset + x] = (raw + predictor) & 255;
    }
  }
  return { width, height, channels, bytesPerPixel, pixels };
};

const srgbToLinear = (channel) => {
  const value = channel / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
};

const luminanceAt = (image, x, y) => {
  const offset = (y * image.width + x) * image.channels;
  const alpha = image.channels === 4 ? image.pixels[offset + 3] / 255 : 1;
  const red = srgbToLinear(image.pixels[offset]) * alpha + (1 - alpha);
  const green = srgbToLinear(image.pixels[offset + 1]) * alpha + (1 - alpha);
  const blue = srgbToLinear(image.pixels[offset + 2]) * alpha + (1 - alpha);
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
};

const quantile = (sorted, fraction) => {
  const position = (sorted.length - 1) * fraction;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  const t = position - lower;
  return sorted[lower] * (1 - t) + sorted[upper] * t;
};

const summarizeRoi = (image, roi) => {
  const values = [];
  let gradientSum = 0;
  let gradientCount = 0;
  let nearBlack = 0;
  let clippedHighlights = 0;
  for (let y = roi.y; y < roi.y + roi.height; y += 1) {
    for (let x = roi.x; x < roi.x + roi.width; x += 1) {
      const luminance = luminanceAt(image, x, y);
      values.push(luminance);
      if (luminance < 0.01) nearBlack += 1;
      if (luminance > 0.95) clippedHighlights += 1;
      if (x + 1 < roi.x + roi.width && y + 1 < roi.y + roi.height) {
        const dx = luminanceAt(image, x + 1, y) - luminance;
        const dy = luminanceAt(image, x, y + 1) - luminance;
        gradientSum += Math.hypot(dx, dy) / Math.SQRT2;
        gradientCount += 1;
      }
    }
  }
  values.sort((a, b) => a - b);
  const count = values.length;
  return {
    pixelBounds: roi,
    pixelCount: count,
    meanLinearLuminance: values.reduce((sum, value) => sum + value, 0) / count,
    p10LinearLuminance: quantile(values, 0.1),
    p90LinearLuminance: quantile(values, 0.9),
    meanLocalLuminanceGradient: gradientSum / gradientCount,
    nearBlackFraction: nearBlack / count,
    clippedHighlightFraction: clippedHighlights / count,
  };
};

const projectedRois = (capture) => {
  const imageDistanceMm = Number(capture.runtime["data-rtt-natural-illumination-image-distance-mm"]);
  const focusDistanceMm = Number(capture.cameraState.focusDistanceMm);
  if (!Number.isFinite(imageDistanceMm) || imageDistanceMm <= 0 || focusDistanceMm <= 0) {
    throw new Error(`Missing projection inputs for ${capture.stateId}`);
  }
  const magnification = imageDistanceMm / focusDistanceMm;
  const pxPerMmX = capture.image.imageWidth * magnification / filmWidthMm;
  const pxPerMmY = capture.image.imageHeight * magnification / filmHeightMm;
  const centerX = capture.image.imageWidth / 2;
  const centerY = capture.image.imageHeight / 2;
  const roiFromWorld = (center, widthMm, heightMm) => {
    const raw = {
      x: Math.round(centerX + center[0] * pxPerMmX - widthMm * pxPerMmX / 2),
      y: Math.round(centerY + center[1] * pxPerMmY - heightMm * pxPerMmY / 2),
      width: Math.max(1, Math.round(widthMm * pxPerMmX)),
      height: Math.max(1, Math.round(heightMm * pxPerMmY)),
    };
    const x = Math.max(0, raw.x);
    const y = Math.max(0, raw.y);
    const right = Math.min(capture.image.imageWidth, raw.x + raw.width);
    const bottom = Math.min(capture.image.imageHeight, raw.y + raw.height);
    return { x, y, width: Math.max(0, right - x), height: Math.max(0, bottom - y) };
  };
  return {
    projection: {
      method: "paraxial projection of source-defined PCB landmarks; ROI scales with recorded image distance/focus distance",
      magnification,
      pxPerMmX,
      pxPerMmY,
      filmWidthMm,
      filmHeightMm,
    },
    rois: {
      near: roiFromWorld([0, -45], 80, 22),
      middle: roiFromWorld([18, 0], 38, 28),
      far: roiFromWorld([0, 40], 80, 14),
      copperTrace: roiFromWorld([-11.5, 15], 28, 8),
      silkscreen: roiFromWorld([-25, -42], 30, 10),
      backgroundControl: { x: 16, y: 16, width: 56, height: 40 },
    },
  };
};

const measureRun = async (captureRunPath) => {
  const resolvedRunPath = resolve(repositoryRoot, captureRunPath);
  const run = JSON.parse(await readFile(resolvedRunPath, "utf8"));
  if (run.schemaVersion !== "rq3e-macro-oblique-capture-v1" || run.sourceTreeStatus !== "clean") {
    throw new Error(`Unsupported or dirty capture run: ${captureRunPath}`);
  }
  const captures = run.captures.filter((capture) => capture.captureRole === "photographic-ground-glass-reference");
  if (captures.length !== 4) throw new Error(`Expected four Ground Glass states in ${captureRunPath}`);
  const results = [];
  for (const capture of captures) {
    let imagePath = resolve(repositoryRoot, capture.image.imagePath);
    try {
      await access(imagePath);
    } catch {
      imagePath = resolve(dirname(resolvedRunPath), capture.image.imagePath);
    }
    const image = await decodePng(imagePath);
    if (image.width !== 450 || image.height !== 360) throw new Error(`Unexpected dimensions in ${imagePath}`);
    const { projection, rois } = projectedRois(capture);
    const metrics = Object.fromEntries(Object.entries(rois).map(([name, roi]) => {
      if (roi.width < 1 || roi.height < 1) throw new Error(`Invalid ${name} ROI for ${capture.stateId}`);
      return [name, summarizeRoi(image, roi)];
    }));
    results.push({
      stateId: capture.stateId,
      focusDistanceMm: capture.cameraState.focusDistanceMm,
      frontTiltDeg: capture.cameraState.movements.find((movement) => movement.label === "Front Tilt")?.value,
      imagePath: capture.image.imagePath,
      sha256: capture.image.sha256,
      projection,
      metrics,
    });
  }
  return {
    captureRunId: run.captureRunId,
    capturePhase: run.capturePhase,
    sourceCommit: run.sourceCommit,
    browser: run.browser,
    operatingSystem: run.operatingSystem,
    states: results,
  };
};

const args = process.argv.slice(2);
const outputFlag = args.find((argument) => argument.startsWith("--output="));
const runPaths = args.filter((argument) => !argument.startsWith("--"));
if (runPaths.length < 1 || runPaths.length > 2) usage();
const measuredRuns = await Promise.all(runPaths.map((path) => measureRun(resolve(repositoryRoot, path))));
const output = {
  schemaVersion: "rq3e-macro-image-metrics-v1",
  luminance: "linear Rec.709 converted from PNG sRGB",
  thresholds: { nearBlack: "<0.01", clippedHighlights: ">0.95" },
  caveat: "Local contrast is a readability diagnostic, not a physical sharpness or photographic-ground-truth metric.",
  runs: measuredRuns,
  comparison: measuredRuns.length === 2 ? measuredRuns[0].states.map((before) => {
    const after = measuredRuns[1].states.find((candidate) => candidate.stateId === before.stateId);
    if (!after) throw new Error(`After run is missing ${before.stateId}`);
    return {
      stateId: before.stateId,
      rois: Object.fromEntries(Object.keys(before.metrics).map((roiName) => {
        const beforeMetrics = before.metrics[roiName];
        const afterMetrics = after.metrics[roiName];
        return [roiName, Object.fromEntries([
          "meanLinearLuminance",
          "p10LinearLuminance",
          "p90LinearLuminance",
          "meanLocalLuminanceGradient",
          "nearBlackFraction",
          "clippedHighlightFraction",
        ].map((metricName) => [metricName, {
          before: beforeMetrics[metricName],
          after: afterMetrics[metricName],
          difference: afterMetrics[metricName] - beforeMetrics[metricName],
        }]))];
      })),
    };
  }) : null,
};

if (outputFlag) {
  const outputPath = resolve(repositoryRoot, outputFlag.slice("--output=".length));
  await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`);
} else {
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
}
