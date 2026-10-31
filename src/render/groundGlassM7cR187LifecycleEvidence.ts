import {
  ARCHITECTURE_RISE_RAW_RTT_R187_EVIDENCE_REVISION,
  ARCHITECTURE_RISE_RAW_RTT_R187_VERIFIED_RENDERER_REVISION,
} from "./webgpu/groundGlassRawWebGpuCompatibility";
import { validateGroundGlassLifecycleScenarioContracts } from "./groundGlassM7bLifecycleEvidence";

export const GROUND_GLASS_M7C_R187_REQUIRED_SCENARIO_IDS = [
  "m7c-r187-native-raw-baseline",
  "m7c-r187-init-after-target-fallback",
  "m7c-r187-scene-render-failure",
  "m7c-r187-queue-completion-rejection",
  "m7c-r187-presentation-failure",
  "m7c-r187-adapter-disposal-failure",
  "m7c-r187-device-loss-equivalent",
  "m7c-r187-test-destroyed-device-loss-promise",
  "m7c-r187-pending-queue-retirement",
  "m7c-r187-latest-request-stale-rejection",
  "m7c-r187-sticky-fallback-remount",
  "m7c-r187-explicit-retry-new-session",
  "m7c-r187-webgl2-compatibility-negative-control",
  "m7c-r187-terminal-webgl-remount",
  "m7c-r187-pending-cleanup-scene-navigation",
  "m7c-r187-cleanup-uncertain-fail-closed",
  "m7c-r187-independent-channel-state",
  "m7c-r187-revision-policy-isolation",
  "m7c-r187-production-preview-isolation",
  "m7c-r187-spontaneous-device-loss",
  "m7c-r187-broad-local-e2e",
] as const;

export const GROUND_GLASS_M7C_R187_EVALUATOR_REVISION = "m7c-r187-lifecycle-evidence-v2" as const;
export const GROUND_GLASS_M7C_R187_SCHEMA_VERSION = "ground-glass-m7c-r187-raw-lifecycle-v1" as const;

export type GroundGlassM7cScenarioStatus = "passed" | "failed" | "blocked" | "not-run";
export type GroundGlassM7cScenarioCounts = Readonly<Record<GroundGlassM7cScenarioStatus, number>>;
export type GroundGlassM7cQualification =
  | "qualified-for-scoped-development-pilot"
  | "partially-qualified"
  | "not-qualified"
  | "blocked-by-environment";

type M7cEvent = Record<string, unknown>;
type M7cScenario = Record<string, unknown> & {
  id: string;
  status: GroundGlassM7cScenarioStatus;
};

export type GroundGlassM7cR187EvidenceEvaluation = Readonly<{
  valid: boolean;
  errors: readonly string[];
  qualification: GroundGlassM7cQualification;
  counts: GroundGlassM7cScenarioCounts;
}>;

