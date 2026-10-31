export const GROUND_GLASS_M7B_REQUIRED_SCENARIO_IDS = [
  "m7b-phase-a-timeout-diagnosis",
  "m7b-b1-initialization-after-target",
  "m7b-b2-runtime-failure-matrix",
  "m7b-b3-async-retirement-and-latest-request",
  "m7b-b4-cleanup-failure-sticky",
  "m7b-c1-device-loss-equivalent",
  "m7b-c2-test-destroyed-gpu-device-lost-promise",
  "m7b-d1-d3-request-and-resize-freshness",
  "m7b-d4-d5-scene-navigation-and-remount",
  "m7b-d6-rapid-transition-sequence",
  "m7b-e1-e4-retry-session-and-rejected-actions",
  "m7b-e5-independent-channel-owner",
  "m7b-e6-terminal-webgl-context-loss",
  "m7b-f-production-preview-isolation",
  "m7b-f-m5q-and-m6-regression-locks",
  "m7b-standard-validation",
  "m7b-broad-local-e2e",
] as const;

export type GroundGlassM7bScenarioId = typeof GROUND_GLASS_M7B_REQUIRED_SCENARIO_IDS[number];
export type GroundGlassM7bScenarioStatus = "passed" | "failed" | "blocked" | "not-run";
export type GroundGlassM7bQualification =
  | "qualified-for-scoped-development-pilot"
  | "partially-qualified"
  | "not-qualified"
  | "blocked-by-environment";

export type GroundGlassM7bEvidenceClass =
  | "native-webgpu-pre-mount-failure"
  | "native-webgpu-runtime"
  | "native-webgpu-runtime-failure"
  | "native-webgpu-cleanup-failure"
  | "native-webgpu-device-loss-equivalent"
  | "native-webgpu-device-destroy-lost-promise"
  | "native-webgl2"
  | "native-regression-suite"
  | "production-preview-webgl"
  | "unit-integration"
  | "environment-blocked"
  | "not-run";

export type GroundGlassM7bEvidenceEvent = Readonly<{
  sequence: number;
  kind: string;
  attemptId: string | null;
  generationId: string | null;
  requestId: string | null;
  detail: string | null;
  channelId?: string | null;
  hostId?: string | null;
  sceneId?: string | null;
  outcome?: "confirmed" | "failed" | "uncertain" | null;
  stage?: "initialization" | "runtime" | null;
  operation?: string | null;
  reason?: string | null;
  cause?: string | null;
  rendererRevision?: string | null;
  rendererFamily?: "webgpu-renderer" | "webgl-renderer" | null;
  executionApi?: "webgpu" | "webgl2" | "webgl" | null;
  internalFallback?: "none" | "webgl2-compatibility" | null;
  acceptedByHost?: boolean;
}>;

export type GroundGlassM7bScenarioEvidence = Readonly<{
  id: GroundGlassM7bScenarioId;
  title: string;
  status: GroundGlassM7bScenarioStatus;
  evidenceClass: GroundGlassM7bEvidenceClass;
  sourceHeadSha: string | null;
  testId: string | null;
  testProject: string | null;
  browserIdentity: string | null;
  threeRevision: string | null;
  invocation: string | null;
  identity: Readonly<{
    channelId: string | null;
    pilotSessionId: string | null;
    retryEpoch: number | null;
    hostId: string | null;
    attemptId: string | null;
    rendererGenerationId: string | null;
    requestId: string | null;
    sceneId: string | null;
  }>;
  requestedBackend: string | null;
  selectedBackend: string | null;
  runtime: Readonly<{
    observed: boolean;
    hostMounted: boolean;
    rendererFamily: string | null;
    actualExecutionApi: string | null;
    internalFallback: string | null;
  }>;
  applicationFallback: boolean | null;
  events: readonly GroundGlassM7bEvidenceEvent[];
  cleanupOutcome: "confirmed" | "failed" | "uncertain" | "not-required" | "not-observed";
  fallbackOutcome: "webgl-mounted" | "unavailable" | "none" | "not-observed";
  publication: Readonly<{
    status: "current" | "stale-rejected" | "not-applicable" | "not-observed";
    acceptedRequestId: string | null;
    completedRequestId: string | null;
  }>;
  supportingArtifacts: readonly string[];
  limitations: readonly string[];
}>;

export type GroundGlassM7bEvidenceReport = Readonly<{
  schemaVersion: "ground-glass-m7b-native-lifecycle-v1";
  sourceHeadSha: string;
  qualification: GroundGlassM7bQualification;
  scenarios: readonly GroundGlassM7bScenarioEvidence[];
}>;

export type GroundGlassM7bEvidenceEvaluation = Readonly<{
  valid: boolean;
  errors: readonly string[];
  qualification: GroundGlassM7bQualification;
  counts: Readonly<Record<GroundGlassM7bScenarioStatus, number>>;
}>;

