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

export const cocDiameterMm = (
  focalLengthMm: number,
  apertureFNumber: number,
  imageDistanceMmVal: number,
  objectDistanceMm: number,
): number => {
  // vObject = f * U / (U - f)
  if (objectDistanceMm === focalLengthMm) return Infinity;
  const vObject = (focalLengthMm * objectDistanceMm) / (objectDistanceMm - focalLengthMm);
  const apertureDiameterMm = focalLengthMm / apertureFNumber;
  return apertureDiameterMm * Math.abs(1 - imageDistanceMmVal / vObject);
};

export const verticalFovDegreesFromImageDistance = (
  sensorHeightMm: number,
  imageDistanceMmVal: number,
): number => {
  const verticalFovRadians = 2 * Math.atan(sensorHeightMm / (2 * imageDistanceMmVal));
  return (verticalFovRadians * 180) / Math.PI;
};
