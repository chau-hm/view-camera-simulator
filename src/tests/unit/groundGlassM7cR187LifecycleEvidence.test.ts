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
const eventFor = (scenario: MutableScenario, kind: string): Record<string, unknown> => {
  const event = eventsFor(scenario).find((entry) => entry.kind === kind);
  if (!event) throw new Error(`Positive control is missing ${kind}`);
  return event;
};
const eventForGeneration = (scenario: MutableScenario, kind: string, generationId: unknown): Record<string, unknown> => {
  const event = eventsFor(scenario).find((entry) => entry.kind === kind && entry.generationId === generationId);
  if (!event) throw new Error(`Positive control is missing ${kind} for ${String(generationId)}`);
  return event;
};
const orderEvents = (scenario: MutableScenario): void => {
  scenario.events = eventsFor(scenario).sort((left, right) => Number(left.sequence) - Number(right.sequence));
};
const swapSequence = (left: Record<string, unknown>, right: Record<string, unknown>): void => {
  const sequence = left.sequence;
  left.sequence = right.sequence;
  right.sequence = sequence;
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
    const scenario = scenarioFor(report, "m7c-r187-scene-render-failure");
    scenario.events = eventsFor(scenario).filter((event) => event.kind !== "cleanup-acknowledged");
    expectRejected(report, "cleanup-host-acknowledgement-contradiction:m7c-r187-scene-render-failure");
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

  it("rejects a stale completion that overwrites the final current publication state", () => {
    const report = copyReport();
    const scenario = scenarioFor(report, "m7c-r187-latest-request-stale-rejection");
    const observations = (scenario.provenance as Record<string, unknown>).observations as Array<Record<string, unknown>>;
    const interleaving = observations.find((observation) => observation.kind === "latest-request-interleaving");
    const finalState = observations.find((observation) => observation.kind === "final-publication-state-after-stale-rejection");
    if (!interleaving || typeof interleaving.requests !== "object" || interleaving.requests === null || !finalState) {
      throw new Error("Positive control is missing the final publication-state observation");
    }
    finalState.lastCompletedRequestId = (interleaving.requests as Record<string, unknown>).staleRequestId;
    expectRejected(report, "latest-request-final-state-overwritten-by-stale:m7c-r187-latest-request-stale-rejection");
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

  it("rejects an initialization failure as qualified when its operation is unknown", () => {
    const report = copyReport();
    const scenario = scenarioFor(report, "m7c-r187-init-after-target-fallback");
    scenario.status = "passed";
    const counts = report.scenarioCounts as Record<string, number>;
    counts.passed += 1;
    counts.blocked -= 1;
    const result = evaluateGroundGlassM7cR187LifecycleEvidence(report);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("initialization-operation-gap-not-blocked:m7c-r187-init-after-target-fallback");
  });

  describe("review-fix F1: test-destroyed GPUDevice.lost chain", () => {
    it("rejects a capture missing both the destroy request and lost-Promise observation", () => {
      const report = copyReport();
      const scenario = scenarioFor(report, "m7c-r187-test-destroyed-device-loss-promise");
      scenario.events = eventsFor(scenario).filter((event) =>
        event.kind !== "device-destroy-requested" && event.kind !== "device-lost-observed");
      expectRejected(report, "test-destroyed-device-loss-chain-contradiction:m7c-r187-test-destroyed-device-loss-promise");
    });

    it("rejects a missing device-destroy request", () => {
      const report = copyReport();
      const scenario = scenarioFor(report, "m7c-r187-test-destroyed-device-loss-promise");
      scenario.events = eventsFor(scenario).filter((event) => event.kind !== "device-destroy-requested");
      expectRejected(report, "test-destroyed-device-loss-chain-contradiction:m7c-r187-test-destroyed-device-loss-promise");
    });

    it("rejects a missing lost-Promise observation", () => {
      const report = copyReport();
      const scenario = scenarioFor(report, "m7c-r187-test-destroyed-device-loss-promise");
      scenario.events = eventsFor(scenario).filter((event) => event.kind !== "device-lost-observed");
      expectRejected(report, "test-destroyed-device-loss-chain-contradiction:m7c-r187-test-destroyed-device-loss-promise");
    });

    it("rejects a wrong test-destroy cause", () => {
      for (const kind of ["device-destroy-requested", "device-lost-observed"]) {
        const report = copyReport();
        const scenario = scenarioFor(report, "m7c-r187-test-destroyed-device-loss-promise");
        eventFor(scenario, kind).cause = "runtime-loss";
        expectRejected(report, "test-destroyed-device-loss-chain-contradiction:m7c-r187-test-destroyed-device-loss-promise");
      }
    });

    it("rejects reversed destroy and lost-Promise ordering", () => {
      const report = copyReport();
      const scenario = scenarioFor(report, "m7c-r187-test-destroyed-device-loss-promise");
      swapSequence(eventFor(scenario, "device-destroy-requested"), eventFor(scenario, "device-lost-observed"));
      orderEvents(scenario);
      expectRejected(report, "test-destroyed-device-loss-chain-contradiction:m7c-r187-test-destroyed-device-loss-promise");
    });

    it("rejects a lost-Promise event after the runtime failure", () => {
      const report = copyReport();
      const scenario = scenarioFor(report, "m7c-r187-test-destroyed-device-loss-promise");
      swapSequence(eventFor(scenario, "device-lost-observed"), eventFor(scenario, "failure"));
      orderEvents(scenario);
      expectRejected(report, "test-destroyed-device-loss-chain-contradiction:m7c-r187-test-destroyed-device-loss-promise");
    });

    it("rejects destroy or lost events assigned to another generation or attempt", () => {
      for (const [kind, field] of [["device-destroy-requested", "generationId"], ["device-lost-observed", "attemptId"]] as const) {
        const report = copyReport();
        const scenario = scenarioFor(report, "m7c-r187-test-destroyed-device-loss-promise");
        eventFor(scenario, kind)[field] = "unrelated-identity";
        expectRejected(report, "test-destroyed-device-loss-chain-contradiction:m7c-r187-test-destroyed-device-loss-promise");
      }
    });

    it("rejects duplicate device-loss trigger evidence", () => {
      const report = copyReport();
      const scenario = scenarioFor(report, "m7c-r187-test-destroyed-device-loss-promise");
      const duplicate = { ...eventFor(scenario, "device-destroy-requested"), sequence: 30 };
      eventsFor(scenario).push(duplicate);
      orderEvents(scenario);
      expectRejected(report, "test-destroyed-device-loss-chain-contradiction:m7c-r187-test-destroyed-device-loss-promise");
    });

    it("rejects a contradictory host cleanup acknowledgement", () => {
      const report = copyReport();
      const scenario = scenarioFor(report, "m7c-r187-test-destroyed-device-loss-promise");
      eventForGeneration(scenario, "cleanup-acknowledged",
        (scenario.identity as Record<string, unknown>).rendererGenerationId).outcome = "uncertain";
      expectRejected(report, "test-destroyed-device-loss-chain-contradiction:m7c-r187-test-destroyed-device-loss-promise");
    });

    it("rejects a replacement or current publication with the wrong host identity", () => {
      for (const kind of ["replacement", "publication"] as const) {
        const report = copyReport();
        const scenario = scenarioFor(report, "m7c-r187-test-destroyed-device-loss-promise");
        const identity = scenario.identity as Record<string, unknown>;
        const event = eventsFor(scenario).find((entry) => kind === "replacement"
          ? entry.kind === "renderer-mounted" && entry.rendererFamily === "webgl-renderer" &&
            entry.generationId !== identity.rendererGenerationId && typeof entry.sequence === "number" && entry.sequence > 27
          : entry.kind === "host-frame-result" && entry.acceptedByHost === true &&
            entry.generationId !== identity.rendererGenerationId && typeof entry.sequence === "number" && entry.sequence > 27);
        if (!event) throw new Error(`Positive control is missing current ${kind}`);
        event.hostId = "unrelated-host";
        expectRejected(report, "test-destroyed-device-loss-chain-contradiction:m7c-r187-test-destroyed-device-loss-promise");
      }
    });
  });

  describe("review-fix F2: pending queue retirement cleanup chain", () => {
    it("accepts the committed confirmed-retirement event chain", () => {
      expect(evaluateGroundGlassM7cR187LifecycleEvidence(originalReport).valid).toBe(true);
    });

    it("rejects retirement without adapter cleanup", () => {
      const report = copyReport();
      const scenario = scenarioFor(report, "m7c-r187-pending-queue-retirement");
      scenario.events = eventsFor(scenario).filter((event) => event.kind !== "cleanup");
      expectRejected(report, "pending-retirement-cleanup-chain-contradiction:m7c-r187-pending-queue-retirement");
    });

    it("rejects retirement without host acknowledgement", () => {
      const report = copyReport();
      const scenario = scenarioFor(report, "m7c-r187-pending-queue-retirement");
      scenario.events = eventsFor(scenario).filter((event) => event.kind !== "cleanup-acknowledged" ||
        event.generationId !== (scenario.identity as Record<string, unknown>).rendererGenerationId);
      expectRejected(report, "pending-retirement-cleanup-chain-contradiction:m7c-r187-pending-queue-retirement");
    });

    it("rejects failed or contradictory cleanup outcomes", () => {
      for (const [kind, outcome] of [["cleanup", "failed"], ["cleanup-acknowledged", "uncertain"]] as const) {
        const report = copyReport();
        const scenario = scenarioFor(report, "m7c-r187-pending-queue-retirement");
        eventForGeneration(scenario, kind,
          (scenario.identity as Record<string, unknown>).rendererGenerationId).outcome = outcome;
        expectRejected(report, "pending-retirement-cleanup-chain-contradiction:m7c-r187-pending-queue-retirement");
      }
    });

    it("rejects a replacement mounted before adapter cleanup", () => {
      const report = copyReport();
      const scenario = scenarioFor(report, "m7c-r187-pending-queue-retirement");
      const events = eventsFor(scenario);
      const cleanup = eventFor(scenario, "cleanup");
      const replacement = events.find((event) => event.kind === "renderer-mounted" && event.rendererFamily === "webgl-renderer" &&
        event.generationId !== (scenario.identity as Record<string, unknown>).rendererGenerationId &&
        typeof event.sequence === "number" && event.sequence > 19);
      if (!replacement) throw new Error("Positive control is missing replacement mount");
      swapSequence(cleanup, replacement);
      orderEvents(scenario);
      expectRejected(report, "pending-retirement-cleanup-chain-contradiction:m7c-r187-pending-queue-retirement");
    });

    it("rejects a replacement mounted before host acknowledgement", () => {
      const report = copyReport();
      const scenario = scenarioFor(report, "m7c-r187-pending-queue-retirement");
      const ack = eventsFor(scenario).find((event) => event.kind === "cleanup-acknowledged" &&
        event.generationId === (scenario.identity as Record<string, unknown>).rendererGenerationId);
      const replacement = eventsFor(scenario).find((event) => event.kind === "renderer-mounted" && event.rendererFamily === "webgl-renderer" &&
        event.generationId !== (scenario.identity as Record<string, unknown>).rendererGenerationId &&
        typeof event.sequence === "number" && event.sequence > 19);
      if (!ack || !replacement) throw new Error("Positive control is missing cleanup/replacement ordering");
      swapSequence(ack, replacement);
      orderEvents(scenario);
      expectRejected(report, "pending-retirement-cleanup-chain-contradiction:m7c-r187-pending-queue-retirement");
    });

    it("rejects a replacement attributed to another generation, host or channel", () => {
      for (const field of ["generationId", "hostId", "channelId"] as const) {
        const report = copyReport();
        const scenario = scenarioFor(report, "m7c-r187-pending-queue-retirement");
        const replacement = eventsFor(scenario).find((event) => event.kind === "renderer-mounted" && event.rendererFamily === "webgl-renderer" &&
          event.generationId !== (scenario.identity as Record<string, unknown>).rendererGenerationId &&
          typeof event.sequence === "number" && event.sequence > 19);
        if (!replacement) throw new Error("Positive control is missing replacement mount");
        replacement[field] = field === "generationId" ? "wrong-generation" : "wrong-identity";
        expectRejected(report, "pending-retirement-cleanup-chain-contradiction:m7c-r187-pending-queue-retirement");
      }
    });

    it("rejects duplicate cleanup acknowledgements and missing queue settlement evidence", () => {
      {
        const report = copyReport();
        const scenario = scenarioFor(report, "m7c-r187-pending-queue-retirement");
        const ack = eventForGeneration(scenario, "cleanup-acknowledged",
          (scenario.identity as Record<string, unknown>).rendererGenerationId);
        eventsFor(scenario).push({ ...ack, sequence: 30 });
        orderEvents(scenario);
        expectRejected(report, "pending-retirement-cleanup-chain-contradiction:m7c-r187-pending-queue-retirement");
      }
      {
        const report = copyReport();
        const scenario = scenarioFor(report, "m7c-r187-pending-queue-retirement");
        scenario.events = eventsFor(scenario).filter((event) => event.kind !== "queue-completion-settled");
        expectRejected(report, "pending-retirement-cleanup-chain-contradiction:m7c-r187-pending-queue-retirement");
      }
    });

    it("rejects a retirement observation that does not prove a held queue and requested release", () => {
      for (const mutation of ["barrier", "release", "held-cleanup"] as const) {
        const report = copyReport();
        const scenario = scenarioFor(report, "m7c-r187-pending-queue-retirement");
        const observations = (scenario.provenance as Record<string, unknown>).observations as Array<Record<string, unknown>>;
        const retirement = observations.find((entry) => entry.kind === "pending-queue-retirement");
        if (!retirement || typeof retirement.retirementWhileHeld !== "object" || retirement.retirementWhileHeld === null) {
          throw new Error("Positive control is missing held-queue observations");
        }
        if (mutation === "barrier") retirement.queueCompletionBarrierReachedBeforeRelease = false;
        else if (mutation === "release") retirement.releaseRequested = false;
        else (retirement.retirementWhileHeld as Record<string, unknown>).cleanupStatus = "confirmed";
        expectRejected(report, "pending-retirement-cleanup-chain-contradiction:m7c-r187-pending-queue-retirement");
      }
    });
  });

  describe("review-fix F3: device-loss-equivalent trigger", () => {
    it("rejects a missing injected trigger", () => {
      const report = copyReport();
      const scenario = scenarioFor(report, "m7c-r187-device-loss-equivalent");
      scenario.events = eventsFor(scenario).filter((event) => event.kind !== "device-loss-equivalent-requested");
      expectRejected(report, "loss-equivalent-trigger-chain-contradiction:m7c-r187-device-loss-equivalent");
    });

    it("rejects an unrelated trigger cause", () => {
      const report = copyReport();
      const scenario = scenarioFor(report, "m7c-r187-device-loss-equivalent");
      const trigger = eventFor(scenario, "device-loss-equivalent-requested");
      trigger.cause = "test-destroy";
      expectRejected(report, "loss-equivalent-trigger-chain-contradiction:m7c-r187-device-loss-equivalent");
    });

    it("rejects an injected trigger attributed to another attempt or generation", () => {
      for (const field of ["generationId", "attemptId"] as const) {
        const report = copyReport();
        const scenario = scenarioFor(report, "m7c-r187-device-loss-equivalent");
        eventFor(scenario, "device-loss-equivalent-requested")[field] = "unrelated-identity";
        expectRejected(report, "loss-equivalent-trigger-chain-contradiction:m7c-r187-device-loss-equivalent");
      }
    });

    it("rejects a trigger ordered after failure or duplicated", () => {
      {
        const report = copyReport();
        const scenario = scenarioFor(report, "m7c-r187-device-loss-equivalent");
        swapSequence(eventFor(scenario, "device-loss-equivalent-requested"), eventFor(scenario, "failure"));
        orderEvents(scenario);
        expectRejected(report, "loss-equivalent-trigger-chain-contradiction:m7c-r187-device-loss-equivalent");
      }
      {
        const report = copyReport();
        const scenario = scenarioFor(report, "m7c-r187-device-loss-equivalent");
        eventsFor(scenario).push({ ...eventFor(scenario, "device-loss-equivalent-requested"), sequence: 40 });
        orderEvents(scenario);
        expectRejected(report, "loss-equivalent-trigger-chain-contradiction:m7c-r187-device-loss-equivalent");
      }
    });

    it("rejects a trigger issued before native renderer mount", () => {
      const report = copyReport();
      const scenario = scenarioFor(report, "m7c-r187-device-loss-equivalent");
      swapSequence(eventFor(scenario, "device-loss-equivalent-requested"),
        eventForGeneration(scenario, "renderer-mounted",
          (scenario.identity as Record<string, unknown>).rendererGenerationId));
      orderEvents(scenario);
      expectRejected(report, "loss-equivalent-trigger-chain-contradiction:m7c-r187-device-loss-equivalent");
    });

    it("rejects replacement before host acknowledgement", () => {
      const report = copyReport();
      const scenario = scenarioFor(report, "m7c-r187-device-loss-equivalent");
      const identity = scenario.identity as Record<string, unknown>;
      const ack = eventForGeneration(scenario, "cleanup-acknowledged", identity.rendererGenerationId);
      const replacement = eventsFor(scenario).find((event) => event.kind === "renderer-mounted" && event.rendererFamily === "webgl-renderer" &&
        event.generationId !== identity.rendererGenerationId && typeof event.sequence === "number" && event.sequence > 19);
      if (!replacement) throw new Error("Positive control is missing replacement mount");
      swapSequence(ack, replacement);
      orderEvents(scenario);
      expectRejected(report, "loss-equivalent-trigger-chain-contradiction:m7c-r187-device-loss-equivalent");
    });

    it("rejects a correct trigger with failed adapter cleanup", () => {
      const report = copyReport();
      const scenario = scenarioFor(report, "m7c-r187-device-loss-equivalent");
      eventForGeneration(scenario, "cleanup",
        (scenario.identity as Record<string, unknown>).rendererGenerationId).outcome = "failed";
      expectRejected(report, "loss-equivalent-trigger-chain-contradiction:m7c-r187-device-loss-equivalent");
    });
  });

  describe("review-fix F4: every retry and new-session generation is native", () => {
    it("rejects a WebGL2-compatible retry generation as native", () => {
      const report = copyReport();
      const scenario = scenarioFor(report, "m7c-r187-explicit-retry-new-session");
      const observations = (scenario.provenance as Record<string, unknown>).observations as Array<Record<string, unknown>>;
      const recovery = observations.find((observation) => observation.kind === "authorized-recovery-actions");
      if (!recovery || !Array.isArray(recovery.attemptsAfterExplicitRetry)) {
        throw new Error("Positive control is missing explicit retry generations");
      }
      const retryGeneration = recovery.attemptsAfterExplicitRetry[1];
      const runtime = eventsFor(scenario).find((event) =>
        event.kind === "runtime-observed" && event.generationId === retryGeneration);
      if (!runtime) throw new Error("Positive control is missing retry runtime evidence");
      runtime.executionApi = "webgl2";
      runtime.internalFallback = "webgl2-compatibility";
      expectRejected(report, "authorized-recovery-native-generation-contradiction:m7c-r187-explicit-retry-new-session");
    });

    it("rejects a WebGL2-compatible new-session generation as native", () => {
      const report = copyReport();
      const scenario = scenarioFor(report, "m7c-r187-explicit-retry-new-session");
      const observations = (scenario.provenance as Record<string, unknown>).observations as Array<Record<string, unknown>>;
      const recovery = observations.find((observation) => observation.kind === "authorized-recovery-actions");
      if (!recovery || !Array.isArray(recovery.attemptsAfterNewSession)) {
        throw new Error("Positive control is missing new-session generations");
      }
      const generation = recovery.attemptsAfterNewSession[2];
      const runtime = eventsFor(scenario).find((event) =>
        event.kind === "runtime-observed" && event.generationId === generation);
      if (!runtime) throw new Error("Positive control is missing new-session runtime evidence");
      runtime.executionApi = "webgl2";
      runtime.internalFallback = "webgl2-compatibility";
      expectRejected(report, "authorized-recovery-native-generation-contradiction:m7c-r187-explicit-retry-new-session");
    });

    it("rejects missing runtime identity, a wrong revision, or a wrong attempt identity for retries", () => {
      for (const mutation of ["missing-runtime", "revision", "attempt"] as const) {
        const report = copyReport();
        const scenario = scenarioFor(report, "m7c-r187-explicit-retry-new-session");
        const generation = "gg-mvwgvfs0-1ez92lgz77o-default-generation-4";
        const runtime = eventsFor(scenario).find((event) => event.kind === "runtime-observed" && event.generationId === generation);
        if (!runtime) throw new Error("Positive control is missing retry runtime event");
        if (mutation === "missing-runtime") scenario.events = eventsFor(scenario).filter((event) => event !== runtime);
        else if (mutation === "revision") runtime.rendererRevision = "186";
        else runtime.attemptId = "wrong-attempt";
        expectRejected(report, "authorized-recovery-native-generation-contradiction:m7c-r187-explicit-retry-new-session");
      }
    });

    it("rejects a retry attempt with mismatched request or scene attribution", () => {
      for (const field of ["requestId", "sceneId"] as const) {
        const report = copyReport();
        const scenario = scenarioFor(report, "m7c-r187-explicit-retry-new-session");
        const retryAttempt = eventsFor(scenario).find((event) => event.kind === "attempt" && String(event.generationId).endsWith("generation-4"));
        if (!retryAttempt) throw new Error("Positive control is missing retry attempt");
        retryAttempt[field] = "unrelated-attribution";
        expectRejected(report, "authorized-recovery-native-generation-contradiction:m7c-r187-explicit-retry-new-session");
      }
    });

    it("rejects retry before acknowledgement and missing failed-attempt cleanup", () => {
      {
        const report = copyReport();
        const scenario = scenarioFor(report, "m7c-r187-explicit-retry-new-session");
        const retry = eventsFor(scenario).find((event) => event.kind === "attempt" && String(event.generationId).endsWith("generation-4"));
        const acknowledgement = eventsFor(scenario).find((event) => event.kind === "cleanup-acknowledged" && String(event.generationId).endsWith("generation-2"));
        if (!retry || !acknowledgement) throw new Error("Positive control is missing retry retirement ordering");
        swapSequence(retry, acknowledgement);
        orderEvents(scenario);
        expectRejected(report, "authorized-recovery-native-generation-contradiction:m7c-r187-explicit-retry-new-session");
      }
      {
        const report = copyReport();
        const scenario = scenarioFor(report, "m7c-r187-explicit-retry-new-session");
        scenario.events = eventsFor(scenario).filter((event) => !(event.kind === "cleanup" &&
          String(event.generationId).endsWith("generation-2")));
        expectRejected(report, "authorized-recovery-native-generation-contradiction:m7c-r187-explicit-retry-new-session");
      }
      {
        const report = copyReport();
        const scenario = scenarioFor(report, "m7c-r187-explicit-retry-new-session");
        const retry = eventsFor(scenario).find((event) => event.kind === "attempt" && String(event.generationId).endsWith("generation-4"));
        const cleanup = eventsFor(scenario).find((event) => event.kind === "cleanup" && String(event.generationId).endsWith("generation-4"));
        if (!retry || !cleanup) throw new Error("Positive control is missing retry cleanup");
        scenario.events = eventsFor(scenario).filter((event) => event !== cleanup);
        expectRejected(report, "authorized-recovery-native-generation-contradiction:m7c-r187-explicit-retry-new-session");
      }
    });

    it("rejects a new-session attempt before the failed retry has acknowledged cleanup", () => {
      const report = copyReport();
      const scenario = scenarioFor(report, "m7c-r187-explicit-retry-new-session");
      const newSession = eventsFor(scenario).find((event) => event.kind === "attempt" && String(event.generationId).endsWith("generation-6"));
      const retryAcknowledgement = eventsFor(scenario).find((event) => event.kind === "cleanup-acknowledged" &&
        String(event.generationId).endsWith("generation-4"));
      if (!newSession || !retryAcknowledgement) throw new Error("Positive control is missing new-session cleanup ordering");
      swapSequence(newSession, retryAcknowledgement);
      orderEvents(scenario);
      expectRejected(report, "authorized-recovery-native-generation-contradiction:m7c-r187-explicit-retry-new-session");
    });

    it("rejects a failed retry without its host cleanup acknowledgement", () => {
      const report = copyReport();
      const scenario = scenarioFor(report, "m7c-r187-explicit-retry-new-session");
      scenario.events = eventsFor(scenario).filter((event) => !(event.kind === "cleanup-acknowledged" &&
        String(event.generationId).endsWith("generation-4")));
      expectRejected(report, "authorized-recovery-native-generation-contradiction:m7c-r187-explicit-retry-new-session");
    });

    it("rejects a failed attempt without WebGL replacement and a final publication on the wrong generation", () => {
      {
        const report = copyReport();
        const scenario = scenarioFor(report, "m7c-r187-explicit-retry-new-session");
        scenario.events = eventsFor(scenario).filter((event) => !(event.kind === "renderer-mounted" &&
          event.rendererFamily === "webgl-renderer" && String(event.generationId).endsWith("generation-3")));
        expectRejected(report, "authorized-recovery-native-generation-contradiction:m7c-r187-explicit-retry-new-session");
      }
      {
        const report = copyReport();
        const scenario = scenarioFor(report, "m7c-r187-explicit-retry-new-session");
        const finalPublication = eventsFor(scenario).find((event) => event.kind === "host-frame-result" &&
          event.generationId === "gg-mvwgvfs0-1ez92lgz77o-default-generation-6");
        if (!finalPublication) throw new Error("Positive control is missing final native publication");
        finalPublication.generationId = "gg-mvwgvfs0-1ez92lgz77o-default-generation-2";
        finalPublication.activeGenerationId = "gg-mvwgvfs0-1ez92lgz77o-default-generation-2";
        expectRejected(report, "authorized-recovery-native-generation-contradiction:m7c-r187-explicit-retry-new-session");
      }
    });
  });

  describe("pending-cleanup navigation event audit", () => {
    it("rejects a summary acknowledgement without its matching host event", () => {
      const report = copyReport();
      const scenario = scenarioFor(report, "m7c-r187-pending-cleanup-scene-navigation");
      scenario.events = eventsFor(scenario).filter((event) =>
        !(event.kind === "cleanup-acknowledged" && event.generationId ===
          (scenario.identity as Record<string, unknown>).rendererGenerationId));
      expectRejected(report, "pending-unmount-event-cleanup-contradiction:m7c-r187-pending-cleanup-scene-navigation");
    });

    it("rejects event cleanup that contradicts the summary acknowledgement", () => {
      const report = copyReport();
      const scenario = scenarioFor(report, "m7c-r187-pending-cleanup-scene-navigation");
      const generation = (scenario.identity as Record<string, unknown>).rendererGenerationId;
      eventForGeneration(scenario, "cleanup-acknowledged", generation).outcome = "uncertain";
      expectRejected(report, "pending-unmount-event-cleanup-contradiction:m7c-r187-pending-cleanup-scene-navigation");
    });

    it("rejects cleanup before unmount, a publication after unmount, or replacement on an unattached host", () => {
      {
        const report = copyReport();
        const scenario = scenarioFor(report, "m7c-r187-pending-cleanup-scene-navigation");
        const observation = ((scenario.provenance as Record<string, unknown>).observations as Array<Record<string, unknown>>)
          .find((entry) => entry.kind === "pending-cleanup-scene-remount");
        if (!observation || typeof observation.unmountSequence !== "number") throw new Error("Positive control is missing unmount evidence");
        observation.unmountSequence = 21;
        expectRejected(report, "pending-unmount-event-cleanup-contradiction:m7c-r187-pending-cleanup-scene-navigation");
      }
      {
        const report = copyReport();
        const scenario = scenarioFor(report, "m7c-r187-pending-cleanup-scene-navigation");
        const identity = scenario.identity as Record<string, unknown>;
        eventsFor(scenario).push({
          ...eventFor(scenario, "host-frame-result"), sequence: 26,
          generationId: identity.rendererGenerationId,
          activeGenerationId: identity.rendererGenerationId,
          acceptedByHost: true,
        });
        orderEvents(scenario);
        expectRejected(report, "pending-unmount-event-cleanup-contradiction:m7c-r187-pending-cleanup-scene-navigation");
      }
      {
        const report = copyReport();
        const scenario = scenarioFor(report, "m7c-r187-pending-cleanup-scene-navigation");
        const identity = scenario.identity as Record<string, unknown>;
        const replacement = eventsFor(scenario).find((event) => event.kind === "renderer-mounted" && event.rendererFamily === "webgl-renderer" &&
          event.generationId !== identity.rendererGenerationId && event.hostId !== identity.hostId);
        if (!replacement) throw new Error("Positive control is missing safe remount");
        replacement.hostId = "unattached-host";
        expectRejected(report, "pending-unmount-event-cleanup-contradiction:m7c-r187-pending-cleanup-scene-navigation");
      }
    });

    it("rejects remount before the retired generation's host acknowledgement", () => {
      const report = copyReport();
      const scenario = scenarioFor(report, "m7c-r187-pending-cleanup-scene-navigation");
      const identity = scenario.identity as Record<string, unknown>;
      const acknowledgement = eventForGeneration(scenario, "cleanup-acknowledged", identity.rendererGenerationId);
      const replacement = eventsFor(scenario).find((event) => event.kind === "renderer-mounted" &&
        event.rendererFamily === "webgl-renderer" && event.hostId !== identity.hostId);
      if (!replacement) throw new Error("Positive control is missing safe remount");
      swapSequence(acknowledgement, replacement);
      orderEvents(scenario);
      expectRejected(report, "pending-unmount-event-cleanup-contradiction:m7c-r187-pending-cleanup-scene-navigation");
    });

    it("rejects an extra native generation after remount", () => {
      const report = copyReport();
      const scenario = scenarioFor(report, "m7c-r187-pending-cleanup-scene-navigation");
      eventsFor(scenario).push({ ...eventFor(scenario, "attempt"), generationId: "unexpected-remount-generation", sequence: 26 });
      orderEvents(scenario);
      expectRejected(report, "pending-unmount-event-cleanup-contradiction:m7c-r187-pending-cleanup-scene-navigation");
    });
  });
});
