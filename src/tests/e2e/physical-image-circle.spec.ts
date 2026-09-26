import { expect, test, type Locator } from "@playwright/test";
import { setStepRangeInput } from "./helpers/stepRangeInput";

const readFiniteAttribute = async (locator: Locator, name: string): Promise<number> => {
  const value = Number(await locator.getAttribute(name));
  expect(Number.isFinite(value), `${name} must be finite`).toBe(true);
  return value;
};

const expectGroundGlassAndSceneCoverageAgreement = async (
  scene: Locator,
  rtt: Locator,
) => {
  expect(await scene.getAttribute("data-image-circle-visible")).toBe("true");
  await expect(rtt).toHaveAttribute("data-rtt-coverage-enabled", "true");
  expect(await scene.getAttribute("data-image-circle-ray-count")).toBe("12");

  const [sceneRadius, rttRadius, sceneOffsetX, rttOffsetX, sceneOffsetY, rttOffsetY] =
    await Promise.all([
      readFiniteAttribute(scene, "data-image-circle-radius-mm"),
      readFiniteAttribute(rtt, "data-rtt-coverage-radius-mm"),
      readFiniteAttribute(scene, "data-image-circle-offset-x-mm"),
      readFiniteAttribute(rtt, "data-rtt-coverage-offset-x-mm"),
      readFiniteAttribute(scene, "data-image-circle-offset-y-mm"),
      readFiniteAttribute(rtt, "data-rtt-coverage-offset-y-mm"),
    ]);

  expect(sceneRadius).toBeCloseTo(rttRadius, 5);
  expect(sceneOffsetX).toBeCloseTo(rttOffsetX, 5);
  expect(sceneOffsetY).toBeCloseTo(rttOffsetY, 5);
  return { sceneRadius, sceneOffsetX, sceneOffsetY };
};

