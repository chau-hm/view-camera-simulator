import { spawnSync } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const metricsScript = resolve(repositoryRoot, "scripts/render-quality/rq3f-macro-image-metrics.mjs");
const archivedRunPath = resolve(repositoryRoot,
  "docs/render-quality/rq3f-macro-compound/before/captures/capture-run.json");

const runMetrics = (captureRunPath: string, outputPath: string) => spawnSync(process.execPath, [
  metricsScript,
  captureRunPath,
  `--output=${outputPath}`,
], {
  cwd: repositoryRoot,
  encoding: "utf8",
  timeout: 30_000,
});

describe("RQ3F image metrics CLI", () => {
  it("reads archived repository-relative images and fresh run-local PNG basenames", async () => {
    const temporaryDirectory = await mkdtemp(join(tmpdir(), "rq3f-metrics-"));
    try {
      const archivedOutputPath = join(temporaryDirectory, "archived-metrics.json");
      const archivedResult = runMetrics(archivedRunPath, archivedOutputPath);
      expect(archivedResult.status, archivedResult.stderr).toBe(0);
      const archivedMetrics = JSON.parse(await readFile(archivedOutputPath, "utf8"));
      expect(archivedMetrics.runs[0].states).toHaveLength(5);

      const runDirectory = join(temporaryDirectory, "fresh-run");
      await mkdir(runDirectory);
      const freshRun = JSON.parse(await readFile(archivedRunPath, "utf8"));
      for (const capture of freshRun.captures.filter((entry: { captureRole: string }) =>
        entry.captureRole === "photographic-ground-glass-reference")) {
        const sourceImagePath = resolve(repositoryRoot, capture.image.imagePath);
        const localImageName = basename(capture.image.imagePath);
        await copyFile(sourceImagePath, join(runDirectory, localImageName));
        capture.image.imagePath = localImageName;
      }
      const freshRunPath = join(runDirectory, "capture-run.json");
      await writeFile(freshRunPath, `${JSON.stringify(freshRun, null, 2)}\n`);

      const freshOutputPath = join(temporaryDirectory, "fresh-metrics.json");
      const freshResult = runMetrics(freshRunPath, freshOutputPath);
      expect(freshResult.status, freshResult.stderr).toBe(0);
      const freshMetrics = JSON.parse(await readFile(freshOutputPath, "utf8"));
      expect(freshMetrics.runs[0].states).toHaveLength(5);
      expect(freshMetrics.runs[0].states.map((state: { stateId: string }) => state.stateId)).toEqual(
        archivedMetrics.runs[0].states.map((state: { stateId: string }) => state.stateId),
      );
    } finally {
      await rm(temporaryDirectory, { recursive: true, force: true });
    }
  });
});
