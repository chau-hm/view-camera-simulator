import { expect, test, type Page } from "@playwright/test";
import * as THREE from "three";
import { planeFromPointNormal } from "../../core/math/plane";
import { vec } from "../../core/math/vec";
import { computePhysicalBlurFootprint } from "../../core/optics/computePhysicalBlurFootprint";
import { decodeGroundGlassFootprintOrientation, encodeGroundGlassFootprintOrientation } from "../../render/groundGlassCocTarget";
import { DEPTH_PROBE_CASES, PHYSICAL_CLASSIFICATION_CASES } from "./fixtures/ground-glass-webgpu-physical-coc-cases";

const FIXTURE_PATH = "/src/tests/e2e/fixtures/ground-glass-webgpu-physical-coc.html";
const nativeWebGpuRequired = process.env.OBSERVER_NATIVE_WEBGPU_REQUIRED === "1";

type Probe = {
  id: string;
  pixel: { x: number; y: number };
  uvTopOrigin: [number, number];
  expectedSurfaceId: string;
  actualSurfaceId: string | null;
  depthEvidence: "visible-geometry" | "clear-background" | "covered-clear-depth-ambiguous" | "depth-without-reference";
  occludedSurfaceIds: string[];
  gpuDepth: number;
  reconstructedWorldM: [number, number, number];
  expectedWorldM: [number, number, number] | null;
  absoluteErrorM: [number, number, number] | null;
  errorMagnitudeM: number | null;
  valid: boolean;
};
type PhysicalSample = {
  id: string;
  sourceProbeId: string;
  input: {
    id: string;
    sourceProbeId: string;
    focalLengthMm: number;
    canonicalObjectDistanceMm: number;
    controlledObjectPointMm?: readonly [number, number, number];
    focalBoundary?: {
      targetObjectMinusFocalMm: number;
      expectedRegime: "finite-virtual" | "parallel-limit" | "finite-real";
      inputSource: "depth" | "controlled-world-point";
      explicitParallelLimitIdentity?: boolean;
    };
    apertureFNumber: number;
    lensCenterMm: readonly [number, number, number];
    lensPlaneNormal: readonly [number, number, number];
    lensPlaneBasisX: readonly [number, number, number];
    lensPlaneBasisY: readonly [number, number, number];
    filmPlanePointMm: readonly [number, number, number];
    filmPlaneNormal: readonly [number, number, number];
    filmPlaneBasisX: readonly [number, number, number];
    filmPlaneBasisY: readonly [number, number, number];
    sourceUv: [number, number];
  };
  gpuDepth: number;
  reconstructedWorldMm: [number, number, number];
  storedRgba16Float: [number, number, number, number];
  validityCode: number;
  storageRepresentable: boolean;
  orientationUnwrappedAngleRad: number;
  orientationRad: number;
  orientationNormalized: number;
  orientationDefined: boolean;
  focalDistance: null | {
    inputSource: "depth" | "controlled-world-point";
    expectedRegime: "finite-virtual" | "parallel-limit" | "finite-real";
    canonicalObjectDistanceMm: number;
    gpuDepthReconstructedObjectDistanceMm: number | null;
    kernelObjectDistanceMm: number;
    canonicalObjectMinusFocalMm: number;
    gpuDepthReconstructedObjectMinusFocalMm: number | null;
    kernelObjectMinusFocalMm: number;
    depthReconstructionErrorMm: number | null;
    depthClassificationResolution: "resolved" | "depth-limited" | "explicit-limit" | "not-applicable";
    explicitParallelLimitIdentity: boolean;
    selectedPhysicalBranch: "finite-virtual" | "parallel-limit" | "finite-real" | "unresolved";
  };
  rawSignClassification: "near" | "neutral" | "far" | "no-depth" | "invalid-geometry" | "unrepresentable" | "unresolved-focal-boundary";
  nearFocusComparison: "within-tolerance" | "outside-tolerance" | "not-applicable";
};
type Diagnostics = {
  status: string;
  handles: Array<{
    instanceId: string;
    state: string;
    runtime: null | {
      rendererFamily: string;
      executionBackend: string;
      applicationFallback: boolean;
      initialized: boolean;
      threeRevision: string;
    };
    depth: null | {
      requestedFormat: string;
      requestedType: string;
      actualGpuFormat: string | null;
      width: number;
      height: number;
      sampleCount: number;
      clearDepth: number;
    };
    camera: null | {
      near: number;
      far: number;
      coordinateSystem: number;
      projectionMatrix: number[];
      projectionMatrixInverse: number[];
      worldMatrix: number[];
      offAxisViewOffsetPx: { x: number; y: number };
    };
    probes: Probe[];
    crop: null | {
      sourceProbeId: string;
      cropViewOffsetPx: { fullWidth: number; fullHeight: number; x: number; y: number; width: number; height: number };
      cropOutputSizePx: { width: number; height: number };
      actualDepthGpuFormat: string | null;
      fullFilmUv: [number, number];
      cropFilmUv: [number, number];
      cropPixel: { x: number; y: number };
      expectedSurfaceId: string;
      actualSurfaceId: string | null;
      depthEvidence: "visible-geometry" | "clear-background" | "covered-clear-depth-ambiguous" | "depth-without-reference";
      gpuDepth: number;
      expectedWorldMm: [number, number, number] | null;
      reconstructedWorldMm: [number, number, number];
      worldErrorMm: number | null;
      fullPhysicalRgba16Float: [number, number, number, number];
      cropPhysicalRgba16Float: [number, number, number, number];
      sampledFilmDimensionsMm: { full: { widthMm: number; heightMm: number }; crop: { widthMm: number; heightMm: number } };
      physicalCoCDifferenceMm: number;
      validityCode: number;
      cameraProjectionMatrix: number[];
    };
    operations: Array<{
      operationId: string;
      kind: string;
      state: string;
      stage: string;
      failureClassification: "readback" | "execution" | "test-injected-readback" | null;
      readbackStarted: boolean;
      readbackOutcome: string;
      resultPublished: boolean;
      error: string | null;
    }>;
    physical: null | {
      requestedFormat: string;
      actualGpuFormat: string | null;
      validityFormat: string;
      actualValidityGpuFormat: string | null;
      samples: PhysicalSample[];
    };
    resources: Array<{ role: string; state: string; error: string | null }>;
    error: string | null;
  }>;
};

