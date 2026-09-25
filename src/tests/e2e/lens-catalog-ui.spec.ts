import { writeFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { expectGroundGlassPhysicalScale } from "./helpers/groundGlass";
import { setStepRangeInput } from "./helpers/stepRangeInput";

const openLensCatalogScene = async (page: Page) => {
  await page.goto("/simulator/free/understanding-camera-movements?rttDiagnostics=1");
  await expect(page.getByTestId("lens-control")).toBeVisible();
  await expect(page.getByTestId("ground-glass-rtt")).toHaveAttribute(
    "data-rtt-final-contentful",
    "true",
    { timeout: 60_000 },
  );
  await expect(page.getByTestId("scene-canvas")).toHaveAttribute(
    "data-optical-geometry-visible",
    "true",
  );
};

test("lens catalog selection keeps finite coverage across published simulator profiles", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await openLensCatalogScene(page);

  const lensControl = page.getByTestId("lens-control");
  const rtt = page.getByTestId("ground-glass-rtt");
  const scene = page.getByTestId("scene-canvas");
  const wide = lensControl.getByRole("radio", {
    name: /90 mm.*Wide.*Lens coverage: 100\.9° simulator coverage \(teaching profile\)/,
  });
  const standard = lensControl.getByRole("radio", {
    name: /150 mm.*Standard.*Lens coverage: 72° simulator coverage \(teaching profile\)/,
  });

  await expect(wide).toBeChecked();
  const publishedProfiles = [
    { focalLengthMm: 90, angle: "100.9" },
    { focalLengthMm: 105, angle: "92.1" },
    { focalLengthMm: 120, angle: "84.5" },
    { focalLengthMm: 150, angle: "72" },
  ];
  for (const { focalLengthMm, angle } of publishedProfiles) {
    const option = lensControl.getByRole("radio", {
      name: new RegExp(
        `${focalLengthMm} mm.*Lens coverage: ${angle.replace(".", "\\.")}° simulator coverage \\(teaching profile\\)`,
      ),
    });
    await option.check();
    await expect(lensControl).toHaveAttribute(
      "data-selected-lens-id",
      `simulator-parametric-${focalLengthMm}mm`,
    );
    await expect(lensControl).toHaveAttribute("data-selected-lens-coverage-kind", "angular");
    await expect(lensControl).toHaveAttribute(
      "data-selected-lens-image-circle-diameter-mm",
      /\d+\.\d{6}/,
    );
    await expect(lensControl.getByTestId("lens-control-coverage-value")).toHaveText(
      `${angle}° simulator coverage (teaching profile)`,
    );
    await expect(rtt).toHaveAttribute("data-rtt-coverage-kind", "parallel-circle");
    await expect(rtt).toHaveAttribute("data-rtt-coverage-enabled", "true");
    await expect(scene).toHaveAttribute("data-image-circle-visible", "true");
    await expect(scene).toHaveAttribute("data-lens-coverage-visible", "true");
    const physicalScale = await expectGroundGlassPhysicalScale(rtt);
    if (focalLengthMm === 90 || focalLengthMm === 150) {
      await page.getByTestId("scene-canvas").locator("canvas").screenshot({
        path: testInfo.outputPath(`understanding-camera-movements-${focalLengthMm}mm.png`),
      });
      const calibrationFile = `understanding-camera-movements-${focalLengthMm}mm-physical-blur-scale.json`;
      const calibrationRecord = { ...physicalScale, focalLengthMm };
      await testInfo.attach(calibrationFile, {
        body: JSON.stringify(calibrationRecord),
        contentType: "application/json",
      });
      await writeFile(
        testInfo.outputPath(calibrationFile),
        JSON.stringify(calibrationRecord, null, 2),
      );
    }
  }

  await standard.check();
  await expect(standard).toBeChecked();
  await expect(lensControl).toHaveAttribute(
    "data-selected-lens-id",
    "simulator-parametric-150mm",
  );
  await expect(lensControl).toHaveAttribute("data-selected-lens-coverage-kind", "angular");
  await expect(lensControl).toHaveAttribute(
    "data-selected-lens-image-circle-diameter-mm",
    /\d+\.\d{6}/,
  );
  await expect(lensControl.getByTestId("lens-control-coverage-value")).toHaveText(
    "72° simulator coverage (teaching profile)",
  );
  await expect(lensControl.getByTestId("lens-control-image-circle-label")).toHaveText(
    "Image circle",
  );
  await expect(lensControl.getByTestId("lens-control-image-circle-value")).toHaveText(/mm/);
  await expect(rtt).toHaveAttribute("data-rtt-coverage-kind", "parallel-circle");
  await expect(rtt).toHaveAttribute("data-rtt-coverage-enabled", "true");
  await expect(scene).toHaveAttribute("data-image-circle-visible", "true");
  await expect(scene).toHaveAttribute("data-image-circle-radius-mm", /\d+\.\d+/);

  await setStepRangeInput(page, "Tilt", 0.5);
  await expect(rtt).toHaveAttribute("data-rtt-coverage-kind", "nonparallel-conic");
  await expect(rtt).toHaveAttribute("data-rtt-natural-illumination-kind", "neutral");
  await expect(scene).toHaveAttribute("data-lens-coverage-kind", "nonparallel-conic");
  await expect(scene).not.toHaveAttribute("data-image-circle-radius-mm", /.+/);
  await expect(lensControl.getByTestId("lens-control-image-circle-label")).toHaveText(
    "Reference image circle",
  );
  await expect(lensControl.getByTestId("lens-control-image-circle-reference-note")).toContainText(
    "Coverage Footprint",
  );
  await expect(lensControl.getByTestId("lens-control-image-circle-value")).toHaveText(/mm/);
  await expect(lensControl).toHaveAttribute(
    "data-selected-lens-image-circle-diameter-mm",
    /\d+\.\d{6}/,
  );

  await setStepRangeInput(page, "Tilt", 0);
  await expect(rtt).toHaveAttribute("data-rtt-coverage-kind", "parallel-circle");
  await expect(scene).toHaveAttribute("data-image-circle-visible", "true");
  await expect(lensControl.getByTestId("lens-control-image-circle-label")).toHaveText(
    "Image circle",
  );
  await expect(lensControl.getByTestId("lens-control-image-circle-reference-note")).toHaveCount(0);

  await wide.check();
  await expect(wide).toBeChecked();
  await expect(lensControl).toHaveAttribute("data-selected-lens-id", "simulator-parametric-90mm");
  await expect(lensControl).toHaveAttribute("data-selected-lens-coverage-kind", "angular");
  await expect(rtt).toHaveAttribute("data-rtt-coverage-kind", "parallel-circle");
  await expect(rtt).toHaveAttribute("data-rtt-coverage-enabled", "true");
  await expect(scene).toHaveAttribute("data-image-circle-visible", "true");
  await expect(scene).toHaveAttribute("data-lens-coverage-visible", "true");
});

