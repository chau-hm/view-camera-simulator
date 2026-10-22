import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { expect, test, type Page, type TestInfo } from "@playwright/test";

const FIXTURE_PATH = "/src/tests/e2e/fixtures/ground-glass-webgpu-aperture-gather.html?phaseK=1";
const nativeRequired = process.env.OBSERVER_NATIVE_WEBGPU_REQUIRED === "1";
const ARTIFACT_DIRECTORY = resolve(process.cwd(), "test-results/ground-glass-webgpu-phase-k");

type JsonRecord = Record<string, unknown>;
type Operation = {
  operationId: string;
  state: string;
  stage: string;
  resultPublished: boolean;
  error: string | null;
  appliedState: JsonRecord | null;
  phaseJ: JsonRecord | null;
  timing: JsonRecord | null;
};
type Handle = {
  instanceId: string;
  generation: number;
  state: string;
  runtime: null | {
    rendererFamily: string;
    executionBackend: string;
    applicationFallback: boolean;
    initialized: boolean;
    threeRevision: string;
  };
  operations: Operation[];
  dimensions: JsonRecord | null;
  resources: Array<{ id: string; role: string; state: string; error: string | null }>;
};
type Diagnostics = { activeHandleId: string | null; handles: Handle[] };

const record = (value: unknown): JsonRecord =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
const number = (value: unknown): number | null => typeof value === "number" && Number.isFinite(value) ? value : null;

const readDiagnostics = async (page: Page): Promise<Diagnostics> => {
  const text = await page.getByTestId("fixture-diagnostics").textContent();
  if (!text) throw new Error("Phase K fixture diagnostics are not published");
  return JSON.parse(text) as Diagnostics;
};

const readActiveHandle = async (page: Page) => {
  const state = await readDiagnostics(page);
  const handle = state.handles.find((entry) => entry.instanceId === state.activeHandleId);
  if (!handle) throw new Error("Phase K fixture has no active native renderer handle");
  return handle;
};

const waitForInitialHandle = async (page: Page) => {
  await expect.poll(async () => {
    const handle = await readActiveHandle(page).catch(() => null);
    const operation = handle?.operations.at(-1);
    return Boolean(handle?.state === "active" && operation?.state === "completed" && operation.resultPublished);
  }, { timeout: 180_000, intervals: [100, 250, 500, 1000] }).toBe(true);
  return readActiveHandle(page);
};

const runCase = async (page: Page, testId: string) => {
  const before = await readActiveHandle(page);
  const previousCount = before.operations.length;
  await page.getByTestId(testId).click();
  await expect.poll(async () => {
    const handle = (await readDiagnostics(page)).handles.find((entry) => entry.instanceId === before.instanceId);
    const operation = handle?.operations.at(-1);
    return operation?.state === "completed" || operation?.state === "failed" || operation?.state === "retired";
  }, { timeout: 180_000, intervals: [100, 250, 500, 1000] }).toBe(true);
  const handle = (await readDiagnostics(page)).handles.find((entry) => entry.instanceId === before.instanceId);
  if (!handle) throw new Error(`Renderer ${before.instanceId} disappeared after ${testId}`);
  const operation = handle.operations.at(-1);
  if (!operation || handle.operations.length !== previousCount + 1) {
    throw new Error(`Expected exactly one operation after ${testId}; saw ${handle.operations.length - previousCount}`);
  }
  expect(operation.state, `${operation.operationId} stage=${operation.stage} error=${operation.error}`).toBe("completed");
  expect(operation.resultPublished, operation.operationId).toBe(true);
  expect(operation.phaseJ, `${operation.operationId} Phase J/K diagnostics`).not.toBeNull();
  return { handle, operation };
};

const assertNative = (handle: Handle) => {
  expect(handle.runtime).toMatchObject({
    rendererFamily: "webgpu-renderer",
    executionBackend: "webgpu",
    applicationFallback: false,
    initialized: true,
    threeRevision: "186",
  });
};

const assertGlobalReadbackContract = (operation: Operation) => {
  const phaseJ = record(operation.phaseJ);
  const phaseK = record(phaseJ.phaseK);
  const readback = record(phaseK.sourceIdentityOrientation);
  expect(readback.policy).toBe("fixed-global-top-origin-readback-to-top-origin-array");
  expect(readback.selectedOrigin).toBe("top");
  expect(readback.topOriginMismatchCount).toBe(0);
  expect(number(readback.bottomOriginMismatchCount) ?? 0).toBeGreaterThan(0);
  expect(readback.pixelCount).toBe(512 * 384);
};