const readDiagnostics = async (page: Page): Promise<Diagnostics> => {
  const text = await page.getByTestId("physical-coc-diagnostics").textContent();
  if (!text) throw new Error("Physical CoC fixture diagnostics are not available");
  return JSON.parse(text) as Diagnostics;
};

const waitForCompletedHandle = async (page: Page) => {
  await expect.poll(async () => {
    try {
      const diagnostics = await readDiagnostics(page);
      return diagnostics.status === "completed" && diagnostics.handles.at(-1)?.state === "active";
    } catch {
      return false;
    }
  }, { timeout: 90_000, intervals: [100, 250, 500] }).toBe(true);
  const diagnostics = await readDiagnostics(page);
  const handle = diagnostics.handles.at(-1);
  if (!handle) throw new Error("No native renderer handle was recorded");
  return { diagnostics, handle };
};

const waitForHandle = async (
  page: Page,
  instanceId: string,
  predicate: (handle: Diagnostics["handles"][number]) => boolean,
) => {
  await expect.poll(async () => {
    const handle = (await readDiagnostics(page)).handles.find((entry) => entry.instanceId === instanceId);
    return handle ? predicate(handle) : false;
  }, { timeout: 30_000, intervals: [100, 250, 500] }).toBe(true);
  const handle = (await readDiagnostics(page)).handles.find((entry) => entry.instanceId === instanceId);
  if (!handle) throw new Error(`Lifecycle evidence for ${instanceId} disappeared`);
  return handle;
};

