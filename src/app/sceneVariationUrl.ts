import type { SceneDefinition } from "../types/scene";
import {
  isSupportedSceneVariationSchemaVersion,
  supportsSceneVariationSchemaVersion,
} from "../scenes/sceneVariation";
import { createSceneVariationSeed } from "../scenes/sceneVariationSeed";
import { normalizeSceneSeed } from "../scenes/sceneVariation";

export type ParsedSceneSeed =
  | Readonly<{ kind: "missing" }>
  | Readonly<{ kind: "valid"; seed: number }>
  | Readonly<{ kind: "invalid"; rawValues: readonly string[] }>;

export type ParsedSceneVariationSchema =
  | Readonly<{ kind: "missing" }>
  | Readonly<{ kind: "valid"; schemaVersion: number }>
  | Readonly<{ kind: "invalid"; rawValues: readonly string[] }>
  | Readonly<{ kind: "unsupported"; schemaVersion: number }>;

export type SceneVariationLocation = Readonly<{
  pathname: string;
  search: string;
  hash: string;
}>;

const readSearchParams = (search: string): URLSearchParams =>
  new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);

/** Accept exactly one canonical decimal unsigned 32-bit seed query value. */
export const parseSceneSeedFromSearch = (search: string): ParsedSceneSeed => {
  const values = readSearchParams(search).getAll("seed");
  if (values.length === 0) return { kind: "missing" };
  if (values.length !== 1 || !/^(0|[1-9][0-9]*)$/.test(values[0]!)) {
    return { kind: "invalid", rawValues: values };
  }

  const seed = Number(values[0]);
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffff_ffff) {
    return { kind: "invalid", rawValues: values };
  }
  return { kind: "valid", seed };
};

/** Parse one canonical positive decimal variation schema version. */
export const parseSceneVariationSchemaFromSearch = (
  search: string,
): ParsedSceneVariationSchema => {
  const values = readSearchParams(search).getAll("sv");
  if (values.length === 0) return { kind: "missing" };
  if (values.length !== 1 || !/^[1-9][0-9]*$/.test(values[0]!)) {
    return { kind: "invalid", rawValues: values };
  }

  const schemaVersion = Number(values[0]);
  if (!Number.isSafeInteger(schemaVersion) || schemaVersion > 0xffff_ffff) {
    return { kind: "invalid", rawValues: values };
  }
  return isSupportedSceneVariationSchemaVersion(schemaVersion)
    ? { kind: "valid", schemaVersion }
    : { kind: "unsupported", schemaVersion };
};

/** Set or remove only the scene seed, preserving other decoded query parameters. */
export const withSceneSeedInSearch = (
  search: string,
  seed: number | null,
): string => {
  const params = readSearchParams(search);
  if (seed === null) {
    params.delete("seed");
  } else {
    const normalizedSeed = String(normalizeSceneSeed(seed));
    if (params.getAll("seed").length === 1) {
      params.set("seed", normalizedSeed);
    } else {
      params.delete("seed");
      params.append("seed", normalizedSeed);
    }
  }
  const encoded = params.toString();
  return encoded.length > 0 ? `?${encoded}` : "";
};

/** Set or remove the complete variation identity while preserving other URL state. */
export const withSceneVariantInSearch = (
  search: string,
  identity: Readonly<{ seed: number; schemaVersion: number }> | null,
): string => {
  const params = readSearchParams(search);
  if (identity === null) {
    params.delete("seed");
    params.delete("sv");
  } else {
    const seed = String(normalizeSceneSeed(identity.seed));
    const schemaVersion = String(identity.schemaVersion);
    params.delete("seed");
    params.delete("sv");
    params.append("seed", seed);
    params.append("sv", schemaVersion);
  }
  const encoded = params.toString();
  return encoded.length > 0 ? `?${encoded}` : "";
};

/**
 * Build the URL used by a future Regenerate Scene action. Call navigate(path)
 * without `replace` so Back/Forward can replay the previous seed. Entry
 * canonicalization remains replace-style in SceneVariationRouteSync.
 */
export const createSceneVariantRegenerationLocation = (options: {
  mode: "free" | "guided";
  scene: Pick<SceneDefinition, "id" | "sceneVariation">;
  location: SceneVariationLocation;
  eligible?: boolean;
  /** Preserves an explicitly opened historical schema during regeneration. */
  activeSchemaVersion?: number;
  createSeed?: () => number;
}): SceneVariationLocation | null => {
  const { mode, scene, location, eligible = true } = options;
  const capability = scene.sceneVariation;
  const schemaVersion = options.activeSchemaVersion ?? capability?.schemaVersion;
  if (
    mode !== "free" ||
    !eligible ||
    !capability?.enabled ||
    schemaVersion === undefined ||
    !supportsSceneVariationSchemaVersion(capability, schemaVersion)
  ) {
    return null;
  }

  let seed = normalizeSceneSeed((options.createSeed ?? createSceneVariationSeed)());
  const previousSeed = parseSceneSeedFromSearch(location.search);
  if (previousSeed.kind === "valid" && previousSeed.seed === seed) {
    seed = (seed + 1) >>> 0;
  }
  return {
    ...location,
    search: withSceneVariantInSearch(location.search, {
      seed,
      schemaVersion,
    }),
  };
};
