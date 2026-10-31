import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as THREE from "three";
import { computePhysicalBlurFootprint, type PhysicalBlurFootprint } from "../../core/optics/computePhysicalBlurFootprint";
import {
  evaluateGroundGlassM7dPhysicalCocCapture,
  evaluateGroundGlassM7dPhysicalCocReport,
  GROUND_GLASS_M7D_PHYSICAL_COC_EVIDENCE_REVISION,
  GROUND_GLASS_M7D_REQUIRED_KERNEL_CASE_IDS,
  GROUND_GLASS_M7D_REQUIRED_SCENARIO_IDS,
} from "../../render/webgpu/groundGlassM7dPhysicalCocEvidence";
import type { GroundGlassPhysicalCocProbeKernelOverride } from "../../render/webgpu/groundGlassWebGpuTestSeam";

type M7dKernelCaseFixture = {
  id: string;
  probeId: string;
  calculatedFootprintMm: number[];
  orientationPrincipalAngleRad: number;
  orientationDefined: boolean;
  validityCode: number;
  focalBranchCode: number;
  storageFormat: string;
  storedHalfFloatBits: number[];
  readbackFootprintMm: number[];
  sampledFootprintMm: number[];
};
type M7dSampleFixture = {
  id: string;
  focalBranchCode: number;
  depthConfidence: Record<string, unknown>;
  [key: string]: unknown;
};
type M7dCaptureFixture = {
  browserVersion: string;
  operatingSystem: string;
  threeRevision: string;
  sceneSourceRevision: string;
  sourceSha: string;
  testProject: string;
  testInvocation: string;
  environment: string;
  sceneId: string;
  rendererFamily: string;
  actualExecutionApi: string;
  internalFallback: string;
  trustedDevelopmentAuthorization: Record<string, unknown>;
  m4CompatibilityEvidence: {
    feature: string;
    status: string;
    sourceRevision: string;
    evidenceRevision: string;
    testedContext: { rendererFamily: string; executionApi: string; rendererRevision: string };
  };
  probeReadback: {
    token: string;
    requestId: string;
    channelId: string;
    sceneId: string;
    rendererGenerationId: string;
    rendererFamily: string;
    actualExecutionApi: string;
    internalFallback: string;
    widthPx: number;
    heightPx: number;
    depthFormat: string;
    cocStorageFormat: string;
    validityStorageFormat: string;
    samples: M7dSampleFixture[];
    controlledKernelCases: M7dKernelCaseFixture[];
  };
  acceptedHostFrameResult: Record<string, unknown>;
  hostFrameEventsForReadback: Record<string, unknown>[];
  depthDerivedExactFocalReadback: Record<string, unknown>;
  depthDerivedExactFocalHostFrameResult: Record<string, unknown>;
  probeSummary: Record<string, unknown>;
  controlledKernelReferences: Array<{
    id: string;
    testCase: { id: string; probe: { id: string; [key: string]: unknown }; [key: string]: unknown };
    cpuReference: PhysicalBlurFootprint;
    cpu: PhysicalBlurFootprint;
  }>;
};

const baseOverride = (input: Readonly<{
  tiltX?: number;
  tiltY?: number;
  filmZMm?: number;
  focalLengthMm?: number;
  apertureFNumber?: number;
}> = {}): GroundGlassPhysicalCocProbeKernelOverride => {
  const normal = { x: input.tiltX ?? 0, y: input.tiltY ?? 0, z: -1 };
  const normalLength = Math.hypot(normal.x, normal.y, normal.z);
  return {
    lens: {
      centerWorldM: { x: 0, y: 0, z: 0 },
      planeNormal: { x: 0, y: 0, z: 1 },
      planeBasisX: { x: 1, y: 0, z: 0 },
      planeBasisY: { x: 0, y: 1, z: 0 },
    },
    film: {
      planePointWorldM: { x: 0, y: 0, z: (input.filmZMm ?? -100) / 1000 },
      planeNormal: { x: normal.x / normalLength, y: normal.y / normalLength, z: normal.z / normalLength },
      planeBasisX: { x: 1, y: 0, z: 0 },
      planeBasisY: { x: 0, y: 1, z: 0 },
    },
    optics: { focalLengthMm: input.focalLengthMm ?? 50, apertureFNumber: input.apertureFNumber ?? 16 },
  };
};

