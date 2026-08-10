import { expect, test, type ElementHandle, type Locator, type Page } from "@playwright/test";
import {
  focusFundamentalsFarFocusDepthMm,
  focusFundamentalsFocusDepthRangeMm,
  focusFundamentalsFocalLengthMm,
  focusFundamentalsNearFocusDepthMm,
  focusFundamentalsReferenceFocusDepthMm,
} from "../../scenes/focusFundamentalsTargets";

const isAllowedEnvironmentConsoleMessage = (message: string) =>
  /GL Driver Message .*GPU stall due to ReadPixels/.test(message);

const parseVector = (value: string | null): number[] => {
  const vector = value?.split(",").map(Number) ?? [];
  if (vector.length !== 3 || vector.some((coordinate) => !Number.isFinite(coordinate))) {
    throw new Error(`Invalid render vector: ${value}`);
  }
  return vector;
};

const readVector = async (locator: Locator, attribute: string) =>
  parseVector(await locator.getAttribute(attribute));

const readZ = async (locator: Locator, attribute: string) =>
  (await readVector(locator, attribute))[2];

const expectContentfulRtt = async (rtt: Locator) => {
  await expect(rtt).toHaveAttribute("data-rtt-camera-ok", "true", { timeout: 120_000 });
  await expect(rtt).toHaveAttribute("data-rtt-depth-available", "true", { timeout: 120_000 });
  await expect(rtt).toHaveAttribute("data-rtt-uniforms-finite", "true", { timeout: 120_000 });
  await expect(rtt).toHaveAttribute("data-rtt-raw-contentful", "true", { timeout: 120_000 });
  await expect(rtt).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 120_000 });
  expect(Number(await rtt.getAttribute("data-rtt-raw-variance"))).toBeGreaterThan(4);
  expect(Number(await rtt.getAttribute("data-rtt-final-variance"))).toBeGreaterThan(4);
  await expect(rtt.locator("canvas")).toBeVisible();
  expect((await rtt.locator("canvas").screenshot()).byteLength).toBeGreaterThan(5_000);
};

const expectStableRttIdentity = async (
  page: Page,
  rtt: Locator,
  rttHandle: ElementHandle<SVGElement | HTMLElement>,
  rttCanvasHandle: ElementHandle<SVGElement | HTMLElement>,
  sceneCanvasHandle: ElementHandle<SVGElement | HTMLElement>,
  ownerId: string,
  resourceGeneration: string,
) => {
  await expect
    .poll(() =>
      page.evaluate(
        (node) => node.isConnected && document.querySelector('[data-testid="ground-glass-rtt"]') === node,
        rttHandle,
      ),
    )
    .toBe(true);
  await expect
    .poll(() =>
      page.evaluate(
        (node) => node.isConnected && document.querySelector('[data-testid="ground-glass-rtt"] canvas') === node,
        rttCanvasHandle,
      ),
    )
    .toBe(true);
  await expect
    .poll(() =>
      page.evaluate(
        (node) => node.isConnected && document.querySelector('[data-testid="scene-canvas"] canvas') === node,
        sceneCanvasHandle,
      ),
    )
    .toBe(true);
  await expect(rtt).toHaveAttribute("data-rtt-owner-id", ownerId);
  await expect(rtt).toHaveAttribute("data-rtt-resource-generation", resourceGeneration);
};

const expectRttCameraAtLens = async (scene: Locator, rtt: Locator) => {
  await expect
    .poll(async () => {
      const lens = await readVector(scene, "data-camera-lens-center-world");
      const camera = await readVector(rtt, "data-rtt-camera-position");
      return Math.hypot(
        camera[0] - lens[0] * 0.001,
        camera[1] - lens[1] * 0.001,
        camera[2] - lens[2] * 0.001,
      );
    })
    .toBeLessThan(1e-5);
};

