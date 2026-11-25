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

export type GroundGlassPhysicalFocalBranch =
  | "finite-virtual"
  | "parallel-limit"
  | "finite-real"
  | "unresolved";

/** Confidence is deliberately scoped to one independently reference-backed probe. */
export type GroundGlassPhysicalDepthConfidence =
  | Readonly<{
      status: "not-assessed";
      scope: "probe-only";
      reason: "no-independent-reference" | "controlled-object-point" | "clear-depth" | "invalid-evidence";
    }>
  | Readonly<{
      status: "resolved" | "depth-limited";
      scope: "probe-only";
      evidence: "paired-analytic-surface-reference";
      surfaceId: string;
      canonicalObjectDistanceMm: number;
      reconstructedObjectDistanceMm: number;
      canonicalUMinusFmm: number;
      reconstructedUMinusFmm: number;
      signedReconstructionErrorMm: number;
      absoluteReconstructionErrorMm: number;
      observedUMinusFIntervalMm: readonly [number, number];
      canonicalExpectedBranch: GroundGlassPhysicalFocalBranch;
      reconstructedBranch: GroundGlassPhysicalFocalBranch;
      kernelSelectedBranch: GroundGlassPhysicalFocalBranch;
    }>;

const focalBranchForUMinusF = (value: number): GroundGlassPhysicalFocalBranch =>
  value < 0 ? "finite-virtual" : value > 0 ? "finite-real" : "parallel-limit";

const focalBranchForKernelCode = (value: number): GroundGlassPhysicalFocalBranch => {
  switch (Math.round(value)) {
    case 1: return "finite-virtual";
    case 2: return "parallel-limit";
    case 3: return "finite-real";
    default: return "unresolved";
  }
};

/**
 * Assess only a single paired analytic-surface probe. The observed interval is
 * the range between the independently known and depth-reconstructed U-f values;
 * it is not extrapolated to neighboring pixels or the full texture.
 */
export const assessGroundGlassPhysicalDepthConfidence = (input: Readonly<{
  expectedWorldM: readonly [number, number, number] | null;
  reconstructedWorldM: readonly [number, number, number];
  expectedSurfaceId: string | null;
  lensCenterWorldM: readonly [number, number, number];
  lensNormal: readonly [number, number, number];
  focalLengthMm: number;
  sampledDepth: number;
  controlledObjectPoint: boolean;
  kernelBranchCode: number;
}>): GroundGlassPhysicalDepthConfidence => {
  const notAssessed = (
    reason: Extract<GroundGlassPhysicalDepthConfidence, { status: "not-assessed" }>['reason'],
  ): GroundGlassPhysicalDepthConfidence => ({ status: "not-assessed", scope: "probe-only", reason });
  if (input.controlledObjectPoint) return notAssessed("controlled-object-point");
  if (input.sampledDepth === 1) return notAssessed("clear-depth");
  if (!input.expectedWorldM || !input.expectedSurfaceId?.trim()) {
    return notAssessed("no-independent-reference");
  }
  const values = [
    ...input.expectedWorldM,
    ...input.reconstructedWorldM,
    ...input.lensCenterWorldM,
    ...input.lensNormal,
    input.focalLengthMm,
    input.sampledDepth,
    input.kernelBranchCode,
  ];
  if (!values.every(Number.isFinite)) return notAssessed("invalid-evidence");
  const normalLength = Math.hypot(...input.lensNormal);
  if (normalLength <= 1e-12 || input.focalLengthMm <= 0 || input.sampledDepth < 0 || input.sampledDepth >= 1) {
    return notAssessed("invalid-evidence");
  }
  const normal = input.lensNormal.map((component) => component / normalLength);
  const distanceAlongLensNormalMm = (point: readonly [number, number, number]): number =>
    ((point[0] - input.lensCenterWorldM[0]) * normal[0]! +
      (point[1] - input.lensCenterWorldM[1]) * normal[1]! +
      (point[2] - input.lensCenterWorldM[2]) * normal[2]!) * 1000;
  const canonicalObjectDistanceMm = distanceAlongLensNormalMm(input.expectedWorldM);
  const reconstructedObjectDistanceMm = distanceAlongLensNormalMm(input.reconstructedWorldM);
  const canonicalUMinusFmm = canonicalObjectDistanceMm - input.focalLengthMm;
  const reconstructedUMinusFmm = reconstructedObjectDistanceMm - input.focalLengthMm;
  const signedReconstructionErrorMm = reconstructedObjectDistanceMm - canonicalObjectDistanceMm;
  const interval: readonly [number, number] = [
    Math.min(canonicalUMinusFmm, reconstructedUMinusFmm),
    Math.max(canonicalUMinusFmm, reconstructedUMinusFmm),
  ];
  if (![canonicalObjectDistanceMm, reconstructedObjectDistanceMm, ...interval].every(Number.isFinite)) {
    return notAssessed("invalid-evidence");
  }
  const canonicalExpectedBranch = focalBranchForUMinusF(canonicalUMinusFmm);
  const reconstructedBranch = focalBranchForUMinusF(reconstructedUMinusFmm);
  const kernelSelectedBranch = focalBranchForKernelCode(input.kernelBranchCode);
  const crossesOrTouchesFocalBoundary = interval[0] <= 0 && interval[1] >= 0;
  const agreesWithReference = reconstructedBranch === canonicalExpectedBranch &&
    kernelSelectedBranch === canonicalExpectedBranch;
  return {
    status: crossesOrTouchesFocalBoundary || !agreesWithReference ? "depth-limited" : "resolved",
    scope: "probe-only",
    evidence: "paired-analytic-surface-reference",
    surfaceId: input.expectedSurfaceId,
    canonicalObjectDistanceMm,
    reconstructedObjectDistanceMm,
    canonicalUMinusFmm,
    reconstructedUMinusFmm,
    signedReconstructionErrorMm,
    absoluteReconstructionErrorMm: Math.abs(signedReconstructionErrorMm),
    observedUMinusFIntervalMm: interval,
    canonicalExpectedBranch,
    reconstructedBranch,
    kernelSelectedBranch,
  };
};

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
