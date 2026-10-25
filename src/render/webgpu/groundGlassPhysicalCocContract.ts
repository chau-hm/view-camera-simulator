export const GROUND_GLASS_PHYSICAL_COC_VALIDITY = {
  noDepth: 0,
  valid: 1,
  outsideBinary16Range: 2,
  invalidGeometry: 3,
  unresolvedFocalBoundary: 4,
} as const;

export const GROUND_GLASS_PHYSICAL_COC_MAX_BINARY16 = 65504;
const PI = Math.PI;

export type GroundGlassPhysicalCocValidityCode =
  (typeof GROUND_GLASS_PHYSICAL_COC_VALIDITY)[keyof typeof GROUND_GLASS_PHYSICAL_COC_VALIDITY];

/** The ellipse angle is an unoriented line, so its storage period is pi. */
export const encodeGroundGlassPhysicalCocOrientation = (orientationRad: number): number | null => {
  if (!Number.isFinite(orientationRad)) return null;
  const wrapped = ((orientationRad % PI) + PI) % PI;
  return wrapped / PI;
};

export const decodeGroundGlassPhysicalCocOrientation = (storedOrientation: number): number | null =>
  Number.isFinite(storedOrientation) && storedOrientation >= 0 && storedOrientation <= 1
    ? storedOrientation * PI
    : null;

export const groundGlassPhysicalCocOrientationErrorModuloPi = (
  leftRad: number,
  rightRad: number,
): number | null => {
  if (!Number.isFinite(leftRad) || !Number.isFinite(rightRad)) return null;
  const difference = Math.abs((((leftRad - rightRad) % PI) + PI) % PI);
  return Math.min(difference, PI - difference);
};

/** Binary16 is a storage limit, not a value to clamp against. */
export const isGroundGlassPhysicalCocRepresentable = (
  signedCoCDiameterMm: number,
  majorRadiusMm: number,
  minorRadiusMm: number,
): boolean =>
  [signedCoCDiameterMm, majorRadiusMm, minorRadiusMm].every(
    (value) => Number.isFinite(value) && Math.abs(value) <= GROUND_GLASS_PHYSICAL_COC_MAX_BINARY16,
  ) &&
  majorRadiusMm >= minorRadiusMm &&
  minorRadiusMm >= 0;
