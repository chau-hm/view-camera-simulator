import type { ApertureValue, CameraState } from "../types/camera";
import type { DerivedOpticsState } from "../types/optics";
import {
  CAMERA_MOVEMENT_CALIBRATION_BASELINE,
  resolveEffectiveCameraMovementCalibration,
  type EffectiveCameraMovementCalibration,
} from "./cameraMovementEffectiveCalibration";
import {
  CAMERA_MOVEMENT_PROVISIONAL_TEACHING_MOVEMENTS,
  createCameraMovementTeachingCases,
  type CameraMovementTeachingCalibrationCandidate,
} from "./cameraMovementTeachingCases";
import {
  matchCameraMovementTeachingCase,
  type CameraMovementPublicCaseId,
} from "./cameraMovementPublicTeaching";
import {
  DEFAULT_CAMERA_MOVEMENT_TARGET_REGION,
  type CameraMovementSceneCalibration,
  type CameraMovementTargetRegion,
} from "./cameraMovementSceneCalibration";
import { resolveCameraRigViewpointAnchor } from "./cameraRigViewpointGeometry";
import { understandingCameraMovementsScene } from "./definitions/understanding-camera-movements";
import { deriveOpticsState } from "../core/optics/deriveOpticsState";
import { isApertureValue } from "../utils/constants";

/**
 * The two renderable sides of a Ground Glass comparison.
 *
 * Both sides carry the same target-region label. The Original side is a
 * neutral, canonical camera; the Current side is the caller's live camera.
 * Keeping the label on each layer prevents a renderer from accidentally
 * selecting C3/D3's region only for one of the two images.
 */
export type CameraMovementGroundGlassComparisonLayer = Readonly<{
  camera: Readonly<CameraState>;
  opticsState: Readonly<DerivedOpticsState>;
  /** Alias useful to consumers that call the derived result simply `optics`. */
  optics: Readonly<DerivedOpticsState>;
  targetRegion: CameraMovementTargetRegion;
  calibrationKey: string;
}>;

export type CameraMovementGroundGlassComparisonInput = Readonly<{
  /** Current camera state. This is never mutated by the resolver. */
  camera: CameraState;
  /** Already-derived Current optics, when the caller has it available. */
  opticsState?: DerivedOpticsState;
  /** Explicit alias for opticsState for Ground Glass callers. */
  currentOptics?: DerivedOpticsState;
  /** Target region shared by Original and Current. */
  targetRegion?: CameraMovementTargetRegion;
  /** Explicit alias used by callers that name the live side. */
  currentTargetRegion?: CameraMovementTargetRegion;
  /** Accepted effective calibration for the current route. */
  effectiveCalibration?: EffectiveCameraMovementCalibration;
  /** Explicit alias for effectiveCalibration. */
  calibration?: EffectiveCameraMovementCalibration | CameraMovementSceneCalibration;
}>;

export type CameraMovementGroundGlassComparison = Readonly<{
  sceneId: typeof understandingCameraMovementsScene.id;
  targetRegion: CameraMovementTargetRegion;
  comparisonTargetRegion: CameraMovementTargetRegion;
  activeTeachingCaseId: CameraMovementPublicCaseId | null;
  /** Deliberately duplicated labels make the shared-region invariant inspectable. */
  originalTargetRegion: CameraMovementTargetRegion;
  currentTargetRegion: CameraMovementTargetRegion;
  shared: Readonly<{
    focalLengthMm: number;
    focusDistanceMm: number;
    aperture: ApertureValue;
    calibrationKey: string;
    effectiveKey: string;
  }>;
  calibration: Readonly<{
    effectiveKey: string;
    subjectGeometryKey: string;
    opticsKey: string;
    rigKey: string;
  }>;
  original: CameraMovementGroundGlassComparisonLayer;
  current: CameraMovementGroundGlassComparisonLayer;
  /** Explicit aliases for consumers that do not use nested layer names. */
  originalCameraState: Readonly<CameraState>;
  currentCameraState: Readonly<CameraState>;
  originalOpticsState: Readonly<DerivedOpticsState>;
  currentOpticsState: Readonly<DerivedOpticsState>;
}>;

const TARGET_REGIONS: ReadonlySet<CameraMovementTargetRegion> = new Set([
  "upper",
  "middle",
  "lower",
]);

