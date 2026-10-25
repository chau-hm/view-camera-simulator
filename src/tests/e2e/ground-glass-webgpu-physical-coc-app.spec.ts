import { expect, test, type Page } from "@playwright/test";
import { REVISION } from "three";
import { computePhysicalBlurFootprint, deriveOrthonormalPlaneBasis } from "../../core/optics/computePhysicalBlurFootprint";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import geometry, { referenceObjects } from "../../scenes/architectureRiseGeometry";
import { architectureRiseScene } from "../../scenes/definitions/architecture-rise";
import { ARCHITECTURE_RISE_RAW_RTT_SOURCE_REVISION } from "../../render/webgpu/groundGlassRawWebGpuCompatibility";
import type { GroundGlassPhysicalCocProbeReadback } from "../../render/webgpu/groundGlassWebGpuTestSeam";
import { DEFAULT_CAMERA_STATE } from "../../utils/constants";
import type { Vec3 } from "../../types/optics";
import { clickStageAt } from "./helpers/groundGlass";
import { setStepRangeInput } from "./helpers/stepRangeInput";

const nativeRequired = process.env.GROUND_GLASS_NATIVE_WEBGPU_REQUIRED === "1";
const physicalResearchEnabled = process.env.GROUND_GLASS_WEBGPU_PHYSICAL_COC_RESEARCH === "1";
const rawPilotEnabled = process.env.VITE_GROUND_GLASS_WEBGPU_RAW_PILOT === "true";

type SurfaceProbe = Readonly<{
  id: string;
  surfaceId: string;
  pointMm: Vec3;
  zMm: number;
  boundsMm: Readonly<{ minX: number; maxX: number; minY: number; maxY: number }>;
}>;

const subtract = (left: Vec3, right: Vec3): Vec3 => ({
  x: left.x - right.x,
  y: left.y - right.y,
  z: left.z - right.z,
});
const add = (left: Vec3, right: Vec3): Vec3 => ({
  x: left.x + right.x,
  y: left.y + right.y,
  z: left.z + right.z,
});
const dot = (left: Vec3, right: Vec3): number => left.x * right.x + left.y * right.y + left.z * right.z;
const cross = (left: Vec3, right: Vec3): Vec3 => ({
  x: left.y * right.z - left.z * right.y,
  y: left.z * right.x - left.x * right.z,
  z: left.x * right.y - left.y * right.x,
});
const scale = (value: Vec3, amount: number): Vec3 => ({
  x: value.x * amount,
  y: value.y * amount,
  z: value.z * amount,
});
const magnitude = (value: Vec3): number => Math.sqrt(dot(value, value));
const normalize = (value: Vec3): Vec3 => scale(value, 1 / magnitude(value));

/** Independent lens-ray/film-plane projection; does not call the adapter camera helper. */
const projectWorldPointToFilm = (input: Readonly<{
  worldPoint: Vec3;
  lensCenter: Vec3;
  corners: ReturnType<typeof deriveOpticsState>["filmPlaneCornersWorld"];
}>) => {
  const { topLeft, topRight, bottomLeft } = input.corners;
  const uAxis = subtract(topRight, topLeft);
  const vAxis = subtract(bottomLeft, topLeft);
  const normal = normalize(cross(uAxis, vAxis));
  const rayDirection = normalize(subtract(input.lensCenter, input.worldPoint));
  const denominator = dot(rayDirection, normal);
  if (Math.abs(denominator) <= 1e-8) return null;
  const distance = dot(subtract(topLeft, input.lensCenter), normal) / denominator;
  if (distance <= 0) return null;
  const filmHit = add(input.lensCenter, scale(rayDirection, distance));
  const relative = subtract(filmHit, topLeft);
  const uu = dot(uAxis, uAxis);
  const uv = dot(uAxis, vAxis);
  const vv = dot(vAxis, vAxis);
  const ur = dot(uAxis, relative);
  const vr = dot(vAxis, relative);
  const determinant = uu * vv - uv * uv;
  if (Math.abs(determinant) <= 1e-8) return null;
  return {
    u: (ur * vv - vr * uv) / determinant,
    v: (vr * uu - ur * uv) / determinant,
  };
};

