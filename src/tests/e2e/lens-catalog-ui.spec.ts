import { expect, test, type Page } from "@playwright/test";

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

test("lens catalog selection updates canonical optics and the 3D image-circle transition", async ({ page }) => {
  test.setTimeout(120_000);
  await openLensCatalogScene(page);

  const lensControl = page.getByTestId("lens-control");
  const rtt = page.getByTestId("ground-glass-rtt");
  const scene = page.getByTestId("scene-canvas");
  const wide = lensControl.getByRole("radio", {
    name: /90 mm.*Wide.*Coverage: Not modelled/,
  });
  const standard = lensControl.getByRole("radio", {
    name: /150 mm.*Standard.*Coverage: 72° simulator coverage/,
  });

  await expect(wide).toBeChecked();
  await expect(lensControl).toHaveAttribute("data-selected-lens-id", "simulator-ideal-90mm");
  await expect(lensControl).toHaveAttribute(
    "data-selected-lens-coverage-kind",
    "unbounded-ideal",
  );
  await expect(lensControl).not.toHaveAttribute(
    "data-selected-lens-image-circle-diameter-mm",
    /.+/,
  );
  await expect(rtt).toHaveAttribute("data-rtt-coverage-kind", "unbounded");
  await expect(rtt).toHaveAttribute("data-rtt-coverage-enabled", "false");
  await expect(scene).toHaveAttribute("data-image-circle-visible", "false");

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
  await expect(lensControl.getByTestId("lens-control-coverage-value")).toHaveText("72° simulator coverage");
  await expect(lensControl.getByTestId("lens-control-image-circle-value")).toHaveText(/mm/);
  await expect(rtt).toHaveAttribute("data-rtt-coverage-kind", "parallel-circle");
  await expect(rtt).toHaveAttribute("data-rtt-coverage-enabled", "true");
  await expect(scene).toHaveAttribute("data-image-circle-visible", "true");
  await expect(scene).toHaveAttribute("data-image-circle-radius-mm", /\d+\.\d+/);

  await wide.check();
  await expect(wide).toBeChecked();
  await expect(lensControl).toHaveAttribute("data-selected-lens-id", "simulator-ideal-90mm");
  await expect(lensControl).toHaveAttribute(
    "data-selected-lens-coverage-kind",
    "unbounded-ideal",
  );
  await expect(lensControl).not.toHaveAttribute(
    "data-selected-lens-image-circle-diameter-mm",
    /.+/,
  );
  await expect(rtt).toHaveAttribute("data-rtt-coverage-kind", "unbounded");
  await expect(rtt).toHaveAttribute("data-rtt-coverage-enabled", "false");
  await expect(scene).toHaveAttribute("data-image-circle-visible", "false");
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
  await expect(localizedLensControl.getByRole("radio", { name: /90 mm.*廣角.*成像範圍: 尚未建模/ })).toBeVisible();
  await expect(localizedLensControl.getByRole("radio", { name: /150 mm.*標準.*成像範圍: 72° 模擬成像範圍/ })).toBeVisible();
  await expect(localizedLensControl.getByTestId("lens-control-coverage-value")).toHaveText("尚未建模");
});
