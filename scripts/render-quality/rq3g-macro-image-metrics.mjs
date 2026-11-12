import { createHash } from "node:crypto";
import { access, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { inflateSync } from "node:zlib";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const expectedStates = [
  { stateId: "b1-initial", focusDistanceMm: 900, apertureFNumber: 5.6, imageDistanceMm: 180, magnification: 0.2, imageCircleDiameterMm: 261.56 },
  { stateId: "b2-intermediate", focusDistanceMm: 450, apertureFNumber: 5.6, imageDistanceMm: 225, magnification: 0.5, imageCircleDiameterMm: 326.94 },
  { stateId: "b3-life-size", focusDistanceMm: 300, apertureFNumber: 5.6, imageDistanceMm: 300, magnification: 1, imageCircleDiameterMm: 435.93 },
  { stateId: "b4-life-size-f11", focusDistanceMm: 300, apertureFNumber: 11, imageDistanceMm: 300, magnification: 1, imageCircleDiameterMm: 435.93 },
  { stateId: "b5-life-size-f22", focusDistanceMm: 300, apertureFNumber: 22, imageDistanceMm: 300, magnification: 1, imageCircleDiameterMm: 435.93 },
];
const sourceGeometry = {
  faceCenterMm: { x: 0, y: 0 },
  outerRimRadiusMm: 44.4,
  facePlateRadiiMm: { inner: 30.8, outer: 34 },
  insetRadiusMm: 30.8,
  raisedRingsMm: [44.4, 35, 17],
  radialTickRadiusMm: 40,
  fastenerOrbitRadiusMm: 24.5,
};
const nearBlackThreshold = 0.01;
const clippedHighlightThreshold = 0.95;
const camera = { focalLengthMm: 150, sampledFilmWidthMm: 127 };

const fail = (message) => { throw new Error(message); };

const decodePng = (buffer) => {
  if (!buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) fail("input is not PNG");
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
    } else if (type === "IDAT") imageData.push(data);
    else if (type === "IEND") break;
    offset += length + 12;
  }
  if (!width || !height || bitDepth !== 8 || ![2, 6].includes(colorType) || interlace !== 0) {
    fail(`unsupported PNG format: ${width}x${height}, depth=${bitDepth}, type=${colorType}, interlace=${interlace}`);
  }
  const channels = colorType === 6 ? 4 : 3;
  const stride = width * channels;
  const bytesPerPixel = channels;
  const inflated = inflateSync(Buffer.concat(imageData));
  if (inflated.length !== (stride + 1) * height) fail("unexpected PNG scanline length");
  const pixels = Buffer.alloc(stride * height);
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
    const filter = inflated[inputOffset];
    for (let x = 0; x < stride; x += 1) {
      const raw = inflated[inputOffset + 1 + x];
      const left = x >= bytesPerPixel ? pixels[rowOffset + x - bytesPerPixel] : 0;
      const above = y > 0 ? pixels[rowOffset + x - stride] : 0;
      const upperLeft = y > 0 && x >= bytesPerPixel ? pixels[rowOffset + x - stride - bytesPerPixel] : 0;
      let predictor = 0;
      if (filter === 1) predictor = left;
      else if (filter === 2) predictor = above;
      else if (filter === 3) predictor = Math.floor((left + above) / 2);
      else if (filter === 4) predictor = paeth(left, above, upperLeft);
      else if (filter !== 0) fail(`unsupported PNG filter ${filter}`);
      pixels[rowOffset + x] = (raw + predictor) & 255;
    }
  }
  const luminance = new Float32Array(width * height);
  const toLinear = (channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  for (let index = 0; index < width * height; index += 1) {
    const offset = index * channels;
    const alpha = channels === 4 ? pixels[offset + 3] / 255 : 1;
    const red = toLinear(pixels[offset]) * alpha + (1 - alpha);
    const green = toLinear(pixels[offset + 1]) * alpha + (1 - alpha);
    const blue = toLinear(pixels[offset + 2]) * alpha + (1 - alpha);
    luminance[index] = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  }
  return { width, height, luminance };
};

