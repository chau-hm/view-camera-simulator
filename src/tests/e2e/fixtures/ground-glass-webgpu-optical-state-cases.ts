import * as THREE from "three";
import type { CameraState } from "../../../types/camera";
import type { SceneDefinition } from "../../../types/scene";
import type { DerivedOpticsState, Vec3 } from "../../../types/optics";
import { deriveOpticsState } from "../../../core/optics/deriveOpticsState";
import { deriveOrthonormalPlaneBasis, computePhysicalBlurFootprint } from "../../../core/optics/computePhysicalBlurFootprint";
import { architectureRiseScene } from "../../../scenes/definitions/architecture-rise";
import { interiorCornerScene } from "../../../scenes/definitions/interior-corner";
import { macroDepthOfFieldScene } from "../../../scenes/definitions/macro-depth-of-field";
import { MACRO_DEPTH_FOCUS_ZONE_SPECS } from "../../../scenes/macroDepthOfFieldGeometry";
import { DEFAULT_CAMERA_STATE, CAMERA_CONSTANTS } from "../../../utils/constants";
import { ACCEPTABLE_COC_DIAMETER_MM } from "../../../core/optics/physicalSharpness";
import { createGroundGlassDofRenderState, type GroundGlassDofRenderState } from "../../../render/groundGlassDofRenderState";
import { configureGroundGlassCamera } from "../../../render/configureGroundGlassCamera";
import { getGroundGlassClipRangeWorld } from "../../../render/groundGlassRttScenes";

export type PhaseJOpticalCaseId =
  | "macro-focus-near-f5_6"
  | "macro-focus-middle-f5_6"
  | "macro-focus-far-f5_6"
  | "macro-focus-middle-f16"
  | "interior-initial"
  | "interior-front-swing"
  | "interior-front-swing-focus"
  | "interior-rise-swing"
  | "architecture-initial"
  | "architecture-rise"
  | "architecture-rise-focus";

export type PhaseJOpticalCase = Readonly<{
  id: PhaseJOpticalCaseId;
  scene: SceneDefinition;
  cameraOverrides: Partial<Pick<CameraState,
    | "focusDistanceMm"
    | "aperture"
    | "frontRiseMm"
    | "frontShiftMm"
    | "frontTiltDeg"
    | "frontSwingDeg"
    | "rearRiseMm"
    | "rearShiftMm"
    | "rearTiltDeg"
    | "rearSwingDeg"
    | "cameraBodyPitchDeg"
  >>;
  pointSamples: readonly Readonly<{ id: string; pointMm: Vec3 }>[];
}>;

const macroPoints = MACRO_DEPTH_FOCUS_ZONE_SPECS.map((zone) => ({
  id: zone.id,
  pointMm: zone.centerMm,
}));

const sceneFocusPoints = (scene: SceneDefinition) => scene.focusTargets.map((target) => ({
  id: target.id,
  pointMm: target.worldPosition,
}));

export const PHASE_J_OPTICAL_CASES: readonly PhaseJOpticalCase[] = [
  {
    id: "macro-focus-near-f5_6",
    scene: macroDepthOfFieldScene,
    cameraOverrides: { focusDistanceMm: 390, aperture: 5.6 },
    pointSamples: macroPoints,
  },
  {
    id: "macro-focus-middle-f5_6",
    scene: macroDepthOfFieldScene,
    cameraOverrides: { focusDistanceMm: 400, aperture: 5.6 },
    pointSamples: macroPoints,
  },
  {
    id: "macro-focus-far-f5_6",
    scene: macroDepthOfFieldScene,
    cameraOverrides: { focusDistanceMm: 410, aperture: 5.6 },
    pointSamples: macroPoints,
  },
  {
    id: "macro-focus-middle-f16",
    scene: macroDepthOfFieldScene,
    cameraOverrides: { focusDistanceMm: 400, aperture: 16 },
    pointSamples: macroPoints,
  },
  {
    id: "interior-initial",
    scene: interiorCornerScene,
    cameraOverrides: {},
    pointSamples: sceneFocusPoints(interiorCornerScene),
  },
  {
    id: "interior-front-swing",
    scene: interiorCornerScene,
    cameraOverrides: { frontSwingDeg: 5 },
    pointSamples: sceneFocusPoints(interiorCornerScene),
  },
  {
    id: "interior-front-swing-focus",
    scene: interiorCornerScene,
    cameraOverrides: { frontSwingDeg: 5, focusDistanceMm: 8500 },
    pointSamples: sceneFocusPoints(interiorCornerScene),
  },
  {
    id: "interior-rise-swing",
    scene: interiorCornerScene,
    cameraOverrides: { frontRiseMm: 12, frontSwingDeg: 5 },
    pointSamples: sceneFocusPoints(interiorCornerScene),
  },
  {
    id: "architecture-initial",
    scene: architectureRiseScene,
    cameraOverrides: {},
    pointSamples: sceneFocusPoints(architectureRiseScene),
  },
  {
    id: "architecture-rise",
    scene: architectureRiseScene,
    cameraOverrides: { frontRiseMm: 20 },
    pointSamples: sceneFocusPoints(architectureRiseScene),
  },
  {
    id: "architecture-rise-focus",
    scene: architectureRiseScene,
    cameraOverrides: { frontRiseMm: 20, focusDistanceMm: 9500 },
    pointSamples: sceneFocusPoints(architectureRiseScene),
  },
];

