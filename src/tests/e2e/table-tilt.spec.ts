import { expect, test } from "@playwright/test";

const tableTiltCard = (page: import("@playwright/test").Page) =>
  page
    .getByRole("article")
    .filter({ has: page.getByRole("heading", { name: "Table Tilt" }) });

const setRangeValue = async (
  page: import("@playwright/test").Page,
  label: string,
  target: number,
) => {
  const slider = page.getByLabel(label);
  const current = Number(await slider.inputValue());
  const step = Number((await slider.getAttribute("step")) ?? "1");
  const direction = target >= current ? "ArrowRight" : "ArrowLeft";
  const coarseStep = step * 10;
  const coarsePresses = Math.floor(Math.abs(target - current) / coarseStep);
  for (let index = 0; index < coarsePresses; index += 1) {
    await slider.press(`Shift+${direction}`);
  }
  const afterCoarse = Number(await slider.inputValue());
  const finePresses = Math.round(Math.abs(target - afterCoarse) / step);
  for (let index = 0; index < finePresses; index += 1) {
    await slider.press(direction);
  }
};

const setRangeDirect = async (
  page: import("@playwright/test").Page,
  label: string,
  target: number,
) => {
  await page.getByLabel(label).evaluate((element, value) => {
    const input = element as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    if (!setter) throw new Error("Range input value setter unavailable");
    setter.call(input, String(value));
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }, target);
};

const readPointScores = async (page: import("@playwright/test").Page) =>
  Object.fromEntries(
    await Promise.all(
      ["near-cup", "mid-notebook", "far-book"].map(async (id) => [
        id,
        Number(
          await page
            .getByRole("progressbar", { name: `${id} sharpness` })
            .getAttribute("aria-valuenow"),
        ),
      ] as const),
    ),
  );

test("Table Tilt card exposes free and guided navigation", async ({ page }) => {
  await page.goto("/scenes");
  const card = tableTiltCard(page);
  await expect(card).toBeVisible();
  await expect(card.getByRole("link", { name: "Open Scene" })).toHaveAttribute(
    "href",
    "/simulator/free/table-tilt",
  );
  await expect(card.getByRole("link", { name: "Start Guided Task" })).toHaveAttribute(
    "href",
    "/simulator/guided/table-tilt/tilt-01",
  );

  await card.getByRole("link", { name: "Start Guided Task" }).click();
  await expect(page).toHaveURL(/\/simulator\/guided\/table-tilt\/tilt-01$/);
  await expect(page.getByText("Align tabletop focus with tilt")).toBeVisible();
});

test("Table Tilt Ground Glass uses one RTT surface and no legacy artifacts", async ({ page }) => {
  await page.goto("/simulator/free/table-tilt");
  const viewport = page.getByLabel("GroundGlassViewport");
  await expect(viewport).toBeVisible();
  await expect(viewport.getByTestId("ground-glass-rtt")).toHaveCount(1);
  await expect(viewport.getByTestId("ground-glass-scene")).toHaveCount(0);
  await expect(viewport.getByTestId("ground-glass-focus-ring")).toHaveCount(0);
  await expect(viewport.locator('[data-testid^="ground-glass-target-"]')).toHaveCount(0);

  const focusAssist = page.getByLabel("Focus Assist");
  await expect(focusAssist).not.toBeChecked();
  await focusAssist.check();
  await expect(focusAssist).toBeChecked();
  await expect(viewport.getByTestId("ground-glass-focus-ring")).toHaveCount(0);
});

