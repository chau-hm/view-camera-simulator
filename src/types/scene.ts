import type { Bounds3, Vec3 } from "./optics";
import type { CameraState, FocusStandard } from "./camera";

export type FocusTarget = {
  id: string;
  label: string;
  worldPosition: Vec3;
  /** Optional visible-surface samples aggregated conservatively under this semantic target id. */
  sampleWorldPositions?: Vec3[];
  weight: number;
  // optional explicit reference depth from the rear/film datum for deterministic focus presets (S)
  focusReferenceDepthFromRearDatumMm?: number;
};

export type CompositionTarget = {
  id: string;
  label: string;
  worldBounds: Bounds3;
};

export type SceneAsset = {
  id: string;
  kind: "model" | "helper";
  source: string;
  textureFormat?: "ktx2" | "webp" | "none";
  loadStrategy?: "eager" | "lazy";
};

export type CameraPlacement = {
  position: Vec3;
  target: Vec3;
};

export type CameraMovementField =
  "frontRiseMm" | "frontTiltDeg" | "frontSwingDeg" | "rearRiseMm" | "rearTiltDeg";

export type SceneMovementCapabilities = {
  /** Movement field names available for this scene. */
  available: readonly CameraMovementField[];
  /** How many movements may be active simultaneously. */
  selectionMode: "single";
  /** Default selected movement on scene entry. */
  defaultMovement: CameraMovementField;
};

/**
 * Declarative finite-focus placement for scenes whose lens remains at the
 * baseline origin while the rear standard supplies the thin-lens extension.
 */
export type SceneFiniteFocusStrategy = {
  kind: "rear-standard-thin-lens";
  lensDatum: "baseline-origin";
  focusDistanceReference: "lens-to-focus-plane";
};

export type SceneCameraBodyPitchCapability = {
  enabled: true;
};

export type SceneFocusStandardCapability = {
  enabled: true;
  defaultStandard: FocusStandard;
  /** Rear-datum focus depth used to calibrate the rear-standard lens position. */
  referenceFocusDepthMm: number;
  /** Smallest public focus depth that keeps both supported standards physical. */
  minimumFocusDepthMm?: number;
};

export type SceneDefinition = {
  id: string;
  name: string;
  description: string;
  assets: SceneAsset[];
  cameraPreset: Pick<
    CameraState,
    | "focusDistanceMm"
    | "aperture"
    | "frontRiseMm"
    | "frontTiltDeg"
    | "frontSwingDeg"
    | "rearRiseMm"
    | "rearTiltDeg"
  > &
    Partial<Pick<CameraState, "focalLengthMm" | "cameraBodyPitchDeg" | "cameraBodyPivotWorld">>;
  cameraPlacement: CameraPlacement;
  bounds: Bounds3;
  focusTargets: FocusTarget[];
  compositionTargets: CompositionTarget[];
  /** Optional physical film-placement strategy. The legacy Z=-f baseline applies when absent. */
  finiteFocusStrategy?: SceneFiniteFocusStrategy;
  /** Optional capability for selectable front/rear finite-focus geometry. */
  focusStandardCapability?: SceneFocusStandardCapability;
  /** Enables the canonical rigid body-pitch transform for this scene. */
  cameraBodyPitchCapability?: SceneCameraBodyPitchCapability;
  /** Optional per-scene movement capability contract. When absent, existing default behaviour applies. */
  movementCapabilities?: SceneMovementCapabilities;
  /** Optional camera-inspection observer framing. When absent, the default fallback applies. */
  cameraInspectionPlacement?: CameraPlacement;
  /** Optional per-scene control policy. When absent, all controls are available. */
  cameraControlPolicy?: CameraControlPolicy;
};

/** Per-scene control policy for locking controls in instructional scenes. */
export type CameraControlPolicy = {
  focusDistance?: "fixed";
  aperture?: "fixed";
  infinityReset?: false;
};
