import { expect, test, type Page } from "@playwright/test";
import { REVISION } from "three";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import geometry from "../../scenes/architectureRiseGeometry";
import { architectureRiseScene } from "../../scenes/definitions/architecture-rise";
import { ARCHITECTURE_RISE_RAW_RTT_SOURCE_REVISION } from "../../render/webgpu/groundGlassRawWebGpuCompatibility";
import { CAMERA_CONSTANTS, DEFAULT_CAMERA_STATE } from "../../utils/constants";
import type { Vec3 } from "../../types/optics";
import { clickStageAt } from "./helpers/groundGlass";
import { setStepRangeInput } from "./helpers/stepRangeInput";

const nativeWebGpuRequired = process.env.GROUND_GLASS_NATIVE_WEBGPU_REQUIRED === "1";

const ASYMMETRIC_POINTS = [
  { id: "left-upper-context", u: 0.29, v: 0.48 },
  { id: "left-upper-facade", u: 0.37, v: 0.32 },
  { id: "facade-focus-chart", u: 0.51, v: 0.65 },
  { id: "right-facade-window", u: 0.63, v: 0.34 },
  { id: "left-side-context", u: 0.25, v: 0.54 },
  { id: "right-side-return", u: 0.75, v: 0.54 },
  { id: "left-lower-context", u: 0.29, v: 0.67 },
  { id: "right-lower-return", u: 0.76, v: 0.69 },
  { id: "lower-facade", u: 0.51, v: 0.81 },
] as const;

type RasterPatch = Readonly<{ id: string; red: number; green: number; blue: number; luminance: number }>;

const waitForCurrentFrame = async (page: Page) => {
  const pane = page.locator('[data-testid="ground-glass-rtt"][data-rtt-channel="default"]');
  await expect.poll(async () => {
    const requestId = await pane.getAttribute("data-frame-request-id");
    return Boolean(
      requestId &&
      requestId === await pane.getAttribute("data-last-completed-request-id") &&
      await pane.getAttribute("data-frame-result-status") === "completed",
    );
  }, { timeout: 90_000 }).toBe(true);
};

const analyzeCanvasScreenshot = async (page: Page, screenshot: Buffer) => page.evaluate(async (base64Png) => {
  const image = new Image();
  image.src = `data:image/png;base64,${base64Png}`;
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not decode the Raw WebGPU canvas screenshot");
  context.drawImage(image, 0, 0);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  const buckets = new Set<string>();
  let luminanceTotal = 0;
  let foregroundSamples = 0;
  let dominantBucket = "";
  const frequencies = new Map<string, number>();
  for (let index = 0; index < pixels.length; index += 4) {
    const red = pixels[index] ?? 0;
    const green = pixels[index + 1] ?? 0;
    const blue = pixels[index + 2] ?? 0;
    const bucket = `${red >> 4}:${green >> 4}:${blue >> 4}`;
    buckets.add(bucket);
    frequencies.set(bucket, (frequencies.get(bucket) ?? 0) + 1);
    if (Math.max(red, green, blue) - Math.min(red, green, blue) > 8) foregroundSamples += 1;
    luminanceTotal += red * 0.2126 + green * 0.7152 + blue * 0.0722;
  }
  let dominantCount = 0;
  for (const [bucket, count] of frequencies) {
    if (count > dominantCount) {
      dominantBucket = bucket;
      dominantCount = count;
    }
  }
  return {
    width: canvas.width,
    height: canvas.height,
    distinctColorBuckets: buckets.size,
    foregroundSamples,
    dominantBucket,
    meanLuminance: pixels.length ? luminanceTotal / (pixels.length / 4) : 0,
    contentful: buckets.size >= 12 && canvas.width * canvas.height - dominantCount >= 20,
  };
}, screenshot.toString("base64"));

const samplePatches = async (
  page: Page,
  screenshot: Buffer,
  points: readonly Readonly<{ id: string; u: number; v: number }>[],
  radius = 2,
): Promise<RasterPatch[]> => page.evaluate(async ({ base64, requestedPoints, patchRadius }) => {
  const image = new Image();
  image.src = `data:image/png;base64,${base64}`;
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not sample the Raw WebGPU screenshot");
  context.drawImage(image, 0, 0);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  return requestedPoints.map(({ id, u, v }) => {
    const centerX = Math.round(u * (canvas.width - 1));
    const centerY = Math.round(v * (canvas.height - 1));
    let red = 0;
    let green = 0;
    let blue = 0;
    let count = 0;
    for (let y = Math.max(0, centerY - patchRadius); y <= Math.min(canvas.height - 1, centerY + patchRadius); y += 1) {
      for (let x = Math.max(0, centerX - patchRadius); x <= Math.min(canvas.width - 1, centerX + patchRadius); x += 1) {
        const offset = (y * canvas.width + x) * 4;
        red += pixels[offset] ?? 0;
        green += pixels[offset + 1] ?? 0;
        blue += pixels[offset + 2] ?? 0;
        count += 1;
      }
    }
    const meanRed = red / count;
    const meanGreen = green / count;
    const meanBlue = blue / count;
    return {
      id,
      red: meanRed,
      green: meanGreen,
      blue: meanBlue,
      luminance: meanRed * 0.2126 + meanGreen * 0.7152 + meanBlue * 0.0722,
    };
  });
}, {
  base64: screenshot.toString("base64"),
  requestedPoints: points,
  patchRadius: radius,
});