const assertCorrespondenceRecord = (value: unknown) => {
  const probe = record(value);
  expect(typeof probe.id).toBe("string");
  const classification = String(probe.classification ?? "");
  expect(classification).toMatch(/^[A-E] — /);
  const projection = record(probe.projection);
  expect(Array.isArray(projection.worldPointMm)).toBe(true);
  expect(Array.isArray(projection.worldPointM)).toBe(true);
  expect(Array.isArray(projection.cameraSpaceM)).toBe(true);
  expect(Array.isArray(projection.clipSpace)).toBe(true);
  expect(Array.isArray(projection.ndc)).toBe(true);
  expect(Array.isArray(projection.continuousPixelTopOrigin)).toBe(true);
  expect(Array.isArray(projection.selectedPixelCenterTopOrigin)).toBe(true);
  expect(projection.existingProjectionHelperAgreement).toBe(true);
  const worldMm = projection.worldPointMm as number[];
  const worldM = projection.worldPointM as number[];
  expect(worldMm).toHaveLength(3);
  expect(worldM).toHaveLength(3);
  for (let axis = 0; axis < 3; axis += 1) expect(worldM[axis]! * 1000).toBeCloseTo(worldMm[axis]!, 6);
  expect(number(projection.pixelCenterQuantizationPx) ?? Infinity).toBeLessThanOrEqual(Math.SQRT1_2 + 1e-6);
  const ray = record(probe.pixelCenterRay);
  expect(Array.isArray(ray.originM)).toBe(true);
  expect(Array.isArray(ray.directionWorld)).toBe(true);
  const firstHit = record(probe.firstEligibleIntersection);
  if (Object.keys(firstHit).length > 0) {
    expect(typeof firstHit.objectName).toBe("string");
    expect(number(firstHit.rayDistanceMm)).not.toBeNull();
    expect(Array.isArray(firstHit.pointMm)).toBe(true);
    expect(typeof firstHit.depthWrite).toBe("boolean");
    const surfaceOptics = record(probe.surfaceOptics);
    expect(surfaceOptics.status).toBe("SURFACE_VERIFIED");
    expect(number(surfaceOptics.gpuToSurfaceMm) ?? Infinity).toBeLessThanOrEqual(0.5);
    const physicalDelta = record(surfaceOptics.gpuMinusCpu);
    expect(Math.abs(number(physicalDelta.signedCoCDiameterMm) ?? Infinity)).toBeLessThan(0.001);
    expect(Math.abs(number(physicalDelta.majorRadiusMm) ?? Infinity)).toBeLessThan(0.001);
    const evidence = record(probe.classificationEvidence);
    expect(evidence.gpuMatchesRayIntersection).toBe(true);
    expect(Math.abs((number(evidence.gpuAlongRayMm) ?? Infinity) - (number(firstHit.rayDistanceMm) ?? 0))).toBeLessThanOrEqual(0.5);
  }
  expect(number(probe.gpuDepth)).not.toBeNull();
  expect(Array.isArray(probe.gpuWorldPositionMm)).toBe(true);
  expect(number(probe.targetToGpuResidualMm)).not.toBeNull();
  expect(typeof record(probe.classificationEvidence).residualAttribution).toBe("string");
  return probe;
};

