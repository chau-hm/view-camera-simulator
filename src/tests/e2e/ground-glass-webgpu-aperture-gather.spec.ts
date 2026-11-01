import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { REVISION } from "three";
import { planeFromPointNormal } from "../../core/math/plane";
import { vec } from "../../core/math/vec";
import { computePhysicalBlurFootprint } from "../../core/optics/computePhysicalBlurFootprint";
import {
  APERTURE_GATHER_CASES,
  clampPixelEllipse,
  mapPhysicalEllipseToSourcePixels,
  maximumPixelEllipseRadius,
  requireGatherReferenceProbePair,
  referenceGatherProbe,
  type GatherReferenceProbe,
} from "./fixtures/ground-glass-webgpu-aperture-gather-cases";

const FIXTURE_PATH = "/src/tests/e2e/fixtures/ground-glass-webgpu-aperture-gather.html";
const nativeWebGpuRequired = process.env.OBSERVER_NATIVE_WEBGPU_REQUIRED === "1";

type PointProbe = {
  id: string;
  worldPointM: [number, number, number];
  pixelTopOrigin: { x: number; y: number };
  pixelReadbackOrigin: "top" | "bottom";
  worldPositionErrorMm: number;
  gpuDepth: number;
  worldPositionMm: [number, number, number];
  physicalRgba16Float: [number, number, number, number];
  sourceColor: [number, number, number];
  farGatherRgba: [number, number, number, number];
  nearGatherRgba: [number, number, number, number];
  compositeColor: [number, number, number];
  validityCode: number;
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
  dimensions: null | {
    sourceWidthPx: number;
    sourceHeightPx: number;
    physicalCocWidthPx: number;
    physicalCocHeightPx: number;
    farGatherWidthPx: number;
    farGatherHeightPx: number;
    nearGatherWidthPx: number;
    nearGatherHeightPx: number;
    compositeWidthPx: number;
    compositeHeightPx: number;
    sampledFilmWidthMm: number;
    sampledFilmHeightMm: number;
    focusOffsetMm: number;
    quality: string;
    sampleCount: number;
    maximumCoCRadiusPx: number;
  };
  formats: null | Record<string, { requested: string; actual: string | null }>;
  passes: Array<{ id: string; state: string; error: string | null }>;
  metrics: null | {
    rawRedPixelCount: number;
    compositeRedPixelCount: number;
    nearSpreadPixelGain: number;
    rawYellowPixelCount: number;
    compositeYellowPixelCount: number;
    farSpreadPixelGain: number;
    farYellowSignalOutsideBluePixelCount: number;
    farYellowSignalOutsideBlueEnergy: number;
    nearRedSpreadOutsideSharpPixelCount: number;
    nearBlueBackgroundLeakPixelCount: number;
    farRedForegroundLeakPixelCount: number;
    nonzeroNearAlphaPixels: number;
    validPhysicalPixelCount: number;
    noDepthPixelCount: number;
    invalidPhysicalPixelCount: number;
    unresolvedPixelCount: number;
    nearSidePixelCount: number;
    farSidePixelCount: number;
    maximumAbsSignedCoCMm: number;
    maximumPhysicalAxisMm: number;
  };
  pointProbes: PointProbe[];
  gatherReferenceProbes: GatherReferenceProbe[];
  unresolvedSample: null | {
    validityCode: number;
    storedFootprint: [number, number, number, number];
    sourceColor: [number, number, number];
    farGather: [number, number, number, number];
    nearGather: [number, number, number, number];
  };
  sampleDiagnostics: null | {
    referencePixelRole: "far-gather-probe" | "center-pixel-fallback";
    pixelReadbackIndex: number;
    physicalMajorRadiusMm: number;
    physicalMinorRadiusMm: number;
    physicalOrientationRad: number;
    pixelMajorVectorPx: [number, number];
    pixelMinorVectorPx: [number, number];
    cpuReference: {
      maximumTransformedEllipseRadiusPx: number;
      rendererMaximumRadiusPx: number;
      clampScale: number;
      maximumClampedEllipseRadiusPx: number;
      firstApertureProposal: [number, number];
      firstTransformedFarSampleOffsetPx: [number, number];
      sampleCount: number;
    };
    gpu: {
      maximumTransformedEllipseRadiusPx: number;
      rendererMaximumRadiusPx: number;
      clampScale: number;
      maximumClampedEllipseRadiusPx: number;
    };
  };
  operations: Array<{
    operationId: string;
    kind: string;
    state: string;
    stage: string;
    completedAt: number | null;
    resultPublished: boolean;
    readbackStarted: boolean;
    readbackOutcome: string;
    error: string | null;
  }>;
  resources: Array<{ id: string; role: string; state: string; error: string | null }>;
  error: string | null;
  cleanupError: string | null;
  cleanupCompletedAt: number | null;
};
type Diagnostics = { status: string; activeHandleId: string | null; handles: Handle[] };

const readDiagnostics = async (page: Page): Promise<Diagnostics> => {
  const text = await page.getByTestId("fixture-diagnostics").textContent();
  if (!text) throw new Error("Phase F renderer diagnostics are not available");
  return JSON.parse(text) as Diagnostics;
};

