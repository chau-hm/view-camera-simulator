import { REVISION } from "three";
import type { GroundGlassBackendPolicyInput } from "../backend/groundGlassBackendPolicy";
import type { GroundGlassPilotRetryState } from "../backend/groundGlassBackendContracts";
import type { GroundGlassFrameRequestInput } from "../groundGlassFrameRequest";
import { architectureRiseScene } from "../../scenes/definitions/architecture-rise";
import { GROUND_GLASS_RAW_WEBGPU_COMPATIBILITY } from "./groundGlassRawWebGpuCompatibility";
import {
  GROUND_GLASS_M6_PRESENTATION_COMPATIBILITY,
  GROUND_GLASS_M6_PRESENTATION_FEATURES,
  groundGlassM6PilotSessionId,
  isGroundGlassM6PresentationBuildEnabled,
} from "./groundGlassM6PresentationPolicy";

/** This Vite flag is trusted build configuration; it is ignored in production builds. */
export const isGroundGlassRawWebGpuPilotBuildEnabled = (): boolean =>
  import.meta.env.DEV && import.meta.env.VITE_GROUND_GLASS_WEBGPU_RAW_PILOT === "true";

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

/** A caller cannot turn an arbitrary scene sharing an ID into the trusted pilot scene. */
export const isGroundGlassRawWebGpuPilotRequest = (
  request: GroundGlassFrameRequestInput,
): boolean =>
  request.scene.id === architectureRiseScene.id &&
  sameBounds(request.scene.bounds, architectureRiseScene.bounds) &&
  request.rawDebug;

const resolveEnvironment = (): GroundGlassBackendPolicyInput["environment"] =>
  import.meta.env.MODE === "test"
    ? "test"
    : import.meta.env.DEV ? "development" : "production";

const reportedWebGpuAvailability = (): GroundGlassBackendPolicyInput["capabilityPreflight"] => {
  if (typeof navigator === "undefined") {
    return {
      webgpuAvailability: "reported-unavailable",
      adapterFeatures: [],
      textureStorageFormats: [],
    };
  }
  const gpu = (navigator as Navigator & { gpu?: unknown }).gpu;
  return {
    webgpuAvailability: gpu ? "reported-available" : "reported-unavailable",
    // Raw RTT requests no optional adapter features or storage formats.
    adapterFeatures: [],
    textureStorageFormats: [],
  };
};

/**
 * Creates explicit policy inputs from trusted build configuration and an accepted request.
 * The expected renderer revision comes from the installed Three.js package, never from evidence.
 */
export const createGroundGlassRawWebGpuPolicyInput = (
  request: GroundGlassFrameRequestInput,
  retryState: GroundGlassPilotRetryState | null,
): GroundGlassBackendPolicyInput => {
  const m6BuildEnabled = isGroundGlassM6PresentationBuildEnabled();
  const m6Requested = m6BuildEnabled && !request.rawDebug;
  const m3PilotEnabled = isGroundGlassRawWebGpuPilotBuildEnabled();
  const m3RawRequested = m3PilotEnabled && isGroundGlassRawWebGpuPilotRequest(request);
  const requestedM6 = m6Requested;
  const requestedWebGpuMode = requestedM6 || m3RawRequested;
  // Raw Debug remains a distinct output mode, but when M6 is build-authorized it shares that
  // channel's pilot-session retry latch. Switching presentation modes must not look like a new
  // session or bypass an already-consumed WebGPU attempt.
  const pilotSessionId = resolveGroundGlassRawWebGpuPilotSessionId(request.channel, m6BuildEnabled);
  const compatibility = requestedM6
    ? GROUND_GLASS_M6_PRESENTATION_COMPATIBILITY
    : GROUND_GLASS_RAW_WEBGPU_COMPATIBILITY;

  return {
    requestedBackend: requestedWebGpuMode ? "webgpu" : null,
    environment: resolveEnvironment(),
    authorization: requestedWebGpuMode
      ? {
          status: "authorized",
          source: "application-configuration",
          pilotSessionId,
        }
      : {
          status: "unauthorized",
          reason: m6BuildEnabled || m3PilotEnabled ? "disabled" : "not-configured",
        },
    channelId: request.channel,
    sceneId: request.scene.id,
    requestedFeatures: requestedM6
      ? GROUND_GLASS_M6_PRESENTATION_FEATURES
      : m3RawRequested ? ["raw-rtt"] : [],
    // An explicit M6 build request still reaches policy for unsupported scenes; exact scene
    // compatibility then denies it and preserves the established WebGL selection.
    sceneCompatibility: requestedWebGpuMode ? compatibility : null,
    expectedCandidateRendererRevision: requestedWebGpuMode ? `r${REVISION}` : null,
    capabilityPreflight: requestedWebGpuMode
      ? reportedWebGpuAvailability()
      : {
          webgpuAvailability: "unresolved",
          adapterFeatures: null,
          textureStorageFormats: null,
        },
    retryState,
    // WebGL remains the established host adapter and is the application fallback attempt.
    // Successful mounted identity is reported separately after renderer initialization.
    webglAvailable: true,
  };
};

export const groundGlassPilotSessionId = (channelId: string): string =>
  `ground-glass-raw-m3:${channelId}`;

export const resolveGroundGlassRawWebGpuPilotSessionId = (
  channelId: string,
  m6PresentationBuildEnabled: boolean,
): string => m6PresentationBuildEnabled
  ? groundGlassM6PilotSessionId(channelId)
  : groundGlassPilotSessionId(channelId);
