export const imageDistanceMm = (focalLengthMm: number, focusDistanceMm: number): number => {
  // imageDistance = f * D / (D - f)
  if (focusDistanceMm === focalLengthMm) return Infinity;
  return (focalLengthMm * focusDistanceMm) / (focusDistanceMm - focalLengthMm);
};

// Solve lens extension v (image distance from rear datum to lens center) and
// lens-to-subject distance U for a requested focus plane depth S (rear datum -> subject).
// Equations: 1/f = 1/v + 1/(S - v)  -> quadratic in v: v^2 - S*v + f*S = 0
// Return smaller positive root for v and U = S - v
export const solveLensExtensionForRearDatumFocusDepth = (
  S: number,
  f: number,
): { v: number; U: number } => {
  // quadratic: v = (S ± sqrt(S^2 - 4 f S)) / 2
  const discr = S * S - 4 * f * S;
  if (discr < 0) {
    // numerically invalid — fallback to using thin-lens image distance for U ~ S - f
    const vFallback = Math.max(0, S - f);
    return { v: vFallback, U: Math.max(1e-6, S - vFallback) };
  }
  const sqrtD = Math.sqrt(discr);
  const v1 = (S - sqrtD) / 2;
  const v2 = (S + sqrtD) / 2;
  // choose the smaller positive root
  const v = Math.min(v1, v2);
  const vPos = v > 0 ? v : Math.max(v1, v2);
  const U = S - vPos;
  return { v: vPos, U };
};
export const focusPlaneWidthMm = (
  sensorWidthMm: number,
  focusDistanceMm: number,
  imageDistanceMmVal: number,
): number => {
  return (sensorWidthMm * focusDistanceMm) / imageDistanceMmVal;
};

export const focusPlaneHeightMm = (
  sensorHeightMm: number,
  focusDistanceMm: number,
  imageDistanceMmVal: number,
): number => {
  return (sensorHeightMm * focusDistanceMm) / imageDistanceMmVal;
};

export const projectPointToGroundGlass = (
  point: { x: number; y: number; z: number },
  imageDistanceMmVal: number,
): { xFilm: number; yFilm: number } | null => {
  // Only defined for points in front of the lens (z > 0)
  if (point.z <= 0) return null;
  const xFilm = (-imageDistanceMmVal * point.x) / point.z;
  const yFilm = (-imageDistanceMmVal * point.y) / point.z;
  return { xFilm, yFilm };
};

export type PhysicalCoCDiameterInput = {
  focalLengthMm: number;
  apertureFNumber: number;
  objectDistanceMm: number;
  filmDistanceMm: number;
};

/**
 * Computes the physical circle-of-confusion diameter on a parallel film
 * plane for an ideal thin lens. All distances and the returned diameter are
 * in millimetres; the result is a diameter, not a radius.
 *
 * The object distance is measured from the lens centre on the object side
 * and the film distance from the lens centre on the image side. The ideal
 * image distance V follows 1/f = 1/U + 1/V. Positive U values below f are
 * retained as the thin-lens virtual-image case. At U = f, V is infinite and
 * the limiting CoC is the physical aperture diameter. A positive infinite U
 * is the infinity-focus limit, V = f.
 *
 * Invalid or non-physical numeric inputs return NaN rather than a display
 * fallback or a fabricated physical value.
 */
export const computePhysicalCoCDiameterMm = ({
  focalLengthMm,
  apertureFNumber,
  objectDistanceMm,
  filmDistanceMm,
}: PhysicalCoCDiameterInput): number => {
  const objectDistanceIsInfinity = objectDistanceMm === Number.POSITIVE_INFINITY;
  const hasValidObjectDistance =
    objectDistanceIsInfinity ||
    (Number.isFinite(objectDistanceMm) && objectDistanceMm > 0);

  if (
    !Number.isFinite(focalLengthMm) ||
    focalLengthMm <= 0 ||
    !Number.isFinite(apertureFNumber) ||
    apertureFNumber <= 0 ||
    !Number.isFinite(filmDistanceMm) ||
    filmDistanceMm <= 0 ||
    !hasValidObjectDistance
  ) {
    return NaN;
  }

  const apertureDiameterMm = focalLengthMm / apertureFNumber;
  if (!Number.isFinite(apertureDiameterMm) || apertureDiameterMm <= 0) return NaN;

  // imageDistanceMm intentionally preserves Infinity at U = f. For CoC,
  // F / Infinity is zero, so the physical limiting diameter is the aperture.
  const idealImageDistanceMm = objectDistanceIsInfinity
    ? focalLengthMm
    : imageDistanceMm(focalLengthMm, objectDistanceMm);
  if (idealImageDistanceMm === Number.POSITIVE_INFINITY) return apertureDiameterMm;
  if (!Number.isFinite(idealImageDistanceMm) || idealImageDistanceMm === 0) return NaN;

  const diameterMm =
    apertureDiameterMm * Math.abs(1 - filmDistanceMm / idealImageDistanceMm);
  return Number.isFinite(diameterMm) && diameterMm >= 0 ? diameterMm : NaN;
};

export const cocDiameterMm = (
  focalLengthMm: number,
  apertureFNumber: number,
  filmDistanceMm: number,
  objectDistanceMm: number,
): number => {
  // Preserve the historical infinity sentinel for existing positional
  // callers. The explicit physical kernel uses the finite aperture limit at
  // U = f, but legacy consumers use Infinity to represent this boundary.
  if (objectDistanceMm === focalLengthMm) return Number.POSITIVE_INFINITY;

  // The physical implementation owns the normal-domain equation so the two
  // APIs cannot drift numerically.
  return computePhysicalCoCDiameterMm({
    focalLengthMm,
    apertureFNumber,
    objectDistanceMm,
    filmDistanceMm,
  });
};

export const verticalFovDegreesFromImageDistance = (
  sensorHeightMm: number,
  imageDistanceMmVal: number,
): number => {
  const verticalFovRadians = 2 * Math.atan(sensorHeightMm / (2 * imageDistanceMmVal));
  return (verticalFovRadians * 180) / Math.PI;
};
