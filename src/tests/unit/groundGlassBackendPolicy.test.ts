import { describe, expect, it } from "vitest";
import { selectGroundGlassBackend } from "../../render/backend/groundGlassBackendPolicy";
import type { GroundGlassFeatureCompatibility } from "../../render/backend/groundGlassSceneCompatibility";
import {
  ARCHITECTURE_RISE_APERTURE_GATHER_EVIDENCE_REVISION,
  ARCHITECTURE_RISE_APERTURE_GATHER_R187_EVIDENCE_REVISION,
  ARCHITECTURE_RISE_B1_RESEARCH_EVIDENCE_REVISION,
  ARCHITECTURE_RISE_B1_R187_RESEARCH_EVIDENCE_REVISION,
  ARCHITECTURE_RISE_PHYSICAL_COC_EVIDENCE_REVISION,
  ARCHITECTURE_RISE_PHYSICAL_COC_R187_EVIDENCE_REVISION,
  ARCHITECTURE_RISE_RAW_RTT_EVIDENCE_REVISION,
  ARCHITECTURE_RISE_RAW_RTT_R187_EVIDENCE_REVISION,
  GROUND_GLASS_RAW_WEBGPU_COMPATIBILITY,
  GROUND_GLASS_RAW_WEBGPU_R187_COMPATIBILITY,
  resolveGroundGlassRawWebGpuCompatibility,
  resolveGroundGlassRawWebGpuEvidenceRevision,
  requireGroundGlassRawWebGpuEvidenceRevision,
} from "../../render/webgpu/groundGlassRawWebGpuCompatibility";
import {
  GROUND_GLASS_M6_PRESENTATION_FEATURES,
  GROUND_GLASS_M6_PRESENTATION_COMPATIBILITY,
} from "../../render/webgpu/groundGlassM6PresentationPolicy";
import {
  completeCapabilityPreflight,
  createSyntheticCompatibility,
  createVerifiedFeature,
  createWebGpuPolicyInput,
  SYNTHETIC_SCENE_ID,
} from "./groundGlassBackendTestFixtures";

const deniedReasons = (input: Parameters<typeof selectGroundGlassBackend>[0]) => {
  const result = selectGroundGlassBackend(input);
  expect(result.policyDecision.status).toBe("denied");
  return result.policyDecision.status === "denied" ? result.policyDecision.reasons : [];
};

