import { expect, test } from "@playwright/test";

type GeometryMetrics = {
  visiblePaneSampleCount: number;
  physicalFiniteHitCount: number;
  physicalNoHitCount: number;
  validCandidateCount: number;
  sameObjectHitCount: number;
  wrongObjectCount: number;
  candidateNoHitCount: number;
  sameObjectCoverage: number | null;
  falsePositiveLocalReflectionCount: number;
  falseNegativeCount: number;
  medianQErrorM: number | null;
  p95QErrorM: number | null;
  medianAngularErrorDeg: number | null;
  p95AngularErrorDeg: number | null;
};

type ImageMetrics = {
  meanAbsoluteRgbDelta: number;
  changedPixelFraction: number;
  glazingMeanAbsoluteRgbDelta: number;
  glazingP95RgbDelta: number;
  glazingChangedPixelFraction: number;
  outsideExpandedGlazingMeanAbsoluteRgbDelta: number;
  outsideExpandedGlazingChangedPixelFraction: number;
};

const expectInside = (value: number, lower: number, upper: number): void => {
  expect(value).toBeGreaterThan(lower);
  expect(value).toBeLessThan(upper);
};

const requiredMetric = (value: number | null, name: string): number => {
  if (value === null || !Number.isFinite(value)) throw new Error(name + " should be a finite measurement");
  return value;
};

type PilotProof = {
  baseSha: string;
  backend: {
    renderer: string;
    gpuRenderer: string;
    webgl2: boolean;
    extensionName: string;
    extensionSupported: boolean;
    colorCubeFaceFramebufferStatuses: readonly string[];
    distanceCubeFaceFramebufferStatuses: readonly string[];
    allCubeFacesFramebufferComplete: boolean;
    gpuDiagnosticFramebufferComplete: boolean;
    gpuDiagnosticReadbackWorks: boolean;
    gpuReadbackArrayType: string;
  };
  candidate: {
    probeOriginM: readonly number[];
    resolution: readonly number[];
    colorFormat: string;
    distanceFormat: string;
    colorDataType: string;
    distanceDataType: string;
    colorSpace: string;
    filter: string;
    correctionIterations: number;
    reflectionWeight: number;
    frontFaceLocalNormal: readonly number[];
    glass: { color: string; roughness: number; metalness: number };
  };
  views: Record<string, { cameraPosition: readonly number[]; target: readonly number[]; fovDeg: number; near: number; far: number }>;
  capture: {
    colorFaceRenders: number;
    distanceFaceRenders: number;
    totalSceneRenders: number;
    recapturesAfterObserverOrbit: number;
    glazingExcludedFromColorAndDistance: boolean;
    sceneBackgroundNullDuringCapture: boolean;
    sceneEnvironmentRetainedDuringCapture: boolean;
    sameOriginNearFarAndVisibility: boolean;
  };
  geometry: Record<string, {
    sampleDomain: {
      paneCount: number;
      totalPaneSamples: number;
      visiblePaneSampleCount: number;
      frontFaceObjectNormalMatches: number;
    };
    physical: { finiteHitCount: number; noHitCount: number };
    uncorrectedCpu: GeometryMetrics;
    correctedCpu: GeometryMetrics;
    correctedGpu: GeometryMetrics & {
      cpuToGpuMedianQErrorM: number | null;
      cpuToGpuP95QErrorM: number | null;
      diagnosticSamples: {
        resolved: number;
        missingPaneInput: number;
        missingInitialProbeDistance: number;
        invalidInitialProbeDistance: number;
        laterCorrectionMiss: number;
        colorSampleNonzero: number;
        meanLinearRadiance: number;
      };
    };
  }>;
  appearance: Record<string, {
    resolution: readonly number[];
    maskPixelCount: number;
    baselineVsUncorrected: ImageMetrics;
    baselineVsCorrected: ImageMetrics;
    uncorrectedVsCorrected: ImageMetrics;
    edgeGradientEnergy: Record<string, number>;
  }>;
  viewDependence: {
    sharedPhysicalPaneSamples: number;
    correctedMeanAbsoluteRgbDeltaBetweenViews: number;
    uncorrectedMeanAbsoluteRgbDeltaBetweenViews: number;
    sameCapturedProbeUsed: boolean;
  };
  environment: {
    presentBeforeCandidate: boolean;
    sameReferenceAfterCandidateRenders: boolean;
    candidateMaterialEnvMapReplaced: boolean;
  };
  candidateFrameCost: Record<string, number | null>;
  resources: {
    colorCube: { bytes: number; mebibytes: number };
    distanceCube: { bytes: number; mebibytes: number };
    candidateTotal: { bytes: number; mebibytes: number };
    diagnosticTargets: number;
  };
  lifecycle: {
    renderTargets: { owned: number; disposed: number; duplicateDisposeEvents: number };
    textures: { owned: number; disposed: number; duplicateDisposeEvents: number };
    materials: { owned: number; disposed: number; duplicateDisposeEvents: number };
    geometries: { owned: number; disposed: number; duplicateDisposeEvents: number };
    customDisposers: { registered: number; invoked: number };
    rendererDisposeCalled: boolean;
  };
};

