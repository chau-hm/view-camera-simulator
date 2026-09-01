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

/** Calibrated observer placement for Camera focus; its orbit target is resolved by viewport framing. */
export type CameraInspectionPlacement = {
  position: Vec3;
};

/** Semantic side of the stable generic camera-inspection body anchor. */
export type CameraInspectionAnchorSide = "front" | "rear";

export type CameraMovementField =
  | "frontRiseMm"
  | "frontShiftMm"
  | "frontTiltDeg"
  | "frontSwingDeg"
  | "rearRiseMm"
  | "rearShiftMm"
  | "rearTiltDeg"
  | "rearSwingDeg";

export type SceneMovementCapabilities = {
  /** Movement field names available for this scene. */
  available: readonly CameraMovementField[];
  /** How many movements may be active simultaneously. */
  selectionMode: "single" | "multiple";
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
  /**
   * Chooses how the finite-focus rear film depth is interpreted when the
   * front lens is tilted or swung. Omitted values preserve the historical
   * rear-standard Z datum.
   */
  filmDepthReference?: "rear-standard-z" | "optical-axis-conjugate";
};

export type SceneCameraBodyPitchCapability = {
  enabled: true;
};

export type SceneCameraRigTranslationCapability = {
  enabled: true;
  axis: "x";
  state: "mirrorShiftLessonState";
};

export type SceneCameraFrontShiftCapability = {
  enabled: true;
  axis: "x";
};

export type SceneFocusStandardCapability = {
  enabled: true;
  defaultStandard: FocusStandard;
  /** Rear-datum focus depth used to calibrate the rear-standard lens position. */
  referenceFocusDepthMm: number;
  /** Smallest public focus depth that keeps both supported standards physical. */
  minimumFocusDepthMm?: number;
  /**
   * Selectable-focus placement contract for composing standard travel with the
   * scene's body datum. The rear-datum mode preserves Focus Fundamentals'
   * absolute construction; scene-baseline applies only the resolved travel.
   */
  placement?: "rear-datum" | "scene-baseline";
};

export type SceneFocusDistanceRangeMm = {
  min: number;
  max: number;
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
    | "rearShiftMm"
    | "rearTiltDeg"
    | "rearSwingDeg"
  > &
    Partial<Pick<CameraState, "focalLengthMm" | "frontShiftMm" | "cameraBodyPitchDeg" | "cameraBodyPivotWorld">>;
  cameraPlacement: CameraPlacement;
  bounds: Bounds3;
  focusTargets: FocusTarget[];
  compositionTargets: CompositionTarget[];
  /** Optional physical film-placement strategy. The legacy Z=-f baseline applies when absent. */
  finiteFocusStrategy?: SceneFiniteFocusStrategy;
  /** Optional capability for selectable front/rear finite-focus geometry. */
  focusStandardCapability?: SceneFocusStandardCapability;
  /** Optional explicit public focus-distance domain for finite-focus scenes. */
  focusDistanceRangeMm?: SceneFocusDistanceRangeMm;
  /** Enables the canonical rigid body-pitch transform for this scene. */
  cameraBodyPitchCapability?: SceneCameraBodyPitchCapability;
  /** Enables a scene-specific rigid lateral translation of the complete camera rig. */
  cameraRigTranslationCapability?: SceneCameraRigTranslationCapability;
  /** Enables a scene-specific horizontal translation of the front standard. */
  cameraFrontShiftCapability?: SceneCameraFrontShiftCapability;
  /** Optional per-scene movement capability contract. When absent, existing default behaviour applies. */
  movementCapabilities?: SceneMovementCapabilities;
  /** Optional semantic side for the generic camera-inspection body anchor; rear is the default. */
  cameraInspectionAnchorSide?: CameraInspectionAnchorSide;
  /** Optional camera-inspection observer position. The physical orbit target is resolved by viewport framing. */
  cameraInspectionPlacement?: CameraInspectionPlacement;
  /** Optional visibility policy for the generic original/reference camera. */
  showReferenceCamera?: boolean;
  /** Optional per-scene control policy. When absent, all controls are available. */
  cameraControlPolicy?: CameraControlPolicy;
};

/** Per-scene control policy for locking controls in instructional scenes. */
export type CameraControlPolicy = {
  movement?: "fixed";
  focusDistance?: "fixed";
  aperture?: "fixed";
  infinityReset?: false;
};
