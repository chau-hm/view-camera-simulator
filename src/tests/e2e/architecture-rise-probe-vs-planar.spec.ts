import { expect, test } from "@playwright/test";
import { GROUND_GLASS_PASS_ORDER } from "../../render/groundGlassPassGraph";

test("Architecture Rise local Probe is compared with the planar Ground Glass reference", async ({ page }) => {
  test.setTimeout(120_000);
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/src/tests/e2e/fixtures/architecture-rise-planar-focus-reference.html");
  const planarBody = page.locator("body");
  await expect.poll(async () =>
    (await planarBody.getAttribute("data-proof-ready")) === "true" ||
    (await planarBody.getAttribute("data-proof-error")) !== null,
  { timeout: 90_000 }).toBe(true);
  expect(await planarBody.getAttribute("data-proof-error"), "The frozen Planar reference must remain valid").toBeNull();
  const planarProof = await page.evaluate(() => {
    const result = window.__architectureRisePlanarFocusProof;
    if (!result) throw new Error("The frozen Planar fixture did not publish its reference evidence");
    return result;
  });
  expect(planarProof.baseSha).toBe("9bf1739a0d73e6650621dd32a55a53f311e09e8d");
  expect(planarProof.sample.pane).toBe("architecture-rise-facade-window-bay-bay-2-1-glazing");
  expect(planarProof.sample.uv).toEqual({ u: 0.3, v: 0.3 });
  expect(planarProof.cases.paneFocus.focusDistanceMm).toBe(8_890);
  expect(planarProof.cases.reflectionFocus.focusDistanceMm).toBe(11_810);
  expect(planarProof.cases.paneFocus.gpu.reflectedCoC.signedCoCDiameterMm).toBeCloseTo(0.05783, 4);
  expect(Math.abs(planarProof.cases.reflectionFocus.gpu.reflectedCoC.signedCoCDiameterMm)).toBeLessThan(0.001);
  expect(planarProof.production.passOrder).toEqual(GROUND_GLASS_PASS_ORDER);
  await page.screenshot({ path: test.info().outputPath("planar-pane-focus.png"), fullPage: true });
  await page.getByRole("button", { name: /Reflection focus/ }).click();
  await expect(page.locator("button[data-case='reflectionFocus']")).toHaveAttribute("aria-pressed", "true");
  await page.screenshot({ path: test.info().outputPath("planar-reflection-focus.png"), fullPage: true });

  await page.goto("/src/tests/e2e/fixtures/architecture-rise-probe-focus-reference.html");
  const body = page.locator("body");
  await expect.poll(async () =>
    (await body.getAttribute("data-proof-ready")) === "true" ||
    (await body.getAttribute("data-proof-error")) !== null,
  { timeout: 90_000 }).toBe(true);
  expect(await body.getAttribute("data-proof-error"), "The local Probe proof must fail closed").toBeNull();

  const proof = await page.evaluate(() => {
    const result = window.__architectureRiseProbeFocusProof;
    if (!result) throw new Error("The Architecture Rise local Probe proof did not publish its evidence");
    return result;
  });
  expect(pageErrors).toEqual([]);
  expect(proof.baseSha).toBe("3952bc1684db74693861e15cacd11fb2e7aefa1b");
  expect(proof.backend).toMatchObject({
    webgl2: true,
    extensionName: "EXT_color_buffer_float",
    extensionSupported: true,
    float32FramebufferComplete: true,
    float32ReadbackWorks: true,
    readbackArrayType: "Float32Array",
    halfFloatColorBufferSupported: true,
    allCubeFacesFramebufferComplete: true,
    colorCubeFilter: "NearestFilter",
    distanceCubeFilter: "NearestFilter",
  });
  expect(proof.backend.gpuRenderer.length).toBeGreaterThan(0);
  expect(proof.backend.gpuVendor.length).toBeGreaterThan(0);
  expect(proof.backend.colorCubeFramebufferStatuses).toHaveLength(6);
  expect(proof.backend.distanceCubeFramebufferStatuses).toHaveLength(6);
  expect([...proof.backend.colorCubeFramebufferStatuses, ...proof.backend.distanceCubeFramebufferStatuses]
    .every((status) => status === "0x8cd5")).toBe(true);
  expect(proof.backend.floatProbeValue).toBeCloseTo(1.25, 5);

  expect(proof.sample.pane).toBe("architecture-rise-facade-window-bay-bay-2-1-glazing");
  expect(proof.sample.uv).toEqual({ u: 0.3, v: 0.3 });
  for (const point of [
    proof.sample.panePoint,
    proof.sample.planarQ,
    proof.sample.planarQVirtual,
    proof.sample.probeOrigin,
    proof.sample.probeCpuQ,
    proof.sample.probeGpuQ,
    proof.sample.probeCpuQVirtual,
    proof.sample.probeGpuQVirtual,
  ]) {
    expect(point).toHaveLength(3);
    expect(point.every((value) => Number.isFinite(value))).toBe(true);
  }
  expect(proof.sample.paneMaskActive).toBe(true);
  expect(proof.sample.probeRadiance.some((value) => value > 0)).toBe(true);
  const namedPlanarToProbeQErrorM = proof.sample.qErrorDecompositionM.planarToProbeCpu;
  const namedPlanarToProbeQVirtualErrorM = proof.sample.qErrorDecompositionM.planarToProbeCpuVirtual;
  const namedProbeCpuToGpuQErrorM = proof.sample.qErrorDecompositionM.probeCpuToProbeGpu;
  const namedProbeCpuToGpuQVirtualErrorM = proof.sample.qErrorDecompositionM.probeCpuToProbeGpuVirtual;
  expect(namedPlanarToProbeQErrorM, "the single-Probe named Q should remain materially displaced from Planar")
    .toBeGreaterThan(0.2);
  expect(namedPlanarToProbeQErrorM, "the Probe should still resolve the intended nearby sign sample")
    .toBeLessThan(0.5);
  expect(namedPlanarToProbeQVirtualErrorM, "the single-Probe named Q_virtual should remain materially displaced from Planar")
    .toBeGreaterThan(0.2);
  expect(namedPlanarToProbeQVirtualErrorM, "the Probe virtual point should remain within the intended sign region")
    .toBeLessThan(0.5);
  expect(namedProbeCpuToGpuQErrorM, "cube reconstruction should remain close to its CPU ray")
    .toBeLessThan(0.02);
  expect(namedProbeCpuToGpuQVirtualErrorM, "cube virtual-position reconstruction should remain close to its CPU ray")
    .toBeLessThan(0.02);
  expect(namedProbeCpuToGpuQErrorM, "cube reconstruction error should remain much smaller than single-Probe geometry error")
    .toBeLessThan(namedPlanarToProbeQErrorM * 0.1);
  expect(namedProbeCpuToGpuQVirtualErrorM, "cube virtual-position error should remain much smaller than single-Probe geometry error")
    .toBeLessThan(namedPlanarToProbeQVirtualErrorM * 0.1);
  for (let component = 0; component < 3; component += 1) {
    expect(proof.sample.planarQ[component]).toBeCloseTo(planarProof.sample.cpuQ[component], 6);
    expect(proof.sample.planarQVirtual[component]).toBeCloseTo(planarProof.sample.cpuQVirtual[component], 6);
  }
  expect(proof.sample.focusAxis.absoluteProbeErrorMm, "Probe focus-axis distance should stay close to the Planar datum")
    .toBeLessThan(5);
  expect(proof.sample.focusAxis.roundedProbeFocusMm).toBe(11_810);
  expect(proof.sample.focusAxis.roundedControlOffsetMm).toBe(0);
  expect(proof.resources.resolution).toEqual([768, 614]);
  expect(proof.sample.angularParallaxDeg, "the fixed Probe should retain meaningful angular parallax")
    .toBeGreaterThan(3);
  expect(proof.sample.angularParallaxDeg).toBeLessThan(10);
  expect(proof.sample.projectedVirtualImageDisplacementPx, "the fixed 768×614 fixture should retain visible spatial displacement")
    .toBeGreaterThan(10);
  expect(proof.sample.projectedVirtualImageDisplacementPx).toBeLessThan(50);

  expect(proof.originStudy.candidateCount).toBeGreaterThan(0);
  expect(proof.originStudy.allPaneSampleCount).toBe(256);
  expect(proof.originStudy.planarSignFaceSampleCount).toBe(12);
  expect(proof.originStudy.selected.probeSameSignFaceHitCount).toBeGreaterThanOrEqual(10);
  expect(proof.originStudy.selected.probeSameSignFaceHitCount)
    .toBe(proof.originStudy.planarSignFaceSampleCount);
  expect(proof.originStudy.selected.wrongObjectCount).toBe(0);
  expect(proof.originStudy.selected.noHitCount).toBe(0);
  expect(proof.originStudy.selected.maximumAdjacent2x2SignCluster).toBeGreaterThanOrEqual(3);
  expect(proof.originStudy.selected.sameSignFaceCoverage).toBe(1);
  expect(proof.originStudy.selected.p95QVirtualErrorM).not.toBeNull();
  const regionalP95QVirtualErrorM = proof.originStudy.selected.p95QVirtualErrorM;
  if (regionalP95QVirtualErrorM === null) {
    throw new Error("The selected Probe origin must publish a regional p95 Q_virtual error");
  }
  expect(regionalP95QVirtualErrorM, "regional Probe-to-Planar Q_virtual error should remain decision-significant")
    .toBeGreaterThan(0.2);
  expect(regionalP95QVirtualErrorM, "regional Probe-to-Planar error should remain bounded to this sign region")
    .toBeLessThan(0.6);
  expect(proof.originStudy.historical.origin).toEqual([1.45, 8.8, 8.55]);
  expect(proof.originStudy.historical.probeSameSignFaceHitCount)
    .toBeLessThan(proof.originStudy.selected.probeSameSignFaceHitCount);
  expect(proof.originStudy.rankedCandidates[0].origin).toEqual(proof.originStudy.selected.origin);
  expect(proof.sample.probeOrigin).toEqual(proof.probeCapture.origin);

  expect(proof.contributionContract).toMatchObject({
    directId: "direct-pane-radiance",
    reflectedId: "architecture-rise-local-probe-reference",
    radianceSemantics: "preweighted-linear-radiance",
    resolvedContributionCount: 2,
  });
  const paneFocus = proof.cases.paneFocus;
  const reflectionFocus = proof.cases.reflectionFocus;
  expect(paneFocus.focusDistanceMm).toBe(8_890);
  expect(reflectionFocus.focusDistanceMm).toBe(11_810);
  expect(Math.abs(paneFocus.gpu.reflectedCoC.signedCoCDiameterMm)).toBeGreaterThan(0.05);
  expect(Math.abs(reflectionFocus.gpu.reflectedCoC.signedCoCDiameterMm)).toBeLessThan(0.001);
  expect(Math.abs(paneFocus.gpu.reflectedCoC.signedCoCDiameterMm -
    reflectionFocus.gpu.reflectedCoC.signedCoCDiameterMm)).toBeGreaterThan(0.05);
  expect(Math.abs(paneFocus.gpu.reflectedCoC.signedCoCDiameterMm -
    planarProof.cases.paneFocus.gpu.reflectedCoC.signedCoCDiameterMm)).toBeLessThan(0.002);
  expect(Math.abs(reflectionFocus.gpu.reflectedCoC.signedCoCDiameterMm -
    planarProof.cases.reflectionFocus.gpu.reflectedCoC.signedCoCDiameterMm)).toBeLessThan(0.002);
  for (const focusCase of [paneFocus, reflectionFocus]) {
    expect(focusCase.gpu.reflectedCoC.absoluteCpuDifferenceMm)
      .toBeLessThanOrEqual(focusCase.gpu.reflectedCoC.storageToleranceMm);
    expect(focusCase.gpu.directCoC.absoluteCpuDifferenceMm)
      .toBeLessThanOrEqual(focusCase.gpu.directCoC.storageToleranceMm);
    expect(focusCase.gpu.maxLinearSumDifference).toBeLessThan(2e-3);
    for (let channel = 0; channel < 3; channel += 1) {
      expect(focusCase.gpu.combinedLinearRgb[channel]).toBeCloseTo(
        focusCase.gpu.directFocusedRgb[channel] + focusCase.gpu.reflectedFocusedRgb[channel],
        3,
      );
    }
  }
  const planarPaneSharpness = planarProof.cases.paneFocus.reflectedSignSharpness.edgeGradientEnergy;
  const planarReflectionSharpness = planarProof.cases.reflectionFocus.reflectedSignSharpness.edgeGradientEnergy;
  const probePaneSharpness = paneFocus.reflectedSignSharpness.edgeGradientEnergy;
  const probeReflectionSharpness = reflectionFocus.reflectedSignSharpness.edgeGradientEnergy;
  expect(paneFocus.reflectedSignSharpness.sampleCount).toBeGreaterThan(0);
  expect(reflectionFocus.reflectedSignSharpness.sampleCount).toBeGreaterThan(0);
  expect(planarProof.cases.paneFocus.reflectedSignSharpness.sampleCount).toBeGreaterThan(0);
  expect(planarProof.cases.reflectionFocus.reflectedSignSharpness.sampleCount).toBeGreaterThan(0);
  expect(planarReflectionSharpness, "Planar remains a positive control for the reflected-focus detail increase")
    .toBeGreaterThan(planarPaneSharpness * 1.1);
  expect(probeReflectionSharpness, "the current single Probe should retain materially less reflected-focus detail than Planar")
    .toBeLessThan(planarReflectionSharpness * 0.1);
  expect(probeReflectionSharpness, "the Probe should not reproduce the Planar focus-state detail increase")
    .toBeLessThanOrEqual(probePaneSharpness);
  expect(proof.sharedFilmEffects.sharedCompositePasses).toBe(2);
  expect(proof.resources.invalidPositionRadianceViolations).toBe(0);

  expect(proof.resources.probeColorCube).toMatchObject({
    resolution: 128,
    faces: 6,
    format: "RGBAFormat",
    type: "HalfFloatType",
    colorSpace: "NoColorSpace",
    filter: "NearestFilter",
  });
  expect(proof.resources.probeDistanceCube).toMatchObject(proof.resources.probeColorCube);
  expect(proof.resources.probeColorCube.nominalTexelPayloadBytes).toBe(786_432);
  expect(proof.resources.probeDistanceCube.nominalTexelPayloadBytes).toBe(786_432);
  expect(proof.resources.probeCaptureNominalTexelPayloadBytes).toBe(1_572_864);
  expect(proof.resources.probeCaptureRenders).toEqual({
    colorFaces: 6,
    distanceFaces: 6,
    total: 12,
    recapturesForFocusChange: 0,
  });
  expect(proof.probeCapture).toMatchObject({
    origin: proof.sample.probeOrigin,
    allFacesComplete: true,
    colorSamplingFilter: "NearestFilter",
    distanceSamplingFilter: "NearestFilter",
    localBackgroundIncluded: false,
    captureToneMapping: "NoToneMapping",
    captureReusedAcrossFocusStates: true,
  });
  expect(proof.probeCapture.excludedGlazingNames.length).toBeGreaterThan(0);
  expect(proof.probeCapture.excludedGlazingNames.every((name) => name.endsWith("-glazing"))).toBe(true);
  expect(proof.production.passOrder).toEqual(GROUND_GLASS_PASS_ORDER);
  expect(GROUND_GLASS_PASS_ORDER).toEqual([
    "sceneRender",
    "cocFootprint",
    "farGather",
    "nearGather",
    "composite",
  ]);
  expect(proof.fixtureConfiguration.reflectionWeight).toBe(0.18);
  expect(proof.directViewSafety).toMatchObject({
    paneFirstHit: proof.sample.pane,
    directRayHitsStreetSign: false,
    paneToQFirstHit: "architecture-rise-street-sign-face-back",
    paneToQPathClear: true,
  });
  expect(proof.resources.passCounts).toMatchObject({
    directSceneRenders: 2,
    probeColorCubeFaceRenders: 6,
    probeDistanceCubeFaceRenders: 6,
    worldPositionSceneRenders: 4,
    paneMaskRenders: 2,
    fullScreenMappingResolves: 4,
    radianceValidityMaskPasses: 2,
    cocPasses: 4,
    cocDecodeDiagnostics: 4,
    gatherPasses: 8,
    focusResolvePasses: 4,
    linearRadianceSums: 2,
    sharedCompositePasses: 2,
  });

  const lifecycle = proof.resources.lifecycle;
  for (const resource of [lifecycle.renderTargets, lifecycle.textures, lifecycle.materials, lifecycle.geometries]) {
    expect(resource.owned).toBeGreaterThan(0);
    expect(resource.disposed).toBe(resource.owned);
    expect(resource.duplicateDisposeEvents).toBe(0);
  }
  expect(lifecycle.customDisposers.registered).toBeGreaterThan(0);
  expect(lifecycle.customDisposers.invoked).toBe(lifecycle.customDisposers.registered);
  expect(lifecycle.rendererDisposeCalled).toBe(true);

  const planarRgb = planarProof.sample.reflectedRadiance;
  const probeRgb = proof.sample.probeRadiance;
  const rgbDifference = probeRgb.map((value, index) => value - planarRgb[index]);
  const luma = (rgb: readonly number[]) => rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
  const probePlanarComparison = {
    planarBaseSha: planarProof.baseSha,
    planarQ: planarProof.sample.cpuQ,
    planarQVirtual: planarProof.sample.cpuQVirtual,
    planarRadiance: planarRgb,
    probeCpuQ: proof.sample.probeCpuQ,
    probeGpuQ: proof.sample.probeGpuQ,
    probeCpuQVirtual: proof.sample.probeCpuQVirtual,
    probeGpuQVirtual: proof.sample.probeGpuQVirtual,
    probeCpuHitObject: proof.sample.probeCpuHitObject,
    probeGpuQInsideSignFace: proof.sample.probeGpuQInsideSignFace,
    qErrorM: proof.sample.qErrorDecompositionM,
    opticalAxisFocus: proof.sample.focusAxis,
    angularParallaxDeg: proof.sample.angularParallaxDeg,
    projectedDisplacementPx: proof.sample.projectedVirtualImageDisplacementPx,
    probeRadiance: probeRgb,
    absoluteRgbDifference: rgbDifference.map(Math.abs),
    luminanceDifference: luma(probeRgb) - luma(planarRgb),
    relativeLuminanceDifference: (luma(probeRgb) - luma(planarRgb)) / Math.max(Math.abs(luma(planarRgb)), 1e-9),
    planarSharpness: {
      paneFocus: planarProof.cases.paneFocus.reflectedSignSharpness.edgeGradientEnergy,
      reflectionFocus: planarProof.cases.reflectionFocus.reflectedSignSharpness.edgeGradientEnergy,
    },
    probeSharpness: {
      paneFocus: paneFocus.reflectedSignSharpness,
      reflectionFocus: reflectionFocus.reflectedSignSharpness,
    },
    focusCoC: {
      paneFocus: {
        planarCpu: planarProof.cases.paneFocus.cpu.reflectedCoC.signedCoCDiameterMm,
        planarGpu: planarProof.cases.paneFocus.gpu.reflectedCoC.signedCoCDiameterMm,
        probeCpu: paneFocus.cpu.reflectedCoC.signedCoCDiameterMm,
        probeGpu: paneFocus.gpu.reflectedCoC.signedCoCDiameterMm,
      },
      reflectionFocus: {
        planarCpu: planarProof.cases.reflectionFocus.cpu.reflectedCoC.signedCoCDiameterMm,
        planarGpu: planarProof.cases.reflectionFocus.gpu.reflectedCoC.signedCoCDiameterMm,
        probeCpu: reflectionFocus.cpu.reflectedCoC.signedCoCDiameterMm,
        probeGpu: reflectionFocus.gpu.reflectedCoC.signedCoCDiameterMm,
      },
    },
    focusPassCounts: proof.resources.passCounts,
    lifecycle: proof.resources.lifecycle,
    originStudy: proof.originStudy,
    backend: proof.backend,
    resources: proof.resources,
  };
  console.info("Architecture Rise Probe vs Planar evidence:", JSON.stringify(probePlanarComparison));

  await page.screenshot({ path: test.info().outputPath("probe-pane-focus.png"), fullPage: true });
  await page.getByRole("button", { name: /Reflection focus/ }).click();
  await expect(page.locator("button[data-case='reflectionFocus']")).toHaveAttribute("aria-pressed", "true");
  await page.screenshot({ path: test.info().outputPath("probe-reflection-focus.png"), fullPage: true });
});