const meanPatchDifference = (left: readonly RasterPatch[], right: readonly RasterPatch[]) => {
  if (left.length !== right.length || left.length === 0) throw new Error("Raster patch inputs must be nonempty and aligned");
  return left.reduce((sum, patch, index) => {
    const other = right[index];
    if (!other) return sum;
    return sum + (Math.abs(patch.red - other.red) + Math.abs(patch.green - other.green) + Math.abs(patch.blue - other.blue)) / 3;
  }, 0) / left.length;
};

type FilmLandmark = Readonly<{
  id: string;
  worldPoint: Vec3;
  expected: "dark" | "light";
}>;

const subtract = (left: Vec3, right: Vec3): Vec3 => ({
  x: left.x - right.x,
  y: left.y - right.y,
  z: left.z - right.z,
});
const dot = (left: Vec3, right: Vec3): number => left.x * right.x + left.y * right.y + left.z * right.z;
const cross = (left: Vec3, right: Vec3): Vec3 => ({
  x: left.y * right.z - left.z * right.y,
  y: left.z * right.x - left.x * right.z,
  z: left.x * right.y - left.y * right.x,
});
const scale = (value: Vec3, amount: number): Vec3 => ({ x: value.x * amount, y: value.y * amount, z: value.z * amount });

/**
 * Independent physical ray/plane oracle for the app-host raster. It intersects a known world
 * landmark ray with the four canonical film-plane corners and solves the film-plane Gram system;
 * it does not use the adapter camera/frustum or the production Ground Glass projection helper.
 */
const projectLandmarkToFilm = (input: {
  worldPoint: Vec3;
  lensCenter: Vec3;
  corners: ReturnType<typeof deriveOpticsState>["filmPlaneCornersWorld"];
}) => {
  const uAxis = subtract(input.corners.topRight, input.corners.topLeft);
  const vAxis = subtract(input.corners.bottomLeft, input.corners.topLeft);
  const normalRaw = cross(uAxis, vAxis);
  const normalLength = Math.sqrt(dot(normalRaw, normalRaw));
  const rayRaw = subtract(input.lensCenter, input.worldPoint);
  const rayLength = Math.sqrt(dot(rayRaw, rayRaw));
  if (normalLength <= 1e-8 || rayLength <= 1e-8) return null;
  const normal = scale(normalRaw, 1 / normalLength);
  const rayDirection = scale(rayRaw, 1 / rayLength);
  const denominator = dot(rayDirection, normal);
  if (Math.abs(denominator) <= 1e-8) return null;
  const distance = dot(subtract(input.corners.topLeft, input.lensCenter), normal) / denominator;
  if (distance <= 0) return null;
  const intersection = {
    x: input.lensCenter.x + rayDirection.x * distance,
    y: input.lensCenter.y + rayDirection.y * distance,
    z: input.lensCenter.z + rayDirection.z * distance,
  };
  const relative = subtract(intersection, input.corners.topLeft);
  const uu = dot(uAxis, uAxis);
  const uv = dot(uAxis, vAxis);
  const vv = dot(vAxis, vAxis);
  const ur = dot(uAxis, relative);
  const vr = dot(vAxis, relative);
  const determinant = uu * vv - uv * uv;
  if (Math.abs(determinant) <= 1e-8) return null;
  const uRaw = (ur * vv - vr * uv) / determinant;
  const vRaw = (vr * uu - ur * uv) / determinant;
  return { uRaw, vRaw, visible: uRaw >= 0 && uRaw <= 1 && vRaw >= 0 && vRaw <= 1 };
};