test("Table Tilt zero-tilt point focus moves from near to middle to far", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/simulator/free/table-tilt");
  await setRangeDirect(page, "Tilt", 0);
  await page.getByRole("combobox", { name: "Aperture" }).selectOption("11");
  await expect(page.getByRole("heading", { name: /Focus targets · Point focus/i })).toBeVisible();
  await expect(page.getByText(/Without tilt, focus can move from near to far/)).toBeVisible();

  const focusCases = [
    { focus: 3150, expected: "near-cup" },
    { focus: 4600, expected: "mid-notebook" },
    { focus: 5900, expected: "far-book" },
  ] as const;

  for (const focusCase of focusCases) {
    await setRangeDirect(page, "Focus distance", focusCase.focus);
    await expect
      .poll(async () => (await readPointScores(page))[focusCase.expected])
      .toBeGreaterThanOrEqual(95);
    const scores = await readPointScores(page);
    expect(scores[focusCase.expected]).toBe(Math.max(...Object.values(scores)));
    expect(Object.values(scores).filter((score) => score >= 80)).toHaveLength(1);
    const canvas = page.getByTestId("ground-glass-rtt").locator("canvas");
    await expect(canvas).toBeVisible();
    expect((await canvas.screenshot()).byteLength).toBeGreaterThan(5_000);
  }

  await setRangeDirect(page, "Tilt", 9);
  await setRangeDirect(page, "Focus distance", 6050);
  await setRangeDirect(page, "Tilt", 0);
  await setRangeDirect(page, "Focus distance", 4600);
  await expect.poll(async () => (await readPointScores(page))["mid-notebook"]).toBeGreaterThanOrEqual(95);
  await expect(page.getByTestId("ground-glass-rtt").locator("canvas")).toBeVisible();
});

test("Table Tilt raw and final RTT diagnostics contain scene pixels before and after refocus", async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto("/simulator/free/table-tilt?rttDiagnostics=1");
  const rtt = page.getByTestId("ground-glass-rtt");
  const expectContent = async () => {
    await expect(rtt).toHaveAttribute("data-rtt-camera-ok", "true", { timeout: 120_000 });
    await expect(rtt).toHaveAttribute("data-rtt-depth-available", "true");
    await expect(rtt).toHaveAttribute("data-rtt-uniforms-finite", "true");
    await expect(rtt).toHaveAttribute("data-rtt-dof-mode", "derived-planes");
    await expect(rtt).toHaveAttribute("data-rtt-raw-contentful", "true");
    await expect(rtt).toHaveAttribute("data-rtt-final-contentful", "true");
    expect(Number(await rtt.getAttribute("data-rtt-raw-variance"))).toBeGreaterThan(4);
    expect(Number(await rtt.getAttribute("data-rtt-final-variance"))).toBeGreaterThan(4);
    expect(Number(await rtt.getAttribute("data-rtt-raw-non-background"))).toBeGreaterThan(0);
    expect(Number(await rtt.getAttribute("data-rtt-final-non-background"))).toBeGreaterThan(0);
  };

  await expectContent();
  const initialStateKey = await rtt.getAttribute("data-rtt-sanity-state");
  const initialGeneration = await rtt.getAttribute("data-rtt-resource-generation");
  await page.getByLabel("Focus distance").evaluate((element) => {
    const input = element as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    if (!setter) throw new Error("Range input value setter unavailable");
    for (const value of [3200, 4600, 5900]) {
      setter.call(input, String(value));
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }
  });
  await expect.poll(() => page.getByLabel("Focus distance").inputValue()).toBe("5900");
  await expect.poll(() => rtt.getAttribute("data-rtt-sanity-state"), { timeout: 120_000 }).not.toBe(initialStateKey);
  await expectContent();
  expect(await rtt.getAttribute("data-rtt-resource-generation")).toBe(initialGeneration);
});

