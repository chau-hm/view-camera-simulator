import type { Plane, Ray } from "../../types/optics";
import { intersectRayPlane } from "../math/ray";

const EPS = 1e-6;

/**
 * Safe fail-closed value for a ray that cannot be resolved against the
 * derived focus wedge. One is the CoC boundary: it is finite and bounded,
 * and it reports the sample as outside the useful depth-of-field interval
 * without inventing a larger-than-physical blur value.
 */
export const SAFE_UNRESOLVED_NORMALIZED_DEFOCUS = 1;

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

export type DofWedgeBoundaryOptions = {
  /** True when a plane was supplied and its forward intersection is required. */
  nearBoundaryPresent?: boolean;
  /** True when a finite far plane was supplied and its forward intersection is required. */
  farBoundaryPresent?: boolean;
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
    {
      nearBoundaryPresent: nearPlane !== null,
      // A far plane that has no forward intersection is an open-ended ray
      // interval, not a reversed finite boundary. This preserves the
      // finite/infinite far contract on a per-ray basis.
      farBoundaryPresent: farDistance !== null,
    },
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
  options: DofWedgeBoundaryOptions = {},
): { insideDepthOfField: boolean; normalizedDefocus: number } {
  const unresolved = {
    insideDepthOfField: false,
    normalizedDefocus: SAFE_UNRESOLVED_NORMALIZED_DEFOCUS,
  };
  const nearBoundaryPresent = options.nearBoundaryPresent ?? nearDistance !== null;
  // Positive infinity is the explicit open-ended-far representation used by
  // the optical model. Only finite far distances participate in ordering.
  const farBoundaryPresent =
    options.farBoundaryPresent ?? (farDistance !== null && Number.isFinite(farDistance));

  // A missing forward intersection is an unresolved ray, not an infinite
  // defocus value. In particular, using a target distance as a replacement
  // for a missing focus intersection can reverse the interval and create a
  // near-zero denominator (the source of the excessive-blur regression).
  if (
    !Number.isFinite(targetDistance) ||
    targetDistance <= 0 ||
    focusDistance === null ||
    !Number.isFinite(focusDistance) ||
    focusDistance <= 0 ||
    (nearBoundaryPresent && (nearDistance === null || !Number.isFinite(nearDistance))) ||
    (farDistance !== null &&
      farDistance !== Number.POSITIVE_INFINITY &&
      !Number.isFinite(farDistance)) ||
    (farBoundaryPresent && (farDistance === null || !Number.isFinite(farDistance)))
  ) {
    return unresolved;
  }

  // Normalize inputs
  const n = nearDistance ?? (focusDistance - EPS);
  const hasFiniteFar = farBoundaryPresent && farDistance !== null && Number.isFinite(farDistance);
  const f = hasFiniteFar ? (farDistance as number) : null;
  const t = targetDistance;

  // The wedge is only meaningful when its boundaries are ordered along the
  // forward ray. Do not replace a reversed/degenerate interval with a tiny
  // epsilon denominator; return the finite boundary fallback instead.
  if (
    !Number.isFinite(n) ||
    n <= 0 ||
    focusDistance - n <= EPS ||
    (hasFiniteFar && (!(f as number > 0) || (f as number) - focusDistance <= EPS))
  ) {
    return unresolved;
  }

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

  // Ensure numeric safety. A finite boundary fallback keeps all downstream
  // diagnostics and blur calculations defined when a valid camera state
  // produces a ray that does not meet one of the derived planes in front of
  // the lens.
  if (!Number.isFinite(normalizedDefocus) || normalizedDefocus < 0) return unresolved;

  return { insideDepthOfField: Boolean(inside), normalizedDefocus };
}