test("3D Image Circle consumes the Ground Glass finite coverage state", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/simulator/free/architecture-rise?rttDiagnostics=1");

  const scene = page.getByTestId("scene-canvas");
  const rtt = page.getByTestId("ground-glass-rtt");
  await expect(scene.locator("canvas")).toHaveCount(1);
  await expect(rtt).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 60_000 });

  await page.getByRole("button", { name: "Infinity Reset" }).click();
  await expect(scene).toHaveAttribute("data-image-circle-visible", "true");
  const neutral = await expectGroundGlassAndSceneCoverageAgreement(scene, rtt);
  expect(neutral.sceneOffsetX).toBeCloseTo(0, 5);
  expect(neutral.sceneOffsetY).toBeCloseTo(0, 5);

  const overlayTrigger = page.getByRole("button", { name: "View overlays" });
  if (await overlayTrigger.isVisible()) await overlayTrigger.click();
  await page.getByRole("button", { name: "Show Legends" }).click();
  await expect(page.getByText("Image circle (rose)", { exact: true })).toBeVisible();

  await setStepRangeInput(page, "Rise", 20);
  const risen = await expectGroundGlassAndSceneCoverageAgreement(scene, rtt);
  expect(risen.sceneOffsetY).toBeCloseTo(20, 5);
  expect(risen.sceneRadius).toBeCloseTo(neutral.sceneRadius, 5);

  await setStepRangeInput(page, "Rise", 40);
  const threshold = await expectGroundGlassAndSceneCoverageAgreement(scene, rtt);
  expect(threshold.sceneOffsetY).toBeCloseTo(40, 5);
  expect(threshold.sceneRadius).toBeCloseTo(neutral.sceneRadius, 5);

  for (const previewLabel of ["Upright Assist", "Raw Ground Glass"]) {
    await page.getByRole("radio", { name: previewLabel }).check();
    const previewState = await expectGroundGlassAndSceneCoverageAgreement(scene, rtt);
    expect(previewState.sceneRadius).toBeCloseTo(threshold.sceneRadius, 5);
    expect(previewState.sceneOffsetX).toBeCloseTo(threshold.sceneOffsetX, 5);
    expect(previewState.sceneOffsetY).toBeCloseTo(threshold.sceneOffsetY, 5);
  }

  const aperture = page.getByRole("radiogroup", { name: "Aperture" });
  await aperture.getByRole("radio", { name: "f/5.6" }).check();
  const wideApertureState = await expectGroundGlassAndSceneCoverageAgreement(scene, rtt);
  await aperture.getByRole("radio", { name: "f/22" }).check();
  const stoppedDownState = await expectGroundGlassAndSceneCoverageAgreement(scene, rtt);
  expect(stoppedDownState.sceneRadius).toBeCloseTo(wideApertureState.sceneRadius, 5);
  expect(stoppedDownState.sceneOffsetX).toBeCloseTo(wideApertureState.sceneOffsetX, 5);
  expect(stoppedDownState.sceneOffsetY).toBeCloseTo(wideApertureState.sceneOffsetY, 5);

  if (await overlayTrigger.isVisible()) await overlayTrigger.click();
  await page.getByRole("button", { name: "Hide Optical geometry" }).click();
  await expect(scene).toHaveAttribute("data-optical-geometry-visible", "false");
  await expect(scene).toHaveAttribute("data-image-circle-visible", "false");
  await expect(scene).toHaveAttribute("data-lens-coverage-visible", "false");
  await expect(scene).not.toHaveAttribute("data-lens-coverage-kind", /.+/);
  await expect(scene).not.toHaveAttribute("data-image-circle-radius-mm", /.+/);
  await expect(page.getByText("Image circle (rose)", { exact: true })).not.toBeVisible();
  await expect(page.getByText("Coverage footprint (rose)", { exact: true })).not.toBeVisible();

  await page.getByRole("button", { name: "Show Optical geometry" }).click();
  await expect(scene).toHaveAttribute("data-image-circle-visible", "true");
  await expect(scene).toHaveAttribute("data-lens-coverage-visible", "true");
  await expect(scene).toHaveAttribute("data-lens-coverage-kind", "parallel-circle");
  await expect(page.getByText("Image circle (rose)", { exact: true })).toBeVisible();

  await setStepRangeInput(page, "Tilt", 5);
  await expect(scene).toHaveAttribute("data-image-circle-visible", "false");
  await expect(scene).not.toHaveAttribute("data-image-circle-radius-mm", /.+/);
  await expect(scene).toHaveAttribute("data-lens-coverage-visible", "true");
  await expect(scene).toHaveAttribute("data-lens-coverage-kind", "nonparallel-conic");
  await expect(scene).toHaveAttribute("data-lens-coverage-perimeter-count", "72");
  await expect(scene).toHaveAttribute("data-lens-coverage-ray-count", "12");
  await expect(scene).toHaveAttribute("data-lens-coverage-semi-axis-1-mm", /\d/);
  await expect(scene).toHaveAttribute("data-lens-coverage-semi-axis-2-mm", /\d/);
  await expect(rtt).toHaveAttribute("data-rtt-coverage-kind", "nonparallel-conic");
  await expect(rtt).toHaveAttribute("data-rtt-coverage-enabled", "true");
  await expect(page.getByText("Image circle (rose)", { exact: true })).not.toBeVisible();
  await expect(page.getByText("Coverage footprint (rose)", { exact: true })).toBeVisible();

  const conicAttributeNames = [
    "data-lens-coverage-center-world",
    "data-lens-coverage-center-x-mm",
    "data-lens-coverage-center-y-mm",
    "data-lens-coverage-semi-axis-1-mm",
    "data-lens-coverage-semi-axis-2-mm",
    "data-lens-coverage-orientation-rad",
    "data-lens-coverage-perimeter-count",
    "data-lens-coverage-ray-count",
  ];
  const conicAttributes = await Promise.all(
    conicAttributeNames.map((name) => scene.getAttribute(name)),
  );
  for (const previewLabel of ["Upright Assist", "Raw Ground Glass"]) {
    await page.getByRole("radio", { name: previewLabel }).check();
    expect(await Promise.all(conicAttributeNames.map((name) => scene.getAttribute(name))))
      .toEqual(conicAttributes);
  }
  await aperture.getByRole("radio", { name: "f/5.6" }).check();
  const wideOpenConicAttributes = await Promise.all(
    conicAttributeNames.map((name) => scene.getAttribute(name)),
  );
  await aperture.getByRole("radio", { name: "f/22" }).check();
  expect(await Promise.all(conicAttributeNames.map((name) => scene.getAttribute(name))))
    .toEqual(wideOpenConicAttributes);

  if (await overlayTrigger.isVisible()) await overlayTrigger.click();
  await page.getByRole("button", { name: "Hide Optical geometry" }).click();
  await expect(scene).toHaveAttribute("data-lens-coverage-visible", "false");
  await expect(scene).not.toHaveAttribute("data-lens-coverage-kind", /.+/);
  await expect(page.getByText("Coverage footprint (rose)", { exact: true })).not.toBeVisible();
});
