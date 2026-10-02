import { execFileSync, spawn } from "node:child_process";
import { access, mkdir, readFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const usage = "Usage: npm run dream-loop:capture -- --pilot architecture-rise";

const parsePilot = (args) => {
  if (args.length === 1 && (args[0] === "--help" || args[0] === "-h")) return null;
  if (args.length !== 2 || args[0] !== "--pilot" || !args[1]) throw new Error(usage);
  return args[1];
};

let pilotId;
try {
  pilotId = parsePilot(process.argv.slice(2));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(2);
}

if (pilotId === null) {
  console.log(usage);
  process.exit(0);
}

const manifestPath = resolve(scriptDirectory, "pilots", pilotId + ".json");
if (!/^[a-z0-9-]+$/.test(pilotId)) {
  console.error("Invalid Dream Loop pilot id: " + pilotId);
  process.exit(2);
}
let manifest;
try {
  manifest = JSON.parse(await readFile(manifestPath, "utf8"));
} catch (error) {
  console.error("Unable to load Dream Loop pilot manifest: " + String(error));
  process.exit(2);
}

if (
  manifest.pilotId !== pilotId ||
  manifest.optimizationSurface?.id !== "observer-scene-viewport" ||
  typeof manifest.capture?.outputPath !== "string" ||
  !manifest.capture.outputPath.startsWith(".dream-loop/") ||
  typeof manifest.capture?.teachingOutputPath !== "string" ||
  !manifest.capture.teachingOutputPath.startsWith(".dream-loop/") ||
  manifest.capture.outputPath === manifest.capture.teachingOutputPath
) {
console.error("Pilot manifest does not declare distinct clean and teaching observer capture targets: " + pilotId);
process.exit(2);
}

const repositoryRoot = gitText(["rev-parse", "--show-toplevel"], process.cwd());
const cleanOutputPath = resolveDreamLoopOutput(manifest.capture.outputPath);
const teachingOutputPath = resolveDreamLoopOutput(manifest.capture.teachingOutputPath);
if (!cleanOutputPath || !teachingOutputPath || cleanOutputPath === teachingOutputPath) {
  console.error("Pilot capture outputs must be distinct paths inside the repository's .dream-loop directory.");
  process.exit(2);
}

await Promise.all([
  mkdir(dirname(cleanOutputPath), { recursive: true }),
  mkdir(dirname(teachingOutputPath), { recursive: true }),
]);
const playwrightCli = resolve(repositoryRoot, "node_modules/playwright/cli.js");
try {
  await access(playwrightCli);
} catch {
  console.error("Playwright is not installed in this workspace. Install project dependencies first.");
  process.exit(2);
}

const child = spawn(
  process.execPath,
  [
    playwrightCli,
    "test",
    "src/tests/e2e/dream-loop-capture.spec.ts",
    "--config=playwright.dream-loop.config.ts",
    "--workers=1",
  ],
  {
    cwd: repositoryRoot,
    stdio: "inherit",
    shell: process.platform === "win32",
    env: {
      ...process.env,
      DREAM_LOOP_CAPTURE: "1",
      DREAM_LOOP_CAPTURE_MANIFEST: manifestPath,
      DREAM_LOOP_CAPTURE_OUTPUT: cleanOutputPath,
      DREAM_LOOP_CAPTURE_TEACHING_OUTPUT: teachingOutputPath,
      VITE_BASE_PATH: "/",
    },
  },
);

child.on("error", (error) => {
  console.error(error);
  process.exitCode = 1;
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exitCode = code ?? 1;
});

function gitText(args, cwd) {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function resolveDreamLoopOutput(outputPath) {
  const absolutePath = resolve(repositoryRoot, outputPath);
  const outputRelative = relative(repositoryRoot, absolutePath);
  if (
    isAbsolute(outputRelative) ||
    outputRelative === ".." ||
    outputRelative.startsWith(".." + sep) ||
    !outputRelative.startsWith(".dream-loop" + sep)
  ) {
    return null;
  }
  return absolutePath;
}
