import { describe, expect, it, vi } from "vitest";
import { resolveSceneVariantRoute } from "../../app/sceneVariationRoute";
import type { ParsedSceneSeed } from "../../app/sceneVariationUrl";
import { createSceneVariantIdentity } from "../../scenes/sceneVariation";

const capability = { enabled: true as const, schemaVersion: 1 };
const missingSeed: ParsedSceneSeed = { kind: "missing" };

describe("scene variation route policy", () => {
  it("uses a valid URL seed exactly and never asks for entropy", () => {
    const createSeed = vi.fn(() => 9);
    const result = resolveSceneVariantRoute({
      mode: "free",
      sceneId: "interior-corner",
      capability,
      routeKey: "entry-a",
      seed: { kind: "valid", seed: 0xffff_ffff },
      previousIdentity: null,
      previousRouteKey: null,
      createSeed,
    });
    expect(result).toMatchObject({
      status: "resolved",
      seedSource: "explicit-url",
      identity: { sceneId: "interior-corner", seed: 0xffff_ffff, schemaVersion: 1 },
    });
    expect(createSeed).not.toHaveBeenCalled();
  });

  it("generates once for one implicit location and reuses on effect replay", () => {
    const createSeed = vi.fn(() => 284719);
    const first = resolveSceneVariantRoute({
      mode: "free",
      sceneId: "interior-corner",
      capability,
      routeKey: "location-a",
      seed: missingSeed,
      previousIdentity: null,
      previousRouteKey: null,
      createSeed,
    });
    const replay = resolveSceneVariantRoute({
      mode: "free",
      sceneId: "interior-corner",
      capability,
      routeKey: "location-a",
      seed: missingSeed,
      previousIdentity: first.identity,
      previousRouteKey: "location-a",
      createSeed,
    });
    expect(first).toMatchObject({ status: "resolved", seedSource: "generated-missing" });
    expect(replay).toMatchObject({ status: "resolved", seedSource: "reused-location" });
    expect(replay.identity).toBe(first.identity);
    expect(createSeed).toHaveBeenCalledTimes(1);
  });

  it("uses a new implicit session seed for a distinct router location", () => {
    const identity = createSceneVariantIdentity("interior-corner", 12);
    const result = resolveSceneVariantRoute({
      mode: "free",
      sceneId: "interior-corner",
      capability,
      routeKey: "location-b",
      seed: missingSeed,
      previousIdentity: identity,
      previousRouteKey: "location-a",
      createSeed: () => 13,
    });
    expect(result).toMatchObject({
      status: "resolved",
      seedSource: "generated-missing",
      identity: { sceneId: "interior-corner", seed: 13 },
    });
  });

  it("replaces invalid seeds with one generated value", () => {
    const result = resolveSceneVariantRoute({
      mode: "free",
      sceneId: "interior-corner",
      capability,
      routeKey: "invalid-entry",
      seed: { kind: "invalid", rawValues: ["1e3"] },
      previousIdentity: null,
      previousRouteKey: null,
      createSeed: () => 21,
    });
    expect(result).toMatchObject({
      status: "resolved",
      seedSource: "generated-invalid",
      identity: { seed: 21 },
    });
  });

  it("never activates variation for Guided Mode, missing capability, or unsupported schema", () => {
    const createSeed = vi.fn(() => 9);
    const common = {
      sceneId: "interior-corner",
      routeKey: "route",
      seed: { kind: "valid", seed: 8 } as const,
      previousIdentity: createSceneVariantIdentity("interior-corner", 7),
      previousRouteKey: "old-route",
      createSeed,
    };
    expect(resolveSceneVariantRoute({ ...common, mode: "guided", capability })).toEqual({
      status: "disabled",
      identity: null,
    });
    expect(resolveSceneVariantRoute({ ...common, mode: "free" })).toEqual({
      status: "disabled",
      identity: null,
    });
    expect(resolveSceneVariantRoute({
      ...common,
      mode: "free",
      capability: { enabled: true, schemaVersion: 2 },
    })).toEqual({ status: "unsupported-schema", identity: null });
    expect(createSeed).not.toHaveBeenCalled();
  });
});