const quantile = (sorted, fraction) => {
  const position = (sorted.length - 1) * fraction;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  const ratio = position - lower;
  return sorted[lower] * (1 - ratio) + sorted[upper] * ratio;
};

const summarizeRoi = (image, contains) => {
  const luminances = [];
  let gradientSum = 0;
  let gradientCount = 0;
  let nearBlack = 0;
  let clipped = 0;
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      if (!contains(x + 0.5, y + 0.5)) continue;
      const value = image.luminance[y * image.width + x];
      luminances.push(value);
      if (value < nearBlackThreshold) nearBlack += 1;
      if (value > clippedHighlightThreshold) clipped += 1;
      if (x + 1 < image.width && y + 1 < image.height && contains(x + 1.5, y + 0.5) && contains(x + 0.5, y + 1.5)) {
        const right = image.luminance[y * image.width + x + 1];
        const below = image.luminance[(y + 1) * image.width + x];
        gradientSum += Math.hypot(right - value, below - value) / Math.SQRT2;
        gradientCount += 1;
      }
    }
  }
  if (luminances.length === 0) fail("ROI contains no pixels");
  luminances.sort((a, b) => a - b);
  const mean = luminances.reduce((sum, value) => sum + value, 0) / luminances.length;
  const p10 = quantile(luminances, 0.1);
  const p90 = quantile(luminances, 0.9);
  return {
    pixels: luminances.length,
    meanLinearLuminance: mean,
    p10LinearLuminance: p10,
    p90LinearLuminance: p90,
    p10ToP90Range: p90 - p10,
    meanLocalLuminanceGradient: gradientCount ? gradientSum / gradientCount : 0,
    nearBlackFraction: nearBlack / luminances.length,
    clippedHighlightFraction: clipped / luminances.length,
  };
};

const resolveImage = async (runPath, imagePath) => {
  const candidates = [resolve(repositoryRoot, imagePath), resolve(dirname(runPath), imagePath)];
  for (const candidate of candidates) {
    try { await access(candidate); return candidate; } catch (error) { if (error?.code !== "ENOENT") throw error; }
  }
  fail(`capture PNG missing: ${imagePath}`);
};

const closeTo = (actual, expected, tolerance = 0.02) => Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance;

