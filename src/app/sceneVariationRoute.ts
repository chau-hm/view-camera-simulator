import type { SceneVariationCapability } from "../types/scene";
import type { SceneVariantIdentity } from "../types/sceneVariation";
import {
  createSceneVariantIdentity,
  LEGACY_SEED_ONLY_SCHEMA_VERSION,
  supportsSceneVariationSchemaVersion,
} from "../scenes/sceneVariation";
import type {
  ParsedSceneSeed,
  ParsedSceneVariationSchema,
} from "./sceneVariationUrl";

export type SceneVariantRouteResolution =
  | Readonly<{
      status: "resolved";
      identity: SceneVariantIdentity;
      seedSource: "explicit-url" | "generated-missing" | "generated-invalid" | "reused-location";
    }>
  | Readonly<{
      status: "disabled" | "unsupported-schema" | "invalid-schema";
      identity: null;
    }>;

/**
 * Resolve one router location without coupling it to camera initialization.
 * The injected seed source makes the lifecycle testable without browser globals.
 */
export const resolveSceneVariantRoute = (options: {
  mode: "free" | "guided";
  sceneId: string;
  capability?: SceneVariationCapability;
  routeKey: string;
  seed: ParsedSceneSeed;
  schema?: ParsedSceneVariationSchema;
  eligible?: boolean;
  previousIdentity: SceneVariantIdentity | null;
  previousRouteKey: string | null;
  createSeed: () => number;
}): SceneVariantRouteResolution => {
  const {
    mode,
    sceneId,
    capability,
    routeKey,
    seed,
    schema = { kind: "missing" },
    eligible = true,
    previousIdentity,
    previousRouteKey,
    createSeed,
  } = options;

  if (mode !== "free" || !eligible || !capability?.enabled) {
    return { status: "disabled", identity: null };
  }
  if (schema.kind === "invalid") {
    return { status: "invalid-schema", identity: null };
  }
  if (schema.kind === "unsupported" || !supportsSceneVariationSchemaVersion(capability, capability.schemaVersion)) {
    return { status: "unsupported-schema", identity: null };
  }
  if (schema.kind === "valid" && !supportsSceneVariationSchemaVersion(capability, schema.schemaVersion)) {
    return { status: "unsupported-schema", identity: null };
  }
  if (routeKey.length === 0) throw new TypeError("Scene variation route key cannot be empty");

  const schemaVersion = schema.kind === "valid"
    ? schema.schemaVersion
    : seed.kind === "valid"
      ? LEGACY_SEED_ONLY_SCHEMA_VERSION
      : capability.schemaVersion;
  if (!supportsSceneVariationSchemaVersion(capability, schemaVersion)) {
    return { status: "unsupported-schema", identity: null };
  }
  if (seed.kind === "valid") {
    return {
      status: "resolved",
      identity: createSceneVariantIdentity(sceneId, seed.seed, schemaVersion),
      seedSource: "explicit-url",
    };
  }

  if (
    previousRouteKey === routeKey &&
    previousIdentity?.sceneId === sceneId &&
    previousIdentity.schemaVersion === schemaVersion
  ) {
    return {
      status: "resolved",
      identity: previousIdentity,
      seedSource: "reused-location",
    };
  }

  return {
    status: "resolved",
    identity: createSceneVariantIdentity(sceneId, createSeed(), schemaVersion),
    seedSource: seed.kind === "missing" ? "generated-missing" : "generated-invalid",
  };
};
