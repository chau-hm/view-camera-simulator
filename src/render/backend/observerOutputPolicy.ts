import type { ObserverBackendSelection } from "./observerBackend";

export type ObserverOutputPolicy = "standard" | "material-aware";
export type ObserverOutputPolicyReason =
  | "standard-requested"
  | "scene-not-eligible"
  | "development-gate-disabled"
  | "webgpu-not-selected"
  | "material-aware-selected";

export type ObserverOutputPolicySelection = Readonly<{
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

/** Selects the isolated PR I output experiment without changing renderer eligibility. */
export const resolveObserverOutputPolicy = ({
  sceneId,
  requestedRendererParam,
  requestedOutputParam,
  backendSelection,
  developmentBuild,
}: ObserverOutputPolicyInput): ObserverOutputPolicySelection => {
  const requested: ObserverOutputPolicy = requestedOutputParam === "material-aware"
    ? "material-aware"
    : "standard";
  if (requested !== "material-aware") {
    return { requested, selected: "standard", reason: "standard-requested" };
  }
  if (!developmentBuild) {
    return { requested, selected: "standard", reason: "development-gate-disabled" };
  }
  if (sceneId !== "architecture-rise") {
    return { requested, selected: "standard", reason: "scene-not-eligible" };
  }
  if (
    requestedRendererParam !== "webgpu" ||
    backendSelection.status !== "selected" ||
    backendSelection.requestedRenderer !== "webgpu-pilot" ||
    backendSelection.selectionReason !== "webgpu-pilot-approved" ||
    backendSelection.rendererAttempt !== "webgpu" ||
    backendSelection.applicationFallback !== "none"
  ) {
    return { requested, selected: "standard", reason: "webgpu-not-selected" };
  }
  return { requested, selected: "material-aware", reason: "material-aware-selected" };
};
