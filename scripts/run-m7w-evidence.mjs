import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve, dirname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import {
  M7W_EXECUTION_SOURCE_SHA,
  evaluateM7wEvidence,
  verifyM7wDigest,
} from "./evaluateM7wQualification.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const reportArgument = process.argv.find((argument) => argument.startsWith("--report-path="));
const reportPath = reportArgument
  ? resolve(root, reportArgument.slice("--report-path=".length))
  : resolve(root, "docs/architecture/GROUND_GLASS_M7W_WEBGL_QUALIFICATION_REPORT.json");
const governancePath = resolve(root, "docs/architecture/GROUND_GLASS_M7V_E2E_SKIP_GOVERNANCE_REPORT.json");
const inventoryPath = resolve(root, "docs/architecture/ground-glass-m7v-skip-governance/current-inventory-reconciliation.json");
const manifestPath = resolve(root, "docs/architecture/ground-glass-m7w-qualification/capture/execution-manifest.json");
const report = JSON.parse(readFileSync(reportPath, "utf8"));
const governance = JSON.parse(readFileSync(governancePath, "utf8"));
const inventory = JSON.parse(readFileSync(inventoryPath, "utf8"));
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const issues = [];
const manifestCaptureNames = {
  ordinary: "ordinary",
  representativeSingle: "representativeSingle",
  rendererSerial: "rendererSerial",
};

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function git(args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function gitBytes(args) {
  return execFileSync("git", args, { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
}

function verifyCommitTree(commitSha, filePaths, label) {
  if (!/^[a-f0-9]{40}$/.test(commitSha ?? "")) {
    issues.push(label + "-commit-sha-invalid");
    return;
  }
  try {
    git(["cat-file", "-e", commitSha + "^{commit}"]);
  } catch {
    issues.push(label + "-commit-unavailable");
    return;
  }
  for (const path of filePaths) {
    try {
      git(["cat-file", "-e", commitSha + ":" + path]);
    } catch {
      issues.push(label + "-tree-path-missing:" + path);
    }
  }
}

function loadPublicCapture(name) {
  const capture = report.captures?.[name];
  const artifact = capture?.publicRaw;
  const manifestCapture = manifest.captures?.[manifestCaptureNames[name]];
  if (!artifact?.path) {
    issues.push(name + "-public-report-path-missing");
    return null;
  }
  if (!manifestCapture ||
      manifestCapture.publicReportPath !== artifact.path ||
      manifestCapture.originalRawSha256 !== artifact.originalRawSha256 ||
      manifestCapture.originalRawBytes !== artifact.originalRawBytes ||
      manifestCapture.originalRawRetainedInRepository !== false ||
      artifact.originalRawRetainedInRepository !== false) {
    issues.push(name + "-execution-manifest-mismatch");
  }
  const relativePath = artifact.path;
  if (relativePath.startsWith("/") || relativePath.split(/[\\/]/).includes("..")) {
    issues.push(name + "-public-report-path-unsafe");
    return null;
  }
  const absolutePath = resolve(root, relativePath);
  if (!absolutePath.startsWith(root + sep)) {
    issues.push(name + "-public-report-path-outside-repository");
    return null;
  }
  let bytes;
  try {
    bytes = readFileSync(absolutePath);
  } catch {
    issues.push(name + "-public-report-missing");
    return null;
  }
  if (sha256(bytes) !== artifact.sha256) issues.push(name + "-public-report-digest-mismatch");
  if (bytes.length !== artifact.bytes) issues.push(name + "-public-report-size-mismatch");
  if (bytes.toString("utf8").includes("/Users/")) issues.push(name + "-public-report-private-path-remains");
  try {
    return JSON.parse(bytes.toString("utf8"));
  } catch {
    issues.push(name + "-public-report-json-invalid");
    return null;
  }
}

function verifyAttachments(name, capture, playwrightReport) {
  const references = new Set();
  function visit(suite) {
    for (const child of suite.suites ?? []) visit(child);
    for (const spec of suite.specs ?? []) for (const test of spec.tests ?? []) for (const result of test.results ?? []) {
      for (const attachment of result.attachments ?? []) if (typeof attachment.path === "string") references.add(attachment.path);
    }
  }
  for (const suite of playwrightReport?.suites ?? []) visit(suite);
  const recorded = capture.attachmentArtifacts ?? [];
  if (references.size !== recorded.length || recorded.some((item) => !references.has(item.path))) {
    issues.push(name + "-attachment-inventory-mismatch");
  }
  for (const artifact of recorded) {
    if (artifact.path.startsWith("/") || artifact.path.split(/[\\/]/).includes("..")) {
      issues.push(name + "-attachment-path-unsafe:" + artifact.path);
      continue;
    }
    const absolute = resolve(root, artifact.path);
    if (!absolute.startsWith(root + sep)) {
      issues.push(name + "-attachment-path-outside-repository:" + artifact.path);
      continue;
    }
    try {
      const bytes = readFileSync(absolute);
      if (sha256(bytes) !== artifact.sha256) issues.push(name + "-attachment-digest-mismatch:" + artifact.path);
      if (bytes.length !== artifact.bytes) issues.push(name + "-attachment-size-mismatch:" + artifact.path);
    } catch {
      issues.push(name + "-attachment-missing:" + artifact.path);
    }
  }
}

if (report.provenance?.inventoryReportSha256 !== sha256(readFileSync(governancePath))) issues.push("m7v-governance-report-digest-mismatch");
if (report.provenance?.currentInventorySha256 !== sha256(readFileSync(inventoryPath))) issues.push("m7v-current-inventory-digest-mismatch");
if (report.provenance?.inventorySourceCommitSha !== inventory.provenance?.currentSourceCommitSha) issues.push("m7v-inventory-source-revision-mismatch");
if (manifest.executionSourceCommitSha !== M7W_EXECUTION_SOURCE_SHA) issues.push("execution-manifest-source-revision-mismatch");
if (report.provenance?.executionSourceCommitSha !== manifest.executionSourceCommitSha) issues.push("execution-source-provenance-mismatch");
if (report.provenance?.originalRawArtifactsRetained !== false || report.provenance?.publicRedactedExportsRetained !== true) issues.push("raw-redaction-disclosure-invalid");

const executionPaths = [
  "playwright.config.ts",
  ...new Set(inventory.profiles.standard.tests.map((test) => test.specPath)),
];
verifyCommitTree(M7W_EXECUTION_SOURCE_SHA, executionPaths, "execution-source");

const analysisSource = report.provenance?.analysisSourceCommitSha;
const analysisFiles = report.provenance?.analysisSourceFiles ?? [];
const requiredAnalysisFiles = [
  "scripts/evaluateM7wQualification.mjs",
  "scripts/normalizeM7wQualificationCapture.mjs",
  "scripts/run-m7w-evidence.mjs",
];
if (new Set(analysisFiles.map((item) => item.path)).size !== requiredAnalysisFiles.length ||
    requiredAnalysisFiles.some((path) => !analysisFiles.some((item) => item.path === path))) {
  issues.push("analysis-source-file-inventory-invalid");
}
verifyCommitTree(analysisSource, requiredAnalysisFiles, "analysis-source");
for (const source of analysisFiles) {
  if (!/^[a-f0-9]{64}$/.test(source.sha256 ?? "")) {
    issues.push("analysis-source-file-digest-invalid:" + source.path);
    continue;
  }
  try {
    const workingBytes = readFileSync(resolve(root, source.path));
    if (sha256(workingBytes) !== source.sha256) issues.push("analysis-source-working-tree-mismatch:" + source.path);
    const committedBytes = gitBytes(["show", analysisSource + ":" + source.path]);
    if (!verifyM7wDigest(workingBytes, source.sha256) || !verifyM7wDigest(committedBytes, source.sha256)) issues.push("analysis-source-content-mismatch:" + source.path);
  } catch {
    issues.push("analysis-source-file-unavailable:" + source.path);
  }
}

const rawCaptures = {
  ordinary: loadPublicCapture("ordinary"),
  representativeSingle: loadPublicCapture("representativeSingle"),
  rendererSerial: loadPublicCapture("rendererSerial"),
};
for (const name of Object.keys(rawCaptures)) verifyAttachments(name, report.captures?.[name] ?? {}, rawCaptures[name]);

const ordinaryProject = inventory.profiles.standard.tests.filter((test) => test.project === "chromium");
const ordinaryRequired = ordinaryProject.filter((test) => test.lane === "ordinary-webgl");
const ordinaryNonMandatory = ordinaryProject.filter((test) => test.lane !== "ordinary-webgl");
const rendererSerialRequired = inventory.profiles.standard.tests.filter((test) => test.lane === "renderer-serial");
const evaluation = evaluateM7wEvidence({
  report,
  inventories: {
    ordinaryProject: ordinaryProject.map((test) => test.identity),
    ordinaryRequired: ordinaryRequired.map((test) => test.identity),
    ordinaryNonMandatory: ordinaryNonMandatory.map((test) => test.identity),
    rendererSerialRequired: rendererSerialRequired.map((test) => test.identity),
    m7uAddedIdentities: inventory.reconciliation.m7uAddedIdentities,
    historicalOrdinaryByIdentity: Object.fromEntries(ordinaryRequired.map((test) => [test.identity, test.historicalM7rOutcome ?? "unknown"])),
  },
  rawCaptures,
});
issues.push(...evaluation.issues);

if (issues.length > 0) {
  console.error("M7W evidence integrity: FAIL");
  for (const issue of [...new Set(issues)]) console.error(" - " + issue);
  process.exitCode = 1;
} else {
  console.log("M7W evidence integrity: PASS");
  console.log("Ordinary Chromium discovery: " + report.captures.ordinary.summary.discovered);
  console.log("Ordinary WebGL mandatory: " + report.decision.ordinaryWebgl.requiredIdentityCounts.passed + " passed, " + report.decision.ordinaryWebgl.requiredIdentityCounts.unexpected + " unexpected, " + report.decision.ordinaryWebgl.requiredIdentityCounts.skipped + " skipped");
  console.log("Renderer-Serial: " + report.decision.rendererSerial.requiredIdentityCounts.passed + "/" + report.decision.rendererSerial.requiredIdentityCounts.discovered + " passed");
  console.log("M7V trusted qualification artifact: " + report.decision.m7vStrictEvidence);
  console.log("M7: " + report.qualification.m7 + "; M8 entry: " + report.qualification.m8Entry);
}
