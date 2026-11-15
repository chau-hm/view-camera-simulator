import { describe, expect, it, vi } from "vitest";
import {
  createSceneVariantRegenerationLocation,
  parseSceneSeedFromSearch,
  parseSceneVariationSchemaFromSearch,
  withSceneSeedInSearch,
  withSceneVariantInSearch,
} from "../../app/sceneVariationUrl";
import { UINT32_MAX } from "../../scenes/sceneVariation";
import type { SceneDefinition } from "../../types/scene";

const variationScene = {
  id: "interior-corner",
  sceneVariation: { enabled: true, schemaVersion: 1 },
} satisfies Pick<SceneDefinition, "id" | "sceneVariation">;

describe("scene variation URL contract", () => {
  it.each([
    ["?seed=0", { kind: "valid", seed: 0 }],
    [`?seed=${UINT32_MAX}`, { kind: "valid", seed: UINT32_MAX }],
  ])("parses canonical decimal seed %s", (search, expected) => {
    expect(parseSceneSeedFromSearch(search)).toEqual(expected);
  });

  it.each([
    "?seed=",
    "?seed=-1",
    "?seed=1.5",
    "?seed=NaN",
    "?seed=1e3",
    `?seed=${UINT32_MAX + 1}`,
    "?seed=12tail",
    "?seed=0012",
    "?seed=1&seed=2",
  ])("rejects malformed seed query %s", (search) => {
    expect(parseSceneSeedFromSearch(search).kind).toBe("invalid");
  });

  it("distinguishes a missing seed and normalizes idempotently", () => {
    expect(parseSceneSeedFromSearch("?keep=one")).toEqual({ kind: "missing" });
    const once = withSceneSeedInSearch("?keep=one&seed=bad&other=two", 284719);
    expect(once).toBe("?keep=one&seed=284719&other=two");
    expect(withSceneSeedInSearch(once, 284719)).toBe(once);
    expect(withSceneSeedInSearch(once, null)).toBe("?keep=one&other=two");
  });

  it.each([
    ["?sv=1", { kind: "valid", schemaVersion: 1 }],
    ["?sv=2", { kind: "unsupported", schemaVersion: 2 }],
  ])("parses explicit schema version %s", (search, expected) => {
    expect(parseSceneVariationSchemaFromSearch(search)).toEqual(expected);
  });

  it.each(["?sv=", "?sv=0", "?sv=-1", "?sv=1.5", "?sv=1e0", "?sv=4294967296", "?sv=1&sv=1"])(
    "rejects malformed schema version query %s",
    (search) => expect(parseSceneVariationSchemaFromSearch(search).kind).toBe("invalid"),
  );

  it("canonicalizes both parts of the identity idempotently and preserves the hash boundary", () => {
    const normalized = withSceneVariantInSearch("?keep=one&seed=bad&sv=2&keep=two", {
      seed: 284719,
      schemaVersion: 1,
    });
    expect(normalized).toBe("?keep=one&keep=two&seed=284719&sv=1");
    expect(withSceneVariantInSearch(normalized, { seed: 284719, schemaVersion: 1 })).toBe(normalized);
    expect(withSceneVariantInSearch(normalized, null)).toBe("?keep=one&keep=two");
  });

  it("preserves unrelated repeated query parameters and their values", () => {
    const normalized = withSceneSeedInSearch("?tag=a&tag=b&caption=wood+grain", 7);
    const params = new URLSearchParams(normalized);
    expect(params.getAll("tag")).toEqual(["a", "b"]);
    expect(params.get("caption")).toBe("wood grain");
    expect(params.get("seed")).toBe("7");
  });

  it("builds a future regeneration location only for supported Free Mode scenes", () => {
    const createSeed = vi.fn(() => 284719);
    const location = {
      pathname: "/simulator/free/interior-corner",
      search: "?keep=one&seed=3",
      hash: "#observer",
    };
    expect(createSceneVariantRegenerationLocation({
      mode: "free",
      scene: variationScene,
      location,
      createSeed,
    })).toEqual({
      ...location,
      search: "?keep=one&seed=284719&sv=1",
    });
    expect(createSeed).toHaveBeenCalledTimes(1);

    expect(createSceneVariantRegenerationLocation({
      mode: "guided",
      scene: variationScene,
      location,
      createSeed,
    })).toBeNull();
    expect(createSceneVariantRegenerationLocation({
      mode: "free",
      scene: { id: "canonical-only" },
      location,
      createSeed,
    })).toBeNull();
    expect(createSceneVariantRegenerationLocation({
      mode: "free",
      scene: { id: "future", sceneVariation: { enabled: true, schemaVersion: 2 } },
      location,
      createSeed,
    })).toBeNull();
    expect(createSeed).toHaveBeenCalledTimes(1);
  });

  it("avoids retaining the current identity if regeneration entropy collides", () => {
    const regenerated = createSceneVariantRegenerationLocation({
      mode: "free",
      scene: variationScene,
      location: {
        pathname: "/simulator/free/interior-corner",
        search: "?seed=5&keep=one",
        hash: "",
      },
      createSeed: () => 5,
    });
    expect(regenerated?.search).toBe("?keep=one&seed=6&sv=1");
  });
});
