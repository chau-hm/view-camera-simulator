import type { GroundGlassSceneCompatibility, GroundGlassFeatureName } from "../backend/groundGlassSceneCompatibility";
import type { GroundGlassFrameRequestInput } from "../groundGlassFrameRequest";
import { architectureRiseScene } from "../../scenes/definitions/architecture-rise";
import { ARCHITECTURE_RISE_RAW_RTT_SOURCE_REVISION } from "./groundGlassRawWebGpuCompatibility";

/** A new attestation binds the unchanged scene source to the M6 display implementation. */
export const ARCHITECTURE_RISE_M6_PRESENTATION_SOURCE_REVISION =
  `${ARCHITECTURE_RISE_RAW_RTT_SOURCE_REVISION}+m6-presentation-v1`;
export const ARCHITECTURE_RISE_M6_PRESENTATION_EVIDENCE_REVISION =
  "m6-architecture-rise-native-presentation-v1";

export const GROUND_GLASS_M6_PRESENTATION_FEATURES = Object.freeze([
  "raw-rtt",
  "physical-coc",
  "aperture-gather",
  "far-reconstruction-b1",
  "composite",
  "full-presentation",
] as const satisfies readonly GroundGlassFeatureName[]);

export const GROUND_GLASS_M6_PRESENTATION_COMPATIBILITY: GroundGlassSceneCompatibility = {
  sceneId: architectureRiseScene.id,
  sourceRevision: ARCHITECTURE_RISE_M6_PRESENTATION_SOURCE_REVISION,
  features: GROUND_GLASS_M6_PRESENTATION_FEATURES.map((feature) => ({
    feature,
    status: "implementation-verified",
    qualityQualification: "unqualified",
    sourceRevision: ARCHITECTURE_RISE_M6_PRESENTATION_SOURCE_REVISION,
    evidenceRevision: `${ARCHITECTURE_RISE_M6_PRESENTATION_EVIDENCE_REVISION}:${feature}`,
    testedContext: {
      rendererFamily: "webgpu-renderer",
      executionApi: "webgpu",
      rendererRevision: "r186",
      runtimeDescription: "Three.js r186 WebGPURenderer native WebGPU M6 development presentation",
    },
    verificationEvidence: [
      `native Architecture Rise M6 implementation evidence for ${feature}`,
      "optical-quality qualification remains explicitly unqualified",
    ],
    // Required render formats are verified against mounted target descriptors after allocation.
    requiredCapabilities: { adapterFeatures: [], textureStorageFormats: [] },
    knownIncompatibilities: [],
  })),
};

export type GroundGlassM6BuildFlags = Readonly<{
  developmentBuild: boolean;
  rawPilotFlag: string | undefined;
  m6PresentationFlag: string | undefined;
}>;

export type GroundGlassM6bTestBuildFlags = GroundGlassM6BuildFlags & Readonly<{
  testSeamFlag: string | undefined;
}>;

/** Shared trusted Raw pilot gate; M6 adds its own feature flag on top of this gate. */
export const isGroundGlassRawPilotBuildAuthorizedForFlags = (
  flags: Pick<GroundGlassM6BuildFlags, "developmentBuild" | "rawPilotFlag">,
): boolean => flags.developmentBuild && flags.rawPilotFlag === "true";

/** M6 is authorized only by the complete trusted development build configuration. */
export const isGroundGlassM6BuildAuthorizedForFlags = (
  flags: GroundGlassM6BuildFlags,
): boolean => isGroundGlassRawPilotBuildAuthorizedForFlags(flags) &&
  flags.m6PresentationFlag === "true";

/** The calibration seam additionally requires the explicit development-test build gate. */
export const isGroundGlassM6bFixtureBuildAuthorizedForFlags = (
  flags: GroundGlassM6bTestBuildFlags,
  explicitTestControl: boolean,
  scene: Pick<GroundGlassFrameRequestInput["scene"], "id" | "bounds">,
): boolean => explicitTestControl &&
  flags.testSeamFlag === "true" &&
  isGroundGlassM6BuildAuthorizedForFlags(flags) &&
  scene.id === architectureRiseScene.id &&
  sameBounds(scene.bounds, architectureRiseScene.bounds);

