import { expect, test } from "@playwright/test";

const currentRtt = (page: import("@playwright/test").Page) =>
  page.locator('[data-testid="ground-glass-rtt"][data-rtt-channel="default"]');

const assertCurrentContentful = async (page: import("@playwright/test").Page) => {
  const rtt = currentRtt(page);
  await expect(rtt).toBeVisible({ timeout: 15_000 });
  await expect(rtt).toHaveAttribute("data-rtt-camera-ok", "true", { timeout: 15_000 });
  await expect(rtt).toHaveAttribute("data-rtt-uniforms-finite", "true", { timeout: 5_000 });
  await expect(rtt).toHaveAttribute("data-rtt-raw-contentful", "true", { timeout: 15_000 });
  await expect(rtt).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 15_000 });
};

test("public camera-movement Ground Glass renders one live Current view through the default RTT channel", async ({ page }) => {
  test.setTimeout(150_000);
  const pageErrors: string[] = [];
  const graphicsErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (!["warning", "error"].includes(message.type())) return;
    const text = message.text();
    if (!/(WebGL|THREE|GPU)/i.test(text) || /GPU stall due to ReadPixels/i.test(text)) return;
    graphicsErrors.push(`${message.type()}: ${text}`);
  });

  await page.goto("/simulator/free/understanding-camera-movements?rttDiagnostics=1");
  await expect(page.getByRole("heading", { name: "Ground Glass", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Original", exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Current", exact: true })).toHaveCount(0);
  await expect(page.getByText("Compare the neutral camera with the selected movement.")).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Original and Current Ground Glass comparison" })).toHaveCount(0);
  await expect(page.getByRole("radio", { name: "Raw Ground Glass" })).toHaveCount(1);
  await expect(page.getByRole("radio", { name: "Upright Assist" })).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Zoom in Ground Glass preview view", exact: true })).toHaveCount(1);
  await expect(page.locator('[data-testid="ground-glass-rtt"][data-rtt-channel^="camera-movement-"]')).toHaveCount(0);
  await expect(currentRtt(page)).toHaveCount(1);

  await assertCurrentContentful(page);
  const current = currentRtt(page);
  const scene = page.locator('[data-testid="scene-canvas"]');
  const geometryId = await current.getAttribute("data-rtt-lattice-geometry-id");
  const resourceGeneration = await current.getAttribute("data-rtt-resource-generation");
  const subjectGeneration = await current.getAttribute("data-rtt-lattice-subject-generation");
  const resourceKey = await current.getAttribute("data-rtt-lattice-resource-key");
  expect(geometryId).toBeTruthy();
  expect(resourceGeneration).toBeTruthy();
  expect(subjectGeneration).toBeTruthy();
  expect(resourceKey).toBeTruthy();
  await expect(current).toHaveAttribute("data-rtt-lattice-geometry-id", geometryId!);
  await expect(current).toHaveAttribute("data-rtt-lattice-edge-count", "224");
  await expect(scene).toHaveAttribute("data-mounted-lattice-presentation-region", "whole");
  await expect(current).toHaveAttribute("data-rtt-lattice-presentation-region", "whole");

  const neutralSanityState = await current.getAttribute("data-rtt-sanity-state");
  expect(neutralSanityState).toBeTruthy();

  const assertStableRendererIdentities = async () => {
    await expect(current).toHaveAttribute("data-rtt-lattice-geometry-id", geometryId!);
    await expect(current).toHaveAttribute("data-rtt-lattice-subject-generation", subjectGeneration!);
    await expect(current).toHaveAttribute("data-rtt-resource-generation", resourceGeneration!);
    await expect(current).toHaveAttribute("data-rtt-lattice-resource-key", resourceKey!);
  };

  const waitForSanityStateChange = async (previousState: string) => {
    await expect
      .poll(async () => current.getAttribute("data-rtt-sanity-state"))
      .not.toBe(previousState);
    const nextState = await current.getAttribute("data-rtt-sanity-state");
    expect(nextState).toBeTruthy();
    return nextState!;
  };

  const assertPresentation = async (expectedRegion: string) => {
    await expect(scene).toHaveAttribute("data-mounted-lattice-presentation-region", expectedRegion);
    await expect(current).toHaveAttribute("data-rtt-lattice-presentation-region", expectedRegion);
    await assertStableRendererIdentities();
    await assertCurrentContentful(page);
  };

  const viewpoint = page.getByRole("slider", { name: "Viewpoint" });
  const tilt = page.getByRole("slider", { name: "Tilt" });
  const framing = page.getByRole("slider", { name: "Vertical framing" });
  const tiltStandards = page.getByRole("group", { name: "Tilt standard" });
  const framingStandards = page.getByRole("group", { name: "Vertical framing standard" });
  const movementStatus = page.locator(".camera-movement-controls__status");
  await tilt.fill("3.2");
  await expect(tilt).toHaveValue("3.2");
  await expect(tiltStandards.getByRole("radio", { name: "Front standard" })).toBeChecked();
  await expect(movementStatus).toContainText("Front tilt · +3.2°");
  let previousSanityState = await waitForSanityStateChange(neutralSanityState!);
  await assertPresentation("middle");

  await tiltStandards.getByRole("radio", { name: "Rear standard" }).click();
  await expect(tiltStandards.getByRole("radio", { name: "Rear standard" })).toBeChecked();
  await expect(tilt).toHaveValue("3.2");
  await expect(movementStatus).toContainText("Rear tilt · +3.2°");
  previousSanityState = await waitForSanityStateChange(previousSanityState);
  await assertPresentation("middle");

  // Transfer the preserved framing value to the Front standard and apply the
  // C1-compatible upper endpoint through the continuous control.
  await framingStandards.getByRole("radio", { name: "Front standard" }).click();
  await framing.fill("1");
  await expect(framing).toHaveValue("1");
  previousSanityState = await waitForSanityStateChange(previousSanityState);
  await assertPresentation("upper");

  await viewpoint.fill("1");
  await expect(viewpoint).toHaveValue("1");
  previousSanityState = await waitForSanityStateChange(previousSanityState);
  await assertPresentation("whole");

  const presentationCases: Array<{ change: () => Promise<void>; expectedRegion: string }> = [
    { change: async () => tilt.fill("-2.4"), expectedRegion: "middle" },
    { change: async () => tiltStandards.getByRole("radio", { name: "Rear standard" }).click(), expectedRegion: "middle" },
    { change: async () => framingStandards.getByRole("radio", { name: "Front standard" }).click(), expectedRegion: "middle" },
    { change: async () => framing.fill("1"), expectedRegion: "upper" },
    { change: async () => framingStandards.getByRole("radio", { name: "Rear standard" }).click(), expectedRegion: "upper" },
    { change: async () => framing.fill("-1"), expectedRegion: "lower" },
    { change: async () => framingStandards.getByRole("radio", { name: "Front standard" }).click(), expectedRegion: "lower" },
    { change: async () => viewpoint.fill("1"), expectedRegion: "whole" },
    { change: async () => viewpoint.fill("-1"), expectedRegion: "whole" },
    { change: async () => viewpoint.fill("0"), expectedRegion: "whole" },
  ];

  for (const { change, expectedRegion } of presentationCases) {
    await change();
    previousSanityState = await waitForSanityStateChange(previousSanityState);
    await assertPresentation(expectedRegion);
  }

  const rttHandle = await current.elementHandle();
  const canvasHandle = await current.locator("canvas").elementHandle();
  if (!rttHandle || !canvasHandle) throw new Error("Current Ground Glass identities unavailable");
  await page.getByRole("button", { name: "Zoom in Ground Glass preview view", exact: true }).click();
  await expect(page.getByRole("button", { name: "Reset Ground Glass preview view", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Reset Ground Glass preview view", exact: true }).click();
  await expect(page.getByRole("button", { name: "Zoom in Ground Glass preview view", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Expand Ground Glass" }).click();
  await expect(page.getByRole("heading", { name: "Original", exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Current", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Restore Ground Glass" })).toBeVisible();
  await expect(currentRtt(page)).toHaveCount(1);
  expect(await page.evaluate((node) => node === document.querySelector('[data-testid="ground-glass-rtt"]'), rttHandle)).toBe(true);
  expect(await page.evaluate((node) => node === document.querySelector('[data-testid="ground-glass-rtt"] canvas'), canvasHandle)).toBe(true);
  await assertCurrentContentful(page);

  expect(pageErrors).toEqual([]);
  expect(graphicsErrors).toEqual([]);
});

test("calibration workbench keeps the existing single Ground Glass path", async ({ page }) => {
  await page.goto("/simulator/free/understanding-camera-movements?cameraCalibration=1&rttDiagnostics=1");
  await expect(page.getByRole("region", { name: "Camera movement calibration workbench" })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("heading", { name: "Original", exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Current", exact: true })).toHaveCount(0);
  await expect(page.locator('[data-testid="ground-glass-rtt"][data-rtt-channel="default"]')).toHaveCount(1);
  await expect(page.locator('[data-testid="ground-glass-rtt"][data-rtt-channel^="camera-movement-"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="ground-glass-rtt"][data-rtt-channel="default"]')).toHaveAttribute("data-rtt-camera-ok", "true", { timeout: 15_000 });
});
