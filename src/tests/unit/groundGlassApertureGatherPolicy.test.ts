import { describe, expect, it } from "vitest";
import {
  createGroundGlassFrameRequest,
  type GroundGlassFrameRequest,
} from "../../render/groundGlassFrameRequest";
import {
  isGroundGlassApertureGatherR187QualificationBuildAuthorizedForFlags,
  isGroundGlassApertureGatherResearchEvidenceRevisionMatched,
  resolveGroundGlassApertureGatherFormatEligibility,
  resolveGroundGlassApertureGatherResearchEligibility,
  resolveGroundGlassApertureGatherSettings,
  type GroundGlassApertureGatherEligibilityInput,
} from "../../render/webgpu/groundGlassApertureGatherPolicy";
import { isGroundGlassM6PresentationRevisionMatched } from "../../render/webgpu/groundGlassPhysicalCocPolicy";
import {
  GROUND_GLASS_RAW_WEBGPU_COMPATIBILITY,
  GROUND_GLASS_RAW_WEBGPU_R187_COMPATIBILITY,
} from "../../render/webgpu/groundGlassRawWebGpuCompatibility";
import { GROUND_GLASS_M6_PRESENTATION_COMPATIBILITY } from "../../render/webgpu/groundGlassM6PresentationPolicy";
import type { GroundGlassSceneCompatibility } from "../../render/backend/groundGlassSceneCompatibility";
import { understandingCameraMovementsScene } from "../../scenes/definitions/understanding-camera-movements";
import { createGroundGlassRequestInput } from "./groundGlassFrameRequestFixtures";

const requestIdentity = {
  requestId: "m5-request-1",
  channelId: "default",
  sceneId: "architecture-rise",
} as const;

const makeRequest = (): GroundGlassFrameRequest => createGroundGlassFrameRequest(
  createGroundGlassRequestInput({ rawDebug: true }),
  requestIdentity,
);

const baseEligibilityInput = (): GroundGlassApertureGatherEligibilityInput => {
  const request = makeRequest();
  return {
    request,
    runtime: { rendererFamily: "webgpu-renderer", actualExecutionApi: "webgpu" },
    physicalStatus: "completed",
    physicalRequestId: request.identity.requestId,
    expectedRendererRevision: "r186",
  };
};

const reviseFeature = (
  compatibility: GroundGlassSceneCompatibility,
  featureName: string,
  update: (feature: GroundGlassSceneCompatibility["features"][number]) => GroundGlassSceneCompatibility["features"][number],
): GroundGlassSceneCompatibility => ({
  ...compatibility,
  features: compatibility.features.map((feature) => feature.feature === featureName ? update(feature) : feature),
});

