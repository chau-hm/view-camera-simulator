import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { inflateSync } from "node:zlib";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const expectedStates = [
  { stateId: "c1-neutral", focusDistanceMm: 500, frontTiltDeg: 0, frontSwingDeg: 0 },
  { stateId: "c2-tilt-only", focusDistanceMm: 490, frontTiltDeg: 3.4, frontSwingDeg: 0 },
  { stateId: "c3-swing-only", focusDistanceMm: 490, frontTiltDeg: 0, frontSwingDeg: -2.8 },
  { stateId: "c4-partial-alignment", focusDistanceMm: 490, frontTiltDeg: 3.3, frontSwingDeg: -2.7 },
  { stateId: "c5-aligned", focusDistanceMm: 490, frontTiltDeg: 3.4, frontSwingDeg: -2.8 },
];

// Fixed 450x360 pixel boxes mapped to named geometry on the C5 reference image.
// The same boxes are applied to every matched state and both capture runs.
const roiDefinitions = {
  nearLeftGearScale: {
    stationId: "macro-compound-near-left",
    features: ["gear rim", "engraved circle", "scale ticks", "baseline"],
    rationale: "Bounding box around the source-defined 19.2 mm gear rim and top scale detail.",
    pixelBounds: { x: 62, y: 104, width: 64, height: 64 },
  },
  centreConcentricTarget: {
    stationId: "macro-compound-centre",
    features: ["outer bezel", "target rings A/B", "crosshair", "precision marks"],
    rationale: "Bounding box around the source-defined concentric target and crosshair.",
    pixelBounds: { x: 193, y: 183, width: 64, height: 64 },
  },
  farRightFineArray: {
    stationId: "macro-compound-far-right",
    features: ["pad array", "horizontal traces", "axis line"],
    rationale: "Bounding box around the source-defined 5x4 pad array and adjacent fine traces.",
    pixelBounds: { x: 331, y: 143, width: 38, height: 38 },
  },
  fixtureRail: {
    stationId: null,
    features: ["horizontal fixture rail"],
    rationale: "Fixed dark rail control outside the three precision surfaces.",
    pixelBounds: { x: 126, y: 82, width: 210, height: 15 },
  },
  background: {
    stationId: null,
    features: ["empty film background"],
    rationale: "Fixed empty upper-left film area, away from the subject and guides.",
    pixelBounds: { x: 16, y: 16, width: 42, height: 42 },
  },
};

const usage = () => {
  console.error("Usage: node scripts/render-quality/rq3f-macro-image-metrics.mjs <before-capture-run.json> [after-capture-run.json] [--output=metrics.json]");
  process.exit(2);
};

const decodePng = (buffer) => {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (!buffer.subarray(0, 8).equals(signature)) throw new Error("Not a PNG");
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
    throw new Error(`Unsupported PNG format: bitDepth=${bitDepth}, colorType=${colorType}, interlace=${interlace}`);
  }
  const channels = colorType === 6 ? 4 : 3;
  const stride = width * channels;
  const bytesPerPixel = channels;
  const filtered = inflateSync(Buffer.concat(imageData));
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
    const rowOffset = y * stride;
    const filter = filtered[inputOffset];
    for (let x = 0; x < stride; x += 1) {
      const raw = filtered[inputOffset + 1 + x];
      const left = x >= bytesPerPixel ? pixels[rowOffset + x - bytesPerPixel] : 0;
      const above = y > 0 ? pixels[rowOffset + x - stride] : 0;
      const upperLeft = y > 0 && x >= bytesPerPixel ? pixels[rowOffset + x - stride - bytesPerPixel] : 0;
      let predictor = 0;
      if (filter === 1) predictor = left;
      else if (filter === 2) predictor = above;
      else if (filter === 3) predictor = Math.floor((left + above) / 2);
      else if (filter === 4) predictor = paeth(left, above, upperLeft);
      else if (filter !== 0) throw new Error(`Unsupported PNG filter ${filter}`);
      pixels[rowOffset + x] = (raw + predictor) & 255;
    }
  }
  return { width, height, channels, pixels };
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
  let nearBlackCount = 0;
  let clippedCount = 0;
  for (let y = roi.y; y < roi.y + roi.height; y += 1) {
    for (let x = roi.x; x < roi.x + roi.width; x += 1) {
      const luminance = luminanceAt(image, x, y);
      values.push(luminance);
      if (luminance < 0.01) nearBlackCount += 1;
      if (luminance > 0.95) clippedCount += 1;
      if (x + 1 < roi.x + roi.width && y + 1 < roi.y + roi.height) {
        const dx = luminanceAt(image, x + 1, y) - luminance;
        const dy = luminanceAt(image, x, y + 1) - luminance;
        gradientSum += Math.hypot(dx, dy) / Math.SQRT2;
        gradientCount += 1;
      }
    }
  }
  values.sort((a, b) => a - b);
  return {
    pixelBounds: roi,
    pixelCount: values.length,
    meanLinearLuminance: values.reduce((sum, value) => sum + value, 0) / values.length,
    p10LinearLuminance: quantile(values, 0.1),
    p90LinearLuminance: quantile(values, 0.9),
    meanLocalLuminanceGradient: gradientSum / gradientCount,
    nearBlackFraction: nearBlackCount / values.length,
    clippedHighlightFraction: clippedCount / values.length,
  };
};

