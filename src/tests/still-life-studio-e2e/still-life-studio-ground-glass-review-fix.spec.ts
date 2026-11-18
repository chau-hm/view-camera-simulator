import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import * as THREE from "three";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { setRangeDirectOnGrid } from "../e2e/helpers/rangeInput";
import {
  getStillLifeObjectBoundsMm,
  resolveStillLifeStudioPlan,
} from "../../scenes/stillLifeStudioVariation";
import { stillLifeStudioScene } from "../../scenes/definitions/still-life-studio";
import {
  DEFAULT_PRESENTATION_LIGHTING_PLACEMENT,
  TEACHING_PRESENTATION_LIGHTING_PROFILE,
} from "../../render/presentationLightingContract";
import { STILL_LIFE_STUDIO_PRESENTATION_LIGHTING } from "../../scenes/presentation/stillLifeStudio";
import {
  createSceneVariantIdentity,
  resolveSceneVariationDescriptor,
} from "../../scenes/sceneVariation";
import {
  stillLifeStudioBackdrop,
  stillLifeStudioFocusTileDimensionsMm,
  stillLifeStudioFocusTargets,
  stillLifeStudioFloor,
  stillLifeStudioSceneBounds,
  stillLifeStudioTable,
} from "../../scenes/stillLifeStudioGeometry";

const basePath = (process.env.STILL_LIFE_STUDIO_BASE_PATH ?? "/").replace(/\/$/, "");
const scenePath = `${basePath}/simulator/free/still-life-studio`;
const evidenceDirectory = path.resolve("docs/render-quality/evidence/still-life-studio/review-fix-round-1");
const capturePhase = process.env.STILL_LIFE_STUDIO_CAPTURE_PHASE ?? "baseline";
const seed = 284719;
const representativeSeeds = [0, 284719, 4294967295, 2130322642] as const;
const sceneLightingIntent = capturePhase === "baseline"
  ? {
      profileId: TEACHING_PRESENTATION_LIGHTING_PROFILE.id,
      placementSource: "shared-default",
      targetWorld: DEFAULT_PRESENTATION_LIGHTING_PLACEMENT.targetWorld,
      keyOffsetWorld: DEFAULT_PRESENTATION_LIGHTING_PLACEMENT.keyOffsetWorld,
    }
  : {
      profileId: TEACHING_PRESENTATION_LIGHTING_PROFILE.id,
      placementSource: "scene-registration",
      targetMm: STILL_LIFE_STUDIO_PRESENTATION_LIGHTING.targetMm,
      keyOffsetWorld: STILL_LIFE_STUDIO_PRESENTATION_LIGHTING.keyOffsetWorld,
    };

const waitForCompletedFrame = async (rtt: Locator, previous?: string | null): Promise<string> => {
  if (previous !== undefined) {
    await expect.poll(() => rtt.getAttribute("data-frame-request-id"), { timeout: 120_000 }).not.toBe(previous);
  }
  await expect.poll(async () => {
    const [requested, completed] = await Promise.all([
      rtt.getAttribute("data-frame-request-id"),
      rtt.getAttribute("data-last-completed-request-id"),
    ]);
    return Boolean(requested && requested === completed);
  }, { timeout: 120_000 }).toBe(true);
  await expect(rtt).toHaveAttribute("data-frame-result-status", "completed");
  await expect(rtt).toHaveAttribute("data-rtt-camera-ok", "true");
  return (await rtt.getAttribute("data-frame-request-id")) ?? "";
};

const readAttributes = async (locator: Locator, names: readonly string[]) =>
  Object.fromEntries(await Promise.all(names.map(async (name) => [
    name,
    await locator.getAttribute(`data-${name}`),
  ])));

const navigateSpaTo = async (page: Page, route: string): Promise<void> => {
  await page.evaluate((nextRoute) => {
    window.history.pushState({}, "", nextRoute);
    window.dispatchEvent(new PopStateEvent("popstate", { state: window.history.state }));
  }, route);
};