const rotateFilmBasis = (
  override: GroundGlassPhysicalCocProbeKernelOverride,
  angleRad: number,
): GroundGlassPhysicalCocProbeKernelOverride => {
  const { planeBasisX: x, planeBasisY: y } = override.film;
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  return {
    ...override,
    film: {
      ...override.film,
      planeBasisX: { x: cos * x.x + sin * y.x, y: cos * x.y + sin * y.y, z: cos * x.z + sin * y.z },
      planeBasisY: { x: -sin * x.x + cos * y.x, y: -sin * x.y + cos * y.y, z: -sin * x.z + cos * y.z },
    },
  };
};

const cpuFor = (
  override: GroundGlassPhysicalCocProbeKernelOverride,
  pointMm: readonly [number, number, number],
): PhysicalBlurFootprint => {
  const filmPoint = {
    x: override.film.planePointWorldM.x * 1000,
    y: override.film.planePointWorldM.y * 1000,
    z: override.film.planePointWorldM.z * 1000,
  };
  return computePhysicalBlurFootprint({
    objectPoint: { x: pointMm[0], y: pointMm[1], z: pointMm[2] },
    lensCenter: {
      x: override.lens.centerWorldM.x * 1000,
      y: override.lens.centerWorldM.y * 1000,
      z: override.lens.centerWorldM.z * 1000,
    },
    lensPlaneNormal: override.lens.planeNormal,
    lensPlaneBasisX: override.lens.planeBasisX,
    lensPlaneBasisY: override.lens.planeBasisY,
    filmPlane: {
      point: filmPoint,
      normal: override.film.planeNormal,
      distance: filmPoint.x * override.film.planeNormal.x +
        filmPoint.y * override.film.planeNormal.y +
        filmPoint.z * override.film.planeNormal.z,
    },
    filmPlaneBasisX: override.film.planeBasisX,
    filmPlaneBasisY: override.film.planeBasisY,
    focalLengthMm: override.optics.focalLengthMm,
    apertureFNumber: override.optics.apertureFNumber,
  });
};

const targetCoCOverride = (
  base: GroundGlassPhysicalCocProbeKernelOverride,
  pointMm: readonly [number, number, number],
  targetMm: number,
): GroundGlassPhysicalCocProbeKernelOverride => {
  const cpu = cpuFor(base, pointMm);
  if (!cpu.valid || Math.abs(cpu.signedCoCDiameterMm) < 1e-9) throw new Error("Fixture CoC cannot be scaled");
  return {
    ...base,
    optics: {
      ...base.optics,
      apertureFNumber: base.optics.apertureFNumber * Math.abs(cpu.signedCoCDiameterMm) / targetMm,
    },
  };
};

