import type { Plane, Vec3 } from "../../types/optics";
import {
  add,
  cross,
  dot,
  isFiniteVec3,
  magnitude,
  safeNormalize,
  scale,
  subtract,
  vec,
} from "../math/vec";
import { imageDistanceMm } from "./thinLensModel";

const EPSILON_MM = 1e-7;
const EPSILON_SQUARED = 1e-14;
const PI = Math.PI;

export type OrthonormalPlaneBasis = {
  x: Vec3;
  y: Vec3;
  normal: Vec3;
};

export type PhysicalBlurFootprintInput = {
  /** Reconstructed object point, in millimetres. */
  objectPoint: Vec3;
  /** Lens centre, in millimetres. */
  lensCenter: Vec3;
  /** Normal points from the image side toward the object side. */
  lensPlaneNormal: Vec3;
  lensPlaneBasisX: Vec3;
  lensPlaneBasisY: Vec3;
  filmPlane: Plane;
  filmPlaneBasisX: Vec3;
  filmPlaneBasisY: Vec3;
  focalLengthMm: number;
  apertureFNumber: number;
};

export type PhysicalBlurFootprint = {
  /** False means the geometry was unresolved and all values are neutral. */
  valid: boolean;
  /** Signed equivalent CoC diameter in millimetres; negative is near-side. */
  signedCoCDiameterMm: number;
  /** Local affine ellipse semi-axes in millimetres. */
  majorRadiusMm: number;
  minorRadiusMm: number;
  /** Major-axis angle in the supplied film-plane basis, modulo pi. */
  orientationRad: number;
};

const neutralFootprint = (): PhysicalBlurFootprint => ({
  valid: false,
  signedCoCDiameterMm: 0,
  majorRadiusMm: 0,
  minorRadiusMm: 0,
  orientationRad: 0,
});

const projectOntoPlane = (value: Vec3, normal: Vec3): Vec3 =>
  subtract(value, scale(normal, dot(value, normal)));

/**
 * Resolve a stable orthonormal frame from canonical plane directions.
 * Directions are unitless; all point/distance quantities remain in mm.
 */
export const deriveOrthonormalPlaneBasis = (
  normalInput: Vec3,
  primaryInput: Vec3,
  secondaryInput: Vec3,
): OrthonormalPlaneBasis | null => {
  if (![normalInput, primaryInput, secondaryInput].every(isFiniteVec3)) return null;

  const normal = safeNormalize(normalInput, vec(0, 0, 0));
  if (magnitude(normal) <= EPSILON_MM) return null;

  const projectedPrimary = projectOntoPlane(primaryInput, normal);
  const projectedSecondary = projectOntoPlane(secondaryInput, normal);
  const x = safeNormalize(
    magnitude(projectedPrimary) > EPSILON_MM ? projectedPrimary : projectedSecondary,
    vec(0, 0, 0),
  );
  if (magnitude(x) <= EPSILON_MM) return null;

  let y = safeNormalize(cross(normal, x), vec(0, 0, 0));
  if (magnitude(y) > EPSILON_MM && dot(y, secondaryInput) < 0) y = scale(y, -1);
  if (magnitude(y) <= EPSILON_MM) return null;

  return { x, y, normal };
};

const intersectRayPlane = (
  rayOrigin: Vec3,
  rayDirection: Vec3,
  plane: Plane,
): Vec3 | null => {
  const denominator = dot(rayDirection, plane.normal);
  if (!Number.isFinite(denominator) || Math.abs(denominator) <= EPSILON_SQUARED) {
    return null;
  }
  const distance = dot(subtract(plane.point, rayOrigin), plane.normal) / denominator;
  if (!Number.isFinite(distance) || distance <= EPSILON_SQUARED) return null;
  const point = add(rayOrigin, scale(rayDirection, distance));
  return isFiniteVec3(point) ? point : null;
};

const wrapOrientationRad = (angle: number): number => {
  if (!Number.isFinite(angle)) return 0;
  const wrapped = angle % PI;
  return wrapped < 0 ? wrapped + PI : wrapped;
};