test("Table Tilt RTT survives focus, preview, zoom, quality, and tilt resource stress", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/simulator/free/table-tilt");
  const viewport = page.getByLabel("GroundGlassViewport");
  const rtt = viewport.getByTestId("ground-glass-rtt");
  const stage = viewport.getByRole("button");
  const assertLiveCanvas = async () => {
    const canvas = rtt.locator("canvas");
    await expect(canvas).toBeVisible();
    const state = await canvas.evaluate((element) => {
      const surface = element as HTMLCanvasElement;
      const context = surface.getContext("webgl2") ?? surface.getContext("webgl");
      return {
        width: surface.width,
        height: surface.height,
        contextLost: context?.isContextLost() ?? true,
      };
    });
    expect(state.width).toBeGreaterThan(0);
    expect(state.height).toBeGreaterThan(0);
    expect(state.contextLost).toBe(false);
    expect((await canvas.screenshot()).byteLength).toBeGreaterThan(5_000);
  };

  for (const focus of [3200, 4600, 5900, 6050]) {
    await setRangeDirect(page, "Focus distance", focus);
    await assertLiveCanvas();
  }
  await page.getByText("Upright Assist").click();
  await assertLiveCanvas();
  await page.getByText("Raw Ground Glass").click();
  await assertLiveCanvas();
  await page.getByText("Raw RTT — bypass DOF").click();
  await assertLiveCanvas();
  await page.getByText("Raw RTT — bypass DOF").click();
  await assertLiveCanvas();

  await stage.click({ position: { x: 110, y: 100 } });
  await expect(stage).toHaveAttribute("data-zoomed", "true");
  const box = await stage.boundingBox();
  if (!box) throw new Error("Ground Glass stage bounding box not found");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 25, box.y + box.height / 2 + 15);
  await page.mouse.up();
  await assertLiveCanvas();
  await stage.click({ position: { x: box.width / 2, y: box.height / 2 } });
  await expect(stage).toHaveAttribute("data-zoomed", "false");
  await assertLiveCanvas();

  await page.getByRole("combobox", { name: "Render quality" }).selectOption("low");
  await assertLiveCanvas();
  await setRangeDirect(page, "Tilt", 9);
  await assertLiveCanvas();
  await setRangeDirect(page, "Tilt", 0);
  await page.getByRole("combobox", { name: "Render quality" }).selectOption("high");
  await assertLiveCanvas();
});

test("Table Tilt calibrated controls complete the guided task", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto("/simulator/guided/table-tilt/tilt-01");
  await expect(page.getByRole("heading", { name: "Task completed" })).not.toBeVisible();

  await setRangeValue(page, "Tilt", 9);
  await setRangeValue(page, "Focus distance", 6054);
  await page.getByRole("combobox", { name: "Aperture" }).selectOption("11");

  await expect(page.getByRole("heading", { name: "Task completed" })).toBeVisible();
  await expect(page.getByText(/Positive front tilt aligned/)).toBeVisible();

  const sceneCanvas = page.getByTestId("scene-canvas");
  for (const attribute of [
    "data-focus-overlay-vertices",
    "data-near-dof-overlay-vertices",
    "data-far-dof-overlay-vertices",
  ]) {
    await expect.poll(async () => Number(await sceneCanvas.getAttribute(attribute))).toBeGreaterThanOrEqual(4);
  }
});

test("Table Tilt focus and DOF overlays stay renderable at 9 degrees and 5780 mm", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto("/simulator/free/table-tilt");
  await setRangeValue(page, "Tilt", 9);
  await setRangeValue(page, "Focus distance", 5780);
  await page.getByRole("combobox", { name: "Aperture" }).selectOption("11");

  const sceneCanvas = page.getByTestId("scene-canvas");
  for (const attribute of [
    "data-focus-overlay-vertices",
    "data-near-dof-overlay-vertices",
    "data-far-dof-overlay-vertices",
  ]) {
    await expect.poll(async () => Number(await sceneCanvas.getAttribute(attribute))).toBeGreaterThanOrEqual(4);
  }
});