test("native scene depth and TSL physical footprints match independent geometry and CPU optics", async ({ page }, testInfo) => {
  await page.goto(FIXTURE_PATH);
  await expect(page.getByTestId("physical-coc-experiment")).toBeVisible();
  const { handle } = await waitForCompletedHandle(page);
  expect(handle.error).toBeNull();
  expect(handle.runtime?.initialized).toBe(true);
  expect(handle.runtime?.threeRevision).toBe(nativeWebGpuRequired ? "186" : THREE.REVISION);
  if (nativeWebGpuRequired) {
    expect(handle.runtime?.rendererFamily).toBe("webgpu-renderer");
    expect(handle.runtime?.executionBackend).toBe("webgpu");
    expect(handle.runtime?.applicationFallback).toBe(false);
  }
  expect(handle.depth).toMatchObject({
    requestedFormat: "DepthFormat",
    requestedType: "UnsignedIntType",
    width: 320,
    height: 240,
    sampleCount: DEPTH_PROBE_CASES.length,
    clearDepth: 1,
  });
  if (nativeWebGpuRequired) expect(handle.depth?.actualGpuFormat).toBeTruthy();
  expect(handle.camera?.near).toBeGreaterThan(0);
  expect(handle.camera?.far).toBeGreaterThan(handle.camera?.near ?? 0);
  expect(handle.camera?.offAxisViewOffsetPx).toEqual({ x: -13, y: 7 });
  expect(handle.camera?.projectionMatrix).toHaveLength(16);
  expect(handle.camera?.projectionMatrixInverse).toHaveLength(16);
  expect(handle.camera?.worldMatrix).toHaveLength(16);
  expect(handle.probes).toHaveLength(DEPTH_PROBE_CASES.length);

  for (const probe of handle.probes.filter((entry) => entry.expectedSurfaceId !== "background")) {
    expect(probe.actualSurfaceId, `${probe.id} should hit its independently identified fixture surface`)
      .toBe(probe.expectedSurfaceId);
    expect(probe.valid, `${probe.id} should contain scene depth`).toBe(true);
    expect(probe.depthEvidence, `${probe.id} should be GPU-observed geometry`).toBe("visible-geometry");
    expect(probe.gpuDepth, `${probe.id} should not be the depth clear value`).toBeLessThan(1);
    expect(probe.expectedWorldM, `${probe.id} should have an analytic ray/plane intersection`).not.toBeNull();
    expect(probe.errorMagnitudeM, `${probe.id} reconstruction error`).toBeLessThan(0.001);
  }
  const background = handle.probes.find((entry) => entry.expectedSurfaceId === "background");
  expect(background).toBeDefined();
  expect(background?.gpuDepth).toBe(1);
  expect(background?.depthEvidence).toBe("clear-background");
  expect(background?.actualSurfaceId).toBeNull();
  expect(background?.valid).toBe(false);
  const farClip = handle.probes.find((entry) => entry.id === "far-clip-upper-right");
  expect(farClip?.expectedSurfaceId).toBe("far-depth-plane");
  expect(farClip?.actualSurfaceId).toBe("far-depth-plane");
  expect(farClip?.depthEvidence).toBe("visible-geometry");
  expect(farClip?.gpuDepth).toBeGreaterThan(0.999999);
  expect(farClip?.gpuDepth).toBeLessThan(1);
  expect(farClip?.valid).toBe(true);
  expect(handle.probes.filter((entry) => entry.depthEvidence === "covered-clear-depth-ambiguous")).toHaveLength(0);
  const overlap = handle.probes.find((entry) => entry.id === "occluded-front-marker");
  expect(overlap?.actualSurfaceId).toBe("occlusion-marker");
  expect(overlap?.occludedSurfaceIds).toContain("far-front-plane");
  expect(handle.physical).not.toBeNull();
  expect(handle.physical?.requestedFormat).toBe("rgba16float");
  expect(handle.physical?.validityFormat).toBe("rgba8unorm");
  expect(handle.physical?.samples).toHaveLength(PHYSICAL_CLASSIFICATION_CASES.length);
  if (nativeWebGpuRequired) {
    expect(handle.physical?.actualGpuFormat).toBe("rgba16float");
    expect(handle.physical?.actualValidityGpuFormat).toBe("rgba8unorm");
  }
  const crop = handle.crop;
  expect(crop).not.toBeNull();
  if (nativeWebGpuRequired) expect(crop?.actualDepthGpuFormat).toBeTruthy();
  expect(crop?.cropViewOffsetPx).toMatchObject({ fullWidth: 320, fullHeight: 240, width: 80, height: 60 });
  expect(crop?.cropViewOffsetPx.x).toBeGreaterThan(0);
  expect(crop?.cropViewOffsetPx.x).toBeLessThan(240);
  expect(crop?.cropViewOffsetPx.y).toBeGreaterThan(0);
  expect(crop?.cropViewOffsetPx.y).toBeLessThan(180);
  expect(crop?.cropViewOffsetPx.x).not.toBe(120);
  expect(crop?.cropViewOffsetPx.y).not.toBe(90);
  expect(crop?.cropOutputSizePx).toEqual({ width: 320, height: 240 });
  expect(crop?.cropFilmUv).not.toEqual(crop?.fullFilmUv);
  expect(crop?.actualSurfaceId).toBe(crop?.expectedSurfaceId);
  expect(crop?.expectedSurfaceId).toBe("tilted-plane");
  expect(crop?.depthEvidence).toBe("visible-geometry");
  expect(crop?.gpuDepth).toBeLessThan(1);
  expect(crop?.worldErrorMm).not.toBeNull();
  expect(crop?.worldErrorMm).toBeLessThan(0.01);
  expect(crop?.sampledFilmDimensionsMm).toEqual({
    full: { widthMm: 36, heightMm: 24 },
    crop: { widthMm: 9, heightMm: 6 },
  });
  expect(crop?.validityCode).toBe(1);
  expect(crop?.physicalCoCDifferenceMm).toBeLessThan(0.05);
  const probeById = new Map(handle.probes.map((probe) => [probe.id, probe]));
  for (const sample of handle.physical?.samples ?? []) {
    if (sample.input.focalBoundary) continue;
    const source = probeById.get(sample.sourceProbeId);
    expect(source, `${sample.id} source probe`).toBeDefined();
    if (!source?.expectedWorldM) {
      expect(sample.validityCode, `${sample.id} background/no-depth code`).toBe(0);
      expect(sample.storedRgba16Float).toEqual([0, 0, 0, 0]);
      continue;
    }
    const input = sample.input;
    const reference = computePhysicalBlurFootprint({
      objectPoint: vec(source.expectedWorldM[0] * 1000, source.expectedWorldM[1] * 1000, source.expectedWorldM[2] * 1000),
      lensCenter: vec(...input.lensCenterMm),
      lensPlaneNormal: vec(...input.lensPlaneNormal),
      lensPlaneBasisX: vec(...input.lensPlaneBasisX),
      lensPlaneBasisY: vec(...input.lensPlaneBasisY),
      filmPlane: planeFromPointNormal(vec(...input.filmPlanePointMm), vec(...input.filmPlaneNormal)),
      filmPlaneBasisX: vec(...input.filmPlaneBasisX),
      filmPlaneBasisY: vec(...input.filmPlaneBasisY),
      focalLengthMm: input.focalLengthMm,
      apertureFNumber: input.apertureFNumber,
    });
    if (!reference.valid) {
      expect(sample.validityCode, `${sample.id} invalid geometry code`).toBe(3);
      continue;
    }
    const physicalChannels = [reference.signedCoCDiameterMm, reference.majorRadiusMm, reference.minorRadiusMm];
    const exceedsHalfRange = physicalChannels.some((value) => !Number.isFinite(value) || Math.abs(value) > 65504);
    if (exceedsHalfRange) {
      expect(sample.validityCode, `${sample.id} unrepresentable RGBA16F code`).toBe(2);
      expect(sample.storageRepresentable).toBe(false);
      expect(sample.storedRgba16Float).toEqual([0, 0, 0, 0]);
      continue;
    }
    expect(sample.validityCode, `${sample.id} valid physical data code`).toBe(1);
    expect(sample.storageRepresentable).toBe(true);
    const expectedChannels = [reference.signedCoCDiameterMm, reference.majorRadiusMm, reference.minorRadiusMm];
    for (let channel = 0; channel < expectedChannels.length; channel++) {
      const expected = expectedChannels[channel]!;
      const actual = sample.storedRgba16Float[channel]!;
      const tolerance = Math.max(0.02, Math.abs(expected) * 0.003);
      expect(Math.abs(actual - expected), `${sample.id} physical channel ${channel}`).toBeLessThan(tolerance);
    }
    const expectedOrientationNormalized = encodeGroundGlassFootprintOrientation(reference.orientationRad);
    const expectedHalfNormalized = THREE.DataUtils.fromHalfFloat(
      THREE.DataUtils.toHalfFloat(expectedOrientationNormalized),
    );
    const storedOrientationNormalized = sample.storedRgba16Float[3];
    expect(storedOrientationNormalized, `${sample.id} normalized stored orientation`)
      .toBeGreaterThanOrEqual(0);
    expect(storedOrientationNormalized, `${sample.id} normalized stored orientation`)
      .toBeLessThan(1);
    expect(Math.abs(storedOrientationNormalized - expectedHalfNormalized), `${sample.id} binary16 normalized orientation`)
      .toBeLessThan(0.001);
    expect(Math.abs(sample.orientationNormalized - expectedOrientationNormalized), `${sample.id} GPU normalized orientation diagnostic`)
      .toBeLessThan(0.001);
    const decodedOrientationRad = decodeGroundGlassFootprintOrientation(storedOrientationNormalized, "half-float-mm");
    const angleDifference = Math.abs(decodedOrientationRad - reference.orientationRad) % Math.PI;
    expect(Math.min(angleDifference, Math.PI - angleDifference), `${sample.id} decoded periodic ellipse angle`)
      .toBeLessThan(0.01);
    // The exact geometric focus point is zero in the CPU oracle, while this
    // native GPU evaluation has a measured negative arithmetic residue. Keep
    // that signed result distinct from the separate numerical focus tolerance.
    const expectedRawSign = sample.id === "in-focus"
      ? "near"
      : reference.signedCoCDiameterMm < 0
        ? "near"
        : reference.signedCoCDiameterMm > 0 ? "far" : "neutral";
    expect(sample.rawSignClassification, `${sample.id} exact signed CoC classification`)
      .toBe(expectedRawSign);
    expect(sample.nearFocusComparison, `${sample.id} independent numeric focus tolerance`)
      .toBe(Math.abs(sample.storedRgba16Float[0]) <= 0.0001 ? "within-tolerance" : "outside-tolerance");
    expect(sample.storedRgba16Float[1]).toBeGreaterThanOrEqual(sample.storedRgba16Float[2]);
    expect(sample.storedRgba16Float[2]).toBeGreaterThanOrEqual(0);
  }
  const physicalById = new Map(handle.physical?.samples.map((sample) => [sample.id, sample]));
  const nearWideOpen = physicalById.get("near-side");
  const nearStoppedDown = physicalById.get("near-side-stopped-down");
  const inFocus = physicalById.get("in-focus");
  const farSide = physicalById.get("far-side");
  const farClipPhysical = physicalById.get("far-clip-visible-surface");
  expect(nearWideOpen).toBeDefined();
  expect(nearStoppedDown).toBeDefined();
  expect(inFocus).toBeDefined();
  expect(farSide).toBeDefined();
  expect(farClipPhysical).toBeDefined();
  expect(farClipPhysical?.validityCode).toBe(1);
  expect(farClipPhysical?.rawSignClassification).toBe("far");
  expect(farClipPhysical?.storedRgba16Float[0]).toBeGreaterThan(0);
  if (nearWideOpen && nearStoppedDown) {
    expect(Math.sign(nearWideOpen.storedRgba16Float[0])).toBe(-1);
    expect(Math.sign(nearStoppedDown.storedRgba16Float[0])).toBe(-1);
    expect(nearWideOpen.storedRgba16Float[1] / nearStoppedDown.storedRgba16Float[1]).toBeCloseTo(2, 1);
    expect(Math.abs(nearWideOpen.storedRgba16Float[0] / nearStoppedDown.storedRgba16Float[0])).toBeCloseTo(2, 1);
  }
  if (inFocus) {
    expect(Math.abs(inFocus.storedRgba16Float[0])).toBeLessThan(0.02);
    expect(inFocus.rawSignClassification).toBe("near");
    expect(inFocus.nearFocusComparison).toBe("within-tolerance");
  }
  expect(nearWideOpen?.rawSignClassification).toBe("near");
  expect(nearStoppedDown?.rawSignClassification).toBe("near");
  expect(farSide?.rawSignClassification).toBe("far");
  expect(physicalById.get("occlusion-near-marker")?.rawSignClassification).toBe("far");
  expect(physicalById.get("invalid-lens-basis")?.rawSignClassification).toBe("invalid-geometry");
  expect(physicalById.get("outside-binary16-range")?.rawSignClassification).toBe("unrepresentable");
  expect(physicalById.get("background-no-depth")?.rawSignClassification).toBe("no-depth");
  expect(nearWideOpen?.orientationDefined).toBe(false);
  expect(nearWideOpen?.storedRgba16Float[3]).toBe(0);
  for (const id of ["film-tilt", "film-swing", "compound-lens-film"]) {
    const oriented = physicalById.get(id);
    expect(oriented, `${id} sample`).toBeDefined();
    expect(oriented?.orientationDefined, `${id} has a defined ellipse orientation`).toBe(true);
    expect(oriented?.storedRgba16Float[3], `${id} stores normalized nonzero orientation`).toBeGreaterThan(0);
  }
  const nearPi = physicalById.get("film-tilt-near-pi");
  const negativeUnwrapped = physicalById.get("film-negative-unwrapped-orientation");
  expect(nearPi?.orientationDefined).toBe(true);
  expect(nearPi?.orientationUnwrappedAngleRad).toBeLessThan(0);
  expect(nearPi?.orientationRad).toBeGreaterThan(3.0);
  expect(nearPi?.orientationNormalized).toBeGreaterThan(0.95);
  expect(negativeUnwrapped?.orientationDefined).toBe(true);
  expect(negativeUnwrapped?.orientationUnwrappedAngleRad).toBeLessThan(0);
  expect(negativeUnwrapped?.orientationRad).toBeGreaterThan(0);
  if (negativeUnwrapped) {
    expect(negativeUnwrapped.orientationNormalized).toBeCloseTo(negativeUnwrapped.orientationRad / Math.PI, 3);
  }
  const cropPhysicalCase = handle.physical?.samples.find((sample) => sample.id === "crop-film-tilt-near-pi");
  expect(cropPhysicalCase).toBeDefined();
  expect(crop?.expectedWorldMm).not.toBeNull();
  expect(cropPhysicalCase?.orientationRad).toBeGreaterThan(3.0);
  expect(crop?.cropPhysicalRgba16Float[3]).toBeGreaterThan(0.95);
  if (cropPhysicalCase && crop?.expectedWorldMm) {
    const input = cropPhysicalCase.input;
    const cropReference = computePhysicalBlurFootprint({
      objectPoint: vec(...crop.expectedWorldMm),
      lensCenter: vec(...input.lensCenterMm),
      lensPlaneNormal: vec(...input.lensPlaneNormal),
      lensPlaneBasisX: vec(...input.lensPlaneBasisX),
      lensPlaneBasisY: vec(...input.lensPlaneBasisY),
      filmPlane: planeFromPointNormal(vec(...input.filmPlanePointMm), vec(...input.filmPlaneNormal)),
      filmPlaneBasisX: vec(...input.filmPlaneBasisX),
      filmPlaneBasisY: vec(...input.filmPlaneBasisY),
      focalLengthMm: input.focalLengthMm,
      apertureFNumber: input.apertureFNumber,
    });
    expect(cropReference.valid).toBe(true);
    expect(Math.abs(crop.cropPhysicalRgba16Float[0] - cropReference.signedCoCDiameterMm)).toBeLessThan(0.02);
    expect(Math.abs(crop.cropPhysicalRgba16Float[1] - cropReference.majorRadiusMm)).toBeLessThan(0.02);
    expect(Math.abs(crop.cropPhysicalRgba16Float[2] - cropReference.minorRadiusMm)).toBeLessThan(0.02);
    const expectedCropOrientation = encodeGroundGlassFootprintOrientation(cropReference.orientationRad);
    const expectedCropHalfOrientation = THREE.DataUtils.fromHalfFloat(THREE.DataUtils.toHalfFloat(expectedCropOrientation));
    expect(Math.abs(crop.cropPhysicalRgba16Float[3] - expectedCropHalfOrientation)).toBeLessThan(0.001);
    const decodedCropOrientation = decodeGroundGlassFootprintOrientation(crop.cropPhysicalRgba16Float[3], "half-float-mm");
    const cropAngleDifference = Math.abs(decodedCropOrientation - cropReference.orientationRad) % Math.PI;
    expect(Math.min(cropAngleDifference, Math.PI - cropAngleDifference)).toBeLessThan(0.01);
    const fullDecodedOrientation = decodeGroundGlassFootprintOrientation(
      cropPhysicalCase.storedRgba16Float[3],
      "half-float-mm",
    );
    const cropConsistencyDifference = Math.abs(decodedCropOrientation - fullDecodedOrientation) % Math.PI;
    expect(Math.min(cropConsistencyDifference, Math.PI - cropConsistencyDifference))
      .toBeLessThan(0.01);
  }
  const cpuReferenceMeasurements = handle.physical?.samples.map((sample) => {
    const source = probeById.get(sample.sourceProbeId);
    if (!source?.expectedWorldM) {
      return {
        id: sample.id,
        rawSignClassification: sample.rawSignClassification,
        nearFocusComparison: sample.nearFocusComparison,
        validityCode: sample.validityCode,
        cpuReference: null,
      };
    }
    const input = sample.input;
    const reference = computePhysicalBlurFootprint({
      objectPoint: vec(source.expectedWorldM[0] * 1000, source.expectedWorldM[1] * 1000, source.expectedWorldM[2] * 1000),
      lensCenter: vec(...input.lensCenterMm),
      lensPlaneNormal: vec(...input.lensPlaneNormal),
      lensPlaneBasisX: vec(...input.lensPlaneBasisX),
      lensPlaneBasisY: vec(...input.lensPlaneBasisY),
      filmPlane: planeFromPointNormal(vec(...input.filmPlanePointMm), vec(...input.filmPlaneNormal)),
      filmPlaneBasisX: vec(...input.filmPlaneBasisX),
      filmPlaneBasisY: vec(...input.filmPlaneBasisY),
      focalLengthMm: input.focalLengthMm,
      apertureFNumber: input.apertureFNumber,
    });
    return {
      id: sample.id,
      rawSignClassification: sample.rawSignClassification,
      nearFocusComparison: sample.nearFocusComparison,
      validityCode: sample.validityCode,
      cpuReference: reference,
      gpuRgba16Float: sample.storedRgba16Float,
      errors: reference.valid ? {
        signedCoCDiameterMm: sample.storedRgba16Float[0] - reference.signedCoCDiameterMm,
        majorRadiusMm: sample.storedRgba16Float[1] - reference.majorRadiusMm,
        minorRadiusMm: sample.storedRgba16Float[2] - reference.minorRadiusMm,
        orientationPeriodicRad: (() => {
          const decoded = decodeGroundGlassFootprintOrientation(sample.storedRgba16Float[3], "half-float-mm");
          const difference = Math.abs(decoded - reference.orientationRad) % Math.PI;
          return Math.min(difference, Math.PI - difference);
        })(),
      } : null,
    };
  }) ?? [];
  await testInfo.attach("phase-e-native-depth-and-physical-results.json", {
    body: Buffer.from(JSON.stringify({
      runtime: handle.runtime,
      camera: handle.camera,
      depth: handle.depth,
      probes: handle.probes,
      crop: handle.crop,
      physical: handle.physical,
      cpuReferenceMeasurements,
      resources: handle.resources,
    }, null, 2)),
    contentType: "application/json",
  });
  expect(handle.resources.every((resource) => resource.state === "active")).toBe(true);
});

