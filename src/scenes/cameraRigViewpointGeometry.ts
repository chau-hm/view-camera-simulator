import { distance, isFiniteVec3, rotatePointAroundX } from "../core/math/vec";
import type {
  ArcAnchorCameraRigPlacement,
  CameraRigPlacement,
  CameraRigViewpointAnchor,
  CameraRigViewpointAnchorMetadata,
  CameraRigViewpointArcPlane,
  Vec3,
} from "../types/optics";

export type {
  CameraRigViewpointAnchor,
  CameraRigViewpointAnchorMetadata,
  CameraRigViewpointArcPlane,
  CameraRigViewpointRelativeHeight,
} from "../types/optics";

export type CameraRigViewpointArcCalibration = Readonly<{
  /** Arc is constrained to the world YZ plane; X remains unchanged. */
  arcPlane: CameraRigViewpointArcPlane;
  /** Centre of the viewpoint arc in canonical scene millimetres. */
  arcCenterWorld: Readonly<Vec3>;
  /** Zero-movement lens datum for the mid anchor. */
  midRigOriginWorld: Readonly<Vec3>;
  /** Explicit raw physical radius of the provisional arc. */
  arcRadiusMm: number;
  /** Positive right-handed +X arc angle for the elevated anchor. */
  highArcAngleDeg: number;
  /** Negative right-handed +X arc angle for the lowered anchor. */
  lowArcAngleDeg: number;
  /** Provisional outer rig pitch, independent from anchor position. */
  provisionalBasePitchDeg: number;
  defaultAnchor: CameraRigViewpointAnchor;
  anchorMetadata: Readonly<
    Record<CameraRigViewpointAnchor, CameraRigViewpointAnchorMetadata>
  >;
}>;

/** Scene-level name for a canonical resolved arc-anchor placement. */
export type ResolvedCameraRigViewpointAnchor = ArcAnchorCameraRigPlacement;

const approximatelyEqual = (a: number, b: number): boolean => {
  const scale = Math.max(1, Math.abs(a), Math.abs(b));
  return Math.abs(a - b) <= Number.EPSILON * scale * 8;
};

const placementNumberApproximatelyEqual = (a: number, b: number): boolean => {
  const scale = Math.max(1, Math.abs(a), Math.abs(b));
  return Number.isFinite(a) && Math.abs(a - b) <= 1e-9 * scale;
};

const placementVectorApproximatelyEqual = (
  a: Readonly<Vec3>,
  b: Readonly<Vec3>,
): boolean =>
  placementNumberApproximatelyEqual(a.x, b.x) &&
  placementNumberApproximatelyEqual(a.y, b.y) &&
  placementNumberApproximatelyEqual(a.z, b.z);

const assertValidCalibration = (calibration: CameraRigViewpointArcCalibration): void => {
  if (calibration.arcPlane !== "yz") {
    throw new Error("Camera rig viewpoint arc plane must be yz");
  }
  if (!isFiniteVec3(calibration.arcCenterWorld) || !isFiniteVec3(calibration.midRigOriginWorld)) {
    throw new Error("Camera rig viewpoint arc requires finite centre and mid-origin coordinates");
  }
  if (calibration.arcCenterWorld.x !== calibration.midRigOriginWorld.x) {
    throw new Error("Camera rig viewpoint arc centre and mid origin must share X");
  }
  if (!Number.isFinite(calibration.arcRadiusMm) || calibration.arcRadiusMm <= 0) {
    throw new Error("Camera rig viewpoint arc radius must be finite and greater than zero");
  }
  const measuredRadiusMm = distance(
    calibration.arcCenterWorld,
    calibration.midRigOriginWorld,
  );
  if (!Number.isFinite(measuredRadiusMm) || measuredRadiusMm <= 0) {
    throw new Error("Camera rig viewpoint centre and mid origin must define a non-zero radius");
  }
  if (!approximatelyEqual(calibration.arcRadiusMm, measuredRadiusMm)) {
    throw new Error("Configured camera rig arc radius must match centre-to-mid distance");
  }
  if (
    !Number.isFinite(calibration.highArcAngleDeg) ||
    calibration.highArcAngleDeg <= 0 ||
    calibration.highArcAngleDeg >= 180
  ) {
    throw new Error("Camera rig high arc angle must be finite, positive, and below 180 degrees");
  }
  if (
    !Number.isFinite(calibration.lowArcAngleDeg) ||
    calibration.lowArcAngleDeg >= 0 ||
    calibration.lowArcAngleDeg <= -180
  ) {
    throw new Error("Camera rig low arc angle must be finite, negative, and above -180 degrees");
  }
  if (!approximatelyEqual(calibration.highArcAngleDeg, -calibration.lowArcAngleDeg)) {
    throw new Error("Camera rig high and low arc angles must be symmetric");
  }
  if (!Number.isFinite(calibration.provisionalBasePitchDeg)) {
    throw new Error("Camera rig provisional base pitch must be finite");
  }

  const expectedMetadata = {
    mid: { identity: "mid", relativeHeight: "at-mid" },
    high: { identity: "high", relativeHeight: "above-mid" },
    low: { identity: "low", relativeHeight: "below-mid" },
  } as const satisfies Readonly<
    Record<CameraRigViewpointAnchor, CameraRigViewpointAnchorMetadata>
  >;
  for (const anchor of ["mid", "high", "low"] as const) {
    const metadata = calibration.anchorMetadata?.[anchor];
    if (
      metadata?.identity !== expectedMetadata[anchor].identity ||
      metadata.relativeHeight !== expectedMetadata[anchor].relativeHeight
    ) {
      throw new Error(`Camera rig ${anchor} anchor metadata is invalid`);
    }
  }
  if (
    !["mid", "high", "low"].includes(calibration.defaultAnchor) ||
    calibration.anchorMetadata[calibration.defaultAnchor]?.identity !==
      calibration.defaultAnchor
  ) {
    throw new Error("Camera rig default anchor metadata is invalid");
  }
};

