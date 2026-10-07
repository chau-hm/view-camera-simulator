import { expect, test } from "@playwright/test";

type CoCMeasurement = {
  signedCoCDiameterMm: number;
  majorRadiusMm: number;
  minorRadiusMm: number;
  orientationRad: number;
  storageFormat: "half-float-mm" | "encoded-byte";
  storageToleranceMm: number;
  absoluteCpuDifferenceMm: number;
};
type FocusCase = {
  focusDistanceMm: number;
  sourcePixel: { x: number; yBottom: number };
  cpu: { reflectedCoC: CoCMeasurement; directCoC: CoCMeasurement };
  gpu: {
    reflectedCoC: CoCMeasurement;
    directCoC: CoCMeasurement;
    directFocusedRgb: readonly [number, number, number];
    reflectedFocusedRgb: readonly [number, number, number];
    combinedLinearRgb: readonly [number, number, number];
    maxLinearSumDifference: number;
    finalDisplayRgba: readonly [number, number, number, number];
  };
  reflectedSignSharpness: { crop: { minX: number; minYBottom: number; maxX: number; maxYBottom: number }; edgeGradientEnergy: number; sampleCount: number };
  reflectionSourceHash: string;
  reflectionOnlyHash: string;
  combinedDisplayHash: string;
};

