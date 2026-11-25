import { describe, expect, it } from "vitest";
import {
  M_INV9_REQUIRED_TRIAL_CHECKS,
  classifyMInv9Outcome,
  qualifyMInv9Matrix,
  qualifyMInv9Trial,
  type MInv9TrialCheck,
} from "../benchmarks/anatomyBellowsOpacityQualification";

const passingChecks = (): Record<MInv9TrialCheck, boolean> =>
  Object.fromEntries(M_INV9_REQUIRED_TRIAL_CHECKS.map((name) => [name, true])) as Record<MInv9TrialCheck, boolean>;

const completeTrials = () => (["webgl", "native"] as const).flatMap((backend) =>
  (["O0", "O1", "O2"] as const).map((condition, index) =>
    qualifyMInv9Trial(backend, condition, [0.16, 0.5, 1][index]!, passingChecks()),
  ),
);

describe("M-INV9 opacity response qualification", () => {
  it("requires every inherited M-INV8 trial check and the native opacity positive control", () => {
    expect(qualifyMInv9Trial("native", "O1", 0.5, passingChecks()).qualified).toBe(true);
    const inertOutput = passingChecks();
    inertOutput.nativeOpacityPathResponseQualified = false;
    const failed = qualifyMInv9Trial("native", "O1", 0.5, inertOutput);
    expect(failed.qualified).toBe(false);
    expect(failed.failedChecks).toContain("nativeOpacityPathResponseQualified");
  });

  it("requires the complete WebGL/native O0-O2 trial matrix and all baseline controls", () => {
    const qualified = qualifyMInv9Matrix({
      trials: completeTrials(),
      nativeAdapterAvailable: true,
      historicalBaselineReproduced: true,
      baselineRepeatabilityQualified: true,
      fixedRoisCompatible: true,
      positiveControlResponsesQualified: true,
      allRestorationsQualified: true,
      groundGlassStable: true,
      runtimeHealthy: true,
    });
    expect(qualified.qualified).toBe(true);

    const incomplete = qualifyMInv9Matrix({
      trials: completeTrials().filter((trial) => trial.condition !== "O2"),
      nativeAdapterAvailable: true,
      historicalBaselineReproduced: true,
      baselineRepeatabilityQualified: true,
      fixedRoisCompatible: true,
      positiveControlResponsesQualified: true,
      allRestorationsQualified: true,
      groundGlassStable: true,
      runtimeHealthy: true,
    });
    expect(incomplete.qualified).toBe(false);
    expect(incomplete.failedChecks).toContain("completeO0O1O2TrialSet");
  });

  it("keeps OAR-1, OAR-2, and OAR-3 outcomes within their qualified measurement rules", () => {
    const classify = (values: readonly [number, number, number], unaffected: readonly [number, number, number] = [40, 40, 40]) =>
      classifyMInv9Outcome({
        matrixQualified: true,
        positiveControlResponsesQualified: true,
        noiseGateMae: 0.5,
        discrepancyMaeByRegion: {
          selectedBellowsDimmedIntersection: values,
          unaffectedBackgroundCandidate: unaffected,
        },
        primaryBellowsRegion: "selectedBellowsDimmedIntersection",
      });

    expect(classify([30, 35, 42]).outcome).toBe("OAR-1");
    expect(classify([30, 45, 33]).outcome).toBe("OAR-2");
    expect(classify([30, 30.1, 29.9]).outcome).toBe("OAR-3");
    expect(classify([30, 35, 42], [40, 47, 43]).outcome).toBe("OAR-2");
    expect(classifyMInv9Outcome({
      matrixQualified: false,
      positiveControlResponsesQualified: true,
      noiseGateMae: 0.5,
      discrepancyMaeByRegion: { selectedBellowsDimmedIntersection: [1, 2, 3] },
      primaryBellowsRegion: "selectedBellowsDimmedIntersection",
    }).outcome).toBe("OAR-0");
  });
});
