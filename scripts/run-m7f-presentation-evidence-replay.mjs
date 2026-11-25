import { build } from "esbuild";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const scratchDir = mkdtempSync(join(tmpdir(), "m7f-evidence-replay-"));
const bundlePath = join(scratchDir, "replayM7fPresentationEvidence.mjs");

try {
  await build({
    entryPoints: [resolve(repoRoot, "scripts/replayM7fPresentationEvidence.ts")],
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
