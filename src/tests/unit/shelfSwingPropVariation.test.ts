import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { shelfSwingScene } from "../../scenes/definitions/shelf-swing";
import {
  getShelfSwingPropVariationSafetyIssues,
  resolveShelfSwingPropVariationCandidate,
  resolveShelfSwingPropVariationPlan,
  serializeShelfSwingPropVariationPlan,
  type ShelfSwingPropVariationCandidate,
} from "../../scenes/shelfSwingPropVariation";
import {
  createSceneVariantIdentity,
  resolveSceneVariationDescriptor,
} from "../../scenes/sceneVariation";
import type { SceneVariationDescriptor } from "../../types/sceneVariation";

const createPlan = (seed: number) => {
  const descriptor = resolveSceneVariationDescriptor(
    shelfSwingScene,
    createSceneVariantIdentity("shelf-swing", seed, 1),
  );
  if (!descriptor) throw new Error("Expected a Shelf Swing schema-v1 descriptor");
  const plan = resolveShelfSwingPropVariationPlan(descriptor);
  if (!plan) throw new Error("Expected a Shelf Swing schema-v1 prop plan");
  return { descriptor, plan };
};

const signature = (plan: ShelfSwingPropVariationCandidate): string =>
  createHash("sha256").update(JSON.stringify(plan)).digest("hex");

const withFirstStationProps = (
  plan: ShelfSwingPropVariationCandidate,
  props: ShelfSwingPropVariationCandidate["stations"][number]["props"],
): ShelfSwingPropVariationCandidate => ({
  schemaVersion: plan.schemaVersion,
  stations: plan.stations.map((station, index) => index === 0
    ? { ...station, props }
    : station),
});

