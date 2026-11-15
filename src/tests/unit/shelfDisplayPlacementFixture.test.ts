import { beforeAll, describe, expect, it, vi } from "vitest";
import { createSceneVariantIdentity, resolveSceneVariationDescriptor } from "../../scenes/sceneVariation";
import type { SceneVariationDescriptor } from "../../types/sceneVariation";

const forbiddenImports = vi.hoisted(() => ({
  three: vi.fn(),
  interiorCorner: vi.fn(),
}));

let fixture: typeof import("./fixtures/shelfDisplayPlacementFixture");

const createShelfDescriptor = (seed: number): SceneVariationDescriptor => {
  const descriptor = resolveSceneVariationDescriptor(
    {
      id: "shelf-display-fixture",
      sceneVariation: { enabled: true, schemaVersion: 2, supportedSchemaVersions: [2] },
    },
    createSceneVariantIdentity("shelf-display-fixture", seed, 2),
  );
  if (!descriptor) throw new Error("Expected the test-only shelf variation descriptor");
  return descriptor;
};

beforeAll(async () => {
  vi.doMock("three", () => {
    forbiddenImports.three();
    throw new Error("The shelf placement fixture must not load Three.js");
  });
  vi.doMock("../../scenes/interiorCornerPropVariation", () => {
    forbiddenImports.interiorCorner();
    throw new Error("The shelf placement fixture must not load Interior Corner planning");
  });
  fixture = await import("./fixtures/shelfDisplayPlacementFixture");
  expect(forbiddenImports.three).not.toHaveBeenCalled();
  expect(forbiddenImports.interiorCorner).not.toHaveBeenCalled();
  vi.doUnmock("three");
  vi.doUnmock("../../scenes/interiorCornerPropVariation");
});

describe("independent shelf display placement fixture", () => {
  it("resolves the same valid placement plan for a stable seed", () => {
    const first = fixture.resolveShelfDisplayPlacementPlan(createShelfDescriptor(284719));
    const second = fixture.resolveShelfDisplayPlacementPlan(createShelfDescriptor(284719));
    expect(second).toEqual(first);
    expect(fixture.serializeShelfDisplayPlacementPlan(second)).toBe(
      fixture.serializeShelfDisplayPlacementPlan(first),
    );
    expect(fixture.getShelfDisplayPlacementSafetyIssues(first)).toEqual([]);
  });

  it("allows different seeds to make valid alternative semantic choices", () => {
    const plans = [0, 1, 2, 3, 4, 5, 6, 7].map((seed) =>
      fixture.resolveShelfDisplayPlacementPlan(createShelfDescriptor(seed)),
    );
    const semanticDecisions = plans.map((plan) => JSON.stringify(plan.items));
    expect(new Set(semanticDecisions).size).toBeGreaterThan(1);
    plans.forEach((plan) => expect(fixture.getShelfDisplayPlacementSafetyIssues(plan)).toEqual([]));
  });

  it("keeps semantic object decisions stable when slot iteration order changes", () => {
    const descriptor = createShelfDescriptor(284719);
    const ordered = fixture.resolveShelfDisplayPlacementPlan(descriptor);
    const reversed = fixture.resolveShelfDisplayPlacementPlan(
      descriptor,
      [...fixture.shelfDisplaySlots].reverse(),
    );
    const decisionsById = (plan: typeof ordered) => Object.fromEntries(
      plan.items.map((item) => [item.id, item]),
    );
    expect(decisionsById(reversed)).toEqual(decisionsById(ordered));
  });

  it("detects unsupported placement, protected-region overlap, and pairwise collision", () => {
    const plan = fixture.resolveShelfDisplayPlacementPlan(createShelfDescriptor(284719));
    const [first, second] = plan.items;
    if (!first || !second) throw new Error("Expected two shelf display items");

    const unsupported = {
      ...plan,
      items: [{ ...first, positionMm: { ...first.positionMm, y: first.positionMm.y + 10 } }, second],
    };
    expect(fixture.getShelfDisplayPlacementSafetyIssues(unsupported)).toContain(
      `${first.id}: not supported by shelf`,
    );

    const protectedItem = {
      ...first,
      positionMm: { x: 0, y: first.positionMm.y, z: 0 },
    };
    const protectedPlan = { ...plan, items: [protectedItem, second] };
    expect(fixture.getShelfDisplayPlacementSafetyIssues(protectedPlan)).toContain(
      `${first.id}: intersects protected shelf region`,
    );

    const overlappingItem = { ...second, positionMm: { ...first.positionMm } };
    const overlappingPlan = { ...plan, items: [first, overlappingItem] };
    expect(fixture.getShelfDisplayPlacementSafetyIssues(overlappingPlan)).toContain(
      `${first.id} intersects ${second.id}`,
    );
  });
});