const clearObserverOverlays = async (page: Page, scene: Locator): Promise<void> => {
  const trigger = page.getByRole("button", { name: /View overlays/i });
  for (let attempt = 0; attempt < 6; attempt += 1) {
    let group = page.getByTestId("scene-overlay-inline");
    if (await group.count() !== 1) {
      group = page.getByTestId("scene-overlay-collapsed");
      if (await group.count() === 0) await trigger.click();
    }
    await expect(group).toBeVisible();
    const active = group.locator('button[aria-pressed="true"]');
    if (await active.count() === 0) break;
    await active.first().click();
  }
  await expect(scene).toHaveAttribute("data-optical-geometry-visible", "false");
  await expect(scene).toHaveAttribute("data-focus-overlay-visible", "false");
  await expect(scene).toHaveAttribute("data-dof-overlay-visible", "false");
  if (await trigger.count() === 1 && await trigger.getAttribute("aria-expanded") === "true") await trigger.click();
};

const captureObserverCanvas = async (page: Page, scene: Locator): Promise<Buffer> => {
  const canvas = scene.locator("canvas").first();
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error("Still-Life Studio Observer canvas is not visible");
  const backupAttribute = "data-still-life-review-capture-style";
  await canvas.evaluate((targetCanvas, backupKey) => {
    const targetRect = targetCanvas.getBoundingClientRect();
    document.querySelectorAll<HTMLElement>("body *").forEach((element) => {
      if (element === targetCanvas || element.contains(targetCanvas) || targetCanvas.contains(element)) return;
      const style = window.getComputedStyle(element);
      if (style.display === "none" || style.visibility === "hidden") return;
      const rect = element.getBoundingClientRect();
      const overlaps = rect.right > targetRect.left && rect.left < targetRect.right &&
        rect.bottom > targetRect.top && rect.top < targetRect.bottom;
      if (!overlaps || rect.width <= 0 || rect.height <= 0) return;
      element.setAttribute(backupKey, element.getAttribute("style") ?? "__no-inline-style__");
      element.style.setProperty("visibility", "hidden", "important");
    });
  }, backupAttribute);
  try {
    return await canvas.screenshot({ animations: "disabled" });
  } finally {
    await page.evaluate((backupKey) => {
      document.querySelectorAll<HTMLElement>(`[${backupKey}]`).forEach((element) => {
        const previous = element.getAttribute(backupKey);
        if (previous === "__no-inline-style__") element.removeAttribute("style");
        else if (previous !== null) element.setAttribute("style", previous);
        element.removeAttribute(backupKey);
      });
    }, backupAttribute);
  }
};

const runtimeAttributes = [
  "frame-request-id",
  "last-completed-request-id",
  "frame-result-status",
  "rtt-camera-ok",
  "rtt-camera-near-world",
  "rtt-camera-far-world",
  "rtt-projection-determinant",
  "rtt-projection-matrix",
  "rtt-camera-position",
  "rtt-camera-up",
  "rtt-camera-forward",
  "rtt-preview-mode",
  "rtt-raw-debug",
  "rtt-dof-processing-enabled",
  "rtt-dof-model",
  "rtt-dof-mode",
  "rtt-depth-available",
  "rtt-uniforms-finite",
  "rtt-natural-illumination-enabled",
  "rtt-natural-illumination-kind",
  "rtt-natural-illumination-state",
  "rtt-ground-glass-illuminance-gain",
  "rtt-coverage-enabled",
  "rtt-coverage-kind",
  "rtt-coverage-radius-mm",
  "rtt-raw-variance",
  "rtt-final-variance",
  "rtt-raw-non-background",
  "rtt-final-non-background",
  "rtt-logical-width",
  "rtt-logical-height",
  "rtt-internal-width",
  "rtt-internal-height",
  "rtt-sampled-film-width-mm",
  "rtt-sampled-film-height-mm",
] as const;

const sceneGeometryAttributes = [
  "camera-lens-center-world",
  "camera-film-center-world",
  "optical-axis-origin-world-mm",
  "optical-axis-forward-world",
  "film-plane-normal-world",
  "film-plane-width-mm",
  "film-plane-height-mm",
  "film-plane-corners-world-mm",
] as const;

const vectorFromAttribute = (value: string | null): [number, number, number] => {
  if (value === null) throw new Error("Missing runtime camera vector");
  const vector = value.split(",").map(Number);
  if (vector.length !== 3 || vector.some((component) => !Number.isFinite(component))) {
    throw new Error(`Invalid runtime camera vector: ${value}`);
  }
  return vector as [number, number, number];
};

