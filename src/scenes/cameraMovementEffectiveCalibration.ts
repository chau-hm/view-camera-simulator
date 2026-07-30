import { distance } from "../core/math/vec";
import { imageDistanceMm } from "../core/optics/thinLensModel";
import type { CameraRigViewpointAnchor, Vec3 } from "../types/optics";
import {
  CAMERA_MOVEMENT_SCENE_CALIBRATION,
  type CameraMovementPresentationCalibration,
  type CameraMovementSceneCalibration,
  type CameraMovementTargetRegion,
} from "./cameraMovementSceneCalibration";

type NumericBounds = Readonly<{ min: number; max: number; minExclusive?: boolean }>;

export const CAMERA_MOVEMENT_WORKBENCH_BOUNDS = {
  subject: {
    columns: { min: 1, max: 8 },
    rows: { min: 1, max: 8 },
    levels: { min: 3, max: 12 },
    cubeSizeMm: { min: 50, max: 1000 },
    horizontalGapMm: { min: 0, max: 1000 },
    verticalGapMm: { min: 0, max: 1000 },
    subjectDistanceMm: { min: 500, max: 10000 },
  },
  optics: {
    provisionalFocalLengthMm: { min: 0, max: 1000, minExclusive: true },
    provisionalFocusDistanceMm: { min: 0, max: 10000, minExclusive: true },
  },
  rig: {
    arcAngleDeg: { min: 0.1, max: 45 },
    provisionalBasePitchDeg: { min: -20, max: 20 },
  },
  movements: {
    cameraBodyPitchDeg: { min: -45, max: 45 },
  },
  presentation: {
    outerVerticalWeight: { min: 0.1, max: 10 },
    outerHorizontalWeight: { min: 0.1, max: 10 },
    internalEdgeWeight: { min: 0.1, max: 10 },
    internalEdgeOpacity: { min: 0.01, max: 1 },
  },
} as const satisfies Record<string, Readonly<Record<string, NumericBounds>>>;

type GeometryOverrides = Readonly<{
  columns?: number;
  rows?: number;
  levels?: number;
  cubeSizeMm?: number;
  horizontalGapMm?: number;
  verticalGapMm?: number;
  /**
   * Canonical lens-to-subject-axis distance. Resolution changes only the
   * subject centre's Z coordinate; X and Y remain baseline calibration data.
   */
  subjectDistanceMm?: number;
}>;

type OpticsOverrides = Readonly<{
  focalLengthCandidatesMm?: readonly number[];
  provisionalFocalLengthMm?: number;
  provisionalFocusDistanceMm?: number;
}>;

type RigOverrides = Readonly<{
  midRigOriginWorld?: Readonly<Vec3>;
  /** Positive half-angle; low is always derived as its exact negative. */
  arcAngleDeg?: number;
  provisionalBasePitchDeg?: number;
  defaultAnchor?: CameraRigViewpointAnchor;
}>;

export type CameraMovementCalibrationOverrides = Readonly<{
  geometry?: GeometryOverrides;
  optics?: OpticsOverrides;
  rig?: RigOverrides;
  presentation?: Partial<CameraMovementPresentationCalibration>;
}>;

export type EffectiveCameraMovementCalibration = CameraMovementSceneCalibration &
  Readonly<{
    subjectGeometryKey: string;
    presentationKey: string;
    opticsKey: string;
    rigKey: string;
    effectiveKey: string;
  }>;

export type CalibrationValidationErrorCode =
  | "not-finite"
  | "not-positive"
  | "not-non-negative"
  | "not-positive-integer"
  | "insufficient-levels"
  | "invalid-target-levels"
  | "invalid-focal-candidates"
  | "invalid-thin-lens"
  | "invalid-rig-plane"
  | "misaligned-rig"
  | "invalid-rig-angle"
  | "asymmetric-rig-angle"
  | "invalid-rig-radius"
  | "invalid-anchor"
  | "invalid-presentation";

export type CalibrationValidationError = Readonly<{
  scope: "geometry" | "optics" | "rig" | "presentation";
  path: string;
  code: CalibrationValidationErrorCode;
  message: string;
}>;

export type CalibrationValidationResult = Readonly<{
  valid: boolean;
  errors: readonly CalibrationValidationError[];
}>;