const surfaceProbes = (): readonly SurfaceProbe[] => {
  const near = referenceObjects.find((object) => object.id === "plinth-foreground-left");
  const checker = referenceObjects.find((object) => object.id === "plinth-mid-right");
  if (!near || !checker) throw new Error("Architecture Rise reference surfaces are unavailable");
  const sign = geometry.streetContext.streetSign;
  const signFrontZ = sign.z - (sign.panelDepth + sign.faceDepth) / 2 - 2 - sign.faceDepth / 2;
  const checkerPanelWidth = Math.min(320, checker.width * 0.9);
  const checkerPanelHeight = Math.min(320, checker.height * 0.9);
  const checkerCellWidth = checkerPanelWidth / 4;
  const checkerCellHeight = checkerPanelHeight / 4;
  const checkerX = checker.x - checkerPanelWidth / 2 + 3 * checkerCellWidth + checkerCellWidth / 2;
  const checkerY = geometry.ground.y + checker.height / 2 - checkerPanelHeight / 2 + 2 * checkerCellHeight + checkerCellHeight / 2;
  const focusCell = geometry.getArchitectureFocusChartCells()[63];
  if (!focusCell) throw new Error("Architecture Rise focus-chart probe is unavailable");
  const make = (
    id: string,
    surfaceId: string,
    pointMm: Vec3,
    zMm: number,
    width: number,
    height: number,
  ): SurfaceProbe => ({
    id,
    surfaceId,
    pointMm,
    zMm,
    boundsMm: {
      minX: pointMm.x - width / 2,
      maxX: pointMm.x + width / 2,
      minY: pointMm.y - height / 2,
      maxY: pointMm.y + height / 2,
    },
  });

  return [
    make(
      "near-foreground-plinth",
      "plinth-foreground-left-front",
      { x: near.x + 40, y: geometry.ground.y + 200, z: near.z - near.depth / 2 },
      near.z - near.depth / 2,
      near.width,
      near.height,
    ),
    make(
      "far-street-sign-face",
      "street-sign-front-face",
      { x: sign.x + 205, y: sign.panelCenterY - 145, z: signFrontZ },
      signFrontZ,
      sign.faceWidth,
      sign.faceHeight,
    ),
    make(
      "off-axis-midground-checker",
      "plinth-mid-right-checker-cell",
      { x: checkerX, y: checkerY, z: checker.z - checker.depth / 2 - 5 },
      checker.z - checker.depth / 2 - 5,
      checkerCellWidth,
      checkerCellHeight,
    ),
    make(
      "asymmetric-sign-edge",
      "street-sign-front-face-edge",
      { x: sign.x - sign.faceWidth / 2 + 38, y: sign.panelCenterY - 145, z: signFrontZ },
      signFrontZ,
      72,
      100,
    ),
    make(
      "far-focus-chart-cell",
      `focus-chart-${focusCell.id}`,
      { x: focusCell.x, y: focusCell.y, z: focusCell.z - focusCell.depth / 2 - 1 },
      focusCell.z - focusCell.depth / 2 - 1,
      focusCell.width,
      focusCell.height,
    ),
  ];
};

const parseSourceCrop = async (pilot: ReturnType<Page["getByTestId"]>) => {
  const values = (await pilot.getAttribute("data-source-crop"))?.split(",").map(Number) ?? [];
  if (values.length !== 4 || values.some((value) => !Number.isFinite(value))) {
    throw new Error("Raw pilot did not expose a finite source crop");
  }
  return { centerU: values[0]!, centerV: values[1]!, width: values[2]!, height: values[3]! };
};

/** Intersect the independently projected pixel-centre ray with the known flat scene surface. */
const intersectPixelWithSurface = (input: Readonly<{
  optics: ReturnType<typeof deriveOpticsState>;
  surface: SurfaceProbe;
  u: number;
  v: number;
  crop: Awaited<ReturnType<typeof parseSourceCrop>>;
}>): readonly [number, number, number] => {
  const filmU = input.crop.centerU + (input.u - 0.5) * input.crop.width;
  const filmV = 1 - (input.crop.centerV + (input.v - 0.5) * input.crop.height);
  const corners = input.optics.filmPlaneCornersWorld;
  const topLeft = corners.topLeft;
  const filmPoint = add(
    add(topLeft, scale(subtract(corners.topRight, topLeft), filmU)),
    scale(subtract(corners.bottomLeft, topLeft), filmV),
  );
  const ray = subtract(input.optics.lensCenterWorld, filmPoint);
  if (Math.abs(ray.z) <= 1e-9) throw new Error(`Probe ${input.surface.id} has a parallel scene ray`);
  const distance = (input.surface.zMm - input.optics.lensCenterWorld.z) / ray.z;
  const point = add(input.optics.lensCenterWorld, scale(ray, distance));
  const bounds = input.surface.boundsMm;
  if (
    point.x < bounds.minX || point.x > bounds.maxX ||
    point.y < bounds.minY || point.y > bounds.maxY
  ) {
    throw new Error(`Pixel-centre ray missed known surface ${input.surface.surfaceId}: ${JSON.stringify(point)}`);
  }
  return [point.x / 1000, point.y / 1000, point.z / 1000];
};

