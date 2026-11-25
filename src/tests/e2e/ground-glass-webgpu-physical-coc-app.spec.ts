import { expect, test, type Locator, type Page } from "@playwright/test";
import * as THREE from "three";
import { REVISION } from "three";
import { computePhysicalBlurFootprint, deriveOrthonormalPlaneBasis } from "../../core/optics/computePhysicalBlurFootprint";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import geometry, { referenceObjects } from "../../scenes/architectureRiseGeometry";
import { architectureRiseScene } from "../../scenes/definitions/architecture-rise";
import {
  ARCHITECTURE_RISE_PHYSICAL_COC_R187_EVIDENCE_REVISION,
  ARCHITECTURE_RISE_RAW_RTT_SOURCE_REVISION,
  GROUND_GLASS_RAW_WEBGPU_R187_COMPATIBILITY,
} from "../../render/webgpu/groundGlassRawWebGpuCompatibility";
import type { GroundGlassPhysicalCocProbeUv } from "../../render/webgpu/groundGlassPhysicalCocNodes";
import type {
  GroundGlassPhysicalCocControlledKernelCase,
  GroundGlassPhysicalCocProbeKernelOverride,
  GroundGlassPhysicalCocProbeReadback,
  GroundGlassPhysicalCocProbeRequest,
} from "../../render/webgpu/groundGlassWebGpuTestSeam";
import { groundGlassPhysicalCocOrientationErrorModuloPi } from "../../render/webgpu/groundGlassPhysicalCocContract";
import { DEFAULT_CAMERA_STATE } from "../../utils/constants";
import type { Vec3 } from "../../types/optics";
import { clickStageAt } from "./helpers/groundGlass";
import { attachGroundGlassM7dEvidence } from "./helpers/groundGlassM7dEvidence";
import { setStepRangeInput } from "./helpers/stepRangeInput";

const nativeRequired = process.env.GROUND_GLASS_NATIVE_WEBGPU_REQUIRED === "1";
const physicalResearchEnabled = process.env.GROUND_GLASS_WEBGPU_PHYSICAL_COC_RESEARCH === "1";
const r187QualificationEnabled = process.env.GROUND_GLASS_WEBGPU_PHYSICAL_COC_R187_QUALIFICATION === "1";
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