const projectBounds = (
  camera: THREE.PerspectiveCamera,
  bounds: { min: { x: number; y: number; z: number }; max: { x: number; y: number; z: number } },
  orientation: "raw" | "upright",
) => {
  const projected: Array<{ x: number; y: number; z: number }> = [];
  for (const x of [bounds.min.x, bounds.max.x]) {
    for (const y of [bounds.min.y, bounds.max.y]) {
      for (const z of [bounds.min.z, bounds.max.z]) {
        const point = new THREE.Vector3(x * 0.001, y * 0.001, z * 0.001).project(camera);
        const uprightX = point.x * 0.5 + 0.5;
        const uprightY = 0.5 - point.y * 0.5;
        projected.push(orientation === "raw"
          ? { x: 1 - uprightX, y: 1 - uprightY, z: point.z }
          : { x: uprightX, y: uprightY, z: point.z });
      }
    }
  }
  return {
    minX: Math.min(...projected.map(({ x }) => x)),
    maxX: Math.max(...projected.map(({ x }) => x)),
    minY: Math.min(...projected.map(({ y }) => y)),
    maxY: Math.max(...projected.map(({ y }) => y)),
    minDepth: Math.min(...projected.map(({ z }) => z)),
    maxDepth: Math.max(...projected.map(({ z }) => z)),
    fullyInsideImage: projected.every(({ x, y, z }) => x >= 0 && x <= 1 && y >= 0 && y <= 1 && z >= -1 && z <= 1),
  };
};

const projectedGeometry = (sceneGeometry: Record<string, string | null>, cameraRuntime: Record<string, string | null>, orientation: "raw" | "upright") => {
  const camera = new THREE.PerspectiveCamera();
  camera.position.fromArray(vectorFromAttribute(cameraRuntime["rtt-camera-position"] ?? null));
  camera.up.fromArray(vectorFromAttribute(cameraRuntime["rtt-camera-up"] ?? null));
  const forward = new THREE.Vector3(...vectorFromAttribute(cameraRuntime["rtt-camera-forward"] ?? null));
  camera.lookAt(camera.position.clone().add(forward));
  camera.updateMatrixWorld(true);
  const projectionMatrix = cameraRuntime["rtt-projection-matrix"]?.split(",").map(Number) ?? [];
  if (projectionMatrix.length !== 16 || projectionMatrix.some((value) => !Number.isFinite(value))) {
    throw new Error("Missing actual Ground Glass projection matrix");
  }
  camera.projectionMatrix.fromArray(projectionMatrix);

  return projectedGeometryForSeed(sceneGeometry, cameraRuntime, orientation, seed, camera);
};

