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

  // The default RTT camera is the live canonical camera. Representative cases
  // must change its extrinsics while the subject and owned RTT resources stay
  // mounted and stable.
  const poseAttributes = ["data-rtt-camera-position", "data-rtt-camera-up", "data-rtt-camera-forward"] as const;
  const neutralPose = Object.fromEntries(
    await Promise.all(poseAttributes.map(async (attribute) => [attribute, await current.getAttribute(attribute)] as const)),
  );
  for (const attribute of poseAttributes) {
    expect(neutralPose[attribute]).toBeTruthy();
  }

  const assertCurrentChanged = async (change: () => Promise<void>) => {
    await change();
    await expect
      .poll(async () => {
        const values = await Promise.all(poseAttributes.map((attribute) => current.getAttribute(attribute)));
        return values.some((value, index) => value !== neutralPose[poseAttributes[index]]);
      })
      .toBe(true);
  };

  const viewpoint = page.getByRole("slider", { name: "Viewpoint" });
  const tilt = page.getByRole("slider", { name: "Tilt" });
  await tilt.fill("3.2");
  await expect(tilt).toHaveValue("3.2");
  await page.getByRole("radio", { name: "Rear standard" }).click();
  await expect(page.getByRole("radio", { name: "Rear standard" })).toBeChecked();
  await assertCurrentChanged(async () => page.getByRole("radio", { name: "C1 — Front rise" }).click());
  await assertCurrentChanged(async () => viewpoint.fill("1"));

  const presentationCases: Array<{ change: () => Promise<void>; expectedRegion: string }> = [
    { change: async () => tilt.fill("-2.4"), expectedRegion: "middle" },
    { change: async () => page.getByRole("radio", { name: "Front standard" }).click(), expectedRegion: "middle" },
    { change: async () => page.getByRole("radio", { name: "C1 — Front rise" }).click(), expectedRegion: "upper" },
    { change: async () => page.getByRole("radio", { name: "C2 — Rear rise" }).click(), expectedRegion: "upper" },
    { change: async () => page.getByRole("radio", { name: "D1 — Front fall" }).click(), expectedRegion: "lower" },
    { change: async () => page.getByRole("radio", { name: "D2 — Rear fall" }).click(), expectedRegion: "lower" },
    { change: async () => viewpoint.fill("1"), expectedRegion: "whole" },
    { change: async () => viewpoint.fill("-1"), expectedRegion: "whole" },
    { change: async () => viewpoint.fill("0"), expectedRegion: "whole" },
  ];

  for (const { change, expectedRegion } of presentationCases) {
    await change();
    await expect(scene).toHaveAttribute("data-mounted-lattice-presentation-region", expectedRegion);
    await expect(current).toHaveAttribute("data-rtt-lattice-presentation-region", expectedRegion);
    await expect(current).toHaveAttribute("data-rtt-lattice-geometry-id", geometryId!);
    await expect(current).toHaveAttribute("data-rtt-lattice-subject-generation", subjectGeneration!);
    await expect(current).toHaveAttribute("data-rtt-resource-generation", resourceGeneration!);
    await expect(current).toHaveAttribute("data-rtt-lattice-resource-key", resourceKey!);
    await assertCurrentContentful(page);
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
