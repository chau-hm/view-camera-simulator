import * as THREE from "three";
import { groundGlassPhysicalCocOrientationErrorModuloPi } from "./groundGlassPhysicalCocContract";

export const GROUND_GLASS_M7D_PHYSICAL_COC_EVIDENCE_REVISION =
  "m7d-physical-coc-evidence-v1" as const;

export const GROUND_GLASS_M7D_REQUIRED_KERNEL_CASE_IDS = [
  "ellipse-circular",
  "ellipse-film-tilt",
  "ellipse-film-swing",
  "ellipse-compound-tilt-swing",
  "ellipse-off-axis",
  "ellipse-negative-principal-angle",
  "ellipse-near-pi-orientation",
  "ellipse-near-circular",
  "storage-exact-zero",
  "storage-small-positive-coc",
  "storage-small-negative-coc",
  "storage-0.1mm-reference",
  "storage-near-binary16-maximum",
  "storage-overrange-positive-coc",
  "storage-overrange-negative-coc",
  "storage-overrange-ellipse-radius",
  "invalid-geometry-lens-basis",
] as const;

export const GROUND_GLASS_M7D_REQUIRED_SCENARIO_IDS = [
  "native-r187-physical-kernel",
  "real-scene-depth-reconstruction",
  "native-storage-and-validity",
  "optional-pass-failure-raw-preservation",
  "stale-readback-after-resize",
  "stale-readback-after-unmount",
  "m5-m6-isolation",
  "production-webgl-isolation",
] as const;

export type GroundGlassM7dEvidenceIssue = Readonly<{
  code: string;
  path: string;
  detail: string;
}>;

export type GroundGlassM7dCaptureEvaluation = Readonly<{
  status: "passed" | "failed";
  evidenceRevision: typeof GROUND_GLASS_M7D_PHYSICAL_COC_EVIDENCE_REVISION;
  requiredKernelCaseCount: number;
  observedKernelCaseCount: number;
  requiredSceneProbeCount: number;
  observedSceneProbeCount: number;
  maximumCpuToTslErrorMm: number | null;
  maximumOrientationErrorRad: number | null;
  issues: readonly GroundGlassM7dEvidenceIssue[];
}>;

export type GroundGlassM7dReportEvaluation = Readonly<{
  status: "passed" | "failed";
  computedCounts: Readonly<Record<"passed" | "failed" | "blocked" | "not-run", number>>;
  issues: readonly GroundGlassM7dEvidenceIssue[];
}>;

type UnknownRecord = Record<string, unknown>;

const record = (value: unknown): UnknownRecord | null =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as UnknownRecord
    : null;

const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const nonEmpty = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
const finiteTuple = (value: unknown, length: number): value is number[] =>
  Array.isArray(value) && value.length === length && value.every(finite);
const branchFromCode = (code: unknown): string | null => {
  switch (code) {
    case 1: return "finite-virtual";
    case 2: return "parallel-limit";
    case 3: return "finite-real";
    case 0: return "unresolved";
    default: return null;
  }
};

const expectedControlledBranches: Readonly<Record<string, number>> = {
  "controlled-u-f-minus-0.01": 1,
  "controlled-u-f-minus-0.001": 1,
  "controlled-u-f-exact-unresolved": 0,
  "controlled-u-f-exact-authorized": 2,
  "controlled-u-f-plus-0.001": 3,
  "controlled-u-f-plus-0.01": 3,
};

const requiredSceneProbeIds = [
  "near-foreground-plinth",
  "far-street-sign-face",
  "off-axis-midground-checker",
  "asymmetric-sign-edge",
  "far-focus-chart-cell",
] as const;

const requireIssue = (
  issues: GroundGlassM7dEvidenceIssue[],
  code: string,
  path: string,
  detail: string,
) => issues.push({ code, path, detail });

/**
 * Validate a native app capture without accepting the test label as runtime
 * evidence. The capture retains the full native readbacks plus the independent
 * CPU references and host accepted-frame result.
 */