const projectedGeometryForSeed = (
  sceneGeometry: Record<string, string | null>,
  cameraRuntime: Record<string, string | null>,
  orientation: "raw" | "upright",
  sceneSeed: number,
  camera = (() => {
    const resolved = new THREE.PerspectiveCamera();
    resolved.position.fromArray(vectorFromAttribute(cameraRuntime["rtt-camera-position"] ?? null));
    resolved.up.fromArray(vectorFromAttribute(cameraRuntime["rtt-camera-up"] ?? null));
    const forward = new THREE.Vector3(...vectorFromAttribute(cameraRuntime["rtt-camera-forward"] ?? null));
    resolved.lookAt(resolved.position.clone().add(forward));
    resolved.updateMatrixWorld(true);
    const matrix = cameraRuntime["rtt-projection-matrix"]?.split(",").map(Number) ?? [];
    if (matrix.length !== 16 || matrix.some((value) => !Number.isFinite(value))) {
      throw new Error("Missing actual Ground Glass projection matrix");
    }
    resolved.projectionMatrix.fromArray(matrix);
    return resolved;
  })(),
) => {
  const projectionMatrix = cameraRuntime["rtt-projection-matrix"]?.split(",").map(Number) ?? [];
  if (projectionMatrix.length !== 16 || projectionMatrix.some((value) => !Number.isFinite(value))) {
    throw new Error("Missing actual Ground Glass projection matrix");
  }
  const plan = resolveStillLifeStudioPlan(resolveSceneVariationDescriptor(
    stillLifeStudioScene,
    createSceneVariantIdentity(stillLifeStudioScene.id, sceneSeed, 1),
  )!);
  const objects = plan.objects.map((placement) => ({
    id: placement.id,
    family: placement.family,
    positionMm: placement.positionMm,
    dimensionsMm: placement.dimensionsMm,
    rotationYDeg: placement.rotationYDeg,
    boundsMm: getStillLifeObjectBoundsMm(placement),
    projectedBounds: projectBounds(camera, getStillLifeObjectBoundsMm(placement), orientation),
  }));
  const cornersRaw = sceneGeometry["film-plane-corners-world-mm"];
  if (cornersRaw === null || cornersRaw === undefined) throw new Error("Missing actual film plane corners");
  const filmCorners = JSON.parse(cornersRaw) as Record<string, { x: number; y: number; z: number }>;
  const tableTopBounds = {
    min: { x: -stillLifeStudioTable.sizeMm.width / 2, y: stillLifeStudioTable.topYmm, z: stillLifeStudioTable.boundsXZMm.min.z },
    max: { x: stillLifeStudioTable.sizeMm.width / 2, y: stillLifeStudioTable.topYmm, z: stillLifeStudioTable.boundsXZMm.max.z },
  };
  const tableBounds = {
    min: { x: -stillLifeStudioTable.sizeMm.width / 2, y: stillLifeStudioTable.topYmm - stillLifeStudioTable.sizeMm.height, z: stillLifeStudioTable.boundsXZMm.min.z },
    max: { x: stillLifeStudioTable.sizeMm.width / 2, y: stillLifeStudioTable.topYmm, z: stillLifeStudioTable.boundsXZMm.max.z },
  };
  return {
    opticalAxisDirectionWorld: sceneGeometry["optical-axis-forward-world"],
    filmPlane: {
      dimensionsMm: {
        width: Number(sceneGeometry["film-plane-width-mm"]),
        height: Number(sceneGeometry["film-plane-height-mm"]),
      },
      cornersWorldMm: filmCorners,
    },
    actualGroundGlassCamera: {
      positionWorld: cameraRuntime["rtt-camera-position"],
      upWorld: cameraRuntime["rtt-camera-up"],
      forwardWorld: cameraRuntime["rtt-camera-forward"],
      nearWorld: Number(cameraRuntime["rtt-camera-near-world"]),
      farWorld: Number(cameraRuntime["rtt-camera-far-world"]),
      projectionMatrixColumnMajor: projectionMatrix,
      configurationOk: cameraRuntime["rtt-camera-ok"] === "true",
      projectionDeterminant: Number(cameraRuntime["rtt-projection-determinant"]),
    },
    table: {
      topYmm: stillLifeStudioTable.topYmm,
      verticalDifferenceFromLensMm: stillLifeStudioTable.topYmm - Number((sceneGeometry["camera-lens-center-world"] ?? "0,0,0").split(",")[1]),
      topProjectedBounds: projectBounds(camera, tableTopBounds, orientation),
      slabProjectedBounds: projectBounds(camera, tableBounds, orientation),
    },
    backdrop: {
      ...stillLifeStudioBackdrop,
      projectedBounds: projectBounds(camera, {
        min: {
          x: stillLifeStudioBackdrop.centerMm.x - stillLifeStudioBackdrop.sizeMm.width / 2,
          y: stillLifeStudioBackdrop.centerMm.y - stillLifeStudioBackdrop.sizeMm.height / 2,
          z: stillLifeStudioBackdrop.centerMm.z - stillLifeStudioBackdrop.sizeMm.depth / 2,
        },
        max: {
          x: stillLifeStudioBackdrop.centerMm.x + stillLifeStudioBackdrop.sizeMm.width / 2,
          y: stillLifeStudioBackdrop.centerMm.y + stillLifeStudioBackdrop.sizeMm.height / 2,
          z: stillLifeStudioBackdrop.centerMm.z + stillLifeStudioBackdrop.sizeMm.depth / 2,
        },
      }, orientation),
    },
    floor: stillLifeStudioFloor,
    sceneBounds: stillLifeStudioSceneBounds,
    focusReferences: stillLifeStudioFocusTargets.map((target) => ({
      id: target.id,
      positionMm: target.worldPosition,
      projectedBounds: projectBounds(camera, {
        min: {
          x: target.worldPosition.x - stillLifeStudioFocusTileDimensionsMm.width / 2,
          y: stillLifeStudioTable.topYmm,
          z: target.worldPosition.z,
        },
        max: {
          x: target.worldPosition.x + stillLifeStudioFocusTileDimensionsMm.width / 2,
          y: stillLifeStudioTable.topYmm + stillLifeStudioFocusTileDimensionsMm.height,
          z: target.worldPosition.z,
        },
      }, orientation),
    })),
    objects,
    planner: { compositionId: plan.compositionId, fallbackUsed: plan.fallbackUsed },
  };
};

