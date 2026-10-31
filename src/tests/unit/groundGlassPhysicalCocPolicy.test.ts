import { describe, expect, it } from "vitest";
import {
  ARCHITECTURE_RISE_PHYSICAL_COC_R187_EVIDENCE_REVISION,
  GROUND_GLASS_RAW_WEBGPU_COMPATIBILITY,
  GROUND_GLASS_RAW_WEBGPU_R187_COMPATIBILITY,
} from "../../render/webgpu/groundGlassRawWebGpuCompatibility";
import { GROUND_GLASS_M6_PRESENTATION_COMPATIBILITY } from "../../render/webgpu/groundGlassM6PresentationPolicy";
import {
  isGroundGlassM6PresentationRevisionMatched,
  isGroundGlassPhysicalCocProvisioningEnabledForPolicy,
  isGroundGlassPhysicalCocQualificationBuildAuthorizedForFlags,
  isGroundGlassPhysicalCocResearchEnabledForPolicy,
  isGroundGlassPhysicalCocResearchEvidenceRevisionMatched,
} from "../../render/webgpu/groundGlassPhysicalCocPolicy";

const r187QualificationFlags = {
  developmentBuild: true,
  rawPilotFlag: "true",
  physicalCocResearchFlag: "true",
  testSeamFlag: "true",
  qualificationFlag: "true",
} as const;

const trustedR187M4PolicyInput = {
  m6PresentationRequest: false,
  m6CompatibilityRevisionMatched: false,
  developmentBuild: true,
  rawPilotBuildAuthorized: true,
  physicalCocResearchBuildEnabled: true,
  rawPilotRequest: true,
  m4ResearchEvidenceRevisionMatched: false,
  qualificationHarnessAuthorized: true,
} as const;