const isTargetRegion = (value: unknown): value is CameraMovementTargetRegion =>
  typeof value === "string" && TARGET_REGIONS.has(value as CameraMovementTargetRegion);

const targetRegionForAnchor = (
  anchor: CameraState["viewpointAnchor"],
): CameraMovementTargetRegion => {
  if (anchor === "high") return "upper";
  if (anchor === "low") return "lower";
  return DEFAULT_CAMERA_MOVEMENT_TARGET_REGION;
};

/**
 * Clone and recursively freeze plain data returned by the optics helpers.
 * Current optics may have been supplied by a caller, so freezing the caller's
 * object in place would violate this resolver's non-mutating contract.
 */
const cloneAndFreeze = <T>(value: T, seen = new WeakMap<object, unknown>()): T => {
  if (value === null || typeof value !== "object") return value;
  const source = value as unknown as object;
  const prior = seen.get(source);
  if (prior !== undefined) return prior as T;

  if (Array.isArray(value)) {
    const clone: unknown[] = [];
    seen.set(source, clone);
    value.forEach((entry) => clone.push(cloneAndFreeze(entry, seen)));
    return Object.freeze(clone) as T;
  }

  const clone: Record<string, unknown> = {};
  seen.set(source, clone);
  Object.entries(value as Record<string, unknown>).forEach(([key, entry]) => {
    clone[key] = cloneAndFreeze(entry, seen);
  });
  return Object.freeze(clone) as T;
};

const effectiveCalibrationFor = (
  input: CameraMovementGroundGlassComparisonInput,
): EffectiveCameraMovementCalibration => {
  if (input.effectiveCalibration) return input.effectiveCalibration;
  if (input.calibration) {
    // Workbench callers provide an Effective calibration. Pure scene callers
    // may provide the raw scene contract; resolve it once to restore scoped
    // identity keys and immutable derived rig geometry.
    if (
      "effectiveKey" in input.calibration &&
      typeof input.calibration.effectiveKey === "string"
    ) {
      return input.calibration as EffectiveCameraMovementCalibration;
    }
    return resolveEffectiveCameraMovementCalibration(input.calibration);
  }
  return resolveEffectiveCameraMovementCalibration(CAMERA_MOVEMENT_CALIBRATION_BASELINE);
};

const candidateFor = (
  calibration: EffectiveCameraMovementCalibration,
): CameraMovementTeachingCalibrationCandidate => ({
  subject: {
    columns: calibration.subject.columns,
    rows: calibration.subject.rows,
    levels: calibration.subject.levels,
    cubeSizeMm: calibration.subject.cubeSizeMm,
    horizontalGapMm: calibration.subject.horizontalGapMm,
    verticalGapMm: calibration.subject.verticalGapMm,
  },
  subjectDistanceMm: calibration.subject.originWorld.z,
  focalLengthMm: calibration.optics.provisionalFocalLengthMm,
  focusDistanceMm: calibration.optics.provisionalFocusDistanceMm,
  arcAngleDeg: calibration.cameraRig.highArcAngleDeg,
  tiltDeg: CAMERA_MOVEMENT_PROVISIONAL_TEACHING_MOVEMENTS.tiltDeg,
  riseMm: CAMERA_MOVEMENT_PROVISIONAL_TEACHING_MOVEMENTS.riseMm,
  bodyPitchDeg: CAMERA_MOVEMENT_PROVISIONAL_TEACHING_MOVEMENTS.bodyPitchDeg,
});

const resolveSharedPhysicalSettings = (
  camera: CameraState,
  calibration: EffectiveCameraMovementCalibration,
): Readonly<{
  focalLengthMm: number;
  focusDistanceMm: number;
  aperture: ApertureValue;
}> => ({
  // Live controls are authoritative when valid. Calibration values provide a
  // finite physical fallback for a partially initialized route.
  focalLengthMm:
    Number.isFinite(camera.focalLengthMm) && camera.focalLengthMm > 0
      ? camera.focalLengthMm
      : calibration.optics.provisionalFocalLengthMm,
  focusDistanceMm:
    Number.isFinite(camera.focusDistanceMm) && camera.focusDistanceMm > 0
      ? camera.focusDistanceMm
      : calibration.optics.provisionalFocusDistanceMm,
  aperture: isApertureValue(camera.aperture) ? camera.aperture : 11,
});

