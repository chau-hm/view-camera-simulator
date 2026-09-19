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

test("camera control rows keep useful rendered tracks across rail widths", async ({ page }) => {
  test.setTimeout(120_000);
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1280, height: 800 },
    { width: 1133, height: 800 },
    { width: 1024, height: 768 },
    { width: 860, height: 768 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/simulator/free/architecture-foreground");

    const controls = page.getByRole("region", { name: "Camera Controls" });
    const rail = page.locator(".simulator-aside__scroll");
    await expect(controls).toBeVisible();
    await expect(controls.getByRole("slider", { name: "Rise" })).toBeEnabled();
    await expect(controls.getByRole("slider", { name: "Tilt" })).toBeEnabled();
    await expect(controls.getByRole("slider", { name: "Swing" })).toBeVisible();

    const railBounds = await rail.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return {
        left: rect.left,
        right: rect.right,
        width: rect.width,
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth,
      };
    });
    const minimumUsefulTrackWidth = Math.min(160, railBounds.width * 0.6);
    const rows = await controls.locator(".movement-controls__rows .compact-range-row").evaluateAll(
      (elements) => elements.map((element) => {
        const row = element.getBoundingClientRect();
        const label = element.querySelector<HTMLElement>(".compact-range-row__label")?.getBoundingClientRect();
        const slider = element.querySelector<HTMLInputElement>(".compact-range-row__slider")?.getBoundingClientRect();
        const value = element.querySelector<HTMLElement>(".compact-range-row__value")?.getBoundingClientRect();
        if (!label || !slider || !value) throw new Error("Movement control bounds unavailable");
        return {
          row: { left: row.left, right: row.right, width: row.width },
          label: { width: label.width },
          slider: { left: slider.left, right: slider.right, width: slider.width },
          value: { left: value.left, right: value.right, width: value.width },
        };
      }),
    );

    expect(rows).toHaveLength(3);
    expect(railBounds.scrollWidth).toBeLessThanOrEqual(railBounds.clientWidth + 1);
    for (const row of rows) {
      expect(row.row.right).toBeLessThanOrEqual(railBounds.right + 1);
      expect(row.label.width).toBeGreaterThan(0);
      expect(row.value.width).toBeGreaterThan(0);
      expect(row.slider.left).toBeGreaterThanOrEqual(railBounds.left - 1);
      expect(row.slider.right).toBeLessThanOrEqual(railBounds.right + 1);
      expect(row.slider.width).toBeGreaterThanOrEqual(minimumUsefulTrackWidth);
    }

    const tilt = controls.getByRole("slider", { name: "Tilt" });
    const tiltBefore = await tilt.inputValue();
    await tilt.focus();
    await tilt.press("ArrowRight");
    await expect(tilt).not.toHaveValue(tiltBefore);

    const aperture = controls.getByRole("radiogroup", { name: "Aperture" });
    await expect(aperture.getByRole("radio")).toHaveCount(6);
    const apertureOptions = await aperture.locator(".aperture-control__option").evaluateAll(
      (elements) => elements.map((element) => {
        const rect = element.getBoundingClientRect();
        return { left: rect.left, right: rect.right, width: rect.width };
      }),
    );
    expect(Math.min(...apertureOptions.map((option) => option.width))).toBeGreaterThanOrEqual(48);
    expect(apertureOptions.every(({ left, right }) => left >= railBounds.left - 1 && right <= railBounds.right + 1)).toBe(true);
  }
});

test("Focus slider and Infinity Reset stay usable in a narrow rail", async ({ page }) => {
  test.setTimeout(120_000);
  for (const viewport of [
    { width: 1133, height: 800 },
    { width: 1024, height: 768 },
    { width: 860, height: 768 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/simulator/free/architecture-rise");

    const controls = page.getByRole("region", { name: "Camera Controls" });
    const rail = page.locator(".simulator-aside__scroll");
    const focus = controls.getByRole("slider", { name: "Focus distance" });
    const infinityReset = controls.getByRole("button", { name: "Infinity Reset" });
    await expect(focus).toBeVisible();
    await expect(infinityReset).toBeVisible();

    const layout = await rail.evaluate((element) => {
      const railRect = element.getBoundingClientRect();
      const row = element.querySelector<HTMLElement>(".focus-control .compact-range-row");
      const slider = row?.querySelector<HTMLInputElement>(".compact-range-row__slider");
      const value = row?.querySelector<HTMLElement>(".compact-range-row__value");
      const trailing = row?.querySelector<HTMLElement>(".compact-range-row__trailing");
      if (!row || !slider || !value || !trailing) throw new Error("Focus control bounds unavailable");
      const rowRect = row.getBoundingClientRect();
      const sliderRect = slider.getBoundingClientRect();
      const valueRect = value.getBoundingClientRect();
      const trailingRect = trailing.getBoundingClientRect();
      return {
        rail: { left: railRect.left, right: railRect.right, width: railRect.width },
        row: { right: rowRect.right, scrollWidth: row.scrollWidth, clientWidth: row.clientWidth },
        slider: { left: sliderRect.left, right: sliderRect.right, width: sliderRect.width },
        value: { left: valueRect.left, right: valueRect.right },
        trailing: { left: trailingRect.left, right: trailingRect.right, width: trailingRect.width },
      };
    });
    const minimumUsefulTrackWidth = Math.min(160, layout.rail.width * 0.6);

    expect(layout.row.right).toBeLessThanOrEqual(layout.rail.right + 1);
    expect(layout.row.scrollWidth).toBeLessThanOrEqual(layout.row.clientWidth + 1);
    expect(layout.slider.left).toBeGreaterThanOrEqual(layout.rail.left - 1);
    expect(layout.slider.right).toBeLessThanOrEqual(layout.rail.right + 1);
    expect(layout.slider.width).toBeGreaterThanOrEqual(minimumUsefulTrackWidth);
    expect(layout.value.right).toBeLessThanOrEqual(layout.trailing.left);
    expect(layout.trailing.width).toBeGreaterThan(0);

    const focusBefore = await focus.inputValue();
    await focus.focus();
    await focus.press("ArrowRight");
    await expect(focus).not.toHaveValue(focusBefore);
    await infinityReset.focus();
    await expect(infinityReset).toBeFocused();
    await infinityReset.press("Enter");
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
