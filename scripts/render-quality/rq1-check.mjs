import { createHash } from "node:crypto";
import { lstat, readdir, readFile } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { captureBelongsToRun } from "./rq1-capture-provenance.mjs";
import { nativeCaptureStatusErrors } from "./rq1-native-capture-status.mjs";

const repositoryRoot = process.cwd();
const baselineRelative = "docs/render-quality/rq1-baseline";
const workingRelative = {
  rq1: "docs/render-quality/.rq1-runs/current",
  rq2: "docs/render-quality/.rq2-runs/current",
};
const baselineDirectory = resolve(repositoryRoot, baselineRelative);
const REQUIRED_CAMERA_KEYS = [
  "focalLengthMm", "focusDistanceMm", "apertureFNumber", "frontRiseMm", "frontShiftMm",
  "frontTiltDeg", "frontSwingDeg", "rearRiseMm", "rearShiftMm", "rearTiltDeg", "rearSwingDeg",
];

function parseArguments(args) {
  let profile = "rq1";
  let profileWasSet = false;
  let mode = "working";
  let outputDirectory = null;
  let outputWasSet = false;
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--help" || argument === "-h") {
      console.log("Usage: node scripts/render-quality/rq1-check.mjs [--profile rq1|rq2] [--baseline | --output-dir docs/render-quality/<name>]");
      process.exit(0);
    } else if (argument === "--profile" && args[index + 1]) {
      if (profileWasSet) throw new Error("--profile may only be provided once");
      profileWasSet = true;
      profile = args[index + 1];
      index += 1;
      if (!(profile in workingRelative)) throw new Error("--profile must be rq1 or rq2");
      if (mode === "baseline" && profile !== "rq1") throw new Error("--baseline applies only to the rq1 profile");
    } else if (argument === "--baseline") {
      if (profile !== "rq1") throw new Error("--baseline applies only to the rq1 profile");
      if (mode !== "working" || outputWasSet) throw new Error("--baseline cannot be combined with --output-dir or repeated");
      mode = "baseline";
      outputDirectory = baselineDirectory;
    } else if (argument === "--output-dir" && args[index + 1]) {
      if (outputWasSet || mode === "baseline") throw new Error("--output-dir may only be provided once and cannot be combined with --baseline");
      outputWasSet = true;
      const outputArgument = args[index + 1];
      index += 1;
      if (isAbsolute(outputArgument)) throw new Error("--output-dir must be a repository-relative docs/render-quality path");
      outputDirectory = resolve(repositoryRoot, outputArgument);
      const outputRelative = relative(repositoryRoot, outputDirectory);
      if (
        outputRelative === ".." || outputRelative.startsWith(".." + sep) || isAbsolute(outputRelative) ||
        !outputRelative.startsWith(`docs${sep}render-quality${sep}`)
      ) {
        throw new Error("--output-dir must stay under docs/render-quality/");
      }
    } else {
      throw new Error("Usage: npm run render-quality:rq1:check -- [--profile rq1|rq2] [--baseline | --output-dir docs/render-quality/<name>]");
    }
  }
  if (!outputDirectory) outputDirectory = resolve(repositoryRoot, workingRelative[profile]);
  return { profile, mode, outputDirectory };
}

async function assertNoSymlinkPath(outputDirectory) {
  const outputRelative = relative(repositoryRoot, outputDirectory);
  let current = repositoryRoot;
  for (const segment of outputRelative.split(sep)) {
    current = resolve(current, segment);
    try {
      if ((await lstat(current)).isSymbolicLink()) throw new Error("--output-dir may not pass through symlinks");
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") break;
      throw error;
    }
  }
}