export const getPhaseJOpticalCase = (id: PhaseJOpticalCaseId) => {
  const resolved = PHASE_J_OPTICAL_CASES.find((candidate) => candidate.id === id);
  if (!resolved) throw new Error(`Unknown Phase J optical case: ${id}`);
  return resolved;
};

export type PhaseJOpticalState = Readonly<{
  caseId: PhaseJOpticalCaseId;
  sceneId: string;
  cameraState: CameraState;
  opticsState: DerivedOpticsState;
  renderState: GroundGlassDofRenderState;
  captureCameraPose: Readonly<{
    positionWorldM: readonly [number, number, number];
    upWorld: readonly [number, number, number];
    forwardWorld: readonly [number, number, number];
    nearM: number;
    farM: number;
  }>;
  captureCameraCoordinateSystem: number;
  canonicalCameraFingerprint: Readonly<{
    projectionMatrixElements: readonly number[];
    worldMatrixElements: readonly number[];
  }>;
}>;

/**
 * Test-only bridge from canonical scene/movement state to the Phase I native
 * renderer. The camera is the photographic capture camera configured from
 * canonical film geometry; SceneDefinition.cameraPlacement is intentionally
 * not read here because it belongs to the separate Observer view.
 */
export function createPhaseJOpticalState(
  caseId: PhaseJOpticalCaseId,
  captureCamera: THREE.PerspectiveCamera,
  widthPx: number,
  heightPx: number,
  maximumBlurRadiusPx: number,
  captureCoordinateSystem: THREE.Camera["coordinateSystem"] = THREE.WebGPUCoordinateSystem,
): PhaseJOpticalState {
  const opticalCase = getPhaseJOpticalCase(caseId);
  const cameraState: CameraState = {
    ...DEFAULT_CAMERA_STATE,
    ...opticalCase.scene.cameraPreset,
    ...opticalCase.cameraOverrides,
    activeSceneId: opticalCase.scene.id,
    activeTaskId: null,
    mode: "free",
    focusMode: "finite",
  };
  const opticsState = deriveOpticsState(cameraState, opticalCase.scene);
  if (opticsState.diagnostics.fallbackApplied) {
    throw new Error(`Canonical optics fallback for ${caseId}: ${opticsState.diagnostics.fallbackReason ?? "unknown reason"}`);
  }

  // A capture camera can be reused by the test fixture after a cropped synthetic
  // study operation. The canonical full-film projection must start with no
  // residual view offset.
  captureCamera.clearViewOffset();
  captureCamera.coordinateSystem = captureCoordinateSystem;
  let clip = getGroundGlassClipRangeWorld(opticalCase.scene, opticsState.lensCenterWorld);
  captureCamera.near = clip.near;
  captureCamera.far = clip.far;
  let cameraConfiguration = configureGroundGlassCamera(
    captureCamera,
    opticsState,
    clip.near,
    clip.far,
  );
  if (!cameraConfiguration.ok) {
    throw new Error(`Canonical camera configuration failed for ${caseId}: ${cameraConfiguration.reason}`);
  }
  const [forwardX, forwardY, forwardZ] = cameraConfiguration.pose.forwardWorld;
  clip = getGroundGlassClipRangeWorld(opticalCase.scene, opticsState.lensCenterWorld, {
    x: forwardX,
    y: forwardY,
    z: forwardZ,
  });
  captureCamera.near = clip.near;
  captureCamera.far = clip.far;
  cameraConfiguration = configureGroundGlassCamera(
    captureCamera,
    opticsState,
    clip.near,
    clip.far,
  );
  if (!cameraConfiguration.ok) {
    throw new Error(`Final canonical camera configuration failed for ${caseId}: ${cameraConfiguration.reason}`);
  }

  const renderState = createGroundGlassDofRenderState(
    opticsState,
    captureCamera,
    cameraState.focalLengthMm,
    CAMERA_CONSTANTS.filmWidthMm,
    CAMERA_CONSTANTS.filmHeightMm,
    ACCEPTABLE_COC_DIAMETER_MM,
    cameraState.aperture,
    widthPx,
    heightPx,
    maximumBlurRadiusPx,
    CAMERA_CONSTANTS.filmWidthMm,
    CAMERA_CONSTANTS.filmHeightMm,
    widthPx,
  );
  return {
    caseId,
    sceneId: opticalCase.scene.id,
    cameraState,
    opticsState,
    renderState,
    captureCameraPose: {
      positionWorldM: captureCamera.position.toArray() as [number, number, number],
      upWorld: captureCamera.up.toArray() as [number, number, number],
      forwardWorld: cameraConfiguration.pose.forwardWorld,
      nearM: captureCamera.near,
      farM: captureCamera.far,
    },
    captureCameraCoordinateSystem: captureCamera.coordinateSystem,
    canonicalCameraFingerprint: {
      projectionMatrixElements: Array.from(captureCamera.projectionMatrix.elements),
      worldMatrixElements: Array.from(captureCamera.matrixWorld.elements),
    },
  };
}

