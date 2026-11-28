const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const metricsUrl = pathToFileURL(path.join(__dirname, "edge-metrics.mjs")).href;
const defaultInput = path.resolve(__dirname, "../evidence/hdr-optics-v5/optical");
const caseNames = [
  "focus-near", "focus-middle", "focus-far",
  "tilt-positive", "tilt-negative", "swing-positive", "swing-negative", "combined",
];
const replicates = 2000;
const phaseBins = 4;
const pixelDifferenceFloorPx = 0.25;

const compareRanks = (a, b) => {
  if (a.measurement.width10to90Px === b.measurement.width10to90Px) return 0;
  return a.measurement.width10to90Px - b.measurement.width10to90Px;
};

const bootstrapDifference = (a, b, minimumResolvableDifferencePx) => {
  const low = a.measurement.bootstrap95Px[0] - b.measurement.bootstrap95Px[1];
  const high = a.measurement.bootstrap95Px[1] - b.measurement.bootstrap95Px[0];
  const phaseMargin = (a.measurement.phaseSweep.envelopePx + b.measurement.phaseSweep.envelopePx) / 2
    + minimumResolvableDifferencePx;
  if (!a.measurement.phaseSweep.adequate || !b.measurement.phaseSweep.adequate) return { status: "INCONCLUSIVE_PHASE_SWEEP" };
  if (low > phaseMargin) return { status: "A_EDGE_WIDER_RESOLVED", deltaIntervalPx: [low, high], phaseMarginPx: phaseMargin };
  if (high < -phaseMargin) return { status: "B_EDGE_WIDER_RESOLVED", deltaIntervalPx: [low, high], phaseMarginPx: phaseMargin };
  return { status: "INCONCLUSIVE_WITHIN_PIXEL_PHASE_TOLERANCE", deltaIntervalPx: [low, high], phaseMarginPx: phaseMargin };
};