const measureRun = async (runPath) => {
  const absoluteRunPath = resolve(repositoryRoot, runPath);
  const run = JSON.parse(await readFile(absoluteRunPath, "utf8"));
  if (run.schemaVersion !== "rq3g-macro-bellows-capture-v1" || run.sourceTreeStatus !== "clean" || !/^[0-9a-f]{40}$/.test(run.sourceCommit)) {
    fail(`unsupported, dirty, or unpinned capture run: ${runPath}`);
  }
  const movementValues = Object.values(run.cameraMovementEvidence?.movementValues ?? {});
  if (run.cameraPreset !== "scene-definition:macro-bellows-extension.cameraPreset" ||
    run.cameraMovementEvidence?.controlPolicy !== "fixed" ||
    run.cameraMovementEvidence?.movementControls?.length !== 0 ||
    movementValues.length !== 8 || movementValues.some((value) => value !== 0)) {
    fail(`camera movement preset evidence mismatch in ${runPath}`);
  }
  if (run.pageErrors?.length || run.consoleErrors?.length) fail(`browser errors in capture run: ${runPath}`);
  const captures = run.captures.filter((capture) => capture.captureRole === "photographic-ground-glass-reference");
  if (captures.length !== expectedStates.length) fail(`expected five Ground Glass states in ${runPath}`);
  const measurements = [];
  const byState = new Map();
  for (const expected of expectedStates) {
    const capture = captures.find((candidate) => candidate.stateId === expected.stateId);
    if (!capture) fail(`missing ${expected.stateId} in ${runPath}`);
    const cameraState = capture.cameraState;
    if (cameraState.focalLengthMm !== camera.focalLengthMm || cameraState.focusDistanceMm !== expected.focusDistanceMm ||
      cameraState.apertureFNumber !== expected.apertureFNumber || capture.renderQuality !== "standard" ||
      capture.previewMode !== "Raw" || capture.rawDebug !== false || capture.gridEnabled !== false ||
      capture.contentful !== true || capture.frame?.acceptedByHost !== true ||
      capture.frame?.requestId !== capture.frame?.lastCompletedRequestId || !capture.frame.requestId) {
      fail(`camera, preview, or accepted-frame evidence mismatch in ${expected.stateId}`);
    }
    const renderer = capture.rendererIdentity;
    if (renderer.rendererFamily !== "webgl-renderer" || renderer.executionApi !== "webgl2" ||
      renderer.rendererRevision !== "187" || renderer.internalFallback !== "none" ||
      renderer.applicationFallback !== "not-observed") fail(`unexpected runtime identity in ${expected.stateId}`);
    const optics = capture.opticalDiagnostics;
    const calculatedImageDistance = camera.focalLengthMm * expected.focusDistanceMm /
      (expected.focusDistanceMm - camera.focalLengthMm);
    const calculatedGain = (11 / expected.apertureFNumber) ** 2 * (camera.focalLengthMm / calculatedImageDistance) ** 2;
    const measuredImageDistance = Number(optics.imageDistanceMm);
    const measuredGain = Number(optics.illuminanceGain);
    const measuredMagnification = Number(String(optics.magnificationReadout).replace("×", ""));
    const measuredCircleDiameter = Number(optics.coverageRadiusMm) * 2;
    if (!closeTo(measuredImageDistance, expected.imageDistanceMm, 0.01) ||
      !closeTo(measuredGain, calculatedGain, 0.0001) ||
      !closeTo(measuredMagnification, expected.magnification, 0.005) ||
      !closeTo(measuredCircleDiameter, expected.imageCircleDiameterMm, 0.1)) {
      fail(`physical readout mismatch in ${expected.stateId}: ${JSON.stringify(optics)}`);
    }
    if (capture.display?.dpr !== 1 || capture.image.imageWidth !== 450 || capture.image.imageHeight !== 360) {
      fail(`unexpected viewport/display dimensions in ${expected.stateId}`);
    }
    const imagePath = await resolveImage(absoluteRunPath, capture.image.imagePath);
    const pngBytes = await readFile(imagePath);
    const sha256 = createHash("sha256").update(pngBytes).digest("hex");
    if (sha256 !== capture.image.sha256) fail(`PNG digest mismatch in ${expected.stateId}`);
    const image = decodePng(pngBytes);
    if (image.width !== 450 || image.height !== 360) fail(`PNG dimensions mismatch in ${expected.stateId}`);
    let rois = null;
    let roiMeasurementNote = "Geometry ROIs are only defined for the 1:1 image projection.";
    if (closeTo(measuredMagnification, 1, 0.005)) {
      const scale = image.width / camera.sampledFilmWidthMm;
      const centerX = image.width / 2;
      const centerY = image.height / 2;
      const physicalXY = (x, y) => ({ xMm: (x - centerX) / scale, yMm: (y - centerY) / scale });
      const radius = (x, y) => {
        const point = physicalXY(x, y);
        return Math.hypot(point.xMm, point.yMm);
      };
      const fastenerCenters = Array.from({ length: 8 }, (_, index) => {
        const angle = (index * Math.PI * 2) / 8 + Math.PI / 8;
        return { xMm: sourceGeometry.fastenerOrbitRadiusMm * Math.sin(angle), yMm: sourceGeometry.fastenerOrbitRadiusMm * Math.cos(angle) };
      });
      const roiPredicates = {
        wholeSpecimen: (x, y) => radius(x, y) <= 45,
        outerMetallicRim: (x, y) => radius(x, y) >= sourceGeometry.outerRimRadiusMm - 0.8 && radius(x, y) <= 45,
        raisedFacePlate: (x, y) => {
          const value = radius(x, y);
          return value >= sourceGeometry.facePlateRadiiMm.inner && value <= sourceGeometry.facePlateRadiiMm.outer;
        },
        darkCentralInset: (x, y) => radius(x, y) <= sourceGeometry.insetRadiusMm - 0.6,
        centralAsymmetricReliefBounds: (x, y) => {
          const point = physicalXY(x, y);
          return Math.abs(point.xMm) <= 11.5 && Math.abs(point.yMm) <= 14.5;
        },
        radialTicks: (x, y) => {
          const value = radius(x, y);
          return value >= sourceGeometry.radialTickRadiusMm - 2.2 && value <= sourceGeometry.radialTickRadiusMm + 2.2;
        },
        fastenersAndSlots: (x, y) => {
          const point = physicalXY(x, y);
          return fastenerCenters.some((center) => Math.hypot(point.xMm - center.xMm, point.yMm - center.yMm) <= 2.1);
        },
        backgroundControl: (x, y) => x >= 18 && x < 52 && y >= 18 && y < 52,
      };
      rois = Object.fromEntries(Object.entries(roiPredicates).map(([id, predicate]) => [id, summarizeRoi(image, predicate)]));
      roiMeasurementNote = "Geometry ROIs measured at the verified 1:1 image projection.";
    }
    const measurement = {
      stateId: expected.stateId,
      focusDistanceMm: expected.focusDistanceMm,
      apertureFNumber: expected.apertureFNumber,
      imageDistanceMm: measuredImageDistance,
      magnification: measuredMagnification,
      actualGroundGlassGain: measuredGain,
      imageCircleDiameterMm: measuredCircleDiameter,
      sourceCommit: run.sourceCommit,
      sourceTreeStatus: run.sourceTreeStatus,
      rendererIdentity: renderer,
      frame: capture.frame,
      image: { path: capture.image.imagePath, width: image.width, height: image.height, sha256 },
      roiMeasurementNote,
      rois,
    };
    measurements.push(measurement);
    byState.set(expected.stateId, { capture, imagePath, measurement });
  }

  const secondary = run.captures.filter((capture) => capture.captureRole === "secondary-macro-regression-reference");
  if (secondary.length !== 3) fail(`expected three unchanged Macro controls in ${runPath}`);
  const secondaryDigests = {};
  for (const capture of secondary) {
    const imagePath = await resolveImage(absoluteRunPath, capture.image.imagePath);
    const bytes = await readFile(imagePath);
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    if (sha256 !== capture.image.sha256) fail(`secondary scene digest mismatch: ${capture.stateId}`);
    secondaryDigests[capture.sceneId] = sha256;
  }
  return {
    runPath,
    run,
    measurements,
    byState,
    secondaryDigests,
  };
};

