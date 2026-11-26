import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";

const manifestPath = resolve(process.cwd(), "scripts/historical-evidence-manifest.json");
export const HISTORICAL_EVIDENCE_MANIFEST = JSON.parse(readFileSync(manifestPath, "utf8"));
const supported = HISTORICAL_EVIDENCE_MANIFEST.families;
const supportedIds = new Set(supported.map(({ id }) => id));
const ordinaryCiOnly = supported.filter((family) => family.alwaysInOrdinaryCi === true);
const automaticallyRouted = supported.filter((family) => family.alwaysInOrdinaryCi !== true);
const registeredOrdinaryCiOwners = new Set([
  "ordinary-ci:unit-tests",
  "ordinary-ci:evidence:check:m7r",
  "ordinary-ci:evidence:check:m7v",
  "ordinary-ci:application-ci",
]);
const m7vOrdinaryCiOwner = "ordinary-ci:evidence:check:m7v";
const legacyEvidenceRoots = HISTORICAL_EVIDENCE_MANIFEST.legacyEvidenceRoots ?? [];
const idToFamily = new Map(supported.map((family) => [family.id, family]));
const globalPaths = HISTORICAL_EVIDENCE_MANIFEST.sharedQualificationPaths;
const familyPattern = /m7([a-z])/i;
const shaPattern = /^[0-9a-f]{40}$/i;

