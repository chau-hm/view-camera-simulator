const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const metricsUrl = pathToFileURL(path.join(__dirname, "edge-metrics.mjs")).href;
const defaultProcessed = "/private/tmp/room-focus-stage-hardware";
const defaultRaw = "/private/tmp/room-focus-raw-hardware";
const widthDifferenceFloorPx = 0.25;
const replicates = 2000;
const phaseBins = 4;

function requireFrameIdentity(record, label) {
  if (label === "processed") {
    const frame = record.p;
    if (frame?.completion?.status !== "completed"
      || frame?.completion?.frameId !== frame?.frameId
      || record.screenshotFrameId !== frame?.frameId) {
      throw new Error(`${label} ${record.focus}: screenshot/stage frame identity is not synchronized`);
    }
  } else if (record.result?.status !== "ready" || record.result?.frameId !== record.state?.frame?.frameId) {
    throw new Error(`${label} ${record.focus}: raw screenshot result/frame identity is not synchronized`);
  }
}

function assertMatchingState(processed, raw, focus) {
  if (JSON.stringify(processed.state.camera) !== JSON.stringify(raw.state.camera)) {
    throw new Error(`${focus}: Raw/Processed canonical camera state mismatch`);
  }
  if (processed.expected.subjectMode !== raw.expected.subjectMode
    || processed.expected.renderQuality !== raw.expected.renderQuality
    || processed.state.subjectIdentity !== raw.state.subjectIdentity) {
    throw new Error(`${focus}: Raw/Processed subject or quality mismatch`);
  }
  const processedInfo = processed.state.observation.info;
  const rawInfo = raw.state.observation.info;
  for (const field of ["canvasCssWidthPx", "canvasCssHeightPx", "internalWidthPx", "internalHeightPx", "sampledFilmWidthMm", "sampledFilmHeightMm"]) {
    if (processedInfo[field] !== rawInfo[field]) throw new Error(`${focus}: Raw/Processed render geometry mismatch at ${field}`);
  }
  const processedFeature = processed.features.find((feature) => feature.id === "near-edge");
  const rawFeature = raw.features.find((feature) => feature.id === "near-edge");
  if (!processedFeature || !rawFeature
    || processedFeature.projected.uRaw !== rawFeature.projected.uRaw
    || processedFeature.projected.vRaw !== rawFeature.projected.vRaw
    || processedFeature.footprint.signedCoCDiameterMm !== rawFeature.footprint.signedCoCDiameterMm) {
    throw new Error(`${focus}: Raw/Processed canonical feature prediction mismatch`);
  }
}

function buildFocusRecord(processed, raw, processedMetric, rawMetric, id) {
  const feature = processed.features.find((candidate) => candidate.id === id);
  const point = processed.p.points.find((candidate) => candidate.id === id);
  const info = processed.state.observation.info;
  const width = info.internalWidthPx;
  const displayWidth = info.canvasCssWidthPx;
  const u = feature.projected.uRaw;
  const sourceUv = point?.sourceUv ?? [u, feature.projected.vRaw];
  const sourceCoordinate = point?.scene?.coordinate;
  const stageCoC = point?.coc?.rgba?.[0];
  const canonicalCoC = feature.footprint.signedCoCDiameterMm;
  const maximumNearRadius = info.maximumCoCRadiusPx;
  const sampleCount = info.sampleCount;
  const firstProposal = maximumNearRadius * Math.sqrt(0.5 / sampleCount);
  return {
    focusMm: processed.state.camera.focusDistanceMm,
    aperture: processed.state.camera.aperture,
    rendererGeneration: processed.state.generation?.generationId,
    processedRequestId: processed.result.requestId,
    processedFrameId: processed.p.frameId,
    rawRequestId: raw.result.requestId,
    rawFrameId: raw.result.frameId,
    subject: {
      id,
      worldM: feature.worldM,
      signedFocusDistanceMm: feature.signedFocusDistanceMm,
      projectedUv: [u, feature.projected.vRaw],
      readbackUv: sourceUv,
      displayCenterPx: [u * displayWidth, (1 - feature.projected.vRaw) * info.canvasCssHeightPx],
      displayCenterPhasePx: [
        u * displayWidth - Math.floor(u * displayWidth),
        (1 - feature.projected.vRaw) * info.canvasCssHeightPx
          - Math.floor((1 - feature.projected.vRaw) * info.canvasCssHeightPx),
      ],
      sampledSceneTexel: sourceCoordinate,
      sourceCenterPhasePx: [
        sourceUv[0] * width - Math.floor(sourceUv[0] * width),
        sourceUv[1] * info.internalHeightPx - Math.floor(sourceUv[1] * info.internalHeightPx),
      ],
      sampledSceneTexelPhaseX: sourceCoordinate ? sourceUv[0] * width - sourceCoordinate.x : null,
      canonicalSignedCoCDiameterMm: canonicalCoC,
      canonicalMajorRadiusInternalPx: feature.majorRadiusInternalPx,
      stageReadbackSignedCoCDiameterMm: stageCoC,
      stageQuantizationLsbMm: point?.coc?.encoding?.precision,
      stageMinusCanonicalCoCDiameterMm: Number.isFinite(stageCoC) ? stageCoC - canonicalCoC : null,
      nearLayerAlphaAtProjectedTexel: point?.near?.rgba?.[3],
      nearProposal: { sampleCount, maximumRadiusPx: maximumNearRadius, firstNoncentralRadiusPx: firstProposal },
    },
    image: {
      measurementGrid: `${displayWidth}x${info.canvasCssHeightPx} CSS display pixels; processed 960x720 captures downsampled in browser Canvas2D; Raw screenshots normalized to same grid`,
      raw: rawMetric,
      processed: processedMetric,
      comparison: null,
    },
    interpretation: "Display-space edge spread is not a CoC transfer calibration; this record separates measured blur from canonical physical footprint and source-pixel phase.",
  };
}

