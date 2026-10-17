import { describe, expect, it } from "vitest";
import {
  outputTransformForAnatomyIntervention,
  resolveAnatomyOutputIntervention,
  type AnatomyOutputInterventionRenderable,
} from "../../render/backend/anatomyMaterialOutputIntervention";
import type { ConceptualCameraAnatomyPresentation } from "../../render/ConceptualViewCamera";

const frontStandardPresentation: ConceptualCameraAnatomyPresentation = {
  targets: [{ kind: "part", part: "front-standard" }],
};

const records: readonly AnatomyOutputInterventionRenderable[] = [
  { id: "front-standard-id", role: "conceptual-camera/front-standard", cameraPart: "front-standard", visible: true },
  { id: "lens-board-id", role: "conceptual-camera/lens-board", cameraPart: "lens-board", visible: true },
  { id: "lens-id", role: "conceptual-camera/lens", cameraPart: "lens", visible: true },
  { id: "bellows-id", role: "conceptual-camera/bellows", cameraPart: "bellows", visible: true },
  { id: "rear-standard-id", role: "conceptual-camera/rear-standard", cameraPart: "rear-standard", visible: true },
  { id: "subject-id", role: "registered-target-subject", cameraPart: null, visible: true },
  { id: "hidden-dimmed-id", role: "conceptual-camera/ground-glass-back", cameraPart: "ground-glass-back", visible: false },
  { id: "ghost-id", role: "ghost-reference-camera/bellows", cameraPart: "bellows", visible: true },
];

describe("Anatomy output intervention targeting", () => {
  it("uses the mounted Front Standard presentation to keep highlighted children out of B1 dimmed targets", () => {
    const result = resolveAnatomyOutputIntervention(
      "B1",
      frontStandardPresentation,
      records,
    );

    expect(result).toMatchObject({
      ok: true,
      mode: "B1",
      targetGroup: "dimmed",
      outputTransform: "bypass-rgb-transform",
      renderableIds: ["bellows-id", "rear-standard-id"],
    });
    if (!result.ok) throw new Error("Expected valid dimmed selection");
    expect(result.renderableIds).not.toContain("lens-board-id");
    expect(result.renderableIds).not.toContain("lens-id");
    expect(result.renderableIds).not.toContain("subject-id");
    expect(result.renderableIds).not.toContain("ghost-id");
    expect(result.renderableIds).not.toContain("hidden-dimmed-id");
  });

  it("targets only mounted highlighted semantic parts for the B4 control", () => {
    const result = resolveAnatomyOutputIntervention(
      "B4",
      frontStandardPresentation,
      records,
    );

    expect(result).toMatchObject({
      ok: true,
      mode: "B4",
      targetGroup: "highlighted",
      renderableIds: ["front-standard-id", "lens-board-id", "lens-id"],
    });
  });

  it("keeps exact-ID pair selections within the current dimmed group", () => {
    expect(resolveAnatomyOutputIntervention(
      "B1",
      frontStandardPresentation,
      records,
      { kind: "renderable-ids", renderableIds: ["bellows-id"] },
    )).toMatchObject({ ok: true, renderableIds: ["bellows-id"] });

    expect(resolveAnatomyOutputIntervention(
      "B1",
      frontStandardPresentation,
      records,
      { kind: "renderable-ids", renderableIds: ["lens-id"] },
    )).toEqual({ ok: false, reason: "selection-outside-target-group" });
    expect(resolveAnatomyOutputIntervention(
      "B1",
      frontStandardPresentation,
      records,
      { kind: "renderable-ids", renderableIds: ["stale-id"] },
    )).toEqual({ ok: false, reason: "stale-renderable-id" });
    expect(resolveAnatomyOutputIntervention(
      "B1",
      frontStandardPresentation,
      records,
      { kind: "renderable-ids", renderableIds: ["bellows-id", "bellows-id"] },
    )).toEqual({ ok: false, reason: "duplicate-renderable-id" });
  });

  it("rejects active interventions without mounted presentation evidence and maps B0-B4 to distinct RGB stages", () => {
    expect(resolveAnatomyOutputIntervention("B1", null, records)).toEqual({
      ok: false,
      reason: "mounted-presentation-unavailable",
    });
    expect(outputTransformForAnatomyIntervention("B0")).toBeNull();
    expect(outputTransformForAnatomyIntervention("B1")).toBe("bypass-rgb-transform");
    expect(outputTransformForAnatomyIntervention("B2")).toBe("bypass-tone-mapping");
    expect(outputTransformForAnatomyIntervention("B3")).toBe("bypass-color-space");
    expect(outputTransformForAnatomyIntervention("B4")).toBe("bypass-rgb-transform");
  });
});