describe("Ground Glass M5 aperture-gather research policy", () => {
  it("allows the native M5 attempt only for the exact Architecture Rise request and matching research evidence", () => {
    expect(resolveGroundGlassApertureGatherResearchEligibility(baseEligibilityInput()))
      .toEqual({ status: "eligible" });
  });

  it("does not reuse the historical r186 research evidence for an r187 candidate", () => {
    expect(resolveGroundGlassApertureGatherResearchEligibility({
      ...baseEligibilityInput(),
      expectedRendererRevision: "r187",
      compatibility: GROUND_GLASS_RAW_WEBGPU_COMPATIBILITY,
    })).toEqual({
      status: "unsupported",
      reason: "physical-coc-evidence-does-not-match-candidate",
    });
  });

  it("does not let r187 Raw RTT or M4 research evidence authorize historical M5 research", () => {
    expect(resolveGroundGlassApertureGatherResearchEligibility({
      ...baseEligibilityInput(),
      expectedRendererRevision: "r187",
      compatibility: GROUND_GLASS_RAW_WEBGPU_R187_COMPATIBILITY,
    })).toEqual({
      status: "unsupported",
      reason: "aperture-gather-evidence-does-not-match-candidate",
    });
  });

  it("allows pre-evidence r187 M5 only through the explicit qualification harness after current M4", () => {
    expect(resolveGroundGlassApertureGatherResearchEligibility({
      ...baseEligibilityInput(),
      expectedRendererRevision: "r187",
      compatibility: GROUND_GLASS_RAW_WEBGPU_R187_COMPATIBILITY,
      qualificationHarnessAuthorized: true,
    })).toEqual({ status: "eligible" });
    expect(resolveGroundGlassApertureGatherResearchEligibility({
      ...baseEligibilityInput(),
      expectedRendererRevision: "r187",
      compatibility: GROUND_GLASS_RAW_WEBGPU_R187_COMPATIBILITY,
      qualificationHarnessAuthorized: true,
      physicalRequestId: "retired-m4-request",
    })).toEqual({ status: "unsupported", reason: "current-m4-physical-inputs-not-completed" });
  });

  it("requires all trusted flags and r187 for the qualification harness", () => {
    const flags = {
      developmentBuild: true,
      rawPilotFlag: "true",
      physicalCocResearchFlag: "true",
      apertureGatherResearchFlag: "true",
      testSeamFlag: "true",
      qualificationFlag: "true",
    } as const;
    expect(isGroundGlassApertureGatherR187QualificationBuildAuthorizedForFlags(flags, "187")).toBe(true);
    expect(isGroundGlassApertureGatherR187QualificationBuildAuthorizedForFlags(flags, "186")).toBe(false);
    for (const key of Object.keys(flags) as (keyof typeof flags)[]) {
      const denied = { ...flags, [key]: key === "developmentBuild" ? false : undefined };
      expect(isGroundGlassApertureGatherR187QualificationBuildAuthorizedForFlags(
        denied as unknown as typeof flags,
        "187",
      ))
        .toBe(false);
    }
  });

  it("keeps M5 evidence research-only and requires M6 compatibility to match before M6 provisioning", () => {
    expect(isGroundGlassApertureGatherResearchEvidenceRevisionMatched(
      GROUND_GLASS_RAW_WEBGPU_R187_COMPATIBILITY,
      "r187",
    )).toBe(false);
    expect(isGroundGlassM6PresentationRevisionMatched(
      GROUND_GLASS_M6_PRESENTATION_COMPATIBILITY,
      "r187",
    )).toBe(false);
    expect(isGroundGlassM6PresentationRevisionMatched(
      GROUND_GLASS_M6_PRESENTATION_COMPATIBILITY,
      "r186",
    )).toBe(true);
  });

  it("requires the same native renderer revision for every M5 feature evidence record", () => {
    const input = {
      ...baseEligibilityInput(),
      compatibility: reviseFeature(
        GROUND_GLASS_RAW_WEBGPU_COMPATIBILITY,
        "far-reconstruction-b1",
        (feature) => feature.status === "research-only"
          ? { ...feature, testedContext: { ...feature.testedContext, rendererRevision: "r185" } }
          : feature,
      ),
    };
    expect(resolveGroundGlassApertureGatherResearchEligibility(input)).toEqual({
      status: "unsupported",
      reason: "far-reconstruction-b1-evidence-does-not-match-candidate",
    });
  });

  it("requires current completed M4 physical inputs for the same accepted request", () => {
    const input = { ...baseEligibilityInput(), physicalRequestId: "m5-request-retired" };
    expect(resolveGroundGlassApertureGatherResearchEligibility(input)).toEqual({
      status: "unsupported",
      reason: "current-m4-physical-inputs-not-completed",
    });
  });

  it("does not treat WebGPURenderer WebGL2 execution as native WebGPU eligibility", () => {
    const input = {
      ...baseEligibilityInput(),
      runtime: { rendererFamily: "webgpu-renderer" as const, actualExecutionApi: "webgl2" as const },
    };
    expect(resolveGroundGlassApertureGatherResearchEligibility(input)).toEqual({
      status: "unsupported",
      reason: "native-webgpu-runtime-not-observed",
    });
  });

  it("denies research outside the registered Architecture Rise Raw pilot request", () => {
    const input = {
      ...baseEligibilityInput(),
      request: createGroundGlassFrameRequest(
        createGroundGlassRequestInput({ rawDebug: true, scene: understandingCameraMovementsScene }),
        { ...requestIdentity, sceneId: understandingCameraMovementsScene.id },
      ),
    };
    expect(resolveGroundGlassApertureGatherResearchEligibility(input)).toEqual({
      status: "unsupported",
      reason: "request-outside-architecture-rise-raw-pilot",
    });
  });

  it("requires the full set of target storage formats and rejects any missing format", () => {
    const formats = {
      sourceColor: "rgba8unorm",
      depth: "depth24plus",
      physical: "rgba16float",
      validity: "rgba8unorm",
      far: "rgba16float",
      near: "rgba16float",
      b1: "rgba16float",
      composite: "rgba16float",
      provenance: "rgba32float",
      decisions: "rgba8unorm",
    };
    expect(resolveGroundGlassApertureGatherFormatEligibility({ observedFormats: formats }))
      .toEqual({ status: "eligible" });
    expect(resolveGroundGlassApertureGatherFormatEligibility({
      observedFormats: { ...formats, provenance: null },
    })).toEqual({ status: "unsupported", reason: "provenance-format-unavailable" });
  });

  it("keeps explicit profile dimensions and proposal counts independent", () => {
    expect(resolveGroundGlassApertureGatherSettings("architecture-rise", "full32"))
      .toMatchObject({ qualityMode: "full32", gatherScale: 1, sampleCount: 32 });
    expect(resolveGroundGlassApertureGatherSettings("architecture-rise", "full64"))
      .toMatchObject({ qualityMode: "full64", gatherScale: 1, sampleCount: 64 });
    expect(resolveGroundGlassApertureGatherSettings("architecture-rise", "half16"))
      .toMatchObject({ qualityMode: "half16", gatherScale: 0.5, sampleCount: 16 });
    expect(resolveGroundGlassApertureGatherSettings("architecture-rise", "half32"))
      .toMatchObject({ qualityMode: "half32", gatherScale: 0.5, sampleCount: 32 });
    expect(resolveGroundGlassApertureGatherSettings("architecture-rise", "half64"))
      .toMatchObject({ qualityMode: "half64", gatherScale: 0.5, sampleCount: 64 });
    expect(() => resolveGroundGlassApertureGatherSettings("architecture-rise", "half32", 0))
      .toThrow(RangeError);
    expect(() => resolveGroundGlassApertureGatherSettings("architecture-rise", "half32", 129))
      .toThrow(RangeError);
  });
});
