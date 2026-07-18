import { expect, test } from "@playwright/test";
import {
  clickStageAt,
  readFreshElementBounds,
  readStageTransform,
} from "./helpers/groundGlass";
import { setRangeDirect } from "./helpers/rangeInput";

const tableTiltCard = (page: import("@playwright/test").Page) =>
  page
    .getByRole("article")
    .filter({ has: page.getByRole("heading", { name: "Table Tilt" }) });

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

type ProjectedLine = { x1: number; y1: number; x2: number; y2: number };

const readProjectedLine = async (
  line: import("@playwright/test").Locator,
): Promise<ProjectedLine> =>
  line.evaluate((element) => {
    const coordinates = {
      x1: Number(element.getAttribute("x1")),
      y1: Number(element.getAttribute("y1")),
      x2: Number(element.getAttribute("x2")),
      y2: Number(element.getAttribute("y2")),
    };
    if (!Object.values(coordinates).every(Number.isFinite)) {
      throw new Error("Projected line contains non-finite coordinates");
    }
    return coordinates;
  });

const projectedSlope = (line: ProjectedLine) =>
  (line.y2 - line.y1) / (line.x2 - line.x1 || Number.EPSILON);

const expectProjectedCollinearity = async (
  physical: import("@playwright/test").Locator,
  trace: import("@playwright/test").Locator,
) => {
  const [physicalLine, traceLine] = await Promise.all([
    readProjectedLine(physical),
    readProjectedLine(trace),
  ]);
  const physicalVector = {
    x: physicalLine.x2 - physicalLine.x1,
    y: physicalLine.y2 - physicalLine.y1,
  };
  const traceVector = {
    x: traceLine.x2 - traceLine.x1,
    y: traceLine.y2 - traceLine.y1,
  };
  const denominator =
    Math.hypot(physicalVector.x, physicalVector.y) *
    Math.hypot(traceVector.x, traceVector.y);
  expect(denominator).toBeGreaterThan(0);
  const residual = Math.abs(
    physicalVector.x * traceVector.y - physicalVector.y * traceVector.x,
  ) / denominator;
  expect(residual).toBeLessThan(1e-8);
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
  await expect(page.getByText("Align the tabletop focus cards with tilt")).toBeVisible();
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
  const stage = viewport.getByRole("button", { name: /Ground Glass$/ });
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
  expect((await rtt.locator("canvas").screenshot()).byteLength).toBeGreaterThan(5_000);
});