const evidenceClasses = new Set<GroundGlassM7bEvidenceClass>([
  "native-webgpu-pre-mount-failure",
  "native-webgpu-runtime",
  "native-webgpu-runtime-failure",
  "native-webgpu-cleanup-failure",
  "native-webgpu-device-loss-equivalent",
  "native-webgpu-device-destroy-lost-promise",
  "native-webgl2",
  "native-regression-suite",
  "production-preview-webgl",
  "unit-integration",
  "environment-blocked",
  "not-run",
]);

const statuses = new Set<GroundGlassM7bScenarioStatus>(["passed", "failed", "blocked", "not-run"]);

const requiredEvidenceClassByScenario: Readonly<Record<GroundGlassM7bScenarioId, GroundGlassM7bEvidenceClass>> = {
  "m7b-phase-a-timeout-diagnosis": "native-webgpu-runtime",
  "m7b-b1-initialization-after-target": "native-webgpu-pre-mount-failure",
  "m7b-b2-runtime-failure-matrix": "native-webgpu-runtime-failure",
  "m7b-b3-async-retirement-and-latest-request": "native-webgpu-runtime-failure",
  "m7b-b4-cleanup-failure-sticky": "native-webgpu-cleanup-failure",
  "m7b-c1-device-loss-equivalent": "native-webgpu-device-loss-equivalent",
  "m7b-c2-test-destroyed-gpu-device-lost-promise": "native-webgpu-device-destroy-lost-promise",
  "m7b-d1-d3-request-and-resize-freshness": "native-webgpu-runtime",
  "m7b-d4-d5-scene-navigation-and-remount": "native-webgpu-pre-mount-failure",
  "m7b-d6-rapid-transition-sequence": "native-webgpu-runtime-failure",
  "m7b-e1-e4-retry-session-and-rejected-actions": "native-webgpu-runtime",
  "m7b-e5-independent-channel-owner": "unit-integration",
  "m7b-e6-terminal-webgl-context-loss": "native-webgl2",
  "m7b-f-production-preview-isolation": "production-preview-webgl",
  "m7b-f-m5q-and-m6-regression-locks": "native-regression-suite",
  "m7b-standard-validation": "unit-integration",
  "m7b-broad-local-e2e": "environment-blocked",
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const eventSequence = (
  scenario: Record<string, unknown>,
  kind: string,
  generationId?: string,
): number | null => {
  const events = scenario.events;
  if (!Array.isArray(events)) return null;
  const event = events.find((value) => isObject(value) && value.kind === kind &&
    (generationId === undefined || value.generationId === generationId));
  return isObject(event) && typeof event.sequence === "number" ? event.sequence : null;
};

const eventFor = (scenario: Record<string, unknown>, kind: string, generationId?: string): Record<string, unknown> | null => {
  const events = scenario.events;
  if (!Array.isArray(events)) return null;
  const event = events.find((value) => isObject(value) && value.kind === kind &&
    (generationId === undefined || value.generationId === generationId));
  return isObject(event) ? event : null;
};

const eventMatchesScenarioIdentity = (
  scenario: Record<string, unknown>,
  event: Record<string, unknown> | null,
  requireRequest = false,
): boolean => {
  if (!event || !isObject(scenario.identity)) return false;
  const identity = scenario.identity;
  return event.generationId === identity.rendererGenerationId &&
    event.attemptId === identity.attemptId &&
    (!requireRequest || event.requestId === identity.requestId) &&
    (event.requestId === undefined || event.requestId === null || event.requestId === identity.requestId) &&
    (event.sceneId === undefined || event.sceneId === identity.sceneId) &&
    (event.channelId === undefined || event.channelId === identity.channelId) &&
    (event.hostId === undefined || event.hostId === identity.hostId);
};

const hasEvent = (scenario: Record<string, unknown>, kind: string, generationId?: string): boolean =>
  eventSequence(scenario, kind, generationId) !== null;

const evaluateQualification = (
  counts: Readonly<Record<GroundGlassM7bScenarioStatus, number>>,
): GroundGlassM7bQualification => {
  if (counts.failed > 0) return "not-qualified";
  if (counts.passed === GROUND_GLASS_M7B_REQUIRED_SCENARIO_IDS.length) {
    return "qualified-for-scoped-development-pilot";
  }
  if (counts.passed === 0 && counts.blocked > 0) return "blocked-by-environment";
  return "partially-qualified";
};


/** An event summary is never proof of native execution unless the observed events agree. */
const validateM7bObservedRuntime = (
  scenario: Record<string, unknown>,
  scenarioId: string,
  errors: string[],
): void => {
  const kind = scenario.evidenceClass;
  if (typeof kind !== "string" || !kind.startsWith("native-webgpu-")) return;
  if (!isObject(scenario.identity) || !isObject(scenario.runtime)) return;
  const generation = scenario.identity.rendererGenerationId;
  if (!isNonEmptyString(generation)) return;
  const attempt = eventFor(scenario, "attempt", generation);
  const observed = eventFor(scenario, "runtime-observed", generation);
  const mounted = eventFor(scenario, "renderer-mounted", generation);
  const preMount = kind === "native-webgpu-pre-mount-failure" || kind === "native-webgpu-cleanup-failure";
  const expectedRevision = scenario.threeRevision;
  if (
    !eventMatchesScenarioIdentity(scenario, attempt, true) ||
    !eventMatchesScenarioIdentity(scenario, observed) ||
    !observed ||
    observed.rendererFamily !== "webgpu-renderer" ||
    observed.executionApi !== "webgpu" ||
    observed.rendererRevision !== expectedRevision ||
    attempt?.rendererRevision !== expectedRevision ||
    scenario.runtime.rendererFamily !== observed.rendererFamily ||
    scenario.runtime.actualExecutionApi !== observed.executionApi ||
    scenario.runtime.internalFallback !== "none"
  ) {
    errors.push("observed-native-runtime-contradiction:" + scenarioId);
  }
  if (preMount) {
    if (mounted !== null || scenario.runtime.hostMounted !== false) {
      errors.push("pre-mount-renderer-observation-contradiction:" + scenarioId);
    }
  } else if (
    !eventMatchesScenarioIdentity(scenario, mounted, true) ||
    mounted?.rendererFamily !== observed?.rendererFamily ||
    mounted?.executionApi !== observed?.executionApi ||
    mounted?.internalFallback !== "none" ||
    scenario.runtime.hostMounted !== true
  ) {
    errors.push("mounted-native-runtime-contradiction:" + scenarioId);
  }
};

/** A replacement is never qualified if adapter and host cleanup disagree. */
const validateM7bCleanupFallback = (
  scenario: Record<string, unknown>,
  scenarioId: string,
  errors: string[],
): void => {
  const cleanupClasses = new Set([
    "native-webgpu-pre-mount-failure",
    "native-webgpu-runtime-failure",
    "native-webgpu-cleanup-failure",
    "native-webgpu-device-loss-equivalent",
    "native-webgpu-device-destroy-lost-promise",
  ]);
  if (!cleanupClasses.has(String(scenario.evidenceClass)) || !isObject(scenario.identity)) return;
  const generation = scenario.identity.rendererGenerationId;
  if (!isNonEmptyString(generation)) return;
  const adapter = eventFor(scenario, "cleanup", generation);
  const host = eventFor(scenario, "cleanup-acknowledged", generation);
  const adapterSeq = adapter?.sequence;
  const hostSeq = host?.sequence;
  if (
    !eventMatchesScenarioIdentity(scenario, adapter) ||
    !host ||
    host.generationId !== generation ||
    host.hostId !== scenario.identity.hostId ||
    host.channelId !== scenario.identity.channelId ||
    adapter?.outcome !== scenario.cleanupOutcome ||
    host.outcome !== scenario.cleanupOutcome ||
    typeof adapterSeq !== "number" ||
    typeof hostSeq !== "number" ||
    adapterSeq >= hostSeq
  ) {
    errors.push("cleanup-host-acknowledgement-contradiction:" + scenarioId);
  }

  if (scenario.fallbackOutcome === "webgl-mounted" || scenario.applicationFallback === true) {
    if (
      scenario.cleanupOutcome !== "confirmed" ||
      scenario.fallbackOutcome !== "webgl-mounted" ||
      scenario.applicationFallback !== true
    ) {
      errors.push("fallback-before-confirmed-cleanup:" + scenarioId);
    }
    const events = Array.isArray(scenario.events) ? scenario.events.filter(isObject) : [];
    const replacement = events.find((event) =>
      event.kind === "renderer-mounted" &&
      event.generationId !== generation &&
      event.channelId === scenario.identity.channelId &&
      event.rendererFamily === "webgl-renderer" &&
      (event.executionApi === "webgl" || event.executionApi === "webgl2") &&
      event.internalFallback === "none" &&
      typeof event.sequence === "number" &&
      typeof hostSeq === "number" &&
      event.sequence > hostSeq
    );
    if (!replacement) errors.push("missing-confirmed-webgl-replacement:" + scenarioId);
  } else if (scenario.cleanupOutcome === "failed" || scenario.cleanupOutcome === "uncertain") {
    if (scenario.applicationFallback !== false || scenario.fallbackOutcome !== "unavailable") {
      errors.push("failed-cleanup-allows-replacement:" + scenarioId);
    }
  }
};

/** Host acceptance is distinct from an adapter's frame-completed notification. */
const validateM7bPublication = (
  scenario: Record<string, unknown>,
  scenarioId: string,
  errors: string[],
): void => {
  if (!isObject(scenario.publication)) return;
  const pub = scenario.publication;
  if (pub.status !== "current" && pub.status !== "stale-rejected") return;
  const events = Array.isArray(scenario.events) ? scenario.events.filter(isObject) : [];
  const result = events.findLast((event) =>
    event.kind === "host-frame-result" &&
    event.frameStatus === "completed" &&
    event.requestId === pub.completedRequestId
  );
  const latest = result?.latestAcceptedRequestId;
  const identityMatches = result &&
    result.channelId === (isObject(scenario.identity) ? scenario.identity.channelId : null) &&
    isNonEmptyString(result.generationId) &&
    result.activeGenerationId === result.generationId &&
    isNonEmptyString(result.sceneId) &&
    isNonEmptyString(result.hostId) &&
    result.latestAcceptedRequestId === pub.acceptedRequestId;
  if (!identityMatches || !isNonEmptyString(latest)) {
    errors.push("missing-host-publication-evidence:" + scenarioId);
    return;
  }
  if (pub.status === "current") {
    if (result.acceptedByHost !== true || result.requestId !== latest) {
      errors.push("current-publication-not-accepted-by-host:" + scenarioId);
    }
  } else if (result.acceptedByHost !== false || result.requestId === latest) {
    errors.push("stale-publication-not-rejected-by-host:" + scenarioId);
  }
  const retirement = events.find((event) =>
    event.kind === "cleanup-acknowledged" && event.generationId === result.generationId &&
    typeof event.sequence === "number" && event.sequence < result.sequence
  );
  if (retirement) errors.push("publication-after-generation-retirement:" + scenarioId);
  const retired = isObject(scenario.identity) ? scenario.identity.rendererGenerationId : null;
  if (scenario.fallbackOutcome === "webgl-mounted" && retired) {
    const hostCleanup = eventFor(scenario, "cleanup-acknowledged", String(retired));
    const replacement = events.find((event) =>
      event.kind === "renderer-mounted" && event.generationId === result.generationId &&
      event.rendererFamily === "webgl-renderer" &&
      (event.executionApi === "webgl" || event.executionApi === "webgl2")
    );
    if (
      result.generationId === retired ||
      !hostCleanup ||
      !replacement ||
      typeof result.sequence !== "number" ||
      typeof replacement.sequence !== "number" ||
      typeof hostCleanup.sequence !== "number" ||
      !(hostCleanup.sequence < replacement.sequence && replacement.sequence < result.sequence)
    ) errors.push("publication-not-from-confirmed-replacement:" + scenarioId);
  }
};

/** Validates the committed M7B evidence inventory before accepting its qualification label. */
export const evaluateGroundGlassM7bLifecycleEvidence = (input: unknown): GroundGlassM7bEvidenceEvaluation => {
  const errors: string[] = [];
  const counts: Record<GroundGlassM7bScenarioStatus, number> = {
    passed: 0,
    failed: 0,
    blocked: 0,
    "not-run": 0,
  };
  if (!isObject(input)) {
    return {
      valid: false,
      errors: ["report-must-be-an-object"],
      qualification: "partially-qualified",
      counts,
    };
  }

  if (input.schemaVersion !== "ground-glass-m7b-native-lifecycle-v1") {
    errors.push("unsupported-schema-version");
  }
  if (!isNonEmptyString(input.sourceHeadSha)) errors.push("missing-source-head-sha");
  if (!Array.isArray(input.scenarios)) {
    errors.push("scenario-inventory-must-be-an-array");
    return {
      valid: false,
      errors,
      qualification: "partially-qualified",
      counts,
    };
  }

  const scenarios = input.scenarios.filter(isObject);
  if (scenarios.length !== input.scenarios.length) errors.push("scenario-entry-must-be-an-object");
  const byId = new Map<string, Record<string, unknown>>();
  for (const scenario of scenarios) {
    if (!isNonEmptyString(scenario.id)) {
      errors.push("scenario-missing-id");
      continue;
    }
    if (byId.has(scenario.id)) {
      errors.push(`duplicate-scenario:${scenario.id}`);
      continue;
    }
    byId.set(scenario.id, scenario);
  }

  for (const requiredId of GROUND_GLASS_M7B_REQUIRED_SCENARIO_IDS) {
    const scenario = byId.get(requiredId);
    if (!scenario) {
      errors.push(`missing-required-scenario:${requiredId}`);
      continue;
    }
    if (!statuses.has(scenario.status as GroundGlassM7bScenarioStatus)) {
      errors.push(`invalid-status:${requiredId}`);
      continue;
    }
    const status = scenario.status as GroundGlassM7bScenarioStatus;
    counts[status] += 1;
    if (!evidenceClasses.has(scenario.evidenceClass as GroundGlassM7bEvidenceClass)) {
      errors.push(`invalid-evidence-class:${requiredId}`);
    }
    if (status !== "not-run" && scenario.evidenceClass !== requiredEvidenceClassByScenario[requiredId]) {
      errors.push(`evidence-class-does-not-match-scenario:${requiredId}`);
    }
    if (!isNonEmptyString(scenario.title)) errors.push(`missing-title:${requiredId}`);
    if (!Array.isArray(scenario.events)) errors.push(`missing-event-list:${requiredId}`);
    if (!Array.isArray(scenario.supportingArtifacts)) errors.push(`missing-artifact-list:${requiredId}`);
    if (!Array.isArray(scenario.limitations)) errors.push(`missing-limitations-list:${requiredId}`);

    if (status === "not-run") {
      if (scenario.evidenceClass !== "not-run") errors.push(`not-run-class-mismatch:${requiredId}`);
      if (scenario.sourceHeadSha !== null) errors.push(`not-run-has-source-evidence:${requiredId}`);
      if (Array.isArray(scenario.events) && scenario.events.length > 0) errors.push(`not-run-has-events:${requiredId}`);
      if (scenario.testId !== null || scenario.testProject !== null || scenario.browserIdentity !== null ||
        scenario.threeRevision !== null || scenario.invocation !== null || scenario.applicationFallback !== null) {
        errors.push(`not-run-has-execution-evidence:${requiredId}`);
      }
      if (isObject(scenario.identity) && Object.values(scenario.identity).some((value) => value !== null)) {
        errors.push(`not-run-has-runtime-identity:${requiredId}`);
      }
      if (isObject(scenario.runtime) && (scenario.runtime.observed !== false || scenario.runtime.hostMounted !== false ||
        scenario.runtime.rendererFamily !== null || scenario.runtime.actualExecutionApi !== null || scenario.runtime.internalFallback !== null)) {
        errors.push(`not-run-has-runtime-observation:${requiredId}`);
      }
      if (scenario.cleanupOutcome !== "not-observed" || scenario.fallbackOutcome !== "not-observed" ||
        !isObject(scenario.publication) || scenario.publication.status !== "not-observed") {
        errors.push(`not-run-has-lifecycle-outcome:${requiredId}`);
      }
      continue;
    }

    if (scenario.sourceHeadSha !== input.sourceHeadSha) errors.push(`stale-source-head:${requiredId}`);
    if (!isNonEmptyString(scenario.sourceHeadSha) || !/^[\da-f]{40}$/i.test(scenario.sourceHeadSha)) {
      errors.push(`invalid-source-head-sha:${requiredId}`);
    }
    if (!isNonEmptyString(scenario.testId)) errors.push(`missing-test-id:${requiredId}`);
    if (!isNonEmptyString(scenario.testProject)) errors.push(`missing-test-project:${requiredId}`);
    if (!isNonEmptyString(scenario.invocation)) errors.push(`missing-invocation:${requiredId}`);
    if (!isObject(scenario.identity)) {
      errors.push(`missing-identity:${requiredId}`);
    }
    if (!isObject(scenario.runtime)) errors.push(`missing-runtime-evidence:${requiredId}`);
    if (!isObject(scenario.publication)) errors.push(`missing-publication-evidence:${requiredId}`);

    const attemptBoundNativeClasses = new Set<GroundGlassM7bEvidenceClass>([
      "native-webgpu-pre-mount-failure",
      "native-webgpu-runtime",
      "native-webgpu-runtime-failure",
      "native-webgpu-cleanup-failure",
      "native-webgpu-device-loss-equivalent",
      "native-webgpu-device-destroy-lost-promise",
    ]);
    const nativeClass = typeof scenario.evidenceClass === "string" && scenario.evidenceClass.startsWith("native-");
    if (nativeClass && status === "passed") {
      if (!isNonEmptyString(scenario.browserIdentity)) errors.push(`missing-browser-identity:${requiredId}`);
      if (!isNonEmptyString(scenario.threeRevision)) errors.push(`missing-three-revision:${requiredId}`);
      if (attemptBoundNativeClasses.has(scenario.evidenceClass as GroundGlassM7bEvidenceClass)) {
        if (!isObject(scenario.identity)) continue;
        for (const identityKey of [
          "channelId",
          "pilotSessionId",
          "hostId",
          "attemptId",
          "rendererGenerationId",
          "requestId",
          "sceneId",
        ]) {
          if (!isNonEmptyString(scenario.identity[identityKey])) {
            errors.push(`missing-native-identity-${identityKey}:${requiredId}`);
          }
        }
        if (!Number.isInteger(scenario.identity.retryEpoch) || (scenario.identity.retryEpoch as number) < 0) {
          errors.push(`invalid-native-retry-epoch:${requiredId}`);
        }
      }
    }

    if (Array.isArray(scenario.events)) {
      let previousSequence = -1;
      const seenSequences = new Set<number>();
      for (const event of scenario.events) {
        if (!isObject(event)) {
          errors.push(`invalid-event-object:${requiredId}`);
          continue;
        }
        if (!Number.isInteger(event.sequence) || (event.sequence as number) < 0) {
          errors.push(`invalid-event-sequence:${requiredId}`);
          continue;
        }
        const sequence = event.sequence as number;
        if (seenSequences.has(sequence) || sequence <= previousSequence) errors.push(`stale-or-duplicate-event-order:${requiredId}`);
        seenSequences.add(sequence);
        previousSequence = sequence;
        if (!isNonEmptyString(event.kind)) errors.push(`event-missing-kind:${requiredId}`);
      }
    }

    if (status !== "passed") continue;
    validateM7bObservedRuntime(scenario, requiredId, errors);
    validateM7bCleanupFallback(scenario, requiredId, errors);
    validateM7bPublication(scenario, requiredId, errors);
    if (scenario.evidenceClass === "native-webgpu-pre-mount-failure") {
      const identityGenerationId = isObject(scenario.identity) && isNonEmptyString(scenario.identity.rendererGenerationId)
        ? scenario.identity.rendererGenerationId
        : undefined;
      if (!isObject(scenario.runtime) || scenario.runtime.observed !== true || scenario.runtime.hostMounted !== false) {
        errors.push(`pre-mount-runtime-identity-contradiction:${requiredId}`);
      }
      const attempt = eventSequence(scenario, "attempt", identityGenerationId);
      const runtime = eventSequence(scenario, "runtime-observed", identityGenerationId);
      const failure = eventSequence(scenario, "failure", identityGenerationId);
      const cleanup = eventSequence(scenario, "cleanup-acknowledged", identityGenerationId);
      const attemptEvidence = eventFor(scenario, "attempt", identityGenerationId);
      const runtimeEvidence = eventFor(scenario, "runtime-observed", identityGenerationId);
      const failureEvidence = eventFor(scenario, "failure", identityGenerationId);
      const cleanupEvidence = eventFor(scenario, "cleanup-acknowledged", identityGenerationId);
      if (attempt === null || runtime === null || failure === null || cleanup === null ||
        !(attempt < runtime && runtime < failure && failure < cleanup) ||
        !eventMatchesScenarioIdentity(scenario, attemptEvidence, true) ||
        !eventMatchesScenarioIdentity(scenario, runtimeEvidence) ||
        !eventMatchesScenarioIdentity(scenario, failureEvidence, true) ||
        !cleanupEvidence || !isObject(scenario.identity) || cleanupEvidence.generationId !== identityGenerationId ||
        cleanupEvidence.channelId !== scenario.identity.channelId || cleanupEvidence.hostId !== scenario.identity.hostId ||
        cleanupEvidence.outcome !== scenario.cleanupOutcome) {
        errors.push(`invalid-pre-mount-failure-order:${requiredId}`);
      }
      if (hasEvent(scenario, "renderer-mounted", identityGenerationId)) {
        errors.push(`pre-mount-failure-claims-mounted-renderer:${requiredId}`);
      }
      if (!isObject(scenario.runtime) || scenario.runtime.rendererFamily !== "webgpu-renderer" ||
        scenario.runtime.actualExecutionApi !== "webgpu" || scenario.runtime.internalFallback !== "none") {
        errors.push(`native-webgpu-runtime-identity-contradiction:${requiredId}`);
      }
      if (scenario.applicationFallback !== true || scenario.fallbackOutcome !== "webgl-mounted") {
        errors.push(`pre-mount-failure-fallback-contradiction:${requiredId}`);
      }
    }
    if (scenario.evidenceClass === "native-webgpu-runtime" || scenario.evidenceClass === "native-regression-suite") {
      if (!isObject(scenario.runtime) || scenario.runtime.observed !== true || scenario.runtime.hostMounted !== true ||
        scenario.runtime.rendererFamily !== "webgpu-renderer" || scenario.runtime.actualExecutionApi !== "webgpu" ||
        scenario.runtime.internalFallback !== "none") {
        errors.push(`native-webgpu-runtime-identity-contradiction:${requiredId}`);
      }
      if (scenario.evidenceClass === "native-webgpu-runtime") {
        const generationId = isObject(scenario.identity) && isNonEmptyString(scenario.identity.rendererGenerationId)
          ? scenario.identity.rendererGenerationId
          : undefined;
        const attempt = eventSequence(scenario, "attempt", generationId);
        const runtime = eventSequence(scenario, "runtime-observed", generationId);
        const mounted = eventSequence(scenario, "renderer-mounted", generationId);
        if (attempt === null || runtime === null || mounted === null || !(attempt < runtime && runtime < mounted) ||
          !eventMatchesScenarioIdentity(scenario, eventFor(scenario, "attempt", generationId), true) ||
          !eventMatchesScenarioIdentity(scenario, eventFor(scenario, "runtime-observed", generationId)) ||
          !eventMatchesScenarioIdentity(scenario, eventFor(scenario, "renderer-mounted", generationId), true)) {
          errors.push(`invalid-native-runtime-observation-order:${requiredId}`);
        }
      }
    }
    if (scenario.evidenceClass === "native-webgpu-cleanup-failure") {
      const generationId = isObject(scenario.identity) && isNonEmptyString(scenario.identity.rendererGenerationId)
        ? scenario.identity.rendererGenerationId
        : undefined;
      const attempt = eventSequence(scenario, "attempt", generationId);
      const runtime = eventSequence(scenario, "runtime-observed", generationId);
      const failure = eventSequence(scenario, "failure", generationId);
      const cleanup = eventSequence(scenario, "cleanup", generationId);
      const cleanupAcknowledged = eventSequence(scenario, "cleanup-acknowledged", generationId);
      const cleanupEvidence = eventFor(scenario, "cleanup-acknowledged", generationId);
      if (!isObject(scenario.runtime) || scenario.runtime.observed !== true || scenario.runtime.hostMounted !== false ||
        scenario.runtime.rendererFamily !== "webgpu-renderer" || scenario.runtime.actualExecutionApi !== "webgpu" ||
        scenario.runtime.internalFallback !== "none") {
        errors.push(`cleanup-failure-runtime-identity-contradiction:${requiredId}`);
      }
      if (attempt === null || runtime === null || failure === null || cleanup === null || cleanupAcknowledged === null ||
        !(attempt < runtime && runtime < failure && failure < cleanup && cleanup < cleanupAcknowledged) ||
        !eventMatchesScenarioIdentity(scenario, eventFor(scenario, "attempt", generationId), true) ||
        !eventMatchesScenarioIdentity(scenario, eventFor(scenario, "runtime-observed", generationId)) ||
        !eventMatchesScenarioIdentity(scenario, eventFor(scenario, "failure", generationId), true) ||
        !eventMatchesScenarioIdentity(scenario, eventFor(scenario, "cleanup", generationId)) ||
        !cleanupEvidence || !isObject(scenario.identity) || cleanupEvidence.outcome !== "failed" ||
        cleanupEvidence.channelId !== scenario.identity.channelId || cleanupEvidence.hostId !== scenario.identity.hostId) {
        errors.push(`invalid-cleanup-failure-order:${requiredId}`);
      }
      if (hasEvent(scenario, "renderer-mounted", generationId)) {
        errors.push(`cleanup-failure-claims-mounted-renderer:${requiredId}`);
      }
      if (scenario.cleanupOutcome !== "failed" || scenario.applicationFallback !== false || scenario.fallbackOutcome !== "unavailable") {
        errors.push(`cleanup-failure-fallback-contradiction:${requiredId}`);
      }
    }
    if (
      scenario.evidenceClass === "native-webgpu-runtime-failure" ||
      scenario.evidenceClass === "native-webgpu-device-loss-equivalent" ||
      scenario.evidenceClass === "native-webgpu-device-destroy-lost-promise"
    ) {
      const identityGenerationId = isObject(scenario.identity) && isNonEmptyString(scenario.identity.rendererGenerationId)
        ? scenario.identity.rendererGenerationId
        : undefined;
      if (!isObject(scenario.runtime) || scenario.runtime.observed !== true || scenario.runtime.hostMounted !== true ||
        scenario.runtime.rendererFamily !== "webgpu-renderer" || scenario.runtime.actualExecutionApi !== "webgpu" ||
        scenario.runtime.internalFallback !== "none") {
        errors.push(`native-webgpu-runtime-identity-contradiction:${requiredId}`);
      }
      const attempt = eventSequence(scenario, "attempt", identityGenerationId);
      const runtime = eventSequence(scenario, "runtime-observed", identityGenerationId);
      const mounted = eventSequence(scenario, "renderer-mounted", identityGenerationId);
      const failure = eventSequence(scenario, "failure", identityGenerationId);
      const cleanup = eventSequence(scenario, "cleanup", identityGenerationId);
      const attemptEvidence = eventFor(scenario, "attempt", identityGenerationId);
      const runtimeEvidence = eventFor(scenario, "runtime-observed", identityGenerationId);
      const mountedEvidence = eventFor(scenario, "renderer-mounted", identityGenerationId);
      const failureEvidence = eventFor(scenario, "failure", identityGenerationId);
      const cleanupEvidence = eventFor(scenario, "cleanup", identityGenerationId);
      if (attempt === null || runtime === null || mounted === null || failure === null || cleanup === null ||
        !(attempt < runtime && runtime < mounted && mounted < failure && failure < cleanup) ||
        !eventMatchesScenarioIdentity(scenario, attemptEvidence, true) ||
        !eventMatchesScenarioIdentity(scenario, runtimeEvidence) ||
        !eventMatchesScenarioIdentity(scenario, mountedEvidence, true) ||
        !eventMatchesScenarioIdentity(scenario, failureEvidence, true) ||
        !eventMatchesScenarioIdentity(scenario, cleanupEvidence) ||
        cleanupEvidence?.outcome !== scenario.cleanupOutcome) {
        errors.push(`invalid-mounted-failure-order:${requiredId}`);
      }
      if (scenario.evidenceClass === "native-webgpu-device-loss-equivalent" && !hasEvent(scenario, "device-loss-equivalent-requested")) {
        errors.push(`missing-device-loss-equivalent-trigger:${requiredId}`);
      }
      if (scenario.evidenceClass === "native-webgpu-device-destroy-lost-promise") {
        const destroy = eventSequence(scenario, "device-destroy-requested", identityGenerationId);
        const lost = eventSequence(scenario, "device-lost-observed", identityGenerationId);
        if (destroy === null || lost === null || !(destroy < lost && lost < failure!)) {
          errors.push(`invalid-test-destroy-device-loss-order:${requiredId}`);
        }
        const scenarioEvents = Array.isArray(scenario.events) ? scenario.events : [];
        const lostEvent = scenarioEvents.find((event) => isObject(event) && event.kind === "device-lost-observed" &&
          event.generationId === identityGenerationId);
        if (!isObject(lostEvent) || lostEvent.cause !== "test-destroy" ||
          !eventMatchesScenarioIdentity(scenario, lostEvent)) {
          errors.push(`device-loss-cause-not-distinguished:${requiredId}`);
        }
      }
    }
    if (scenario.evidenceClass === "native-webgl2") {
      if (isObject(scenario.identity)) {
        for (const identityKey of ["channelId", "hostId", "attemptId", "rendererGenerationId", "requestId", "sceneId"]) {
          if (!isNonEmptyString(scenario.identity[identityKey])) errors.push(`missing-native-identity-${identityKey}:${requiredId}`);
        }
      }
      const identityGenerationId = isObject(scenario.identity) && isNonEmptyString(scenario.identity.rendererGenerationId)
        ? scenario.identity.rendererGenerationId
        : undefined;
      if (!isObject(scenario.runtime) || scenario.runtime.hostMounted !== true ||
        scenario.runtime.rendererFamily !== "webgl-renderer" || scenario.runtime.actualExecutionApi !== "webgl2" ||
        scenario.runtime.internalFallback !== "none") {
        errors.push(`native-webgl-runtime-identity-contradiction:${requiredId}`);
      }
      const failedFrame = eventSequence(scenario, "failed-frame-result", identityGenerationId);
      const cleanup = eventSequence(scenario, "cleanup-acknowledged", identityGenerationId);
      if (failedFrame === null || cleanup === null || !(failedFrame < cleanup)) {
        errors.push(`invalid-webgl-terminal-failure-order:${requiredId}`);
      }
      const failedFrameEvidence = eventFor(scenario, "failed-frame-result", identityGenerationId);
      const identityRequestId = isObject(scenario.identity) ? scenario.identity.requestId : undefined;
      if (!failedFrameEvidence || failedFrameEvidence.acceptedByHost !== true ||
        failedFrameEvidence.requestId !== identityRequestId ||
        !eventMatchesScenarioIdentity(scenario, failedFrameEvidence, true)) {
        errors.push(`webgl-failure-not-attributed-to-current-request:${requiredId}`);
      }
      const cleanupEvidence = eventFor(scenario, "cleanup-acknowledged", identityGenerationId);
      if (!cleanupEvidence || !isObject(scenario.identity) || cleanupEvidence.outcome !== scenario.cleanupOutcome ||
        cleanupEvidence.generationId !== identityGenerationId ||
        cleanupEvidence.channelId !== scenario.identity.channelId || cleanupEvidence.hostId !== scenario.identity.hostId) {
        errors.push(`webgl-cleanup-outcome-mismatch:${requiredId}`);
      }
      if (scenario.applicationFallback !== false || scenario.fallbackOutcome !== "unavailable") {
        errors.push(`webgl-terminal-failure-fallback-contradiction:${requiredId}`);
      }
    }
    if (isObject(scenario.publication)) {
      if (!["current", "stale-rejected", "not-applicable", "not-observed"].includes(String(scenario.publication.status))) {
        errors.push(`invalid-publication-status:${requiredId}`);
      }
      if (scenario.publication.status === "current" &&
        (!isNonEmptyString(scenario.publication.acceptedRequestId) ||
          scenario.publication.completedRequestId !== scenario.publication.acceptedRequestId)) {
        errors.push(`current-publication-identity-mismatch:${requiredId}`);
      }
      if (scenario.publication.status === "stale-rejected" &&
        (!isNonEmptyString(scenario.publication.acceptedRequestId) ||
          !isNonEmptyString(scenario.publication.completedRequestId) ||
          scenario.publication.acceptedRequestId === scenario.publication.completedRequestId)) {
        errors.push(`stale-publication-identity-contradiction:${requiredId}`);
      }
    }
  }

  for (const scenarioId of byId.keys()) {
    if (!(GROUND_GLASS_M7B_REQUIRED_SCENARIO_IDS as readonly string[]).includes(scenarioId)) {
      errors.push(`unexpected-scenario:${scenarioId}`);
    }
  }

  const computedQualification = evaluateQualification(counts);
  if (input.qualification !== computedQualification) errors.push("qualification-does-not-match-evidence-inventory");
  const valid = errors.length === 0;
  return {
    valid,
    errors,
    qualification: valid ? computedQualification : "not-qualified",
    counts,
  };
};
