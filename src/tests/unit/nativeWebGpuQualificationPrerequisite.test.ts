import { afterEach, describe, expect, it, vi } from "vitest";
import { createGroundGlassPilotRetryState } from "../../render/backend/groundGlassBackendContracts";
import { selectGroundGlassBackend } from "../../render/backend/groundGlassBackendPolicy";
import {
  ARCHITECTURE_RISE_M6_PRESENTATION_SOURCE_REVISION,
  GROUND_GLASS_M6_R187_PRESENTATION_COMPATIBILITY,
  isGroundGlassM6PresentationBuildEnabled,
  isGroundGlassM6PresentationBuildEnabledForRevision,
  isGroundGlassM6R187PresentationEvidenceMatched,
  isGroundGlassM6R187QualificationBuildAuthorizedForFlags,
} from "../../render/webgpu/groundGlassM6PresentationPolicy";
import { createGroundGlassRawWebGpuPolicyInput, groundGlassPilotSessionId, isGroundGlassRawWebGpuPilotRequest } from "../../render/webgpu/groundGlassRawWebGpuPolicyInput";
import { ARCHITECTURE_RISE_RAW_RTT_SOURCE_REVISION, resolveGroundGlassRawWebGpuCompatibility } from "../../render/webgpu/groundGlassRawWebGpuCompatibility";
import { createGroundGlassRequestInput } from "./groundGlassFrameRequestFixtures";

const enabled = { developmentBuild: true, rawPilotFlag: "true", m6PresentationFlag: "true", testSeamFlag: "true", qualificationFlag: "true" } as const;
const configureBuild = () => {
  vi.stubEnv("VITE_GROUND_GLASS_WEBGPU_RAW_PILOT", "true");
  vi.stubEnv("VITE_GROUND_GLASS_WEBGPU_M6_PRESENTATION", "true");
  vi.stubEnv("VITE_GROUND_GLASS_WEBGPU_TEST_SEAM", "true");
  vi.stubEnv("VITE_GROUND_GLASS_WEBGPU_M6_R187_QUALIFICATION", "true");
};

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("current-source native qualification prerequisite", () => {
  it("defaults the non-Raw request to WebGL despite complete M6 qualification flags", () => {
    configureBuild();
    vi.stubGlobal("navigator", { gpu: {} });
    expect(ARCHITECTURE_RISE_RAW_RTT_SOURCE_REVISION).toBe("architecture-rise-raw-rtt-v2");
    expect(ARCHITECTURE_RISE_M6_PRESENTATION_SOURCE_REVISION).toBe("architecture-rise-raw-rtt-v1+m6-presentation-v1");
    expect(isGroundGlassM6R187QualificationBuildAuthorizedForFlags(enabled, "187")).toBe(true);
    expect(isGroundGlassM6R187PresentationEvidenceMatched(GROUND_GLASS_M6_R187_PRESENTATION_COMPATIBILITY, "r187")).toBe(false);
    expect(isGroundGlassM6PresentationBuildEnabledForRevision(enabled, GROUND_GLASS_M6_R187_PRESENTATION_COMPATIBILITY, "187")).toBe(false);
    expect(isGroundGlassM6PresentationBuildEnabled()).toBe(false);
    const input = createGroundGlassRawWebGpuPolicyInput(createGroundGlassRequestInput({ rawDebug: false }), null);
    expect(input).toMatchObject({ requestedBackend: null, authorization: { status: "unauthorized", reason: "disabled" }, requestedFeatures: [], capabilityPreflight: { webgpuAvailability: "unresolved" } });
    expect(selectGroundGlassBackend(input)).toMatchObject({ status: "selected", requestedBackend: null, selectedBackend: "webgl", selectionReason: "webgl-default", policyDecision: { status: "defaulted", reason: "webgl-default" } });
  });

  it.each(["rawPilotFlag", "m6PresentationFlag", "testSeamFlag", "qualificationFlag"] as const)(
    "independently denies the r187 qualification harness when %s is disabled",
    (key) => {
      expect(isGroundGlassM6R187QualificationBuildAuthorizedForFlags(enabled, "187")).toBe(true);
      expect(isGroundGlassM6R187QualificationBuildAuthorizedForFlags({ ...enabled, [key]: "false" }, "187")).toBe(false);
    },
  );

  it("allows v2 Raw RTT as a distinct authorized request without enabling M6", () => {
    configureBuild();
    vi.stubGlobal("navigator", { gpu: {} });
    const compatibility = resolveGroundGlassRawWebGpuCompatibility("r187");
    expect(compatibility).toMatchObject({ sourceRevision: "architecture-rise-raw-rtt-v2", features: expect.arrayContaining([expect.objectContaining({ feature: "raw-rtt", evidenceRevision: "m3-architecture-rise-raw-rtt-native-r187-v2" })]) });
    expect(isGroundGlassM6PresentationBuildEnabled()).toBe(false);
    const retry = createGroundGlassPilotRetryState("default", groundGlassPilotSessionId("default"));
    const input = createGroundGlassRawWebGpuPolicyInput(createGroundGlassRequestInput({ rawDebug: true }), retry);
    expect(input).toMatchObject({ requestedBackend: "webgpu", requestedFeatures: ["raw-rtt"] });
    expect(selectGroundGlassBackend(input)).toMatchObject({ selectedBackend: "webgpu", policyDecision: { status: "authorized", sceneEligibility: { status: "eligible" } } });
  });
  it("does not accept an unsupported scene or altered bounds as the Raw pilot", () => {
    const request = createGroundGlassRequestInput({ rawDebug: true });
    expect(isGroundGlassRawWebGpuPilotRequest(request)).toBe(true);
    expect(isGroundGlassRawWebGpuPilotRequest({ ...request, scene: { ...request.scene, id: "other-scene" } })).toBe(false);
    expect(isGroundGlassRawWebGpuPilotRequest({ ...request, scene: { ...request.scene, bounds: { ...request.scene.bounds, max: { ...request.scene.bounds.max, x: request.scene.bounds.max.x + 1 } } } })).toBe(false);
    expect(resolveGroundGlassRawWebGpuCompatibility("r188")).toBeNull();
  });

});
