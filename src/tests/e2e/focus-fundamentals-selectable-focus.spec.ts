import { expect, test, type ElementHandle, type Locator, type Page } from "@playwright/test";

const isAllowedEnvironmentConsoleMessage = (message: string) =>
  /GL Driver Message .*GPU stall due to ReadPixels/.test(message);

const parseVector = (value: string | null): number[] => {
  const vector = value?.split(",").map(Number) ?? [];
  if (vector.length !== 3 || vector.some((coordinate) => !Number.isFinite(coordinate))) {
    throw new Error(`Invalid render vector: ${value}`);
  }
  return vector;
};

const readZ = async (locator: Locator, attribute: string) =>
  parseVector(await locator.getAttribute(attribute))[2];

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
  canvasHandle: ElementHandle<SVGElement | HTMLElement>,
  sceneHandle: ElementHandle<SVGElement | HTMLElement>,
  ownerId: string,
  resourceGeneration: string,
) => {
  await expect.poll(() => page.evaluate((node) => node.isConnected && document.querySelector('[data-testid="ground-glass-rtt"]') === node, rttHandle)).toBe(true);
  await expect.poll(() => page.evaluate((node) => node.isConnected && document.querySelector('[data-testid="ground-glass-rtt"] canvas') === node, canvasHandle)).toBe(true);
  await expect.poll(() => page.evaluate((node) => node.isConnected && document.querySelector('[data-testid="scene-canvas"]') === node, sceneHandle)).toBe(true);
  await expect(rtt).toHaveAttribute("data-rtt-owner-id", ownerId);
  await expect(rtt).toHaveAttribute("data-rtt-resource-generation", resourceGeneration);
};