test("Table Tilt calibrated side geometry keeps the table, targets, focus, and DOF readable", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto("/simulator/free/table-tilt");
  await setRangeValue(page, "Tilt", 9);
  await setRangeValue(page, "Focus distance", 6054);
  await page.getByRole("combobox", { name: "Aperture" }).selectOption("11");
  await page.getByRole("button", { name: "Open 2D Geometry" }).click();

  const svg = page.getByTestId("geometry-svg-side");
  const svgBox = await svg.boundingBox();
  const focusBox = await svg.getByTestId("plane-line-focus").boundingBox();
  const dofBox = await svg.getByTestId("dof-region").boundingBox();
  const tabletopBox = await svg.getByTestId("tabletop-guide").boundingBox();
  if (!svgBox || !focusBox || !dofBox || !tabletopBox) {
    throw new Error("Table Tilt geometry primitives were not measurable");
  }

  expect(focusBox.width).toBeGreaterThan(svgBox.width * 0.45);
  expect(focusBox.height).toBeLessThanOrEqual(3);
  expect(dofBox.height).toBeLessThan(svgBox.height * 0.35);
  expect(tabletopBox.width).toBeGreaterThan(svgBox.width * 0.35);

  const targetCenters: number[] = [];
  for (const id of ["near-cup", "mid-notebook", "far-book"]) {
    const targetBox = await svg.getByTestId(`geometry-target-${id}`).boundingBox();
    if (!targetBox) throw new Error(`Missing geometry target ${id}`);
    targetCenters.push(targetBox.x + targetBox.width / 2);
  }
  expect(targetCenters[1] - targetCenters[0]).toBeGreaterThan(40);
  expect(targetCenters[2] - targetCenters[1]).toBeGreaterThan(40);
  await expect(svg.getByText("Near card")).toBeVisible();
  await expect(svg.getByText("Middle lines")).toBeVisible();
  await expect(svg.getByText("Far chart")).toBeVisible();
  const focusLabelBox = await svg.getByText("Focus plane").boundingBox();
  const farLabelBox = await svg.getByText("Far chart").boundingBox();
  if (!focusLabelBox || !farLabelBox) throw new Error("Geometry labels were not measurable");
  const labelsOverlap = !(
    focusLabelBox.x + focusLabelBox.width <= farLabelBox.x ||
    farLabelBox.x + farLabelBox.width <= focusLabelBox.x ||
    focusLabelBox.y + focusLabelBox.height <= farLabelBox.y ||
    farLabelBox.y + farLabelBox.height <= focusLabelBox.y
  );
  expect(labelsOverlap).toBe(false);
});

test("Table Tilt exposes the 3D and perpendicular Scheimpflug construction", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto("/simulator/free/table-tilt");
  const sceneCanvas = page.getByTestId("scene-canvas");
  const zeroTiltNormal = await sceneCanvas.getAttribute("data-lens-plane-normal");
  await setRangeValue(page, "Tilt", 9);
  await setRangeValue(page, "Focus distance", 6054);
  await expect.poll(() => sceneCanvas.getAttribute("data-lens-plane-normal")).not.toBe(zeroTiltNormal);

  await page.getByRole("button", { name: "Hide DOF region" }).click();
  await expect(sceneCanvas).toHaveAttribute("data-dof-overlay-visible", "false");
  await page.getByRole("button", { name: "Show Scheimpflug construction" }).click();
  await expect(sceneCanvas).toHaveAttribute(
    "data-scheimpflug-construction",
    "true",
  );
  for (const attribute of [
    "data-scheimpflug-film-vertices",
    "data-scheimpflug-lens-vertices",
    "data-scheimpflug-focus-vertices",
  ]) {
    await expect.poll(async () => Number(await sceneCanvas.getAttribute(attribute))).toBeGreaterThanOrEqual(3);
  }
  await expect(sceneCanvas).toHaveAttribute("data-scheimpflug-line-points", "2");
  await expect(sceneCanvas).toHaveAttribute("data-dof-overlay-visible", "false");
  await expect(page.getByTestId("scheimpflug-construction-note")).toContainText(
    "violet Scheimpflug line",
  );

  await page.getByRole("button", { name: "Open 2D Geometry" }).click();
  await page.getByRole("button", { name: "Scheimpflug Section", exact: true }).click();
  const section = page.getByTestId("geometry-svg-scheimpflug");
  await expect(section).toBeVisible();
  await expect(section.getByTestId("scheimpflug-intersection")).toBeVisible();
  await expect(section.getByText("Film plane (extended)")).toBeVisible();
  await expect(section.getByText("Lens plane (extended)")).toBeVisible();
  await expect(section.getByText("Plane of sharp focus (extended)")).toBeVisible();
  await expect(page.getByText("Film, lens and focus planes meet along one line. This section views that line end-on.")).toBeVisible();

  const concurrence = await section.evaluate((svg) => {
    const point = svg.querySelector('[data-testid="scheimpflug-intersection"] circle');
    if (!point) throw new Error("Missing Scheimpflug intersection point");
    const px = Number(point.getAttribute("cx"));
    const py = Number(point.getAttribute("cy"));
    return ["film", "lens", "focus"].map((id) => {
      const line = svg.querySelector(`[data-testid="plane-line-${id}"]`);
      if (!line) throw new Error(`Missing ${id} trace`);
      const x1 = Number(line.getAttribute("x1"));
      const y1 = Number(line.getAttribute("y1"));
      const x2 = Number(line.getAttribute("x2"));
      const y2 = Number(line.getAttribute("y2"));
      const denominator = Math.hypot(x2 - x1, y2 - y1);
      return Math.abs((x2 - x1) * (y1 - py) - (x1 - px) * (y2 - y1)) / denominator;
    });
  });
  concurrence.forEach((distance) => expect(distance).toBeLessThan(0.5));

  const geometryPanel = page.locator('section[data-geometry-fit]');
  await page.getByRole("button", { name: "Fit Construction" }).click();
  await expect(geometryPanel).toHaveAttribute("data-geometry-fit", "construction");
  await expect(section.getByTestId("scheimpflug-intersection")).toBeVisible();
  await page.getByRole("button", { name: "Fit Scene" }).click();
  await expect(geometryPanel).toHaveAttribute("data-geometry-fit", "scene");
});

