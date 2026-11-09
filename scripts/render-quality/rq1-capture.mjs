import { spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { copyFile, lstat, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { findCurrentCaptureIds } from "./rq1-capture-provenance.mjs";
import { classifyNativeCaptureOutcome, classifyNativePreflight } from "./rq1-native-capture-status.mjs";

const repositoryRoot = process.cwd();
const defaultOutputs = {
  rq1: "docs/render-quality/.rq1-runs/current",
  rq2: "docs/render-quality/.rq2-runs/current",
};
const baselineOutput = resolve(repositoryRoot, "docs/render-quality/rq1-baseline");
const dreamLoopDirectory = resolve(repositoryRoot, ".dream-loop/architecture-rise");

function parseArguments(args) {
  let profile = "rq1";
  let profileWasSet = false;
  let outputDirectory = null;
  let skipObserver = false;
  let outputWasSet = false;
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--help" || argument === "-h") {
      console.log([
        "Usage: node scripts/render-quality/rq1-capture.mjs [--profile rq1|rq2] [--skip-observer] [--output-dir docs/render-quality/<name>]",
        "RQ1 default output: docs/render-quality/.rq1-runs/current (Git-ignored).",
        "RQ2 default output: docs/render-quality/.rq2-runs/current (Git-ignored).",
        "Capture requires a clean source tree; the committed rq1-baseline directory is read-only.",
      ].join("\n"));
      process.exit(0);
    } else if (argument === "--profile" && args[index + 1]) {
      if (profileWasSet) throw new Error("--profile may only be provided once");
      profileWasSet = true;
      profile = args[index + 1];
      index += 1;
      if (!(profile in defaultOutputs)) throw new Error("--profile must be rq1 or rq2");
    } else if (argument === "--skip-observer") {
      skipObserver = true;
    } else if (argument === "--output-dir" && args[index + 1]) {
      if (outputWasSet) throw new Error("--output-dir may only be provided once");
      outputWasSet = true;
      const outputArgument = args[index + 1];
      index += 1;
      if (isAbsolute(outputArgument)) throw new Error("--output-dir must be a repository-relative docs/render-quality path");
      outputDirectory = resolve(repositoryRoot, outputArgument);
      const outputRelative = relative(repositoryRoot, outputDirectory);
      if (
        outputRelative === ".." ||
        outputRelative.startsWith(".." + sep) ||
        isAbsolute(outputRelative) ||
        !outputRelative.startsWith("docs" + sep + "render-quality" + sep)
      ) {
        throw new Error("--output-dir must stay under docs/render-quality/");
      }
    } else {
      throw new Error("Usage: npm run render-quality:rq1:capture -- [--profile rq1|rq2] [--skip-observer] [--output-dir docs/render-quality/<name>]");
    }
  }
  if (!outputDirectory) outputDirectory = resolve(repositoryRoot, defaultOutputs[profile]);
  return { profile, outputDirectory, skipObserver };
}

async function assertSafeOutputDirectory(outputDirectory) {
  const outputRelativeToBaseline = relative(baselineOutput, outputDirectory);
  if (
    outputDirectory === baselineOutput ||
    (outputRelativeToBaseline !== ".." && !outputRelativeToBaseline.startsWith(".." + sep) && !isAbsolute(outputRelativeToBaseline))
  ) {
    throw new Error("The committed RQ1 baseline is immutable; capture into docs/render-quality/.rq1-runs/ or another non-baseline directory.");
  }

  const outputRelative = relative(repositoryRoot, outputDirectory);
  let current = repositoryRoot;
  for (const segment of outputRelative.split(sep)) {
    current = resolve(current, segment);
    try {
      const info = await lstat(current);
      if (info.isSymbolicLink()) throw new Error("--output-dir may not pass through symlinks");
      if (current !== outputDirectory && !info.isDirectory()) throw new Error("--output-dir parent component is not a directory");
      if (current === outputDirectory && !info.isDirectory()) throw new Error("--output-dir must be a directory");
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") break;
      throw error;
    }
  }
}