const edgeIntersection = ({
  aperturePoint,
  imageDirection,
  filmPlane,
}: {
  aperturePoint: Vec3;
  imageDirection: Vec3;
  filmPlane: Plane;
}): Vec3 | null => {
  return intersectRayPlane(aperturePoint, imageDirection, filmPlane);
};

/**
 * Computes a local affine projection of a circular aperture onto an oriented
 * film plane. The exact projection is projective; symmetric +/- aperture
 * edge intersections provide the first-order ellipse used by the renderer.
 *
 * All points, plane distances, focal length, and returned radii are in mm.
 * The aperture remains circular; anisotropy is caused only by lens/film
 * geometry. Invalid geometry fails closed to a neutral unresolved footprint.
 */
export const computePhysicalBlurFootprint = (
  input: PhysicalBlurFootprintInput,
): PhysicalBlurFootprint => {
  const {
    objectPoint,
    lensCenter,
    lensPlaneNormal: lensNormalInput,
    lensPlaneBasisX: lensBasisXInput,
    lensPlaneBasisY: lensBasisYInput,
    filmPlane,
    filmPlaneBasisX: filmBasisXInput,
    filmPlaneBasisY: filmBasisYInput,
    focalLengthMm,
    apertureFNumber,
  } = input;

  if (
    ![objectPoint, lensCenter, filmPlane.point, filmPlane.normal].every(isFiniteVec3) ||
    ![lensNormalInput, lensBasisXInput, lensBasisYInput, filmBasisXInput, filmBasisYInput].every(
      isFiniteVec3,
    ) ||
    !Number.isFinite(focalLengthMm) ||
    focalLengthMm <= 0 ||
    !Number.isFinite(apertureFNumber) ||
    apertureFNumber <= 0
  ) {
    return neutralFootprint();
  }

  const lensBasis = deriveOrthonormalPlaneBasis(
    lensNormalInput,
    lensBasisXInput,
    lensBasisYInput,
  );
  const filmBasis = deriveOrthonormalPlaneBasis(
    filmPlane.normal,
    filmBasisXInput,
    filmBasisYInput,
  );
  if (!lensBasis || !filmBasis) return neutralFootprint();

  const objectDelta = subtract(objectPoint, lensCenter);
  const objectDistanceMm = dot(objectDelta, lensBasis.normal);
  if (!Number.isFinite(objectDistanceMm) || objectDistanceMm <= EPSILON_MM) {
    return neutralFootprint();
  }

  const lateralObjectOffset = subtract(
    objectDelta,
    scale(lensBasis.normal, objectDistanceMm),
  );
  const apertureRadiusMm = focalLengthMm / (2 * apertureFNumber);
  if (!Number.isFinite(apertureRadiusMm) || apertureRadiusMm <= 0) {
    return neutralFootprint();
  }

  const idealImageDistanceMm = imageDistanceMm(focalLengthMm, objectDistanceMm);
  const imagePointIsFinite = Number.isFinite(idealImageDistanceMm);
  if (!imagePointIsFinite && idealImageDistanceMm !== Number.POSITIVE_INFINITY) {
    return neutralFootprint();
  }

  let imagePoint = vec(0, 0, 0);
  let imageDirection: Vec3;
  let signedSide = -1;
  if (imagePointIsFinite) {
    if (Math.abs(idealImageDistanceMm) <= EPSILON_MM) return neutralFootprint();
    imagePoint = add(
      subtract(lensCenter, scale(lensBasis.normal, idealImageDistanceMm)),
      scale(lateralObjectOffset, -(idealImageDistanceMm / objectDistanceMm)),
    );
    imageDirection = subtract(imagePoint, lensCenter);
    if (idealImageDistanceMm < 0) imageDirection = scale(imageDirection, -1);

    const imagePlaneDeltaMm = dot(
      subtract(imagePoint, filmPlane.point),
      filmBasis.normal,
    );
    if (!Number.isFinite(imagePlaneDeltaMm)) return neutralFootprint();
    if (Math.abs(imagePlaneDeltaMm) > EPSILON_MM) signedSide = imagePlaneDeltaMm < 0 ? -1 : 1;
    else signedSide = 0;
  } else {
    // At U = f the ideal image is at infinity. The outgoing rays are
    // parallel; their direction is the focal-plane image direction.
    imageDirection = safeNormalize(
      scale(
        add(scale(lensBasis.normal, -1), scale(lateralObjectOffset, -1 / objectDistanceMm)),
        1,
      ),
      vec(0, 0, -1),
    );
    signedSide = -1;
  }
  if (magnitude(imageDirection) <= EPSILON_MM) return neutralFootprint();

  const centreFilmPoint = edgeIntersection({
    aperturePoint: lensCenter,
    imageDirection,
    filmPlane,
  });
  if (!centreFilmPoint) return neutralFootprint();

  // The symmetric +/- aperture-edge construction has a closed-form first
  // derivative at the aperture centre. It is the same local affine map, but
  // avoids four redundant ray/plane intersections in the full-resolution
  // shader while keeping the CPU reference and GPU contract identical.
  const filmDelta = subtract(filmPlane.point, lensCenter);
  const mapApertureOffset = (apertureOffset: Vec3): Vec3 | null => {
    if (!imagePointIsFinite) {
      const denominator = dot(imageDirection, filmBasis.normal);
      if (!Number.isFinite(denominator) || Math.abs(denominator) <= EPSILON_SQUARED) {
        return null;
      }
      return subtract(
        apertureOffset,
        scale(imageDirection, dot(apertureOffset, filmBasis.normal) / denominator),
      );
    }

    const imageVector = subtract(imagePoint, lensCenter);
    const denominator = dot(imageVector, filmBasis.normal);
    if (!Number.isFinite(denominator) || Math.abs(denominator) <= EPSILON_SQUARED) {
      return null;
    }
    const rayParameter = dot(filmDelta, filmBasis.normal) / denominator;
    if (!Number.isFinite(rayParameter)) return null;
    return scale(
      subtract(
        apertureOffset,
        scale(imageVector, dot(apertureOffset, filmBasis.normal) / denominator),
      ),
      1 - rayParameter,
    );
  };

  const mappedX = mapApertureOffset(scale(lensBasis.x, apertureRadiusMm));
  const mappedY = mapApertureOffset(scale(lensBasis.y, apertureRadiusMm));
  if (!mappedX || !mappedY) return neutralFootprint();

  const matrix00 = dot(mappedX, filmBasis.x);
  const matrix10 = dot(mappedX, filmBasis.y);
  const matrix01 = dot(mappedY, filmBasis.x);
  const matrix11 = dot(mappedY, filmBasis.y);
  if (![matrix00, matrix01, matrix10, matrix11].every(Number.isFinite)) {
    return neutralFootprint();
  }

  // The singular values of the 2x2 local mapping are the ellipse radii.
  const covariance00 = matrix00 * matrix00 + matrix01 * matrix01;
  const covariance01 = matrix00 * matrix10 + matrix01 * matrix11;
  const covariance11 = matrix10 * matrix10 + matrix11 * matrix11;
  const traceHalf = (covariance00 + covariance11) / 2;
  const discriminant = Math.hypot(
    (covariance00 - covariance11) / 2,
    covariance01,
  );
  const majorRadiusMm = Math.sqrt(Math.max(0, traceHalf + discriminant));
  const minorRadiusMm = Math.sqrt(Math.max(0, traceHalf - discriminant));
  if (!Number.isFinite(majorRadiusMm) || !Number.isFinite(minorRadiusMm)) {
    return neutralFootprint();
  }

  const orientationRad =
    majorRadiusMm - minorRadiusMm > EPSILON_MM
      ? wrapOrientationRad(0.5 * Math.atan2(2 * covariance01, covariance00 - covariance11))
      : 0;
  const signedCoCDiameterMm =
    signedSide * 2 * Math.sqrt(Math.max(0, majorRadiusMm * minorRadiusMm));

  return {
    valid: true,
    signedCoCDiameterMm: Number.isFinite(signedCoCDiameterMm) ? signedCoCDiameterMm : 0,
    majorRadiusMm,
    minorRadiusMm,
    orientationRad,
  };
};
