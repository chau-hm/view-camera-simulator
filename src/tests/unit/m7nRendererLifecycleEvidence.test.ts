import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { evaluateM7nRendererLifecycleEvidence } from "../../../scripts/evaluateM7nRendererLifecycle";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const acceptedReportPath = "docs/architecture/GROUND_GLASS_M7N_RENDERER_LIFECYCLE_REPORT.json";
type JsonRecord = Record<string, unknown>;

describe("M7N renderer lifecycle evidence evaluator", () => {
  it("accepts the retained report and rejects digest or causal-claim mutations", async () => {
    const report = JSON.parse(await readFile(resolve(repositoryRoot, acceptedReportPath), "utf8")) as JsonRecord;
    const fixtureDirectory = await mkdtemp(resolve(repositoryRoot, ".m7n-evidence-test-"));
    const reportPath = resolve(fixtureDirectory, "report.json");
    const relativeReportPath = reportPath.slice(repositoryRoot.length + 1);

    const evaluateMutation = async (mutation: (candidate: JsonRecord) => void) => {
      const candidate = structuredClone(report);
      mutation(candidate);
      await writeFile(reportPath, `${JSON.stringify(candidate, null, 2)}\n`);
      return evaluateM7nRendererLifecycleEvidence(relativeReportPath);
    };

    try {
      const valid = await evaluateMutation(() => undefined);
      expect(valid.passed, valid.issues.join(", ")).toBe(true);

      const alteredArtifact = await evaluateMutation((candidate) => {
        const experiments = candidate.experiments as JsonRecord[];
        experiments[0]!.outcomesArtifactSha256 = "0".repeat(64);
      });
      expect(alteredArtifact.passed).toBe(false);
      expect(alteredArtifact.issues).toContain("m7n-artifact-digest-mismatch");

      const unsupportedCause = await evaluateMutation((candidate) => {
        (candidate.diagnosis as JsonRecord).rootCause = "renderer-creation-failure";
      });
      expect(unsupportedCause.passed).toBe(false);
      expect(unsupportedCause.issues).toContain("m7n-causal-claim-exceeds-evidence");

      const selectedPassPromoted = await evaluateMutation((candidate) => {
        (candidate.qualification as JsonRecord).broadE2eQualification = "qualified";
      });
      expect(selectedPassPromoted.passed).toBe(false);
      expect(selectedPassPromoted.issues).toContain("m7n-broad-e2e-qualification-boundary-invalid");
    } finally {
      await rm(fixtureDirectory, { recursive: true, force: true });
    }
  });
});