test("Table Tilt calibrated controls complete the guided task", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto("/simulator/guided/table-tilt/tilt-01");
  await expect(page.getByRole("heading", { name: "Task completed" })).not.toBeVisible();

  await setRangeDirect(page, "Tilt", 9);
  await setRangeDirect(page, "Focus distance", 6054);
  await page.getByRole("combobox", { name: "Aperture" }).selectOption("11");

  await expect(page.getByRole("heading", { name: "Task completed" })).toBeVisible();
  await expect(page.getByText(/Positive front tilt made the plane of sharp focus parallel/)).toBeVisible();

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
  await setRangeDirect(page, "Tilt", 9);
  await setRangeDirect(page, "Focus distance", 5780);
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
  await setRangeDirect(page, "Tilt", 9);
  await setRangeDirect(page, "Focus distance", 6054);
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
  await expect(svg.getByText("Middle notebook")).toBeVisible();
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
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto("/simulator/free/table-tilt");
  const sceneCanvas = page.getByTestId("scene-canvas");
  const zeroTiltNormal = await sceneCanvas.getAttribute("data-lens-plane-normal");
  const overlayTrigger = page.getByRole("button", { name: "View overlays" });
  await expect(overlayTrigger).toBeVisible();
  await overlayTrigger.click();
  await expect(page.getByRole("button", { name: "Show Scheimpflug construction" })).toBeDisabled();
  await expect(sceneCanvas).toHaveAttribute("data-focus-overlay-visible", "true");
  await setRangeDirect(page, "Tilt", 9);
  await setRangeDirect(page, "Focus distance", 6054);
  await expect.poll(() => sceneCanvas.getAttribute("data-lens-plane-normal")).not.toBe(zeroTiltNormal);

  await expect(page.getByRole("button", { name: "Show Scheimpflug construction" })).toBeEnabled();
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

  const geometryTrigger = page.getByRole("button", { name: "Open 2D Geometry" });
  await geometryTrigger.click();
  await page.getByRole("button", { name: "Scheimpflug Section", exact: true }).click();
  const section = page.getByTestId("geometry-svg-scheimpflug");
  await expect(section).toBeVisible();
  await expect(section.getByTestId("scheimpflug-intersection")).toBeVisible();
  await expect(section.getByText("Film plane (extended)")).toBeVisible();
  await expect(section.getByText("Lens plane (extended)")).toBeVisible();
  await expect(section.getByText("Plane of sharp focus (extended)")).toBeVisible();
  await expect(section.getByTestId("generic-camera-glyphs")).toHaveCount(0);
  await expect(section.getByTestId("physical-film-segment")).toHaveCount(1);
  await expect.poll(() => section.getByTestId("physical-film-segment").evaluate((line) => {
    const x1 = Number(line.getAttribute("x1"));
    const y1 = Number(line.getAttribute("y1"));
    const x2 = Number(line.getAttribute("x2"));
    const y2 = Number(line.getAttribute("y2"));
    return Math.hypot(x2 - x1, y2 - y1);
  })).toBeGreaterThan(5);
  await expect(section.getByTestId("physical-lens-segment")).toBeVisible();
  await expect(section.getByTestId("physical-film-centre")).toBeVisible();
  await expect(section.getByTestId("physical-lens-centre")).toBeVisible();
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
  await expect(geometryPanel).toHaveAttribute("data-construction-layout", "split");
  await expect(geometryPanel).toHaveAttribute("data-camera-construction-visible", "true");
  await expect(geometryPanel).toHaveAttribute("data-subject-field-visible", "true");
  const cameraRegion = page.getByTestId("camera-construction-region");
  const subjectRegion = page.getByTestId("subject-field-region");
  await expect(cameraRegion.getByText("Camera-side Scheimpflug construction — enlarged")).toBeVisible();
  await expect(cameraRegion.getByText("Camera construction — enlarged", { exact: true })).toHaveCount(0);
  await expect(subjectRegion.getByText("Subject field")).toBeVisible();
  await expect(subjectRegion.getByText("Near card")).toBeVisible();
  await expect(subjectRegion.getByText("Middle notebook")).toBeVisible();
  await expect(subjectRegion.getByText("Far chart")).toBeVisible();
  await expect(subjectRegion.getByTestId("plane-line-focus")).toBeVisible();
  await expect(subjectRegion.getByTestId("geometry-target-near-cup")).toBeVisible();
  await expect(subjectRegion.getByTestId("geometry-target-mid-notebook")).toBeVisible();
  await expect(subjectRegion.getByTestId("geometry-target-far-book")).toBeVisible();
  await expect(cameraRegion.locator('[data-projection-linear="true"]')).toHaveAttribute("data-projection-linear", "true");
  await expect(subjectRegion.locator('[data-projection-linear="true"]')).toHaveAttribute("data-projection-linear", "true");
  await expect(section.getByTestId("scheimpflug-intersection")).toBeVisible();
  await page.getByRole("button", { name: "Fit Scene" }).click();
  await expect(geometryPanel).toHaveAttribute("data-geometry-fit", "scene");
  await page.getByRole("button", { name: "Close 2D Geometry" }).click();
  await expect(geometryTrigger).toBeFocused();

  // Returning to parallel standards makes the requested construction invalid,
  // but must restore the normal focus overlay and leave an enabled off action.
  await setRangeDirect(page, "Tilt", 0);
  await expect(sceneCanvas).toHaveAttribute("data-scheimpflug-construction", "false");
  await expect(sceneCanvas).toHaveAttribute("data-focus-overlay-visible", "true");
  await setRangeDirect(page, "Tilt", 9);
  await expect(sceneCanvas).toHaveAttribute("data-scheimpflug-construction", "true");
  await setRangeDirect(page, "Tilt", 0);
  await expect(sceneCanvas).toHaveAttribute("data-scheimpflug-construction", "false");
  await expect(sceneCanvas).toHaveAttribute("data-focus-overlay-visible", "true");
  await page.getByRole("button", { name: "View overlays" }).click();
  const hideConstruction = page.getByRole("button", { name: "Hide Scheimpflug construction" });
  await expect(hideConstruction).toBeEnabled();
  await hideConstruction.click();
  await expect(page.getByTestId("scheimpflug-construction-note")).toHaveCount(0);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(2);
});