test("Architecture Rise corrected Probe appearance is measured at Observer scale", async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1000, height: 1000 });
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto("/src/tests/e2e/fixtures/architecture-rise-observer-reflection-pilot.html");
  const body = page.locator("body");
  await expect.poll(async () =>
    (await body.getAttribute("data-proof-ready")) === "true" ||
    (await body.getAttribute("data-proof-error")) !== null,
  { timeout: 90_000 }).toBe(true);
  expect(await body.getAttribute("data-proof-error"), "Observer appearance pilot must fail closed").toBeNull();

  const proof = await page.evaluate(() => {
    const result = window.__architectureRiseObserverReflectionPilot?.proof;
    if (!result) throw new Error("Observer appearance proof did not publish measurements");
    return result as PilotProof;
  });
  console.info("Architecture Rise Observer corrected-Probe pilot:", JSON.stringify(proof));
  expect(pageErrors).toEqual([]);
  expect(consoleErrors, "Three.js shader compilation must not report console errors").toEqual([]);
  expect(proof.baseSha).toBe("30098d044ff5fd8b2a14693c6d310980c5459455");
  expect(proof.backend).toMatchObject({
    webgl2: true,
    extensionName: "EXT_color_buffer_float",
    extensionSupported: true,
    allCubeFacesFramebufferComplete: true,
    gpuDiagnosticFramebufferComplete: true,
    gpuDiagnosticReadbackWorks: true,
    gpuReadbackArrayType: "Float32Array",
  });
  expect(proof.backend.colorCubeFaceFramebufferStatuses).toHaveLength(6);
  expect(proof.backend.distanceCubeFaceFramebufferStatuses).toHaveLength(6);
  expect(proof.candidate).toMatchObject({
    probeOriginM: [-1.2725, 1.5, 6.972],
    resolution: [128, 128, 6],
    colorFormat: "RGBA16F",
    distanceFormat: "RGBA16F",
    colorDataType: "HalfFloatType",
    distanceDataType: "HalfFloatType",
    colorSpace: "NoColorSpace",
    filter: "NearestFilter",
    correctionIterations: 1,
    reflectionWeight: 0.18,
    frontFaceLocalNormal: [0, 0, -1],
    glass: { color: "#182d37", roughness: 0.24, metalness: 0.08 },
  });
  expect(proof.views.default.cameraPosition).toEqual([6.5, 3, -6.5]);
  proof.views.default.target.forEach((value, index) => expect(value).toBeCloseTo([0, 0.9, 5.6][index], 6));
  expect(proof.views.alternate.cameraPosition).toEqual([11.037666, 3, 0.323947]);
  proof.views.alternate.target.forEach((value, index) => expect(value).toBeCloseTo([0, 0.9, 5.6][index], 6));
  expect(proof.capture).toMatchObject({
    colorFaceRenders: 6,
    distanceFaceRenders: 6,
    totalSceneRenders: 12,
    recapturesAfterObserverOrbit: 0,
    glazingExcludedFromColorAndDistance: true,
    sceneBackgroundNullDuringCapture: true,
    sceneEnvironmentRetainedDuringCapture: true,
    sameOriginNearFarAndVisibility: true,
  });
  expect(proof.environment).toMatchObject({
    presentBeforeCandidate: true,
    sameReferenceAfterCandidateRenders: true,
    candidateMaterialEnvMapReplaced: false,
  });
  expect(proof.resources.colorCube).toEqual({ bytes: 786_432, mebibytes: 0.75 });
  expect(proof.resources.distanceCube).toEqual({ bytes: 786_432, mebibytes: 0.75 });
  expect(proof.resources.candidateTotal).toEqual({ bytes: 1_572_864, mebibytes: 1.5 });
  expect(proof.resources.diagnosticTargets).toBe(2);

  for (const view of ["default", "alternate"] as const) {
    const geometry = proof.geometry[view];
    expect(geometry.sampleDomain.paneCount).toBeGreaterThan(0);
    expect(geometry.sampleDomain.totalPaneSamples).toBe(geometry.sampleDomain.paneCount * 16);
    expect(geometry.sampleDomain.visiblePaneSampleCount).toBeGreaterThan(0);
    expect(geometry.sampleDomain.frontFaceObjectNormalMatches)
      .toBe(geometry.sampleDomain.visiblePaneSampleCount);
    expect(geometry.physical.finiteHitCount + geometry.physical.noHitCount)
      .toBe(geometry.sampleDomain.visiblePaneSampleCount);
    expect(geometry.correctedCpu.visiblePaneSampleCount).toBe(geometry.sampleDomain.visiblePaneSampleCount);
    expect(geometry.correctedGpu.visiblePaneSampleCount).toBe(geometry.sampleDomain.visiblePaneSampleCount);
    expect(proof.appearance[view].resolution).toEqual([514, 411]);
    expect(proof.appearance[view].maskPixelCount).toBeGreaterThan(0);
    expect(geometry.correctedGpu.diagnosticSamples.resolved).toBe(geometry.correctedGpu.validCandidateCount);
    expect(
      geometry.correctedGpu.diagnosticSamples.resolved +
      geometry.correctedGpu.diagnosticSamples.missingPaneInput +
      geometry.correctedGpu.diagnosticSamples.missingInitialProbeDistance +
      geometry.correctedGpu.diagnosticSamples.invalidInitialProbeDistance +
      geometry.correctedGpu.diagnosticSamples.laterCorrectionMiss,
    ).toBe(geometry.sampleDomain.visiblePaneSampleCount);
    for (const comparison of [
      proof.appearance[view].baselineVsUncorrected,
      proof.appearance[view].baselineVsCorrected,
      proof.appearance[view].uncorrectedVsCorrected,
    ]) {
      expect(comparison.outsideExpandedGlazingMeanAbsoluteRgbDelta).toBeLessThan(0.001);
      expect(comparison.outsideExpandedGlazingChangedPixelFraction).toBeLessThan(0.001);
    }
  }

  const defaultGeometry = proof.geometry.default;
  const alternateGeometry = proof.geometry.alternate;
  const defaultAppearance = proof.appearance.default;
  const alternateAppearance = proof.appearance.alternate;

  // The default view improves over the uncorrected candidate, but still has
  // substantial physical mismatch and false local reflections.
  expectInside(defaultGeometry.sampleDomain.visiblePaneSampleCount, 200, 256);
  expectInside(defaultGeometry.physical.finiteHitCount, 40, 70);
  expectInside(defaultGeometry.physical.noHitCount, 150, 200);
  expect(defaultGeometry.correctedCpu.sameObjectCoverage).not.toBeNull();
  expect(defaultGeometry.uncorrectedCpu.sameObjectCoverage).not.toBeNull();
  expect(defaultGeometry.correctedCpu.sameObjectCoverage!)
    .toBeGreaterThan(defaultGeometry.uncorrectedCpu.sameObjectCoverage! + 0.2);
  expectInside(defaultGeometry.uncorrectedCpu.validCandidateCount, 150, 220);
  expect(defaultGeometry.uncorrectedCpu.sameObjectHitCount).toBeLessThan(5);
  expect(defaultGeometry.uncorrectedCpu.wrongObjectCount).toBeGreaterThan(30);
  expect(defaultGeometry.uncorrectedCpu.falsePositiveLocalReflectionCount).toBeGreaterThan(100);
  expect(defaultGeometry.uncorrectedCpu.candidateNoHitCount).toBeGreaterThan(35);
  expectInside(defaultGeometry.correctedCpu.validCandidateCount, 50, 130);
  expectInside(defaultGeometry.correctedCpu.sameObjectHitCount, 15, 35);
  expectInside(defaultGeometry.correctedCpu.wrongObjectCount, 15, 35);
  expect(defaultGeometry.correctedCpu.candidateNoHitCount).toBeGreaterThan(100);
  expect(requiredMetric(defaultGeometry.correctedCpu.p95QErrorM, "default corrected CPU p95 Q error"))
    .toBeLessThan(requiredMetric(defaultGeometry.uncorrectedCpu.p95QErrorM, "default uncorrected CPU p95 Q error") * 0.95);
  const defaultPhysicalNoHits = defaultGeometry.physical.noHitCount;
  const defaultFalsePositiveRate =
    defaultGeometry.correctedGpu.falsePositiveLocalReflectionCount / defaultPhysicalNoHits;
  expectInside(defaultFalsePositiveRate, 0.15, 0.4);
  expect(defaultGeometry.correctedGpu.wrongObjectCount).toBeGreaterThan(10);
  expect(defaultGeometry.correctedGpu.falseNegativeCount).toBeGreaterThan(0);
  expectInside(requiredMetric(defaultGeometry.correctedGpu.p95QErrorM, "default corrected GPU p95 Q error"), 5, 9);
  expect(requiredMetric(defaultGeometry.correctedGpu.cpuToGpuMedianQErrorM, "default CPU-to-GPU median Q error"))
    .toBeLessThan(0.03);
  expect(requiredMetric(defaultGeometry.correctedGpu.cpuToGpuP95QErrorM, "default CPU-to-GPU p95 Q error"))
    .toBeLessThan(0.2);
  expect(defaultGeometry.correctedGpu.sameObjectHitCount).toBe(defaultGeometry.correctedCpu.sameObjectHitCount);
  expect(defaultGeometry.correctedGpu.wrongObjectCount).toBe(defaultGeometry.correctedCpu.wrongObjectCount);
  expect(defaultGeometry.correctedGpu.falsePositiveLocalReflectionCount)
    .toBe(defaultGeometry.correctedCpu.falsePositiveLocalReflectionCount);
  expect(defaultGeometry.correctedGpu.diagnosticSamples.colorSampleNonzero)
    .toBe(defaultGeometry.correctedGpu.validCandidateCount);
  expect(defaultGeometry.correctedGpu.diagnosticSamples.meanLinearRadiance).toBeGreaterThan(0.1);
  expect(defaultGeometry.correctedGpu.diagnosticSamples.meanLinearRadiance).toBeLessThan(2);

  // The alternate camera has physical local hits but the fixed Probe has no
  // initial distance-cube samples for most of its visible pane rays.
  expectInside(alternateGeometry.sampleDomain.visiblePaneSampleCount, 150, 200);
  expectInside(alternateGeometry.physical.finiteHitCount, 20, 40);
  expectInside(alternateGeometry.physical.noHitCount, 120, 160);
  expect(alternateGeometry.correctedCpu.validCandidateCount).toBe(0);
  expect(alternateGeometry.correctedGpu.validCandidateCount).toBe(0);
  expect(alternateGeometry.correctedGpu.falseNegativeCount)
    .toBe(alternateGeometry.physical.finiteHitCount);
  expect(alternateGeometry.correctedGpu.candidateNoHitCount)
    .toBe(alternateGeometry.sampleDomain.visiblePaneSampleCount);
  expect(
    alternateGeometry.correctedGpu.diagnosticSamples.missingInitialProbeDistance /
      alternateGeometry.sampleDomain.visiblePaneSampleCount,
  ).toBeGreaterThan(0.8);
  expect(alternateAppearance.baselineVsCorrected.glazingMeanAbsoluteRgbDelta).toBeLessThan(0.001);
  expect(alternateAppearance.baselineVsCorrected.changedPixelFraction).toBeLessThan(0.001);
  expect(alternateAppearance.baselineVsUncorrected.glazingMeanAbsoluteRgbDelta).toBeLessThan(0.001);
  expect(alternateAppearance.uncorrectedVsCorrected.glazingMeanAbsoluteRgbDelta).toBeLessThan(0.001);

  // Appearance changes are local to glazing and visible in View A, but do not
  // transfer to View B. This is the rejection-driving result.
  expectInside(defaultAppearance.baselineVsCorrected.glazingMeanAbsoluteRgbDelta, 0.03, 0.12);
  expectInside(defaultAppearance.baselineVsCorrected.glazingP95RgbDelta, 0.1, 0.4);
  expect(defaultAppearance.baselineVsCorrected.glazingChangedPixelFraction).toBeGreaterThan(0.2);
  expect(defaultAppearance.uncorrectedVsCorrected.glazingMeanAbsoluteRgbDelta).toBeGreaterThan(0.02);
  expectInside(defaultAppearance.baselineVsCorrected.meanAbsoluteRgbDelta, 0.0002, 0.002);
  expectInside(defaultAppearance.baselineVsCorrected.changedPixelFraction, 0.001, 0.01);
  expect(defaultAppearance.baselineVsUncorrected.glazingMeanAbsoluteRgbDelta).toBeGreaterThan(0.03);
  expect(defaultAppearance.edgeGradientEnergy["corrected-probe"])
    .toBeLessThan(defaultAppearance.edgeGradientEnergy.baseline);
  expect(defaultAppearance.edgeGradientEnergy["uncorrected-probe"])
    .toBeLessThan(defaultAppearance.edgeGradientEnergy.baseline);
  const decision = alternateGeometry.correctedGpu.validCandidateCount === 0 &&
    alternateGeometry.physical.finiteHitCount > 0 &&
    defaultFalsePositiveRate > 0.15
    ? "OBSERVER-SCALE CORRECTED PROBE REJECTED"
    : "REVIEW REQUIRED";
  expect(decision).toBe("OBSERVER-SCALE CORRECTED PROBE REJECTED");
  console.info("PR S decision: " + decision);

  expect(proof.viewDependence.sharedPhysicalPaneSamples).toBeGreaterThan(150);
  expectInside(proof.viewDependence.correctedMeanAbsoluteRgbDeltaBetweenViews, 0.05, 0.15);
  expectInside(proof.viewDependence.uncorrectedMeanAbsoluteRgbDeltaBetweenViews, 0.05, 0.15);
  expect(proof.viewDependence.sameCapturedProbeUsed).toBe(true);
  expect(proof.candidateFrameCost.totalCaptureRenders).toBe(12);

  for (const view of ["default", "alternate"] as const) {
    await page.getByRole("button", { name: view === "default" ? "Default Observer" : "Alternate Observer" }).click();
    for (const mode of ["baseline", "uncorrected-probe", "corrected-probe"] as const) {
      await page.locator(`button[data-mode="${mode}"]`).click();
      await page.screenshot({ path: test.info().outputPath(view + "-" + mode + ".png") });
    }
  }

  try {
    await page.evaluate(() => window.__architectureRiseObserverReflectionPilot?.dispose());
  } finally {
    const finalProof = await page.evaluate(() => {
      const result = window.__architectureRiseObserverReflectionPilot?.proof;
      if (!result) throw new Error("Observer appearance proof disappeared during teardown");
      return result as PilotProof;
    });
    for (const category of [
      finalProof.lifecycle.renderTargets,
      finalProof.lifecycle.textures,
      finalProof.lifecycle.materials,
      finalProof.lifecycle.geometries,
    ]) {
      expect(category.owned).toBeGreaterThan(0);
      expect(category.disposed).toBe(category.owned);
      expect(category.duplicateDisposeEvents).toBe(0);
    }
    expect(finalProof.lifecycle.customDisposers.invoked).toBe(finalProof.lifecycle.customDisposers.registered);
    expect(finalProof.lifecycle.customDisposers.registered).toBe(4);
    expect(finalProof.lifecycle.rendererDisposeCalled).toBe(true);
    console.info("PR S fixture lifecycle:", JSON.stringify(finalProof.lifecycle));
  }
});
