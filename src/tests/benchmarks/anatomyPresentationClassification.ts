import {
  CONCEPTUAL_CAMERA_ANATOMY_PARTS,
  resolveConceptualAnatomyElementState,
  resolveConceptualAnatomyPartState,
  type AnatomyPresentationState,
  type ConceptualAnatomyTarget,
  type ConceptualCameraAnatomyPresentation,
  type ConceptualCameraAnatomyPart,
} from "../../render/ConceptualViewCamera";

export type AnatomyPresentationRenderable = Readonly<{
  objectId: string;
  role: string;
  cameraPart: string | null;
  visible: boolean;
  parentHierarchy?: readonly Readonly<{ name: string }>[];
}>;

export type AnatomyPresentationClassification = Readonly<{
  targets: readonly ConceptualAnatomyTarget[];
  highlightedParts: readonly ConceptualCameraAnatomyPart[];
  dimmedParts: readonly ConceptualCameraAnatomyPart[];
  normalParts: readonly ConceptualCameraAnatomyPart[];
  highlightedRenderableIds: readonly string[];
  dimmedRenderableIds: readonly string[];
  normalRenderableIds: readonly string[];
  unclassifiedVisibleRenderableIds: readonly string[];
  selectedElements: readonly Readonly<{
    target: Extract<ConceptualAnatomyTarget, { kind: "element" }>;
    state: AnatomyPresentationState;
    renderableIds: readonly string[];
  }>[];
}>;

const partSet = new Set<string>(CONCEPTUAL_CAMERA_ANATOMY_PARTS);
const isConceptualCameraRole = (role: string): boolean =>
  role === "conceptual-camera" || role.startsWith("conceptual-camera/");

const validatePresentation = (
  presentation: ConceptualCameraAnatomyPresentation | null | undefined,
): ConceptualCameraAnatomyPresentation => {
  if (!presentation || !Array.isArray(presentation.targets)) {
    throw new Error("Anatomy audit requires the mounted scene's actual presentation targets");
  }
  for (const target of presentation.targets as readonly unknown[]) {
    if (!target || typeof target !== "object") {
      throw new Error("Anatomy audit cannot classify an invalid presentation target");
    }
    const value = target as Record<string, unknown>;
    if (value.kind === "part" && typeof value.part === "string" && partSet.has(value.part)) continue;
    if (value.kind === "element" && value.name === "lens-aperture-iris" && value.parentPart === "lens") continue;
    throw new Error(`Anatomy audit cannot classify unknown presentation target: ${JSON.stringify(target)}`);
  }
  return presentation;
};

export const resolveAnatomyPresentationClassification = (
  actualPresentation: ConceptualCameraAnatomyPresentation | null | undefined,
  renderables: readonly AnatomyPresentationRenderable[],
): AnatomyPresentationClassification => {
  const presentation = validatePresentation(actualPresentation);
  const states = CONCEPTUAL_CAMERA_ANATOMY_PARTS.map((part) => ({
    part,
    state: resolveConceptualAnatomyPartState(part, presentation),
  }));
  const highlightedParts = states.filter(({ state }) => state === "highlighted").map(({ part }) => part);
  const dimmedParts = states.filter(({ state }) => state === "dimmed").map(({ part }) => part);
  const normalParts = states.filter(({ state }) => state === "normal").map(({ part }) => part);
  const stateSets = [highlightedParts, dimmedParts, normalParts];
  for (let leftIndex = 0; leftIndex < stateSets.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < stateSets.length; rightIndex += 1) {
      const overlap = stateSets[leftIndex]!.filter((part) => stateSets[rightIndex]!.includes(part));
      if (overlap.length > 0) throw new Error(`Anatomy presentation state groups overlap: ${overlap.join(", ")}`);
    }
  }
  if (stateSets.flat().length !== CONCEPTUAL_CAMERA_ANATOMY_PARTS.length) {
    throw new Error("Anatomy presentation did not resolve every semantic camera part");
  }

  const visibleCameraRenderables = renderables.filter((renderable) =>
    renderable.visible && isConceptualCameraRole(renderable.role));
  const knownIds = new Set<string>();
  for (const renderable of visibleCameraRenderables) {
    if (knownIds.has(renderable.objectId)) throw new Error(`Duplicate visible Anatomy renderable ID: ${renderable.objectId}`);
    knownIds.add(renderable.objectId);
    if (renderable.cameraPart !== null && !partSet.has(renderable.cameraPart)) {
      throw new Error(`Anatomy renderable has an unknown semantic part: ${renderable.cameraPart}`);
    }
  }
  const idsForParts = (parts: readonly ConceptualCameraAnatomyPart[]) => visibleCameraRenderables
    .filter((renderable) => renderable.cameraPart !== null && parts.includes(renderable.cameraPart as ConceptualCameraAnatomyPart))
    .map((renderable) => renderable.objectId)
    .sort();
  const selectedElements = presentation.targets.flatMap((target) => {
    if (target.kind !== "element") return [];
    return [{
      target,
      state: resolveConceptualAnatomyElementState(target.name, target.parentPart, presentation),
      renderableIds: visibleCameraRenderables
        .filter((renderable) => renderable.cameraPart === target.parentPart &&
          renderable.parentHierarchy?.some(({ name }) => name === target.name))
        .map((renderable) => renderable.objectId)
        .sort(),
    }];
  });
  return {
    targets: presentation.targets,
    highlightedParts,
    dimmedParts,
    normalParts,
    highlightedRenderableIds: idsForParts(highlightedParts),
    dimmedRenderableIds: idsForParts(dimmedParts),
    normalRenderableIds: idsForParts(normalParts),
    unclassifiedVisibleRenderableIds: visibleCameraRenderables
      .filter((renderable) => renderable.cameraPart === null)
      .map((renderable) => renderable.objectId)
      .sort(),
    selectedElements,
  };
};