test("native focal-length boundary preserves finite virtual, exact-limit, and finite real branches", async ({ page }, testInfo) => {
  await page.goto(FIXTURE_PATH);
  await expect(page.getByTestId("physical-coc-experiment")).toBeVisible();
  const { handle } = await waitForCompletedHandle(page);
  expect(handle.error).toBeNull();
  if (nativeWebGpuRequired) {
    expect(handle.runtime?.rendererFamily).toBe("webgpu-renderer");
    expect(handle.runtime?.executionBackend).toBe("webgpu");
    expect(handle.runtime?.applicationFallback).toBe(false);
  }

  const probes = new Map(handle.probes.map((probe) => [probe.id, probe]));
  const samples = new Map((handle.physical?.samples ?? []).map((sample) => [sample.id, sample]));
  const boundarySamples = [...samples.values()].filter((sample) => sample.input.focalBoundary);
  expect(boundarySamples).toHaveLength(12);

  const measuredBoundary = boundarySamples.map((sample) => {
    const boundary = sample.input.focalBoundary;
    const source = probes.get(sample.sourceProbeId);
    expect(boundary, sample.id).toBeDefined();
    expect(source, sample.id).toBeDefined();
    if (!boundary || !source?.expectedWorldM || !sample.focalDistance) {
      throw new Error(`Missing focal-boundary evidence for ${sample.id}`);
    }
    const input = sample.input;
    const canonicalObjectPointMm = input.controlledObjectPointMm
      ? [...input.controlledObjectPointMm] as [number, number, number]
      : source.expectedWorldM.map((coordinate) => coordinate * 1000) as [number, number, number];
    const lensCenter = new THREE.Vector3(...input.lensCenterMm);
    const lensNormal = new THREE.Vector3(...input.lensPlaneNormal).normalize();
    const canonicalObjectDistanceMm = new THREE.Vector3(...canonicalObjectPointMm)
      .sub(lensCenter)
      .dot(lensNormal);
    const canonicalObjectMinusFocalMm = canonicalObjectDistanceMm - input.focalLengthMm;
    expect(canonicalObjectDistanceMm).toBeCloseTo(sample.focalDistance.canonicalObjectDistanceMm, 5);
    expect(canonicalObjectMinusFocalMm)
      .toBeCloseTo(boundary.targetObjectMinusFocalMm, 6);

    const cpuFor = (pointMm: readonly [number, number, number]) => computePhysicalBlurFootprint({
      objectPoint: vec(...pointMm),
      lensCenter: vec(...input.lensCenterMm),
      lensPlaneNormal: vec(...input.lensPlaneNormal),
      lensPlaneBasisX: vec(...input.lensPlaneBasisX),
      lensPlaneBasisY: vec(...input.lensPlaneBasisY),
      filmPlane: planeFromPointNormal(vec(...input.filmPlanePointMm), vec(...input.filmPlaneNormal)),
      filmPlaneBasisX: vec(...input.filmPlaneBasisX),
      filmPlaneBasisY: vec(...input.filmPlaneBasisY),
      focalLengthMm: input.focalLengthMm,
      apertureFNumber: input.apertureFNumber,
    });
    const canonicalReference = cpuFor(canonicalObjectPointMm);
    expect(canonicalReference.valid, `${sample.id} canonical CPU footprint`).toBe(true);
    const canonicalExpectedSign = boundary.expectedRegime === "finite-virtual" ? 1 : -1;
    expect(Math.sign(canonicalReference.signedCoCDiameterMm), `${sample.id} canonical regime sign`)
      .toBe(canonicalExpectedSign);

    const focal = sample.focalDistance;
    expect(focal.expectedRegime).toBe(boundary.expectedRegime);
    expect(focal.inputSource).toBe(boundary.inputSource);
    const explicitParallelLimitIdentity = boundary.expectedRegime === "parallel-limit"
      && boundary.explicitParallelLimitIdentity !== false;
    expect(focal.explicitParallelLimitIdentity).toBe(explicitParallelLimitIdentity);
    if (boundary.expectedRegime === "parallel-limit" && !explicitParallelLimitIdentity) {
      expect(boundary.inputSource).toBe("controlled-world-point");
      expect(sample.validityCode, `${sample.id} unresolved focal-boundary validity`).toBe(4);
      expect(focal.selectedPhysicalBranch).toBe("unresolved");
      expect(sample.rawSignClassification).toBe("unresolved-focal-boundary");
      expect(sample.storedRgba16Float).toEqual([0, 0, 0, 0]);
      expect(sample.storedRgba16Float.every(Number.isFinite)).toBe(true);
      return {
        id: sample.id,
        focalLengthMm: input.focalLengthMm,
        canonicalObjectDistanceMm,
        gpuDepthReconstructedObjectDistanceMm: focal.gpuDepthReconstructedObjectDistanceMm,
        kernelObjectDistanceMm: focal.kernelObjectDistanceMm,
        canonicalUminusFMm: canonicalObjectMinusFocalMm,
        gpuDepthReconstructedUminusFMm: focal.gpuDepthReconstructedObjectMinusFocalMm,
        kernelUminusFMm: focal.kernelObjectMinusFocalMm,
        depthReconstructionErrorMm: focal.depthReconstructionErrorMm,
        selectedPhysicalBranch: focal.selectedPhysicalBranch,
        depthClassificationResolution: focal.depthClassificationResolution,
        explicitParallelLimitIdentity,
        validityCode: sample.validityCode,
        cpuCanonicalSignedCoCMm: canonicalReference.signedCoCDiameterMm,
        gpuStoredSignedCoCMm: sample.storedRgba16Float[0],
        cpuKernelInputSignedCoCMm: null,
      };
    }
    expect(sample.validityCode, `${sample.id} GPU physical validity`).toBe(1);
    if (boundary.inputSource === "controlled-world-point") {
      expect(focal.gpuDepthReconstructedObjectDistanceMm).toBeNull();
      expect(focal.depthReconstructionErrorMm).toBeNull();
      expect(focal.depthClassificationResolution).toBe("not-applicable");
      expect(focal.kernelObjectMinusFocalMm)
        .toBeCloseTo(boundary.targetObjectMinusFocalMm, 5);
      expect(focal.selectedPhysicalBranch).toBe(boundary.expectedRegime);
      expect(Math.sign(sample.storedRgba16Float[0])).toBe(canonicalExpectedSign);
    } else if (boundary.expectedRegime === "parallel-limit") {
      expect(focal.depthClassificationResolution).toBe("explicit-limit");
      expect(focal.selectedPhysicalBranch).toBe("parallel-limit");
      expect(focal.kernelObjectMinusFocalMm).not.toBe(0);
      expect(sample.storedRgba16Float.every(Number.isFinite)).toBe(true);
      expect(Math.sign(sample.storedRgba16Float[0])).toBe(-1);
    } else {
      expect(focal.gpuDepthReconstructedObjectDistanceMm).not.toBeNull();
      expect(focal.depthReconstructionErrorMm).not.toBeNull();
      const targetDelta = boundary.targetObjectMinusFocalMm;
      const depthError = focal.depthReconstructionErrorMm ?? 0;
      const resolvedFromDepth =
        Math.sign(targetDelta) === Math.sign(focal.kernelObjectMinusFocalMm)
        && Math.abs(targetDelta) > Math.abs(depthError);
      expect(focal.depthClassificationResolution)
        .toBe(resolvedFromDepth ? "resolved" : "depth-limited");
      if (resolvedFromDepth) {
        expect(focal.selectedPhysicalBranch).toBe(boundary.expectedRegime);
      } else {
        expect(focal.depthClassificationResolution).toBe("depth-limited");
      }
    }

    const comparisonPointMm = boundary.inputSource === "controlled-world-point"
      ? canonicalObjectPointMm
      : boundary.expectedRegime === "parallel-limit"
        ? canonicalObjectPointMm
        : sample.reconstructedWorldMm;
    const gpuInputReference = cpuFor(comparisonPointMm);
    expect(gpuInputReference.valid, `${sample.id} CPU oracle for GPU kernel input`).toBe(true);
    const expected = [
      gpuInputReference.signedCoCDiameterMm,
      gpuInputReference.majorRadiusMm,
      gpuInputReference.minorRadiusMm,
    ];
    for (let channel = 0; channel < expected.length; channel++) {
      const tolerance = Math.max(0.02, Math.abs(expected[channel]!) * 0.003);
      expect(
        Math.abs(sample.storedRgba16Float[channel]! - expected[channel]!),
        `${sample.id} GPU/CPU channel ${channel}`,
      ).toBeLessThan(tolerance);
    }
    expect(sample.rawSignClassification).toBe(
      sample.storedRgba16Float[0] < 0 ? "near" : sample.storedRgba16Float[0] > 0 ? "far" : "neutral",
    );

    if (boundary.expectedRegime === "parallel-limit") {
      expect(sample.storedRgba16Float[0]).toBeLessThan(0);
      expect(sample.storedRgba16Float.slice(0, 3).every(Number.isFinite)).toBe(true);
      expect(Math.abs(sample.storedRgba16Float[0])).toBeGreaterThan(0);
      expect(Math.abs(sample.storedRgba16Float[0])).toBeCloseTo(
        input.focalLengthMm / input.apertureFNumber,
        1,
      );
    }

    return {
      id: sample.id,
      focalLengthMm: input.focalLengthMm,
      canonicalObjectDistanceMm,
      gpuDepthReconstructedObjectDistanceMm: focal.gpuDepthReconstructedObjectDistanceMm,
      kernelObjectDistanceMm: focal.kernelObjectDistanceMm,
      canonicalUminusFMm: canonicalObjectMinusFocalMm,
      gpuDepthReconstructedUminusFMm: focal.gpuDepthReconstructedObjectMinusFocalMm,
      kernelUminusFMm: focal.kernelObjectMinusFocalMm,
      depthReconstructionErrorMm: focal.depthReconstructionErrorMm,
      selectedPhysicalBranch: focal.selectedPhysicalBranch,
      depthClassificationResolution: focal.depthClassificationResolution,
      explicitParallelLimitIdentity,
      validityCode: sample.validityCode,
      cpuCanonicalSignedCoCMm: canonicalReference.signedCoCDiameterMm,
      gpuStoredSignedCoCMm: sample.storedRgba16Float[0],
      cpuKernelInputSignedCoCMm: gpuInputReference.signedCoCDiameterMm,
    };
  });
  await testInfo.attach("phase-e-focal-boundary-results.json", {
    body: Buffer.from(JSON.stringify({
      runtime: handle.runtime,
      depth: handle.depth,
      measuredBoundary,
    }, null, 2)),
    contentType: "application/json",
  });
});

