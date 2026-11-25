import { REVISION } from "three";

export type ObserverSceneRenderingRequirement =
  | "observer-scene-subject"
  | "presentation-lighting"
  | "shadow-maps"
  | "procedural-world-environment";

export type ObserverSceneBackendConstraint =
  | "procedural-world-environment-uses-webgl-pmrem";

export type ObserverWebGpuEvidence =
  | "pr-248-native-observer-e2e"
  | "pr-251-native-architecture-rise-e2e"
  | "r187-native-view-camera-anatomy-pilot-e2e"
  | "r187-native-architecture-rise-verification-e2e";

export type ObserverWebGpuQualification = Readonly<{
  /** Three.js revision that was installed during the native runtime evidence run. */
  rendererRevision: string;
  evidence: ObserverWebGpuEvidence;
  verifiedRequirements: readonly ObserverSceneRenderingRequirement[];
}>;

export type ObserverWebGpuCompatibility =
  | Readonly<{ status: "not-evaluated" }>
  | Readonly<{
      status: "verified";
      rendererRevision: string;
      evidence: ObserverWebGpuEvidence;
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
    webgpuQualifications: Object.freeze([
      Object.freeze({
        rendererRevision: "186",
        evidence: "pr-248-native-observer-e2e",
        verifiedRequirements: Object.freeze([
          "observer-scene-subject",
          "presentation-lighting",
          "shadow-maps",
        ] as const),
      }),
      Object.freeze({
        rendererRevision: "187",
        evidence: "r187-native-view-camera-anatomy-pilot-e2e",
        verifiedRequirements: Object.freeze([
          "observer-scene-subject",
          "presentation-lighting",
          "shadow-maps",
        ] as const),
      }),
    ]),
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
    webgpuQualifications: Object.freeze([
      Object.freeze({
        rendererRevision: "186",
        evidence: "pr-251-native-architecture-rise-e2e",
        verifiedRequirements: Object.freeze([
          "observer-scene-subject",
          "presentation-lighting",
          "shadow-maps",
          "procedural-world-environment",
        ] as const),
      }),
      Object.freeze({
        rendererRevision: "187",
        evidence: "r187-native-architecture-rise-verification-e2e",
        verifiedRequirements: Object.freeze([
          "observer-scene-subject",
          "presentation-lighting",
          "shadow-maps",
          "procedural-world-environment",
        ] as const),
      }),
    ]),
    knownBackendConstraints: Object.freeze([]),
    developmentWebGpuPilot: "eligible",
  }),
} satisfies Readonly<Record<string, Readonly<{
  requirements: readonly ObserverSceneRenderingRequirement[];
  webgpuQualifications: readonly ObserverWebGpuQualification[];
  knownBackendConstraints: readonly ObserverSceneBackendConstraint[];
  developmentWebGpuPilot: "eligible" | "not-eligible";
}>>>);

/** Missing scene or renderer qualifications are explicitly unevaluated and never pilot-eligible. */
export const resolveObserverSceneCompatibility = (
  sceneId: string,
  rendererRevision: string = REVISION,
): ObserverSceneCompatibility => {
  const declaration = observerSceneCompatibilityRegistry[
    sceneId as keyof typeof observerSceneCompatibilityRegistry
  ];
  if (!declaration) return UNREVIEWED_SCENE;

  const qualification = declaration.webgpuQualifications.find(
    (entry) => entry.rendererRevision === rendererRevision,
  );
  return {
    requirements: declaration.requirements,
    webgpu: qualification
      ? { status: "verified", ...qualification }
      : { status: "not-evaluated" },
    knownBackendConstraints: declaration.knownBackendConstraints,
    developmentWebGpuPilot: qualification ? declaration.developmentWebGpuPilot : "not-eligible",
  };
};
