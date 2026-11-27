import { expect, test, type Page } from "@playwright/test";

const fixtureUrl = "/src/tests/e2e/fixtures/ground-glass-dof-edge.html";

async function capture(page: Page) {
  await page.goto(fixtureUrl);
  await expect.poll(() => page.locator("body").getAttribute("data-proof-ready"), {
    timeout: 30_000,
  }).toBe("true");
  return page.evaluate(() => {
    const proof = window.__groundGlassDofEdgeProof;
    if (!proof) throw new Error("Depth-edge GPU results are missing");
    const canvas = document.querySelector<HTMLCanvasElement>("#source-output");
    const context = canvas?.getContext("2d");
    if (!canvas || !context) throw new Error("Source pixels are missing");
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let sum = 0;
    let sumSquares = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      const luminance = 0.2126 * pixels[i] + 0.7152 * pixels[i + 1] + 0.0722 * pixels[i + 2];
      sum += luminance;
      sumSquares += luminance * luminance;
    }
    const count = pixels.length / 4;
    return {
      backend: proof.backend,
      renderer: proof.renderer,
      scene: proof.scene,
      measurement: proof.cases["focus-foreground-400-f2_8"],
      faults: proof.faults,
      variance: sumSquares / count - (sum / count) ** 2,
      sourcePixels: Array.from(pixels),
    };
  });
}

test("Ground Glass optical response tolerates rendered background variation", async ({ page }) => {
  const baseline = await capture(page);

  // The fixture's protected optical regions are in the center. Alter only an
  // unrelated top strip of its rendered background material, keeping geometry,
  // camera, depths, aperture, and protected stripe pixels unchanged.
  await page.route("**/src/tests/e2e/fixtures/ground-glass-dof-edge-harness.ts*", async (route) => {
    const response = await route.fetch();
    const source = await response.text();
    const anchor = "gl_FragColor = vec4(mix(darkBlue, lightCyan, stripe), 1.0);";
    expect(source.split(anchor)).toHaveLength(2);
    const changed = source.replace(anchor,
      `${anchor}\n    if (vUv.y > 0.7) gl_FragColor = vec4(0.95, 0.85, 0.05, 1.0);`);
    await route.fulfill({ response, body: changed });
  });
  const varied = await capture(page);

  expect(baseline.backend).toBe("webgl2");
  expect(varied.backend).toBe(baseline.backend);
  expect(varied.renderer).toBe(baseline.renderer);
  expect(varied.scene).toEqual(baseline.scene);
  expect(varied.sourcePixels).not.toEqual(baseline.sourcePixels);
  expect(Math.abs(varied.variance - baseline.variance)).toBeGreaterThan(1);

  const first = baseline.measurement;
  const second = varied.measurement;
  for (const key of [
    "foregroundCoCDiameterMm", "backgroundCoCDiameterMm",
    "candidateForegroundContrast", "candidateBackgroundContrast", "candidateEdgeRedIncrease",
  ] as const) {
    expect(second[key], key).toBeCloseTo(first[key], 4);
  }
  // An unchanged source ROI is still expected to show physical defocus. The
  // bypass/zero-blur comparator fault must fail the same response requirement.
  const acceptsDefocus = (backgroundContrast: number) =>
    backgroundContrast < second.sourceBackgroundContrast;
  expect(acceptsDefocus(second.candidateBackgroundContrast)).toBe(true);
  expect(acceptsDefocus(varied.faults.zeroBlurBackgroundContrast)).toBe(false);
  expect(second.candidateZeroBlurMeanAbsDifference).toBeGreaterThan(0);
  console.info("A1 content compatibility", JSON.stringify({
    backend: baseline.backend,
    renderer: baseline.renderer,
    baselineVariance: baseline.variance,
    variedVariance: varied.variance,
    baseline: first,
    varied: second,
  }));
});
