import { build } from "esbuild";
import { mkdtempSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const scratchDir = mkdtempSync(join(tmpdir(), "m7n-renderer-lifecycle-"));
const bundlePath = join(scratchDir, "evaluateM7nRendererLifecycle.mjs");

try {
  await build({
    entryPoints: [resolve(repoRoot, "scripts/evaluateM7nRendererLifecycle.ts")],
    outfile: bundlePath,
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node24",
    packages: "external",
  });
  const result = spawnSync(process.execPath, [bundlePath, ...process.argv.slice(2)], {
    cwd: repoRoot,
    env: {
      ...process.env,
      M7N_RENDERER_LIFECYCLE_CLI: "1",
      M7N_RENDERER_LIFECYCLE_REPO_ROOT: repoRoot,
    },
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally {
  rmSync(scratchDir, { recursive: true, force: true });
}
