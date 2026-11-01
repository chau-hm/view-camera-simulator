import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import {
  createGroundGlassM6bCalibrationSource,
  evaluateGroundGlassM6bAlignment,
  GROUND_GLASS_M6B_MARKER_RADIUS_SOURCE_PX,
  fingerprintGroundGlassM6bPresentationState,
  GROUND_GLASS_M6B_CALIBRATION_LANDMARKS,
  GROUND_GLASS_M6B_GRID_SQUARE_MM,
  resolveGroundGlassM6bExpectedLandmarks,
} from "../../render/groundGlassPhysicalOverlayConformance";
import {
  encodeGroundGlassLinearChannelToSrgb,
  evaluateGroundGlassPresentationReference,
} from "../../render/webgpu/groundGlassPresentationReference";
import {
  evaluateGroundGlassM6bCaptureSpatialConformance,
  evaluateGroundGlassM6bSpatialConformance,
  GROUND_GLASS_M6B_MAXIMUM_SPATIAL_ERROR_PX,
  GROUND_GLASS_M6B_MAXIMUM_SPATIAL_RMS_PX,
  GROUND_GLASS_M6B_REQUIRED_CAPTURE_IDS,
  GROUND_GLASS_M6B_SPATIAL_GATE_REVISION,
} from "../../render/groundGlassM6bSpatialConformance";
import type {
  GroundGlassM6bPresentationEffectOverrides,
  GroundGlassM6bPresentationFixtureEvidence,
} from "../../render/webgpu/groundGlassWebGpuTestSeam";
import { mapGroundGlassInspectionWindowToRttSourceCrop } from "../../render/groundGlassInspectionWindow";
import { CAMERA_CONSTANTS } from "../../utils/constants";
import { readFreshElementBounds } from "./helpers/groundGlass";
import {
  groundGlassM7fCaptureProvenance,
  isGroundGlassM7fRequired,
  writeGroundGlassM7fCapture,
} from "./helpers/groundGlassM7fEvidence";

const nativeWebGpuRequired = process.env.GROUND_GLASS_NATIVE_WEBGPU_REQUIRED === "1";
const m6PresentationRequired = process.env.GROUND_GLASS_WEBGPU_M6_PRESENTATION_REQUIRED === "1";
const m7fRequired = isGroundGlassM7fRequired();
const m6NativeRunRequired = m6PresentationRequired &&
  process.env.GROUND_GLASS_WEBGPU_M6_R187_QUALIFICATION_REQUIRED === "1";

const paneFor = (page: Page) => page.locator('[data-testid="ground-glass-rtt"][data-rtt-channel="default"]');
const pilotFor = (page: Page) => page.getByTestId("ground-glass-webgpu-pilot");
const stageFor = (page: Page) => page.getByLabel("GroundGlassViewport").locator("[data-zoomed]");

const waitForCurrentFrame = async (page: Page): Promise<void> => {
  const pane = paneFor(page);
  await expect.poll(async () => {
    const requestId = await pane.getAttribute("data-frame-request-id");
    return Boolean(requestId &&
      requestId === await pane.getAttribute("data-last-completed-request-id") &&
      await pane.getAttribute("data-frame-result-status") === "completed");
  }, { timeout: 150_000 }).toBe(true);
};

const attachEvidence = async (testInfo: TestInfo, name: string, body: Buffer | string, contentType: string) => {
  const path = testInfo.outputPath(name);
  await writeFile(path, body);
  await testInfo.attach(name, { path, contentType });
};