const statusKeys = ["passed", "failed", "blocked", "not-run"] as const;
const statusSet = new Set<string>(statusKeys);
// Three.REVISION is reported by the installed runtime as "187"; the policy
// record uses the human-readable compatibility tag "r187".
const THREE_R187_PACKAGE_REVISION = ARCHITECTURE_RISE_RAW_RTT_R187_VERIFIED_RENDERER_REVISION.slice(1);
const nativeWebGpuClasses = new Set([
  "native-webgpu-pre-mount-failure",
  "native-webgpu-runtime",
  "native-webgpu-runtime-failure",
  "native-webgpu-cleanup-failure",
  "native-webgpu-device-loss-equivalent",
  "native-webgpu-device-destroy-lost-promise",
  "native-webgpu-retry-session",
]);
const evidenceClassById: Readonly<Record<string, string>> = {
  "m7c-r187-native-raw-baseline": "native-webgpu-runtime",
  "m7c-r187-init-after-target-fallback": "native-webgpu-pre-mount-failure",
  "m7c-r187-scene-render-failure": "native-webgpu-runtime-failure",
  "m7c-r187-queue-completion-rejection": "native-webgpu-runtime-failure",
  "m7c-r187-presentation-failure": "native-webgpu-runtime-failure",
  "m7c-r187-adapter-disposal-failure": "native-webgpu-cleanup-failure",
  "m7c-r187-device-loss-equivalent": "native-webgpu-device-loss-equivalent",
  "m7c-r187-test-destroyed-device-loss-promise": "native-webgpu-device-destroy-lost-promise",
  "m7c-r187-pending-queue-retirement": "native-webgpu-runtime",
  "m7c-r187-latest-request-stale-rejection": "native-webgpu-runtime-failure",
  "m7c-r187-sticky-fallback-remount": "native-webgpu-pre-mount-failure",
  "m7c-r187-explicit-retry-new-session": "native-webgpu-retry-session",
  "m7c-r187-webgl2-compatibility-negative-control": "native-webgpu-webgl2-compatibility-control",
  "m7c-r187-terminal-webgl-remount": "native-webgl-terminal-runtime",
  "m7c-r187-pending-cleanup-scene-navigation": "native-webgpu-runtime",
  "m7c-r187-cleanup-uncertain-fail-closed": "unit-integration",
  "m7c-r187-independent-channel-state": "unit-integration",
  "m7c-r187-revision-policy-isolation": "unit-integration",
  "m7c-r187-production-preview-isolation": "production-preview-webgl",
  "m7c-r187-spontaneous-device-loss": "native-webgpu-device-destroy-lost-promise",
  "m7c-r187-broad-local-e2e": "not-run",
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;
const readEvents = (scenario: Record<string, unknown>): M7cEvent[] =>
  Array.isArray(scenario.events) ? scenario.events.filter(isObject) : [];
const readObservations = (scenario: Record<string, unknown>, kind: string): Record<string, unknown>[] => {
  const provenance = scenario.provenance;
  const observation = isObject(provenance) && Array.isArray(provenance.observations)
    ? provenance.observations.filter((item) => isObject(item) && item.kind === kind)
    : [];
  return observation.filter(isObject);
};
const readObservation = (scenario: Record<string, unknown>, kind: string): Record<string, unknown> | null =>
  readObservations(scenario, kind)[0] ?? null;
const eventSequence = (event: M7cEvent | undefined): number | null =>
  event && Number.isInteger(event.sequence) ? event.sequence as number : null;

const validateNativeRuntime = (scenario: M7cScenario, errors: string[]): void => {
  const id = scenario.id;
  const runtime = scenario.runtime;
  const identity = scenario.identity;
  const events = readEvents(scenario);
  if (!isObject(runtime) || !isObject(identity)) return;
  const generationId = identity.rendererGenerationId;
  const attempts = events.filter((event) => event.kind === "attempt" && event.generationId === generationId);
  const observations = events.filter((event) => event.kind === "runtime-observed" && event.generationId === generationId);
  const mounts = events.filter((event) => event.kind === "renderer-mounted" && event.generationId === generationId);
  const preMount = scenario.evidenceClass === "native-webgpu-pre-mount-failure" ||
    scenario.evidenceClass === "native-webgpu-cleanup-failure" ||
    id === "m7c-r187-explicit-retry-new-session";
  if (attempts.length !== 1 || observations.length !== 1 || mounts.length !== (preMount ? 0 : 1)) {
    errors.push(`native-runtime-event-count-mismatch:${id}`);
    return;
  }
  const attempt = attempts[0]!;
  const observed = observations[0]!;
  const mount = mounts[0];
  if (
    runtime.observed !== true || attempt.attemptId !== identity.attemptId || attempt.requestId !== identity.requestId ||
    attempt.channelId !== identity.channelId || attempt.sceneId !== identity.sceneId ||
    attempt.rendererRevision !== THREE_R187_PACKAGE_REVISION ||
    observed.attemptId !== attempt.attemptId || observed.generationId !== attempt.generationId ||
    observed.rendererRevision !== THREE_R187_PACKAGE_REVISION ||
    observed.rendererFamily !== "webgpu-renderer" || observed.executionApi !== "webgpu" ||
    observed.internalFallback !== "none" || scenario.threeRevision !== THREE_R187_PACKAGE_REVISION ||
    runtime.rendererFamily !== observed.rendererFamily || runtime.actualExecutionApi !== observed.executionApi ||
    runtime.internalFallback !== observed.internalFallback || runtime.hostMounted !== !preMount
  ) errors.push(`native-runtime-identity-contradiction:${id}`);
  if (mount && (
    mount.attemptId !== attempt.attemptId || mount.channelId !== identity.channelId ||
    mount.hostId !== identity.hostId || mount.requestId !== identity.requestId ||
    mount.sceneId !== identity.sceneId || mount.rendererFamily !== observed.rendererFamily ||
    mount.executionApi !== observed.executionApi || mount.internalFallback !== observed.internalFallback
  )) errors.push(`native-mounted-runtime-contradiction:${id}`);
  if (scenario.policyEvidenceRevision !== ARCHITECTURE_RISE_RAW_RTT_R187_EVIDENCE_REVISION) {
    errors.push(`r187-policy-evidence-mismatch:${id}`);
  }
  const provenance = scenario.provenance;
  if (
    !isObject(provenance) || provenance.rendererRevision !== "187" ||
    provenance.actualExecutionApi !== "webgpu" || provenance.rendererFamily !== "webgpu-renderer" ||
    provenance.internalFallback !== "none" || provenance.policyEvidenceRevision !== scenario.policyEvidenceRevision
  ) errors.push(`native-provenance-runtime-contradiction:${id}`);
};

type LossTriggerContract = Readonly<{
  kind: string;
  cause: string;
  reason?: string;
}>;

const validateNativeLossFallbackChain = (
  scenario: M7cScenario,
  errors: string[],
  errorCode: string,
  triggers: readonly LossTriggerContract[],
  forbiddenTriggerKinds: readonly string[],
): void => {
  const identity = isObject(scenario.identity) ? scenario.identity : null;
  if (!identity) {
    errors.push(`${errorCode}:${scenario.id}`);
    return;
  }
  const generationId = identity.rendererGenerationId;
  const attemptId = identity.attemptId;
  const channelId = identity.channelId;
  const hostId = identity.hostId;
  const requestId = identity.requestId;
  const sceneId = identity.sceneId;
  const events = readEvents(scenario);
  const all = (kind: string) => events.filter((event) => event.kind === kind);
  const forGeneration = (kind: string) => events.filter((event) =>
    event.kind === kind && event.generationId === generationId);
  const exactlyOne = (kind: string) => {
    const matches = forGeneration(kind);
    return matches.length === 1 ? matches[0] : undefined;
  };
  let valid = true;
  for (const trigger of triggers) {
    const matches = all(trigger.kind);
    if (matches.length !== 1 || matches[0]?.generationId !== generationId ||
        matches[0]?.attemptId !== attemptId || matches[0]?.cause !== trigger.cause ||
        (trigger.reason !== undefined && matches[0]?.reason !== trigger.reason)) valid = false;
  }
  if (forbiddenTriggerKinds.some((kind) => all(kind).length !== 0)) valid = false;

  const attempt = exactlyOne("attempt");
  const runtime = exactlyOne("runtime-observed");
  const mount = exactlyOne("renderer-mounted");
  const failure = exactlyOne("failure");
  const cleanup = exactlyOne("cleanup");
  const acknowledgement = exactlyOne("cleanup-acknowledged");
  const triggerEvents = triggers.map((trigger) => all(trigger.kind)[0]);
  const adapterCleanupEvents = forGeneration("cleanup");
  const acknowledgementEvents = forGeneration("cleanup-acknowledged");
  const attemptSequence = eventSequence(attempt);
  const runtimeSequence = eventSequence(runtime);
  const mountSequence = eventSequence(mount);
  const failureSequence = eventSequence(failure);
  const cleanupSequence = eventSequence(cleanup);
  const acknowledgementSequence = eventSequence(acknowledgement);
  const triggerSequences = triggerEvents.map(eventSequence);
  const replacementCandidates = events.filter((event) =>
    event.kind === "renderer-mounted" && event.rendererFamily === "webgl-renderer" &&
    event.generationId !== generationId && event.channelId === channelId && event.hostId === hostId &&
    typeof acknowledgementSequence === "number" && typeof event.sequence === "number" &&
    event.sequence > acknowledgementSequence);
  const replacement = replacementCandidates.length === 1 ? replacementCandidates[0] : undefined;
  const replacementSequence = eventSequence(replacement);
  const publicationCandidates = events.filter((event) =>
    event.kind === "host-frame-result" && event.generationId === replacement?.generationId &&
    event.activeGenerationId === replacement?.generationId && event.acceptedByHost === true &&
    event.latestAcceptedRequestId === requestId && event.requestId === requestId &&
    event.channelId === channelId && event.hostId === hostId && event.sceneId === sceneId &&
    event.activeRendererFamily === "webgl-renderer");
  const publication = publicationCandidates.length === 1 ? publicationCandidates[0] : undefined;
  const publicationSequence = eventSequence(publication);
  const publicationSummary = scenario.publication;
  if (
    !attempt || !runtime || !mount || !failure || !cleanup || !acknowledgement ||
    attempt.attemptId !== attemptId || attempt.requestId !== requestId || attempt.channelId !== channelId ||
    attempt.sceneId !== sceneId || runtime.attemptId !== attemptId || runtime.generationId !== generationId ||
    runtime.rendererRevision !== THREE_R187_PACKAGE_REVISION || runtime.rendererFamily !== "webgpu-renderer" ||
    runtime.executionApi !== "webgpu" || runtime.internalFallback !== "none" ||
    mount.attemptId !== attemptId || mount.channelId !== channelId || mount.hostId !== hostId ||
    mount.requestId !== requestId || mount.sceneId !== sceneId || mount.rendererFamily !== "webgpu-renderer" ||
    mount.executionApi !== "webgpu" || mount.internalFallback !== "none" ||
    failure.attemptId !== attemptId || failure.channelId !== channelId || failure.requestId !== requestId ||
    failure.sceneId !== sceneId || failure.stage !== "runtime" ||
    cleanup.attemptId !== attemptId || cleanup.outcome !== "confirmed" ||
    acknowledgement.channelId !== channelId || acknowledgement.hostId !== hostId ||
    acknowledgement.outcome !== "confirmed" || acknowledgementEvents.length !== 1 || adapterCleanupEvents.length !== 1 ||
    !replacement || replacement.attemptId !== JSON.stringify([channelId, replacement.generationId]) ||
    replacement.requestId !== requestId || replacement.sceneId !== sceneId ||
    replacement.executionApi !== "webgl2" || replacement.internalFallback !== "none" ||
    !publication || publication.attemptId !== replacement.attemptId || typeof publicationSequence !== "number" ||
    !isObject(publicationSummary) || publicationSummary.status !== "current" ||
    publicationSummary.completedRequestId !== requestId || publicationSummary.acceptedRequestId !== requestId ||
    publicationSummary.rendererGenerationId !== replacement.generationId ||
    publicationSummary.publicationSequence !== publicationSequence ||
    scenario.cleanupOutcome !== "confirmed" || scenario.applicationFallback !== true ||
    scenario.fallbackOutcome !== "webgl-mounted" ||
    typeof attemptSequence !== "number" || typeof runtimeSequence !== "number" || typeof mountSequence !== "number" ||
    typeof failureSequence !== "number" || typeof cleanupSequence !== "number" ||
    typeof acknowledgementSequence !== "number" || typeof replacementSequence !== "number" ||
    !(attemptSequence < runtimeSequence && runtimeSequence < mountSequence &&
      triggerSequences.every((sequence) => typeof sequence === "number" && mountSequence < sequence && sequence < failureSequence) &&
      triggerSequences.every((sequence, index) => index === 0 ||
        typeof sequence === "number" && typeof triggerSequences[index - 1] === "number" &&
        triggerSequences[index - 1]! < sequence) &&
      failureSequence < cleanupSequence && cleanupSequence < acknowledgementSequence &&
      acknowledgementSequence < replacementSequence && replacementSequence < publicationSequence)
  ) valid = false;

  if (!valid) errors.push(`${errorCode}:${scenario.id}`);
};

const validateTestDestroyedDeviceLoss = (scenario: M7cScenario, errors: string[]): void => {
  if (scenario.id !== "m7c-r187-test-destroyed-device-loss-promise") return;
  const events = readEvents(scenario);
  const lost = events.find((event) => event.kind === "device-lost-observed");
  if (!lost || lost.reason !== "destroyed" || !isNonEmptyString(lost.message)) {
    errors.push(`test-destroyed-device-loss-chain-contradiction:${scenario.id}`);
    return;
  }
  validateNativeLossFallbackChain(
    scenario,
    errors,
    "test-destroyed-device-loss-chain-contradiction",
    [
      { kind: "device-destroy-requested", cause: "test-destroy" },
      { kind: "device-lost-observed", cause: "test-destroy" },
    ],
    ["device-loss-equivalent-requested"],
  );
};

const validateDeviceLossEquivalent = (scenario: M7cScenario, errors: string[]): void => {
  if (scenario.id !== "m7c-r187-device-loss-equivalent") return;
  validateNativeLossFallbackChain(
    scenario,
    errors,
    "loss-equivalent-trigger-chain-contradiction",
    [{ kind: "device-loss-equivalent-requested", cause: "test-callback-equivalent" }],
    ["device-destroy-requested", "device-lost-observed"],
  );
};

const validatePendingQueueRetirement = (scenario: M7cScenario, errors: string[]): void => {
  if (scenario.id !== "m7c-r187-pending-queue-retirement") return;
  const identity = isObject(scenario.identity) ? scenario.identity : null;
  const observations = readObservations(scenario, "pending-queue-retirement");
  const observation = observations.length === 1 ? observations[0] : null;
  const events = readEvents(scenario);
  if (!identity || !observation) {
    errors.push(`pending-retirement-cleanup-chain-contradiction:${scenario.id}`);
    return;
  }
  const generationId = identity.rendererGenerationId;
  const attemptId = identity.attemptId;
  const channelId = identity.channelId;
  const hostId = identity.hostId;
  const requestId = identity.requestId;
  const sceneId = identity.sceneId;
  const forGeneration = (kind: string) => events.filter((event) =>
    event.kind === kind && event.generationId === generationId);
  const single = (kind: string) => {
    const matches = forGeneration(kind);
    return matches.length === 1 ? matches[0] : undefined;
  };
  const attempt = single("attempt");
  const runtime = single("runtime-observed");
  const mount = single("renderer-mounted");
  const settledEvents = forGeneration("queue-completion-settled");
  const queueSettled = settledEvents.length === 1 ? settledEvents[0] : undefined;
  const cleanupEvents = forGeneration("cleanup");
  const cleanup = cleanupEvents.length === 1 ? cleanupEvents[0] : undefined;
  const acknowledgementEvents = forGeneration("cleanup-acknowledged");
  const acknowledgement = acknowledgementEvents.length === 1 ? acknowledgementEvents[0] : undefined;
  const attemptSequence = eventSequence(attempt);
  const runtimeSequence = eventSequence(runtime);
  const mountSequence = eventSequence(mount);
  const settledSequence = eventSequence(queueSettled);
  const cleanupSequence = eventSequence(cleanup);
  const acknowledgementSequence = eventSequence(acknowledgement);
  const replacementCandidates = events.filter((event) =>
    event.kind === "renderer-mounted" && event.rendererFamily === "webgl-renderer" &&
    event.generationId !== generationId && event.channelId === channelId && event.hostId === hostId &&
    typeof mountSequence === "number" && typeof event.sequence === "number" && event.sequence > mountSequence);
  const replacement = replacementCandidates.length === 1 ? replacementCandidates[0] : undefined;
  const replacementSequence = eventSequence(replacement);
  const held = observation.retirementWhileHeld;
  const valid =
    scenario.failureStage === null && scenario.failureOperation === null &&
    scenario.cleanupOutcome === "confirmed" && scenario.applicationFallback === false && scenario.fallbackOutcome === "none" &&
    events.filter((event) => event.kind === "failure" && event.generationId === generationId).length === 0 &&
    events.filter((event) => ["device-destroy-requested", "device-lost-observed", "device-loss-equivalent-requested"]
      .includes(String(event.kind)) && event.generationId === generationId).length === 0 &&
    !!attempt && !!runtime && !!mount && !!queueSettled && !!cleanup && !!acknowledgement && !!replacement &&
    attempt.attemptId === attemptId && attempt.requestId === requestId && attempt.channelId === channelId &&
    attempt.sceneId === sceneId && attempt.rendererRevision === THREE_R187_PACKAGE_REVISION &&
    runtime.attemptId === attemptId && runtime.generationId === generationId &&
    runtime.rendererRevision === THREE_R187_PACKAGE_REVISION && runtime.rendererFamily === "webgpu-renderer" &&
    runtime.executionApi === "webgpu" && runtime.internalFallback === "none" &&
    mount.attemptId === attemptId && mount.channelId === channelId && mount.hostId === hostId &&
    mount.requestId === requestId && mount.sceneId === sceneId && mount.rendererFamily === "webgpu-renderer" &&
    mount.executionApi === "webgpu" && mount.internalFallback === "none" &&
    settledEvents.length === 1 && queueSettled.kind === "queue-completion-settled" &&
    queueSettled.attemptId === attemptId && queueSettled.requestId === requestId && queueSettled.operation === "sceneRender" &&
    cleanupEvents.length === 1 && cleanup.attemptId === attemptId && cleanup.outcome === "confirmed" &&
    acknowledgementEvents.length === 1 && acknowledgement.channelId === channelId &&
    acknowledgement.hostId === hostId && acknowledgement.outcome === "confirmed" &&
    replacementCandidates.length === 1 && replacement.generationId !== generationId &&
    replacement.attemptId === JSON.stringify([channelId, replacement.generationId]) &&
    replacement.sceneId === sceneId && replacement.requestId !== requestId &&
    replacement.executionApi === "webgl2" && replacement.internalFallback === "none" &&
    observation.generationId === generationId && observation.attemptId === attemptId &&
    observation.requestId === requestId && observation.channelId === channelId &&
    observation.sceneId === sceneId && observation.hostId === hostId &&
    observation.queueCompletionBarrierReachedBeforeRelease === true && observation.releaseRequested === true &&
    isObject(held) && held.lifecycle === "retiring" && held.cleanupStatus === "pending" &&
    held.rendererGeneration === generationId && held.mountedRendererFamily === "webgpu-renderer" &&
    observation.queueCompletionSettledSequence === settledSequence &&
    observation.adapterCleanupSequence === cleanupSequence &&
    observation.hostAcknowledgementSequence === acknowledgementSequence &&
    observation.replacementGenerationId === replacement.generationId &&
    observation.replacementMountSequence === replacementSequence &&
    typeof attemptSequence === "number" && typeof runtimeSequence === "number" &&
    typeof mountSequence === "number" && typeof settledSequence === "number" &&
    typeof cleanupSequence === "number" && typeof acknowledgementSequence === "number" &&
    typeof replacementSequence === "number" &&
    attemptSequence < runtimeSequence && runtimeSequence < mountSequence && mountSequence < settledSequence &&
    settledSequence < cleanupSequence && cleanupSequence < acknowledgementSequence &&
    acknowledgementSequence < replacementSequence;
  if (!valid) errors.push(`pending-retirement-cleanup-chain-contradiction:${scenario.id}`);
};

const validateLatestRequestEvidence = (scenario: M7cScenario, errors: string[]): void => {
  if (scenario.id !== "m7c-r187-latest-request-stale-rejection") return;
  const interleaving = readObservation(scenario, "latest-request-interleaving");
  const events = readEvents(scenario);
  if (!interleaving || !isObject(interleaving.requests) || !isObject(interleaving.generations)) {
    errors.push("missing-latest-request-interleaving:" + scenario.id);
    return;
  }
  const requests = interleaving.requests;
  const generations = interleaving.generations;
  const latestId = requests.latestAcceptedRequestId;
  const staleId = requests.staleRequestId;
  const replacementId = generations.replacementWebGlGeneration;
  const changedInputs = interleaving.changedInputs;
  const accepted = events.find((event) => event.kind === "host-frame-result" && event.requestId === latestId &&
    event.acceptedByHost === true);
  const stale = events.find((event) => event.kind === "host-frame-result" && event.requestId === staleId &&
    event.acceptedByHost === false && event.latestAcceptedRequestId === latestId);
  const finalState = readObservation(scenario, "final-publication-state-after-stale-rejection");
  if (
    !accepted || accepted.acceptedByHost !== true || accepted.generationId !== replacementId ||
    accepted.latestAcceptedRequestId !== latestId || accepted.activeGenerationId !== replacementId ||
    !stale || stale.acceptedByHost !== false || stale.generationId !== replacementId ||
    stale.latestAcceptedRequestId !== latestId || stale.activeGenerationId !== replacementId ||
    stale.activeRendererFamily !== "webgl-renderer" ||
    !finalState || finalState.currentRequestId !== latestId || finalState.lastCompletedRequestId !== latestId ||
    finalState.completedCurrentRequest !== true || finalState.frameResultStatus !== "completed" ||
    finalState.lifecycle !== "ready" ||
    typeof accepted.sequence !== "number" || typeof stale.sequence !== "number" || accepted.sequence >= stale.sequence ||
    interleaving.hostAcceptedLatestBeforeRejectingStale !== true ||
    !Array.isArray(changedInputs) ||
    !["focus", "render-quality", "stage-pan", "aperture"].every((input) =>
      Array.isArray(changedInputs) && changedInputs.includes(input),
    )
  ) errors.push("latest-request-result-chain-contradiction:" + scenario.id);
  if (finalState && (finalState.currentRequestId !== latestId || finalState.lastCompletedRequestId !== latestId)) {
    errors.push("latest-request-final-state-overwritten-by-stale:" + scenario.id);
  }
  const latestIdentity = interleaving.latestRequestIdentity;
  if (!isObject(latestIdentity) || latestIdentity.channelId !== accepted?.channelId ||
      latestIdentity.sceneId !== accepted?.sceneId || latestIdentity.rendererFamily !== "webgl-renderer" ||
      latestIdentity.renderQuality !== "low" || !isObject(latestIdentity.dimensions) ||
      !isNonEmptyString(latestIdentity.dimensions.width) || !isNonEmptyString(latestIdentity.dimensions.height)) {
    errors.push("latest-request-identity-incomplete:" + scenario.id);
  }
};

const validateFailureStageAndOperation = (scenario: M7cScenario, errors: string[]): void => {
  const expectedById: Readonly<Record<string, Readonly<{ stage: string; operation: string }>>> = {
    "m7c-r187-init-after-target-fallback": { stage: "initialization", operation: "unknown" },
    "m7c-r187-scene-render-failure": { stage: "runtime", operation: "sceneRender" },
    "m7c-r187-queue-completion-rejection": { stage: "runtime", operation: "sceneRender" },
    "m7c-r187-presentation-failure": { stage: "runtime", operation: "textureDisplay" },
    "m7c-r187-latest-request-stale-rejection": { stage: "runtime", operation: "sceneRender" },
  };
  const expected = expectedById[scenario.id];
  if (!expected) return;
  const identity = isObject(scenario.identity) ? scenario.identity : null;
  const generationId = identity?.rendererGenerationId;
  const failure = readEvents(scenario).find((event) => event.kind === "failure" &&
    event.generationId === generationId);
  if (!failure || failure.stage !== expected.stage || failure.operation !== expected.operation) {
    errors.push(`failure-stage-operation-contradiction:${scenario.id}`);
    return;
  }
  if (scenario.id === "m7c-r187-init-after-target-fallback") {
    const limitation = Array.isArray(scenario.limitations) && scenario.limitations.some((entry) =>
      typeof entry === "string" && entry.includes("operation=unknown"));
    if (scenario.status !== "blocked" || !limitation ||
        typeof failure.reason !== "string" || !failure.reason.includes("initialization-after-target")) {
      errors.push(`initialization-operation-gap-not-blocked:${scenario.id}`);
    }
  }
};

const validateSessionBoundary = (scenario: M7cScenario, errors: string[]): void => {
  if (scenario.id === "m7c-r187-sticky-fallback-remount") {
    const observation = readObservation(scenario, "sticky-session-remount");
    if (!observation || observation.sessionIdBeforeChanges !== observation.sessionIdAfterRemount ||
        !Array.isArray(observation.attemptGenerationsBeforeChanges) ||
        !Array.isArray(observation.attemptGenerationsAfterRemount) ||
        JSON.stringify(observation.attemptGenerationsBeforeChanges) !== JSON.stringify(observation.attemptGenerationsAfterRemount) ||
        observation.retryEpochBeforeChanges !== observation.retryEpochAfterRemount) {
      errors.push("remount-implicitly-retried-pilot-session:" + scenario.id);
    }
  }
  if (scenario.id === "m7c-r187-explicit-retry-new-session") {
    const observation = readObservation(scenario, "authorized-recovery-actions");
    const explicitRetry = observation?.explicitRetry;
    const invalidAction = observation?.invalidAction;
    const newSession = observation?.newSession;
    if (
      !observation || !isObject(explicitRetry) || !isObject(invalidAction) || !isObject(newSession) ||
      explicitRetry.action !== "explicit-retry" || explicitRetry.status !== "authorized" || explicitRetry.retryEpoch !== 1 ||
      invalidAction.action !== "invalid" || invalidAction.status !== "rejected" || invalidAction.retryEpoch !== 1 ||
      newSession.action !== "new-pilot-session" || newSession.status !== "authorized" || newSession.retryEpoch !== 2 ||
      newSession.pilotSessionId === observation.initialSessionId ||
      !Array.isArray(observation.initialAttemptGenerations) || observation.initialAttemptGenerations.length !== 1 ||
      !Array.isArray(observation.attemptsAfterExplicitRetry) || observation.attemptsAfterExplicitRetry.length !== 2 ||
      !Array.isArray(observation.attemptsAfterInvalidAction) || observation.attemptsAfterInvalidAction.length !== 2 ||
      !Array.isArray(observation.attemptsAfterNewSession) || observation.attemptsAfterNewSession.length !== 3
    ) errors.push("authorized-recovery-boundary-contradiction:" + scenario.id);
  }
};

const validateAuthorizedRetrySession = (scenario: M7cScenario, errors: string[]): void => {
  if (scenario.id !== "m7c-r187-explicit-retry-new-session") return;
  const observation = readObservation(scenario, "authorized-recovery-actions");
  const identity = isObject(scenario.identity) ? scenario.identity : null;
  const initial = observation?.initialAttemptGenerations;
  const afterRetry = observation?.attemptsAfterExplicitRetry;
  const afterInvalid = observation?.attemptsAfterInvalidAction;
  const afterNewSession = observation?.attemptsAfterNewSession;
  if (!observation || !Array.isArray(initial) || !Array.isArray(afterRetry) ||
      !Array.isArray(afterInvalid) || !Array.isArray(afterNewSession) ||
      initial.length !== 1 || afterRetry.length !== 2 || afterInvalid.length !== 2 || afterNewSession.length !== 3 ||
      JSON.stringify(afterInvalid) !== JSON.stringify(afterRetry) ||
      JSON.stringify(afterNewSession.slice(0, 2)) !== JSON.stringify(afterRetry) ||
      new Set(afterNewSession).size !== 3) {
    errors.push("authorized-recovery-attempt-inventory-contradiction:" + scenario.id);
    return;
  }
  const events = readEvents(scenario);
  const generations = afterNewSession as string[];
  const attemptEvents = events.filter((event) => event.kind === "attempt");
  let valid = !!identity && initial[0] === identity.rendererGenerationId &&
    attemptEvents.length === generations.length &&
    JSON.stringify(attemptEvents.map((event) => event.generationId)) === JSON.stringify(generations);
  if (!identity || !generations.every(isNonEmptyString)) {
    errors.push(`authorized-recovery-native-generation-contradiction:${scenario.id}`);
    return;
  }
  const seq = (event: M7cEvent | undefined) => eventSequence(event);
  const generationRecords: Array<{
    generationId: string;
    attempt: M7cEvent;
    runtime: M7cEvent;
    mount?: M7cEvent;
    failure?: M7cEvent;
    cleanup?: M7cEvent;
    acknowledgement?: M7cEvent;
  }> = [];
  for (const [index, generationId] of generations.entries()) {
    const forGeneration = (kind: string) => events.filter((event) =>
      event.kind === kind && event.generationId === generationId);
    const attempts = forGeneration("attempt");
    const runtimes = forGeneration("runtime-observed");
    const mounts = forGeneration("renderer-mounted");
    const failures = forGeneration("failure");
    const cleanups = forGeneration("cleanup");
    const acknowledgements = forGeneration("cleanup-acknowledged");
    const attempt = attempts.length === 1 ? attempts[0] : undefined;
    const runtime = runtimes.length === 1 ? runtimes[0] : undefined;
    const failedAttempt = index < generations.length - 1;
    const mount = mounts.length === 1 ? mounts[0] : undefined;
    const failure = failures.length === 1 ? failures[0] : undefined;
    const cleanup = cleanups.length === 1 ? cleanups[0] : undefined;
    const acknowledgement = acknowledgements.length === 1 ? acknowledgements[0] : undefined;
    const expectedAttemptId = JSON.stringify([identity.channelId, generationId]);
    if (
      attempts.length !== 1 || runtimes.length !== 1 || !attempt || !runtime ||
      attempt.attemptId !== expectedAttemptId || attempt.requestId !== identity.requestId ||
      attempt.channelId !== identity.channelId || attempt.sceneId !== identity.sceneId ||
      attempt.rendererRevision !== THREE_R187_PACKAGE_REVISION ||
      runtime.attemptId !== expectedAttemptId || runtime.generationId !== generationId ||
      runtime.rendererRevision !== THREE_R187_PACKAGE_REVISION || runtime.rendererFamily !== "webgpu-renderer" ||
      runtime.executionApi !== "webgpu" || runtime.internalFallback !== "none" ||
      typeof seq(attempt) !== "number" || typeof seq(runtime) !== "number" || seq(attempt)! >= seq(runtime)!
    ) valid = false;
    if (failedAttempt) {
      if (
        mounts.length !== 0 || failures.length !== 1 || cleanups.length !== 1 || acknowledgements.length !== 1 ||
        !failure || !cleanup || !acknowledgement ||
        failure.attemptId !== expectedAttemptId || failure.channelId !== identity.channelId ||
        failure.requestId !== identity.requestId || failure.sceneId !== identity.sceneId ||
        failure.stage !== "initialization" || cleanup.attemptId !== expectedAttemptId || cleanup.outcome !== "confirmed" ||
        acknowledgement.channelId !== identity.channelId || acknowledgement.hostId !== identity.hostId ||
        acknowledgement.outcome !== "confirmed" ||
        !(seq(runtime)! < seq(failure)! && seq(failure)! < seq(cleanup)! && seq(cleanup)! < seq(acknowledgement)!)
      ) valid = false;
    } else if (
      mounts.length !== 1 || failures.length !== 0 || cleanups.length !== 0 || acknowledgements.length !== 0 || !mount ||
      mount.attemptId !== expectedAttemptId || mount.channelId !== identity.channelId ||
      mount.hostId !== identity.hostId || mount.requestId !== identity.requestId || mount.sceneId !== identity.sceneId ||
      mount.rendererFamily !== "webgpu-renderer" || mount.executionApi !== "webgpu" || mount.internalFallback !== "none" ||
      !(seq(runtime)! < seq(mount)!)
    ) valid = false;
    generationRecords.push({ generationId, attempt: attempt!, runtime: runtime!, mount, failure, cleanup, acknowledgement });
  }

  for (let index = 0; index < generationRecords.length - 1; index += 1) {
    const current = generationRecords[index]!;
    const next = generationRecords[index + 1]!;
    const cleanupSequence = seq(current.acknowledgement);
    const nextAttemptSequence = seq(next.attempt);
    const replacementCandidates = events.filter((event) =>
      event.kind === "renderer-mounted" && event.rendererFamily === "webgl-renderer" &&
      event.channelId === identity.channelId && event.hostId === identity.hostId &&
      event.requestId === identity.requestId && event.sceneId === identity.sceneId &&
      event.generationId !== current.generationId && typeof cleanupSequence === "number" &&
      typeof event.sequence === "number" && event.sequence > cleanupSequence &&
      typeof nextAttemptSequence === "number" && event.sequence < nextAttemptSequence);
    const replacement = replacementCandidates.length === 1 ? replacementCandidates[0] : undefined;
    if (
      !replacement || replacement.generationId === current.generationId ||
      replacement.attemptId !== JSON.stringify([identity.channelId, replacement.generationId]) ||
      replacement.executionApi !== "webgl2" || replacement.internalFallback !== "none" ||
      typeof cleanupSequence !== "number" || typeof nextAttemptSequence !== "number" ||
      seq(replacement)! >= nextAttemptSequence
    ) valid = false;
  }

  const finalGenerationId = generations.at(-1);
  const final = generationRecords.at(-1);
  const finalPublicationCandidates = events.filter((event) =>
    event.kind === "host-frame-result" && event.generationId === finalGenerationId &&
    event.activeGenerationId === finalGenerationId && event.acceptedByHost === true &&
    event.latestAcceptedRequestId === identity.requestId && event.requestId === identity.requestId &&
    event.channelId === identity.channelId && event.hostId === identity.hostId &&
    event.sceneId === identity.sceneId && event.activeRendererFamily === "webgpu-renderer" &&
    event.frameStatus === "completed");
  const finalPublication = finalPublicationCandidates.length === 1 ? finalPublicationCandidates[0] : undefined;
  const publicationSummary = scenario.publication;
  const finalPublicationSequence = seq(finalPublication);
  const finalMountSequence = seq(final?.mount);
  if (
    finalPublicationCandidates.length !== 1 || !finalPublication || !final?.mount ||
    !isObject(publicationSummary) || publicationSummary.status !== "current" ||
    publicationSummary.rendererGenerationId !== finalGenerationId ||
    publicationSummary.completedRequestId !== identity.requestId || publicationSummary.acceptedRequestId !== identity.requestId ||
    typeof finalPublicationSequence !== "number" || typeof finalMountSequence !== "number" ||
    publicationSummary.publicationSequence !== finalPublicationSequence || finalPublicationSequence <= finalMountSequence
  ) valid = false;
  if (!valid) errors.push(`authorized-recovery-native-generation-contradiction:${scenario.id}`);
};

const validateWebGl2NegativeControl = (scenario: M7cScenario, errors: string[]): void => {
  if (scenario.id !== "m7c-r187-webgl2-compatibility-negative-control") return;
  const runtime = scenario.runtime;
  const events = readEvents(scenario);
  const identity = scenario.identity;
  if (!isObject(runtime) || !isObject(identity)) return;
  const observed = events.find((event) => event.kind === "runtime-observed" && event.generationId === identity.rendererGenerationId);
  const mount = events.find((event) => event.kind === "renderer-mounted" && event.generationId === identity.rendererGenerationId);
  if (
    runtime.rendererFamily !== "webgpu-renderer" || runtime.actualExecutionApi !== "webgl2" ||
    runtime.internalFallback !== "webgl2-compatibility" ||
    observed?.rendererFamily !== "webgpu-renderer" || observed.executionApi !== "webgl2" ||
    observed.internalFallback !== "webgl2-compatibility" || observed.rendererRevision !== "187" ||
    (mount && (mount.rendererFamily !== "webgpu-renderer" || mount.executionApi !== "webgl2" ||
      mount.internalFallback !== "webgl2-compatibility")) || scenario.nativeWebGpuQualified !== false ||
    scenario.fallbackOutcome !== "webgl-mounted" || scenario.applicationFallback !== true ||
    scenario.cleanupOutcome !== "confirmed"
  ) errors.push("webgl2-control-misclassified-as-native-webgpu:" + scenario.id);
  if (scenario.policyEvidenceRevision !== ARCHITECTURE_RISE_RAW_RTT_R187_EVIDENCE_REVISION) {
    errors.push("r187-policy-evidence-mismatch:" + scenario.id);
  }
};

const validateTerminalWebGl = (scenario: M7cScenario, errors: string[]): void => {
  if (scenario.id !== "m7c-r187-terminal-webgl-remount") return;
  const observation = readObservation(scenario, "terminal-webgl-context-loss");
  const events = readEvents(scenario);
  if (!observation) {
    errors.push("missing-terminal-webgl-observation:" + scenario.id);
    return;
  }
  const failureSequence = observation.failureSequence;
  const acceptedAfterFailure = events.some((event) =>
    event.kind === "host-frame-result" && event.acceptedByHost === true &&
    typeof failureSequence === "number" && typeof event.sequence === "number" && event.sequence > failureSequence,
  );
  if (
    observation.rendererFamily !== "webgl-renderer" || observation.executionApi !== "webgl2" ||
    observation.cleanupStatus !== "confirmed" || observation.lifecycleAfterRemount !== "unavailable" ||
    observation.remountRendererFamily !== null || !Array.isArray(observation.adapterAttemptGenerationsAfterRemount) ||
    observation.adapterAttemptGenerationsAfterRemount.length !== 0 ||
    acceptedAfterFailure
  ) errors.push("webgl-terminal-publication-after-terminal-failure:" + scenario.id);
};

const validatePendingUnmount = (scenario: M7cScenario, errors: string[]): void => {
  if (scenario.id !== "m7c-r187-pending-cleanup-scene-navigation") return;
  const observation = readObservation(scenario, "pending-cleanup-scene-remount");
  const events = readEvents(scenario);
  const identity = isObject(scenario.identity) ? scenario.identity : null;
  const retiredGeneration = observation?.retiredGeneration;
  if (!observation || !identity || !isNonEmptyString(retiredGeneration) ||
      typeof observation.unmountSequence !== "number" || !Number.isInteger(observation.unmountSequence)) {
    errors.push("pending-unmount-event-cleanup-contradiction:" + scenario.id);
    return;
  }
  const unmountSequence = observation.unmountSequence;
  const forGeneration = (kind: string) => events.filter((event) =>
    event.kind === kind && event.generationId === retiredGeneration);
  const single = (kind: string) => {
    const matches = forGeneration(kind);
    return matches.length === 1 ? matches[0] : undefined;
  };
  const attempt = single("attempt");
  const runtime = single("runtime-observed");
  const mount = single("renderer-mounted");
  const cleanupEvents = forGeneration("cleanup");
  const cleanup = cleanupEvents.length === 1 ? cleanupEvents[0] : undefined;
  const acknowledgementEvents = forGeneration("cleanup-acknowledged");
  const acknowledgement = acknowledgementEvents.length === 1 ? acknowledgementEvents[0] : undefined;
  const mountSequence = eventSequence(mount);
  const cleanupSequence = eventSequence(cleanup);
  const acknowledgementSequence = eventSequence(acknowledgement);
  const acceptedAfterUnmount = events.some((event) =>
    (event.kind === "host-frame-result" && event.generationId === retiredGeneration && event.acceptedByHost === true ||
      event.kind === "frame-completed" && event.generationId === retiredGeneration) &&
    typeof event.sequence === "number" && event.sequence > unmountSequence,
  );
  const acknowledgementSummary = observation.cleanupAcknowledgement;
  const matchesAcknowledgement = isObject(acknowledgementSummary) && !!acknowledgement &&
    acknowledgementSummary.kind === "cleanup-acknowledged" &&
    acknowledgementSummary.generationId === acknowledgement.generationId &&
    acknowledgementSummary.channelId === acknowledgement.channelId &&
    acknowledgementSummary.hostId === acknowledgement.hostId &&
    acknowledgementSummary.outcome === acknowledgement.outcome &&
    acknowledgementSummary.reason === acknowledgement.reason &&
    acknowledgementSummary.sequence === acknowledgement.sequence;
  const newHosts = events.filter((event) => event.kind === "host-attached" &&
    event.channelId === identity.channelId && event.hostId !== identity.hostId &&
    typeof acknowledgementSequence === "number" && typeof event.sequence === "number" &&
    event.sequence > acknowledgementSequence);
  const replacementCandidates = events.filter((event) =>
    event.kind === "renderer-mounted" && event.rendererFamily === "webgl-renderer" &&
    event.generationId !== retiredGeneration && event.channelId === identity.channelId &&
    event.hostId !== identity.hostId && typeof acknowledgementSequence === "number" &&
    typeof event.sequence === "number" && event.sequence > acknowledgementSequence);
  const replacement = replacementCandidates.length === 1 ? replacementCandidates[0] : undefined;
  const observedAttempts = events.filter((event) => event.kind === "attempt").map((event) => event.generationId);
  const attemptGenerationsAfterRemount = observation.adapterAttemptGenerationsAfterRemount;
  const heldRequestMatches = observation.heldRequestId === identity.requestId &&
    observation.heldSessionId === identity.pilotSessionId;
  const valid =
    !!attempt && !!runtime && !!mount && !!cleanup && !!acknowledgement && !!replacement &&
    identity.rendererGenerationId === retiredGeneration && identity.attemptId === attempt?.attemptId &&
    identity.requestId === attempt?.requestId && identity.channelId === attempt?.channelId &&
    identity.sceneId === attempt?.sceneId && identity.hostId === acknowledgement?.hostId &&
    heldRequestMatches &&
    attempt?.attemptId === JSON.stringify([identity.channelId, retiredGeneration]) &&
    runtime.attemptId === attempt.attemptId && runtime.generationId === retiredGeneration &&
    runtime.rendererRevision === THREE_R187_PACKAGE_REVISION && runtime.rendererFamily === "webgpu-renderer" &&
    runtime.executionApi === "webgpu" && runtime.internalFallback === "none" &&
    mount.attemptId === attempt.attemptId && mount.channelId === identity.channelId &&
    mount.hostId === identity.hostId && mount.requestId === identity.requestId &&
    mount.rendererFamily === "webgpu-renderer" && mount.executionApi === "webgpu" && mount.internalFallback === "none" &&
    cleanupEvents.length === 1 && cleanup.attemptId === attempt.attemptId && cleanup.outcome === "confirmed" &&
    acknowledgementEvents.length === 1 && acknowledgement.channelId === identity.channelId &&
    acknowledgement.hostId === identity.hostId && acknowledgement.outcome === "confirmed" && matchesAcknowledgement &&
    scenario.cleanupOutcome === "confirmed" && scenario.failureStage === null &&
    Number.isInteger(unmountSequence) && typeof mountSequence === "number" && mountSequence <= unmountSequence &&
    typeof cleanupSequence === "number" && unmountSequence < cleanupSequence &&
    typeof acknowledgementSequence === "number" && cleanupSequence < acknowledgementSequence &&
    !acceptedAfterUnmount &&
    Array.isArray(observation.postRetirementAcceptedPublications) &&
    observation.postRetirementAcceptedPublications.length === 0 &&
    observation.remountedRendererFamily === "webgl-renderer" && newHosts.length > 0 &&
    !!replacement && newHosts.every((event) => event.hostId === replacement.hostId) &&
    replacementCandidates.length === 1 && replacement.hostId !== identity.hostId &&
    replacement.attemptId === JSON.stringify([identity.channelId, replacement.generationId]) &&
    replacement.executionApi === "webgl2" && replacement.internalFallback === "none" &&
    isNonEmptyString(replacement.requestId) && replacement.sceneId === identity.sceneId &&
    typeof replacement.sequence === "number" && replacement.sequence > acknowledgementSequence &&
    replacement.sequence > Math.max(...newHosts.map((event) => Number(event.sequence))) &&
    Array.isArray(attemptGenerationsAfterRemount) && attemptGenerationsAfterRemount.length === 1 &&
    attemptGenerationsAfterRemount[0] === retiredGeneration && observedAttempts.length === 1 &&
    observedAttempts[0] === retiredGeneration;
  if (!valid) errors.push("pending-unmount-event-cleanup-contradiction:" + scenario.id);
};

const qualificationFor = (counts: GroundGlassM7cScenarioCounts): GroundGlassM7cQualification => {
  if (counts.failed > 0) return "not-qualified";
  if (counts.passed === GROUND_GLASS_M7C_R187_REQUIRED_SCENARIO_IDS.length) return "qualified-for-scoped-development-pilot";
  if (counts.passed === 0 && counts.blocked > 0) return "blocked-by-environment";
  return "partially-qualified";
};

/** Validate the revision-specific M7C inventory and reuse M7B's strict lifecycle event contracts. */
export const evaluateGroundGlassM7cR187LifecycleEvidence = (input: unknown): GroundGlassM7cR187EvidenceEvaluation => {
  const errors: string[] = [];
  const counts: Record<GroundGlassM7cScenarioStatus, number> = { passed: 0, failed: 0, blocked: 0, "not-run": 0 };
  if (!isObject(input)) {
    return { valid: false, errors: ["report-must-be-an-object"], qualification: "partially-qualified", counts };
  }
  if (input.schemaVersion !== GROUND_GLASS_M7C_R187_SCHEMA_VERSION) errors.push("unsupported-schema-version");
  if (input.evaluatorRevision !== GROUND_GLASS_M7C_R187_EVALUATOR_REVISION) errors.push("unsupported-evaluator-revision");
  if (!isNonEmptyString(input.reportId)) errors.push("missing-report-id");
  if (!isNonEmptyString(input.sourceHeadSha) || !/^[\da-f]{40}$/i.test(input.sourceHeadSha)) errors.push("invalid-report-source-head-sha");
  if (!Array.isArray(input.scenarios)) {
    errors.push("scenario-inventory-must-be-an-array");
    return { valid: false, errors, qualification: "partially-qualified", counts };
  }
  const scenarios = input.scenarios.filter(isObject) as M7cScenario[];
  if (scenarios.length !== input.scenarios.length) errors.push("scenario-entry-must-be-an-object");
  const byId = new Map<string, M7cScenario>();
  for (const scenario of scenarios) {
    if (!isNonEmptyString(scenario.id)) {
      errors.push("scenario-missing-id");
      continue;
    }
    if (byId.has(scenario.id)) errors.push(`duplicate-scenario:${scenario.id}`);
    else byId.set(scenario.id, scenario);
  }
  for (const id of GROUND_GLASS_M7C_R187_REQUIRED_SCENARIO_IDS) {
    const scenario = byId.get(id);
    if (!scenario) {
      errors.push(`missing-required-scenario:${id}`);
      continue;
    }
    if (!statusSet.has(scenario.status)) {
      errors.push(`invalid-status:${id}`);
      continue;
    }
    counts[scenario.status] += 1;
    if (scenario.evidenceClass !== evidenceClassById[id]) errors.push(`evidence-class-does-not-match-scenario:${id}`);
    if (!isNonEmptyString(scenario.title)) errors.push(`missing-title:${id}`);
    if (!Array.isArray(scenario.events)) errors.push(`missing-event-list:${id}`);
    if (!Array.isArray(scenario.supportingArtifacts)) errors.push(`missing-artifact-list:${id}`);
    if (!Array.isArray(scenario.limitations)) errors.push(`missing-limitations-list:${id}`);
    if (scenario.status === "not-run") {
      if (scenario.evidenceClass !== "not-run" || scenario.sourceHeadSha !== null ||
          (Array.isArray(scenario.events) && scenario.events.length > 0) || scenario.testId !== null ||
          scenario.testProject !== null || scenario.threeRevision !== null || scenario.invocation !== null) {
        errors.push(`not-run-has-execution-evidence:${id}`);
      }
      if (id !== "m7c-r187-broad-local-e2e") errors.push(`unexpected-not-run-scenario:${id}`);
      continue;
    }
    if (!isNonEmptyString(scenario.sourceHeadSha) || !/^[\da-f]{40}$/i.test(scenario.sourceHeadSha)) {
      errors.push(`invalid-source-head-sha:${id}`);
    }
    if (!isNonEmptyString(scenario.testId)) errors.push(`missing-test-id:${id}`);
    if (!isNonEmptyString(scenario.testProject)) errors.push(`missing-test-project:${id}`);
    if (!isNonEmptyString(scenario.invocation)) errors.push(`missing-invocation:${id}`);
    if (!isObject(scenario.identity)) errors.push(`missing-identity:${id}`);
    if (!isObject(scenario.runtime)) errors.push(`missing-runtime-evidence:${id}`);
    if (!isObject(scenario.publication)) errors.push(`missing-publication-evidence:${id}`);
    if (!isObject(scenario.provenance)) errors.push(`missing-capture-provenance:${id}`);
    if (scenario.status === "blocked" && (!Array.isArray(scenario.limitations) || scenario.limitations.length === 0)) {
      errors.push(`blocked-scenario-without-reason:${id}`);
    }
    validateFailureStageAndOperation(scenario, errors);
    if (id === "m7c-r187-spontaneous-device-loss") {
      const events = readEvents(scenario);
      const loss = events.find((event) => event.kind === "device-lost-observed");
      if (scenario.status !== "blocked" || loss?.cause !== "test-destroy" ||
          events.some((event) => event.kind === "device-lost-observed" && event.cause === "runtime-loss")) {
        errors.push("spontaneous-device-loss-not-distinguished-from-test-destroy:" + id);
      }
    }
    if (scenario.status !== "passed") continue;
    if (!Array.isArray(scenario.supportingArtifacts) || scenario.supportingArtifacts.length === 0) {
      errors.push(`passed-scenario-without-artifact:${id}`);
    }
    if (!isObject(scenario.provenance) || scenario.provenance.captureSourceSha !== scenario.sourceHeadSha ||
        !isNonEmptyString(scenario.provenance.invocation) || !isNonEmptyString(scenario.provenance.testId) ||
        !Array.isArray(scenario.provenance.observations)) {
      errors.push(`missing-capture-provenance:${id}`);
    }
    const nativeWebGpu = nativeWebGpuClasses.has(String(scenario.evidenceClass));
    if (nativeWebGpu) {
      if (scenario.testProject !== "chrome-native-webgpu" || typeof scenario.invocation !== "string" ||
          !scenario.invocation.includes("--project=chrome-native-webgpu")) {
        errors.push(`native-project-invocation-mismatch:${id}`);
      }
      if (!isObject(scenario.provenance) || !isNonEmptyString(scenario.provenance.browserVersion) ||
          !isNonEmptyString(scenario.provenance.userAgent) || !isObject(scenario.provenance.operatingSystem) ||
          !isNonEmptyString(scenario.provenance.operatingSystem.platform) ||
          !isNonEmptyString(scenario.provenance.operatingSystem.release) ||
          !isNonEmptyString(scenario.provenance.operatingSystem.architecture)) {
        errors.push(`native-provenance-incomplete:${id}`);
      }
      if (scenario.status === "passed") validateNativeRuntime(scenario, errors);
    }
    if (Array.isArray(scenario.events)) {
      let previousSequence = -1;
      const seen = new Set<number>();
      for (const event of scenario.events) {
        if (!isObject(event) || !Number.isInteger(event.sequence) || (event.sequence as number) < 0 || !isNonEmptyString(event.kind)) {
          errors.push(`invalid-event:${id}`);
          continue;
        }
        const sequence = event.sequence as number;
        if (seen.has(sequence) || sequence <= previousSequence) errors.push(`stale-or-duplicate-event-order:${id}`);
        seen.add(sequence);
        previousSequence = sequence;
      }
    }
    if (scenario.status === "passed" && nativeWebGpu) {
      if (scenario.evidenceClass !== "native-webgpu-retry-session") {
        errors.push(...validateGroundGlassLifecycleScenarioContracts(scenario, id));
      }
      validateLatestRequestEvidence(scenario, errors);
      validateSessionBoundary(scenario, errors);
      validateDeviceLossEquivalent(scenario, errors);
      validateTestDestroyedDeviceLoss(scenario, errors);
      validateAuthorizedRetrySession(scenario, errors);
      validatePendingQueueRetirement(scenario, errors);
      validatePendingUnmount(scenario, errors);
    }
    if (scenario.status === "passed") {
      validateWebGl2NegativeControl(scenario, errors);
      validateTerminalWebGl(scenario, errors);
    }
  }
  for (const scenario of scenarios) {
    if (!GROUND_GLASS_M7C_R187_REQUIRED_SCENARIO_IDS.includes(scenario.id as typeof GROUND_GLASS_M7C_R187_REQUIRED_SCENARIO_IDS[number])) {
      errors.push(`unexpected-scenario:${scenario.id}`);
    }
  }
  const declaredCounts = input.scenarioCounts;
  if (!isObject(declaredCounts)) errors.push("missing-scenario-counts");
  else {
    for (const key of statusKeys) {
      if (declaredCounts[key] !== counts[key]) errors.push(`scenario-count-mismatch:${key}`);
    }
    if (Object.keys(declaredCounts).some((key) => !statusKeys.includes(key as typeof statusKeys[number]))) {
      errors.push("unexpected-scenario-count-key");
    }
  }
  const qualification = qualificationFor(counts);
  if (input.qualification !== qualification) errors.push("qualification-mismatch");
  const revisionBoundary = input.revisionBoundary;
  if (!isObject(revisionBoundary) || revisionBoundary.rawRttRendererRevision !== "r187" ||
      revisionBoundary.rawRttEvidenceRevision !== ARCHITECTURE_RISE_RAW_RTT_R187_EVIDENCE_REVISION ||
      revisionBoundary.productionGroundGlass !== "webgl-only" ||
      revisionBoundary.r187DofAuthorization !== "denied") errors.push("r187-authorization-boundary-mismatch");
  return { valid: errors.length === 0, errors, qualification, counts };
};
