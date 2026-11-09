import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";

const repositoryRoot = process.cwd();
const defaultOutput = "docs/render-quality/rq1-baseline";
const M3_EVIDENCE = "m3-architecture-rise-raw-rtt-native-r187-v1";
const REQUIRED_CAMERA_KEYS = [
  "focalLengthMm", "focusDistanceMm", "apertureFNumber", "frontRiseMm", "frontShiftMm",
  "frontTiltDeg", "frontSwingDeg", "rearRiseMm", "rearShiftMm", "rearTiltDeg", "rearSwingDeg",
];

function outputPath(args) {
  if (args.length === 0) return resolve(repositoryRoot, defaultOutput);
  if (args.length !== 2 || args[0] !== "--output-dir" || !args[1] || isAbsolute(args[1])) {
    throw new Error("Usage: npm run render-quality:rq1:check -- [--output-dir docs/render-quality/<name>]");
  }
  const path = resolve(repositoryRoot, args[1]);
  const pathRelative = relative(repositoryRoot, path);
  if (pathRelative.startsWith(".." + sep) || !pathRelative.startsWith(`docs${sep}render-quality${sep}`)) {
    throw new Error("--output-dir must stay under docs/render-quality/");
  }
  return path;
}

const outputDirectory = outputPath(process.argv.slice(2));
const manifest = JSON.parse(await readFile(resolve(repositoryRoot, "docs/render-quality/rq1-baseline/states.json"), "utf8"));
const errors = [];
const nativeStatus = await readJson(resolve(outputDirectory, "captures/native-status.json"));
const webglStatus = await readJson(resolve(outputDirectory, "captures/webgl-status.json"));
const reportPath = resolve(repositoryRoot, "docs/render-quality/RQ1_BASELINE_REPORT.json");
const report = await readJsonIfExists(reportPath);

if (manifest.acceptedBaselineCommit !== "41a78eaed941bf559ea361bdd2aed4a4ec55cc8c") {
  errors.push("state manifest accepted baseline commit does not match M7X");
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
if (webglStatus.status !== "captured") errors.push("WebGL capture status is not captured");
if (!["captured", "blocked"].includes(nativeStatus.status)) errors.push("native status must be captured or explicitly blocked");
if (nativeStatus.authorization?.feature !== "Architecture Rise M3 Raw RTT only" ||
  nativeStatus.authorization?.evidenceRevision !== M3_EVIDENCE ||
  nativeStatus.authorization?.rawPilot !== true ||
  nativeStatus.authorization?.physicalCocResearch !== false ||
  nativeStatus.authorization?.apertureGatherResearch !== false ||
  nativeStatus.authorization?.m6Presentation !== false ||
  nativeStatus.authorization?.m6Qualification !== false) {
  errors.push("native capture status does not preserve the M3-only authorization boundary");
}

const expected = [
  {
    captureId: "architecture-rise-observer-clean",
    path: "observer/observer-clean.png",
    role: "observer",
  },
  {
    captureId: "architecture-rise-observer-teaching",
    path: "observer/observer-teaching.png",
    role: "observer",
  },
  ...manifest.states.flatMap((state) => state.captures.map((capture) => ({
    captureId: capture.captureId,
    path: capture.path,
    role: capture.rendererFamily === "webgpu-renderer" ? "native" : "ground-glass",
    spec: capture,
    state,
  }))),
  ...manifest.additionalReferences.map((capture) => ({
    captureId: capture.captureId,
    path: capture.path,
    role: "ground-glass",
    spec: capture,
    state: manifest.states.find((state) => state.stateId === capture.stateId),
  })),
];

const captured = [];
for (const item of expected) {
  const metadataPath = resolve(outputDirectory, "captures", `${item.captureId}.json`);
  const metadata = await readJsonIfExists(metadataPath);
  const imagePath = resolve(outputDirectory, item.path);
  const isPresent = await fileExists(imagePath);
  if (!metadata || !isPresent) {
    const nativeBlocked = item.role === "native" && nativeStatus.status === "blocked" && nativeStatus.missingCaptureIds?.includes(item.captureId);
    if (!nativeBlocked) errors.push(`${item.captureId}: screenshot or metadata is missing`);
    continue;
  }

  const image = await readFile(imagePath);
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
  if (metadata.sourceCommit !== report?.captureRunSourceCommit && report?.captureRunSourceCommit) {
    errors.push(`${item.captureId}: source commit differs from the baseline report`);
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
      if (!nativeStatus.capturedCaptureIds?.includes(item.captureId)) {
        errors.push(`${item.captureId}: native metadata exists but the status record does not acknowledge it`);
      }
      if (metadata.selectedBackend !== "webgpu" || metadata.internalFallback !== "none") {
        errors.push(`${item.captureId}: native runtime identity/fallback/accepted-frame proof is invalid`);
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

if (nativeStatus.status === "blocked") {
  if (!Array.isArray(nativeStatus.missingCaptureIds) || nativeStatus.missingCaptureIds.length === 0 || !nativeStatus.blocker) {
    errors.push("blocked native status must name missing captures and explain the environment blocker");
  }
  for (const captureId of nativeStatus.missingCaptureIds ?? []) {
    if (!expected.some((item) => item.captureId === captureId && item.role === "native")) {
      errors.push(`native blocked status names undeclared capture ${captureId}`);
    }
  }
}

if (report) {
  if (report.acceptedBaselineCommit !== manifest.acceptedBaselineCommit) errors.push("report accepted baseline commit mismatch");
  if (report.captureRunSourceCommit && expected.some((item) => item.role === "native" && captured.includes(item.captureId)) && report.nativeStatus !== nativeStatus.status) {
    errors.push("report native status differs from native capture status");
  }
  if (report.captureRunSourceCommit && report.sourceCommit !== report.captureRunSourceCommit) {
    errors.push("report sourceCommit and captureRunSourceCommit must be the same pinned capture source");
  }
}

if (errors.length > 0) {
  console.error("RQ1 evidence check failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`RQ1 evidence valid: ${captured.length} validated captures; native M3 status ${nativeStatus.status}.`);

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

async function fileExists(path) {
  try {
    await readFile(path);
    return true;
  } catch {
    return false;
  }
}

function readPngDimensions(image) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (image.length < 24 || !image.subarray(0, 8).equals(signature)) return null;
  return { width: image.readUInt32BE(16), height: image.readUInt32BE(20) };
}
