import { expect, test } from "@playwright/test";
import { coverageViewport, expectCoverageContour, prepareCoverageView } from "./helpers/observerCoverageContour";
import { macroContours, obliqueArchitectureContours } from "./helpers/coveragePixelReferences";
import { setStepRangeInput } from "./helpers/stepRangeInput";

test.use(coverageViewport);

test("Oblique Architecture transitions between the parallel circle and non-parallel conic", async ({ page }, testInfo) => {
  test.setTimeout(150_000);
  await page.goto("/simulator/free/oblique-architecture?rttDiagnostics=1");
  await prepareCoverageView(page);

  const rtt = page.getByTestId("ground-glass-rtt");
  const scene = page.getByTestId("scene-canvas");
  await expect(scene.locator("canvas")).toHaveCount(1);
  await expect(rtt).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 60_000 });
  await expect(rtt).toHaveAttribute("data-rtt-focal-length-mm", "150");
  await expect(rtt).toHaveAttribute("data-rtt-coverage-kind", "parallel-circle");
  await expect(rtt).toHaveAttribute("data-rtt-coverage-enabled", "true");
  await expect(scene).toHaveAttribute("data-image-circle-visible", "true");
  await expect(scene).toHaveAttribute("data-lens-coverage-visible", "true");
  await expect(scene).toHaveAttribute("data-lens-coverage-kind", "parallel-circle");
  await expect(scene).toHaveAttribute("data-lens-coverage-perimeter-count", "72");
  await expect(scene).toHaveAttribute("data-lens-coverage-ray-count", "12");
  const overlayTrigger = page.getByRole("button", { name: "View overlays" });
  if (await overlayTrigger.isVisible()) await overlayTrigger.click();
  await page.getByRole("button", { name: "Show Legends" }).click();
  if (await overlayTrigger.isVisible()) await overlayTrigger.click();
  await expect(page.getByText("Image circle (rose)", { exact: true })).toBeVisible();
  await expectCoverageContour(page, testInfo, "oblique-parallel-baseline", obliqueArchitectureContours.neutral);

  await setStepRangeInput(page, "Rise", 40);
  await expect(rtt).toHaveAttribute("data-rtt-coverage-kind", "parallel-circle");
  await expectCoverageContour(page, testInfo, "oblique-parallel-rise40", obliqueArchitectureContours.rise40);

  await setStepRangeInput(page, "Swing", 5);
  await expect(rtt).toHaveAttribute("data-rtt-coverage-kind", "nonparallel-conic");
  await expect(rtt).toHaveAttribute("data-rtt-coverage-enabled", "true");
  await expect(rtt).toHaveAttribute("data-rtt-coverage-conic-quadratic", /,/);
  await expect(rtt).toHaveAttribute("data-rtt-coverage-conic-axial", /,/);
  await expect(rtt).toHaveAttribute("data-rtt-natural-illumination-kind", "nonparallel-geometric");
  await expect(rtt).toHaveAttribute("data-rtt-natural-illumination-enabled", "true");
  await expect(scene).toHaveAttribute("data-image-circle-visible", "false");
  await expect(scene).toHaveAttribute("data-lens-coverage-visible", "true");
  await expect(scene).toHaveAttribute("data-lens-coverage-kind", "nonparallel-conic");
  await expect(scene).toHaveAttribute("data-lens-coverage-perimeter-count", "72");
  await expect(scene).toHaveAttribute("data-lens-coverage-ray-count", "12");
  await expect(scene).toHaveAttribute("data-lens-coverage-center-world", /,/);
  await expect(scene).toHaveAttribute("data-lens-coverage-semi-axis-1-mm", /\d/);
  await expect(scene).toHaveAttribute("data-lens-coverage-semi-axis-2-mm", /\d/);
  await expect(scene).not.toHaveAttribute("data-image-circle-radius-mm", /.+/);
  await expect(page.getByText("Image circle (rose)", { exact: true })).not.toBeVisible();
  await expect(page.getByText("Coverage footprint (rose)", { exact: true })).toBeVisible();
  const positiveSwingCoefficients = await rtt.getAttribute("data-rtt-coverage-conic-quadratic");
  await expectCoverageContour(page, testInfo, "oblique-swing-plus5",
    obliqueArchitectureContours.plus, { reject: obliqueArchitectureContours.rise40 });

  await setStepRangeInput(page, "Swing", -5);
  await expect(rtt).toHaveAttribute("data-rtt-coverage-kind", "nonparallel-conic");
  await expect(rtt).toHaveAttribute("data-rtt-coverage-enabled", "true");
  const negativeSwingCoefficients = await rtt.getAttribute("data-rtt-coverage-conic-quadratic");
  expect(negativeSwingCoefficients).not.toBe(positiveSwingCoefficients);
  await expect(scene).toHaveAttribute("data-image-circle-visible", "false");
  await expect(scene).toHaveAttribute("data-lens-coverage-kind", "nonparallel-conic");
  await expect(scene).toHaveAttribute("data-lens-coverage-ray-count", "12");
  await expectCoverageContour(page, testInfo, "oblique-swing-minus5",
    obliqueArchitectureContours.minus, { reject: obliqueArchitectureContours.plus });

  await setStepRangeInput(page, "Swing", 0);
  await expect(rtt).toHaveAttribute("data-rtt-coverage-kind", "parallel-circle");
  await expect(rtt).toHaveAttribute("data-rtt-coverage-enabled", "true");
  await expect(rtt).not.toHaveAttribute("data-rtt-coverage-conic-quadratic", /.+/);
  await expect(scene).toHaveAttribute("data-image-circle-visible", "true");
  await expect(scene).toHaveAttribute("data-lens-coverage-visible", "true");
  await expect(scene).toHaveAttribute("data-lens-coverage-kind", "parallel-circle");
  await expect(scene).not.toHaveAttribute("data-lens-coverage-semi-axis-1-mm", /.+/);
  await expect(page.getByText("Image circle (rose)", { exact: true })).toBeVisible();
  await expect(page.getByText("Coverage footprint (rose)", { exact: true })).not.toBeVisible();
  await expectCoverageContour(page, testInfo, "oblique-swing0-restored",
    obliqueArchitectureContours.rise40, { reject: obliqueArchitectureContours.minus });

  await setStepRangeInput(page, "Swing", 5);
  await expect(rtt).toHaveAttribute("data-rtt-coverage-kind", "nonparallel-conic");
  await expect(rtt).toHaveAttribute("data-rtt-coverage-enabled", "true");
  await page.getByLabel("Raw RTT — bypass DOF").check();
  await expect(rtt).toHaveAttribute("data-rtt-coverage-kind", "nonparallel-conic");
  await expect(rtt).toHaveAttribute("data-rtt-coverage-enabled", "false");
  await expect(scene).toHaveAttribute("data-lens-coverage-kind", "nonparallel-conic");
  await expect(scene).toHaveAttribute("data-lens-coverage-visible", "true");
  await page.getByLabel("Raw RTT — bypass DOF").uncheck();
  await expect(rtt).toHaveAttribute("data-rtt-coverage-enabled", "true");
});