async function main() {
  const processedDir = path.resolve(process.argv[2] || defaultProcessed);
  const rawDir = path.resolve(process.argv[3] || defaultRaw);
  const outputPath = process.argv[4] ? path.resolve(process.argv[4]) : null;
  const {
    cropRgba,
    decodePngRgba,
    measureVerticalEdgeRows,
    compareEdgeMetrics,
    firstWebGlNearProposalRadiusPx,
    resizeRgbaBilinear,
  } = await import(metricsUrl);
  const processedManifest = JSON.parse(fs.readFileSync(path.join(processedDir, "manifest.json"), "utf8"));
  const rawManifest = JSON.parse(fs.readFileSync(path.join(rawDir, "manifest.json"), "utf8"));
  if (processedManifest.source.commit !== rawManifest.source.commit
    || processedManifest.source.dirtySource || rawManifest.source.dirtySource) {
    throw new Error("Refusing mismatched or dirty source captures");
  }
  if (JSON.stringify(processedManifest.gpu) !== JSON.stringify(rawManifest.gpu)) {
    throw new Error("Raw/Processed captures do not report the same renderer/GPU");
  }
  const values = processedManifest.values.filter((focus) => rawManifest.values.includes(focus));
  if (values.length === 0) throw new Error("No common focus states between Raw and Processed manifests");
  const cases = [];
  for (const focus of values) {
      const processed = JSON.parse(fs.readFileSync(path.join(processedDir, `${focus}.json`), "utf8"));
      const raw = JSON.parse(fs.readFileSync(path.join(rawDir, `${focus}.json`), "utf8"));
      requireFrameIdentity(processed, "processed");
      requireFrameIdentity(raw, "raw");
      assertMatchingState(processed, raw, focus);
      const processedInfo = processed.state.observation.info;
      const width = processedInfo.canvasCssWidthPx;
      const height = processedInfo.canvasCssHeightPx;
      const processedPng = path.join(processedDir, processed.screenshot || `${focus}.png`);
      const rawPng = path.join(rawDir, raw.screenshot || `${focus}.png`);
      const processedImage = resizeRgbaBilinear(
        decodePngRgba(fs.readFileSync(processedPng)), width, height,
      );
      const rawImage = resizeRgbaBilinear(decodePngRgba(fs.readFileSync(rawPng)), width, height);
      const features = processed.features.filter((feature) => feature.valid);
      const rows = [];
      for (const feature of features) {
        const id = feature.id;
        const processedMeasurement = processed.measurements.find((entry) => entry.id === id);
        const rawMeasurement = raw.measurements.find((entry) => entry.id === id);
        if (!processedMeasurement?.measurement.valid || !rawMeasurement?.measurement.valid) {
          rows.push({ id, status: "INCONCLUSIVE_INVALID_EXISTING_MEASUREMENT" });
          continue;
        }
        const roi = {
          x: Math.round(feature.projected.uRaw * width) - 14,
          y: Math.round((1 - feature.projected.vRaw) * height) - 6,
          width: processedMeasurement.roi.width,
          height: processedMeasurement.roi.height,
        };
        const rawRegistrationDelta = {
          x: roi.x - rawMeasurement.roi.x,
          y: roi.y - rawMeasurement.roi.y,
        };
        if (Math.abs(rawRegistrationDelta.x) > 1 || Math.abs(rawRegistrationDelta.y) > 1) {
          rows.push({ id, status: "INCONCLUSIVE_REGISTRATION", rawRegistrationDelta, roi });
          continue;
        }
        const processedRgba = cropRgba(processedImage, roi);
        const rawRgba = cropRgba(rawImage, roi);
        const seed = focus * 31 + id.split("").reduce((sum, character) => sum + character.charCodeAt(0), 0);
        const processedMetric = measureVerticalEdgeRows(processedRgba, roi.width, roi.height, {
          replicates, seed, phaseBins,
        });
        const rawMetric = measureVerticalEdgeRows(rawRgba, roi.width, roi.height, {
          replicates, seed: seed + 1, phaseBins,
        });
        const record = buildFocusRecord(processed, raw, processedMetric, rawMetric, id);
        record.image.comparison = compareEdgeMetrics(rawMetric, processedMetric, {
          minimumResolvableDifferencePx: widthDifferenceFloorPx,
        });
        record.image.roi = roi;
        record.image.rawCaptureRoi = rawMeasurement.roi;
        record.image.rawRegistrationDeltaPx = rawRegistrationDelta;
        rows.push(record);
      }
      cases.push({ focus, rows });
      console.log(`${focus}mm`, JSON.stringify(rows.map((row) => ({
        id: row.subject?.id ?? row.id,
        raw: row.image?.raw?.width10to90Px ?? null,
        rawCI: row.image?.raw?.bootstrap95Px ?? null,
        processed: row.image?.processed?.width10to90Px ?? null,
        processedCI: row.image?.processed?.bootstrap95Px ?? null,
        phase: row.subject?.displayCenterPhasePx ?? null,
        cocRadiusInternalPx: row.subject?.canonicalMajorRadiusInternalPx ?? null,
        result: row.image?.comparison?.status ?? row.status,
      }))));
  }
  const report = {
    schemaVersion: 1,
    sourceCommit: processedManifest.source.commit,
    sourceDirty: false,
    backend: processedManifest.gpu,
    browser: processedManifest.browser,
    renderer: "WebGL2 GroundGlassRTT; offline image registration uses deterministic bilinear resampling",
    captureRoots: { processedDir, rawDir },
    measurementProtocol: {
      rawAndProcessedCameraState: "must match field-for-field for focal length, focus, aperture, Rise, Shift, Tilt, Swing; scene, render quality, internal/display dimensions and sampled film dimensions must match",
      sourceResolution: processedManifest.records?.[0]?.points ? "Processed intermediate capture is 960x720; Raw canvas screenshot is normalized to the 480x360 CSS display grid" : "See capture metadata",
      outputGrid: "Use each record's canvasCssWidthPx × canvasCssHeightPx; bilinearly resize both captures to that display grid before ROI extraction",
      edgeMetric: "per-row RGB8 luma 10–90% transition; median across valid rows",
      uncertainty: "95% percentile bootstrap interval of row medians, 2000 deterministic replicates; phase sensitivity is the measured width envelope after eight fixed horizontal subpixel resampling offsets",
      predeclaredDecisionTolerance: {
        minimumResolvableDifferencePx: widthDifferenceFloorPx,
        rationale: "A quarter of one display pixel is the reporting floor for a display-referred edge difference, not an optical or CoC tolerance.",
        noPhaseCoverage: "INCONCLUSIVE_PHASE_COVERAGE",
        subThreshold: "INCONCLUSIVE_WITHIN_PIXEL_PHASE_TOLERANCE",
      },
      physicalCoC: "Report canonical feature CoC/radii and renderer stage readback separately. Readback encoding is recorded; point-to-texel world-position mismatch is not treated as a quantization-only error bound.",
    },
    proposalSupport: {
      sampleCount: 32,
      maximumRadiusPx: 60,
      firstNoncentralRadiusPx: firstWebGlNearProposalRadiusPx(60, 32),
      limitation: "A support gap is not proof that this was the source of the manually observed room-image oscillation.",
    },
    cases,
    limitations: [
      "These captures use the diagnostic optical fixture, not the original room materials.",
      "Raw and Processed are separate capture runs, not simultaneous render-target snapshots.",
      "The image comparison is display-referred and does not calibrate the shader's physical CoC-to-PSF transfer.",
      "Row bootstrap uncertainty is conditional on captured rows and does not cover scene, browser, GPU, or repeated-capture variance.",
      "An insufficient pixel-phase distribution is reported as inconclusive rather than as a pass or failure.",
      "The WebGPU CPU aperture reference is not used as an exact oracle for the WebGL shader.",
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
