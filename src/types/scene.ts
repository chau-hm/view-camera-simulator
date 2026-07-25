import type { Bounds3, Vec3 } from "./optics";
import type { CameraState } from "./camera";

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
  | "frontRiseMm"
  | "frontTiltDeg"
  | "frontSwingDeg"
  | "rearRiseMm"
  | "rearTiltDeg";

export type SceneMovementCapabilities = {
  /** Movement field names available for this scene. */
  available: readonly CameraMovementField[];
  /** How many movements may be active simultaneously. */
  selectionMode: "single";
  /** Default selected movement on scene entry. */
  defaultMovement: CameraMovementField;
};

export type SceneDefinition = {
  id: string;
  name: string;
  description: string;
  assets: SceneAsset[];
  cameraPreset: Pick<
    CameraState,
    "focusDistanceMm" | "aperture" | "frontRiseMm" | "frontTiltDeg" | "frontSwingDeg" | "rearRiseMm" | "rearTiltDeg"
  >;
  cameraPlacement: CameraPlacement;
  bounds: Bounds3;
  focusTargets: FocusTarget[];
  compositionTargets: CompositionTarget[];
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