const measureRun = async (runPath) => {
  const run = JSON.parse(await readFile(resolve(repositoryRoot, runPath), "utf8"));
  if (run.schemaVersion !== "rq3f-macro-compound-capture-v1" || run.sourceTreeStatus !== "clean") {
    throw new Error(`Unsupported or non-clean capture run: ${runPath}`);
  }
  const captures = run.captures.filter((capture) => capture.captureRole === "photographic-ground-glass-reference");
  if (captures.length !== expectedStates.length) throw new Error(`Expected five Ground Glass states in ${runPath}`);
  const states = [];
  for (let index = 0; index < expectedStates.length; index += 1) {
    const expected = expectedStates[index];
    const capture = captures.find((candidate) => candidate.stateId === expected.stateId);
    if (!capture) throw new Error(`Missing ${expected.stateId} in ${runPath}`);
    const state = capture.cameraState;
    if (state.focusDistanceMm !== expected.focusDistanceMm || state.frontTiltDeg !== expected.frontTiltDeg ||
      state.frontSwingDeg !== expected.frontSwingDeg || state.focalLengthMm !== 150 || state.apertureFNumber !== 5.6) {
      throw new Error(`Camera state mismatch for ${capture.stateId}`);
    }
    if (capture.previewMode !== "Raw" || capture.rawDebug !== false || capture.renderQuality !== "standard" ||
      capture.contentful !== true || capture.frame?.acceptedByHost !== true ||
      capture.frame?.requestId !== capture.frame?.lastCompletedRequestId) {
      throw new Error(`Frame or preview evidence invalid for ${capture.stateId}`);
    }
    if (capture.rendererIdentity?.rendererFamily !== "webgl-renderer" || capture.rendererIdentity?.executionApi !== "webgl2" ||
      capture.rendererIdentity?.internalFallback !== "none" || capture.rendererIdentity?.applicationFallback !== "not-observed") {
      throw new Error(`Unexpected renderer identity in ${capture.stateId}`);
    }
    const imagePath = resolve(repositoryRoot, capture.image.imagePath);
    const bytes = await readFile(imagePath);
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    if (sha256 !== capture.image.sha256) throw new Error(`PNG SHA-256 mismatch: ${imagePath}`);
    const image = decodePng(bytes);
    if (image.width !== 450 || image.height !== 360 || image.width !== capture.image.imageWidth || image.height !== capture.image.imageHeight) {
      throw new Error(`Unexpected dimensions: ${imagePath}`);
    }
    const metrics = Object.fromEntries(Object.entries(roiDefinitions).map(([key, definition]) => {
      const { x, y, width, height } = definition.pixelBounds;
      if (x < 0 || y < 0 || width < 1 || height < 1 || x + width > image.width || y + height > image.height) {
        throw new Error(`Invalid ${key} ROI for ${capture.stateId}`);
      }
      return [key, summarizeRoi(image, definition.pixelBounds)];
    }));
    states.push({
      stateId: capture.stateId,
      focusDistanceMm: state.focusDistanceMm,
      frontTiltDeg: state.frontTiltDeg,
      frontSwingDeg: state.frontSwingDeg,
      imagePath: capture.image.imagePath,
      sha256,
      metrics,
    });
  }
  return {
    captureRunId: run.captureRunId,
    capturePhase: run.capturePhase,
    sourceCommit: run.sourceCommit,
    browser: run.browser,
    operatingSystem: run.operatingSystem,
    rendererIdentity: { rendererFamily: "webgl-renderer", executionApi: "webgl2", rendererRevision: "r187" },
    states,
  };
};

const args = process.argv.slice(2);
const outputArgument = args.find((argument) => argument.startsWith("--output="));
const runPaths = args.filter((argument) => !argument.startsWith("--"));
if (runPaths.length < 1 || runPaths.length > 2) usage();
const runs = await Promise.all(runPaths.map(measureRun));
const output = {
  schemaVersion: "rq3f-macro-compound-image-metrics-v1",
  luminance: "linear Rec.709 converted from PNG sRGB",
  thresholds: { nearBlack: "<0.01", clippedHighlights: ">0.95" },
  roiDefinitions,
  caveat: "Fixed feature ROIs are readability diagnostics, not physical sharpness or photographic ground truth. The station ROI gradient combines material contrast and optical blur.",
  runs,
  comparison: runs.length === 2 ? expectedStates.map(({ stateId }) => {
    const before = runs[0].states.find((state) => state.stateId === stateId);
    const after = runs[1].states.find((state) => state.stateId === stateId);
    if (!before || !after) throw new Error(`Matched state missing for ${stateId}`);
    return {
      stateId,
      rois: Object.fromEntries(Object.keys(roiDefinitions).map((roiName) => [roiName,
        Object.fromEntries([
          "meanLinearLuminance",
          "p10LinearLuminance",
          "p90LinearLuminance",
          "meanLocalLuminanceGradient",
          "nearBlackFraction",
          "clippedHighlightFraction",
        ].map((metricName) => [metricName, {
          before: before.metrics[roiName][metricName],
          after: after.metrics[roiName][metricName],
          difference: after.metrics[roiName][metricName] - before.metrics[roiName][metricName],
        }]))],
      )),
    };
  }) : null,
};
if (outputArgument) {
  await writeFile(resolve(repositoryRoot, outputArgument.slice("--output=".length)), `${JSON.stringify(output, null, 2)}\n`);
} else {
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
}