export const evaluateGroundGlassM7dPhysicalCocCapture = (
  input: unknown,
): GroundGlassM7dCaptureEvaluation => {
  const issues: GroundGlassM7dEvidenceIssue[] = [];
  const capture = record(input);
  const issue = (code: string, path: string, detail: string) => requireIssue(issues, code, path, detail);
  if (!capture) {
    issue("capture-shape", "$", "capture must be a JSON object");
    return {
      status: "failed",
      evidenceRevision: GROUND_GLASS_M7D_PHYSICAL_COC_EVIDENCE_REVISION,
      requiredKernelCaseCount: GROUND_GLASS_M7D_REQUIRED_KERNEL_CASE_IDS.length,
      observedKernelCaseCount: 0,
      requiredSceneProbeCount: requiredSceneProbeIds.length,
      observedSceneProbeCount: 0,
      maximumCpuToTslErrorMm: null,
      maximumOrientationErrorRad: null,
      issues,
    };
  }

  if (capture.threeRevision !== "187") issue("renderer-revision", "threeRevision", "expected Three.js revision 187");
  if (capture.sceneId !== "architecture-rise") issue("scene-identity", "sceneId", "M4 evidence is scoped to Architecture Rise");
  if (capture.sceneSourceRevision !== "architecture-rise-raw-rtt-v1") {
    issue("source-identity", "sceneSourceRevision", "scene source revision does not match the authorized M3 source identity");
  }
  const compatibilityEvidence = record(capture.m4CompatibilityEvidence);
  const compatibilityRuntime = record(compatibilityEvidence?.testedContext);
  if (!compatibilityEvidence || compatibilityEvidence.status !== "research-only" ||
      compatibilityEvidence.feature !== "physical-coc" ||
      compatibilityEvidence.evidenceRevision !== "m4-architecture-rise-physical-coc-native-r187-v1" ||
      compatibilityEvidence.sourceRevision !== capture.sceneSourceRevision ||
      compatibilityRuntime?.rendererFamily !== "webgpu-renderer" ||
      compatibilityRuntime.executionApi !== "webgpu" ||
      compatibilityRuntime.rendererRevision !== "r187") {
    issue("revision-evidence", "m4CompatibilityEvidence", "capture requires the exact research-only r187 M4 evidence record");
  }
  if (capture.rendererFamily !== "webgpu-renderer") issue("renderer-family", "rendererFamily", "native WebGPU renderer family was not observed");
  if (capture.actualExecutionApi !== "webgpu") issue("execution-api", "actualExecutionApi", "native WebGPU execution is required; internal WebGL2 is not native evidence");
  if (capture.internalFallback !== "none") issue("internal-fallback", "internalFallback", "WebGPURenderer internal fallback must be none");
  if (!nonEmpty(capture.browserVersion) || capture.browserVersion === "unknown") {
    issue("runtime-provenance", "browserVersion", "browser version is required");
  }
  if (!nonEmpty(capture.operatingSystem) || capture.operatingSystem === "unknown") {
    issue("runtime-provenance", "operatingSystem", "OS/runtime environment is required");
  }
  if (capture.testProject !== "chrome-native-webgpu") {
    issue("test-project", "testProject", "capture must come from chrome-native-webgpu");
  }
  if (!nonEmpty(capture.testInvocation) || capture.testInvocation === "missing") {
    issue("capture-provenance", "testInvocation", "exact native test invocation is required");
  }
  if (typeof capture.sourceSha !== "string" || !/^[0-9a-f]{40}$/.test(capture.sourceSha)) {
    issue("capture-provenance", "sourceSha", "capture source SHA must be a full 40-character commit SHA");
  }
  const authorization = record(capture.trustedDevelopmentAuthorization);
  for (const key of ["nativeRequired", "rawPilotRequest", "physicalCocResearchBuildFlag", "r187QualificationFlag", "testSeamFlag"]) {
    if (authorization?.[key] !== true) {
      issue("authorization", `trustedDevelopmentAuthorization.${key}`, "trusted native M4 qualification authorization was not recorded");
    }
  }

  const readback = record(capture.probeReadback);
  if (!readback) {
    issue("readback-shape", "probeReadback", "native probe readback is required");
  }
  const activeReadback = readback ?? {};
  if (activeReadback.rendererFamily !== "webgpu-renderer") issue("renderer-family", "probeReadback.rendererFamily", "mounted readback renderer family disagrees with the capture");
  if (activeReadback.actualExecutionApi !== "webgpu") issue("execution-api", "probeReadback.actualExecutionApi", "mounted readback did not observe native WebGPU");
  if (activeReadback.internalFallback !== "none") issue("internal-fallback", "probeReadback.internalFallback", "mounted readback reports an internal fallback");
  if (activeReadback.sceneId !== capture.sceneId) issue("scene-identity", "probeReadback.sceneId", "readback scene disagrees with the capture scene");
  if (!nonEmpty(activeReadback.requestId) || !nonEmpty(activeReadback.channelId) || !nonEmpty(activeReadback.rendererGenerationId)) {
    issue("request-identity", "probeReadback", "request, channel, and renderer-generation identities are required");
  }
  if (!finite(activeReadback.widthPx) || activeReadback.widthPx < 1 ||
      !finite(activeReadback.heightPx) || activeReadback.heightPx < 1) {
    issue("target-size", "probeReadback", "positive native target dimensions are required");
  }
  if (activeReadback.depthFormat !== "depth24plus" ||
      activeReadback.cocStorageFormat !== "rgba16float" ||
      activeReadback.validityStorageFormat !== "rgba8unorm") {
    issue("target-storage", "probeReadback", "observed depth24plus, rgba16float, and rgba8unorm formats are required");
  }

  const acceptedFrame = record(capture.acceptedHostFrameResult);
  if (!acceptedFrame || acceptedFrame.kind !== "host-frame-result" || acceptedFrame.acceptedByHost !== true) {
    issue("host-frame-acceptance", "acceptedHostFrameResult", "current physical readback must correspond to an observed host-accepted completed frame");
  } else {
    if (!nonEmpty(acceptedFrame.hostId)) issue("host-frame-acceptance", "acceptedHostFrameResult.hostId", "host identity is required");
    if (acceptedFrame.requestId !== activeReadback.requestId ||
        acceptedFrame.channelId !== activeReadback.channelId ||
        acceptedFrame.sceneId !== activeReadback.sceneId ||
        acceptedFrame.generationId !== activeReadback.rendererGenerationId ||
        acceptedFrame.latestAcceptedRequestId !== activeReadback.requestId ||
        acceptedFrame.activeGenerationId !== activeReadback.rendererGenerationId ||
        acceptedFrame.activeRendererFamily !== "webgpu-renderer" ||
        acceptedFrame.frameStatus !== "completed") {
      issue("request-identity", "acceptedHostFrameResult", "host event identity or current-request acceptance disagrees with the mounted M4 readback");
    }
  }
  if (capture.probeSummary && record(capture.probeSummary)?.requestId !== activeReadback.requestId) {
    issue("stale-readback", "probeSummary.requestId", "summary publication must match the observed readback request");
  }

  let observedSceneProbeCount = 0;
  const samples = Array.isArray(activeReadback.samples) ? activeReadback.samples.map(record) : [];
  const sampleById = new Map<string, UnknownRecord>();
  for (const sample of samples) {
    if (!sample || !nonEmpty(sample.id)) continue;
    if (sampleById.has(sample.id)) issue("duplicate-probe", `probeReadback.samples.${sample.id}`, "probe identities must be unique");
    sampleById.set(sample.id, sample);
  }
  for (const id of requiredSceneProbeIds) {
    const sample = sampleById.get(id);
    if (!sample) {
      issue("missing-probe", `probeReadback.samples.${id}`, "required registered Architecture Rise surface probe is missing");
      continue;
    }
    observedSceneProbeCount += 1;
    if (!nonEmpty(sample.expectedSurfaceId) || !finiteTuple(sample.expectedWorldM, 3) ||
        !finiteTuple(sample.reconstructedWorldM, 3)) {
      issue("depth-reference", `probeReadback.samples.${id}`, "independent surface identity and expected/reconstructed world points are required");
      continue;
    }
    const worldErrorMm = Math.hypot(
      (sample.reconstructedWorldM[0]! - sample.expectedWorldM[0]!) * 1000,
      (sample.reconstructedWorldM[1]! - sample.expectedWorldM[1]!) * 1000,
      (sample.reconstructedWorldM[2]! - sample.expectedWorldM[2]!) * 1000,
    );
    if (!finite(worldErrorMm) || worldErrorMm > 25) {
      issue("depth-reconstruction", `probeReadback.samples.${id}.reconstructedWorldM`, "world reconstruction error exceeds 25 mm");
    }
    if (sample.validityCode !== 1) issue("validity", `probeReadback.samples.${id}.validityCode`, "visible surface must have valid physical data");
    const confidence = record(sample.depthConfidence);
    if (confidence?.status !== "resolved" || confidence.scope !== "probe-only") {
      issue("depth-confidence", `probeReadback.samples.${id}.depthConfidence`, "paired visible surface probe must report probe-only resolved confidence");
    } else if (confidence.canonicalExpectedBranch !== confidence.reconstructedBranch ||
        confidence.reconstructedBranch !== confidence.kernelSelectedBranch ||
        confidence.surfaceId !== sample.expectedSurfaceId) {
      issue("depth-confidence", `probeReadback.samples.${id}.depthConfidence`, "resolved focal branches and surface identity must agree");
    }
    const focalCodeBranch = branchFromCode(sample.focalBranchCode);
    if (focalCodeBranch !== confidence?.kernelSelectedBranch) {
      issue("focal-branch", `probeReadback.samples.${id}.focalBranchCode`, "kernel focal branch disagrees with the independent depth-confidence probe");
    }
    if (!finiteTuple(sample.storedFootprintMm, 4)) {
      issue("storage-readback", `probeReadback.samples.${id}.storedFootprintMm`, "visible real-scene physical storage readback is required");
    }
  }

  const exactDepthReadback = record(capture.depthDerivedExactFocalReadback);
  const exactDepthSamples = Array.isArray(exactDepthReadback?.samples)
    ? exactDepthReadback.samples.map(record)
    : [];
  const exactDepth = exactDepthSamples[0] ?? null;
  if (!exactDepthReadback || !exactDepth || exactDepth.id !== "depth-derived-canonical-u-f-no-parallel-authority") {
    issue("missing-probe", "depthDerivedExactFocalReadback", "separate depth-derived focal-boundary control is required");
  } else {
    if (exactDepthReadback.sceneId !== activeReadback.sceneId ||
        exactDepthReadback.channelId !== activeReadback.channelId ||
        exactDepthReadback.rendererGenerationId !== activeReadback.rendererGenerationId ||
        exactDepthReadback.actualExecutionApi !== "webgpu" || exactDepthReadback.internalFallback !== "none") {
      issue("request-identity", "depthDerivedExactFocalReadback", "focal-boundary readback must belong to the same current native generation and channel");
    }
    const confidence = record(exactDepth.depthConfidence);
    if (!confidence || exactDepth.controlledObjectPoint !== false || confidence.status !== "depth-limited" ||
        confidence.scope !== "probe-only" || confidence.canonicalExpectedBranch !== "parallel-limit") {
      issue("depth-confidence", "probeReadback.samples.depth-derived-canonical-u-f-no-parallel-authority", "scene-depth exact-U=f probe must remain depth-limited and cannot claim parallel-limit authority");
    } else if (!finite(confidence.canonicalUMinusFmm) || Math.abs(confidence.canonicalUMinusFmm) > 1e-7 ||
      exactDepth.focalBranchCode === 2 || confidence.kernelSelectedBranch === "parallel-limit") {
      issue("focal-branch", "probeReadback.samples.depth-derived-canonical-u-f-no-parallel-authority", "rounded depth cannot establish the exact parallel-image limit");
    }
  }
  const exactDepthHostFrame = record(capture.depthDerivedExactFocalHostFrameResult);
  if (!exactDepthReadback || !exactDepthHostFrame || exactDepthHostFrame.kind !== "host-frame-result" ||
      exactDepthHostFrame.acceptedByHost !== true || exactDepthHostFrame.requestId !== exactDepthReadback.requestId ||
      exactDepthHostFrame.channelId !== exactDepthReadback.channelId || exactDepthHostFrame.sceneId !== exactDepthReadback.sceneId ||
      exactDepthHostFrame.generationId !== exactDepthReadback.rendererGenerationId ||
      exactDepthHostFrame.latestAcceptedRequestId !== exactDepthReadback.requestId ||
      exactDepthHostFrame.activeGenerationId !== exactDepthReadback.rendererGenerationId) {
    issue("host-frame-acceptance", "depthDerivedExactFocalHostFrameResult", "depth-boundary readback must have its own current host-accepted frame result");
  }

  const unreferenced = sampleById.get("unreferenced-visible-surface-pixel");
  if (!unreferenced || record(unreferenced.depthConfidence)?.status !== "not-assessed" ||
      record(unreferenced.depthConfidence)?.reason !== "no-independent-reference") {
    issue("depth-confidence", "probeReadback.samples.unreferenced-visible-surface-pixel", "confidence must remain not-assessed without an independent reference");
  }
  const backgrounds = [...sampleById.values()].filter((sample) => typeof sample.id === "string" && sample.id.startsWith("background-"));
  const clearBackgrounds = backgrounds.filter((sample) => sample.validityCode === 0);
  if (backgrounds.length !== 3 || clearBackgrounds.length < 1) {
    issue("clear-depth", "probeReadback.samples.background-*", "three bounded background candidates and at least one clear-depth sample are required");
  }
  for (const sample of clearBackgrounds) {
    if (sample.depth !== 1 || !finiteTuple(sample.storedFootprintMm, 4) || sample.storedFootprintMm.some((value) => value !== 0)) {
      issue("clear-depth", `probeReadback.samples.${String(sample.id)}`, "clear depth must publish validity 0 and zero physical storage");
    }
  }

  const observedControlled = Array.isArray(activeReadback.controlledKernelCases)
    ? activeReadback.controlledKernelCases.map(record)
    : [];
  const references = Array.isArray(capture.controlledKernelReferences)
    ? capture.controlledKernelReferences.map(record)
    : [];
  const actualById = new Map<string, UnknownRecord>();
  for (const item of observedControlled) {
    if (!item || !nonEmpty(item.id)) continue;
    if (actualById.has(item.id)) issue("duplicate-kernel-case", `probeReadback.controlledKernelCases.${item.id}`, "controlled case identities must be unique");
    actualById.set(item.id, item);
  }
  const referenceById = new Map<string, UnknownRecord>();
  for (const reference of references) {
    if (!reference || !nonEmpty(reference.id)) continue;
    if (referenceById.has(reference.id)) issue("duplicate-cpu-reference", `controlledKernelReferences.${reference.id}`, "CPU reference identities must be unique");
    referenceById.set(reference.id, reference);
  }
  for (const item of observedControlled) {
    if (item && nonEmpty(item.id) && !(GROUND_GLASS_M7D_REQUIRED_KERNEL_CASE_IDS as readonly string[]).includes(item.id)) {
      issue("unexpected-kernel-case", `probeReadback.controlledKernelCases.${item.id}`, "unexpected controlled kernel identity");
    }
  }

  let maximumCpuToTslErrorMm = 0;
  let maximumOrientationErrorRad = 0;
  for (const id of GROUND_GLASS_M7D_REQUIRED_KERNEL_CASE_IDS) {
    const actual = actualById.get(id);
    const reference = referenceById.get(id);
    if (!actual) {
      issue("missing-kernel-case", `probeReadback.controlledKernelCases.${id}`, "required controlled kernel case is missing");
      continue;
    }
    if (!reference) {
      issue("missing-cpu-reference", `controlledKernelReferences.${id}`, "independent CPU reference and source vector are required");
      continue;
    }
    const testCase = record(reference.testCase);
    const probe = record(testCase?.probe);
    const override = record(testCase?.kernelOverride);
    const cpu = record(reference.cpuReference);
    if (testCase?.id !== id || !probe || !override || !cpu || !finiteTuple(probe.controlledObjectPointMm, 3)) {
      issue("cpu-reference-shape", `controlledKernelReferences.${id}`, "controlled input vector, kernel override, and CPU reference are required");
      continue;
    }
    if (actual.probeId !== probe.id) {
      issue("kernel-probe-identity", `probeReadback.controlledKernelCases.${id}.probeId`, "GPU result is not paired with its recorded controlled input");
    }
    if (typeof cpu.valid !== "boolean" || !finite(cpu.signedCoCDiameterMm) ||
        !finite(cpu.majorRadiusMm) || !finite(cpu.minorRadiusMm) || !finite(cpu.orientationRad)) {
      issue("cpu-reference", `controlledKernelReferences.${id}.cpuReference`, "CPU reference must contain finite millimetre values and validity");
      continue;
    }
    const calculated = actual.calculatedFootprintMm;
    if (!finiteTuple(calculated, 4)) {
      issue("kernel-numeric", `probeReadback.controlledKernelCases.${id}.calculatedFootprintMm`, "calculated TSL values must be finite");
      continue;
    }
    if (actual.storageFormat !== "rgba16float") {
      issue("storage-format", `probeReadback.controlledKernelCases.${id}.storageFormat`, "actual diagnostic target must be rgba16float");
    }
    const sourceValues = [cpu.signedCoCDiameterMm, cpu.majorRadiusMm, cpu.minorRadiusMm];
    const actualValues = [calculated[0]!, calculated[1]!, calculated[2]!];
    const valueErrors = actualValues.map((value, index) => Math.abs(value - sourceValues[index]!));
    maximumCpuToTslErrorMm = Math.max(maximumCpuToTslErrorMm, ...valueErrors);
    if (!valueErrors.every((error, index) => error <= Math.max(0.0005, Math.abs(sourceValues[index]!) * 0.00002))) {
      issue("kernel-comparison", `probeReadback.controlledKernelCases.${id}.calculatedFootprintMm`, "CPU/TSL error exceeds the frozen 0.0005 mm / 0.002% tolerance");
    }
    if (calculated[1]! < calculated[2]! || calculated[2]! < 0) {
      issue("ellipse-axes", `probeReadback.controlledKernelCases.${id}.calculatedFootprintMm`, "major/minor ellipse axes are swapped or invalid");
    }
    if (Math.abs(cpu.signedCoCDiameterMm) >= 0.001 && Math.sign(calculated[0]!) !== Math.sign(cpu.signedCoCDiameterMm)) {
      issue("signed-coc", `probeReadback.controlledKernelCases.${id}.calculatedFootprintMm[0]`, "signed CoC side differs from the CPU reference");
    }
    if (calculated[3]! < 0 || calculated[3]! >= 1) {
      issue("orientation-encoding", `probeReadback.controlledKernelCases.${id}.calculatedFootprintMm[3]`, "orientation storage must be normalized to [0,1)");
    }
    const orientationDefined = cpu.valid && cpu.majorRadiusMm - cpu.minorRadiusMm > 1e-7;
    if (orientationDefined) {
      const orientationError = groundGlassPhysicalCocOrientationErrorModuloPi(
        calculated[3]! * Math.PI,
        cpu.orientationRad,
      );
      if (orientationError === null) {
        issue("orientation-encoding", `probeReadback.controlledKernelCases.${id}.calculatedFootprintMm[3]`, "orientation modulo pi is not finite");
      } else {
        maximumOrientationErrorRad = Math.max(maximumOrientationErrorRad, orientationError);
        if (orientationError >= 0.003) issue("orientation-error", `probeReadback.controlledKernelCases.${id}.calculatedFootprintMm[3]`, "orientation modulo-pi error exceeds 0.003 rad");
      }
    } else if (calculated[3] !== 0 || (cpu.valid && actual.orientationDefined !== false)) {
      issue("orientation-encoding", `probeReadback.controlledKernelCases.${id}`, "near-circular ellipse must use undefined deterministic orientation zero");
    }
    if (id.startsWith("ellipse-film-") || id === "ellipse-compound-tilt-swing" || id === "ellipse-off-axis") {
      if (cpu.majorRadiusMm - cpu.minorRadiusMm <= 1e-5) {
        issue("ellipse-axes", `controlledKernelReferences.${id}.cpuReference`, "tilt, swing, compound, and off-axis controls must produce anisotropic footprints");
      }
    }
    if (id === "ellipse-circular" && Math.abs(cpu.majorRadiusMm - cpu.minorRadiusMm) > 1e-7) {
      issue("ellipse-axes", `controlledKernelReferences.${id}.cpuReference`, "symmetric circular control must remain circular");
    }
    if (id === "ellipse-negative-principal-angle" &&
        !(finite(actual.orientationPrincipalAngleRad) && actual.orientationPrincipalAngleRad < 0 && calculated[3]! > 0.9)) {
      issue("orientation-encoding", `probeReadback.controlledKernelCases.${id}`, "negative principal-angle control must retain its negative angle and modulo-pi encoding");
    }
    if (id === "ellipse-near-pi-orientation" && calculated[3]! <= 0.99) {
      issue("orientation-encoding", `probeReadback.controlledKernelCases.${id}`, "near-pi orientation control must remain close to the modulo-pi boundary");
    }

    const validity = actual.validityCode;
    const overflow = Math.abs(cpu.signedCoCDiameterMm) > 65504 || cpu.majorRadiusMm > 65504 || cpu.minorRadiusMm > 65504;
    const expectedValidity = !cpu.valid ? 3 : overflow ? 2 : 1;
    if (validity !== expectedValidity) {
      issue("validity", `probeReadback.controlledKernelCases.${id}.validityCode`, `expected M4 validity code ${expectedValidity}, observed ${String(validity)}`);
    }
    const bits = actual.storedHalfFloatBits;
    const decoded = actual.readbackFootprintMm;
    const sampled = actual.sampledFootprintMm;
    if (!finiteTuple(bits, 4) || !finiteTuple(decoded, 4) || !finiteTuple(sampled, 4) ||
        bits.some((value) => !Number.isInteger(value) || value < 0 || value > 65535)) {
      issue("storage-readback", `probeReadback.controlledKernelCases.${id}`, "actual half bits, decoded storage, and GPU sampled value are required");
      continue;
    }
    const mustStoreZero = expectedValidity === 2 || expectedValidity === 3;
    for (let channel = 0; channel < 4; channel += 1) {
      const decodedFromBits = THREE.DataUtils.fromHalfFloat(bits[channel]!);
      if (decoded[channel] !== decodedFromBits) {
        issue("storage-decode", `probeReadback.controlledKernelCases.${id}.readbackFootprintMm[${channel}]`, "decoded RGBA16F value does not match the observed binary16 bit pattern");
      }
      if (Math.abs(sampled[channel]! - decoded[channel]!) > Math.max(0.0001, Math.abs(decoded[channel]!) * 1e-6)) {
        issue("storage-sample", `probeReadback.controlledKernelCases.${id}.sampledFootprintMm[${channel}]`, "GPU sampled decode does not match the stored RGBA16F value");
      }
      if (mustStoreZero) {
        if (bits[channel] !== 0 || decoded[channel] !== 0 || sampled[channel] !== 0) {
          issue("storage-overflow", `probeReadback.controlledKernelCases.${id}`, "invalid or over-range values must fail closed to zero storage");
        }
      } else {
        if (bits[channel] !== THREE.DataUtils.toHalfFloat(calculated[channel]!)) {
          issue("storage-binary16", `probeReadback.controlledKernelCases.${id}.storedHalfFloatBits[${channel}]`, "observed RGBA16F bits differ from Three.js binary16 rounding");
        }
      }
    }
    if (orientationDefined && !mustStoreZero) {
      const storedOrientationError = groundGlassPhysicalCocOrientationErrorModuloPi(
        decoded[3]! * Math.PI,
        cpu.orientationRad,
      );
      if (storedOrientationError === null || storedOrientationError >= 0.003) {
        issue("orientation-error", `probeReadback.controlledKernelCases.${id}.readbackFootprintMm[3]`, "decoded RGBA16F orientation modulo-pi error exceeds 0.003 rad");
      }
    }
    if (id.startsWith("storage-overrange-") && validity !== 2) {
      issue("storage-overflow", `probeReadback.controlledKernelCases.${id}.validityCode`, "over-range physical data must use validity code 2");
    }
    if (id === "storage-near-binary16-maximum" && validity !== 1) {
      issue("storage-overflow", `probeReadback.controlledKernelCases.${id}.validityCode`, "representable near-maximum binary16 data must remain valid");
    }
    if (id === "storage-small-positive-coc" && !(calculated[0]! > 0 && Math.abs(calculated[0]!) < 0.02)) {
      issue("signed-coc", `probeReadback.controlledKernelCases.${id}`, "small positive CoC vector lost its sign or magnitude");
    }
    if (id === "storage-small-negative-coc" && !(calculated[0]! < 0 && Math.abs(calculated[0]!) < 0.02)) {
      issue("signed-coc", `probeReadback.controlledKernelCases.${id}`, "small negative CoC vector lost its sign or magnitude");
    }
    if (id === "storage-exact-zero" && Math.abs(calculated[0]!) > 0.0005) {
      issue("kernel-comparison", `probeReadback.controlledKernelCases.${id}`, "exact-zero CoC control is not zero within the frozen absolute tolerance");
    }
    if (id === "storage-0.1mm-reference" && Math.abs(Math.abs(calculated[0]!) - 0.1) > 0.0005) {
      issue("kernel-comparison", `probeReadback.controlledKernelCases.${id}`, "0.1 mm controlled CoC reference is outside the frozen absolute tolerance");
    }
    const branchCase = expectedControlledBranches[id];
    if (branchCase !== undefined && actual.focalBranchCode !== branchCase) {
      issue("focal-branch", `probeReadback.controlledKernelCases.${id}.focalBranchCode`, `expected controlled focal branch ${branchCase}`);
    }
  }

  for (const id of Object.keys(expectedControlledBranches)) {
    const sample = sampleById.get(id);
    const expectedBranch = expectedControlledBranches[id];
    if (!sample) {
      issue("missing-probe", `probeReadback.samples.${id}`, "controlled focal-boundary sample is missing");
    } else if (sample.focalBranchCode !== expectedBranch) {
      issue("focal-branch", `probeReadback.samples.${id}.focalBranchCode`, `expected controlled branch ${String(expectedBranch)}`);
    }
  }

  return {
    status: issues.length === 0 ? "passed" : "failed",
    evidenceRevision: GROUND_GLASS_M7D_PHYSICAL_COC_EVIDENCE_REVISION,
    requiredKernelCaseCount: GROUND_GLASS_M7D_REQUIRED_KERNEL_CASE_IDS.length,
    observedKernelCaseCount: actualById.size,
    requiredSceneProbeCount: requiredSceneProbeIds.length,
    observedSceneProbeCount,
    maximumCpuToTslErrorMm: Number.isFinite(maximumCpuToTslErrorMm) ? maximumCpuToTslErrorMm : null,
    maximumOrientationErrorRad: Number.isFinite(maximumOrientationErrorRad) ? maximumOrientationErrorRad : null,
    issues,
  };
};