const { profile, mode, outputDirectory } = parseArguments(process.argv.slice(2));
if (mode === "working" && outputDirectory === baselineDirectory) {
  throw new Error("Use --baseline to validate the immutable committed RQ1 reference.");
}
await assertNoSymlinkPath(outputDirectory);
const manifestPath = resolve(
  repositoryRoot,
  profile === "rq2"
    ? "docs/render-quality/rq2-architecture-rise/states.json"
    : "docs/render-quality/rq1-baseline/states.json",
);
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const M3_EVIDENCE = manifest.nativeRevalidation?.featureEvidenceRevision ??
  manifest.states.flatMap((state) => state.captures)
    .find((capture) => capture.rendererFamily === "webgpu-renderer")?.featureEvidenceRevision;
if (!M3_EVIDENCE) throw new Error(`Capture profile ${profile} has no M3 evidence revision.`);
const errors = [];
const captureRun = await readJsonIfExists(resolve(outputDirectory, "captures/capture-run.json"));
const nativeStatus = await readJson(resolve(outputDirectory, "captures/native-status.json"));
const webglStatus = await readJson(resolve(outputDirectory, "captures/webgl-status.json"));
const report = profile === "rq1"
  ? await readJsonIfExists(resolve(repositoryRoot, "docs/render-quality/RQ1_BASELINE_REPORT.json"))
  : null;

if (!captureRun?.captureRunId || !/^[0-9a-f-]{36}$/.test(captureRun.captureRunId) || !/^[0-9a-f]{40}$/i.test(captureRun.sourceCommit ?? "")) {
  errors.push("capture-run.json must identify the current capture invocation and a full source commit SHA");
}
const allowedRunStatuses = mode === "baseline" ? ["captured"] : profile === "rq2"
  ? ["captured", "native-blocked", "native-not-evaluated"]
  : ["captured", "native-blocked"];
if (!captureRun || !allowedRunStatuses.includes(captureRun.status)) {
  errors.push("capture run did not complete with a status allowed for this validation mode");
}
if (mode === "working" && (
  captureRun?.schemaVersion !== "rq1-capture-run-v2" ||
  captureRun?.captureProfile !== profile ||
  captureRun?.sourceTree?.status !== "clean" ||
  captureRun?.sourceTree?.commitReproducible !== true ||
  !Array.isArray(captureRun?.sourceTree?.dirtyPaths) ||
  captureRun.sourceTree.dirtyPaths.length !== 0
)) {
  errors.push("working capture must record a clean, commit-reproducible source tree");
}
if (!["dream-loop-captured", "reused-dream-loop-output"].includes(captureRun?.observerCaptureMode)) {
  errors.push("capture-run Observer source mode is missing or unsupported");
}
for (const [label, status] of [["WebGL", webglStatus], ["native", nativeStatus]]) {
  if (status.captureRunId !== captureRun?.captureRunId || status.sourceCommit !== captureRun?.sourceCommit) {
    errors.push(`${label} status provenance does not match the current capture run`);
  }
}
if (captureRun?.webglStatus !== webglStatus.status || captureRun?.nativeStatus !== nativeStatus.status) {
  errors.push("capture-run status summary does not match backend status records");
}
if (mode === "working" && (
  webglStatus.captureProfile !== profile || nativeStatus.captureProfile !== profile
)) {
  errors.push("backend status capture profiles do not match the selected validation profile");
}
if (mode === "working" && captureRun?.nativeReasonClass !== nativeStatus.reasonClass) {
  errors.push("capture-run native reason summary does not match the native status record");
}

const expectedBaselineCommit = profile === "rq2"
  ? "fc01c023ab8621c8f0f796b000a3b82ad137b54c"
  : "41a78eaed941bf559ea361bdd2aed4a4ec55cc8c";