describe("Ground Glass Physical CoC revision research policy", () => {
  it("does not reuse historical r186 M4 research evidence for r187", () => {
    expect(isGroundGlassPhysicalCocResearchEvidenceRevisionMatched(
      GROUND_GLASS_RAW_WEBGPU_R187_COMPATIBILITY,
      "r187",
    )).toBe(true);
    expect(isGroundGlassPhysicalCocResearchEvidenceRevisionMatched(
      GROUND_GLASS_RAW_WEBGPU_COMPATIBILITY,
      "r187",
    )).toBe(false);
    expect(isGroundGlassPhysicalCocResearchEvidenceRevisionMatched(
      GROUND_GLASS_RAW_WEBGPU_COMPATIBILITY,
      "r186",
    )).toBe(true);
    expect(GROUND_GLASS_RAW_WEBGPU_R187_COMPATIBILITY.features.find(
      (feature) => feature.feature === "physical-coc",
    )).toMatchObject({
      evidenceRevision: ARCHITECTURE_RISE_PHYSICAL_COC_R187_EVIDENCE_REVISION,
      status: "research-only",
      testedContext: { rendererRevision: "r187", executionApi: "webgpu" },
    });

    const webgl2ResearchRecord = {
      ...GROUND_GLASS_RAW_WEBGPU_COMPATIBILITY,
      features: GROUND_GLASS_RAW_WEBGPU_COMPATIBILITY.features.map((feature) =>
        feature.feature === "physical-coc" && feature.status === "research-only"
          ? { ...feature, testedContext: { ...feature.testedContext, rendererRevision: "r187", executionApi: "webgl2" as const } }
          : feature,
      ),
    };
    expect(isGroundGlassPhysicalCocResearchEvidenceRevisionMatched(webgl2ResearchRecord, "r187")).toBe(false);

    expect(isGroundGlassPhysicalCocResearchEvidenceRevisionMatched({
      ...GROUND_GLASS_RAW_WEBGPU_COMPATIBILITY,
      sceneId: "unsupported-scene",
    }, "r186")).toBe(false);
  });

  it("allows the bounded qualification harness without treating it as compatibility eligibility", () => {
    expect(isGroundGlassPhysicalCocQualificationBuildAuthorizedForFlags(
      r187QualificationFlags,
      "187",
    )).toBe(true);
    expect(isGroundGlassPhysicalCocResearchEnabledForPolicy(trustedR187M4PolicyInput)).toBe(true);
    expect(isGroundGlassPhysicalCocResearchEnabledForPolicy({
      ...trustedR187M4PolicyInput,
      qualificationHarnessAuthorized: false,
    })).toBe(false);
  });

  it.each([
    ["production build", { developmentBuild: false }],
    ["missing Raw pilot", { rawPilotFlag: "false" }],
    ["missing M4 flag", { physicalCocResearchFlag: "false" }],
    ["missing test seam", { testSeamFlag: "false" }],
    ["missing qualification flag", { qualificationFlag: "false" }],
  ] as const)("qualification harness rejects %s", (_label, override) => {
    expect(isGroundGlassPhysicalCocQualificationBuildAuthorizedForFlags({
      ...r187QualificationFlags,
      ...override,
    }, "187")).toBe(false);
  });

  it.each(["186", "188", "unknown"])("qualification harness rejects Three.js %s", (revision) => {
    expect(isGroundGlassPhysicalCocQualificationBuildAuthorizedForFlags(
      r187QualificationFlags,
      revision,
    )).toBe(false);
  });

  it("keeps ordinary r187 M4 research disabled until revision-matched evidence exists", () => {
    expect(isGroundGlassPhysicalCocResearchEnabledForPolicy({
      ...trustedR187M4PolicyInput,
      qualificationHarnessAuthorized: false,
      m4ResearchEvidenceRevisionMatched: false,
    })).toBe(false);
    expect(isGroundGlassPhysicalCocResearchEnabledForPolicy({
      ...trustedR187M4PolicyInput,
      qualificationHarnessAuthorized: false,
      m4ResearchEvidenceRevisionMatched: true,
    })).toBe(true);
  });

  it("does not enable the optional M4 pass in production or outside the Raw pilot", () => {
    expect(isGroundGlassPhysicalCocResearchEnabledForPolicy({
      ...trustedR187M4PolicyInput,
      developmentBuild: false,
    })).toBe(false);
    expect(isGroundGlassPhysicalCocResearchEnabledForPolicy({
      ...trustedR187M4PolicyInput,
      rawPilotBuildAuthorized: false,
    })).toBe(false);
    expect(isGroundGlassPhysicalCocResearchEnabledForPolicy({
      ...trustedR187M4PolicyInput,
      rawPilotRequest: false,
    })).toBe(false);
  });

  it("denies M6-triggered M4 execution and provisioning when the M6 evidence is r186", () => {
    expect(isGroundGlassM6PresentationRevisionMatched(
      GROUND_GLASS_M6_PRESENTATION_COMPATIBILITY,
      "r187",
    )).toBe(false);
    const m6RequestWithStaleEvidence = {
      ...trustedR187M4PolicyInput,
      m6PresentationRequest: true,
      m6CompatibilityRevisionMatched: false,
      qualificationHarnessAuthorized: false,
    };
    expect(isGroundGlassPhysicalCocResearchEnabledForPolicy(m6RequestWithStaleEvidence)).toBe(false);
    expect(isGroundGlassPhysicalCocProvisioningEnabledForPolicy({
      ...m6RequestWithStaleEvidence,
      m6CapableSession: true,
    })).toBe(false);
  });

  it("retains the current r186 M6 provision path only with matching complete feature records", () => {
    expect(isGroundGlassM6PresentationRevisionMatched(
      GROUND_GLASS_M6_PRESENTATION_COMPATIBILITY,
      "r186",
    )).toBe(true);
    expect(isGroundGlassPhysicalCocProvisioningEnabledForPolicy({
      ...trustedR187M4PolicyInput,
      m6CapableSession: true,
      m6CompatibilityRevisionMatched: true,
      qualificationHarnessAuthorized: false,
      m4ResearchEvidenceRevisionMatched: false,
    })).toBe(true);
  });
});
