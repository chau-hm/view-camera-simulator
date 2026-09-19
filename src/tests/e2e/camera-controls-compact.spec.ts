import { expect, test } from "@playwright/test";

test("compact common camera controls stay usable at desktop and narrow widths", async ({ page }) => {
  for (const viewport of [
    { width: 1280, height: 800 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/simulator/free/architecture-foreground");

    const controls = page.getByRole("region", { name: "Camera Controls" });
    await controls.scrollIntoViewIfNeeded();
    await expect(controls.getByRole("heading", { name: "Front standard" })).toBeVisible();

    const workspaceLayout = await page.locator(".simulator-body").evaluate((element) => {
      const styles = getComputedStyle(element);
      const main = element.querySelector<HTMLElement>(".simulator-main")?.getBoundingClientRect();
      const aside = element.querySelector<HTMLElement>(".simulator-aside")?.getBoundingClientRect();
      return {
        gridTemplateColumns: styles.gridTemplateColumns,
        gridTemplateRows: styles.gridTemplateRows,
        main,
        aside,
      };
    });
    expect(workspaceLayout.gridTemplateColumns.trim().split(/\s+/)).toHaveLength(2);
    expect(workspaceLayout.gridTemplateRows.trim().split(/\s+/)).toHaveLength(1);
    expect(workspaceLayout.main).not.toBeNull();
    expect(workspaceLayout.aside).not.toBeNull();
    expect(workspaceLayout.aside!.left).toBeGreaterThanOrEqual(workspaceLayout.main!.right - 1);
    expect(Math.abs(workspaceLayout.aside!.top - workspaceLayout.main!.top)).toBeLessThanOrEqual(1);

    const movement = controls.getByRole("region", { name: "Movement" });
    await expect(movement.getByRole("slider")).toHaveCount(3);
    await expect(movement.getByRole("slider", { name: /rear/i })).toHaveCount(0);

    const tilt = movement.getByRole("slider", { name: "Tilt" });
    await tilt.fill("3.2");
    await expect(tilt).toHaveValue("3.2");
    await expect(movement.locator(".compact-range-row").nth(1).locator(".compact-range-row__value")).toHaveText("3.2°");

    const aperture = controls.getByRole("radiogroup", { name: "Aperture" });
    await expect(aperture.getByRole("radio")).toHaveCount(6);
    await expect(aperture.getByRole("radio", { name: "f/16" })).toBeVisible();

    const railLayout = await controls.evaluate((element) => {
      const rail = element.getBoundingClientRect();
      return {
        right: rail.right,
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth,
      };
    });
    expect(railLayout.scrollWidth).toBeLessThanOrEqual(railLayout.clientWidth);

    const asideBounds = await page.locator(".simulator-aside").evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return { left: rect.left, right: rect.right };
    });
    const rects = await controls.locator(".compact-range-row, .aperture-control__option").evaluateAll(
      (elements) => elements.map((element) => {
        const rect = element.getBoundingClientRect();
        return { left: rect.left, right: rect.right };
      }),
    );
    expect(rects.every(({ left, right }) => left >= asideBounds.left - 1 && right <= asideBounds.right + 1)).toBe(true);
  }
});

test("responsive workspace keeps the primary simulator wider than the controls rail", async ({ page }) => {
  for (const { viewport, maxToolbarHeight } of [
    { viewport: { width: 1440, height: 900 }, maxToolbarHeight: 40 },
    { viewport: { width: 1280, height: 800 }, maxToolbarHeight: 40 },
    { viewport: { width: 1024, height: 768 }, maxToolbarHeight: 80 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/simulator/free/architecture-rise");
    await page.locator(".scene-toolbar").waitFor();

    const layout = await page.locator(".simulator-body").evaluate((element) => {
      const main = element.querySelector<HTMLElement>(".simulator-main")?.getBoundingClientRect();
      const aside = element.querySelector<HTMLElement>(".simulator-aside")?.getBoundingClientRect();
      const sceneToolbar = element.querySelector<HTMLElement>(".scene-toolbar")?.getBoundingClientRect();
      const groundGlassToolbar = element.querySelector<HTMLElement>(".groundglass-control-groups")?.getBoundingClientRect();
      if (!main || !aside || !sceneToolbar || !groundGlassToolbar) {
        throw new Error("Responsive workspace bounds unavailable");
      }
      return {
        mainWidth: main.width,
        asideWidth: aside.width,
        sceneToolbarHeight: sceneToolbar.height,
        groundGlassToolbarHeight: groundGlassToolbar.height,
      };
    });

    expect(layout.asideWidth).toBeLessThan(layout.mainWidth);
    expect(layout.asideWidth).toBeLessThan(viewport.width * 0.31);
    expect(layout.sceneToolbarHeight).toBeLessThanOrEqual(maxToolbarHeight);
    expect(layout.groundGlassToolbarHeight).toBeLessThanOrEqual(maxToolbarHeight);
  }
});

test("Macro Focus stays in the lower controls rail at landscape widths", async ({ page }) => {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1024, height: 768 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/simulator/free/macro-bellows-extension");

    const macro = page.getByRole("region", { name: "Macro focus" });
    await expect(macro).toBeVisible();
    await expect(page.getByRole("region", { name: "Camera Controls" })).toBeVisible();

    const placement = await page.evaluate(() => {
      const macro = document.querySelector<HTMLElement>(".macro-focus-readout");
      const aside = document.querySelector<HTMLElement>(".simulator-aside");
      const scroll = document.querySelector<HTMLElement>(".simulator-aside__scroll");
      const metricGrid = macro?.querySelector<HTMLElement>("dl");
      if (!macro || !aside || !scroll || !metricGrid) {
        throw new Error("Macro Focus placement unavailable");
      }
      const macroBounds = macro.getBoundingClientRect();
      const asideBounds = aside.getBoundingClientRect();
      const scrollBounds = scroll.getBoundingClientRect();
      return {
        insideAside: Boolean(macro.closest(".simulator-aside")),
        macroTop: macroBounds.top,
        macroBottom: macroBounds.bottom,
        asideBottom: asideBounds.bottom,
        scrollBottom: scrollBounds.bottom,
        scrollOverflowY: getComputedStyle(scroll).overflowY,
        macroScrollWidth: macro.scrollWidth,
        macroClientWidth: macro.clientWidth,
        metricColumns: getComputedStyle(metricGrid).gridTemplateColumns.trim().split(/\s+/),
      };
    });

    expect(placement.insideAside).toBe(true);
    expect(placement.macroTop).toBeGreaterThan(placement.scrollBottom);
    expect(placement.macroBottom).toBeLessThanOrEqual(placement.asideBottom + 1);
    expect(placement.scrollOverflowY).toBe("auto");
    expect(placement.macroScrollWidth).toBeLessThanOrEqual(placement.macroClientWidth);
    expect(placement.metricColumns).toHaveLength(2);
  }
});