test("Table Tilt RTT supports zoom, pan, and a mobile smoke viewport", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto("/simulator/free/table-tilt");
  const viewport = page.getByLabel("GroundGlassViewport");
  const stage = viewport.getByRole("button");
  const transformedLayer = viewport.locator(".groundglass-stage");
  const readTransform = () => transformedLayer.evaluate((element) => {
    const matrix = new DOMMatrixReadOnly(getComputedStyle(element).transform);
    return { x: matrix.m41, y: matrix.m42, scale: matrix.a };
  });
  await expect(viewport.getByTestId("ground-glass-rtt")).toBeVisible();
  await expect(stage).toHaveAttribute("data-zoomed", "false");

  await stage.click({ position: { x: 100, y: 100 } });
  await expect(stage).toHaveAttribute("data-zoomed", "true");
  const box = await stage.boundingBox();
  if (!box) throw new Error("Ground Glass stage bounding box not found");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 30, box.y + box.height / 2 + 20, {
    steps: 4,
  });
  await page.mouse.up();
  await expect(stage).toHaveAttribute("data-zoomed", "true");

  const panned = await readTransform();
  expect(Math.abs(panned.x)).toBeLessThanOrEqual((box.width * (panned.scale - 1)) / 2 + 1);
  expect(Math.abs(panned.y)).toBeLessThanOrEqual((box.height * (panned.scale - 1)) / 2 + 1);

  // Regression: after a drag, the next deliberate activation must zoom out
  // instead of being swallowed by stale drag-click suppression.
  await stage.click({ position: { x: box.width / 2, y: box.height / 2 } });
  await expect(stage).toHaveAttribute("data-zoomed", "false");
  await expect.poll(async () => {
    const value = await readTransform();
    return Math.abs(value.x) <= 0.5 && Math.abs(value.y) <= 0.5 && Math.abs(value.scale - 1) <= 0.01;
  }).toBe(true);

  // A fresh off-centre zoom starts from a valid anchor, and zooming out again
  // always returns to an identity transform.
  await stage.click({ position: { x: box.width * 0.8, y: box.height * 0.7 } });
  await expect(stage).toHaveAttribute("data-zoomed", "true");
  const rezoomed = await readTransform();
  expect(rezoomed.x).toBeLessThan(0);
  expect(rezoomed.y).toBeLessThan(0);
  await stage.click({ position: { x: box.width / 2, y: box.height / 2 } });
  await expect(stage).toHaveAttribute("data-zoomed", "false");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(page.getByLabel("GroundGlassViewport").getByTestId("ground-glass-rtt")).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "Ground Glass" })).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(2);
});
