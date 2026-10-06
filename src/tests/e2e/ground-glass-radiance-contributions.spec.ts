import { expect, test } from "@playwright/test";

type ContributionMeasurement = {
  id: string;
  centerSignedCoCDiameterMm: number;
  centerMajorRadiusMm: number;
  changedPixelsFromEqualFocusReference: number;
  hash: string;
};

type ProofCase = {
  focusDistanceMm: number;
  direct: ContributionMeasurement;
  secondary: ContributionMeasurement;
  combinedHash: string;
  singleContributionHash?: string;
  combinedVsRadiometricSumMaxByteDelta?: number;
  singleContributionPassCount?: number;
  contributionPassCount: number;
  cpuSubmitMs: number;
};

test("Ground Glass contributions retain independent physical focus before radiance addition", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto("/src/tests/e2e/fixtures/ground-glass-radiance-contribution.html");
  await expect(page.locator("body")).toHaveAttribute("data-proof-ready", "true", {
    timeout: 30_000,
  });

  const proof = await page.evaluate(() => {
    const result = window.__groundGlassContributionProof;
    if (!result) throw new Error("The Ground Glass contribution proof did not publish results");
    return result;
  });
  const { A, B, C } = proof.cases as Record<"A" | "B" | "C", ProofCase>;

  expect(pageErrors).toEqual([]);
  expect(proof.resourceSummary).toMatchObject({
    targetCount: 10,
    targetDimensions: [128, 128],
    targetFormat: "RGBA8",
    fullResolutionPassesPerTwoContributionFrame: 10,
  });
  console.info("Ground Glass contribution GPU proof:", JSON.stringify({
    backend: proof.backend,
    resourceSummary: proof.resourceSummary,
    cases: proof.cases,
  }));

  // A: one metre is the active conjugate; the half-metre contribution keeps
  // its own negative physical CoC and loses high-frequency pattern contrast.
  expect(A.focusDistanceMm).toBe(1000);
  expect(Math.abs(A.direct.centerSignedCoCDiameterMm)).toBeLessThan(0.2);
  expect(A.secondary.centerSignedCoCDiameterMm).toBeCloseTo(-9.45, 0);
  expect(A.secondary.centerMajorRadiusMm).toBeCloseTo(4.73, 0);
  expect(A.direct.hash).toBe(C.direct.hash);
  expect(A.secondary.changedPixelsFromEqualFocusReference).toBeGreaterThan(1000);

  // B swaps the film conjugate. The secondary becomes sharp while the direct
  // contribution carries its own positive physical CoC and blur response.
  expect(B.focusDistanceMm).toBe(500);
  expect(B.direct.centerSignedCoCDiameterMm).toBeCloseTo(11.48, 0);
  expect(B.direct.centerMajorRadiusMm).toBeCloseTo(5.74, 0);
  expect(Math.abs(B.secondary.centerSignedCoCDiameterMm)).toBeLessThan(0.2);
  expect(B.secondary.hash).toBe(C.secondary.hash);
  expect(B.direct.changedPixelsFromEqualFocusReference).toBeGreaterThan(1000);

  // C has equivalent apparent-world-position fields. It agrees with the
  // single-contribution reference within storage/raster tolerance, and the
  // final render is the additive sum of the independently focused inputs.
  expect(C.direct.centerSignedCoCDiameterMm).toBeCloseTo(
    C.secondary.centerSignedCoCDiameterMm,
    4,
  );
  expect(Math.abs(C.direct.centerSignedCoCDiameterMm)).toBeLessThan(0.2);
  expect(C.direct.hash).toBe(C.singleContributionHash);
  expect(C.singleContributionPassCount).toBe(5);
  expect(C.direct.changedPixelsFromEqualFocusReference).toBe(0);
  expect(C.secondary.changedPixelsFromEqualFocusReference).toBe(0);
  expect(C.combinedVsRadiometricSumMaxByteDelta).toBeLessThanOrEqual(2);
  expect(new Set([A.combinedHash, B.combinedHash, C.combinedHash]).size).toBe(3);

  await page.screenshot({ path: test.info().outputPath("case-a.png"), fullPage: true });

  await page.getByRole("button", { name: /Case B/ }).click();
  await expect(page.locator("button[data-case='B']")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText(/"case": "B"/)).toBeVisible();
  await page.screenshot({ path: test.info().outputPath("case-b.png"), fullPage: true });
});
