import {
  M_INV8_REQUIRED_TRIAL_CHECKS,
  type MInv8Backend,
  type MInv8TrialCheck,
} from "./anatomyBellowsCompositingQualification";

export type MInv9Condition = "O0" | "O1" | "O2";
export type MInv9TrialCheck =
  | MInv8TrialCheck
  | "requestedOpacityMatches"
  | "effectiveOpacityMatches"
  | "opacityOnlyStateQualified"
  | "nativePipelineBlendQualified"
  | "nativeOpacityPathResponseQualified"
  | "outputGraphIdentityQualified"
  | "groundGlassStable";

export const M_INV9_REQUIRED_TRIAL_CHECKS = [
  ...M_INV8_REQUIRED_TRIAL_CHECKS,
  "requestedOpacityMatches",
  "effectiveOpacityMatches",
  "opacityOnlyStateQualified",
  "nativePipelineBlendQualified",
  "nativeOpacityPathResponseQualified",
  "outputGraphIdentityQualified",
  "groundGlassStable",
] as const satisfies readonly MInv9TrialCheck[];

export type MInv9TrialQualification = Readonly<{
  backend: MInv8Backend;
  condition: MInv9Condition;
  requestedOpacity: number;
  qualified: boolean;
  checks: Readonly<Record<MInv9TrialCheck, boolean>>;
  failedChecks: readonly MInv9TrialCheck[];
}>;

export const M_INV9_REQUIRED_MATRIX_CHECKS = [
  "nativeAdapterAvailable",
  "historicalBaselineReproduced",
  "baselineRepeatabilityQualified",
  "completeO0O1O2TrialSet",
  "allTrialsQualified",
  "fixedRoisCompatible",
  "positiveControlResponsesQualified",
  "allRestorationsQualified",
  "groundGlassStable",
  "runtimeHealthy",
] as const;

export type MInv9MatrixCheck = typeof M_INV9_REQUIRED_MATRIX_CHECKS[number];
export type MInv9MatrixQualification = Readonly<{
  qualified: boolean;
  checks: Readonly<Record<MInv9MatrixCheck, boolean>>;
  failedChecks: readonly MInv9MatrixCheck[];
}>;

export const qualifyMInv9Trial = (
  backend: MInv8Backend,
  condition: MInv9Condition,
  requestedOpacity: number,
  checks: Partial<Readonly<Record<MInv9TrialCheck, boolean>>>,
): MInv9TrialQualification => {
  const complete = Object.fromEntries(M_INV9_REQUIRED_TRIAL_CHECKS.map((name) => [name, checks[name] === true])) as Record<MInv9TrialCheck, boolean>;
  const failedChecks = M_INV9_REQUIRED_TRIAL_CHECKS.filter((name) => !complete[name]);
  return {
    backend,
    condition,
    requestedOpacity,
    qualified: failedChecks.length === 0,
    checks: complete,
    failedChecks,
  };
};

export const qualifyMInv9Matrix = (input: Readonly<{
  trials: readonly MInv9TrialQualification[];
  nativeAdapterAvailable: boolean;
  historicalBaselineReproduced: boolean;
  baselineRepeatabilityQualified: boolean;
  fixedRoisCompatible: boolean;
  positiveControlResponsesQualified: boolean;
  allRestorationsQualified: boolean;
  groundGlassStable: boolean;
  runtimeHealthy: boolean;
}>): MInv9MatrixQualification => {
  const expectedTrials = ( ["webgl", "native"] as const).flatMap((backend) =>
    (["O0", "O1", "O2"] as const).map((condition) => `${backend}:${condition}`),
  );
  const seenTrials = new Set(input.trials.map(({ backend, condition }) => `${backend}:${condition}`));
  const checks: Record<MInv9MatrixCheck, boolean> = {
    nativeAdapterAvailable: input.nativeAdapterAvailable,
    historicalBaselineReproduced: input.historicalBaselineReproduced,
    baselineRepeatabilityQualified: input.baselineRepeatabilityQualified,
    completeO0O1O2TrialSet: input.trials.length === expectedTrials.length && expectedTrials.every((key) => seenTrials.has(key)),
    allTrialsQualified: input.trials.length === expectedTrials.length && input.trials.every(({ qualified }) => qualified),
    fixedRoisCompatible: input.fixedRoisCompatible,
    positiveControlResponsesQualified: input.positiveControlResponsesQualified,
    allRestorationsQualified: input.allRestorationsQualified,
    groundGlassStable: input.groundGlassStable,
    runtimeHealthy: input.runtimeHealthy,
  };
  const failedChecks = M_INV9_REQUIRED_MATRIX_CHECKS.filter((name) => !checks[name]);
  return { qualified: failedChecks.length === 0, checks, failedChecks };
};