const makeControlledCase = (id: string) => {
  let override = baseOverride();
  let point: readonly [number, number, number] = [120, 20, 200];
  if (id === "ellipse-circular") point = [0, 0, 200];
  if (id === "ellipse-film-tilt") override = baseOverride({ tiltX: 0.18 });
  if (id === "ellipse-film-swing") override = baseOverride({ tiltY: 0.2 });
  if (id === "ellipse-compound-tilt-swing" || id === "ellipse-off-axis") {
    override = baseOverride({ tiltX: 0.18, tiltY: 0.13 });
  }
  if (id === "ellipse-off-axis") point = [480, 30, 200];
  if (id === "ellipse-negative-principal-angle" || id === "ellipse-near-pi-orientation") {
    const anisotropic = baseOverride({ tiltX: 0.18, tiltY: 0.13 });
    let selected = anisotropic;
    let selectedCpu = cpuFor(selected, point);
    let targetError = Number.POSITIVE_INFINITY;
    for (let step = 0; step <= 720; step += 1) {
      const candidate = rotateFilmBasis(anisotropic, -Math.PI + step * Math.PI / 360);
      const cpu = cpuFor(candidate, point);
      const error = id === "ellipse-negative-principal-angle"
        ? Math.abs(cpu.orientationRad - Math.PI * 0.96)
        : Math.abs(cpu.orientationRad - Math.PI * 0.995);
      if (cpu.valid && error < targetError) {
        selected = candidate;
        selectedCpu = cpu;
        targetError = error;
      }
    }
    override = selected;
    if (id === "ellipse-negative-principal-angle" && selectedCpu.orientationRad < Math.PI * 0.9) {
      throw new Error("Fixture could not produce a negative principal angle");
    }
    if (id === "ellipse-near-pi-orientation" && selectedCpu.orientationRad < Math.PI * 0.99) {
      throw new Error("Fixture could not produce a near-pi orientation");
    }
  }
  if (id === "ellipse-near-circular") override = baseOverride({ tiltX: 1e-8 });
  if (id === "storage-exact-zero") point = [0, 0, 100];
  if (id === "storage-small-positive-coc") {
    override = targetCoCOverride(baseOverride({ filmZMm: -50 }), [120, 20, 200], 0.01);
    point = [120, 20, 200];
  }
  if (id === "storage-small-negative-coc") {
    override = targetCoCOverride(baseOverride({ filmZMm: -100 }), [120, 20, 200], 0.01);
    point = [120, 20, 200];
  }
  if (id === "storage-0.1mm-reference") {
    override = targetCoCOverride(baseOverride(), point, 0.1);
  }
  if (id === "storage-near-binary16-maximum") {
    const base = baseOverride({ tiltX: 0.18, tiltY: 0.13 });
    const cpu = cpuFor(base, point);
    const largest = Math.max(Math.abs(cpu.signedCoCDiameterMm), cpu.majorRadiusMm, cpu.minorRadiusMm);
    override = {
      ...base,
      optics: { ...base.optics, apertureFNumber: base.optics.apertureFNumber * largest / 64000 },
    };
  }
  if (id === "storage-overrange-positive-coc") {
    override = targetCoCOverride(baseOverride({ filmZMm: -50 }), [120, 20, 200], 66000);
    point = [120, 20, 200];
  }
  if (id === "storage-overrange-negative-coc") {
    override = targetCoCOverride(baseOverride({ filmZMm: -100 }), [120, 20, 200], 66000);
    point = [120, 20, 200];
  }
  if (id === "storage-overrange-ellipse-radius") {
    const base = baseOverride({ tiltX: 0.18, tiltY: 0.13 });
    const cpu = cpuFor(base, point);
    override = {
      ...base,
      optics: { ...base.optics, apertureFNumber: base.optics.apertureFNumber * cpu.majorRadiusMm / 66000 },
    };
  }
  if (id === "invalid-geometry-lens-basis") {
    const normal = { x: 0, y: 0, z: 0 };
    override = { ...override, lens: { ...override.lens, planeNormal: normal } };
  }
  const cpu = cpuFor(override, point);
  return {
    id,
    testCase: {
      id,
      kernelOverride: override,
      probe: { id, u: 0.5, v: 0.5, controlledObjectPointMm: point },
    },
    cpu,
  };
};

const expectedKernelValidity = (cpu: PhysicalBlurFootprint) => !cpu.valid
  ? 3
  : Math.max(Math.abs(cpu.signedCoCDiameterMm), cpu.majorRadiusMm, cpu.minorRadiusMm) > 65504
    ? 2
    : 1;