describe("Ground Glass backend policy", () => {
  it("selects WebGL by default", () => {
    const result = selectGroundGlassBackend(createWebGpuPolicyInput({
      requestedBackend: null,
      expectedCandidateRendererRevision: null,
    }));
    expect(result).toMatchObject({
      status: "selected",
      selectedBackend: "webgl",
      selectionReason: "webgl-default",
      policyDecision: { status: "defaulted", reason: "webgl-default" },
    });
  });

  it("selects explicitly requested WebGL when available", () => {
    const result = selectGroundGlassBackend(createWebGpuPolicyInput({
      requestedBackend: "webgl",
      expectedCandidateRendererRevision: null,
    }));
    expect(result).toMatchObject({
      status: "selected",
      selectedBackend: "webgl",
      selectionReason: "explicit-webgl-request",
    });
  });

  it("denies WebGPU in production even when authorization, evidence, and capabilities are supplied", () => {
    const result = selectGroundGlassBackend(createWebGpuPolicyInput({ environment: "production" }));
    expect(result).toMatchObject({
      status: "selected",
      selectedBackend: "webgl",
      policyDecision: { status: "denied", reasons: ["production-webgpu-forbidden"] },
    });
  });

  it("requires explicit development/test authorization", () => {
    const result = selectGroundGlassBackend(createWebGpuPolicyInput({
      authorization: { status: "unauthorized", reason: "not-configured" },
    }));
    expect(result).toMatchObject({
      status: "selected",
      selectedBackend: "webgl",
      policyDecision: {
        status: "denied",
        reasons: expect.arrayContaining(["webgpu-authorization-required"]),
      },
    });
  });

  it("accepts the explicit development/test request path in test environment", () => {
    const result = selectGroundGlassBackend(createWebGpuPolicyInput({ environment: "test" }));
    expect(result).toMatchObject({ status: "selected", selectedBackend: "webgpu" });
  });

  it("selects revision-bound Raw RTT evidence and keeps unsupported revisions fail-closed", () => {
    expect(resolveGroundGlassRawWebGpuEvidenceRevision("r186"))
      .toBe(ARCHITECTURE_RISE_RAW_RTT_EVIDENCE_REVISION);
    expect(resolveGroundGlassRawWebGpuEvidenceRevision("r187"))
      .toBe(ARCHITECTURE_RISE_RAW_RTT_R187_EVIDENCE_REVISION);
    expect(resolveGroundGlassRawWebGpuEvidenceRevision("r188")).toBeNull();
    expect(resolveGroundGlassRawWebGpuEvidenceRevision("unknown")).toBeNull();
    expect(() => requireGroundGlassRawWebGpuEvidenceRevision("r188"))
      .toThrow("Ground Glass Raw RTT is not qualified for renderer r188");
    expect(() => requireGroundGlassRawWebGpuEvidenceRevision("unknown"))
      .toThrow("Ground Glass Raw RTT is not qualified for renderer unknown");

    const r187Compatibility = resolveGroundGlassRawWebGpuCompatibility("r187");
    expect(r187Compatibility).toBeTruthy();
    expect(r187Compatibility?.features.find((feature) => feature.feature === "raw-rtt"))
      .toMatchObject({
        status: "verified",
        evidenceRevision: ARCHITECTURE_RISE_RAW_RTT_R187_EVIDENCE_REVISION,
        testedContext: { rendererRevision: "r187" },
      });
    const rawResult = selectGroundGlassBackend(createWebGpuPolicyInput({
      sceneId: "architecture-rise",
      requestedFeatures: ["raw-rtt"],
      sceneCompatibility: r187Compatibility,
      expectedCandidateRendererRevision: "r187",
    }));
    expect(rawResult).toMatchObject({
      status: "selected",
      selectedBackend: "webgpu",
      policyDecision: {
        status: "authorized",
        sceneEligibility: {
          status: "eligible",
          evidenceRevisions: [ARCHITECTURE_RISE_RAW_RTT_R187_EVIDENCE_REVISION],
        },
      },
    });

    expect(GROUND_GLASS_RAW_WEBGPU_COMPATIBILITY.features.find(
      (feature) => feature.feature === "physical-coc",
    )).toMatchObject({
      status: "research-only",
      evidenceRevision: ARCHITECTURE_RISE_PHYSICAL_COC_EVIDENCE_REVISION,
      testedContext: { rendererRevision: "r186" },
    });
    expect(GROUND_GLASS_RAW_WEBGPU_R187_COMPATIBILITY.features.find(
      (feature) => feature.feature === "physical-coc",
    )).toMatchObject({
      status: "research-only",
      evidenceRevision: ARCHITECTURE_RISE_PHYSICAL_COC_R187_EVIDENCE_REVISION,
      testedContext: { rendererRevision: "r187", executionApi: "webgpu" },
      knownIncompatibilities: expect.arrayContaining([
        expect.stringContaining("depth-limited near focal inversion"),
      ]),
    });
    const m4OnlyResult = selectGroundGlassBackend(createWebGpuPolicyInput({
      sceneId: "architecture-rise",
      requestedFeatures: ["physical-coc"],
      sceneCompatibility: GROUND_GLASS_RAW_WEBGPU_R187_COMPATIBILITY,
      expectedCandidateRendererRevision: "r187",
    }));
    expect(m4OnlyResult.selectedBackend).toBe("webgl");
    expect(m4OnlyResult.policyDecision).toMatchObject({
      status: "denied",
      sceneEligibility: { status: "denied", reasons: expect.arrayContaining(["feature-research-only"]) },
    });
    const combinedRawAndM4Result = selectGroundGlassBackend(createWebGpuPolicyInput({
      sceneId: "architecture-rise",
      requestedFeatures: ["raw-rtt", "physical-coc"],
      sceneCompatibility: GROUND_GLASS_RAW_WEBGPU_R187_COMPATIBILITY,
      expectedCandidateRendererRevision: "r187",
    }));
    expect(combinedRawAndM4Result.selectedBackend).toBe("webgl");
    expect(combinedRawAndM4Result.policyDecision).toMatchObject({
      status: "denied",
      sceneEligibility: { status: "denied", reasons: expect.arrayContaining(["feature-research-only"]) },
    });
    expect(GROUND_GLASS_RAW_WEBGPU_COMPATIBILITY.features.find(
      (feature) => feature.feature === "aperture-gather",
    )).toMatchObject({
      status: "research-only",
      evidenceRevision: ARCHITECTURE_RISE_APERTURE_GATHER_EVIDENCE_REVISION,
      testedContext: { rendererRevision: "r186" },
    });
    expect(GROUND_GLASS_RAW_WEBGPU_COMPATIBILITY.features.find(
      (feature) => feature.feature === "far-reconstruction-b1",
    )).toMatchObject({
      status: "research-only",
      evidenceRevision: ARCHITECTURE_RISE_B1_RESEARCH_EVIDENCE_REVISION,
      testedContext: { rendererRevision: "r186" },
    });
    expect(GROUND_GLASS_RAW_WEBGPU_R187_COMPATIBILITY.features.find(
      (feature) => feature.feature === "aperture-gather",
    )).toMatchObject({
      status: "research-only",
      evidenceRevision: ARCHITECTURE_RISE_APERTURE_GATHER_R187_EVIDENCE_REVISION,
      testedContext: { rendererRevision: "r187", executionApi: "webgpu" },
      knownIncompatibilities: expect.arrayContaining([
        expect.stringContaining("partially qualified"),
      ]),
    });
    expect(GROUND_GLASS_RAW_WEBGPU_R187_COMPATIBILITY.features.find(
      (feature) => feature.feature === "far-reconstruction-b1",
    )).toMatchObject({
      status: "research-only",
      evidenceRevision: ARCHITECTURE_RISE_B1_R187_RESEARCH_EVIDENCE_REVISION,
      testedContext: { rendererRevision: "r187", executionApi: "webgpu" },
    });
    const m5AttemptResult = selectGroundGlassBackend(createWebGpuPolicyInput({
      sceneId: "architecture-rise",
      requestedFeatures: ["raw-rtt", "physical-coc", "aperture-gather", "far-reconstruction-b1"],
      sceneCompatibility: GROUND_GLASS_RAW_WEBGPU_R187_COMPATIBILITY,
      expectedCandidateRendererRevision: "r187",
    }));
    expect(m5AttemptResult.selectedBackend).toBe("webgl");
    expect(m5AttemptResult.policyDecision).toMatchObject({
      status: "denied",
      sceneEligibility: { status: "denied", reasons: expect.arrayContaining(["feature-research-only"]) },
    });
    expect(GROUND_GLASS_M6_PRESENTATION_COMPATIBILITY.features.every(
      (feature) => feature.status === "implementation-verified" &&
        feature.testedContext.rendererRevision === "r186",
    )).toBe(true);
    const m6R187Result = selectGroundGlassBackend(createWebGpuPolicyInput({
      sceneId: "architecture-rise",
      requestedFeatures: GROUND_GLASS_M6_PRESENTATION_FEATURES,
      sceneCompatibility: GROUND_GLASS_M6_PRESENTATION_COMPATIBILITY,
      expectedCandidateRendererRevision: "r187",
    }));
    expect(m6R187Result.selectedBackend).toBe("webgl");
    expect(m6R187Result.policyDecision).toMatchObject({
      status: "denied",
      sceneEligibility: {
        status: "denied",
        reasons: expect.arrayContaining(["renderer-revision-mismatch"]),
      },
    });

    expect(resolveGroundGlassRawWebGpuCompatibility("r188")).toBeNull();
    const unknownRevisionResult = selectGroundGlassBackend(createWebGpuPolicyInput({
      sceneId: "architecture-rise",
      requestedFeatures: ["raw-rtt"],
      sceneCompatibility: resolveGroundGlassRawWebGpuCompatibility("r188"),
      expectedCandidateRendererRevision: "r188",
    }));
    expect(unknownRevisionResult.selectedBackend).toBe("webgl");
    expect(unknownRevisionResult.policyDecision).toMatchObject({
      status: "denied",
      sceneEligibility: { status: "denied", reasons: ["unknown-scene"] },
    });
  });

  it("fails closed on an unknown request value", () => {
    const result = selectGroundGlassBackend(createWebGpuPolicyInput({ requestedBackend: "webgpu-auto" }));
    expect(result).toMatchObject({ selectedBackend: "webgl", selectionReason: "webgl-after-request-denial" });
    expect(deniedReasons(createWebGpuPolicyInput({ requestedBackend: "webgpu-auto" })))
      .toContain("unrecognized-backend-request");
  });

  it("fails closed on an unknown scene", () => {
    const result = selectGroundGlassBackend(createWebGpuPolicyInput({
      sceneId: "unregistered-public-scene",
      sceneCompatibility: null,
    }));
    expect(result.selectedBackend).toBe("webgl");
    expect(result.policyDecision).toMatchObject({
      status: "denied",
      reasons: ["scene-ineligible"],
      sceneEligibility: { status: "denied", reasons: ["unknown-scene"] },
    });
  });

  it("fails closed on an unknown requested feature", () => {
    const result = selectGroundGlassBackend(createWebGpuPolicyInput({
      requestedFeatures: ["raw-rtt", "unimplemented-feature"],
    }));
    expect(result.selectedBackend).toBe("webgl");
    expect(result.policyDecision).toMatchObject({
      status: "denied",
      sceneEligibility: { status: "denied", reasons: ["unknown-feature"] },
    });
  });

  it("does not treat research-only fixture evidence as scene verification", () => {
    const researchOnly: GroundGlassFeatureCompatibility = {
      feature: "raw-rtt",
      status: "research-only",
      sourceRevision: "fixture-source-r1",
      evidenceRevision: "fixture-evidence-r1",
      testedContext: {
        rendererFamily: "webgpu-renderer",
        executionApi: "webgpu",
        rendererRevision: "fixture-renderer",
        runtimeDescription: "isolated experimental fixture",
      },
      evidence: ["isolated-fixture-run"],
      requiredCapabilities: { adapterFeatures: [], textureStorageFormats: [] },
      knownIncompatibilities: [],
    };
    const result = selectGroundGlassBackend(createWebGpuPolicyInput({
      sceneCompatibility: createSyntheticCompatibility([researchOnly]),
    }));
    expect(result.selectedBackend).toBe("webgl");
    expect(result.policyDecision).toMatchObject({
      status: "denied",
      sceneEligibility: { status: "denied", reasons: ["feature-research-only"] },
    });
  });

  it("denies a feature whose compatibility status is not evaluated", () => {
    const notEvaluated: GroundGlassFeatureCompatibility = {
      feature: "raw-rtt",
      status: "not-evaluated",
      sourceRevision: "scene-source-r1",
      knownIncompatibilities: [],
    };
    const result = selectGroundGlassBackend(createWebGpuPolicyInput({
      sceneCompatibility: createSyntheticCompatibility([notEvaluated]),
    }));
    expect(result.policyDecision).toMatchObject({
      status: "denied",
      sceneEligibility: { status: "denied", reasons: ["feature-not-evaluated"] },
    });
  });

  it("does not let verification of one feature authorize an unrelated feature", () => {
    const result = selectGroundGlassBackend(createWebGpuPolicyInput({
      requestedFeatures: ["physical-coc"],
      sceneCompatibility: createSyntheticCompatibility([createVerifiedFeature("raw-rtt")]),
    }));
    expect(result.selectedBackend).toBe("webgl");
    expect(result.policyDecision).toMatchObject({
      status: "denied",
      sceneEligibility: { status: "denied", reasons: ["feature-not-declared"] },
    });
  });

  it("accepts verified feature evidence when its source revision matches the scene revision", () => {
    const feature = createVerifiedFeature("raw-rtt", { sourceRevision: "r2" });
    const result = selectGroundGlassBackend(createWebGpuPolicyInput({
      sceneCompatibility: createSyntheticCompatibility([feature], SYNTHETIC_SCENE_ID, "r2"),
    }));

    expect(result).toMatchObject({ status: "selected", selectedBackend: "webgpu" });
  });

  it("denies verified feature evidence from a different scene source revision", () => {
    const feature = createVerifiedFeature("raw-rtt", { sourceRevision: "r1" });
    const result = selectGroundGlassBackend(createWebGpuPolicyInput({
      sceneCompatibility: createSyntheticCompatibility([feature], SYNTHETIC_SCENE_ID, "r2"),
    }));

    expect(result.selectedBackend).toBe("webgl");
    expect(result.policyDecision).toMatchObject({
      status: "denied",
      sceneEligibility: { status: "denied", reasons: ["feature-source-revision-mismatch"] },
    });
  });

  it("validates source revision consistency independently for every requested feature", () => {
    const result = selectGroundGlassBackend(createWebGpuPolicyInput({
      requestedFeatures: ["raw-rtt", "physical-coc"],
      sceneCompatibility: createSyntheticCompatibility([
        createVerifiedFeature("raw-rtt", { sourceRevision: "r2" }),
        createVerifiedFeature("physical-coc", { sourceRevision: "r1" }),
      ], SYNTHETIC_SCENE_ID, "r2"),
    }));

    expect(result.selectedBackend).toBe("webgl");
    expect(result.policyDecision).toMatchObject({
      status: "denied",
      sceneEligibility: { status: "denied", reasons: ["feature-source-revision-mismatch"] },
    });
  });

  it("fails closed when the scene or verified feature source revision is blank", () => {
    const blankSceneRevision = selectGroundGlassBackend(createWebGpuPolicyInput({
      sceneCompatibility: createSyntheticCompatibility(
        [createVerifiedFeature()],
        SYNTHETIC_SCENE_ID,
        "  ",
      ),
    }));
    const blankFeatureRevision = selectGroundGlassBackend(createWebGpuPolicyInput({
      sceneCompatibility: createSyntheticCompatibility([
        createVerifiedFeature("raw-rtt", { sourceRevision: " " }),
      ]),
    }));

    expect(blankSceneRevision.selectedBackend).toBe("webgl");
    expect(blankSceneRevision.policyDecision).toMatchObject({
      status: "denied",
      sceneEligibility: { status: "denied", reasons: ["scene-source-revision-missing"] },
    });
    expect(blankFeatureRevision.selectedBackend).toBe("webgl");
    expect(blankFeatureRevision.policyDecision).toMatchObject({
      status: "denied",
      sceneEligibility: { status: "denied", reasons: ["feature-source-revision-missing"] },
    });
  });

  it("requires an exact candidate renderer revision match for every requested feature", () => {
    const matching = selectGroundGlassBackend(createWebGpuPolicyInput({
      expectedCandidateRendererRevision: "three-test-r186",
      sceneCompatibility: createSyntheticCompatibility([
        createVerifiedFeature("raw-rtt", {
          testedContext: {
            rendererFamily: "webgpu-renderer",
            executionApi: "webgpu",
            rendererRevision: "three-test-r186",
            runtimeDescription: "synthetic unit-test evidence only",
          },
        }),
      ]),
    }));
    const stale = selectGroundGlassBackend(createWebGpuPolicyInput({
      expectedCandidateRendererRevision: "three-test-r186",
      sceneCompatibility: createSyntheticCompatibility([
        createVerifiedFeature("raw-rtt", {
          testedContext: {
            rendererFamily: "webgpu-renderer",
            executionApi: "webgpu",
            rendererRevision: "three-test-r185",
            runtimeDescription: "synthetic unit-test evidence only",
          },
        }),
      ]),
    }));

    expect(matching).toMatchObject({ status: "selected", selectedBackend: "webgpu" });
    expect(stale.selectedBackend).toBe("webgl");
    expect(stale.policyDecision).toMatchObject({
      status: "denied",
      sceneEligibility: { status: "denied", reasons: ["renderer-revision-mismatch"] },
    });
  });

  it("denies missing candidate or verified renderer revisions", () => {
    const missingCandidate = selectGroundGlassBackend(createWebGpuPolicyInput({
      expectedCandidateRendererRevision: null,
    }));
    const blankCandidate = selectGroundGlassBackend(createWebGpuPolicyInput({
      expectedCandidateRendererRevision: " ",
    }));
    const missingEvidenceRevision = selectGroundGlassBackend(createWebGpuPolicyInput({
      sceneCompatibility: createSyntheticCompatibility([
        createVerifiedFeature("raw-rtt", {
          testedContext: {
            rendererFamily: "webgpu-renderer",
            executionApi: "webgpu",
            rendererRevision: " ",
            runtimeDescription: "synthetic unit-test evidence only",
          },
        }),
      ]),
    }));

    for (const result of [missingCandidate, blankCandidate, missingEvidenceRevision]) {
      expect(result.selectedBackend).toBe("webgl");
      expect(result.policyDecision.status).toBe("denied");
    }
    expect(missingCandidate.policyDecision).toMatchObject({
      sceneEligibility: { status: "denied", reasons: ["candidate-renderer-revision-missing"] },
    });
    expect(blankCandidate.policyDecision).toMatchObject({
      sceneEligibility: { status: "denied", reasons: ["candidate-renderer-revision-missing"] },
    });
    expect(missingEvidenceRevision.policyDecision).toMatchObject({
      sceneEligibility: { status: "denied", reasons: ["feature-renderer-revision-missing"] },
    });
  });

  it("denies the whole request when requested features were verified under different renderer revisions", () => {
    const result = selectGroundGlassBackend(createWebGpuPolicyInput({
      requestedFeatures: ["raw-rtt", "physical-coc"],
      expectedCandidateRendererRevision: "three-test-r186",
      sceneCompatibility: createSyntheticCompatibility([
        createVerifiedFeature("raw-rtt", {
          testedContext: {
            rendererFamily: "webgpu-renderer",
            executionApi: "webgpu",
            rendererRevision: "three-test-r186",
            runtimeDescription: "synthetic unit-test evidence only",
          },
        }),
        createVerifiedFeature("physical-coc", {
          testedContext: {
            rendererFamily: "webgpu-renderer",
            executionApi: "webgpu",
            rendererRevision: "three-test-r185",
            runtimeDescription: "synthetic unit-test evidence only",
          },
        }),
      ]),
    }));

    expect(result.selectedBackend).toBe("webgl");
    expect(result.policyDecision).toMatchObject({
      status: "denied",
      sceneEligibility: { status: "denied", reasons: ["renderer-revision-mismatch"] },
    });
  });

  it("denies verified feature evidence that carries a known incompatibility", () => {
    const result = selectGroundGlassBackend(createWebGpuPolicyInput({
      sceneCompatibility: createSyntheticCompatibility([
        createVerifiedFeature("raw-rtt", { knownIncompatibilities: ["fixture-only-material-path"] }),
      ]),
    }));
    expect(result.policyDecision).toMatchObject({
      status: "denied",
      sceneEligibility: { status: "denied", reasons: ["feature-has-known-incompatibility"] },
    });
  });

  it("denies a verified label without supporting evidence", () => {
    const result = selectGroundGlassBackend(createWebGpuPolicyInput({
      sceneCompatibility: createSyntheticCompatibility([
        createVerifiedFeature("raw-rtt", { verificationEvidence: [] }),
      ]),
    }));
    expect(result.policyDecision).toMatchObject({
      status: "denied",
      sceneEligibility: { status: "denied", reasons: ["feature-evidence-insufficient"] },
    });
  });

  it("denies a missing mandatory adapter feature", () => {
    const result = selectGroundGlassBackend(createWebGpuPolicyInput({
      capabilityPreflight: { ...completeCapabilityPreflight, adapterFeatures: [] },
    }));
    expect(result.selectedBackend).toBe("webgl");
    expect(result.policyDecision).toMatchObject({
      status: "denied",
      capabilityPreflight: {
        status: "denied",
        missing: { adapterFeatures: ["float32-filterable"] },
        reasons: ["missing-required-adapter-feature"],
      },
    });
  });

  it("denies a missing mandatory texture/storage format", () => {
    const result = selectGroundGlassBackend(createWebGpuPolicyInput({
      capabilityPreflight: { ...completeCapabilityPreflight, textureStorageFormats: [] },
    }));
    expect(result.selectedBackend).toBe("webgl");
    expect(result.policyDecision).toMatchObject({
      status: "denied",
      capabilityPreflight: {
        status: "denied",
        missing: { textureStorageFormats: ["rgba16float"] },
        reasons: ["missing-required-texture-storage-format"],
      },
    });
  });

  it("denies unresolved required capability evidence", () => {
    const result = selectGroundGlassBackend(createWebGpuPolicyInput({
      capabilityPreflight: { ...completeCapabilityPreflight, adapterFeatures: null },
    }));
    expect(result.policyDecision).toMatchObject({
      status: "denied",
      capabilityPreflight: {
        status: "denied",
        unresolved: ["adapter-features"],
        reasons: ["adapter-features-unresolved"],
      },
    });
  });

  it("denies unavailable or unresolved browser capability reports", () => {
    const unavailable = selectGroundGlassBackend(createWebGpuPolicyInput({
      capabilityPreflight: { ...completeCapabilityPreflight, webgpuAvailability: "reported-unavailable" },
    }));
    const unresolved = selectGroundGlassBackend(createWebGpuPolicyInput({
      capabilityPreflight: { ...completeCapabilityPreflight, webgpuAvailability: "unresolved" },
    }));
    expect(unavailable.policyDecision).toMatchObject({
      status: "denied",
      capabilityPreflight: { status: "denied", reasons: ["webgpu-unavailable"] },
    });
    expect(unresolved.policyDecision).toMatchObject({
      status: "denied",
      capabilityPreflight: {
        status: "denied",
        unresolved: ["webgpu-availability"],
        reasons: ["webgpu-availability-unresolved"],
      },
    });
  });

  it("denies unresolved required texture/storage format evidence", () => {
    const result = selectGroundGlassBackend(createWebGpuPolicyInput({
      capabilityPreflight: { ...completeCapabilityPreflight, textureStorageFormats: null },
    }));
    expect(result.policyDecision).toMatchObject({
      status: "denied",
      capabilityPreflight: {
        status: "denied",
        unresolved: ["texture-storage-formats"],
        reasons: ["texture-storage-formats-unresolved"],
      },
    });
  });

  it("selects a WebGPU attempt only for a synthetic fully verified, authorized development request", () => {
    const result = selectGroundGlassBackend(createWebGpuPolicyInput());
    expect(result).toMatchObject({
      status: "selected",
      selectedBackend: "webgpu",
      selectionReason: "authorized-development-webgpu-request",
      authorizedAttempt: {
        channelId: "primary",
        pilotSessionId: "m1-synthetic-session",
        sceneId: SYNTHETIC_SCENE_ID,
        retryEpoch: 0,
      },
      policyDecision: {
        status: "authorized",
        sceneEligibility: { status: "eligible", requestedFeatures: ["raw-rtt"] },
        capabilityPreflight: { status: "satisfied" },
      },
    });
    expect(result).not.toHaveProperty("mountedRuntime");
    expect(result).not.toHaveProperty("actualExecutionApi");
  });

  it("reports unavailable when WebGL is absent and the WebGPU request is denied", () => {
    const result = selectGroundGlassBackend(createWebGpuPolicyInput({
      authorization: { status: "unauthorized", reason: "disabled" },
      webglAvailable: false,
    }));
    expect(result).toMatchObject({
      status: "unavailable",
      selectedBackend: null,
      selectionReason: "no-valid-backend-available",
      failureReason: "webgl-unavailable-and-webgpu-not-authorized",
      policyDecision: { status: "denied", reasons: ["webgpu-authorization-required"] },
    });
  });

  it("requires the compatibility record's exact scene identity", () => {
    const result = selectGroundGlassBackend(createWebGpuPolicyInput({
      sceneCompatibility: createSyntheticCompatibility(undefined, "different-scene"),
    }));
    expect(result.policyDecision).toMatchObject({
      status: "denied",
      sceneEligibility: { status: "denied", reasons: ["scene-identity-mismatch"] },
    });
  });
});
