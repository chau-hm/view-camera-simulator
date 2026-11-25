import { build } from "esbuild";
import { mkdtempSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const scratchDirectory = mkdtempSync(join(tmpdir(), "m7r-evidence-"));
const evaluatorBundle = join(scratchDirectory, "evaluateM7rBroadE2eRecovery.mjs");

try {
  const args = process.argv.slice(2);
  if (args.length > 1 || args.some((argument) => !argument.startsWith("--report-path="))) throw new Error("Supported option: --report-path=<repository-relative-path>");
  const reportPath = args[0]?.slice("--report-path=".length) ?? "docs/architecture/GROUND_GLASS_M7R_BROAD_E2E_QUALIFICATION_RECOVERY_REPORT.json";
  const reportAbsolute = resolve(repositoryRoot, reportPath);
  if (!reportAbsolute.startsWith(`${repositoryRoot}/`)) throw new Error("M7R report path must remain inside the repository.");
  await build({
    entryPoints: [resolve(repositoryRoot, "scripts/evaluateM7rBroadE2eRecovery.ts")],
    outfile: evaluatorBundle,
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node24",
    packages: "external",
  });
  const result = spawnSync(process.execPath, [evaluatorBundle], {
    cwd: repositoryRoot,
    env: {
      ...process.env,
      M7R_EVIDENCE_CLI: "1",
      M7R_EVIDENCE_REPOSITORY_ROOT: repositoryRoot,
      M7R_EVIDENCE_REPORT_PATH: reportPath,
    },
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} catch (error) {
  process.stderr.write(`M7R evidence checker failed closed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
} finally {
  rmSync(scratchDirectory, { recursive: true, force: true });
}
