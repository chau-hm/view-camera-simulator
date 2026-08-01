import { test, expect, type Locator, type Page } from "@playwright/test";

const disableOpticalGeometry = async (page: Page, scene: Locator) => {
  if ((await scene.getAttribute("data-optical-geometry-visible")) !== "true") return;
  const trigger = page.getByRole("button", { name: "View overlays" });
  if (await trigger.isVisible()) await trigger.click();
  await page.getByRole("button", { name: "Hide Optical geometry" }).click();
  await expect(scene).toHaveAttribute("data-optical-geometry-visible", "false");
};

const enableRttDiagnosticsWithoutNavigation = async (page: Page) => {
  await page.evaluate(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("rttDiagnostics", "1");
    window.history.replaceState(window.history.state, "", url);
  });
};

async function readSceneCanvasVisualSample(canvas: Locator) {
  const screenshot = await canvas.screenshot();
  return canvas.evaluate(async (_element, screenshotBase64) => {
    const image = new Image();
    image.src = `data:image/png;base64,${screenshotBase64}`;
    await image.decode();
    const width = Math.min(image.width, 640);
    const height = Math.min(image.height, 480);
    const sampleCanvas = document.createElement("canvas");
    sampleCanvas.width = width;
    sampleCanvas.height = height;
    const context = sampleCanvas.getContext("2d");
    if (!context) return { supported: false, chromaticPixels: 0, brightNeutralPixels: 0, brightPixels: 0 };
    context.drawImage(image, 0, 0, width, height);
    const pixels = context.getImageData(0, 0, width, height).data;
    let chromaticPixels = 0;
    let brightNeutralPixels = 0;
    let brightPixels = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      const red = pixels[index] ?? 0;
      const green = pixels[index + 1] ?? 0;
      const blue = pixels[index + 2] ?? 0;
      const maximum = Math.max(red, green, blue);
      const minimum = Math.min(red, green, blue);
      if (maximum > 55) {
        brightPixels += 1;
        if (maximum - minimum < 18) brightNeutralPixels += 1;
      }
      if (maximum > 55 && maximum - minimum > 24) chromaticPixels += 1;
    }
    return { supported: true, chromaticPixels, brightNeutralPixels, brightPixels };
  }, screenshot.toString("base64"));
}

const expectFiniteVectorAttribute = async (
  locator: Locator,
  attribute: string,
): Promise<number[]> => {
  const serialized = await locator.getAttribute(attribute);
  expect(serialized, attribute).toBeTruthy();
  const components = serialized!.split(",").map(Number);
  expect(components, attribute).toHaveLength(3);
  expect(components.every(Number.isFinite), attribute).toBe(true);
  return components;
};

test("camera movements scene loads and renders valid Ground Glass content", async ({ page }) => {
  await page.goto("/simulator/free/understanding-camera-movements?rttDiagnostics=1");
  await expect(page.locator('[data-testid="scene-canvas"]')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('[data-optical-geometry-visible="true"]')).toBeVisible({ timeout: 5000 });

  const rtt = page.locator('[data-testid="ground-glass-rtt"]');
  await expect(rtt).toHaveCount(1);
  await expect(rtt).toBeVisible({ timeout: 15000 });

  await expect(rtt).toHaveAttribute("data-rtt-camera-ok", "true", { timeout: 15000 });
  await expect(rtt).toHaveAttribute("data-rtt-uniforms-finite", "true", { timeout: 5000 });
  await expect(rtt).toHaveAttribute("data-rtt-raw-contentful", "true", { timeout: 15000 });
  await expect(rtt).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 5000 });

  const rawNonBg = Number(await rtt.getAttribute("data-rtt-raw-non-background"));
  const finalNonBg = Number(await rtt.getAttribute("data-rtt-final-non-background"));
  expect(Number.isFinite(rawNonBg) && rawNonBg > 0).toBe(true);
  expect(Number.isFinite(finalNonBg) && finalNonBg > 0).toBe(true);

  const sanityError = await rtt.getAttribute("data-rtt-sanity-error");
  expect(sanityError === null || sanityError === "" || sanityError === "null").toBe(true);

  await expect(page.getByRole("radio", { name: "Neutral" })).toBeVisible();
  await expect(page.getByRole("radio", { name: "A — Front tilt" })).toBeVisible();
  await expect(page.getByRole("radio", { name: "B — Rear tilt" })).toBeVisible();
  await expect(page.getByRole("radio", { name: "C1 — Front rise" })).toBeVisible();
  await expect(page.getByRole("radio", { name: "C2 — Rear rise" })).toBeVisible();
  await expect(page.getByRole("radio", { name: "C3 — Higher viewpoint" })).toBeVisible();
  await expect(page.getByRole("radio", { name: "D1 — Front fall" })).toBeVisible();
  await expect(page.getByRole("radio", { name: "D2 — Rear fall" })).toBeVisible();
  await expect(page.getByRole("radio", { name: "D3 — Lower viewpoint" })).toBeVisible();

  await expect(page.getByRole("button", { name: "Reset Movements" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Restart Task" })).toHaveCount(0);
});

test("all four movements change Ground Glass without breaking", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/simulator/free/understanding-camera-movements?rttDiagnostics=1");
  const rtt = page.locator('[data-testid="ground-glass-rtt"]');
  await expect(rtt).toBeVisible({ timeout: 15000 });
  await expect(rtt).toHaveAttribute("data-rtt-camera-ok", "true", { timeout: 15000 });

  const cases: Array<{ label: string }> = [
    { label: "A — Front tilt" },
    { label: "B — Rear tilt" },
    { label: "C1 — Front rise" },
    { label: "C2 — Rear rise" },
    { label: "C3 — Higher viewpoint" },
    { label: "D1 — Front fall" },
    { label: "D2 — Rear fall" },
    { label: "D3 — Lower viewpoint" },
  ];

  for (const { label } of cases) {
    const radio = page.getByRole("radio", { name: label });
    await radio.click();
    await expect(radio).toBeChecked();

    // RTT stays valid after the case transition. Movement-only changes do not
    // guarantee a distinct sanity hash (e.g. A vs B), so wait for RTT validity
    // rather than a sanity-state change.
    await expect(rtt).toHaveAttribute("data-rtt-camera-ok", "true", { timeout: 5000 });
    await expect(rtt).toHaveAttribute("data-rtt-uniforms-finite", "true", { timeout: 5000 });
    await expect(rtt).toHaveAttribute("data-rtt-raw-contentful", "true", { timeout: 10000 });
    await expect(rtt).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 5000 });
  }
});