test("2D Geometry keeps projected camera orientation and fit/view state coherent", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/simulator/free/table-tilt");
  await setRangeDirect(page, "Tilt", 0);
  await setRangeDirect(page, "Swing", 0);
  await page.getByRole("button", { name: "Open 2D Geometry" }).click();

  const geometryPanel = page.locator('section[data-geometry-fit]');
  const sideButton = page.getByRole("button", { name: "Side", exact: true });
  const topButton = page.getByRole("button", { name: "Top", exact: true });
  const sectionButton = page.getByRole("button", { name: "Scheimpflug Section", exact: true });
  const fitSceneButton = page.getByRole("button", { name: "Fit Scene" });
  const fitConstructionButton = page.getByRole("button", { name: "Fit Construction" });

  await expect(geometryPanel).toHaveAttribute("data-geometry-view", "side");
  await expect(geometryPanel).toHaveAttribute("data-geometry-fit", "scene");
  const sideSvg = page.getByTestId("geometry-svg-side");
  await expect(sideSvg.getByTestId("generic-camera-glyphs")).toHaveCount(0);
  const zeroTiltLens = await readProjectedLine(sideSvg.getByTestId("physical-lens-segment"));

  await setRangeDirect(page, "Tilt", 7);
  await expect.poll(async () => {
    const tiltedLens = await readProjectedLine(sideSvg.getByTestId("physical-lens-segment"));
    return Math.abs(projectedSlope(tiltedLens) - projectedSlope(zeroTiltLens));
  }).toBeGreaterThan(0.01);
  await expectProjectedCollinearity(
    sideSvg.getByTestId("physical-lens-segment"),
    sideSvg.getByTestId("plane-line-lens"),
  );

  await fitConstructionButton.click();
  await expect(sectionButton).toHaveAttribute("aria-pressed", "true");
  await expect(geometryPanel).toHaveAttribute("data-geometry-view", "scheimpflug");
  await expect(geometryPanel).toHaveAttribute("data-geometry-fit", "construction");
  await expect(geometryPanel).toHaveAttribute("data-construction-layout", "split");
  await expect(page.getByTestId("camera-construction-region")).toContainText(
    "Camera-side Scheimpflug construction — enlarged",
  );
  await expect(page.getByTestId("subject-field-region")).toContainText("Subject field");
  await expect(page.getByText("Camera construction — enlarged", { exact: true })).toHaveCount(0);

  await sideButton.click();
  await expect(sideButton).toHaveAttribute("aria-pressed", "true");
  await expect(geometryPanel).toHaveAttribute("data-geometry-view", "side");
  await expect(geometryPanel).toHaveAttribute("data-geometry-fit", "scene");
  await expect(geometryPanel).toHaveAttribute("data-construction-layout", "single");
  for (const targetId of ["near-cup", "mid-notebook", "far-book"]) {
    await expect(page.getByTestId(`geometry-target-${targetId}`)).toBeVisible();
  }

  await fitConstructionButton.click();
  await topButton.click();
  await expect(topButton).toHaveAttribute("aria-pressed", "true");
  await expect(geometryPanel).toHaveAttribute("data-geometry-view", "top");
  await expect(geometryPanel).toHaveAttribute("data-geometry-fit", "scene");
  await expect(geometryPanel).toHaveAttribute("data-construction-layout", "single");
  for (const targetId of ["near-cup", "mid-notebook", "far-book"]) {
    await expect(page.getByTestId(`geometry-target-${targetId}`)).toBeVisible();
  }

  await sectionButton.click();
  await expect(geometryPanel).toHaveAttribute("data-geometry-view", "scheimpflug");
  await expect(geometryPanel).toHaveAttribute("data-geometry-fit", "scene");
  await expect(geometryPanel).toHaveAttribute("data-construction-layout", "single");

  await fitConstructionButton.click();
  await fitSceneButton.click();
  await expect(sideButton).toHaveAttribute("aria-pressed", "true");
  await expect(geometryPanel).toHaveAttribute("data-geometry-view", "side");
  await expect(geometryPanel).toHaveAttribute("data-geometry-fit", "scene");
  const restoredSideSvg = page.getByTestId("geometry-svg-side");
  await expect(restoredSideSvg.getByText("Near card", { exact: true })).toBeVisible();
  await expect(restoredSideSvg.getByText("Middle notebook", { exact: true })).toBeVisible();
  await expect(restoredSideSvg.getByText("Far chart", { exact: true })).toBeVisible();

  await fitConstructionButton.click();
  await expect(geometryPanel).toHaveAttribute("data-construction-layout", "split");
  await setRangeDirect(page, "Tilt", 0);
  await expect(geometryPanel).toHaveAttribute("data-construction-layout", "single");
  await expect(geometryPanel).toHaveAttribute("data-geometry-view", "side");
  await expect(geometryPanel).toHaveAttribute("data-geometry-fit", "scene");
  await expect(fitSceneButton).toHaveAttribute("aria-pressed", "true");
  const fallbackFocusLine = page
    .getByTestId("geometry-svg-side")
    .getByTestId("plane-line-focus");
  await expect(fallbackFocusLine).toHaveCount(1);
  const fallbackFocus = await readProjectedLine(fallbackFocusLine);
  expect(
    Math.hypot(
      fallbackFocus.x2 - fallbackFocus.x1,
      fallbackFocus.y2 - fallbackFocus.y1,
    ),
  ).toBeGreaterThan(1);
  for (const targetId of ["near-cup", "mid-notebook", "far-book"]) {
    await expect(page.getByTestId(`geometry-target-${targetId}`)).toBeVisible();
  }
  await setRangeDirect(page, "Tilt", 7);
  await expect(geometryPanel).toHaveAttribute("data-geometry-view", "side");
  await expect(geometryPanel).toHaveAttribute("data-geometry-fit", "scene");
  await expect(geometryPanel).toHaveAttribute("data-construction-layout", "single");

  await topButton.click();
  await setRangeDirect(page, "Tilt", 0);
  const topSvg = page.getByTestId("geometry-svg-top");
  const zeroSwingLens = await readProjectedLine(topSvg.getByTestId("physical-lens-segment"));
  await setRangeDirect(page, "Swing", 5);
  await expect.poll(async () => {
    const swungLens = await readProjectedLine(topSvg.getByTestId("physical-lens-segment"));
    return Math.abs(projectedSlope(swungLens) - projectedSlope(zeroSwingLens));
  }).toBeGreaterThan(0.01);
  await expectProjectedCollinearity(
    topSvg.getByTestId("physical-lens-segment"),
    topSvg.getByTestId("plane-line-lens"),
  );
});