export type CameraMovementCalibrationSnapshot = Readonly<{
  schemaVersion: 1;
  calibrationStatus: CameraMovementSceneCalibration["calibrationStatus"];
  geometryAndOpticsUnits: CameraMovementSceneCalibration["geometryAndOpticsUnits"];
  geometry: CameraMovementSceneCalibration["subject"];
  optics: CameraMovementSceneCalibration["optics"];
  rig: CameraMovementSceneCalibration["cameraRig"];
  presentation: CameraMovementSceneCalibration["presentation"];
}>;

const deepFreeze = <T>(value: T): T => {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.values(value).forEach((child) => deepFreeze(child));
    Object.freeze(value);
  }
  return value;
};

const cloneVec3 = (point: Readonly<Vec3>): Vec3 => ({
  x: point.x,
  y: point.y,
  z: point.z,
});

const cloneBaseline = (
  baseline: CameraMovementSceneCalibration,
): CameraMovementSceneCalibration => ({
  calibrationStatus: baseline.calibrationStatus,
  geometryAndOpticsUnits: baseline.geometryAndOpticsUnits,
  subject: {
    ...baseline.subject,
    originWorld: cloneVec3(baseline.subject.originWorld),
  },
  optics: {
    ...baseline.optics,
    focalLengthCandidatesMm: [...baseline.optics.focalLengthCandidatesMm],
  },
  cameraRig: {
    ...baseline.cameraRig,
    arcCenterWorld: cloneVec3(baseline.cameraRig.arcCenterWorld),
    midRigOriginWorld: cloneVec3(baseline.cameraRig.midRigOriginWorld),
    anchorMetadata: {
      mid: { ...baseline.cameraRig.anchorMetadata.mid },
      high: { ...baseline.cameraRig.anchorMetadata.high },
      low: { ...baseline.cameraRig.anchorMetadata.low },
    },
  },
  presentation: { ...baseline.presentation },
});

/** Runtime-immutable workbench baseline, separate from production calibration. */
export const CAMERA_MOVEMENT_CALIBRATION_BASELINE = deepFreeze(
  cloneBaseline(CAMERA_MOVEMENT_SCENE_CALIBRATION),
);

const scopedKey = (scope: string, value: unknown): string =>
  `${scope}:${JSON.stringify(value, (_key, child: unknown) => {
    if (typeof child !== "number" || Number.isFinite(child)) return child;
    return { nonFiniteNumber: String(child) };
  })}`;

const snapshotSections = (calibration: CameraMovementSceneCalibration) => ({
  geometry: {
    columns: calibration.subject.columns,
    rows: calibration.subject.rows,
    levels: calibration.subject.levels,
    cubeSizeMm: calibration.subject.cubeSizeMm,
    horizontalGapMm: calibration.subject.horizontalGapMm,
    verticalGapMm: calibration.subject.verticalGapMm,
    originWorld: cloneVec3(calibration.subject.originWorld),
    upperTargetLevel: calibration.subject.upperTargetLevel,
    middleTargetLevel: calibration.subject.middleTargetLevel,
    lowerTargetLevel: calibration.subject.lowerTargetLevel,
  },
  optics: {
    focalLengthCandidatesMm: [...calibration.optics.focalLengthCandidatesMm],
    provisionalFocalLengthMm: calibration.optics.provisionalFocalLengthMm,
    provisionalFocusDistanceMm: calibration.optics.provisionalFocusDistanceMm,
  },
  rig: {
    arcPlane: calibration.cameraRig.arcPlane,
    arcCenterWorld: cloneVec3(calibration.cameraRig.arcCenterWorld),
    midRigOriginWorld: cloneVec3(calibration.cameraRig.midRigOriginWorld),
    arcRadiusMm: calibration.cameraRig.arcRadiusMm,
    highArcAngleDeg: calibration.cameraRig.highArcAngleDeg,
    lowArcAngleDeg: calibration.cameraRig.lowArcAngleDeg,
    provisionalBasePitchDeg: calibration.cameraRig.provisionalBasePitchDeg,
    defaultAnchor: calibration.cameraRig.defaultAnchor,
    anchorMetadata: {
      mid: { ...calibration.cameraRig.anchorMetadata.mid },
      high: { ...calibration.cameraRig.anchorMetadata.high },
      low: { ...calibration.cameraRig.anchorMetadata.low },
    },
  },
  presentation: {
    outerVerticalWeight: calibration.presentation.outerVerticalWeight,
    outerHorizontalWeight: calibration.presentation.outerHorizontalWeight,
    internalEdgeWeight: calibration.presentation.internalEdgeWeight,
    internalEdgeOpacity: calibration.presentation.internalEdgeOpacity,
    upperRegionColour: calibration.presentation.upperRegionColour,
    middleRegionColour: calibration.presentation.middleRegionColour,
    lowerRegionColour: calibration.presentation.lowerRegionColour,
    inactiveColour: calibration.presentation.inactiveColour,
    showReferenceCamera: calibration.presentation.showReferenceCamera,
    defaultTargetRegion: calibration.presentation.defaultTargetRegion,
  },
});

