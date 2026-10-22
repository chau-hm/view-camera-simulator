import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { expect, test, type Page, type TestInfo } from "@playwright/test";

const FIXTURE_PATH = "/src/tests/e2e/fixtures/ground-glass-webgpu-aperture-gather.html?phaseJ=1";
const nativeRequired = process.env.OBSERVER_NATIVE_WEBGPU_REQUIRED === "1";
const PHASE_J_ARTIFACT_DIRECTORY = resolve(process.cwd(), "test-results/ground-glass-webgpu-phase-j");

type JsonRecord = Record<string, unknown>;
type Operation = {
  operationId: string;
  state: string;
  stage: string;
  resultPublished: boolean;
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
  resources: Array<{ id: string; role: string; state: string; error: string | null }>;
  cleanupCompletedAt: number | null;
  cleanupError: string | null;
};
type Diagnostics = { activeHandleId: string | null; handles: Handle[] };

const record = (value: unknown): JsonRecord =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};

const readDiagnostics = async (page: Page): Promise<Diagnostics> => {
  const text = await page.getByTestId("fixture-diagnostics").textContent();
  if (!text) throw new Error("Phase J native fixture has not published diagnostics");
  return JSON.parse(text) as Diagnostics;
};

const readActiveHandle = async (page: Page) => {
  const state = await readDiagnostics(page);
  const handle = state.handles.find((candidate) => candidate.instanceId === state.activeHandleId);
  if (!handle) throw new Error("Phase J fixture has no active renderer handle");
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
    const handle = (await readDiagnostics(page)).handles.find((candidate) => candidate.instanceId === before.instanceId);
    const operation = handle?.operations.at(-1);
    return operation?.state === "completed" || operation?.state === "failed";
  }, { timeout: 180_000, intervals: [100, 250, 500, 1000] }).toBe(true);
  const handle = (await readDiagnostics(page)).handles.find((candidate) => candidate.instanceId === before.instanceId);
  if (!handle) throw new Error(`Renderer ${before.instanceId} disappeared after ${testId}`);
  const operation = handle.operations.at(-1);
  if (!operation || handle.operations.length !== previousCount + 1) {
    throw new Error(`Expected one new operation from ${testId}; observed ${handle.operations.length - previousCount}`);
  }
  expect(operation.state, `${operation.operationId}: ${operation.stage}`).toBe("completed");
  expect(operation.resultPublished, operation.operationId).toBe(true);
  expect(operation.phaseJ, `${operation.operationId} Phase J diagnostics`).not.toBeNull();
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