const waitForLatestCompletedHandle = async (page: Page): Promise<Handle> => {
  await expect.poll(async () => {
    const diagnostics = await readDiagnostics(page);
    const handle = diagnostics.handles.find((entry) => entry.instanceId === diagnostics.activeHandleId);
    return Boolean(
      handle?.state === "active"
      && handle.operations.at(-1)?.state === "completed"
      && handle.operations.at(-1)?.resultPublished
      && handle.passes.some((pass) => pass.id === "display-pass" && pass.state === "completed"),
    );
  }, { timeout: 120_000, intervals: [100, 250, 500] }).toBe(true);
  const diagnostics = await readDiagnostics(page);
  const handle = diagnostics.handles.find((entry) => entry.instanceId === diagnostics.activeHandleId);
  if (!handle) throw new Error("No active Phase F handle was recorded after rendering");
  return handle;
};

const waitForNewCompletedOperation = async (page: Page, instanceId: string, previousCount: number): Promise<Handle> => {
  await expect.poll(async () => {
    const handle = (await readDiagnostics(page)).handles.find((entry) => entry.instanceId === instanceId);
    return Boolean(
      handle
      && handle.operations.length === previousCount + 1
      && handle.operations.at(-1)?.state === "completed"
      && handle.operations.at(-1)?.resultPublished,
    );
  }, { timeout: 120_000, intervals: [100, 250, 500] }).toBe(true);
  const handle = (await readDiagnostics(page)).handles.find((entry) => entry.instanceId === instanceId);
  if (!handle) throw new Error("Phase F handle " + instanceId + " disappeared while awaiting GPU completion");
  return handle;
};

const waitForHandle = async (page: Page, instanceId: string, state: string): Promise<Handle> => {
  await expect.poll(async () => {
    return (await readDiagnostics(page)).handles.find((entry) => entry.instanceId === instanceId)?.state === state;
  }, { timeout: 30_000, intervals: [100, 250, 500] }).toBe(true);
  const handle = (await readDiagnostics(page)).handles.find((entry) => entry.instanceId === instanceId);
  if (!handle) throw new Error("Missing lifecycle evidence for " + instanceId);
  return handle;
};

const captureComposite = async (page: Page, handle: Handle, testInfo: TestInfo, name: string) => {
  expect(handle.operations.at(-1)?.state).toBe("completed");
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await testInfo.attach(name, {
    body: await page.locator('canvas[aria-label="Native WebGPU aperture gather composite"]').screenshot(),
    contentType: "image/png",
  });
};

const centerColorForReferenceProbe = (probe: GatherReferenceProbe): [number, number, number] => {
  const localX = probe.x - probe.patch.left;
  const localY = probe.y - probe.patch.top;
  const index = localY * probe.patch.width + localX;
  const color = probe.patch.colors[index];
  if (!color) throw new Error(`Missing captured source color for ${probe.layer} reference probe`);
  return [...color];
};

const cpuFootprintAtWorldPosition = (
  worldPositionMm: [number, number, number],
  apertureFNumber: number,
  filmTiltDeg = 0,
  focusOffsetMm = 0,
) => {
  const tilt = filmTiltDeg * Math.PI / 180;
  const filmNormal = vec(0, -Math.sin(tilt), Math.cos(tilt));
  return computePhysicalBlurFootprint({
    objectPoint: vec(...worldPositionMm),
    lensCenter: vec(...APERTURE_GATHER_CASES.lensCenterMm),
    lensPlaneNormal: vec(...APERTURE_GATHER_CASES.lensNormal),
    lensPlaneBasisX: vec(...APERTURE_GATHER_CASES.lensBasisX),
    lensPlaneBasisY: vec(...APERTURE_GATHER_CASES.lensBasisY),
    filmPlane: planeFromPointNormal(
      vec(0, 0, APERTURE_GATHER_CASES.filmPointMm[2] + focusOffsetMm),
      filmNormal,
    ),
    filmPlaneBasisX: vec(1, 0, 0),
    filmPlaneBasisY: vec(0, Math.cos(tilt), Math.sin(tilt)),
    focalLengthMm: APERTURE_GATHER_CASES.focalLengthMm,
    apertureFNumber,
  });
};

const cpuFootprintForProbe = (
  probe: PointProbe,
  apertureFNumber: number,
  filmTiltDeg = 0,
  focusOffsetMm = 0,
) => cpuFootprintAtWorldPosition(probe.worldPositionMm, apertureFNumber, filmTiltDeg, focusOffsetMm);

const expectGatherProbePhysicalMatchesCpu = (
  probe: GatherReferenceProbe,
  apertureFNumber: number,
  filmTiltDeg = 0,
  focusOffsetMm = 0,
) => {
  const localX = probe.x - probe.patch.left;
  const localY = probe.y - probe.patch.top;
  const index = localY * probe.patch.width + localX;
  const worldPosition = probe.patch.worldAndDepth[index];
  const physical = probe.patch.physical[index];
  if (!worldPosition || !physical) throw new Error(`Missing captured physical inputs for ${probe.layer} gather reference`);
  const expected = cpuFootprintAtWorldPosition(
    [worldPosition[0], worldPosition[1], worldPosition[2]],
    apertureFNumber,
    filmTiltDeg,
    focusOffsetMm,
  );
  expect(expected.valid, `tilted/cropped ${probe.layer} CPU physical geometry`).toBe(true);
  const actualChannels = physical.slice(0, 3);
  const expectedChannels = [expected.signedCoCDiameterMm, expected.majorRadiusMm, expected.minorRadiusMm];
  expectedChannels.forEach((value, channel) => {
    expect(Math.abs(actualChannels[channel]! - value), `tilted/cropped ${probe.layer} physical channel ${channel}`).toBeLessThan(
      Math.max(0.04, Math.abs(value) * 0.03),
    );
  });
  if (expected.majorRadiusMm - expected.minorRadiusMm > 0.02) {
    const normalizedExpected = ((expected.orientationRad % Math.PI) + Math.PI) % Math.PI / Math.PI;
    const error = Math.abs(physical[3] - normalizedExpected);
    expect(Math.min(error, 1 - error), `tilted/cropped ${probe.layer} normalized orientation`).toBeLessThan(0.025);
  }
  return expected;
};

