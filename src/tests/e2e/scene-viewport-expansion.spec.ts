import { expect, test } from "@playwright/test";

test("3D Scene expansion restores a contained 5:4 viewport without replacing its canvas", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto("/simulator/free/architecture-rise");

  const sceneRenderer = page.getByTestId("scene-canvas");
  await expect(sceneRenderer.locator("canvas")).toHaveCount(1);
  const originalRenderer = await sceneRenderer.elementHandle();
  expect(originalRenderer).toBeTruthy();
  const originalCameraPosition = await sceneRenderer.getAttribute("data-observer-camera-position");
  const originalOrbitTarget = await sceneRenderer.getAttribute("data-orbit-target");

  const readExpandedLayout = () => page.evaluate(() => {
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

  const readRestoredLayout = () => page.evaluate(() => {
    const sceneCard = document.querySelector<HTMLElement>(".simulator-viewport-grid > .simulator-card:first-child");
    const groundGlassCard = document.querySelector<HTMLElement>('[aria-label="GroundGlassColumn"]');
    const renderer = document.querySelector<HTMLElement>('[data-testid="scene-canvas"]');
    if (!sceneCard || !groundGlassCard || !renderer) throw new Error("Normal viewport layout is incomplete");
    const sceneCardRect = sceneCard.getBoundingClientRect();
    const groundGlassCardRect = groundGlassCard.getBoundingClientRect();
    const rendererRect = renderer.getBoundingClientRect();
    return {
      sceneCard: { left: sceneCardRect.left, right: sceneCardRect.right, bottom: sceneCardRect.bottom },
      groundGlassCard: { left: groundGlassCardRect.left, right: groundGlassCardRect.right },
      renderer: {
        left: rendererRect.left,
        right: rendererRect.right,
        bottom: rendererRect.bottom,
        width: rendererRect.width,
        height: rendererRect.height,
      },
    };
  });

  for (let cycle = 0; cycle < 3; cycle += 1) {
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
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Camera Controls" })).toBeVisible();

    const expandedLayout = await readExpandedLayout();
    expect(expandedLayout.card.left).toBeGreaterThanOrEqual(expandedLayout.main.left - 1);
    expect(expandedLayout.card.right).toBeLessThanOrEqual(expandedLayout.main.right + 1);
    expect(expandedLayout.card.right).toBeLessThan(expandedLayout.aside.left);
    expect(expandedLayout.card.height).toBeGreaterThan(0);
    expect(expandedLayout.renderer.width).toBeGreaterThan(0);
    expect(expandedLayout.renderer.height).toBeGreaterThan(200);
    expect(expandedLayout.mainOverflowY).toBe("hidden");
    expect(expandedLayout.aside.overflowY).toBe("auto");

    await page.getByRole("button", { name: "Restore 3D Scene" }).click();
    await expect(page.getByRole("button", { name: "Expand 3D Scene" })).toBeFocused();
    await expect(page.getByLabel("GroundGlassColumn")).toBeVisible();
    await expect(page.getByRole("region", { name: "Camera Controls" })).toBeVisible();
    expect(
      await page.evaluate(
        (node) => node === document.querySelector('[data-testid="scene-canvas"]'),
        originalRenderer,
      ),
    ).toBe(true);

    const restoredLayout = await readRestoredLayout();
    expect(restoredLayout.renderer.width / restoredLayout.renderer.height).toBeCloseTo(5 / 4, 2);
    expect(restoredLayout.renderer.left).toBeGreaterThanOrEqual(restoredLayout.sceneCard.left);
    expect(restoredLayout.renderer.right).toBeLessThanOrEqual(restoredLayout.sceneCard.right);
    expect(restoredLayout.renderer.bottom).toBeLessThanOrEqual(restoredLayout.sceneCard.bottom);
    expect(restoredLayout.renderer.right).toBeLessThanOrEqual(restoredLayout.groundGlassCard.left);
    expect(restoredLayout.sceneCard.right).toBeLessThanOrEqual(restoredLayout.groundGlassCard.left);
  }
});
