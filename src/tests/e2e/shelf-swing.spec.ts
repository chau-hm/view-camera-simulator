import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  clickStageAt,
  readFreshElementBounds,
  readStageTransform,
} from "./helpers/groundGlass";
import { setRangeDirect } from "./helpers/rangeInput";
import { setStepRangeInput } from "./helpers/stepRangeInput";

const shelfCard = (page: Page) =>
  page
    .getByRole("article")
    .filter({ has: page.getByRole("heading", { name: "Shelf Swing" }) });

// Chromium may emit this driver-only performance diagnostic around RTT readback.
// It is not a React, Three.js, feedback-loop, disposed-resource, or non-finite warning.
const isAllowedEnvironmentConsoleMessage = (message: string) =>
  /GL Driver Message .*GPU stall due to ReadPixels/.test(message);

const readSharpness = async (page: Page) =>
  Object.fromEntries(
    await Promise.all(
      ["shelf-front", "shelf-middle", "shelf-back"].map(async (id) => [
        id,
        Number(
          await page
            .getByRole("progressbar", { name: `${id} sharpness` })
            .getAttribute("aria-valuenow"),
        ),
      ] as const),
    ),
  );

const expectGuideLabelClearOfMiddleTarget = async (svg: Locator) => {
  const guideLabel = svg.getByTestId("shelf-swing-subject-trace-label");
  const middleTarget = svg.getByTestId("geometry-target-shelf-middle");
  const middleMarker = middleTarget.locator("rect").first();
  const middleLabel = middleTarget.getByText("Middle chart", { exact: true });
  const [svgBox, guideBox, markerBox, middleLabelBox] = await Promise.all([
    svg.boundingBox(),
    guideLabel.boundingBox(),
    middleMarker.boundingBox(),
    middleLabel.boundingBox(),
  ]);
  if (!svgBox || !guideBox || !markerBox || !middleLabelBox) {
    throw new Error("Shelf Swing geometry label bounds were unavailable");
  }

  const overlapsWithGap = (
    first: { x: number; y: number; width: number; height: number },
    second: { x: number; y: number; width: number; height: number },
    gapPx: number,
  ) =>
    !(
      first.x + first.width + gapPx <= second.x ||
      second.x + second.width + gapPx <= first.x ||
      first.y + first.height + gapPx <= second.y ||
      second.y + second.height + gapPx <= first.y
    );

  expect(overlapsWithGap(guideBox, markerBox, 4)).toBe(false);
  expect(overlapsWithGap(guideBox, middleLabelBox, 4)).toBe(false);
  expect(guideBox.x).toBeGreaterThanOrEqual(svgBox.x);
  expect(guideBox.y).toBeGreaterThanOrEqual(svgBox.y);
  expect(guideBox.x + guideBox.width).toBeLessThanOrEqual(svgBox.x + svgBox.width);
  expect(guideBox.y + guideBox.height).toBeLessThanOrEqual(svgBox.y + svgBox.height);
};

const expectRttContent = async (page: Page) => {
  const rtt = page.getByTestId("ground-glass-rtt");
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
  await expect(rtt.locator("canvas")).toBeVisible();
  expect((await rtt.locator("canvas").screenshot()).byteLength).toBeGreaterThan(5_000);
};

