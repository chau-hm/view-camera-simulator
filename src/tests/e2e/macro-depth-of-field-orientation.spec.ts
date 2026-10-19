import { expect, test, type Locator, type Page } from "@playwright/test";

const TARGET_COLUMNS = {
  raw: {
    "macro-depth-near": 0,
    "macro-depth-middle": 1,
    "macro-depth-far": 2,
  },
  upright: {
    "macro-depth-near": 2,
    "macro-depth-middle": 1,
    "macro-depth-far": 0,
  },
} as const;

const TARGET_IDS = [
  "macro-depth-near",
  "macro-depth-middle",
  "macro-depth-far",
] as const;

// The specimen is centered and vertically asymmetric (bridge above the three
// focus stations). These fixed physical-film V samples cross its interior;
// pairing Raw V with Upright 1-V tests the actual RTT raster without sampling
// antialiased silhouette edges.
const SPECIMEN_PROFILE_V = [
  0.42, 0.44, 0.46, 0.48, 0.50, 0.52, 0.54, 0.56, 0.58,
] as const;

const captureGroundGlassOutput = async (page: Page, canvas: Locator, path: string) => {
  const hiddenSiblings = await canvas.evaluate((element) => {
    const imageLayer = document.querySelector('[data-testid="ground-glass-image-layer"]');
    const captureRoot = imageLayer?.parentElement?.parentElement ?? imageLayer;
    const changed: HTMLElement[] = [];
    let current: Element | null = element;
    while (current && current !== captureRoot) {
      const parentElement: HTMLElement | null = current.parentElement;
      if (!parentElement) break;
      for (const sibling of Array.from(parentElement.children)) {
        if (sibling === current || !(sibling instanceof HTMLElement)) continue;
        sibling.dataset.rttCapturePreviousVisibility = sibling.style.visibility;
        sibling.style.visibility = "hidden";
        changed.push(sibling);
      }
      current = parentElement;
    }
    return changed.length;
  });
  expect(hiddenSiblings).toBeGreaterThan(0);
  try {
    return await canvas.screenshot({ animations: "disabled", path });
  } finally {
    await page.locator('[data-rtt-capture-previous-visibility]').evaluateAll((elements) => {
      for (const element of elements) {
        const htmlElement = element as HTMLElement;
        htmlElement.style.visibility = htmlElement.dataset.rttCapturePreviousVisibility ?? "";
        delete htmlElement.dataset.rttCapturePreviousVisibility;
      }
    });
  }
};

const readCanvasPatches = async (
  canvas: Locator,
  screenshotBase64: string,
  points: readonly { u: number; v: number }[],
) => {
  return canvas.evaluate(async (_element, input) => {
    const image = new Image();
    image.src = `data:image/png;base64,${input.screenshotBase64}`;
    await image.decode();
    const sampleCanvas = document.createElement("canvas");
    sampleCanvas.width = image.width;
    sampleCanvas.height = image.height;
    const context = sampleCanvas.getContext("2d");
    if (!context) throw new Error("Unable to inspect the captured Ground Glass WebGL output");
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, image.width, image.height).data;
    const radiusX = Math.max(2, Math.round(image.width * 0.01));
    const radiusY = Math.max(2, Math.round(image.height * 0.01));

    return input.points.map(({ u, v }) => {
      const centerX = Math.min(image.width - 1, Math.max(0, Math.round(u * (image.width - 1))));
      const centerY = Math.min(image.height - 1, Math.max(0, Math.round(v * (image.height - 1))));
      let red = 0;
      let green = 0;
      let blue = 0;
      let count = 0;
      for (let y = Math.max(0, centerY - radiusY); y <= Math.min(image.height - 1, centerY + radiusY); y += 1) {
        for (let x = Math.max(0, centerX - radiusX); x <= Math.min(image.width - 1, centerX + radiusX); x += 1) {
          const offset = (y * image.width + x) * 4;
          red += pixels[offset] ?? 0;
          green += pixels[offset + 1] ?? 0;
          blue += pixels[offset + 2] ?? 0;
          count += 1;
        }
      }
      return { red: red / count, green: green / count, blue: blue / count };
    });
  }, { screenshotBase64, points });
};

const readTargetCell = async (page: Page, targetId: string) =>
  page.getByTestId("focus-distribution-panel").locator(`[data-focus-target-id="${targetId}"]`)
    .evaluate((element) => {
      const cell = element.closest("td");
      const row = cell?.closest("tr");
      if (!cell || !row) throw new Error(`Target ${targetId} is not placed in the Focus Distribution grid`);
      return {
        rowIndex: Array.from(row.parentElement?.children ?? []).indexOf(row),
        columnIndex: Array.from(row.children).indexOf(cell),
      };
    });

