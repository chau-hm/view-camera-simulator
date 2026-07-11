import type { Plane, Ray } from "../../types/optics";
import { intersectRayPlane } from "../math/ray";

const EPS = 1e-6;

export type DofWedgeSample = {
  targetDistanceMm: number;
  nearDistanceMm: number | null;
  focusDistanceMm: number | null;
  farDistanceMm: number | null;
  insideDepthOfField: boolean;
  normalizedDefocus: number;
};

export type DofWedgeSampleInput = {
  ray: Ray;
  targetDistanceMm: number;
  nearPlane: Plane | null;
  focusPlane: Plane | null;
  farPlane: Plane | null;
};

// Sample a ray against focus/near/far planes. Supports finite and infinite far plane.
export function sampleDofWedge(input: DofWedgeSampleInput): DofWedgeSample {
  const { ray, targetDistanceMm, nearPlane, focusPlane, farPlane } = input;

  // Intersections
  const focusHit = focusPlane ? intersectRayPlane(ray, focusPlane) : null;
  const nearHit = nearPlane ? intersectRayPlane(ray, nearPlane) : null;
  const farHit = farPlane ? intersectRayPlane(ray, farPlane) : null;

  const focusDistance = focusHit ? focusHit.distance : null;
  const nearDistance = nearHit ? nearHit.distance : null;
  const farDistance = farHit ? farHit.distance : null;

  // Compute normalized defocus using shared helper logic below
  const { insideDepthOfField, normalizedDefocus } = calculateDofWedgeDefocus(
    targetDistanceMm,
    nearDistance,
    focusDistance,
    farDistance,
  );

  return {
    targetDistanceMm,
    nearDistanceMm: nearDistance,
    focusDistanceMm: focusDistance,
    farDistanceMm: farDistance,
    insideDepthOfField,
    normalizedDefocus,
  };
}

export function calculateDofWedgeDefocus(
  targetDistance: number,
  nearDistance: number | null,
  focusDistance: number | null,
  farDistance: number | null,
): { insideDepthOfField: boolean; normalizedDefocus: number } {
  // If focusDistance is missing, cannot compute; return a safe non-finite result
  if (focusDistance === null) {
    return { insideDepthOfField: false, normalizedDefocus: Number.NaN };
  }

  // Normalize inputs
  const n = nearDistance ?? (focusDistance - EPS);
  const hasFiniteFar = farDistance !== null && Number.isFinite(farDistance);
  const f = hasFiniteFar ? (farDistance as number) : null;
  const t = targetDistance;

  // Use explicit interval ordering to avoid comparisons with Infinity
  // 1) before near
  // 2) near..focus
  // 3) beyond focus with infinite far
  // 4) focus..finite far
  // 5) beyond finite far

  let normalizedDefocus = 0;
  let inside = false;

  if (t < n) {
    // before near
    const denom = Math.max(EPS, focusDistance - n);
    normalizedDefocus = 1 + (n - t) / denom;
    inside = false;
  } else if (t <= focusDistance) {
    // between near and focus (inclusive of focus)
    const denom = Math.max(EPS, focusDistance - n);
    normalizedDefocus = (focusDistance - t) / denom;
    inside = normalizedDefocus <= 1;
  } else if (!hasFiniteFar) {
    // beyond focus with open-ended far
    const denom = Math.max(EPS, focusDistance - n);
    normalizedDefocus = (t - focusDistance) / denom;
    // insideDepthOfField for open far: any point >= near is considered inside the open-ended DOF region
    inside = t >= n;
  } else if (t <= (f as number)) {
    // between focus and finite far
    const denom = Math.max(EPS, (f as number) - focusDistance);
    normalizedDefocus = (t - focusDistance) / denom;
    inside = normalizedDefocus <= 1;
  } else {
    // beyond finite far
    const denom = Math.max(EPS, (f as number) - focusDistance);
    normalizedDefocus = 1 + (t - (f as number)) / denom;
    inside = false;
  }

  // Ensure numeric safety
  if (!Number.isFinite(normalizedDefocus) || Number.isNaN(normalizedDefocus)) normalizedDefocus = Number.POSITIVE_INFINITY;

  return { insideDepthOfField: Boolean(inside), normalizedDefocus };
}
