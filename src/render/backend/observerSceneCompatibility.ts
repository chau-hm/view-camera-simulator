export type ObserverSceneRenderingRequirement =
  | "observer-scene-subject"
  | "presentation-lighting"
  | "shadow-maps"
  | "procedural-world-environment";

export type ObserverSceneBackendConstraint =
  | "procedural-world-environment-uses-webgl-pmrem";

export type ObserverWebGpuCompatibility =
  | Readonly<{ status: "not-evaluated" }>
  | Readonly<{
      status: "verified";
      evidence: "pr-248-native-observer-e2e";
      verifiedRequirements: readonly ObserverSceneRenderingRequirement[];
    }>;

export type ObserverSceneCompatibility = Readonly<{
  /** Null means the scene's Observer rendering requirements have not been audited. */
  requirements: readonly ObserverSceneRenderingRequirement[] | null;
  webgpu: ObserverWebGpuCompatibility;
  /** Known constraints are recorded separately from a complete compatibility result. */
  knownBackendConstraints: readonly ObserverSceneBackendConstraint[];
  /** Pilot approval is a rollout decision, separate from feature requirements and evidence. */
  developmentWebGpuPilot: "eligible" | "not-eligible";
}>;

const UNREVIEWED_SCENE: ObserverSceneCompatibility = Object.freeze({
  requirements: null,
  webgpu: Object.freeze({ status: "not-evaluated" }),
  knownBackendConstraints: Object.freeze([]),
  developmentWebGpuPilot: "not-eligible",
});

export const observerSceneCompatibilityRegistry = Object.freeze({
  "view-camera-anatomy": Object.freeze({
    requirements: Object.freeze([
      "observer-scene-subject",
      "presentation-lighting",
      "shadow-maps",
    ] as const),
    webgpu: Object.freeze({
      status: "verified",
      evidence: "pr-248-native-observer-e2e",
      verifiedRequirements: Object.freeze([
        "observer-scene-subject",
        "presentation-lighting",
        "shadow-maps",
      ] as const),
    }),
    knownBackendConstraints: Object.freeze([]),
    developmentWebGpuPilot: "eligible",
  }),
  "architecture-rise": Object.freeze({
    requirements: Object.freeze([
      "observer-scene-subject",
      "presentation-lighting",
      "shadow-maps",
      "procedural-world-environment",
    ] as const),
    webgpu: Object.freeze({ status: "not-evaluated" }),
    knownBackendConstraints: Object.freeze([
      "procedural-world-environment-uses-webgl-pmrem",
    ] as const),
    developmentWebGpuPilot: "not-eligible",
  }),
} satisfies Readonly<Record<string, ObserverSceneCompatibility>>);

/** Missing scene declarations are explicitly unevaluated and never pilot-eligible. */
export const resolveObserverSceneCompatibility = (
  sceneId: string,
): ObserverSceneCompatibility =>
  observerSceneCompatibilityRegistry[
    sceneId as keyof typeof observerSceneCompatibilityRegistry
  ] ?? UNREVIEWED_SCENE;