export type MInv9Outcome = "OAR-0" | "OAR-1" | "OAR-2" | "OAR-3";

type RegionTrend = Readonly<{
  values: readonly [number, number, number];
  meaningfulChange: boolean;
  monotonicChange: boolean;
  direction: -1 | 0 | 1;
}>;

const summarizeRegionTrend = (values: readonly [number, number, number], noiseGate: number): RegionTrend => {
  const firstStep = values[1] - values[0];
  const secondStep = values[2] - values[1];
  const firstMeaningful = Math.abs(firstStep) > noiseGate;
  const secondMeaningful = Math.abs(secondStep) > noiseGate;
  const meaningfulChange = Math.abs(values[2] - values[0]) > noiseGate || firstMeaningful || secondMeaningful;
  const meaningfulDirections = [firstMeaningful ? Math.sign(firstStep) : 0, secondMeaningful ? Math.sign(secondStep) : 0]
    .filter((direction) => direction !== 0);
  const monotonicChange = meaningfulChange && new Set(meaningfulDirections).size <= 1;
  const direction = !meaningfulChange ? 0 : values[2] > values[0] ? 1 : values[2] < values[0] ? -1 : 0;
  return { values, meaningfulChange, monotonicChange, direction };
};

/** Classifies only qualified data; image changes are not interpreted as fragment-alpha measurements. */
export const classifyMInv9Outcome = (input: Readonly<{
  matrixQualified: boolean;
  positiveControlResponsesQualified: boolean;
  noiseGateMae: number;
  discrepancyMaeByRegion: Readonly<Record<string, readonly [number, number, number]>>;
  primaryBellowsRegion: string;
}>): Readonly<{
  outcome: MInv9Outcome;
  trendByRegion: Readonly<Record<string, RegionTrend>>;
  reason: string;
}> => {
  if (!input.matrixQualified || !input.positiveControlResponsesQualified) {
    return { outcome: "OAR-0", trendByRegion: {}, reason: "required-opacity-trials-or-positive-controls-did-not-qualify" };
  }
  if (!Number.isFinite(input.noiseGateMae) || input.noiseGateMae < 0) {
    return { outcome: "OAR-0", trendByRegion: {}, reason: "invalid-measurement-noise-gate" };
  }
  const trendByRegion = Object.fromEntries(Object.entries(input.discrepancyMaeByRegion).map(([name, values]) => [
    name,
    summarizeRegionTrend(values, input.noiseGateMae),
  ]));
  const primary = trendByRegion[input.primaryBellowsRegion];
  if (!primary) return { outcome: "OAR-0", trendByRegion, reason: "primary-bellows-region-not-measured" };
  const significantRegions = Object.values(trendByRegion).filter((trend) => trend.meaningfulChange);
  const regionDirections = new Set(significantRegions.map((trend) => trend.direction).filter((direction) => direction !== 0));
  const mixedRegionalTrend = regionDirections.size > 1 || significantRegions.some((trend) => !trend.monotonicChange);
  if (primary.monotonicChange && !mixedRegionalTrend) {
    return { outcome: "OAR-1", trendByRegion, reason: "selected-bellows-cross-renderer-discrepancy-changes-monotonically-beyond-noise" };
  }
  if (significantRegions.length > 0) {
    return { outcome: "OAR-2", trendByRegion, reason: "qualified-opacity-response-is-region-dependent-or-non-monotonic" };
  }
  return { outcome: "OAR-3", trendByRegion, reason: "qualified-positive-controls-show-no-cross-renderer-opacity-trend-beyond-noise" };
};