const alignmentErrorSvg = (capture: Awaited<ReturnType<typeof captureAlignment>>): string => {
  const markers = capture.alignment.measurements.flatMap((measurement) => {
    if (measurement.status !== "measured") return [];
    const lines = [
      measurement.measuredImagePx && `<line x1="${measurement.expectedImagePx.x}" y1="${measurement.expectedImagePx.y}" x2="${measurement.measuredImagePx.x}" y2="${measurement.measuredImagePx.y}" stroke="#ff6b6b" stroke-width="0.7"/>`,
      measurement.measuredTargetPx && `<line x1="${measurement.expectedTargetPx.x}" y1="${measurement.expectedTargetPx.y}" x2="${measurement.measuredTargetPx.x}" y2="${measurement.measuredTargetPx.y}" stroke="#4dabf7" stroke-width="0.7"/>`,
      measurement.expectedGridIntersectionPx && measurement.measuredGridIntersectionPx && `<line x1="${measurement.expectedGridIntersectionPx.x}" y1="${measurement.expectedGridIntersectionPx.y}" x2="${measurement.measuredGridIntersectionPx.x}" y2="${measurement.measuredGridIntersectionPx.y}" stroke="#69db7c" stroke-width="0.7"/>`,
    ].filter((line): line is string => Boolean(line)).join("");
    return [`<g>${lines}
      <path d="M ${measurement.expectedImagePx.x - 3} ${measurement.expectedImagePx.y} h 6 M ${measurement.expectedImagePx.x} ${measurement.expectedImagePx.y - 3} v 6" stroke="#fff" stroke-width="0.7"/>
      <circle cx="${measurement.measuredImagePx?.x ?? measurement.expectedImagePx.x}" cy="${measurement.measuredImagePx?.y ?? measurement.expectedImagePx.y}" r="2" fill="#ff6b6b"/>
      <circle cx="${measurement.measuredTargetPx?.x ?? measurement.expectedTargetPx.x}" cy="${measurement.measuredTargetPx?.y ?? measurement.expectedTargetPx.y}" r="2" fill="#4dabf7"/>
      <text x="${measurement.expectedImagePx.x + 4}" y="${measurement.expectedImagePx.y - 4}" fill="#fff" font-size="7">${measurement.id}</text>
    </g>`];
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${capture.geometry.widthPx}" height="${capture.geometry.heightPx}" viewBox="0 0 ${capture.geometry.widthPx} ${capture.geometry.heightPx}">
    <rect width="100%" height="100%" fill="#15171b"/>
    <text x="8" y="14" fill="#fff" font-size="10">M6B measured alignment errors in CSS content-box coordinates · max ${capture.alignment.maximumErrorPx?.toFixed(3) ?? "n/a"} px</text>
    <g>${markers}</g>
    <g transform="translate(8 ${capture.geometry.heightPx - 8})" font-size="7">
      <text fill="#fff">white = expected · </text><text x="70" fill="#ff6b6b">red = rendered image</text><text x="170" fill="#4dabf7">blue = Stage target</text><text x="265" fill="#69db7c">green = physical grid</text>
    </g>
  </svg>`;
};

const sourceToOutputSamplingSvg = (oracle: Awaited<ReturnType<typeof runPixelOracle>>): string => {
  const sampleMarks = oracle.samples.map((sample) => {
    const [red = 128, green = 128, blue = 128] = sample.expectedSrgbRgb;
    const color = `rgb(${red},${green},${blue})`;
    const sourceX = 60 + (sample.sourceTexelPx.x + 0.5) * 390 / oracle.sourceDimensions.widthPx;
    const sourceY = 80 + (sample.sourceTexelPx.y + 0.5) * 390 / oracle.sourceDimensions.heightPx;
    const outputX = 550 + (sample.displayPixel.x + 0.5) * 390 / oracle.outputDimensions.widthPx;
    const outputY = 80 + (sample.displayPixel.y + 0.5) * 312 / oracle.outputDimensions.heightPx;
    return `<line x1="${sourceX}" y1="${sourceY}" x2="${outputX}" y2="${outputY}" stroke="${color}" stroke-opacity="0.28" stroke-width="0.6"/>
      <circle cx="${sourceX}" cy="${sourceY}" r="2.3" fill="${color}" stroke="#fff" stroke-width="0.4"/>
      <circle cx="${outputX}" cy="${outputY}" r="2.3" fill="${color}" stroke="#fff" stroke-width="0.4"/>`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="470" viewBox="0 0 1000 470">
    <rect width="1000" height="470" fill="#15171b"/>
    <text x="60" y="28" fill="#fff" font-size="16">M6B nearest source sampling to visible canvas pixel (${oracle.samples.length} paired samples)</text>
    <text x="60" y="55" fill="#adb5bd" font-size="12">linear source texel center → measured output pixel center; color denotes expected sRGB sample</text>
    <rect x="60" y="80" width="390" height="390" fill="#272b30" stroke="#868e96"/>
    <rect x="550" y="80" width="390" height="312" fill="#272b30" stroke="#868e96"/>
    <text x="60" y="72" fill="#fff" font-size="11">source ${oracle.sourceDimensions.widthPx} × ${oracle.sourceDimensions.heightPx}</text>
    <text x="550" y="72" fill="#fff" font-size="11">visible canvas output (${oracle.sourceSampling})</text>
    <g>${sampleMarks}</g>
  </svg>`;
};

const readFixtureEvidence = async (page: Page): Promise<GroundGlassM6bPresentationFixtureEvidence | null> =>
  page.evaluate(() => window.__groundGlassWebGpuM3TestControl?.m6bCalibrationFixture?.presentationEvidence ?? null);

const setFixtureEffectOverrides = async (
  page: Page,
  overrides: GroundGlassM6bPresentationEffectOverrides,
): Promise<void> => page.evaluate((effectOverrides) => {
  const fixture = window.__groundGlassWebGpuM3TestControl?.m6bCalibrationFixture;
  if (!fixture) throw new Error("M6B test control disappeared before effect case");
  // Isolate the named operation while retaining the adapter-resolved film window.
  fixture.presentationState = "neutral";
  fixture.effectOverrides = effectOverrides;
  fixture.presentationEvidence = null;
}, overrides);

const resetFixturePresentationToNeutral = async (page: Page): Promise<void> => page.evaluate(() => {
  const fixture = window.__groundGlassWebGpuM3TestControl?.m6bCalibrationFixture;
  if (!fixture) throw new Error("M6B test control disappeared before neutral reset");
  fixture.presentationState = "neutral";
  fixture.effectOverrides = undefined;
  fixture.presentationEvidence = null;
});

const readStageGeometry = async (page: Page) => stageFor(page).evaluate((element) => {
  const stage = element as HTMLDivElement;
  const grid = stage.querySelector('[data-testid="ground-glass-grid"]') as HTMLElement | null;
  const gridStyle = grid ? getComputedStyle(grid) : null;
  return {
    widthPx: stage.clientWidth,
    heightPx: stage.clientHeight,
    devicePixelRatio: window.devicePixelRatio,
    borderLeftPx: stage.clientLeft,
    borderTopPx: stage.clientTop,
    physicalGrid: grid && gridStyle ? {
      mode: grid.dataset.gridMode ?? "unknown",
      spacingXPx: Number(grid.dataset.gridSpacingXPx),
      spacingYPx: Number(grid.dataset.gridSpacingYPx),
      cssBackgroundSize: gridStyle.backgroundSize,
      cssBackgroundPosition: gridStyle.backgroundPosition,
    } : null,
    rect: (() => {
      const rect = stage.getBoundingClientRect();
      return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
    })(),
    inspectionWindow: {
      active: stage.getAttribute("data-focus-loupe-active") === "true",
      centerU: Number(stage.getAttribute("data-focus-loupe-center-u")),
      centerV: Number(stage.getAttribute("data-focus-loupe-center-v")),
      widthFraction: Number(stage.getAttribute("data-focus-loupe-window-width")),
      heightFraction: Number(stage.getAttribute("data-focus-loupe-window-height")),
    },
  };
});

const captureScreenshot = async (page: Page, testInfo: TestInfo, name: string) => {
  const canvas = pilotFor(page).locator("canvas");
  const compositedPng = await canvas.screenshot({ animations: "disabled" });
  await attachEvidence(testInfo, `${name}-composited.png`, compositedPng, "image/png");
  const canvasDataUrl = await canvas.evaluate((element) =>
    (element as HTMLCanvasElement).toDataURL("image/png"));
  const prefix = "data:image/png;base64,";
  if (!canvasDataUrl.startsWith(prefix)) {
    throw new Error("The native WebGPU canvas did not expose its presented bitmap as PNG");
  }
  const png = Buffer.from(canvasDataUrl.slice(prefix.length), "base64");
  await attachEvidence(testInfo, `${name}-canvas-bitmap.png`, png, "image/png");
  return png;
};

const detectLandmarkCenters = async (
  page: Page,
  png: Buffer,
  input: Readonly<{
    points: readonly Readonly<{ id: string; color: string; x: number; y: number; visible: boolean }>[];
    widthCssPx: number;
    heightCssPx: number;
    markerRadiusSourcePx: number;
  }>,
) => page.evaluate(async ({ base64, points, widthCssPx, heightCssPx, markerRadiusSourcePx }) => {
  const image = new Image();
  image.src = `data:image/png;base64,${base64}`;
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not decode the M6B calibration image capture");
  context.drawImage(image, 0, 0);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  const matches = {
    red: (r: number, g: number, b: number) => r > 150 && r > g * 1.8 && r > b * 1.8,
    green: (r: number, g: number, b: number) => g > 150 && g > r * 1.7 && g > b * 1.5,
    blue: (r: number, g: number, b: number) => b > 150 && b > r * 1.7 && b > g * 1.35,
    yellow: (r: number, g: number, b: number) => r > 150 && g > 130 && b < 120,
    magenta: (r: number, g: number, b: number) => r > 150 && b > 130 && g < 120,
  };
  const centers: Record<string, { x: number; y: number; count: number } | null> = {};
  const scaleX = canvas.width / widthCssPx;
  const scaleY = canvas.height / heightCssPx;
  // Markers retain a fixed radius in the source texture across crop windows.
  // Search the marker core only so nearby color-oracle swatches cannot bias it.
  const radiusCssPx = Math.max(2, markerRadiusSourcePx - 2);
  for (const point of points) {
    const accepts = matches[point.color as keyof typeof matches];
    if (!point.visible || !accepts) {
      centers[point.id] = null;
      continue;
    }
    const centerX = point.x * scaleX;
    const centerY = point.y * scaleY;
    const radiusX = radiusCssPx * scaleX;
    const radiusY = radiusCssPx * scaleY;
    let sumX = 0;
    let sumY = 0;
    let count = 0;
    for (let y = Math.max(0, Math.floor(centerY - radiusY)); y <= Math.min(canvas.height - 1, Math.ceil(centerY + radiusY)); y += 1) {
      for (let x = Math.max(0, Math.floor(centerX - radiusX)); x <= Math.min(canvas.width - 1, Math.ceil(centerX + radiusX)); x += 1) {
        const offset = (y * canvas.width + x) * 4;
        if (accepts(pixels[offset] ?? 0, pixels[offset + 1] ?? 0, pixels[offset + 2] ?? 0)) {
          sumX += x;
          sumY += y;
          count += 1;
        }
      }
    }
    centers[point.id] = count >= 4 ? { x: sumX / count, y: sumY / count, count } : null;
  }
  return { widthPx: canvas.width, heightPx: canvas.height, centers };
}, {
  base64: png.toString("base64"),
  ...input,
});

const measureGridRaster = async (
  page: Page,
  gridVisiblePng: Buffer,
  gridHiddenPng: Buffer,
  expectedPoints: readonly Readonly<{ id: string; x: number; y: number; visible: boolean }>[],
) => {
  const geometry = await readStageGeometry(page);
  return page.evaluate(async ({ visibleBase64, hiddenBase64, points, borderLeftPx, borderTopPx, rect }) => {
    const decode = async (base64: string) => {
      const image = new Image();
      image.src = `data:image/png;base64,${base64}`;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Could not compare M6B physical-grid captures");
      context.drawImage(image, 0, 0);
      return context.getImageData(0, 0, canvas.width, canvas.height);
    };
    const visible = await decode(visibleBase64);
    const hidden = await decode(hiddenBase64);
    if (visible.width !== hidden.width || visible.height !== hidden.height) {
      throw new Error("Physical-grid captures have different screenshot dimensions");
    }
    const xScores = new Float64Array(visible.width);
    const yScores = new Float64Array(visible.height);
    for (let y = 0; y < visible.height; y += 1) {
      for (let x = 0; x < visible.width; x += 1) {
        const offset = (y * visible.width + x) * 4;
        const delta = Math.max(
          Math.abs((visible.data[offset] ?? 0) - (hidden.data[offset] ?? 0)),
          Math.abs((visible.data[offset + 1] ?? 0) - (hidden.data[offset + 1] ?? 0)),
          Math.abs((visible.data[offset + 2] ?? 0) - (hidden.data[offset + 2] ?? 0)),
        );
        if (delta > 3) {
          xScores[x] += 1;
          yScores[y] += 1;
        }
      }
    }
    const scaleX = visible.width / rect.width;
    const scaleY = visible.height / rect.height;
    const findAxis = (scores: Float64Array, target: number, radius: number, minSupport: number) => {
      let best = -1;
      let bestScore = minSupport;
      for (let coordinate = Math.max(0, Math.round(target - radius));
        coordinate <= Math.min(scores.length - 1, Math.round(target + radius)); coordinate += 1) {
        if ((scores[coordinate] ?? 0) > bestScore) {
          best = coordinate;
          bestScore = scores[coordinate] ?? 0;
        }
      }
      return best < 0 ? null : best;
    };
    return Object.fromEntries(points.map((point) => {
      if (!point.visible) return [point.id, null];
      const x = findAxis(xScores, (borderLeftPx + point.x) * scaleX, 3 * scaleX, visible.height * 0.45);
      const y = findAxis(yScores, (borderTopPx + point.y) * scaleY, 3 * scaleY, visible.width * 0.45);
      return [point.id, x === null || y === null
        ? null
        // Raster coordinates identify pixel cells; convert their centers,
        // matching the image-centroid measurement above.
        : { x: (x + 0.5) / scaleX - borderLeftPx, y: (y + 0.5) / scaleY - borderTopPx }];
    }));
  }, {
    visibleBase64: gridVisiblePng.toString("base64"),
    hiddenBase64: gridHiddenPng.toString("base64"),
    points: expectedPoints,
    borderLeftPx: geometry.borderLeftPx,
    borderTopPx: geometry.borderTopPx,
    rect: geometry.rect,
  });
};

const captureAlignment = async (
  page: Page,
  testInfo: TestInfo,
  name: string,
  previousInternalTargetSizePx: Readonly<{ widthPx: number; heightPx: number }> | null = null,
) => {
  const pane = paneFor(page);
  const stage = stageFor(page);
  const grid = stage.getByTestId("ground-glass-grid");
  const geometry = await readStageGeometry(page);
  const previewMode = await page.getByRole("radio", { name: "Raw Ground Glass", exact: true }).isChecked()
    ? "raw" as const
    : "upright" as const;
  const expected = resolveGroundGlassM6bExpectedLandmarks({
    filmWidthMm: CAMERA_CONSTANTS.filmWidthMm,
    filmHeightMm: CAMERA_CONSTANTS.filmHeightMm,
    gridSquareMm: GROUND_GLASS_M6B_GRID_SQUARE_MM,
    displayWidthPx: geometry.widthPx,
    displayHeightPx: geometry.heightPx,
    inspectionWindow: geometry.inspectionWindow,
    previewMode,
  });
  const png = await captureScreenshot(page, testInfo, `${name}.png`);
  const raster = await detectLandmarkCenters(page, png, {
    points: expected.map((landmark) => ({
      id: landmark.id,
      color: GROUND_GLASS_M6B_CALIBRATION_LANDMARKS.find((entry) => entry.id === landmark.id)?.color ?? "",
      x: landmark.cssContentBoxPx.x,
      y: landmark.cssContentBoxPx.y,
      visible: landmark.visibleInCrop,
    })),
    widthCssPx: geometry.widthPx,
    heightCssPx: geometry.heightPx,
    markerRadiusSourcePx: GROUND_GLASS_M6B_MARKER_RADIUS_SOURCE_PX,
  });
  const canvasBounds = await pilotFor(page).locator("canvas").evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
  });
  const stageContentOrigin = {
    x: geometry.rect.left + geometry.borderLeftPx * geometry.rect.width / (geometry.widthPx + 2 * geometry.borderLeftPx),
    y: geometry.rect.top + geometry.borderTopPx * geometry.rect.height / (geometry.heightPx + 2 * geometry.borderTopPx),
  };
  const imageScale = {
    x: canvasBounds.width / raster.widthPx,
    y: canvasBounds.height / raster.heightPx,
  };
  const measuredImageById = Object.fromEntries(expected.map((landmark) => {
    const point = raster.centers[landmark.id];
    return [landmark.id, point
      ? {
          x: (point.x + 0.5) * imageScale.x + canvasBounds.left - stageContentOrigin.x,
          y: (point.y + 0.5) * imageScale.y + canvasBounds.top - stageContentOrigin.y,
        }
      : null];
  }));
  const measuredTargetById = Object.fromEntries(await stage.locator('[data-testid="ground-glass-calibration-target"]').evaluateAll((elements) => {
    const stageElement = elements[0]?.closest("[data-zoomed]");
    if (!stageElement) return [];
    const stage = stageElement as HTMLDivElement;
    const stageRect = stage.getBoundingClientRect();
    const scaleX = stage.offsetWidth > 0 ? stageRect.width / stage.offsetWidth : 1;
    const scaleY = stage.offsetHeight > 0 ? stageRect.height / stage.offsetHeight : 1;
    const contentLeft = stageRect.left + stage.clientLeft * scaleX;
    const contentTop = stageRect.top + stage.clientTop * scaleY;
    return elements.map((element) => {
      const target = element as HTMLElement;
      const rect = target.getBoundingClientRect();
      const id = target.dataset.calibrationLandmarkId ?? "";
      return [id, target.dataset.calibrationVisible === "true"
        ? { x: (rect.left + rect.width / 2 - contentLeft) / scaleX, y: (rect.top + rect.height / 2 - contentTop) / scaleY }
        : null];
    });
  }));
  const gridPreviousVisibility = await grid.evaluate((element) => (element as HTMLElement).style.visibility);
  const gridVisiblePng = await stage.screenshot({ animations: "disabled" });
  await grid.evaluate((element) => { (element as HTMLElement).style.visibility = "hidden"; });
  const gridHiddenPng = await stage.screenshot({ animations: "disabled" });
  await grid.evaluate((element, visibility) => { (element as HTMLElement).style.visibility = visibility; }, gridPreviousVisibility);
  await attachEvidence(testInfo, `${name}-stage.png`, gridVisiblePng, "image/png");
  const measuredGridById = await measureGridRaster(page, gridVisiblePng, gridHiddenPng,
    expected.map((landmark) => ({ id: landmark.id, ...landmark.cssContentBoxPx, visible: landmark.visibleInCrop && landmark.onGridIntersection })));
  const alignment = evaluateGroundGlassM6bAlignment({
    expected,
    measuredImageById,
    measuredTargetById,
    measuredGridById,
  });
  const identity = {
    requestId: await pane.getAttribute("data-frame-request-id"),
    rendererGenerationId: await pane.getAttribute("data-renderer-generation"),
    targetWidthPx: Number(await pilotFor(page).getAttribute("data-target-width")),
    targetHeightPx: Number(await pilotFor(page).getAttribute("data-target-height")),
    outputWidthPx: Number(await pilotFor(page).getAttribute("data-presentation-output-width")),
    outputHeightPx: Number(await pilotFor(page).getAttribute("data-presentation-output-height")),
  };
  const evidence = await readFixtureEvidence(page);
  expect(evidence).not.toBeNull();
  expect(evidence?.requestId).toBe(identity.requestId);
  expect(evidence?.rendererGenerationId).toBe(identity.rendererGenerationId);
  expect(evidence?.sceneId).toBe("architecture-rise");
  expect(evidence?.sourceDataFingerprint).toBe(createGroundGlassM6bCalibrationSource({
    inspectionWindow: mapGroundGlassInspectionWindowToRttSourceCrop(evidence!.sourceCrop, evidence!.previewMode),
    previewMode: evidence!.previewMode,
  }).sourceFingerprint);
  expect(evidence?.presentationStateFingerprint)
    .toBe(fingerprintGroundGlassM6bPresentationState(evidence?.presentationState));
  expect(evidence?.actualExecutionApi).toBe("webgpu");
  expect(evidence?.internalFallback).toBe("none");
  expect(await pilotFor(page).getAttribute("data-presentation-source")).toBe("m6b-calibration-fixture");
  const spatialConformanceInput = {
    captureId: name,
    captureName: name,
    previewMode,
    focusLoupeActive: geometry.inspectionWindow.active,
    crop: geometry.inspectionWindow,
    displaySizePx: { widthPx: geometry.widthPx, heightPx: geometry.heightPx },
    internalTargetSizePx: { widthPx: identity.targetWidthPx, heightPx: identity.targetHeightPx },
    previousInternalTargetSizePx,
    requestId: identity.requestId,
    channelId: evidence?.channelId ?? null,
    sceneId: evidence?.sceneId ?? null,
    rendererGenerationId: identity.rendererGenerationId,
    expectedLandmarks: expected,
    minimumMeasuredLandmarkCount: expected.filter(({ visibleInCrop }) => visibleInCrop).length,
    maximumSpatialErrorPx: GROUND_GLASS_M6B_MAXIMUM_SPATIAL_ERROR_PX,
    maximumSpatialRmsPx: GROUND_GLASS_M6B_MAXIMUM_SPATIAL_RMS_PX,
    alignment,
  } as const;
  const spatialConformance = evaluateGroundGlassM6bCaptureSpatialConformance(spatialConformanceInput);
  const result = { name, previewMode, geometry, expected, raster, alignment, identity, evidence, png, spatialConformanceInput, spatialConformance };
  await attachEvidence(testInfo, `${name}-measurements.json`, JSON.stringify({
    previewMode,
    geometry,
    expected,
    raster,
    identity,
    presentationEvidence: evidence,
    alignment,
    spatialConformance,
  }, null, 2), "application/json");
  return result;
};