const assertAppliedPhaseJState = (operation: Operation, expected: {
  caseId: string;
  sceneId: string;
  gatherWidth: number;
  sampleCount: number;
  aperture: number;
  variant: "B0" | "B1";
  focusDistanceMm: number;
  frontRiseMm: number;
  frontSwingDeg: number;
  maximumCoCRadiusPx?: number;
}) => {
  const applied = operation.appliedState;
  expect(applied, operation.operationId).not.toBeNull();
  expect(applied).toMatchObject({
    reconstructionVariant: expected.variant,
    scene: expected.sceneId,
    crop: false,
    focusOffsetMm: 0,
    sourceWidthPx: 512,
    sourceHeightPx: 384,
    farGatherWidthPx: expected.gatherWidth,
    farGatherHeightPx: expected.gatherWidth * 3 / 4,
    gatherScale: expected.gatherWidth / 512,
    sampledFilmWidthMm: 127,
    sampledFilmHeightMm: 101.6,
    apertureFNumber: expected.aperture,
    sampleCount: expected.sampleCount,
    maximumCoCRadiusPx: expected.maximumCoCRadiusPx ?? 12,
  });
  expect(Math.abs(Number(applied!.filmTiltDeg))).toBeLessThan(1e-4);
  const phaseJ = record(operation.phaseJ);
  expect(phaseJ.caseId).toBe(expected.caseId);
  expect(record(phaseJ.opticalState).canonicalOpticsReused).toBe(true);
  expect(record(phaseJ.opticalState).observerCameraPlacementUsed).toBe(false);
  expect(record(phaseJ.opticalState).cameraState).toMatchObject({
    focalLengthMm: 150,
    aperture: expected.aperture,
    focusDistanceMm: expected.focusDistanceMm,
    frontRiseMm: expected.frontRiseMm,
    frontShiftMm: 0,
    frontTiltDeg: 0,
    frontSwingDeg: expected.frontSwingDeg,
    rearRiseMm: 0,
    rearShiftMm: 0,
    rearTiltDeg: 0,
    rearSwingDeg: 0,
    cameraBodyPitchDeg: 0,
  });
  expect(record(phaseJ.geometryEvidence).sourceNonBlackPixelCount).toBeGreaterThan(0);
  expect(record(phaseJ.geometryEvidence).depthOccupiedPixelCount).toBeGreaterThan(0);
  expect(record(phaseJ.geometryEvidence).validDepthPixelCount).toBeGreaterThan(0);
  const optics = record(phaseJ.opticalState);
  const captureCamera = record(optics.captureCamera);
  expect(Array.isArray(captureCamera.positionWorldM)).toBe(true);
  expect(Array.isArray(record(optics.cameraMatrices).projectionMatrixElements)).toBe(true);
  expect((record(optics.cameraMatrices).projectionMatrixElements as unknown[]).length).toBe(16);
  expect((record(optics.cameraMatrices).worldMatrixElements as unknown[]).length).toBe(16);
  expect(operation.timing).toMatchObject({ gpuTimestampDurationMs: null });
};

const assertPointFootprintParity = (qualityValue: unknown, minimumPoints: number) => {
  const quality = record(qualityValue);
  const probes = Array.isArray(quality.pointComparisons) ? quality.pointComparisons.map(record) : [];
  expect(probes.length).toBeGreaterThanOrEqual(minimumPoints);
  for (const probe of probes) {
    const comparison = record(probe.comparison);
    const reconstructedCpu = record(comparison.reconstructedPointCpu);
    const gpu = record(comparison.gpu);
    const delta = record(comparison.gpuMinusReconstructedCpu);
    expect(probe.validityCode, `${String(probe.id)} validity`).toBe(1);
    expect(metric(delta, "signedCoCDiameterMm"), `${String(probe.id)} CoC`).not.toBeNull();
    expect(Math.abs(metric(delta, "signedCoCDiameterMm") ?? Infinity), `${String(probe.id)} reconstructed CoC error`).toBeLessThan(0.001);
    expect(Math.abs(metric(delta, "majorRadiusMm") ?? Infinity), `${String(probe.id)} major-axis error`).toBeLessThan(0.001);
    expect(Math.abs(metric(delta, "minorRadiusMm") ?? Infinity), `${String(probe.id)} minor-axis error`).toBeLessThan(0.001);
    expect(Math.abs(metric(delta, "orientationRadModuloPi") ?? Infinity), `${String(probe.id)} orientation error`).toBeLessThan(0.001);
    const reconstructedCoC = metric(reconstructedCpu, "signedCoCDiameterMm");
    const gpuCoC = metric(gpu, "signedCoCDiameterMm");
    if (reconstructedCoC !== null && gpuCoC !== null && Math.abs(reconstructedCoC) > 0.001) {
      expect(Math.sign(gpuCoC), `${String(probe.id)} signed CoC`).toBe(Math.sign(reconstructedCoC));
    }
  }
};

