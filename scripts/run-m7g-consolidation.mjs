import { build } from "esbuild";
import { mkdtempSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const scratchDir = mkdtempSync(join(repoRoot, ".m7g-consolidation-"));
const bundlePath = join(scratchDir, "evaluateM7gConsolidation.mjs");

try {
  await build({
    entryPoints: [resolve(repoRoot, "scripts/evaluateM7gConsolidation.ts")],
    outfile: bundlePath,
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node24",
    packages: "external",
  });
  const result = spawnSync(process.execPath, [bundlePath, ...process.argv.slice(2)], {
    cwd: repoRoot,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally {
  rmSync(scratchDir, { recursive: true, force: true });
}
