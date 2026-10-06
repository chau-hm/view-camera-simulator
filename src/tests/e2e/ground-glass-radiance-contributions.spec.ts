import { expect, test } from "@playwright/test";

type ContributionMeasurement = {
  id: string;
  centerSignedCoCDiameterMm: number;
  centerMajorRadiusMm: number;
  changedPixelsFromEqualFocusReference: number;
  displayHash: string;
};

type ProofCase = {
  focusDistanceMm: number;
  direct: ContributionMeasurement;
  secondary: ContributionMeasurement;
  combinedDisplayHash: string;
  singleContributionDisplayHash?: string;
  singleContributionPassCount?: number;
  contributionPassCount: number;
  cpuSubmitMs: number;
};

type RadiometricProbeMeasurement = {
  xPx: number;
  yPx: number;
  channel: "R";
  directFocusedValue: number;
  secondaryFocusedValue: number;
  expectedLinearSum: number;
  measuredCombinedLinearValue: number;
  combinedValueExceedsOne: boolean;
  tolerance: number;
  finalDisplayRedByte: number;
  legacyRgba8AccumulatorRedByte: number;
};

test("Ground Glass contributions retain independent focus and unclamped linear-radiance addition", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto("/src/tests/e2e/fixtures/ground-glass-radiance-contribution.html");

  const body = page.locator("body");
  await expect.poll(async () =>
    (await body.getAttribute("data-proof-ready")) === "true" ||
    (await body.getAttribute("data-proof-error")) !== null,
  { timeout: 30_000 }).toBe(true);
  expect(
    await body.getAttribute("data-proof-error"),
    "The floating-point capability gate and radiance proof must succeed without an LDR fallback",
  ).toBeNull();

  const proof = await page.evaluate(() => {
    const result = window.__groundGlassContributionProof;
    if (!result) throw new Error("The Ground Glass contribution proof did not publish results");
    return result;
  });
  const { A, B, C } = proof.cases as Record<"A" | "B" | "C", ProofCase>;

  expect(pageErrors).toEqual([]);
  expect(proof.floatingRadianceCapability).toMatchObject({
    webgl2: true,
    extensionName: "EXT_color_buffer_float",
    extensionSupported: true,
    framebufferComplete: true,
    framebufferStatus: "0x8cd5",
    readbackArrayType: "Float32Array",
  });
  expect(proof.resourceSummary).toMatchObject({
    targetCount: 11,
    cocTargets: {
      count: 2,
      dimensions: [128, 128],
      format: "RGBAFormat",
      type: "UnsignedByteType",
    },
    contributionRadianceTargets: {
      farCount: 2,
      nearCount: 2,
      focusedCount: 2,
      dimensions: [128, 128],
      format: "RGBAFormat",
      type: "FloatType",
      filter: "NearestFilter",
    },
    combinedRadianceTarget: {
      dimensions: [128, 128],
      format: "RGBAFormat",
      type: "FloatType",
    },
    finalDisplayTarget: {
      dimensions: [128, 128],
      format: "RGBAFormat",
      type: "UnsignedByteType",
    },
    legacyByteAccumulatorControl: {
      dimensions: [1, 1],
      format: "RGBAFormat",
      type: "UnsignedByteType",
    },
    radianceInputTextures: {
      count: 2,
      dimensions: [128, 128],
      format: "RGBAFormat",
      type: "FloatType",
    },
    apparentPositionTextures: {
      count: 2,
      dimensions: [128, 128],
      format: "RGBAFormat",
      type: "FloatType",
    },
    visibilityDepthInput: {
      dimensions: [1, 1],
      format: "RGBAFormat",
      type: "UnsignedByteType",
    },
    nominalTargetTexelBytes: 2_031_620,
    nominalInputTexelBytes: 1_048_580,
    fullResolutionPassesPerTwoContributionFrame: 10,
  });
  expect(proof.resourceSummary.rendererTextureCount).toBeGreaterThanOrEqual(16);
  console.info("Ground Glass contribution GPU proof:", JSON.stringify({
    backend: proof.backend,
    floatingRadianceCapability: proof.floatingRadianceCapability,
    resourceSummary: proof.resourceSummary,
    cases: proof.cases,
    radiometricProbe: proof.radiometricProbe,
  }));

  // A: one metre is the active conjugate; the half-metre contribution keeps
  // its own negative physical CoC and loses high-frequency pattern contrast.
  expect(A.focusDistanceMm).toBe(1000);
  expect(Math.abs(A.direct.centerSignedCoCDiameterMm)).toBeLessThan(0.2);
  expect(A.secondary.centerSignedCoCDiameterMm).toBeCloseTo(-9.45, 0);
  expect(A.secondary.centerMajorRadiusMm).toBeCloseTo(4.73, 0);
  expect(A.direct.displayHash).toBe(C.direct.displayHash);
  expect(A.secondary.changedPixelsFromEqualFocusReference).toBeGreaterThan(1000);

  // B swaps the film conjugate. The secondary becomes sharp while the direct
  // contribution carries its own positive physical CoC and blur response.
  expect(B.focusDistanceMm).toBe(500);
  expect(B.direct.centerSignedCoCDiameterMm).toBeCloseTo(11.48, 0);
  expect(B.direct.centerMajorRadiusMm).toBeCloseTo(5.74, 0);
  expect(Math.abs(B.secondary.centerSignedCoCDiameterMm)).toBeLessThan(0.2);
  expect(B.secondary.displayHash).toBe(C.secondary.displayHash);
  expect(B.direct.changedPixelsFromEqualFocusReference).toBeGreaterThan(1000);

  // C preserves equal focus behavior and its single-contribution display path.
  expect(C.direct.centerSignedCoCDiameterMm).toBeCloseTo(
    C.secondary.centerSignedCoCDiameterMm,
    4,
  );
  expect(Math.abs(C.direct.centerSignedCoCDiameterMm)).toBeLessThan(0.2);
  expect(C.direct.displayHash).toBe(C.singleContributionDisplayHash);
  expect(C.singleContributionPassCount).toBe(5);
  expect(C.direct.changedPixelsFromEqualFocusReference).toBe(0);
  expect(C.secondary.changedPixelsFromEqualFocusReference).toBe(0);
  expect(new Set([A.combinedDisplayHash, B.combinedDisplayHash, C.combinedDisplayHash]).size).toBe(3);

  // A central Case C patch is sharp in both contribution layers. The two
  // float readbacks must each retain 0.75 red and combine to 1.50 before the
  // shared film/display stage.
  const probe = proof.radiometricProbe as RadiometricProbeMeasurement;
  expect(probe.channel).toBe("R");
  expect(probe.directFocusedValue).toBeCloseTo(0.75, 4);
  expect(probe.secondaryFocusedValue).toBeCloseTo(0.75, 4);
  expect(probe.expectedLinearSum).toBeCloseTo(1.5, 4);
  expect(probe.measuredCombinedLinearValue).toBeCloseTo(1.5, 4);
  expect(probe.measuredCombinedLinearValue).toBeGreaterThan(1.0);
  expect(probe.combinedValueExceedsOne).toBe(true);
  expect(Math.abs(probe.measuredCombinedLinearValue - probe.expectedLinearSum))
    .toBeLessThanOrEqual(probe.tolerance);

  // An RGBA8 accumulator of the same inputs saturates at 255 (1.0). The
  // separate final display may also clamp, but it is not the radiance oracle.
  expect(probe.legacyRgba8AccumulatorRedByte).toBe(255);
  expect(probe.finalDisplayRedByte).toBe(255);

  await page.screenshot({ path: test.info().outputPath("case-a.png"), fullPage: true });

  await page.getByRole("button", { name: /Case B/ }).click();
  await expect(page.locator("button[data-case='B']")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText(/"case": "B"/)).toBeVisible();
  await page.screenshot({ path: test.info().outputPath("case-b.png"), fullPage: true });
});
