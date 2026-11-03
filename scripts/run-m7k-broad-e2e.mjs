import { createHash } from "node:crypto";
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, writeFileSync } from "node:fs";
import { basename, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const baseCommitSha = "e6066a244510387c32995c1e973a771667b04d10";
const reportDir = "docs/architecture/ground-glass-m7k-broad-e2e";
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const git = (args) => {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
  if (result.status !== 0) throw new Error(`git ${args.join(" ")} failed: ${result.stderr}`);
  return result.stdout.trim();
};
const parseArgs = () => {
  const options = new Map();
  for (const argument of process.argv.slice(2)) {
    const match = argument.match(/^--([a-z-]+)=(.+)$/);
    if (!match || options.has(match[1])) throw new Error(`Unsupported option: ${argument}`);
    options.set(match[1], match[2]);
  }
  if ([...options.keys()].some((key) => key !== "output-dir")) throw new Error("Supported option: --output-dir=<repo-relative-path>");
  const stamp = new Date().toISOString().replaceAll(":", "-");
  const outputDir = options.get("output-dir") ?? `${reportDir}/runs/${stamp}`;
  if (isAbsolute(outputDir) || relative(root, resolve(root, outputDir)).startsWith(`..${sep}`)) {
    throw new Error("--output-dir must stay inside the repository");
  }
  return outputDir.replaceAll("\\", "/");
};
const readDigest = (relativePath) => sha256(readFileSync(resolve(root, relativePath)));
const writeExitCode = (path, code) => writeFileSync(resolve(root, path), `${code ?? 1}\n`);
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
  return Object.assign(env, {
    VITE_GROUND_GLASS_WEBGPU_RAW_PILOT: "false",
    VITE_GROUND_GLASS_WEBGPU_TEST_SEAM: "false",
    VITE_GROUND_GLASS_WEBGPU_PHYSICAL_COC_RESEARCH: "false",
    VITE_GROUND_GLASS_WEBGPU_GATHER_RESEARCH: "false",
    VITE_GROUND_GLASS_WEBGPU_M6_PRESENTATION: "false",
    VITE_GROUND_GLASS_WEBGPU_M6_R187_QUALIFICATION: "false",
  });
};
const runCapture = ({ label, args, port, outputPath, logPath }) => {
  const logFd = openSync(resolve(root, logPath), "w");
  const env = Object.assign(baselineEnvironment(), {
    PLAYWRIGHT_WEB_SERVER_PORT: String(port),
    PLAYWRIGHT_JSON_OUTPUT_NAME: resolve(root, outputPath),
  });
  const result = spawnSync("npm", ["run", "test:e2e", "--", ...args], {
    cwd: root,
    env,
    stdio: ["ignore", logFd, logFd],
  });
  closeSync(logFd);
  const exitCode = result.status ?? 1;
  writeExitCode(logPath.replace(/-console\.log$/, "-exit-code.txt"), exitCode);
  return { exitCode, spawnError: result.error?.message ?? null };
};
const runDiscovery = ({ project, workers, outputPath, logPath, noDeps = false }) => {
  const args = ["--project", project];
  if (noDeps) args.push("--no-deps");
  args.push("--workers", String(workers), "--list");
  const logFd = openSync(resolve(root, logPath), "w");
  const result = spawnSync("npm", ["run", "test:e2e", "--", ...args], {
    cwd: root,
    env: baselineEnvironment(),
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
  });
  closeSync(logFd);
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  writeFileSync(resolve(root, logPath), output);
  writeFileSync(resolve(root, outputPath), output);
  return { exitCode: result.status ?? 1, spawnError: result.error?.message ?? null };
};
const parseIdentities = (text, project) => text.split(/\r?\n/).flatMap((line) => {
  const match = line.match(/^\s+\[([^\]]+)\]\s+›\s+(.+?):\d+:\d+\s+›\s+(.*)$/);
  if (!match || match[1] !== project) return [];
  return [`${basename(match[2])}::${match[3].split(/\s+›\s+/).map((part) => part.trim()).filter(Boolean).join("::")}`];
});
const main = () => {
  const outputDir = parseArgs();
  if (Number(process.versions.node.split(".")[0]) < 24) throw new Error("M7K capture requires Node.js 24");
  const sourceCommitSha = git(["rev-parse", "--verify", "HEAD"]);
  if (!/^[0-9a-f]{40}$/.test(sourceCommitSha)) throw new Error("Could not resolve the execution source commit");
  const outputRoot = resolve(root, outputDir);
  if (existsSync(outputRoot)) throw new Error(`Output directory already exists: ${outputDir}`);
  mkdirSync(outputRoot, { recursive: true });
  const discoveryDir = `${outputDir}/discovery`;
  const executionDir = `${outputDir}/execution`;
  mkdirSync(resolve(root, discoveryDir), { recursive: true });
  mkdirSync(resolve(root, executionDir), { recursive: true });

  const discovery = {};
  for (const lane of [
    { key: "ordinary", project: "chromium", workers: 4, noDeps: false },
    { key: "rendererSerial", project: "chromium-renderer-serial", workers: 1, noDeps: true },
  ]) {
    const outputPath = `${discoveryDir}/${lane.key}-playwright-list.txt`;
    const logPath = `${discoveryDir}/${lane.key}-discovery-console.log`;
    const result = runDiscovery({ ...lane, outputPath, logPath });
    const text = readFileSync(resolve(root, outputPath), "utf8");
    discovery[lane.key] = {
      projectName: lane.project,
      command: `npm run test:e2e -- --project=${lane.project}${lane.noDeps ? " --no-deps" : ""} --workers=${lane.workers} --list`,
      exitCode: result.exitCode,
      outputPath,
      outputSha256: readDigest(outputPath),
    };
    discovery[lane.key].identities = parseIdentities(text, lane.project);
    if (result.exitCode !== 0 || result.spawnError) throw new Error(`${lane.key} test discovery failed`);
  }

  const ordinaryRaw = `${executionDir}/ordinary-playwright.json`;
  const serialRaw = `${executionDir}/renderer-serial-playwright.json`;
  const ordinaryLog = `${executionDir}/ordinary-console.log`;
  const serialLog = `${executionDir}/renderer-serial-console.log`;
  const ordinaryRun = runCapture({
    label: "ordinary",
    args: ["--project=chromium", "--workers=4", "--retries=0", "--reporter=list,json"],
    port: 4471,
    outputPath: ordinaryRaw,
    logPath: ordinaryLog,
  });
  const serialRun = runCapture({
    label: "renderer-serial",
    args: ["--project=chromium-renderer-serial", "--no-deps", "--workers=1", "--retries=0", "--reporter=list,json"],
    port: 4472,
    outputPath: serialRaw,
    logPath: serialLog,
  });

  const manifest = {
    schemaVersion: 1,
    baseCommitSha,
    executionSourceCommitSha: sourceCommitSha,
    evaluationCommitSha: git(["log", "-1", "--format=%H", "--", "scripts/evaluateM7kBroadE2eQualification.ts"]),
    generatedAt: new Date().toISOString(),
    environment: {
      platform: process.platform,
      architecture: process.arch,
      nodeVersion: process.version,
      browserName: "chromium",
      browserMode: "headless",
      webglBackend: "webgl2-fallback",
      nativeWebGpuRequested: false,
      productionPreviewTestsIncluded: false,
      rendererSerialWorkers: 1,
      ordinaryWorkers: 4,
      retries: 0,
    },
    discovery,
    lanes: {
      ordinary: {
        projectName: "chromium", command: "npm run test:e2e -- --project=chromium --workers=4 --retries=0 --reporter=list,json",
        sourceCommitSha, exitCode: ordinaryRun.exitCode, rawReportPath: ordinaryRaw,
        rawReportSha256: readDigest(ordinaryRaw), consolePath: ordinaryLog, consoleSha256: readDigest(ordinaryLog),
        serverPort: 4471, invocationStatus: ordinaryRun.spawnError ? "failed-to-start" : "executed",
        discoveredTestIdentities: discovery.ordinary.identities,
      },
      rendererSerial: {
        projectName: "chromium-renderer-serial", command: "npm run test:e2e -- --project=chromium-renderer-serial --no-deps --workers=1 --retries=0 --reporter=list,json",
        sourceCommitSha, exitCode: serialRun.exitCode, rawReportPath: serialRaw,
        rawReportSha256: readDigest(serialRaw), consolePath: serialLog, consoleSha256: readDigest(serialLog),
        serverPort: 4472, invocationStatus: serialRun.spawnError ? "failed-to-start" : "executed",
        discoveredTestIdentities: discovery.rendererSerial.identities,
      },
    },
    approvedSkipExclusions: [],
    validation: {},
  };
  const manifestPath = `${outputDir}/capture-manifest.json`;
  writeFileSync(resolve(root, manifestPath), `${JSON.stringify(manifest, null, 2)}\n`);
  process.stdout.write(`Capture manifest: ${manifestPath}\n`);
  process.stdout.write(`Ordinary exit: ${ordinaryRun.exitCode}; renderer-serial exit: ${serialRun.exitCode}\n`);
  process.stdout.write("Ordinary and renderer-serial commands ran sequentially; raw test failures are retained as evidence.\n");

  const reportPath = `${outputDir}/qualification-report.json`;
  const evaluationPath = `${outputDir}/evaluation.json`;
  const evaluation = spawnSync(process.execPath, [
    "scripts/run-m7k-qualification.mjs",
    `--capture-manifest=${manifestPath}`,
    `--report-output=${reportPath}`,
    `--evaluation-output=${evaluationPath}`,
  ], { cwd: root, env: baselineEnvironment(), stdio: "inherit" });
  if (evaluation.error) throw evaluation.error;
  if (evaluation.status !== 0) {
    process.stderr.write("M7K offline evidence evaluation failed; captured raw outcomes remain preserved.\n");
    process.exitCode = evaluation.status ?? 1;
    return;
  }
  const result = JSON.parse(readFileSync(resolve(root, evaluationPath), "utf8"));
  process.stdout.write(
    `Evidence integrity: ${result.evidenceIntegrity}; Broad E2E qualification: ${result.broadE2eQualification}.\n`,
  );
};

try {
  main();
} catch (error) {
  process.stderr.write(`M7K capture failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