if (manifest.acceptedBaselineCommit !== expectedBaselineCommit) {
  errors.push(`state manifest accepted baseline commit does not match the ${profile.toUpperCase()} reference`);
}
if (manifest.sceneId !== "architecture-rise" || manifest.rendererRevision !== "r187") {
  errors.push("state manifest scene/renderer binding is not Architecture Rise / r187");
}
if (manifest.viewport.width !== 1280 || manifest.viewport.height !== 900 || manifest.viewport.devicePixelRatio !== 1) {
  errors.push("state manifest viewport must remain 1280x900 at DPR 1");
}
if (manifest.groundGlassOutputSizeCss?.width !== 450 || manifest.groundGlassOutputSizeCss?.height !== 360) {
  errors.push("Ground Glass display capture size must remain 450x360 CSS pixels");
}
if (manifest.viewOptions?.grid !== false) errors.push("Ground Glass view grid must remain disabled for image comparisons");
if (manifest.states.length !== 2 || manifest.states[0]?.stateId !== "architecture-rise-neutral" || manifest.states[1]?.stateId !== "architecture-rise-front-rise") {
  errors.push("state manifest must contain the stable neutral and front-rise IDs in order");
}
if (manifest.states[0]?.cameraState?.focusDistanceMm !== 8900 || manifest.states[0]?.cameraState?.apertureFNumber !== 8 || manifest.states[0]?.cameraState?.frontRiseMm !== 0) {
  errors.push("neutral state no longer matches the accepted public Architecture Rise camera values");
}
if (manifest.states[1]?.cameraState?.focusDistanceMm !== 8900 || manifest.states[1]?.cameraState?.apertureFNumber !== 8 || manifest.states[1]?.cameraState?.frontRiseMm !== 20) {
  errors.push("front-rise state no longer uses focus 8900 mm, f/8 and public Rise 20 mm");
}

const groundGlassExpected = [
  ...manifest.states.flatMap((state) => state.captures.map((capture) => ({ capture, state }))),
  ...manifest.additionalReferences.map((capture) => ({
    capture,
    state: manifest.states.find((state) => state.stateId === capture.stateId),
  })),
];
const nativeExpectedIds = groundGlassExpected
  .filter(({ capture }) => capture.rendererFamily === "webgpu-renderer")
  .map(({ capture }) => capture.captureId);
const webglExpectedIds = groundGlassExpected
  .filter(({ capture }) => capture.rendererFamily === "webgl-renderer")
  .map(({ capture }) => capture.captureId);

if (webglStatus.status !== "captured") errors.push("WebGL capture status is not captured");
if (webglStatus.backend !== "webgl-renderer/webgl2") errors.push("WebGL status runtime identity is incorrect");
if (webglStatus.exitCode !== 0 || (webglStatus.signal ?? null) !== null) errors.push("WebGL process did not exit successfully");
if (!sameOrderedIds(webglStatus.capturedCaptureIds, webglExpectedIds) || !sameOrderedIds(webglStatus.missingCaptureIds, [])) {
  errors.push("WebGL status identities do not match the complete current-run capture set");
}
if (nativeStatus.authorization?.feature !== "Architecture Rise M3 Raw RTT only" ||
  nativeStatus.backend !== "webgpu-renderer/webgpu" ||
  nativeStatus.authorization?.evidenceRevision !== M3_EVIDENCE ||
  nativeStatus.authorization?.rawPilot !== true ||
  nativeStatus.authorization?.physicalCocResearch !== false ||
  nativeStatus.authorization?.apertureGatherResearch !== false ||
  nativeStatus.authorization?.m6Presentation !== false ||
  nativeStatus.authorization?.m6Qualification !== false) {
  errors.push("native capture status does not preserve the M3-only authorization boundary");
}
if (mode === "working" && nativeStatus.authorization?.sourceRevision !== manifest.sceneSourceRevision) {
  errors.push("native capture status source revision does not match the selected state manifest");
}
if (mode === "working" && profile === "rq2" && nativeStatus.status !== "not-evaluated" &&
  manifest.nativeRevalidation?.status === "not-evaluated" && (
    captureRun?.nativeRevalidation?.mode !== "explicit-rq2.1-source-revalidation" ||
    captureRun?.nativeRevalidation?.sourceRevision !== manifest.sceneSourceRevision ||
    captureRun?.nativeRevalidation?.evidenceRevision !== M3_EVIDENCE
  )) {
  errors.push("RQ2 native revalidation lacks an explicit run identity bound to the existing scene source and M3 evidence");
}

