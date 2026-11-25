import { describe, expect, it, vi } from "vitest";
import { resolveSceneVariantRoute } from "../../app/sceneVariationRoute";
import {
  createSceneVariantRegenerationLocation,
  type ParsedSceneSeed,
} from "../../app/sceneVariationUrl";
import { createSceneVariantIdentity } from "../../scenes/sceneVariation";
import { shelfSwingScene } from "../../scenes/definitions/shelf-swing";

const capability = {
  enabled: true as const,
  schemaVersion: 2,
  supportedSchemaVersions: [1, 2],
};
const missingSeed: ParsedSceneSeed = { kind: "missing" };

describe("scene variation route policy", () => {
  it("preserves legacy Shelf Swing v1 and keeps current v1 as the implicit identity", () => {
    const explicit = resolveSceneVariantRoute({
      mode: "free",
      sceneId: "shelf-swing",
      capability: shelfSwingScene.sceneVariation,
      routeKey: "shelf-explicit",
      seed: { kind: "valid", seed: 284719 },
      schema: { kind: "valid", schemaVersion: 1 },
      previousIdentity: null,
      previousRouteKey: null,
      createSeed: () => 5,
    });
    const legacy = resolveSceneVariantRoute({
      mode: "free",
      sceneId: "shelf-swing",
      capability: shelfSwingScene.sceneVariation,
      routeKey: "shelf-legacy",
      seed: { kind: "valid", seed: 284719 },
      previousIdentity: null,
      previousRouteKey: null,
      createSeed: () => 5,
    });
    const implicit = resolveSceneVariantRoute({
      mode: "free",
      sceneId: "shelf-swing",
      capability: shelfSwingScene.sceneVariation,
      routeKey: "shelf-implicit",
      seed: missingSeed,
      previousIdentity: null,
      previousRouteKey: null,
      createSeed: () => 9,
    });
    const explicitV2 = resolveSceneVariantRoute({
      mode: "free",
      sceneId: "shelf-swing",
      capability: shelfSwingScene.sceneVariation,
      routeKey: "shelf-explicit-v2",
      seed: { kind: "valid", seed: 284719 },
      schema: { kind: "valid", schemaVersion: 2 },
      previousIdentity: null,
      previousRouteKey: null,
      createSeed: () => 5,
    });
    const generatedV1 = resolveSceneVariantRoute({
      mode: "free",
      sceneId: "shelf-swing",
      capability: shelfSwingScene.sceneVariation,
      routeKey: "shelf-generated-v1",
      seed: missingSeed,
      schema: { kind: "valid", schemaVersion: 1 },
      previousIdentity: null,
      previousRouteKey: null,
      createSeed: () => 17,
    });
    const generatedV2 = resolveSceneVariantRoute({
      mode: "free",
      sceneId: "shelf-swing",
      capability: shelfSwingScene.sceneVariation,
      routeKey: "shelf-generated-v2",
      seed: missingSeed,
      schema: { kind: "valid", schemaVersion: 2 },
      previousIdentity: null,
      previousRouteKey: null,
      createSeed: () => 19,
    });
    expect(explicit.identity).toEqual({ sceneId: "shelf-swing", seed: 284719, schemaVersion: 1 });
    expect(legacy.identity).toEqual({ sceneId: "shelf-swing", seed: 284719, schemaVersion: 1 });
    expect(explicitV2.identity).toEqual({ sceneId: "shelf-swing", seed: 284719, schemaVersion: 2 });
    expect(implicit.identity).toEqual({ sceneId: "shelf-swing", seed: 9, schemaVersion: 1 });
    expect(generatedV1.identity).toEqual({ sceneId: "shelf-swing", seed: 17, schemaVersion: 1 });
    expect(generatedV2.identity).toEqual({ sceneId: "shelf-swing", seed: 19, schemaVersion: 2 });
  });

  it("fails closed on unsupported Shelf Swing schemas and preserves the active version on regeneration", () => {
    const unsupported = resolveSceneVariantRoute({
      mode: "free",
      sceneId: "shelf-swing",
      capability: shelfSwingScene.sceneVariation,
      routeKey: "shelf-unsupported",
      seed: { kind: "valid", seed: 284719 },
      schema: { kind: "unsupported", schemaVersion: 3 },
      previousIdentity: null,
      previousRouteKey: null,
      createSeed: () => 5,
    });
    expect(unsupported).toEqual({ status: "unsupported-schema", identity: null });

    const locationV1 = createSceneVariantRegenerationLocation({
      mode: "free",
      scene: shelfSwingScene,
      activeSchemaVersion: 1,
      location: {
        pathname: "/simulator/free/shelf-swing",
        search: "?keep=two&seed=284719&sv=1",
        hash: "#observer",
      },
      createSeed: () => 91,
    });
    const locationV2 = createSceneVariantRegenerationLocation({
      mode: "free",
      scene: shelfSwingScene,
      activeSchemaVersion: 2,
      location: {
        pathname: "/simulator/free/shelf-swing",
        search: "?keep=two&seed=284719&sv=2",
        hash: "#observer",
      },
      createSeed: () => 92,
    });
    expect(locationV1).toEqual({
      pathname: "/simulator/free/shelf-swing",
      search: "?keep=two&seed=91&sv=1",
      hash: "#observer",
    });
    expect(locationV2).toEqual({
      pathname: "/simulator/free/shelf-swing",
      search: "?keep=two&seed=92&sv=2",
      hash: "#observer",
    });
  });

  it("uses a valid URL seed exactly and never asks for entropy", () => {
    const createSeed = vi.fn(() => 9);
    const result = resolveSceneVariantRoute({
      mode: "free",
      sceneId: "interior-corner",
      capability,
      routeKey: "entry-a",
      seed: { kind: "valid", seed: 0xffff_ffff },
      schema: { kind: "valid", schemaVersion: 2 },
      previousIdentity: null,
      previousRouteKey: null,
      createSeed,
    });
    expect(result).toMatchObject({
      status: "resolved",
      seedSource: "explicit-url",
      identity: { sceneId: "interior-corner", seed: 0xffff_ffff, schemaVersion: 2 },
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
    expect(first).toMatchObject({
      status: "resolved",
      seedSource: "generated-missing",
      identity: { schemaVersion: 2 },
    });
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
      identity: { sceneId: "interior-corner", seed: 13, schemaVersion: 2 },
    });
  });

  it("keeps a legacy bare-seed URL on v1 and honors explicit v1", () => {
    const resolve = (schema?: { kind: "valid"; schemaVersion: number }) =>
      resolveSceneVariantRoute({
        mode: "free",
        sceneId: "interior-corner",
        capability,
        routeKey: schema ? "explicit-v1" : "legacy-v1",
        seed: { kind: "valid", seed: 284719 },
        schema,
        previousIdentity: null,
        previousRouteKey: null,
        createSeed: () => 99,
      });

    expect(resolve().identity).toEqual({
      sceneId: "interior-corner",
      seed: 284719,
      schemaVersion: 1,
    });
    expect(resolve({ kind: "valid", schemaVersion: 1 }).identity?.schemaVersion).toBe(1);
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
      capability: { enabled: true, schemaVersion: 3 },
    })).toEqual({ status: "unsupported-schema", identity: null });
    expect(resolveSceneVariantRoute({
      ...common,
      mode: "free",
      capability,
      schema: { kind: "unsupported", schemaVersion: 3 },
    })).toEqual({ status: "unsupported-schema", identity: null });
    expect(resolveSceneVariantRoute({
      ...common,
      mode: "free",
      capability,
      schema: { kind: "invalid", rawValues: ["1", "1"] },
    })).toEqual({ status: "invalid-schema", identity: null });
    expect(resolveSceneVariantRoute({
      ...common,
      mode: "free",
      capability,
      eligible: false,
    })).toEqual({ status: "disabled", identity: null });
    expect(createSeed).not.toHaveBeenCalled();
  });
});