const captureFixture = (): M7dCaptureFixture => {
  const controlledKernelReferences = GROUND_GLASS_M7D_REQUIRED_KERNEL_CASE_IDS.map((id) => {
    const reference = makeControlledCase(id);
    return { ...reference, cpuReference: reference.cpu };
  });
  const controlledKernelCases: M7dKernelCaseFixture[] = controlledKernelReferences.map(({ id, testCase, cpu }) => {
    const validityCode = expectedKernelValidity(cpu);
    const calculatedFootprintMm = cpu.valid
      ? [cpu.signedCoCDiameterMm, cpu.majorRadiusMm, cpu.minorRadiusMm, cpu.orientationRad / Math.PI]
      : [0, 0, 0, 0];
    const storedHalfFloatBits = validityCode === 2 || validityCode === 3
      ? [0, 0, 0, 0]
      : calculatedFootprintMm.map((value) => THREE.DataUtils.toHalfFloat(value));
    const readbackFootprintMm = storedHalfFloatBits.map((value) => THREE.DataUtils.fromHalfFloat(value));
    const orientationDefined = cpu.majorRadiusMm - cpu.minorRadiusMm > 1e-7;
    return {
      id,
      probeId: testCase.probe.id,
      calculatedFootprintMm,
      orientationPrincipalAngleRad: id === "ellipse-negative-principal-angle"
        ? cpu.orientationRad - Math.PI
        : cpu.orientationRad,
      orientationDefined,
      validityCode,
      focalBranchCode: 3,
      storageFormat: "rgba16float",
      storedHalfFloatBits,
      readbackFootprintMm,
      sampledFootprintMm: readbackFootprintMm,
    };
  });
  const sceneIds = [
    "near-foreground-plinth",
    "far-street-sign-face",
    "off-axis-midground-checker",
    "asymmetric-sign-edge",
    "far-focus-chart-cell",
  ];
  const samples: M7dSampleFixture[] = sceneIds.map((id, index) => {
    const expectedWorldM = [index / 1000, 0, 2 + index] as const;
    const reconstructedWorldM = [expectedWorldM[0] + 0.001, expectedWorldM[1], expectedWorldM[2]] as const;
    const canonicalObjectDistanceMm = expectedWorldM[2] * 1000;
    const reconstructedObjectDistanceMm = canonicalObjectDistanceMm;
    return {
      id,
      u: 0.4 + index * 0.03,
      v: 0.5,
      depth: 0.5,
      reconstructedWorldM,
      kernelObjectPositionM: reconstructedWorldM,
      controlledObjectPoint: false,
      expectedWorldM,
      expectedSurfaceId: `surface-${id}`,
      kernelFootprintMm: [0.1, 0.06, 0.04, 0.2],
      storedFootprintMm: [0.1, 0.06, 0.04, 0.2],
      validityCode: 1,
      focalBranchCode: 3,
      depthConfidence: {
        status: "resolved",
        scope: "probe-only",
        evidence: "paired-analytic-surface-reference",
        surfaceId: `surface-${id}`,
        canonicalObjectDistanceMm,
        reconstructedObjectDistanceMm,
        canonicalUMinusFmm: canonicalObjectDistanceMm - 50,
        reconstructedUMinusFmm: reconstructedObjectDistanceMm - 50,
        signedReconstructionErrorMm: 0,
        absoluteReconstructionErrorMm: 0,
        observedUMinusFIntervalMm: [canonicalObjectDistanceMm - 50, canonicalObjectDistanceMm - 50],
        canonicalExpectedBranch: "finite-real",
        reconstructedBranch: "finite-real",
        kernelSelectedBranch: "finite-real",
      },
    };
  });
  samples.push({
    id: "depth-derived-canonical-u-f-no-parallel-authority",
    u: 0.5,
    v: 0.5,
    depth: 0.5,
    reconstructedWorldM: [0, 0, 0.050001],
    kernelObjectPositionM: [0, 0, 0.050001],
    controlledObjectPoint: false,
    expectedWorldM: [0, 0, 0.05],
    expectedSurfaceId: "focal-surface",
    kernelFootprintMm: [0.1, 0.06, 0.04, 0.2],
    storedFootprintMm: null,
    validityCode: 1,
    focalBranchCode: 3,
    depthConfidence: {
      status: "depth-limited",
      scope: "probe-only",
      evidence: "paired-analytic-surface-reference",
      surfaceId: "focal-surface",
      canonicalObjectDistanceMm: 50,
      reconstructedObjectDistanceMm: 50.001,
      canonicalUMinusFmm: 0,
      reconstructedUMinusFmm: 0.001,
      signedReconstructionErrorMm: 0.001,
      absoluteReconstructionErrorMm: 0.001,
      observedUMinusFIntervalMm: [0, 0.001],
      canonicalExpectedBranch: "parallel-limit",
      reconstructedBranch: "finite-real",
      kernelSelectedBranch: "finite-real",
    },
  });
  samples.push({
    id: "unreferenced-visible-surface-pixel",
    u: 0.4,
    v: 0.4,
    depth: 0.5,
    reconstructedWorldM: [0, 0, 2],
    kernelObjectPositionM: [0, 0, 2],
    controlledObjectPoint: false,
    expectedWorldM: null,
    expectedSurfaceId: null,
    kernelFootprintMm: [0.1, 0.06, 0.04, 0.2],
    storedFootprintMm: [0.1, 0.06, 0.04, 0.2],
    validityCode: 1,
    focalBranchCode: 3,
    depthConfidence: { status: "not-assessed", scope: "probe-only", reason: "no-independent-reference" },
  });
  samples.push(...["top-left", "top-right", "bottom-left"].map((corner, index) => ({
    id: `background-${corner}`,
    u: index === 1 ? 0.99 : 0.01,
    v: index === 2 ? 0.99 : 0.01,
    depth: 1,
    reconstructedWorldM: [0, 0, 0],
    kernelObjectPositionM: [0, 0, 0],
    controlledObjectPoint: false,
    expectedWorldM: null,
    expectedSurfaceId: "background-candidate",
    kernelFootprintMm: [0, 0, 0, 0],
    storedFootprintMm: [0, 0, 0, 0],
    validityCode: index === 0 ? 0 : 1,
    focalBranchCode: 0,
    depthConfidence: { status: "not-assessed", scope: "probe-only", reason: "clear-depth" },
  })));
  const controlledBranches: Readonly<Record<string, number>> = {
    "controlled-u-f-minus-0.01": 1,
    "controlled-u-f-minus-0.001": 1,
    "controlled-u-f-exact-unresolved": 0,
    "controlled-u-f-exact-authorized": 2,
    "controlled-u-f-plus-0.001": 3,
    "controlled-u-f-plus-0.01": 3,
  };
  for (const [id, focalBranchCode] of Object.entries(controlledBranches)) {
    samples.push({
      id,
      u: 0.5,
      v: 0.5,
      depth: 0,
      reconstructedWorldM: [0, 0, 0],
      kernelObjectPositionM: [0, 0, 0],
      controlledObjectPoint: true,
      expectedWorldM: null,
      expectedSurfaceId: null,
      kernelFootprintMm: [0.1, 0.06, 0.04, 0.2],
      storedFootprintMm: null,
      validityCode: focalBranchCode === 0 ? 4 : 1,
      focalBranchCode,
      depthConfidence: { status: "not-assessed", scope: "probe-only", reason: "controlled-object-point" },
    });
  }
  const acceptedHostFrameResult = {
    kind: "host-frame-result",
    hostId: "ground-glass-host-default",
    channelId: "default",
    requestId: "request-42",
    sceneId: "architecture-rise",
    generationId: "generation-9",
    frameStatus: "completed",
    acceptedByHost: true,
    latestAcceptedRequestId: "request-42",
    activeGenerationId: "generation-9",
    activeRendererFamily: "webgpu-renderer",
  };
  const probeReadback = {
    token: "m4-capture-1",
    requestId: "request-42",
    channelId: "default",
    sceneId: "architecture-rise",
    rendererGenerationId: "generation-9",
    rendererFamily: "webgpu-renderer",
    actualExecutionApi: "webgpu",
    internalFallback: "none",
    widthPx: 640,
    heightPx: 480,
    depthFormat: "depth24plus",
    cocStorageFormat: "rgba16float",
    validityStorageFormat: "rgba8unorm",
    samples,
    controlledKernelCases,
  };
  const depthDerivedExactFocalReadback = {
    ...probeReadback,
    token: "m4-depth-exact-1",
    requestId: "request-43",
    samples: [samples.find((sample) => sample.id === "depth-derived-canonical-u-f-no-parallel-authority")!],
  };
  const depthDerivedExactFocalHostFrameResult = {
    ...acceptedHostFrameResult,
    requestId: "request-43",
    latestAcceptedRequestId: "request-43",
  };
  return {
    browserVersion: "Chrome 156.0.0.0",
    operatingSystem: "darwin arm64",
    threeRevision: "187",
    sceneSourceRevision: "architecture-rise-raw-rtt-v1",
    m4CompatibilityEvidence: {
      feature: "physical-coc",
      status: "research-only",
      sourceRevision: "architecture-rise-raw-rtt-v1",
      evidenceRevision: "m4-architecture-rise-physical-coc-native-r187-v1",
      testedContext: { rendererFamily: "webgpu-renderer", executionApi: "webgpu", rendererRevision: "r187" },
    },
    sourceSha: "1234567890abcdef1234567890abcdef12345678",
    testProject: "chrome-native-webgpu",
    testInvocation: "npm run test:e2e -- --project=chrome-native-webgpu physical-coc-app.spec.ts",
    environment: "headed native-required Chrome",
    sceneId: "architecture-rise",
    rendererFamily: "webgpu-renderer",
    actualExecutionApi: "webgpu",
    internalFallback: "none",
    trustedDevelopmentAuthorization: {
      nativeRequired: true,
      rawPilotRequest: true,
      physicalCocResearchBuildFlag: true,
      r187QualificationFlag: true,
      testSeamFlag: true,
    },
    probeReadback,
    acceptedHostFrameResult,
    hostFrameEventsForReadback: [acceptedHostFrameResult],
    depthDerivedExactFocalReadback,
    depthDerivedExactFocalHostFrameResult,
    probeSummary: { requestId: "request-42" },
    controlledKernelReferences,
  };
};