const args = process.argv.slice(2);
const outputArg = args.find((argument) => argument.startsWith("--output="));
const runPaths = args.filter((argument) => !argument.startsWith("--"));
if (runPaths.length !== 2) {
  console.error("Usage: node scripts/render-quality/rq3g-macro-image-metrics.mjs <before/captures/capture-run.json> <after/captures/capture-run.json> [--output=metrics.json]");
  process.exit(2);
}
const [before, after] = await Promise.all(runPaths.map(measureRun));
if (before.run.capturePhase !== "before" || after.run.capturePhase !== "after") fail("capture phases must be before then after");
if (before.run.browser?.version !== after.run.browser?.version ||
  JSON.stringify(before.run.operatingSystem) !== JSON.stringify(after.run.operatingSystem)) {
  fail("Before and After must use the same browser and operating system for a matched comparison");
}
const sameControls = Object.fromEntries(Object.keys(before.secondaryDigests).map((sceneId) => [
  sceneId,
  {
    beforeSha256: before.secondaryDigests[sceneId],
    afterSha256: after.secondaryDigests[sceneId],
    byteIdentical: before.secondaryDigests[sceneId] === after.secondaryDigests[sceneId],
  },
]));
const beforeB3 = before.byState.get("b3-life-size").measurement;
const afterB3 = after.byState.get("b3-life-size").measurement;
const roiDeltas = Object.fromEntries(Object.keys(beforeB3.rois).map((roiId) => {
  const prior = beforeB3.rois[roiId];
  const current = afterB3.rois[roiId];
  return [roiId, {
    beforeMeanLinearLuminance: prior.meanLinearLuminance,
    afterMeanLinearLuminance: current.meanLinearLuminance,
    meanLinearLuminanceDelta: current.meanLinearLuminance - prior.meanLinearLuminance,
    meanLinearLuminancePercentChange: prior.meanLinearLuminance === 0 ? null : (current.meanLinearLuminance / prior.meanLinearLuminance - 1) * 100,
    beforeP10ToP90Range: prior.p10ToP90Range,
    afterP10ToP90Range: current.p10ToP90Range,
    beforeMeanLocalLuminanceGradient: prior.meanLocalLuminanceGradient,
    afterMeanLocalLuminanceGradient: current.meanLocalLuminanceGradient,
    beforeNearBlackFraction: prior.nearBlackFraction,
    afterNearBlackFraction: current.nearBlackFraction,
    beforeClippedHighlightFraction: prior.clippedHighlightFraction,
    afterClippedHighlightFraction: current.clippedHighlightFraction,
  }];
}));
const output = {
  schemaVersion: "rq3g-macro-bellows-image-metrics-v1",
  method: {
    luminance: "linear Rec.709 decoded from captured sRGB PNG values; no exposure or white-balance normalization",
    physicalScale: "captured 450 px width / 127 mm sampled film width at the verified 1:1 B3 state",
    imageOrigin: "captured Ground Glass center (225,180 px); circular masks are orientation independent; asymmetric-relief bounds use the source geometry projected about this center",
    roiDefinitions: {
      outerMetallicRim: "physical-radius annulus 43.6–45.0 mm from specimen center",
      raisedFacePlate: "source geometry annulus 30.8–34.0 mm",
      darkCentralInset: "central disk with radius 30.2 mm (source inset radius 30.8 mm minus a 0.6 mm edge margin)",
      centralAsymmetricReliefBounds: "source-geometry bounding box |x|≤11.5 mm, |y|≤14.5 mm around the relief vertices",
      radialTicks: "annulus 37.8–42.2 mm around the source radial tick circle at radius 40 mm",
      fastenersAndSlots: "eight radius-2.1 mm disks around the source fastener centers on a 24.5 mm orbit",
      backgroundControl: "fixed empty-film pixel patch x=18..51, y=18..51 from the screenshot top-left; outside the 90 mm specimen",
    },
    thresholds: { nearBlackLinearLuminance: nearBlackThreshold, clippedHighlightLinearLuminance: clippedHighlightThreshold },
    localGradient: "mean forward luminance gradient within the ROI; material contrast and optical blur both affect it, so it is not physical sharpness",
    comparisonLimits: "geometry-based ROIs are measured only for 1:1 states; B1/B2 are retained as optical and visual controls without ROI metrics; the B3 measures are readability diagnostics, not photographic ground truth",
  },
  captures: {
    before: { captureRunId: before.run.captureRunId, sourceCommit: before.run.sourceCommit, browser: before.run.browser, operatingSystem: before.run.operatingSystem, states: before.measurements },
    after: { captureRunId: after.run.captureRunId, sourceCommit: after.run.sourceCommit, browser: after.run.browser, operatingSystem: after.run.operatingSystem, states: after.measurements },
  },
  b3RoiComparison: roiDeltas,
  crossSceneRegression: sameControls,
};
const serialized = `${JSON.stringify(output, null, 2)}\n`;
if (outputArg) {
  const outputPath = resolve(repositoryRoot, outputArg.slice("--output=".length));
  await writeFile(outputPath, serialized);
} else process.stdout.write(serialized);
