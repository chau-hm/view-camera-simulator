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
  request.scene.id === architectureRiseScene.id &&
  sameBounds(request.scene.bounds, architectureRiseScene.bounds);

/** This Vite build flag is the only M6 activation input; production builds ignore it. */
export const isGroundGlassM6PresentationBuildEnabled = (): boolean =>
  import.meta.env.DEV && import.meta.env.VITE_GROUND_GLASS_WEBGPU_M6_PRESENTATION === "true";

export const isGroundGlassM6PresentationRequest = (
  request: GroundGlassFrameRequestInput,
): boolean => isGroundGlassM6PresentationRequestForBuild(
  request,
  isGroundGlassM6PresentationBuildEnabled(),
);

export const groundGlassM6PilotSessionId = (channelId: string): string =>
  `ground-glass-m6-presentation:${channelId}`;