const expectPhysicalChannelsMatchCpu = (
  probe: PointProbe,
  apertureFNumber: number,
  filmTiltDeg = 0,
  focusOffsetMm = 0,
) => {
  const expected = cpuFootprintForProbe(probe, apertureFNumber, filmTiltDeg, focusOffsetMm);
  expect(expected.valid, `${probe.id} CPU physical geometry`).toBe(true);
  const actual = probe.physicalRgba16Float;
  const channels = [expected.signedCoCDiameterMm, expected.majorRadiusMm, expected.minorRadiusMm];
  channels.forEach((value, index) => {
    const tolerance = Math.max(0.03, Math.abs(value) * 0.025);
    expect(Math.abs(actual[index]! - value), `${probe.id} channel ${index} vs independent CPU footprint`).toBeLessThan(tolerance);
  });
  if (expected.majorRadiusMm - expected.minorRadiusMm > 0.02) {
    const expectedNormalizedOrientation = expected.orientationRad / Math.PI;
    const orientationError = Math.min(
      Math.abs(actual[3] - expectedNormalizedOrientation),
      1 - Math.abs(actual[3] - expectedNormalizedOrientation),
    );
    expect(orientationError, `${probe.id} normalized ellipse orientation`).toBeLessThan(0.02);
  }
  return expected;
};

test("ordinary Chromium can execute the isolated aperture-gather fixture without claiming native WebGPU", async ({ page }) => {
  test.skip(nativeWebGpuRequired, "Ordinary Chromium compatibility control runs in the standard Playwright project");
  test.setTimeout(120_000);
  await page.goto(FIXTURE_PATH);
  await expect(page.getByRole("heading", { name: "Native WebGPU physical aperture gather" })).toBeVisible();
  const handle = await waitForLatestCompletedHandle(page);
  expect(handle.runtime?.initialized).toBe(true);
  expect(handle.runtime?.threeRevision).toBe(REVISION);
  expect(handle.runtime?.executionBackend).not.toBe("webgpu");
  expect(handle.runtime?.applicationFallback).toBe(false);
  expect(handle.formats?.sceneColor.requested).toBe("rgba16float");
  expect(handle.formats?.physicalCoC.requested).toContain("rgba16float");
  expect(handle.metrics?.validPhysicalPixelCount).toBeGreaterThan(0);
  await captureComposite(page, handle, test.info(), "ordinary-chromium-aperture-composite.png");
});

