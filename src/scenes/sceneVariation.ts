import type { SceneDefinition, SceneVariationCapability } from "../types/scene";
import type {
  SceneRandomStream,
  SceneVariationDescriptor,
  SceneVariationDomain,
  SceneVariantIdentity,
} from "../types/sceneVariation";

export const CURRENT_SCENE_VARIATION_SCHEMA_VERSION = 1;
export const UINT32_MAX = 0xffff_ffff;
const UINT32_RANGE = 0x1_0000_0000;
const SUPPORTED_SCHEMA_VERSIONS = new Set([CURRENT_SCENE_VARIATION_SCHEMA_VERSION]);

const variationDomains = new Set<SceneVariationDomain>([
  "materials",
  "props",
  "layout",
  "lighting",
]);

export class UnsupportedSceneVariationSchemaError extends Error {
  readonly schemaVersion: number;

  constructor(schemaVersion: number) {
    super(`Unsupported scene variation schema version: ${schemaVersion}`);
    this.name = "UnsupportedSceneVariationSchemaError";
    this.schemaVersion = schemaVersion;
  }
}

export const normalizeSceneSeed = (seed: number): number => {
  if (!Number.isInteger(seed) || seed < 0 || seed > UINT32_MAX) {
    throw new RangeError("Scene seed must be an unsigned 32-bit integer");
  }
  return seed;
};

const normalizeSceneId = (sceneId: string): string => {
  if (typeof sceneId !== "string" || sceneId.trim().length === 0) {
    throw new TypeError("Scene variation identity requires a non-empty scene ID");
  }
  return sceneId;
};

const normalizeSchemaVersion = (schemaVersion: number): number => {
  if (!Number.isInteger(schemaVersion) || schemaVersion < 1 || schemaVersion > UINT32_MAX) {
    throw new RangeError("Scene variation schema version must be a positive 32-bit integer");
  }
  return schemaVersion;
};

export const createSceneVariantIdentity = (
  sceneId: string,
  seed: number,
  schemaVersion = CURRENT_SCENE_VARIATION_SCHEMA_VERSION,
): SceneVariantIdentity => Object.freeze({
  sceneId: normalizeSceneId(sceneId),
  seed: normalizeSceneSeed(seed),
  schemaVersion: normalizeSchemaVersion(schemaVersion),
});

const assertSupportedSchemaVersion = (schemaVersion: number): void => {
  if (!SUPPORTED_SCHEMA_VERSIONS.has(schemaVersion)) {
    throw new UnsupportedSceneVariationSchemaError(schemaVersion);
  }
};

export const isSupportedSceneVariationSchemaVersion = (
  schemaVersion: number,
): boolean => SUPPORTED_SCHEMA_VERSIONS.has(schemaVersion);

const assertIdentityShape = (identity: SceneVariantIdentity): SceneVariantIdentity =>
  createSceneVariantIdentity(
    identity.sceneId,
    identity.seed,
    identity.schemaVersion,
  );

export const createSeededRandomStream = (seed: number): SceneRandomStream => {
  let state = normalizeSceneSeed(seed);

  const nextUint32 = (): number => {
    // Mulberry32 v1: all state arithmetic is explicitly unsigned 32-bit math.
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return (value ^ (value >>> 14)) >>> 0;
  };

  const nextFloat = (): number => nextUint32() / UINT32_RANGE;

  const nextInt = (min: number, max: number): number => {
    if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max) || min > max) {
      throw new RangeError("nextInt bounds must be ordered safe integers");
    }

    const span = max - min + 1;
    if (span > UINT32_RANGE) {
      throw new RangeError("nextInt interval must contain no more than 2^32 integers");
    }

    // Rejection sampling avoids modulo bias for bounded integer draws.
    const acceptedLimit = Math.floor(UINT32_RANGE / span) * span;
    let sample = nextUint32();
    while (sample >= acceptedLimit) sample = nextUint32();
    return min + (sample % span);
  };

  const nextRange = (min: number, max: number): number => {
    if (
      !Number.isFinite(min) ||
      !Number.isFinite(max) ||
      min >= max ||
      !Number.isFinite(max - min)
    ) {
      throw new RangeError("nextRange requires finite bounds with min less than max");
    }
    return min + (max - min) * nextFloat();
  };

  const pick = <T,>(items: readonly T[]): T => {
    if (items.length === 0) throw new RangeError("pick requires a non-empty list");
    return items[nextInt(0, items.length - 1)]!;
  };

  return Object.freeze({ nextUint32, nextFloat, nextInt, nextRange, pick });
};

const hashUtf16 = (value: string): number => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(hash ^ value.charCodeAt(index), 0x01000193);
  }
  return hash >>> 0;
};

/**
 * Derive a stable unsigned seed for one semantic object/domain pair. The schema
 * version participates in the key so changing the contract changes substreams.
 */
export const deriveSceneSubstreamSeed = (
  sceneSeed: number,
  sceneId: string,
  domain: SceneVariationDomain,
  objectId: string,
  schemaVersion = CURRENT_SCENE_VARIATION_SCHEMA_VERSION,
): number => {
  const seed = normalizeSceneSeed(sceneSeed);
  const normalizedSceneId = normalizeSceneId(sceneId);
  const version = normalizeSchemaVersion(schemaVersion);
  assertSupportedSchemaVersion(version);
  if (!variationDomains.has(domain)) {
    throw new TypeError(`Unknown scene variation domain: ${String(domain)}`);
  }
  if (typeof objectId !== "string" || objectId.trim().length === 0) {
    throw new TypeError("Scene variation substreams require a stable non-empty object ID");
  }
  const key = JSON.stringify([
    "scene-variation-substream",
    version,
    normalizedSceneId,
    seed,
    domain,
    objectId,
  ]);
  return hashUtf16(key);
};

export const resolveSceneVariationDescriptor = (
  scene: Pick<SceneDefinition, "id" | "sceneVariation">,
  identity: SceneVariantIdentity | null,
): SceneVariationDescriptor | null => {
  const capability: SceneVariationCapability | undefined = scene.sceneVariation;
  if (!capability?.enabled || identity === null) return null;

  const normalizedIdentity = assertIdentityShape(identity);
  const schemaVersion = normalizeSchemaVersion(capability.schemaVersion);
  assertSupportedSchemaVersion(schemaVersion);
  if (normalizedIdentity.sceneId !== scene.id) {
    throw new RangeError("Scene variation identity does not match the canonical scene ID");
  }
  if (normalizedIdentity.schemaVersion !== schemaVersion) {
    throw new RangeError("Scene variation identity schema version does not match scene capability");
  }
  assertSupportedSchemaVersion(normalizedIdentity.schemaVersion);

  return Object.freeze({
    identity: normalizedIdentity,
    createRandomStream: (domain, objectId) => createSeededRandomStream(
      deriveSceneSubstreamSeed(
        normalizedIdentity.seed,
        normalizedIdentity.sceneId,
        domain,
        objectId,
        normalizedIdentity.schemaVersion,
      ),
    ),
  });
};
