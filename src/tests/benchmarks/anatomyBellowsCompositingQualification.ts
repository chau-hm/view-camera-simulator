export type MInv8Backend = "webgl" | "native";
export type MInv8Condition = "C0" | "C1" | "C2" | "C3";

export const areMInv8ObservedBlendStatesQualified = (
  actualBlendEnabled: readonly unknown[],
  requestedBlendEnabled: boolean,
): boolean => actualBlendEnabled.length > 0 && actualBlendEnabled.every((enabled) => enabled === requestedBlendEnabled);

export const areMInv8ScreenshotRepresentationsCompatible = (
  images: readonly Readonly<{ channels: number }>[],
): boolean => {
  const channels = images[0]?.channels;
  return (channels === 3 || channels === 4) && images.every((image) => image.channels === channels);
};

export const areMInv8GeometryContentsCompatible = (
  left: Readonly<Record<string, unknown>>,
  right: Readonly<Record<string, unknown>>,
): boolean => {
  const fields = ["type", "vertexCount", "indexCount", "contentFingerprint"] as const;
  return typeof left.contentFingerprint === "string" && left.contentFingerprint.length > 0 &&
    fields.every((field) => left[field] === right[field]);
};

export const M_INV8_REQUIRED_TRIAL_CHECKS = [
  "captureCompleted",
  "rendererRuntimeQualified",
  "rendererGenerationQualified",
  "cameraAndViewportCompatible",
  "sourceMaterialPreserved",
  "effectiveOutputStateQualified",
  "drawStateQualified",
  "nativePipelineQualified",
  "outputPolicyQualified",
  "interventionAppliedOrBaseline",
  "originalOutputIdentityRestored",
  "geometryIdentityPreserved",
  "visibilityRestored",
  "ownedResourcesReleased",
  "borrowedResourcesPreserved",
  "repeatabilityWithinTolerance",
  "restoredBaselineWithinTolerance",
  "imageAvailable",
  "imageDimensionsCompatible",
] as const;

export type MInv8TrialCheck = typeof M_INV8_REQUIRED_TRIAL_CHECKS[number];
export type MInv8TrialQualification = Readonly<{
  backend: MInv8Backend;
  condition: MInv8Condition;
  qualified: boolean;
  checks: Readonly<Record<MInv8TrialCheck, boolean>>;
  failedChecks: readonly MInv8TrialCheck[];
}>;

export type MInv8GateQualification = Readonly<{
  qualified: boolean;
  checks: Readonly<Record<string, boolean>>;
  failedChecks: readonly string[];
}>;

const qualifyChecks = (checks: Readonly<Record<string, boolean>>, required: readonly string[]): MInv8GateQualification => {
  const complete = Object.fromEntries(required.map((name) => [name, checks[name] === true]));
  const failedChecks = required.filter((name) => complete[name] !== true);
  return { qualified: failedChecks.length === 0, checks: complete, failedChecks };
};

export const qualifyMInv8Trial = (
  backend: MInv8Backend,
  condition: MInv8Condition,
  checks: Partial<Readonly<Record<MInv8TrialCheck, boolean>>>,
): MInv8TrialQualification => {
  const complete = Object.fromEntries(M_INV8_REQUIRED_TRIAL_CHECKS.map((name) => [name, checks[name] === true])) as Record<MInv8TrialCheck, boolean>;
  const failedChecks = M_INV8_REQUIRED_TRIAL_CHECKS.filter((name) => complete[name] !== true);
  return { backend, condition, qualified: failedChecks.length === 0, checks: complete, failedChecks };
};

export const qualifyMInv8ConditionPair = (input: Readonly<{
  webglTrialQualified: boolean;
  nativeTrialQualified: boolean;
  imagesAvailable: boolean;
  representationCompatible: boolean;
  geometryCompatible: boolean;
  maskCompatible: boolean;
}>): MInv8GateQualification => qualifyChecks(input, [
  "webglTrialQualified",
  "nativeTrialQualified",
  "imagesAvailable",
  "representationCompatible",
  "geometryCompatible",
  "maskCompatible",
]);