test("native r186 WebGPU performs scene depth, physical CoC, far/near gathers, composite, and readback", async ({ page }) => {
  test.skip(!nativeWebGpuRequired, "Native WebGPU provenance requires the headed Chrome project");
  test.setTimeout(180_000);
  await page.goto(FIXTURE_PATH);
  await expect(page.getByRole("heading", { name: "Native WebGPU physical aperture gather" })).toBeVisible();
  const handle = await waitForLatestCompletedHandle(page);

  expect(handle.runtime).toMatchObject({
    rendererFamily: "webgpu-renderer",
    executionBackend: "webgpu",
    applicationFallback: false,
    initialized: true,
    threeRevision: "186",
  });
  expect(handle.dimensions).toMatchObject({
    sourceWidthPx: 128,
    sourceHeightPx: 96,
    physicalCocWidthPx: 128,
    physicalCocHeightPx: 96,
    farGatherWidthPx: 128,
    farGatherHeightPx: 96,
    nearGatherWidthPx: 128,
    nearGatherHeightPx: 96,
    compositeWidthPx: 128,
    compositeHeightPx: 96,
    sampledFilmWidthMm: 36,
    sampledFilmHeightMm: 24,
    quality: "standard",
    sampleCount: 32,
    maximumCoCRadiusPx: 12,
  });
  expect(handle.formats?.sceneColor.actual).toContain("rgba16float");
  expect(handle.formats?.sceneDepth.actual).toBeTruthy();
  expect(handle.formats?.physicalCoC.actual).toContain("rgba16float");
  expect(handle.formats?.validity.actual).toContain("rgba8unorm");
  expect(handle.formats?.farGather.actual).toContain("rgba16float");
  expect(handle.formats?.nearGather.actual).toContain("rgba16float");
  expect(handle.formats?.gatherRadiusDiagnostics.actual).toContain("rgba16float");
  expect(handle.formats?.composite.actual).toContain("rgba16float");
  expect(handle.passes.map((pass) => pass.id)).toEqual([
    "scene-color-depth",
    "physical-coc-and-validity",
    "gather-radius-diagnostics",
    "far-gather",
    "near-gather",
    "research-composite",
    "display-pass",
  ]);
  expect(handle.passes.every((pass) => pass.state === "completed")).toBe(true);
  expect(handle.operations.at(-1)).toMatchObject({ state: "completed", readbackStarted: true, readbackOutcome: "succeeded", resultPublished: true });
  expect(handle.metrics?.validPhysicalPixelCount).toBeGreaterThan(100);
  expect(handle.metrics?.noDepthPixelCount).toBeGreaterThan(0);
  expect(handle.metrics?.invalidPhysicalPixelCount).toBe(0);
  expect(handle.metrics?.unresolvedPixelCount).toBe(0);
  expect(handle.metrics?.nearSidePixelCount).toBeGreaterThan(0);
  expect(handle.metrics?.farSidePixelCount).toBeGreaterThan(0);
  expect(handle.metrics?.nonzeroNearAlphaPixels).toBeGreaterThan(0);
  expect(handle.metrics?.nearRedSpreadOutsideSharpPixelCount).toBeGreaterThan(0);
  expect(handle.metrics?.nearBlueBackgroundLeakPixelCount).toBe(0);
  expect(handle.metrics?.farRedForegroundLeakPixelCount).toBe(0);
  expect(handle.metrics?.farYellowSignalOutsideBluePixelCount).toBeGreaterThan(0);
  expect(handle.metrics?.farYellowSignalOutsideBlueEnergy).toBeGreaterThan(0);

  const gatherProbePair = requireGatherReferenceProbePair(handle.gatherReferenceProbes);
  expect(gatherProbePair.far.layer).toBe("far");
  expect(gatherProbePair.near.layer).toBe("near");
  const gatherReferences = [gatherProbePair.far, gatherProbePair.near].map((probe) => {
    const result = referenceGatherProbe(probe);
    expect(result.maxRgbError, `${probe.layer} gather CPU-reference RGB error`).toBeLessThan(0.04);
    expect(result.alphaError, `${probe.layer} gather CPU-reference coverage error`).toBeLessThan(0.025);
    return { layer: probe.layer, x: probe.x, y: probe.y, actualRgba: probe.actualRgba, ...result };
  });
  const baselineFarCenter = centerColorForReferenceProbe(gatherProbePair.far);
  expect(baselineFarCenter[2]).toBeGreaterThan(0.5);
  expect(gatherProbePair.far.actualRgba[0] - baselineFarCenter[0]).toBeGreaterThan(0.02);
  const baselineNearCenter = centerColorForReferenceProbe(gatherProbePair.near);
  expect(baselineNearCenter[0] < 0.5 || baselineNearCenter[1] > 0.12 || baselineNearCenter[2] > 0.12).toBe(true);
  expect(gatherProbePair.near.actualRgba[0]).toBeGreaterThan(0.5);
  expect(gatherProbePair.near.actualRgba[3]).toBeGreaterThan(0.02);

  const baselineDiagnostics = handle.sampleDiagnostics;
  expect(baselineDiagnostics?.referencePixelRole).toBe("far-gather-probe");
  expect(baselineDiagnostics?.gpu.rendererMaximumRadiusPx).toBe(12);
  expect(Math.abs((baselineDiagnostics?.gpu.maximumTransformedEllipseRadiusPx ?? 0)
    - (baselineDiagnostics?.cpuReference.maximumTransformedEllipseRadiusPx ?? 0))).toBeLessThan(0.05);
  expect(Math.abs((baselineDiagnostics?.gpu.clampScale ?? 0)
    - (baselineDiagnostics?.cpuReference.clampScale ?? 0))).toBeLessThan(0.005);
  expect(baselineDiagnostics?.gpu.maximumClampedEllipseRadiusPx).toBeLessThanOrEqual(12.02);

  const near = handle.pointProbes.find((probe) => probe.id === "near-red-foreground");
  const far = handle.pointProbes.find((probe) => probe.id === "far-yellow-feature");
  const focused = handle.pointProbes.find((probe) => probe.id === "focused-green-target");
  expect(near?.gpuDepth).toBeLessThan(1);
  expect(far?.gpuDepth).toBeLessThan(1);
  expect(near?.validityCode).toBe(1);
  expect(far?.validityCode).toBe(1);
  expect(focused?.validityCode).toBe(1);
  expect(near?.worldPositionErrorMm).toBeLessThan(15);
  expect(far?.worldPositionErrorMm).toBeLessThan(15);
  expect(near?.physicalRgba16Float[0]).toBeLessThan(0);
  expect(far?.physicalRgba16Float[0]).toBeGreaterThan(0);
  expect(Math.abs(focused?.physicalRgba16Float[0] ?? 1)).toBeLessThan(0.0001);
  expect(focused).toBeDefined();
  focused?.sourceColor.forEach((value, channel) => {
    expect(Math.abs((focused.compositeColor[channel] ?? 0) - value), `focused pixel channel ${channel} preserved`).toBeLessThan(0.015);
  });
  const cpuReferences = [near, far, focused].map((probe) => {
    if (!probe) throw new Error("Missing native point probe for CPU physical comparison");
    const cpu = expectPhysicalChannelsMatchCpu(probe, 1);
    const cpuChannels = [cpu.signedCoCDiameterMm, cpu.majorRadiusMm, cpu.minorRadiusMm];
    const gpuChannels = probe.physicalRgba16Float.slice(0, 3);
    return {
      id: probe.id,
      canonicalWorldPointMm: probe.worldPointM.map((value) => value * 1000),
      reconstructedWorldPointMm: probe.worldPositionMm,
      reconstructedPositionErrorMm: probe.worldPositionErrorMm,
      reconstructedObjectDistanceMm: probe.worldPositionMm[2],
      cpu,
      gpuPhysicalRgba16Float: probe.physicalRgba16Float,
      cpuMinusGpuPhysicalChannelsMm: cpuChannels.map((value, index) => value - gpuChannels[index]!),
    };
  });

  await captureComposite(page, handle, test.info(), "native-aperture-gather-composite.png");
  await test.info().attach("native-aperture-gather-cpu-footprint-comparisons.json", {
    body: Buffer.from(JSON.stringify({ physicalFootprints: cpuReferences, sampledGatherPixels: gatherReferences }, null, 2)),
    contentType: "application/json",
  });
});

