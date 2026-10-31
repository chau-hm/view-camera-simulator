import { REVISION } from "three";
import type { GroundGlassFrameRequestInput } from "../groundGlassFrameRequest";
import type { GroundGlassSceneCompatibility } from "../backend/groundGlassSceneCompatibility";
import {
  isGroundGlassRawWebGpuPilotBuildEnabled,
  isGroundGlassRawWebGpuPilotRequest,
} from "./groundGlassRawWebGpuPolicyInput";
import {
  GROUND_GLASS_M6_PRESENTATION_COMPATIBILITY,
  isGroundGlassM6CapablePilotSessionForBuild,
  isGroundGlassM6PresentationBuildEnabled,
  isGroundGlassM6PresentationRequest,
} from "./groundGlassM6PresentationPolicy";
import {
  ARCHITECTURE_RISE_RAW_RTT_SOURCE_REVISION,
  resolveGroundGlassRawWebGpuCompatibility,
} from "./groundGlassRawWebGpuCompatibility";

export type GroundGlassPhysicalCocQualificationBuildFlags = Readonly<{
  developmentBuild: boolean;
  rawPilotFlag: string | undefined;
  physicalCocResearchFlag: string | undefined;
  testSeamFlag: string | undefined;
  qualificationFlag: string | undefined;
}>;

/** This exception opens the M4 pass only inside the explicit r187 qualification harness. */
export const isGroundGlassPhysicalCocQualificationBuildAuthorizedForFlags = (
  flags: GroundGlassPhysicalCocQualificationBuildFlags,
  rendererRevision: string,
): boolean => flags.developmentBuild &&
  rendererRevision === "187" &&
  flags.rawPilotFlag === "true" &&
  flags.physicalCocResearchFlag === "true" &&
  flags.testSeamFlag === "true" &&
  flags.qualificationFlag === "true";

/** Research-only M4 evidence must still identify the renderer revision being executed. */
export const isGroundGlassPhysicalCocResearchEvidenceRevisionMatched = (
  compatibility: GroundGlassSceneCompatibility | null,
  rendererRevision: string,
): boolean => {
  const feature = compatibility?.features.find((candidate) => candidate.feature === "physical-coc");
  return Boolean(
    compatibility?.sceneId === "architecture-rise" &&
    compatibility.sourceRevision === ARCHITECTURE_RISE_RAW_RTT_SOURCE_REVISION &&
    feature?.status === "research-only" &&
    feature.sourceRevision === compatibility.sourceRevision &&
    feature.evidenceRevision.trim().length > 0 &&
    feature.testedContext.rendererFamily === "webgpu-renderer" &&
    feature.testedContext.executionApi === "webgpu" &&
    feature.testedContext.rendererRevision === rendererRevision,
  );
};

/** M6 may provision its dependent M4 inputs only when every M6 record matches this renderer. */
export const isGroundGlassM6PresentationRevisionMatched = (
  compatibility: GroundGlassSceneCompatibility,
  rendererRevision: string,
): boolean => compatibility.features.length > 0 &&
  compatibility.features.some((feature) => feature.feature === "physical-coc") &&
  compatibility.features.every((feature) =>
    feature.status === "implementation-verified" &&
    feature.sourceRevision === compatibility.sourceRevision &&
    feature.testedContext.rendererRevision === rendererRevision,
  );

export type GroundGlassPhysicalCocResearchPolicyInput = Readonly<{
  m6PresentationRequest: boolean;
  m6CompatibilityRevisionMatched: boolean;
  developmentBuild: boolean;
  rawPilotBuildAuthorized: boolean;
  physicalCocResearchBuildEnabled: boolean;
  rawPilotRequest: boolean;
  m4ResearchEvidenceRevisionMatched: boolean;
  qualificationHarnessAuthorized: boolean;
}>;

/** Pure decision contract keeps M4 research separate from renderer selection evidence. */
export const isGroundGlassPhysicalCocResearchEnabledForPolicy = (
  input: GroundGlassPhysicalCocResearchPolicyInput,
): boolean => input.m6PresentationRequest
  ? input.m6CompatibilityRevisionMatched
  : (
  input.developmentBuild &&
  input.rawPilotBuildAuthorized &&
  input.physicalCocResearchBuildEnabled &&
  input.rawPilotRequest &&
  (input.m4ResearchEvidenceRevisionMatched || input.qualificationHarnessAuthorized)
  );

