import type { Plane, Ray, Vec3, Line3 } from "../../types/optics";
import { planeFromPointNormal, intersectPlanes, planeFromLineAndPoint } from "../math/plane";
import { add, scale, normalize, subtract, dot } from "../math/vec";
import { CAMERA_CONSTANTS } from "../../utils/constants";
import { imageDistanceMm } from "./thinLensModel";

type CanonicalAperture = (typeof CAMERA_CONSTANTS.apertureOptions)[number];

/**
 * Legacy presentation/readout anchors, not the authoritative physical CoC
 * model. Existing values remain exact for compatibility; newly supported
 * stops are interpolated by their position in the canonical stop sequence.
 */
const APERTURE_TOLERANCE_ANCHORS_MM: Partial<Record<CanonicalAperture, number>> = {
  5.6: 800,
  11: 1600,
  22: 3200,
  32: 4800,
};

const getApertureToleranceAnchor = (aperture: CanonicalAperture): number | undefined =>
  APERTURE_TOLERANCE_ANCHORS_MM[aperture];

export const mapApertureToToleranceMm = (aperture: number): number => {
  const canonicalApertures = CAMERA_CONSTANTS.apertureOptions;
  const canonicalAperture = aperture as CanonicalAperture;
  const exactAnchor = getApertureToleranceAnchor(canonicalAperture);
  if (exactAnchor !== undefined) return exactAnchor;

  const apertureIndex = canonicalApertures.indexOf(canonicalAperture);
  if (apertureIndex < 0) return 16;

  let lowerIndex = apertureIndex - 1;
  while (
    lowerIndex >= 0 &&
    getApertureToleranceAnchor(canonicalApertures[lowerIndex]) === undefined
  ) {
    lowerIndex -= 1;
  }

  let upperIndex = apertureIndex + 1;
  while (
    upperIndex < canonicalApertures.length &&
    getApertureToleranceAnchor(canonicalApertures[upperIndex]) === undefined
  ) {
    upperIndex += 1;
  }

  if (lowerIndex < 0 || upperIndex >= canonicalApertures.length) return 16;

  const lowerTolerance = getApertureToleranceAnchor(canonicalApertures[lowerIndex]);
  const upperTolerance = getApertureToleranceAnchor(canonicalApertures[upperIndex]);
  if (lowerTolerance === undefined || upperTolerance === undefined) return 16;

  const interpolation = (apertureIndex - lowerIndex) / (upperIndex - lowerIndex);
  return lowerTolerance + interpolation * (upperTolerance - lowerTolerance);
};

// Thin-lens hyperfocal DOF calculation
// Inputs:
// - focalLengthMm: f
// - apertureFNumber: N
// - circleOfConfusionMm: c
// - lensCenterWorld: Vec3
// - opticalAxis: Ray (origin, direction normalized)
// - focusObjectDistanceMm: U (object distance measured from lens centre)
// Returns planes located at lensCenter + direction * nearU / farU