const waitForStableRequestId = async (page: Page, target: Locator) => {
  await expect.poll(async () => {
    const first = await target.getAttribute("data-frame-request-id");
    await page.evaluate(() => new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    }));
    const second = await target.getAttribute("data-frame-request-id");
    return first && first === second ? second : null;
  }, { timeout: 15_000 }).not.toBeNull();
  return target.getAttribute("data-frame-request-id");
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
}>): GroundGlassPhysicalCocProbeUv[] => {
  const probes: GroundGlassPhysicalCocProbeUv[] = surfaceProbes().map((surface) => {
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

  // Three corners provide a bounded search for clear background while the expected
  // geometry probes above validate known visible surfaces and depth orientation.
  for (const [id, u, v] of [
    ["background-top-left", 0.01, 0.01],
    ["background-top-right", 0.99, 0.01],
    ["background-bottom-left", 0.01, 0.99],
  ] as const) probes.push({ id, u, v, expectedWorldM: null, expectedSurfaceId: "background-candidate" });
  return probes;
};

const createControlledProbes = (input: Readonly<{
  optics: ReturnType<typeof deriveOpticsState>;
  targetWidth: number;
  focalLengthMm: number;
  apertureFNumber: number;
  lensBasis: NonNullable<ReturnType<typeof deriveOrthonormalPlaneBasis>>;
}>): GroundGlassPhysicalCocProbeUv[] => {
  const objectPointFor = (distanceMm: number): [number, number, number] => {
    const position = add(
      add(input.optics.lensCenterWorld, scale(input.lensBasis.normal, distanceMm)),
      scale(input.lensBasis.x, 250),
    );
    return [position.x, position.y, position.z];
  };
  const cases = [
    { id: "controlled-u-f-minus-0.01", deltaMm: -0.01, explicitParallelLimitIdentity: false },
    { id: "controlled-u-f-minus-0.001", deltaMm: -0.001, explicitParallelLimitIdentity: false },
    { id: "controlled-u-f-exact-unresolved", deltaMm: 0, explicitParallelLimitIdentity: false },
    { id: "controlled-u-f-exact-authorized", deltaMm: 0, explicitParallelLimitIdentity: true },
    { id: "controlled-u-f-plus-0.001", deltaMm: 0.001, explicitParallelLimitIdentity: false },
    { id: "controlled-u-f-plus-0.01", deltaMm: 0.01, explicitParallelLimitIdentity: false },
  ];
  return cases.map((testCase, index) => ({
    id: testCase.id,
    u: (index + 0.5) / input.targetWidth,
    v: 0.5,
    controlledObjectPointMm: objectPointFor(input.focalLengthMm + testCase.deltaMm),
    explicitParallelLimitIdentity: testCase.explicitParallelLimitIdentity,
  }));
};

type ControlledKernelExpectation = Readonly<{
  testCase: GroundGlassPhysicalCocControlledKernelCase;
  cpu: ReturnType<typeof computePhysicalBlurFootprint>;
}>;

const createPhysicalKernelOverride = (
  optics: ReturnType<typeof deriveOpticsState>,
  focalLengthMm: number,
  apertureFNumber: number,
): GroundGlassPhysicalCocProbeKernelOverride => {
  const lensBasis = deriveOrthonormalPlaneBasis(
    optics.lensPlane.normal,
    optics.rearStandardFrame.rightWorld,
    optics.rearStandardFrame.upWorld,
  );
  const filmBasis = deriveOrthonormalPlaneBasis(
    optics.filmPlane.normal,
    optics.rearStandardFrame.rightWorld,
    optics.rearStandardFrame.upWorld,
  );
  if (!lensBasis || !filmBasis) throw new Error("Controlled M4 kernel case has a degenerate canonical plane basis");
  // A shared origin shift is physically invariant and avoids losing sub-mm
  // differences to float32 cancellation from the public scene's world offset.
  const origin = optics.lensCenterWorld;
  const toMeters = (point: Vec3): Vec3 => ({
    x: (point.x - origin.x) / 1000,
    y: (point.y - origin.y) / 1000,
    z: (point.z - origin.z) / 1000,
  });
  return {
    lens: {
      centerWorldM: toMeters(origin),
      planeNormal: lensBasis.normal,
      planeBasisX: lensBasis.x,
      planeBasisY: lensBasis.y,
    },
    film: {
      planePointWorldM: toMeters(optics.filmPlane.point),
      planeNormal: filmBasis.normal,
      planeBasisX: filmBasis.x,
      planeBasisY: filmBasis.y,
    },
    optics: { focalLengthMm, apertureFNumber },
  };
};

const rotateKernelFilmBasis = (
  override: GroundGlassPhysicalCocProbeKernelOverride,
  angleRad: number,
): GroundGlassPhysicalCocProbeKernelOverride => {
  const { planeBasisX: x, planeBasisY: y } = override.film;
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  return {
    ...override,
    film: {
      ...override.film,
      planeBasisX: { x: cos * x.x + sin * y.x, y: cos * x.y + sin * y.y, z: cos * x.z + sin * y.z },
      planeBasisY: { x: -sin * x.x + cos * y.x, y: -sin * x.y + cos * y.y, z: -sin * x.z + cos * y.z },
    },
  };
};

const controlledPointMm = (
  override: GroundGlassPhysicalCocProbeKernelOverride,
  objectDistanceMm: number,
  lateralOffsetMm = 0,
): [number, number, number] => [
  override.lens.centerWorldM.x * 1000 + override.lens.planeNormal.x * objectDistanceMm + override.lens.planeBasisX.x * lateralOffsetMm,
  override.lens.centerWorldM.y * 1000 + override.lens.planeNormal.y * objectDistanceMm + override.lens.planeBasisX.y * lateralOffsetMm,
  override.lens.centerWorldM.z * 1000 + override.lens.planeNormal.z * objectDistanceMm + override.lens.planeBasisX.z * lateralOffsetMm,
];

const physicalOracleForOverride = (
  override: GroundGlassPhysicalCocProbeKernelOverride,
  objectPointMm: readonly [number, number, number],
) => {
  const filmPointMm = {
    x: override.film.planePointWorldM.x * 1000,
    y: override.film.planePointWorldM.y * 1000,
    z: override.film.planePointWorldM.z * 1000,
  };
  const lensCenterMm = {
    x: override.lens.centerWorldM.x * 1000,
    y: override.lens.centerWorldM.y * 1000,
    z: override.lens.centerWorldM.z * 1000,
  };
  return computePhysicalBlurFootprint({
    objectPoint: { x: objectPointMm[0], y: objectPointMm[1], z: objectPointMm[2] },
    lensCenter: lensCenterMm,
    lensPlaneNormal: override.lens.planeNormal,
    lensPlaneBasisX: override.lens.planeBasisX,
    lensPlaneBasisY: override.lens.planeBasisY,
    filmPlane: {
      point: filmPointMm,
      normal: override.film.planeNormal,
      distance: dot(filmPointMm, override.film.planeNormal),
    },
    filmPlaneBasisX: override.film.planeBasisX,
    filmPlaneBasisY: override.film.planeBasisY,
    focalLengthMm: override.optics.focalLengthMm,
    apertureFNumber: override.optics.apertureFNumber,
  });
};

const createControlledKernelExpectations = (input: Readonly<{
  cameraState: typeof DEFAULT_CAMERA_STATE;
  scene: typeof architectureRiseScene;
}>): readonly ControlledKernelExpectation[] => {
  const neutralState = {
    ...input.cameraState,
    frontRiseMm: 0,
    frontTiltDeg: 0,
    frontSwingDeg: 0,
    rearRiseMm: 0,
    rearTiltDeg: 0,
    rearSwingDeg: 0,
  };
  const derive = (movement: Partial<typeof DEFAULT_CAMERA_STATE> = {}) => deriveOpticsState(
    { ...neutralState, ...movement },
    input.scene,
  );
  const focalLengthMm = input.cameraState.focalLengthMm;
  const defaultAperture = 16;
  const neutralOptics = derive();
  const neutral = createPhysicalKernelOverride(neutralOptics, focalLengthMm, defaultAperture);
  const objectDistance = focalLengthMm * 1.8;
  const cases: ControlledKernelExpectation[] = [];
  const addCase = (
    id: string,
    override: GroundGlassPhysicalCocProbeKernelOverride,
    point: readonly [number, number, number],
  ) => {
    const testCase: GroundGlassPhysicalCocControlledKernelCase = {
      id,
      kernelOverride: override,
      probe: {
        id,
        u: 0.5,
        v: 0.5,
        controlledObjectPointMm: point,
      },
    };
    cases.push({ testCase, cpu: physicalOracleForOverride(override, point) });
  };

  addCase("ellipse-circular", neutral, controlledPointMm(neutral, objectDistance));
  const tilt = createPhysicalKernelOverride(derive({ rearTiltDeg: 12 }), focalLengthMm, defaultAperture);
  const swing = createPhysicalKernelOverride(derive({ rearSwingDeg: 14 }), focalLengthMm, defaultAperture);
  const compound = createPhysicalKernelOverride(
    derive({ rearTiltDeg: -10, rearSwingDeg: 13 }), focalLengthMm, defaultAperture,
  );
  addCase("ellipse-film-tilt", tilt, controlledPointMm(tilt, objectDistance, 120));
  addCase("ellipse-film-swing", swing, controlledPointMm(swing, objectDistance, 120));
  addCase("ellipse-compound-tilt-swing", compound, controlledPointMm(compound, objectDistance, 120));
  addCase("ellipse-off-axis", compound, controlledPointMm(compound, objectDistance, 480));

  const compoundPoint = controlledPointMm(compound, objectDistance, 120);
  const compoundCpu = physicalOracleForOverride(compound, compoundPoint);
  if (!compoundCpu.valid || compoundCpu.majorRadiusMm - compoundCpu.minorRadiusMm <= 1e-7) {
    throw new Error("Compound controlled vector did not produce a defined anisotropic principal axis");
  }
  const negativeAngleOverride = rotateKernelFilmBasis(
    compound,
    compoundCpu.orientationRad - (Math.PI - 0.2),
  );
  const nearPiOverride = rotateKernelFilmBasis(
    compound,
    compoundCpu.orientationRad - (Math.PI - 0.01),
  );
  addCase("ellipse-negative-principal-angle", negativeAngleOverride, compoundPoint);
  addCase("ellipse-near-pi-orientation", nearPiOverride, compoundPoint);
  const almostCircular = createPhysicalKernelOverride(
    derive({ rearTiltDeg: 1e-8 }),
    focalLengthMm,
    defaultAperture,
  );
  addCase("ellipse-near-circular", almostCircular, controlledPointMm(almostCircular, objectDistance));

  const lensBasis = deriveOrthonormalPlaneBasis(
    neutralOptics.lensPlane.normal,
    neutralOptics.rearStandardFrame.rightWorld,
    neutralOptics.rearStandardFrame.upWorld,
  );
  if (!lensBasis) throw new Error("Neutral physical storage vector has no lens basis");
  const lensToFilmDistanceMm = dot(
    subtract(neutralOptics.lensCenterWorld, neutralOptics.filmPlane.point),
    lensBasis.normal,
  );
  if (lensToFilmDistanceMm <= focalLengthMm) throw new Error("Neutral film plane is not beyond the focal length");
  const conjugateObjectDistanceMm =
    (focalLengthMm * lensToFilmDistanceMm) / (lensToFilmDistanceMm - focalLengthMm);
  const nearFocusCandidates = [-0.1, -0.01, -0.001, -0.0001, 0.0001, 0.001, 0.01, 0.1]
    .map((offset) => conjugateObjectDistanceMm * (1 + offset))
    .filter((distance) => distance > focalLengthMm);
  const referenceOverride = createPhysicalKernelOverride(neutralOptics, focalLengthMm, defaultAperture);
  const candidates = nearFocusCandidates
    .map((distance) => {
      const point = controlledPointMm(referenceOverride, distance);
      return { distance, point, cpu: physicalOracleForOverride(referenceOverride, point) };
    })
    .filter((candidate) => candidate.cpu.valid && Math.abs(candidate.cpu.signedCoCDiameterMm) > 1e-5);
  const positive = candidates.find((candidate) => candidate.cpu.signedCoCDiameterMm > 0);
  const negative = candidates.find((candidate) => candidate.cpu.signedCoCDiameterMm < 0);
  if (!positive || !negative) throw new Error("Canonical near-focus references did not produce both signed CoC sides");
  const stableOverflowCandidates = [0.5, 2].map((focusRatio) => {
    const distance = conjugateObjectDistanceMm * focusRatio;
    const point = controlledPointMm(referenceOverride, distance);
    return { distance, point, cpu: physicalOracleForOverride(referenceOverride, point) };
  }).filter((candidate) => candidate.cpu.valid);
  const positiveOverflowSource = stableOverflowCandidates.find((candidate) => candidate.cpu.signedCoCDiameterMm > 0);
  const negativeOverflowSource = stableOverflowCandidates.find((candidate) => candidate.cpu.signedCoCDiameterMm < 0);
  if (!positiveOverflowSource || !negativeOverflowSource) {
    throw new Error("Stable binary16 overflow vectors did not preserve both signed CoC sides");
  }
  const stableReferencePoint = controlledPointMm(referenceOverride, objectDistance);
  const stableReferenceCpu = physicalOracleForOverride(referenceOverride, stableReferencePoint);
  if (!stableReferenceCpu.valid || Math.abs(stableReferenceCpu.signedCoCDiameterMm) < 1e-6) {
    throw new Error("Stable controlled storage reference did not produce finite nonzero CoC");
  }
  const stableReference = {
    distance: objectDistance,
    point: stableReferencePoint,
    cpu: stableReferenceCpu,
  };
  const scaleApertureForSignedCoC = (
    source: (typeof candidates)[number],
    targetCoCDiameterMm: number,
  ) => ({
    point: source.point,
    override: createPhysicalKernelOverride(
      neutralOptics,
      focalLengthMm,
      defaultAperture * Math.abs(source.cpu.signedCoCDiameterMm) / targetCoCDiameterMm,
    ),
  });
  const smallPositive = scaleApertureForSignedCoC(positive, 0.01);
  const smallNegative = scaleApertureForSignedCoC(negative, 0.01);
  const reference01 = scaleApertureForSignedCoC(stableReference, 0.1);
  addCase("storage-exact-zero", referenceOverride, controlledPointMm(referenceOverride, conjugateObjectDistanceMm));
  addCase("storage-small-positive-coc", smallPositive.override, smallPositive.point);
  addCase("storage-small-negative-coc", smallNegative.override, smallNegative.point);
  addCase("storage-0.1mm-reference", reference01.override, reference01.point);

  const referenceMax = Math.max(
    Math.abs(stableReference.cpu.signedCoCDiameterMm),
    stableReference.cpu.majorRadiusMm,
    stableReference.cpu.minorRadiusMm,
  );
  const nearLimitScale = 64000 / referenceMax;
  const nearLimit = createPhysicalKernelOverride(
    neutralOptics,
    focalLengthMm,
    defaultAperture / nearLimitScale,
  );
  addCase("storage-near-binary16-maximum", nearLimit, stableReference.point);
  // Keep storage-range controls well away from the focused image plane. Huge
  // pupil scaling amplifies float32 cancellation near the conjugate boundary.
  const positiveOverflow = scaleApertureForSignedCoC(positiveOverflowSource, 66000);
  const negativeOverflow = scaleApertureForSignedCoC(negativeOverflowSource, 66000);
  addCase("storage-overrange-positive-coc", positiveOverflow.override, positiveOverflow.point);
  addCase("storage-overrange-negative-coc", negativeOverflow.override, negativeOverflow.point);
  const radiusScale = 66000 / positiveOverflowSource.cpu.majorRadiusMm;
  const overrangeRadius = createPhysicalKernelOverride(
    neutralOptics,
    focalLengthMm,
    defaultAperture / radiusScale,
  );
  addCase("storage-overrange-ellipse-radius", overrangeRadius, positiveOverflowSource.point);

  const invalidLensBasis: GroundGlassPhysicalCocProbeKernelOverride = {
    ...neutral,
    lens: { ...neutral.lens, planeNormal: { x: 0, y: 0, z: 0 } },
  };
  addCase("invalid-geometry-lens-basis", invalidLensBasis, controlledPointMm(neutral, objectDistance));

  if (cases.length > 17) throw new Error("M4 controlled kernel test cases exceed the bounded test-seam limit");
  return cases;
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
    !nativeRequired || !physicalResearchEnabled || !rawPilotEnabled || !r187QualificationEnabled,
    "Requires native WebGPU, the M3 Raw pilot, and the explicit r187 M4 qualification harness",
  );
  test.setTimeout(600_000);
  expect(REVISION).toBe("187");

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
  const controlledKernelExpectations = createControlledKernelExpectations({
    cameraState,
    scene: architectureRiseScene,
  });
  const lensBasis = deriveOrthonormalPlaneBasis(
    optics.lensPlane.normal,
    optics.rearStandardFrame.rightWorld,
    optics.rearStandardFrame.upWorld,
  );
  expect(lensBasis).not.toBeNull();
  const realSceneProbes = createRealSceneProbes({ optics, targetWidth, targetHeight, crop });
  const focalReference = realSceneProbes.find((probe) => probe.id === "off-axis-midground-checker");
  if (!focalReference?.expectedWorldM) throw new Error("No independent midground surface reference for focal-boundary probe");
  const normalizedLensNormal = normalize(optics.lensPlane.normal);
  const canonicalWorldPointMm = {
    x: focalReference.expectedWorldM[0] * 1000,
    y: focalReference.expectedWorldM[1] * 1000,
    z: focalReference.expectedWorldM[2] * 1000,
  };
  const depthDerivedExactFocalLengthMm = dot(
    subtract(canonicalWorldPointMm, optics.lensCenterWorld),
    normalizedLensNormal,
  );
  expect(depthDerivedExactFocalLengthMm).toBeGreaterThan(0);
  const depthDerivedExactFocalProbe: GroundGlassPhysicalCocProbeUv = {
    ...focalReference,
    id: "depth-derived-canonical-u-f-no-parallel-authority",
    focalLengthOverrideMm: depthDerivedExactFocalLengthMm,
  };
  const unreferencedVisibleProbe: GroundGlassPhysicalCocProbeUv = {
    ...realSceneProbes[0]!,
    id: "unreferenced-visible-surface-pixel",
    expectedWorldM: null,
    expectedSurfaceId: null,
  };
  const probes = [
    ...realSceneProbes,
    unreferencedVisibleProbe,
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
  const probeRequest: GroundGlassPhysicalCocProbeRequest = {
    token: probeToken,
    probes,
    controlledKernelCases: controlledKernelExpectations.map(({ testCase }) => testCase),
  };
  await page.evaluate((requestedProbes) => {
    const control = window.__groundGlassWebGpuM3TestControl;
    if (!control) throw new Error("The development-only Ground Glass test seam is unavailable");
    control.physicalCocProbeReadback = null;
    control.physicalCocProbeRequest = requestedProbes;
  }, probeRequest);
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
  expect(pilot).toHaveAttribute("data-physical-coc-depth-confidence-status", "not-assessed");

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
    expect(sample.depthConfidence.scope).toBe("probe-only");
    expect(sample.depthConfidence.status).toBe("resolved");
    if (sample.depthConfidence.status !== "not-assessed") {
      expect(sample.depthConfidence.canonicalExpectedBranch).toBe(sample.depthConfidence.reconstructedBranch);
      expect(sample.depthConfidence.kernelSelectedBranch).toBe(sample.depthConfidence.canonicalExpectedBranch);
      expect(sample.depthConfidence.surfaceId).toBe(sample.expectedSurfaceId);
    }
  }

  const unreferencedSample = readback.samples.find((sample) => sample.id === "unreferenced-visible-surface-pixel");
  expect(unreferencedSample?.validityCode).toBe(1);
  expect(unreferencedSample?.storedFootprintMm).not.toBeNull();
  expect(unreferencedSample?.depthConfidence).toMatchObject({
    status: "not-assessed",
    scope: "probe-only",
    reason: "no-independent-reference",
  });

  const backgroundSamples = readback.samples.filter((sample) => sample.id.startsWith("background-"));
  expect(backgroundSamples).toHaveLength(3);
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
    const kernelTolerance = (value: number) => Math.max(0.0005, Math.abs(value) * 0.00002);
    expect(Math.abs(cpu.signedCoCDiameterMm - sample.kernelFootprintMm[0]))
      .toBeLessThanOrEqual(kernelTolerance(cpu.signedCoCDiameterMm));
    expect(Math.abs(cpu.majorRadiusMm - sample.kernelFootprintMm[1]))
      .toBeLessThanOrEqual(kernelTolerance(cpu.majorRadiusMm));
    expect(Math.abs(cpu.minorRadiusMm - sample.kernelFootprintMm[2]))
      .toBeLessThanOrEqual(kernelTolerance(cpu.minorRadiusMm));
    expect(sample.storedFootprintMm).toBeNull();
  }

  const controlledKernelReadbacks = readback.controlledKernelCases;
  expect(controlledKernelReadbacks).toHaveLength(controlledKernelExpectations.length);
  const expectationById = new Map(controlledKernelExpectations.map((entry) => [entry.testCase.id, entry]));
  const kernelById = new Map(controlledKernelReadbacks.map((entry) => [entry.id, entry]));
  const kernelTolerance = (value: number) => Math.max(0.0005, Math.abs(value) * 0.00002);
  const assertOrientationWithinPeriod = (angleRad: number, expectedRad: number, label: string) => {
    const error = groundGlassPhysicalCocOrientationErrorModuloPi(angleRad, expectedRad);
    expect(error, `${label} has a finite modulo-pi orientation error`).not.toBeNull();
    expect(error!, `${label} orientation`).toBeLessThan(0.003);
  };
  const assertKernelAgreement = (
    footprint: readonly [number, number, number, number],
    cpu: ReturnType<typeof computePhysicalBlurFootprint>,
    label: string,
  ) => {
    expect(cpu.valid, `${label} CPU physical reference is valid`).toBe(true);
    expect(footprint[1], `${label} major radius >= minor radius`).toBeGreaterThanOrEqual(footprint[2]);
    expect(footprint[2], `${label} minor radius is nonnegative`).toBeGreaterThanOrEqual(0);
    for (const [channel, value] of [
      ["signed CoC", cpu.signedCoCDiameterMm],
      ["major radius", cpu.majorRadiusMm],
      ["minor radius", cpu.minorRadiusMm],
    ] as const) {
      const index = channel === "signed CoC" ? 0 : channel === "major radius" ? 1 : 2;
      expect(
        Math.abs(footprint[index] - value),
        `${label} ${channel} CPU/TSL error: cpu=${value}, tsl=${footprint[index]}, tolerance=${kernelTolerance(value)}`,
      )
        .toBeLessThanOrEqual(kernelTolerance(value));
    }
    if (Math.abs(cpu.signedCoCDiameterMm) >= 0.001) {
      expect(Math.sign(footprint[0]), `${label} preserves signed CoC side`)
        .toBe(Math.sign(cpu.signedCoCDiameterMm));
    }
    const orientationDefined = cpu.majorRadiusMm - cpu.minorRadiusMm > 1e-7;
    expect(footprint[3] >= 0 && footprint[3] < 1, `${label} normalized orientation is in [0,1)`).toBe(true);
    if (orientationDefined) assertOrientationWithinPeriod(footprint[3] * Math.PI, cpu.orientationRad, label);
    else expect(footprint[3], `${label} undefined near-circular orientation uses deterministic zero`).toBe(0);
  };
  const assertStorageContract = (
    validityCode: number,
    readbackFootprint: readonly [number, number, number, number] | null,
    cpu: ReturnType<typeof computePhysicalBlurFootprint>,
    label: string,
  ) => {
    const representable = cpu.valid &&
      Math.abs(cpu.signedCoCDiameterMm) <= 65504 &&
      cpu.majorRadiusMm <= 65504 &&
      cpu.minorRadiusMm <= 65504 &&
      cpu.majorRadiusMm >= cpu.minorRadiusMm && cpu.minorRadiusMm >= 0;
    expect(validityCode, `${label} validity follows binary16 representability`).toBe(representable ? 1 : 2);
    expect(readbackFootprint, `${label} reads actual RGBA16F storage`).not.toBeNull();
    if (!readbackFootprint) return;
    if (!representable) {
      expect(readbackFootprint, `${label} unsupported overflow is not accepted as saturated data`).toEqual([0, 0, 0, 0]);
    }
  };

  for (const entry of controlledKernelExpectations) {
    const sample = kernelById.get(entry.testCase.id);
    if (!sample) throw new Error(`The application TSL kernel did not read back ${entry.testCase.id}`);
    expect(sample.storageFormat, `${sample.id} uses actual RGBA16F storage`).toBe("rgba16float");
    expect(sample.storedHalfFloatBits, `${sample.id} includes native half-float bits`).not.toBeNull();
    expect(sample.readbackFootprintMm, `${sample.id} includes decoded half-float readback`).not.toBeNull();
    expect(sample.sampledFootprintMm, `${sample.id} includes a GPU-sampled decoded value`).not.toBeNull();
    if (entry.testCase.id === "invalid-geometry-lens-basis") {
      expect(entry.cpu.valid, "invalid lens geometry is independently rejected by the CPU reference").toBe(false);
      expect(sample.validityCode, "invalid geometry has validity code 3").toBe(3);
      expect(sample.calculatedFootprintMm).toEqual([0, 0, 0, 0]);
      expect(sample.readbackFootprintMm).toEqual([0, 0, 0, 0]);
      expect(sample.storedHalfFloatBits).toEqual([0, 0, 0, 0]);
      continue;
    }
    assertStorageContract(sample.validityCode, sample.readbackFootprintMm, entry.cpu, sample.id);
    if (sample.validityCode === 2) {
      expect(entry.cpu.valid, `${sample.id} overflow reference has valid source geometry`).toBe(true);
      if (Math.abs(entry.cpu.signedCoCDiameterMm) > 65504) {
        expect(Math.sign(sample.calculatedFootprintMm[0]), `${sample.id} keeps the unsupported CoC sign`)
          .toBe(Math.sign(entry.cpu.signedCoCDiameterMm));
        expect(Math.abs(sample.calculatedFootprintMm[0]), `${sample.id} calculated CoC remains out of range`)
          .toBeGreaterThan(65504);
      }
      if (entry.cpu.majorRadiusMm > 65504) {
        expect(sample.calculatedFootprintMm[1], `${sample.id} calculated major radius remains out of range`)
          .toBeGreaterThan(65504);
      }
      if (entry.cpu.minorRadiusMm > 65504) {
        expect(sample.calculatedFootprintMm[2], `${sample.id} calculated minor radius remains out of range`)
          .toBeGreaterThan(65504);
      }
      continue;
    }
    assertKernelAgreement(sample.calculatedFootprintMm, entry.cpu, sample.id);
    const bits = sample.storedHalfFloatBits!;
    const readbackValues = sample.readbackFootprintMm!;
    const sampledValues = sample.sampledFootprintMm!;
    for (let channel = 0; channel < 4; channel += 1) {
      expect(readbackValues[channel], `${sample.id} channel ${channel} decodes the native half bits`)
        .toBe(THREE.DataUtils.fromHalfFloat(bits[channel]!));
      expect(bits[channel], `${sample.id} channel ${channel} follows binary16 rounding`)
        .toBe(THREE.DataUtils.toHalfFloat(sample.calculatedFootprintMm[channel]!));
      expect(Math.abs(sampledValues[channel]! - readbackValues[channel]!))
        .toBeLessThanOrEqual(Math.max(0.0001, Math.abs(readbackValues[channel]!) * 1e-6));
    }
    if (entry.cpu.valid && entry.cpu.majorRadiusMm - entry.cpu.minorRadiusMm > 1e-7) {
      expect(sample.orientationDefined, `${sample.id} TSL marks the principal orientation defined`).toBe(true);
      assertOrientationWithinPeriod(
        sample.readbackFootprintMm![3] * Math.PI,
        entry.cpu.orientationRad,
        `${sample.id} RGBA16F orientation readback`,
      );
    } else {
      expect(sample.orientationDefined, `${sample.id} does not publish an unstable circular angle`).toBe(false);
    }
  }

  const validKernelMeasurements = controlledKernelExpectations.flatMap((entry) => {
    const actual = kernelById.get(entry.testCase.id);
    if (!actual || actual.validityCode !== 1 || !entry.cpu.valid || !actual.readbackFootprintMm || !actual.sampledFootprintMm) {
      return [];
    }
    const orientationError = groundGlassPhysicalCocOrientationErrorModuloPi(
      actual.readbackFootprintMm[3] * Math.PI,
      entry.cpu.orientationRad,
    );
    return [{
      id: entry.testCase.id,
      cpuToTslMaxMm: Math.max(
        Math.abs(entry.cpu.signedCoCDiameterMm - actual.calculatedFootprintMm[0]),
        Math.abs(entry.cpu.majorRadiusMm - actual.calculatedFootprintMm[1]),
        Math.abs(entry.cpu.minorRadiusMm - actual.calculatedFootprintMm[2]),
      ),
      calculationToHalfMaxMm: Math.max(
        ...[0, 1, 2].map((channel) => Math.abs(
          actual.readbackFootprintMm![channel]! - actual.calculatedFootprintMm[channel]!,
        )),
      ),
      halfToSampleMaxMm: Math.max(
        ...[0, 1, 2].map((channel) => Math.abs(
          actual.sampledFootprintMm![channel]! - actual.readbackFootprintMm![channel]!,
        )),
      ),
      orientationModuloPiErrorRad: orientationError,
    }];
  });
  const maximumOf = (values: readonly (number | null)[]) => Math.max(...values.filter(
    (value): value is number => value !== null,
  ));
  const nativeKernelMeasurements = {
    validControlledCaseCount: validKernelMeasurements.length,
    maxCpuToTslErrorMm: maximumOf(validKernelMeasurements.map((value) => value.cpuToTslMaxMm)),
    maxCalculationToRgba16fErrorMm: maximumOf(validKernelMeasurements.map((value) => value.calculationToHalfMaxMm)),
    maxRgba16fToGpuSampleErrorMm: maximumOf(validKernelMeasurements.map((value) => value.halfToSampleMaxMm)),
    maxOrientationModuloPiErrorRad: maximumOf(validKernelMeasurements.map((value) => value.orientationModuloPiErrorRad)),
    overflowCases: controlledKernelReadbacks.filter((value) => value.validityCode === 2).map((value) => ({
      id: value.id,
      calculatedFootprintMm: value.calculatedFootprintMm,
      decodedStorage: value.readbackFootprintMm,
    })),
    limits: { kernelAbsoluteMm: 0.0005, kernelRelative: 0.00002, orientationModuloPiRad: 0.003 },
  };
  console.log("M4 native application-kernel measurements:", JSON.stringify(nativeKernelMeasurements));

  const ellipseTilt = kernelById.get("ellipse-film-tilt")!;
  const ellipseSwing = kernelById.get("ellipse-film-swing")!;
  expect(ellipseTilt.calculatedFootprintMm[1] - ellipseTilt.calculatedFootprintMm[2]).toBeGreaterThan(1e-5);
  expect(ellipseSwing.calculatedFootprintMm[1] - ellipseSwing.calculatedFootprintMm[2]).toBeGreaterThan(1e-5);
  expect(groundGlassPhysicalCocOrientationErrorModuloPi(
    ellipseTilt.calculatedFootprintMm[3] * Math.PI,
    ellipseSwing.calculatedFootprintMm[3] * Math.PI,
  )).toBeGreaterThan(0.01);
  expect(kernelById.get("ellipse-negative-principal-angle")!.orientationPrincipalAngleRad).toBeLessThan(0);
  expect(kernelById.get("ellipse-negative-principal-angle")!.calculatedFootprintMm[3]).toBeGreaterThan(0.9);
  expect(kernelById.get("ellipse-near-pi-orientation")!.calculatedFootprintMm[3]).toBeGreaterThan(0.99);
  expect(kernelById.get("ellipse-near-circular")!.orientationDefined).toBe(false);

  const positiveSmall = kernelById.get("storage-small-positive-coc")!;
  const negativeSmall = kernelById.get("storage-small-negative-coc")!;
  expect(positiveSmall.calculatedFootprintMm[0]).toBeGreaterThan(0);
  expect(negativeSmall.calculatedFootprintMm[0]).toBeLessThan(0);
  expect(Math.abs(positiveSmall.calculatedFootprintMm[0])).toBeLessThan(0.02);
  expect(Math.abs(negativeSmall.calculatedFootprintMm[0])).toBeLessThan(0.02);
  expect(Math.abs(kernelById.get("storage-0.1mm-reference")!.calculatedFootprintMm[0]))
    .toBeCloseTo(0.1, 3);
  const nearMaximum = kernelById.get("storage-near-binary16-maximum")!;
  expect(Math.max(...nearMaximum.calculatedFootprintMm.slice(0, 3).map(Math.abs))).toBeGreaterThan(63000);
  expect(nearMaximum.validityCode).toBe(1);
  expect(kernelById.get("storage-overrange-positive-coc")!.validityCode).toBe(2);
  expect(kernelById.get("storage-overrange-positive-coc")!.calculatedFootprintMm[0]).toBeGreaterThan(65504);
  expect(kernelById.get("storage-overrange-negative-coc")!.validityCode).toBe(2);
  expect(kernelById.get("storage-overrange-negative-coc")!.calculatedFootprintMm[0]).toBeLessThan(-65504);
  expect(kernelById.get("storage-overrange-ellipse-radius")!.validityCode).toBe(2);
  expect(kernelById.get("storage-overrange-ellipse-radius")!.calculatedFootprintMm[1]).toBeGreaterThan(65504);

  const expectMutationRejected = (label: string, mutate: () => void) => {
    let rejected = false;
    try { mutate(); } catch { rejected = true; }
    expect(rejected, `${label} mutation must trip the actual CPU/kernel assertion`).toBe(true);
  };
  const compoundExpectation = expectationById.get("ellipse-compound-tilt-swing")!;
  const compoundActual = kernelById.get("ellipse-compound-tilt-swing")!;
  expectMutationRejected("swapped ellipse axes", () => assertKernelAgreement([
    compoundActual.calculatedFootprintMm[0],
    compoundActual.calculatedFootprintMm[2],
    compoundActual.calculatedFootprintMm[1],
    compoundActual.calculatedFootprintMm[3],
  ], compoundExpectation.cpu, "mutated-axis-swap"));
  expectMutationRejected("orientation stored with a 2pi period", () => assertOrientationWithinPeriod(
    compoundActual.calculatedFootprintMm[3] * 2 * Math.PI,
    compoundExpectation.cpu.orientationRad,
    "mutated-2pi-orientation",
  ));
  expectMutationRejected("radians stored instead of normalized orientation", () => {
    const tiltExpectation = expectationById.get("ellipse-film-tilt")!;
    const tiltActual = kernelById.get("ellipse-film-tilt")!;
    expect(tiltExpectation.cpu.orientationRad).toBeGreaterThan(0.1);
    expect(tiltExpectation.cpu.orientationRad).toBeLessThan(1);
    assertKernelAgreement([
      tiltActual.calculatedFootprintMm[0],
      tiltActual.calculatedFootprintMm[1],
      tiltActual.calculatedFootprintMm[2],
      tiltExpectation.cpu.orientationRad,
    ], tiltExpectation.cpu, "mutated-radians-channel");
  });
  expectMutationRejected("incorrect signed CoC", () => assertKernelAgreement([
    -positiveSmall.calculatedFootprintMm[0],
    positiveSmall.calculatedFootprintMm[1],
    positiveSmall.calculatedFootprintMm[2],
    positiveSmall.calculatedFootprintMm[3],
  ], expectationById.get("storage-small-positive-coc")!.cpu, "mutated-signed-coc"));
  expectMutationRejected("omitted millimetre conversion", () => assertKernelAgreement([
    compoundActual.calculatedFootprintMm[0] * 0.001,
    compoundActual.calculatedFootprintMm[1] * 0.001,
    compoundActual.calculatedFootprintMm[2] * 0.001,
    compoundActual.calculatedFootprintMm[3],
  ], compoundExpectation.cpu, "mutated-unit-scale"));
  const wrongBasisOverride = rotateKernelFilmBasis(compoundExpectation.testCase.kernelOverride, Math.PI / 2);
  const wrongBasisCpu = physicalOracleForOverride(
    wrongBasisOverride,
    compoundExpectation.testCase.probe.controlledObjectPointMm!,
  );
  expectMutationRejected("wrong film-plane basis", () =>
    assertKernelAgreement(compoundActual.calculatedFootprintMm, wrongBasisCpu, "mutated-film-basis"));
  expectMutationRejected("binary16 saturation accepted as physical output", () =>
    assertStorageContract(1, [65504, 65504, 65504, 0], expectationById.get("storage-overrange-ellipse-radius")!.cpu, "mutated-saturated-output"));

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
  expect(summary.maximumKernelCoCErrorMm).toBeLessThanOrEqual(0.0005);
  expect(summary.maximumStorageCoCErrorMm).toBeLessThanOrEqual(0.06);

  const depthFocalRequestIdBefore = await pane.getAttribute("data-frame-request-id");
  const depthFocalToken = `m4-depth-exact-${Date.now()}`;
  await page.evaluate((requested) => {
    const control = window.__groundGlassWebGpuM3TestControl;
    if (!control) throw new Error("The development-only Ground Glass test seam is unavailable");
    control.physicalCocProbeReadback = null;
    control.physicalCocProbeRequest = { token: requested.token, probes: [requested.probe] };
  }, { token: depthFocalToken, probe: depthDerivedExactFocalProbe });
  await aperture.getByRole("radio", { name: "f/8", exact: true }).check();
  await expect.poll(() => pane.getAttribute("data-frame-request-id"), { timeout: 60_000 })
    .not.toBe(depthFocalRequestIdBefore);
  await waitForCompletedFrame(page);
  await expect.poll(async () => (await readProbeResult(page, depthFocalToken))?.token ?? null, {
    timeout: 90_000,
  }).toBe(depthFocalToken);
  const depthDerivedExactFocalReadback = await readProbeResult(page, depthFocalToken);
  const depthDerivedExactFocalSample = depthDerivedExactFocalReadback?.samples[0];
  if (!depthDerivedExactFocalReadback || !depthDerivedExactFocalSample) {
    throw new Error("Depth-derived exact-U=f probe was not returned");
  }
  expect(depthDerivedExactFocalReadback.requestId).toBe(await pane.getAttribute("data-frame-request-id"));
  expect(depthDerivedExactFocalSample.id).toBe(depthDerivedExactFocalProbe.id);
  expect(depthDerivedExactFocalSample.controlledObjectPoint).toBe(false);
  expect(depthDerivedExactFocalSample.depthConfidence).toMatchObject({
    status: "depth-limited",
    scope: "probe-only",
    evidence: "paired-analytic-surface-reference",
    canonicalExpectedBranch: "parallel-limit",
  });
  if (depthDerivedExactFocalSample.depthConfidence.status !== "depth-limited") {
    throw new Error("Scene-depth focal equality must remain depth-limited");
  }
  expect(Math.abs(depthDerivedExactFocalSample.depthConfidence.canonicalUMinusFmm)).toBeLessThan(1e-7);
  expect(depthDerivedExactFocalSample.depthConfidence.kernelSelectedBranch).not.toBe("parallel-limit");
  expect(depthDerivedExactFocalSample.focalBranchCode).not.toBe(2);
  const depthExactFrameEvents = await page.evaluate(
    (expectedRequestId) => JSON.parse(JSON.stringify(
      (window.__groundGlassWebGpuM3TestControl?.adapterEvents ?? []).filter((event) =>
        event.kind === "host-frame-result" && event.requestId === expectedRequestId,
      ),
    )) as Array<Record<string, unknown>>,
    depthDerivedExactFocalReadback.requestId,
  );
  const depthExactAcceptedFrame = depthExactFrameEvents.find((event) => event.acceptedByHost === true);
  expect(depthExactAcceptedFrame).toMatchObject({
    kind: "host-frame-result",
    requestId: depthDerivedExactFocalReadback.requestId,
    channelId: depthDerivedExactFocalReadback.channelId,
    sceneId: depthDerivedExactFocalReadback.sceneId,
    generationId: depthDerivedExactFocalReadback.rendererGenerationId,
    acceptedByHost: true,
    latestAcceptedRequestId: depthDerivedExactFocalReadback.requestId,
    activeGenerationId: depthDerivedExactFocalReadback.rendererGenerationId,
  });
  if (!depthExactAcceptedFrame) throw new Error("Depth-boundary readback lacks host-accepted frame evidence");

  let boundarySource: (typeof realSamples)[number] | undefined;
  let boundaryErrorMm = -1;
  for (const sample of realSamples) {
    if (sample.depthConfidence.status === "not-assessed") continue;
    if (sample.depthConfidence.absoluteReconstructionErrorMm > boundaryErrorMm) {
      boundarySource = sample;
      boundaryErrorMm = sample.depthConfidence.absoluteReconstructionErrorMm;
    }
  }
  if (!boundarySource) {
    throw new Error("No independently referenced Architecture Rise depth sample was available for the focal-side probe");
  }
  const boundaryEvidence = boundarySource.depthConfidence;
  if (boundaryEvidence.status === "not-assessed") {
    throw new Error("Selected focal-side reference has no assessed depth evidence");
  }
  if (!boundarySource.expectedWorldM || !boundarySource.expectedSurfaceId) {
    throw new Error("Selected focal-side probe lost its independent scene-surface reference");
  }
  const focalBoundaryMm = (
    boundaryEvidence.canonicalObjectDistanceMm +
    boundaryEvidence.reconstructedObjectDistanceMm
  ) / 2;
  expect(boundaryEvidence.absoluteReconstructionErrorMm)
    .toBeGreaterThan(0);
  const canonicalBranch = boundaryEvidence.canonicalObjectDistanceMm > boundaryEvidence.reconstructedObjectDistanceMm
    ? "finite-real"
    : "finite-virtual";
  const reconstructedBranch = canonicalBranch === "finite-real" ? "finite-virtual" : "finite-real";
  const expectedKernelBranchCode = reconstructedBranch === "finite-virtual" ? 1 : 3;
  await aperture.getByRole("radio", { name: "f/16", exact: true }).check();
  await waitForCompletedFrame(page);
  const boundaryRequestId = await pane.getAttribute("data-frame-request-id");
  const boundaryToken = `m4-depth-boundary-${Date.now()}`;
  const boundaryProbe: GroundGlassPhysicalCocProbeUv = {
    id: "depth-derived-u-f-inversion",
    u: boundarySource.u,
    v: boundarySource.v,
    expectedWorldM: boundarySource.expectedWorldM,
    expectedSurfaceId: boundarySource.expectedSurfaceId,
    focalLengthOverrideMm: focalBoundaryMm,
  };
  const boundaryProbeRequest: GroundGlassPhysicalCocProbeRequest = {
    token: boundaryToken,
    probes: [boundaryProbe],
  };
  await page.evaluate((requested) => {
    const control = window.__groundGlassWebGpuM3TestControl;
    if (!control) throw new Error("The development-only Ground Glass test seam is unavailable");
    control.physicalCocProbeReadback = null;
    control.physicalCocProbeRequest = requested;
  }, boundaryProbeRequest);
  await aperture.getByRole("radio", { name: "f/8", exact: true }).check();
  await expect.poll(() => pane.getAttribute("data-frame-request-id"), { timeout: 60_000 }).not.toBe(boundaryRequestId);
  await waitForCompletedFrame(page);
  await expect.poll(async () => (await readProbeResult(page, boundaryToken))?.token ?? null, {
    timeout: 90_000,
  }).toBe(boundaryToken);
  const boundaryReadback = await readProbeResult(page, boundaryToken);
  const boundarySample = boundaryReadback?.samples[0];
  if (!boundaryReadback || !boundarySample) throw new Error("The focal-side depth probe did not return its GPU readback");
  expect(boundaryReadback.requestId).toBe(await pane.getAttribute("data-frame-request-id"));
  expect(boundarySample.depthConfidence).toMatchObject({
    status: "depth-limited",
    scope: "probe-only",
    evidence: "paired-analytic-surface-reference",
    canonicalExpectedBranch: canonicalBranch,
    reconstructedBranch,
    kernelSelectedBranch: reconstructedBranch,
  });
  expect(boundarySample.validityCode, "physical validity remains independent of depth-limited confidence").toBe(1);
  expect(boundarySample.focalBranchCode).toBe(expectedKernelBranchCode);
  expect(boundarySample.storedFootprintMm).toBeNull();
  const boundaryCpu = physicalOracleForOverride(
    createPhysicalKernelOverride(optics, focalBoundaryMm, 8),
    [
      boundarySample.kernelObjectPositionM[0] * 1000,
      boundarySample.kernelObjectPositionM[1] * 1000,
      boundarySample.kernelObjectPositionM[2] * 1000,
    ],
  );
  expect(boundaryCpu.valid).toBe(true);
  expect(Math.sign(boundarySample.kernelFootprintMm[0])).toBe(Math.sign(boundaryCpu.signedCoCDiameterMm));
  expect(Math.abs(boundarySample.kernelFootprintMm[0] - boundaryCpu.signedCoCDiameterMm))
    .toBeLessThanOrEqual(Math.max(0.0005, Math.abs(boundaryCpu.signedCoCDiameterMm) * 0.00002));
  await expect(pilot).toHaveAttribute("data-physical-coc-depth-confidence-status", "not-assessed");

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

  const frameEvents = await page.evaluate(
    (expectedRequestId) => JSON.parse(JSON.stringify(
      (window.__groundGlassWebGpuM3TestControl?.adapterEvents ?? []).filter((event) =>
        event.kind === "host-frame-result" && event.requestId === expectedRequestId,
      ),
    )) as Array<Record<string, unknown>>,
    readback.requestId,
  );
  const acceptedFrameEvent = frameEvents.find((event) => event.acceptedByHost === true);
  expect(acceptedFrameEvent).toMatchObject({
    kind: "host-frame-result",
    requestId: readback.requestId,
    channelId: readback.channelId,
    sceneId: readback.sceneId,
    generationId: readback.rendererGenerationId,
    frameStatus: "completed",
    acceptedByHost: true,
    latestAcceptedRequestId: readback.requestId,
    activeGenerationId: readback.rendererGenerationId,
    activeRendererFamily: "webgpu-renderer",
  });
  expect(typeof acceptedFrameEvent?.hostId).toBe("string");
  expect((acceptedFrameEvent?.hostId as string | undefined)?.trim().length).toBeGreaterThan(0);

  const capturedAdapterEvents = await page.evaluate(() =>
    JSON.parse(JSON.stringify(window.__groundGlassWebGpuM3TestControl?.adapterEvents ?? [])) as
      Array<Record<string, unknown>>,
  );
  const m4CompatibilityEvidence = GROUND_GLASS_RAW_WEBGPU_R187_COMPATIBILITY.features.find(
    (feature) => feature.feature === "physical-coc",
  );
  expect(m4CompatibilityEvidence).toMatchObject({
    status: "research-only",
    evidenceRevision: ARCHITECTURE_RISE_PHYSICAL_COC_R187_EVIDENCE_REVISION,
    testedContext: { rendererFamily: "webgpu-renderer", executionApi: "webgpu", rendererRevision: "r187" },
  });

  await attachGroundGlassM7dEvidence(testInfo, "ground-glass-m4-physical-coc-native-evidence.json", {
      browserVersion: page.context().browser()?.version() ?? "unknown",
      operatingSystem: `${process.platform} ${process.arch}`,
      threeRevision: REVISION,
      sceneSourceRevision: ARCHITECTURE_RISE_RAW_RTT_SOURCE_REVISION,
      sourceSha: process.env.GROUND_GLASS_EVIDENCE_SOURCE_SHA ?? "missing",
      testProject: testInfo.project.name,
      testInvocation: process.env.GROUND_GLASS_EVIDENCE_TEST_INVOCATION ?? "missing",
      environment: "headed native-required Chrome",
      sceneId: "architecture-rise",
      m4CompatibilityEvidence,
      rendererFamily: readback.rendererFamily,
      actualExecutionApi: readback.actualExecutionApi,
      internalFallback: readback.internalFallback,
      trustedDevelopmentAuthorization: {
        nativeRequired: process.env.GROUND_GLASS_NATIVE_WEBGPU_REQUIRED === "1",
        rawPilotRequest: process.env.VITE_GROUND_GLASS_WEBGPU_RAW_PILOT === "true",
        physicalCocResearchBuildFlag: process.env.GROUND_GLASS_WEBGPU_PHYSICAL_COC_RESEARCH === "1",
        r187QualificationFlag: process.env.GROUND_GLASS_WEBGPU_PHYSICAL_COC_R187_QUALIFICATION === "1",
        testSeamFlag: process.env.VITE_GROUND_GLASS_WEBGPU_TEST_SEAM === "true",
      },
      initialGeneration,
      retiredGeneration,
      remountedGeneration,
      nativeKernelMeasurements,
      controlledKernelReferences: controlledKernelExpectations.map(({ testCase, cpu }) => ({
        id: testCase.id,
        testCase,
        cpuReference: cpu,
      })),
      focalBoundaryReferences: [
        {
          id: depthDerivedExactFocalProbe.id,
          inputSource: "scene-depth-with-independent-analytic-surface",
          expectedWorldM: depthDerivedExactFocalProbe.expectedWorldM,
          focalLengthOverrideMm: depthDerivedExactFocalProbe.focalLengthOverrideMm,
          explicitParallelLimitIdentity: false,
        },
        {
          id: "controlled-u-f-exact-authorized",
          inputSource: "controlled-object-point",
          focalLengthMm: cameraState.focalLengthMm,
          explicitParallelLimitIdentity: true,
        },
      ],
      probeReadback: readback,
      depthDerivedExactFocalReadback,
      depthDerivedExactFocalHostFrameResult: depthExactAcceptedFrame,
      acceptedHostFrameResult: acceptedFrameEvent,
      hostFrameEventsForReadback: frameEvents,
      lifecycleEvents: capturedAdapterEvents.filter((event) =>
        event.generationId === readback.rendererGenerationId ||
        event.generationId === retiredGeneration ||
        event.generationId === remountedGeneration,
      ),
      probeSummary: summary,
      lifecycle: { beforeResize, afterResize, cleanupOutcome: await retiredPilot.getAttribute("data-cleanup-outcome") },
      pageErrors,
  });
  expect(pageErrors).toEqual([]);
});

