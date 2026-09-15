import { execFileSync, spawn } from "node:child_process";

const commitSha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const command = process.platform === "win32" ? "npx.cmd" : "npx";
const child = spawn(
  command,
  [
    "playwright",
    "test",
    "src/tests/e2e/scene-capacity-benchmark.spec.ts",
    "--config=playwright.scene-capacity-benchmark.config.ts",
    "--workers=1",
  ],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      SCENE_CAPACITY_BENCHMARK: "1",
      SCENE_CAPACITY_BENCHMARK_COMMIT: commitSha,
      SCENE_CAPACITY_BENCHMARK_OUTPUT_DIR: "test-results",
    },
  },
);

child.on("error", (error) => {
  console.error(error);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
