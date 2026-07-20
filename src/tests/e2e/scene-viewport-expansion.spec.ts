import { expect, test } from "@playwright/test";

test("simulator viewports expand in main without replacing their active canvases", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto("/simulator/free/architecture-rise");

  const sceneRenderer = page.getByTestId("scene-canvas");
  await expect(sceneRenderer.locator("canvas")).toHaveCount(1);
  const originalRenderer = await sceneRenderer.elementHandle();
  expect(originalRenderer).toBeTruthy();
  const originalCameraPosition = await sceneRenderer.getAttribute("data-observer-camera-position");
  const originalOrbitTarget = await sceneRenderer.getAttribute("data-orbit-target");

  const readExpandedLayout = (activeViewportSelector: string) => page.evaluate((selector) => {
    const main = document.querySelector<HTMLElement>(".simulator-main");
    const aside = document.querySelector<HTMLElement>(".simulator-aside");
    const card = document.querySelector<HTMLElement>(".simulator-card--expanded");
    const renderer = document.querySelector<HTMLElement>(selector);
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
  }, activeViewportSelector);

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

    const expandedLayout = await readExpandedLayout('[data-testid="scene-canvas"]');
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

  await page.getByRole("button", { name: "Expand 3D Scene" }).click();
  const overlayMenu = page.getByRole("button", { name: "View overlays" });
  await overlayMenu.click();
  await expect(overlayMenu).toHaveAttribute("aria-expanded", "true");
  const overlayChoice = page.getByRole("button", { name: "Hide Focus plane" });
  await overlayChoice.focus();
  await page.keyboard.press("Escape");
  await expect(overlayMenu).toHaveAttribute("aria-expanded", "false");
  await expect(overlayMenu).toBeFocused();
  await expect(page.getByRole("button", { name: "Restore 3D Scene" })).toBeVisible();
  await expect(sceneRenderer).toHaveCount(1);
  await expect(sceneRenderer.locator("canvas")).toHaveCount(1);
  expect(
    await page.evaluate(
      (node) => node === document.querySelector('[data-testid="scene-canvas"]'),
      originalRenderer,
    ),
  ).toBe(true);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Expand 3D Scene" })).toBeFocused();

  await page.getByRole("button", { name: "Expand 3D Scene" }).click();
  await page.getByRole("button", { name: "Help" }).click();
  await expect(page.getByRole("dialog", { name: "Movement help" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Close help" })).toBeFocused();
  await page.getByLabel("Tilt").focus();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Movement help" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Help" })).toBeFocused();
  await expect(page.getByRole("button", { name: "Restore 3D Scene" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Camera Controls" })).toBeVisible();
  await expect(sceneRenderer).toHaveCount(1);
  expect(
    await page.evaluate(
      (node) => node === document.querySelector('[data-testid="scene-canvas"]'),
      originalRenderer,
    ),
  ).toBe(true);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Expand 3D Scene" })).toBeFocused();

  const groundGlassRenderer = page.getByTestId("ground-glass-rtt");
  await expect(groundGlassRenderer.locator("canvas")).toHaveCount(1);
  await expect(groundGlassRenderer).toHaveAttribute("data-rtt-resource-generation", /\d+/);
  const originalGroundGlassRenderer = await groundGlassRenderer.elementHandle();
  const originalGroundGlassCanvas = await groundGlassRenderer.locator("canvas").elementHandle();
  const originalResourceGeneration = await groundGlassRenderer.getAttribute("data-rtt-resource-generation");
  expect(originalGroundGlassRenderer).toBeTruthy();
  expect(originalGroundGlassCanvas).toBeTruthy();

  await page.getByRole("button", { name: "Expand Ground Glass" }).click();
  await expect(page.getByRole("button", { name: "Restore Ground Glass" })).toBeFocused();
  await expect(page.getByTestId("scene-canvas")).toHaveCount(0);
  await expect(groundGlassRenderer).toHaveCount(1);
  await expect(groundGlassRenderer.locator("canvas")).toHaveCount(1);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Camera Controls" })).toBeVisible();
  expect(
    await page.evaluate(
      (node) => node === document.querySelector('[data-testid="ground-glass-rtt"]'),
      originalGroundGlassRenderer,
    ),
  ).toBe(true);
  expect(
    await page.evaluate(
      (node) => node === document.querySelector('[data-testid="ground-glass-rtt"] canvas'),
      originalGroundGlassCanvas,
    ),
  ).toBe(true);
  await expect(groundGlassRenderer).toHaveAttribute(
    "data-rtt-resource-generation",
    originalResourceGeneration ?? "",
  );

  const groundGlassLayout = await readExpandedLayout(".groundglass-renderer-host--expanded");
  expect(groundGlassLayout.card.left).toBeGreaterThanOrEqual(groundGlassLayout.main.left - 1);
  expect(groundGlassLayout.card.right).toBeLessThanOrEqual(groundGlassLayout.main.right + 1);
  expect(groundGlassLayout.card.right).toBeLessThan(groundGlassLayout.aside.left);
  expect(groundGlassLayout.renderer.width).toBeGreaterThan(0);
  expect(groundGlassLayout.renderer.height).toBeGreaterThan(0);
  expect(groundGlassLayout.renderer.width / groundGlassLayout.renderer.height).toBeCloseTo(5 / 4, 2);
  expect(groundGlassLayout.mainOverflowY).toBe("hidden");
  expect(groundGlassLayout.aside.overflowY).toBe("auto");

  const tilt = page.getByLabel("Tilt");
  const tiltBefore = await tilt.inputValue();
  await tilt.press("ArrowRight");
  await expect(tilt).not.toHaveValue(tiltBefore);

  await page.getByRole("button", { name: "Zoom in Ground Glass view" }).click();
  const zoomedGroundGlass = page.getByRole("button", { name: "Zoom out Ground Glass" });
  await expect(zoomedGroundGlass).toHaveAttribute("data-zoomed", "true");
  await zoomedGroundGlass.focus();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Zoom in Ground Glass", exact: true })).toHaveAttribute(
    "data-zoomed",
    "false",
  );
  await expect(page.getByRole("button", { name: "Restore Ground Glass" })).toBeVisible();
  await expect(page.getByTestId("scene-canvas")).toHaveCount(0);
  await expect(groundGlassRenderer).toHaveCount(1);
  await expect(groundGlassRenderer.locator("canvas")).toHaveCount(1);
  expect(
    await page.evaluate(
      (node) => node === document.querySelector('[data-testid="ground-glass-rtt"]'),
      originalGroundGlassRenderer,
    ),
  ).toBe(true);

  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Expand Ground Glass" })).toBeFocused();
  await expect(page.getByTestId("scene-canvas")).toHaveCount(1);
  await expect(page.getByLabel("GroundGlassColumn")).toBeVisible();
  await expect(page.getByRole("region", { name: "Camera Controls" })).toBeVisible();
  expect(
    await page.evaluate(
      (node) => node === document.querySelector('[data-testid="ground-glass-rtt"]'),
      originalGroundGlassRenderer,
    ),
  ).toBe(true);
  expect(
    await page.evaluate(
      (node) => node === document.querySelector('[data-testid="ground-glass-rtt"] canvas'),
      originalGroundGlassCanvas,
    ),
  ).toBe(true);
});