test("M4 probe readback is stale after resize and cannot publish the superseded request", async ({ page }, testInfo) => {
  test.skip(
    !nativeRequired || !physicalResearchEnabled || !rawPilotEnabled || !r187QualificationEnabled,
    "Requires native WebGPU, the M3 Raw pilot, and the explicit r187 M4 qualification harness",
  );
  test.setTimeout(300_000);
  await page.addInitScript(() => {
    window.__groundGlassWebGpuM3TestControl = {};
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/simulator/free/architecture-rise?rttDiagnostics=1");
  const pane = page.locator('[data-testid="ground-glass-rtt"][data-rtt-channel="default"]');
  const pilot = page.getByTestId("ground-glass-webgpu-pilot");
  await expect(pane).toHaveAttribute("data-render-host-lifecycle", "ready", { timeout: 90_000 });
  await page.getByLabel("Raw RTT — bypass DOF").check();
  await expect(pane).toHaveAttribute("data-mounted-renderer-family", "webgpu-renderer", { timeout: 120_000 });
  await expectPhysicalFrame(page);
  const rendererGenerationId = await pane.getAttribute("data-renderer-generation");
  expect(rendererGenerationId).toBeTruthy();

  const token = `m4-stale-resize-${Date.now()}`;
  await page.evaluate((request) => {
    const control = window.__groundGlassWebGpuM3TestControl;
    if (!control) throw new Error("The development-only Ground Glass test seam is unavailable");
    control.physicalCocProbeReadback = null;
    control.holdPhysicalCocProbeReadback = true;
    control.physicalCocProbeRequest = {
      token: request,
      probes: [{ id: "stale-resize-probe", u: 0.5, v: 0.5, expectedWorldM: null, expectedSurfaceId: null }],
    };
  }, token);
  const focus = page.getByRole("slider", { name: "Focus distance", exact: true });
  const focusStep = Number(await focus.getAttribute("step"));
  await setStepRangeInput(page, "Focus distance", Number(await focus.inputValue()) + focusStep);
  const probeRequestId = await waitForStableRequestId(page, pane);
  await expect.poll(async () => page.evaluate(() =>
    Boolean(window.__groundGlassWebGpuM3TestControl?.physicalCocProbeReadbackBarrierReached),
  ), { timeout: 120_000 }).toBe(true);
  await page.setViewportSize({ width: 1160, height: 900 });
  const resizedRequestId = await waitForStableRequestId(page, pane);
  expect(resizedRequestId).not.toBe(probeRequestId);
  await page.evaluate(() => window.__groundGlassWebGpuM3TestControl?.releasePhysicalCocProbeReadback?.());
  await expectPhysicalFrame(page);
  await expect(pilot).toHaveAttribute("data-physical-coc-request-id", resizedRequestId!);
  await expect(pilot).toHaveAttribute("data-physical-coc-probe-readback-status", "not-requested");
  expect(await page.evaluate(() => window.__groundGlassWebGpuM3TestControl?.physicalCocProbeReadback ?? null)).toBeNull();
  const lifecycleEvents = await page.evaluate((generationId) => {
    const events = JSON.parse(JSON.stringify(window.__groundGlassWebGpuM3TestControl?.adapterEvents ?? [])) as
      Array<Record<string, unknown>>;
    return events.filter((event) => event.generationId === generationId);
  }, rendererGenerationId);
  const hostFrameResults = lifecycleEvents.filter((event) =>
    event.kind === "host-frame-result" &&
    (event.requestId === probeRequestId || event.requestId === resizedRequestId),
  );
  expect(lifecycleEvents.length).toBeGreaterThan(0);
  expect(hostFrameResults.some((event) =>
    event.requestId === resizedRequestId && event.acceptedByHost === true &&
    event.generationId === rendererGenerationId,
  )).toBe(true);
  const resizeEventSequences = lifecycleEvents.map((event) => Number(event.sequence));
  expect(resizeEventSequences.every(Number.isFinite)).toBe(true);
  expect(resizeEventSequences).toEqual([...resizeEventSequences].sort((left, right) => left - right));
  await attachGroundGlassM7dEvidence(testInfo, "ground-glass-m4-stale-resize-evidence.json", {
      test: "M4 probe readback is stale after resize and cannot publish the superseded request",
      browserVersion: page.context().browser()?.version() ?? "unknown",
      operatingSystem: `${process.platform} ${process.arch}`,
      threeRevision: REVISION,
      sourceSha: process.env.GROUND_GLASS_EVIDENCE_SOURCE_SHA ?? "missing",
      testProject: testInfo.project.name,
      testInvocation: process.env.GROUND_GLASS_EVIDENCE_TEST_INVOCATION ?? "missing",
      rendererFamily: await pane.getAttribute("data-mounted-renderer-family"),
      actualExecutionApi: await pane.getAttribute("data-actual-execution-api"),
      channelId: await pane.getAttribute("data-frame-channel-id"),
      sceneId: await pane.getAttribute("data-frame-scene-id"),
      rendererGenerationId,
      oldProbeRequestId: probeRequestId,
      currentRequestId: resizedRequestId,
      physicalRequestId: await pilot.getAttribute("data-physical-coc-request-id"),
      readbackAfterRelease: await page.evaluate(() => window.__groundGlassWebGpuM3TestControl?.physicalCocProbeReadback ?? null),
      readbackStatus: await pilot.getAttribute("data-physical-coc-probe-readback-status"),
      stalePublicationRejected: true,
      lifecycleEvents,
      hostFrameResults,
  });
});

test("M4 unmount during a held probe prevents publication and confirms cleanup after the readback settles", async ({ page }, testInfo) => {
  test.skip(
    !nativeRequired || !physicalResearchEnabled || !rawPilotEnabled || !r187QualificationEnabled,
    "Requires native WebGPU, the M3 Raw pilot, and the explicit r187 M4 qualification harness",
  );
  test.setTimeout(300_000);
  await page.addInitScript(() => {
    window.__groundGlassWebGpuM3TestControl = {};
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/simulator/free/architecture-rise?rttDiagnostics=1");
  const pane = page.locator('[data-testid="ground-glass-rtt"][data-rtt-channel="default"]');
  const pilot = page.getByTestId("ground-glass-webgpu-pilot");
  await expect(pane).toHaveAttribute("data-render-host-lifecycle", "ready", { timeout: 90_000 });
  await page.getByLabel("Raw RTT — bypass DOF").check();
  await expect(pane).toHaveAttribute("data-mounted-renderer-family", "webgpu-renderer", { timeout: 120_000 });
  await expectPhysicalFrame(page);
  const rendererGenerationId = await pane.getAttribute("data-renderer-generation");
  expect(rendererGenerationId).toBeTruthy();

  const token = `m4-stale-unmount-${Date.now()}`;
  await page.evaluate((request) => {
    const control = window.__groundGlassWebGpuM3TestControl;
    if (!control) throw new Error("The development-only Ground Glass test seam is unavailable");
    control.physicalCocProbeReadback = null;
    control.holdPhysicalCocProbeReadback = true;
    control.physicalCocProbeRequest = {
      token: request,
      probes: [{ id: "stale-unmount-probe", u: 0.5, v: 0.5, expectedWorldM: null, expectedSurfaceId: null }],
    };
  }, token);
  const focus = page.getByRole("slider", { name: "Focus distance", exact: true });
  const focusStep = Number(await focus.getAttribute("step"));
  await setStepRangeInput(page, "Focus distance", Number(await focus.inputValue()) + focusStep);
  const probeRequestId = await waitForStableRequestId(page, pane);
  await expect.poll(async () => page.evaluate(() =>
    Boolean(window.__groundGlassWebGpuM3TestControl?.physicalCocProbeReadbackBarrierReached),
  ), { timeout: 120_000 }).toBe(true);
  const retiredPilot = await pilot.elementHandle();
  if (!retiredPilot) throw new Error("Could not retain the native M4 adapter for held-probe cleanup evidence");
  await page.getByRole("link", { name: "All Scenes", exact: true }).click();
  await expect(page).toHaveURL(/\/scenes$/);
  await expect(page.getByTestId("ground-glass-webgpu-pilot")).toHaveCount(0);
  await page.evaluate(() => window.__groundGlassWebGpuM3TestControl?.releasePhysicalCocProbeReadback?.());
  await expect.poll(() => retiredPilot.getAttribute("data-cleanup-outcome"), { timeout: 90_000 }).toBe("confirmed");
  expect(await page.evaluate(() => window.__groundGlassWebGpuM3TestControl?.physicalCocProbeReadback ?? null)).toBeNull();
  expect(await retiredPilot.getAttribute("data-last-displayed-request-id")).not.toBeNull();
  const lifecycleEvents = await page.evaluate((generationId) => {
    const events = JSON.parse(JSON.stringify(window.__groundGlassWebGpuM3TestControl?.adapterEvents ?? [])) as
      Array<Record<string, unknown>>;
    return events.filter((event) => event.generationId === generationId);
  }, rendererGenerationId);
  const hostFrameResults = lifecycleEvents.filter((event) => event.kind === "host-frame-result");
  expect(lifecycleEvents.length).toBeGreaterThan(0);
  const cleanupEvent = lifecycleEvents.find((event) => event.kind === "cleanup");
  expect(cleanupEvent).toMatchObject({ generationId: rendererGenerationId, outcome: "confirmed" });
  const cleanupAcknowledgement = lifecycleEvents.find((event) => event.kind === "cleanup-acknowledged");
  expect(cleanupAcknowledgement).toMatchObject({ generationId: rendererGenerationId, outcome: "confirmed" });
  const unmountEventSequences = lifecycleEvents.map((event) => Number(event.sequence));
  expect(unmountEventSequences.every(Number.isFinite)).toBe(true);
  expect(unmountEventSequences).toEqual([...unmountEventSequences].sort((left, right) => left - right));
  await attachGroundGlassM7dEvidence(testInfo, "ground-glass-m4-stale-unmount-evidence.json", {
      test: "M4 unmount during a held probe prevents publication and confirms cleanup after the readback settles",
      browserVersion: page.context().browser()?.version() ?? "unknown",
      operatingSystem: `${process.platform} ${process.arch}`,
      threeRevision: REVISION,
      sourceSha: process.env.GROUND_GLASS_EVIDENCE_SOURCE_SHA ?? "missing",
      testProject: testInfo.project.name,
      testInvocation: process.env.GROUND_GLASS_EVIDENCE_TEST_INVOCATION ?? "missing",
      retiredRendererFamily: await retiredPilot.getAttribute("data-mounted-renderer-family"),
      retiredExecutionApi: await retiredPilot.getAttribute("data-actual-execution-api"),
      channelId: "default",
      sceneId: "architecture-rise",
      rendererGenerationId,
      retiredGeneration: await retiredPilot.getAttribute("data-renderer-generation"),
      oldProbeRequestId: probeRequestId,
      cleanupOutcome: await retiredPilot.getAttribute("data-cleanup-outcome"),
      lastDisplayedRequestId: await retiredPilot.getAttribute("data-last-displayed-request-id"),
      readbackAfterRelease: await page.evaluate(() => window.__groundGlassWebGpuM3TestControl?.physicalCocProbeReadback ?? null),
      stalePublicationRejected: true,
      lifecycleEvents,
      hostFrameResults,
      cleanupEvent,
      cleanupAcknowledgement,
  });
});
