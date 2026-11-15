import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { interiorCornerScene } from "../../scenes/definitions/interior-corner";
import {
  getInteriorCornerPropVariationPlanSafetyIssues,
  resolveInteriorCornerPropVariationPlan,
  serializeInteriorCornerPropVariationPlan,
} from "../../scenes/interiorCornerPropVariation";
import { createSceneVariantIdentity, resolveSceneVariationDescriptor } from "../../scenes/sceneVariation";
import type { SceneVariationDescriptor } from "../../types/sceneVariation";

const createPlan = (seed: number) => {
  const descriptor = resolveSceneVariationDescriptor(
    interiorCornerScene,
    createSceneVariantIdentity("interior-corner", seed, 2),
  );
  if (!descriptor) throw new Error("Expected an Interior Corner schema v2 descriptor");
  const plan = resolveInteriorCornerPropVariationPlan(descriptor);
  if (!plan) throw new Error("Expected a schema v2 prop plan");
  return { descriptor, plan };
};

const V2_PLAN_SIGNATURES: Readonly<Record<number, string>> = {
  0: "f75ec88d9ff3e410a92e9c04a2811d843b4e0b2c223cc81c0e8a0f943d68b279",
  1: "a2444f7294ce17a3bb26e1f701ff90773519ba26cb1beb96cff7b88ed54233c1",
  284719: "6cc1bfe1ffde90045f99c01af4bfeb7bee74fc05c6f0b262c3875ceb676cec95",
  [0xffff_ffff]: "fcca3b1d9ddb2ab6a315d90e7c0f53e5f755ac4fc38289a246ebb294b461e552",
};

describe("Interior Corner deterministic prop variation plan", () => {
  it.each(Object.entries(V2_PLAN_SIGNATURES))(
    "produces its fixed schema-v2 plan signature and a safe plan for seed %s",
    (seedText, expectedSignature) => {
      const seed = Number(seedText);
      const first = createPlan(seed).plan;
      const second = createPlan(seed).plan;
      expect(second).toEqual(first);
      expect(serializeInteriorCornerPropVariationPlan(second)).toBe(
        serializeInteriorCornerPropVariationPlan(first),
      );
      expect(JSON.parse(JSON.stringify(first))).toEqual(first);
      expect(createHash("sha256").update(JSON.stringify(first)).digest("hex"))
        .toBe(expectedSignature);
      expect(getInteriorCornerPropVariationPlanSafetyIssues(first)).toEqual([]);
      expect(first.schemaVersion).toBe(2);
      expect(Object.isFrozen(first)).toBe(true);
      expect(Object.isFrozen(first.props)).toBe(true);
    },
  );

  it("distinguishes representative seeds through object, count, or rug-pattern choices", () => {
    const plans = [0, 1, 284719, 0xffff_ffff].map((seed) => createPlan(seed).plan);
    const signatures = plans.map((plan) => serializeInteriorCornerPropVariationPlan(plan));
    expect(new Set(signatures).size).toBeGreaterThan(1);
    for (const plan of plans) {
      expect(plan.props.some((prop) => prop.kind === "vase")).toBe(true);
      expect(plan.props.some((prop) => prop.kind === "rug")).toBe(true);
      expect(plan.props.filter((prop) => prop.kind === "cushion").length).toBeGreaterThanOrEqual(1);
      expect(plan.props.filter((prop) => prop.kind === "cushion").length).toBeLessThanOrEqual(2);
    }
  });

  it("keeps a broad sample of generated placements inside validated supports", () => {
    for (let seed = 0; seed < 256; seed += 1) {
      const { plan } = createPlan(seed);
      expect(getInteriorCornerPropVariationPlanSafetyIssues(plan), `seed ${seed}`).toEqual([]);
      expect(plan.props.every((prop) => {
        const values = prop.kind === "vase"
          ? [prop.heightMm, prop.baseRadiusMm, prop.topRadiusMm]
          : [
              prop.dimensionsMm.width,
              prop.dimensionsMm.height,
              prop.dimensionsMm.depth,
            ];
        const positions = [prop.positionMm.x, prop.positionMm.y, prop.positionMm.z];
        return values.every((value) => Number.isFinite(value) && value > 0) &&
          positions.every(Number.isFinite);
      }), `seed ${seed} has positive finite dimensions`).toBe(true);
    }
  });

  it("keeps per-object choices independent from unrelated prop streams and materials", () => {
    const base = createPlan(284719).descriptor;
    const before = serializeInteriorCornerPropVariationPlan(
      resolveInteriorCornerPropVariationPlan(base)!,
    );
    const materialDraw = base.createRandomStream("materials", "wall-plaster").nextUint32();
    base.createRandomStream("props", "new-optional-book").nextUint32();
    base.createRandomStream("layout", "new-layout-item").nextUint32();

    const extendedDescriptor: SceneVariationDescriptor = {
      identity: base.identity,
      createRandomStream: (domain, objectId) => {
        if (domain === "props" && objectId === "new-optional-book") {
          base.createRandomStream(domain, objectId).nextUint32();
        }
        return base.createRandomStream(domain, objectId);
      },
    };
    const after = resolveInteriorCornerPropVariationPlan(extendedDescriptor);
    expect(after).not.toBeNull();
    expect(serializeInteriorCornerPropVariationPlan(after!)).toBe(before);
    expect(base.createRandomStream("materials", "wall-plaster").nextUint32()).toBe(materialDraw);
  });

  it("does not activate v2 props for v1 or another scene", () => {
    const v1 = resolveSceneVariationDescriptor(
      interiorCornerScene,
      createSceneVariantIdentity("interior-corner", 284719, 1),
    );
    expect(resolveInteriorCornerPropVariationPlan(v1 ?? undefined)).toBeNull();
    const wrongScene: SceneVariationDescriptor = {
      identity: createSceneVariantIdentity("another-scene", 284719, 2),
      createRandomStream: (domain, objectId) =>
        createPlan(284719).descriptor.createRandomStream(domain, objectId),
    };
    expect(() => resolveInteriorCornerPropVariationPlan(wrongScene)).toThrow(/canonical Interior Corner/);
  });
});
