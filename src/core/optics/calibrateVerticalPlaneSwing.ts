// Generic finite-focus calibration for a vertical subject plane.
// Every distance and position is expressed in millimetres.

import { planeFromPointNormal } from "../math/plane";
import {
  distance,
  dot,
  isFiniteVec3,
  rotateAroundY,
  subtract,
  vec,
} from "../math/vec";
import { imageDistanceMm } from "./thinLensModel";
import type { Line3, Plane, Ray, Vec3 } from "../../types/optics";

export type VerticalPlaneSwingCalibrationInput = {
  focalLengthMm: number;
  focusProbes: readonly [Vec3, Vec3, Vec3];
  collinearityEpsilonMm?: number;
};

export type VerticalPlaneSwingCalibrationResult = {
  subjectPlane: Plane & {
    topViewTrace: {
      xPerZ: number;
      xInterceptMm: number;
    };
  };
  hingeLine: Line3;
  frontSwingDeg: number;
  opticalAxis: Ray;
  opticalAxisIntersection: Vec3;
  focusDistanceMm: number;
  filmDistanceMm: number;
  collinearityErrorMm: number;
};

const radiansToDegrees = (radians: number): number => (radians * 180) / Math.PI;

const requireFinitePoint = (point: Vec3, label: string): void => {
  if (!isFiniteVec3(point)) {
    throw new Error(`Vertical-plane Swing calibration requires a finite ${label} focus probe`);
  }
};

/**
 * Derive the signed Front Swing solution for three probes on one vertical
 * subject plane. The rear-standard finite-focus contract places the film at
 * the Z coordinate of the on-axis ideal image point, F = v*cos(theta).
 */
export const calibrateVerticalPlaneSwing = ({
  focalLengthMm,
  focusProbes,
  collinearityEpsilonMm = 1e-6,
}: VerticalPlaneSwingCalibrationInput): VerticalPlaneSwingCalibrationResult => {
  if (!Number.isFinite(focalLengthMm) || focalLengthMm <= 0) {
    throw new Error("Vertical-plane Swing calibration requires a positive finite focal length");
  }
  if (!Number.isFinite(collinearityEpsilonMm) || collinearityEpsilonMm <= 0) {
    throw new Error("Vertical-plane Swing calibration requires a positive finite collinearity epsilon");
  }

  const [front, middle, back] = focusProbes;
  requireFinitePoint(front, "front");
  requireFinitePoint(middle, "middle");
  requireFinitePoint(back, "back");

  if (
    distance(front, middle) <= collinearityEpsilonMm ||
    distance(middle, back) <= collinearityEpsilonMm ||
    distance(front, back) <= collinearityEpsilonMm
  ) {
    throw new Error("Vertical-plane Swing calibration focus probes must not coincide");
  }

  const sharedYErrorMm = Math.max(Math.abs(middle.y - front.y), Math.abs(back.y - front.y));
  if (sharedYErrorMm > collinearityEpsilonMm) {
    throw new Error("Vertical-plane Swing calibration focus probes must define a vertical subject plane");
  }

  const trace = subtract(back, front);
  const traceLengthTopView = Math.hypot(trace.x, trace.z);
  if (!Number.isFinite(traceLengthTopView) || traceLengthTopView <= collinearityEpsilonMm) {
    throw new Error("Vertical-plane Swing calibration requires a finite top-view subject trace");
  }
  const middleOffset = subtract(middle, front);
  const crossTopView = middleOffset.x * trace.z - middleOffset.z * trace.x;
  const collinearityErrorMm = Math.abs(crossTopView) / traceLengthTopView;
  if (collinearityErrorMm > collinearityEpsilonMm) {
    throw new Error(
      `Vertical-plane Swing calibration focus probes are not collinear (${collinearityErrorMm} mm error)`,
    );
  }
  if (Math.abs(trace.z) <= collinearityEpsilonMm) {
    throw new Error("Vertical-plane Swing calibration requires a subject trace with finite Z extent");
  }

  const xPerZ = trace.x / trace.z;
  const xInterceptMm = front.x - xPerZ * front.z;
  if (Math.abs(xInterceptMm) <= focalLengthMm + collinearityEpsilonMm) {
    throw new Error("Vertical-plane Swing calibration has no finite rear-standard swing solution");
  }

  const swingTangent =
    Math.sign(xInterceptMm) *
    focalLengthMm /
      Math.sqrt(Math.max(0, xInterceptMm * xInterceptMm - focalLengthMm * focalLengthMm));
  const frontSwingRad = Math.atan(swingTangent);
  const frontSwingDeg = radiansToDegrees(frontSwingRad);
  if (!Number.isFinite(frontSwingDeg) || Math.abs(frontSwingDeg) <= 1e-9) {
    throw new Error("Vertical-plane Swing calibration produced an invalid zero swing solution");
  }

  const subjectNormalLength = Math.hypot(trace.x, trace.z);
  const subjectNormal = vec(trace.z / subjectNormalLength, 0, -trace.x / subjectNormalLength);
  const subjectPlane = planeFromPointNormal(front, subjectNormal);
  const opticalAxisDirection = rotateAroundY(vec(0, 0, 1), frontSwingDeg);
  const axisPlaneDenominator = dot(subjectPlane.normal, opticalAxisDirection);
  if (!Number.isFinite(axisPlaneDenominator) || Math.abs(axisPlaneDenominator) <= 1e-12) {
    throw new Error("Vertical-plane Swing calibration optical axis does not intersect the subject plane");
  }
  const focusDistanceMm = subjectPlane.distance / axisPlaneDenominator;
  if (!Number.isFinite(focusDistanceMm) || focusDistanceMm <= 0) {
    throw new Error("Vertical-plane Swing calibration has no positive optical-axis intersection");
  }
  const opticalAxisIntersection = vec(
    opticalAxisDirection.x * focusDistanceMm,
    opticalAxisDirection.y * focusDistanceMm,
    opticalAxisDirection.z * focusDistanceMm,
  );
  if (!isFiniteVec3(opticalAxisIntersection)) {
    throw new Error("Vertical-plane Swing calibration produced a non-finite optical-axis intersection");
  }

  const idealImageDistanceMm = imageDistanceMm(focalLengthMm, focusDistanceMm);
  const filmDistanceMm = idealImageDistanceMm * opticalAxisDirection.z;
  const hingeX = filmDistanceMm / Math.tan(frontSwingRad);
  if (
    !Number.isFinite(idealImageDistanceMm) ||
    !Number.isFinite(filmDistanceMm) ||
    filmDistanceMm <= 0 ||
    !Number.isFinite(hingeX) ||
    Math.abs(hingeX) <= collinearityEpsilonMm
  ) {
    throw new Error("Vertical-plane Swing calibration produced an invalid lens/film hinge position");
  }

  return {
    subjectPlane: {
      point: { ...subjectPlane.point },
      normal: { ...subjectPlane.normal },
      distance: subjectPlane.distance,
      topViewTrace: { xPerZ, xInterceptMm },
    },
    hingeLine: {
      point: { x: hingeX, y: 0, z: -filmDistanceMm },
      direction: { x: 0, y: 1, z: 0 },
    },
    frontSwingDeg,
    opticalAxis: {
      origin: { x: 0, y: 0, z: 0 },
      direction: opticalAxisDirection,
    },
    opticalAxisIntersection,
    focusDistanceMm,
    filmDistanceMm,
    collinearityErrorMm,
  };
};
