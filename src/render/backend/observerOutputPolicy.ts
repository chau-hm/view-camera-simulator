import type { ObserverBackendSelection } from "./observerBackend";

export type ObserverOutputPolicy = "standard" | "material-aware";
export type ObserverOutputPolicyReason =
  | "standard-default"
  | "standard-requested"
  | "unknown-output-request"
  | "scene-not-eligible"
  | "development-gate-disabled"
  | "webgpu-not-selected"
  | "material-aware-selected"
  | "development-pilot-default";

export type ObserverOutputPolicySelection = Readonly<{
  requestedParameter: string | null;
  requested: ObserverOutputPolicy;
  selected: ObserverOutputPolicy;
  reason: ObserverOutputPolicyReason;
}>;

export type ObserverOutputPolicyInput = Readonly<{
  sceneId: string;
  requestedRendererParam: string | null;
  requestedOutputParam: string | null;
  backendSelection: ObserverBackendSelection;
  developmentBuild: boolean;
}>;

/** Selects the Architecture Rise WebGPU output treatment without changing renderer eligibility. */
export const resolveObserverOutputPolicy = ({
  sceneId,
  requestedRendererParam,
  requestedOutputParam,
  backendSelection,
  developmentBuild,
}: ObserverOutputPolicyInput): ObserverOutputPolicySelection => {
  const requestIsKnown = requestedOutputParam === null ||
    requestedOutputParam === "standard" ||
    requestedOutputParam === "material-aware";
  const defaultCandidateRequested = requestedOutputParam === null &&
    developmentBuild &&
    sceneId === "architecture-rise" &&
    requestedRendererParam === "webgpu";
  const requested: ObserverOutputPolicy = requestedOutputParam === "material-aware" ||
    defaultCandidateRequested
    ? "material-aware"
    : "standard";
  if (!requestIsKnown) {
    return {
      requestedParameter: requestedOutputParam,
      requested: "standard",
      selected: "standard",
      reason: "unknown-output-request",
    };
  }
  if (requested !== "material-aware") {
    return {
      requestedParameter: requestedOutputParam,
      requested,
      selected: "standard",
      reason: requestedOutputParam === "standard" ? "standard-requested" : "standard-default",
    };
  }
  if (!developmentBuild) {
    return {
      requestedParameter: requestedOutputParam,
      requested,
      selected: "standard",
      reason: "development-gate-disabled",
    };
  }
  if (sceneId !== "architecture-rise") {
    return {
      requestedParameter: requestedOutputParam,
      requested,
      selected: "standard",
      reason: "scene-not-eligible",
    };
  }
  if (
    requestedRendererParam !== "webgpu" ||
    backendSelection.status !== "selected" ||
    backendSelection.requestedRenderer !== "webgpu-pilot" ||
    backendSelection.selectionReason !== "webgpu-pilot-approved" ||
    backendSelection.rendererAttempt !== "webgpu" ||
    backendSelection.applicationFallback !== "none"
  ) {
    return {
      requestedParameter: requestedOutputParam,
      requested,
      selected: "standard",
      reason: "webgpu-not-selected",
    };
  }
  return {
    requestedParameter: requestedOutputParam,
    requested,
    selected: "material-aware",
    reason: defaultCandidateRequested
      ? "development-pilot-default"
      : "material-aware-selected",
  };
};