/** Independent CPU footprint for a known production-scene point, all optical lengths in mm. */
export function computePhaseJKnownPointFootprint(
  state: PhaseJOpticalState,
  pointMm: Vec3,
) {
  const { opticsState, cameraState } = state;
  const lensBasis = deriveOrthonormalPlaneBasis(
    opticsState.lensPlane.normal,
    opticsState.rearStandardFrame.rightWorld,
    opticsState.rearStandardFrame.upWorld,
  );
  const filmBasis = deriveOrthonormalPlaneBasis(
    opticsState.filmPlane.normal,
    opticsState.rearStandardFrame.rightWorld,
    opticsState.rearStandardFrame.upWorld,
  );
  if (!lensBasis || !filmBasis) throw new Error(`Degenerate canonical plane basis for ${state.caseId}`);
  return computePhysicalBlurFootprint({
    objectPoint: pointMm,
    lensCenter: opticsState.lensCenterWorld,
    lensPlaneNormal: lensBasis.normal,
    lensPlaneBasisX: lensBasis.x,
    lensPlaneBasisY: lensBasis.y,
    filmPlane: opticsState.filmPlane,
    filmPlaneBasisX: filmBasis.x,
    filmPlaneBasisY: filmBasis.y,
    focalLengthMm: cameraState.focalLengthMm,
    apertureFNumber: cameraState.aperture,
  });
}

export const projectPhaseJKnownPointToSourcePixel = (
  state: PhaseJOpticalState,
  pointMm: Vec3,
  widthPx: number,
  heightPx: number,
) => {
  const projected = new THREE.Vector3(pointMm.x * 0.001, pointMm.y * 0.001, pointMm.z * 0.001);
  const projection = new THREE.Matrix4().fromArray([...state.canonicalCameraFingerprint.projectionMatrixElements]);
  const world = new THREE.Matrix4().fromArray([...state.canonicalCameraFingerprint.worldMatrixElements]);
  const inverseWorld = world.clone().invert();
  // The snapshot is the exact configured capture camera; project with its matrices.
  projected.applyMatrix4(inverseWorld).applyMatrix4(projection);
  const x = Math.floor((projected.x + 1) * 0.5 * widthPx);
  const y = Math.floor((1 - projected.y) * 0.5 * heightPx);
  return {
    x,
    y,
    ndc: [projected.x, projected.y, projected.z] as const,
    inBounds: x >= 0 && x < widthPx && y >= 0 && y < heightPx,
  };
};