test("3D overlay controls switch responsively without wrapping or blocking the scene", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto("/simulator/free/table-tilt");
  const responsive = page.locator(".scene-overlay-responsive").first();
  const sceneShell = page.locator(".scene-viewport-shell");
  await expect(responsive).toHaveAttribute("data-overlay-presentation", "collapsed");
  const trigger = page.getByRole("button", { name: "View overlays" });
  await expect(trigger).toBeVisible();
  await trigger.click();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  const menu = page.getByTestId("scene-overlay-collapsed");
  await expect(menu).toBeVisible();
  const triggerBox = await trigger.boundingBox();
  const menuBox = await menu.boundingBox();
  const shellBox = await sceneShell.boundingBox();
  if (!triggerBox || !menuBox || !shellBox) throw new Error("Overlay menu bounds were unavailable");
  expect(menuBox.y).toBeGreaterThanOrEqual(triggerBox.y + triggerBox.height);
  expect(menuBox.x).toBeGreaterThanOrEqual(shellBox.x);
  expect(menuBox.x + menuBox.width).toBeLessThanOrEqual(shellBox.x + shellBox.width + 1);
  expect(menuBox.height).toBeLessThan(shellBox.height * 0.8);
  await page.getByRole("button", { name: "Show Legends" }).click();
  await expect(page.getByRole("button", { name: "Hide Legends" })).toBeVisible();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Escape");
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await expect(menu).toHaveCount(0);
  await expect(responsive).toHaveCSS("pointer-events", "none");
  await expect(trigger).toHaveCSS("pointer-events", "auto");

  await page.setViewportSize({ width: 1920, height: 1000 });
  await expect(responsive).toHaveAttribute("data-overlay-presentation", "inline");
  await expect(page.getByTestId("scene-overlay-inline")).toBeVisible();
  await expect(page.getByRole("button", { name: "View overlays" })).toHaveCount(0);
  const inline = page.getByTestId("scene-overlay-inline");
  const inlineButtons = inline.getByRole("button");
  const firstBox = await inlineButtons.first().boundingBox();
  const lastBox = await inlineButtons.last().boundingBox();
  if (!firstBox || !lastBox) throw new Error("Inline overlay controls were not measurable");
  expect(Math.abs(firstBox.y - lastBox.y)).toBeLessThan(2);
});