function requireCleanSource(outputDirectory) {
  const outputRelative = relative(repositoryRoot, outputDirectory).split(sep).join("/");
  const trackedOutput = spawnSync("git", ["ls-files", "--", outputRelative], {
    cwd: repositoryRoot,
    encoding: "utf8",
  });
  if (trackedOutput.status !== 0) throw new Error(trackedOutput.stderr || "Unable to inspect capture output path in Git.");
  if (trackedOutput.stdout.trim()) throw new Error("Capture output directory overlaps tracked files; choose an untracked docs/render-quality directory.");

  const status = spawnSync("git", [
    "status", "--porcelain=v1", "--untracked-files=all", "--", ".",
    `:(exclude,top)${outputRelative}`,
    `:(exclude,top)${outputRelative}/**`,
  ], { cwd: repositoryRoot, encoding: "utf8" });
  if (status.status !== 0) throw new Error(status.stderr || "Unable to verify source-tree cleanliness.");
  if (status.stdout.trim()) {
    const paths = status.stdout.trim().split("\n").map((line) => line.slice(3));
    throw new Error(`RQ1 capture requires a clean source tree for commit-reproducible evidence. Dirty paths: ${paths.join(", ")}`);
  }
  return { status: "clean", commitReproducible: true, dirtyPaths: [] };
}