test("Focus Fundamentals proves front/rear viewpoint behavior without replacing RTT resources", async ({ page }) => {
  test.setTimeout(240_000);
  const pageErrors: string[] = [];
  const consoleProblems: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (
      (message.type() === "error" || message.type() === "warning") &&
      !isAllowedEnvironmentConsoleMessage(message.text())
    ) {
      consoleProblems.push(message.text());
    }
  });

  await page.goto("/simulator/free/focus-fundamentals-two-targets?rttDiagnostics=1");
  const scene = page.getByTestId("scene-canvas");
  const sceneCanvas = scene.locator("canvas").first();
  const rtt = page.locator('[data-testid="ground-glass-rtt"][data-rtt-channel="default"]');
  const rttCanvas = rtt.locator("canvas");
  const sceneCanvasHandle = await sceneCanvas.elementHandle();
  const slider = page.getByLabel("Focus distance");
  const front = page.getByRole("radio", { name: "Front standard" });
  const rear = page.getByRole("radio", { name: "Rear standard" });
  const nearSharpness = page.getByRole("progressbar", { name: "focus-near-detail sharpness" });
  const farSharpness = page.getByRole("progressbar", { name: "focus-far-detail sharpness" });

  await expect(scene).toHaveAttribute("data-scene-subject-id", "focus-fundamentals-two-targets");
  await expect(page.getByRole("group", { name: "Focus standard" })).toBeVisible();
  await expect(front).toBeChecked();
  await expect(slider).toHaveValue(String(focusFundamentalsReferenceFocusDepthMm));
  await expect(slider).toHaveAttribute("min", String(focusFundamentalsFocusDepthRangeMm.min));
  await expect(slider).toHaveAttribute("max", String(focusFundamentalsFocusDepthRangeMm.max));
  await expect(page.getByText("Focus method")).toBeVisible();
  await expect(page.getByText("Movement · Lens moves · Film fixed")).toBeVisible();
  await expect(scene).toHaveAttribute("data-focus-teaching-active-standard", "front");
  await expect(scene).toHaveAttribute("data-focus-teaching-movement-visible", "false");
  expect(Number(await scene.getAttribute("data-focus-teaching-displacement-mm"))).toBeLessThan(1e-6);
  expect(Number(await rtt.getAttribute("data-rtt-focal-length-mm"))).toBe(focusFundamentalsFocalLengthMm);
  await expectContentfulRtt(rtt);

  await page.getByRole("button", { name: "Open 2D Geometry" }).click();
  const geometrySvg = page.getByTestId("geometry-svg-side");
  await expect(geometrySvg).toBeVisible();
  await expect(geometrySvg.locator('[data-testid="focus-fundamentals-position-cues"]')).toBeVisible();
  await expect(geometrySvg.locator('[data-testid="focus-current-lens-position"]')).toBeVisible();
  await expect(geometrySvg.locator('[data-testid="focus-reference-lens-position"]')).toBeVisible();
  await expect(geometrySvg).toContainText("Lens · current");
  await expect(geometrySvg).toContainText("Lens · reference");
  await expect(geometrySvg).not.toContainText("Original");
  await page.getByRole("button", { name: "Close 2D Geometry" }).click();

  const rttHandle = await rtt.elementHandle();
  const rttCanvasHandle = await rttCanvas.elementHandle();
  if (!rttHandle || !rttCanvasHandle || !sceneCanvasHandle) {
    throw new Error("Focus Fundamentals render resources were not mounted");
  }
  const ownerId = await rtt.getAttribute("data-rtt-owner-id");
  const resourceGeneration = await rtt.getAttribute("data-rtt-resource-generation");
  if (!ownerId || !resourceGeneration) throw new Error("Ground Glass RTT diagnostics were incomplete");

  const referenceLensZ = await readZ(scene, "data-camera-lens-center-world");
  expect(await readZ(scene, "data-camera-film-center-world")).toBeCloseTo(0, 8);
  expect(await scene.getAttribute("data-focus-standard-selected")).toBe("front");
  expect(await scene.getAttribute("data-focus-standard-resolved")).toBe("front");
  await expectRttCameraAtLens(scene, rtt);
  const initialSanityState = await rtt.getAttribute("data-rtt-sanity-state");
  expect(initialSanityState).toBeTruthy();

  await page.getByRole("button", { name: "Focus Near Detail" }).click();
  await expect(slider).toHaveValue(String(focusFundamentalsNearFocusDepthMm));
  expect(await readZ(scene, "data-camera-film-center-world")).toBeCloseTo(0, 8);
  const frontNearLensZ = await readZ(scene, "data-camera-lens-center-world");
  expect(frontNearLensZ).not.toBeCloseTo(referenceLensZ, 8);
  await expect(page.getByText("Movement · Lens moves · Film fixed")).toBeVisible();
  await expect(scene).toHaveAttribute("data-focus-teaching-active-standard", "front");
  await expect(scene).toHaveAttribute("data-focus-teaching-movement-visible", "true");
  expect(Number(await scene.getAttribute("data-focus-teaching-displacement-mm"))).toBeGreaterThan(0.5);
  await expectRttCameraAtLens(scene, rtt);
  const frontNearRttPosition = await readVector(rtt, "data-rtt-camera-position");
  await expect
    .poll(async () => Number(await nearSharpness.getAttribute("aria-valuenow")) - Number(await farSharpness.getAttribute("aria-valuenow")))
    .toBeGreaterThan(0);
  await expect.poll(() => rtt.getAttribute("data-rtt-sanity-state"), { timeout: 120_000 }).not.toBe(initialSanityState);
  await expectContentfulRtt(rtt);
  await expectStableRttIdentity(page, rtt, rttHandle, rttCanvasHandle, sceneCanvasHandle, ownerId, resourceGeneration);

  await page.getByRole("button", { name: "Focus Far Detail" }).click();
  await expect(slider).toHaveValue(String(focusFundamentalsFarFocusDepthMm));
  expect(await readZ(scene, "data-camera-film-center-world")).toBeCloseTo(0, 8);
  const frontFarLensZ = await readZ(scene, "data-camera-lens-center-world");
  expect(frontFarLensZ).not.toBeCloseTo(frontNearLensZ, 8);
  await expect(scene).toHaveAttribute("data-focus-teaching-active-standard", "front");
  await expect(scene).toHaveAttribute("data-focus-teaching-movement-visible", "true");
  await expectRttCameraAtLens(scene, rtt);
  expect(await readZ(rtt, "data-rtt-camera-position")).not.toBeCloseTo(frontNearRttPosition[2], 6);
  await expect
    .poll(async () => Number(await farSharpness.getAttribute("aria-valuenow")) - Number(await nearSharpness.getAttribute("aria-valuenow")))
    .toBeGreaterThan(0);
  await expectContentfulRtt(rtt);
  await expectStableRttIdentity(page, rtt, rttHandle, rttCanvasHandle, sceneCanvasHandle, ownerId, resourceGeneration);

  await rear.click();
  await expect(rear).toBeChecked();
  await expect(slider).toHaveValue(String(focusFundamentalsFarFocusDepthMm));
  await expect(scene).toHaveAttribute("data-focus-standard-selected", "rear");
  await expect(scene).toHaveAttribute("data-focus-standard-resolved", "rear");
  await expect(page.getByText("Movement · Film moves · Lens/viewpoint fixed")).toBeVisible();
  await expect(scene).toHaveAttribute("data-focus-teaching-active-standard", "rear");
  await expect(scene).toHaveAttribute("data-focus-teaching-movement-visible", "true");
  expect(await readZ(scene, "data-camera-lens-center-world")).toBeCloseTo(referenceLensZ, 8);
  const rearFarFilmZ = await readZ(scene, "data-camera-film-center-world");
  expect(rearFarFilmZ).not.toBeCloseTo(0, 8);
  await expectRttCameraAtLens(scene, rtt);
  const rearFarRttPosition = await readVector(rtt, "data-rtt-camera-position");
  await expectContentfulRtt(rtt);
  await expectStableRttIdentity(page, rtt, rttHandle, rttCanvasHandle, sceneCanvasHandle, ownerId, resourceGeneration);

  await page.getByRole("button", { name: "Focus Near Detail" }).click();
  await expect(slider).toHaveValue(String(focusFundamentalsNearFocusDepthMm));
  expect(await readZ(scene, "data-camera-lens-center-world")).toBeCloseTo(referenceLensZ, 8);
  const rearNearFilmZ = await readZ(scene, "data-camera-film-center-world");
  expect(rearNearFilmZ).not.toBeCloseTo(rearFarFilmZ, 8);
  await expect(scene).toHaveAttribute("data-focus-teaching-active-standard", "rear");
  await expect(scene).toHaveAttribute("data-focus-teaching-movement-visible", "true");
  await expectRttCameraAtLens(scene, rtt);
  const rearNearRttPosition = await readVector(rtt, "data-rtt-camera-position");
  expect(Math.hypot(...rearNearRttPosition.map((value, index) => value - rearFarRttPosition[index]))).toBeLessThan(1e-7);
  await expect
    .poll(async () => Number(await nearSharpness.getAttribute("aria-valuenow")) - Number(await farSharpness.getAttribute("aria-valuenow")))
    .toBeGreaterThan(0);
  await expectContentfulRtt(rtt);
  await expectStableRttIdentity(page, rtt, rttHandle, rttCanvasHandle, sceneCanvasHandle, ownerId, resourceGeneration);

  await page.getByRole("button", { name: "Focus Far Detail" }).click();
  await expect(slider).toHaveValue(String(focusFundamentalsFarFocusDepthMm));
  expect(await readZ(scene, "data-camera-lens-center-world")).toBeCloseTo(referenceLensZ, 8);
  expect(await readZ(scene, "data-camera-film-center-world")).toBeCloseTo(rearFarFilmZ, 8);
  await expectRttCameraAtLens(scene, rtt);
  await expect
    .poll(async () => Number(await farSharpness.getAttribute("aria-valuenow")) - Number(await nearSharpness.getAttribute("aria-valuenow")))
    .toBeGreaterThan(0);
  await expectContentfulRtt(rtt);
  await expectStableRttIdentity(page, rtt, rttHandle, rttCanvasHandle, sceneCanvasHandle, ownerId, resourceGeneration);

  await front.click();
  await expect(front).toBeChecked();
  await page.getByRole("button", { name: "Infinity Reset" }).click();
  await expect(page.getByText("Focus: ∞")).toBeVisible();
  await expect(scene).toHaveAttribute("data-focus-standard-selected", "front");
  await expect(scene).toHaveAttribute("data-focus-standard-resolved", "front");
  await expect(scene).toHaveAttribute("data-focus-teaching-active-standard", "front");
  await expect(scene).toHaveAttribute("data-focus-teaching-movement-visible", "true");
  const focalLengthMm = Number(await rtt.getAttribute("data-rtt-focal-length-mm"));
  expect(await readZ(scene, "data-camera-lens-center-world")).toBeCloseTo(focalLengthMm, 8);
  expect(await readZ(scene, "data-camera-film-center-world")).toBeCloseTo(0, 8);
  await expectRttCameraAtLens(scene, rtt);
  await expectContentfulRtt(rtt);
  await expectStableRttIdentity(page, rtt, rttHandle, rttCanvasHandle, sceneCanvasHandle, ownerId, resourceGeneration);

  await rear.click();
  await expect(rear).toBeChecked();
  await expect(page.getByText("Focus: ∞")).toBeVisible();
  await expect(scene).toHaveAttribute("data-focus-standard-selected", "rear");
  await expect(scene).toHaveAttribute("data-focus-standard-resolved", "rear");
  await expect(scene).toHaveAttribute("data-focus-teaching-active-standard", "rear");
  await expect(scene).toHaveAttribute("data-focus-teaching-movement-visible", "true");
  expect(await readZ(scene, "data-camera-lens-center-world")).toBeCloseTo(referenceLensZ, 8);
  expect(await readZ(scene, "data-camera-film-center-world")).toBeCloseTo(referenceLensZ - focalLengthMm, 8);
  await expectRttCameraAtLens(scene, rtt);
  await expectContentfulRtt(rtt);
  await expectStableRttIdentity(page, rtt, rttHandle, rttCanvasHandle, sceneCanvasHandle, ownerId, resourceGeneration);

  await page.getByRole("button", { name: "Focus Far Detail" }).click();
  await expect(slider).toHaveValue(String(focusFundamentalsFarFocusDepthMm));
  await expect(page.getByText("Focus: ∞")).toHaveCount(0);
  await expect(rear).toBeChecked();
  await expect(page.getByTestId("scene-canvas")).toHaveAttribute("data-optics-fallback-applied", "false");

  await page.getByRole("button", { name: "Reset movements" }).click();
  await expect(slider).toHaveValue(String(focusFundamentalsReferenceFocusDepthMm));
  await expect(front).toBeChecked();
  await expect(scene).toHaveAttribute("data-focus-standard-selected", "front");
  await expect(scene).toHaveAttribute("data-focus-standard-resolved", "front");
  await expect(scene).toHaveAttribute("data-focus-teaching-active-standard", "front");
  await expect(scene).toHaveAttribute("data-focus-teaching-movement-visible", "false");
  expect(Number(await scene.getAttribute("data-focus-teaching-displacement-mm"))).toBeLessThan(1e-6);
  await expect(scene).toHaveAttribute("data-optics-fallback-applied", "false");
  await expectRttCameraAtLens(scene, rtt);
  await expectContentfulRtt(rtt);
  await expectStableRttIdentity(page, rtt, rttHandle, rttCanvasHandle, sceneCanvasHandle, ownerId, resourceGeneration);

  expect(pageErrors, `Uncaught page errors: ${pageErrors.join("\n")}`).toEqual([]);
  expect(consoleProblems, `React/Three.js/WebGL warnings: ${consoleProblems.join("\n")}`).toEqual([]);
});

test("Focus Fundamentals controls remain usable at responsive viewports", async ({ page }) => {
  for (const viewport of [
    { width: 1024, height: 768 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/simulator/free/focus-fundamentals-two-targets");

    const controls = page.getByRole("region", { name: "Camera Controls" });
    const aside = page.locator(".simulator-aside");
    const group = page.getByRole("group", { name: "Focus standard" });
    await expect(controls).toBeVisible();
    await expect(aside).toHaveCSS("overflow-y", "auto");
    await expect(group).toBeVisible();
    await expect(page.getByRole("radio", { name: "Front standard" })).toBeVisible();
    await expect(page.getByRole("radio", { name: "Rear standard" })).toBeVisible();
    await expect(page.getByLabel("Focus distance")).toBeVisible();
    await expect(page.getByRole("button", { name: "Focus Near Detail" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Focus Far Detail" })).toBeVisible();
    await expect(page.getByTestId("ground-glass-rtt")).toHaveCount(1);

    const bounds = await group.boundingBox();
    if (!bounds) throw new Error("Focus standard controls have no layout bounds");
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width);

    const horizontalOverflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(horizontalOverflow.scrollWidth).toBeLessThanOrEqual(horizontalOverflow.clientWidth + 1);
  }
});