export const qualifyMInv8DifferenceOfResponses = (input: Readonly<{
  baselineConditionPairQualified: boolean;
  interventionConditionPairQualified: boolean;
  maskCompatible: boolean;
}>): MInv8GateQualification => qualifyChecks(input, [
  "baselineConditionPairQualified",
  "interventionConditionPairQualified",
  "maskCompatible",
]);

export const qualifyMInv8FactorialInteraction = (input: Readonly<{
  c0TrialQualified: boolean;
  c1TrialQualified: boolean;
  c2TrialQualified: boolean;
  c3TrialQualified: boolean;
  imagesAvailable: boolean;
  representationCompatible: boolean;
  maskCompatible: boolean;
}>): MInv8GateQualification => qualifyChecks(input, [
  "c0TrialQualified",
  "c1TrialQualified",
  "c2TrialQualified",
  "c3TrialQualified",
  "imagesAvailable",
  "representationCompatible",
  "maskCompatible",
]);

export const qualifyMInv8Matrix = (input: Readonly<{
  trials: readonly MInv8TrialQualification[];
  conditionPairs: readonly Readonly<{ condition: MInv8Condition; qualified: boolean }>[];
  differenceOfResponses: readonly Readonly<{ condition: Exclude<MInv8Condition, "C0">; qualified: boolean }>[];
  factorialInteractions: readonly Readonly<{ backend: MInv8Backend; qualified: boolean }>[];
  baselineReproduced: boolean;
  baselineRepeatability: boolean;
  finalRestoration: boolean;
  groundGlassRestoration: boolean;
  runtimeHealthy: boolean;
}>): MInv8GateQualification => {
  const expectedTrials = (["webgl", "native"] as const).flatMap((backend) =>
    (["C0", "C1", "C2", "C3"] as const).map((condition) => `${backend}:${condition}`),
  );
  const expectedConditions = ["C0", "C1", "C2", "C3"] as const;
  const expectedInterventions = ["C1", "C2", "C3"] as const;
  const expectedBackends = ["webgl", "native"] as const;
  const trialKeys = new Set(input.trials.map((trial) => `${trial.backend}:${trial.condition}`));
  return qualifyChecks({
    baselineReproduced: input.baselineReproduced,
    baselineRepeatability: input.baselineRepeatability,
    completeTrialSet: expectedTrials.every((key) => trialKeys.has(key)) && input.trials.length === expectedTrials.length,
    allTrialsQualified: input.trials.length === expectedTrials.length && input.trials.every((trial) => trial.qualified),
    allConditionPairsQualified: input.conditionPairs.length === expectedConditions.length &&
      expectedConditions.every((condition) => input.conditionPairs.some((pair) => pair.condition === condition && pair.qualified)),
    allDifferenceOfResponsesQualified: input.differenceOfResponses.length === expectedInterventions.length &&
      expectedInterventions.every((condition) => input.differenceOfResponses.some((item) => item.condition === condition && item.qualified)),
    allFactorialInteractionsQualified: input.factorialInteractions.length === expectedBackends.length &&
      expectedBackends.every((backend) => input.factorialInteractions.some((item) => item.backend === backend && item.qualified)),
    finalRestoration: input.finalRestoration,
    groundGlassRestoration: input.groundGlassRestoration,
    runtimeHealthy: input.runtimeHealthy,
  }, [
    "baselineReproduced",
    "baselineRepeatability",
    "completeTrialSet",
    "allTrialsQualified",
    "allConditionPairsQualified",
    "allDifferenceOfResponsesQualified",
    "allFactorialInteractionsQualified",
    "finalRestoration",
    "groundGlassRestoration",
    "runtimeHealthy",
  ]);
};