test("native SPA retirement waits for held readbacks, rejects stale publication, and remounts independently", async ({ page }, testInfo) => {
  test.skip(!nativeWebGpuRequired, "Native WebGPU cleanup requires the headed Chrome project");
  test.setTimeout(240_000);
  await page.goto(FIXTURE_PATH);
  const { handle: initial } = await waitForCompletedHandle(page);
  expect(initial.runtime?.executionBackend).toBe("webgpu");
  const documentToken = await page.evaluate(() => {
    const token = crypto.randomUUID();
    (window as Window & { __phaseEDocumentToken?: string }).__phaseEDocumentToken = token;
    return token;
  });
  await page.getByRole("button", { name: "Start held readback" }).click();
  let current = await waitForHandle(page, initial.instanceId, (candidate) =>
    candidate.operations.some((operation) => operation.kind === "held-readback" && operation.stage === "readback-settled-held"),
  );
  const successfulReadback = current.operations.find((operation) => operation.kind === "held-readback");
  expect(successfulReadback?.readbackStarted).toBe(true);
  expect(successfulReadback?.readbackOutcome).toBe("succeeded");
  expect(successfulReadback?.state).toBe("running");
  const successfulOperationId = successfulReadback?.operationId;
  await page.getByRole("link", { name: "Navigate away" }).click();
  await expect(page.getByTestId("physical-coc-away")).toBeVisible();
  expect(page.url()).toContain("#/away");
  expect(await page.evaluate(() => (window as Window & { __phaseEDocumentToken?: string }).__phaseEDocumentToken)).toBe(documentToken);
  current = await waitForHandle(page, initial.instanceId, (candidate) => candidate.state === "retiring");
  expect(current.resources.every((resource) => resource.state === "active")).toBe(true);
  expect(current.operations.find((operation) => operation.operationId === successfulOperationId)?.stage)
    .toBe("readback-settled-held");
  await page.getByRole("button", { name: "Release held readback" }).click();
  current = await waitForHandle(page, initial.instanceId, (candidate) => candidate.state === "disposed");
  const retiredSuccess = current.operations.find((operation) => operation.operationId === successfulOperationId);
  expect(retiredSuccess).toMatchObject({
    state: "retired",
    stage: "stale-readback-discarded",
    readbackStarted: true,
    readbackOutcome: "succeeded",
    resultPublished: false,
    error: null,
  });
  expect(current.resources.length).toBeGreaterThan(0);
  expect(current.resources.every((resource) => resource.state === "disposed")).toBe(true);
  await page.getByRole("button", { name: "Return to experiment" }).click();
  const { handle: remounted } = await waitForCompletedHandle(page);
  expect(remounted.instanceId).not.toBe(initial.instanceId);
  expect(remounted.runtime?.executionBackend).toBe("webgpu");
  expect(remounted.probes.some((probe) => probe.valid)).toBe(true);
  await page.getByRole("button", { name: "Start held readback" }).click();
  current = await waitForHandle(page, remounted.instanceId, (candidate) =>
    candidate.operations.some((operation) => operation.kind === "held-readback" && operation.stage === "readback-settled-held"),
  );
  const rejectedOperation = current.operations.find((operation) => operation.kind === "held-readback");
  expect(rejectedOperation?.readbackOutcome).toBe("succeeded");
  await page.getByRole("link", { name: "Navigate away" }).click();
  await expect(page.getByTestId("physical-coc-away")).toBeVisible();
  current = await waitForHandle(page, remounted.instanceId, (candidate) => candidate.state === "retiring");
  await page.getByRole("button", { name: "Inject post-readback failure (test only)" }).click();
  current = await waitForHandle(page, remounted.instanceId, (candidate) => candidate.state === "disposed");
  const rejected = current.operations.find((operation) => operation.operationId === rejectedOperation?.operationId);
  expect(rejected).toMatchObject({
    state: "failed",
    stage: "test-injected-readback-failure-after-retirement",
    failureClassification: "test-injected-readback",
    readbackStarted: true,
    readbackOutcome: "succeeded",
    resultPublished: false,
    error: "Injected test-only operation failure after native GPU readback completed",
  });
  expect(current.resources.every((resource) => resource.state === "disposed")).toBe(true);
  await page.getByRole("button", { name: "Return to experiment" }).click();
  const recovered = await waitForCompletedHandle(page);
  expect(recovered.handle.instanceId).not.toBe(remounted.instanceId);
  expect(recovered.handle.runtime?.executionBackend).toBe("webgpu");
  await page.getByRole("link", { name: "Navigate away" }).click();
  await expect(page.getByTestId("physical-coc-away")).toBeVisible();
  const finalCleanup = await waitForHandle(page, recovered.handle.instanceId, (candidate) => candidate.state === "disposed");
  expect(finalCleanup.resources.every((resource) => resource.state === "disposed")).toBe(true);
  await testInfo.attach("phase-e-native-spa-lifecycle.json", {
    body: Buffer.from(JSON.stringify((await readDiagnostics(page)).handles, null, 2)),
    contentType: "application/json",
  });
});