const architectureRiseLandmarks = (): readonly FilmLandmark[] => {
  const sign = geometry.streetContext.streetSign;
  const faceCenterZ = sign.z - (sign.panelDepth + sign.faceDepth) / 2 - 2;
  const inscriptionCenterZ = faceCenterZ - (sign.faceDepth / 2 + 3 + 3);
  const signLandmarks: FilmLandmark[] = [
    { id: "street-sign-inscription-upper", expected: "dark", worldPoint: { x: sign.x, y: sign.panelCenterY + 70, z: inscriptionCenterZ } },
    { id: "street-sign-inscription-lower", expected: "dark", worldPoint: { x: sign.x, y: sign.panelCenterY + 22, z: inscriptionCenterZ } },
    { id: "street-sign-face-left", expected: "light", worldPoint: { x: sign.x - 190, y: sign.panelCenterY - 130, z: faceCenterZ } },
    { id: "street-sign-face-right", expected: "light", worldPoint: { x: sign.x + 190, y: sign.panelCenterY - 130, z: faceCenterZ } },
    { id: "street-sign-face-lower", expected: "light", worldPoint: { x: sign.x + 150, y: sign.panelCenterY + 170, z: faceCenterZ } },
  ];
  const focusCells = geometry.getArchitectureFocusChartCells();
  const focusCellLandmarks: FilmLandmark[] = [0, 7, 56, 63].flatMap((index) => {
    const cell = focusCells[index];
    return cell ? [{
      id: `focus-chart-${cell.id}`,
      expected: cell.dark ? "dark" : "light",
      worldPoint: { x: cell.x, y: cell.y, z: cell.z - cell.depth / 2 - 1 },
    }] : [];
  });
  const windowLandmarks: FilmLandmark[] = geometry.architectureRiseWindowBays
    .filter((bay) => bay.y === 1100 && (bay.x === -1080 || bay.x === 1080))
    .flatMap((bay) => [
      {
        id: `facade-window-${bay.id}-glass`,
        expected: "dark" as const,
        worldPoint: { x: bay.x, y: bay.y, z: geometry.facade.frontFacadeZ - 54 },
      },
      {
        id: `facade-window-${bay.id}-upper-trim`,
        expected: "light" as const,
        worldPoint: { x: bay.x, y: bay.y + bay.height / 2 + 17, z: geometry.facade.frontFacadeZ - 76 },
      },
    ]);
  return [...signLandmarks, ...focusCellLandmarks, ...windowLandmarks];
};

const sourceCropFor = async (pilot: ReturnType<Page["getByTestId"]>) => {
  const values = (await pilot.getAttribute("data-source-crop"))?.split(",").map(Number) ?? [];
  return values.length === 4 && values.every(Number.isFinite)
    ? { centerU: values[0]!, centerV: values[1]!, width: values[2]!, height: values[3]! }
    : { centerU: 0.5, centerV: 0.5, width: 1, height: 1 };
};