test("lens catalog presentation stays readable and localized at desktop and tablet widths", async ({ page }) => {
  for (const viewport of [
    { width: 1280, height: 800 },
    { width: 1024, height: 768 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/simulator/free/understanding-camera-movements");
    const lensControl = page.getByTestId("lens-control");
    await expect(lensControl).toBeVisible();
    await expect(lensControl.getByRole("radio", { name: /90 mm.*Wide/ })).toBeVisible();
    await expect(lensControl.getByRole("radio", { name: /150 mm.*Standard/ })).toBeVisible();
    const bounds = await lensControl.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width);
  }

  await page.getByRole("combobox", { name: "Language" }).selectOption("zh-HK");
  const localizedLensControl = page.getByTestId("lens-control");
  await expect(localizedLensControl).toBeVisible();
  await expect(page.getByRole("combobox", { name: "語言" })).toHaveValue("zh-HK");
  await expect(localizedLensControl.getByRole("radiogroup", { name: "鏡頭選項" })).toBeVisible();
  await expect(
    localizedLensControl.getByRole("radio", {
      name: /90 mm.*廣角.*鏡頭成像範圍: 100\.9° 模擬成像範圍（教學模型）/,
    }),
  ).toBeVisible();
  await expect(
    localizedLensControl.getByRole("radio", {
      name: /150 mm.*標準.*鏡頭成像範圍: 72° 模擬成像範圍（教學模型）/,
    }),
  ).toBeVisible();
  await expect(localizedLensControl.getByTestId("lens-control-coverage-value")).toHaveText(
    "100.9° 模擬成像範圍（教學模型）",
  );
});