const groundGlassLocators = (page: import("@playwright/test").Page) => {
  const viewport = page.getByLabel("GroundGlassViewport");
  return {
    viewport,
    stage: viewport.getByRole("button", { name: /Ground Glass$/ }),
    transformedLayer: viewport.locator(".groundglass-stage"),
  };
};

const expectGroundGlassIdentity = async (
  stage: import("@playwright/test").Locator,
  transformedLayer: import("@playwright/test").Locator,
) => {
  await expect(stage).toHaveAttribute("data-zoomed", "false");
  await expect(stage).toHaveAttribute("data-pan-x", "0");
  await expect(stage).toHaveAttribute("data-pan-y", "0");
  await expect(stage).toHaveAttribute("data-scale", "1");
  await expect.poll(async () => {
    const transform = await readStageTransform(transformedLayer);
    return (
      Math.abs(transform.translateX) <= 0.5 &&
      Math.abs(transform.translateY) <= 0.5 &&
      Math.abs(transform.scaleX - 1) <= 0.01 &&
      Math.abs(transform.scaleY - 1) <= 0.01
    );
  }).toBe(true);
};

const zoomGroundGlassAt = async (
  page: import("@playwright/test").Page,
  stage: import("@playwright/test").Locator,
  xRatio = 0.25,
  yRatio = 0.25,
) => {
  const bounds = await clickStageAt(page, stage, xRatio, yRatio);
  await expect(stage).toHaveAttribute("data-zoomed", "true");
  return bounds;
};

const boxesOverlap = (
  first: Awaited<ReturnType<typeof readFreshElementBounds>>,
  second: Awaited<ReturnType<typeof readFreshElementBounds>>,
) => !(
  first.x + first.width <= second.x ||
  second.x + second.width <= first.x ||
  first.y + first.height <= second.y ||
  second.y + second.height <= first.y
);

