import { Buffer } from "node:buffer";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";
import { expect, test } from "@playwright/test";
import { architectureRiseScene } from "../../scenes/definitions/architecture-rise";
import type { SceneCapacitySnapshot } from "../../render/sceneCapacityProfiling";
import { isDreamLoopSubjectCaptureReady } from "../helpers/dreamLoopCaptureReadiness";

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
    teachingOutputPath: string;
  };
};

test("Dream Loop pilot captures teaching and clean Architecture Rise observer views", async ({ page }) => {
  test.skip(process.env.DREAM_LOOP_CAPTURE !== "1", "Run through dream-loop:capture.");

  const manifestPath = process.env.DREAM_LOOP_CAPTURE_MANIFEST;
  const outputPath = process.env.DREAM_LOOP_CAPTURE_OUTPUT;
  const teachingOutputPath = process.env.DREAM_LOOP_CAPTURE_TEACHING_OUTPUT;
  expect(manifestPath, "capture runner supplies the selected pilot manifest").toBeTruthy();
  expect(outputPath, "capture runner supplies the clean observer output path").toBeTruthy();
  expect(teachingOutputPath, "capture runner supplies the teaching observer output path").toBeTruthy();

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

  const outputPaths = [outputPath as string, teachingOutputPath as string];
  expect(new Set(outputPaths).size).toBe(2);
  for (const output of outputPaths) {
    const outputRelative = relative(process.cwd(), resolve(output));
    expect(outputRelative.startsWith(".." + sep)).toBe(false);
    expect(outputRelative.startsWith(".dream-loop" + sep)).toBe(true);
    await mkdir(dirname(output), { recursive: true });
  }
  expect(resolve(outputPath as string)).toBe(resolve(process.cwd(), manifest.capture.outputPath));
  expect(resolve(teachingOutputPath as string)).toBe(
    resolve(process.cwd(), manifest.capture.teachingOutputPath),
  );

  const captureUrl = manifest.optimizationSurface.route + "?sceneCapacityProfiling=1";
  await page.goto(captureUrl);
  expect(new URL(page.url()).pathname).toBe(manifest.optimizationSurface.route);
  expect(new URL(page.url()).searchParams.get("sceneCapacityProfiling")).toBe("1");
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

  const capacitySnapshotElement = page.getByTestId("scene-capacity-snapshot");
  await expect(capacitySnapshotElement).toHaveCount(1);
  const readCapacitySnapshot = async (): Promise<SceneCapacitySnapshot | null> => {
    const text = await capacitySnapshotElement.textContent();
    if (!text || text.trim() === "null") return null;
    try {
      return JSON.parse(text) as SceneCapacitySnapshot;
    } catch {
      return null;
    }
  };
  await expect.poll(
    async () => isDreamLoopSubjectCaptureReady(
      await readCapacitySnapshot(),
      manifest.sceneId,
    ),
    {
      timeout: 20_000,
      message: "Expected renderable viewport subject metrics from the mounted Architecture Rise registered-subject root",
    },
  ).toBe(true);
  const subjectSnapshot = await readCapacitySnapshot();
  if (!isDreamLoopSubjectCaptureReady(subjectSnapshot, manifest.sceneId)) {
    throw new Error(
      "The mounted Architecture Rise subject did not provide renderable capacity evidence: " +
        JSON.stringify(subjectSnapshot),
    );
  }
  const viewportSubject = subjectSnapshot.viewportSubject;
  const subjectSnapshotIsInsideCanvas = await capacitySnapshotElement.evaluate((element) =>
    element.closest("canvas") !== null,
  );
  expect(subjectSnapshotIsInsideCanvas).toBe(false);

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

  const readDeterministicState = async () => ({
    sceneId: await scene.getAttribute("data-scene-subject-id"),
    opticsFallbackApplied: await scene.getAttribute("data-optics-fallback-applied"),
    viewFocus: await scene.getAttribute("data-view-focus"),
    cameraPosition: await scene.getAttribute("data-observer-camera-position"),
    orbitTarget: await scene.getAttribute("data-orbit-target"),
    rise: await page.getByRole("slider", { name: "Rise" }).inputValue(),
    tilt: await page.getByRole("slider", { name: "Tilt" }).inputValue(),
    swing: await page.getByRole("slider", { name: "Swing" }).inputValue(),
    focus: await focus.inputValue(),
    aperture: await page.getByRole("radiogroup", { name: "Aperture" })
      .getAttribute("data-selected-aperture"),
    renderQuality: await renderQuality.inputValue(),
  });
  const deterministicState = await readDeterministicState();
  const subjectEvidence = {
    sceneId: subjectSnapshot.sceneId,
    mounted: true,
    evidenceSource: "sceneCapacitySnapshot.viewportSubject from TeachingShadowParticipation subject root",
    objectCount: viewportSubject.objectCount,
    meshCount: viewportSubject.meshCount,
    renderableMeshCount: viewportSubject.renderableMeshCount,
    effectiveTriangleCount: viewportSubject.effectiveTriangleCount,
    renderableEffectiveTriangleCount: viewportSubject.renderableEffectiveTriangleCount,
  };

  const overlayGroup = await getOverlayGroup(page);
  const overlayButtons = overlayGroup.locator("button[aria-pressed]");
  const overlayButtonCount = await overlayButtons.count();
  expect(overlayButtonCount).toBeGreaterThanOrEqual(4);
  const readOverlayState = async () => overlayButtons.evaluateAll((buttons) =>
    buttons.map((button) => ({
      label: button.getAttribute("aria-label") ?? button.textContent?.trim() ?? button.tagName,
      visible: button.getAttribute("aria-pressed") === "true",
    })),
  );
  const teachingOverlays = await readOverlayState();
  expect(teachingOverlays.some((overlay) => overlay.visible)).toBe(true);
  const teachingOverlayLabels = teachingOverlays.map((overlay) => overlay.label.toLowerCase());
  for (const expectedOverlay of ["focus plane", "dof region", "legends", "optical geometry"]) {
    expect(teachingOverlayLabels.some((label) => label.includes(expectedOverlay))).toBe(true);
  }
  for (const expectedActiveOverlay of ["focus plane", "dof region", "optical geometry"]) {
    const overlay = teachingOverlays.find((choice) =>
      choice.label.toLowerCase().includes(expectedActiveOverlay),
    );
    expect(overlay?.visible).toBe(true);
  }

  const captureCanvas = async () => {
    // Locator screenshots include positioned DOM siblings. Temporarily hide
    // overlapping controls, never scene geometry, then restore them before
    // the next public-UI interaction.
    const hiddenDomControls = await canvas.evaluate((canvasElement) => {
      const canvasBounds = canvasElement.getBoundingClientRect();
      const candidates = Array.from(
        document.querySelectorAll<HTMLElement>(
          'button, a[href], [role="button"], .scene-overlay-responsive',
        ),
      );
      const hidden: string[] = [];
      for (const candidate of candidates) {
        if (
          candidate === canvasElement ||
          candidate.contains(canvasElement) ||
          canvasElement.contains(candidate)
        ) {
          continue;
        }
        const bounds = candidate.getBoundingClientRect();
        const overlapsCanvas =
          bounds.width > 0 &&
          bounds.height > 0 &&
          bounds.left < canvasBounds.right &&
          bounds.right > canvasBounds.left &&
          bounds.top < canvasBounds.bottom &&
          bounds.bottom > canvasBounds.top;
        if (!overlapsCanvas) continue;
        candidate.dataset.dreamLoopCaptureHidden = "true";
        hidden.push(
          candidate.getAttribute("aria-label") ??
            candidate.textContent?.trim() ??
            candidate.className.toString() ??
            candidate.tagName,
        );
      }
      const style = document.createElement("style");
      style.dataset.dreamLoopCaptureStyles = "true";
      style.textContent =
        '[data-dream-loop-capture-hidden="true"] { visibility: hidden !important; pointer-events: none !important; }';
      document.head.append(style);
      return hidden;
    });

    try {
      await page.evaluate(
        () =>
          new Promise<void>((resolveFrame) => {
            requestAnimationFrame(() => requestAnimationFrame(() => resolveFrame()));
          }),
      );
      const image = await canvas.screenshot({ animations: "disabled" });
      const imageDataUrl = "data:image/png;base64," + Buffer.from(image).toString("base64");
      const content = await page.evaluate(async (dataUrl) => {
      const screenshot = new Image();
      screenshot.src = dataUrl;
      await screenshot.decode();
      const probe = document.createElement("canvas");
      probe.width = screenshot.naturalWidth;
      probe.height = screenshot.naturalHeight;
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

      context.drawImage(screenshot, 0, 0);
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
      // Pixel diversity is only a canvas sanity check; subject readiness is
      // established independently from the mounted registered-subject root.
      expect(content).toMatchObject({ ready: true });
      return { image, content, hiddenDomControls };
    } finally {
      await page.evaluate(() => {
        document.querySelector('[data-dream-loop-capture-styles="true"]')?.remove();
        document
          .querySelectorAll<HTMLElement>('[data-dream-loop-capture-hidden="true"]')
          .forEach((element) => delete element.dataset.dreamLoopCaptureHidden);
      });
    }
  };

  const writeCapture = async (
    path: string,
    view: "observer-teaching" | "observer-clean",
    image: Buffer,
    overlays: Awaited<ReturnType<typeof readOverlayState>>,
    content: Awaited<ReturnType<typeof captureCanvas>>["content"],
    hiddenDomControls: string[],
  ) => {
    await writeFile(path, image);
    await writeFile(
      path + ".json",
      JSON.stringify(
        {
          pilotId: manifest.pilotId,
          sceneId: manifest.sceneId,
          assetKey: manifest.assetKey,
          optimizationSurface: manifest.optimizationSurface.id,
          captureRole: view === "observer-clean" ? "optimization-target" : "regression-only",
          view,
          route: manifest.optimizationSurface.route,
          viewport,
          renderQuality: manifest.capture.renderQuality,
          deterministicState,
          subject: subjectEvidence,
          overlays,
          canvas: content,
          hiddenDomControls,
          captureBoundary: "observer canvas locator screenshot with overlapping DOM controls temporarily hidden; scene geometry remains rendered",
        },
        null,
        2,
      ),
    );
    console.log("Dream Loop " + view + " capture: " + path);
  };

  const teachingCapture = await captureCanvas();
  await writeCapture(
    teachingOutputPath as string,
    "observer-teaching",
    teachingCapture.image,
    teachingOverlays,
    teachingCapture.content,
    teachingCapture.hiddenDomControls,
  );

  const activeOverlayButtons = overlayGroup.locator('button[aria-pressed="true"]');
  while (await activeOverlayButtons.count() > 0) {
    const previousCount = await activeOverlayButtons.count();
    await activeOverlayButtons.first().click();
    await expect(activeOverlayButtons).toHaveCount(previousCount - 1);
  }
  await expect(activeOverlayButtons).toHaveCount(0);
  const cleanOverlays = await readOverlayState();
  expect(cleanOverlays.every((overlay) => !overlay.visible)).toBe(true);

  const stateAfterOverlayToggles = await readDeterministicState();
  expect(stateAfterOverlayToggles).toEqual(deterministicState);
  const subjectAfterOverlayToggles = await readCapacitySnapshot();
  expect(isDreamLoopSubjectCaptureReady(subjectAfterOverlayToggles, manifest.sceneId)).toBe(true);
  expect(subjectAfterOverlayToggles?.viewportSubject).toEqual(subjectSnapshot.viewportSubject);

  const cleanCapture = await captureCanvas();
  await writeCapture(
    outputPath as string,
    "observer-clean",
    cleanCapture.image,
    cleanOverlays,
    cleanCapture.content,
    cleanCapture.hiddenDomControls,
  );
});

async function getOverlayGroup(page: import("@playwright/test").Page) {
  const inlineGroup = page.getByTestId("scene-overlay-inline");
  if (await inlineGroup.count() === 1) {
    await expect(inlineGroup).toBeVisible();
    return inlineGroup;
  }

  const collapsedGroup = page.getByTestId("scene-overlay-collapsed");
  if (await collapsedGroup.count() === 0) {
    const openOverlays = page.getByRole("button", { name: /View overlays/i });
    await expect(openOverlays).toBeVisible();
    await openOverlays.click();
  }
  await expect(collapsedGroup).toBeVisible();
  return collapsedGroup;
}