test("Macro Oblique Plane renders the finite non-parallel coverage conic", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await page.goto("/simulator/free/macro-oblique-plane?rttDiagnostics=1");
  await prepareCoverageView(page);

  const rtt = page.getByTestId("ground-glass-rtt");
  const scene = page.getByTestId("scene-canvas");
  await expect(rtt).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 60_000 });
  await setStepRangeInput(page, "Tilt", 5);

  await expect(rtt).toHaveAttribute("data-rtt-focal-length-mm", "150");
  await expect(rtt).toHaveAttribute("data-rtt-coverage-kind", "nonparallel-conic");
  await expect(rtt).toHaveAttribute("data-rtt-coverage-enabled", "true");
  await expect(rtt).toHaveAttribute("data-rtt-natural-illumination-kind", "nonparallel-geometric");
  await expect(rtt).toHaveAttribute("data-rtt-natural-illumination-enabled", "true");
  await expect(scene).toHaveAttribute("data-image-circle-visible", "false");
  await expect(scene).toHaveAttribute("data-lens-coverage-visible", "true");
  await expect(scene).toHaveAttribute("data-lens-coverage-kind", "nonparallel-conic");
  await expect(scene).toHaveAttribute("data-lens-coverage-perimeter-count", "72");
  await expect(scene).toHaveAttribute("data-lens-coverage-ray-count", "12");
  await expect(rtt).toHaveAttribute("data-rtt-coverage-conic-quadratic", /,/);
  await expectCoverageContour(page, testInfo, "macro-oblique-tilt5", macroContours.oblique);
});

// Keep the registered M7V title. The raster assertion covers the compound
// footprint in this projection; the orientation diagnostic covers film-space rotation.
test("Macro Compound Movements renders a rotated conic for compound Tilt and Swing", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await page.goto("/simulator/free/macro-compound-movements?rttDiagnostics=1");
  await prepareCoverageView(page);

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
  await expect(scene).toHaveAttribute("data-lens-coverage-visible", "true");
  await expect(scene).toHaveAttribute("data-lens-coverage-kind", "nonparallel-conic");
  await expect(scene).toHaveAttribute("data-lens-coverage-ray-count", "12");
  await expect(scene).toHaveAttribute("data-lens-coverage-orientation-rad", /\d/);

  await expectCoverageContour(page, testInfo, "macro-compound-tilt4-swing4",
    macroContours.compound, { reject: macroContours.tiltOnly });
});
