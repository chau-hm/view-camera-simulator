import { describe, expect, it } from "vitest";
import { stillLifeStudioScene } from "../../scenes/definitions/still-life-studio";
import {
  createStillLifeStudioFallbackPlan,
  resolveStillLifeStudioPlan,
  validateStillLifeStudioPlan,
} from "../../scenes/stillLifeStudioVariation";
import {
  stillLifeStudioFocusReferences,
  stillLifeStudioFocusTargets,
  stillLifeStudioTable,
} from "../../scenes/stillLifeStudioGeometry";
import { createSceneVariantIdentity, resolveSceneVariationDescriptor } from "../../scenes/sceneVariation";
import { getYawRotatedBoxBoundsMm } from "../../scenes/variation/placementGeometry";
import { isSupportedAtHeightMm } from "../../scenes/variation/placementConstraints";

const descriptorFor = (seed: number) => resolveSceneVariationDescriptor(
  stillLifeStudioScene,
  createSceneVariantIdentity(stillLifeStudioScene.id, seed, 1),
)!;

describe("Still-Life Studio schema-v1 variation", () => {
  it("reproduces fixed seed plans and their serialization", () => {
    for (const seed of [0, 1, 284719, 0xffff_ffff]) {
      const first = resolveStillLifeStudioPlan(descriptorFor(seed));
      const second = resolveStillLifeStudioPlan(descriptorFor(seed));

      expect(first).toEqual(second);
      expect(JSON.stringify(first)).toBe(JSON.stringify(second));
      expect(first.schemaVersion).toBe(1);
      expect(first.fallbackUsed).toBe(false);
      expect(validateStillLifeStudioPlan(first)).toEqual([]);
    }
  });

  it("uses independent semantic substreams for each object and domain", () => {
    const descriptor = descriptorFor(284719);
    const heroBefore = descriptor.createRandomStream("materials", "hero");
    const heroControl = descriptor.createRandomStream("materials", "hero");
    const unrelatedObject = descriptor.createRandomStream("materials", "optional-accent");

    expect(heroBefore.nextUint32()).toBe(heroControl.nextUint32());
    unrelatedObject.nextUint32();
    expect(heroBefore.nextUint32()).toBe(heroControl.nextUint32());
    expect(
      descriptor.createRandomStream("materials", "hero").nextUint32(),
    ).not.toBe(
      descriptor.createRandomStream("props", "hero").nextUint32(),
    );
  });

  it("keeps the twelve-seed frozen sample within the curated bounds", () => {
    const seeds = [
      0,
      1,
      284719,
      0xffff_ffff,
      3079748268,
      654013979,
      4041585854,
      2762659077,
      2004402848,
      1824298367,
      2130322642,
      4065361417,
    ];
    const plans = seeds.map((seed) => resolveStillLifeStudioPlan(descriptorFor(seed)));

    expect(plans.every((plan) => validateStillLifeStudioPlan(plan).length === 0)).toBe(true);
    expect(plans.every((plan) => plan.objects.length >= 3 && plan.objects.length <= 4)).toBe(true);
    expect(new Set(plans.map((plan) => plan.compositionId)).size).toBeGreaterThanOrEqual(3);
    expect(new Set(plans.map((plan) => JSON.stringify(plan.objects))).size).toBeGreaterThanOrEqual(8);
    expect(new Set(plans.flatMap((plan) => plan.objects.map(({ family }) => family)))).toEqual(
      new Set(["vessel", "books", "wooden-form", "bowl"]),
    );
  });

  it("passes a deterministic 256-seed placement sweep with no fallback", () => {
    let fallbackCount = 0;
    const compositions = new Set<string>();
    const counts = new Set<number>();

    for (let seed = 0; seed < 256; seed += 1) {
      const plan = resolveStillLifeStudioPlan(descriptorFor(seed));
      fallbackCount += Number(plan.fallbackUsed);
      compositions.add(plan.compositionId);
      counts.add(plan.objects.length);
      expect(validateStillLifeStudioPlan(plan), `seed ${seed}`).toEqual([]);

      for (const object of plan.objects) {
        const bounds = getYawRotatedBoxBoundsMm(
          object.positionMm,
          object.dimensionsMm,
          object.rotationYDeg,
        );
        expect(isSupportedAtHeightMm(bounds.min.y, stillLifeStudioTable.topYmm, 1e-6)).toBe(true);
      }
    }

    expect(fallbackCount).toBe(0);
    expect(compositions.size).toBe(4);
    expect(counts).toEqual(new Set([3, 4]));
  });

  it("keeps visible focus references fixed and independent of subject selection", () => {
    const seeds = [0, 1, 284719, 0xffff_ffff];
    const signature = JSON.stringify(stillLifeStudioFocusTargets);
    expect(stillLifeStudioFocusReferences).toHaveLength(3);
    expect(stillLifeStudioFocusTargets.map(({ id }) => id)).toEqual(
      stillLifeStudioFocusReferences.map(({ id }) => id),
    );
    seeds.forEach((seed) => {
      resolveStillLifeStudioPlan(descriptorFor(seed));
      expect(JSON.stringify(stillLifeStudioFocusTargets)).toBe(signature);
    });
  });

  it("provides a deterministic validated safe fallback", () => {
    const first = createStillLifeStudioFallbackPlan();
    const second = createStillLifeStudioFallbackPlan();
    expect(first).toEqual(second);
    expect(first.fallbackUsed).toBe(true);
    expect(first.fallbackIssues).toEqual([]);
    expect(validateStillLifeStudioPlan(first)).toEqual([]);
    expect(resolveStillLifeStudioPlan()).toEqual(first);
  });
});