describe("Shelf Swing deterministic prop variation plan", () => {
  it.each([0, 1, 284719, 0xffff_ffff])(
    "is deterministic, frozen, safe, and serializable for seed %s",
    (seed) => {
      const first = createPlan(seed).plan;
      const second = createPlan(seed).plan;
      expect(second).toEqual(first);
      expect(serializeShelfSwingPropVariationPlan(second)).toBe(
        serializeShelfSwingPropVariationPlan(first),
      );
      expect(JSON.parse(JSON.stringify(first))).toEqual(first);
      expect(Object.isFrozen(first)).toBe(true);
      expect(first.stations.every((station) => Object.isFrozen(station.props))).toBe(true);
      expect(first.schemaVersion).toBe(1);
      expect(first.fallbackUsed).toBe(false);
      expect(getShelfSwingPropVariationSafetyIssues(first)).toEqual([]);
    },
  );

  it("pins representative schema-v1 plan signatures", () => {
    // Accepted deterministic plan output for the first Shelf Swing schema.
    const expected: Readonly<Record<number, string>> = {
      0: "0fe4c4e9b4ee3a05411b6e63003ee8b255891ea06091c91aeccf52536ea1d3f8",
      1: "04f3e1c2be8ae8d60b920a27780a4a0a9189dc78465615644e9442ea1ac88104",
      284719: "85bef947291a31cc2f5c61c8884fb771212f1cffbee4d5396201676dbace9aef",
      [0xffff_ffff]: "adaf776456e9d3e0bb48f385af5121a1c873221aeccd90de80a101a5cdd7a708",
    };
    for (const [seedText, expectedSignature] of Object.entries(expected)) {
      expect(signature(createPlan(Number(seedText)).plan)).toBe(expectedSignature);
    }
  });

  it("changes at least one meaningful decorative choice across representative seeds", () => {
    const plans = [0, 1, 284719, 0xffff_ffff].map((seed) => createPlan(seed).plan);
    expect(new Set(plans.map(serializeShelfSwingPropVariationPlan)).size).toBeGreaterThan(1);
    expect(plans.every((plan) => plan.stations.every((station) =>
      station.props.length >= 1 && station.props.length <= 2,
    ))).toBe(true);
    expect(plans.some((plan) => plan.stations.some((station) =>
      station.props.some((prop) => prop.family === "vessel"),
    ))).toBe(true);
  });

  it("keeps a sampled range of independently seeded placements inside their supports", () => {
    for (let seed = 0; seed < 256; seed += 1) {
      const plan = createPlan(seed).plan;
      expect(getShelfSwingPropVariationSafetyIssues(plan), `seed ${seed}`).toEqual([]);
    }
  });

  it("keeps station streams independent when front choices change", () => {
    const base = createPlan(284719).descriptor;
    const alternate = createPlan(19).descriptor;
    const frontOnlyChange: SceneVariationDescriptor = {
      identity: base.identity,
      createRandomStream: (domain, objectId) =>
        objectId.startsWith("shelf-front/")
          ? alternate.createRandomStream(domain, objectId)
          : base.createRandomStream(domain, objectId),
    };
    const basePlan = resolveShelfSwingPropVariationPlan(base)!;
    const changedPlan = resolveShelfSwingPropVariationPlan(frontOnlyChange)!;
    expect(changedPlan.stations[0]).not.toEqual(basePlan.stations[0]);
    expect(changedPlan.stations.slice(1)).toEqual(basePlan.stations.slice(1));
  });

  it("keeps semantic props independent from new IDs, layout draws, and material draws", () => {
    const base = createPlan(284719).descriptor;
    const basePlan = resolveShelfSwingPropVariationPlan(base)!;
    const extendedDescriptor: SceneVariationDescriptor = {
      identity: base.identity,
      createRandomStream: (domain, objectId) => {
        if (domain === "props") {
          base.createRandomStream("props", "new-unrelated-decoration").nextUint32();
          base.createRandomStream("materials", "shelf-frame").nextUint32();
          base.createRandomStream("layout", "new-layout-item").nextUint32();
        }
        return base.createRandomStream(domain, objectId);
      },
    };
    expect(resolveShelfSwingPropVariationPlan(extendedDescriptor)).toEqual(basePlan);
    expect(resolveShelfSwingPropVariationPlan(undefined)).toBeNull();
  });

  it("does not use ambient randomness while resolving a scene identity", () => {
    const random = vi.spyOn(Math, "random");
    try {
      createPlan(284719);
      expect(random).not.toHaveBeenCalled();
    } finally {
      random.mockRestore();
    }
  });

  it("reports invalid support, context-book, chart, and prop-collision candidates", () => {
    const { plan } = createPlan(284719);
    const prop = plan.stations[0]!.props[0]!;

    expect(getShelfSwingPropVariationSafetyIssues(withFirstStationProps(plan, [{
      ...prop,
      positionMm: { ...prop.positionMm, y: 20 },
    }]))).toContain(`unsupported:${prop.id}`);

    expect(getShelfSwingPropVariationSafetyIssues(withFirstStationProps(plan, [{
      ...prop,
      positionMm: { x: -165, y: 153, z: 285 },
    }]))).toContain(`context-book-collision:${prop.id}`);

    expect(getShelfSwingPropVariationSafetyIssues(withFirstStationProps(plan, [{
      ...prop,
      positionMm: { x: 0, y: 560, z: 0 },
    }])).some((issue) => issue === `focus-chart-volume:${prop.id}` ||
      issue === `chart-visibility:${prop.id}`)).toBe(true);

    const duplicate = {
      ...prop,
      id: `${prop.id}-overlap`,
    };
    expect(getShelfSwingPropVariationSafetyIssues(withFirstStationProps(plan, [prop, duplicate]))
      .some((issue) => issue.startsWith("prop-collision:"))).toBe(true);
  });

  it("uses the fixed supported fallback without rerolling an invalid candidate", () => {
    const { plan } = createPlan(284719);
    const prop = plan.stations[0]!.props[0]!;
    const invalidCandidate = withFirstStationProps(plan, [{
      ...prop,
      positionMm: { ...prop.positionMm, y: 20 },
    }]);
    const firstFallback = resolveShelfSwingPropVariationCandidate(invalidCandidate);
    const secondFallback = resolveShelfSwingPropVariationCandidate(invalidCandidate);
    expect(firstFallback).toEqual(secondFallback);
    expect(firstFallback.fallbackUsed).toBe(true);
    expect(firstFallback.fallbackIssues).toContain(`unsupported:${prop.id}`);
    expect(getShelfSwingPropVariationSafetyIssues(firstFallback)).toEqual([]);
    expect(firstFallback.stations.every((station) => station.props.length === 1)).toBe(true);
  });

  it("fails closed for descriptors from another scene or schema", () => {
    const { descriptor } = createPlan(284719);
    expect(() => resolveShelfSwingPropVariationPlan({
      ...descriptor,
      identity: createSceneVariantIdentity("interior-corner", 284719, 1),
    })).toThrow(/canonical Shelf Swing identity/);
    expect(() => resolveShelfSwingPropVariationPlan({
      ...descriptor,
      identity: createSceneVariantIdentity("shelf-swing", 284719, 2),
    })).toThrow(/schema version 1 only/);
  });
});
