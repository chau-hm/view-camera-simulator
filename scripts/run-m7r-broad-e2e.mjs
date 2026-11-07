import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { closeSync, existsSync, lstatSync, mkdirSync, openSync, readFileSync, realpathSync, readdirSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import os from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { createServer } from "node:net";

const toolingRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const runnerSourcePath = "scripts/run-m7r-broad-e2e.mjs";
const commitPattern = /^[0-9a-f]{40}$/;
const webGpuEnvironmentNames = [
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
];
const viteWebGpuEnvironment = {
  VITE_GROUND_GLASS_WEBGPU_RAW_PILOT: "false",
  VITE_GROUND_GLASS_WEBGPU_TEST_SEAM: "false",
  VITE_GROUND_GLASS_WEBGPU_PHYSICAL_COC_RESEARCH: "false",
  VITE_GROUND_GLASS_WEBGPU_GATHER_RESEARCH: "false",
  VITE_GROUND_GLASS_WEBGPU_M6_PRESENTATION: "false",
  VITE_GROUND_GLASS_WEBGPU_M6_R187_QUALIFICATION: "false",
};

const inside = (parent, child) => {
  const path = relative(parent, child);
  return path === "" || (!isAbsolute(path) && path !== ".." && !path.startsWith(`..${sep}`));
};
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const git = (cwd, args, allowFailure = false) => {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (result.error) throw result.error;
  if (!allowFailure && result.status !== 0) {
    throw new Error(`git -C ${cwd} ${args.join(" ")} failed: ${result.stderr.trim()}`);
  }
  return { status: result.status ?? 1, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
};
const gitText = (cwd, args) => git(cwd, args).stdout.trim();

const parseArgs = () => {
  const values = new Map();
  for (const argument of process.argv.slice(2)) {
    const match = argument.match(/^--([a-z-]+)=(.+)$/);
    if (!match || values.has(match[1])) throw new Error(`Unsupported or duplicate option: ${argument}`);
    values.set(match[1], match[2]);
  }
  const supported = new Set(["execution-worktree", "execution-sha", "output-dir"]);
  if ([...values.keys()].some((key) => !supported.has(key))) {
    throw new Error("Options: --execution-worktree=<path> --execution-sha=<40-char-sha> --output-dir=<new-repo-relative-path>");
  }
  const executionWorktree = values.get("execution-worktree");
  const executionSha = values.get("execution-sha");
  const outputDir = (values.get("output-dir") ?? "").replaceAll("\\", "/");
  if (!executionWorktree) throw new Error("--execution-worktree is required");
  if (!executionSha || !commitPattern.test(executionSha)) throw new Error("--execution-sha must be a full Git commit SHA");
  const segments = outputDir.split("/");
  const outputRoot = resolve(toolingRoot, outputDir);
  if (!outputDir || isAbsolute(outputDir) || /^[a-zA-Z]:/.test(outputDir) ||
      segments.some((segment) => !segment || segment === "." || segment === "..") ||
      !inside(toolingRoot, outputRoot) || outputRoot === toolingRoot) {
    throw new Error("--output-dir must be a new, non-root path inside the tooling worktree");
  }
  if (existsSync(outputRoot)) throw new Error(`Output directory already exists; refusing to overwrite: ${outputDir}`);
  const executionRoot = realpathSync(resolve(toolingRoot, executionWorktree));
  return { executionRoot, executionSha, outputDir, outputRoot };
};

const executionEnvironment = (port) => {
  const env = { ...process.env };
  for (const name of webGpuEnvironmentNames) delete env[name];
  env.PATH = [dirname(process.execPath), env.PATH].filter(Boolean).join(sep === "\\" ? ";" : ":");
  return Object.assign(env, viteWebGpuEnvironment, {
    VITE_BASE_PATH: "/",
    PLAYWRIGHT_WEB_SERVER_PORT: String(port),
  });
};

const checkPortAvailable = (port) => new Promise((resolveResult) => {
  const server = createServer();
  server.once("error", () => resolveResult(false));
  server.listen(port, "127.0.0.1", () => server.close(() => resolveResult(true)));
});

const choosePort = async (preferred) => {
  if (await checkPortAvailable(preferred)) return preferred;
  const server = createServer();
  const port = await new Promise((resolveResult, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") return reject(new Error("Could not reserve a local port"));
      resolveResult(address.port);
    });
  });
  await new Promise((resolveResult) => server.close(resolveResult));
  return port;
};