describe("M7D r187 Physical CoC evidence evaluator", () => {
  it("accepts a complete native capture with independently paired CPU, storage, scene, and host evidence", () => {
    const result = evaluateGroundGlassM7dPhysicalCocCapture(captureFixture());
    expect(result.status, JSON.stringify(result.issues)).toBe("passed");
    expect(result).toMatchObject({
      evidenceRevision: GROUND_GLASS_M7D_PHYSICAL_COC_EVIDENCE_REVISION,
      requiredKernelCaseCount: 17,
      observedKernelCaseCount: 17,
      requiredSceneProbeCount: 5,
      observedSceneProbeCount: 5,
    });
    expect(result.issues).toEqual([]);
  });

  it("accepts the persisted native r187 M4 capture artifact", () => {
    const capturePath = resolve(
      process.cwd(),
      "docs/architecture/ground-glass-m7d-r187-physical-coc/captures/ground-glass-m4-physical-coc-native-evidence.json",
    );
    const capture = JSON.parse(readFileSync(capturePath, "utf8")) as unknown;
    const result = evaluateGroundGlassM7dPhysicalCocCapture(capture);
    expect(result.status, JSON.stringify(result.issues)).toBe("passed");
    expect(result).toMatchObject({
      status: "passed",
      requiredKernelCaseCount: GROUND_GLASS_M7D_REQUIRED_KERNEL_CASE_IDS.length,
      observedKernelCaseCount: GROUND_GLASS_M7D_REQUIRED_KERNEL_CASE_IDS.length,
      requiredSceneProbeCount: 5,
      observedSceneProbeCount: 5,
    });
    expect(result.issues).toEqual([]);
  });

  const mutateCapture = (
    label: string,
    mutate: (capture: ReturnType<typeof captureFixture>) => void,
    code: string,
  ) => it(`rejects ${label} for the relevant evidence contract`, () => {
    const capture = captureFixture();
    mutate(capture);
    const result = evaluateGroundGlassM7dPhysicalCocCapture(capture);
    expect(result.status).toBe("failed");
    expect(result.issues.map((issue) => issue.code)).toContain(code);
  });

  mutateCapture("a changed signed CoC sign", (capture) => {
    const caseResult = capture.probeReadback.controlledKernelCases.find((entry) => entry.id === "storage-small-positive-coc")!;
    caseResult.calculatedFootprintMm[0] *= -1;
  }, "signed-coc");

  mutateCapture("swapped major and minor ellipse axes", (capture) => {
    const caseResult = capture.probeReadback.controlledKernelCases.find((entry) => entry.id === "ellipse-compound-tilt-swing")!;
    [caseResult.calculatedFootprintMm[1], caseResult.calculatedFootprintMm[2]] =
      [caseResult.calculatedFootprintMm[2], caseResult.calculatedFootprintMm[1]];
  }, "kernel-comparison");

  mutateCapture("a 1000x unit-scale error", (capture) => {
    const caseResult = capture.probeReadback.controlledKernelCases.find((entry) => entry.id === "ellipse-compound-tilt-swing")!;
    caseResult.calculatedFootprintMm[0] *= 0.001;
    caseResult.calculatedFootprintMm[1] *= 0.001;
    caseResult.calculatedFootprintMm[2] *= 0.001;
  }, "kernel-comparison");

  mutateCapture("an incorrect normalized orientation", (capture) => {
    const caseResult = capture.probeReadback.controlledKernelCases.find((entry) => entry.id === "ellipse-negative-principal-angle")!;
    caseResult.calculatedFootprintMm[3] = 0.4;
  }, "orientation-error");

  mutateCapture("an incorrect controlled focal branch near U=f", (capture) => {
    const sample = capture.probeReadback.samples.find((entry) => entry.id === "controlled-u-f-plus-0.001")!;
    sample.focalBranchCode = 2;
  }, "focal-branch");

  mutateCapture("depth-limited exact-U=f evidence relabelled resolved", (capture) => {
    const sample = capture.probeReadback.samples.find((entry) => entry.id === "depth-derived-canonical-u-f-no-parallel-authority")!;
    sample.depthConfidence.status = "resolved";
  }, "depth-confidence");

  mutateCapture("a missing controlled probe case", (capture) => {
    capture.probeReadback.controlledKernelCases = capture.probeReadback.controlledKernelCases
      .filter((entry) => entry.id !== "ellipse-film-swing");
  }, "missing-kernel-case");

  mutateCapture("a missing independent CPU reference", (capture) => {
    capture.controlledKernelReferences = capture.controlledKernelReferences
      .filter((entry) => entry.id !== "ellipse-compound-tilt-swing");
  }, "missing-cpu-reference");

  mutateCapture("a duplicate controlled probe case", (capture) => {
    capture.probeReadback.controlledKernelCases.push({
      ...capture.probeReadback.controlledKernelCases[0]!,
    });
  }, "duplicate-kernel-case");

  mutateCapture("overflow validity code 2 changed to valid code 1", (capture) => {
    const caseResult = capture.probeReadback.controlledKernelCases.find((entry) => entry.id === "storage-overrange-positive-coc")!;
    caseResult.validityCode = 1;
  }, "validity");

  mutateCapture("unsupported half-float storage bits", (capture) => {
    const caseResult = capture.probeReadback.controlledKernelCases.find((entry) => entry.id === "storage-near-binary16-maximum")!;
    caseResult.storedHalfFloatBits = [1, 1, 1, 1];
  }, "storage-binary16");

  mutateCapture("Three.js revision 186", (capture) => { capture.threeRevision = "186"; }, "renderer-revision");
  mutateCapture("WebGL2 compatibility execution masquerading as WebGPU", (capture) => {
    capture.actualExecutionApi = "webgl2";
  }, "execution-api");
  mutateCapture("a different scene source identity", (capture) => {
    capture.sceneSourceRevision = "architecture-rise-unrelated-v9";
  }, "source-identity");
  mutateCapture("the wrong public scene identity", (capture) => {
    capture.sceneId = "interior-corner";
  }, "scene-identity");
  mutateCapture("a stale readback host event", (capture) => {
    capture.acceptedHostFrameResult.requestId = "older-request";
  }, "request-identity");
  mutateCapture("a wrong-generation publication", (capture) => {
    capture.acceptedHostFrameResult.generationId = "retired-generation";
  }, "request-identity");
  mutateCapture("r186 evidence reused as the r187 M4 record", (capture) => {
    capture.m4CompatibilityEvidence.evidenceRevision = "m4-architecture-rise-physical-coc-native-v1";
    capture.m4CompatibilityEvidence.testedContext.rendererRevision = "r186";
  }, "revision-evidence");
  mutateCapture("unsupported storage reported as successful", (capture) => {
    capture.probeReadback.cocStorageFormat = "rgba32float";
  }, "target-storage");
  mutateCapture("missing capture provenance", (capture) => {
    capture.sourceSha = "missing";
  }, "capture-provenance");

  it("rejects a report whose declared counts differ from its exact scenario inventory", () => {
    const report = {
      reportId: "ground-glass-m7d-r187-physical-coc",
      evaluatorRevision: GROUND_GLASS_M7D_PHYSICAL_COC_EVIDENCE_REVISION,
      m4ResearchEvidenceRevision: "m4-architecture-rise-physical-coc-native-r187-v1",
      m5M6Authorization: "denied",
      productionGroundGlassBackend: "webgl-only",
      scenarios: GROUND_GLASS_M7D_REQUIRED_SCENARIO_IDS.map((id) => ({
        id,
        status: "passed",
        capture: `${id}.json`,
        sourceSha: "1234567890abcdef1234567890abcdef12345678",
        invocation: "npm run test:e2e -- --project=chrome-native-webgpu",
      })),
      counts: { passed: 7, failed: 0, blocked: 0, "not-run": 0 },
    };
    const result = evaluateGroundGlassM7dPhysicalCocReport(report);
    expect(result.status).toBe("failed");
    expect(result.issues.map((issue) => issue.code)).toContain("report-counts");
  });

  it("accepts the persisted M7D report only when its declared inventory is exact", () => {
    const reportPath = resolve(
      process.cwd(),
      "docs/architecture/GROUND_GLASS_M7D_R187_PHYSICAL_COC_REPORT.json",
    );
    const report = JSON.parse(readFileSync(reportPath, "utf8")) as unknown;
    const result = evaluateGroundGlassM7dPhysicalCocReport(report);
    expect(result.status, JSON.stringify(result.issues)).toBe("passed");
    expect(result.computedCounts).toEqual({ passed: 8, failed: 0, blocked: 0, "not-run": 0 });
    expect(result.issues).toEqual([]);
  });
});