const assertLargeState = (
  operation: Operation,
  capPx: number,
  gatherWidth: number,
  candidate: boolean,
  state = { focusDistanceMm: 400, cropMagnification: 16 },
  sampleCount = 32,
) => {
  const stressCrop = state.cropMagnification > 1;
  expect(operation.appliedState).toMatchObject({
    reconstructionVariant: candidate ? "B1" : "B0",
    scene: "macro-depth-of-field",
    crop: stressCrop,
    focusOffsetMm: 0,
    sourceWidthPx: 512,
    sourceHeightPx: 384,
    farGatherWidthPx: gatherWidth,
    farGatherHeightPx: gatherWidth * 3 / 4,
    apertureFNumber: 5.6,
    sampleCount,
    maximumCoCRadiusPx: capPx,
  });
  const phaseJ = record(operation.phaseJ);
  expect(phaseJ.caseId).toBe("macro-focus-middle-f5_6");
  const optical = record(phaseJ.opticalState);
  const cameraState = record(optical.cameraState);
  expect(cameraState).toMatchObject({ focalLengthMm: 150, aperture: 5.6, focusDistanceMm: state.focusDistanceMm });
  const film = record(optical.film);
  expect(film.sampledWidthMm).toBeCloseTo(127 / state.cropMagnification, 6);
  expect(film.sampledHeightMm).toBeCloseTo(101.6 / state.cropMagnification, 6);
  const inspection = record(optical.inspectionWindow);
  expect(inspection.active).toBe(stressCrop);
  expect(inspection.widthFraction).toBeCloseTo(1 / state.cropMagnification, 8);
  const phaseK = record(phaseJ.phaseK);
  expect(phaseK.radiusCapPx).toBe(capPx);
  expect(phaseK.sourceDimensionsPx).toEqual({ widthPx: 512, heightPx: 384 });
  expect(phaseK.gatherDimensionsPx).toEqual({ widthPx: gatherWidth, heightPx: gatherWidth * 3 / 4 });
  expect(record(phaseK.nativeRuntime)).toMatchObject({ executionBackend: "webgpu", applicationFallback: false, threeRevision: "186" });
  expect(record(phaseK.physical).radiusDiagnosticMismatchCount).toBe(0);
  expect(operation.timing).toMatchObject({ gpuTimestampDurationMs: null });
  const timing = record(operation.timing);
  expect(number(timing.operationWallTimeMs)).not.toBeNull();
  expect(number(timing.readbackWallTimeMs)).not.toBeNull();
  expect(Array.isArray(timing.stages)).toBe(true);
  const stages = (timing.stages as unknown[]).map(record);
  expect(stages.length).toBeGreaterThan(0);
  for (const stage of stages) {
    expect(typeof stage.stage).toBe("string");
    expect(number(stage.cpuSubmissionTimeMs)).not.toBeNull();
  }
  return { phaseJ, phaseK, physical: record(phaseK.physical), quality: record(phaseK.largeCocFarQuality) };
};

const readPointComparison = (operation: Operation, pointId: string) => {
  const quality = record(record(operation.phaseJ).quality);
  const comparisons = Array.isArray(quality.pointComparisons) ? quality.pointComparisons.map(record) : [];
  const result = comparisons.find((comparison) => comparison.id === pointId);
  if (!result) throw new Error(`Missing physical point comparison ${pointId} in ${operation.operationId}`);
  return result;
};

const measurementEvidence = (operation: Operation) => {
  const phaseK = record(record(operation.phaseJ).phaseK);
  return {
    operationId: operation.operationId,
    appliedState: operation.appliedState,
    timing: operation.timing,
    targetMemoryEstimate: phaseK.targetMemoryEstimate ?? null,
    ownedResourceCount: phaseK.ownedResourceCount ?? null,
  };
};

const attachArtifacts = async (page: Page, testInfo: TestInfo, name: string, prefixes: string[]) => {
  const captured = await page.evaluate((wanted) => {
    const store = (window as Window & { __groundGlassWebGpuApertureGather?: { handles?: unknown[] } }).__groundGlassWebGpuApertureGather;
    const images = (window as Window & { __groundGlassWebGpuPhaseJImages?: Record<string, string> }).__groundGlassWebGpuPhaseJImages ?? {};
    return {
      store,
      images: Object.fromEntries(Object.entries(images).filter(([key]) => wanted.some((prefix) => key.startsWith(prefix)))),
    };
  }, prefixes);
  await mkdir(ARTIFACT_DIRECTORY, { recursive: true });
  const json = JSON.stringify(captured.store, null, 2);
  await writeFile(join(ARTIFACT_DIRECTORY, `${name}.json`), json);
  await testInfo.attach(`${name}.json`, { body: json, contentType: "application/json" });
  for (const [key, dataUrl] of Object.entries(captured.images)) {
    const base64 = dataUrl.split(",", 2)[1];
    if (!base64) continue;
    const image = Buffer.from(base64, "base64");
    const artifactName = `${name}-${key.replaceAll("/", "-")}.png`;
    await writeFile(join(ARTIFACT_DIRECTORY, artifactName), image);
    await testInfo.attach(artifactName, { body: image, contentType: "image/png" });
  }
};