test("Table Tilt Ground Glass zoom, pan, jitter, and reset stay deterministic", async ({ page }) => {
  test.setTimeout(150_000);
  await page.goto("/simulator/free/table-tilt");
  const { viewport, stage, transformedLayer } = groundGlassLocators(page);
  await expect(viewport.getByTestId("ground-glass-rtt")).toBeVisible();
  await expectGroundGlassIdentity(stage, transformedLayer);

  const bounds = await zoomGroundGlassAt(page, stage, 0.25, 0.25);
  const centerX = bounds.x + bounds.width / 2;
  const centerY = bounds.y + bounds.height / 2;
  await page.mouse.move(centerX, centerY);
  await page.mouse.down();
  await page.mouse.move(centerX + 30, centerY + 20, { steps: 4 });
  await page.mouse.up();
  await expect(stage).toHaveAttribute("data-zoomed", "true");
  const panned = await readStageTransform(transformedLayer);
  expect(Math.abs(panned.translateX)).toBeLessThanOrEqual(
    (bounds.width * (panned.scaleX - 1)) / 2 + 1,
  );
  expect(Math.abs(panned.translateY)).toBeLessThanOrEqual(
    (bounds.height * (panned.scaleY - 1)) / 2 + 1,
  );

  await page.mouse.move(centerX, centerY);
  await page.mouse.down();
  await page.mouse.move(centerX + 4, centerY + 3);
  await page.mouse.up();
  await expectGroundGlassIdentity(stage, transformedLayer);

  await zoomGroundGlassAt(page, stage, 0.8, 0.7);
  const rezoomed = await readStageTransform(transformedLayer);
  expect(rezoomed.translateX).toBeLessThan(0);
  expect(rezoomed.translateY).toBeLessThan(0);
  const freshBounds = await readFreshElementBounds(stage);
  const freshCenterX = freshBounds.x + freshBounds.width / 2;
  const freshCenterY = freshBounds.y + freshBounds.height / 2;
  await page.mouse.move(freshCenterX, freshCenterY);
  await page.mouse.down();
  await page.mouse.move(freshCenterX - 35, freshCenterY + 20, { steps: 4 });
  await page.mouse.up();
  await page.getByRole("button", { name: "Reset Ground Glass view" }).click();
  await expectGroundGlassIdentity(stage, transformedLayer);

  await zoomGroundGlassAt(page, stage);
  await page.keyboard.press("Escape");
  await expectGroundGlassIdentity(stage, transformedLayer);
});

test("Table Tilt Ground Glass recovers from interrupted pointer gestures", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/simulator/free/table-tilt");
  const { stage, transformedLayer } = groundGlassLocators(page);

  for (const [index, terminalEvent] of ["pointercancel", "lostpointercapture"].entries()) {
    const bounds = await zoomGroundGlassAt(page, stage);
    const start = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
    const pointerId = 91 + index;
    await stage.dispatchEvent("pointerdown", {
      pointerId,
      pointerType: "mouse",
      button: 0,
      clientX: start.x,
      clientY: start.y,
    });
    await stage.dispatchEvent("pointermove", {
      pointerId,
      pointerType: "mouse",
      clientX: start.x + 30,
      clientY: start.y + 20,
    });
    await stage.dispatchEvent(terminalEvent, { pointerId, pointerType: "mouse" });
    await expectGroundGlassIdentity(stage, transformedLayer);
    await expect(stage).toHaveAttribute("data-pointer-active", "false");
    await expect(stage).toHaveAttribute("data-pointer-captured", "false");
  }
});

test("Table Tilt Ground Glass survives optics, preview, and quality changes", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/simulator/free/table-tilt");
  const { viewport, stage, transformedLayer } = groundGlassLocators(page);
  const rtt = viewport.getByTestId("ground-glass-rtt");
  await expect(rtt).toBeVisible();

  await setRangeDirect(page, "Focus distance", 5000);
  await zoomGroundGlassAt(page, stage);
  await page.getByRole("button", { name: "Reset Ground Glass view" }).click();
  await expectGroundGlassIdentity(stage, transformedLayer);
  await expect(rtt).toBeVisible();

  await setRangeDirect(page, "Tilt", 3);
  await zoomGroundGlassAt(page, stage);
  await page.getByRole("button", { name: "Reset Ground Glass view" }).click();
  await expectGroundGlassIdentity(stage, transformedLayer);
  await expect(rtt).toBeVisible();

  await zoomGroundGlassAt(page, stage);
  await page.getByLabel("Upright Assist").check();
  await expectGroundGlassIdentity(stage, transformedLayer);
  await expect(rtt).toBeVisible();

  await zoomGroundGlassAt(page, stage);
  await page.getByLabel("Render quality").selectOption("low");
  await expect(stage).toHaveAttribute("data-zoomed", "true");
  await expect(rtt).toBeVisible();
  await page.getByRole("button", { name: "Reset Ground Glass view" }).click();
  await expectGroundGlassIdentity(stage, transformedLayer);
  await page.getByLabel("Raw Ground Glass").check();
  await expectGroundGlassIdentity(stage, transformedLayer);
  await expect(rtt).toBeVisible();
});