test("Shelf Swing card exposes free and guided modes", async ({ page }) => {
  await page.goto("/scenes");
  const card = shelfCard(page);
  await expect(card).toBeVisible();
  const thumbnail = card.locator("img");
  await expect(thumbnail).toHaveAttribute("src", /assets\/shelf-swing\.png$/);
  await expect.poll(() => thumbnail.evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await expect(card.getByRole("link", { name: "Open Scene" })).toHaveAttribute(
    "href",
    "/simulator/free/shelf-swing",
  );
  await expect(card.getByRole("link", { name: "Start Guided Task" })).toHaveAttribute(
    "href",
    "/simulator/guided/shelf-swing/swing-01",
  );
  await expect(card.getByText("In development")).toHaveCount(0);

  await card.getByRole("link", { name: "Open Scene" }).click();
  await expect(page).toHaveURL(/\/simulator\/free\/shelf-swing$/);
});

test("Shelf Swing routes reject mismatched and free-mode task IDs", async ({ page }) => {
  await page.goto("/simulator/guided/shelf-swing/tilt-01");
  await expect(page).toHaveURL(/\/scenes$/);
  await expect(page.getByText("Align the tabletop focus cards with tilt")).toHaveCount(0);

  await page.goto("/simulator/free/shelf-swing/swing-01");
  await expect(page).toHaveURL(/\/scenes$/);
  await expect(page.getByText("Align the diagonal focus plane with swing")).toHaveCount(0);

  await page.goto("/simulator/guided/shelf-swing/swing-01");
  await expect(page).toHaveURL(/\/simulator\/guided\/shelf-swing\/swing-01$/);
  await expect(page.getByText("Align the diagonal focus plane with swing")).toBeVisible();
});

test("Shelf Swing free and guided workflows stay accessible without console errors", async ({ page }) => {
  const pageErrors: string[] = [];
  const consoleProblems: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") {
      if (!isAllowedEnvironmentConsoleMessage(message.text())) {
        consoleProblems.push(message.text());
      }
    }
  });

  await page.goto("/simulator/free/shelf-swing");
  for (const label of ["Rise", "Tilt", "Swing", "Focus distance"]) {
    await expect(page.getByLabel(label)).toBeEnabled();
  }

  await page.goto("/simulator/guided/shelf-swing/swing-01");
  await expect(page.getByLabel("Rise")).toBeDisabled();
  await expect(page.getByLabel("Tilt")).toBeDisabled();
  await expect(page.getByLabel("Rise").locator("..")).toContainText("Disabled for this guided task");
  await expect(page.getByLabel("Tilt").locator("..")).toContainText("Disabled for this guided task");
  const progress = page.getByRole("progressbar", { name: "Task requirements completed" });
  await expect(progress).toHaveAttribute("aria-valuemin", "0");
  await expect(progress).toHaveAttribute("aria-valuemax", /\d+/);
  await expect(progress).toHaveAttribute("aria-valuenow", /\d+/);

  const overlayTrigger = page.getByRole("button", { name: "View overlays" }).first();
  await overlayTrigger.click();
  const focusPlaneToggle = page.getByRole("button", { name: /focus plane/i }).first();
  await expect(focusPlaneToggle).toHaveAttribute("aria-pressed", /true|false/);
  await expect(page.getByRole("button", { name: "Open 2D Geometry" })).toBeVisible();

  expect(pageErrors, `Uncaught page errors: ${pageErrors.join("\n")}`).toEqual([]);
  expect(consoleProblems, `Console errors/warnings: ${consoleProblems.join("\n")}`).toEqual([]);
});

