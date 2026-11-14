import type { SceneDefinition } from "../types/scene";
import { isSupportedSceneVariationSchemaVersion } from "../scenes/sceneVariation";
import { createSceneVariationSeed } from "../scenes/sceneVariationSeed";
import { normalizeSceneSeed } from "../scenes/sceneVariation";

export type ParsedSceneSeed =
  | Readonly<{ kind: "missing" }>
  | Readonly<{ kind: "valid"; seed: number }>
  | Readonly<{ kind: "invalid"; rawValues: readonly string[] }>;

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

/**
 * Build the URL used by a future Regenerate Scene action. Call navigate(path)
 * without `replace` so Back/Forward can replay the previous seed. Entry
 * canonicalization remains replace-style in SceneVariationRouteSync.
 */
export const createSceneVariantRegenerationLocation = (options: {
  mode: "free" | "guided";
  scene: Pick<SceneDefinition, "id" | "sceneVariation">;
  location: SceneVariationLocation;
  createSeed?: () => number;
}): SceneVariationLocation | null => {
  const { mode, scene, location } = options;
  const capability = scene.sceneVariation;
  if (
    mode !== "free" ||
    !capability?.enabled ||
    !isSupportedSceneVariationSchemaVersion(capability.schemaVersion)
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
    search: withSceneSeedInSearch(location.search, seed),
  };
};