async function main() {
  const inputDir = path.resolve(process.argv[2] || defaultInput);
  const outputPath = process.argv[3] ? path.resolve(process.argv[3]) : null;
  const {
    cropRgba,
    decodePngRgba,
    measureVerticalEdgeRows,
    resizeRgbaBilinear,
  } = await import(metricsUrl);
  const manifest = JSON.parse(fs.readFileSync(path.join(inputDir, "manifest.json"), "utf8"));
  if (manifest.dirtySource) throw new Error("Refusing dirty v5 source captures");
  const cases = [];
  for (const name of caseNames) {
    const record = JSON.parse(fs.readFileSync(path.join(inputDir, `${name}.json`), "utf8"));
    const state = record.state;
    const info = state.observation.info;
    const width = info.canvasCssWidthPx;
    const height = info.canvasCssHeightPx;
    const image = resizeRgbaBilinear(
      decodePngRgba(fs.readFileSync(path.join(inputDir, record.screenshot))),
      width,
      height,
    );
    const measurements = [];
    for (const feature of record.features) {
      const captureMeasurement = record.measurements.find((entry) => entry.id === feature.id);
      if (!captureMeasurement?.measurement.valid || !feature.valid) {
        measurements.push({ id: feature.id, valid: false, rejection: captureMeasurement?.measurement.rejection ?? feature.rejection });
        continue;
      }
      const crop = cropRgba(image, captureMeasurement.roi);
      const seed = name.split("").reduce((sum, character) => sum + character.charCodeAt(0), 0)
        + feature.id.split("").reduce((sum, character) => sum + character.charCodeAt(0), 0);
      const measurement = measureVerticalEdgeRows(crop, captureMeasurement.roi.width, captureMeasurement.roi.height, {
        replicates, seed, phaseBins,
      });
      measurements.push({
        id: feature.id,
        valid: measurement.valid,
        worldMm: feature.worldMm,
        signedFocusPlaneDistanceMm: feature.signedFocusDistanceMm,
        canonicalSignedCoCDiameterMm: feature.footprint.signedCoCDiameterMm,
        canonicalMajorRadiusDisplayPx: feature.majorRadiusDisplayPx,
        canonicalMinorRadiusMm: feature.footprint.minorRadiusMm,
        canonicalFootprintOrientationRad: feature.footprint.orientationRad,
        projectedUv: [feature.projected.uRaw, feature.projected.vRaw],
        registeredRoi: captureMeasurement.roi,
        measurement,
      });
    }
    const valid = measurements.filter((entry) => entry.valid && entry.measurement.valid);
    const expectedSharpest = [...valid].sort((a, b) => a.canonicalMajorRadiusDisplayPx - b.canonicalMajorRadiusDisplayPx)[0];
    const measuredSharpest = [...valid].sort(compareRanks)[0];
    const sharpnessRank = {
      expectedByCanonicalMajorRadius: expectedSharpest?.id ?? null,
      measuredByEdgeWidth: measuredSharpest?.id ?? null,
      candidateMatch: Boolean(expectedSharpest && measuredSharpest && expectedSharpest.id === measuredSharpest.id),
      limitation: "This rank is descriptive; edge spread contains pixel phase, native raster, silhouette, and display mapping effects. It is not a calibrated CoC-to-PSF transfer.",
    };
    const pairwise = [];
    for (let i = 0; i < valid.length; i += 1) for (let j = i + 1; j < valid.length; j += 1) {
      const left = valid[i], right = valid[j];
      if (left.canonicalMajorRadiusDisplayPx === right.canonicalMajorRadiusDisplayPx) continue;
      const smaller = left.canonicalMajorRadiusDisplayPx < right.canonicalMajorRadiusDisplayPx ? left : right;
      const larger = smaller === left ? right : left;
      const comparison = bootstrapDifference(smaller, larger, pixelDifferenceFloorPx);
      pairwise.push({
        predictedSharper: smaller.id,
        predictedMoreDefocused: larger.id,
        predictedRadiusDifferencePx: larger.canonicalMajorRadiusDisplayPx - smaller.canonicalMajorRadiusDisplayPx,
        measuredWidthDifferencePx: larger.measurement.width10to90Px - smaller.measurement.width10to90Px,
        measuredOrder: larger.measurement.width10to90Px > smaller.measurement.width10to90Px ? "predicted_order" : "reversed_or_tied",
        ...comparison,
      });
    }
    cases.push({
      case: name,
      sourceFrame: record.frame,
      camera: record.test,
      backend: manifest.gpu ?? manifest.backend ?? null,
      displayGrid: `${width}x${height}`,
      sharpnessRank,
      pairwise,
      measurements,
    });
  }
  const report = {
    schemaVersion: 1,
    sourceCommit: manifest.commit,
    sourceDirty: manifest.dirtySource,
    browser: manifest.browser,
    backend: manifest.backend ?? manifest.gpu ?? "not recorded",
    measurementProtocol: {
      edgeMetric: "per-row display RGB8 luma 10–90% edge spread, median over rows",
      uncertainty: "95% percentile bootstrap interval over rows (2000 deterministic resamples), plus an eight-offset bilinear subpixel resampling phase envelope",
      pixelDifferenceFloorPx,
      toleranceMeaning: "Quarter-display-pixel resolution floor only; not a physically derived optical tolerance.",
      predictedOrdering: "Canonical major-radius ordering is a screening bound; no direct equivalence to measured edge width is assumed.",
    },
    cases,
    limitations: [
      "v5 is an earlier SwiftShader/display capture set; it is not the v6 Apple Metal hardware capture.",
      "Only processed images were saved for these movement cases, so no matched Raw baseline is available.",
      "The images are 480x361 CSS captures resized to the recorded 480x360 measurement grid.",
      "Pairwise edge results are inconclusive when bootstrap and pixel-phase bounds overlap.",
      "The fixture is diagnostic geometry, not the original room scene.",
    ],
  };
  const serialized = `${JSON.stringify(report, null, 2)}\n`;
  if (outputPath) fs.writeFileSync(outputPath, serialized);
  else process.stdout.write(serialized);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
