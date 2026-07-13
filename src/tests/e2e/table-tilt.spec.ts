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
  await expect(svg.getByText("Near stripe")).toBeVisible();
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