const readTargetMarkerOffset = async (page: Page, targetId: string) =>
  page.getByTestId("focus-distribution-panel")
    .locator(`[data-focus-target-id="${targetId}"]`)
    .evaluate((element) => ({
      x: (element as HTMLElement).style.getPropertyValue("--focus-distribution-target-marker-x"),
      y: (element as HTMLElement).style.getPropertyValue("--focus-distribution-target-marker-y"),
    }));

test("Macro depth targets, Focus Distribution, and Raw/Upright raster stay aligned", async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  await page.goto("/simulator/free/macro-depth-of-field");

  const scene = page.getByTestId("scene-canvas");
  const rtt = page.getByTestId("ground-glass-rtt");
  const rttCanvas = rtt.locator("canvas");
  const distribution = page.getByTestId("focus-distribution-panel");
  await expect(scene.locator("canvas")).toHaveCount(1);
  await expect(rtt.locator("canvas")).toHaveCount(1);
  await expect(rtt).toHaveAttribute("data-rtt-camera-ok", "true", { timeout: 60_000 });
  await expect(rtt).toHaveAttribute("data-rtt-resource-generation", /\d+/, { timeout: 60_000 });
  await expect(distribution.locator("[data-focus-target-id]")).toHaveCount(3);

  const rawMarkerOffsets = new Map<string, { x: string; y: string }>();
  for (const targetId of TARGET_IDS) {
    await expect.poll(() => readTargetCell(page, targetId)).toEqual({
      rowIndex: 1,
      columnIndex: TARGET_COLUMNS.raw[targetId],
    });
    rawMarkerOffsets.set(targetId, await readTargetMarkerOffset(page, targetId));
  }
  const rawRttImage = await captureGroundGlassOutput(page,
    rttCanvas,
    testInfo.outputPath("macro-depth-of-field-raw-webgl-canvas.png"),
  );
  const rawPatches = await readCanvasPatches(
    rttCanvas,
    rawRttImage.toString("base64"),
    SPECIMEN_PROFILE_V.map((v) => ({ u: 0.5, v })),
  );
  await testInfo.attach("macro-depth-of-field-raw-webgl-output", { body: rawRttImage, contentType: "image/png" });
  await page.screenshot({ path: testInfo.outputPath("macro-depth-of-field-raw-rtt.png"), animations: "disabled" });
  await page.screenshot({ path: testInfo.outputPath("macro-depth-of-field-raw.png") });

  await page.getByRole("radio", { name: "Upright Assist" }).check();
  await expect(page.getByTestId("focus-distribution-orientation")).toHaveText("Upright");
  await page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  }));
  for (const targetId of TARGET_IDS) {
    await expect.poll(() => readTargetCell(page, targetId)).toEqual({
      rowIndex: 1,
      columnIndex: TARGET_COLUMNS.upright[targetId],
    });
    const rawOffset = rawMarkerOffsets.get(targetId);
    const uprightOffset = await readTargetMarkerOffset(page, targetId);
    expect(rawOffset).toBeDefined();
    expect(uprightOffset.x).toBe(rawOffset?.x === "-3px" ? "3px" : rawOffset?.x === "3px" ? "-3px" : "0px");
    expect(uprightOffset.y).toBe(rawOffset?.y === "-3px" ? "3px" : rawOffset?.y === "3px" ? "-3px" : "0px");
  }
  const uprightRttImage = await captureGroundGlassOutput(page,
    rttCanvas,
    testInfo.outputPath("macro-depth-of-field-upright-webgl-canvas.png"),
  );
  const uprightPatches = await readCanvasPatches(
    rttCanvas,
    uprightRttImage.toString("base64"),
    SPECIMEN_PROFILE_V.map((v) => ({ u: 0.5, v: 1 - v })),
  );
  await testInfo.attach("macro-depth-of-field-upright-webgl-output", { body: uprightRttImage, contentType: "image/png" });
  await page.screenshot({ path: testInfo.outputPath("macro-depth-of-field-upright-rtt.png"), animations: "disabled" });
  await testInfo.attach("macro-depth-of-field-orientation-samples", {
    body: JSON.stringify({ rawPatches, uprightPatches }, null, 2),
    contentType: "application/json",
  });
  const patchLuminance = [...rawPatches, ...uprightPatches]
    .map(({ red, green, blue }) => (red + green + blue) / 3);
  expect(Math.max(...patchLuminance) - Math.min(...patchLuminance)).toBeGreaterThan(20);
  for (let index = 0; index < rawPatches.length; index += 1) {
    const raw = rawPatches[index];
    const upright = uprightPatches[index];
    expect(raw).toBeDefined();
    expect(upright).toBeDefined();
    expect(Math.abs(raw!.red - upright!.red)).toBeLessThanOrEqual(8);
    expect(Math.abs(raw!.green - upright!.green)).toBeLessThanOrEqual(8);
    expect(Math.abs(raw!.blue - upright!.blue)).toBeLessThanOrEqual(8);
  }
  await page.screenshot({ path: testInfo.outputPath("macro-depth-of-field-upright.png") });
});