const sampleCanvasLocations = async (
  page: Page,
  png: Buffer,
  displayPoints: readonly Readonly<{ id: string; u: number; v: number }>[],
) => page.evaluate(async ({ base64, points }) => {
  const image = new Image();
  image.src = `data:image/png;base64,${base64}`;
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not read the final M6 canvas pixels");
  context.drawImage(image, 0, 0);
  const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
    return points.map((point) => {
    const x = Math.max(0, Math.min(canvas.width - 1, Math.round(point.u * (canvas.width - 1))));
    const y = Math.max(0, Math.min(canvas.height - 1, Math.round(point.v * (canvas.height - 1))));
    const offset = (y * canvas.width + x) * 4;
    return {
      id: point.id,
      x,
      y,
      widthPx: canvas.width,
      heightPx: canvas.height,
      rgba: [data[offset] ?? 0, data[offset + 1] ?? 0, data[offset + 2] ?? 0, data[offset + 3] ?? 0],
    };
  });
}, { base64: png.toString("base64"), points: displayPoints });

const runPixelOracle = async (page: Page, png: Buffer, evidence: GroundGlassM6bPresentationFixtureEvidence) => {
  const texture = createGroundGlassM6bCalibrationSource({
    inspectionWindow: mapGroundGlassInspectionWindowToRttSourceCrop(evidence.sourceCrop, evidence.previewMode),
    previewMode: evidence.previewMode,
  });
  const sampleDefinitions = [
    ...texture.swatches.map((swatch) => ({
      id: swatch.id,
      sourceUvTopOrigin: swatch.sourceUvTopOrigin,
      kind: "color-swatch" as const,
    })),
    ...texture.fieldProbes.filter((probe) => probe.visibleInCrop).map((probe) => ({
      id: probe.id,
      sourceUvTopOrigin: probe.sourceUvTopOrigin,
      kind: "uniform-field" as const,
    })),
    ...texture.samplingBoundaries.map((boundary) => ({
      id: boundary.id,
      sourceUvTopOrigin: boundary.sourceUvTopOrigin,
      kind: "sampling-boundary" as const,
      expectedNearestTexel: boundary.expectedNearestTexel,
      adjacentTexel: boundary.adjacentTexel,
    })),
  ];
  const displayPoints = sampleDefinitions.map((sample) => ({
    id: sample.id,
    ...(evidence.previewMode === "raw"
      ? { u: 1 - sample.sourceUvTopOrigin.u, v: 1 - sample.sourceUvTopOrigin.v }
      : { u: sample.sourceUvTopOrigin.u, v: sample.sourceUvTopOrigin.v }),
  }));
  const measured = await sampleCanvasLocations(page, png, displayPoints);
  const samples = measured.map((observation) => {
    const swatch = texture.swatches.find((entry) => entry.id === observation.id);
    const fieldProbe = texture.fieldProbes.find((entry) => entry.id === observation.id);
    const samplingBoundary = texture.samplingBoundaries.find((entry) => entry.id === observation.id);
    const definition = sampleDefinitions.find((entry) => entry.id === observation.id);
    if (!definition || (!swatch && !fieldProbe && !samplingBoundary)) {
      throw new Error(`Missing M6B source sample ${observation.id}`);
    }
    // The oracle must evaluate the exact raster sample observed from the GPU,
    // including the fragment-center offset. At a feathered physical boundary,
    // using the ideal swatch center instead can describe a different coverage
    // gain than the output pixel under measurement.
    const displayUvTopOrigin = {
      u: (observation.x + 0.5) / observation.widthPx,
      v: (observation.y + 0.5) / observation.heightPx,
    };
    const reference = evaluateGroundGlassPresentationReference({
      displayUvTopOrigin,
      previewMode: evidence.previewMode,
      filmWindow: evidence.presentationState.coverage.filmWindow,
      coverage: evidence.presentationState.coverage,
      naturalIllumination: evidence.presentationState.naturalIllumination,
      throughputGain: evidence.presentationState.throughputGain,
      sampleSource: (sourceUv) => {
        const x = Math.max(0, Math.min(texture.widthPx - 1, Math.floor(sourceUv.u * texture.widthPx)));
        const y = Math.max(0, Math.min(texture.heightPx - 1, Math.floor(sourceUv.v * texture.heightPx)));
        const offset = (y * texture.widthPx + x) * 4;
        return [texture.rgba[offset] ?? 0, texture.rgba[offset + 1] ?? 0, texture.rgba[offset + 2] ?? 0, texture.rgba[offset + 3] ?? 1] as const;
      },
    });
    const expectedSrgbRgb = reference.outputLinearRgba.slice(0, 3).map((linear) =>
      Math.round(Math.min(1, Math.max(0, encodeGroundGlassLinearChannelToSrgb(linear))) * 255));
    const absoluteChannelError = expectedSrgbRgb.map((expected, index) =>
      Math.abs(expected - (observation.rgba[index] ?? 0)));
    return {
      id: observation.id,
      kind: definition.kind,
      ...(samplingBoundary ? {
        expectedNearestTexel: samplingBoundary.expectedNearestTexel,
        adjacentTexel: samplingBoundary.adjacentTexel,
      } : {}),
      displayUvTopOrigin,
      physicalFilmPointMm: reference.physicalFilmPointMm,
      sourceUvTopOrigin: reference.sourceUvTopOrigin,
      sourceTexelPx: {
        x: Math.max(0, Math.min(texture.widthPx - 1, Math.floor(reference.sourceUvTopOrigin.u * texture.widthPx))),
        y: Math.max(0, Math.min(texture.heightPx - 1, Math.floor(reference.sourceUvTopOrigin.v * texture.heightPx))),
      },
      displayPixel: { x: observation.x, y: observation.y },
      inputLinearRgba: reference.inputLinearRgba,
      expectedOutputLinearRgba: reference.outputLinearRgba,
      coverageGain: reference.coverageGain,
      naturalIlluminationGain: reference.naturalIlluminationGain,
      throughputGain: reference.throughputGain,
      expectedSrgbRgb,
      measuredSrgbRgba: observation.rgba,
      absoluteChannelError,
      maximumChannelError: Math.max(...absoluteChannelError),
      rgbRmse: Math.sqrt(absoluteChannelError.reduce((sum, error) => sum + error * error, 0) / 3),
      meanAbsoluteChannelError: absoluteChannelError.reduce((sum, error) => sum + error, 0) / 3,
      alphaError: null,
    };
  });
  const rgbErrors = samples.flatMap((sample) => sample.absoluteChannelError);
  return {
    sourceDimensions: { widthPx: texture.widthPx, heightPx: texture.heightPx },
    outputDimensions: {
      widthPx: measured[0]?.widthPx ?? 0,
      heightPx: measured[0]?.heightPx ?? 0,
    },
    sourceSampling: evidence.sourceSampling,
    sourceColorDomain: evidence.sourceColorDomain,
    presentationState: evidence.presentationState,
    samples,
    maximumChannelError: Math.max(...rgbErrors),
    rgbRmse: Math.sqrt(rgbErrors.reduce((sum, error) => sum + error * error, 0) / rgbErrors.length),
    meanAbsoluteChannelError: rgbErrors.reduce((sum, error) => sum + error, 0) / rgbErrors.length,
    alphaObservation: "canvas-is-opaque; partial source alpha is not independently observable in the visible output",
  };
};

