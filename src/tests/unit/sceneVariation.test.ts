import { describe, expect, it } from "vitest";
import {
  CURRENT_SCENE_VARIATION_SCHEMA_VERSION,
  UINT32_MAX,
  createSceneVariantIdentity,
  createSeededRandomStream,
  deriveSceneSubstreamSeed,
  normalizeSceneSeed,
  resolveSceneVariationDescriptor,
  UnsupportedSceneVariationSchemaError,
} from "../../scenes/sceneVariation";
import { createSceneVariationSeed } from "../../scenes/sceneVariationSeed";
import type { SceneDefinition } from "../../types/scene";

const variationScene = {
  id: "test-interior",
  sceneVariation: { enabled: true, schemaVersion: CURRENT_SCENE_VARIATION_SCHEMA_VERSION },
} satisfies Pick<SceneDefinition, "id" | "sceneVariation">;

describe("scene variation deterministic core", () => {
  it("normalizes only unsigned 32-bit integer seeds", () => {
    expect(normalizeSceneSeed(0)).toBe(0);
    expect(normalizeSceneSeed(UINT32_MAX)).toBe(UINT32_MAX);
    for (const seed of [-1, 1.25, Number.NaN, Number.POSITIVE_INFINITY, UINT32_MAX + 1]) {
      expect(() => normalizeSceneSeed(seed)).toThrow(RangeError);
    }
  });

  it("produces the same sequence for repeated and independent instances", () => {
    const first = createSeededRandomStream(284719);
    const second = createSeededRandomStream(284719);
    expect(Array.from({ length: 12 }, () => first.nextUint32())).toEqual(
      Array.from({ length: 12 }, () => second.nextUint32()),
    );
    expect(createSeededRandomStream(0).nextUint32()).toBe(
      createSeededRandomStream(0).nextUint32(),
    );
  });

  it("distinguishes representative seeds and retains unsigned output", () => {
    const sequence = (seed: number) => {
      const stream = createSeededRandomStream(seed);
      return Array.from({ length: 8 }, () => stream.nextUint32());
    };
    const first = createSeededRandomStream(1);
    const second = createSeededRandomStream(2);
    expect(Array.from({ length: 8 }, () => first.nextUint32())).not.toEqual(
      Array.from({ length: 8 }, () => second.nextUint32()),
    );
    expect(sequence(UINT32_MAX)).toHaveLength(8);
    for (const value of sequence(123)) {
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(UINT32_MAX);
    }
  });

  it("uses explicit float, integer, range, and pick bounds", () => {
    const stream = createSeededRandomStream(71);
    for (let index = 0; index < 100; index += 1) {
      const float = stream.nextFloat();
      const integer = stream.nextInt(-3, 4);
      const range = stream.nextRange(2.5, 9.25);
      expect(float).toBeGreaterThanOrEqual(0);
      expect(float).toBeLessThan(1);
      expect(Number.isInteger(integer)).toBe(true);
      expect(integer).toBeGreaterThanOrEqual(-3);
      expect(integer).toBeLessThanOrEqual(4);
      expect(range).toBeGreaterThanOrEqual(2.5);
      expect(range).toBeLessThan(9.25);
    }
    expect(["a", "b", "c"]).toContain(stream.pick(["a", "b", "c"]));
    expect(stream.nextInt(7, 7)).toBe(7);
    expect(() => stream.nextInt(2, 1)).toThrow(RangeError);
    expect(() => stream.nextRange(2, 2)).toThrow(RangeError);
    expect(() => stream.pick([])).toThrow(RangeError);
  });

  it("derives independent stable semantic substreams", () => {
    const materialsSeed = deriveSceneSubstreamSeed(19, "test-interior", "materials", "bench-seat");
    expect(materialsSeed).toBe(
      deriveSceneSubstreamSeed(19, "test-interior", "materials", "bench-seat"),
    );
    expect(materialsSeed).not.toBe(
      deriveSceneSubstreamSeed(19, "test-interior", "props", "bench-seat"),
    );
    expect(materialsSeed).not.toBe(
      deriveSceneSubstreamSeed(19, "test-interior", "materials", "wall-plaster"),
    );
    expect(() => deriveSceneSubstreamSeed(
      19,
      "test-interior",
      "materials",
      "bench-seat",
      2,
    )).toThrow(UnsupportedSceneVariationSchemaError);
    expect(createSceneVariantIdentity("test-interior", 19, 2).schemaVersion).not.toBe(
      createSceneVariantIdentity("test-interior", 19, 1).schemaVersion,
    );

    const beforeExtraDraw = createSeededRandomStream(materialsSeed);
    const expected = beforeExtraDraw.nextUint32();
    const withAnUnrelatedDraw = createSeededRandomStream(
      deriveSceneSubstreamSeed(19, "test-interior", "props", "lamp"),
    );
    withAnUnrelatedDraw.nextUint32();
    const unchangedMaterials = createSeededRandomStream(
      deriveSceneSubstreamSeed(19, "test-interior", "materials", "bench-seat"),
    );
    expect(unchangedMaterials.nextUint32()).toBe(expected);

    const expectedPropDraw = createSeededRandomStream(
      deriveSceneSubstreamSeed(19, "test-interior", "props", "bench-leg-front-left"),
    ).nextUint32();
    createSeededRandomStream(
      deriveSceneSubstreamSeed(19, "test-interior", "materials", "new-paper-object"),
    ).nextUint32();
    expect(createSeededRandomStream(
      deriveSceneSubstreamSeed(19, "test-interior", "props", "bench-leg-front-left"),
    ).nextUint32()).toBe(expectedPropDraw);
  });

  it("resolves equivalent descriptors for independent subject consumers", () => {
    const identity = createSceneVariantIdentity("test-interior", 284719);
    const observer = resolveSceneVariationDescriptor(variationScene, identity);
    const groundGlass = resolveSceneVariationDescriptor(variationScene, identity);
    expect(observer).not.toBeNull();
    expect(groundGlass).not.toBeNull();
    expect(observer!.identity).toEqual(groundGlass!.identity);
    const observerStream = observer!.createRandomStream("materials", "oak-console");
    const groundGlassStream = groundGlass!.createRandomStream("materials", "oak-console");
    expect(
      Array.from({ length: 6 }, () => observerStream.nextUint32()),
    ).toEqual(
      Array.from({ length: 6 }, () => groundGlassStream.nextUint32()),
    );
  });

  it("keeps identities serializable and rejects unsupported descriptor versions", () => {
    const identity = createSceneVariantIdentity("test-interior", 0);
    expect(JSON.parse(JSON.stringify(identity))).toEqual(identity);
    expect(identity.schemaVersion).toBe(CURRENT_SCENE_VARIATION_SCHEMA_VERSION);
    expect(resolveSceneVariationDescriptor({ id: "test-interior" }, identity)).toBeNull();
    expect(() => resolveSceneVariationDescriptor(
      { ...variationScene, sceneVariation: { enabled: true, schemaVersion: 2 } },
      createSceneVariantIdentity("test-interior", 5, 2),
    )).toThrow(UnsupportedSceneVariationSchemaError);
    expect(() => resolveSceneVariationDescriptor(
      variationScene,
      createSceneVariantIdentity("another-scene", 5),
    )).toThrow(/canonical scene ID/);
  });

  it("takes new seeds from injected entropy without coupling that source to generation", () => {
    let requestedLength = 0;
    const seed = createSceneVariationSeed({
      getRandomValues: <T extends ArrayBufferView>(array: T): T => {
        requestedLength = array.byteLength;
        new Uint32Array(array.buffer, array.byteOffset, array.byteLength / 4)[0] = UINT32_MAX;
        return array;
      },
    });
    expect(seed).toBe(UINT32_MAX);
    expect(requestedLength).toBe(4);
  });
});
