import { describe, expect, it } from "vitest";
import {
  areMInv8GeometryContentsCompatible,
  areMInv8ObservedBlendStatesQualified,
  areMInv8ScreenshotRepresentationsCompatible,
  M_INV8_REQUIRED_TRIAL_CHECKS,
  qualifyMInv8ConditionPair,
  qualifyMInv8DifferenceOfResponses,
  qualifyMInv8FactorialInteraction,
  qualifyMInv8Matrix,
  qualifyMInv8Trial,
  type MInv8TrialCheck,
  type MInv8TrialQualification,
} from "../benchmarks/anatomyBellowsCompositingQualification";

const allChecks = () => Object.fromEntries(M_INV8_REQUIRED_TRIAL_CHECKS.map((name) => [name, true]));
const trials = (): MInv8TrialQualification[] => (["webgl", "native"] as const).flatMap((backend) =>
  (["C0", "C1", "C2", "C3"] as const).map((condition) => qualifyMInv8Trial(backend, condition, allChecks())),
);

const qualifiedMatrixWithTrials = (trialSet: readonly MInv8TrialQualification[]) => qualifyMInv8Matrix({
  trials: trialSet,
  conditionPairs: (["C0", "C1", "C2", "C3"] as const).map((condition) => ({ condition, qualified: true })),
  differenceOfResponses: (["C1", "C2", "C3"] as const).map((condition) => ({ condition, qualified: true })),
  factorialInteractions: (["webgl", "native"] as const).map((backend) => ({ backend, qualified: true })),
  baselineReproduced: true,
  baselineRepeatability: true,
  finalRestoration: true,
  groundGlassRestoration: true,
  runtimeHealthy: true,
});
const qualifiedMatrix = () => qualifiedMatrixWithTrials(trials());