function run(label, command, args, env) {
  console.log(`\n[RQ1] ${label}: ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, {
    cwd: repositoryRoot,
    env,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";
  if (stdout) process.stdout.write(stdout);
  if (stderr) process.stderr.write(stderr);
  return {
    exitCode: result.status,
    status: result.status ?? 1,
    signal: result.signal ?? null,
    stdout,
    stderr,
    error: result.error?.message ?? null,
  };
}

function cleanCaptureEnvironment(backend, outputDirectory, captureRun) {
  const env = { ...process.env };
  for (const key of [
    "OBSERVER_NATIVE_WEBGPU_REQUIRED",
    "GROUND_GLASS_NATIVE_WEBGPU_REQUIRED",
    "GROUND_GLASS_WEBGPU_FAILURE_INTEGRATION",
    "GROUND_GLASS_WEBGPU_PHYSICAL_COC_RESEARCH",
    "GROUND_GLASS_WEBGPU_PHYSICAL_COC_R187_QUALIFICATION",
    "GROUND_GLASS_WEBGPU_APERTURE_GATHER_RESEARCH",
    "GROUND_GLASS_WEBGPU_APERTURE_GATHER_R187_QUALIFICATION",
    "GROUND_GLASS_WEBGPU_M6_PRESENTATION_REQUIRED",
    "GROUND_GLASS_WEBGPU_M6_R187_QUALIFICATION_REQUIRED",
    "VITE_GROUND_GLASS_WEBGPU_M6_PRESENTATION",
    "VITE_GROUND_GLASS_WEBGPU_M6_R187_QUALIFICATION",
  ]) delete env[key];

  env.VITE_BASE_PATH = "/";
  env.VITE_GROUND_GLASS_WEBGPU_RAW_PILOT = backend === "webgpu" ? "true" : "false";
  env.VITE_GROUND_GLASS_WEBGPU_PHYSICAL_COC_RESEARCH = "false";
  env.VITE_GROUND_GLASS_WEBGPU_PHYSICAL_COC_R187_QUALIFICATION = "false";
  env.VITE_GROUND_GLASS_WEBGPU_GATHER_RESEARCH = "false";
  env.VITE_GROUND_GLASS_WEBGPU_APERTURE_GATHER_R187_QUALIFICATION = "false";
  env.GROUND_GLASS_WEBGPU_PHYSICAL_COC_RESEARCH = "0";
  env.GROUND_GLASS_WEBGPU_PHYSICAL_COC_R187_QUALIFICATION = "0";
  env.GROUND_GLASS_WEBGPU_APERTURE_GATHER_RESEARCH = "0";
  env.GROUND_GLASS_WEBGPU_APERTURE_GATHER_R187_QUALIFICATION = "0";
  env.GROUND_GLASS_WEBGPU_M6_PRESENTATION_REQUIRED = "0";
  env.GROUND_GLASS_WEBGPU_M6_R187_QUALIFICATION_REQUIRED = "0";
  env.PLAYWRIGHT_WEB_SERVER_PORT = backend === "webgpu" ? "4174" : "4173";
  env.RQ1_CAPTURE_BACKEND = backend;
  env.RQ_CAPTURE_PROFILE = captureRun.captureProfile;
  env.RQ1_CAPTURE_OUTPUT_DIR = outputDirectory;
  env.RQ1_CAPTURE_RUN_ID = captureRun.captureRunId;
  // Enable the existing test-only frame acceptance diagnostics for both
  // renderers. No failure point is invoked and this does not select WebGPU.
  env.GROUND_GLASS_WEBGPU_FAILURE_INTEGRATION = "1";

  if (backend === "webgpu") {
    env.GROUND_GLASS_NATIVE_WEBGPU_REQUIRED = "1";
  } else {
    delete env.GROUND_GLASS_NATIVE_WEBGPU_REQUIRED;
  }
  return env;
}

async function copyObserverEvidence(outputDirectory, captureRun, manifest) {
  const captureRecords = [];
  for (const view of ["observer-clean", "observer-teaching"]) {
    const sourceImage = resolve(dreamLoopDirectory, `${view}.png`);
    const sourceMetadata = resolve(dreamLoopDirectory, `${view}.png.json`);
    const targetImage = resolve(outputDirectory, "observer", `${view}.png`);
    const targetMetadata = resolve(outputDirectory, "captures", `architecture-rise-${view}.json`);
    await mkdir(dirname(targetImage), { recursive: true });
    await mkdir(dirname(targetMetadata), { recursive: true });
    await copyFile(sourceImage, targetImage);

    const image = await readFile(targetImage);
    const sidecar = JSON.parse(await readFile(sourceMetadata, "utf8"));
    const runtime = sidecar.runtime ?? {};
    const sourceCommit = typeof sidecar.sourceCommit === "string"
      ? sidecar.sourceCommit
      : manifest.acceptedBaselineCommit;
    const cameraState = sidecar.deterministicState ?? {};
    if (
      runtime.status !== "active" ||
      !runtime.rendererFamily ||
      !runtime.executionApi ||
      runtime.rendererRevision === null ||
      runtime.applicationFallback !== "none"
    ) {
      throw new Error(`${view} did not record an active Observer renderer without fallback: ${JSON.stringify(runtime)}`);
    }

    const sceneMovement = cameraState.movements ?? {};
    const metadata = {
      schemaVersion: "rq1-capture-metadata-v1",
      captureProfile: captureRun.captureProfile,
      captureId: `architecture-rise-${view}`,
      stateId: "architecture-rise-observer-dream-loop-reference",
      sourceCommit,
      captureRunId: captureRun.captureRunId,
      captureRunSourceCommit: captureRun.sourceCommit,
      captureSourceCommitFallback: sidecar.sourceCommit ? null : "accepted-baseline-commit; legacy Dream Loop sidecar had no sourceCommit field",
      sceneId: manifest.sceneId,
      sceneSourceRevision: manifest.sceneSourceRevision,
      rendererFamily: runtime.rendererFamily,
      actualExecutionApi: runtime.executionApi,
      rendererRevision: `r${runtime.rendererRevision}`,
      threeRevision: String(runtime.rendererRevision),
      featureEvidenceRevision: null,
      applicationFallback: runtime.applicationFallback,
      internalFallback: null,
      browser: {
        name: runtime.browserName,
        version: runtime.browserVersion,
        userAgent: runtime.userAgent,
      },
      operatingSystem: runtime.operatingSystem,
      viewport: sidecar.viewport,
      devicePixelRatio: sidecar.viewport?.devicePixelRatio ?? null,
      cameraPresetIdentity: manifest.cameraPresetIdentity,
      cameraState: {
        focalLengthMm: manifest.cameraState.focalLengthMm,
        focusDistanceMm: Number(cameraState.focus),
        apertureFNumber: Number(cameraState.aperture),
        frontRiseMm: Number(sceneMovement.frontRiseMm ?? 0),
        frontShiftMm: 0,
        frontTiltDeg: Number(sceneMovement.frontTiltDeg ?? 0),
        frontSwingDeg: Number(sceneMovement.frontSwingDeg ?? 0),
        rearRiseMm: 0,
        rearShiftMm: 0,
        rearTiltDeg: 0,
        rearSwingDeg: 0,
      },
      renderQuality: sidecar.renderQuality,
      previewMode: "not-applicable",
      rawDebug: false,
      pipelineStage: "observer-scene-canvas",
      displayPipelineNotes:
        "Observer clean is the Dream Loop appearance reference; Observer teaching enables the public teaching overlays. Its actual camera state is recorded independently and is not treated as matched to Ground Glass.",
      frameStatus: runtime.status,
      requestId: null,
      lastCompletedRequestId: null,
      acceptedByHost: null,
      contentful: sidecar.canvas?.ready === true,
      contentfulness: sidecar.canvas,
      imagePath: relative(repositoryRoot, targetImage),
      imageWidth: sidecar.canvas?.width ?? null,
      imageHeight: sidecar.canvas?.height ?? null,
      imageSha256: createHash("sha256").update(image).digest("hex"),
      captureRole: sidecar.captureRole,
      dreamLoopSource: {
        pilotId: sidecar.pilotId,
        assetKey: sidecar.assetKey,
        sourceCommit,
        optimizationSurface: sidecar.optimizationSurface,
        hiddenDomControls: sidecar.hiddenDomControls,
        overlays: sidecar.overlays,
        subject: sidecar.subject,
      },
    };
    await writeFile(targetMetadata, JSON.stringify(metadata, null, 2) + "\n");
    captureRecords.push(metadata);
  }
  return captureRecords;
}

const { profile, outputDirectory, skipObserver } = parseArguments(process.argv.slice(2));
await assertSafeOutputDirectory(outputDirectory);
const sourceTree = requireCleanSource(outputDirectory);
const manifestPath = resolve(
  repositoryRoot,
  profile === "rq2"
    ? "docs/render-quality/rq2-architecture-rise/states.json"
    : "docs/render-quality/rq1-baseline/states.json",
);
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const sourceCommit = runGit(["rev-parse", "HEAD"]);
const compatibilitySource = await readFile(
  resolve(repositoryRoot, "src/render/webgpu/groundGlassRawWebGpuCompatibility.ts"),
  "utf8",
);
const activeSourceMatch = compatibilitySource.match(
  /export const ARCHITECTURE_RISE_RAW_RTT_SOURCE_REVISION\s*=\s*["']([^"']+)["']/,
);
if (!activeSourceMatch || activeSourceMatch[1] !== manifest.sceneSourceRevision) {
  throw new Error(
    `Capture profile ${profile} is bound to ${manifest.sceneSourceRevision}, but the active scene-source revision is ${activeSourceMatch?.[1] ?? "unavailable"}.`,
  );
}
const captureRun = {
  schemaVersion: "rq1-capture-run-v2",
  captureProfile: profile,
  captureRunId: randomUUID(),
  sourceCommit,
  sourceTree,
  observerCaptureMode: skipObserver ? "reused-dream-loop-output" : "dream-loop-captured",
  observerSourceCommits: [],
  status: "running",
};
const expectedM3Evidence = manifest.nativeRevalidation?.featureEvidenceRevision ??
  manifest.states.flatMap((state) => state.captures)
    .find((capture) => capture.rendererFamily === "webgpu-renderer")?.featureEvidenceRevision;
if (!expectedM3Evidence) throw new Error(`Capture profile ${profile} does not declare a native M3 evidence revision.`);
if (manifest.sceneId !== "architecture-rise" || manifest.rendererRevision !== "r187") {
  throw new Error(`Capture profile ${profile} does not match Architecture Rise / r187.`);
}
for (const state of manifest.states) {
  if (state.captures.some((capture) => capture.rendererFamily === "webgpu-renderer" && capture.featureEvidenceRevision !== expectedM3Evidence)) {
    throw new Error(`The native capture state ${state.stateId} does not bind to the authorized M3 r187 evidence.`);
  }
}

await mkdir(outputDirectory, { recursive: true });
const allCaptureSpecs = [
  ...manifest.states.flatMap((state) => state.captures),
  ...manifest.additionalReferences,
];
for (const capture of allCaptureSpecs) {
  await rm(resolve(outputDirectory, capture.path), { force: true });
  await rm(resolve(outputDirectory, "captures", `${capture.captureId}.json`), { force: true });
}
for (const id of ["architecture-rise-observer-clean", "architecture-rise-observer-teaching"]) {
  await rm(resolve(outputDirectory, "observer", `${id.replace("architecture-rise-", "")}.png`), { force: true });
  await rm(resolve(outputDirectory, "captures", `${id}.json`), { force: true });
}
for (const filename of ["webgl-status.json", "native-status.json", "native-preflight.json"]) {
  await rm(resolve(outputDirectory, "captures", filename), { force: true });
}
const captureRunPath = resolve(outputDirectory, "captures/capture-run.json");
await mkdir(dirname(captureRunPath), { recursive: true });
await writeFile(captureRunPath, JSON.stringify(captureRun, null, 2) + "\n");
const dreamLoopEnv = {
  ...process.env,
  DREAM_LOOP_SOURCE_COMMIT: sourceCommit,
  VITE_BASE_PATH: "/",
  GROUND_GLASS_NATIVE_WEBGPU_REQUIRED: "0",
  GROUND_GLASS_WEBGPU_FAILURE_INTEGRATION: "0",
  VITE_GROUND_GLASS_WEBGPU_RAW_PILOT: "false",
  VITE_GROUND_GLASS_WEBGPU_PHYSICAL_COC_RESEARCH: "false",
  VITE_GROUND_GLASS_WEBGPU_GATHER_RESEARCH: "false",
  VITE_GROUND_GLASS_WEBGPU_M6_PRESENTATION: "false",
  VITE_GROUND_GLASS_WEBGPU_M6_R187_QUALIFICATION: "false",
};
if (!skipObserver) {
  const dreamLoop = run("existing Observer pilot capture", "npm", ["run", "dream-loop:capture", "--", "--pilot", "architecture-rise"], dreamLoopEnv);
  if (dreamLoop.status !== 0) throw new Error(`Dream Loop Observer capture failed with exit ${dreamLoop.status}.`);
} else {
  console.log("[RQ1] Reusing the existing .dream-loop Architecture Rise Observer capture as explicitly requested.");
}
const observerCaptures = await copyObserverEvidence(outputDirectory, captureRun, manifest);
captureRun.observerSourceCommits = [...new Set(observerCaptures.map((capture) => capture.sourceCommit))];
captureRun.status = "capturing-ground-glass";
await writeFile(captureRunPath, JSON.stringify(captureRun, null, 2) + "\n");

const playwrightCli = resolve(repositoryRoot, "node_modules/playwright/cli.js");
const commonArgs = [
  playwrightCli,
  "test",
  "scripts/render-quality/rq1-capture.spec.ts",
  "--config=playwright.rq1.config.ts",
  "--workers=1",
  "--retries=0",
  "--reporter=list",
];
const webgl = run(
  "WebGL Raw and processed captures",
  process.execPath,
  [...commonArgs, "--project=chromium"],
  cleanCaptureEnvironment("webgl", outputDirectory, captureRun),
);
const webglCaptureSpecs = [
  ...manifest.states.flatMap((state) => state.captures.filter((capture) => capture.rendererFamily === "webgl-renderer")),
  ...manifest.additionalReferences.filter((capture) => capture.rendererFamily === "webgl-renderer"),
];
const webglCaptureIds = await findCurrentCaptureIds(webglCaptureSpecs, outputDirectory, captureRun);
const missingWebglCaptureIds = webglCaptureSpecs
  .map((capture) => capture.captureId)
  .filter((captureId) => !webglCaptureIds.includes(captureId));
const webglStatus = {
  status: webgl.status === 0 && missingWebglCaptureIds.length === 0 ? "captured" : "invalid",
  captureProfile: profile,
  captureRunId: captureRun.captureRunId,
  sourceCommit: captureRun.sourceCommit,
  command: profile === "rq2" ? "npm run render-quality:rq2:capture" : "npm run render-quality:rq1:capture",
  backend: "webgl-renderer/webgl2",
  exitCode: webgl.exitCode,
  signal: webgl.signal,
  capturedCaptureIds: webglCaptureIds,
  missingCaptureIds: missingWebglCaptureIds,
  error: webgl.error,
  failureSummary: webgl.status === 0 ? null : (webgl.stderr || webgl.stdout).slice(-8000),
};
await writeFile(resolve(outputDirectory, "captures/webgl-status.json"), JSON.stringify(webglStatus, null, 2) + "\n");

const nativeCaptureSpecs = manifest.states.flatMap((state) =>
  state.captures.filter((capture) => capture.rendererFamily === "webgpu-renderer"),
);
let native = null;
let nativeStatus;
let nativeCaptureIds = [];
let missingNativeCaptureIds = nativeCaptureSpecs.map((capture) => capture.captureId);
let preflight = null;
if (profile === "rq2" && manifest.nativeRevalidation?.status === "not-evaluated") {
  console.warn("[RQ2] Native M3 capture not attempted: the v2 scene-source attestation is not evaluated.");
  const nativeArtifactsPresent = await anyNativeArtifacts(outputDirectory, nativeCaptureSpecs);
  if (nativeArtifactsPresent) {
    throw new Error("RQ2 native artifacts exist despite the not-evaluated status; use a fresh working output directory.");
  }
  nativeStatus = {
    schemaVersion: "rq2-native-status-v1",
    status: "not-evaluated",
    captureProfile: profile,
    reasonClass: "source-revision-unverified",
    captureRunId: captureRun.captureRunId,
    sourceCommit: captureRun.sourceCommit,
    command: null,
    backend: "webgpu-renderer/webgpu",
    authorization: {
      feature: "Architecture Rise M3 Raw RTT only",
      sourceRevision: manifest.nativeRevalidation.sourceRevision,
      evidenceRevision: expectedM3Evidence,
      rawPilot: true,
      physicalCocResearch: false,
      apertureGatherResearch: false,
      m6Presentation: false,
      m6Qualification: false,
    },
    preflight: null,
    nativeTest: { captureAttempted: false, exitCode: null, signal: null, error: null },
    exitCode: null,
    signal: null,
    error: null,
    capturedCaptureIds: [],
    missingCaptureIds: missingNativeCaptureIds,
    blocker: manifest.nativeRevalidation.blocker,
    failureSummary: null,
  };
} else {
  native = run(
    "authorized native WebGPU M3 Raw captures",
    process.execPath,
    [...commonArgs, "--project=chrome-native-webgpu"],
    cleanCaptureEnvironment("webgpu", outputDirectory, captureRun),
  );
  nativeCaptureIds = await findCurrentCaptureIds(nativeCaptureSpecs, outputDirectory, captureRun);
  missingNativeCaptureIds = nativeCaptureSpecs
    .map((capture) => capture.captureId)
    .filter((captureId) => !nativeCaptureIds.includes(captureId));
  preflight = await readJsonIfExists(resolve(outputDirectory, "captures/native-preflight.json"));
  const nativeArtifactsPresent = await anyNativeArtifacts(outputDirectory, nativeCaptureSpecs);
  const preflightStatus = classifyNativePreflight(preflight, captureRun);
  const nativeOutcome = classifyNativeCaptureOutcome({
    preflight,
    captureRun,
    processExitCode: native.exitCode,
    processSignal: native.signal,
    captureAttempted: preflightStatus === "available",
    expectedCaptureIds: nativeCaptureSpecs.map((capture) => capture.captureId),
    currentCaptureIds: nativeCaptureIds,
    nativeArtifactsPresent,
  });
  nativeStatus = {
    schemaVersion: "rq1-native-status-v1",
    status: nativeOutcome.status,
    captureProfile: profile,
    reasonClass: nativeOutcome.reasonClass,
    captureRunId: captureRun.captureRunId,
    sourceCommit: captureRun.sourceCommit,
    command: profile === "rq2" ? "npm run render-quality:rq2:capture" : "npm run render-quality:rq1:capture",
    backend: "webgpu-renderer/webgpu",
    authorization: {
      feature: "Architecture Rise M3 Raw RTT only",
      sourceRevision: manifest.sceneSourceRevision,
      evidenceRevision: expectedM3Evidence,
      rawPilot: true,
      physicalCocResearch: false,
      apertureGatherResearch: false,
      m6Presentation: false,
      m6Qualification: false,
    },
    preflight,
    nativeTest: {
      captureAttempted: preflightStatus === "available",
      exitCode: native.exitCode,
      signal: native.signal,
      error: native.error,
    },
    exitCode: native.exitCode,
    signal: native.signal,
    error: native.error,
    capturedCaptureIds: nativeCaptureIds,
    missingCaptureIds: missingNativeCaptureIds,
    blocker: nativeOutcome.status === "blocked" ? `Native prerequisite unavailable: ${preflight.probeStatus}.` : null,
    failureSummary: nativeOutcome.status === "invalid"
      ? (native.stderr || native.stdout || native.error || "Native capture failed without process output.").slice(-12000)
      : null,
  };
}
await writeFile(resolve(outputDirectory, "captures/native-status.json"), JSON.stringify(nativeStatus, null, 2) + "\n");

captureRun.capturedCaptureIds = [...new Set([...observerCaptures.map((capture) => capture.captureId), ...webglCaptureIds, ...nativeCaptureIds])];
captureRun.webglStatus = webglStatus.status;
captureRun.nativeStatus = nativeStatus.status;
captureRun.nativeReasonClass = nativeStatus.reasonClass;
captureRun.status = webglStatus.status !== "captured"
  ? "invalid"
  : nativeStatus.status === "blocked"
    ? "native-blocked"
    : nativeStatus.status === "not-evaluated"
      ? "native-not-evaluated"
    : nativeStatus.status === "captured"
      ? "captured"
      : "invalid";
await writeFile(captureRunPath, JSON.stringify(captureRun, null, 2) + "\n");

if (webglStatus.status !== "captured") {
  throw new Error(`WebGL capture is ${webglStatus.status}; see ${relative(repositoryRoot, resolve(outputDirectory, "captures/webgl-status.json"))}.`);
}
if (nativeStatus.status === "blocked") {
  console.warn(`[${profile.toUpperCase()}] Native environment unavailable (${preflight.probeStatus}). WebGL evidence is available; native rendering was not validated.`);
} else if (nativeStatus.status === "not-evaluated") {
  console.warn(`[RQ2] WebGL evidence is valid; native M3 was not evaluated for source ${manifest.sceneSourceRevision}.`);
} else if (nativeStatus.status === "invalid") {
  throw new Error(`Native capture is invalid (process exit ${String(native?.exitCode)}${native?.signal ? `, signal ${native.signal}` : ""}); see ${relative(repositoryRoot, resolve(outputDirectory, "captures/native-status.json"))}.`);
}

console.log(`\n[${profile.toUpperCase()}] Evidence written under ${relative(repositoryRoot, outputDirectory)} (source HEAD ${sourceCommit}).`);

function runGit(args) {
  const result = spawnSync("git", args, { cwd: repositoryRoot, encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr || `git ${args.join(" ")} failed`);
  return result.stdout.trim();
}

async function readJsonIfExists(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return null;
    throw error;
  }
}

async function anyNativeArtifacts(outputDirectory, captures) {
  for (const capture of captures) {
    for (const path of [
      resolve(outputDirectory, capture.path),
      resolve(outputDirectory, "captures", `${capture.captureId}.json`),
    ]) {
      try {
        await lstat(path);
        return true;
      } catch (error) {
        if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT")) throw error;
      }
    }
  }
  return false;
}