test("ordinary Chromium executes Phase K controls without claiming native WebGPU", async ({ page }) => {
  test.skip(nativeRequired, "Ordinary Chromium control is run separately from the native-required gate");
  await page.goto(FIXTURE_PATH);
  const handle = await waitForInitialHandle(page);
  expect(handle.runtime?.threeRevision).toBe("186");
  const { operation } = await runCase(page, "phase-k-s0-full32");
  expect(operation.appliedState?.scene).toBe("macro-depth-of-field");
  const runtime = record(record(operation.phaseJ).phaseK).nativeRuntime;
  expect(record(runtime).executionBackend).not.toBe("webgpu");
});

test("native point projection, fixed readback orientation, and visible-surface audit cover all seven states", async ({ page }, testInfo) => {
  test.skip(!nativeRequired, "Run with OBSERVER_NATIVE_WEBGPU_REQUIRED=1 for native-only evidence");
  test.setTimeout(900_000);
  await page.goto(FIXTURE_PATH);
  const mounted = await waitForInitialHandle(page);
  assertNative(mounted);
  const cases = [
    "interior-initial",
    "interior-front-swing",
    "interior-front-swing-focus",
    "interior-rise-swing",
    "architecture-initial",
    "architecture-rise",
    "architecture-rise-focus",
  ] as const;
  const records: Array<{ operationId: string; caseId: string; runtime: Handle["runtime"]; readback: JsonRecord; probes: JsonRecord[] }> = [];
  for (const caseId of cases) {
    const { handle, operation } = await runCase(page, `phase-k-correspondence-${caseId}`);
    assertNative(handle);
    assertGlobalReadbackContract(operation);
    expect(record(operation.phaseJ).caseId).toBe(caseId);
    const phaseK = record(record(operation.phaseJ).phaseK);
    const probes = Array.isArray(phaseK.correspondence) ? phaseK.correspondence.map(assertCorrespondenceRecord) : [];
    expect(probes.length, `${caseId} correspondence probes`).toBeGreaterThan(0);
    const interiorCase = caseId.startsWith("interior-");
    for (const probe of probes) {
      const evidence = record(probe.classificationEvidence);
      if (interiorCase) {
        expect(probe.classification).toMatch(/^C — Occluded target$/);
        expect(evidence.occludedAlongPixelRay).toBe(true);
        expect(evidence.surfaceOffsetMatchesIntent).toBe(false);
      } else {
        expect(probe.classification).toMatch(/^B — Deliberately offset teaching target$/);
        expect(evidence.surfaceOffsetMatchesIntent).toBe(true);
        expect(Math.abs((number(evidence.targetToIntersectionMm) ?? Infinity) - (number(evidence.documentedOffsetMm) ?? 0))).toBeLessThanOrEqual(3);
      }
    }
    records.push({
      operationId: operation.operationId,
      caseId,
      runtime: handle.runtime,
      readback: record(phaseK.sourceIdentityOrientation),
      probes,
    });
  }
  const output = JSON.stringify(records, null, 2);
  await mkdir(ARTIFACT_DIRECTORY, { recursive: true });
  await writeFile(join(ARTIFACT_DIRECTORY, "point-correspondence.json"), output);
  await testInfo.attach("point-correspondence.json", { body: output, contentType: "application/json" });
});

