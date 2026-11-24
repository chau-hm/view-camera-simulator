#!/usr/bin/env node
/*
 * Conservative analysis for capture-focus-scrub.cjs output.
 *
 * Full-frame image comparisons are interpreted only for repeated renders of
 * the same committed camera state. Focus-to-focus image differences are not
 * scored because focus breathing and a legitimate sharpness peak change them.
 * This tool reports geometric projection/CoC state separately from measured
 * image sharpness. The current room feature diagnostics do not establish that
 * a projected point is visible, unoccluded, and textured enough for an image
 * ROI, so those candidates are explicitly rejected unless a later capture
 * supplies validated local measurements.
 */
const fs = require('node:fs');
const path = require('node:path');
const util = require('node:util');

const DEFAULT_THRESHOLDS = Object.freeze({
  repeatMeanRgb8: 1,
  repeatP99MeanChannelRgb8: 3,
});

const DEFAULT_ROI_RESIDUAL_THRESHOLDS = Object.freeze({
  positionDeltaPx: 2,
  edgeSpreadDeltaPx: 2,
});

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function finite(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function deepEqual(left, right) {
  return util.isDeepStrictEqual(left, right);
}

function focusControlSignature(camera) {
  if (!camera || typeof camera !== 'object') return null;
  const { focusDistanceMm, lastFiniteFocusDepthMm, ...nonFocusState } = camera;
  return nonFocusState;
}

function renderStateSignature(state) {
  if (!state) return null;
  return {
    camera: state.camera,
    optics: state.optics && {
      lensCenterWorld: state.optics.lensCenterWorld,
      lensNormalWorld: state.optics.lensNormalWorld,
      filmCenterWorld: state.optics.filmCenterWorld,
      filmNormalWorld: state.optics.filmNormalWorld,
      lensPlane: state.optics.lensPlane,
      filmPlane: state.optics.filmPlane,
      focusPlane: state.optics.focusPlane,
      offAxisProjectionMatrix: state.optics.offAxisProjectionMatrix,
      groundGlassProjection: state.optics.groundGlassProjection,
      diagnostics: state.optics.diagnostics,
    },
    observationProjection: state.observation?.info?.projectionMatrix,
    renderQuality: state.renderQuality,
    rawDebug: state.rawDebug,
    hdr: state.hdr,
    displayExposure: state.displayExposure,
    reflectionsEnabled: state.reflectionsEnabled,
    presetKey: state.presetKey,
    subjectIdentity: state.subjectIdentity,
  };
}

function checkSnapshot(snapshot, requestedFocusMm, mode) {
  const problems = [];
  const state = snapshot?.state;
  const result = snapshot?.result;
  const frame = state?.frame;
  if (!state || !result) return { valid: false, problems: ['snapshot or result missing'] };
  if (result.status !== 'ready') problems.push(`capture status is ${result.status}`);
  if (state.camera?.focusDistanceMm !== requestedFocusMm) problems.push('committed focus differs from requested focus');
  if (Boolean(state.rawDebug) !== (mode === 'raw')) problems.push('raw/processed mode differs from capture label');
  if (state.renderError) problems.push(`render error: ${state.renderError}`);
  if (!frame || frame.status !== 'completed') problems.push('reported frame is not completed');
  if (result.frameId !== frame?.frameId) problems.push('inspection frame id differs from state frame id');
  if (result.requestId !== state.request?.requestId || result.requestId !== frame?.request?.requestId) {
    problems.push('request identity differs between inspection, state, and completed frame');
  }
  if (result.generationId !== state.generation?.generationId || result.generationId !== frame?.generation?.generationId) {
    problems.push('generation identity differs between inspection, state, and completed frame');
  }
  const info = state.observation?.info;
  if (info?.cameraConfigurationOk === false) problems.push(info.cameraConfigurationError || 'camera configuration is invalid');
  if (info?.uniformsFinite === false) problems.push(info.uniformPreparationError || 'render uniforms are non-finite');
  if (info?.renderSanityError) problems.push(`render sanity error: ${info.renderSanityError}`);
  const gi = snapshot.gi;
  if (!gi || gi.expected !== 302 || gi.matched !== 302 || gi.missing?.length || gi.mismatch?.length || gi.stale?.length) {
    problems.push('GI report is absent or does not confirm 302/302 clean matches');
  }
  return { valid: problems.length === 0, problems };
}

function captureBracket(record, capture) {
  const before = capture?.before;
  const after = capture?.after;
  const beforeCheck = checkSnapshot(before, record.requestedFocusMm, record.mode);
  const afterCheck = checkSnapshot(after, record.requestedFocusMm, record.mode);
  const sameRequest = before?.result?.requestId === after?.result?.requestId;
  const sameGeneration = before?.result?.generationId === after?.result?.generationId;
  const sameState = deepEqual(renderStateSignature(before?.state), renderStateSignature(after?.state));
  return {
    valid: beforeCheck.valid && afterCheck.valid && sameRequest && sameGeneration && sameState,
    before: beforeCheck,
    after: afterCheck,
    screenshotBracket: {
      beforeFrameId: before?.result?.frameId ?? null,
      afterFrameId: after?.result?.frameId ?? null,
      requestId: after?.result?.requestId ?? null,
      generationId: after?.result?.generationId ?? null,
      cameraStateStableAcrossScreenshot: sameState,
      requestStableAcrossScreenshot: sameRequest,
      generationStableAcrossScreenshot: sameGeneration,
      exactCompositorPresentedFrameObserved: false,
    },
  };
}

function comparisonStatus(metrics, equivalentState, thresholds = DEFAULT_THRESHOLDS) {
  if (!equivalentState) return { status: 'rejected', reason: 'canonical render state did not match' };
  if (!metrics || !finite(metrics.meanAbsoluteRgb8) || !finite(metrics.p99MeanChannelDifference)) {
    return { status: 'rejected', reason: 'same-state RGB8 comparison metrics are missing' };
  }
  const repeatable = metrics.meanAbsoluteRgb8 <= thresholds.repeatMeanRgb8
    && metrics.p99MeanChannelDifference <= thresholds.repeatP99MeanChannelRgb8;
  return {
    status: repeatable ? 'within-repeatability-threshold' : 'same-state-image-divergence',
    thresholds,
    meanAbsoluteRgb8: metrics.meanAbsoluteRgb8,
    p99MeanChannelDifference: metrics.p99MeanChannelDifference,
    meaning: 'display-referred repeatability for identical state only; not focus sharpness accuracy',
  };
}

/**
 * Compare a registered local image measurement to its canonical prediction.
 * A smooth predicted focus-breathing path and a focus-dependent sharpness peak
 * are not errors by themselves: only an abrupt change in prediction residual
 * is flagged. `samples` must be for the same identified ROI, sorted in either
 * focus direction, and contain independently validated local measurements.
 */
function analyzeRegisteredRoiSamples(samples, thresholds = DEFAULT_ROI_RESIDUAL_THRESHOLDS) {
  const reject = (reason) => ({ status: 'rejected', reason, samples: [] });
  if (!Array.isArray(samples) || samples.length < 3) return reject('at least three registered samples are required');
  const regionIds = new Set(samples.map((sample) => sample?.regionId));
  if (regionIds.size !== 1 || regionIds.has(undefined) || regionIds.has(null)) return reject('all samples must identify the same ROI');
  if (samples.some((sample) => sample.valid !== true)) return reject('one or more local image measurements failed visibility/contrast/clipping/bounds validation');
  if (samples.some((sample) => !finite(sample.focusMm)
    || !finite(sample.predicted?.positionPx?.x) || !finite(sample.predicted?.positionPx?.y)
    || !finite(sample.observed?.positionPx?.x) || !finite(sample.observed?.positionPx?.y)
    || !finite(sample.predicted?.edgeSpreadPx) || !finite(sample.observed?.edgeSpreadPx))) {
    return reject('predicted and observed registered position and edge-spread values are required');
  }
  const direction = Math.sign(samples[1].focusMm - samples[0].focusMm);
  if (!direction || samples.some((sample, index) => index > 0 && Math.sign(sample.focusMm - samples[index - 1].focusMm) !== direction)) {
    return reject('focus values must be strictly monotonic in capture order');
  }
  const measured = samples.map((sample) => {
    const xResidualPx = sample.observed.positionPx.x - sample.predicted.positionPx.x;
    const yResidualPx = sample.observed.positionPx.y - sample.predicted.positionPx.y;
    const edgeSpreadResidualPx = sample.observed.edgeSpreadPx - sample.predicted.edgeSpreadPx;
    return {
      focusMm: sample.focusMm,
      signedCoCMm: sample.signedCoCMm ?? null,
      predicted: sample.predicted,
      observed: sample.observed,
      positionResidualPx: { x: xResidualPx, y: yResidualPx, magnitude: Math.hypot(xResidualPx, yResidualPx) },
      edgeSpreadResidualPx,
    };
  });
  const discontinuities = [];
  for (let index = 1; index < measured.length; index++) {
    const previous = measured[index - 1];
    const current = measured[index];
    const positionResidualStepPx = Math.hypot(
      current.positionResidualPx.x - previous.positionResidualPx.x,
      current.positionResidualPx.y - previous.positionResidualPx.y,
    );
    const edgeSpreadResidualStepPx = Math.abs(current.edgeSpreadResidualPx - previous.edgeSpreadResidualPx);
    if (positionResidualStepPx > thresholds.positionDeltaPx || edgeSpreadResidualStepPx > thresholds.edgeSpreadDeltaPx) {
      discontinuities.push({
        fromFocusMm: previous.focusMm,
        toFocusMm: current.focusMm,
        positionResidualStepPx,
        edgeSpreadResidualStepPx,
      });
    }
  }
  return {
    status: discontinuities.length ? 'registered-roi-discontinuity-candidate' : 'registered-roi-residual-continuous',
    regionId: samples[0].regionId,
    thresholds,
    maximumPositionResidualPx: Math.max(...measured.map((sample) => sample.positionResidualPx.magnitude)),
    maximumAbsoluteEdgeSpreadResidualPx: Math.max(...measured.map((sample) => Math.abs(sample.edgeSpreadResidualPx))),
    discontinuities,
    samples: measured,
    interpretation: 'Focus breathing and the expected sharpness peak are encoded in predicted positions/edge spread; this flags only abrupt changes in local measurement residual. It does not establish canonical-model correctness or physical CoC accuracy by itself.',
  };
}

function sequenceNumber(requestId) {
  const match = /^room-request-(\d+)$/.exec(requestId || '');
  return match ? Number(match[1]) : null;
}

function analyzeInteractive(interactive) {
  if (!interactive) return { status: 'not-captured' };
  const samples = interactive.trace?.samples || [];
  const events = interactive.trace?.events || [];
  const completed = [];
  const seenFrameIds = new Set();
  const requestLagSamples = [];
  let previousSequence = -1;
  const regressions = [];
  for (const sample of samples) {
    const frame = sample.frame;
    if (!frame || frame.status !== 'completed' || !frame.frameId || seenFrameIds.has(frame.frameId)) continue;
    seenFrameIds.add(frame.frameId);
    const frameSequence = sequenceNumber(frame.request?.requestId);
    const committedSequence = sequenceNumber(sample.request?.requestId);
    if (frameSequence !== null && committedSequence !== null && frameSequence < committedSequence) {
      requestLagSamples.push({
        frameId: frame.frameId,
        frameRequestId: frame.request.requestId,
        committedRequestId: sample.request.requestId,
        committedFocusMm: sample.committedFocusMm,
        interpretation: 'completion telemetry trails current committed state; lag alone is not an ordering defect',
      });
    }
    if (frameSequence !== null && frameSequence < previousSequence) regressions.push({
      frameId: frame.frameId,
      requestId: frame.request?.requestId,
      previousCompletedRequestSequence: previousSequence,
    });
    if (frameSequence !== null) previousSequence = Math.max(previousSequence, frameSequence);
    completed.push({
      frameId: frame.frameId,
      requestId: frame.request?.requestId ?? null,
      requestSequence: frameSequence,
      committedRequestId: sample.request?.requestId ?? null,
      committedFocusMm: sample.committedFocusMm ?? null,
      generationId: frame.generation?.generationId ?? null,
      status: frame.status,
    });
  }
  const recordedRegressions = interactive.orderRegressions || [];
  return {
    status: regressions.length || recordedRegressions.length ? 'completion-telemetry-order-regression' : 'no-completion-telemetry-order-regression-observed',
    trustedInputEventCount: events.filter((event) => event.trusted === true).length,
    untrustedInputEventCount: events.filter((event) => event.trusted !== true).length,
    inputValuesMm: events.map((event) => event.value),
    uniqueCompletedFrames: completed.length,
    completedFrames: completed,
    completionRequestLags: requestLagSamples,
    calculatedRequestSequenceRegressions: regressions,
    harnessReportedRegressions: recordedRegressions,
    observedCompositorPresentation: false,
    limitation: interactive.limitation || 'RTT completion telemetry does not directly observe browser compositor presentation.',
  };
}

function analyzeCanonicalFocusTrajectory(captures, mode = 'processed', direction = 'forward') {
  const records = captures
    .filter((entry) => entry.record.mode === mode && entry.record.direction === direction)
    .sort((a, b) => a.record.requestedFocusMm - b.record.requestedFocusMm);
  if (!records.length) return { status: 'not-captured', samples: [] };
  const samples = records.map(({ record, capture, bracket }) => {
    const state = capture.after?.state;
    const optics = state?.optics || {};
    const diagnostics = optics.diagnostics || {};
    const info = state?.observation?.info || {};
    const focusedFeatures = (state?.features || []).map((feature) => ({
      id: feature.id,
      sourceM: feature.sourceM ?? null,
      worldMm: feature.worldMm ?? null,
      visibleInCanonicalProjection: feature.projected?.visible === true,
      normalizedProjection: feature.projected?.visible ? {
        uRaw: feature.projected.uRaw,
        vRaw: feature.projected.vRaw,
      } : null,
      signedFocusDistanceMm: feature.signedFocusDistanceMm ?? null,
      cocDiameterMm: feature.cocDiameterMm ?? null,
      signedCoCAvailable: finite(feature.signedCoCDiameterMm),
      roiEligible: feature.valid === true && feature.imageMeasurement?.valid === true,
      roiRejection: feature.valid === false
        ? (feature.rejection || feature.visibility || 'canonical feature validation rejected this region')
        : feature.visibility || 'capture does not contain a contrast/clipping/edge measurement for this feature',
    }));
    return {
      requestedFocusMm: record.requestedFocusMm,
      committedFocusMm: state?.camera?.focusDistanceMm ?? null,
      frameId: capture.after?.result?.frameId ?? null,
      requestId: capture.after?.result?.requestId ?? null,
      generationId: capture.after?.result?.generationId ?? null,
      bracketValid: bracket.valid,
      focusPlaneDistanceMm: optics.focusPlane?.distance ?? null,
      focusPlaneDistanceErrorMm: finite(optics.focusPlane?.distance)
        ? optics.focusPlane.distance - record.requestedFocusMm
        : null,
      focusObjectDistanceMm: diagnostics.focusObjectDistanceMm ?? null,
      imageDistanceMm: diagnostics.imageDistanceMm ?? null,
      projectionMatrix: info.projectionMatrix ?? null,
      cameraMovementState: focusControlSignature(state?.camera),
      features: focusedFeatures,
      renderQuality: state?.renderQuality ?? null,
      internalDimensionsPx: [info.internalWidthPx ?? null, info.internalHeightPx ?? null],
      sampleCount: info.sampleCount ?? null,
      maximumCoCRadiusPx: info.maximumCoCRadiusPx ?? null,
      CocStorageFormat: info.cocStorageFormat ?? null,
    };
  });
  const valid = samples.every((sample) => sample.bracketValid
    && sample.committedFocusMm === sample.requestedFocusMm
    && finite(sample.focusPlaneDistanceMm)
    && Math.abs(sample.focusPlaneDistanceErrorMm) <= 1e-5
    && finite(sample.focusObjectDistanceMm)
    && Math.abs(sample.focusObjectDistanceMm - sample.requestedFocusMm) <= 1e-5);
  const fixedMovementState = samples.length <= 1 || samples.every((sample) => deepEqual(sample.cameraMovementState, samples[0].cameraMovementState));
  const featureIds = [...new Set(samples.flatMap((sample) => sample.features.map((feature) => feature.id)))];
  const featureTrajectories = featureIds.map((id) => {
    const rows = samples.map((sample) => ({ focusMm: sample.requestedFocusMm, feature: sample.features.find((candidate) => candidate.id === id) }));
    const firstWorldPoint = rows.find((row) => row.feature?.worldMm)?.feature?.worldMm;
    const sameWorldPoint = rows.every((row) => !row.feature?.worldMm || deepEqual(row.feature.worldMm, firstWorldPoint));
    return {
      id,
      sameWorldPointAcrossFocus: sameWorldPoint,
      samples: rows.map(({ focusMm, feature }) => ({ focusMm, ...(feature || { missing: true }) })),
      imageBlurTrajectoryStatus: 'not-measured; projected point visibility does not prove an unoccluded textured ROI',
    };
  });
  return {
    status: valid && fixedMovementState ? 'canonical-focus-state-continuity-consistent' : 'canonical-focus-state-continuity-incomplete-or-mismatched',
    criterion: 'Committed focus, canonical focus plane, and existing optical focus-object distance track the requested control; this does not claim image sharpness or shader CoC continuity.',
    fixedNonFocusCameraState: fixedMovementState,
    samples,
    featureTrajectories,
    signedCoC: {
      status: 'unavailable-in-room-feature-capture',
      reason: 'The room feature payload exposes signed distance to focus plane and an unsigned CoC diameter; no canonical signed CoC field or validated image ROI is captured here.',
    },
  };
}

function analyzeCaptureDirectory(directory) {
  const root = path.resolve(directory);
  const manifestFile = path.join(root, 'manifest.json');
  if (!fs.existsSync(manifestFile)) throw new Error(`Missing manifest.json in ${root}; capture may still be running or incomplete`);
  const manifest = readJson(manifestFile);
  const captures = [];
  const loadFailures = [];
  for (const record of manifest.records || []) {
    const captureFile = path.join(root, `${record.name}.json`);
    if (!fs.existsSync(captureFile)) {
      loadFailures.push({ name: record.name, reason: 'capture JSON missing' });
      continue;
    }
    try {
      const capture = readJson(captureFile);
      const normalizedRecord = {
        ...record,
        requestedFocusMm: capture.requestedFocusMm ?? record.focus,
        focus: record.focus ?? capture.requestedFocusMm,
        mode: capture.mode ?? record.mode,
        direction: capture.direction ?? record.direction,
      };
      const bracket = captureBracket(normalizedRecord, capture);
      captures.push({ record: normalizedRecord, capture, bracket });
    } catch (error) {
      loadFailures.push({ name: record.name, reason: error.message });
    }
  }
  const captureByName = new Map(captures.map((entry) => [entry.record.name, entry]));
  const repeated = captures.filter(({ record }) => record.direction === 'repeat').map(({ record, capture }) => ({
    mode: record.mode,
    focusMm: record.focus,
    comparison: comparisonStatus(capture.comparison, true),
    frameBracket: {
      firstFrameId: capture.before?.frameId ?? null,
      laterCompletedFrameId: capture.later?.frameId ?? null,
      capturedAfterFrameId: capture.after?.frameId ?? null,
      requestId: capture.after?.requestId ?? null,
      generationId: capture.after?.generationId ?? null,
    },
    limitation: 'Repeat JSON proves same-request IDs from the harness; it does not contain a complete serialized camera state. The capture sequence leaves controls unchanged between the paired screenshots.',
  }));
  const forwardReverse = [];
  for (const pair of manifest.comparisons || []) {
    const forward = captureByName.get(pair.forward);
    const reverse = captureByName.get(pair.reverse);
    const equivalentState = Boolean(forward && reverse
      && forward.bracket.valid && reverse.bracket.valid
      && deepEqual(renderStateSignature(forward.capture.after?.state), renderStateSignature(reverse.capture.after?.state)));
    forwardReverse.push({
      mode: pair.mode,
      focusMm: pair.focus,
      forward: pair.forward,
      reverse: pair.reverse,
      sameCanonicalRenderState: equivalentState,
      requestIdsDiffer: forward?.capture.after?.result?.requestId !== reverse?.capture.after?.result?.requestId,
      comparison: comparisonStatus(pair, equivalentState),
    });
  }
  const interactiveFile = path.join(root, 'interactive.json');
  const interactive = fs.existsSync(interactiveFile) ? analyzeInteractive(readJson(interactiveFile)) : { status: 'not-captured' };
  const trajectories = ['processed', 'raw'].map((mode) => ({
    mode,
    forward: analyzeCanonicalFocusTrajectory(captures, mode, 'forward'),
    reverse: analyzeCanonicalFocusTrajectory(captures, mode, 'reverse'),
  }));
  const sameStateComparisons = [...repeated.map((item) => ({ mode: item.mode, focusMm: item.focusMm, ...item.comparison })),
    ...forwardReverse.map((item) => ({ mode: item.mode, focusMm: item.focusMm, ...item.comparison }))];
  const divergences = sameStateComparisons.filter((item) => item.status === 'same-state-image-divergence');
  const comparable = sameStateComparisons.filter((item) => item.status === 'within-repeatability-threshold');
  const roiCandidates = trajectories.flatMap(({ mode, forward }) => forward.featureTrajectories.flatMap((trajectory) => {
    const visible = trajectory.samples.some((sample) => sample.visibleInCanonicalProjection);
    if (!visible) return [];
    return [{ mode, featureId: trajectory.id, accepted: false, reason: 'projected visibility is not proof of scene visibility, non-occlusion, texture contrast, or registered edge suitability' }];
  }));
  let settledInterpretation = 'incomplete';
  if (divergences.length) settledInterpretation = 'same-state-render-divergence-observed; distinguish renderer nondeterminism/stale output before assigning a DOF-shader cause';
  else if (comparable.length && sameStateComparisons.length === comparable.length) settledInterpretation = 'no-settled-same-state-instability-reproduced-at-sampled-focus-values; coarse sampled evidence only';
  const rawComparable = sameStateComparisons.some((item) => item.mode === 'raw' && item.status === 'within-repeatability-threshold');
  const processedComparable = sameStateComparisons.some((item) => item.mode === 'processed' && item.status === 'within-repeatability-threshold');
  const rawDivergence = sameStateComparisons.some((item) => item.mode === 'raw' && item.status === 'same-state-image-divergence');
  const processedDivergence = sameStateComparisons.some((item) => item.mode === 'processed' && item.status === 'same-state-image-divergence');
  let rawProcessedInterpretation = 'insufficient comparable raw/processed same-state pairs';
  if (rawComparable && !rawDivergence && processedDivergence) rawProcessedInterpretation = 'candidate instability appears only after Raw RTT; localize within processed optical passes, not yet to a specific pass';
  else if (rawDivergence && processedDivergence) rawProcessedInterpretation = 'instability is already present in Raw RTT or upstream state/rendering; DOF gather is not the first demonstrated boundary';
  else if (rawComparable && processedComparable && !rawDivergence && !processedDivergence) rawProcessedInterpretation = 'same-state output is repeatable in both modes at captured states; does not rule out transient interactive presentation or between-state shader discontinuity';
  const report = {
    schemaVersion: 1,
    source: manifest.source || null,
    capture: {
      directory: root,
      valuesMm: manifest.values || [],
      modes: manifest.modes || [],
      apertureFNumber: manifest.aperture ?? null,
      displayExposure: manifest.displayExposure ?? null,
      hdr: manifest.hdr ?? null,
      reflections: manifest.reflections ?? null,
      variant: manifest.variant ?? null,
      backend: manifest.gpu || null,
      errors: manifest.errors || [],
      loadFailures,
    },
    sameStateImageComparisons: {
      thresholds: DEFAULT_THRESHOLDS,
      sameStateRepeat: repeated,
      sameFocusForwardReverse: forwardReverse,
      settledInterpretation,
      rawVsProcessedInterpretation: rawProcessedInterpretation,
      rejectedComparisons: sameStateComparisons.filter((item) => item.status === 'rejected'),
    },
    canonicalFocusStateTrajectory: trajectories,
    imageRoiEvidence: {
      status: roiCandidates.length ? 'candidate-projections-rejected-no-valid-image-roi' : 'no-visible-projection-candidates',
      acceptedRegionCount: 0,
      candidates: roiCandidates,
      reason: 'No capture record contains a registered local pixel ROI with validated target identity, visibility/non-occlusion, contrast, clipping, and edge-spread measurement. Do not infer sharpness from full-frame differences or projection-only room features.',
    },
    interactiveFrameTelemetry: interactive,
    overallFocusScrubStatus: divergences.length
      ? 'PARTIAL / SAME_STATE_DIVERGENCE_REQUIRES_LOCALIZATION'
      : loadFailures.length || manifest.errors?.length || !sameStateComparisons.length || sameStateComparisons.some((item) => item.status === 'rejected')
        ? 'INCOMPLETE_EVIDENCE / NEEDS_MANUAL_REVIEW'
        : 'NOT_REPRODUCED / NEEDS_MANUAL_REVIEW',
    confidence: divergences.length ? 'moderate for repeatability deviation; low for DOF causal attribution'
      : sameStateComparisons.length && !loadFailures.length && !manifest.errors?.length && sameStateComparisons.every((item) => item.status === 'within-repeatability-threshold')
        ? 'moderate for sampled settled repeatability; low for continuous optical correctness and compositor ordering'
        : 'low; the settled comparison set is incomplete or contains rejected pairs',
    limits: [
      'No cross-focus full-frame difference is used as an instability metric.',
      'The coarse 1200/2000/3000 mm sweep does not resolve small focus intervals around a shader threshold.',
      'Raw/Processed comparison can localize only to before/after the Raw RTT boundary when same-state pairs diverge.',
      'rAF and RTT frame telemetry cannot prove the exact frame physically presented by the browser compositor.',
      'No image-based local edge sharpness is established without a validated and registered ROI.',
      'No signed per-feature CoC is included in the room feature payload; the provided feature CoC diameter is unsigned.',
      'A deterministic same-state result does not prove continuous focus response between states.',
    ],
  };
  return report;
}

if (require.main === module) {
  const directory = process.argv[2];
  if (!directory) {
    console.error('Usage: node experiments/room-at-dawn/analyze-focus-scrub.cjs <capture-directory> [--output <report.json>]');
    process.exitCode = 2;
  } else {
    try {
      const report = analyzeCaptureDirectory(directory);
      const outputIndex = process.argv.indexOf('--output');
      if (outputIndex >= 0) {
        const outputFile = path.resolve(process.argv[outputIndex + 1]);
        fs.writeFileSync(outputFile, `${JSON.stringify(report, null, 2)}\n`);
        console.log(`Wrote ${outputFile}`);
      }
      console.log(JSON.stringify({
        overallFocusScrubStatus: report.overallFocusScrubStatus,
        confidence: report.confidence,
        settledInterpretation: report.sameStateImageComparisons.settledInterpretation,
        rawVsProcessedInterpretation: report.sameStateImageComparisons.rawVsProcessedInterpretation,
        interactiveFrameTelemetry: report.interactiveFrameTelemetry.status,
        validImageRoiCount: report.imageRoiEvidence.acceptedRegionCount,
      }, null, 2));
    } catch (error) {
      console.error(error.stack || error.message);
      process.exitCode = 1;
    }
  }
}

module.exports = {
  DEFAULT_THRESHOLDS,
  DEFAULT_ROI_RESIDUAL_THRESHOLDS,
  analyzeRegisteredRoiSamples,
  analyzeCaptureDirectory,
  analyzeCanonicalFocusTrajectory,
  analyzeInteractive,
  captureBracket,
  checkSnapshot,
  comparisonStatus,
  focusControlSignature,
  renderStateSignature,
};
