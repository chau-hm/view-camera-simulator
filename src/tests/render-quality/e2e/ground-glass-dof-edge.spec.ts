import { expect, test } from "@playwright/test";

test("Ground Glass depth-edge fixture measures production gather visibility on rendered pixels", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto("/src/tests/e2e/fixtures/ground-glass-dof-edge.html");

  await expect.poll(async () => page.locator("body").getAttribute("data-proof-ready"), {
    timeout: 30_000,
  }).toBe("true");

  const proof = await page.evaluate(() => {
    const result = window.__groundGlassDofEdgeProof;
    if (!result) throw new Error("The Ground Glass DOF edge fixture did not publish measurements");
    return {
      backend: result.backend,
      renderer: result.renderer,
      sourceDepthFormat: result.sourceDepthFormat,
      scene: result.scene,
      cases: result.cases,
      faults: result.faults,
    };
  });

  expect(pageErrors).toEqual([]);
  expect(proof.backend).toBe("webgl2");
  expect(proof.scene).toMatchObject({
    frontDistanceMm: 400,
    backDistanceMm: 410,
    edgePixelX: 256,
  });
  console.info("Ground Glass DOF depth-edge fixture:", JSON.stringify(proof));

  // Thin-lens reference in millimetres, calculated independently of the renderer.
  // v = fD / (D - f), and the signed blur diameter is (f / N)(v_f / v - 1).
  const thinLensCoc = (distanceMm: number, focusMm: number, fNumber: number) => {
    const focalLengthMm = 150;
    const imageDistance = (subjectMm: number) =>
      focalLengthMm * subjectMm / (subjectMm - focalLengthMm);
    return focalLengthMm / fNumber * (imageDistance(focusMm) / imageDistance(distanceMm) - 1);
  };
  const cocQuantizationBoundMm = (distanceMm: number, focusMm: number, fNumber: number) => {
    // DEPTH_COMPONENT16 quantizes perspective depth. Bound the resulting
    // distance error with the exact inverse projection at half a depth code.
    const nearMm = 10;
    const farMm = 4000;
    const depthCodes = 65535;
    const depthCode = farMm / (farMm - nearMm) -
      farMm * nearMm / ((farMm - nearMm) * distanceMm);
    const distanceAtDepth = (depth: number) =>
      farMm * nearMm / (farMm - depth * (farMm - nearMm));
    const halfDepthCode = 0.5 / depthCodes;
    const distanceErrorMm = Math.max(
      Math.abs(distanceAtDepth(depthCode - halfDepthCode) - distanceMm),
      Math.abs(distanceAtDepth(depthCode + halfDepthCode) - distanceMm),
    );
    const reference = thinLensCoc(distanceMm, focusMm, fNumber);
    const depthCocErrorMm = Math.max(
      Math.abs(thinLensCoc(distanceMm - distanceErrorMm, focusMm, fNumber) - reference),
      Math.abs(thinLensCoc(distanceMm + distanceErrorMm, focusMm, fNumber) - reference),
    );

    // The CoC target stores signed diameter in RGBA8 over a 12 mm range.
    // Negative values use 128 intervals; positive values use 127.
    const cocHalfCodeMm = (reference < 0 ? 12 / 128 : 12 / 127) / 2;
    return depthCocErrorMm + cocHalfCodeMm;
  };
  const referenceCases = [
    { id: "focus-foreground-400-f2_8", focus: 400, aperture: 2.8, distance: 410, surface: "background" },
    { id: "focus-near-far-390-f2_8", focus: 390, aperture: 2.8, distance: 400, surface: "foreground" },
    { id: "focus-background-410-f1_4", focus: 410, aperture: 1.4, distance: 400, surface: "foreground" },
  ] as const;
  for (const reference of referenceCases) {
    const result = proof.cases[reference.id];
    const measured = reference.surface === "foreground"
      ? result.foregroundCoCDiameterMm
      : result.backgroundCoCDiameterMm;
    const expected = thinLensCoc(reference.distance, reference.focus, reference.aperture);
    const errorBoundMm = cocQuantizationBoundMm(reference.distance, reference.focus, reference.aperture);
    expect(Math.abs(measured - expected), `${reference.id} signed CoC error within quantization bound ${errorBoundMm} mm`)
      .toBeLessThan(errorBoundMm);
  }

  const focusedForeground = proof.cases["focus-foreground-400-f2_8"];
  expect(focusedForeground.foregroundCoCDiameterMm).toBe(0);
  expect(focusedForeground.backgroundCoCDiameterMm).toBeGreaterThan(0);
  expect(focusedForeground.candidateForegroundNearAlpha).toBe(0);
  expect(focusedForeground.candidateEdgeRedIncrease).toBeLessThan(1);
  expect(focusedForeground.legacyEdgeRedIncrease).toBeGreaterThan(20);
  expect(focusedForeground.legacyEdgeRedIncrease - focusedForeground.candidateEdgeRedIncrease)
    .toBeGreaterThan(50);
  expect(focusedForeground.candidateForegroundContrast)
    .toBeCloseTo(focusedForeground.sourceForegroundContrast, 1);
  expect(focusedForeground.candidateForegroundContrast)
    .toBeCloseTo(focusedForeground.legacyForegroundContrast, 1);
  expect(focusedForeground.candidateBackgroundContrast)
    .toBeLessThan(focusedForeground.sourceBackgroundContrast);
  expect(focusedForeground.candidateBackgroundContrast)
    .toBeCloseTo(focusedForeground.legacyBackgroundContrast, 1);

  const faultMeasurements = proof.faults;
  const expectedBackgroundCoc = thinLensCoc(410, 400, 2.8);
  const candidateBackgroundContrastRatio = focusedForeground.candidateBackgroundContrast /
    focusedForeground.sourceBackgroundContrast;
  expect(faultMeasurements.wrongCocBackgroundDiameterMm).toBeLessThan(0);
  expect(Math.abs(faultMeasurements.wrongCocBackgroundDiameterMm - expectedBackgroundCoc))
    .toBeGreaterThan(cocQuantizationBoundMm(410, 400, 2.8));
  expect(
    faultMeasurements.wrongCocBackgroundContrast,
    "the wrong-sign GPU pass fails the rendered local-contrast control",
  ).toBeGreaterThan(focusedForeground.candidateBackgroundContrast * 1.03);
  expect(candidateBackgroundContrastRatio, "the expected defocus retains most of the fixture stripe contrast")
    .toBeGreaterThan(0.75);
  expect(candidateBackgroundContrastRatio).toBeLessThan(0.99);
  expect(
    faultMeasurements.excessiveBlurBackgroundContrast,
    "the 3× GPU blur fault loses at least 10% more local contrast than the physical gather",
  ).toBeLessThan(focusedForeground.candidateBackgroundContrast * 0.9);
  expect(faultMeasurements.zeroBlurBackgroundContrast / faultMeasurements.sourceBackgroundContrast)
    .toBeGreaterThan(0.99);

  const nearFar = proof.cases["focus-near-far-390-f2_8"];
  expect(nearFar.candidateEdgeRedIncrease).toBeLessThan(nearFar.legacyEdgeRedIncrease);

  const defocusedForeground = proof.cases["focus-background-410-f1_4"];
  expect(defocusedForeground.foregroundCoCDiameterMm).toBeLessThan(0);
  expect(defocusedForeground.backgroundCoCDiameterMm).toBe(0);
  expect(defocusedForeground.candidateForegroundNearAlpha).toBe(1);
  expect(defocusedForeground.candidateForegroundContrast)
    .toBeLessThan(defocusedForeground.sourceForegroundContrast);
  expect(defocusedForeground.candidateBackgroundContrast)
    .toBeGreaterThan(defocusedForeground.sourceBackgroundContrast * 0.9);

  const stoppedDown = proof.cases["stopped-down-400-f32"];
  expect(stoppedDown.candidateZeroBlurMeanAbsDifference).toBe(0);

  for (const caseId of [
    "focus-near-far-390-f2_8",
    "focus-foreground-400-f2_8",
    "focus-background-410-f1_4",
    "stopped-down-400-f32",
  ] as const) {
    await page.evaluate((id) => window.__groundGlassDofEdgeProof?.showCase(id), caseId);
    await page.screenshot({
      path: test.info().outputPath(`${caseId}.png`),
      fullPage: true,
    });
  }
});
