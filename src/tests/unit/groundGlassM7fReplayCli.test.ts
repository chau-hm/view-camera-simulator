import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const persistedEvidence = resolve(repositoryRoot, "docs/architecture/ground-glass-m7f-r187-presentation");
const replayScript = resolve(repositoryRoot, "scripts/run-m7f-presentation-evidence-replay.mjs");

type Scenario = { id: string; status: string };
type ReplayReport = { qualificationStatus: string; qualificationPass: boolean; evidenceReadIssues: string[]; scenarios: Scenario[] };

const replay = (mutate?: (evidenceDirectory: string) => void): Readonly<{ status: number | null; report: ReplayReport }> => {
  const scratch = mkdtempSync(join(tmpdir(), "m7f-offline-replay-"));
  try {
    const evidenceDirectory = join(scratch, "evidence");
    const reportPath = join(scratch, "report.json");
    cpSync(persistedEvidence, evidenceDirectory, { recursive: true });
    mutate?.(evidenceDirectory);
    const result = spawnSync(process.execPath, [
      replayScript,
      `--evidence-dir=${evidenceDirectory}`,
      `--report-output=${reportPath}`,
    ], { cwd: repositoryRoot, stdio: "ignore", timeout: 90_000 });
    if (result.error) throw result.error;
    const report = JSON.parse(readFileSync(reportPath, "utf8")) as ReplayReport;
    return { status: result.status, report };
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
};

const removeEvidence = (evidenceDirectory: string, relativePath: string): void => {
  rmSync(join(evidenceDirectory, relativePath), { force: true });
};

describe("M7F persisted evidence replay command", () => {
  it("returns success only for the complete valid persisted native inventory", () => {
    const result = replay();

    expect(result.status).toBe(0);
    expect(result.report.qualificationStatus).toBe("passed");
    expect(result.report.qualificationPass).toBe(true);
    expect(result.report.scenarios).toHaveLength(17);
    expect(result.report.scenarios.every(({ status }) => status === "passed")).toBe(true);
  });

  it.each([
    ["M6D", "m6d-composite.json", "m6d-opaque-composite"],
    ["M6B", "m6b-conformance.json", "m6b-spatial-fixture"],
    ["M6C", "m6c-alpha-conformance.json", "m6c-opaque-target-alpha"],
    ["registered application", "registered-app-m6.json", "registered-architecture-rise-m3-m6"],
    ["final display lifecycle", "lifecycle/final-display-failure.json", "final-display-failure"],
    ["another lifecycle", "lifecycle/raw-first-provisioning.json", "raw-first-resource-provisioning"],
    ["production isolation", "production-isolation.json", "production-webgl-isolation"],
  ])("returns nonzero when required %s evidence is missing", (_name, file, scenarioId) => {
    const result = replay((directory) => removeEvidence(directory, file));

    expect(result.status).not.toBe(0);
    expect(result.report.qualificationPass).toBe(false);
    expect(result.report.scenarios.find(({ id }) => id === scenarioId)?.status).toBe("blocked");
  });

  it("returns nonzero and records malformed required JSON", () => {
    const result = replay((directory) => {
      writeFileSync(join(directory, "m6c-alpha-conformance.json"), "{ malformed");
    });

    expect(result.status).not.toBe(0);
    expect(result.report.qualificationPass).toBe(false);
    expect(result.report.evidenceReadIssues.some((issue) => issue.startsWith("m6c-alpha-conformance.json:"))).toBe(true);
  });

  it("returns nonzero when a required scenario fails its evidence contract", () => {
    const result = replay((directory) => {
      const path = join(directory, "m6d-composite.json");
      const capture = JSON.parse(readFileSync(path, "utf8")) as {
        controlledCompositeProbe: { cases: Array<{ measuredCompositeRgba: number[] }> };
      };
      capture.controlledCompositeProbe.cases[0]!.measuredCompositeRgba[0]! += 0.5;
      writeFileSync(path, `${JSON.stringify(capture)}\n`);
    });

    expect(result.status).not.toBe(0);
    expect(result.report.qualificationPass).toBe(false);
    expect(result.report.scenarios.find(({ id }) => id === "m6d-opaque-composite")?.status).toBe("failed");
  });
});
