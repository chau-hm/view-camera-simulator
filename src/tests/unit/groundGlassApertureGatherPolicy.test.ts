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
  GROUND_GLASS_RAW_WEBGPU_R187_V1_COMPATIBILITY,
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
    compatibility: GROUND_GLASS_RAW_WEBGPU_COMPATIBILITY,
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
  it("rejects the historical M5 record after the Architecture Rise source revision changes", () => {
    expect(resolveGroundGlassApertureGatherResearchEligibility(baseEligibilityInput()))
      .toEqual({ status: "unsupported", reason: "scene-source-compatibility-mismatch" });
  });

  it("does not reuse the historical r186 research evidence for an r187 candidate", () => {
    expect(resolveGroundGlassApertureGatherResearchEligibility({
      ...baseEligibilityInput(),
      expectedRendererRevision: "r187",
      compatibility: GROUND_GLASS_RAW_WEBGPU_COMPATIBILITY,
    })).toEqual({
      status: "unsupported",
      reason: "scene-source-compatibility-mismatch",
    });
  });

  it("does not let r187 Raw RTT or M4 research evidence reuse the historical r186 M5 records", () => {
    const historicalGather = GROUND_GLASS_RAW_WEBGPU_COMPATIBILITY.features.find(
      (feature) => feature.feature === "aperture-gather",
    );
    if (!historicalGather) throw new Error("Historical M5 Gather record is unavailable");
    const staleM5Compatibility = reviseFeature(
      GROUND_GLASS_RAW_WEBGPU_R187_V1_COMPATIBILITY,
      "aperture-gather",
      () => historicalGather,
    );
    expect(resolveGroundGlassApertureGatherResearchEligibility({
      ...baseEligibilityInput(),
      expectedRendererRevision: "r187",
      compatibility: staleM5Compatibility,
    })).toEqual({
      status: "unsupported",
      reason: "scene-source-compatibility-mismatch",
    });
  });

  it("rejects historical v1 r187 M5 evidence for the current v2 source", () => {
    expect(resolveGroundGlassApertureGatherResearchEligibility({
      ...baseEligibilityInput(),
      expectedRendererRevision: "r187",
      compatibility: GROUND_GLASS_RAW_WEBGPU_R187_V1_COMPATIBILITY,
    })).toEqual({ status: "unsupported", reason: "scene-source-compatibility-mismatch" });
    expect(isGroundGlassApertureGatherResearchEvidenceRevisionMatched(
      GROUND_GLASS_RAW_WEBGPU_R187_V1_COMPATIBILITY,
      "r187",
    )).toBe(false);
  });

  it("does not let the qualification harness relabel historical M5 evidence for v2", () => {
    expect(resolveGroundGlassApertureGatherResearchEligibility({
      ...baseEligibilityInput(),
      expectedRendererRevision: "r187",
      compatibility: GROUND_GLASS_RAW_WEBGPU_R187_V1_COMPATIBILITY,
      qualificationHarnessAuthorized: true,
    })).toEqual({ status: "unsupported", reason: "scene-source-compatibility-mismatch" });
    expect(resolveGroundGlassApertureGatherResearchEligibility({
      ...baseEligibilityInput(),
      expectedRendererRevision: "r187",
      compatibility: GROUND_GLASS_RAW_WEBGPU_R187_V1_COMPATIBILITY,
      qualificationHarnessAuthorized: true,
      physicalRequestId: "retired-m4-request",
    })).toEqual({ status: "unsupported", reason: "scene-source-compatibility-mismatch" });
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

  it("keeps historical M5 evidence unmatched for v2 and requires M6 compatibility before provisioning", () => {
    expect(isGroundGlassApertureGatherResearchEvidenceRevisionMatched(
      GROUND_GLASS_RAW_WEBGPU_R187_V1_COMPATIBILITY,
      "r187",
    )).toBe(false);
    expect(isGroundGlassApertureGatherResearchEvidenceRevisionMatched(
      reviseFeature(GROUND_GLASS_RAW_WEBGPU_R187_V1_COMPATIBILITY, "aperture-gather", (feature) =>
        feature.status === "research-only" ? { ...feature, evidenceRevision: "wrong-r187-evidence" } : feature),
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
      reason: "scene-source-compatibility-mismatch",
    });
  });

  it("requires current completed M4 physical inputs for the same accepted request", () => {
    const input = { ...baseEligibilityInput(), physicalRequestId: "m5-request-retired" };
    expect(resolveGroundGlassApertureGatherResearchEligibility(input)).toEqual({
      status: "unsupported",
      reason: "scene-source-compatibility-mismatch",
    });
  });

  it("does not treat WebGPURenderer WebGL2 execution as native WebGPU eligibility", () => {
    const input = {
      ...baseEligibilityInput(),
      runtime: { rendererFamily: "webgpu-renderer" as const, actualExecutionApi: "webgl2" as const },
    };
    expect(resolveGroundGlassApertureGatherResearchEligibility(input)).toEqual({
      status: "unsupported",
      reason: "scene-source-compatibility-mismatch",
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