test("a post-physical TSL failure remains visible and still cleans the exact native handle", async ({ page }, testInfo) => {
  test.skip(!nativeWebGpuRequired, "Native WebGPU cleanup requires the headed Chrome project");
  test.setTimeout(120_000);
  await page.goto(FIXTURE_PATH);
  const { handle } = await waitForCompletedHandle(page);
  expect(handle.runtime?.executionBackend).toBe("webgpu");
  await page.getByRole("button", { name: "Inject post-physical failure" }).click();
  const failed = await waitForHandle(page, handle.instanceId, (candidate) =>
    candidate.state === "disposed" && candidate.operations.some((operation) => operation.kind === "post-physical-failure" && operation.state === "failed"),
  );
  expect(failed.error).toBe("Injected Phase E failure after native physical footprint processing");
  expect(failed.operations.at(-1)).toMatchObject({
    kind: "post-physical-failure",
    state: "failed",
    stage: "physical-pass-failed",
    failureClassification: "execution",
    resultPublished: false,
  });
  expect(failed.resources.every((resource) => resource.state === "disposed")).toBe(true);
  await page.getByRole("link", { name: "Navigate away" }).click();
  await expect(page.getByTestId("physical-coc-away")).toBeVisible();
  expect((await waitForHandle(page, handle.instanceId, (candidate) => candidate.state === "disposed")).resources.every((resource) => resource.state === "disposed")).toBe(true);
  await testInfo.attach("phase-e-post-physical-failure.json", {
    body: Buffer.from(JSON.stringify((await readDiagnostics(page)).handles.at(-1), null, 2)),
    contentType: "application/json",
  });
});

