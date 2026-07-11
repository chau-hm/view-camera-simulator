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

// Sample a ray against focus/near/far planes. nearPlane may be null (no near) and farPlane may be null (infinite).
export function sampleDofWedge(
  ray: Ray,
  focusPlane: Plane | null,
  nearPlane: Plane | null,
  farPlane: Plane | null,
): DofWedgeSample {
  // distance along ray to target point (we assume callers compute this separately as needed)
  // But here, the ray origin is lens center; if caller passes a ray constructed through target, we can project
  // The ray does not carry a target point; compute distances to plane intersections instead.

  // Intersections
  const focusHit = focusPlane ? intersectRayPlane(ray, focusPlane) : null;
  const nearHit = nearPlane ? intersectRayPlane(ray, nearPlane) : null;
  const farHit = farPlane ? intersectRayPlane(ray, farPlane) : null;

  // targetDistanceMm: intersect ray with focus or use near/far as fallbacks
  // For a ray built through a target, the caller should compute targetDistance separately. To keep parity, we expect
  // callers to compute targetDistance and pass as part of ray origin->target projection. Here, use focusHit distance if present
  const focusDistance = focusHit ? focusHit.distance : null;
  const nearDistance = nearHit ? nearHit.distance : null;
  const farDistance = farHit ? farHit.distance : null;

  // We cannot know the actual targetDistance here — caller should compute it. To preserve utility, set targetDistance to 0
  // and let callers override. Consumers should call computeDofDefocusWithTargetDistance instead.
  return {
    targetDistanceMm: 0,
    nearDistanceMm: nearDistance,
    focusDistanceMm: focusDistance,
    farDistanceMm: farDistance,
    insideDepthOfField: false,
    normalizedDefocus: Number.POSITIVE_INFINITY,
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

  // prefer to treat null nearDistance as extremely small nearDistance
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
    // beyond far (if far infinite then this is false)
    if (!isFinite(f)) {
      // open far, treat as inside wedge beyond focus
      const denom = Math.max(
        EPS,
        f === Number.POSITIVE_INFINITY ? focusDistance - n : f - focusDistance,
      );
      normalizedDefocus = Math.abs(t - focusDistance) / denom;
      inside = normalizedDefocus <= 1;
    } else {
      const denom = Math.max(EPS, f - focusDistance);
      normalizedDefocus = 1 + (t - f) / denom;
      inside = false;
    }
  } else {
    // between near and far
    const denom =
      t <= focusDistance ? Math.max(EPS, focusDistance - n) : Math.max(EPS, f - focusDistance);
    normalizedDefocus = Math.abs(t - focusDistance) / denom;
    inside = normalizedDefocus <= 1;
  }

  return { insideDepthOfField: inside, normalizedDefocus };
}