const verifyIndependentSignGeometry = async (input: {
  page: Page;
  pilot: ReturnType<Page["getByTestId"]>;
  screenshot: Buffer;
  riseMm: number;
  previewMode: "raw" | "upright";
  requireDarkAndLight?: boolean;
}) => {
  const camera = {
    ...DEFAULT_CAMERA_STATE,
    ...architectureRiseScene.cameraPreset,
    activeSceneId: architectureRiseScene.id,
    frontRiseMm: input.riseMm,
  };
  const optics = deriveOpticsState(camera, architectureRiseScene);
  const sourceCrop = await sourceCropFor(input.pilot);
  const landmarks = architectureRiseLandmarks().map((landmark) => {
    const projection = projectLandmarkToFilm({
      worldPoint: landmark.worldPoint,
      lensCenter: optics.lensCenterWorld,
      corners: optics.filmPlaneCornersWorld,
    });
    if (!projection?.visible) return null;
    const displayed = input.previewMode === "raw"
      ? { u: 1 - projection.uRaw, v: projection.vRaw }
      : { u: projection.uRaw, v: 1 - projection.vRaw };
    const cropCenter = input.previewMode === "raw"
      ? { u: 1 - sourceCrop.centerU, v: 1 - sourceCrop.centerV }
      : { u: sourceCrop.centerU, v: sourceCrop.centerV };
    return {
      id: landmark.id,
      expected: landmark.expected,
      fullFilm: displayed,
      u: (displayed.u - cropCenter.u) / sourceCrop.width + 0.5,
      v: (displayed.v - cropCenter.v) / sourceCrop.height + 0.5,
    };
  }).filter((landmark): landmark is NonNullable<typeof landmark> => Boolean(landmark));
  const inFrameLandmarks = landmarks.filter(({ u, v }) => u >= 0.04 && u <= 0.96 && v >= 0.04 && v <= 0.96);
  if (input.requireDarkAndLight !== false) {
    expect(inFrameLandmarks.filter((landmark) => landmark.expected === "dark").length).toBeGreaterThanOrEqual(1);
    expect(inFrameLandmarks.filter((landmark) => landmark.expected === "light").length).toBeGreaterThanOrEqual(1);
  }
  const samplePoints = inFrameLandmarks.flatMap((landmark) => [
    { ...landmark, mapping: "correct" as const },
    { ...landmark, mapping: "horizontal-reflection" as const, u: 1 - landmark.u },
    { ...landmark, mapping: "vertical-reflection" as const, v: 1 - landmark.v },
    { ...landmark, mapping: "x-y-swap" as const, u: landmark.v, v: landmark.u },
  ]);

  const inspected = await input.page.evaluate(async ({ base64, points }) => {
    const image = new Image();
    image.src = `data:image/png;base64,${base64}`;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not decode the native Raw raster for landmark inspection");
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const read = (u: number, v: number) => {
      const centerX = Math.round(u * (canvas.width - 1));
      const centerY = Math.round(v * (canvas.height - 1));
      let red = 0;
      let green = 0;
      let blue = 0;
      let count = 0;
      let darkCount = 0;
      let darkX = 0;
      let darkY = 0;
      let brightCount = 0;
      let brightX = 0;
      let brightY = 0;
      const radius = 3;
      for (let y = Math.max(0, centerY - radius); y <= Math.min(canvas.height - 1, centerY + radius); y += 1) {
        for (let x = Math.max(0, centerX - radius); x <= Math.min(canvas.width - 1, centerX + radius); x += 1) {
          const offset = (y * canvas.width + x) * 4;
          const pixelRed = pixels[offset] ?? 0;
          const pixelGreen = pixels[offset + 1] ?? 0;
          const pixelBlue = pixels[offset + 2] ?? 0;
          const luminance = pixelRed * 0.2126 + pixelGreen * 0.7152 + pixelBlue * 0.0722;
          red += pixelRed;
          green += pixelGreen;
          blue += pixelBlue;
          count += 1;
          if (luminance < 75) {
            darkCount += 1;
            darkX += x;
            darkY += y;
          }
          if (luminance > 200) {
            brightCount += 1;
            brightX += x;
            brightY += y;
          }
        }
      }
      const meanRed = red / count;
      const meanGreen = green / count;
      const meanBlue = blue / count;
      return {
        red: meanRed,
        green: meanGreen,
        blue: meanBlue,
        luminance: meanRed * 0.2126 + meanGreen * 0.7152 + meanBlue * 0.0722,
        darkCount,
        darkCentroidX: darkCount ? darkX / darkCount : null,
        darkCentroidY: darkCount ? darkY / darkCount : null,
        brightCount,
        brightCentroidX: brightCount ? brightX / brightCount : null,
        brightCentroidY: brightCount ? brightY / brightCount : null,
      };
    };
    return {
      width: canvas.width,
      height: canvas.height,
      points: points.map((point) => ({ ...point, ...read(point.u, point.v) })),
    };
  }, { base64: input.screenshot.toString("base64"), points: samplePoints });

  const correctPoints = inspected.points.filter((point) => point.mapping === "correct");
  const score = (points: typeof inspected.points) => points.reduce((sum, point) => sum + (
    point.expected === "dark"
      ? Math.max(0, point.luminance - 55)
      : Math.max(0, 145 - point.luminance)
  ), 0) / Math.max(1, points.length);
  const correctScore = score(correctPoints);
  const wrongAxisScores = Object.fromEntries([
    "horizontal-reflection",
    "vertical-reflection",
    "x-y-swap",
  ].map((mapping) => [mapping, score(inspected.points.filter((point) => point.mapping === mapping))]));
  const coordinateErrors = correctPoints.map((point) => {
    const centroidX = point.expected === "dark" ? point.darkCentroidX : point.brightCentroidX;
    const centroidY = point.expected === "dark" ? point.darkCentroidY : point.brightCentroidY;
    return {
      id: point.id,
      expected: point.expected,
      errorPx: centroidX === null || centroidY === null
        ? null
        : Math.hypot(
            centroidX - point.u * (inspected.width - 1),
            centroidY - point.v * (inspected.height - 1),
          ),
    };
  });

  return {
    camera,
    filmDimensionsMm: { width: CAMERA_CONSTANTS.filmWidthMm, height: CAMERA_CONSTANTS.filmHeightMm },
    sourceCrop,
    targetDimensionsPx: { width: inspected.width, height: inspected.height },
    landmarks: correctPoints,
    correctScore,
    wrongAxisScores,
    coordinateErrors,
  };
};

const assertIndependentGeometryEvidence = (
  evidence: Awaited<ReturnType<typeof verifyIndependentSignGeometry>>,
  options: Readonly<{
    minimumLandmarks?: number;
    checkAppearanceScore?: boolean;
    checkWrongAxisControls?: boolean;
  }> = {},
) => {
  expect(evidence.landmarks.length).toBeGreaterThanOrEqual(options.minimumLandmarks ?? 4);
  if (options.checkAppearanceScore !== false) expect(evidence.correctScore, `independent geometry score: ${JSON.stringify({
    targetDimensionsPx: evidence.targetDimensionsPx,
    sourceCrop: evidence.sourceCrop,
    landmarks: evidence.landmarks.map(({ id, expected, u, v, luminance, darkCentroidX, darkCentroidY }) => ({
      id, expected, u, v, luminance, darkCentroidX, darkCentroidY,
    })),
    correctScore: evidence.correctScore,
    wrongAxisScores: evidence.wrongAxisScores,
    coordinateErrors: evidence.coordinateErrors,
  })}`).toBeLessThan(45);
  if (options.checkWrongAxisControls !== false) {
    for (const [negativeControl, score] of Object.entries(evidence.wrongAxisScores)) {
      expect(score, `${negativeControl} must disagree with the independent geometry oracle`).toBeGreaterThan(evidence.correctScore + 6);
    }
  }
  const measuredErrors = evidence.coordinateErrors.flatMap((point) => point.errorPx === null ? [] : [point.errorPx]);
  expect(measuredErrors.length).toBeGreaterThanOrEqual(1);
  expect(Math.max(...measuredErrors)).toBeLessThanOrEqual(6);
};