/** Prevent manifest changes from silently assigning evidence to arbitrary CI owners. */
export function validateEvidenceOwnershipDeclarations(manifest = HISTORICAL_EVIDENCE_MANIFEST) {
  const errors = [];
  const declaredPaths = new Set();
  const declarations = [
    ...(manifest.families ?? [])
      .filter(({ alwaysInOrdinaryCi }) => alwaysInOrdinaryCi === true)
      .map(({ id, owner }) => ({ label: `family:${id}`, owner, path: null })),
    ...(manifest.ordinaryCiPaths ?? [])
      .map(({ path, owner }) => ({ label: `path:${path}`, owner, path })),
  ];
  for (const { label, owner, path } of declarations) {
    if (typeof owner !== "string" || !registeredOrdinaryCiOwners.has(owner)) {
      errors.push(`ordinary-ci-owner-unregistered:${label}:${String(owner ?? "<missing>")}`);
    }
    if (path !== null) {
      const normalized = typeof path === "string" ? path.replaceAll("\\", "/").replace(/^\.\//, "") : "";
      if (!normalized || normalized.startsWith("/") || normalized.split("/").includes("..")) {
        errors.push(`ordinary-ci-path-invalid:${label}`);
      } else if (declaredPaths.has(normalized.toLowerCase())) {
        errors.push(`ordinary-ci-path-duplicated:${normalized}`);
      } else {
        declaredPaths.add(normalized.toLowerCase());
      }
    }
  }
  const roots = manifest.legacyEvidenceRoots;
  if (!Array.isArray(roots) || roots.length === 0 || roots.some((root) => typeof root !== "string" ||
      !/^docs\/architecture\/[^/]+(?:\/[^/]+)*\/$/.test(root) || root.split("/").includes("..")) ||
      new Set(roots).size !== roots.length) {
    errors.push("legacy-evidence-roots-incomplete-or-too-broad");
  }
  return { valid: errors.length === 0, errors };
}

const ownershipValidation = validateEvidenceOwnershipDeclarations();
if (!ownershipValidation.valid) {
  throw new Error(`historical-evidence-manifest-ownership-invalid:${ownershipValidation.errors.join(",")}`);
}
const ordinaryCiOwners = [...new Set([
  ...ordinaryCiOnly.map(({ owner }) => owner),
  m7vOrdinaryCiOwner,
])];
// These specific audited tests and their direct local helpers do not consume
// retained historical evidence. Their byte identities are part of the audit:
// a change, deletion, or unreadable file must return to fail-closed routing.
const nonHistoricalCaptureAudits = new Map([
  ["src/tests/unit/roomAtDawnCaptureSync.test.ts", [
    ["src/tests/unit/roomAtDawnCaptureSync.test.ts", "ee7563ca79ca477988bcde5a7d515526b45506ba209bebe890150ae156a1b037"],
    ["experiments/room-at-dawn/capture-sync.cjs", "d8ec1b767a648759cc0242c2b78ddb1a255befcd3ccf737cac8c464ccad10874"],
  ]],
  ["src/tests/unit/roomAtDawnReflectionCapture.test.ts", [
    ["src/tests/unit/roomAtDawnReflectionCapture.test.ts", "b7993e6674135708663cc6f507c89d7104e31fb681ef0ca326f83dff95ee42ae"],
    ["experiments/room-at-dawn/reflection-capture.js", "75b358799453fd9b5b8cde386b03cbbbfbfaa74a819f1d0325d1fcb27d678ebf"],
  ]],
  // Audited from room-at-dawn PR #359 commit ba99cf13a776ffec65c505eed60687d8f7522b91:
  // test blob ddf5770bddabc075b03a222d74e993290cb2edf6 imports only the
  // local helper blob 0074da9623269dd68c8965b064c0fc0ba0e9fd99, which has
  // no runtime imports; neither consumes retained historical evidence.
  ["src/tests/unit/roomAtDawnComparisonCapture.test.ts", [
    ["src/tests/unit/roomAtDawnComparisonCapture.test.ts", "aca2d1ce20cd31c52dde8d5391371fc870af1574ec339d3ee25eb6c5c144d58c"],
    ["experiments/room-at-dawn/comparison-capture.ts", "9f5747c40f86cc016a4f4a1bb09413ef3f5b969ef89bc7bc8a0969e5bd12b597"],
  ]],
]);
// The imported helper is itself an input to the audit: a PR that changes
// only that helper must not bypass the same checkout-byte verification.
const nonHistoricalCaptureOwners = new Map(
  [...nonHistoricalCaptureAudits].flatMap(([owner, files]) => files.map(([file]) => [file, owner])),
);

function isAuditedNonHistoricalCaptureTest(path) {
  const auditedFiles = nonHistoricalCaptureAudits.get(path);
  if (!auditedFiles) return false;
  try {
    return auditedFiles.every(([file, expected]) =>
      createHash("sha256").update(readFileSync(resolve(process.cwd(), file))).digest("hex") === expected);
  } catch {
    return false;
  }
}

const normalizePath = (value) => value.replaceAll("\\", "/").replace(/^\.\//, "");
const isWithin = (path, prefix) => prefix.endsWith("/") ? path.startsWith(prefix) : path === prefix;
const isSharedQualificationPath = (path) => globalPaths.some((prefix) => isWithin(path, prefix));
const ordinaryCiPathOwners = new Map((HISTORICAL_EVIDENCE_MANIFEST.ordinaryCiPaths ?? [])
  .map(({ path, owner }) => [normalizePath(path).toLowerCase(), owner]));
const familyPathMatches = (path, family) => {
  const normalized = path.toLowerCase();
  if (family.artifactRoots.some((root) => normalized.startsWith(root.toLowerCase()))) return true;
  if (family.documentationPaths?.some((documentationPath) => normalizePath(documentationPath).toLowerCase() === normalized)) return true;
  if (family.replaySourcePaths?.some((sourcePath) => normalizePath(sourcePath) === path)) return true;
  if (HISTORICAL_EVIDENCE_MANIFEST.sourcePins.some((pin) =>
    pin.families.includes(family.id) && pin.verifyPaths.some((sourcePath) => normalizePath(sourcePath) === path))) return true;
  if (!/^(?:scripts|src)\//i.test(path)) return false;
  return normalized.includes(family.id.toLowerCase());
};

function allFamilies({ includeOrdinaryCiOnly = false } = {}) {
  const families = includeOrdinaryCiOnly ? supported : automaticallyRouted;
  return families.map(({ id }) => id);
}

function closeDependencies(initialIds) {
  const closure = new Set(initialIds);
  const queue = [...closure];
  while (queue.length > 0) {
    const current = queue.shift();
    for (const dependent of HISTORICAL_EVIDENCE_MANIFEST.dependencies[current] ?? []) {
      if (!closure.has(dependent)) {
        closure.add(dependent);
        queue.push(dependent);
      }
    }
  }
  return supported.map(({ id }) => id).filter((id) => closure.has(id));
}

function broadDecision(reason, { unverified = true, paths = [] } = {}) {
  return {
    decision: unverified ? "UNVERIFIED" : "QUALIFIED",
    families: allFamilies(),
    changedPaths: paths,
    broad: true,
    reasons: [reason],
    currentOwners: [...new Set([...ordinaryCiOwners, m7vOrdinaryCiOwner])],
    pathOwnership: [],
    unsupported: [],
  };
}

/** Classifies actual repository paths and closes each match over known report consumers. */
export function classifyChangedPaths(changedPaths, options = {}) {
  if (options.forceFull === true) {
    const unsupported = options.includeUnsupported === true
      ? Object.entries(HISTORICAL_EVIDENCE_MANIFEST.unsupportedFamilies).map(([id, reason]) => ({ id, reason }))
      : [];
    return {
      decision: unsupported.length > 0 ? "UNVERIFIED" : "QUALIFIED",
      families: allFamilies({ includeOrdinaryCiOnly: true }),
      changedPaths: [],
      broad: true,
      reasons: options.reason ? [options.reason] : ["full-historical-qualification-requested"],
      currentOwners: ["ordinary-ci:evidence:check:m7v"],
      pathOwnership: [],
      unsupported,
    };
  }

  if (!Array.isArray(changedPaths) || changedPaths.length === 0) {
    return broadDecision("changed-file-set-empty-or-unavailable", { paths: [] });
  }

  const paths = [...new Set(changedPaths.map((path) => normalizePath(String(path))))];
  if (paths.some((path) => !path || path.startsWith("/") || path.split("/").includes(".."))) {
    return broadDecision("changed-file-path-invalid", { paths });
  }

  const matched = new Set();
  const unsupported = new Map();
  const reasons = [];
  const currentOwners = new Set();
  const pathClassifications = new Map();
  let broad = false;
  let unverified = false;

  for (const path of paths) {
    const ownership = {
      path,
      historicalValidators: new Set(),
      ordinaryCiOwners: new Set(),
      unresolved: false,
      qualificationInfrastructure: false,
    };

    if (isSharedQualificationPath(path)) {
      broad = true;
      allFamilies().forEach((id) => {
        matched.add(id);
        ownership.historicalValidators.add(id);
      });
      [...ordinaryCiOwners, m7vOrdinaryCiOwner].forEach((owner) => {
        currentOwners.add(owner);
        ownership.ordinaryCiOwners.add(owner);
      });
      ownership.qualificationInfrastructure = true;
      reasons.push(`shared-qualification-path:${path}`);
      pathClassifications.set(path, ownership);
      continue;
    }

    const ordinaryCiPathOwner = ordinaryCiPathOwners.get(path.toLowerCase());
    if (ordinaryCiPathOwner) {
      currentOwners.add(ordinaryCiPathOwner);
      ownership.ordinaryCiOwners.add(ordinaryCiPathOwner);
      reasons.push(`ordinary-ci-path:${ordinaryCiPathOwner}:${path}`);
      pathClassifications.set(path, ownership);
      continue;
    }

    const lower = path.toLowerCase();
    const token = lower.match(familyPattern);
    let matchedKnownFamily = false;

    if (!token) {
      const replayOwners = automaticallyRouted.filter(({ replaySourcePaths = [] }) =>
        replaySourcePaths.some((sourcePath) => normalizePath(sourcePath) === path));
      for (const family of replayOwners) {
        matched.add(family.id);
        ownership.historicalValidators.add(family.id);
        reasons.push(`replay-source-dependency:${family.id}:${path}`);
      }
      matchedKnownFamily = replayOwners.length > 0;
    }

    if (token) {
      const candidate = `M7${token[1].toUpperCase()}`;
      if (candidate === "M7V") {
        currentOwners.add(m7vOrdinaryCiOwner);
        ownership.ordinaryCiOwners.add(m7vOrdinaryCiOwner);
        matched.add("M7W");
        ownership.historicalValidators.add("M7W");
        reasons.push(`current-m7v-input-also-feeds-m7w:${path}`);
        matchedKnownFamily = true;
      } else if (supportedIds.has(candidate) && idToFamily.get(candidate).alwaysInOrdinaryCi === true
        && familyPathMatches(path, idToFamily.get(candidate))) {
        const owner = idToFamily.get(candidate).owner;
        currentOwners.add(owner);
        ownership.ordinaryCiOwners.add(owner);
        reasons.push(`family-retained-in-ordinary-ci:${candidate}:${path}`);
        matchedKnownFamily = true;
      } else if (supportedIds.has(candidate) && familyPathMatches(path, idToFamily.get(candidate))) {
        matched.add(candidate);
        ownership.historicalValidators.add(candidate);
        reasons.push(`family-input:${candidate}:${path}`);
        matchedKnownFamily = true;
      } else {
        const unsupportedReason = HISTORICAL_EVIDENCE_MANIFEST.unsupportedFamilies[candidate]
          ?? `No qualification manifest or retained validator is registered for ${candidate}.`;
        unsupported.set(candidate, unsupportedReason);
        unverified = true;
        broad = true;
        allFamilies().forEach((id) => {
          matched.add(id);
          ownership.historicalValidators.add(id);
        });
        [...ordinaryCiOwners, m7vOrdinaryCiOwner].forEach((owner) => {
          currentOwners.add(owner);
          ownership.ordinaryCiOwners.add(owner);
        });
        ownership.unresolved = true;
        reasons.push(`unsupported-or-unmapped-historical-family:${candidate}:${path}`);
        matchedKnownFamily = true;
      }
    }

    if (!matchedKnownFamily && isEvidenceLikeUnknownPath(path)) {
      unverified = true;
      broad = true;
      allFamilies().forEach((id) => {
        matched.add(id);
        ownership.historicalValidators.add(id);
      });
      [...ordinaryCiOwners, m7vOrdinaryCiOwner].forEach((owner) => {
        currentOwners.add(owner);
        ownership.ordinaryCiOwners.add(owner);
      });
      ownership.unresolved = true;
      reasons.push(`unmapped-evidence-verification-dependency:${path}`);
    }

    pathClassifications.set(path, ownership);
  }

  const dependencyClosure = closeDependencies(matched);
  for (const familyId of dependencyClosure) {
    const family = idToFamily.get(familyId);
    if (family?.alwaysInOrdinaryCi === true) currentOwners.add(family.owner);
  }
  const families = dependencyClosure.filter((id) => idToFamily.get(id)?.alwaysInOrdinaryCi !== true);
  const pathOwnership = paths.map((path) => {
    const ownership = pathClassifications.get(path);
    const pathClosure = closeDependencies(ownership.historicalValidators);
    for (const familyId of pathClosure) {
      const family = idToFamily.get(familyId);
      if (family?.alwaysInOrdinaryCi === true) ownership.ordinaryCiOwners.add(family.owner);
    }
    const hasHistoricalValidator = pathClosure.some((id) => idToFamily.get(id)?.alwaysInOrdinaryCi !== true);
    const classification = ownership.unresolved ? "unresolved"
      : ownership.qualificationInfrastructure ? "qualification-infrastructure"
        : hasHistoricalValidator ? "historical-validator"
          : ownership.ordinaryCiOwners.size > 0 ? "ordinary-ci" : "non-evidence";
    return {
      path,
      classification,
      historicalValidators: pathClosure.filter((id) => idToFamily.get(id)?.alwaysInOrdinaryCi !== true),
      ordinaryCiOwners: [...ownership.ordinaryCiOwners],
      unresolved: ownership.unresolved,
    };
  });
  if (families.length === 0 && !unverified) {
    return {
      decision: "NOT_APPLICABLE",
      families: [],
      changedPaths: paths,
      broad: false,
      reasons: ["complete-path-set-has-no-frozen-historical-qualification-dependency"],
      currentOwners: [...currentOwners],
      pathOwnership,
      unsupported: [],
    };
  }

  return {
    decision: unverified ? "UNVERIFIED" : "QUALIFIED",
    families,
    changedPaths: paths,
    broad,
    reasons: [...new Set(reasons)],
    currentOwners: [...currentOwners],
    pathOwnership,
    unsupported: [...unsupported].map(([id, reason]) => ({ id, reason })),
  };
}

/** Classifies a path set only after event discovery proved the set complete. */
export function classifyCompleteChangedPaths(changedPaths) {
  if (!Array.isArray(changedPaths)) return failedClosedRoute("complete-changed-file-set-invalid");
  if (changedPaths.length === 0) {
    return {
      decision: "NOT_APPLICABLE",
      families: [],
      changedPaths: [],
      broad: false,
      reasons: ["complete-changed-file-set-is-empty"],
      currentOwners: [...new Set([...ordinaryCiOwners, m7vOrdinaryCiOwner])],
      pathOwnership: [],
      unsupported: [],
    };
  }
  return classifyChangedPaths(changedPaths);
}

function isEvidenceLikeUnknownPath(path) {
  const auditedOwner = nonHistoricalCaptureOwners.get(path);
  if (auditedOwner) return !isAuditedNonHistoricalCaptureTest(auditedOwner);
  const lower = path.toLowerCase();
  if (/^docs\/architecture\//.test(lower)) {
    if (legacyEvidenceRoots.some((root) => lower.startsWith(root.toLowerCase()))) return true;
    if (/(?:^|\/)[^/]*archive[^/]*\//.test(lower)) return true;
  }
  if (/^docs\/architecture\//.test(lower) && /(?:evidence|capture|qualification|provenance|report|m7)/i.test(lower)) return true;
  if (/^scripts\//i.test(path) && /(?:evidence|capture|qualification|provenance|replay|normaliz|evaluate|historical)/i.test(path)) return true;
  if (/^src\//i.test(path) && /(?:evidence|capture|qualification|provenance|m7)/i.test(path)) return true;
  return false;
}

export function parseNameStatusZ(output) {
  const entries = output.split("\0");
  const paths = [];
  for (let index = 0; index < entries.length;) {
    const status = entries[index++];
    if (!status) continue;
    const pathCount = /^[RC]/.test(status) ? 2 : 1;
    for (let pathIndex = 0; pathIndex < pathCount; pathIndex += 1) {
      const path = entries[index++];
      if (!path) throw new Error("Git returned an incomplete name-status record");
      paths.push(path);
    }
  }
  return paths;
}

function checkedPrIdentity(event, repository) {
  const pull = event?.pull_request;
  const base = pull?.base;
  const head = pull?.head;
  if (event?.repository?.full_name !== repository || base?.repo?.full_name !== repository ||
      !Number.isSafeInteger(pull?.number) || pull.number < 1 ||
      !shaPattern.test(head?.sha ?? "") || !shaPattern.test(base?.sha ?? "") ||
      typeof head?.ref !== "string" || typeof base?.ref !== "string") {
    throw new Error("pull-request-event-identity-incomplete");
  }
  return { pullNumber: pull.number, eventHeadSha: head.sha, eventBaseSha: base.sha, baseRef: base.ref };
}

/** Re-reads the PR, verifies its exact event revision, then retrieves every changed-file page. */
export async function discoverPullRequestPaths(event, { repository, apiRequest, maxPages = 30 }) {
  const identity = checkedPrIdentity(event, repository);
  if (typeof apiRequest !== "function") throw new Error("pull-request-api-client-unavailable");
  const detail = await apiRequest(`/repos/${repository}/pulls/${identity.pullNumber}`);
  if (detail?.number !== identity.pullNumber || detail?.state !== "open" ||
      detail?.base?.repo?.full_name !== repository || detail?.base?.ref !== identity.baseRef ||
      detail?.base?.sha !== identity.eventBaseSha || detail?.head?.sha !== identity.eventHeadSha ||
      typeof detail?.changed_files !== "number" || !Number.isSafeInteger(detail.changed_files) || detail.changed_files < 0) {
    throw new Error("pull-request-head-base-or-state-is-stale");
  }

  const files = [];
  let fileCount = 0;
  let complete = false;
  for (let page = 1; page <= maxPages; page += 1) {
    const rows = await apiRequest(`/repos/${repository}/pulls/${identity.pullNumber}/files?per_page=100&page=${page}`);
    if (!Array.isArray(rows)) throw new Error("pull-request-files-response-invalid");
    for (const row of rows) {
      if (!row || typeof row.filename !== "string" || row.filename.length === 0 ||
          !["added", "modified", "removed", "renamed", "copied", "changed"].includes(row.status)) {
        throw new Error("pull-request-file-row-incomplete");
      }
      fileCount += 1;
      files.push(row.filename);
      if (row.status === "renamed") {
        if (typeof row.previous_filename !== "string" || row.previous_filename.length === 0) {
          throw new Error("pull-request-rename-source-missing");
        }
        files.push(row.previous_filename);
      }
    }
    if (rows.length < 100) {
      complete = true;
      break;
    }
  }
  if (!complete || fileCount !== detail.changed_files) {
    throw new Error("pull-request-file-pagination-incomplete");
  }
  const finalDetail = await apiRequest(`/repos/${repository}/pulls/${identity.pullNumber}`);
  if (finalDetail?.number !== identity.pullNumber || finalDetail?.state !== "open" ||
      finalDetail?.base?.repo?.full_name !== repository || finalDetail?.base?.ref !== identity.baseRef ||
      finalDetail?.base?.sha !== identity.eventBaseSha || finalDetail?.head?.sha !== identity.eventHeadSha ||
      finalDetail?.changed_files !== detail.changed_files) {
    throw new Error("pull-request-changed-during-file-pagination");
  }
  return {
    paths: files,
    pullNumber: identity.pullNumber,
    headSha: identity.eventHeadSha,
    baseSha: identity.eventBaseSha,
    baseRef: identity.baseRef,
  };
}

/** Compares the exact push trees. A new branch uses main's merge-base; uncertainty is surfaced. */
export async function discoverPushPaths(event, { runGit, repositoryRoot = process.cwd() }) {
  const before = event?.before;
  const after = event?.after;
  if (event?.deleted === true || after === "0".repeat(40)) return { paths: [], noCommit: true, reason: "branch-deleted" };
  if (typeof runGit !== "function" || !shaPattern.test(after ?? "")) throw new Error("push-commit-identity-invalid");

  const head = await runGit(["rev-parse", "HEAD"], repositoryRoot);
  if (head.trim() !== after) throw new Error("checked-out-head-does-not-match-push-after-sha");
  const afterObject = await runGit(["cat-file", "-e", `${after}^{commit}`], repositoryRoot, true);
  if (afterObject.status !== 0) throw new Error("push-after-commit-unavailable");

  let base = before;
  if (before === "0".repeat(40)) {
    const shallow = (await runGit(["rev-parse", "--is-shallow-repository"], repositoryRoot)).trim() === "true";
    const fetchArgs = shallow
      ? ["fetch", "--unshallow", "--no-tags", "origin", "refs/heads/main:refs/remotes/origin/main"]
      : ["fetch", "--no-tags", "origin", "refs/heads/main:refs/remotes/origin/main"];
    await runGit(fetchArgs, repositoryRoot);
    base = (await runGit(["merge-base", "refs/remotes/origin/main", after], repositoryRoot)).trim();
    if (!shaPattern.test(base)) throw new Error("new-branch-has-no-main-merge-base");
  } else {
    if (!shaPattern.test(before ?? "")) throw new Error("push-before-sha-invalid");
    const beforeObject = await runGit(["cat-file", "-e", `${before}^{commit}`], repositoryRoot, true);
    if (beforeObject.status !== 0) {
      await runGit(["fetch", "--no-tags", "--depth=1", "origin", before], repositoryRoot);
    }
    const confirmedBefore = await runGit(["cat-file", "-e", `${before}^{commit}`], repositoryRoot, true);
    if (confirmedBefore.status !== 0) throw new Error("push-before-commit-unavailable");
  }

  const diff = await runGit(["diff", "--name-status", "-M", "-z", base, after], repositoryRoot);
  return { paths: parseNameStatusZ(diff), beforeSha: before, afterSha: after, comparisonBaseSha: base, noCommit: false };
}

export function failedClosedRoute(reason) {
  return broadDecision(reason, { unverified: true });
}

export function determineQualificationDecision({ routeDecision, hasFamilies, sourceFailure = false, missingArtifacts = false, validatorFailure = false, unsupported = false }) {
  if (!hasFamilies && routeDecision === "NOT_APPLICABLE") return "NOT_APPLICABLE";
  if (routeDecision === "UNVERIFIED" || sourceFailure || missingArtifacts || unsupported) return "UNVERIFIED";
  if (validatorFailure) return "FAILED";
  return routeDecision === "QUALIFIED" || routeDecision === "QUALIFIED_WITH_LEGACY_ARCHIVAL"
    ? routeDecision
    : "UNVERIFIED";
}

export function manifestPathForDiagnostics() {
  return manifestPath;
}
