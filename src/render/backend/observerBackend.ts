import type { ObserverSceneCompatibility } from "./observerSceneCompatibility";

export type ObserverRendererRequest = "webgl" | "webgpu-pilot" | "unknown";
export type ObserverRendererAttempt = "webgl" | "webgpu";
export type ObserverApplicationFallback = "none" | "app-webgl";

export type ObserverBackendSelectionReason =
  | "default-webgl-request"
  | "webgpu-pilot-approved"
  | "development-gate-disabled"
  | "scene-compatibility-not-evaluated"
  | "scene-requirements-not-declared"
  | "scene-requirement-unverified"
  | "scene-has-known-webgpu-constraint"
  | "scene-not-pilot-enabled"
  | "unrecognized-renderer-request";

type ObserverBackendSelectionBase = Readonly<{
  requestedRenderer: ObserverRendererRequest;
  applicationFallback: ObserverApplicationFallback;
  webglAvailable: boolean;
  selectionReason: ObserverBackendSelectionReason;
}>;

export type ObserverBackendSelection =
  | (ObserverBackendSelectionBase & Readonly<{
      status: "selected";
      rendererAttempt: ObserverRendererAttempt;
    }>)
  | (ObserverBackendSelectionBase & Readonly<{
      status: "unavailable";
      rendererAttempt: null;
      failureReason: "no-supported-backend" | "renderer-initialization-failed";
    }>);

export type SelectedObserverBackend = Extract<
  ObserverBackendSelection,
  { status: "selected" }
>;

export type ObserverBackendSelectionInput = Readonly<{
  webglAvailable: boolean;
  requestedRendererParam: string | null;
  sceneCompatibility: ObserverSceneCompatibility;
  developmentPilotEnabled: boolean;
}>;

const resolveRequestedRenderer = (
  requestedRendererParam: string | null,
): ObserverRendererRequest => {
  if (requestedRendererParam === null || requestedRendererParam === "webgl") {
    return "webgl";
  }
  if (requestedRendererParam === "webgpu") return "webgpu-pilot";
  return "unknown";
};

const resolveWebGpuPilotDenialReason = (
  input: ObserverBackendSelectionInput,
): ObserverBackendSelectionReason | null => {
  if (!input.developmentPilotEnabled) return "development-gate-disabled";
  if (input.sceneCompatibility.requirements === null) {
    return "scene-requirements-not-declared";
  }
  if (input.sceneCompatibility.knownBackendConstraints.length > 0) {
    return "scene-has-known-webgpu-constraint";
  }
  if (input.sceneCompatibility.webgpu.status !== "verified") {
    return "scene-compatibility-not-evaluated";
  }
  const verifiedRequirements = input.sceneCompatibility.webgpu.verifiedRequirements;
  if (
    input.sceneCompatibility.requirements.some(
      (requirement) => !verifiedRequirements.includes(requirement),
    )
  ) {
    return "scene-requirement-unverified";
  }
  if (input.sceneCompatibility.developmentWebGpuPilot !== "eligible") {
    return "scene-not-pilot-enabled";
  }
  return null;
};

/** Pure policy: declarations and rollout approval permit an attempt; runtime evidence remains separate. */
export const selectObserverBackend = (
  input: ObserverBackendSelectionInput,
): ObserverBackendSelection => {
  const requestedRenderer = resolveRequestedRenderer(input.requestedRendererParam);
  const selectionReason = requestedRenderer === "unknown"
    ? "unrecognized-renderer-request"
    : requestedRenderer === "webgpu-pilot"
      ? resolveWebGpuPilotDenialReason(input) ?? "webgpu-pilot-approved"
      : "default-webgl-request";
  const pilotApproved =
    requestedRenderer === "webgpu-pilot" &&
    selectionReason === "webgpu-pilot-approved";

  if (pilotApproved) {
    return {
      status: "selected",
      requestedRenderer,
      rendererAttempt: "webgpu",
      applicationFallback: "none",
      webglAvailable: input.webglAvailable,
      selectionReason,
    };
  }

  if (!input.webglAvailable) {
    return {
      status: "unavailable",
      requestedRenderer,
      rendererAttempt: null,
      applicationFallback: "none",
      webglAvailable: false,
      selectionReason,
      failureReason: "no-supported-backend",
    };
  }

  return {
    status: "selected",
    requestedRenderer,
    rendererAttempt: "webgl",
    applicationFallback: "none",
    webglAvailable: true,
    selectionReason,
  };
};

/** Resolves the single allowed application-level fallback after a WebGPU attempt fails. */
export const resolveObserverRendererInitializationFailure = (
  selection: SelectedObserverBackend,
): ObserverBackendSelection => {
  if (
    selection.requestedRenderer === "webgpu-pilot" &&
    selection.rendererAttempt === "webgpu" &&
    selection.applicationFallback === "none"
  ) {
    if (selection.webglAvailable) {
      return {
        ...selection,
        rendererAttempt: "webgl",
        applicationFallback: "app-webgl",
      };
    }

    return {
      status: "unavailable",
      requestedRenderer: selection.requestedRenderer,
      rendererAttempt: null,
      applicationFallback: "none",
      webglAvailable: false,
      selectionReason: selection.selectionReason,
      failureReason: "renderer-initialization-failed",
    };
  }

  return {
    status: "unavailable",
    requestedRenderer: selection.requestedRenderer,
    rendererAttempt: null,
    applicationFallback: selection.applicationFallback,
    webglAvailable: selection.webglAvailable,
    selectionReason: selection.selectionReason,
    failureReason: "renderer-initialization-failed",
  };
};
