import { expect, test } from "@playwright/test";
import { setStepRangeInput } from "./helpers/stepRangeInput";

test("Oblique Architecture keeps finite Ground Glass coverage through Swing transitions", async ({ page }, testInfo) => {
  test.setTimeout(150_000);
  await page.goto("/simulator/free/oblique-architecture?rttDiagnostics=1");

  const rtt = page.getByTestId("ground-glass-rtt");
  const scene = page.getByTestId("scene-canvas");
  await expect(scene.locator("canvas")).toHaveCount(1);
  await expect(rtt).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 60_000 });
  await expect(rtt).toHaveAttribute("data-rtt-focal-length-mm", "150");
  await expect(rtt).toHaveAttribute("data-rtt-coverage-kind", "parallel-circle");
  await expect(rtt).toHaveAttribute("data-rtt-coverage-enabled", "true");
  await expect(scene).toHaveAttribute("data-image-circle-visible", "true");
  await page.screenshot({ path: testInfo.outputPath("parallel-150mm-baseline.png") });

  await setStepRangeInput(page, "Rise", 40);
  await expect(rtt).toHaveAttribute("data-rtt-coverage-kind", "parallel-circle");
  await page.screenshot({ path: testInfo.outputPath("oblique-architecture-rise40-swing0.png") });

  await setStepRangeInput(page, "Swing", 5);
  await expect(rtt).toHaveAttribute("data-rtt-coverage-kind", "nonparallel-conic");
  await expect(rtt).toHaveAttribute("data-rtt-coverage-enabled", "true");
  await expect(rtt).toHaveAttribute("data-rtt-coverage-conic-quadratic", /,/);
  await expect(rtt).toHaveAttribute("data-rtt-coverage-conic-axial", /,/);
  await expect(rtt).toHaveAttribute("data-rtt-natural-illumination-kind", "neutral");
  await expect(rtt).toHaveAttribute("data-rtt-natural-illumination-enabled", "false");
  await expect(scene).toHaveAttribute("data-image-circle-visible", "false");
  const positiveSwingCoefficients = await rtt.getAttribute("data-rtt-coverage-conic-quadratic");
  await page.screenshot({ path: testInfo.outputPath("oblique-architecture-rise40-swing-plus5.png") });

  await setStepRangeInput(page, "Swing", -5);
  await expect(rtt).toHaveAttribute("data-rtt-coverage-kind", "nonparallel-conic");
  await expect(rtt).toHaveAttribute("data-rtt-coverage-enabled", "true");
  const negativeSwingCoefficients = await rtt.getAttribute("data-rtt-coverage-conic-quadratic");
  expect(negativeSwingCoefficients).not.toBe(positiveSwingCoefficients);
  await expect(scene).toHaveAttribute("data-image-circle-visible", "false");
  await page.screenshot({ path: testInfo.outputPath("oblique-architecture-rise40-swing-minus5.png") });

  await setStepRangeInput(page, "Swing", 0);
  await expect(rtt).toHaveAttribute("data-rtt-coverage-kind", "parallel-circle");
  await expect(rtt).toHaveAttribute("data-rtt-coverage-enabled", "true");
  await expect(rtt).not.toHaveAttribute("data-rtt-coverage-conic-quadratic", /.+/);
  await expect(scene).toHaveAttribute("data-image-circle-visible", "true");

  await setStepRangeInput(page, "Swing", 5);
  await expect(rtt).toHaveAttribute("data-rtt-coverage-kind", "nonparallel-conic");
  await expect(rtt).toHaveAttribute("data-rtt-coverage-enabled", "true");
  await page.getByLabel("Raw RTT — bypass DOF").check();
  await expect(rtt).toHaveAttribute("data-rtt-coverage-kind", "nonparallel-conic");
  await expect(rtt).toHaveAttribute("data-rtt-coverage-enabled", "false");
  await page.getByLabel("Raw RTT — bypass DOF").uncheck();
  await expect(rtt).toHaveAttribute("data-rtt-coverage-enabled", "true");
});

test("Macro Oblique Plane enables finite Ground Glass coverage while its 3D circle stays hidden", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await page.goto("/simulator/free/macro-oblique-plane?rttDiagnostics=1");

  const rtt = page.getByTestId("ground-glass-rtt");
  const scene = page.getByTestId("scene-canvas");
  await expect(rtt).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 60_000 });
  await setStepRangeInput(page, "Tilt", 5);

  await expect(rtt).toHaveAttribute("data-rtt-focal-length-mm", "150");
  await expect(rtt).toHaveAttribute("data-rtt-coverage-kind", "nonparallel-conic");
  await expect(rtt).toHaveAttribute("data-rtt-coverage-enabled", "true");
  await expect(rtt).toHaveAttribute("data-rtt-natural-illumination-kind", "neutral");
  await expect(rtt).toHaveAttribute("data-rtt-natural-illumination-enabled", "false");
  await expect(scene).toHaveAttribute("data-image-circle-visible", "false");
  await expect(rtt).toHaveAttribute("data-rtt-coverage-conic-quadratic", /,/);
  await page.screenshot({ path: testInfo.outputPath("macro-oblique-plane-tilt5.png") });
});

test("Macro Compound Movements keeps finite coverage through compound Tilt and Swing", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/simulator/free/macro-compound-movements?rttDiagnostics=1");

  const rtt = page.getByTestId("ground-glass-rtt");
  const scene = page.getByTestId("scene-canvas");
  await expect(rtt).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 60_000 });
  await expect(rtt).toHaveAttribute("data-rtt-coverage-kind", "parallel-circle");
  await expect(rtt).toHaveAttribute("data-rtt-coverage-enabled", "true");

  await setStepRangeInput(page, "Tilt", 4);
  await setStepRangeInput(page, "Swing", 4);
  await expect(rtt).toHaveAttribute("data-rtt-coverage-kind", "nonparallel-conic");
  await expect(rtt).toHaveAttribute("data-rtt-coverage-enabled", "true");
  await expect(rtt).toHaveAttribute("data-rtt-coverage-conic-quadratic", /,/);
  await expect(scene).toHaveAttribute("data-image-circle-visible", "false");
});
