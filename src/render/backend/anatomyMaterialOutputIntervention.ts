import {
  CONCEPTUAL_CAMERA_ANATOMY_PARTS,
  resolveConceptualAnatomyPartState,
  type ConceptualCameraAnatomyPresentation,
} from "../ConceptualViewCamera";
import type { MaterialAwareOutputTransform } from "./materialAwareNodeMaterials";

export const ANATOMY_OUTPUT_INTERVENTION_EVENT =
  "vcs:observer-verification:anatomy-output-intervention";
export const ANATOMY_OUTPUT_INTERVENTION_RESULT_EVENT =
  "vcs:observer-verification:anatomy-output-intervention-result";

export type AnatomyOutputInterventionMode = "B0" | "B1" | "B2" | "B3" | "B4";
export type AnatomyOutputInterventionTargetGroup = "dimmed" | "highlighted";
export type AnatomyOutputInterventionSelection =
  | Readonly<{ kind: "presentation-group" }>
  | Readonly<{ kind: "renderable-ids"; renderableIds: readonly string[] }>;

export type AnatomyOutputInterventionRenderable = Readonly<{
  id: string;
  role: string;
  cameraPart: string | null;
  visible: boolean;
}>;

export type AnatomyOutputInterventionResolution =
  | Readonly<{
      ok: true;
      mode: AnatomyOutputInterventionMode;
      targetGroup: AnatomyOutputInterventionTargetGroup | null;
      outputTransform: MaterialAwareOutputTransform | null;
      renderableIds: readonly string[];
      semanticParts: readonly string[];
    }>
  | Readonly<{
      ok: false;
      reason:
        | "mounted-presentation-unavailable"
        | "invalid-selection"
        | "empty-selection"
        | "duplicate-renderable-id"
        | "stale-renderable-id"
        | "selection-outside-target-group";
    }>;

const isConceptualCameraRole = (role: string): boolean =>
  role === "conceptual-camera" || role.startsWith("conceptual-camera/");

const targetGroupForMode = (mode: AnatomyOutputInterventionMode): AnatomyOutputInterventionTargetGroup | null => {
  if (mode === "B0") return null;
  return mode === "B4" ? "highlighted" : "dimmed";
};

export const outputTransformForAnatomyIntervention = (
  mode: AnatomyOutputInterventionMode,
): MaterialAwareOutputTransform | null => {
  switch (mode) {
    case "B0": return null;
    case "B1":
    case "B4": return "bypass-rgb-transform";
    case "B2": return "bypass-tone-mapping";
    case "B3": return "bypass-color-space";
  }
};

/**
 * Resolve targets from the mounted semantic presentation and current visible
 * renderable IDs. Explicit-ID selections are accepted only within the mode's
 * presentation group, which bounds pairwise experiments to current dimmed or
 * highlighted Anatomy parts.
 */
export const resolveAnatomyOutputIntervention = (
  mode: AnatomyOutputInterventionMode,
  presentation: ConceptualCameraAnatomyPresentation | null,
  records: readonly AnatomyOutputInterventionRenderable[],
  selection: AnatomyOutputInterventionSelection = { kind: "presentation-group" },
): AnatomyOutputInterventionResolution => {
  if (mode === "B0") {
    return {
      ok: true,
      mode,
      targetGroup: null,
      outputTransform: null,
      renderableIds: [],
      semanticParts: [],
    };
  }
  if (!presentation || !Array.isArray(presentation.targets)) {
    return { ok: false, reason: "mounted-presentation-unavailable" };
  }
  if (selection.kind !== "presentation-group" && selection.kind !== "renderable-ids") {
    return { ok: false, reason: "invalid-selection" };
  }

  const targetGroup = targetGroupForMode(mode);
  if (!targetGroup) return { ok: false, reason: "invalid-selection" };
  const semanticParts = CONCEPTUAL_CAMERA_ANATOMY_PARTS.filter((part) =>
    resolveConceptualAnatomyPartState(part, presentation) === targetGroup,
  );
  const eligible = records.filter((record) =>
    record.visible &&
    isConceptualCameraRole(record.role) &&
    record.cameraPart !== null &&
    semanticParts.includes(record.cameraPart as (typeof CONCEPTUAL_CAMERA_ANATOMY_PARTS)[number]),
  );
  const eligibleIds = new Set(eligible.map((record) => record.id));

  if (selection.kind === "presentation-group") {
    return eligible.length > 0
      ? {
          ok: true,
          mode,
          targetGroup,
          outputTransform: outputTransformForAnatomyIntervention(mode),
          renderableIds: eligible.map((record) => record.id).sort(),
          semanticParts,
        }
      : { ok: false, reason: "empty-selection" };
  }

  if (selection.renderableIds.length === 0) return { ok: false, reason: "empty-selection" };
  const requestedIds = new Set(selection.renderableIds);
  if (requestedIds.size !== selection.renderableIds.length) {
    return { ok: false, reason: "duplicate-renderable-id" };
  }
  if ([...requestedIds].some((id) => !records.some((record) => record.id === id))) {
    return { ok: false, reason: "stale-renderable-id" };
  }
  if ([...requestedIds].some((id) => !eligibleIds.has(id))) {
    return { ok: false, reason: "selection-outside-target-group" };
  }
  return {
    ok: true,
    mode,
    targetGroup,
    outputTransform: outputTransformForAnatomyIntervention(mode),
    renderableIds: [...requestedIds].sort(),
    semanticParts,
  };
};