test("a failure after native depth rendering releases the allocated depth and renderer resources", async ({ page }, testInfo) => {
  test.skip(!nativeWebGpuRequired, "Native WebGPU cleanup requires the headed Chrome project");
  await page.goto(FIXTURE_PATH);
  const { handle } = await waitForCompletedHandle(page);
  expect(handle.runtime?.executionBackend).toBe("webgpu");
  await page.getByRole("button", { name: "Inject post-depth failure" }).click();
  const failed = await waitForHandle(page, handle.instanceId, (candidate) =>
    candidate.state === "disposed" && candidate.operations.some((operation) => operation.kind === "post-depth-failure" && operation.state === "failed"),
  );
  expect(failed.error).toBe("Injected Phase E failure after native scene depth rendering");
  expect(failed.operations.at(-1)).toMatchObject({
    kind: "post-depth-failure",
    state: "failed",
    stage: "native-depth-pass-failed",
    failureClassification: "execution",
    resultPublished: false,
  });
  expect(failed.resources.some((resource) => resource.role === "scene-color-depth-target")).toBe(true);
  expect(failed.resources.every((resource) => resource.state === "disposed")).toBe(true);
  await testInfo.attach("phase-e-post-depth-failure.json", {
    body: Buffer.from(JSON.stringify(failed, null, 2)),
    contentType: "application/json",
  });
});
