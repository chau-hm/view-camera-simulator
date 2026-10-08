import { expect, test } from "@playwright/test";
import { GROUND_GLASS_PASS_ORDER } from "../../render/groundGlassPassGraph";

test("measures bounded ideal distance-cube Probe parallax correction", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/src/tests/e2e/fixtures/architecture-rise-probe-focus-reference.html?cpuCorrectionStudy=1");
  const body = page.locator("body");
  await expect.poll(async () =>
    (await body.getAttribute("data-proof-ready")) === "true" ||
    (await body.getAttribute("data-proof-error")) !== null,
  { timeout: 90_000 }).toBe(true);
  expect(await body.getAttribute("data-proof-error"), "The CPU correction study must fail closed").toBeNull();

  const proof = await page.evaluate(() => {
    const result = window.__architectureRiseProbeFocusProof;
    if (!result?.distanceCubeCpuCorrectionStudy) {
      throw new Error("The ideal distance-cube CPU correction study did not publish its evidence");
    }
    return {
      baseSha: result.baseSha,
      originStudy: result.originStudy,
      sample: result.sample,
      study: result.distanceCubeCpuCorrectionStudy,
    };
  });

  expect(pageErrors).toEqual([]);
  expect(proof.baseSha).toBe("3952bc1684db74693861e15cacd11fb2e7aefa1b");
  expect(proof.originStudy.planarSignFaceSampleCount).toBe(12);
  proof.originStudy.selected.origin.forEach((coordinate, index) => {
    expect(coordinate).toBeCloseTo([-1.2725, 1.5, 6.972][index], 10);
  });
  expect(proof.study).toMatchObject({
    method: "ideal infinite-resolution radial-distance raycasts",
    probeOrigin: proof.sample.probeOrigin,
    physicalRayProjectionOnly: true,
    comparisonAuthority: "Planar Q/Q_virtual used only after final Probe ray hit",
    directionStabilityThresholdDeg: 0.01,
  });
  expect(proof.study.iterations.map(({ iterations }) => iterations)).toEqual([0, 1, 2, 4, 8]);

  const uncorrected = proof.study.iterations[0];
  expect(uncorrected.sameTargetFaceHitCount).toBe(12);
  expect(uncorrected.wrongObjectCount).toBe(0);
  expect(uncorrected.noHitCount).toBe(0);
  expect(uncorrected.p95QVirtualErrorM).toBeCloseTo(proof.originStudy.selected.p95QVirtualErrorM ?? NaN, 8);
  expect(uncorrected.namedSample.qErrorM).toBeCloseTo(proof.sample.qErrorDecompositionM.planarToProbeCpu, 8);
  expect(uncorrected.namedSample.qVirtualErrorM)
    .toBeCloseTo(proof.sample.qErrorDecompositionM.planarToProbeCpuVirtual, 8);

  for (const result of proof.study.iterations) {
    expect(result.sampleCount).toBe(12);
    expect(result.sameTargetFaceHitCount + result.wrongObjectCount + result.noHitCount).toBe(12);
    expect(result.sameTargetFaceCoverage).toBe(result.sameTargetFaceHitCount / 12);
    for (const metric of [
      result.medianQErrorM,
      result.p95QErrorM,
      result.medianQVirtualErrorM,
      result.p95QVirtualErrorM,
      result.medianAngularParallaxDeg,
      result.p95AngularParallaxDeg,
      result.medianFocusAxisErrorMm,
      result.p95FocusAxisErrorMm,
    ]) {
      if (metric !== null) expect(Number.isFinite(metric)).toBe(true);
    }
  }

  console.log("PR R CPU distance-cube iteration study", JSON.stringify(proof.study.iterations.map((result) => ({
    iterations: result.iterations,
    coverage: result.sameTargetFaceCoverage,
    sameTargetFaceHitCount: result.sameTargetFaceHitCount,
    wrongObjectCount: result.wrongObjectCount,
    noHitCount: result.noHitCount,
    medianQErrorM: result.medianQErrorM,
    p95QErrorM: result.p95QErrorM,
    medianQVirtualErrorM: result.medianQVirtualErrorM,
    p95QVirtualErrorM: result.p95QVirtualErrorM,
    medianAngularParallaxDeg: result.medianAngularParallaxDeg,
    p95AngularParallaxDeg: result.p95AngularParallaxDeg,
    medianFocusAxisErrorMm: result.medianFocusAxisErrorMm,
    p95FocusAxisErrorMm: result.p95FocusAxisErrorMm,
    medianFinalDirectionChangeDeg: result.medianFinalDirectionChangeDeg,
    p95FinalDirectionChangeDeg: result.p95FinalDirectionChangeDeg,
    invalidDuringIterationCount: result.invalidDuringIterationCount,
    oscillatingSampleCount: result.oscillatingSampleCount,
    notStabilizedAfterFinalIterationCount: result.notStabilizedAfterFinalIterationCount,
    namedSample: result.namedSample,
  })), null, 2));
});