test("native quality, aperture, film tilt, and off-center crop preserve physical units", async ({ page }) => {
  test.skip(!nativeWebGpuRequired, "Native WebGPU parameter-response evidence requires headed Chrome");
  test.setTimeout(240_000);
  await page.goto(FIXTURE_PATH);
  const initial = await waitForLatestCompletedHandle(page);
  const initialCount = initial.operations.length;
  const nearInitial = initial.pointProbes.find((probe) => probe.id === "near-red-foreground");
  expect(nearInitial).toBeDefined();

  await page.getByRole("button", { name: "Aperture f/2" }).click();
  const f2 = await waitForNewCompletedOperation(page, initial.instanceId, initialCount);
  const nearF2 = f2.pointProbes.find((probe) => probe.id === "near-red-foreground");
  expect(nearF2).toBeDefined();
  expect(Math.abs(nearF2?.physicalRgba16Float[0] ?? 0)).toBeLessThan(Math.abs(nearInitial?.physicalRgba16Float[0] ?? 0));
  expect(nearF2?.physicalRgba16Float[1]).toBeLessThan(nearInitial?.physicalRgba16Float[1] ?? 0);

  const beforeLowCount = f2.operations.length;
  await page.getByRole("button", { name: "Low resolution gather" }).click();
  const low = await waitForNewCompletedOperation(page, initial.instanceId, beforeLowCount);
  expect(low.dimensions).toMatchObject({ farGatherWidthPx: 64, farGatherHeightPx: 48, nearGatherWidthPx: 64, nearGatherHeightPx: 48, sampleCount: 16 });
  const lowNear = low.pointProbes.find((probe) => probe.id === "near-red-foreground");
  expect(lowNear?.physicalRgba16Float).toEqual(nearF2?.physicalRgba16Float);
  expect(low.metrics?.maximumAbsSignedCoCMm).toBeCloseTo(f2.metrics?.maximumAbsSignedCoCMm ?? 0, 3);

  const beforeCropCount = low.operations.length;
  await page.getByRole("button", { name: "Off-center 4x crop" }).click();
  const crop = await waitForNewCompletedOperation(page, initial.instanceId, beforeCropCount);
  expect(crop.dimensions).toMatchObject({ sampledFilmWidthMm: 9, sampledFilmHeightMm: 6, sourceWidthPx: 128, sourceHeightPx: 96 });
  const fullYellow = f2.pointProbes.find((probe) => probe.id === "far-yellow-feature");
  const cropYellow = crop.pointProbes.find((probe) => probe.id === "far-yellow-feature");
  expect(cropYellow?.gpuDepth).toBeLessThan(1);
  expect(cropYellow?.validityCode).toBe(1);
  expect(cropYellow?.worldPositionErrorMm).toBeLessThan(15);
  expect(cropYellow?.physicalRgba16Float[0]).toBeCloseTo(fullYellow?.physicalRgba16Float[0] ?? 0, 2);
  expect(cropYellow?.physicalRgba16Float[1]).toBeCloseTo(fullYellow?.physicalRgba16Float[1] ?? 0, 2);
  expect(cropYellow?.physicalRgba16Float[2]).toBeCloseTo(fullYellow?.physicalRgba16Float[2] ?? 0, 2);
  const fullPixelEllipse = mapPhysicalEllipseToSourcePixels(
    fullYellow?.physicalRgba16Float[1] ?? 0,
    fullYellow?.physicalRgba16Float[2] ?? 0,
    (fullYellow?.physicalRgba16Float[3] ?? 0) * Math.PI,
    { widthMm: 36, heightMm: 24 },
    { widthPx: 128, heightPx: 96 },
  );
  const cropPixelEllipse = mapPhysicalEllipseToSourcePixels(
    cropYellow?.physicalRgba16Float[1] ?? 0,
    cropYellow?.physicalRgba16Float[2] ?? 0,
    (cropYellow?.physicalRgba16Float[3] ?? 0) * Math.PI,
    { widthMm: 9, heightMm: 6 },
    { widthPx: 128, heightPx: 96 },
  );
  expect(cropPixelEllipse.major[0] / fullPixelEllipse.major[0]).toBeCloseTo(4, 1);
  expect(cropPixelEllipse.minor[1] / fullPixelEllipse.minor[1]).toBeCloseTo(4, 1);
  expect(crop.sampleDiagnostics?.referencePixelRole).toBe("far-gather-probe");
  expect(crop.sampleDiagnostics?.pixelMajorVectorPx.some((axis) => Math.abs(axis) > 0)).toBe(true);

  const beforeTiltCount = crop.operations.length;
  await page.getByRole("button", { name: "Tilt film 12 degrees" }).click();
  const tilted = await waitForNewCompletedOperation(page, initial.instanceId, beforeTiltCount);
  const tiltedYellow = tilted.pointProbes.find((probe) => probe.id === "far-yellow-feature");
  expect(tiltedYellow?.validityCode).toBe(1);
  expect(tiltedYellow?.physicalRgba16Float[1]).not.toBeCloseTo(cropYellow?.physicalRgba16Float[1] ?? 0, 3);
  if (!tiltedYellow) throw new Error("Missing tilted yellow point probe");
  const tiltedCpu = expectPhysicalChannelsMatchCpu(tiltedYellow, 2, 12);
  expect(tiltedCpu.valid).toBe(true);
  expect(tiltedYellow.physicalRgba16Float[1] - tiltedYellow.physicalRgba16Float[2]).toBeGreaterThan(0.02);
  const tiltedGatherProbePair = requireGatherReferenceProbePair(tilted.gatherReferenceProbes);
  const tiltedFarPhysical = expectGatherProbePhysicalMatchesCpu(tiltedGatherProbePair.far, 2, 12);
  const tiltedFarComparison = referenceGatherProbe(tiltedGatherProbePair.far);
  expect(tiltedFarComparison.maxRgbError, "tilted/cropped far gather RGB mismatch").toBeLessThan(0.04);
  expect(tiltedFarComparison.alphaError, "tilted/cropped far gather alpha mismatch").toBeLessThan(0.025);
  const tiltedNearComparison = referenceGatherProbe(tiltedGatherProbePair.near);
  expect(tiltedNearComparison.maxRgbError, "tilted/cropped near gather RGB mismatch").toBeLessThan(0.04);
  expect(tiltedNearComparison.alphaError, "tilted/cropped near coverage mismatch").toBeLessThan(0.025);
  const tiltedFarCenter = centerColorForReferenceProbe(tiltedGatherProbePair.far);
  expect(tiltedFarCenter[2], "tilted far probe source is blue background").toBeGreaterThan(0.5);
  expect(tiltedGatherProbePair.far.actualRgba[0] - tiltedFarCenter[0], "tilted far probe has a real yellow contribution").toBeGreaterThan(0.02);
  const tiltedNearCenter = centerColorForReferenceProbe(tiltedGatherProbePair.near);
  expect(tiltedNearCenter[0] < 0.5 || tiltedNearCenter[1] > 0.12 || tiltedNearCenter[2] > 0.12, "tilted near probe is outside the sharp red silhouette").toBe(true);
  expect(tiltedGatherProbePair.near.actualRgba[0], "tilted near probe contains foreground red").toBeGreaterThan(0.5);
  expect(tiltedGatherProbePair.near.actualRgba[3], "tilted near probe has measured coverage").toBeGreaterThan(0.02);
  const tiltedSampleDiagnostics = tilted.sampleDiagnostics;
  if (!tiltedSampleDiagnostics) throw new Error("Missing tilted native GPU radius diagnostics");
  expect(tiltedSampleDiagnostics.referencePixelRole).toBe("far-gather-probe");
  expect(tiltedSampleDiagnostics.physicalMajorRadiusMm - tiltedSampleDiagnostics.physicalMinorRadiusMm).toBeGreaterThan(0.02);
  const normalizedTiltedOrientation = ((tiltedFarPhysical.orientationRad % Math.PI) + Math.PI) % Math.PI;
  expect(Math.min(
    Math.abs(tiltedSampleDiagnostics.physicalOrientationRad - normalizedTiltedOrientation),
    Math.PI - Math.abs(tiltedSampleDiagnostics.physicalOrientationRad - normalizedTiltedOrientation),
  )).toBeLessThan(0.08);
  const tiltedFilm = tilted.dimensions;
  if (!tiltedFilm) throw new Error("Missing tilted/cropped source dimensions");
  const expectedTiltedPixelEllipse = mapPhysicalEllipseToSourcePixels(
    tiltedFarPhysical.majorRadiusMm,
    tiltedFarPhysical.minorRadiusMm,
    normalizedTiltedOrientation,
    { widthMm: tiltedFilm.sampledFilmWidthMm, heightMm: tiltedFilm.sampledFilmHeightMm },
    { widthPx: tiltedFilm.sourceWidthPx, heightPx: tiltedFilm.sourceHeightPx },
  );
  const expectedTiltedMaximumRadiusPx = maximumPixelEllipseRadius(expectedTiltedPixelEllipse);
  const expectedTiltedClamp = clampPixelEllipse(expectedTiltedPixelEllipse, 12);
  expect(Math.abs(expectedTiltedPixelEllipse.major[0] - tiltedSampleDiagnostics.pixelMajorVectorPx[0])).toBeLessThan(0.4);
  expect(Math.abs(expectedTiltedPixelEllipse.major[1] - tiltedSampleDiagnostics.pixelMajorVectorPx[1])).toBeLessThan(0.4);
  expect(Math.abs(expectedTiltedPixelEllipse.minor[0] - tiltedSampleDiagnostics.pixelMinorVectorPx[0])).toBeLessThan(0.4);
  expect(Math.abs(expectedTiltedPixelEllipse.minor[1] - tiltedSampleDiagnostics.pixelMinorVectorPx[1])).toBeLessThan(0.4);
  expect(tiltedSampleDiagnostics.gpu.maximumTransformedEllipseRadiusPx).toBeCloseTo(expectedTiltedMaximumRadiusPx, 1);
  expect(tiltedSampleDiagnostics.gpu.clampScale).toBeCloseTo(expectedTiltedClamp.clampScale, 2);
  const tiltedPixelAxisDot = tiltedSampleDiagnostics.pixelMajorVectorPx[0] * tiltedSampleDiagnostics.pixelMinorVectorPx[0]
    + tiltedSampleDiagnostics.pixelMajorVectorPx[1] * tiltedSampleDiagnostics.pixelMinorVectorPx[1];
  expect(Math.abs(tiltedPixelAxisDot), "anisotropic pixel transform produces a nonorthogonal ellipse").toBeGreaterThan(0.1);
  expect(tiltedSampleDiagnostics.cpuReference.maximumTransformedEllipseRadiusPx).toBeGreaterThan(12.02);
  expect(tiltedSampleDiagnostics.gpu.maximumTransformedEllipseRadiusPx).toBeCloseTo(
    tiltedSampleDiagnostics.cpuReference.maximumTransformedEllipseRadiusPx,
    1,
  );
  expect(tiltedSampleDiagnostics.gpu.clampScale).toBeCloseTo(tiltedSampleDiagnostics.cpuReference.clampScale, 2);
  expect(tiltedSampleDiagnostics.gpu.maximumClampedEllipseRadiusPx).toBeLessThanOrEqual(12.02);
  expect(tiltedSampleDiagnostics.gpu.rendererMaximumRadiusPx).toBe(12);
  expect(Math.hypot(...tiltedSampleDiagnostics.cpuReference.firstTransformedFarSampleOffsetPx)).toBeLessThanOrEqual(12 + 1e-8);
  const tiltedGatherComparisons = [
    { layer: "far" as const, actualRgba: tiltedGatherProbePair.far.actualRgba, ...tiltedFarComparison },
    { layer: "near" as const, actualRgba: tiltedGatherProbePair.near.actualRgba, ...tiltedNearComparison },
  ];

  const beforeStressCount = tilted.operations.length;
  await page.getByRole("button", { name: "64 sample gather" }).click();
  const stress = await waitForNewCompletedOperation(page, initial.instanceId, beforeStressCount);
  expect(stress.dimensions).toMatchObject({ farGatherWidthPx: 128, farGatherHeightPx: 96, sampleCount: 64 });
  expect(stress.dimensions?.maximumCoCRadiusPx).toBe(12);

  const beforeFocusCount = stress.operations.length;
  await page.getByRole("button", { name: "Reset focus plane" }).click();
  const resetFocus = await waitForNewCompletedOperation(page, initial.instanceId, beforeFocusCount);
  const resetGreen = resetFocus.pointProbes.find((probe) => probe.id === "focused-green-target");
  if (!resetGreen) throw new Error("Missing focused target probe after resetting focus plane");
  const resetCpu = expectPhysicalChannelsMatchCpu(resetGreen, 2, 12, 0);
  expect(resetGreen.physicalRgba16Float[0]).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Shift focus plane +1mm" }).click();
  const shiftedFocus = await waitForNewCompletedOperation(page, initial.instanceId, resetFocus.operations.length);
  const shiftedGreen = shiftedFocus.pointProbes.find((probe) => probe.id === "focused-green-target");
  expect(shiftedFocus.dimensions?.focusOffsetMm).toBe(1);
  expect(Math.abs(shiftedGreen?.physicalRgba16Float[0] ?? 0)).toBeGreaterThan(0.05);
  if (!shiftedGreen) throw new Error("Missing focused target probe after film-plane shift");
  const shiftedCpu = expectPhysicalChannelsMatchCpu(shiftedGreen, 2, 12, 1);
  expect(shiftedGreen.physicalRgba16Float[0]).toBeLessThan(0);
  expect(Math.sign(shiftedCpu.signedCoCDiameterMm)).not.toBe(Math.sign(resetCpu.signedCoCDiameterMm));

  const beforeUnresolvedCount = shiftedFocus.operations.length;
  await page.getByRole("button", { name: "Force unresolved diagnostic" }).click();
  const unresolved = await waitForNewCompletedOperation(page, initial.instanceId, beforeUnresolvedCount);
  expect(unresolved.metrics?.unresolvedPixelCount).toBeGreaterThan(0);
  expect(unresolved.metrics?.invalidPhysicalPixelCount).toBe(0);
  expect(unresolved.unresolvedSample?.validityCode).toBe(4);
  expect(unresolved.unresolvedSample?.storedFootprint).toEqual([0, 0, 0, 0]);
  expect(unresolved.unresolvedSample?.farGather.slice(0, 3)).toEqual(unresolved.unresolvedSample?.sourceColor);
  await page.getByRole("button", { name: "Clear unresolved diagnostic" }).click();
  const cleared = await waitForNewCompletedOperation(page, initial.instanceId, unresolved.operations.length);
  expect(cleared.metrics?.unresolvedPixelCount).toBe(0);

  await test.info().attach("native-quality-crop-tilt-diagnostics.json", {
    body: Buffer.from(JSON.stringify({ initial, f2, low, crop, tilted, tiltedCpu, tiltedGatherComparisons, stress, resetFocus, resetGreen, resetCpu, shiftedFocus, shiftedGreen, shiftedCpu, unresolved, cleared }, null, 2)),
    contentType: "application/json",
  });
});

