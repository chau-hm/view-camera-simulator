import { execFileSync, spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { release, arch, platform } from "node:os";
import { join } from "node:path";

const commitSha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const timestamp = new Date().toISOString().replaceAll(":", "-");
const outputDirectory = join("test-results", "observer-backend-comparison", `${timestamp}-${commitSha.slice(0, 12)}`);
const command = process.platform === "win32" ? "npx.cmd" : "npx";

const initialReport = {
  schemaVersion: 2,
  status: "starting",
  gitCommit: commitSha,
  generatedAt: new Date().toISOString(),
  host: { platform: platform(), architecture: arch(), osRelease: release(), node: process.version },
  benchmark: {
    name: "Observer WebGL2 vs native WebGPU",
    sceneIds: ["view-camera-anatomy", "architecture-rise"],
    pairedTrialsPerScene: 3,
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
    cadenceSampling: "rAF intervals wholly inside actual pointerdown/up gestures; inter-gesture cadence separate; idle intervals excluded",
    groundGlassRestorationPixelThreshold: 1,
  },
  trials: [],
  limitations: ["GPU render time is not measured; observed browser frame cadence is not GPU execution time."],
};

await mkdir(outputDirectory, { recursive: true });
await writeFile(join(outputDirectory, "run.json"), JSON.stringify(initialReport, null, 2));

const child = spawn(
  command,
  [
    "playwright",
    "test",
    "--config=playwright.observer-backend-benchmark.config.ts",
    "src/tests/benchmarks/observer-backend-comparison.bench.ts",
    "--workers=1",
  ],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      OBSERVER_NATIVE_WEBGPU_REQUIRED: "1",
      OBSERVER_BACKEND_BENCHMARK: "1",
      OBSERVER_BACKEND_BENCHMARK_OUTPUT_DIR: outputDirectory,
      VITE_BASE_PATH: "/",
    },
  },
);

child.on("error", async (error) => {
  await finishWithoutTestReport(`Could not start Playwright: ${error.message}`);
  console.error(error);
  process.exit(1);
});

child.on("exit", async (code, signal) => {
  const exitCode = code ?? 1;
  if (signal || exitCode !== 0) {
    await finishWithoutTestReport(signal ? `Playwright terminated by ${signal}.` : `Playwright exited with code ${exitCode}.`);
  }
  console.log(`Observer backend benchmark artifacts: ${outputDirectory}`);
  process.exit(signal ? 1 : exitCode);
});

async function finishWithoutTestReport(reason) {
  const reportPath = join(outputDirectory, "run.json");
  try {
    const current = JSON.parse(await readFile(reportPath, "utf8"));
    if (current.status !== "starting" && current.status !== "in-progress") return;
    const completedTrialCount = Array.isArray(current.trials) ? current.trials.length : 0;
    current.status = "infrastructure-failure";
    current.failure = reason;
    current.completedTrialCount = completedTrialCount;
    current.runtimeQualification = {
      nativeWebGpu: "unverified",
      hardwareAcceleration: "unconfirmed",
    };
    await writeFile(reportPath, JSON.stringify(current, null, 2));
    await writeFile(join(outputDirectory, "summary.md"), [
      "# Observer backend comparison benchmark",
      "",
      `Status: **infrastructure failure; ${completedTrialCount} trial record(s) were completed, no comparison was finalized**.`,
      "",
      `Git commit: \`${commitSha}\``,
      `Reason: ${reason}`,
      "",
      "Any partial trial records remain in `run.json` and are not a completed or paired comparison.",
      "",
      "Native WebGPU execution and hardware acceleration are unverified.",
    ].join("\n"));
  } catch {
    // Preserve the original process failure if output cannot be rewritten.
  }
}