const expected = [
  { captureId: "architecture-rise-observer-clean", path: "observer/observer-clean.png", role: "observer" },
  { captureId: "architecture-rise-observer-teaching", path: "observer/observer-teaching.png", role: "observer" },
  ...groundGlassExpected.map(({ capture, state }) => ({
    captureId: capture.captureId,
    path: capture.path,
    role: capture.rendererFamily === "webgpu-renderer" ? "native" : "ground-glass",
    spec: capture,
    state,
  })),
];

const captured = [];
const observerSourceCommits = [];
for (const item of expected) {
  const metadataPath = resolve(outputDirectory, "captures", `${item.captureId}.json`);
  const metadata = await readJsonIfExists(metadataPath);
  const imagePath = resolve(outputDirectory, item.path);
  const isPresent = await fileExists(imagePath);
  if (!metadata || !isPresent || !captureBelongsToRun(metadata, captureRun)) {
    const nativeUnavailable = mode === "working" && item.role === "native" &&
      (nativeStatus.status === "blocked" || (profile === "rq2" && nativeStatus.status === "not-evaluated"));
    if (!nativeUnavailable) errors.push(`${item.captureId}: current-run screenshot or metadata is missing`);
    continue;
  }

  if (mode === "working" && metadata.captureProfile !== profile) {
    errors.push(`${item.captureId}: capture metadata profile does not match the selected validation profile`);
  }

  const image = await readFile(imagePath);
  if (metadata.captureId !== item.captureId) errors.push(`${item.captureId}: sidecar captureId is contradictory`);
  const digest = createHash("sha256").update(image).digest("hex");
  if (metadata.imageSha256 !== digest) errors.push(`${item.captureId}: SHA-256 does not match PNG`);
  const pngDimensions = readPngDimensions(image);
  if (!pngDimensions) errors.push(`${item.captureId}: image is not a readable PNG`);
  if (metadata.imageWidth !== pngDimensions?.width || metadata.imageHeight !== pngDimensions?.height) {
    errors.push(`${item.captureId}: metadata dimensions do not match PNG header`);
  }
  if (item.role !== "observer" &&
    (metadata.imageWidth !== manifest.groundGlassOutputSizeCss.width || metadata.imageHeight !== manifest.groundGlassOutputSizeCss.height)) {
    errors.push(`${item.captureId}: screenshot dimensions do not match the shared Ground Glass display size`);
  }
  if (metadata.imagePath !== relative(repositoryRoot, imagePath)) errors.push(`${item.captureId}: metadata imagePath points elsewhere`);
  if (metadata.sceneId !== manifest.sceneId || metadata.sceneSourceRevision !== manifest.sceneSourceRevision) {
    errors.push(`${item.captureId}: scene ID/source revision mismatch`);
  }
  if (metadata.contentful !== true) errors.push(`${item.captureId}: contentful evidence is false`);
  if (!metadata.browser?.name || !metadata.browser?.version || !metadata.operatingSystem?.platform) {
    errors.push(`${item.captureId}: browser or operating-system provenance is missing`);
  }
  if (item.role !== "observer" && metadata.sourceCommit !== captureRun.sourceCommit) {
    errors.push(`${item.captureId}: source commit differs from the current capture run`);
  }
  if (item.role === "observer") observerSourceCommits.push(metadata.sourceCommit);
  if (item.role === "observer" && captureRun.observerCaptureMode === "dream-loop-captured" &&
    metadata.sourceCommit !== captureRun.sourceCommit) {
    errors.push(`${item.captureId}: newly captured Observer source differs from the current run`);
  }

  if (item.role === "observer") {
    if (metadata.rendererFamily === null || !metadata.actualExecutionApi || metadata.frameStatus !== "active") {
      errors.push(`${item.captureId}: Observer renderer identity is incomplete`);
    }
  } else {
    const spec = item.spec;
    if (metadata.stateId !== item.state?.stateId) errors.push(`${item.captureId}: stateId mismatch`);
    if (metadata.rendererFamily !== spec.rendererFamily || metadata.actualExecutionApi !== spec.executionApi) {
      errors.push(`${item.captureId}: actual renderer family/API mismatch`);
    }
    if (metadata.rendererRevision !== "r187" || metadata.threeRevision !== "187") {
      errors.push(`${item.captureId}: renderer revision is not r187`);
    }
    if (metadata.previewMode !== spec.previewMode || metadata.rawDebug !== spec.rawDebug || metadata.pipelineStage !== spec.pipelineStage) {
      errors.push(`${item.captureId}: preview mode, Raw stage, or pipeline stage mismatch`);
    }
    if (metadata.viewOptions?.grid !== false) errors.push(`${item.captureId}: comparison grid must be disabled`);
    for (const key of REQUIRED_CAMERA_KEYS) {
      if (metadata.cameraState?.[key] !== item.state?.cameraState?.[key]) errors.push(`${item.captureId}: cameraState.${key} mismatch`);
    }
    if (metadata.frameStatus !== "completed" || !metadata.requestId || metadata.requestId !== metadata.lastCompletedRequestId) {
      errors.push(`${item.captureId}: frame request is not current and completed`);
    }
    if (metadata.acceptedByHost !== true) errors.push(`${item.captureId}: current completed request was not observed as accepted by the host`);
    if (metadata.applicationFallback !== "not-observed") errors.push(`${item.captureId}: unexpected application fallback`);
    if (item.role === "native") {
      if (metadata.selectedBackend !== "webgpu" || metadata.internalFallback !== "none") {
        errors.push(`${item.captureId}: native runtime identity/fallback/accepted-frame proof is invalid`);
      }
      if (metadata.runtimeDiagnostics?.sceneSourceRevision !== manifest.sceneSourceRevision) {
        errors.push(`${item.captureId}: mounted runtime scene-source revision does not match the RQ2 manifest`);
      }
      if (metadata.featureEvidenceRevision !== M3_EVIDENCE || metadata.mountedFeatureEvidenceRevision !== M3_EVIDENCE) {
        errors.push(`${item.captureId}: native capture is not bound to the accepted M3 r187 evidence`);
      }
    } else if (metadata.selectedBackend !== "webgl" || metadata.internalFallback !== null) {
      errors.push(`${item.captureId}: WebGL reference runtime identity is invalid`);
    }
  }
  captured.push(item.captureId);
}