describe("M-INV8 authoritative evidence qualification", () => {
  it("accepts matching RGB or RGBA screenshot representations", () => {
    expect(areMInv8ScreenshotRepresentationsCompatible([{ channels: 3 }, { channels: 3 }])).toBe(true);
    expect(areMInv8ScreenshotRepresentationsCompatible([{ channels: 4 }, { channels: 4 }])).toBe(true);
    expect(areMInv8ScreenshotRepresentationsCompatible([{ channels: 3 }, { channels: 4 }])).toBe(false);
    expect(areMInv8ScreenshotRepresentationsCompatible([{ channels: 5 }, { channels: 5 }])).toBe(false);
  });

  it("compares cross-renderer geometry content while ignoring backend-local resource IDs", () => {
    const webglGeometry = {
      id: "webgl-buffer",
      type: "BufferGeometry",
      vertexCount: 44,
      indexCount: 240,
      contentFingerprint: "f5234645",
    };
    const nativeGeometry = { ...webglGeometry, id: "native-buffer" };
    expect(areMInv8GeometryContentsCompatible(webglGeometry, nativeGeometry)).toBe(true);
    expect(areMInv8GeometryContentsCompatible(webglGeometry, { ...nativeGeometry, indexCount: 239 })).toBe(false);
    expect(areMInv8GeometryContentsCompatible(webglGeometry, { ...nativeGeometry, contentFingerprint: null })).toBe(false);
  });

  it("rejects a rich trial record when a required check is missing or false", () => {
    expect(qualifyMInv8Trial("native", "C2", allChecks()).qualified).toBe(true);
    const missingActualOutput = allChecks() as Record<string, boolean>;
    delete missingActualOutput.drawStateQualified;
    const missing = qualifyMInv8Trial("native", "C2", missingActualOutput);
    expect(missing.qualified).toBe(false);
    expect(missing.failedChecks).toContain("drawStateQualified");

    const failedPipeline = qualifyMInv8Trial("native", "C2", { ...allChecks(), nativePipelineQualified: false });
    expect(failedPipeline.qualified).toBe(false);
    expect(failedPipeline.failedChecks).toContain("nativePipelineQualified");
  });

  it.each([
    "rendererRuntimeQualified",
    "rendererGenerationQualified",
    "cameraAndViewportCompatible",
    "outputPolicyQualified",
    "nativePipelineQualified",
    "drawStateQualified",
    "originalOutputIdentityRestored",
    "borrowedResourcesPreserved",
  ] as const)("propagates a failed %s check to the aggregate matrix", (failedCheck: MInv8TrialCheck) => {
    const failedTrial = qualifyMInv8Trial("native", "C3", {
      ...allChecks(),
      [failedCheck]: false,
    });
    expect(failedTrial.failedChecks).toContain(failedCheck);
    const result = qualifiedMatrixWithTrials(trials().map((trial) =>
      trial.backend === "native" && trial.condition === "C3" ? failedTrial : trial,
    ));
    expect(result.qualified).toBe(false);
    expect(result.failedChecks).toContain("allTrialsQualified");
  });

  it("rejects a requested blend state that conflicts with the observed GPU pipeline", () => {
    const observedPipelineStates = [true, true];
    const drawStateQualified = areMInv8ObservedBlendStatesQualified(observedPipelineStates, false);
    expect(drawStateQualified).toBe(false);
    const failedTrial = qualifyMInv8Trial("native", "C2", {
      ...allChecks(),
      drawStateQualified,
    });
    const result = qualifiedMatrixWithTrials(trials().map((trial) =>
      trial.backend === "native" && trial.condition === "C2" ? failedTrial : trial,
    ));
    expect(result.qualified).toBe(false);
    expect(result.failedChecks).toContain("allTrialsQualified");
  });

  it("does not qualify image comparisons when either source trial failed", () => {
    const comparison = qualifyMInv8ConditionPair({
      webglTrialQualified: true,
      nativeTrialQualified: false,
      imagesAvailable: true,
      representationCompatible: true,
      geometryCompatible: true,
      maskCompatible: true,
    });
    expect(comparison.qualified).toBe(false);
    expect(comparison.failedChecks).toEqual(["nativeTrialQualified"]);
  });

  it("does not qualify a response difference without both qualified conditions and a compatible mask", () => {
    expect(qualifyMInv8DifferenceOfResponses({
      baselineConditionPairQualified: true,
      interventionConditionPairQualified: true,
      maskCompatible: true,
    }).qualified).toBe(true);
    const unqualified = qualifyMInv8DifferenceOfResponses({
      baselineConditionPairQualified: false,
      interventionConditionPairQualified: true,
      maskCompatible: true,
    });
    expect(unqualified.qualified).toBe(false);
    expect(unqualified.failedChecks).toContain("baselineConditionPairQualified");
  });

  it("does not qualify factorial interaction when any C0-C3 trial is unqualified", () => {
    const interaction = qualifyMInv8FactorialInteraction({
      c0TrialQualified: true,
      c1TrialQualified: true,
      c2TrialQualified: false,
      c3TrialQualified: true,
      imagesAvailable: true,
      representationCompatible: true,
      maskCompatible: true,
    });
    expect(interaction.qualified).toBe(false);
    expect(interaction.failedChecks).toContain("c2TrialQualified");
  });

  it("forces the complete matrix unqualified for missing, failed, or image-only trials", () => {
    expect(qualifiedMatrix().qualified).toBe(true);
    const missingTrial = qualifiedMatrix();
    const completeTrials = trials();
    completeTrials.pop();
    const missing = qualifyMInv8Matrix({
      trials: completeTrials,
      conditionPairs: (["C0", "C1", "C2", "C3"] as const).map((condition) => ({ condition, qualified: true })),
      differenceOfResponses: (["C1", "C2", "C3"] as const).map((condition) => ({ condition, qualified: true })),
      factorialInteractions: (["webgl", "native"] as const).map((backend) => ({ backend, qualified: true })),
      baselineReproduced: true,
      baselineRepeatability: true,
      finalRestoration: true,
      groundGlassRestoration: true,
      runtimeHealthy: true,
    });
    expect(missing.qualified).toBe(false);
    expect(missing.failedChecks).toContain("completeTrialSet");
    expect(missingTrial.qualified).toBe(true);

    const failed = qualifyMInv8Matrix({
      trials: trials().map((trial) => trial.backend === "native" && trial.condition === "C3"
        ? qualifyMInv8Trial("native", "C3", { ...allChecks(), nativePipelineQualified: false })
        : trial),
      conditionPairs: (["C0", "C1", "C2", "C3"] as const).map((condition) => ({ condition, qualified: true })),
      differenceOfResponses: (["C1", "C2", "C3"] as const).map((condition) => ({ condition, qualified: true })),
      factorialInteractions: (["webgl", "native"] as const).map((backend) => ({ backend, qualified: true })),
      baselineReproduced: true,
      baselineRepeatability: true,
      finalRestoration: true,
      groundGlassRestoration: true,
      runtimeHealthy: true,
    });
    expect(failed.qualified).toBe(false);
    expect(failed.failedChecks).toContain("allTrialsQualified");

    const duplicatedConditionPair = qualifyMInv8Matrix({
      trials: trials(),
      conditionPairs: (["C0", "C0", "C0", "C0"] as const).map((condition) => ({ condition, qualified: true })),
      differenceOfResponses: (["C1", "C2", "C3"] as const).map((condition) => ({ condition, qualified: true })),
      factorialInteractions: (["webgl", "native"] as const).map((backend) => ({ backend, qualified: true })),
      baselineReproduced: true,
      baselineRepeatability: true,
      finalRestoration: true,
      groundGlassRestoration: true,
      runtimeHealthy: true,
    });
    expect(duplicatedConditionPair.qualified).toBe(false);
    expect(duplicatedConditionPair.failedChecks).toContain("allConditionPairsQualified");
  });
});