test("Focus Fundamentals switches standards and focus modes without replacing RTT resources", async ({ page }) => {
  test.setTimeout(240_000);
  const pageErrors: string[] = [];
  const consoleProblems: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if ((message.type() === "error" || message.type() === "warning") && !isAllowedEnvironmentConsoleMessage(message.text())) {
      consoleProblems.push(message.text());
    }
  });

  await page.goto("/simulator/free/focus-fundamentals-two-targets?rttDiagnostics=1");
  const scene = page.getByTestId("scene-canvas");
  const rtt = page.locator('[data-testid="ground-glass-rtt"][data-rtt-channel="default"]');
  const canvas = rtt.locator("canvas");
  const sceneHandle = await scene.elementHandle();
  const slider = page.getByLabel("Focus distance");
  const front = page.getByRole("radio", { name: "Front standard" });
  const rear = page.getByRole("radio", { name: "Rear standard" });
  const nearSharpness = page.getByRole("progressbar", { name: "focus-near-board sharpness" });
  const farSharpness = page.getByRole("progressbar", { name: "focus-far-board sharpness" });

  await expect(scene).toHaveAttribute("data-scene-subject-id", "focus-fundamentals-two-targets");
  await expect(page.getByRole("group", { name: "Focus standard" })).toBeVisible();
  await expect(front).toBeChecked();
  await expect(slider).toHaveValue("2000");
  await expectContentfulRtt(rtt);

  const rttHandle = await rtt.elementHandle();
  const canvasHandle = await canvas.elementHandle();
  if (!rttHandle || !canvasHandle || !sceneHandle) throw new Error("Focus Fundamentals render resources were not mounted");
  const ownerId = await rtt.getAttribute("data-rtt-owner-id");
  const resourceGeneration = await rtt.getAttribute("data-rtt-resource-generation");
  if (!ownerId || !resourceGeneration) throw new Error("Ground Glass RTT diagnostics were incomplete");
  const referenceLensZ = await readZ(scene, "data-camera-lens-center-world");
  expect(await readZ(scene, "data-camera-film-center-world")).toBeCloseTo(0, 8);
  expect(await scene.getAttribute("data-focus-standard-selected")).toBe("front");
  expect(await scene.getAttribute("data-focus-standard-resolved")).toBe("front");
  const initialSanityState = await rtt.getAttribute("data-rtt-sanity-state");
  expect(initialSanityState).toBeTruthy();

  await page.getByRole("button", { name: "Focus Near Board" }).click();
  await expect(slider).toHaveValue("1000");
  expect(await readZ(scene, "data-camera-film-center-world")).toBeCloseTo(0, 8);
  expect(await readZ(scene, "data-camera-lens-center-world")).not.toBeCloseTo(referenceLensZ, 8);
  await expect.poll(async () => Number(await nearSharpness.getAttribute("aria-valuenow")) - Number(await farSharpness.getAttribute("aria-valuenow"))).toBeGreaterThan(0);
  await expect.poll(() => rtt.getAttribute("data-rtt-sanity-state"), { timeout: 120_000 }).not.toBe(initialSanityState);
  await expectContentfulRtt(rtt);
  await expectStableRttIdentity(page, rtt, rttHandle, canvasHandle, sceneHandle, ownerId, resourceGeneration);

  await page.getByRole("button", { name: "Focus Far Board" }).click();
  await expect(slider).toHaveValue("3000");
  expect(await readZ(scene, "data-camera-film-center-world")).toBeCloseTo(0, 8);
  await expect.poll(async () => Number(await farSharpness.getAttribute("aria-valuenow")) - Number(await nearSharpness.getAttribute("aria-valuenow"))).toBeGreaterThan(0);
  await expectContentfulRtt(rtt);
  await expectStableRttIdentity(page, rtt, rttHandle, canvasHandle, sceneHandle, ownerId, resourceGeneration);

  await rear.click();
  await expect(rear).toBeChecked();
  await expect(slider).toHaveValue("3000");
  await expect(scene).toHaveAttribute("data-focus-standard-selected", "rear");
  await expect(scene).toHaveAttribute("data-focus-standard-resolved", "rear");
  expect(await readZ(scene, "data-camera-lens-center-world")).toBeCloseTo(referenceLensZ, 8);
  const rearFarFilmZ = await readZ(scene, "data-camera-film-center-world");
  expect(rearFarFilmZ).not.toBeCloseTo(0, 8);
  await expectContentfulRtt(rtt);
  await expectStableRttIdentity(page, rtt, rttHandle, canvasHandle, sceneHandle, ownerId, resourceGeneration);

  await page.getByRole("button", { name: "Focus Near Board" }).click();
  await expect(slider).toHaveValue("1000");
  expect(await readZ(scene, "data-camera-lens-center-world")).toBeCloseTo(referenceLensZ, 8);
  const rearNearFilmZ = await readZ(scene, "data-camera-film-center-world");
  expect(rearNearFilmZ).not.toBeCloseTo(rearFarFilmZ, 8);
  await expect.poll(async () => Number(await nearSharpness.getAttribute("aria-valuenow")) - Number(await farSharpness.getAttribute("aria-valuenow"))).toBeGreaterThan(0);
  await expectContentfulRtt(rtt);
  await expectStableRttIdentity(page, rtt, rttHandle, canvasHandle, sceneHandle, ownerId, resourceGeneration);

  await page.getByRole("button", { name: "Focus Far Board" }).click();
  await expect(slider).toHaveValue("3000");
  expect(await readZ(scene, "data-camera-lens-center-world")).toBeCloseTo(referenceLensZ, 8);
  expect(await readZ(scene, "data-camera-film-center-world")).toBeCloseTo(rearFarFilmZ, 8);
  await expect.poll(async () => Number(await farSharpness.getAttribute("aria-valuenow")) - Number(await nearSharpness.getAttribute("aria-valuenow"))).toBeGreaterThan(0);
  await expectContentfulRtt(rtt);
  await expectStableRttIdentity(page, rtt, rttHandle, canvasHandle, sceneHandle, ownerId, resourceGeneration);

  await front.click();
  await expect(front).toBeChecked();
  await expect(scene).toHaveAttribute("data-focus-standard-selected", "front");
  await expect(scene).toHaveAttribute("data-focus-standard-resolved", "front");

  await page.getByRole("button", { name: "Infinity Reset" }).click();
  await expect(page.getByText("Focus: ∞")).toBeVisible();
  await expect(scene).toHaveAttribute("data-focus-standard-selected", "front");
  await expect(scene).toHaveAttribute("data-focus-standard-resolved", "front");
  const infinityLensZ = await readZ(scene, "data-camera-lens-center-world");
  const focalLengthMm = Number(await rtt.getAttribute("data-rtt-focal-length-mm"));
  expect(Number.isFinite(focalLengthMm)).toBe(true);
  expect(infinityLensZ).toBeCloseTo(focalLengthMm, 8);
  expect(await readZ(scene, "data-camera-film-center-world")).toBeCloseTo(
    0,
    8,
  );
  await expectContentfulRtt(rtt);
  await expectStableRttIdentity(page, rtt, rttHandle, canvasHandle, sceneHandle, ownerId, resourceGeneration);

  await rear.click();
  await expect(rear).toBeChecked();
  await expect(page.getByText("Focus: ∞")).toBeVisible();
  await expect(scene).toHaveAttribute("data-focus-standard-selected", "rear");
  await expect(scene).toHaveAttribute("data-focus-standard-resolved", "rear");
  expect(await readZ(scene, "data-camera-lens-center-world")).toBeCloseTo(referenceLensZ, 8);
  expect(await readZ(scene, "data-camera-film-center-world")).toBeCloseTo(referenceLensZ - focalLengthMm, 8);
  await expectContentfulRtt(rtt);
  await expectStableRttIdentity(page, rtt, rttHandle, canvasHandle, sceneHandle, ownerId, resourceGeneration);

  await page.getByRole("button", { name: "Focus Far Board" }).click();
  await expect(slider).toHaveValue("3000");
  await expect(page.getByText("Focus: ∞")).toHaveCount(0);
  await expect(rear).toBeChecked();
  await expect(page.getByTestId("scene-canvas")).toHaveAttribute("data-optics-fallback-applied", "false");

  await page.getByRole("button", { name: "Reset movements" }).click();
  await expect(slider).toHaveValue("2000");
  await expect(front).toBeChecked();
  await expect(scene).toHaveAttribute("data-focus-standard-selected", "front");
  await expect(scene).toHaveAttribute("data-focus-standard-resolved", "front");
  await expect(scene).toHaveAttribute("data-optics-fallback-applied", "false");
  await expectContentfulRtt(rtt);
  await expectStableRttIdentity(page, rtt, rttHandle, canvasHandle, sceneHandle, ownerId, resourceGeneration);

  expect(pageErrors, `Uncaught page errors: ${pageErrors.join("\n")}`).toEqual([]);
  expect(consoleProblems, `React/Three.js/WebGL warnings: ${consoleProblems.join("\n")}`).toEqual([]);
});

test("Focus Fundamentals controls remain usable at a 1024px viewport", async ({ page }) => {
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
    await expect(page.getByRole("button", { name: "Focus Near Board" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Focus Far Board" })).toBeVisible();
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