const uniqueObserverSources = [...new Set(observerSourceCommits)].sort();
if (!sameOrderedIds([...(captureRun?.observerSourceCommits ?? [])].sort(), uniqueObserverSources)) {
  errors.push("capture-run Observer source provenance does not match the copied Dream Loop sidecars");
}

const captureSidecarDirectory = resolve(outputDirectory, "captures");
for (const filename of await readDirectoryIfExists(captureSidecarDirectory)) {
  if (!filename.endsWith(".json") || ["capture-run.json", "webgl-status.json", "native-status.json", "native-preflight.json"].includes(filename)) continue;
  const metadata = await readJsonIfExists(resolve(captureSidecarDirectory, filename));
  if (metadata?.captureRunId !== captureRun?.captureRunId || metadata?.rendererFamily !== "webgpu-renderer") continue;
  if (!nativeExpectedIds.includes(metadata.captureId) || filename !== `${metadata.captureId}.json`) {
    errors.push(`native status inventory contains undeclared or contradictory current-run identity ${filename}`);
  }
}

const currentNativeIds = [];
let nativeArtifactsPresent = false;
for (const captureId of nativeExpectedIds) {
  const item = expected.find((candidate) => candidate.captureId === captureId);
  const metadata = await readJsonIfExists(resolve(outputDirectory, "captures", `${captureId}.json`));
  const imagePath = resolve(outputDirectory, item.path);
  const metadataPresent = metadata !== null;
  const imagePresent = await fileExists(imagePath);
  nativeArtifactsPresent ||= metadataPresent || imagePresent;
  if (metadataPresent && captureBelongsToRun(metadata, captureRun) && imagePresent) currentNativeIds.push(captureId);
}