test("Shelf Swing free scene uses canonical R3F and contentful RTT rendering", async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto("/simulator/free/shelf-swing?rttDiagnostics=1");

  await expect(page.getByRole("heading", { name: "3D Scene", level: 2 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ground Glass", level: 2 })).toBeVisible();
  await expect(page.getByTestId("scene-canvas")).toHaveAttribute(
    "data-scene-subject-id",
    "shelf-swing",
  );
  await expect(page.getByText(/WebGL is unavailable/)).toHaveCount(0);
  await expect(page.getByTestId("ground-glass-rtt")).toHaveCount(1);
  await expect(page.getByTestId("ground-glass-scene")).toHaveCount(0);
  await expectRttContent(page);
});

test("Shelf Swing negative calibration sharpens all targets and the opposite sign worsens them", async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto("/simulator/free/shelf-swing?rttDiagnostics=1");
  await page.getByRole("combobox", { name: "Aperture" }).selectOption("11");

  await setRangeDirect(page, "Swing", 0);
  await setRangeDirect(page, "Focus distance", 3800);
  const zero = await readSharpness(page);
  expect(zero["shelf-middle"]).toBe(Math.max(...Object.values(zero)));
  expect(Object.values(zero).every((score) => score >= 80)).toBe(false);

  await setRangeDirect(page, "Swing", -3.802040434);
  await setRangeDirect(page, "Focus distance", 3411.619);
  await expect.poll(async () => Object.values(await readSharpness(page)).every((score) => score >= 80)).toBe(true);
  const calibrated = await readSharpness(page);
  await expectRttContent(page);
  const calibratedStateKey = await page
    .getByTestId("ground-glass-rtt")
    .getAttribute("data-rtt-sanity-state");

  await setRangeDirect(page, "Swing", 3.802);
  await expect.poll(async () => Object.values(await readSharpness(page)).every((score) => score >= 80)).toBe(false);
  const opposite = await readSharpness(page);
  expect(Math.min(opposite["shelf-front"], opposite["shelf-back"])).toBeLessThan(
    Math.min(calibrated["shelf-front"], calibrated["shelf-back"]),
  );
  await expect
    .poll(() => page.getByTestId("ground-glass-rtt").getAttribute("data-rtt-sanity-state"))
    .not.toBe(calibratedStateKey);

  const f11 = Math.min(...Object.values(opposite));
  await page.getByRole("combobox", { name: "Aperture" }).selectOption("22");
  await expect.poll(async () => Math.min(...Object.values(await readSharpness(page)))).toBeGreaterThanOrEqual(f11);
});

test("Shelf Swing Ground Glass zoom, pan, reset, orientation, and quality stay live", async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto("/simulator/free/shelf-swing?rttDiagnostics=1");
  await expectRttContent(page);
  const viewport = page.getByLabel("GroundGlassViewport");
  const stage = viewport.getByRole("button", { name: /Ground Glass$/ });
  const layer = viewport.getByTestId("ground-glass-image-layer");

  await clickStageAt(page, stage, 0.25, 0.25);
  await expect(stage).toHaveAttribute("data-zoomed", "true");
  const zoomed = await readStageTransform(layer);
  expect(zoomed.scaleX).toBeGreaterThan(1);

  const bounds = await readFreshElementBounds(stage);
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width / 2 + 45, bounds.y + bounds.height / 2 + 30, { steps: 4 });
  await page.mouse.up();
  const panned = await readStageTransform(layer);
  expect(Math.abs(panned.translateX - zoomed.translateX) + Math.abs(panned.translateY - zoomed.translateY)).toBeGreaterThan(1);

  await viewport.getByRole("button", { name: "Reset Ground Glass view" }).click();
  await expect(stage).toHaveAttribute("data-zoomed", "false");
  expect(await readStageTransform(layer)).toEqual({
    translateX: 0,
    translateY: 0,
    scaleX: 1,
    scaleY: 1,
  });

  await page.getByText("Upright Assist").click();
  await expectRttContent(page);
  await page.getByText("Raw Ground Glass").click();
  await expectRttContent(page);
  await page.getByLabel("Render quality").selectOption("low");
  await expectRttContent(page);
  await page.getByLabel("Render quality").selectOption("high");
  await expectRttContent(page);
});

test("Shelf Swing guided task teaches negative swing and restores its initial state", async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto("/scenes");
  await shelfCard(page).getByRole("link", { name: "Start Guided Task" }).click();
  await expect(page).toHaveURL(/\/simulator\/guided\/shelf-swing\/swing-01$/);
  await expect(
    page.getByText("Align the diagonal focus plane with swing"),
  ).toBeVisible();
  await expect(
    page.getByText(/Use negative front swing and focus to align the plane of sharp focus/),
  ).toBeVisible();
  await page.getByLabel("Render quality").selectOption("low");

  await expect(page.getByLabel("Rise")).toBeDisabled();
  await expect(page.getByLabel("Tilt")).toBeDisabled();
  await expect(page.getByLabel("Swing")).toBeEnabled();
  await expect(page.getByLabel("Focus distance")).toBeEnabled();
  await expect(page.getByLabel("Swing")).toHaveAttribute("step", "0.1");
  await expect(page.getByLabel("Focus distance")).toHaveAttribute("step", "10");
  await expect(page.getByRole("combobox", { name: "Aperture" })).toBeEnabled();
  await expect(page.getByLabel("Swing")).toHaveValue("0");
  await expect(page.getByLabel("Focus distance")).toHaveValue("3800");
  await expect(page.getByRole("combobox", { name: "Aperture" })).toHaveValue("11");
  await expect(page.getByRole("heading", { name: "Task completed" })).not.toBeVisible();

  await setStepRangeInput(page, "Swing", 3.8);
  await setStepRangeInput(page, "Focus distance", 3410);
  await expect(page.getByRole("heading", { name: "Task completed" })).not.toBeVisible();
  await expect(page.getByText(/Use negative front swing near -3\.8°/)).toBeVisible();

  await setStepRangeInput(page, "Swing", -3.8);
  await expect
    .poll(async () => Object.values(await readSharpness(page)).every((score) => score >= 80))
    .toBe(true);
  await expect(page.getByRole("heading", { name: "Task completed" })).toBeVisible();
  await expect(page.getByText(/Negative front swing rotated the plane of sharp focus/)).toBeVisible();
  await page.getByRole("combobox", { name: "Aperture" }).selectOption("22");
  await expect(page.getByRole("heading", { name: "Task completed" })).toBeVisible();
  await page.getByRole("combobox", { name: "Aperture" }).selectOption("11");

  await page.getByRole("button", { name: "Restart task" }).click();
  await expect(page.getByLabel("Swing")).toHaveValue("0");
  await expect(page.getByLabel("Focus distance")).toHaveValue("3800");
  await expect(page.getByRole("combobox", { name: "Aperture" })).toHaveValue("11");
  await expect(page.getByRole("heading", { name: "Task completed" })).not.toBeVisible();
});