test("native SPA navigation retires a held readback and remounts an independent renderer", async ({ page }) => {
  test.skip(!nativeWebGpuRequired, "Native WebGPU lifecycle proof requires headed Chrome");
  test.setTimeout(240_000);
  await page.goto(FIXTURE_PATH);
  const first = await waitForLatestCompletedHandle(page);
  const documentToken = await page.evaluate(() => document.documentElement.dataset.phaseFDocumentToken ??= crypto.randomUUID());
  const operationCount = first.operations.length;
  await page.getByRole("button", { name: "Start held native readback" }).click();
  await expect.poll(async () => {
    const handle = (await readDiagnostics(page)).handles.find((entry) => entry.instanceId === first.instanceId);
    const operation = handle?.operations.at(-1);
    return operation?.state === "running" && operation.readbackStarted && operation.readbackOutcome === "pending";
  }, { timeout: 120_000, intervals: [100, 250, 500] }).toBe(true);
  const held = (await readDiagnostics(page)).handles.find((entry) => entry.instanceId === first.instanceId);
  const heldOperation = held?.operations.at(-1);
  expect(heldOperation?.operationId).toBe(first.instanceId + ":op-" + (operationCount + 1));

  await page.getByRole("link", { name: "Navigate away (SPA)" }).click();
  await expect(page.getByTestId("away-route")).toBeVisible();
  await expect.poll(async () => (await readDiagnostics(page)).handles.find((entry) => entry.instanceId === first.instanceId)?.state)
    .toBe("retiring");
  const retiring = (await readDiagnostics(page)).handles.find((entry) => entry.instanceId === first.instanceId);
  expect(retiring?.resources.every((resource) => resource.state === "disposal-requested")).toBe(true);
  expect(await page.evaluate(() => document.documentElement.dataset.phaseFDocumentToken)).toBe(documentToken);

  await page.getByRole("button", { name: "Release held readback" }).click();
  const retired = await waitForHandle(page, first.instanceId, "disposed");
  expect(retired.operations.at(-1)).toMatchObject({
    operationId: first.instanceId + ":op-" + (operationCount + 1),
    state: "retired",
    stage: "stale-readback-discarded",
    readbackOutcome: "succeeded",
    resultPublished: false,
    error: null,
  });
  expect(retired.resources.every((resource) => resource.state === "disposed")).toBe(true);
  expect(retired.cleanupError).toBeNull();

  await page.getByRole("link", { name: "Return to experiment (SPA)" }).click();
  const second = await waitForLatestCompletedHandle(page);
  expect(second.instanceId).not.toBe(first.instanceId);
  expect(second.generation).toBeGreaterThan(first.generation);
  expect(second.runtime?.executionBackend).toBe("webgpu");
  expect(second.metrics?.nearRedSpreadOutsideSharpPixelCount).toBeGreaterThan(0);
  await page.getByRole("link", { name: "Navigate away (SPA)" }).click();
  const secondRetired = await waitForHandle(page, second.instanceId, "disposed");
  expect(secondRetired.resources.every((resource) => resource.state === "disposed")).toBe(true);
});