const captureCase = async (
  page: Page,
  rtt: Locator,
  canvas: Locator,
  input: { id: string; orientation: "raw" | "upright"; dofBypass: boolean; aperture: number },
  previousFrame: string,
) => {
  if (input.orientation === "raw") await page.getByRole("radio", { name: "Raw Ground Glass" }).check();
  else await page.getByRole("radio", { name: "Upright Assist" }).check();
  await page.getByRole("radiogroup", { name: "Aperture" })
    .getByRole("radio", { name: `f/${input.aperture}` }).check();
  const bypass = page.getByLabel("Raw RTT — bypass DOF");
  if (input.dofBypass) await bypass.check();
  else await bypass.uncheck();
  const frameRequestId = await waitForCompletedFrame(rtt, previousFrame);
  await expect(rtt).toHaveAttribute("data-rtt-preview-mode", input.orientation);
  await expect(rtt).toHaveAttribute("data-rtt-raw-debug", String(input.dofBypass));
  const screenshot = await canvas.screenshot({
    animations: "disabled",
    style: `
      .groundglass-view-control,
      .btn--viewport-action,
      [data-testid="ground-glass-focus-label"],
      [data-testid="ground-glass-image-layer"] + div { visibility: hidden !important; }
    `,
  });
  const screenshotPath = path.join(evidenceDirectory, `${capturePhase}-${input.id}.png`);
  await writeFile(screenshotPath, screenshot);
  const [canvasBounds, runtime] = await Promise.all([
    canvas.boundingBox(),
    readAttributes(rtt, runtimeAttributes),
  ]);
  return {
    ...input,
    frameRequestId,
    screenshot: path.basename(screenshotPath),
    screenshotCssBounds: canvasBounds,
    runtime,
  };
};