if (mode === "baseline") {
  if (nativeStatus.status !== "captured" || nativeStatus.exitCode !== 0 || nativeStatus.signal !== null ||
    !sameOrderedIds(nativeStatus.capturedCaptureIds, nativeExpectedIds) || !sameOrderedIds(nativeStatus.missingCaptureIds, [])) {
    errors.push("committed baseline native status is not a complete successful M3 capture");
  }
  if (captureRun?.captureRunId !== report?.captureRunId || captureRun?.sourceCommit !== report?.captureRunSourceCommit ||
    captureRun?.sourceCommit !== report?.sourceCommit) {
    errors.push("committed baseline capture-run identity/source does not match the accepted report");
  }
} else if (profile === "rq2" && nativeStatus.status === "not-evaluated") {
  const expectedMissing = nativeExpectedIds;
  const nativeTest = nativeStatus.nativeTest ?? {};
  if (manifest.nativeRevalidation?.status !== "not-evaluated" ||
    manifest.nativeRevalidation?.reasonClass !== "source-revision-unverified" ||
    manifest.nativeRevalidation?.sourceRevision !== manifest.sceneSourceRevision ||
    manifest.nativeRevalidation?.featureEvidenceRevision !== M3_EVIDENCE) {
    errors.push("RQ2 native status is not bound to an explicit, unevaluated source-revision attestation");
  }
  if (nativeStatus.schemaVersion !== "rq2-native-status-v1" ||
    nativeStatus.reasonClass !== "source-revision-unverified" ||
    nativeStatus.captureRunId !== captureRun?.captureRunId ||
    nativeStatus.sourceCommit !== captureRun?.sourceCommit ||
    nativeStatus.backend !== "webgpu-renderer/webgpu" ||
    nativeStatus.authorization?.sourceRevision !== manifest.sceneSourceRevision ||
    nativeStatus.authorization?.evidenceRevision !== M3_EVIDENCE ||
    nativeStatus.authorization?.feature !== "Architecture Rise M3 Raw RTT only" ||
    nativeStatus.authorization?.rawPilot !== true ||
    nativeStatus.authorization?.physicalCocResearch !== false ||
    nativeStatus.authorization?.apertureGatherResearch !== false ||
    nativeStatus.authorization?.m6Presentation !== false ||
    nativeStatus.authorization?.m6Qualification !== false) {
    errors.push("RQ2 not-evaluated native status has missing or contradictory authorization provenance");
  }
  if (nativeStatus.command !== null || nativeStatus.preflight !== null ||
    nativeTest.captureAttempted !== false || nativeTest.exitCode !== null || nativeTest.signal !== null ||
    nativeTest.error !== null || nativeStatus.exitCode !== null || nativeStatus.signal !== null ||
    nativeStatus.error !== null || nativeStatus.failureSummary !== null) {
    errors.push("RQ2 not-evaluated native status must prove that no native process was attempted");
  }
  if (!sameOrderedIds(nativeStatus.capturedCaptureIds, []) ||
    !sameOrderedIds(nativeStatus.missingCaptureIds, expectedMissing) || nativeArtifactsPresent || currentNativeIds.length > 0) {
    errors.push("RQ2 not-evaluated native status must contain no native artifacts and list every required identity as missing");
  }
  if (captureRun?.status !== "native-not-evaluated") {
    errors.push("capture-run status does not identify the native source attestation as not evaluated");
  }
} else {
  errors.push(...nativeCaptureStatusErrors(nativeStatus, captureRun, nativeExpectedIds, currentNativeIds, nativeArtifactsPresent));
  const expectedRunStatus = nativeStatus.status === "blocked" ? "native-blocked"
    : nativeStatus.status === "captured" ? "captured" : "invalid";
  if (captureRun?.status !== expectedRunStatus) errors.push("capture-run status does not agree with native execution classification");
}

