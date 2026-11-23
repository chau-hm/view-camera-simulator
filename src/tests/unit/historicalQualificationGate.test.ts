import { describe, expect, it } from "vitest";
import { evaluateHistoricalQualificationGate } from "../../../scripts/historical-qualification-ci-gate.mjs";

const validGate = {
  featureRoutingResult: "success",
  featureRoutingDecision: "run-ci",
  featureGateResult: "success",
  historicalResult: "success",
  historicalDecision: "NOT_APPLICABLE",
};

describe("authoritative CI qualification gate", () => {
  it("accepts a complete non-applicable application route", () => {
    expect(evaluateHistoricalQualificationGate(validGate)).toEqual({ passed: true, reasons: [] });
  });

  it("accepts an executed and qualified historical archive", () => {
    expect(evaluateHistoricalQualificationGate({ ...validGate, historicalDecision: "QUALIFIED" }))
      .toEqual({ passed: true, reasons: [] });
  });

  it.each(["FAILED", "UNVERIFIED", "", undefined])("rejects a non-merge-safe decision: %s", (historicalDecision) => {
    expect(evaluateHistoricalQualificationGate({ ...validGate, historicalDecision })).toMatchObject({ passed: false });
  });

  it.each(["failure", "cancelled", "skipped", "", undefined])("rejects a missing or unsuccessful qualification job: %s", (historicalResult) => {
    expect(evaluateHistoricalQualificationGate({ ...validGate, historicalResult })).toMatchObject({ passed: false });
  });

  it.each(["failure", "cancelled", "skipped", "", undefined])("rejects an unsuccessful feature-push gate: %s", (featureGateResult) => {
    expect(evaluateHistoricalQualificationGate({ ...validGate, featureGateResult })).toMatchObject({ passed: false });
  });

  it("allows fail-open CI when PR association could not be verified", () => {
    expect(evaluateHistoricalQualificationGate({
      ...validGate,
      featureRoutingResult: "failure",
      featureRoutingDecision: "run-ci",
    })).toEqual({ passed: true, reasons: [] });
  });

  it("does not allow a redundant feature-push result to substitute for the PR run", () => {
    expect(evaluateHistoricalQualificationGate({
      ...validGate,
      featureRoutingDecision: "covered-by-pr",
    })).toMatchObject({
      passed: false,
      reasons: ["redundant-feature-push-ci-should-have-been-suppressed"],
    });
  });
});