export const calculateDepthOfField = ({
  focalLengthMm,
  apertureFNumber,
  circleOfConfusionMm,
  lensCenterWorld,
  opticalAxis,
  focusObjectDistanceMm,
  // optional visual cap in mm when far is infinite
  visualCapMm = 10000,
  // optional geometry for Scheimpflug model
  filmPlane,
  lensPlane,
  hingeLine,
  filmCenterWorld,
}: {
  focalLengthMm: number;
  apertureFNumber: number;
  circleOfConfusionMm: number;
  lensCenterWorld: Vec3;
  opticalAxis: Ray;
  focusObjectDistanceMm: number;
  visualCapMm?: number;
  filmPlane?: Plane;
  lensPlane?: Plane;
  hingeLine?: Line3 | null;
  filmCenterWorld?: Vec3;
}): {
  depthOfFieldNearPlane: Plane;
  depthOfFieldFarPlane: Plane | null;
  farIsInfinite: boolean;
  nearU: number;
  focusU?: number;
  farU: number;
  depthOfFieldModel: "parallel" | "scheimpflug-wedge";
  fallbackApplied?: boolean;
  fallbackReason?: string | null;
} => {
  const f = focalLengthMm;
  const N = apertureFNumber;
  const c = circleOfConfusionMm;
  const U = focusObjectDistanceMm;

  // hyperfocal
  const H = (f * f) / (N * c) + f;

  const nearU = (H * U) / (H + (U - f));

  const denom = H - (U - f);
  let farU: number;
  let farIsInfinite = false;
  if (denom <= 1e-9) {
    farIsInfinite = true;
    farU = Infinity;
  } else {
    farU = (H * U) / denom;
  }

  // Default: parallel model (legacy behavior)
  const dir = opticalAxis.direction;
  const nearPoint = add(lensCenterWorld, scale(dir, nearU));
  const farPoint = farIsInfinite
    ? add(lensCenterWorld, scale(dir, visualCapMm))
    : add(lensCenterWorld, scale(dir, farU));
  const parallelNearPlane = planeFromPointNormal(nearPoint, dir);
  const parallelFarPlane = planeFromPointNormal(farPoint, dir);

  // If we have enough geometry for Scheimpflug wedge, attempt construction
  if (filmPlane && lensPlane && typeof hingeLine !== "undefined" && hingeLine !== null) {
    try {
      // image distances
      const focusV = imageDistanceMm(f, U);
      const nearV = imageDistanceMm(f, nearU);
      const farV = farIsInfinite ? null : imageDistanceMm(f, farU);

      // image side direction: which way from lens to film center
      const imageSideDir = normalize(subtract(filmCenterWorld ?? filmPlane.point, lensCenterWorld));
      // determine sign of film normal that corresponds to increasing image distance
      const sign = Math.sign(dot(imageSideDir, filmPlane.normal)) || 1;

      // near image plane: parallel to filmPlane, offset by (nearV - focusV) along film normal (signed)
      const nearOffset = (nearV - focusV) * sign;
      const nearImagePlanePoint = add(filmPlane.point, scale(filmPlane.normal, nearOffset));
      const nearImagePlane = planeFromPointNormal(nearImagePlanePoint, filmPlane.normal);

      // intersect with lens plane to get hinge lines
      const nearScheimpflugLine = intersectPlanes(lensPlane, nearImagePlane);
      if (!nearScheimpflugLine) {
        // fallback: invalid near image plane intersection
        return {
          depthOfFieldNearPlane: parallelNearPlane,
          depthOfFieldFarPlane: parallelFarPlane,
          farIsInfinite,
          nearU,
          farU,
          depthOfFieldModel: "parallel",
          fallbackApplied: true,
          fallbackReason: "invalid near image plane intersection",
        };
      }

      // far image plane: do NOT fabricate an image-plane for infinite far. Keep farImagePlane null when farIsInfinite.
      let farImagePlane: Plane | null = null;
      if (!farIsInfinite && farV !== null) {
        const farOffset = (farV - focusV) * sign;
        const farImagePlanePoint = add(filmPlane.point, scale(filmPlane.normal, farOffset));
        farImagePlane = planeFromPointNormal(farImagePlanePoint, filmPlane.normal);
      }

      // intersect far image plane with lens plane (if farImagePlane exists)
      const farScheimpflugLine = farImagePlane ? intersectPlanes(lensPlane, farImagePlane) : null;

      // Construct object-side points
      const nearObjectPoint = add(lensCenterWorld, scale(opticalAxis.direction, nearU));
      const farObjectPoint = farIsInfinite
        ? add(lensCenterWorld, scale(opticalAxis.direction, visualCapMm))
        : add(lensCenterWorld, scale(opticalAxis.direction, farU));

      // Build planes through the corresponding Scheimpflug lines and object points
      const nearPlane = planeFromLineAndPoint(
        nearScheimpflugLine,
        nearObjectPoint,
        filmPlane.normal,
      );
      if (!nearPlane)
        return {
          depthOfFieldNearPlane: parallelNearPlane,
          depthOfFieldFarPlane: parallelFarPlane,
          farIsInfinite,
          nearU,
          farU,
          depthOfFieldModel: "parallel",
          fallbackApplied: true,
          fallbackReason: "plane-through-line construction failed for near plane",
        };

      let farPlane: Plane | null = null;
      if (farScheimpflugLine) {
        farPlane = planeFromLineAndPoint(farScheimpflugLine, farObjectPoint, filmPlane.normal);
        if (!farPlane) {
          // fallback to parallel far
          farPlane = parallelFarPlane;
        }
      } else if (farIsInfinite) {
        // keep far plane null to indicate infinite
        farPlane = null;
      } else {
        // if we couldn't form a far Scheimpflug line but far is finite, fallback and report reason
        farPlane = parallelFarPlane;
      }

      return {
        depthOfFieldNearPlane: nearPlane,
        depthOfFieldFarPlane: farPlane,
        farIsInfinite,
        nearU,
        focusU: U,
        farU,
        depthOfFieldModel: "scheimpflug-wedge",
        fallbackApplied: false,
        fallbackReason: null,
      };
    } catch (e) {
      // on any failure, fall back to parallel model and surface reason
      const reason = e instanceof Error ? e.message : String(e);
      return {
        depthOfFieldNearPlane: parallelNearPlane,
        depthOfFieldFarPlane: parallelFarPlane,
        farIsInfinite,
        nearU,
        farU,
        depthOfFieldModel: "parallel",
        fallbackApplied: true,
        fallbackReason: `exception: ${reason}`,
      };
    }
  }

  // default return (parallel model)
  return {
    depthOfFieldNearPlane: parallelNearPlane,
    depthOfFieldFarPlane: parallelFarPlane,
    farIsInfinite,
    nearU,
    farU,
    depthOfFieldModel: "parallel",
    fallbackApplied: false,
    fallbackReason: null,
  };
};