if (report) {
  if (report.acceptedBaselineCommit !== manifest.acceptedBaselineCommit) errors.push("report accepted baseline commit mismatch");
  if (report.captureRunId === captureRun?.captureRunId && report.captureRunSourceCommit !== captureRun?.sourceCommit) {
    errors.push("committed baseline run source does not match its capture-run record");
  }
  if (report.captureRunId === captureRun?.captureRunId && report.nativeStatus !== nativeStatus.status) {
    errors.push("report native status differs from the accepted capture run");
  }
  if (report.captureRunSourceCommit && report.sourceCommit !== report.captureRunSourceCommit) {
    errors.push("report sourceCommit and captureRunSourceCommit must be the same pinned capture source");
  }
}

const currentExpectedIds = expected
  .filter((item) => captured.includes(item.captureId))
  .map((item) => item.captureId);
if (!sameIdSet(captureRun?.capturedCaptureIds, currentExpectedIds)) {
  errors.push("capture-run capturedCaptureIds do not match validated current-run images");
}

if (errors.length > 0) {
  console.error(`${profile.toUpperCase()} evidence check failed:`);
  for (const error of [...new Set(errors)]) console.error(`- ${error}`);
  process.exit(1);
}

if (mode === "baseline") {
  console.log(`RQ1 committed baseline valid: ${captured.length} captures; native M3 captured; source ${captureRun.sourceCommit}.`);
} else if (profile === "rq2" && nativeStatus.status === "not-evaluated") {
  console.log(`RQ2 working evidence valid: ${captured.length} captures; WebGL evidence valid; native M3 not evaluated for source ${manifest.sceneSourceRevision} (source attestation pending).`);
} else if (nativeStatus.status === "blocked") {
  const prefix = profile === "rq2" ? "RQ2 limited reproduction valid" : "RQ1 limited reproduction valid";
  console.log(`${prefix}: ${captured.length} captures; WebGL evidence valid; native environment unavailable (${nativeStatus.preflight.probeStatus}). Native rendering was not validated.`);
} else if (profile === "rq2") {
  console.log(`RQ2 working evidence valid: ${captured.length} captures; native M3 v2 Raw captured; source ${captureRun.sourceCommit} (clean and commit-reproducible).`);
} else {
  console.log(`RQ1 working evidence valid: ${captured.length} captures; native M3 captured; source ${captureRun.sourceCommit} (clean and commit-reproducible).`);
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function readJsonIfExists(path) {
  try {
    return await readJson(path);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return null;
    throw error;
  }
}

async function readDirectoryIfExists(path) {
  try {
    return await readdir(path);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return [];
    throw error;
  }
}

async function fileExists(path) {
  try {
    await readFile(path);
    return true;
  } catch {
    return false;
  }
}

function sameOrderedIds(actual, expected) {
  return Array.isArray(actual) && actual.length === expected.length &&
    new Set(actual).size === actual.length && actual.every((captureId, index) => captureId === expected[index]);
}

function sameIdSet(actual, expected) {
  return Array.isArray(actual) && actual.length === expected.length && new Set(actual).size === actual.length &&
    [...actual].sort().every((captureId, index) => captureId === [...expected].sort()[index]);
}

function readPngDimensions(image) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (image.length < 24 || !image.subarray(0, 8).equals(signature)) return null;
  return { width: image.readUInt32BE(16), height: image.readUInt32BE(20) };
}