/**
 * Resolve canonical Original and live Current optics for the camera-movement
 * Ground Glass comparison.
 *
 * Coordinate and sign conventions remain those of the canonical scene:
 * millimetres, +X camera-right, +Y up, +Z lens-to-subject; positive front or
 * rear rise is +Y; positive body pitch/arc angle is the calibrated high
 * viewpoint. No store or renderer objects are read here.
 */
export const resolveCameraMovementGroundGlassComparison = (
  input: CameraMovementGroundGlassComparisonInput,
): CameraMovementGroundGlassComparison => {
  const calibration = effectiveCalibrationFor(input);
  const currentCamera = input.camera;
  const sharedPhysical = resolveSharedPhysicalSettings(currentCamera, calibration);
  const requestedTargetRegion = input.currentTargetRegion ?? input.targetRegion;
  const targetRegion = isTargetRegion(requestedTargetRegion)
    ? requestedTargetRegion
    : targetRegionForAnchor(currentCamera.viewpointAnchor);

  // Neutral is built through the same canonical teaching-case factory used by
  // public C3/D3 cases, then receives the effective physical calibration.
  const neutralTeachingCase = createCameraMovementTeachingCases(
    candidateFor(calibration),
  ).neutral;
  const originalCamera: CameraState = {
    ...currentCamera,
    ...neutralTeachingCase.camera,
    focalLengthMm: sharedPhysical.focalLengthMm,
    focusDistanceMm: sharedPhysical.focusDistanceMm,
    aperture: sharedPhysical.aperture,
    focusMode: "finite",
    lastFiniteFocusDepthMm: sharedPhysical.focusDistanceMm,
    activeSceneId: understandingCameraMovementsScene.id,
    viewpointAnchor: neutralTeachingCase.anchor,
    cameraRigPlacement: resolveCameraRigViewpointAnchor(
      calibration.cameraRig,
      neutralTeachingCase.anchor,
    ),
  };

  const currentOptics =
    input.currentOptics ?? input.opticsState ?? deriveOpticsState(
      currentCamera,
      understandingCameraMovementsScene,
      calibration,
    );
  const originalOptics = deriveOpticsState(
    originalCamera,
    understandingCameraMovementsScene,
    calibration,
  );

  const frozenCurrentCamera = cloneAndFreeze({ ...currentCamera });
  const frozenOriginalCamera = cloneAndFreeze(originalCamera);
  const frozenCurrentOptics = cloneAndFreeze(currentOptics);
  const frozenOriginalOptics = cloneAndFreeze(originalOptics);
  const calibrationIdentity = {
    effectiveKey: calibration.effectiveKey,
    subjectGeometryKey: calibration.subjectGeometryKey,
    opticsKey: calibration.opticsKey,
    rigKey: calibration.rigKey,
  } as const;
  const currentLayer = {
    camera: frozenCurrentCamera,
    opticsState: frozenCurrentOptics,
    optics: frozenCurrentOptics,
    targetRegion,
    calibrationKey: calibration.effectiveKey,
  } as const;
  const originalLayer = {
    camera: frozenOriginalCamera,
    opticsState: frozenOriginalOptics,
    optics: frozenOriginalOptics,
    targetRegion,
    calibrationKey: calibration.effectiveKey,
  } as const;

  const activeTeachingCaseId = matchCameraMovementTeachingCase({
    anchor: currentCamera.viewpointAnchor,
    targetRegion,
    camera: currentCamera,
  });

  return cloneAndFreeze({
    sceneId: understandingCameraMovementsScene.id,
    targetRegion,
    comparisonTargetRegion: targetRegion,
    activeTeachingCaseId,
    originalTargetRegion: targetRegion,
    currentTargetRegion: targetRegion,
    shared: {
      ...sharedPhysical,
      calibrationKey: calibration.effectiveKey,
      effectiveKey: calibration.effectiveKey,
    },
    calibration: calibrationIdentity,
    original: originalLayer,
    current: currentLayer,
    originalCameraState: frozenOriginalCamera,
    currentCameraState: frozenCurrentCamera,
    originalOpticsState: frozenOriginalOptics,
    currentOpticsState: frozenCurrentOptics,
  });
};

/** Descriptive aliases for callers that use `derive` or `create` terminology. */
export const deriveCameraMovementGroundGlassComparison =
  resolveCameraMovementGroundGlassComparison;
export const createCameraMovementGroundGlassComparison =
  resolveCameraMovementGroundGlassComparison;