/**
 * Resolve workbench overrides without mutating the baseline.
 *
 * Target levels, rig centre/radius, and symmetric arc angles are canonical
 * derivatives rather than independent editable values.
 */
export const resolveEffectiveCameraMovementCalibration = (
  baseline: CameraMovementSceneCalibration,
  overrides: CameraMovementCalibrationOverrides = {},
): EffectiveCameraMovementCalibration => {
  const geometry = overrides.geometry ?? {};
  const optics = overrides.optics ?? {};
  const rig = overrides.rig ?? {};
  const levels = geometry.levels ?? baseline.subject.levels;
  const lastLevel = levels - 1;
  const subjectOriginWorld = {
    x: baseline.subject.originWorld.x,
    y: baseline.subject.originWorld.y,
    z: geometry.subjectDistanceMm ?? baseline.subject.originWorld.z,
  };
  const midRigOriginWorld = cloneVec3(
    rig.midRigOriginWorld ?? baseline.cameraRig.midRigOriginWorld,
  );
  const arcAngleDeg = rig.arcAngleDeg ?? baseline.cameraRig.highArcAngleDeg;
  const arcRadiusMm = distance(subjectOriginWorld, midRigOriginWorld);

  const resolved: CameraMovementSceneCalibration = {
    calibrationStatus: baseline.calibrationStatus,
    geometryAndOpticsUnits: baseline.geometryAndOpticsUnits,
    subject: {
      columns: geometry.columns ?? baseline.subject.columns,
      rows: geometry.rows ?? baseline.subject.rows,
      levels,
      cubeSizeMm: geometry.cubeSizeMm ?? baseline.subject.cubeSizeMm,
      horizontalGapMm: geometry.horizontalGapMm ?? baseline.subject.horizontalGapMm,
      verticalGapMm: geometry.verticalGapMm ?? baseline.subject.verticalGapMm,
      originWorld: subjectOriginWorld,
      lowerTargetLevel: 0,
      middleTargetLevel: Math.floor(lastLevel / 2),
      upperTargetLevel: lastLevel,
    },
    optics: {
      focalLengthCandidatesMm: [
        ...(optics.focalLengthCandidatesMm ?? baseline.optics.focalLengthCandidatesMm),
      ],
      provisionalFocalLengthMm:
        optics.provisionalFocalLengthMm ?? baseline.optics.provisionalFocalLengthMm,
      provisionalFocusDistanceMm:
        optics.provisionalFocusDistanceMm ?? baseline.optics.provisionalFocusDistanceMm,
    },
    cameraRig: {
      arcPlane: baseline.cameraRig.arcPlane,
      arcCenterWorld: subjectOriginWorld,
      midRigOriginWorld,
      arcRadiusMm,
      highArcAngleDeg: arcAngleDeg,
      lowArcAngleDeg: -arcAngleDeg,
      provisionalBasePitchDeg:
        rig.provisionalBasePitchDeg ?? baseline.cameraRig.provisionalBasePitchDeg,
      defaultAnchor: rig.defaultAnchor ?? baseline.cameraRig.defaultAnchor,
      anchorMetadata: {
        mid: { ...baseline.cameraRig.anchorMetadata.mid },
        high: { ...baseline.cameraRig.anchorMetadata.high },
        low: { ...baseline.cameraRig.anchorMetadata.low },
      },
    },
    presentation: {
      ...baseline.presentation,
      ...overrides.presentation,
    },
  };
  const sections = snapshotSections(resolved);
  const subjectGeometryKey = scopedKey("geometry", sections.geometry);
  const presentationKey = scopedKey("presentation", sections.presentation);
  const opticsKey = scopedKey("optics", sections.optics);
  const rigKey = scopedKey("rig", sections.rig);

  return deepFreeze({
    ...resolved,
    subjectGeometryKey,
    presentationKey,
    opticsKey,
    rigKey,
    effectiveKey: scopedKey("effective", {
      subjectGeometryKey,
      presentationKey,
      opticsKey,
      rigKey,
    }),
  });
};

