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
  // If focusDistance is missing, cannot compute; return soft
  if (focusDistance === null) {
    return { insideDepthOfField: false, normalizedDefocus: Number.POSITIVE_INFINITY };
  }

  // prefer to treat null nearDistance as very close to focusDistance
  const n = nearDistance ?? focusDistance - EPS;
  const f = farDistance ?? Number.POSITIVE_INFINITY;
  const t = targetDistance;

  let normalizedDefocus: number;
  let inside = false;

  if (t < n) {
    // before near
    const denom = Math.max(EPS, focusDistance - n);
    normalizedDefocus = 1 + (n - t) / denom;
    inside = false;
  } else if (t > f) {
    // beyond far
    if (!isFinite(f)) {
      // open far: normalized by focusDistance - nearDistance
      const denom = Math.max(EPS, focusDistance - n);
      normalizedDefocus = Math.abs(t - focusDistance) / denom;
      inside = t >= n; // inside if beyond near
    } else {
      const denom = Math.max(EPS, f - focusDistance);
      normalizedDefocus = 1 + (t - f) / denom;
      inside = false;
    }
  } else {
    // between near and far
    const denom = t <= focusDistance ? Math.max(EPS, focusDistance - n) : Math.max(EPS, f - focusDistance);
    normalizedDefocus = Math.abs(t - focusDistance) / denom;
    inside = normalizedDefocus <= 1;
  }

  return { insideDepthOfField: inside, normalizedDefocus };
}