const waitForCompletedFrame = async (page: Page) => {
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

const expectPhysicalFrame = async (page: Page) => {
  const pane = page.locator('[data-testid="ground-glass-rtt"][data-rtt-channel="default"]');
  const pilot = page.getByTestId("ground-glass-webgpu-pilot");
  await waitForCompletedFrame(page);
  await expect(pilot).toHaveAttribute("data-physical-coc-status", "completed", { timeout: 90_000 });
  await expect(pilot).toHaveAttribute("data-physical-coc-depth-format", "depth24plus");
  await expect(pilot).toHaveAttribute("data-physical-coc-storage-format", "rgba16float");
  await expect(pilot).toHaveAttribute("data-physical-coc-validity-format", "rgba8unorm");
  await expect(pilot).toHaveAttribute("data-physical-coc-passes", "sceneDepth,physicalCoc,validity");
  await expect(pilot).toHaveAttribute("data-physical-coc-request-id", await pane.getAttribute("data-frame-request-id") ?? "");
};

const createRealSceneProbes = (input: Readonly<{
  optics: ReturnType<typeof deriveOpticsState>;
  targetWidth: number;
  targetHeight: number;
  crop: Awaited<ReturnType<typeof parseSourceCrop>>;
}>): Array<Record<string, unknown>> => {
  const probes: Array<Record<string, unknown>> = surfaceProbes().map((surface) => {
    const film = projectWorldPointToFilm({
      worldPoint: surface.pointMm,
      lensCenter: input.optics.lensCenterWorld,
      corners: input.optics.filmPlaneCornersWorld,
    });
    if (!film) throw new Error(`Could not project ${surface.surfaceId} to the film`);
    const u = (film.u - input.crop.centerU) / input.crop.width + 0.5;
    const v = ((1 - film.v) - input.crop.centerV) / input.crop.height + 0.5;
    if (u < 0.005 || u > 0.995 || v < 0.005 || v > 0.995) {
      throw new Error(`Known surface ${surface.surfaceId} projects outside the native target: ${u}, ${v}`);
    }
    const x = Math.min(input.targetWidth - 1, Math.floor(u * input.targetWidth));
    const y = Math.min(input.targetHeight - 1, Math.floor(v * input.targetHeight));
    const centerU = (x + 0.5) / input.targetWidth;
    const centerV = (y + 0.5) / input.targetHeight;
    return {
      id: surface.id,
      u: centerU,
      v: centerV,
      expectedWorldM: intersectPixelWithSurface({
        optics: input.optics,
        surface,
        u: centerU,
        v: centerV,
        crop: input.crop,
      }),
      expectedSurfaceId: surface.surfaceId,
    };
  });

  // Four corners provide a bounded search for clear background while the expected
  // geometry probes above validate known visible surfaces and depth orientation.
  for (const [id, u, v] of [
    ["background-top-left", 0.01, 0.01],
    ["background-top-right", 0.99, 0.01],
    ["background-bottom-left", 0.01, 0.99],
    ["background-bottom-right", 0.99, 0.99],
  ] as const) probes.push({ id, u, v, expectedWorldM: null, expectedSurfaceId: "background-candidate" });
  return probes;
};

const createControlledProbes = (input: Readonly<{
  optics: ReturnType<typeof deriveOpticsState>;
  targetWidth: number;
  focalLengthMm: number;
  apertureFNumber: number;
  lensBasis: NonNullable<ReturnType<typeof deriveOrthonormalPlaneBasis>>;
}>): Array<Record<string, unknown>> => {
  const objectPointFor = (distanceMm: number): [number, number, number] => {
    const position = add(
      add(input.optics.lensCenterWorld, scale(input.lensBasis.normal, distanceMm)),
      scale(input.lensBasis.x, 250),
    );
    return [position.x, position.y, position.z];
  };
  const cases = [
    { id: "controlled-u-f-minus-0.01", deltaMm: -0.01, branchCode: 1 },
    { id: "controlled-u-f-minus-0.001", deltaMm: -0.001, branchCode: 1 },
    { id: "controlled-u-f-exact-unresolved", deltaMm: 0, branchCode: 0, explicitParallelLimitIdentity: false },
    { id: "controlled-u-f-exact-authorized", deltaMm: 0, branchCode: 2, explicitParallelLimitIdentity: true },
    { id: "controlled-u-f-plus-0.001", deltaMm: 0.001, branchCode: 3 },
    { id: "controlled-u-f-plus-0.01", deltaMm: 0.01, branchCode: 3 },
  ];
  return cases.map((testCase, index) => ({
    id: testCase.id,
    u: (index + 0.5) / input.targetWidth,
    v: 0.5,
    controlledObjectPointMm: objectPointFor(input.focalLengthMm + testCase.deltaMm),
    explicitParallelLimitIdentity: testCase.explicitParallelLimitIdentity ?? false,
    expectedBranchCode: testCase.branchCode,
    focalLengthMm: input.focalLengthMm,
    apertureFNumber: input.apertureFNumber,
  }));
};

const readProbeResult = async (page: Page, token: string): Promise<GroundGlassPhysicalCocProbeReadback | null> =>
  page.evaluate((expectedToken) => {
    const control = window.__groundGlassWebGpuM3TestControl;
    return control?.physicalCocProbeReadback?.token === expectedToken
      ? control.physicalCocProbeReadback
      : null;
  }, token);

test("native M4 app adapter reconstructs Architecture Rise depth and writes physical CoC data", async ({ page }, testInfo) => {
  test.skip(
    !nativeRequired || !physicalResearchEnabled || !rawPilotEnabled,
    "Requires headed native WebGPU, the M3 Raw pilot, and the separate M4 research build gate",
  );
  test.setTimeout(600_000);
  expect(REVISION).toBe("186");

  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.addInitScript(() => {
    window.__groundGlassWebGpuM3TestControl = {};
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/simulator/free/architecture-rise?rttDiagnostics=1");

  const pane = page.locator('[data-testid="ground-glass-rtt"][data-rtt-channel="default"]');
  await expect(pane).toHaveAttribute("data-render-host-lifecycle", "ready", { timeout: 90_000 });
  await page.getByLabel("Raw RTT — bypass DOF").check();
  const pilot = page.getByTestId("ground-glass-webgpu-pilot");
  await expect(pane).toHaveAttribute("data-mounted-renderer-family", "webgpu-renderer", { timeout: 120_000 });
  await expect(pane).toHaveAttribute("data-actual-execution-api", "webgpu");
  await expect(pilot).toHaveAttribute("data-scene-subject-realization", "registered-ground-glass-profile");
  await expect(pilot).toHaveAttribute("data-scene-subject-mounted", "true");
  await expect(pilot).toHaveAttribute("data-camera-coordinate-system", "webgpu");
  await expectPhysicalFrame(page);

  const crop = await parseSourceCrop(pilot);
  expect(crop).toEqual({ centerU: 0.5, centerV: 0.5, width: 1, height: 1 });
  const targetWidth = Number(await pilot.getAttribute("data-target-width"));
  const targetHeight = Number(await pilot.getAttribute("data-target-height"));
  expect(targetWidth).toBeGreaterThan(0);
  expect(targetHeight).toBeGreaterThan(0);

  const cameraState = {
    ...DEFAULT_CAMERA_STATE,
    ...architectureRiseScene.cameraPreset,
    activeSceneId: architectureRiseScene.id,
  };
  const optics = deriveOpticsState(cameraState, architectureRiseScene);
  const lensBasis = deriveOrthonormalPlaneBasis(
    optics.lensPlane.normal,
    optics.rearStandardFrame.rightWorld,
    optics.rearStandardFrame.upWorld,
  );
  expect(lensBasis).not.toBeNull();
  const probes = [
    ...createRealSceneProbes({ optics, targetWidth, targetHeight, crop }),
    ...createControlledProbes({
      optics,
      targetWidth,
      focalLengthMm: cameraState.focalLengthMm,
      apertureFNumber: 16,
      lensBasis: lensBasis!,
    }),
  ];
  expect(probes.length).toBeLessThanOrEqual(16);
  const aperture = page.getByRole("radiogroup", { name: "Aperture", exact: true });
  await aperture.getByRole("radio", { name: "f/8", exact: true }).check();
  await expectPhysicalFrame(page);
  const previousRequestId = await pane.getAttribute("data-frame-request-id");
  const probeToken = `m4-physical-${Date.now()}`;
  await page.evaluate(({ token, requestedProbes }) => {
    const control = window.__groundGlassWebGpuM3TestControl;
    if (!control) throw new Error("The development-only Ground Glass test seam is unavailable");
    control.physicalCocProbeReadback = null;
    control.physicalCocProbeRequest = {
      token,
      probes: requestedProbes as never,
    };
  }, { token: probeToken, requestedProbes: probes });
  await aperture.getByRole("radio", { name: "f/16", exact: true }).check();
  await expect.poll(() => pane.getAttribute("data-frame-request-id"), { timeout: 60_000 }).not.toBe(previousRequestId);
  await waitForCompletedFrame(page);
  await expect.poll(async () => (await readProbeResult(page, probeToken))?.token ?? null, {
    timeout: 90_000,
  }).toBe(probeToken);
  await expectPhysicalFrame(page);

  const readback = await readProbeResult(page, probeToken);
  if (!readback) throw new Error("Native M4 adapter did not publish its bounded physical probe result");
  const currentRequestId = await pane.getAttribute("data-frame-request-id");
  const generationId = await pane.getAttribute("data-renderer-generation");
  expect(readback.sceneId).toBe("architecture-rise");
  expect(readback.requestId).toBe(currentRequestId);
  expect(readback.channelId).toBe("default");
  expect(readback.rendererGenerationId).toBe(generationId);
  expect(readback.rendererFamily).toBe("webgpu-renderer");
  expect(readback.actualExecutionApi).toBe("webgpu");
  expect(readback.internalFallback).toBe("none");
  expect(readback.widthPx).toBe(targetWidth);
  expect(readback.heightPx).toBe(targetHeight);
  expect(readback.depthFormat).toBe("depth24plus");
  expect(readback.cocStorageFormat).toBe("rgba16float");
  expect(readback.validityStorageFormat).toBe("rgba8unorm");

  const realProbeIds = new Set(surfaceProbes().map((probe) => probe.id));
  const realSamples = readback.samples.filter((sample) => realProbeIds.has(sample.id));
  expect(realSamples).toHaveLength(realProbeIds.size);
  for (const sample of realSamples) {
    expect(sample.expectedWorldM, `${sample.id} has independent surface intersection`).not.toBeNull();
    expect(sample.expectedSurfaceId).not.toBeNull();
    expect(sample.validityCode, `${sample.id} is visible in the registered Architecture Rise scene`).toBe(1);
    const expected = sample.expectedWorldM!;
    const worldErrorMm = Math.hypot(
      (sample.reconstructedWorldM[0] - expected[0]) * 1000,
      (sample.reconstructedWorldM[1] - expected[1]) * 1000,
      (sample.reconstructedWorldM[2] - expected[2]) * 1000,
    );
    expect(worldErrorMm, `${sample.id} depth reconstructs its independently intersected surface`).toBeLessThanOrEqual(25);
    expect(sample.controlledObjectPoint).toBe(false);
    expect(sample.storedFootprintMm).not.toBeNull();
  }

  const backgroundSamples = readback.samples.filter((sample) => sample.id.startsWith("background-"));
  expect(backgroundSamples).toHaveLength(4);
  const clearBackgroundSamples = backgroundSamples.filter((sample) => sample.validityCode === 0);
  expect(clearBackgroundSamples.length, "at least one independently selected target corner is clear background").toBeGreaterThan(0);
  for (const sample of clearBackgroundSamples) {
    expect(sample.depth).toBe(1);
    expect(sample.storedFootprintMm).toEqual([0, 0, 0, 0]);
  }

  const controlled = readback.samples.filter((sample) => sample.controlledObjectPoint);
  expect(controlled).toHaveLength(6);
  const branches = new Map([
    ["controlled-u-f-minus-0.01", 1],
    ["controlled-u-f-minus-0.001", 1],
    ["controlled-u-f-exact-unresolved", 0],
    ["controlled-u-f-exact-authorized", 2],
    ["controlled-u-f-plus-0.001", 3],
    ["controlled-u-f-plus-0.01", 3],
  ]);
  const filmBasis = deriveOrthonormalPlaneBasis(
    optics.filmPlane.normal,
    optics.rearStandardFrame.rightWorld,
    optics.rearStandardFrame.upWorld,
  );
  expect(filmBasis).not.toBeNull();
  const filmPlaneDistanceMm = dot(optics.filmPlane.point, optics.filmPlane.normal);
  const physicalOracle = (objectPointM: readonly [number, number, number]) => computePhysicalBlurFootprint({
    objectPoint: { x: objectPointM[0] * 1000, y: objectPointM[1] * 1000, z: objectPointM[2] * 1000 },
    lensCenter: optics.lensCenterWorld,
    lensPlaneNormal: optics.lensPlane.normal,
    lensPlaneBasisX: lensBasis!.x,
    lensPlaneBasisY: lensBasis!.y,
    filmPlane: { ...optics.filmPlane, distance: filmPlaneDistanceMm },
    filmPlaneBasisX: filmBasis!.x,
    filmPlaneBasisY: filmBasis!.y,
    focalLengthMm: cameraState.focalLengthMm,
    apertureFNumber: 16,
  });
  for (const sample of controlled) {
    const expectedBranch = branches.get(sample.id);
    expect(expectedBranch).toBeDefined();
    expect(sample.focalBranchCode, `${sample.id} preserves the exact U-f branch`).toBe(expectedBranch);
    const expectedPoint = sample.kernelObjectPositionM;
    const cpu = physicalOracle(expectedPoint);
    if (expectedBranch === 0) {
      expect(sample.validityCode, "exact U=f without identity is unresolved").toBe(4);
      expect(sample.kernelFootprintMm).toEqual([0, 0, 0, 0]);
      continue;
    }
    expect(cpu.valid, `${sample.id} CPU oracle is valid`).toBe(true);
    expect(sample.validityCode, `${sample.id} is within RGBA16F range`).toBe(1);
    expect(Math.abs(cpu.signedCoCDiameterMm - sample.kernelFootprintMm[0])).toBeLessThan(0.05);
    expect(Math.abs(cpu.majorRadiusMm - sample.kernelFootprintMm[1])).toBeLessThan(0.05);
    expect(Math.abs(cpu.minorRadiusMm - sample.kernelFootprintMm[2])).toBeLessThan(0.05);
    expect(sample.storedFootprintMm).toBeNull();
  }

  const summary = await pilot.evaluate((element) => ({
    requestId: element.getAttribute("data-physical-coc-request-id"),
    probeStatus: element.getAttribute("data-physical-coc-probe-readback-status"),
    probeCount: Number(element.getAttribute("data-physical-coc-probe-count")),
    maximumWorldErrorMm: Number(element.getAttribute("data-physical-coc-max-world-error-mm")),
    maximumKernelCoCErrorMm: Number(element.getAttribute("data-physical-coc-max-kernel-coc-error-mm")),
    maximumStorageCoCErrorMm: Number(element.getAttribute("data-physical-coc-max-storage-coc-error-mm")),
  }));
  expect(summary.requestId).toBe(currentRequestId);
  expect(summary.probeStatus).toBe("completed");
  expect(summary.probeCount).toBe(probes.length);
  expect(summary.maximumWorldErrorMm).toBeLessThanOrEqual(25);
  expect(summary.maximumKernelCoCErrorMm).toBeLessThan(0.05);
  expect(summary.maximumStorageCoCErrorMm).toBeLessThan(0.05);

  const initialGeneration = await pane.getAttribute("data-renderer-generation");
  let previousRequest = await pane.getAttribute("data-frame-request-id");
  const focus = page.getByRole("slider", { name: "Focus distance", exact: true });
  const focusStep = Number(await focus.getAttribute("step"));
  const focusValue = Number(await focus.inputValue());
  const focusMaximum = Number(await focus.getAttribute("max"));
  const nextFocus = focusValue + focusStep <= focusMaximum ? focusValue + focusStep : focusValue - focusStep;
  await setStepRangeInput(page, "Focus distance", nextFocus);
  await expect.poll(() => pane.getAttribute("data-frame-request-id"), { timeout: 60_000 }).not.toBe(previousRequest);
  await expectPhysicalFrame(page);
  previousRequest = await pane.getAttribute("data-frame-request-id");

  await setStepRangeInput(page, "Rise", 20);
  await expect.poll(() => pane.getAttribute("data-frame-request-id"), { timeout: 60_000 }).not.toBe(previousRequest);
  await expectPhysicalFrame(page);
  expect(await pane.getAttribute("data-renderer-generation")).toBe(initialGeneration);
  previousRequest = await pane.getAttribute("data-frame-request-id");

  const stage = page.getByLabel("GroundGlassViewport").locator("[data-zoomed]");
  await clickStageAt(page, stage, 0.7, 0.35);
  await expect(stage).toHaveAttribute("data-zoomed", "true");
  await expect.poll(() => pane.getAttribute("data-frame-request-id"), { timeout: 60_000 }).not.toBe(previousRequest);
  await expectPhysicalFrame(page);
  expect(await pane.getAttribute("data-renderer-generation")).toBe(initialGeneration);
  previousRequest = await pane.getAttribute("data-frame-request-id");

  const beforeResize = {
    width: Number(await pilot.getAttribute("data-target-width")),
    height: Number(await pilot.getAttribute("data-target-height")),
  };
  await page.setViewportSize({ width: 1160, height: 900 });
  await expect.poll(() => pane.getAttribute("data-frame-request-id"), { timeout: 60_000 }).not.toBe(previousRequest);
  await expectPhysicalFrame(page);
  expect(await pane.getAttribute("data-renderer-generation")).toBe(initialGeneration);
  const afterResize = {
    width: Number(await pilot.getAttribute("data-target-width")),
    height: Number(await pilot.getAttribute("data-target-height")),
  };
  expect(afterResize.width > 0 && afterResize.height > 0).toBe(true);
  expect(afterResize.width !== beforeResize.width || afterResize.height !== beforeResize.height).toBe(true);

  const retiredGeneration = await pane.getAttribute("data-renderer-generation");
  const retiredPilot = await pilot.elementHandle();
  if (!retiredPilot) throw new Error("Could not retain the native M4 adapter for cleanup evidence");
  await page.getByRole("link", { name: "All Scenes", exact: true }).click();
  await expect(page).toHaveURL(/\/scenes$/);
  await expect.poll(() => retiredPilot.getAttribute("data-cleanup-outcome"), { timeout: 90_000 }).toBe("confirmed");
  await page.locator('article.scene-feature-card a.btn--primary[href="/simulator/free/architecture-rise"]').click();
  await expect(page).toHaveURL(/\/simulator\/free\/architecture-rise$/);
  const remountedPane = page.locator('[data-testid="ground-glass-rtt"][data-rtt-channel="default"]');
  await expect(remountedPane).toHaveAttribute("data-render-host-lifecycle", "ready", { timeout: 90_000 });
  await page.getByLabel("Raw RTT — bypass DOF").check();
  await expect(remountedPane).toHaveAttribute("data-mounted-renderer-family", "webgpu-renderer", { timeout: 120_000 });
  await expect(remountedPane).toHaveAttribute("data-actual-execution-api", "webgpu");
  await expectPhysicalFrame(page);
  const remountedGeneration = await remountedPane.getAttribute("data-renderer-generation");
  expect(remountedGeneration).toBeTruthy();
  expect(remountedGeneration).not.toBe(retiredGeneration);

  await testInfo.attach("ground-glass-m4-physical-coc-native-evidence.json", {
    body: JSON.stringify({
      browserVersion: page.context().browser()?.version() ?? "unknown",
      operatingSystem: `${process.platform} ${process.arch}`,
      threeRevision: REVISION,
      sceneSourceRevision: ARCHITECTURE_RISE_RAW_RTT_SOURCE_REVISION,
      environment: "headed native-required Chrome",
      sceneId: "architecture-rise",
      rendererFamily: readback.rendererFamily,
      actualExecutionApi: readback.actualExecutionApi,
      internalFallback: readback.internalFallback,
      initialGeneration,
      retiredGeneration,
      remountedGeneration,
      probeReadback: readback,
      probeSummary: summary,
      lifecycle: { beforeResize, afterResize, cleanupOutcome: await retiredPilot.getAttribute("data-cleanup-outcome") },
      pageErrors,
    }, null, 2),
    contentType: "application/json",
  });
  expect(pageErrors).toEqual([]);
});
