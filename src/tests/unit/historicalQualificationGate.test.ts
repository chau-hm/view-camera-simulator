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

  it("accepts the explicit archival disposition only for the canonical production-release event", () => {
    expect(evaluateHistoricalQualificationGate({
      ...validGate,
      historicalDecision: "QUALIFIED_WITH_LEGACY_ARCHIVAL",
      historicalMode: "production-release",
      eventName: "push",
      ref: "refs/heads/production",
    })).toEqual({ passed: true, reasons: [] });
  });

  it.each([
    { historicalMode: "changed", eventName: "push", ref: "refs/heads/production" },
    { historicalMode: "production-release", eventName: "pull_request", ref: "refs/heads/production" },
    { historicalMode: "production-release", eventName: "push", ref: "refs/heads/feature/example" },
    { historicalMode: "production-release", eventName: "push", ref: "refs/heads/main" },
  ])("rejects archival qualification outside production release context: %o", (context) => {
    expect(evaluateHistoricalQualificationGate({
      ...validGate,
      historicalDecision: "QUALIFIED_WITH_LEGACY_ARCHIVAL",
      ...context,
    })).toMatchObject({
      passed: false,
      reasons: expect.arrayContaining(["legacy-archival-decision-outside-canonical-production-release"]),
    });
  });

  it("still rejects archival qualification if ordinary CI failed", () => {
    expect(evaluateHistoricalQualificationGate({
      ...validGate,
      featureGateResult: "failure",
      historicalDecision: "QUALIFIED_WITH_LEGACY_ARCHIVAL",
      historicalMode: "production-release",
      eventName: "push",
      ref: "refs/heads/production",
    })).toMatchObject({ passed: false, reasons: ["feature-push-gate-failure"] });
  });

  it("rejects a production push if workflow wiring falls back to incremental qualification", () => {
    expect(evaluateHistoricalQualificationGate({
      ...validGate,
      historicalDecision: "QUALIFIED",
      historicalMode: "changed",
      eventName: "push",
      ref: "refs/heads/production",
    })).toMatchObject({
      passed: false,
      reasons: ["production-push-requires-cumulative-qualification-mode"],
    });
  });

  it("does not allow production-release mode on a feature, main, or manual event", () => {
    expect(evaluateHistoricalQualificationGate({
      ...validGate,
      historicalDecision: "QUALIFIED",
      historicalMode: "production-release",
      eventName: "push",
      ref: "refs/heads/feature/example",
    })).toMatchObject({
      passed: false,
      reasons: ["production-release-mode-outside-canonical-production-event"],
    });
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

  it("fails the authoritative gate when cancellation leaves qualification or routing incomplete", () => {
    expect(evaluateHistoricalQualificationGate({
      featureRoutingResult: "cancelled",
      featureRoutingDecision: "",
      featureGateResult: "skipped",
      historicalResult: "cancelled",
      historicalDecision: "",
    })).toMatchObject({
      passed: false,
      reasons: expect.arrayContaining([
        "feature-push-gate-skipped",
        "historical-qualification-cancelled",
        "historical-decision-missing",
      ]),
    });
  });
});