const metric = (object: unknown, key: string) => {
  const value = record(object)[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
};

const attachEvidence = async (page: Page, testInfo: TestInfo, name: string, prefixes: string[]) => {
  const result = await page.evaluate((requestedPrefixes) => {
    const asRecord = (value: unknown): Record<string, unknown> =>
      value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
    const w = window as Window & { __groundGlassWebGpuApertureGather?: unknown; __groundGlassWebGpuPhaseJImages?: Record<string, string> };
    const store = asRecord(w.__groundGlassWebGpuApertureGather);
    const images = w.__groundGlassWebGpuPhaseJImages ?? {};
    return {
      diagnostics: store,
      images: Object.fromEntries(Object.entries(images).filter(([key]) => requestedPrefixes.some((prefix) => key.startsWith(prefix)))),
    };
  }, prefixes);
  await mkdir(PHASE_J_ARTIFACT_DIRECTORY, { recursive: true });
  const serializedDiagnostics = JSON.stringify(result.diagnostics, null, 2);
  await writeFile(join(PHASE_J_ARTIFACT_DIRECTORY, `${name}-run.json`), serializedDiagnostics);
  await testInfo.attach(`${name}-run.json`, { body: serializedDiagnostics, contentType: "application/json" });
  for (const [key, dataUrl] of Object.entries(result.images)) {
    const base64 = dataUrl.split(",", 2)[1];
    if (!base64) continue;
    const image = Buffer.from(base64, "base64");
    const artifactName = `${name}-${key.replaceAll("/", "-")}.png`;
    await writeFile(join(PHASE_J_ARTIFACT_DIRECTORY, artifactName), image);
    await testInfo.attach(artifactName, { body: image, contentType: "image/png" });
  }
};

test("ordinary Chromium can execute the canonical Macro fixture without claiming native WebGPU", async ({ page }, testInfo) => {
  test.skip(nativeRequired, "This control is run separately from the native-required headed Chrome gate");
  await page.goto(FIXTURE_PATH);
  const handle = await waitForInitialHandle(page);
  expect(handle.runtime?.threeRevision).toBe("186");
  expect(handle.runtime?.initialized).toBe(true);
  const { operation } = await runCase(page, "phase-j-macro-focus-middle-f5_6-full32");
  expect(operation.appliedState?.scene).toBe("macro-depth-of-field");
  expect(record(operation.phaseJ).caseId).toBe("macro-focus-middle-f5_6");
  await attachEvidence(page, testInfo, "ordinary-chromium-macro-control", ["macro-focus-middle-f5_6-full32-"]);
});

test("native Macro focus/aperture matrix preserves canonical state and compares B1 with full references", async ({ page }, testInfo) => {
  test.skip(!nativeRequired, "Run with OBSERVER_NATIVE_WEBGPU_REQUIRED=1 for native-only evidence");
  test.setTimeout(600_000);
  await page.goto(FIXTURE_PATH);
  const mounted = await waitForInitialHandle(page);
  assertNative(mounted);

  const focusCases = [
    { caseId: "macro-focus-near-f5_6", sceneId: "macro-depth-of-field", aperture: 5.6, target: "macro-depth-near" },
    { caseId: "macro-focus-middle-f5_6", sceneId: "macro-depth-of-field", aperture: 5.6, target: "macro-depth-middle" },
    { caseId: "macro-focus-far-f5_6", sceneId: "macro-depth-of-field", aperture: 5.6, target: "macro-depth-far" },
    { caseId: "macro-focus-middle-f16", sceneId: "macro-depth-of-field", aperture: 16, target: "macro-depth-middle" },
  ] as const;
  const macroPrefixes: string[] = [];
  const focusDiagnostics: Array<{ caseId: string; operationId: string; phaseJ: JsonRecord }> = [];
  for (const state of focusCases) {
    const full32 = await runCase(page, `phase-j-${state.caseId}-full32`);
    assertNative(full32.handle);
    expect(full32.operation.appliedState?.scene).toBe(state.sceneId);
    expect(full32.operation.appliedState?.sampleCount).toBe(32);
    expect(full32.operation.appliedState?.farGatherWidthPx).toBe(512);
    assertAppliedPhaseJState(full32.operation, {
      caseId: state.caseId,
      sceneId: state.sceneId,
      gatherWidth: 512,
      sampleCount: 32,
      aperture: state.aperture,
      variant: "B0",
      focusDistanceMm: state.caseId === "macro-focus-near-f5_6" ? 390 : state.caseId === "macro-focus-far-f5_6" ? 410 : 400,
      frontRiseMm: 0,
      frontSwingDeg: 0,
    });

    if (state.caseId === "macro-focus-middle-f5_6") {
      const full64 = await runCase(page, `phase-j-${state.caseId}-full64`);
      assertAppliedPhaseJState(full64.operation, {
        caseId: state.caseId,
        sceneId: state.sceneId,
        gatherWidth: 512,
        sampleCount: 64,
        aperture: state.aperture,
        variant: "B0",
        focusDistanceMm: 400,
        frontRiseMm: 0,
        frontSwingDeg: 0,
      });
    }

    const halfB0 = await runCase(page, `phase-j-${state.caseId}-half32-b0`);
    assertAppliedPhaseJState(halfB0.operation, {
      caseId: state.caseId,
      sceneId: state.sceneId,
      gatherWidth: 256,
      sampleCount: 32,
      aperture: state.aperture,
      variant: "B0",
      focusDistanceMm: state.caseId === "macro-focus-near-f5_6" ? 390 : state.caseId === "macro-focus-far-f5_6" ? 410 : 400,
      frontRiseMm: 0,
      frontSwingDeg: 0,
    });
    const halfB1 = await runCase(page, `phase-j-${state.caseId}-half32-b1`);
    assertNative(halfB1.handle);
    assertAppliedPhaseJState(halfB1.operation, {
      caseId: state.caseId,
      sceneId: state.sceneId,
      gatherWidth: 256,
      sampleCount: 32,
      aperture: state.aperture,
      variant: "B1",
      focusDistanceMm: state.caseId === "macro-focus-near-f5_6" ? 390 : state.caseId === "macro-focus-far-f5_6" ? 410 : 400,
      frontRiseMm: 0,
      frontSwingDeg: 0,
    });

    const phaseJ = record(halfB1.operation.phaseJ);
    const geometry = record(phaseJ.geometryEvidence);
    expect(metric(geometry, "distinctTwoMillimeterDepthBuckets")).toBeGreaterThanOrEqual(3);
    const quality = record(phaseJ.quality);
    const comparisons = record(quality.comparisons);
    expect(comparisons.full32, `${state.caseId} full32 matched reference`).not.toBeNull();
    expect(metric(comparisons.full32, "pixelCount")).toBe(512 * 384);
    expect(metric(comparisons.full32, "rootMeanSquareRgbError")).not.toBeNull();
    expect(metric(comparisons.full32, "meanAbsoluteRgbError")).not.toBeNull();
    if (state.caseId === "macro-focus-middle-f5_6") {
      expect(comparisons.full64, "middle-focus full64 reference").not.toBeNull();
      expect(metric(comparisons.full64, "pixelCount")).toBe(512 * 384);
    }
    expect(metric(quality, "validFarPixelsUsingSourceFallback")).not.toBeNull();
    expect(metric(quality, "fallbackPixelCount") ?? 0).toBeGreaterThan(0);
    expect(metric(quality, "validFarPixelsUsingSourceFallback") ?? 0).toBeGreaterThan(0);
    expect(metric(quality, "fallbackSourceColorMismatchCount")).toBe(0);
    const b0Comparisons = record(record(halfB0.operation.phaseJ).quality).comparisons;
    expect(metric(comparisons.full32, "rootMeanSquareRgbError") ?? Infinity)
      .toBeLessThan(metric(record(b0Comparisons).full32, "rootMeanSquareRgbError") ?? -Infinity);
    const sourceDifference = record(quality.pairedSourceDifferenceFromB0);
    expect(metric(sourceDifference, "rootMeanSquareRgbError")).toBe(0);
    expect(metric(sourceDifference, "pixelCount")).toBe(512 * 384);
    const nearDifference = record(quality.pairedNearTargetDifferenceFromB0);
    expect(metric(nearDifference, "rootMeanSquareRgbError") ?? Infinity).toBeLessThan(1e-6);
    expect(metric(nearDifference, "pixelCount")).toBe(256 * 192);
    expect(metric(nearDifference, "maxRgbError") ?? 0).toBeLessThan(1e-5);

    const pointProbes = Array.isArray(quality.pointComparisons) ? quality.pointComparisons.map(record) : [];
    assertPointFootprintParity(quality, 3);
    expect(pointProbes.map((probe) => probe.id)).toContain(state.target);
    const point = pointProbes.find((probe) => probe.id === state.target);
    expect(point, `${state.caseId} target probe`).toBeDefined();
    expect(metric(point, "worldPositionErrorMm")).not.toBeNull();
    const comparison = record(point?.comparison);
    const gpuMinusReconstructed = record(comparison.gpuMinusReconstructedCpu);
    expect(metric(gpuMinusReconstructed, "signedCoCDiameterMm")).not.toBeNull();
    expect(Math.abs(metric(gpuMinusReconstructed, "signedCoCDiameterMm") ?? Infinity)).toBeLessThan(0.03);
    expect(Math.abs(metric(gpuMinusReconstructed, "majorRadiusMm") ?? Infinity)).toBeLessThan(0.04);
    expect(Math.abs(metric(gpuMinusReconstructed, "minorRadiusMm") ?? Infinity)).toBeLessThan(0.04);
    focusDiagnostics.push({ caseId: state.caseId, operationId: halfB1.operation.operationId, phaseJ });
    macroPrefixes.push(`${state.caseId}-full32-`, `${state.caseId}-half32-B0-`, `${state.caseId}-half32-B1-`);
  }

  const nearCase = focusDiagnostics.find((entry) => entry.caseId === "macro-focus-near-f5_6")!;
  const middleCase = focusDiagnostics.find((entry) => entry.caseId === "macro-focus-middle-f5_6")!;
  const farCase = focusDiagnostics.find((entry) => entry.caseId === "macro-focus-far-f5_6")!;
  const nearPhysical = record(nearCase.phaseJ.physical);
  const middlePhysical = record(middleCase.phaseJ.physical);
  const farPhysical = record(farCase.phaseJ.physical);
  expect(metric(nearPhysical, "nearSidePixelCount")).toBeGreaterThan(0);
  expect(metric(nearPhysical, "farSidePixelCount")).toBeGreaterThan(0);
  expect(metric(middlePhysical, "nearSidePixelCount")).toBeGreaterThan(0);
  expect(metric(middlePhysical, "farSidePixelCount")).toBeGreaterThan(0);
  expect(metric(farPhysical, "nearSidePixelCount")).toBeGreaterThan(0);
  expect(metric(farPhysical, "farSidePixelCount")).toBeGreaterThan(0);
  const f16 = focusDiagnostics.find((entry) => entry.caseId === "macro-focus-middle-f16")!;
  expect(metric(record(f16.phaseJ.physical), "maximumAbsCoCMm")).toBeLessThan(metric(middlePhysical, "maximumAbsCoCMm") ?? 0);

  const cap32 = await runCase(page, "phase-j-macro-focus-far-f5_6-half32-b1-r32");
  const previousFar = focusDiagnostics.find((entry) => entry.caseId === "macro-focus-far-f5_6")!;
  assertAppliedPhaseJState(cap32.operation, {
    caseId: "macro-focus-far-f5_6",
    sceneId: "macro-depth-of-field",
    gatherWidth: 256,
    sampleCount: 32,
    aperture: 5.6,
    variant: "B1",
    focusDistanceMm: 410,
    frontRiseMm: 0,
    frontSwingDeg: 0,
    maximumCoCRadiusPx: 32,
  });
  expect(record(record(cap32.operation.phaseJ).physical).rawRgba16FloatFingerprint)
    .toBe(record(previousFar.phaseJ.physical).rawRgba16FloatFingerprint);
  const capPhysical = record(record(cap32.operation.phaseJ).physical);
  expect(metric(capPhysical, "radiusCapPx")).toBe(32);
  expect(metric(capPhysical, "maximumAbsCoCMm")).toBe(metric(farPhysical, "maximumAbsCoCMm"));
  await attachEvidence(page, testInfo, "native-phase-j-macro", macroPrefixes.concat("macro-focus-far-f5_6-half32-B1-r32-"));
  const focusSummary = JSON.stringify(focusDiagnostics.map(({ caseId, operationId, phaseJ }) => ({ caseId, operationId, phaseJ })), null, 2);
  await writeFile(join(PHASE_J_ARTIFACT_DIRECTORY, "native-phase-j-focus-summary.json"), focusSummary);
  await testInfo.attach("native-phase-j-focus-summary.json", {
    body: focusSummary,
    contentType: "application/json",
  });

  const timeOrigin = await page.evaluate(() => performance.timeOrigin);
  await page.getByRole("link", { name: "Navigate away (SPA)" }).click();
  await expect(page).toHaveURL(/#\/away$/);
  await expect(page.getByTestId("away-route")).toBeVisible();
  const documentTimeOriginAfterFirstNavigation = await page.evaluate(() => performance.timeOrigin);
  expect(documentTimeOriginAfterFirstNavigation).toBe(timeOrigin);
  await expect.poll(async () => {
    const state = await readDiagnostics(page);
    const retired = state.handles.find((handle) => handle.instanceId === mounted.instanceId);
    return retired?.state === "disposed" && retired.cleanupCompletedAt !== null;
  }, { timeout: 60_000, intervals: [100, 250, 500] }).toBe(true);
  const retiredFirst = (await readDiagnostics(page)).handles.find((handle) => handle.instanceId === mounted.instanceId)!;
  expect(retiredFirst.cleanupError).toBeNull();
  expect(retiredFirst.resources.length).toBeGreaterThan(0);
  expect(retiredFirst.resources.every((resource) => resource.state === "disposed")).toBe(true);
  expect(retiredFirst.resources.some((resource) => resource.role === "webgpu-renderer" && resource.state === "disposed")).toBe(true);
  expect(retiredFirst.resources.some((resource) => resource.role === "rgba16float-scene-color-plus-depth-target" && resource.state === "disposed")).toBe(true);
  expect(retiredFirst.resources.some((resource) => resource.role === "owned-canonical-macro-depth-of-field-subject" && resource.state === "disposed")).toBe(true);

  await page.getByRole("link", { name: "Return to experiment (SPA)" }).click();
  await expect(page).toHaveURL(/#\/experiment$/);
  const remounted = await waitForInitialHandle(page);
  assertNative(remounted);
  expect(remounted.instanceId).not.toBe(mounted.instanceId);
  expect(remounted.generation).toBeGreaterThan(mounted.generation);
  const remountRender = await runCase(page, "phase-j-macro-focus-middle-f5_6-full32");
  expect(record(remountRender.operation.phaseJ).geometryEvidence).toMatchObject({ sourceNonBlackPixelCount: expect.any(Number) });
  await page.getByRole("link", { name: "Navigate away (SPA)" }).click();
  await expect(page).toHaveURL(/#\/away$/);
  expect(await page.evaluate(() => performance.timeOrigin)).toBe(timeOrigin);
  await expect.poll(async () => (await readDiagnostics(page)).handles.find((handle) => handle.instanceId === remounted.instanceId)?.state)
    .toBe("disposed");
  const retiredSecond = (await readDiagnostics(page)).handles.find((handle) => handle.instanceId === remounted.instanceId)!;
  expect(retiredSecond.cleanupCompletedAt).not.toBeNull();
  expect(retiredSecond.cleanupError).toBeNull();
  expect(retiredSecond.resources.length).toBeGreaterThan(0);
  expect(retiredSecond.resources.every((resource) => resource.state === "disposed")).toBe(true);
  const lifecycle = JSON.stringify({
    documentTimeOriginPreserved: documentTimeOriginAfterFirstNavigation === timeOrigin
      && await page.evaluate(() => performance.timeOrigin) === timeOrigin,
    first: retiredFirst,
    remounted: retiredSecond,
  }, null, 2);
  await writeFile(join(PHASE_J_ARTIFACT_DIRECTORY, "native-phase-j-lifecycle.json"), lifecycle);
  await testInfo.attach("native-phase-j-lifecycle.json", {
    body: lifecycle,
    contentType: "application/json",
  });
});

test("native Interior and Architecture focus/movement states preserve canonical camera/film state", async ({ page }, testInfo) => {
  test.skip(!nativeRequired, "Run with OBSERVER_NATIVE_WEBGPU_REQUIRED=1 for native-only evidence");
  test.setTimeout(900_000);
  await page.goto(FIXTURE_PATH);
  const mounted = await waitForInitialHandle(page);
  assertNative(mounted);
  const cases = [
    { caseId: "interior-initial", sceneId: "interior-corner", aperture: 5.6, focusDistanceMm: 8000, riseMm: 0, swingDeg: 0, minimumPoints: 3 },
    { caseId: "interior-front-swing", sceneId: "interior-corner", aperture: 5.6, focusDistanceMm: 8000, riseMm: 0, swingDeg: 5, minimumPoints: 3 },
    { caseId: "interior-front-swing-focus", sceneId: "interior-corner", aperture: 5.6, focusDistanceMm: 8500, riseMm: 0, swingDeg: 5, minimumPoints: 3 },
    { caseId: "interior-rise-swing", sceneId: "interior-corner", aperture: 5.6, focusDistanceMm: 8000, riseMm: 12, swingDeg: 5, minimumPoints: 3 },
    { caseId: "architecture-initial", sceneId: "architecture-rise", aperture: 11, focusDistanceMm: 8890, riseMm: 0, swingDeg: 0, minimumPoints: 1 },
    { caseId: "architecture-rise", sceneId: "architecture-rise", aperture: 11, focusDistanceMm: 8890, riseMm: 20, swingDeg: 0, minimumPoints: 1 },
    { caseId: "architecture-rise-focus", sceneId: "architecture-rise", aperture: 11, focusDistanceMm: 9500, riseMm: 20, swingDeg: 0, minimumPoints: 1 },
  ] as const;
  const prefixes: string[] = [];
  const results: Array<Record<string, unknown>> = [];
  for (const state of cases) {
    const full32 = await runCase(page, `phase-j-${state.caseId}-full32`);
    assertAppliedPhaseJState(full32.operation, {
      caseId: state.caseId,
      sceneId: state.sceneId,
      gatherWidth: 512,
      sampleCount: 32,
      aperture: state.aperture,
      variant: "B0",
      focusDistanceMm: state.focusDistanceMm,
      frontRiseMm: state.riseMm,
      frontSwingDeg: state.swingDeg,
    });
    const halfB0 = await runCase(page, `phase-j-${state.caseId}-half32-b0`);
    assertAppliedPhaseJState(halfB0.operation, {
      caseId: state.caseId,
      sceneId: state.sceneId,
      gatherWidth: 256,
      sampleCount: 32,
      aperture: state.aperture,
      variant: "B0",
      focusDistanceMm: state.focusDistanceMm,
      frontRiseMm: state.riseMm,
      frontSwingDeg: state.swingDeg,
    });
    const b1 = await runCase(page, `phase-j-${state.caseId}-half32-b1`);
    assertNative(b1.handle);
    assertAppliedPhaseJState(b1.operation, {
      caseId: state.caseId,
      sceneId: state.sceneId,
      gatherWidth: 256,
      sampleCount: 32,
      aperture: state.aperture,
      variant: "B1",
      focusDistanceMm: state.focusDistanceMm,
      frontRiseMm: state.riseMm,
      frontSwingDeg: state.swingDeg,
    });
    const phaseJ = record(b1.operation.phaseJ);
    expect(metric(record(phaseJ.geometryEvidence), "distinctTwoMillimeterDepthBuckets")).toBeGreaterThan(1);
    expect(metric(record(phaseJ.physical), "validPixelCount")).toBeGreaterThan(0);
    const optical = record(phaseJ.opticalState);
    const cameraState = record(optical.cameraState);
    expect(cameraState.frontRiseMm).toBe(state.riseMm);
    expect(cameraState.frontSwingDeg).toBe(state.swingDeg);
    expect(cameraState.focusDistanceMm).toBe(state.focusDistanceMm);
    const lensCenter = record(record(optical.lens).centerWorldM);
    expect(Math.abs(Number(lensCenter.y) - state.riseMm / 1000)).toBeLessThan(1e-8);
    if (state.sceneId === "interior-corner" && state.swingDeg !== 0) {
      const lens = record(optical.lens);
      const lensNormal = record(lens.planeNormal);
      expect(Number(lensNormal.x)).toBeCloseTo(Math.sin(5 * Math.PI / 180), 8);
      expect(Number(lensNormal.y)).toBeCloseTo(0, 8);
      expect(Number(lensNormal.z)).toBeCloseTo(Math.cos(5 * Math.PI / 180), 8);
      expect(record(record(optical.film).planeNormal)).toEqual({ x: 0, y: 0, z: 1 });
    } else {
      expect(record(record(optical.lens).planeNormal)).toEqual({ x: 0, y: 0, z: 1 });
    }
    const comparisons = record(record(phaseJ.quality).comparisons);
    expect(comparisons.full32).not.toBeNull();
    expect(metric(comparisons.full32, "rootMeanSquareRgbError")).not.toBeNull();
    const b0Comparisons = record(record(halfB0.operation.phaseJ).quality).comparisons;
    expect(metric(record(b0Comparisons).full32, "rootMeanSquareRgbError")).not.toBeNull();
    const quality = record(phaseJ.quality);
    expect(metric(quality, "fallbackPixelCount") ?? 0).toBeGreaterThan(0);
    expect(metric(quality, "validFarPixelsUsingSourceFallback") ?? 0).toBeGreaterThan(0);
    expect(metric(quality, "fallbackSourceColorMismatchCount")).toBe(0);
    expect(metric(record(quality.pairedSourceDifferenceFromB0), "rootMeanSquareRgbError")).toBe(0);
    expect(metric(record(quality.pairedNearTargetDifferenceFromB0), "rootMeanSquareRgbError") ?? Infinity).toBeLessThan(1e-6);
    const points = Array.isArray(record(phaseJ.quality).pointComparisons)
      ? (record(phaseJ.quality).pointComparisons as unknown[]).map(record)
      : [];
    assertPointFootprintParity(quality, state.minimumPoints);
    expect(points.length).toBeGreaterThanOrEqual(state.minimumPoints);
    const b0Applied = { ...record(halfB0.operation.appliedState) };
    const b1Applied = { ...record(b1.operation.appliedState) };
    delete b0Applied.reconstructionVariant;
    delete b1Applied.reconstructionVariant;
    expect(b1Applied).toEqual(b0Applied);
    results.push({ caseId: state.caseId, operationId: b1.operation.operationId, phaseJ });
    prefixes.push(`${state.caseId}-full32-`, `${state.caseId}-half32-B0-`, `${state.caseId}-half32-B1-`);
  }
  await attachEvidence(page, testInfo, "native-phase-j-movements", prefixes);
  const movementResults = JSON.stringify(results, null, 2);
  await writeFile(join(PHASE_J_ARTIFACT_DIRECTORY, "native-phase-j-movements.json"), movementResults);
  await testInfo.attach("native-phase-j-movements.json", { body: movementResults, contentType: "application/json" });
});
