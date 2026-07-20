import { expect, test } from "@playwright/test";

test("expanded 3D Scene stays inside simulator main and preserves its canvas", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto("/simulator/free/architecture-rise");

  const sceneRenderer = page.getByTestId("scene-canvas");
  await expect(sceneRenderer.locator("canvas")).toHaveCount(1);
  const originalRenderer = await sceneRenderer.elementHandle();
  expect(originalRenderer).toBeTruthy();
  const originalCameraPosition = await sceneRenderer.getAttribute("data-observer-camera-position");
  const originalOrbitTarget = await sceneRenderer.getAttribute("data-orbit-target");

  await page.getByRole("button", { name: "Expand 3D Scene" }).click();
  await expect(page.getByRole("button", { name: "Restore 3D Scene" })).toBeFocused();
  await expect(sceneRenderer).toHaveCount(1);
  await expect(sceneRenderer.locator("canvas")).toHaveCount(1);
  expect(
    await page.evaluate(
      (node) => node === document.querySelector('[data-testid="scene-canvas"]'),
      originalRenderer,
    ),
  ).toBe(true);
  await expect(sceneRenderer).toHaveAttribute(
    "data-observer-camera-position",
    originalCameraPosition ?? "",
  );
  await expect(sceneRenderer).toHaveAttribute("data-orbit-target", originalOrbitTarget ?? "");

  await expect(page.getByLabel("GroundGlassColumn")).toHaveCount(0);
  await expect(page.getByLabel("CurrentSettingsReadout")).toHaveCount(0);
  await expect(page.getByLabel("FocusTargetsReadout")).toHaveCount(0);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Camera Controls" })).toBeVisible();

  const layout = await page.evaluate(() => {
    const main = document.querySelector<HTMLElement>(".simulator-main");
    const aside = document.querySelector<HTMLElement>(".simulator-aside");
    const card = document.querySelector<HTMLElement>(".simulator-card--expanded");
    const renderer = document.querySelector<HTMLElement>('[data-testid="scene-canvas"]');
    if (!main || !aside || !card || !renderer) throw new Error("Expanded layout is incomplete");
    const mainRect = main.getBoundingClientRect();
    const asideRect = aside.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    const rendererRect = renderer.getBoundingClientRect();
    return {
      main: { left: mainRect.left, right: mainRect.right, height: mainRect.height },
      aside: { left: asideRect.left, overflowY: getComputedStyle(aside).overflowY },
      card: { left: cardRect.left, right: cardRect.right, height: cardRect.height },
      renderer: { width: rendererRect.width, height: rendererRect.height },
      mainOverflowY: getComputedStyle(main).overflowY,
    };
  });

  expect(layout.card.left).toBeGreaterThanOrEqual(layout.main.left - 1);
  expect(layout.card.right).toBeLessThanOrEqual(layout.main.right + 1);
  expect(layout.card.right).toBeLessThan(layout.aside.left);
  expect(layout.card.height).toBeGreaterThan(0);
  expect(layout.renderer.width).toBeGreaterThan(0);
  expect(layout.renderer.height).toBeGreaterThan(200);
  expect(layout.mainOverflowY).toBe("hidden");
  expect(layout.aside.overflowY).toBe("auto");

  const rise = page.getByLabel("Rise");
  const beforeRise = await rise.inputValue();
  await rise.press("ArrowRight");
  await expect(rise).not.toHaveValue(beforeRise);

  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Expand 3D Scene" })).toBeFocused();
  await expect(page.getByLabel("GroundGlassColumn")).toBeVisible();
  expect(
    await page.evaluate(
      (node) => node === document.querySelector('[data-testid="scene-canvas"]'),
      originalRenderer,
    ),
  ).toBe(true);
});
