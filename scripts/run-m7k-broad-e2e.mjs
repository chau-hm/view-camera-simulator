import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { closeSync, existsSync, lstatSync, mkdirSync, openSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import os from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

const toolingRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const pinnedExecutionSha = "e6066a244510387c32995c1e973a771667b04d10";
const reportDir = "docs/architecture/ground-glass-m7k-broad-e2e";
const runnerSourcePath = "scripts/run-m7k-broad-e2e.mjs";
const evaluatorSourcePath = "src/render/testing/groundGlassM7kBroadE2eQualification.ts";
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const inside = (parent, child) => {
  const path = relative(parent, child);
  return path === "" || (!isAbsolute(path) && path !== ".." && !path.startsWith(`..${sep}`));
};

const git = (cwd, args, allowFailure = false) => {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (!allowFailure && result.status !== 0) {
    throw new Error(`git -C ${cwd} ${args.join(" ")} failed: ${result.stderr.trim()}`);
  }
  return { status: result.status ?? 1, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
};

const gitText = (cwd, args) => git(cwd, args).stdout.trim();

const parseArgs = () => {
  const values = new Map();
  let preflightOnly = false;
  for (const argument of process.argv.slice(2)) {
    if (argument === "--preflight-only") {
      if (preflightOnly) throw new Error("Duplicate option: --preflight-only");
      preflightOnly = true;
      continue;
    }
    const match = argument.match(/^--([a-z-]+)=(.+)$/);
    if (!match || values.has(match[1])) throw new Error(`Unsupported or duplicate option: ${argument}`);
    values.set(match[1], match[2]);
  }
  const supported = new Set([
    "execution-worktree",
    "output-dir",
    "ordinary-grep",
    "renderer-serial-grep",
  ]);
  if ([...values.keys()].some((key) => !supported.has(key))) {
    throw new Error("Options: --execution-worktree=<path> [--output-dir=<repo-relative-path>] " +
      "[--ordinary-grep=<pattern> --renderer-serial-grep=<pattern>] [--preflight-only]");
  }
  const executionWorktreeArg = values.get("execution-worktree");
  if (!executionWorktreeArg) throw new Error("--execution-worktree is required; prepare a separate clean worktree at the pinned source first");
  const ordinaryGrep = values.get("ordinary-grep");
  const rendererSerialGrep = values.get("renderer-serial-grep");
  const selectedMode = ordinaryGrep !== undefined || rendererSerialGrep !== undefined;
  if (selectedMode && (!ordinaryGrep || !rendererSerialGrep)) {
    throw new Error("Selected captures require both --ordinary-grep and --renderer-serial-grep");
  }
  if (preflightOnly && selectedMode) throw new Error("--preflight-only cannot be combined with selected test filters");
  const stamp = new Date().toISOString().replaceAll(":", "-");
  const requestedOutputDir = values.get("output-dir") ?? `${reportDir}/runs/${stamp}`;
  const outputDir = requestedOutputDir.replaceAll("\\", "/");
  const outputSegments = outputDir.split("/");
  const outputRoot = resolve(toolingRoot, outputDir);
  if (isAbsolute(requestedOutputDir) || /^[a-zA-Z]:/.test(requestedOutputDir) ||
      outputSegments.some((segment) => !segment || segment === "." || segment === "..") ||
      !inside(toolingRoot, outputRoot) || outputRoot === toolingRoot) {
    throw new Error("--output-dir must be a non-root path inside the tooling worktree");
  }
  if (existsSync(outputRoot)) throw new Error(`Output directory already exists; refusing to overwrite: ${outputDir}`);
  const executionRoot = realpathSync(resolve(toolingRoot, executionWorktreeArg));
  return {
    outputDir,
    outputRoot,
    executionRoot,
    preflightOnly,
    captureMode: selectedMode ? "selected" : "full",
    selection: selectedMode ? { ordinaryGrep, rendererSerialGrep } : null,
  };
};

const baselineEnvironment = () => {
  const env = { ...process.env };
  for (const name of [
    "OBSERVER_NATIVE_WEBGPU_REQUIRED",
    "GROUND_GLASS_NATIVE_WEBGPU_REQUIRED",
    "GROUND_GLASS_WEBGPU_FAILURE_INTEGRATION",
    "GROUND_GLASS_WEBGPU_PHYSICAL_COC_RESEARCH",
    "GROUND_GLASS_WEBGPU_PHYSICAL_COC_R187_QUALIFICATION",
    "GROUND_GLASS_WEBGPU_APERTURE_GATHER_RESEARCH",
    "GROUND_GLASS_WEBGPU_APERTURE_GATHER_R187_QUALIFICATION",
    "GROUND_GLASS_WEBGPU_M6_PRESENTATION_REQUIRED",
    "GROUND_GLASS_WEBGPU_M6_R187_QUALIFICATION_REQUIRED",
    "GROUND_GLASS_WEBGPU_M7G_R187_QUALIFICATION_REQUIRED",
  ]) delete env[name];
  const nodeBin = dirname(process.execPath);
  env.PATH = [nodeBin, env.PATH].filter(Boolean).join(sep === "\\" ? ";" : ":");
  return Object.assign(env, {
    VITE_GROUND_GLASS_WEBGPU_RAW_PILOT: "false",
    VITE_GROUND_GLASS_WEBGPU_TEST_SEAM: "false",
    VITE_GROUND_GLASS_WEBGPU_PHYSICAL_COC_RESEARCH: "false",
    VITE_GROUND_GLASS_WEBGPU_GATHER_RESEARCH: "false",
    VITE_GROUND_GLASS_WEBGPU_M6_PRESENTATION: "false",
    VITE_GROUND_GLASS_WEBGPU_M6_R187_QUALIFICATION: "false",
  });
};

const requireCleanWorktree = (cwd, label) => {
  const status = gitText(cwd, ["status", "--porcelain", "--untracked-files=all"]);
  if (status) throw new Error(`${label} worktree must be clean before capture:\n${status}`);
};

const requireSourceFile = (cwd, sha, sourcePath) => {
  const result = git(cwd, ["cat-file", "-e", `${sha}:${sourcePath}`], true);
  if (result.status !== 0) throw new Error(`Source file ${sourcePath} is unavailable at ${sha}`);
};

const readPackageFromEntry = (entryPath, packageName) => {
  let directory = dirname(realpathSync(entryPath));
  while (inside(resolve(directory, ".."), directory)) {
    const packagePath = join(directory, "package.json");
    if (existsSync(packagePath)) {
      const value = JSON.parse(readFileSync(packagePath, "utf8"));
      if (value.name === packageName) return { path: packagePath, value };
    }
    const parent = dirname(directory);
    if (parent === directory) break;
    directory = parent;
  }
  throw new Error(`Could not locate ${packageName}/package.json from ${entryPath}`);
};

const runExternal = (command, args, { cwd, env, maxBuffer = 8 * 1024 * 1024 } = {}) => {
  const result = spawnSync(command, args, { cwd, env, encoding: "utf8", maxBuffer });
  if (result.error) throw result.error;
  return { status: result.status ?? 1, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
};

const inspectPlaywrightConfig = (executionRoot, env) => {
  const configPath = resolve(executionRoot, "playwright.config.ts");
  const configUrl = pathToFileURL(configPath).href;
  const code = `const c=(await import(${JSON.stringify(configUrl)})).default;` +
    `process.stdout.write(JSON.stringify({timeout:c.timeout??null,retries:c.retries??0,projects:(c.projects??[]).map(p=>({name:p.name,workers:p.workers??null,retries:p.retries??c.retries??0,viewport:p.use?.viewport??null,headless:p.use?.headless??null,channel:p.use?.channel??null})),webServerEnv:c.webServer?.env??{}}));`;
  const result = runExternal(process.execPath, ["--experimental-strip-types", "--input-type=module", "-e", code], {
    cwd: executionRoot,
    env,
  });
  if (result.status !== 0) throw new Error(`Could not inspect execution Playwright config: ${result.stderr.trim()}`);
  return JSON.parse(result.stdout);
};

const collectRuntime = async (executionRoot, env) => {
  const nodeRuntimeResult = runExternal("node", ["-e", "process.stdout.write(JSON.stringify({version:process.version,platform:process.platform,architecture:process.arch}))"], {
    cwd: executionRoot,
    env,
  });
  if (nodeRuntimeResult.status !== 0) throw new Error(`Execution Node.js could not be run: ${nodeRuntimeResult.stderr.trim()}`);
  const nodeRuntime = JSON.parse(nodeRuntimeResult.stdout);
  if (nodeRuntime.version !== process.version) {
    throw new Error(`Tooling Node ${process.version} differs from execution Node ${nodeRuntime.version}; use the same Node runtime for both worktrees`);
  }
  if (Number(nodeRuntime.version.replace(/^v/, "").split(".")[0]) < 24) {
    throw new Error(`M7K capture requires Node.js 24 or newer; found ${nodeRuntime.version}`);
  }

  const nodeModules = join(executionRoot, "node_modules");
  if (!existsSync(nodeModules)) throw new Error(`Execution worktree has no node_modules; run npm ci in ${executionRoot}`);
  if (lstatSync(nodeModules).isSymbolicLink()) {
    throw new Error("Execution node_modules must be installed in the execution worktree; linked parent installations are not accepted");
  }
  if (!existsSync(join(nodeModules, ".package-lock.json"))) {
    throw new Error("Execution node_modules has no npm hidden lockfile; run npm ci in the execution worktree");
  }

  const packageJson = JSON.parse(readFileSync(join(executionRoot, "package.json"), "utf8"));
  const lock = JSON.parse(readFileSync(join(executionRoot, "package-lock.json"), "utf8"));
  const lockedPlaywright = lock.packages?.["node_modules/playwright"]?.version;
  const lockedThree = lock.packages?.["node_modules/three"]?.version;
  if (!lockedPlaywright || !lockedThree) throw new Error("Execution package-lock.json does not pin Playwright and Three.js");
  const executionRequire = createRequire(join(executionRoot, "package.json"));
  const playwrightEntry = realpathSync(executionRequire.resolve("playwright"));
  const threeEntry = realpathSync(executionRequire.resolve("three"));
  if (!inside(realpathSync(nodeModules), playwrightEntry) || !inside(realpathSync(nodeModules), threeEntry)) {
    throw new Error("Playwright or Three.js resolved outside the execution worktree node_modules");
  }
  const playwrightPackage = readPackageFromEntry(playwrightEntry, "playwright").value;
  const threePackage = readPackageFromEntry(threeEntry, "three").value;
  const three = executionRequire("three");
  const threeVersion = String(threePackage.version ?? "");
  const threeRevision = String(three.REVISION ?? "");
  const expectedThreeRevision = threeVersion.match(/^0\.(\d+)\./)?.[1] ?? "";
  if (playwrightPackage.version !== lockedPlaywright) {
    throw new Error(`Installed Playwright ${playwrightPackage.version} does not match execution lockfile ${lockedPlaywright}`);
  }
  if (threeVersion !== lockedThree || threeVersion !== "0.187.0" || threeRevision !== expectedThreeRevision) {
    throw new Error(`Installed Three.js ${threeVersion} (revision ${threeRevision}) does not match pinned lockfile Three.js ${lockedThree}; M7K requires 0.187.0`);
  }

  const hiddenLock = JSON.parse(readFileSync(join(nodeModules, ".package-lock.json"), "utf8"));
  for (const [packagePath, actual] of Object.entries(hiddenLock.packages ?? {})) {
    if (!packagePath || !packagePath.startsWith("node_modules/")) continue;
    const expected = lock.packages?.[packagePath];
    if (!expected || actual.version !== expected.version ||
        (expected.resolved && actual.resolved !== expected.resolved) ||
        (expected.integrity && actual.integrity !== expected.integrity)) {
      throw new Error(`Execution installed dependency ${packagePath} does not match package-lock.json; run npm ci`);
    }
  }

  const npmVersion = runExternal("npm", ["--version"], { cwd: executionRoot, env });
  if (npmVersion.status !== 0 || !/^\d+\.\d+\.\d+$/.test(npmVersion.stdout.trim())) {
    throw new Error(`Could not determine execution npm version: ${npmVersion.stderr.trim()}`);
  }
  const npmTree = runExternal("npm", ["ls", "--depth=0", "--json"], { cwd: executionRoot, env });
  if (npmTree.status !== 0) throw new Error(`Execution dependencies do not match package-lock.json; run npm ci. ${npmTree.stderr.trim()}`);

  const config = inspectPlaywrightConfig(executionRoot, env);
  const ordinaryProject = config.projects.find((project) => project.name === "chromium");
  const serialProject = config.projects.find((project) => project.name === "chromium-renderer-serial");
  if (!ordinaryProject || !serialProject || !ordinaryProject.viewport || !serialProject.viewport) {
    throw new Error("Execution Playwright config is missing the ordinary or renderer-serial Chromium project or its viewport");
  }
  if (JSON.stringify(ordinaryProject.viewport) !== JSON.stringify(serialProject.viewport)) {
    throw new Error("Ordinary and renderer-serial project viewports differ");
  }
  if (ordinaryProject.channel || serialProject.channel) {
    throw new Error("M7K preflight launches the Playwright-managed Chromium build; custom browser channels are not supported");
  }
  if (ordinaryProject.headless === false || serialProject.headless === false) {
    throw new Error("M7K runner requires both Chromium projects to be headless");
  }
  const testSeamValue = config.webServerEnv.VITE_GROUND_GLASS_WEBGPU_TEST_SEAM;
  if (testSeamValue !== "false") throw new Error(`Execution Playwright config enables the test seam (${testSeamValue})`);

  const { chromium } = executionRequire("playwright");
  let browser;
  let browserVersion;
  let browserEvidence;
  try {
    browser = await chromium.launch({ headless: true });
    browserVersion = browser.version();
    const page = await browser.newPage({ viewport: ordinaryProject.viewport });
    browserEvidence = await page.evaluate(() => {
      const canvas = document.createElement("canvas");
      const gl = canvas.getContext("webgl2");
      const extension = gl?.getExtension("WEBGL_debug_renderer_info");
      return {
        userAgent: navigator.userAgent,
        viewport: { width: window.innerWidth, height: window.innerHeight },
        webgl2Available: Boolean(gl),
        webglVersion: gl ? gl.getParameter(gl.VERSION) : null,
        unmaskedVendor: gl && extension ? gl.getParameter(extension.UNMASKED_VENDOR_WEBGL) : null,
        unmaskedRenderer: gl && extension ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) : null,
      };
    });
  } finally {
    if (browser) await browser.close();
  }
  const browserMatch = browserEvidence.userAgent.match(/(?:Chrome|HeadlessChrome)\/([\d.]+)/);
  if (!browserVersion || !browserMatch || browserMatch[1] !== browserVersion) {
    throw new Error(`Playwright browser.version() ${browserVersion || "missing"} disagrees with launched Chromium user agent ${browserEvidence.userAgent}`);
  }
  if (!browserEvidence.webgl2Available || browserEvidence.viewport.width !== ordinaryProject.viewport.width ||
      browserEvidence.viewport.height !== ordinaryProject.viewport.height) {
    throw new Error("Preflight Chromium did not provide the configured viewport and a WebGL2 context");
  }

  return {
    executionRequire,
    playwrightVersion: playwrightPackage.version,
    browserVersion,
    threeJsVersion: threeVersion,
    threeRevision,
    npmVersion: npmVersion.stdout.trim(),
    runtime: nodeRuntime,
    config,
    browserEvidence,
    lockedVersions: { playwright: lockedPlaywright, three: lockedThree },
    toolingNodeVersion: process.version,
    toolingPlatform: process.platform,
    toolingArchitecture: process.arch,
    osRelease: os.release(),
    packageName: packageJson.name,
  };
};

const parseIdentities = (text, project) => text.split(/\r?\n/).flatMap((line) => {
  const match = line.match(/^\s+\[([^\]]+)\]\s+›\s+(.+?):\d+:\d+\s+›\s+(.*)$/);
  if (!match || match[1] !== project) return [];
  return [`${basename(match[2])}::${match[3].split(/\s+›\s+/).map((part) => part.trim()).filter(Boolean).join("::")}`];
});

const runDiscovery = ({ executionRoot, env, project, workers, outputPath, logPath, noDeps = false }) => {
  const args = ["--project", project];
  if (noDeps) args.push("--no-deps");
  args.push("--workers", String(workers), "--list");
  const result = runExternal("npm", ["run", "test:e2e", "--", ...args], { cwd: executionRoot, env });
  const output = `${result.stdout}${result.stderr}`;
  writeFileSync(resolve(toolingRoot, logPath), output);
  writeFileSync(resolve(toolingRoot, outputPath), output);
  return {
    projectName: project,
    command: `npm run test:e2e -- --project=${project}${noDeps ? " --no-deps" : ""} --workers=${workers} --list`,
    exitCode: result.status,
    outputPath,
    outputSha256: sha256(readFileSync(resolve(toolingRoot, outputPath))),
    identities: parseIdentities(output, project),
    processError: result.stderr && result.status === 1 ? result.stderr.trim() : "",
  };
};

const parseObserverEnvironment = (consoleOutput) => {
  const evidence = [];
  for (const line of consoleOutput.split(/\r?\n/)) {
    const match = line.match(/^Observer environment evidence (webgl|webgpu): (\{.*\})$/);
    if (!match) continue;
    try {
      const value = JSON.parse(match[2]);
      if (value && typeof value === "object" && value.runtime && typeof value.runtime === "object") {
        evidence.push({ kind: match[1], ...value, runtime: value.runtime });
      }
    } catch {
      // Malformed diagnostics remain absent and the evaluator rejects them.
    }
  }
  return evidence;
};

const runCapture = ({ executionRoot, env, args, port, outputPath, logPath }) => {
  const logFd = openSync(resolve(toolingRoot, logPath), "wx");
  const captureEnv = Object.assign({}, env, {
    PLAYWRIGHT_WEB_SERVER_PORT: String(port),
    PLAYWRIGHT_JSON_OUTPUT_NAME: resolve(toolingRoot, outputPath),
  });
  let result;
  try {
    result = spawnSync("npm", ["run", "test:e2e", "--", ...args], {
      cwd: executionRoot,
      env: captureEnv,
      stdio: ["ignore", logFd, logFd],
    });
  } finally {
    closeSync(logFd);
  }
  const exitCode = result?.status ?? 1;
  writeFileSync(resolve(toolingRoot, logPath.replace(/-console\.log$/, "-exit-code.txt")), `${exitCode}\n`);
  return { exitCode, spawnError: result?.error?.message ?? null, rawPresent: existsSync(resolve(toolingRoot, outputPath)) };
};

const makeEnvironment = (runtime, ordinaryLog = "") => {
  const events = parseObserverEnvironment(ordinaryLog);
  const webglRuntime = events.find((entry) => entry.kind === "webgl" && entry.runtime.executionBackend === "webgl2");
  const webgpuFallbackRuntime = events.find((entry) => entry.kind === "webgpu" && entry.runtime.executionBackend === "webgl2-fallback");
  const runtimeMatches = events.every((entry) => entry.runtime.browserVersion === runtime.browserVersion &&
    entry.runtime.threeRevision === runtime.threeRevision &&
    entry.runtime.hostPlatform === runtime.runtime.platform &&
    entry.runtime.hostArchitecture === runtime.runtime.architecture);
  return {
    platform: runtime.runtime.platform,
    osRelease: runtime.osRelease,
    architecture: runtime.runtime.architecture,
    nodeVersion: runtime.runtime.version,
    toolingNodeVersion: runtime.toolingNodeVersion,
    npmVersion: runtime.npmVersion,
    playwrightVersion: runtime.playwrightVersion,
    browserName: "chromium",
    browserMode: "headless",
    browserVersion: runtime.browserVersion,
    browserProject: "chromium",
    browserUserAgent: runtime.browserEvidence.userAgent,
    browserWebGlProbe: {
      webgl2Available: runtime.browserEvidence.webgl2Available,
      webglVersion: runtime.browserEvidence.webglVersion,
      unmaskedVendor: runtime.browserEvidence.unmaskedVendor,
      unmaskedRenderer: runtime.browserEvidence.unmaskedRenderer,
    },
    viewport: runtime.browserEvidence.viewport,
    threeJsVersion: runtime.threeJsVersion,
    threeRevision: runtime.threeRevision,
    webglBackend: webglRuntime && webgpuFallbackRuntime && runtimeMatches ? "webgl2-fallback" : "unverified",
    nativeWebGpuRequested: false,
    nativeWebGpuRuntimeEvidence: events.length > 0 && events.every((entry) => entry.nativeRequired === false),
    productionPreviewTestsIncluded: false,
    testSeamEnabled: runtime.config.webServerEnv.VITE_GROUND_GLASS_WEBGPU_TEST_SEAM === "true",
    featureFlags: {
      groundGlassWebGpuRawPilot: runtime.config.webServerEnv.VITE_GROUND_GLASS_WEBGPU_RAW_PILOT ?? "false",
      groundGlassTestSeam: runtime.config.webServerEnv.VITE_GROUND_GLASS_WEBGPU_TEST_SEAM ?? "false",
      groundGlassPhysicalCocResearch: runtime.config.webServerEnv.VITE_GROUND_GLASS_WEBGPU_PHYSICAL_COC_RESEARCH ?? "false",
      groundGlassGatherResearch: runtime.config.webServerEnv.VITE_GROUND_GLASS_WEBGPU_GATHER_RESEARCH ?? "false",
      groundGlassM6Presentation: runtime.config.webServerEnv.VITE_GROUND_GLASS_WEBGPU_M6_PRESENTATION ?? "false",
      groundGlassM6Qualification: runtime.config.webServerEnv.VITE_GROUND_GLASS_WEBGPU_M6_R187_QUALIFICATION ?? "false",
    },
    configuredExpectations: {
      ordinaryWorkers: 4,
      rendererSerialWorkers: 1,
      retries: 0,
      browserMode: "headless",
      browserProject: "chromium",
    },
    ordinaryWorkers: 4,
    rendererSerialWorkers: 1,
    retries: 0,
    projectConfig: {
      ordinary: runtime.config.projects.find((project) => project.name === "chromium"),
      rendererSerial: runtime.config.projects.find((project) => project.name === "chromium-renderer-serial"),
      configuredTimeoutMs: runtime.config.timeout,
    },
    dependencyLock: runtime.lockedVersions,
  };
};

const validateDiscovery = (discovery) => {
  if (discovery.ordinary.exitCode !== 0 || discovery.rendererSerial.exitCode !== 0) {
    throw new Error(`Discovery failed (ordinary ${discovery.ordinary.exitCode}; renderer serial ${discovery.rendererSerial.exitCode})`);
  }
  const ordinary = discovery.ordinary.identities;
  const serial = discovery.rendererSerial.identities;
  if (ordinary.length !== 274 || serial.length !== 4 || new Set([...ordinary, ...serial]).size !== 278 ||
      ordinary.some((identity) => serial.includes(identity))) {
    throw new Error(`Pinned source discovery differs from the accepted inventory (ordinary ${ordinary.length}; renderer serial ${serial.length})`);
  }
};

const main = async () => {
  const options = parseArgs();
  const toolingRootReal = realpathSync(toolingRoot);
  if (options.executionRoot === toolingRootReal) throw new Error("Tooling and execution worktrees must be separate directories");
  const executionGitRoot = realpathSync(gitText(options.executionRoot, ["rev-parse", "--show-toplevel"]));
  if (executionGitRoot !== options.executionRoot) throw new Error("--execution-worktree must name the execution worktree root");
  const executionSourceCommitSha = gitText(options.executionRoot, ["rev-parse", "--verify", "HEAD"]);
  if (executionSourceCommitSha !== pinnedExecutionSha) {
    throw new Error(`Execution worktree must be pinned to ${pinnedExecutionSha}; found ${executionSourceCommitSha}`);
  }
  requireCleanWorktree(options.executionRoot, "Execution");
  requireCleanWorktree(toolingRootReal, "Tooling");

  const toolingCommitSha = gitText(toolingRootReal, ["rev-parse", "--verify", "HEAD"]);
  const evaluationCommitSha = gitText(toolingRootReal, ["log", "-1", "--format=%H", "--", evaluatorSourcePath]);
  for (const sha of [toolingCommitSha, evaluationCommitSha]) {
    if (!/^[0-9a-f]{40}$/.test(sha)) throw new Error("Tooling and evaluator commits must resolve to full Git commit SHAs");
  }
  if (toolingCommitSha === executionSourceCommitSha || evaluationCommitSha === executionSourceCommitSha) {
    throw new Error("Tooling and evaluator source identities must differ from the pinned execution source");
  }
  requireSourceFile(toolingRootReal, toolingCommitSha, runnerSourcePath);
  requireSourceFile(toolingRootReal, evaluationCommitSha, evaluatorSourcePath);

  if (Number(process.versions.node.split(".")[0]) < 24) {
    throw new Error(`M7K capture requires Node.js 24 or newer; found ${process.version}`);
  }
  const env = baselineEnvironment();
  const runtime = await collectRuntime(options.executionRoot, env);
  const discoveryDir = `${options.outputDir}/discovery`;
  const executionDir = `${options.outputDir}/execution`;
  mkdirSync(resolve(toolingRoot, discoveryDir), { recursive: true });
  mkdirSync(resolve(toolingRoot, executionDir), { recursive: true });

  const discovery = {
    ordinary: runDiscovery({
      executionRoot: options.executionRoot,
      env,
      project: "chromium",
      workers: 4,
      outputPath: `${discoveryDir}/ordinary-playwright-list.txt`,
      logPath: `${discoveryDir}/ordinary-discovery-console.log`,
    }),
    rendererSerial: runDiscovery({
      executionRoot: options.executionRoot,
      env,
      project: "chromium-renderer-serial",
      workers: 1,
      noDeps: true,
      outputPath: `${discoveryDir}/rendererSerial-playwright-list.txt`,
      logPath: `${discoveryDir}/rendererSerial-discovery-console.log`,
    }),
  };
  validateDiscovery(discovery);

  if (options.preflightOnly) {
    mkdirSync(options.outputRoot, { recursive: true });
    const preflight = {
      schemaVersion: 1,
      status: "passed",
      captureMode: "preflight",
      executionSourceCommitSha,
      toolingCommitSha,
      evaluationCommitSha,
      generatedAt: new Date().toISOString(),
      dependencies: {
        lockfileVersions: runtime.lockedVersions,
        installedPlaywrightVersion: runtime.playwrightVersion,
        installedThreeJsVersion: runtime.threeJsVersion,
        installedThreeRevision: runtime.threeRevision,
        npmVersion: runtime.npmVersion,
        toolingNodeVersion: runtime.toolingNodeVersion,
        executionNodeVersion: runtime.runtime.version,
      },
      browser: {
        version: runtime.browserVersion,
        userAgent: runtime.browserEvidence.userAgent,
        viewport: runtime.browserEvidence.viewport,
        webglProbe: runtime.browserEvidence,
      },
      projects: runtime.config.projects,
      discovery: {
        ordinary: { ...discovery.ordinary, uniqueIdentities: new Set(discovery.ordinary.identities).size },
        rendererSerial: { ...discovery.rendererSerial, uniqueIdentities: new Set(discovery.rendererSerial.identities).size },
        combinedUniqueIdentities: new Set([...discovery.ordinary.identities, ...discovery.rendererSerial.identities]).size,
      },
    };
    const path = resolve(options.outputRoot, "preflight.json");
    writeFileSync(path, `${JSON.stringify(preflight, null, 2)}\n`, { flag: "wx" });
    process.stdout.write(`M7K preflight passed: ${path}\n`);
    process.stdout.write("No Playwright test cases were executed.\n");
    return;
  }

  const ordinaryRaw = `${executionDir}/ordinary-playwright.json`;
  const rendererSerialRaw = `${executionDir}/renderer-serial-playwright.json`;
  const ordinaryConsole = `${executionDir}/ordinary-console.log`;
  const rendererSerialConsole = `${executionDir}/renderer-serial-console.log`;
  const ordinaryArgs = ["--project=chromium", "--workers=4", "--retries=0", "--reporter=list,json"];
  const rendererSerialArgs = ["--project=chromium-renderer-serial", "--no-deps", "--workers=1", "--retries=0", "--reporter=list,json"];
  if (options.selection) {
    ordinaryArgs.push("--grep", options.selection.ordinaryGrep);
    rendererSerialArgs.push("--grep", options.selection.rendererSerialGrep);
  }
  const ordinaryRun = runCapture({
    executionRoot: options.executionRoot,
    env,
    args: ordinaryArgs,
    port: 4471,
    outputPath: ordinaryRaw,
    logPath: ordinaryConsole,
  });
  const rendererSerialRun = runCapture({
    executionRoot: options.executionRoot,
    env,
    args: rendererSerialArgs,
    port: 4472,
    outputPath: rendererSerialRaw,
    logPath: rendererSerialConsole,
  });

  if (!ordinaryRun.rawPresent || !rendererSerialRun.rawPresent) {
    throw new Error(`At least one Playwright JSON report is missing; lane exit codes were ordinary=${ordinaryRun.exitCode}, rendererSerial=${rendererSerialRun.exitCode}. Console and exit-code files were retained.`);
  }
  const ordinaryLogText = readFileSync(resolve(toolingRoot, ordinaryConsole), "utf8");
  const environment = makeEnvironment(runtime, ordinaryLogText);
  const manifest = {
    schemaVersion: 2,
    baseCommitSha: pinnedExecutionSha,
    executionSourceCommitSha,
    toolingCommitSha,
    evaluationCommitSha,
    toolingSourcePath: runnerSourcePath,
    evaluatorSourcePath,
    captureMode: options.captureMode,
    selection: options.selection,
    outputDirectory: options.outputDir,
    generatedAt: new Date().toISOString(),
    environment,
    discovery: {
      ordinary: {
        projectName: discovery.ordinary.projectName,
        command: discovery.ordinary.command,
        exitCode: discovery.ordinary.exitCode,
        outputPath: discovery.ordinary.outputPath,
        outputSha256: discovery.ordinary.outputSha256,
      },
      rendererSerial: {
        projectName: discovery.rendererSerial.projectName,
        command: discovery.rendererSerial.command,
        exitCode: discovery.rendererSerial.exitCode,
        outputPath: discovery.rendererSerial.outputPath,
        outputSha256: discovery.rendererSerial.outputSha256,
      },
    },
    lanes: {
      ordinary: {
        projectName: "chromium",
        command: `npm run test:e2e -- ${ordinaryArgs.join(" ")}`,
        sourceCommitSha: executionSourceCommitSha,
        exitCode: ordinaryRun.exitCode,
        rawReportPath: ordinaryRaw,
        rawReportSha256: sha256(readFileSync(resolve(toolingRoot, ordinaryRaw))),
        consolePath: ordinaryConsole,
        consoleSha256: sha256(readFileSync(resolve(toolingRoot, ordinaryConsole))),
        serverPort: 4471,
        invocationStatus: ordinaryRun.spawnError ? "failed-to-start" : "executed",
        discoveredTestIdentities: discovery.ordinary.identities,
      },
      rendererSerial: {
        projectName: "chromium-renderer-serial",
        command: `npm run test:e2e -- ${rendererSerialArgs.join(" ")}`,
        sourceCommitSha: executionSourceCommitSha,
        exitCode: rendererSerialRun.exitCode,
        rawReportPath: rendererSerialRaw,
        rawReportSha256: sha256(readFileSync(resolve(toolingRoot, rendererSerialRaw))),
        consolePath: rendererSerialConsole,
        consoleSha256: sha256(readFileSync(resolve(toolingRoot, rendererSerialConsole))),
        serverPort: 4472,
        invocationStatus: rendererSerialRun.spawnError ? "failed-to-start" : "executed",
        discoveredTestIdentities: discovery.rendererSerial.identities,
      },
    },
    approvedSkipExclusions: [],
    validation: {
      runner: {
        toolingCommitSha,
        executionSourceCommitSha,
        dependencyInstallPolicy: "execution-worktree-npm-ci-required-and-verified",
        bothLanesInvokedSequentially: true,
        selectedCapture: options.captureMode === "selected",
      },
    },
  };
  const manifestPath = `${options.outputDir}/capture-manifest.json`;
  writeFileSync(resolve(toolingRoot, manifestPath), `${JSON.stringify(manifest, null, 2)}\n`, { flag: "wx" });
  process.stdout.write(`Capture manifest: ${manifestPath}\n`);
  process.stdout.write(`Ordinary exit: ${ordinaryRun.exitCode}; renderer-serial exit: ${rendererSerialRun.exitCode}\n`);
  process.stdout.write("Ordinary and renderer-serial commands ran sequentially; raw test failures are retained as evidence.\n");

  const reportPath = `${options.outputDir}/qualification-report.json`;
  const evaluationPath = `${options.outputDir}/evaluation.json`;
  const evaluation = spawnSync(process.execPath, [
    "scripts/run-m7k-qualification.mjs",
    `--capture-manifest=${manifestPath}`,
    `--report-output=${reportPath}`,
    `--evaluation-output=${evaluationPath}`,
  ], { cwd: toolingRootReal, env, stdio: "inherit" });
  if (evaluation.error) throw evaluation.error;
  if (evaluation.status !== 0) {
    process.stderr.write("M7K offline evidence evaluation failed; captured raw outcomes remain preserved.\n");
    process.exitCode = evaluation.status ?? 1;
    return;
  }
  const result = JSON.parse(readFileSync(resolve(toolingRoot, evaluationPath), "utf8"));
  process.stdout.write(`Evidence integrity: ${result.evidenceIntegrity}; execution completeness: ${result.executionCompleteness}; Broad E2E qualification: ${result.broadE2eQualification}.\n`);
};

try {
  await main();
} catch (error) {
  process.stderr.write(`M7K capture failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