test("Architecture Rise planar reflection follows independent Ground Glass focus", async ({ page }) => {
  test.setTimeout(120_000);
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto("/src/tests/e2e/fixtures/architecture-rise-planar-focus-reference.html");
  const body = page.locator("body");
  await expect.poll(async () =>
    (await body.getAttribute("data-proof-ready")) === "true" ||
    (await body.getAttribute("data-proof-error")) !== null,
  { timeout: 90_000 }).toBe(true);
  expect(await body.getAttribute("data-proof-error"), "The planar focus proof must fail closed").toBeNull();

  const proof = await page.evaluate(() => {
    const result = window.__architectureRisePlanarFocusProof;
    if (!result) throw new Error("The Architecture Rise planar proof did not publish its evidence");
    return result;
  });
  expect(pageErrors).toEqual([]);
  expect(proof.baseSha).toBe("9bf1739a0d73e6650621dd32a55a53f311e09e8d");
  expect(proof.backend).toMatchObject({
    webgl2: true,
    extensionName: "EXT_color_buffer_float",
    extensionSupported: true,
    float32FramebufferComplete: true,
    float32ReadbackWorks: true,
    readbackArrayType: "Float32Array",
  });
  expect(proof.backend.floatProbeValue).toBeCloseTo(1.25, 5);
  expect(proof.backend.radianceFilter).toMatch(/LinearFilter|NearestFilter/);
  expect(proof.sample.pane).toBe("architecture-rise-facade-window-bay-bay-2-1-glazing");
  expect(proof.sample.uv).toEqual({ u: 0.3, v: 0.3 });
  expect(proof.sample.panePoint[0]).toBeCloseTo(-1.14, 3);
  expect(proof.sample.panePoint[1]).toBeCloseTo(1.014, 3);
  expect(proof.sample.panePoint[2]).toBeCloseTo(8.836, 3);
  expect(proof.sample.normal).toEqual([0, 0, -1]);
  expect(proof.sample.paneMaskActive).toBe(true);
  expect(proof.sample.reflectionObject).toBe("architecture-rise-street-sign-face-back");
  expect(proof.sample.cpuQ[0]).toBeCloseTo(-1.523311, 3);
  expect(proof.sample.cpuQ[1]).toBeCloseTo(1.354945, 3);
  expect(proof.sample.cpuQ[2]).toBeCloseTo(5.865, 3);
  expect(proof.sample.cpuQVirtual[0]).toBeCloseTo(-1.523311, 3);
  expect(proof.sample.cpuQVirtual[1]).toBeCloseTo(1.354945, 3);
  expect(proof.sample.cpuQVirtual[2]).toBeCloseTo(11.807, 3);
  expect(proof.sample.reflectedRadiance.some((value: number) => value > 0)).toBe(true);
  expect(proof.sample.sourcePixel.x).toBeGreaterThanOrEqual(0);
  expect(proof.sample.sourcePixel.x).toBeLessThan(proof.resources.resolution[0]);
  expect(proof.sample.sourcePixel.yBottom).toBeGreaterThanOrEqual(0);
  expect(proof.sample.sourcePixel.yBottom).toBeLessThan(proof.resources.resolution[1]);
  expect(proof.sample.reflectedPixel.x).toBeGreaterThanOrEqual(0);
  expect(proof.sample.reflectedPixel.x).toBeLessThan(proof.resources.resolution[0]);
  expect(proof.sample.reflectedPixel.yBottom).toBeGreaterThanOrEqual(0);
  expect(proof.sample.reflectedPixel.yBottom).toBeLessThan(proof.resources.resolution[1]);
  expect(proof.sample.paneWorldPosition).toHaveLength(3);
  expect(proof.sample.cpuQ).toHaveLength(3);
  expect(proof.sample.gpuQ).toHaveLength(3);
  expect(proof.sample.cpuQVirtual).toHaveLength(3);
  expect(proof.sample.gpuQVirtual).toHaveLength(3);
  expect(proof.sample.gpuQInsideSignFace).toBe(true);
  expect(proof.sample.cpuQ.every((value: number) => Number.isFinite(value))).toBe(true);
  expect(proof.sample.gpuQ.every((value: number) => Number.isFinite(value))).toBe(true);
  expect(proof.sample.cpuQVirtual.every((value: number) => Number.isFinite(value))).toBe(true);
  expect(proof.sample.gpuQVirtual.every((value: number) => Number.isFinite(value))).toBe(true);
  expect(proof.sample.gpuQDistanceFromCpuM).toBeLessThan(0.03);
  expect(proof.sample.gpuQVirtualDistanceFromCpuM).toBeLessThan(0.03);
  expect(proof.sample.gpuQ).not.toEqual(proof.sample.paneWorldPosition);
  expect(proof.sample.reflectedUv.x).toBeGreaterThanOrEqual(0);
  expect(proof.sample.reflectedUv.x).toBeLessThanOrEqual(1);
  expect(proof.sample.reflectedUv.y).toBeGreaterThanOrEqual(0);
  expect(proof.sample.reflectedUv.y).toBeLessThanOrEqual(1);
  expect(proof.sample.reflectedPixel.x).toBe(Math.floor(proof.sample.reflectedUv.x * proof.resources.resolution[0]));
  expect(proof.sample.reflectedPixel.yBottom).toBe(Math.floor(proof.sample.reflectedUv.y * proof.resources.resolution[1]));
  expect(proof.sample.euclideanGeometricRangeMm).toBeGreaterThan(11_900);
  expect(proof.sample.opticalAxisFocusDistanceMm).toBeCloseTo(11_807, 0);
  expect(proof.sample.roundedReflectionFocusMm).toBe(11_810);
  expect(proof.groundGlassCamera.pose.positionWorld).toEqual(proof.groundGlassCamera.lensCenterWorldM);
  expect(proof.groundGlassCamera.opticalAxisOriginWorldM).toEqual(proof.groundGlassCamera.lensCenterWorldM);
  expect(proof.groundGlassCamera.pose.forwardWorld[0]).toBeCloseTo(proof.groundGlassCamera.opticalAxisDirection[0], 6);
  expect(proof.groundGlassCamera.pose.forwardWorld[1]).toBeCloseTo(proof.groundGlassCamera.opticalAxisDirection[1], 6);
  expect(proof.groundGlassCamera.pose.forwardWorld[2]).toBeCloseTo(proof.groundGlassCamera.opticalAxisDirection[2], 6);
  expect(proof.groundGlassCamera.pose.forwardWorld[2]).toBeCloseTo(1, 6);
  expect(proof.groundGlassCamera.projectionMatrix).toHaveLength(16);
  expect(proof.groundGlassCamera.projectionMatrix.every((value: number) => Number.isFinite(value))).toBe(true);
  expect(proof.groundGlassCamera.frustum.near).toBeGreaterThan(0);
  expect(proof.groundGlassCamera.frustum.far).toBeGreaterThan(proof.groundGlassCamera.frustum.near);
  expect(Math.abs(proof.groundGlassCamera.frustum.determinant)).toBeGreaterThan(0);
  expect(proof.contributionContract).toMatchObject({
    directId: "direct-pane-radiance",
    reflectedId: "architecture-rise-planar-reference",
    radianceSemantics: "preweighted-linear-radiance",
    resolvedContributionCount: 2,
    gatherVisibility: { dimensions: [1, 1], purpose: "visibility-only", neutral: true },
  });

  const paneFocus = proof.cases.paneFocus as FocusCase;
  const reflectionFocus = proof.cases.reflectionFocus as FocusCase;
  expect(paneFocus.focusDistanceMm).toBe(8_890);
  expect(reflectionFocus.focusDistanceMm).toBe(11_810);
  expect(Math.abs(paneFocus.cpu.reflectedCoC.signedCoCDiameterMm)).toBeGreaterThan(0.05);
  expect(Math.abs(reflectionFocus.cpu.reflectedCoC.signedCoCDiameterMm)).toBeLessThan(0.005);
  expect(Math.abs(paneFocus.gpu.directCoC.signedCoCDiameterMm)).toBeLessThan(0.005);
  expect(Math.abs(paneFocus.gpu.reflectedCoC.signedCoCDiameterMm)).toBeGreaterThan(0.05);
  expect(Math.abs(reflectionFocus.gpu.reflectedCoC.signedCoCDiameterMm)).toBeLessThan(0.005);
  expect(Math.abs(reflectionFocus.gpu.directCoC.signedCoCDiameterMm)).toBeGreaterThan(0.05);
  for (const focusCase of [paneFocus, reflectionFocus]) {
    expect(focusCase.gpu.reflectedCoC.absoluteCpuDifferenceMm)
      .toBeLessThanOrEqual(focusCase.gpu.reflectedCoC.storageToleranceMm);
    expect(focusCase.gpu.directCoC.absoluteCpuDifferenceMm)
      .toBeLessThanOrEqual(focusCase.gpu.directCoC.storageToleranceMm);
    expect(focusCase.gpu.maxLinearSumDifference).toBeLessThan(2e-3);
    expect(focusCase.gpu.combinedLinearRgb[0]).toBeCloseTo(
      focusCase.gpu.directFocusedRgb[0] + focusCase.gpu.reflectedFocusedRgb[0],
      3,
    );
  }
  expect(Math.abs(paneFocus.gpu.reflectedCoC.signedCoCDiameterMm - paneFocus.cpu.reflectedCoC.signedCoCDiameterMm))
    .toBeLessThanOrEqual(paneFocus.gpu.reflectedCoC.storageToleranceMm);
  expect(Math.abs(paneFocus.gpu.reflectedCoC.signedCoCDiameterMm - paneFocus.gpu.directCoC.signedCoCDiameterMm))
    .toBeGreaterThan(0.02);
  expect(Math.abs(paneFocus.gpu.directCoC.signedCoCDiameterMm))
    .toBeLessThan(Math.abs(reflectionFocus.gpu.directCoC.signedCoCDiameterMm));
  expect(reflectionFocus.reflectedSignSharpness.edgeGradientEnergy)
    .toBeGreaterThan(paneFocus.reflectedSignSharpness.edgeGradientEnergy * 1.1);
  expect(reflectionFocus.reflectedSignSharpness.sampleCount).toBeGreaterThan(0);
  expect(paneFocus.reflectionSourceHash).toMatch(/^[0-9a-f]{8}$/);
  expect(reflectionFocus.reflectionSourceHash).toMatch(/^[0-9a-f]{8}$/);
  expect(paneFocus.reflectionOnlyHash).not.toBe(reflectionFocus.reflectionOnlyHash);
  expect(paneFocus.combinedDisplayHash).not.toBe(reflectionFocus.combinedDisplayHash);
  expect(proof.sharedFilmEffects.namedSample.coverageGain).toBeGreaterThanOrEqual(0);
  expect(proof.sharedFilmEffects.namedSample.coverageGain).toBeLessThanOrEqual(1);
  expect(proof.sharedFilmEffects.namedSample.naturalIlluminationGain).toBeGreaterThan(0);
  expect(proof.sharedFilmEffects.sharedCompositePasses).toBe(2);
  expect(proof.resources.sceneRadianceTargets.type).toBe("FloatType");
  expect(proof.resources.worldPositionTargets.type).toBe("FloatType");
  expect(proof.resources.worldPositionTargets.colorSpace).toBe("NoColorSpace");
  expect(proof.resources.sceneRadianceTargets.colorSpace).toBe("NoColorSpace");
  expect(proof.resources.sceneRadianceTargets.toneMapping).toBe("NoToneMapping");
  expect(proof.resources.directContributionRadianceTarget).toMatchObject({
    type: "FloatType",
    colorSpace: "NoColorSpace",
  });
  expect(proof.resources.directContributionRadianceTarget.dimensions).toEqual(proof.resources.resolution);
  expect(proof.resources.cocTargets.count).toBe(2);
  expect(proof.resources.resolvedRadianceTargets.type).toBe("FloatType");
  expect(proof.resources.combinedRadianceTarget).toMatchObject({
    type: "FloatType",
    colorSpace: "NoColorSpace",
    toneMapping: "NoToneMapping",
  });
  expect(proof.resources.finalDisplayTarget.type).toBe("UnsignedByteType");
  expect(proof.resources.targetCount).toBe(19);
  expect(proof.resources.invalidPositionRadianceViolations).toBe(0);
  expect(proof.resources.passCounts).toMatchObject({
    directSceneRenders: 2,
    planarReflectionSceneRenders: 2,
    worldPositionSceneRenders: 4,
    paneMaskRenders: 2,
    fullScreenMappingResolves: 4,
    radianceValidityMaskPasses: 2,
    cocPasses: 4,
    gatherPasses: 8,
    focusResolvePasses: 4,
    linearRadianceSums: 2,
    sharedCompositePasses: 2,
  });
  expect(proof.resources.productionExtraTargets).toBe(0);
  expect(proof.resources.productionExtraPasses).toBe(0);
  expect(proof.production.passOrder).toEqual([
    "sceneRender",
    "cocFootprint",
    "farGather",
    "nearGather",
    "composite",
  ]);
  expect(proof.production.observerReflectionAdded).toBe(false);
  expect(proof.production.reflectionWeight).toBe(0.18);
  expect(proof.production.captureClippedToCameraSideOfPane).toBe(true);
  expect(proof.production.targetGlazingExcluded).toBe(true);
  expect(proof.directViewSafety).toMatchObject({
    paneFirstHit: proof.sample.pane,
    directRayHitsStreetSign: false,
    paneToQFirstHit: proof.sample.reflectionObject,
    paneToQPathClear: true,
  });
  expect(proof.resources.disposed).toBe(true);

  console.info("Architecture Rise planar focus GPU proof:", JSON.stringify(proof));
  await page.screenshot({ path: test.info().outputPath("pane-focus.png"), fullPage: true });
  await page.getByRole("button", { name: /Reflection focus/ }).click();
  await expect(page.locator("button[data-case='reflectionFocus']")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText(/reflectionFocus/)).toBeVisible();
  await page.screenshot({ path: test.info().outputPath("reflection-focus.png"), fullPage: true });
});