test("native pass failures remain observable and release the exact owning handle", async ({ page }) => {
  test.skip(!nativeWebGpuRequired, "Native WebGPU failure cleanup proof requires headed Chrome");
  test.setTimeout(300_000);
  await page.goto(FIXTURE_PATH);
  let handle = await waitForLatestCompletedHandle(page);
  const failureCases = [
    { button: "Fail after physical CoC", expectedPass: "physical-coc-and-validity" },
    { button: "Fail after far gather", expectedPass: "far-gather" },
    { button: "Fail after near gather", expectedPass: "near-gather" },
    { button: "Fail after composite", expectedPass: "research-composite" },
  ];

  for (const failureCase of failureCases) {
    const failedId = handle.instanceId;
    const previousCount = handle.operations.length;
    await page.getByRole("button", { name: failureCase.button }).click();
    await expect.poll(async () => {
      const current = (await readDiagnostics(page)).handles.find((entry) => entry.instanceId === failedId);
      const operation = current?.operations.at(-1);
      return current?.state === "disposed"
        && current.operations.length === previousCount + 1
        && operation?.state === "failed"
        && operation.error?.includes("Injected Phase F failure") === true;
    }, { timeout: 120_000, intervals: [100, 250, 500] }).toBe(true);
    const failed = (await readDiagnostics(page)).handles.find((entry) => entry.instanceId === failedId);
    expect(failed?.runtime?.executionBackend).toBe("webgpu");
    expect(failed?.passes.at(-1)).toMatchObject({ id: failureCase.expectedPass, state: "completed" });
    expect(failed?.resources.every((resource) => resource.state === "disposed")).toBe(true);

    await page.getByRole("link", { name: "Navigate away (SPA)" }).click();
    await page.getByRole("link", { name: "Return to experiment (SPA)" }).click();
    handle = await waitForLatestCompletedHandle(page);
    expect(handle.instanceId).not.toBe(failedId);
  }
});
