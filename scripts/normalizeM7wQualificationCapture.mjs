import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import {
  M7W_EVALUATOR_REVISION,
  deriveM7wFailureSurface,
  flattenM7wPlaywrightReport,
  summarizeM7wCapture,
} from "./evaluateM7wQualification.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const evidenceRoot = "docs/architecture/ground-glass-m7w-qualification";
const manifestPath = resolve(root, evidenceRoot, "capture/execution-manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const inventoryPath = resolve(root, "docs/architecture/ground-glass-m7v-skip-governance/current-inventory-reconciliation.json");
const governancePath = resolve(root, "docs/architecture/GROUND_GLASS_M7V_E2E_SKIP_GOVERNANCE_REPORT.json");
const inventory = JSON.parse(readFileSync(inventoryPath, "utf8"));
const governance = JSON.parse(readFileSync(governancePath, "utf8"));

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function loadCapture(key) {
  const item = manifest.captures[key];
  const reportPath = resolve(root, item.publicReportPath);
  const bytes = readFileSync(reportPath);
  if (item.originalRawRetainedInRepository !== false) throw new Error(key + ": original raw retention disclosure must remain explicit");
  if (!/^[a-f0-9]{64}$/.test(item.originalRawSha256)) throw new Error(key + ": original raw digest is malformed");
  const playwrightReport = JSON.parse(bytes.toString("utf8"));
  const results = flattenM7wPlaywrightReport(playwrightReport);
  const summary = summarizeM7wCapture(playwrightReport, results);
  const attachments = new Map();
  for (const row of results) for (const attempt of row.attempts) for (const attachment of attempt.attachments) {
    if (!attachment.path) continue;
    const path = attachment.path;
    if (path.startsWith("/") || path.split(/[\\/]/).includes("..")) throw new Error(key + ": unsafe attachment path " + path);
    const absolute = resolve(root, path);
    if (!absolute.startsWith(root + sep)) throw new Error(key + ": attachment escaped repository root");
    const attachmentBytes = readFileSync(absolute);
    attachments.set(path, { path, sha256: sha256(attachmentBytes), bytes: statSync(absolute).size });
  }
  return {
    publicRaw: {
      path: item.publicReportPath,
      sha256: sha256(bytes),
      bytes: bytes.length,
      originalRawSha256: item.originalRawSha256,
      originalRawBytes: item.originalRawBytes,
      originalRawRetainedInRepository: false,
      redaction: "absolute worktree and user-specific runtime paths replaced; outcomes, times, identities, retries, worker metadata, errors, and attachment references retained",
    },
    summary,
    results,
    attachmentArtifacts: [...attachments.values()].sort((a, b) => a.path.localeCompare(b.path)),
  };
}

function stripAnsi(value) {
  return String(value ?? "").replace(/\u001b\[[0-9;]*m/g, "");
}

function identityRow(row) {
  const attempt = row.attempts.at(-1) ?? null;
  return {
    identity: row.identity,
    project: row.project,
    specPath: row.specPath,
    titlePath: row.titlePath,
    sourceLine: row.sourceLine,
    expectedStatus: row.expectedStatus,
    status: row.status,
    retryCount: row.retryCount,
    attempts: row.attempts,
    actualWorkerIndex: attempt?.workerIndex ?? null,
    actualParallelIndex: attempt?.parallelIndex ?? null,
    executionStart: attempt?.startTime ?? null,
    durationMs: attempt?.durationMs ?? null,
    failureSurface: row.status === "passed" || row.status === "skipped" ? null : deriveM7wFailureSurface(row),
    errorLocation: attempt?.errorLocation ?? null,
    errorExcerpt: row.status === "passed" || row.status === "skipped" ? null : stripAnsi(attempt?.errorText).slice(0, 1800),
  };
}

const captures = {
  ordinary: loadCapture("ordinary"),
  representativeSingle: loadCapture("representativeSingle"),
  rendererSerial: loadCapture("rendererSerial"),
};

const standardTests = inventory.profiles.standard.tests;
const ordinaryProjectTests = standardTests.filter((test) => test.project === "chromium");
const ordinaryRequired = ordinaryProjectTests.filter((test) => test.lane === "ordinary-webgl");
const ordinaryNonMandatory = ordinaryProjectTests.filter((test) => test.lane !== "ordinary-webgl");
const rendererSerial = standardTests.filter((test) => test.lane === "renderer-serial");
const historicalOrdinary = ordinaryRequired.filter((test) => test.historicalM7rOutcome !== null);
const historicalStatusCounts = {};
for (const test of historicalOrdinary) historicalStatusCounts[test.historicalM7rOutcome] = (historicalStatusCounts[test.historicalM7rOutcome] ?? 0) + 1;

const historicalByIdentity = new Map(ordinaryRequired.map((test) => [test.identity, test]));
const singleByIdentity = new Map(captures.representativeSingle.results.map((row) => [row.identity, row]));
const ordinaryRequiredRows = captures.ordinary.results.filter((row) => historicalByIdentity.has(row.identity));
const failureClassifications = ordinaryRequiredRows.filter((row) => !["passed", "skipped"].includes(row.status)).map((row) => {
  const reproduction = singleByIdentity.get(row.identity);
  return {
    identity: row.identity,
    specPath: row.specPath,
    historicalM7rStatus: historicalByIdentity.get(row.identity)?.historicalM7rOutcome ?? "new-in-m7u",
    fullRunStatus: row.status,
    failureSurface: deriveM7wFailureSurface(row),
    failureStage: row.attempts.at(-1)?.errorLocation ?? null,
    assertionOrAction: stripAnsi(row.attempts.at(-1)?.errorText).slice(0, 1800),
    workerIndex: row.attempts.at(-1)?.workerIndex ?? null,
    parallelIndex: row.attempts.at(-1)?.parallelIndex ?? null,
    durationMs: row.attempts.at(-1)?.durationMs ?? null,
    category: "unclassified",
    reproductionStatus: reproduction?.status === "passed" ? "not-reproduced" : "not-rechecked",
    targetedSingleWorkerOutcome: reproduction?.status ?? null,
    rootCauseConfidence: "none",
    proposedSmallestRemediation: "No fix is authorized by this result alone; reproduce the exact public assertion against the immutable baseline before choosing application or test-contract changes.",
    blocksRequiredQualificationLane: true,
  };
});

const failureGroups = new Map();
for (const classification of failureClassifications) {
  const current = failureGroups.get(classification.failureSurface) ?? { failureSurface: classification.failureSurface, count: 0, identities: [] };
  current.count += 1;
  current.identities.push(classification.identity);
  failureGroups.set(classification.failureSurface, current);
}
const failureCohorts = [...failureGroups.values()].sort((a, b) => b.count - a.count || a.failureSurface.localeCompare(b.failureSurface));

const transitions = new Map();
for (const row of ordinaryRequiredRows) {
  const previous = historicalByIdentity.get(row.identity)?.historicalM7rOutcome ?? "unknown";
  const key = previous + "->" + row.status;
  transitions.set(key, (transitions.get(key) ?? 0) + 1);
}
const representativeIds = captures.representativeSingle.results.map((row) => row.identity);
const drawerCohort = failureClassifications.filter((item) => item.failureSurface === "learning-drawer-open-position-assertion");

const analysisCommitSha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
const analysisFiles = [
  "scripts/evaluateM7wQualification.mjs",
  "scripts/normalizeM7wQualificationCapture.mjs",
  "scripts/run-m7w-evidence.mjs",
];
const analysisSourceFiles = analysisFiles.map((path) => ({
  path,
  sha256: sha256(readFileSync(resolve(root, path))),
}));

const report = {
  schemaVersion: 1,
  reportId: "ground-glass-m7w-webgl-qualification",
  evaluatorRevision: M7W_EVALUATOR_REVISION,
  provenance: {
    executionSourceCommitSha: manifest.executionSourceCommitSha,
    inventorySourceCommitSha: inventory.provenance.currentSourceCommitSha,
    inventoryReportSha256: sha256(readFileSync(resolve(root, "docs/architecture/GROUND_GLASS_M7V_E2E_SKIP_GOVERNANCE_REPORT.json"))),
    currentInventorySha256: sha256(readFileSync(inventoryPath)),
    analysisSourceCommitSha: analysisCommitSha,
    analysisSourceFiles,
    originalRawArtifactsRetained: false,
    publicRedactedExportsRetained: true,
  },
  environment: manifest.environment,
  inventory: {
    standardDiscovered: standardTests.length,
    ordinaryProjectDiscovered: ordinaryProjectTests.length,
    requiredOrdinaryIdentities: ordinaryRequired.map((test) => test.identity),
    ordinaryProjectIdentities: ordinaryProjectTests.map((test) => test.identity),
    ordinaryNonMandatoryIdentities: ordinaryNonMandatory.map((test) => test.identity),
    rendererSerialIdentities: rendererSerial.map((test) => test.identity),
    m7uAddedIdentities: inventory.reconciliation.m7uAddedIdentities,
    historicalOrdinaryByIdentity: Object.fromEntries(ordinaryRequired.map((test) => [test.identity, test.historicalM7rOutcome ?? "unknown"])),
    historicalM7r: {
      standardDiscovered: 278,
      ordinaryProjectDiscovered: 274,
      ordinaryMandatoryExecuted: historicalOrdinary.length,
      ordinaryMandatoryPassed: historicalStatusCounts.passed ?? 0,
      ordinaryMandatoryUnexpected: (historicalStatusCounts.failed ?? 0) + (historicalStatusCounts.timedOut ?? 0),
      ordinaryConditionalSkipped: 75,
      rendererSerialPassed: rendererSerial.filter((test) => test.historicalM7rOutcome === "passed").length,
      rendererSerialUnexpected: rendererSerial.filter((test) => !["passed", null].includes(test.historicalM7rOutcome)).length,
      retries: 0,
      incomplete: 0,
      reportSha256: "b39b3c4b4a0c56b8d62120ccc62dfcca509e37356c565538316d983dc44b4823",
    },
    historicalTransitions: Object.fromEntries([...transitions.entries()].sort(([a], [b]) => a.localeCompare(b))),
  },
  captures,
  targetedReproduction: {
    sourceCommitSha: manifest.executionSourceCommitSha,
    selectedIdentities: representativeIds,
    configuredWorkers: 1,
    retries: 0,
    result: "4/4 passed in the one-worker subset; failures from the full four-worker run were not reproduced under this different bounded workload",
  },
  failureClassifications,
  failureCohorts,
  decision: {
    outcome: "W2",
    ordinaryWebgl: {
      qualification: "not-qualified",
      executionCompleteness: "complete",
      requiredIdentityCounts: {
        discovered: ordinaryRequired.length,
        passed: ordinaryRequiredRows.filter((row) => row.status === "passed").length,
        unexpected: ordinaryRequiredRows.filter((row) => !["passed", "skipped"].includes(row.status)).length,
        skipped: ordinaryRequiredRows.filter((row) => row.status === "skipped").length,
        retries: ordinaryRequiredRows.reduce((sum, row) => sum + row.retryCount, 0),
        incomplete: ordinaryRequiredRows.filter((row) => ["incomplete", "interrupted"].includes(row.status)).length,
      },
      localEvidenceTrust: "complete redacted Playwright execution evidence; not an authenticated M7V GitHub lane artifact",
    },
    rendererSerial: {
      qualification: "locally-passed",
      executionCompleteness: "complete",
      localExecution: "locally-passed",
      requiredIdentityCounts: {
        discovered: captures.rendererSerial.results.length,
        passed: captures.rendererSerial.summary.passed,
        unexpected: captures.rendererSerial.summary.unexpected,
        skipped: captures.rendererSerial.summary.skipped,
        retries: captures.rendererSerial.summary.retries,
        incomplete: captures.rendererSerial.summary.incomplete,
      },
      localEvidenceTrust: "complete redacted Playwright execution evidence; not an authenticated M7V GitHub lane artifact",
    },
    m7vStrictEvidence: "incomplete",
    m7vCompatibility: {
      accepted: false,
      reason: "M7V v2 requires a trusted artifact from the reserved .github/workflows/m7v-lane-qualification.yml workflow, which does not exist on the accepted M7V source. Its per-identity renderer evidence schema also requires webgl-renderer/webgl2 rows for every ordinary identity, including non-rendering and explicit WebGPU-fallback compatibility controls; no such per-test runtime collector exists. M7W does not fabricate these observations or alter M7V.",
    },
    nextRemediation: {
      objective: "Bounded Learning Drawer open-position cohort verification under the ordinary four-worker lane.",
      rationale: "The largest exact shared assertion surface is the existing learningOverlay.ts toHaveCSS open-position failure; one isolated representative passed once, so the full-run failure is not a verified application defect or a verified fix.",
      affectedIdentities: drawerCohort.map((item) => item.identity),
      negativeControls: ["closed/peek remains rejected", "materially translated drawer remains rejected", "Task/Feedback controls remain reachable only when the public open-state contract is satisfied"],
      acceptance: ["reproduce exact identities on the immutable M7V merge source", "change only the justified application or helper contract", "matched candidate evidence retains meaningful visual geometry checks", "do not claim all historic drawer cases fixed from one pass"],
      stopCondition: "Stop after the exact shared helper cohort has matched baseline/candidate evidence; route unrelated assertion surfaces separately.",
    },
  },
  qualification: {
    broadE2e: "not-qualified",
    m7: "partially-qualified",
    m8Entry: "denied",
    spontaneousExternalGpuDeviceLoss: "blocked",
    productionGroundGlass: "webgl-only",
    productionWebgpu: "disabled",
  },
  notes: [
    "The mandatory Ordinary WebGL projection is derived from the M7V current-inventory reconciliation; the complete Chromium project was executed once so the 75 conditional skips remain visible.",
    "The single-worker reproduction contains four preselected identities that failed in the full run; its passing results are a bounded non-reproduction under a different workload, not a fix or causal explanation.",
    "The Chromium browser probe reported WebGL 2 backed by ANGLE/SwiftShader. Hardware acceleration was not established.",
    "Runtime diagnostics recorded both default WebGL2 execution and a controlled WebGPU-to-WebGL2 fallback for a compatibility/pilot control; M7W does not classify that as native WebGPU.",
    "All current unexpected mandatory outcomes are assigned category unclassified because the bounded evidence does not independently establish application or infrastructure root cause.",
    "The original unredacted Playwright JSON bytes were hashed and kept outside the repository. The committed JSON files are public redacted exports with separate content hashes; the export digest is not the original raw digest.",
  ],
};

const outputPath = resolve(root, evidenceRoot, "../GROUND_GLASS_M7W_WEBGL_QUALIFICATION_REPORT.json");
await import("node:fs/promises").then(({ writeFile }) => writeFile(outputPath, JSON.stringify(report, null, 2) + "\n"));
console.log("Wrote " + outputPath);