test("native large-CoC crop activates and measures the real 12 px cap against matched references", async ({ page }, testInfo) => {
  test.skip(!nativeRequired, "Run with OBSERVER_NATIVE_WEBGPU_REQUIRED=1 for native-only evidence");
  test.setTimeout(900_000);
  await page.goto(FIXTURE_PATH);
  const mounted = await waitForInitialHandle(page);
  assertNative(mounted);
  const run = async (testId: string) => {
    const result = await runCase(page, testId);
    assertNative(result.handle);
    return result;
  };
  const prefixes: string[] = [];

  const s0Full = await run("phase-k-s0-full32");
  const s0B0 = await run("phase-k-s0-half32-b0");
  const s0B1 = await run("phase-k-s0-half32-b1");
  assertLargeState(s0Full.operation, 12, 512, false, { focusDistanceMm: 400, cropMagnification: 1 });
  assertLargeState(s0B0.operation, 12, 256, false, { focusDistanceMm: 400, cropMagnification: 1 });
  assertLargeState(s0B1.operation, 12, 256, true, { focusDistanceMm: 400, cropMagnification: 1 });
  const s0Cap = record(record(s0Full.operation.phaseJ).physical);
  expect(number(s0Cap.capActivatedPixelCount) ?? 0, "S0 continuity control should remain uncapped").toBe(0);

  const s1Full32 = await run("phase-k-s1-full32");
  const s1Full64 = await run("phase-k-s1-full64");
  const s1B0 = await run("phase-k-s1-half32-b0");
  const s1B1 = await run("phase-k-s1-half32-b1");
  const s1Full32State = assertLargeState(s1Full32.operation, 60, 512, false);
  const s1Full64State = assertLargeState(s1Full64.operation, 60, 512, false, undefined, 64);
  const s1B0State = assertLargeState(s1B0.operation, 60, 256, false);
  const s1B1State = assertLargeState(s1B1.operation, 60, 256, true);
  expect(s1Full32State.phaseK.opticalStateFingerprint).toBe(s1B1State.phaseK.opticalStateFingerprint);
  expect(s1Full32State.physical.physicalFingerprint).toBe(s1B1State.physical.physicalFingerprint);
  expect(number(s1B1State.physical.capActivatedPixelCount) ?? 0).toBe(0);
  expect(record(s1B1State.phaseK).sourceIdentityOrientation).toBeDefined();
  expect(number(record(s1Full64State.phaseK.full32VsFull64Agreement).pixelCount)).toBe(512 * 384);
  expect(number(record(s1B0State.quality.fullFrameRgbError).rgbRootMeanSquareError)).not.toBeNull();

  // This known focus point remains visible in the same optical state before
  // and after the film window is cropped. Its source pixel changes, but its
  // stored physical millimetre footprint must not acquire crop magnification.
  const fullFilmMiddle = readPointComparison(s0Full.operation, "macro-depth-middle");
  const croppedMiddle = readPointComparison(s1Full32.operation, "macro-depth-middle");
  expect(fullFilmMiddle.validityCode).toBe(1);
  expect(croppedMiddle.validityCode).toBe(1);
  expect(number(fullFilmMiddle.worldPositionErrorMm) ?? Infinity).toBeLessThan(0.5);
  expect(number(croppedMiddle.worldPositionErrorMm) ?? Infinity).toBeLessThan(0.5);
  const fullFilmMiddlePhysical = record(record(fullFilmMiddle.comparison).gpu);
  const croppedMiddlePhysical = record(record(croppedMiddle.comparison).gpu);
  for (const field of ["signedCoCDiameterMm", "majorRadiusMm", "minorRadiusMm"] as const) {
    expect(number(fullFilmMiddlePhysical[field])).not.toBeNull();
    expect(Math.abs((number(fullFilmMiddlePhysical[field]) ?? 0) - (number(croppedMiddlePhysical[field]) ?? Infinity))).toBeLessThan(0.00001);
  }
  expect(Math.abs((number(fullFilmMiddlePhysical.orientationRad) ?? 0) - (number(croppedMiddlePhysical.orientationRad) ?? Infinity))).toBeLessThan(1e-5);

  const s2Full32 = await run("phase-k-s2-full32");
  const s2B0 = await run("phase-k-s2-half32-b0");
  const s2B1 = await run("phase-k-s2-half32-b1");
  const s2FullState = assertLargeState(s2Full32.operation, 12, 512, false);
  const s2B0State = assertLargeState(s2B0.operation, 12, 256, false);
  const s2B1State = assertLargeState(s2B1.operation, 12, 256, true);
  await testInfo.attach("phase-k-s2-measurements.json", {
    body: JSON.stringify({
      configuration: { apertureFNumber: 5.6, focusDistanceMm: 400, cropMagnification: 16 },
      full32: s2FullState.physical,
      b0: s2B0State.physical,
      b1: s2B1State.physical,
      b1NearTarget: record(record(s2B1State.phaseJ.quality).nearTarget),
    }, null, 2),
    contentType: "application/json",
  });
  expect(s1B1State.phaseK.opticalStateFingerprint).toBe(s2B1State.phaseK.opticalStateFingerprint);
  expect(s1B1State.physical.physicalFingerprint).toBe(s2B1State.physical.physicalFingerprint);
  expect(number(s2B1State.physical.capActivatedPixelCount) ?? 0).toBeGreaterThan(0);
  const capComponent = record(s2B1State.physical.largestCapComponent);
  expect(number(capComponent.pixelCount) ?? 0, "cap activation should form a spatial region").toBeGreaterThan(16);
  const capBounds = record(capComponent.bounds);
  expect((number(capBounds.right) ?? 0) - (number(capBounds.left) ?? 0) + 1).toBeGreaterThan(2);
  expect((number(capBounds.bottom) ?? 0) - (number(capBounds.top) ?? 0) + 1).toBeGreaterThan(2);
  expect(number(s2B1State.physical.maximumClampedRadiusPx) ?? Infinity).toBeLessThanOrEqual(12.1);
  const gpuCap = record(record(s2B1State.phaseJ.physical).gpuCapActivation);
  expect(number(gpuCap.maximumCpuGpuRadiusDiagnosticErrorPx) ?? Infinity).toBeLessThan(0.1);
  const cappedSamples = Array.isArray(s2B1State.physical.capActivatedSamples)
    ? s2B1State.physical.capActivatedSamples.map(record)
    : [];
  expect(cappedSamples.length).toBeGreaterThan(0);
  for (const sample of cappedSamples) {
    const uncappedEllipse = record(sample.unclampedSourceEllipsePx);
    const effectiveEllipse = record(sample.effectiveCpuClampedAxesPx);
    expect(number(uncappedEllipse.maximumRadiusPx) ?? 0).toBeGreaterThan(12);
    expect(number(sample.gpuClampedRadiusPx) ?? Infinity).toBeLessThanOrEqual(12.1);
    expect(number(sample.cpuClampedMaximumRadiusPx) ?? Infinity).toBeLessThanOrEqual(12.1);
    expect(Math.abs((number(sample.expectedCpuScale) ?? 0) - (number(sample.gpuAppliedScale) ?? 1))).toBeLessThan(0.005);
    expect(number(sample.orientationPreservationErrorRadModuloPi) ?? Infinity).toBeLessThan(1e-5);
    expect(Array.isArray(effectiveEllipse.major)).toBe(true);
    expect(Array.isArray(effectiveEllipse.minor)).toBe(true);
  }
  expect(number(s2B1State.physical.capActivatedFarPixelCount) ?? 0).toBeGreaterThan(0);
  expect(number(s2B1State.physical.capActivatedNonBlackSourcePixelCount) ?? 0, "capped pixels must contain rendered scene color").toBeGreaterThan(0);
  expect(number(s2B1State.physical.capActivatedInteriorPixelCount) ?? 0, "cap region must extend beyond the raster boundary").toBeGreaterThan(0);
  expect(number(s2B1State.physical.capActivatedDepthBoundaryPixelCount) ?? 0, "cap region should include an image depth edge").toBeGreaterThan(0);
  const signs = record(record(s2B1State.phaseK.physical).signedCoCPixelCount);
  expect(number(signs.near) ?? 0).toBeGreaterThan(0);
  expect(number(signs.far) ?? 0).toBeGreaterThan(0);
  const nearTarget = record(record(s2B1State.phaseJ.quality).nearTarget);
  expect(number(nearTarget.alphaCoveragePixelCount) ?? 0, "the large-CoC state must contain near-layer coverage").toBeGreaterThan(0);
  expect(number(nearTarget.maximumAlpha) ?? 0).toBeGreaterThan(0.02);
  const nearRgba = record(s2B1State.phaseK.nearRgbaComparisonFromB0);
  expect(number(nearRgba.rootMeanSquareRgbError) ?? Infinity).toBeLessThan(1e-5);
  expect(number(nearRgba.rootMeanSquareAlphaError) ?? Infinity).toBeLessThan(1e-5);
  const s2B0Quality = record(s2B0State.phaseK.largeCocFarQuality);
  const s2B1Quality = record(s2B1State.phaseK.largeCocFarQuality);
  const s2FullQuality = record(s2FullState.phaseK.largeCocFarQuality);
  expect(number(record(s2B0Quality.fullFrameRgbError).rgbRootMeanSquareError)).not.toBeNull();
  expect(number(record(s2B1Quality.validFarRgbError).rgbRootMeanSquareError)).not.toBeNull();
  expect(number(s2B1Quality.sourceFallbackFarPixelCount) ?? 0, "B1 must exercise its measured source-fallback path").toBeGreaterThan(0);
  expect(number(record(s2B1State.phaseJ.quality).fallbackSourceColorMismatchCount)).toBe(0);
  expect(number(s2B1Quality.farBlurSuppressionEnergy)).not.toBeNull();
  expect(number(s2B1Quality.farHaloWidthPx)).not.toBeNull();
  expect(number(record(s2FullQuality.fullFrameRgbError).rgbRootMeanSquareError)).not.toBeNull();

  const s3Full32 = await run("phase-k-s3-full32");
  const s3B1 = await run("phase-k-s3-half32-b1");
  const s3FullState = assertLargeState(s3Full32.operation, 32, 512, false);
  const s3B1State = assertLargeState(s3B1.operation, 32, 256, true);
  expect(s1B1State.phaseK.opticalStateFingerprint).toBe(s3B1State.phaseK.opticalStateFingerprint);
  expect(s1B1State.physical.physicalFingerprint).toBe(s3B1State.physical.physicalFingerprint);
  expect(number(s3B1State.physical.maximumClampedRadiusPx) ?? Infinity).toBeLessThanOrEqual(32.1);
  expect(number(record(record(s3B1State.phaseK.largeCocFarQuality).fullFrameRgbError).rgbRootMeanSquareError)).not.toBeNull();
  expect(number(record(s3FullState.quality.fullFrameRgbError).rgbRootMeanSquareError)).not.toBeNull();
  prefixes.push(
    "macro-focus-middle-f5_6-full32-r12-",
    "macro-focus-middle-f5_6-half32-B0-r12-",
    "macro-focus-middle-f5_6-half32-B1-r12-",
    "macro-focus-middle-f5_6-full32-r60-",
    "macro-focus-middle-f5_6-full64-r60-",
    "macro-focus-middle-f5_6-half32-B0-r60-",
    "macro-focus-middle-f5_6-half32-B1-r60-",
    "macro-focus-middle-f5_6-full32-r32-",
    "macro-focus-middle-f5_6-half32-B1-r32-",
  );
  const summary = {
    nativeRuntime: mounted.runtime,
    opticalConfiguration: {
      caseId: "macro-focus-middle-f5_6",
      apertureFNumber: 5.6,
      focusDistanceMm: 400,
      cropMagnification: 16,
      sampledFilmMm: { width: 127 / 16, height: 101.6 / 16 },
      source: { widthPx: 512, heightPx: 384 },
    },
    states: [
      {
        id: "S0", capPx: 12,
        full32: s0Full.operation.phaseJ, halfB0: s0B0.operation.phaseJ, halfB1: s0B1.operation.phaseJ,
        measurements: { full32: measurementEvidence(s0Full.operation), halfB0: measurementEvidence(s0B0.operation), halfB1: measurementEvidence(s0B1.operation) },
      },
      {
        id: "S1", capPx: 60,
        full32: s1Full32.operation.phaseJ, full64: s1Full64.operation.phaseJ, halfB0: s1B0.operation.phaseJ, halfB1: s1B1.operation.phaseJ,
        measurements: { full32: measurementEvidence(s1Full32.operation), full64: measurementEvidence(s1Full64.operation), halfB0: measurementEvidence(s1B0.operation), halfB1: measurementEvidence(s1B1.operation) },
      },
      {
        id: "S2", capPx: 12,
        full32: s2Full32.operation.phaseJ, halfB0: s2B0.operation.phaseJ, halfB1: s2B1.operation.phaseJ,
        measurements: { full32: measurementEvidence(s2Full32.operation), halfB0: measurementEvidence(s2B0.operation), halfB1: measurementEvidence(s2B1.operation) },
      },
      {
        id: "S3", capPx: 32,
        full32: s3Full32.operation.phaseJ, halfB1: s3B1.operation.phaseJ,
        measurements: { full32: measurementEvidence(s3Full32.operation), halfB1: measurementEvidence(s3B1.operation) },
      },
    ],
    resourceEvidence: {
      handleId: mounted.instanceId,
      generation: mounted.generation,
      activeOwnedResources: mounted.resources.filter((resource) => resource.state === "active").length,
      memoryEstimate: mounted.dimensions,
    },
  };
  const output = JSON.stringify(summary, null, 2);
  await mkdir(ARTIFACT_DIRECTORY, { recursive: true });
  await writeFile(join(ARTIFACT_DIRECTORY, "large-coc-quality.json"), output);
  await testInfo.attach("large-coc-quality.json", { body: output, contentType: "application/json" });
  await attachArtifacts(page, testInfo, "large-coc-images", prefixes);
});