test("Table Tilt Ground Glass responsive overlays remain separate and centered", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/simulator/free/table-tilt");
  const { viewport, stage, transformedLayer } = groundGlassLocators(page);
  const viewControl = viewport.locator(".groundglass-view-control");
  const focusLabel = viewport.getByTestId("ground-glass-focus-label");

  await viewControl.focus();
  await viewControl.press("Enter");
  await expect(viewControl).toHaveAttribute("aria-label", "Reset Ground Glass view");
  expect(await viewControl.evaluate((element) => document.activeElement === element)).toBe(true);
  expect(
    boxesOverlap(
      await readFreshElementBounds(viewControl),
      await readFreshElementBounds(focusLabel),
    ),
  ).toBe(false);
  await viewControl.click();
  await expectGroundGlassIdentity(stage, transformedLayer);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(viewport.getByTestId("ground-glass-rtt")).toHaveCount(1);
  await expectGroundGlassIdentity(stage, transformedLayer);
  await expect(page.getByRole("heading", { name: "Ground Glass" })).toBeVisible();
  expect(
    boxesOverlap(
      await readFreshElementBounds(viewControl),
      await readFreshElementBounds(focusLabel),
    ),
  ).toBe(false);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(2);
});

test("Ground Glass zoom state resets across free/guided and scene navigation", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto("/simulator/free/table-tilt");
  let viewport = page.getByLabel("GroundGlassViewport");
  let stage = viewport.getByRole("button", { name: /Ground Glass$/ });
  await stage.click({ position: { x: 90, y: 80 } });
  await expect(stage).toHaveAttribute("data-zoomed", "true");

  await page.goto("/simulator/guided/table-tilt/tilt-01");
  viewport = page.getByLabel("GroundGlassViewport");
  stage = viewport.getByRole("button", { name: /Ground Glass$/ });
  await expect(stage).toHaveAttribute("data-zoomed", "false");
  await expect(stage).toHaveAttribute("data-pan-x", "0");

  await page.goto("/simulator/free/architecture-rise");
  viewport = page.getByLabel("GroundGlassViewport");
  stage = viewport.getByRole("button", { name: /Ground Glass$/ });
  await expect(stage).toHaveAttribute("data-zoomed", "false");
  await expect(stage).toHaveAttribute("data-pan-y", "0");
  await expect(viewport.getByTestId("ground-glass-rtt")).toBeVisible();
  await page.getByRole("button", { name: "View overlays" }).click();
  await page.getByRole("button", { name: "Show Legends" }).click();
  await expect(page.getByRole("button", { name: "Hide Legends" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Scheimpflug construction/ })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Open 2D Geometry" }).click();
  await expect(page.getByRole("button", { name: "Scheimpflug Section" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Fit Construction" })).toHaveCount(0);
  await page.goto("/simulator/free/focus-fundamentals-two-targets");
  await page.getByRole("button", { name: "View overlays" }).click();
  await page.getByRole("button", { name: "Show Optical geometry" }).click();
  await expect(page.getByRole("button", { name: "Hide Optical geometry" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Scheimpflug construction/ })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Open 2D Geometry" }).click();
  await expect(page.getByRole("button", { name: "Scheimpflug Section" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Fit Construction" })).toHaveCount(0);
});