const isArchitectureRiseRequest = (request: GroundGlassFrameRequestInput): boolean =>
  request.scene.id === architectureRiseScene.id &&
  sameBounds(request.scene.bounds, architectureRiseScene.bounds);

const sameBounds = (
  left: GroundGlassFrameRequestInput["scene"]["bounds"],
  right: typeof architectureRiseScene.bounds,
): boolean =>
  left.min.x === right.min.x &&
  left.min.y === right.min.y &&
  left.min.z === right.min.z &&
  left.max.x === right.max.x &&
  left.max.y === right.max.y &&
  left.max.z === right.max.z;

/** Pure scene/request check; the caller supplies the trusted build authorization explicitly. */
export const isGroundGlassM6PresentationRequestForBuild = (
  request: GroundGlassFrameRequestInput,
  buildAuthorized: boolean,
): boolean =>
  buildAuthorized &&
  !request.rawDebug &&
  isArchitectureRiseRequest(request);

/** Session provisioning is independent of the initial Raw/M6 request mode. */
export const isGroundGlassM6CapablePilotSessionForBuild = (
  request: GroundGlassFrameRequestInput,
  buildAuthorized: boolean,
  selectedBackend: "webgpu" | "webgl" | "unavailable",
  actualExecutionApi: "webgpu" | "webgl2" | "unknown",
): boolean =>
  buildAuthorized &&
  selectedBackend === "webgpu" &&
  actualExecutionApi === "webgpu" &&
  isArchitectureRiseRequest(request);

/** Both documented Vite flags are required; production builds ignore them. */
export const isGroundGlassM6PresentationBuildEnabled = (): boolean =>
  isGroundGlassM6BuildAuthorizedForFlags({
    developmentBuild: import.meta.env.DEV,
    rawPilotFlag: import.meta.env.VITE_GROUND_GLASS_WEBGPU_RAW_PILOT,
    m6PresentationFlag: import.meta.env.VITE_GROUND_GLASS_WEBGPU_M6_PRESENTATION,
  });

/** Runtime guard for the shared Stage fixture; it does not enable or select a renderer. */
export const isGroundGlassM6bFixtureSceneEnabled = (
  scene: Pick<GroundGlassFrameRequestInput["scene"], "id" | "bounds">,
  explicitTestControl: boolean,
): boolean => isGroundGlassM6bFixtureBuildAuthorizedForFlags({
  developmentBuild: import.meta.env.DEV,
  rawPilotFlag: import.meta.env.VITE_GROUND_GLASS_WEBGPU_RAW_PILOT,
  m6PresentationFlag: import.meta.env.VITE_GROUND_GLASS_WEBGPU_M6_PRESENTATION,
  testSeamFlag: import.meta.env.VITE_GROUND_GLASS_WEBGPU_TEST_SEAM,
}, explicitTestControl, scene);

/** Narrow startup evidence for the M6 native test; does not expose other build environment. */
export const getGroundGlassM6BuildConfigurationEvidence = () => Object.freeze({
  rawPilotEnabled: import.meta.env.DEV && import.meta.env.VITE_GROUND_GLASS_WEBGPU_RAW_PILOT === "true",
  m6PresentationEnabled: import.meta.env.DEV && import.meta.env.VITE_GROUND_GLASS_WEBGPU_M6_PRESENTATION === "true",
  physicalCocResearchEnabled: import.meta.env.DEV && import.meta.env.VITE_GROUND_GLASS_WEBGPU_PHYSICAL_COC_RESEARCH === "true",
  apertureGatherResearchEnabled: import.meta.env.DEV && import.meta.env.VITE_GROUND_GLASS_WEBGPU_GATHER_RESEARCH === "true",
});

export const isGroundGlassM6PresentationRequest = (
  request: GroundGlassFrameRequestInput,
): boolean => isGroundGlassM6PresentationRequestForBuild(
  request,
  isGroundGlassM6PresentationBuildEnabled(),
);

export const groundGlassM6PilotSessionId = (channelId: string): string =>
  `ground-glass-m6-presentation:${channelId}`;