/** Validate declared inventory and count metadata for the independent M7D report. */
export const evaluateGroundGlassM7dPhysicalCocReport = (
  input: unknown,
): GroundGlassM7dReportEvaluation => {
  const issues: GroundGlassM7dEvidenceIssue[] = [];
  const report = record(input);
  const issue = (code: string, path: string, detail: string) => requireIssue(issues, code, path, detail);
  const statuses = ["passed", "failed", "blocked", "not-run"] as const;
  const computedCounts = { passed: 0, failed: 0, blocked: 0, "not-run": 0 };
  if (!report) {
    issue("report-shape", "$", "report must be a JSON object");
  } else {
    if (report.reportId !== "ground-glass-m7d-r187-physical-coc") issue("report-identity", "reportId", "unexpected M7D report identity");
    if (report.evaluatorRevision !== GROUND_GLASS_M7D_PHYSICAL_COC_EVIDENCE_REVISION) {
      issue("evaluator-revision", "evaluatorRevision", "report/evaluator revision mismatch");
    }
    const inventory = Array.isArray(report.scenarios) ? report.scenarios.map(record) : [];
    const ids = new Set<string>();
    for (const scenario of inventory) {
      if (!scenario || !nonEmpty(scenario.id)) {
        issue("scenario-identity", "scenarios", "each scenario requires a stable identity");
        continue;
      }
      if (!(GROUND_GLASS_M7D_REQUIRED_SCENARIO_IDS as readonly string[]).includes(scenario.id)) {
        issue("unexpected-scenario", `scenarios.${scenario.id}`, "unexpected M7D scenario identity");
      }
      if (ids.has(scenario.id)) issue("duplicate-scenario", `scenarios.${scenario.id}`, "scenario identities must be unique");
      ids.add(scenario.id);
      if (!(statuses as readonly unknown[]).includes(scenario.status)) {
        issue("scenario-status", `scenarios.${scenario.id}.status`, "scenario status must be passed, failed, blocked, or not-run");
      } else {
        computedCounts[scenario.status as keyof typeof computedCounts] += 1;
      }
      if (!nonEmpty(scenario.capture) || typeof scenario.sourceSha !== "string" ||
          !/^[0-9a-f]{40}$/.test(scenario.sourceSha) || !nonEmpty(scenario.invocation)) {
        issue("capture-provenance", `scenarios.${scenario.id}`, "scenario capture, source SHA, and invocation are required");
      }
      if (scenario.status === "passed" && scenario.evidenceKind === "native") {
        const runtime = record(scenario.runtimeIdentity);
        if (scenario.rendererRevision !== "187" || runtime?.threeRevision !== "187" ||
            runtime.rendererFamily !== "webgpu-renderer" || runtime.actualExecutionApi !== "webgpu" ||
            runtime.internalFallback !== "none" || !nonEmpty(runtime.browserVersion) ||
            !nonEmpty(runtime.operatingSystem) || runtime.sceneId !== "architecture-rise" ||
            !nonEmpty(runtime.channelId) || !nonEmpty(runtime.generationId) ||
            !Array.isArray(runtime.requestIds) || runtime.requestIds.length === 0 ||
            runtime.requestIds.some((requestId) => !nonEmpty(requestId))) {
          issue("runtime-identity", `scenarios.${scenario.id}.runtimeIdentity`, "passed native scenario requires exact r187 native WebGPU scene/request/generation identity");
        }
        const eventEvidence = Array.isArray(scenario.orderedEventEvidence) ? scenario.orderedEventEvidence.map(record) : [];
        if (eventEvidence.length === 0 || eventEvidence.some((entry) => !entry ||
            !nonEmpty(entry.artifact) || !nonEmpty(entry.collection))) {
          issue("event-provenance", `scenarios.${scenario.id}.orderedEventEvidence`, "passed native scenario must reference captured ordered lifecycle/host events");
        } else if (eventEvidence.some((entry) => {
          if (!entry) return false;
          const sequences = entry.sequenceNumbers;
          return !Array.isArray(sequences) || sequences.length === 0 ||
            !sequences.every(finite) ||
            sequences.some((sequence, index) => index > 0 && sequence <= (sequences[index - 1] as number));
        })) {
          issue("event-order", `scenarios.${scenario.id}.orderedEventEvidence`, "captured event sequence numbers must be finite, non-empty, and strictly ordered");
        }
        const supportingArtifacts = Array.isArray(scenario.supportingArtifacts) ? scenario.supportingArtifacts : [];
        if (supportingArtifacts.length === 0 || supportingArtifacts.some((artifact) => !nonEmpty(artifact))) {
          issue("artifact-provenance", `scenarios.${scenario.id}.supportingArtifacts`, "passed native scenario must identify supporting artifacts");
        }
        const knownLimitations = Array.isArray(scenario.knownLimitations) ? scenario.knownLimitations : [];
        if (knownLimitations.length === 0 || knownLimitations.some((limitation) => !nonEmpty(limitation))) {
          issue("known-limitations", `scenarios.${scenario.id}.knownLimitations`, "passed native scenario must declare known limitations");
        }
      }
    }
    for (const id of GROUND_GLASS_M7D_REQUIRED_SCENARIO_IDS) {
      if (!ids.has(id)) issue("missing-scenario", `scenarios.${id}`, "required scenario inventory entry is missing");
    }
    if (inventory.length !== GROUND_GLASS_M7D_REQUIRED_SCENARIO_IDS.length) {
      issue("scenario-count", "scenarios", "scenario inventory count must exactly match the required M7D inventory");
    }
    const declared = record(report.counts);
    if (!declared || statuses.some((status) => declared[status] !== computedCounts[status])) {
      issue("report-counts", "counts", "declared scenario counts do not match the computed inventory");
    }
    if (report.m4ResearchEvidenceRevision !== "m4-architecture-rise-physical-coc-native-r187-v1") {
      issue("revision-evidence", "m4ResearchEvidenceRevision", "exact r187 M4 research evidence revision is required");
    }
    if (report.m5M6Authorization !== "denied") issue("feature-boundary", "m5M6Authorization", "r187 M5/M6 authorization must remain denied");
    if (report.productionGroundGlassBackend !== "webgl-only") issue("production-isolation", "productionGroundGlassBackend", "production Ground Glass must remain WebGL-only");
  }
  return { status: issues.length === 0 ? "passed" : "failed", computedCounts, issues };
};