const error = (
  scope: CalibrationValidationError["scope"],
  path: string,
  code: CalibrationValidationErrorCode,
  message: string,
): CalibrationValidationError => ({ scope, path, code, message });

const isFinitePoint = (point: Readonly<Vec3>): boolean =>
  Number.isFinite(point.x) && Number.isFinite(point.y) && Number.isFinite(point.z);

const isPositiveInteger = (value: number): boolean => Number.isInteger(value) && value > 0;

const validTargetRegion = (value: string): value is CameraMovementTargetRegion =>
  value === "upper" || value === "middle" || value === "lower";

export const validateEffectiveCameraMovementCalibration = (
  calibration: CameraMovementSceneCalibration,
): CalibrationValidationResult => {
  const errors: CalibrationValidationError[] = [];
  const { subject, optics, cameraRig, presentation } = calibration;

  (["columns", "rows"] as const).forEach((field) => {
    const bounds = CAMERA_MOVEMENT_WORKBENCH_BOUNDS.subject[field];
    if (!isPositiveInteger(subject[field]) || subject[field] > bounds.max) {
      errors.push(
        error(
          "geometry",
          `subject.${field}`,
          "not-positive-integer",
          `${field} must be an integer from ${bounds.min} to ${bounds.max}`,
        ),
      );
    }
  });
  if (!isPositiveInteger(subject.levels)) {
    errors.push(
      error(
        "geometry",
        "subject.levels",
        "not-positive-integer",
        "levels must be a positive integer",
      ),
    );
  } else if (
    subject.levels < CAMERA_MOVEMENT_WORKBENCH_BOUNDS.subject.levels.min ||
    subject.levels > CAMERA_MOVEMENT_WORKBENCH_BOUNDS.subject.levels.max
  ) {
    errors.push(
      error(
        "geometry",
        "subject.levels",
        "insufficient-levels",
        "levels must be from 3 to 12",
      ),
    );
  }
  if (
    !Number.isFinite(subject.cubeSizeMm) ||
    subject.cubeSizeMm < CAMERA_MOVEMENT_WORKBENCH_BOUNDS.subject.cubeSizeMm.min ||
    subject.cubeSizeMm > CAMERA_MOVEMENT_WORKBENCH_BOUNDS.subject.cubeSizeMm.max
  ) {
    errors.push(
      error(
        "geometry",
        "subject.cubeSizeMm",
        "not-positive",
        "cubeSizeMm must be from 50 to 1000 mm",
      ),
    );
  }
  (["horizontalGapMm", "verticalGapMm"] as const).forEach((field) => {
    if (
      !Number.isFinite(subject[field]) ||
      subject[field] < CAMERA_MOVEMENT_WORKBENCH_BOUNDS.subject[field].min ||
      subject[field] > CAMERA_MOVEMENT_WORKBENCH_BOUNDS.subject[field].max
    ) {
      errors.push(
        error(
          "geometry",
          `subject.${field}`,
          "not-non-negative",
          `${field} must be from 0 to 1000 mm`,
        ),
      );
    }
  });
  if (!isFinitePoint(subject.originWorld)) {
    errors.push(
      error(
        "geometry",
        "subject.originWorld",
        "not-finite",
        "subject origin must contain finite coordinates",
      ),
    );
  }
  if (
    Number.isFinite(subject.originWorld.z) &&
    (subject.originWorld.z < CAMERA_MOVEMENT_WORKBENCH_BOUNDS.subject.subjectDistanceMm.min ||
      subject.originWorld.z > CAMERA_MOVEMENT_WORKBENCH_BOUNDS.subject.subjectDistanceMm.max)
  ) {
    errors.push(
      error(
        "geometry",
        "subject.originWorld.z",
        "not-positive",
        "subject distance must be from 500 to 10000 mm",
      ),
    );
  }
  const lastLevel = subject.levels - 1;
  if (
    subject.lowerTargetLevel !== 0 ||
    subject.middleTargetLevel !== Math.floor(lastLevel / 2) ||
    subject.upperTargetLevel !== lastLevel
  ) {
    errors.push(
      error(
        "geometry",
        "subject.targetLevels",
        "invalid-target-levels",
        "target levels must be derived as zero, central, and last",
      ),
    );
  }

  if (
    optics.focalLengthCandidatesMm.length === 0 ||
    !optics.focalLengthCandidatesMm.every(
      (candidate) =>
        Number.isFinite(candidate) &&
        candidate > CAMERA_MOVEMENT_WORKBENCH_BOUNDS.optics.provisionalFocalLengthMm.min &&
        candidate <= CAMERA_MOVEMENT_WORKBENCH_BOUNDS.optics.provisionalFocalLengthMm.max,
    ) ||
    !optics.focalLengthCandidatesMm.includes(optics.provisionalFocalLengthMm)
  ) {
    errors.push(
      error(
        "optics",
        "optics.focalLengthCandidatesMm",
        "invalid-focal-candidates",
        "focal-length candidates must be finite, positive, non-empty, and include the provisional focal length",
      ),
    );
  }
  if (
    !Number.isFinite(optics.provisionalFocalLengthMm) ||
    optics.provisionalFocalLengthMm <=
      CAMERA_MOVEMENT_WORKBENCH_BOUNDS.optics.provisionalFocalLengthMm.min ||
    optics.provisionalFocalLengthMm >
      CAMERA_MOVEMENT_WORKBENCH_BOUNDS.optics.provisionalFocalLengthMm.max
  ) {
    errors.push(
      error(
        "optics",
        "optics.provisionalFocalLengthMm",
        "not-positive",
        "provisional focal length must be greater than 0 and no more than 1000 mm",
      ),
    );
  }
  if (
    !Number.isFinite(optics.provisionalFocusDistanceMm) ||
    optics.provisionalFocusDistanceMm <=
      CAMERA_MOVEMENT_WORKBENCH_BOUNDS.optics.provisionalFocusDistanceMm.min ||
    optics.provisionalFocusDistanceMm >
      CAMERA_MOVEMENT_WORKBENCH_BOUNDS.optics.provisionalFocusDistanceMm.max
  ) {
    errors.push(
      error(
        "optics",
        "optics.provisionalFocusDistanceMm",
        "not-positive",
        "provisional focus distance must be greater than 0 and no more than 10000 mm",
      ),
    );
  }
  const imageDistance = imageDistanceMm(
    optics.provisionalFocalLengthMm,
    optics.provisionalFocusDistanceMm,
  );
  if (
    optics.provisionalFocusDistanceMm <= optics.provisionalFocalLengthMm ||
    !Number.isFinite(imageDistance) ||
    imageDistance <= 0
  ) {
    errors.push(
      error(
        "optics",
        "optics.thinLens",
        "invalid-thin-lens",
        "finite thin-lens focus requires focus distance greater than focal length",
      ),
    );
  }

  if (cameraRig.arcPlane !== "yz") {
    errors.push(
      error("rig", "cameraRig.arcPlane", "invalid-rig-plane", "rig arc plane must be yz"),
    );
  }
  if (!isFinitePoint(cameraRig.arcCenterWorld) || !isFinitePoint(cameraRig.midRigOriginWorld)) {
    errors.push(
      error("rig", "cameraRig.points", "not-finite", "rig centre and midpoint must be finite"),
    );
  }
  if (
    cameraRig.arcCenterWorld.x !== subject.originWorld.x ||
    cameraRig.arcCenterWorld.y !== subject.originWorld.y ||
    cameraRig.arcCenterWorld.z !== subject.originWorld.z
  ) {
    errors.push(
      error(
        "rig",
        "cameraRig.arcCenterWorld",
        "misaligned-rig",
        "rig arc centre must equal the subject centre",
      ),
    );
  }
  const measuredRadius = distance(cameraRig.arcCenterWorld, cameraRig.midRigOriginWorld);
  const radiusTolerance = Number.EPSILON * Math.max(1, measuredRadius, cameraRig.arcRadiusMm) * 8;
  if (
    !Number.isFinite(cameraRig.arcRadiusMm) ||
    cameraRig.arcRadiusMm <= 0 ||
    !Number.isFinite(measuredRadius) ||
    measuredRadius <= 0 ||
    Math.abs(cameraRig.arcRadiusMm - measuredRadius) > radiusTolerance
  ) {
    errors.push(
      error(
        "rig",
        "cameraRig.arcRadiusMm",
        "invalid-rig-radius",
        "rig radius must be finite, positive, and equal centre-to-mid distance",
      ),
    );
  }
  if (
    !Number.isFinite(cameraRig.highArcAngleDeg) ||
    cameraRig.highArcAngleDeg < CAMERA_MOVEMENT_WORKBENCH_BOUNDS.rig.arcAngleDeg.min ||
    cameraRig.highArcAngleDeg > CAMERA_MOVEMENT_WORKBENCH_BOUNDS.rig.arcAngleDeg.max
  ) {
    errors.push(
      error(
        "rig",
        "cameraRig.highArcAngleDeg",
        "invalid-rig-angle",
        "arc angle magnitude must be greater than 0 and no more than 45 degrees",
      ),
    );
  }
  if (
    !Number.isFinite(cameraRig.lowArcAngleDeg) ||
    cameraRig.lowArcAngleDeg >= 0 ||
    cameraRig.lowArcAngleDeg < -45
  ) {
    errors.push(
      error(
        "rig",
        "cameraRig.lowArcAngleDeg",
        "invalid-rig-angle",
        "low rig angle must be negative and no less than -45 degrees",
      ),
    );
  }
  if (cameraRig.highArcAngleDeg !== -cameraRig.lowArcAngleDeg) {
    errors.push(
      error(
        "rig",
        "cameraRig.arcAngles",
        "asymmetric-rig-angle",
        "high and low rig angles must be exact opposites",
      ),
    );
  }
  if (
    !Number.isFinite(cameraRig.provisionalBasePitchDeg) ||
    cameraRig.provisionalBasePitchDeg <
      CAMERA_MOVEMENT_WORKBENCH_BOUNDS.rig.provisionalBasePitchDeg.min ||
    cameraRig.provisionalBasePitchDeg >
      CAMERA_MOVEMENT_WORKBENCH_BOUNDS.rig.provisionalBasePitchDeg.max
  ) {
    errors.push(
      error(
        "rig",
        "cameraRig.provisionalBasePitchDeg",
        "not-finite",
        "base pitch must be from -20 to 20 degrees",
      ),
    );
  }
  if (!["mid", "high", "low"].includes(cameraRig.defaultAnchor)) {
    errors.push(
      error(
        "rig",
        "cameraRig.defaultAnchor",
        "invalid-anchor",
        "default anchor must be mid, high, or low",
      ),
    );
  }

  (
    [
      "outerVerticalWeight",
      "outerHorizontalWeight",
      "internalEdgeWeight",
      "internalEdgeOpacity",
    ] as const
  ).forEach((field) => {
    const bounds = CAMERA_MOVEMENT_WORKBENCH_BOUNDS.presentation[field];
    if (
      !Number.isFinite(presentation[field]) ||
      presentation[field] < bounds.min ||
      presentation[field] > bounds.max
    ) {
      errors.push(
        error(
          "presentation",
          `presentation.${field}`,
          "invalid-presentation",
          `${field} must be from ${bounds.min} to ${bounds.max}`,
        ),
      );
    }
  });
  if (presentation.internalEdgeOpacity > 1) {
    errors.push(
      error(
        "presentation",
        "presentation.internalEdgeOpacity",
        "invalid-presentation",
        "internal edge opacity must not exceed 1",
      ),
    );
  }
  if (!validTargetRegion(presentation.defaultTargetRegion)) {
    errors.push(
      error(
        "presentation",
        "presentation.defaultTargetRegion",
        "invalid-presentation",
        "default target region must be upper, middle, or lower",
      ),
    );
  }

  return deepFreeze({ valid: errors.length === 0, errors });
};

export const buildCameraMovementCalibrationSnapshot = (
  calibration: EffectiveCameraMovementCalibration,
): CameraMovementCalibrationSnapshot => {
  const validation = validateEffectiveCameraMovementCalibration(calibration);
  if (!validation.valid) {
    throw new Error(
      `Cannot snapshot invalid camera-movement calibration: ${validation.errors
        .map(({ path }) => path)
        .join(", ")}`,
    );
  }
  const sections = snapshotSections(calibration);
  return deepFreeze({
    schemaVersion: 1,
    calibrationStatus: calibration.calibrationStatus,
    geometryAndOpticsUnits: calibration.geometryAndOpticsUnits,
    ...sections,
  });
};

export const stringifyCameraMovementCalibrationSnapshot = (
  calibrationOrSnapshot: EffectiveCameraMovementCalibration | CameraMovementCalibrationSnapshot,
): string =>
  JSON.stringify(
    "schemaVersion" in calibrationOrSnapshot
      ? calibrationOrSnapshot
      : buildCameraMovementCalibrationSnapshot(calibrationOrSnapshot),
    null,
    2,
  );