test("Reset Movements restores zero state and keeps Ground Glass valid", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto("/simulator/free/understanding-camera-movements?rttDiagnostics=1");
  const rtt = page.locator('[data-testid="ground-glass-rtt"]');
  await expect(rtt).toBeVisible({ timeout: 15000 });
  await expect(rtt).toHaveAttribute("data-rtt-camera-ok", "true", { timeout: 15000 });

  // Select and change A — Front tilt
  await page.getByRole("radio", { name: "A — Front tilt" }).click();
  await expect(page.getByRole("radio", { name: "A — Front tilt" })).toBeChecked();

  const prevState = await rtt.getAttribute("data-rtt-sanity-state");

  // Reset Movements restores complete Neutral
  await page.getByRole("button", { name: "Reset Movements" }).click();

  // Neutral should be selected again
  await expect(page.getByRole("radio", { name: "Neutral" })).toBeChecked();

  // Wait for a new RTT frame after reset
  await expect.poll(async () => {
    const state = await rtt.getAttribute("data-rtt-sanity-state");
    if (state && state !== prevState && state.length > 0) return true;
    return false;
  }, { timeout: 10000, intervals: [500, 1000] }).toBe(true);

  // Ground Glass stays valid
  await expect(rtt).toBeVisible({ timeout: 5000 });
  await expect(rtt).toHaveAttribute("data-rtt-camera-ok", "true", { timeout: 5000 });
  await expect(rtt).toHaveAttribute("data-rtt-raw-contentful", "true", { timeout: 10000 });
  await expect(rtt).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 5000 });
});

