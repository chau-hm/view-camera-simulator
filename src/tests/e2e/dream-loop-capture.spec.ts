import { Buffer } from "node:buffer";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";
import { expect, test } from "@playwright/test";
import { architectureRiseScene } from "../../scenes/definitions/architecture-rise";

type DreamLoopManifest = {
  pilotId: string;
  sceneId: string;
  assetKey: string;
  optimizationSurface: {
    id: string;
    route: string;
    sceneSelector: string;
    canvasSelector: string;
  };
  capture: {
    viewport: { width: number; height: number };
    deviceScaleFactor: number;
    renderQuality: string;
    outputPath: string;
  };
};

test("Dream Loop pilot captures the ready Architecture Rise observer canvas", async ({ page }) => {
  test.skip(process.env.DREAM_LOOP_CAPTURE !== "1", "Run through dream-loop:capture.");

  const manifestPath = process.env.DREAM_LOOP_CAPTURE_MANIFEST;
  const outputPath = process.env.DREAM_LOOP_CAPTURE_OUTPUT;
  expect(manifestPath, "capture runner supplies the selected pilot manifest").toBeTruthy();
  expect(outputPath, "capture runner supplies an ignored output path").toBeTruthy();

  const manifest = JSON.parse(
    await readFile(manifestPath as string, "utf8"),
  ) as DreamLoopManifest;
  expect(manifest).toMatchObject({
    pilotId: "architecture-rise",
    sceneId: "architecture-rise",
    assetKey: "architecture-rise-subject",
    optimizationSurface: { id: "observer-scene-viewport" },
  });
  expect(manifest.capture.viewport.width).toBeGreaterThan(0);
  expect(manifest.capture.viewport.height).toBeGreaterThan(0);
  expect(manifest.capture.deviceScaleFactor).toBeGreaterThan(0);

  const outputRelative = relative(process.cwd(), resolve(outputPath as string));
  expect(outputRelative.startsWith(".." + sep)).toBe(false);
  expect(outputRelative.startsWith(".dream-loop" + sep)).toBe(true);
  await mkdir(dirname(outputPath as string), { recursive: true });

  await page.goto(manifest.optimizationSurface.route);
  expect(new URL(page.url()).pathname).toBe(manifest.optimizationSurface.route);
  expect(new URL(page.url()).search).toBe("");
  await expect(page).toHaveTitle(/.+/);

  const scene = page.locator(manifest.optimizationSurface.sceneSelector);
  await expect(scene).toBeVisible();
  await expect(scene).toHaveAttribute("data-scene-subject-id", manifest.sceneId);
  await expect(scene).toHaveAttribute("data-optics-fallback-applied", "false");
  await expect(scene).toHaveAttribute("data-view-focus", "scene");

  const renderQuality = page.getByLabel(/Render quality/i);
  await expect(renderQuality).toBeVisible();
  await renderQuality.selectOption(manifest.capture.renderQuality);
  const defaultObserverView = await scene.evaluate((element) => ({
    cameraPosition: element.getAttribute("data-observer-camera-position"),
    orbitTarget: element.getAttribute("data-orbit-target"),
  }));
  const focus = page.getByRole("slider", { name: "Focus distance" });
  const focusMinimum = await focus.getAttribute("min");
  expect(focusMinimum).not.toBeNull();
  await page.getByRole("button", { name: "Reset movements", exact: true }).click();
  await page.getByRole("button", { name: "Reset 3D view", exact: true }).click();
  await expect(scene).toHaveAttribute("data-view-focus", "scene");
  await expect(page.getByRole("slider", { name: "Rise" })).toHaveValue(
    String(architectureRiseScene.cameraPreset.frontRiseMm),
  );
  await expect(page.getByRole("slider", { name: "Tilt" })).toHaveValue(
    String(architectureRiseScene.cameraPreset.frontTiltDeg),
  );
  await expect(page.getByRole("slider", { name: "Swing" })).toHaveValue(
    String(architectureRiseScene.cameraPreset.frontSwingDeg),
  );
  await expect(focus).toHaveValue(focusMinimum as string);
  await expect(page.getByRole("radiogroup", { name: "Aperture" })).toHaveAttribute(
    "data-selected-aperture",
    String(architectureRiseScene.cameraPreset.aperture),
  );
  await expect(scene).toHaveAttribute(
    "data-observer-camera-position",
    defaultObserverView.cameraPosition as string,
  );
  await expect(scene).toHaveAttribute(
    "data-orbit-target",
    defaultObserverView.orbitTarget as string,
  );

  const canvas = scene.locator(manifest.optimizationSurface.canvasSelector);
  await expect(canvas).toHaveCount(1);
  await expect(canvas).toBeVisible();

  const hiddenOverlayControls = await canvas.evaluate((canvasElement) => {
    const canvasBounds = canvasElement.getBoundingClientRect();
    const controls = Array.from(
      document.querySelectorAll<HTMLElement>('button, a[href], [role="button"]'),
    );
    const hidden: string[] = [];
    for (const control of controls) {
      if (control === canvasElement || control.contains(canvasElement) || canvasElement.contains(control)) {
        continue;
      }
      const bounds = control.getBoundingClientRect();
      const overlapsCanvas =
        bounds.width > 0 &&
        bounds.height > 0 &&
        bounds.left < canvasBounds.right &&
        bounds.right > canvasBounds.left &&
        bounds.top < canvasBounds.bottom &&
        bounds.bottom > canvasBounds.top;
      if (!overlapsCanvas) continue;
      control.dataset.dreamLoopCaptureHidden = "true";
      hidden.push(control.getAttribute("aria-label") ?? control.textContent?.trim() ?? control.tagName);
    }
    const style = document.createElement("style");
    style.dataset.dreamLoopCaptureStyles = "true";
    style.textContent =
      '[data-dream-loop-capture-hidden="true"] { visibility: hidden !important; pointer-events: none !important; }';
    document.head.append(style);
    return hidden;
  });

  await page.evaluate(
    () =>
      new Promise<void>((resolveFrame) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolveFrame()));
      }),
  );
  const captureImage = await canvas.screenshot({ animations: "disabled" });
  const imageDataUrl =
    "data:image/png;base64," + Buffer.from(captureImage).toString("base64");
  const contentEvidence = await page.evaluate(async (dataUrl) => {
    const image = new Image();
    image.src = dataUrl;
    await image.decode();
    const probe = document.createElement("canvas");
    probe.width = image.naturalWidth;
    probe.height = image.naturalHeight;
    const context = probe.getContext("2d");
    if (!context || probe.width === 0 || probe.height === 0) {
      return {
        ready: false,
        width: probe.width,
        height: probe.height,
        distinctSampleColors: 0,
        nonDominantSampleFraction: 0,
      };
    }

    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, probe.width, probe.height).data;
    const colors = new Map<string, number>();
    const gridSize = 16;
    for (let row = 0; row < gridSize; row += 1) {
      for (let column = 0; column < gridSize; column += 1) {
        const x = Math.min(
          probe.width - 1,
          Math.floor(((column + 0.5) / gridSize) * probe.width),
        );
        const y = Math.min(
          probe.height - 1,
          Math.floor(((row + 0.5) / gridSize) * probe.height),
        );
        const offset = (y * probe.width + x) * 4;
        const color = [
          pixels[offset],
          pixels[offset + 1],
          pixels[offset + 2],
          pixels[offset + 3],
        ].join(",");
        colors.set(color, (colors.get(color) ?? 0) + 1);
      }
    }
    const sampleCount = gridSize * gridSize;
    const dominantCount = Math.max(...colors.values());
    const nonDominantSampleFraction = 1 - dominantCount / sampleCount;
    return {
      ready: colors.size > 4 && nonDominantSampleFraction > 0.08,
      width: probe.width,
      height: probe.height,
      distinctSampleColors: colors.size,
      nonDominantSampleFraction,
    };
  }, imageDataUrl);
  expect(contentEvidence).toMatchObject({ ready: true });

  const viewport = await page.evaluate(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
    devicePixelRatio: window.devicePixelRatio,
  }));
  expect(viewport).toEqual({
    width: manifest.capture.viewport.width,
    height: manifest.capture.viewport.height,
    devicePixelRatio: manifest.capture.deviceScaleFactor,
  });

  await writeFile(outputPath as string, captureImage);
  await writeFile(
    (outputPath as string) + ".json",
    JSON.stringify(
      {
        pilotId: manifest.pilotId,
        sceneId: manifest.sceneId,
        assetKey: manifest.assetKey,
        optimizationSurface: manifest.optimizationSurface.id,
        route: manifest.optimizationSurface.route,
        viewport,
        renderQuality: manifest.capture.renderQuality,
        canvas: contentEvidence,
        hiddenOverlayControls,
        captureBoundary: "registered observer scene canvas",
      },
      null,
      2,
    ),
  );
  console.log("Dream Loop observer capture: " + outputPath);
});
