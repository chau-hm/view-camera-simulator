import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ARCHITECTURE_RISE_RAW_RTT_EVIDENCE_REVISION } from "../../render/webgpu/groundGlassRawWebGpuCompatibility";
import { evaluateGroundGlassM7cR187LifecycleEvidence } from "../../render/groundGlassM7cR187LifecycleEvidence";

type MutableScenario = Record<string, unknown>;
type MutableReport = Record<string, unknown> & { scenarios: MutableScenario[] };

const originalReport = JSON.parse(readFileSync(
  "docs/architecture/GROUND_GLASS_M7C_R187_RAW_LIFECYCLE_REPORT.json",
  "utf8",
)) as MutableReport;

const copyReport = (): MutableReport => structuredClone(originalReport);
const scenarioFor = (report: MutableReport, id: string): MutableScenario => {
  const scenario = report.scenarios.find((entry) => entry.id === id);
  if (!scenario) throw new Error(`Missing fixture scenario ${id}`);
  return scenario;
};
const eventsFor = (scenario: MutableScenario): Array<Record<string, unknown>> => {
  if (!Array.isArray(scenario.events)) throw new Error("Scenario events are missing");
  return scenario.events as Array<Record<string, unknown>>;
};
const expectRejected = (report: MutableReport, error: string) => {
  const result = evaluateGroundGlassM7cR187LifecycleEvidence(report);
  expect(result.valid).toBe(false);
  expect(result.errors).toContain(error);
};

