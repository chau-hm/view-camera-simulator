import { expect, test, type Page } from "@playwright/test";
import {
  clickStageAt,
  readFreshElementBounds,
  readStageTransform,
} from "./helpers/groundGlass";
import { setRangeDirect } from "./helpers/rangeInput";

const shelfCard = (page: Page) =>
  page
    .getByRole("article")
    .filter({ has: page.getByRole("heading", { name: "Shelf Swing" }) });

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
  await page.goto("/scenes");
  await shelfCard(page).getByRole("link", { name: "Start Guided Task" }).click();
  await expect(page).toHaveURL(/\/simulator\/guided\/shelf-swing\/swing-01$/);
  await page.goto("/simulator/guided/shelf-swing/swing-01?rttDiagnostics=1");
  await expect(
    page.getByText("Align the diagonal focus plane with swing"),
  ).toBeVisible();
  await expect(
    page.getByText(/Use negative front swing and focus to align the plane of sharp focus/),
  ).toBeVisible();

  await expect(page.getByLabel("Rise")).toBeDisabled();
  await expect(page.getByLabel("Tilt")).toBeDisabled();
  await expect(page.getByLabel("Swing")).toBeEnabled();
  await expect(page.getByLabel("Focus distance")).toBeEnabled();
  await expect(page.getByRole("combobox", { name: "Aperture" })).toBeEnabled();
  await expect(page.getByLabel("Swing")).toHaveValue("0");
  await expect(page.getByLabel("Focus distance")).toHaveValue("3800");
  await expect(page.getByRole("combobox", { name: "Aperture" })).toHaveValue("11");
  await expect(page.getByRole("heading", { name: "Task completed" })).not.toBeVisible();

  await page.getByRole("button", { name: "Open 2D Geometry" }).click();
  const initialTop = page.getByTestId("geometry-svg-top");
  await expect(initialTop).toBeVisible();
  await expect(initialTop.getByTestId("shelf-swing-subject-trace")).toBeVisible();
  for (const [targetId, label] of [
    ["shelf-front", "Front chart"],
    ["shelf-middle", "Middle chart"],
    ["shelf-back", "Back chart"],
  ]) {
    await expect(initialTop.getByTestId(`geometry-target-${targetId}`)).toBeVisible();
    await expect(initialTop.getByText(label)).toBeVisible();
  }
  await expect(page.getByRole("button", { name: "Fit Construction" })).toBeDisabled();
  await page.getByRole("button", { name: "Close 2D Geometry" }).click();

  await setRangeDirect(page, "Swing", 3.802);
  await setRangeDirect(page, "Focus distance", 3411.62);
  await expect(page.getByRole("heading", { name: "Task completed" })).not.toBeVisible();
  await expect(page.getByText(/Use negative front swing near -3\.8°/)).toBeVisible();

  await setRangeDirect(page, "Swing", -3.802040434);
  await expect
    .poll(async () => Object.values(await readSharpness(page)).every((score) => score >= 80))
    .toBe(true);
  await expect(page.getByRole("heading", { name: "Task completed" })).toBeVisible();
  await expect(page.getByText(/Negative front swing rotated the plane of sharp focus/)).toBeVisible();
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
  // The public range control resolves swing to 0.1°, so the browser-level
  // trace comparison allows the small projection residual around -3.8°.
  expect(residual).toBeLessThan(1e-3);
  await expect(page.getByRole("button", { name: "Fit Construction" })).toBeEnabled();
  await page.getByRole("button", { name: "Fit Construction" }).click();
  const subjectField = page.getByTestId("subject-field-region");
  await expect(subjectField.getByTestId("shelf-swing-subject-trace")).toBeVisible();
  await expect(
    page.getByTestId("camera-construction-region").getByTestId("shelf-swing-subject-trace"),
  ).toHaveCount(0);
  for (const targetId of ["shelf-front", "shelf-middle", "shelf-back"]) {
    await expect(subjectField.getByTestId(`geometry-target-${targetId}`)).toBeVisible();
  }
  await page.getByRole("button", { name: "Fit Scene" }).click();
  await expect(page.getByTestId("geometry-svg-top")).toBeVisible();
  await page.getByRole("button", { name: "Close 2D Geometry" }).click();

  await page.getByRole("button", { name: "Restart task" }).click();
  await expect(page.getByLabel("Swing")).toHaveValue("0");
  await expect(page.getByLabel("Focus distance")).toHaveValue("3800");
  await expect(page.getByRole("combobox", { name: "Aperture" })).toHaveValue("11");
  await expect(page.getByRole("heading", { name: "Task completed" })).not.toBeVisible();
  await page.getByRole("button", { name: "Open 2D Geometry" }).click();
  await expect(page.getByTestId("geometry-svg-top")).toBeVisible();
  await expect(page.getByRole("button", { name: "Fit Construction" })).toBeDisabled();
});