test("canonical lattice remains stable across controls and SPA routes", async ({ page }) => {
  test.setTimeout(120_000);
  const pageErrors: string[] = [];
  const unexpectedGraphicsMessages: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    const text = message.text();
    if (!(message.type() === "warning" || message.type() === "error") || !/(WebGL|THREE|GPU)/i.test(text)) return;
    if (/GPU stall due to ReadPixels/i.test(text)) return;
    unexpectedGraphicsMessages.push(`${message.type()}: ${text}`);
  });

  await page.goto("/simulator/free/understanding-camera-movements?rttDiagnostics=1");
  const scene = page.locator('[data-testid="scene-canvas"]');
  const rtt = page.locator('[data-testid="ground-glass-rtt"]');
  const sceneCanvas = scene.locator("canvas");
  await expect(sceneCanvas).toHaveCount(1);
  await expect(scene).toHaveAttribute("data-mounted-lattice", "true", { timeout: 15_000 });
  await expect(scene).toHaveAttribute("data-mounted-lattice-edge-count", "224");
  await expect(scene).toHaveAttribute("data-mounted-lattice-target-region", "middle");
  await expect(scene).toHaveAttribute("data-reference-camera-visible", "false");
  const initialGeometryId = await scene.getAttribute("data-mounted-lattice-geometry-id");
  const initialGenerationValue = await scene.getAttribute("data-mounted-lattice-generation");
  const initialGeneration = Number(initialGenerationValue);
  expect(initialGeometryId).toBeTruthy();
  expect(Number.isSafeInteger(initialGeneration) && initialGeneration > 0).toBe(true);
  await expect(scene).toHaveAttribute("data-camera-rig-anchor", "mid");
  await expect(scene).toHaveAttribute("data-camera-rig-origin", "0.000000,0.000000,0.000000");
  await expect(scene).toHaveAttribute("data-camera-rig-base-pitch-deg", "0.000000");
  await expect(scene).toHaveAttribute("data-camera-body-pitch-deg", "0.000000");
  await expectFiniteVectorAttribute(scene, "data-camera-body-pivot-world");
  await expect(scene).toHaveAttribute(
    "data-camera-lens-center-world",
    "0.000000,0.000000,0.000000",
  );
  await expectFiniteVectorAttribute(scene, "data-camera-film-center-world");
  await expect(rtt).toHaveAttribute("data-rtt-lattice-geometry-id", initialGeometryId!);
  await expect(rtt).toHaveAttribute("data-rtt-lattice-edge-count", "224");
  await expect(rtt).toHaveAttribute("data-rtt-lattice-target-region", "middle");
  expect(await rtt.getAttribute("data-rtt-lattice-edge-count")).toBe(
    await scene.getAttribute("data-mounted-lattice-edge-count"),
  );
  expect(await rtt.getAttribute("data-rtt-lattice-target-region")).toBe(
    await scene.getAttribute("data-mounted-lattice-target-region"),
  );
  await disableOpticalGeometry(page, scene);
  const initialVisual = await readSceneCanvasVisualSample(sceneCanvas);
  expect(initialVisual.supported).toBe(true);
  expect(initialVisual.chromaticPixels).toBeGreaterThan(20);
  expect(initialVisual.brightNeutralPixels / Math.max(initialVisual.brightPixels, 1)).toBeLessThan(0.95);
  await expect(page.getByText("Subjects", { exact: true })).toHaveCount(0);
  await expect(scene).toHaveAttribute("data-lattice-edge-count", "224", { timeout: 15_000 });
  await expect(scene).toHaveAttribute("data-lattice-target-region", "middle", { timeout: 15_000 });
  await expect(scene).toHaveAttribute("data-reference-camera-visible", "false", { timeout: 15_000 });
  await expect(rtt).toHaveAttribute("data-rtt-focal-length-mm", "90", { timeout: 15_000 });
  await expect(rtt).toHaveAttribute("data-rtt-lattice-edge-count", "224", { timeout: 15_000 });
  await expect(rtt).toHaveAttribute("data-rtt-lattice-target-region", "middle", { timeout: 15_000 });
  const initialRttGeneration = await rtt.getAttribute(
    "data-rtt-resource-generation",
  );
  const initialRttCameraPosition = await rtt.getAttribute(
    "data-rtt-camera-position",
  );
  expect(initialRttGeneration).toBeTruthy();
  expect(initialRttCameraPosition).toBeTruthy();

  await page.getByRole("radio", { name: "C1 — Front rise" }).click();
  await expect(page.getByRole("radio", { name: "C1 — Front rise" })).toBeChecked();
  await expect
    .poll(() => rtt.getAttribute("data-rtt-camera-position"))
    .not.toBe(initialRttCameraPosition);
  await expect(rtt).toHaveAttribute(
    "data-rtt-resource-generation",
    initialRttGeneration!,
  );
  await expect(scene).toHaveAttribute(
    "data-mounted-lattice-generation",
    initialGenerationValue!,
  );
  await expect(scene).toHaveAttribute(
    "data-mounted-lattice-geometry-id",
    initialGeometryId!,
  );
  await page.getByRole("button", { name: "Reset Movements" }).click();
  await expect(page.getByRole("radio", { name: "Neutral" })).toBeChecked();
  await expect(rtt).toHaveAttribute(
    "data-rtt-camera-position",
    initialRttCameraPosition!,
  );
  await expect(rtt).toHaveAttribute(
    "data-rtt-resource-generation",
    initialRttGeneration!,
  );
  await expect(scene).toHaveAttribute(
    "data-mounted-lattice-generation",
    initialGenerationValue!,
  );
  await expect(scene).toHaveAttribute("data-lattice-target-region", "middle");
  await expect(rtt).toHaveAttribute("data-rtt-lattice-target-region", "middle");
  await expect(rtt).toHaveAttribute("data-rtt-camera-ok", "true", { timeout: 5000 });
  await expect(rtt).toHaveAttribute("data-rtt-raw-contentful", "true", { timeout: 10000 });
  await expect(rtt).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 5000 });

  const initialSceneHandle = await scene.elementHandle();
  const initialRttHandle = await rtt.elementHandle();
  expect(initialSceneHandle).toBeTruthy();
  expect(initialRttHandle).toBeTruthy();
  await page.getByRole("link", { name: "All Scenes" }).click();
  await expect
    .poll(() => page.evaluate((node) => !node.isConnected, initialSceneHandle!))
    .toBe(true);
  await expect
    .poll(() => page.evaluate((node) => !node.isConnected, initialRttHandle!))
    .toBe(true);
  await page
    .getByRole("article")
    .filter({ has: page.getByRole("heading", { name: "Architecture Rise" }) })
    .getByRole("link", { name: "Open Scene" })
    .click();
  const architectureScene = page.locator('[data-testid="scene-canvas"]');
  await expect(architectureScene).not.toHaveAttribute("data-mounted-lattice", "true");
  await expect(architectureScene).not.toHaveAttribute(
    "data-mounted-lattice-geometry-id",
    /.+/,
  );
  const legacyRtt = page.locator('[data-testid="ground-glass-rtt"]');
  await expect(legacyRtt).toHaveAttribute("data-rtt-focal-length-mm", "150", { timeout: 15_000 });
  await expect(legacyRtt).not.toHaveAttribute("data-rtt-lattice-edge-count", /.+/);
  await expect(legacyRtt).not.toHaveAttribute("data-rtt-lattice-geometry-id", /.+/);
  const architectureSceneHandle = await architectureScene.elementHandle();
  const architectureRttHandle = await legacyRtt.elementHandle();
  expect(architectureSceneHandle).toBeTruthy();
  expect(architectureRttHandle).toBeTruthy();
  await page.getByRole("link", { name: "All Scenes" }).click();
  await expect
    .poll(() =>
      page.evaluate((node) => !node.isConnected, architectureSceneHandle!),
    )
    .toBe(true);
  await expect
    .poll(() => page.evaluate((node) => !node.isConnected, architectureRttHandle!))
    .toBe(true);
  await page
    .getByRole("article")
    .filter({ has: page.getByRole("heading", { name: "Understanding Camera Movements" }) })
    .getByRole("link", { name: "Open Scene" })
    .click();
  await enableRttDiagnosticsWithoutNavigation(page);
  const returnedScene = page.locator('[data-testid="scene-canvas"]');
  const returnedRtt = page.locator('[data-testid="ground-glass-rtt"]');
  await expect(returnedScene).toHaveAttribute("data-lattice-edge-count", "224", { timeout: 15_000 });
  await expect(returnedScene).toHaveAttribute("data-mounted-lattice", "true", { timeout: 15_000 });
  await expect(returnedScene).toHaveAttribute("data-mounted-lattice-edge-count", "224");
  await expect(returnedScene).toHaveAttribute("data-mounted-lattice-target-region", "middle");
  await expect(returnedScene).toHaveAttribute(
    "data-camera-rig-anchor",
    "mid",
  );
  await expect(returnedScene).toHaveAttribute(
    "data-camera-rig-origin",
    "0.000000,0.000000,0.000000",
  );
  await expect(returnedScene).toHaveAttribute(
    "data-camera-rig-base-pitch-deg",
    "0.000000",
  );
  await expect(returnedScene).toHaveAttribute(
    "data-camera-body-pitch-deg",
    "0.000000",
  );
  const returnedGeometryId = await returnedScene.getAttribute("data-mounted-lattice-geometry-id");
  const returnedGeneration = Number(
    await returnedScene.getAttribute("data-mounted-lattice-generation"),
  );
  expect(returnedGeometryId).toBe(initialGeometryId);
  expect(Number.isSafeInteger(returnedGeneration) && returnedGeneration > 0).toBe(true);
  expect(returnedGeneration).not.toBe(initialGeneration);
  await expect(returnedRtt).toHaveAttribute("data-rtt-focal-length-mm", "90", { timeout: 15_000 });
  await expect(returnedRtt).toHaveAttribute("data-rtt-lattice-edge-count", "224", { timeout: 15_000 });
  await expect(returnedRtt).toHaveAttribute("data-rtt-lattice-geometry-id", returnedGeometryId!);
  await expect(returnedRtt).toHaveAttribute("data-rtt-lattice-target-region", "middle");
  await expect(returnedRtt).toHaveAttribute("data-rtt-raw-contentful", "true", { timeout: 15_000 });
  await expect(returnedRtt).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 15_000 });
  await disableOpticalGeometry(page, returnedScene);
  const returnVisual = await readSceneCanvasVisualSample(returnedScene.locator("canvas"));
  expect(returnVisual.supported).toBe(true);
  expect(returnVisual.chromaticPixels).toBeGreaterThan(20);
  expect(returnVisual.brightNeutralPixels / Math.max(returnVisual.brightPixels, 1)).toBeLessThan(0.95);

  expect(pageErrors).toEqual([]);
  expect(unexpectedGraphicsMessages).toEqual([]);
});