test("development Raw request defaults to WebGL and URL parameters cannot authorize the adapter", async ({ page }) => {
  const webgpuModuleRequests: string[] = [];
  page.on("request", (request) => {
    if (/three[/._-]webgpu|GroundGlassWebGPUAdapter/i.test(request.url())) webgpuModuleRequests.push(request.url());
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/simulator/free/architecture-rise?groundGlassBackend=webgpu&rawDebug=true&rttDiagnostics=1");

  const pane = page.locator('[data-testid="ground-glass-rtt"][data-rtt-channel="default"]');
  await expect(page.getByLabel("Raw RTT — bypass DOF")).not.toBeChecked();
  await expect(pane).toHaveAttribute("data-render-host-lifecycle", "ready", { timeout: 60_000 });
  await expect(pane).toHaveAttribute("data-mounted-renderer-family", "webgl-renderer");
  await expect(pane).toHaveAttribute("data-actual-execution-api", /^webgl2?$/);
  await expect(page.getByTestId("ground-glass-webgpu-pilot")).toHaveCount(0);
  expect(webgpuModuleRequests).toEqual([]);
});

test("native-required app-host pilot renders Architecture Rise Raw RTT and cleans up across SPA remount", async ({ page }, testInfo) => {
  test.skip(!nativeWebGpuRequired, "Run with GROUND_GLASS_NATIVE_WEBGPU_REQUIRED=1 in the headed Chrome project");
  test.setTimeout(300_000);

  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  const webgpuModuleRequests: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("request", (request) => {
    if (/three[/._-]webgpu|GroundGlassWebGPUAdapter/i.test(request.url())) webgpuModuleRequests.push(request.url());
  });

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/simulator/free/architecture-rise?rttDiagnostics=1");
  const pane = page.locator('[data-testid="ground-glass-rtt"][data-rtt-channel="default"]');
  await expect(pane).toHaveAttribute("data-render-host-lifecycle", "ready", { timeout: 90_000 });
  await expect(pane).toHaveAttribute("data-mounted-renderer-family", "webgl-renderer");

  const rawDebug = page.getByLabel("Raw RTT — bypass DOF");
  await rawDebug.check();
  let pilot = page.getByTestId("ground-glass-webgpu-pilot");
  await expect(pilot).toBeVisible({ timeout: 90_000 });
  await expect(pane).toHaveAttribute("data-mounted-renderer-family", "webgpu-renderer", { timeout: 120_000 });
  await expect(pane).toHaveAttribute("data-actual-execution-api", "webgpu");
  await expect(pilot).toHaveAttribute("data-mounted-renderer-family", "webgpu-renderer");
  await expect(pilot).toHaveAttribute("data-actual-execution-api", "webgpu");
  await expect(pilot).toHaveAttribute("data-frame-ready", "true");
  await expect(pilot).toHaveAttribute("data-scene-subject-realization", "registered-ground-glass-profile");
  await expect(pilot).toHaveAttribute("data-scene-subject-mounted", "true");
  await expect(pilot).toHaveAttribute("data-scene-subject-child-count", /^[1-9]\d*$/);
  await expect(pilot).toHaveAttribute("data-camera-configured", "true");
  await expect(pilot).toHaveAttribute("data-camera-coordinate-system", "webgpu");
  await expect(pilot).toHaveAttribute("data-target-depth-enabled", "true");
  await expect(pilot).toHaveAttribute("data-target-depth-format", "depth24plus");
  await expect(pilot).toHaveAttribute("data-target-color-format", "rgba8unorm");
  await expect(pilot).toHaveAttribute("data-frame-scene-id", "architecture-rise");
  const initialGeneration = await pane.getAttribute("data-renderer-generation");
  const initialRequestId = await pane.getAttribute("data-frame-request-id");
  const currentCanvas = pilot.locator("canvas");
  const initialCanvasHandle = await currentCanvas.elementHandle();
  expect(initialGeneration).toBeTruthy();
  expect(initialRequestId).toBeTruthy();
  await expect(pane).toHaveAttribute("data-last-completed-request-id", initialRequestId!);
  await expect(pilot).toHaveAttribute("data-renderer-generation", initialGeneration!);
  await expect(pilot).toHaveAttribute("data-frame-request-id", initialRequestId!);
  await expect(pilot).toHaveAttribute("data-last-displayed-request-id", initialRequestId!);
  await expect(pilot).toHaveAttribute("data-last-displayed-frame-id", /generation-/);

  const initialCamera = await pilot.evaluate((element) => ({
    left: Number(element.getAttribute("data-camera-left")),
    right: Number(element.getAttribute("data-camera-right")),
    top: Number(element.getAttribute("data-camera-top")),
    bottom: Number(element.getAttribute("data-camera-bottom")),
    near: Number(element.getAttribute("data-camera-near")),
    far: Number(element.getAttribute("data-camera-far")),
  }));
  expect(Object.values(initialCamera).every(Number.isFinite)).toBe(true);
  expect(initialCamera.right).toBeGreaterThan(initialCamera.left);
  expect(initialCamera.top).toBeGreaterThan(initialCamera.bottom);
  expect(initialCamera.near).toBeGreaterThan(0);
  expect(initialCamera.far).toBeGreaterThan(initialCamera.near);

  const rawMode = page.getByRole("radio", { name: "Raw Ground Glass", exact: true });
  const uprightMode = page.getByRole("radio", { name: "Upright Assist", exact: true });
  await rawMode.check();
  await expect(pilot).toHaveAttribute("data-preview-mode", "raw");
  await waitForCurrentFrame(page);
  const rawImage = await currentCanvas.screenshot({ animations: "disabled" });
  const rawImageAnalysis = await analyzeCanvasScreenshot(page, rawImage);
  expect(rawImageAnalysis.contentful).toBe(true);
  expect(rawImageAnalysis.meanLuminance).toBeGreaterThan(1);
  const baselineRawGeometry = await verifyIndependentSignGeometry({
    page,
    pilot,
    screenshot: rawImage,
    riseMm: 0,
    previewMode: "raw",
  });
  assertIndependentGeometryEvidence(baselineRawGeometry);
  await testInfo.attach("ground-glass-m3-webgpu-raw-native.png", {
    body: rawImage,
    contentType: "image/png",
  });

  const rawRequestId = await pane.getAttribute("data-frame-request-id");
  await uprightMode.check();
  await expect(pilot).toHaveAttribute("data-preview-mode", "upright");
  await expect.poll(() => pane.getAttribute("data-frame-request-id"), { timeout: 60_000 }).not.toBe(rawRequestId);
  await waitForCurrentFrame(page);
  const uprightImage = await currentCanvas.screenshot({ animations: "disabled" });
  const uprightImageAnalysis = await analyzeCanvasScreenshot(page, uprightImage);
  expect(uprightImageAnalysis.contentful).toBe(true);
  const baselineUprightGeometry = await verifyIndependentSignGeometry({
    page,
    pilot,
    screenshot: uprightImage,
    riseMm: 0,
    previewMode: "upright",
  });
  assertIndependentGeometryEvidence(baselineUprightGeometry);

  const rawPatches = await samplePatches(page, rawImage, ASYMMETRIC_POINTS);
  const uprightExpectedPatches = await samplePatches(page, uprightImage, ASYMMETRIC_POINTS.map((point) => ({
    ...point,
    u: 1 - point.u,
    v: 1 - point.v,
  })));
  const uprightWrongHorizontalPatches = await samplePatches(page, uprightImage, ASYMMETRIC_POINTS.map((point) => ({
    ...point,
    u: 1 - point.u,
  })));
  const uprightWrongVerticalPatches = await samplePatches(page, uprightImage, ASYMMETRIC_POINTS.map((point) => ({
    ...point,
    v: 1 - point.v,
  })));
  const orientationEvidence = {
    rawImage: rawImageAnalysis,
    uprightImage: uprightImageAnalysis,
    rawPatches,
    uprightExpectedPatches,
    correctMeanRgbDifference: meanPatchDifference(rawPatches, uprightExpectedPatches),
    wrongHorizontalDifference: meanPatchDifference(rawPatches, uprightWrongHorizontalPatches),
    wrongVerticalDifference: meanPatchDifference(rawPatches, uprightWrongVerticalPatches),
  };
  expect(orientationEvidence.correctMeanRgbDifference + 8).toBeLessThan(orientationEvidence.wrongHorizontalDifference);
  expect(orientationEvidence.correctMeanRgbDifference + 8).toBeLessThan(orientationEvidence.wrongVerticalDifference);

  const uprightRequestId = await pane.getAttribute("data-frame-request-id");
  await rawMode.check();
  await expect(pilot).toHaveAttribute("data-preview-mode", "raw");
  await waitForCurrentFrame(page);
  await expect.poll(() => pane.getAttribute("data-frame-request-id"), { timeout: 60_000 }).not.toBe(uprightRequestId);
  // Match the independently sampled Phase C state through the public, reachable control step.
  await setStepRangeInput(page, "Rise", 20);
  await waitForCurrentFrame(page);
  const rise20RawImage = await currentCanvas.screenshot({ animations: "disabled" });
  const rise20RawGeometry = await verifyIndependentSignGeometry({
    page,
    pilot,
    screenshot: rise20RawImage,
    riseMm: 20,
    previewMode: "raw",
  });
  assertIndependentGeometryEvidence(rise20RawGeometry);
  const stage = page.getByLabel("GroundGlassViewport").locator("[data-zoomed]");
  const generationBeforeCrop = await pane.getAttribute("data-renderer-generation");
  const requestBeforeCrop = await pane.getAttribute("data-frame-request-id");
  await clickStageAt(page, stage, 0.7, 0.35);
  await expect(stage).toHaveAttribute("data-zoomed", "true");
  await expect(stage).toHaveAttribute("data-focus-loupe-window-width", "0.25");
  await expect.poll(() => pane.getAttribute("data-frame-request-id"), { timeout: 60_000 }).not.toBe(requestBeforeCrop);
  await waitForCurrentFrame(page);
  expect(await pane.getAttribute("data-renderer-generation")).toBe(generationBeforeCrop);

  const displayedCrop = await stage.evaluate((element) => ({
    centerU: Number(element.getAttribute("data-focus-loupe-center-u")),
    centerV: Number(element.getAttribute("data-focus-loupe-center-v")),
    width: Number(element.getAttribute("data-focus-loupe-window-width")),
    height: Number(element.getAttribute("data-focus-loupe-window-height")),
  }));
  const rawSourceCrop = (await pilot.getAttribute("data-source-crop"))?.split(",").map(Number) ?? [];
  expect(rawSourceCrop).toHaveLength(4);
  expect(rawSourceCrop[0]).toBeCloseTo(1 - displayedCrop.centerU, 5);
  expect(rawSourceCrop[1]).toBeCloseTo(1 - displayedCrop.centerV, 5);
  expect(rawSourceCrop[2]).toBeCloseTo(0.25, 5);
  expect(rawSourceCrop[3]).toBeCloseTo(0.25, 5);
  const rawCropImage = await currentCanvas.screenshot({ animations: "disabled" });
  expect((await analyzeCanvasScreenshot(page, rawCropImage)).contentful).toBe(true);
  const offCenterRawCropGeometry = await verifyIndependentSignGeometry({
    page,
    pilot,
    screenshot: rawCropImage,
    riseMm: 20,
    previewMode: "raw",
    requireDarkAndLight: false,
  });
  assertIndependentGeometryEvidence(offCenterRawCropGeometry, {
    minimumLandmarks: 2,
    checkAppearanceScore: false,
    checkWrongAxisControls: false,
  });

  const rawCropRequestId = await pane.getAttribute("data-frame-request-id");
  await uprightMode.check();
  await expect(pilot).toHaveAttribute("data-preview-mode", "upright");
  await expect.poll(() => pane.getAttribute("data-frame-request-id"), { timeout: 60_000 }).not.toBe(rawCropRequestId);
  await waitForCurrentFrame(page);

  // Changing the public orientation intentionally resets the Stage loupe. Create a fresh
  // upright-space crop so this assertion checks the actual mode-specific crop contract.
  await expect(stage).toHaveAttribute("data-zoomed", "false");
  const uprightCropBaseRequest = await pane.getAttribute("data-frame-request-id");
  await clickStageAt(page, stage, 0.7, 0.35);
  await expect(stage).toHaveAttribute("data-zoomed", "true");
  await expect.poll(() => pane.getAttribute("data-frame-request-id"), { timeout: 60_000 }).not.toBe(uprightCropBaseRequest);
  await waitForCurrentFrame(page);
  const uprightDisplayedCrop = await stage.evaluate((element) => ({
    centerU: Number(element.getAttribute("data-focus-loupe-center-u")),
    centerV: Number(element.getAttribute("data-focus-loupe-center-v")),
    width: Number(element.getAttribute("data-focus-loupe-window-width")),
    height: Number(element.getAttribute("data-focus-loupe-window-height")),
  }));
  const uprightSourceCrop = (await pilot.getAttribute("data-source-crop"))?.split(",").map(Number) ?? [];
  expect(uprightSourceCrop).toHaveLength(4);
  expect(uprightSourceCrop[0]).toBeCloseTo(uprightDisplayedCrop.centerU, 5);
  expect(uprightSourceCrop[1]).toBeCloseTo(uprightDisplayedCrop.centerV, 5);
  expect(uprightSourceCrop[2]).toBeCloseTo(0.25, 5);
  expect(uprightSourceCrop[3]).toBeCloseTo(0.25, 5);

  const resizeGeneration = await pane.getAttribute("data-renderer-generation");
  const resizeRequest = await pane.getAttribute("data-frame-request-id");
  const oldTargetSize = {
    width: Number(await pilot.getAttribute("data-target-width")),
    height: Number(await pilot.getAttribute("data-target-height")),
  };
  await page.setViewportSize({ width: 1160, height: 900 });
  await expect.poll(() => pane.getAttribute("data-frame-request-id"), { timeout: 60_000 }).not.toBe(resizeRequest);
  await waitForCurrentFrame(page);
  expect(await pane.getAttribute("data-renderer-generation")).toBe(resizeGeneration);
  const resizedTargetSize = {
    width: Number(await pilot.getAttribute("data-target-width")),
    height: Number(await pilot.getAttribute("data-target-height")),
  };
  expect(resizedTargetSize.width > 0 && resizedTargetSize.height > 0).toBe(true);
  expect(resizedTargetSize.width !== oldTargetSize.width || resizedTargetSize.height !== oldTargetSize.height).toBe(true);
  const resizedUprightImage = await currentCanvas.screenshot({ animations: "disabled" });
  const resizedUprightGeometry = await verifyIndependentSignGeometry({
    page,
    pilot,
    screenshot: resizedUprightImage,
    riseMm: 20,
    previewMode: "upright",
    requireDarkAndLight: false,
  });
  assertIndependentGeometryEvidence(resizedUprightGeometry, {
    minimumLandmarks: 1,
    checkAppearanceScore: false,
    checkWrongAxisControls: false,
  });

  const retiredGeneration = await pane.getAttribute("data-renderer-generation");
  const retiredCanvas = initialCanvasHandle;
  const retiredAdapter = await pilot.elementHandle();
  if (!retiredCanvas || !retiredAdapter) throw new Error("Native WebGPU adapter evidence could not be retained for cleanup verification");
  await page.getByRole("link", { name: "All Scenes", exact: true }).click();
  await expect(page).toHaveURL(/\/scenes$/);
  await expect.poll(() => page.evaluate((element) => !element.isConnected, retiredCanvas)).toBe(true);
  await expect.poll(() => retiredAdapter.getAttribute("data-cleanup-outcome"), { timeout: 90_000 }).toBe("confirmed");

  await page.locator('article.scene-feature-card a.btn--primary[href="/simulator/free/architecture-rise"]').click();
  await expect(page).toHaveURL(/\/simulator\/free\/architecture-rise$/);
  const remountedPane = page.locator('[data-testid="ground-glass-rtt"][data-rtt-channel="default"]');
  await expect(remountedPane).toHaveAttribute("data-render-host-lifecycle", "ready", { timeout: 90_000 });
  await expect(remountedPane).toHaveAttribute("data-mounted-renderer-family", "webgl-renderer");
  await page.getByLabel("Raw RTT — bypass DOF").check();
  pilot = page.getByTestId("ground-glass-webgpu-pilot");
  await expect(remountedPane).toHaveAttribute("data-mounted-renderer-family", "webgpu-renderer", { timeout: 120_000 });
  await expect(remountedPane).toHaveAttribute("data-actual-execution-api", "webgpu");
  await waitForCurrentFrame(page);
  const remountedGeneration = await remountedPane.getAttribute("data-renderer-generation");
  const remountedRequestId = await remountedPane.getAttribute("data-frame-request-id");
  expect(remountedGeneration).toBeTruthy();
  expect(remountedRequestId).toBeTruthy();
  expect(remountedGeneration).not.toBe(retiredGeneration);
  await expect(pilot).toHaveAttribute("data-last-displayed-request-id", remountedRequestId!);
  expect(webgpuModuleRequests.length).toBeGreaterThan(0);

  await testInfo.attach("ground-glass-m3-native-host-evidence.json", {
    body: JSON.stringify({
      browserVersion: page.context().browser()?.version() ?? "unknown",
      operatingSystem: `${process.platform} ${process.arch}`,
      threeRevision: REVISION,
      sceneSourceRevision: ARCHITECTURE_RISE_RAW_RTT_SOURCE_REVISION,
      environment: "headed native-required Chrome",
      sceneId: "architecture-rise",
      feature: "raw-rtt",
      colorConfiguration: {
        targetFormat: "rgba8unorm",
        targetColorSpace: "no-color-space",
        rendererOutputColorSpace: "srgb",
        toneMapping: "none",
        antialias: false,
        depthFormat: "depth24plus",
      },
      initialGeneration,
      retiredGeneration,
      remountedGeneration,
      initialRequestId,
      rawSourceCrop,
      uprightSourceCrop,
      initialCamera,
      initialTargetSize: oldTargetSize,
      resizedTargetSize,
      rawImageAnalysis,
      independentGeometryEvidence: {
        baselineRaw: baselineRawGeometry,
        baselineUpright: baselineUprightGeometry,
        rise20Raw: rise20RawGeometry,
        offCenterRawCrop: offCenterRawCropGeometry,
        resizedUpright: resizedUprightGeometry,
        oracle: "independent lens-ray / canonical film-plane intersection; candidate camera projection helper is not called",
        wrongAxisNegativeControls: ["horizontal-reflection", "vertical-reflection", "x-y-swap"],
        threshold: "full-film dark/light semantic score under 45; full-film wrong-axis score at least 6 worse; dark landmark centroid error at most 6 px; crop/resize checks use visible landmark coordinates only",
      },
      orientationEvidence,
      cleanupOutcome: await retiredAdapter.getAttribute("data-cleanup-outcome"),
      mountedRendererFamily: await remountedPane.getAttribute("data-mounted-renderer-family"),
      actualExecutionApi: await remountedPane.getAttribute("data-actual-execution-api"),
      webgpuModuleRequests,
      pageErrors,
      consoleErrors,
    }, null, 2),
    contentType: "application/json",
  });
  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});