const angleForAnchor = (
  calibration: CameraRigViewpointArcCalibration,
  anchor: CameraRigViewpointAnchor,
): number => {
  switch (anchor) {
    case "mid":
      return 0;
    case "high":
      return calibration.highArcAngleDeg;
    case "low":
      return calibration.lowArcAngleDeg;
    default:
      throw new Error(`Unknown camera rig viewpoint anchor: ${String(anchor)}`);
  }
};

/**
 * Resolve one camera-rig lens-datum anchor on a pure world YZ arc.
 *
 * Positive arc rotation is the high viewpoint because the calibrated
 * centre-to-mid vector points along -Z and right-handed +X sends -Z toward +Y.
 */
export const resolveCameraRigViewpointAnchor = (
  calibration: CameraRigViewpointArcCalibration,
  anchor: CameraRigViewpointAnchor,
): ResolvedCameraRigViewpointAnchor => {
  assertValidCalibration(calibration);
  const arcAngleDeg = angleForAnchor(calibration, anchor);
  const rigOriginWorld =
    arcAngleDeg === 0
      ? { ...calibration.midRigOriginWorld }
      : rotatePointAroundX(
          calibration.midRigOriginWorld,
          calibration.arcCenterWorld,
          arcAngleDeg,
        );

  return {
    kind: "arc-anchor",
    anchor,
    metadata: calibration.anchorMetadata[anchor],
    arcPlane: calibration.arcPlane,
    arcCenterWorld: { ...calibration.arcCenterWorld },
    rigOriginWorld,
    basePitchDeg: calibration.provisionalBasePitchDeg,
    arcAngleDeg,
    radiusMm: calibration.arcRadiusMm,
  };
};

/**
 * Validate compatibility state against a freshly resolved canonical anchor.
 *
 * The stored numeric placement is never authoritative: callers should consume
 * the newly resolved placement after this comparison succeeds.
 */
export const isCanonicalCameraRigViewpointPlacement = (
  placement: CameraRigPlacement,
  calibration: CameraRigViewpointArcCalibration,
  anchor: CameraRigViewpointAnchor,
): placement is ArcAnchorCameraRigPlacement => {
  let expected: ResolvedCameraRigViewpointAnchor;
  try {
    expected = resolveCameraRigViewpointAnchor(calibration, anchor);
  } catch {
    return false;
  }

  try {
    return (
      placement.kind === "arc-anchor" &&
      placement.anchor === expected.anchor &&
      placement.metadata.identity === expected.metadata.identity &&
      placement.metadata.relativeHeight === expected.metadata.relativeHeight &&
      placement.arcPlane === expected.arcPlane &&
      placementVectorApproximatelyEqual(
        placement.arcCenterWorld,
        expected.arcCenterWorld,
      ) &&
      placementVectorApproximatelyEqual(
        placement.rigOriginWorld,
        expected.rigOriginWorld,
      ) &&
      placementNumberApproximatelyEqual(placement.radiusMm, expected.radiusMm) &&
      placementNumberApproximatelyEqual(
        placement.arcAngleDeg,
        expected.arcAngleDeg,
      ) &&
      placementNumberApproximatelyEqual(
        placement.basePitchDeg,
        expected.basePitchDeg,
      )
    );
  } catch {
    return false;
  }
};

export const resolveCameraRigViewpointAnchors = (
  calibration: CameraRigViewpointArcCalibration,
): Readonly<Record<CameraRigViewpointAnchor, ResolvedCameraRigViewpointAnchor>> => ({
  mid: resolveCameraRigViewpointAnchor(calibration, "mid"),
  high: resolveCameraRigViewpointAnchor(calibration, "high"),
  low: resolveCameraRigViewpointAnchor(calibration, "low"),
});
