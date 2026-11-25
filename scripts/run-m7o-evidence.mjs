import { build } from "esbuild";
import { mkdtempSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const scratchDirectory = mkdtempSync(join(tmpdir(), "m7o-evidence-"));
const evaluatorBundle = join(scratchDirectory, "evaluateM7oCanvasAssertionTiming.mjs");

try {
  await build({
    entryPoints: [resolve(repositoryRoot, "scripts/evaluateM7oCanvasAssertionTiming.ts")],
    outfile: evaluatorBundle,
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node24",
    packages: "external",
  });
  const result = spawnSync(process.execPath, [evaluatorBundle, ...process.argv.slice(2)], {
    cwd: repositoryRoot,
    env: {
      ...process.env,
      M7O_CANVAS_TIMING_CLI: "1",
      M7O_CANVAS_TIMING_REPO_ROOT: repositoryRoot,
    },
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally {
  rmSync(scratchDirectory, { recursive: true, force: true });
}