const waitUntilPortClosed = async (port, timeoutMs = 10_000) => {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await checkPortAvailable(port)) return true;
    await new Promise((resolveResult) => setTimeout(resolveResult, 250));
  }
  return checkPortAvailable(port);
};

const packageAtEntry = (entryPath, packageName) => {
  let directory = dirname(realpathSync(entryPath));
  while (true) {
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

const inspectPlaywrightConfig = (executionRoot, env) => {
  const configPath = resolve(executionRoot, "playwright.config.ts");
  const configUrl = pathToFileURL(configPath).href;
  const code = `const c=(await import(${JSON.stringify(configUrl)})).default;` +
    `process.stdout.write(JSON.stringify({testDir:c.testDir,timeout:c.timeout??null,retries:c.retries??0,` +
    `baseURL:c.use?.baseURL??null,projects:(c.projects??[]).map(p=>({name:p.name,workers:p.workers??null,` +
    `retries:p.retries??c.retries??0,viewport:p.use?.viewport??null,headless:p.use?.headless??null,channel:p.use?.channel??null})),` +
    `webServerEnv:c.webServer?.env??{},` +
    `webServer:Array.isArray(c.webServer)?c.webServer.map(s=>({command:s.command,url:s.url,reuseExistingServer:s.reuseExistingServer,timeout:s.timeout})):({command:c.webServer?.command,url:c.webServer?.url,reuseExistingServer:c.webServer?.reuseExistingServer,timeout:c.webServer?.timeout})}));`;
  const result = spawnSync(process.execPath, ["--experimental-strip-types", "--input-type=module", "-e", code], {
    cwd: executionRoot,
    env,
    encoding: "utf8",
    maxBuffer: 2 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Could not inspect execution Playwright config: ${result.stderr.trim()}`);
  return JSON.parse(result.stdout);
};

const inspectRuntime = async (executionRoot) => {
  if (Number(process.version.slice(1).split(".")[0]) < 24) throw new Error(`Node.js 24 or newer is required; found ${process.version}`);
  const executionNode = spawnSync("node", ["-e", "process.stdout.write(process.version)"], {
    cwd: executionRoot,
    env: executionEnvironment(4471),
    encoding: "utf8",
  });
  if (executionNode.error) throw executionNode.error;
  if (executionNode.status !== 0 || executionNode.stdout.trim() !== process.version) {
    throw new Error(`Tooling Node ${process.version} does not match execution Node ${executionNode.stdout.trim() || "unavailable"}`);
  }

  const nodeModules = join(executionRoot, "node_modules");
  if (!existsSync(nodeModules) || lstatSync(nodeModules).isSymbolicLink()) {
    throw new Error("Execution worktree needs its own installed node_modules; run npm ci there");
  }
  const packageLock = JSON.parse(readFileSync(join(executionRoot, "package-lock.json"), "utf8"));
  const playwrightExpected = packageLock.packages?.["node_modules/playwright"]?.version;
  const threeExpected = packageLock.packages?.["node_modules/three"]?.version;
  const executionRequire = createRequire(join(executionRoot, "package.json"));
  const playwright = packageAtEntry(executionRequire.resolve("playwright"), "playwright").value;
  const threePackage = packageAtEntry(executionRequire.resolve("three"), "three").value;
  const three = executionRequire("three");
  if (!playwrightExpected || playwright.version !== playwrightExpected) throw new Error("Installed Playwright does not match the execution lockfile");
  if (!threeExpected || threePackage.version !== threeExpected || threePackage.version !== "0.187.0" || three.REVISION !== "187") {
    throw new Error(`Installed Three.js ${threePackage.version} / revision ${three.REVISION} does not match the locked M7 runtime 0.187.0`);
  }
  const npmVersion = spawnSync("npm", ["--version"], { cwd: executionRoot, env: executionEnvironment(4471), encoding: "utf8" });
  if (npmVersion.error) throw npmVersion.error;
  if (npmVersion.status !== 0) throw new Error(`Could not determine npm version: ${npmVersion.stderr.trim()}`);
  const npmTree = spawnSync("npm", ["ls", "--depth=0", "--json"], { cwd: executionRoot, env: executionEnvironment(4471), encoding: "utf8", maxBuffer: 4 * 1024 * 1024 });
  if (npmTree.error) throw npmTree.error;
  if (npmTree.status !== 0) throw new Error(`Execution dependencies do not match package-lock.json: ${npmTree.stderr.trim()}`);

  const config = inspectPlaywrightConfig(executionRoot, executionEnvironment(4471));
  const ordinary = config.projects.find((project) => project.name === "chromium");
  const serial = config.projects.find((project) => project.name === "chromium-renderer-serial");
  if (!ordinary || !serial || JSON.stringify(ordinary.viewport) !== JSON.stringify(serial.viewport)) {
    throw new Error("Execution config is missing a consistent ordinary or renderer-serial Chromium project");
  }
  if (config.webServerEnv.VITE_GROUND_GLASS_WEBGPU_TEST_SEAM !== "false" ||
      Object.entries(viteWebGpuEnvironment).some(([name, value]) => config.webServerEnv[name] !== value)) {
    throw new Error("Execution config does not keep the WebGPU development gates disabled");
  }
  if (ordinary.channel || serial.channel || ordinary.headless === false || serial.headless === false) {
    throw new Error("M7R requires the default headless Playwright-managed Chromium build");
  }

  const { chromium } = executionRequire("playwright");
  let browser;
  let browserEvidence;
  let browserVersion;
  try {
    browser = await chromium.launch({ headless: true });
    browserVersion = browser.version();
    const page = await browser.newPage({ viewport: ordinary.viewport });
    browserEvidence = await page.evaluate(() => {
      const canvas = document.createElement("canvas");
      const gl = canvas.getContext("webgl2");
      const debug = gl?.getExtension("WEBGL_debug_renderer_info");
      return {
        userAgent: navigator.userAgent,
        viewport: { width: window.innerWidth, height: window.innerHeight },
        webgl2Available: Boolean(gl),
        webglVersion: gl ? gl.getParameter(gl.VERSION) : null,
        unmaskedVendor: gl && debug ? gl.getParameter(debug.UNMASKED_VENDOR_WEBGL) : null,
        unmaskedRenderer: gl && debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : null,
      };
    });
  } finally {
    if (browser) await browser.close();
  }
  const uaVersion = browserEvidence.userAgent.match(/(?:Chrome|HeadlessChrome)\/([\d.]+)/)?.[1] ?? null;
  if (!browserVersion || uaVersion !== browserVersion || !browserEvidence.webgl2Available) {
    throw new Error("Headless Chromium version or WebGL2 runtime probe could not be verified");
  }
  return {
    runtime: { nodeVersion: process.version, platform: process.platform, architecture: process.arch, osRelease: os.release(), osVersion: os.version() },
    npmVersion: npmVersion.stdout.trim(),
    playwrightVersion: playwright.version,
    browserVersion,
    browserEvidence,
    threeJsVersion: threePackage.version,
    threeRevision: three.REVISION,
    lockfileVersions: { playwright: playwrightExpected, three: threeExpected },
    config,
  };
};

const runCommand = ({ executionRoot, env, args, logPath }) => {
  const logFd = openSync(logPath, "wx");
  const startedAt = new Date().toISOString();
  const start = process.hrtime.bigint();
  let result;
  try {
    result = spawnSync("npm", ["run", "test:e2e", "--", ...args], {
      cwd: executionRoot,
      env,
      stdio: ["ignore", logFd, logFd],
    });
  } finally {
    closeSync(logFd);
  }
  const elapsedMs = Number(process.hrtime.bigint() - start) / 1e6;
  return {
    startedAt,
    settledAt: new Date().toISOString(),
    elapsedMs,
    exitCode: result?.status ?? 1,
    signal: result?.signal ?? null,
    spawnError: result?.error?.message ?? null,
  };
};

const parseDiscovery = (text, project) => text.split(/\r?\n/).flatMap((line) => {
  const match = line.match(/^\s+\[([^\]]+)\]\s+›\s+(.+?):\d+:\d+\s+›\s+(.*)$/);
  if (!match || match[1] !== project) return [];
  const titlePath = match[3].split(/\s+›\s+/).map((part) => part.trim()).filter(Boolean);
  return [{ projectName: project, sourceSpec: basename(match[2]), titlePath, testId: `${basename(match[2])}::${titlePath.join("::")}` }];
});

const runDiscovery = ({ executionRoot, project, workers, noDeps, outputPath, port }) => {
  const args = ["--project", project];
  if (noDeps) args.push("--no-deps");
  args.push("--workers", String(workers), "--list");
  const logPath = outputPath.replace(/\.txt$/, "-console.log");
  const invocation = runCommand({ executionRoot, env: executionEnvironment(port), args, logPath });
  const bytes = readFileSync(logPath);
  writeFileSync(outputPath, bytes, { flag: "wx" });
  const text = bytes.toString("utf8");
  const identities = parseDiscovery(text, project);
  return {
    command: `npm run test:e2e -- ${args.join(" ")}`,
    invocation,
    outputPath,
    outputSha256: sha256(bytes),
    identityCount: identities.length,
    duplicateIdentityCount: identities.length - new Set(identities.map((item) => item.testId)).size,
    identities,
  };
};

const collectOutputFiles = (root, directory = root) => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const path = join(directory, entry.name);
  if (entry.isDirectory()) return collectOutputFiles(root, path);
  const bytes = readFileSync(path);
  return [{ path: relative(root, path).split(sep).join("/"), sizeBytes: bytes.byteLength, sha256: sha256(bytes) }];
});

const flattenRawTests = (raw) => {
  const tests = [];
  const visit = (suites, inheritedFile = "", titles = []) => {
    for (const suite of suites ?? []) {
      const sourceFile = suite.file ?? inheritedFile;
      const nestedTitles = suite.file ? titles : suite.title ? [...titles, suite.title] : titles;
      for (const spec of suite.specs ?? []) {
        const testTitles = [...nestedTitles, spec.title].filter(Boolean);
        for (const test of spec.tests ?? []) {
          const sourceSpec = basename(sourceFile || spec.location?.file || "unknown.spec.ts");
          tests.push({
            projectName: test.projectName,
            sourceSpec,
            titlePath: testTitles,
            testId: `${sourceSpec}::${testTitles.join("::")}`,
            expectedStatus: test.expectedStatus ?? "unknown",
            annotations: test.annotations ?? [],
            location: spec.location ?? null,
            results: test.results ?? [],
            actualStatus: test.results?.at(-1)?.status ?? "no-result",
            retryCount: test.results?.reduce((maximum, result) => Math.max(maximum, Number(result.retry ?? 0)), 0) ?? 0,
          });
        }
      }
      visit(suite.suites, sourceFile, nestedTitles);
    }
  };
  visit(raw.suites);
  return tests;
};

const runLane = async ({ executionRoot, outputRoot, laneName, project, workers, noDeps, port, discovery }) => {
  const laneRoot = join(outputRoot, "execution", laneName);
  const rawDir = join(outputRoot, "raw");
  const attachmentsDir = join(outputRoot, "attachments", laneName);
  mkdirSync(laneRoot, { recursive: true });
  mkdirSync(attachmentsDir, { recursive: true });
  const rawReportPath = join(rawDir, `${laneName}-playwright.json`);
  const consolePath = join(laneRoot, `${laneName}-console.log`);
  const exitCodePath = join(laneRoot, `${laneName}-exit-code.txt`);
  const outputPath = join(attachmentsDir, "playwright-output");
  mkdirSync(outputPath, { recursive: true });
  const selectedPort = await choosePort(port);
  const args = [`--project=${project}`, `--workers=${workers}`, "--retries=0", "--reporter=list,json", `--output=${outputPath}`];
  if (noDeps) args.splice(1, 0, "--no-deps");
  const invocation = runCommand({
    executionRoot,
    env: Object.assign(executionEnvironment(selectedPort), { PLAYWRIGHT_JSON_OUTPUT_NAME: rawReportPath }),
    args,
    logPath: consolePath,
  });
  writeFileSync(exitCodePath, `${invocation.exitCode}\n`, { flag: "wx" });
  const rawAvailable = existsSync(rawReportPath);
  let raw = null;
  let rawParseError = null;
  if (rawAvailable) {
    try {
      raw = JSON.parse(readFileSync(rawReportPath, "utf8"));
    } catch (error) {
      rawParseError = error instanceof Error ? error.message : String(error);
    }
  }
  const outputFiles = collectOutputFiles(outputPath);
  const serverClosed = await waitUntilPortClosed(selectedPort);
  const rawTests = raw ? flattenRawTests(raw) : [];
  const expectedIdentities = new Set(discovery.identities.map((item) => `${item.projectName}::${item.testId}`));
  const actualIdentities = rawTests.map((item) => `${item.projectName}::${item.testId}`);
  const actualIdentitySet = new Set(actualIdentities);
  const missingIdentityCount = [...expectedIdentities].filter((identity) => !actualIdentitySet.has(identity)).length;
  const extraIdentityCount = actualIdentities.filter((identity) => !expectedIdentities.has(identity)).length;
  const duplicateIdentityCount = actualIdentities.length - actualIdentitySet.size;
  const rawCount = rawTests.length;
  const projectConfig = raw?.config?.projects?.find((entry) => entry.name === project) ?? null;
  const resultCountValid = rawTests.every((test) => test.results.length === 1 && test.actualStatus !== "no-result");
  const retryFree = rawTests.every((test) => test.retryCount === 0 && test.results.every((result) => Number(result.retry ?? 0) === 0));
  const rawReport = raw ? {
    configWorkers: raw.config?.workers ?? null,
    retriesConfigured: raw.config?.retries ?? null,
    projectWorkers: projectConfig?.workers ?? null,
    actualWorkers: projectConfig?.metadata?.actualWorkers ?? null,
    stats: raw.stats ?? null,
    errors: raw.errors ?? [],
    resultCount: rawCount,
    retryFree,
    resultCountValid,
    identityReconciliation: { discovered: expectedIdentities.size, reported: rawCount, missing: missingIdentityCount, extra: extraIdentityCount, duplicates: duplicateIdentityCount },
    workerIndexes: [...new Set(rawTests.flatMap((test) => test.results.map((result) => result.workerIndex).filter(Number.isInteger)))].sort((left, right) => left - right),
  } : null;
  const complete = rawAvailable && raw !== null && rawCount === discovery.identityCount &&
    missingIdentityCount === 0 && extraIdentityCount === 0 && duplicateIdentityCount === 0 &&
    resultCountValid && retryFree && (raw.errors ?? []).length === 0 && serverClosed;
  return {
    projectName: project,
    configuredWorkers: workers,
    configuredRetries: 0,
    command: `npm run test:e2e -- ${args.join(" ")}`,
    server: {
      host: "127.0.0.1",
      port: selectedPort,
      strictPort: true,
      priorListenerAbsent: true,
      closedAfterInvocation: serverClosed,
      configVerifiedAgainstEnvironment: true,
    },
    discovery: { outputPath: discovery.outputPath, outputSha256: discovery.outputSha256, identityCount: discovery.identityCount },
    invocation,
    rawReport: rawReportPath,
    rawReportSha256: rawAvailable ? sha256(readFileSync(rawReportPath)) : null,
    rawReportBytes: rawAvailable ? readFileSync(rawReportPath).byteLength : null,
    rawParseError,
    consolePath,
    consoleSha256: sha256(readFileSync(consolePath)),
    exitCodePath,
    outputFiles,
    rawSummary: rawReport,
    executionCompleteness: complete ? "complete" : "incomplete",
    captureValidity: complete ? "valid" : "invalid",
  };
};

const main = async () => {
  const options = parseArgs();
  const executionSha = gitText(options.executionRoot, ["rev-parse", "HEAD"]);
  if (executionSha !== options.executionSha) throw new Error(`Execution worktree HEAD ${executionSha} differs from requested source ${options.executionSha}`);
  if (gitText(options.executionRoot, ["status", "--porcelain", "--untracked-files=all"])) {
    throw new Error("Execution worktree must be clean before capture; install dependencies there with npm ci");
  }
  git(options.executionRoot, ["cat-file", "-e", `${executionSha}^{commit}`]);
  const toolingCommitSha = gitText(toolingRoot, ["rev-parse", "HEAD"]);
  git(toolingRoot, ["cat-file", "-e", `${toolingCommitSha}^{commit}`]);
  const runnerCommitBytes = Buffer.from(git(toolingRoot, ["show", `${toolingCommitSha}:${runnerSourcePath}`]).stdout);
  const runnerCurrentBytes = readFileSync(resolve(toolingRoot, runnerSourcePath));
  if (sha256(runnerCommitBytes) !== sha256(runnerCurrentBytes)) throw new Error("Capture runner source differs from its pinned tooling commit");

  const outputRoot = options.outputRoot;
  mkdirSync(join(outputRoot, "discovery"), { recursive: true });
  mkdirSync(join(outputRoot, "raw"), { recursive: true });
  mkdirSync(join(outputRoot, "execution"), { recursive: true });
  mkdirSync(join(outputRoot, "attachments"), { recursive: true });
  const runtime = await inspectRuntime(options.executionRoot);
  const discovery = {
    ordinary: runDiscovery({
      executionRoot: options.executionRoot,
      project: "chromium",
      workers: 4,
      noDeps: false,
      outputPath: join(outputRoot, "discovery", "ordinary-playwright-list.txt"),
      port: 4471,
    }),
    rendererSerial: runDiscovery({
      executionRoot: options.executionRoot,
      project: "chromium-renderer-serial",
      workers: 1,
      noDeps: true,
      outputPath: join(outputRoot, "discovery", "renderer-serial-playwright-list.txt"),
      port: 4472,
    }),
  };
  const discoveredIdentities = [
    ...discovery.ordinary.identities.map((item) => `${item.projectName}::${item.testId}`),
    ...discovery.rendererSerial.identities.map((item) => `${item.projectName}::${item.testId}`),
  ];
  const duplicateIdentityCount = discoveredIdentities.length - new Set(discoveredIdentities).size;
  if (discovery.ordinary.invocation.exitCode !== 0 || discovery.rendererSerial.invocation.exitCode !== 0 || duplicateIdentityCount !== 0) {
    throw new Error("Current Playwright discovery failed or produced duplicate identities; no test lanes were started");
  }

  const ordinaryPortProbe = await choosePort(4471);
  const rendererSerialPortProbe = await choosePort(4472);
  const ordinary = await runLane({
    executionRoot: options.executionRoot,
    outputRoot,
    laneName: "ordinary",
    project: "chromium",
    workers: 4,
    noDeps: false,
    port: ordinaryPortProbe,
    discovery: discovery.ordinary,
  });
  const rendererSerial = await runLane({
    executionRoot: options.executionRoot,
    outputRoot,
    laneName: "renderer-serial",
    project: "chromium-renderer-serial",
    workers: 1,
    noDeps: true,
    port: rendererSerialPortProbe,
    discovery: discovery.rendererSerial,
  });

  const environment = {
    ...runtime,
    executionSourceCommitSha: executionSha,
    nativeWebGpuRequested: false,
    rendererBackend: "application-default-WebGL",
    nativeFeatureGatesEnabled: false,
    effectiveEnvironmentFlags: { ...viteWebGpuEnvironment },
    removedInheritedEnvironmentNames: webGpuEnvironmentNames,
    discoveryCommandsCompleted: true,
  };
  const manifest = {
    schemaVersion: 1,
    captureId: `m7r-${executionSha.slice(0, 7)}-${new Date().toISOString().replaceAll(":", "-")}`,
    generatedAt: new Date().toISOString(),
    executionSourceCommitSha: executionSha,
    captureRunnerSourceCommitSha: toolingCommitSha,
    captureRunnerSourcePath: runnerSourcePath,
    outputDirectory: options.outputDir,
    source: {
      executionWorktree: options.executionRoot,
      executionCommitTree: gitText(options.executionRoot, ["rev-parse", `${executionSha}^{tree}`]),
      cleanBeforeExecution: true,
      currentDiscoveryMatchedExecutionSource: true,
    },
    environment,
    discovery: {
      ordinary: { command: discovery.ordinary.command, exitCode: discovery.ordinary.invocation.exitCode, outputPath: relative(toolingRoot, discovery.ordinary.outputPath), outputSha256: discovery.ordinary.outputSha256, identities: discovery.ordinary.identities },
      rendererSerial: { command: discovery.rendererSerial.command, exitCode: discovery.rendererSerial.invocation.exitCode, outputPath: relative(toolingRoot, discovery.rendererSerial.outputPath), outputSha256: discovery.rendererSerial.outputSha256, identities: discovery.rendererSerial.identities },
      total: discoveredIdentities.length,
      unique: new Set(discoveredIdentities).size,
      duplicateIdentityCount,
    },
    lanes: { ordinary, rendererSerial },
    policy: {
      ordinary: { project: "chromium", configuredWorkers: 4, retries: 0 },
      rendererSerial: { project: "chromium-renderer-serial", configuredWorkers: 1, retries: 0, dependenciesDisabled: true },
      lanesExecutedSequentially: true,
      ordinaryFailureSuppressesSerial: false,
      testTimeoutsChanged: false,
      applicationSourceChangedDuringCapture: false,
    },
    artifactManifest: collectOutputFiles(outputRoot),
  };
  writeFileSync(join(outputRoot, "capture-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, { flag: "wx" });
  process.stdout.write(`M7R capture manifest: ${relative(toolingRoot, join(outputRoot, "capture-manifest.json"))}\n`);
  process.stdout.write(`Discovery: ordinary ${discovery.ordinary.identityCount}; renderer serial ${discovery.rendererSerial.identityCount}; unique ${discoveredIdentities.length - duplicateIdentityCount}.\n`);
  process.stdout.write(`Lane capture validity: ordinary ${ordinary.captureValidity}; renderer serial ${rendererSerial.captureValidity}.\n`);
  process.stdout.write(`Playwright outcomes: ordinary exit ${ordinary.invocation.exitCode}; renderer serial exit ${rendererSerial.invocation.exitCode}. Test failures remain recorded as outcomes.\n`);
  if (ordinary.captureValidity !== "valid" || rendererSerial.captureValidity !== "valid") process.exitCode = 1;
};

try {
  await main();
} catch (error) {
  process.stderr.write(`M7R capture failed: ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
}