export type GroundGlassPhysicalCocProvisioningPolicyInput = GroundGlassPhysicalCocResearchPolicyInput & Readonly<{
  m6CapableSession: boolean;
}>;

export const isGroundGlassPhysicalCocProvisioningEnabledForPolicy = (
  input: GroundGlassPhysicalCocProvisioningPolicyInput,
): boolean => input.m6CapableSession
  ? input.m6CompatibilityRevisionMatched
  : isGroundGlassPhysicalCocResearchEnabledForPolicy(input);

const m6CompatibilityMatchesInstalledRenderer = (): boolean =>
  isGroundGlassM6PresentationRevisionMatched(
    GROUND_GLASS_M6_PRESENTATION_COMPATIBILITY,
    `r${REVISION}`,
  );

const physicalCocResearchBuildFlags = (): GroundGlassPhysicalCocQualificationBuildFlags => ({
  developmentBuild: import.meta.env.DEV,
  rawPilotFlag: import.meta.env.VITE_GROUND_GLASS_WEBGPU_RAW_PILOT,
  physicalCocResearchFlag: import.meta.env.VITE_GROUND_GLASS_WEBGPU_PHYSICAL_COC_RESEARCH,
  testSeamFlag: import.meta.env.VITE_GROUND_GLASS_WEBGPU_TEST_SEAM,
  qualificationFlag: import.meta.env.VITE_GROUND_GLASS_WEBGPU_PHYSICAL_COC_R187_QUALIFICATION,
});

const qualificationHarnessMatchesInstalledRenderer = (): boolean =>
  isGroundGlassPhysicalCocQualificationBuildAuthorizedForFlags(
    physicalCocResearchBuildFlags(),
    REVISION,
  );

const m4EvidenceMatchesInstalledRenderer = (): boolean =>
  isGroundGlassPhysicalCocResearchEvidenceRevisionMatched(
    resolveGroundGlassRawWebGpuCompatibility(`r${REVISION}`),
    `r${REVISION}`,
  );

const getPhysicalCocResearchPolicyInput = (
  request: GroundGlassFrameRequestInput,
): GroundGlassPhysicalCocResearchPolicyInput => ({
  m6PresentationRequest: isGroundGlassM6PresentationRequest(request),
  m6CompatibilityRevisionMatched: m6CompatibilityMatchesInstalledRenderer(),
  developmentBuild: import.meta.env.DEV,
  rawPilotBuildAuthorized: isGroundGlassRawWebGpuPilotBuildEnabled(),
  physicalCocResearchBuildEnabled:
    import.meta.env.VITE_GROUND_GLASS_WEBGPU_PHYSICAL_COC_RESEARCH === "true",
  rawPilotRequest: isGroundGlassRawWebGpuPilotRequest(request),
  m4ResearchEvidenceRevisionMatched: m4EvidenceMatchesInstalledRenderer(),
  qualificationHarnessAuthorized: qualificationHarnessMatchesInstalledRenderer(),
});

/**
 * M4 is a separately gated research pass inside the already-authorized M3
 * Architecture Rise Raw pilot. The flag is trusted Vite build configuration;
 * URL, storage, and scene metadata cannot activate the physical pass.
 */
export const isGroundGlassPhysicalCocResearchEnabled = (
  request: GroundGlassFrameRequestInput,
): boolean => isGroundGlassPhysicalCocResearchEnabledForPolicy(
  getPhysicalCocResearchPolicyInput(request),
);

/** M6 sessions provision M4 only when the complete M6 evidence set matches this renderer. */
export const isGroundGlassPhysicalCocResourceProvisioningEnabled = (
  request: GroundGlassFrameRequestInput,
): boolean => isGroundGlassPhysicalCocProvisioningEnabledForPolicy({
  ...getPhysicalCocResearchPolicyInput(request),
  m6CapableSession: isGroundGlassM6CapablePilotSessionForBuild(
    request,
    isGroundGlassM6PresentationBuildEnabled(),
    "webgpu",
    "webgpu",
  ),
});