describe("M7C r187 lifecycle evidence evaluator", () => {
  it("accepts the committed revision-specific inventory and computed counts", () => {
    const result = evaluateGroundGlassM7cR187LifecycleEvidence(originalReport);
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
    expect(result.qualification).toBe(originalReport.qualification);
    expect(result.counts).toEqual(originalReport.scenarioCounts);
  });

  it("rejects WebGL2 compatibility execution presented as native WebGPU", () => {
    const report = copyReport();
    scenarioFor(report, "m7c-r187-webgl2-compatibility-negative-control").nativeWebGpuQualified = true;
    expectRejected(report, "webgl2-control-misclassified-as-native-webgpu:m7c-r187-webgl2-compatibility-negative-control");
  });

  it("rejects a native capture whose Three.js revision is not r187", () => {
    const report = copyReport();
    scenarioFor(report, "m7c-r187-native-raw-baseline").threeRevision = "186";
    expectRejected(report, "native-runtime-identity-contradiction:m7c-r187-native-raw-baseline");
  });

  it("rejects r186 evidence reused as the r187 Raw RTT authorization", () => {
    const report = copyReport();
    const scenario = scenarioFor(report, "m7c-r187-native-raw-baseline");
    scenario.policyEvidenceRevision = ARCHITECTURE_RISE_RAW_RTT_EVIDENCE_REVISION;
    if (typeof scenario.provenance === "object" && scenario.provenance !== null) {
      (scenario.provenance as Record<string, unknown>).policyEvidenceRevision = ARCHITECTURE_RISE_RAW_RTT_EVIDENCE_REVISION;
    }
    expectRejected(report, "r187-policy-evidence-mismatch:m7c-r187-native-raw-baseline");
  });

  it("rejects replacement after adapter and host both report failed cleanup", () => {
    const report = copyReport();
    const scenario = scenarioFor(report, "m7c-r187-scene-render-failure");
    scenario.cleanupOutcome = "failed";
    scenario.applicationFallback = true;
    scenario.fallbackOutcome = "webgl-mounted";
    for (const event of eventsFor(scenario)) {
      if (event.kind === "cleanup" || event.kind === "cleanup-acknowledged") event.outcome = "failed";
    }
    expectRejected(report, "fallback-before-confirmed-cleanup:m7c-r187-scene-render-failure");
  });

  it("rejects a missing host cleanup acknowledgement", () => {
    const report = copyReport();
    const scenario = scenarioFor(report, "m7c-r187-init-after-target-fallback");
    scenario.events = eventsFor(scenario).filter((event) => event.kind !== "cleanup-acknowledged");
    expectRejected(report, "cleanup-host-acknowledgement-contradiction:m7c-r187-init-after-target-fallback");
  });

  it("rejects host acknowledgement that contradicts adapter cleanup", () => {
    const report = copyReport();
    const scenario = scenarioFor(report, "m7c-r187-scene-render-failure");
    const identity = scenario.identity as Record<string, unknown>;
    const acknowledgement = eventsFor(scenario).find((event) => event.kind === "cleanup-acknowledged" &&
      event.generationId === identity.rendererGenerationId);
    if (!acknowledgement) throw new Error("Host cleanup acknowledgement is missing from the positive control");
    acknowledgement.outcome = "uncertain";
    expectRejected(report, "cleanup-host-acknowledgement-contradiction:m7c-r187-scene-render-failure");
  });

  it("rejects a replacement mount ordered before cleanup confirmation", () => {
    const report = copyReport();
    const scenario = scenarioFor(report, "m7c-r187-scene-render-failure");
    const events = eventsFor(scenario);
    const identity = scenario.identity as Record<string, unknown>;
    const acknowledgement = events.find((event) => event.kind === "cleanup-acknowledged" &&
      event.generationId === identity.rendererGenerationId);
    const replacement = events.find((event) => event.kind === "renderer-mounted" &&
      event.rendererFamily === "webgl-renderer" && event.hostId === identity.hostId &&
      event.channelId === identity.channelId && typeof event.sequence === "number" &&
      typeof acknowledgement?.sequence === "number" && event.sequence > acknowledgement.sequence);
    if (!acknowledgement || !replacement || typeof acknowledgement.sequence !== "number") {
      throw new Error("Positive control is missing replacement ordering evidence");
    }
    replacement.sequence = acknowledgement.sequence - 1;
    expectRejected(report, "missing-confirmed-webgl-replacement:m7c-r187-scene-render-failure");
  });

  it("rejects a current publication assigned to the wrong generation", () => {
    const report = copyReport();
    const scenario = scenarioFor(report, "m7c-r187-scene-render-failure");
    const summary = scenario.publication as Record<string, unknown>;
    const publication = eventsFor(scenario).find((event) => event.kind === "host-frame-result" &&
      event.requestId === summary.completedRequestId && event.generationId === summary.rendererGenerationId &&
      event.acceptedByHost === true);
    if (!publication) throw new Error("Positive control is missing host publication evidence");
    publication.activeGenerationId = "fabricated-generation";
    expectRejected(report, "current-publication-not-accepted-by-host:m7c-r187-scene-render-failure");
  });

  it("rejects a stale completion marked as host accepted", () => {
    const report = copyReport();
    const scenario = scenarioFor(report, "m7c-r187-latest-request-stale-rejection");
    const note = (scenario.provenance as Record<string, unknown>).observations as Array<Record<string, unknown>>;
    const interleaving = note.find((observation) => observation.kind === "latest-request-interleaving");
    if (!interleaving || typeof interleaving.requests !== "object" || interleaving.requests === null) {
      throw new Error("Positive control is missing the latest-request observation");
    }
    const staleRequestId = (interleaving.requests as Record<string, unknown>).staleRequestId;
    const latestRequestId = (interleaving.requests as Record<string, unknown>).latestAcceptedRequestId;
    const stale = eventsFor(scenario).find((event) => event.kind === "host-frame-result" &&
      event.requestId === staleRequestId && event.latestAcceptedRequestId === latestRequestId && event.acceptedByHost === false);
    if (!stale) throw new Error("Positive control is missing the observed stale rejection");
    stale.acceptedByHost = true;
    expectRejected(report, "latest-request-result-chain-contradiction:m7c-r187-latest-request-stale-rejection");
  });

  it("rejects a fabricated current request identity", () => {
    const report = copyReport();
    scenarioFor(report, "m7c-r187-scene-render-failure").identity = {
      ...(scenarioFor(report, "m7c-r187-scene-render-failure").identity as Record<string, unknown>),
      requestId: "fabricated-current-request",
    };
    expectRejected(report, "native-runtime-identity-contradiction:m7c-r187-scene-render-failure");
  });

  it("rejects a remount that changes the session or creates another native attempt", () => {
    const report = copyReport();
    const scenario = scenarioFor(report, "m7c-r187-sticky-fallback-remount");
    const observations = (scenario.provenance as Record<string, unknown>).observations as Array<Record<string, unknown>>;
    const remount = observations.find((observation) => observation.kind === "sticky-session-remount");
    if (!remount || !Array.isArray(remount.attemptGenerationsAfterRemount)) {
      throw new Error("Positive control is missing the sticky-remount observation");
    }
    remount.attemptGenerationsAfterRemount.push("unexpected-generation");
    expectRejected(report, "remount-implicitly-retried-pilot-session:m7c-r187-sticky-fallback-remount");
  });

  it("rejects a native attempt attributed to an unknown retry action", () => {
    const report = copyReport();
    const scenario = scenarioFor(report, "m7c-r187-explicit-retry-new-session");
    const recovery = ((scenario.provenance as Record<string, unknown>).observations as Array<Record<string, unknown>>)
      .find((observation) => observation.kind === "authorized-recovery-actions");
    if (!recovery || !Array.isArray(recovery.attemptsAfterInvalidAction)) {
      throw new Error("Positive control is missing the rejected-action observation");
    }
    recovery.attemptsAfterInvalidAction.push("unauthorized-native-attempt");
    expectRejected(report, "authorized-recovery-attempt-inventory-contradiction:m7c-r187-explicit-retry-new-session");
  });

  it("rejects a new-session action that reuses the prior pilot session", () => {
    const report = copyReport();
    const scenario = scenarioFor(report, "m7c-r187-explicit-retry-new-session");
    const recovery = ((scenario.provenance as Record<string, unknown>).observations as Array<Record<string, unknown>>)
      .find((observation) => observation.kind === "authorized-recovery-actions");
    if (!recovery || typeof recovery.newSession !== "object" || recovery.newSession === null) {
      throw new Error("Positive control is missing new-session authorization evidence");
    }
    (recovery.newSession as Record<string, unknown>).pilotSessionId = recovery.initialSessionId;
    expectRejected(report, "authorized-recovery-boundary-contradiction:m7c-r187-explicit-retry-new-session");
  });

  it("rejects successful host publication after terminal WebGL failure", () => {
    const report = copyReport();
    const scenario = scenarioFor(report, "m7c-r187-terminal-webgl-remount");
    const terminal = ((scenario.provenance as Record<string, unknown>).observations as Array<Record<string, unknown>>)
      .find((observation) => observation.kind === "terminal-webgl-context-loss");
    if (!terminal || typeof terminal.failureSequence !== "number") throw new Error("Positive control is missing terminal failure order");
    eventsFor(scenario).push({
      sequence: terminal.failureSequence + 1,
      kind: "host-frame-result",
      requestId: "stale-success",
      generationId: terminal.generationId,
      acceptedByHost: true,
    });
    expectRejected(report, "webgl-terminal-publication-after-terminal-failure:m7c-r187-terminal-webgl-remount");
  });

  it("rejects report counts that disagree with its scenario inventory", () => {
    const report = copyReport();
    const counts = report.scenarioCounts as Record<string, number>;
    counts.passed += 1;
    expectRejected(report, "scenario-count-mismatch:passed");
  });

  it("rejects missing capture provenance", () => {
    const report = copyReport();
    delete scenarioFor(report, "m7c-r187-native-raw-baseline").provenance;
    expectRejected(report, "missing-capture-provenance:m7c-r187-native-raw-baseline");
  });

  it("rejects a mismatched evaluator revision", () => {
    const report = copyReport();
    report.evaluatorRevision = "m7c-r187-lifecycle-evidence-v0";
    expectRejected(report, "unsupported-evaluator-revision");
  });
});