test("native M6B measures physical overlay alignment and final canvas output", async ({ page }, testInfo) => {
  test.skip(!nativeWebGpuRequired || !m6NativeRunRequired,
    "Requires chrome-native-webgpu and both trusted M6 development flags");
  test.setTimeout(600_000);
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.addInitScript(() => {
    window.__groundGlassWebGpuM3TestControl = {
      m6bCalibrationFixture: { enabled: true, presentationState: "neutral" },
    };
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/simulator/free/architecture-rise");
  await page.getByLabel("Render quality").selectOption("low");

  const pane = paneFor(page);
  const pilot = pilotFor(page);
  const stage = stageFor(page);
  await expect(pane).toHaveAttribute("data-render-host-lifecycle", "ready", { timeout: 150_000 });
  await expect(pane).toHaveAttribute("data-mounted-renderer-family", "webgpu-renderer");
  await expect(pane).toHaveAttribute("data-actual-execution-api", "webgpu");
  await expect(pilot).toHaveAttribute("data-internal-fallback", "none");
  await expect(pilot).toHaveAttribute("data-presentation-renderer-revision", m7fRequired ? "r187" : "r186");
  await expect(pilot).toHaveAttribute("data-presentation-source", "m6b-calibration-fixture");
  await expect(pilot).toHaveAttribute("data-presentation-status", "completed", { timeout: 150_000 });
  await expect(stage.getByTestId("ground-glass-grid")).toHaveAttribute("data-grid-mode", "physical");
  await expect(stage.locator('[data-testid="ground-glass-calibration-target"]')).toHaveCount(GROUND_GLASS_M6B_CALIBRATION_LANDMARKS.length);
  await waitForCurrentFrame(page);

  const captures: Awaited<ReturnType<typeof captureAlignment>>[] = [];
  const raw = await captureAlignment(page, testInfo, "m6b-raw-full-film");
  captures.push(raw);
  await attachEvidence(testInfo, "m6b-overlay-alignment-error.svg", alignmentErrorSvg(raw), "image/svg+xml");

  const pixelOracle = await runPixelOracle(page, raw.png, raw.evidence!);
  await attachEvidence(testInfo, "m6b-source-to-output-sampling.svg", sourceToOutputSamplingSvg(pixelOracle), "image/svg+xml");
  // Preserve the exact per-sample evidence even when the acceptance gate
  // fails, so color-domain or coordinate mismatches cannot disappear behind
  // the first thrown assertion.
  await attachEvidence(testInfo, "m6b-final-output-pixel-oracle.json", JSON.stringify(pixelOracle, null, 2), "application/json");
  expect(pixelOracle.samples).toHaveLength(24);
  expect(pixelOracle.maximumChannelError).toBeLessThanOrEqual(4);
  expect(pixelOracle.rgbRmse).toBeLessThanOrEqual(2.5);
  const boundarySample = pixelOracle.samples.find((sample) => sample.kind === "sampling-boundary");
  expect(boundarySample).toMatchObject({
    id: "nearest-edge-saturated-red",
    sourceTexelPx: boundarySample?.expectedNearestTexel,
    inputLinearRgba: [1, 0, 0, 1],
  });
  expect(boundarySample?.expectedNearestTexel?.x).not.toBe(boundarySample?.adjacentTexel?.x);

  const pixelOracleCases: Array<Readonly<{
    name: string;
    captureId: string;
    requestId: string | null;
    channelId: string;
    sceneId: string;
    rendererGenerationId: string | null;
    inputFingerprints: Readonly<{ sourceData: string; presentationState: string }>;
    sourceCrop: GroundGlassM6bPresentationFixtureEvidence["sourceCrop"];
    presentationState: GroundGlassM6bPresentationFixtureEvidence["presentationState"];
    oracle: Awaited<ReturnType<typeof runPixelOracle>>;
  }>> = [{
    name: "neutral-raw",
    captureId: raw.name,
    requestId: raw.evidence!.requestId,
    channelId: raw.evidence!.channelId,
    sceneId: raw.evidence!.sceneId,
    rendererGenerationId: raw.evidence!.rendererGenerationId,
    inputFingerprints: {
      sourceData: raw.evidence!.sourceDataFingerprint,
      presentationState: raw.evidence!.presentationStateFingerprint,
    },
    sourceCrop: raw.evidence!.sourceCrop,
    presentationState: raw.evidence!.presentationState,
    oracle: pixelOracle,
  }];
  const captureEffectCase = async (
    name: string,
    effectOverrides: GroundGlassM6bPresentationEffectOverrides,
  ) => {
    await setFixtureEffectOverrides(page, effectOverrides);
    const rawRadio = page.getByRole("radio", { name: "Raw Ground Glass", exact: true });
    const uprightRadio = page.getByRole("radio", { name: "Upright Assist", exact: true });
    await (await rawRadio.isChecked() ? uprightRadio : rawRadio).check();
    await waitForCurrentFrame(page);
    const evidence = await readFixtureEvidence(page);
    expect(evidence).not.toBeNull();
    const png = await captureScreenshot(page, testInfo, `${name}.png`);
    const oracle = await runPixelOracle(page, png, evidence!);
    await attachEvidence(testInfo, `${name}-pixel-oracle.json`, JSON.stringify(oracle, null, 2), "application/json");
    expect(oracle.samples.length).toBeGreaterThan(13);
    expect(oracle.maximumChannelError).toBeLessThanOrEqual(4);
    expect(oracle.rgbRmse).toBeLessThanOrEqual(2.5);
    const result = {
      name,
      captureId: name,
      requestId: evidence!.requestId,
      channelId: evidence!.channelId,
      sceneId: evidence!.sceneId,
      rendererGenerationId: evidence!.rendererGenerationId,
      inputFingerprints: {
        sourceData: evidence!.sourceDataFingerprint,
        presentationState: evidence!.presentationStateFingerprint,
      },
      sourceCrop: evidence!.sourceCrop,
      presentationState: evidence!.presentationState,
      oracle,
    };
    pixelOracleCases.push(result);
    return result;
  };
  const throughputCase = await captureEffectCase("m6b-throughput-half", { throughputGain: 0.5 });
  const naturalCase = await captureEffectCase("m6b-natural-cos4", {
    naturalIllumination: {
      enabled: true,
      geometry: { kind: "parallel-cos4", imageDistanceMm: 150, opticalAxisOffsetXMm: 0, opticalAxisOffsetYMm: 0 },
    },
  });
  const centeredCircleCase = await captureEffectCase("m6b-circle-centered", {
    coverage: {
      active: true,
      edgeFeatherMm: 8,
      geometry: { kind: "parallel-circle", radiusMm: 40, opticalAxisOffsetXMm: 0, opticalAxisOffsetYMm: 0 },
    },
  });
  const shiftedCircleCase = await captureEffectCase("m6b-circle-shifted", {
    coverage: {
      active: true,
      edgeFeatherMm: 8,
      geometry: { kind: "parallel-circle", radiusMm: 43, opticalAxisOffsetXMm: 20, opticalAxisOffsetYMm: -12 },
    },
  });
  const conicCoverageCase = await captureEffectCase("m6b-conic-coverage", {
    coverage: {
      active: true,
      edgeFeatherMm: 8,
      geometry: {
        kind: "nonparallel-conic",
        quadratic: { a: 1 / (45 * 45), b: 0, c: 1 / (35 * 35), d: 0, e: 0, f: -1 },
        axial: { x: 0, y: 0, constant: 1 },
      },
    },
  });
  const combinedEffectsCase = await captureEffectCase("m6b-combined-effects", {
    throughputGain: 0.55,
    naturalIllumination: {
      enabled: true,
      geometry: { kind: "parallel-cos4", imageDistanceMm: 150, opticalAxisOffsetXMm: 12, opticalAxisOffsetYMm: -8 },
    },
    coverage: {
      active: true,
      edgeFeatherMm: 8,
      geometry: { kind: "parallel-circle", radiusMm: 48, opticalAxisOffsetXMm: 15, opticalAxisOffsetYMm: -8 },
    },
  });
  const fieldSamples = (oracle: typeof pixelOracle) =>
    oracle.samples.filter((sample) => sample.kind === "uniform-field");
  const neutralFieldById = new Map(fieldSamples(pixelOracle).map((sample) => [sample.id, sample]));
  expect(fieldSamples(throughputCase.oracle).some((sample) =>
    JSON.stringify(sample.measuredSrgbRgba) !== JSON.stringify(neutralFieldById.get(sample.id)?.measuredSrgbRgba),
  )).toBe(true);
  const naturalGains = fieldSamples(naturalCase.oracle).map((sample) => sample.naturalIlluminationGain);
  expect(Math.max(...naturalGains) - Math.min(...naturalGains)).toBeGreaterThan(0.05);
  const centeredGains = new Map(fieldSamples(centeredCircleCase.oracle).map((sample) => [sample.id, sample.coverageGain]));
  expect([...centeredGains.values()].some((gain) => gain === 0)).toBe(true);
  expect([...centeredGains.values()].some((gain) => gain === 1)).toBe(true);
  expect([...centeredGains.values()].some((gain) => gain > 0 && gain < 1)).toBe(true);
  expect(fieldSamples(shiftedCircleCase.oracle).some((sample) =>
    Math.abs(sample.coverageGain - (centeredGains.get(sample.id) ?? 0)) > 0.1,
  )).toBe(true);
  expect(fieldSamples(conicCoverageCase.oracle).some((sample) =>
    Math.abs(sample.coverageGain - (centeredGains.get(sample.id) ?? 0)) > 0.1,
  )).toBe(true);
  combinedEffectsCase.oracle.samples.forEach((sample) => {
    const gain = sample.coverageGain * sample.naturalIlluminationGain * sample.throughputGain;
    sample.inputLinearRgba.slice(0, 3).forEach((channel, index) => {
      expect(sample.expectedOutputLinearRgba[index]).toBeCloseTo(channel * gain, 10);
    });
  });
  await resetFixturePresentationToNeutral(page);
  await page.getByRole("radio", { name: "Upright Assist", exact: true }).check();
  await waitForCurrentFrame(page);
  const neutralUprightEvidence = await readFixtureEvidence(page);
  expect(neutralUprightEvidence?.presentationState.throughputGain).toBe(1);
  expect(neutralUprightEvidence?.presentationState.coverage.active).toBe(false);
  expect(neutralUprightEvidence?.presentationState.naturalIllumination.enabled).toBe(false);

  await page.getByRole("radio", { name: "Upright Assist", exact: true }).check();
  await waitForCurrentFrame(page);
  const upright = await captureAlignment(page, testInfo, "m6b-upright-full-film");
  captures.push(upright);

  await page.getByRole("radio", { name: "Raw Ground Glass", exact: true }).check();
  await waitForCurrentFrame(page);
  const rawRoundTrip = await captureAlignment(page, testInfo, "m6b-raw-round-trip");
  captures.push(rawRoundTrip);
  expect(rawRoundTrip.identity.rendererGenerationId).toBe(raw.identity.rendererGenerationId);

  await page.getByRole("button", { name: "Focus loupe · 4× Ground Glass view", exact: true }).click();
  await expect(stage).toHaveAttribute("data-focus-loupe-active", "true");
  await waitForCurrentFrame(page);
  const centeredLoupe = await captureAlignment(page, testInfo, "m6b-loupe-centered");
  captures.push(centeredLoupe);
  const centeredLoupePixelOracle = await runPixelOracle(page, centeredLoupe.png, centeredLoupe.evidence!);
  await attachEvidence(testInfo, "m6b-loupe-cropped-pixel-oracle.json", JSON.stringify(centeredLoupePixelOracle, null, 2), "application/json");
  expect(centeredLoupePixelOracle.samples.length).toBeGreaterThan(13);
  expect(centeredLoupePixelOracle.maximumChannelError).toBeLessThanOrEqual(4);
  expect(centeredLoupePixelOracle.rgbRmse).toBeLessThanOrEqual(2.5);
  pixelOracleCases.push({
    name: "loupe-centered-crop",
    captureId: centeredLoupe.name,
    requestId: centeredLoupe.evidence!.requestId,
    channelId: centeredLoupe.evidence!.channelId,
    sceneId: centeredLoupe.evidence!.sceneId,
    rendererGenerationId: centeredLoupe.evidence!.rendererGenerationId,
    inputFingerprints: {
      sourceData: centeredLoupe.evidence!.sourceDataFingerprint,
      presentationState: centeredLoupe.evidence!.presentationStateFingerprint,
    },
    sourceCrop: centeredLoupe.evidence!.sourceCrop,
    presentationState: centeredLoupe.evidence!.presentationState,
    oracle: centeredLoupePixelOracle,
  });

  const panLoupeBy = async (deltaX: number, deltaY: number) => {
    const bounds = await readFreshElementBounds(stage);
    const startX = bounds.x + bounds.width * 0.5;
    const startY = bounds.y + bounds.height * 0.5;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + bounds.width * deltaX, startY + bounds.height * deltaY, { steps: 6 });
    await page.mouse.up();
    await waitForCurrentFrame(page);
    return readStageGeometry(page);
  };
  const centeredGeometry = await readStageGeometry(page);
  const horizontalPanGeometry = await panLoupeBy(0.12, 0);
  expect(Math.abs(horizontalPanGeometry.inspectionWindow.centerU - centeredGeometry.inspectionWindow.centerU))
    .toBeGreaterThan(0.005);
  expect(Math.abs(horizontalPanGeometry.inspectionWindow.centerV - centeredGeometry.inspectionWindow.centerV))
    .toBeLessThan(1e-6);
  const horizontalLoupe = await captureAlignment(page, testInfo, "m6b-loupe-horizontal-pan");
  captures.push(horizontalLoupe);

  const horizontalGeometry = horizontalPanGeometry;
  const verticalPanGeometry = await panLoupeBy(0, 0.12);
  expect(Math.abs(verticalPanGeometry.inspectionWindow.centerU - horizontalGeometry.inspectionWindow.centerU))
    .toBeLessThan(1e-6);
  expect(Math.abs(verticalPanGeometry.inspectionWindow.centerV - horizontalGeometry.inspectionWindow.centerV))
    .toBeGreaterThan(0.005);
  const verticalLoupe = await captureAlignment(page, testInfo, "m6b-loupe-vertical-pan");
  captures.push(verticalLoupe);

  await panLoupeBy(0.12, -0.09);
  const pannedLoupe = await captureAlignment(page, testInfo, "m6b-loupe-diagonal-pan");
  captures.push(pannedLoupe);

  const expectedBoundaryCenter = (direction: -1 | 1) => direction === 1 ? 0.125 : 0.875;
  const panLoupeToBoundary = async (axis: "horizontal" | "vertical", direction: -1 | 1) => {
    let geometry = await readStageGeometry(page);
    const coordinate = axis === "horizontal" ? "centerU" : "centerV";
    for (let step = 0; step < 6 && Math.abs(geometry.inspectionWindow[coordinate] - expectedBoundaryCenter(direction)) > 1e-5; step += 1) {
      geometry = await panLoupeBy(
        axis === "horizontal" ? direction * 0.75 : 0,
        axis === "vertical" ? direction * 0.75 : 0,
      );
    }
    return geometry;
  };
  const captureCropBoundary = async (
    name: string,
    axis: "horizontal" | "vertical",
    direction: -1 | 1,
    expectedCenter: number,
  ) => {
    const geometry = await panLoupeToBoundary(axis, direction);
    expect(geometry.inspectionWindow[axis === "horizontal" ? "centerU" : "centerV"])
      .toBeCloseTo(expectedCenter, 3);
    const capture = await captureAlignment(page, testInfo, name);
    captures.push(capture);
    return capture;
  };
  await captureCropBoundary("m6b-loupe-left-limit", "horizontal", 1, 0.125);
  await captureCropBoundary("m6b-loupe-right-limit", "horizontal", -1, 0.875);
  await captureCropBoundary("m6b-loupe-top-limit", "vertical", 1, 0.125);
  await captureCropBoundary("m6b-loupe-bottom-limit", "vertical", -1, 0.875);

  await page.getByRole("radio", { name: "Upright Assist", exact: true }).check();
  await waitForCurrentFrame(page);
  await expect(stage).toHaveAttribute("data-focus-loupe-active", "true");
  const croppedUpright = await captureAlignment(page, testInfo, "m6b-upright-cropped-loupe");
  captures.push(croppedUpright);
  expect(croppedUpright.geometry.inspectionWindow.active).toBe(true);
  await page.getByRole("radio", { name: "Raw Ground Glass", exact: true }).check();
  await waitForCurrentFrame(page);
  await expect(stage).toHaveAttribute("data-focus-loupe-active", "true");

  // Reset the shared Stage crop through its public Loupe control and remeasure the full film.
  await page.getByRole("button", { name: "Reset Ground Glass view", exact: true }).click();
  await expect(stage).toHaveAttribute("data-focus-loupe-active", "false");
  await waitForCurrentFrame(page);
  const cropReset = await captureAlignment(page, testInfo, "m6b-loupe-reset-full-film");
  captures.push(cropReset);

  const resizeBefore = {
    targetWidthPx: Number(await pilot.getAttribute("data-target-width")),
    targetHeightPx: Number(await pilot.getAttribute("data-target-height")),
    physicalWidthPx: Number(await pilot.getAttribute("data-physical-coc-width-px")),
    physicalHeightPx: Number(await pilot.getAttribute("data-physical-coc-height-px")),
    gatherWidthPx: Number(await pilot.getAttribute("data-aperture-gather-far-width-px")),
    gatherHeightPx: Number(await pilot.getAttribute("data-aperture-gather-far-height-px")),
    outputWidthPx: Number(await pilot.getAttribute("data-presentation-output-width")),
    outputHeightPx: Number(await pilot.getAttribute("data-presentation-output-height")),
    stage: await readStageGeometry(page),
  };
  const generationBeforeResize = await pilot.getAttribute("data-renderer-generation");
  await page.getByLabel("Render quality").selectOption("standard");
  await expect.poll(() => pilot.getAttribute("data-frame-request-id"), { timeout: 60_000 })
    .not.toBe(raw.identity.requestId);
  await waitForCurrentFrame(page);
  const resizeAfter = {
    targetWidthPx: Number(await pilot.getAttribute("data-target-width")),
    targetHeightPx: Number(await pilot.getAttribute("data-target-height")),
    physicalWidthPx: Number(await pilot.getAttribute("data-physical-coc-width-px")),
    physicalHeightPx: Number(await pilot.getAttribute("data-physical-coc-height-px")),
    gatherWidthPx: Number(await pilot.getAttribute("data-aperture-gather-far-width-px")),
    gatherHeightPx: Number(await pilot.getAttribute("data-aperture-gather-far-height-px")),
    outputWidthPx: Number(await pilot.getAttribute("data-presentation-output-width")),
    outputHeightPx: Number(await pilot.getAttribute("data-presentation-output-height")),
    stage: await readStageGeometry(page),
  };
  expect(resizeAfter.targetWidthPx).not.toBe(resizeBefore.targetWidthPx);
  expect(resizeAfter.targetHeightPx).not.toBe(resizeBefore.targetHeightPx);
  expect(resizeAfter.physicalWidthPx).toBe(resizeAfter.targetWidthPx);
  expect(resizeAfter.physicalHeightPx).toBe(resizeAfter.targetHeightPx);
  expect(resizeAfter.gatherWidthPx).toBeGreaterThan(resizeBefore.gatherWidthPx);
  expect(resizeAfter.gatherHeightPx).toBeGreaterThan(resizeBefore.gatherHeightPx);
  expect(resizeAfter.outputWidthPx).toBe(resizeAfter.stage.widthPx);
  expect(resizeAfter.outputHeightPx).toBe(resizeAfter.stage.heightPx);
  expect(await pilot.getAttribute("data-renderer-generation")).toBe(generationBeforeResize);
  const resized = await captureAlignment(page, testInfo, "m6b-resized-standard-quality", {
    widthPx: resizeBefore.targetWidthPx,
    heightPx: resizeBefore.targetHeightPx,
  });
  captures.push(resized);
  const resizedPixelOracle = await runPixelOracle(page, resized.png, resized.evidence!);
  await attachEvidence(testInfo, "m6b-resized-pixel-oracle.json", JSON.stringify(resizedPixelOracle, null, 2), "application/json");
  expect(resizedPixelOracle.samples.length).toBeGreaterThan(13);
  expect(resizedPixelOracle.maximumChannelError).toBeLessThanOrEqual(4);
  expect(resizedPixelOracle.rgbRmse).toBeLessThanOrEqual(2.5);
  pixelOracleCases.push({
    name: "resized-standard-quality",
    captureId: resized.name,
    requestId: resized.evidence!.requestId,
    channelId: resized.evidence!.channelId,
    sceneId: resized.evidence!.sceneId,
    rendererGenerationId: resized.evidence!.rendererGenerationId,
    inputFingerprints: {
      sourceData: resized.evidence!.sourceDataFingerprint,
      presentationState: resized.evidence!.presentationStateFingerprint,
    },
    sourceCrop: resized.evidence!.sourceCrop,
    presentationState: resized.evidence!.presentationState,
    oracle: resizedPixelOracle,
  });

  const fixtureControl = await page.evaluate(() => ({
    disposed: window.__groundGlassWebGpuM3TestControl?.m6bCalibrationFixture?.resourceDisposed === true,
    active: window.__groundGlassWebGpuM3TestControl?.m6bCalibrationFixture?.enabled === true,
  }));
  expect(fixtureControl.active).toBe(true);

  // Reaching this point means all explicit M6B state-transition assertions above passed.
  // The spatial evaluator owns the per-capture limits and exact 14-capture inventory.
  const spatialConformance = evaluateGroundGlassM6bSpatialConformance({
    captures: captures.map(({ spatialConformanceInput }) => spatialConformanceInput),
    stateSpecificAssertionsPassed: true,
  });
  const aggregateRgbErrors = pixelOracleCases.flatMap(({ oracle }) =>
    oracle.samples.flatMap(({ absoluteChannelError }) => absoluteChannelError),
  );
  const pixelOracleAggregate = {
    sampleCount: pixelOracleCases.reduce((count, { oracle }) => count + oracle.samples.length, 0),
    maximumChannelError: Math.max(...aggregateRgbErrors),
    rgbRmse: Math.sqrt(aggregateRgbErrors.reduce((sum, error) => sum + error * error, 0) / aggregateRgbErrors.length),
  };
  const spatialConformanceEvidence = {
    sourceCommit: m7fRequired
      ? groundGlassM7fCaptureProvenance().sourceCommitSha
      : process.env.GROUND_GLASS_M6B_SOURCE_COMMIT ?? null,
    nativeRuntime: {
      rendererFamily: await pane.getAttribute("data-mounted-renderer-family"),
      actualExecutionApi: await pane.getAttribute("data-actual-execution-api"),
      rendererRevision: await pilot.getAttribute("data-presentation-renderer-revision"),
    },
    result: spatialConformance,
  };
  await attachEvidence(testInfo, "m6b-spatial-conformance.json", JSON.stringify(spatialConformanceEvidence, null, 2), "application/json");
  expect(spatialConformance.requiredCaptureIds).toEqual([...GROUND_GLASS_M6B_REQUIRED_CAPTURE_IDS]);
  expect(spatialConformance.allRequiredCaptureIdsPresentExactlyOnce).toBe(true);
  expect(spatialConformance.physicalOverlayConformant, JSON.stringify(spatialConformance.failureReasons, null, 2)).toBe(true);

  const report = {
    schemaVersion: 1,
    captureProvenance: m7fRequired ? groundGlassM7fCaptureProvenance() : null,
    browserVersion: page.context().browser()?.version() ?? "unknown",
    operatingSystem: `${process.platform} ${process.arch}`,
    adapterEvents: await page.evaluate(() => window.__groundGlassWebGpuM3TestControl?.adapterEvents ?? []),
    spatialGateRevision: GROUND_GLASS_M6B_SPATIAL_GATE_REVISION,
    spatialConformance,
    sourceCommit: m7fRequired
      ? groundGlassM7fCaptureProvenance().sourceCommitSha
      : process.env.GROUND_GLASS_M6B_SOURCE_COMMIT ?? null,
    fixtureRevision: raw.evidence?.fixtureRevision,
    physicalFilmContract: {
      filmWidthMm: CAMERA_CONSTANTS.filmWidthMm,
      filmHeightMm: CAMERA_CONSTANTS.filmHeightMm,
      gridSquareMm: GROUND_GLASS_M6B_GRID_SQUARE_MM,
      physicalOriginMm: "film center (0, 0); +X right; +Y up",
      canonicalFilmUv: "u = 0.5 + xMm / filmWidthMm; v = 0.5 - yMm / filmHeightMm",
      previewMapping: "Raw = (1-u, v); Upright = (u, 1-v)",
      logicalCoordinates: "CSS content-box pixel coordinates; raster detections converted from screenshot pixel centers by measured canvas CSS scale",
      rasterDevicePixelRatio: raw.geometry.devicePixelRatio,
    },
    measurementSpecification: {
      version: "m6b-physical-overlay-v1",
      markerCount: GROUND_GLASS_M6B_CALIBRATION_LANDMARKS.length,
      markerRadiusSourcePx: GROUND_GLASS_M6B_MARKER_RADIUS_SOURCE_PX,
      expectedRasterLocalizationUncertaintyCssPx: 1,
      maximumSpatialErrorCssPx: 2,
      maximumSpatialRmsCssPx: 1.25,
      pixelCenterConvention: "measured screenshot sample is its pixel cell center",
      requiredFullFilmCaptures: ["raw", "upright", "raw-round-trip", "crop-reset", "resized"],
      requiredCropCaptures: ["center", "horizontal-pan", "vertical-pan", "diagonal-pan", "left-limit", "right-limit", "top-limit", "bottom-limit", "upright-cropped"],
      requiredMeasuredMarkersPerFullFilmCapture: GROUND_GLASS_M6B_CALIBRATION_LANDMARKS.length,
    },
    nativeRuntime: {
      applicationFallback: false,
      rendererFamily: await pane.getAttribute("data-mounted-renderer-family"),
      actualExecutionApi: await pane.getAttribute("data-actual-execution-api"),
      internalFallback: await pilot.getAttribute("data-internal-fallback"),
      rendererRevision: await pilot.getAttribute("data-presentation-renderer-revision"),
      sceneSourceRevision: await pilot.getAttribute("data-presentation-scene-source-revision"),
      sceneId: await pane.getAttribute("data-frame-scene-id"),
    },
    activation: {
      devTestSeam: true,
      bothM6BuildFlags: true,
      exactScene: "architecture-rise",
      explicitControl: true,
      source: await pilot.getAttribute("data-presentation-source"),
    },
    physicalLandmarks: GROUND_GLASS_M6B_CALIBRATION_LANDMARKS.map((landmark) => ({
      id: landmark.id,
      physicalXMm: landmark.physicalXMm,
      physicalYMm: landmark.physicalYMm,
      color: landmark.color,
    })),
    captures: captures.map((capture) => ({
      name: capture.name,
      previewMode: capture.previewMode,
      captureId: capture.name,
      requestId: capture.identity.requestId,
      channelId: capture.evidence?.channelId,
      sceneId: capture.evidence?.sceneId,
      rendererGenerationId: capture.identity.rendererGenerationId,
      inputFingerprints: capture.evidence ? {
        sourceData: capture.evidence.sourceDataFingerprint,
        presentationState: capture.evidence.presentationStateFingerprint,
      } : null,
      targetSizePx: [capture.identity.targetWidthPx, capture.identity.targetHeightPx],
      outputSizePx: [capture.identity.outputWidthPx, capture.identity.outputHeightPx],
      crop: capture.geometry.inspectionWindow,
      alignment: capture.alignment,
      spatialConformance: capture.spatialConformance,
    })),
    spatialConformanceInputs: captures.map((capture) => capture.spatialConformanceInput),
    resize: { before: resizeBefore, after: resizeAfter },
    pixelOracle,
    pixelOracleAggregate,
    pixelOracleCases,
    alphaObservation: pixelOracle.alphaObservation,
    evidenceScopes: {
      controlledFixture: "measured",
      registeredArchitectureRise: "separately covered by native M6 registered-app integration capture; not combined with fixture pixels",
    },
    resourceAccounting: {
      fixtureSourceTexture: "adapter-owned test DataTexture; disposal is asserted after route retirement",
      fixtureSourceDataFingerprint: raw.evidence?.sourceDataFingerprint,
      fixtureResourceDisposedAfterRetirement: false,
    },
    limitations: [
      "The visible canvas is opaque, so source-alpha preservation is not independently observable without a test-only alpha-preserving target.",
      "This fixture validates physical presentation mapping and the final M6 presentation node, not M5 optical image quality.",
    ],
  };

  await page.getByRole("link", { name: "All Scenes" }).click();
  await expect(page).toHaveURL(/\/scenes$/);
  await page.locator('a[href="/simulator/free/understanding-camera-movements"]').click();
  await expect(page).toHaveURL(/\/simulator\/free\/understanding-camera-movements$/);
  await expect(stage.locator('[data-testid="ground-glass-calibration-target"]')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() =>
    window.__groundGlassWebGpuM3TestControl?.m6bCalibrationFixture?.resourceDisposed === true,
  )).toBe(true);
  await expect.poll(() => page.evaluate(
    (generationId) => window.__groundGlassWebGpuM3TestControl?.adapterEvents?.some((event) =>
      event.kind === "cleanup" && event.generationId === generationId && event.outcome === "confirmed",
    ) === true,
    raw.identity.rendererGenerationId,
  )).toBe(true);
  await expect(pilot).toHaveCount(0);
  expect(pageErrors).toEqual([]);
  report.adapterEvents = await page.evaluate(() => window.__groundGlassWebGpuM3TestControl?.adapterEvents ?? []);
  report.resourceAccounting.fixtureResourceDisposedAfterRetirement = true;
  await attachEvidence(testInfo, "m6b-native-conformance.json", JSON.stringify(report, null, 2), "application/json");
  writeGroundGlassM7fCapture("m6b-conformance.json", report);
});