test("validates the one-step distance-cube correction against frozen Planar and Probe evidence", async ({ page }) => {
  test.setTimeout(180_000);
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/src/tests/e2e/fixtures/architecture-rise-planar-focus-reference.html");
  const body = page.locator("body");
  await expect.poll(async () =>
    (await body.getAttribute("data-proof-ready")) === "true" ||
    (await body.getAttribute("data-proof-error")) !== null,
  { timeout: 90_000 }).toBe(true);
  expect(await body.getAttribute("data-proof-error"), "The frozen Planar reference must remain valid").toBeNull();
  const planarProof = await page.evaluate(() => {
    const result = window.__architectureRisePlanarFocusProof;
    if (!result) throw new Error("The frozen Planar reference did not publish its proof");
    return result;
  });
  expect(planarProof.baseSha).toBe("9bf1739a0d73e6650621dd32a55a53f311e09e8d");
  await page.getByRole("button", { name: /Reflection focus/ }).click();
  await page.screenshot({ path: test.info().outputPath("planar-reflection-focus.png"), fullPage: true });

  await page.goto("/src/tests/e2e/fixtures/architecture-rise-probe-focus-reference.html");
  await expect.poll(async () =>
    (await body.getAttribute("data-proof-ready")) === "true" ||
    (await body.getAttribute("data-proof-error")) !== null,
  { timeout: 90_000 }).toBe(true);
  expect(await body.getAttribute("data-proof-error"), "The uncorrected PR Q reference must remain valid").toBeNull();
  const uncorrectedProbe = await page.evaluate(() => {
    const result = window.__architectureRiseProbeFocusProof;
    if (!result) throw new Error("The uncorrected PR Q Probe did not publish its proof");
    return result;
  });
  expect(uncorrectedProbe.baseSha).toBe("3952bc1684db74693861e15cacd11fb2e7aefa1b");
  expect(uncorrectedProbe.originStudy.planarSignFaceSampleCount).toBe(12);
  await page.getByRole("button", { name: /Reflection focus/ }).click();
  await page.screenshot({ path: test.info().outputPath("probe-uncorrected-reflection-focus.png"), fullPage: true });

  await page.goto("/src/tests/e2e/fixtures/architecture-rise-probe-focus-reference.html?parallaxCorrectionIterations=1");
  await expect.poll(async () =>
    (await body.getAttribute("data-proof-ready")) === "true" ||
    (await body.getAttribute("data-proof-error")) !== null,
  { timeout: 90_000 }).toBe(true);
  expect(await body.getAttribute("data-proof-error"), "The corrected GPU mapping must fail closed").toBeNull();

  const proof = await page.evaluate(() => {
    const result = window.__architectureRiseProbeFocusProof;
    if (!result?.distanceCubeCpuCorrectionStudy || !result.distanceCubeGpuCorrectionStudy) {
      throw new Error("The corrected Probe proof did not publish CPU and GPU comparison evidence");
    }
    return result;
  });
  expect(pageErrors).toEqual([]);
  expect(proof.baseSha).toBe(uncorrectedProbe.baseSha);
  const cpuCorrectionStudy = proof.distanceCubeCpuCorrectionStudy;
  const gpuCorrectionStudy = proof.distanceCubeGpuCorrectionStudy;
  if (!cpuCorrectionStudy || !gpuCorrectionStudy) throw new Error("The corrected CPU/GPU studies are absent");
  const correctedCpu = cpuCorrectionStudy.iterations.find(({ iterations }) => iterations === 1);
  const correctedGpu = gpuCorrectionStudy;
  if (!correctedCpu || !correctedGpu) throw new Error("The one-step CPU/GPU correction evidence is incomplete");
  await page.getByRole("button", { name: /Reflection focus/ }).click();
  await page.screenshot({ path: test.info().outputPath("probe-corrected-reflection-focus.png"), fullPage: true });

  const baselineRegionP95 = uncorrectedProbe.originStudy.selected.p95QVirtualErrorM;
  if (baselineRegionP95 === null) throw new Error("Frozen PR Q regional p95 Q_virtual error is absent");
  const baselineNamedError = uncorrectedProbe.sample.qErrorDecompositionM.planarToProbeCpu;
  const baselineProjectedDisplacementPx = uncorrectedProbe.sample.projectedVirtualImageDisplacementPx;
  const correctedGpuNamed = correctedGpu.samples.find((sample) => sample.u === 0.3 && sample.v === 0.3);
  if (!correctedGpuNamed) throw new Error("Corrected GPU region omitted the named (0.3, 0.3) pane sample");

  expect(proof.sample.probeOrigin).toEqual(uncorrectedProbe.sample.probeOrigin);
  expect(cpuCorrectionStudy.iterations.map(({ iterations }) => iterations)).toEqual([0, 1, 2, 4, 8]);
  expect(correctedCpu.sameTargetFaceHitCount).toBe(12);
  expect(correctedCpu.wrongObjectCount).toBe(0);
  expect(correctedCpu.noHitCount).toBe(0);
  expect(correctedCpu.invalidDuringIterationCount).toBe(0);
  expect(correctedCpu.oscillatingSampleCount).toBe(0);
  expect(correctedCpu.namedSample.qErrorM).not.toBeNull();
  expect(correctedCpu.namedSample.qVirtualErrorM).not.toBeNull();
  expect(correctedCpu.namedSample.qErrorM!).toBeLessThan(baselineNamedError * 0.05);
  expect(correctedCpu.namedSample.qVirtualErrorM!).toBeLessThan(baselineNamedError * 0.05);
  expect(correctedCpu.p95QVirtualErrorM!).toBeLessThan(baselineRegionP95 * 0.05);
  expect(correctedCpu.namedSample.projectedVirtualImageDisplacementPx!).toBeLessThan(baselineProjectedDisplacementPx * 0.1);
  expect(correctedCpu.namedSample.focusAxisErrorMm!).toBeLessThan(1);
  expect(correctedCpu.namedSample.roundedFocusControlMm).toBe(11_810);

  expect(correctedGpu.iterations).toBe(1);
  expect(correctedGpu.sampleCount).toBe(12);
  expect(correctedGpu.sameTargetFaceHitCount).toBe(12);
  expect(correctedGpu.wrongObjectCount).toBe(0);
  expect(correctedGpu.noHitCount).toBe(0);
  expect(correctedGpu.sameTargetFaceCoverage).toBe(1);
  expect(correctedGpu.p95QErrorM!).toBeLessThan(baselineRegionP95 * 0.1);
  expect(correctedGpu.p95QVirtualErrorM!).toBeLessThan(baselineRegionP95 * 0.1);
  expect(correctedGpu.p95QVirtualErrorM!).toBeLessThan(0.03);
  expect(correctedGpu.p95AngularParallaxDeg!).toBeLessThan(
    (uncorrectedProbe.originStudy.selected.p95AngularParallaxDeg ?? 10) * 0.1,
  );
  expect(correctedGpu.p95FocusAxisErrorMm!).toBeLessThan(15);
  expect(correctedGpu.p95CpuToGpuQErrorM!).toBeLessThan(0.02);
  expect(correctedGpu.p95CpuToGpuQVirtualErrorM!).toBeLessThan(0.02);
  expect(correctedGpuNamed.qErrorM!).toBeLessThan(baselineNamedError * 0.05);
  expect(correctedGpuNamed.qVirtualErrorM!).toBeLessThan(baselineNamedError * 0.05);
  expect(correctedGpuNamed.cpuToGpuQErrorM!).toBeLessThan(0.02);
  expect(proof.sample.qErrorDecompositionM.probeGpuToPlanar).toBeLessThan(baselineNamedError * 0.05);
  expect(proof.sample.qErrorDecompositionM.probeGpuToPlanarVirtual).toBeLessThan(baselineNamedError * 0.05);
  expect(proof.sample.projectedVirtualImageDisplacementPx).toBeLessThan(baselineProjectedDisplacementPx * 0.1);
  expect(proof.sample.focusAxis.absoluteProbeErrorMm).toBeLessThan(5);
  expect(proof.sample.focusAxis.roundedProbeFocusMm).toBe(11_810);
  expect(proof.production.passOrder).toEqual(GROUND_GLASS_PASS_ORDER);
  expect(proof.sample.probeGpuQInsideSignFace).toBe(true);
  expect(proof.sample.probeRadiance.every(Number.isFinite)).toBe(true);
  expect(proof.sample.probeRadiance.some((value) => value > 0)).toBe(true);

  const paneFocus = proof.cases.paneFocus;
  const reflectionFocus = proof.cases.reflectionFocus;
  expect(paneFocus.focusDistanceMm).toBe(8_890);
  expect(reflectionFocus.focusDistanceMm).toBe(11_810);
  expect(Math.abs(paneFocus.gpu.reflectedCoC.signedCoCDiameterMm)).toBeGreaterThan(0.05);
  expect(Math.abs(reflectionFocus.gpu.reflectedCoC.signedCoCDiameterMm)).toBeLessThan(0.001);
  expect(paneFocus.gpu.reflectedCoC.absoluteCpuDifferenceMm).toBeLessThanOrEqual(
    paneFocus.gpu.reflectedCoC.storageToleranceMm,
  );
  expect(reflectionFocus.gpu.reflectedCoC.absoluteCpuDifferenceMm).toBeLessThanOrEqual(
    reflectionFocus.gpu.reflectedCoC.storageToleranceMm,
  );
  expect(Math.abs(paneFocus.gpu.reflectedCoC.signedCoCDiameterMm -
    planarProof.cases.paneFocus.gpu.reflectedCoC.signedCoCDiameterMm)).toBeLessThan(0.002);
  expect(Math.abs(reflectionFocus.gpu.reflectedCoC.signedCoCDiameterMm -
    planarProof.cases.reflectionFocus.gpu.reflectedCoC.signedCoCDiameterMm)).toBeLessThan(0.002);

  const planarPaneSharpness = planarProof.cases.paneFocus.reflectedSignSharpness.edgeGradientEnergy;
  const planarReflectionSharpness = planarProof.cases.reflectionFocus.reflectedSignSharpness.edgeGradientEnergy;
  const uncorrectedProbeReflectionSharpness = uncorrectedProbe.cases.reflectionFocus.reflectedSignSharpness.edgeGradientEnergy;
  const correctedPaneSharpness = paneFocus.reflectedSignSharpness.edgeGradientEnergy;
  const correctedReflectionSharpness = reflectionFocus.reflectedSignSharpness.edgeGradientEnergy;
  expect(planarReflectionSharpness).toBeGreaterThan(planarPaneSharpness * 1.1);
  expect(uncorrectedProbeReflectionSharpness).toBeLessThan(planarReflectionSharpness * 0.1);
  expect(correctedReflectionSharpness).toBeGreaterThan(planarReflectionSharpness * 0.5);
  expect(correctedReflectionSharpness)
    .toBeGreaterThan(uncorrectedProbeReflectionSharpness + planarReflectionSharpness * 0.4);
  expect(correctedReflectionSharpness).toBeGreaterThan(correctedPaneSharpness * 1.05);
  expect(paneFocus.reflectedSignSharpness.sampleCount).toBeGreaterThan(0);
  expect(reflectionFocus.reflectedSignSharpness.sampleCount).toBeGreaterThan(0);

  expect(correctedGpu.extraDistanceCubeSamplesPerOutputPixel).toBe(1);
  expect(correctedGpu.extraDistanceCubeSamplesPerPanePixelAcrossBothMappingOutputsPerFocusCase).toBe(2);
  expect(correctedGpu.extraColorCubeSamplesPerPanePixelPerFocusCase).toBe(0);
  expect(correctedGpu.additionalCandidateFullscreenPasses).toBe(0);
  expect(correctedGpu.regionDiagnosticFullscreenPasses).toBe(1);
  expect(correctedGpu.regionDiagnosticFramebufferStatus).toBe("0x8cd5");
  expect(correctedGpu.regionDiagnosticReadbackArrayType).toBe("Float32Array");
  expect(correctedGpu.regionDiagnosticResources).toMatchObject({
    panePositionTexture: { dimensions: [12, 1], type: "FloatType", filter: "NearestFilter" },
    paneNormalTexture: { dimensions: [12, 1], type: "FloatType", filter: "NearestFilter" },
    correctedPointTarget: { dimensions: [12, 1], type: "FloatType", filter: "NearestFilter" },
    shaderMaterialCount: 1,
  });
  expect(proof.resources.probeCaptureRenders).toEqual(uncorrectedProbe.resources.probeCaptureRenders);
  expect(proof.resources.probeCaptureRenders).toEqual({
    colorFaces: 6,
    distanceFaces: 6,
    total: 12,
    recapturesForFocusChange: 0,
  });
  expect(proof.resources.probeColorCube).toMatchObject(uncorrectedProbe.resources.probeColorCube);
  expect(proof.resources.probeDistanceCube).toMatchObject(uncorrectedProbe.resources.probeDistanceCube);
  expect(proof.resources.probeCaptureNominalTexelPayloadBytes)
    .toBe(uncorrectedProbe.resources.probeCaptureNominalTexelPayloadBytes);
  for (const resource of [
    proof.resources.lifecycle.renderTargets,
    proof.resources.lifecycle.textures,
    proof.resources.lifecycle.materials,
    proof.resources.lifecycle.geometries,
  ]) {
    expect(resource.disposed).toBe(resource.owned);
    expect(resource.duplicateDisposeEvents).toBe(0);
  }
  expect(proof.resources.lifecycle.customDisposers.invoked)
    .toBe(proof.resources.lifecycle.customDisposers.registered);
  expect(proof.resources.lifecycle.rendererDisposeCalled).toBe(true);

  const promising =
    correctedCpu.p95QVirtualErrorM! < baselineRegionP95 * 0.05 &&
    correctedGpu.p95QVirtualErrorM! < baselineRegionP95 * 0.1 &&
    correctedGpu.sameTargetFaceCoverage === 1 &&
    correctedGpu.p95CpuToGpuQVirtualErrorM! < 0.02 &&
    correctedReflectionSharpness > planarReflectionSharpness * 0.5;
  expect(promising, "One fixed Probe plus one bounded distance-cube update materially improves spatial mapping and detail")
    .toBe(true);

  console.log("PR R corrected GPU summary", JSON.stringify({
    outcome: promising ? "DISTANCE-CUBE PARALLAX CORRECTION PROMISING" : "not promising",
    frozenPlanar: {
      q: planarProof.sample.cpuQ,
      qVirtual: planarProof.sample.cpuQVirtual,
      paneFocusCoC: planarProof.cases.paneFocus.gpu.reflectedCoC.signedCoCDiameterMm,
      reflectionFocusCoC: planarProof.cases.reflectionFocus.gpu.reflectedCoC.signedCoCDiameterMm,
      paneFocusSharpness: planarPaneSharpness,
      reflectionFocusSharpness: planarReflectionSharpness,
    },
    frozenUncorrectedProbe: {
      origin: uncorrectedProbe.sample.probeOrigin,
      cpuQ: uncorrectedProbe.sample.probeCpuQ,
      gpuQ: uncorrectedProbe.sample.probeGpuQ,
      cpuQVirtual: uncorrectedProbe.sample.probeCpuQVirtual,
      gpuQVirtual: uncorrectedProbe.sample.probeGpuQVirtual,
      planarToProbeCpuQErrorM: uncorrectedProbe.sample.qErrorDecompositionM.planarToProbeCpu,
      probeCpuToGpuQErrorM: uncorrectedProbe.sample.qErrorDecompositionM.probeCpuToProbeGpu,
      gpuToPlanarQErrorM: uncorrectedProbe.sample.qErrorDecompositionM.probeGpuToPlanar,
      angularParallaxDeg: uncorrectedProbe.sample.angularParallaxDeg,
      projectedDisplacementPx: uncorrectedProbe.sample.projectedVirtualImageDisplacementPx,
      focusAxis: uncorrectedProbe.sample.focusAxis,
      regionP95QVirtualErrorM: baselineRegionP95,
      paneFocusSharpness: uncorrectedProbe.cases.paneFocus.reflectedSignSharpness.edgeGradientEnergy,
      reflectionFocusSharpness: uncorrectedProbeReflectionSharpness,
    },
    frozenProbeNamedQErrorM: baselineNamedError,
    frozenProbeRegionP95QVirtualErrorM: baselineRegionP95,
    correctedQ: proof.sample.probeGpuQ,
    correctedQVirtual: proof.sample.probeGpuQVirtual,
    gpuToPlanarQErrorM: proof.sample.qErrorDecompositionM.probeGpuToPlanar,
    gpuToPlanarQVirtualErrorM: proof.sample.qErrorDecompositionM.probeGpuToPlanarVirtual,
    cpuToGpuQErrorM: correctedGpu.medianCpuToGpuQErrorM,
    cpuToGpuQVirtualErrorM: correctedGpu.medianCpuToGpuQVirtualErrorM,
    gpuRegion: {
      sameTargetFaceHitCount: correctedGpu.sameTargetFaceHitCount,
      wrongObjectCount: correctedGpu.wrongObjectCount,
      noHitCount: correctedGpu.noHitCount,
      medianQErrorM: correctedGpu.medianQErrorM,
      p95QErrorM: correctedGpu.p95QErrorM,
      medianQVirtualErrorM: correctedGpu.medianQVirtualErrorM,
      p95QVirtualErrorM: correctedGpu.p95QVirtualErrorM,
      medianAngularParallaxDeg: correctedGpu.medianAngularParallaxDeg,
      p95AngularParallaxDeg: correctedGpu.p95AngularParallaxDeg,
      medianFocusAxisErrorMm: correctedGpu.medianFocusAxisErrorMm,
      p95FocusAxisErrorMm: correctedGpu.p95FocusAxisErrorMm,
      medianCpuToGpuQErrorM: correctedGpu.medianCpuToGpuQErrorM,
      p95CpuToGpuQErrorM: correctedGpu.p95CpuToGpuQErrorM,
      medianCpuToGpuQVirtualErrorM: correctedGpu.medianCpuToGpuQVirtualErrorM,
      p95CpuToGpuQVirtualErrorM: correctedGpu.p95CpuToGpuQVirtualErrorM,
      samples: correctedGpu.samples.map(({ u, v, qErrorM, qVirtualErrorM, cpuToGpuQErrorM, hitObject }) => ({
        u, v, qErrorM, qVirtualErrorM, cpuToGpuQErrorM, hitObject,
      })),
    },
    correctedCpuNamed: correctedCpu?.namedSample,
    correctedGpuNamed: correctedGpuNamed && {
      q: correctedGpuNamed.q,
      qVirtual: correctedGpuNamed.qVirtual,
      qErrorM: correctedGpuNamed.qErrorM,
      qVirtualErrorM: correctedGpuNamed.qVirtualErrorM,
      cpuToGpuQErrorM: correctedGpuNamed.cpuToGpuQErrorM,
      angularParallaxDeg: correctedGpuNamed.angularParallaxDeg,
      focusAxisErrorMm: correctedGpuNamed.focusAxisErrorMm,
    },
    cpuIterationStudy: proof.distanceCubeCpuCorrectionStudy?.iterations.map((result) => ({
      iterations: result.iterations,
      sameFace: result.sameTargetFaceHitCount,
      wrong: result.wrongObjectCount,
      noHit: result.noHitCount,
      medianQVirtualErrorM: result.medianQVirtualErrorM,
      p95QVirtualErrorM: result.p95QVirtualErrorM,
      medianAngularParallaxDeg: result.medianAngularParallaxDeg,
      p95AngularParallaxDeg: result.p95AngularParallaxDeg,
      medianFocusAxisErrorMm: result.medianFocusAxisErrorMm,
      p95FocusAxisErrorMm: result.p95FocusAxisErrorMm,
      named: result.namedSample,
      invalid: result.invalidDuringIterationCount,
      oscillating: result.oscillatingSampleCount,
      notStabilizedAfterFinalIteration: result.notStabilizedAfterFinalIterationCount,
    })),
    correctedSharpness: { planarReflectionSharpness, uncorrectedProbeReflectionSharpness, correctedPaneSharpness, correctedReflectionSharpness },
    paneFocus: {
      coc: proof.cases.paneFocus.gpu.reflectedCoC.signedCoCDiameterMm,
      sharpness: proof.cases.paneFocus.reflectedSignSharpness.edgeGradientEnergy,
    },
    reflectionFocus: {
      coc: proof.cases.reflectionFocus.gpu.reflectedCoC.signedCoCDiameterMm,
      sharpness: proof.cases.reflectionFocus.reflectedSignSharpness.edgeGradientEnergy,
    },
    lifecycle: proof.resources.lifecycle,
    targetCount: proof.resources.targetCount,
    captureRenders: proof.resources.probeCaptureRenders,
  }, null, 2));
});