test("captures a mode-correct Still-Life Studio Ground Glass diagnostic matrix", async ({ page }, testInfo) => {
  test.skip(basePath !== "", "The fixed review-fix diagnostic matrix is captured at the root deployment base.");
  test.setTimeout(480_000);
  await mkdir(evidenceDirectory, { recursive: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const response = await page.goto(
    `${scenePath}?seed=${seed}&sv=1&rttDiagnostics=1&dofProfiling=1`,
  );
  expect(response?.ok()).toBeTruthy();

  const scene = page.getByTestId("scene-canvas");
  const rtt = page.getByTestId("ground-glass-rtt");
  const canvas = rtt.locator("canvas");
  await expect(scene).toHaveAttribute("data-scene-subject-id", "still-life-studio");
  await expect(scene).toHaveAttribute("data-optics-fallback-applied", "false");
  await expect(rtt).toHaveAttribute("data-mounted-renderer-family", "webgl-renderer");
  await expect(rtt).toHaveAttribute("data-actual-execution-api", "webgl2");
  await expect(page.getByTestId("scene-variation-controls")).toHaveAttribute("data-active-seed", String(seed));
  await page.getByLabel("Render quality").selectOption("standard");
  await setRangeDirectOnGrid(page, "Focus distance", 4100);
  await page.getByRole("checkbox", { name: "Grid" }).uncheck();
  const focusLoupeStage = page.locator("[data-focus-loupe-active]");
  await expect(focusLoupeStage).toHaveAttribute("data-focus-loupe-active", "false");

  const initialFrame = await waitForCompletedFrame(rtt);
  const filmGeometry = await readAttributes(scene, sceneGeometryAttributes);
  const initialState = {
    route: page.url(),
    seed,
    schemaVersion: 1,
    focusDistanceMm: Number(await page.getByRole("slider", { name: "Focus distance" }).inputValue()),
    quality: await page.getByLabel("Render quality").inputValue(),
    groundGlassGridEnabled: await page.getByRole("checkbox", { name: "Grid" }).isChecked(),
    focusLoupeActive: await focusLoupeStage.getAttribute("data-focus-loupe-active"),
    viewport: await page.evaluate(() => ({ width: innerWidth, height: innerHeight, dpr: devicePixelRatio })),
    filmGeometry,
    initialFrame,
  };

  const cases = [
    { id: "raw-f5_6", orientation: "raw", dofBypass: false, aperture: 5.6 },
    { id: "raw-f11", orientation: "raw", dofBypass: false, aperture: 11 },
    { id: "raw-f22", orientation: "raw", dofBypass: false, aperture: 22 },
    { id: "upright-f11", orientation: "upright", dofBypass: false, aperture: 11 },
    { id: "raw-dof-bypass-f11", orientation: "raw", dofBypass: true, aperture: 11 },
  ] as const;
  let previousFrame = initialFrame;
  const captures = [];
  for (const diagnosticCase of cases) {
    const capture = await captureCase(page, rtt, canvas, diagnosticCase, previousFrame);
    previousFrame = capture.frameRequestId;
    captures.push(capture);
  }

  const rawReference = captures.find(({ id }) => id === "raw-f11");
  const uprightReference = captures.find(({ id }) => id === "upright-f11");
  if (!rawReference || !uprightReference) throw new Error("Missing orientation reference captures");
  const projectedBounds = {
    raw: projectedGeometry(filmGeometry, rawReference.runtime, "raw"),
    upright: projectedGeometry(filmGeometry, uprightReference.runtime, "upright"),
  };

  expect(errors).toEqual([]);
  const report = {
    phase: capturePhase,
    purpose: capturePhase === "baseline"
      ? "Pre-correction Ground Glass mode/framing diagnosis"
      : "Post-correction Ground Glass mode/framing qualification",
    capturedAt: new Date().toISOString(),
    runtime: "Chromium software WebGL2 preview; submit timings are not hardware GPU performance evidence",
    setup: initialState,
    sceneLightingIntent,
    projectedBounds,
    cases: captures,
    pageErrors: errors,
  };
  const matrixReportPath = path.join(evidenceDirectory, `${capturePhase}-ground-glass-matrix.json`);
  await writeFile(matrixReportPath, `${JSON.stringify(report, null, 2)}\n`);

  const rows = (await Promise.all(captures.map(async (capture) => {
    const image = await readFile(path.join(evidenceDirectory, capture.screenshot));
    return `<figure><figcaption>${capture.orientation.toUpperCase()} · ${capture.dofBypass ? "DOF BYPASS" : "DOF ON"} · f/${capture.aperture}</figcaption><img src="data:image/png;base64,${image.toString("base64")}" /></figure>`;
  }))).join("");
  const sheetPage = await page.context().newPage();
  await sheetPage.setViewportSize({ width: 1440, height: 1000 });
  await sheetPage.setContent(`<!doctype html><html><head><style>
    *{box-sizing:border-box}body{margin:0;padding:12px;background:#f3f5f7;color:#202a35;font:14px Arial,sans-serif}
    main{display:grid;grid-template-columns:repeat(2,max-content);gap:12px}figure{margin:0;padding:8px;background:white;border:1px solid #cbd2da}
    figcaption{height:24px;font-weight:600}img{display:block;image-rendering:auto}
  </style></head><body><main>${rows}</main></body></html>`, { waitUntil: "load" });
  await sheetPage.evaluate(async () => Promise.all(Array.from(document.images, (image) => image.decode())));
  const matrixSheetPath = path.join(evidenceDirectory, `${capturePhase}-ground-glass-contact-sheet.png`);
  await sheetPage.locator("main").screenshot({ path: matrixSheetPath, animations: "disabled" });
  await sheetPage.close();
  await testInfo.attach(`${capturePhase}-ground-glass-contact-sheet`, {
    path: matrixSheetPath,
    contentType: "image/png",
  });

  let representativePreviousFrame = previousFrame;
  const representativeCaptures = [];
  const representativeObserverScreenshots = new Map<number, string>();
  for (const representativeSeed of representativeSeeds) {
    await navigateSpaTo(page, `${scenePath}?seed=${representativeSeed}&sv=1&rttDiagnostics=1&dofProfiling=1`);
    await expect(page.getByTestId("scene-variation-controls")).toHaveAttribute("data-active-seed", String(representativeSeed));
    representativePreviousFrame = await waitForCompletedFrame(rtt, representativePreviousFrame);
    await setRangeDirectOnGrid(page, "Focus distance", 4100);
    await page.getByLabel("Render quality").selectOption("standard");
    const activeScene = page.getByTestId("scene-canvas");
    const observerCanvas = activeScene.locator("canvas").first();
    const observerBounds = await observerCanvas.boundingBox();
    if (!observerBounds) throw new Error(`Seed ${representativeSeed} Observer canvas is not visible`);
    expect(observerBounds.width).toBeCloseTo(514, 0);
    await clearObserverOverlays(page, activeScene);
    const observerFilename = `${capturePhase}-observer-seed-${representativeSeed}.png`;
    await writeFile(
      path.join(evidenceDirectory, observerFilename),
      await captureObserverCanvas(page, activeScene),
    );
    representativeObserverScreenshots.set(representativeSeed, observerFilename);

    const plan = resolveStillLifeStudioPlan(resolveSceneVariationDescriptor(
      stillLifeStudioScene,
      createSceneVariantIdentity(stillLifeStudioScene.id, representativeSeed, 1),
    )!);
    const stateCases = capturePhase === "baseline"
      ? [{ id: "raw-f11", orientation: "raw", aperture: 11, dofBypass: false }] as const
      : [
          { id: "raw-f5_6", orientation: "raw", aperture: 5.6, dofBypass: false },
          { id: "raw-f11", orientation: "raw", aperture: 11, dofBypass: false },
          { id: "upright-f11", orientation: "upright", aperture: 11, dofBypass: false },
          { id: "raw-dof-bypass-f11", orientation: "raw", aperture: 11, dofBypass: true },
        ] as const;

    for (const stateCase of stateCases) {
      await page.getByRole("radio", {
        name: stateCase.orientation === "raw" ? "Raw Ground Glass" : "Upright Assist",
      }).check();
      await page.getByRole("radiogroup", { name: "Aperture" })
        .getByRole("radio", { name: `f/${stateCase.aperture}` }).check();
      const bypass = page.getByLabel("Raw RTT — bypass DOF");
      if (stateCase.dofBypass !== await bypass.isChecked()) {
        if (stateCase.dofBypass) await bypass.check();
        else await bypass.uncheck();
      }
      representativePreviousFrame = await waitForCompletedFrame(rtt, representativePreviousFrame);
      await expect(rtt).toHaveAttribute("data-rtt-preview-mode", stateCase.orientation);
      await expect(rtt).toHaveAttribute("data-rtt-raw-debug", String(stateCase.dofBypass));

      const sceneAttributes = await readAttributes(activeScene, sceneGeometryAttributes);
      const runtime = await readAttributes(rtt, runtimeAttributes);
      expect(runtime["rtt-dof-processing-enabled"]).toBe(String(!stateCase.dofBypass));
      expect(runtime["frame-request-id"]).toBe(runtime["last-completed-request-id"]);
      const bytes = await canvas.screenshot({
        animations: "disabled",
        style: `
          .groundglass-view-control,
          .btn--viewport-action,
          [data-testid="ground-glass-focus-label"],
          [data-testid="ground-glass-image-layer"] + div { visibility: hidden !important; }
        `,
      });
      const filename = `${capturePhase}-representative-${representativeSeed}-${stateCase.id}.png`;
      await writeFile(path.join(evidenceDirectory, filename), bytes);
      representativeCaptures.push({
        id: stateCase.id,
        seed: representativeSeed,
        schemaVersion: 1,
        compositionId: plan.compositionId,
        families: plan.objects.map(({ family }) => family),
        planSignature: createHash("sha256").update(JSON.stringify(plan)).digest("hex"),
        fallbackUsed: plan.fallbackUsed,
        aperture: stateCase.aperture,
        focusDistanceMm: 4100,
        orientation: stateCase.orientation,
        dofBypass: stateCase.dofBypass,
        screenshot: filename,
        cameraConfigurationOk: runtime["rtt-camera-ok"] === "true",
        frameRequestId: runtime["frame-request-id"],
        lastCompletedRequestId: runtime["last-completed-request-id"],
        sceneGeometry: sceneAttributes,
        runtime,
        projectedBounds: projectedGeometryForSeed(sceneAttributes, runtime, stateCase.orientation, representativeSeed),
      });
    }
  }
  const representativeReportPath = path.join(evidenceDirectory, `${capturePhase}-four-seed-ground-glass.json`);
  await writeFile(representativeReportPath, `${JSON.stringify({
    phase: capturePhase,
    capturedAt: new Date().toISOString(),
    seedSchema: 1,
    viewport: initialState.viewport,
    focusDistanceMm: 4100,
    apertures: capturePhase === "baseline" ? [11] : [5.6, 11],
    quality: "standard",
    orientations: capturePhase === "baseline" ? ["raw"] : ["raw", "upright"],
    dofBypassModes: capturePhase === "baseline" ? [false] : [false, true],
    groundGlassGridEnabled: false,
    focusLoupeActive: false,
    captures: representativeCaptures,
  }, null, 2)}\n`);
  const representativeRows = (await Promise.all(representativeCaptures.map(async (capture) => {
    const image = await readFile(path.join(evidenceDirectory, capture.screenshot));
    const label = capture.dofBypass
      ? `Raw RTT bypass · f/${capture.aperture}`
      : `${capture.orientation === "raw" ? "Raw" : "Upright"} · DOF on · f/${capture.aperture}`;
    return `<figure><figcaption>Seed ${capture.seed} · ${capture.compositionId} · ${capture.families.join(", ")}<br />${label}</figcaption><img src="data:image/png;base64,${image.toString("base64")}" /></figure>`;
  }))).join("");
  const representativeSheetPage = await page.context().newPage();
  await representativeSheetPage.setContent(`<!doctype html><html><head><style>
    *{box-sizing:border-box}body{margin:0;padding:12px;background:#f3f5f7;color:#202a35;font:14px Arial,sans-serif}
    main{display:grid;grid-template-columns:repeat(2,max-content);gap:12px}figure{margin:0;padding:8px;background:white;border:1px solid #cbd2da}
    figcaption{height:48px;font-weight:600;line-height:1.35}img{display:block;image-rendering:auto}
  </style></head><body><main>${representativeRows}</main></body></html>`, { waitUntil: "load" });
  await representativeSheetPage.evaluate(async () => Promise.all(Array.from(document.images, (image) => image.decode())));
  const representativeSheetPath = path.join(evidenceDirectory, `${capturePhase}-four-seed-ground-glass.png`);
  await representativeSheetPage.locator("main").screenshot({ path: representativeSheetPath, animations: "disabled" });
  for (const representativeSeed of representativeSeeds) {
    const seedCaptures = representativeCaptures.filter(({ seed: capturedSeed }) => capturedSeed === representativeSeed);
    const observerFilename = representativeObserverScreenshots.get(representativeSeed);
    if (!observerFilename) throw new Error(`Missing Observer capture for seed ${representativeSeed}`);
    const observerBytes = await readFile(path.join(evidenceDirectory, observerFilename));
    const comparisonCaptures = [
      { label: "Observer · orbit camera", bytes: observerBytes },
      ...seedCaptures
        .filter(({ id, dofBypass }) => id === "raw-f11" || id === "upright-f11" || dofBypass)
        .map(async (capture) => ({
          label: capture.dofBypass
            ? "Ground Glass · Raw RTT bypass · f/11"
            : `Ground Glass · ${capture.orientation === "raw" ? "Raw" : "Upright"} · DOF on · f/11`,
          bytes: await readFile(path.join(evidenceDirectory, capture.screenshot)),
        })),
    ];
    const resolvedComparisons = await Promise.all(comparisonCaptures.map(async (capture) => capture));
    const tiles = await Promise.all(resolvedComparisons.map(async ({ label, bytes }) =>
      `<figure><figcaption>${label}</figcaption><img src="data:image/png;base64,${bytes.toString("base64")}" /></figure>`));
    await representativeSheetPage.setContent(`<!doctype html><html><head><style>
      *{box-sizing:border-box}body{margin:0;padding:12px;background:#f3f5f7;color:#202a35;font:14px Arial,sans-serif}
      h1{font-size:18px;margin:0 0 10px}main{display:grid;grid-template-columns:repeat(2,max-content);gap:12px}
      figure{margin:0;padding:8px;background:white;border:1px solid #cbd2da}figcaption{height:28px;font-weight:600}
      img{display:block;image-rendering:auto}
    </style></head><body><h1>Seed ${representativeSeed} · schema v1 · focus 4100 mm</h1><main>${tiles.join("")}</main></body></html>`, { waitUntil: "load" });
    await representativeSheetPage.evaluate(async () => Promise.all(Array.from(document.images, (image) => image.decode())));
    const seedSheetPath = path.join(evidenceDirectory, `${capturePhase}-seed-${representativeSeed}-comparison.png`);
    await representativeSheetPage.locator("body").screenshot({ path: seedSheetPath, animations: "disabled" });
    await testInfo.attach(`${capturePhase}-seed-${representativeSeed}-comparison`, {
      path: seedSheetPath,
      contentType: "image/png",
    });
  }
  await representativeSheetPage.close();
  await testInfo.attach(`${capturePhase}-four-seed-ground-glass`, {
    path: representativeSheetPath,
    contentType: "image/png",
  });
});
