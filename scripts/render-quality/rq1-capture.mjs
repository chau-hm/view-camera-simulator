import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

const repositoryRoot = process.cwd();
const defaultOutput = "docs/render-quality/rq1-baseline";
const stateManifestPath = resolve(repositoryRoot, "docs/render-quality/rq1-baseline/states.json");
const dreamLoopDirectory = resolve(repositoryRoot, ".dream-loop/architecture-rise");

function parseOutputDirectory(args) {
  if (args.length === 0) return resolve(repositoryRoot, defaultOutput);
  if (args.length !== 2 || args[0] !== "--output-dir" || !args[1]) {
    throw new Error("Usage: npm run render-quality:rq1:capture -- [--skip-observer] [--output-dir docs/render-quality/<name>]");
  }
  if (isAbsolute(args[1])) throw new Error("--output-dir must be a repository-relative docs/render-quality path");
  const output = resolve(repositoryRoot, args[1]);
  const outputRelative = relative(repositoryRoot, output);
  if (
    outputRelative === ".." ||
    outputRelative.startsWith(".." + sep) ||
    isAbsolute(outputRelative) ||
    !outputRelative.startsWith("docs" + sep + "render-quality" + sep)
  ) {
    throw new Error("--output-dir must stay under docs/render-quality/");
  }
  return output;
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
    status: result.status ?? 1,
    signal: result.signal ?? null,
    stdout,
    stderr,
    error: result.error?.message ?? null,
  };
}

function cleanCaptureEnvironment(backend, outputDirectory) {
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
  env.RQ1_CAPTURE_OUTPUT_DIR = outputDirectory;
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

async function copyObserverEvidence(outputDirectory, sourceCommit, manifest) {
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
      captureId: `architecture-rise-${view}`,
      stateId: "architecture-rise-observer-dream-loop-reference",
      sourceCommit,
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
        optimizationSurface: sidecar.optimizationSurface,
        hiddenDomControls: sidecar.hiddenDomControls,
        overlays: sidecar.overlays,
        subject: sidecar.subject,
      },
    };
    await writeFile(targetMetadata, JSON.stringify(metadata, null, 2) + "\n");
    captureRecords.push(targetMetadata);
  }
  return captureRecords;
}

const captureArgs = process.argv.slice(2);
const skipObserver = captureArgs.includes("--skip-observer");
const outputArgs = captureArgs.filter((argument) => argument !== "--skip-observer");
const outputDirectory = parseOutputDirectory(outputArgs);
const manifest = JSON.parse(await readFile(stateManifestPath, "utf8"));
const sourceCommit = runGit(["rev-parse", "HEAD"]);
const expectedM3Evidence = "m3-architecture-rise-raw-rtt-native-r187-v1";
if (manifest.sceneId !== "architecture-rise" || manifest.rendererRevision !== "r187") {
  throw new Error("RQ1 state manifest does not match the accepted Architecture Rise r187 baseline.");
}
for (const state of manifest.states) {
  if (state.captures.some((capture) => capture.rendererFamily === "webgpu-renderer" && capture.featureEvidenceRevision !== expectedM3Evidence)) {
    throw new Error(`The native capture state ${state.stateId} does not bind to the authorized M3 r187 evidence.`);
  }
}

await mkdir(outputDirectory, { recursive: true });
const dreamLoopEnv = {
  ...process.env,
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
await copyObserverEvidence(outputDirectory, sourceCommit, manifest);

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
  cleanCaptureEnvironment("webgl", outputDirectory),
);
const webglStatus = {
  status: webgl.status === 0 ? "captured" : "blocked",
  command: "npm run render-quality:rq1:capture",
  backend: "webgl-renderer/webgl2",
  exitCode: webgl.status,
  error: webgl.error,
  failureSummary: webgl.status === 0 ? null : (webgl.stderr || webgl.stdout).slice(-8000),
};
await writeFile(resolve(outputDirectory, "captures/webgl-status.json"), JSON.stringify(webglStatus, null, 2) + "\n");

const native = run(
  "authorized native WebGPU M3 Raw captures",
  process.execPath,
  [...commonArgs, "--project=chrome-native-webgpu"],
  cleanCaptureEnvironment("webgpu", outputDirectory),
);
const nativeCaptureSpecs = manifest.states.flatMap((state) =>
  state.captures.filter((capture) => capture.rendererFamily === "webgpu-renderer"),
);
const nativeCaptureIds = [];
for (const capture of nativeCaptureSpecs) {
  try {
    await readFile(resolve(outputDirectory, "captures", `${capture.captureId}.json`));
    nativeCaptureIds.push(capture.captureId);
  } catch {
    // A capture is listed only when the test wrote its validated PNG and metadata.
  }
}
const missingNativeCaptureIds = nativeCaptureSpecs
  .map((capture) => capture.captureId)
  .filter((captureId) => !nativeCaptureIds.includes(captureId));
const nativeStatus = {
  status: native.status === 0 && missingNativeCaptureIds.length === 0
    ? "captured"
    : missingNativeCaptureIds.length > 0
      ? "blocked"
      : "invalid",
  command: "npm run render-quality:rq1:capture",
  backend: "webgpu-renderer/webgpu",
  authorization: {
    feature: "Architecture Rise M3 Raw RTT only",
    evidenceRevision: expectedM3Evidence,
    rawPilot: true,
    physicalCocResearch: false,
    apertureGatherResearch: false,
    m6Presentation: false,
    m6Qualification: false,
  },
  exitCode: native.status,
  signal: native.signal,
  error: native.error,
  capturedCaptureIds: nativeCaptureIds,
  missingCaptureIds: missingNativeCaptureIds,
  blocker: native.status === 0 && missingNativeCaptureIds.length === 0
    ? null
    : (native.stderr || native.stdout || native.error || "Native capture failed without process output.").slice(-12000),
};
await writeFile(resolve(outputDirectory, "captures/native-status.json"), JSON.stringify(nativeStatus, null, 2) + "\n");

if (webgl.status !== 0) {
  throw new Error(`WebGL capture is ${webglStatus.status}; see ${relative(repositoryRoot, resolve(outputDirectory, "captures/webgl-status.json"))}.`);
}
if (nativeStatus.status === "blocked") {
  console.warn(`[RQ1] Native WebGPU capture is explicitly blocked. Missing: ${missingNativeCaptureIds.join(", ") || "none"}.`);
} else if (nativeStatus.status === "invalid") {
  throw new Error("Native capture process failed even though it wrote all expected captures; inspect its runtime log before accepting them.");
}

console.log(`\n[RQ1] Evidence written under ${relative(repositoryRoot, outputDirectory)} (source HEAD ${sourceCommit}).`);

function runGit(args) {
  const result = spawnSync("git", args, { cwd: repositoryRoot, encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr || `git ${args.join(" ")} failed`);
  return result.stdout.trim();
}