test("Shelf Swing geometry limits projected depth planes to the movement-relevant Top view", async ({ page }) => {
  await page.goto("/simulator/free/shelf-swing");
  await setStepRangeInput(page, "Swing", -3.8);
  await setStepRangeInput(page, "Focus distance", 3410);

  const trigger = page.getByRole("button", { name: "Open 2D Geometry" });
  await trigger.click();
  await page.getByRole("button", { name: "Side", exact: true }).click();
  const side = page.getByTestId("geometry-svg-side");
  for (const locator of [
    side.getByTestId("plane-line-focus"),
    side.locator('line[aria-label="nearDof plane"]'),
    side.locator('line[aria-label="farDof plane"]'),
    side.getByTestId("dof-region"),
  ]) {
    await expect(locator).toHaveCount(0);
  }
  for (const testId of ["physical-film-segment", "physical-lens-segment"]) {
    await expect(side.getByTestId(testId)).toHaveCount(1);
  }
  for (const testId of [
    "geometry-target-shelf-front",
    "geometry-target-shelf-middle",
    "geometry-target-shelf-back",
  ]) {
    await expect(side.getByTestId(testId)).toBeVisible();
  }

  await page.getByRole("button", { name: "Top", exact: true }).click();
  const top = page.getByTestId("geometry-svg-top");
  for (const locator of [
    top.getByTestId("plane-line-focus"),
    top.locator('line[aria-label="nearDof plane"]'),
    top.locator('line[aria-label="farDof plane"]'),
    top.getByTestId("dof-region"),
  ]) {
    await expect(locator).toBeVisible();
  }

  await page.getByRole("button", { name: "Close 2D Geometry" }).click();
  await expect(page.getByRole("dialog", { name: "2D Geometry" })).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test("Shelf Swing solved geometry and RTT remain coherent at the public solution", async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto("/simulator/guided/shelf-swing/swing-01?rttDiagnostics=1");
  await setStepRangeInput(page, "Swing", -3.8);
  await setStepRangeInput(page, "Focus distance", 3410);
  await expect(page.getByRole("heading", { name: "Task completed" })).toBeVisible();
  await expectRttContent(page);

  const sceneCanvas = page.getByTestId("scene-canvas");
  for (const attribute of [
    "data-focus-overlay-vertices",
    "data-near-dof-overlay-vertices",
    "data-far-dof-overlay-vertices",
  ]) {
    await expect.poll(async () => Number(await sceneCanvas.getAttribute(attribute))).toBeGreaterThanOrEqual(4);
  }

  await page.getByRole("button", { name: "Open 2D Geometry" }).click();
  const calibratedTop = page.getByTestId("geometry-svg-top");
  await expectGuideLabelClearOfMiddleTarget(calibratedTop);
  const subjectLine = calibratedTop.getByTestId("shelf-swing-subject-trace").locator("line");
  const focusLine = calibratedTop.getByTestId("plane-line-focus");
  const residual = await Promise.all([subjectLine, focusLine].map(async (line) =>
    line.evaluate((element) => ({
      x1: Number(element.getAttribute("x1")),
      y1: Number(element.getAttribute("y1")),
      x2: Number(element.getAttribute("x2")),
      y2: Number(element.getAttribute("y2")),
    })),
  )).then(([subject, focus]) => {
    const a = { x: subject.x2 - subject.x1, y: subject.y2 - subject.y1 };
    const b = { x: focus.x2 - focus.x1, y: focus.y2 - focus.y1 };
    return Math.abs(a.x * b.y - a.y * b.x) / (Math.hypot(a.x, a.y) * Math.hypot(b.x, b.y));
  });
  expect(residual).toBeLessThan(1e-3);
  await expect(page.getByRole("button", { name: "Fit Construction" })).toBeEnabled();
  await page.getByRole("button", { name: "Fit Construction" }).click();
  const subjectField = page.getByTestId("subject-field-region");
  await expect(subjectField.getByTestId("shelf-swing-subject-trace")).toBeVisible();
  await expectGuideLabelClearOfMiddleTarget(subjectField.getByTestId("geometry-svg-top"));
  await expect(
    page.getByTestId("camera-construction-region").getByTestId("shelf-swing-subject-trace"),
  ).toHaveCount(0);
  for (const targetId of ["shelf-front", "shelf-middle", "shelf-back"]) {
    await expect(subjectField.getByTestId(`geometry-target-${targetId}`)).toBeVisible();
  }
  await page.getByRole("button", { name: "Fit Scene" }).click();
  await expect(page.getByTestId("geometry-svg-top")).toBeVisible();
});

test("Shelf Swing geometry dialog stays keyboard-accessible and bounded at 1024px", async ({ page }) => {
  test.setTimeout(120_000);
  for (const height of [768, 900]) {
    await page.setViewportSize({ width: 1024, height });
    await page.goto("/simulator/guided/shelf-swing/swing-01");

    await expect(page.getByRole("heading", { name: "3D Scene", level: 2 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Ground Glass", level: 2 })).toBeVisible();
    await expect(page.getByLabel("Camera Controls")).toBeVisible();
    await expect(page.locator("[data-overlay-presentation='collapsed']").first()).toBeVisible();
    expect(
      await page.evaluate(() => ({
        main: getComputedStyle(document.querySelector(".simulator-main")!).overflowY,
        aside: getComputedStyle(document.querySelector(".simulator-aside")!).overflowY,
      })),
    ).toEqual({ main: "auto", aside: "auto" });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
    ).toBe(true);

    const overlayTrigger = page.getByRole("button", { name: "View overlays" }).first();
    await expect(page.getByTestId("scene-canvas")).toBeVisible({ timeout: 60_000 });
    await overlayTrigger.click();
    const [overlayBounds, sceneBounds] = await Promise.all([
      page.locator(".scene-overlay-menu__panel").first().boundingBox(),
      page.getByTestId("scene-canvas").boundingBox(),
    ]);
    if (!overlayBounds || !sceneBounds) throw new Error("Overlay or scene bounds were unavailable");
    expect(overlayBounds.width * overlayBounds.height).toBeLessThan(
      sceneBounds.width * sceneBounds.height,
    );
    await overlayTrigger.click();

    const trigger = page.getByRole("button", { name: "Open 2D Geometry" });
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "2D Geometry" });
    await expect(dialog).toHaveAttribute("aria-modal", "true");
    await expect(page.getByRole("button", { name: "Close 2D Geometry" })).toBeFocused();
    await expect(page.getByRole("button", { name: "Fit Scene" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Fit Construction" })).toBeVisible();
    const bounds = await dialog.boundingBox();
    if (!bounds) throw new Error("2D Geometry dialog bounds were unavailable");
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.y).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(1024);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(height);
    const beforeResize = { ...bounds };
    await page.mouse.move(bounds.x + bounds.width - 3, bounds.y + bounds.height - 3);
    await page.mouse.down();
    await page.mouse.move(bounds.x + bounds.width + 90, bounds.y + bounds.height + 70, { steps: 5 });
    await page.mouse.up();
    const resized = await dialog.boundingBox();
    if (!resized) throw new Error("Resized dialog bounds were unavailable");
    expect(resized.width).toBeGreaterThan(beforeResize.width + 20);
    expect(resized.height).toBeGreaterThan(beforeResize.height + 20);
    expect(Math.abs(resized.x - beforeResize.x)).toBeLessThanOrEqual(2);
    expect(Math.abs(resized.y - beforeResize.y)).toBeLessThanOrEqual(2);
    expect(resized.x).toBeGreaterThanOrEqual(16);
    expect(resized.y).toBeGreaterThanOrEqual(16);
    expect(resized.x + resized.width).toBeLessThanOrEqual(1024 - 16);
    expect(resized.y + resized.height).toBeLessThanOrEqual(height - 16);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
  }
});
