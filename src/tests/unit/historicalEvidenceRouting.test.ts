import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, relative, resolve } from "node:path";
import * as ts from "typescript";
import { describe, expect, it } from "vitest";
import {
  HISTORICAL_EVIDENCE_MANIFEST,
  classifyCompleteChangedPaths,
  classifyChangedPaths,
  discoverPullRequestPaths,
  discoverPushPaths,
  determineQualificationDecision,
  failedClosedRoute,
  parseNameStatusZ,
  validateEvidenceOwnershipDeclarations,
} from "../../../scripts/historical-evidence-routing.mjs";
import { HISTORICAL_QUALIFICATION_BASELINE } from "../../../scripts/historical-qualification-baseline.mjs";

const allFamilies = HISTORICAL_EVIDENCE_MANIFEST.families
  .filter(({ alwaysInOrdinaryCi }) => alwaysInOrdinaryCi !== true)
  .map(({ id }) => id);
const sha = (fill: string) => fill.repeat(40);

const runtimeLocalImportClosure = (entryPath: string): string[] => {
  const root = process.cwd();
  const seen = new Set<string>();
  const queue = [entryPath];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;
    if (seen.has(current)) continue;
    seen.add(current);
    const source = ts.createSourceFile(
      current,
      readFileSync(resolve(root, current), "utf8"),
      ts.ScriptTarget.Latest,
      true,
    );
    for (const statement of source.statements) {
      if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
      const clause = statement.importClause;
      if (clause?.isTypeOnly) continue;
      if (clause && !clause.name && clause.namedBindings && ts.isNamedImports(clause.namedBindings)
          && clause.namedBindings.elements.every((specifier) => specifier.isTypeOnly)) continue;
      const specifier = statement.moduleSpecifier.text;
      if (!specifier.startsWith(".")) continue;
      const resolved = ts.resolveModuleName(
        specifier,
        resolve(root, current),
        { moduleResolution: ts.ModuleResolutionKind.Bundler },
        ts.sys,
      ).resolvedModule;
      if (!resolved) continue;
      const localPath = relative(root, resolved.resolvedFileName).replaceAll("\\", "/");
      if (localPath.startsWith("scripts/") || localPath.startsWith("src/")) queue.push(localPath);
    }
  }
  return [...seen].filter((path) => path.startsWith("src/")).sort();
};

describe("historical evidence change routing", () => {
  it("keeps ordinary application changes outside the frozen archive lane", () => {
    expect(classifyChangedPaths(["src/components/simulator/SceneViewport.tsx"])).toMatchObject({
      decision: "NOT_APPLICABLE",
      families: [],
      broad: false,
      pathOwnership: [{
        path: "src/components/simulator/SceneViewport.tsx",
        classification: "non-evidence",
        historicalValidators: [],
        ordinaryCiOwners: [],
        unresolved: false,
      }],
    });
  });

  it("classifies an explicit legitimate architecture document consistently for development", () => {
    expect(classifyCompleteChangedPaths(["docs/architecture/new-camera-movement-design.md"])).toMatchObject({
      decision: "NOT_APPLICABLE",
      pathOwnership: [{
        path: "docs/architecture/new-camera-movement-design.md",
        classification: "non-evidence",
        historicalValidators: [],
        ordinaryCiOwners: [],
        unresolved: false,
      }],
    });
  });

  it("fails closed on unknown additions under registered or explicitly archive-named roots", () => {
    for (const path of [
      "docs/architecture/anatomy-gpu-blend-intermediate/unregistered-report.json",
      "docs/architecture/opaque-archive-directory/new.json",
      "docs/architecture/new-evidence-index.json",
    ]) {
      expect(classifyCompleteChangedPaths([path])).toMatchObject({
        decision: "UNVERIFIED",
        broad: true,
        pathOwnership: [{ path, classification: "unresolved", unresolved: true }],
      });
    }
  });

  it("rejects unregistered ordinary-CI owners and broad legacy roots", () => {
    const invalidOwner = structuredClone(HISTORICAL_EVIDENCE_MANIFEST);
    Object.defineProperty(invalidOwner.ordinaryCiPaths[0], "owner", { value: "ordinary-ci:invented-check" });
    expect(validateEvidenceOwnershipDeclarations(invalidOwner)).toMatchObject({
      valid: false,
      errors: ["ordinary-ci-owner-unregistered:path:src/render/sceneCapacityBenchmarkQualification.ts:ordinary-ci:invented-check"],
    });

    const broadRoot = structuredClone(HISTORICAL_EVIDENCE_MANIFEST);
    Object.defineProperty(broadRoot.legacyEvidenceRoots, "0", { value: "docs/architecture/" });
    expect(validateEvidenceOwnershipDeclarations(broadRoot).errors)
      .toContain("legacy-evidence-roots-incomplete-or-too-broad");
    expect(validateEvidenceOwnershipDeclarations(HISTORICAL_EVIDENCE_MANIFEST).valid).toBe(true);
  });

  it("keeps legacy detection roots explicit and covering every nested baseline archive", () => {
    const roots = HISTORICAL_EVIDENCE_MANIFEST.legacyEvidenceRoots;
    expect(roots).not.toContain("docs/architecture/");
    for (const { path } of HISTORICAL_QUALIFICATION_BASELINE.entries.filter(({ disposition }) =>
      disposition === "legacy-archival-unverified")) {
      const parent = path.slice(0, path.lastIndexOf("/") + 1);
      if (parent.startsWith("docs/architecture/") && parent !== "docs/architecture/") {
        expect(roots.some((root) => parent.startsWith(root)), path).toBe(true);
      }
    }
  });

  it("accepts only the audited checkout bytes and fails closed for changed or missing test/helpers", () => {
    // Main does not contain the experimental feature files. Exercise the real
    // router and SHA-256 against a temporary checkout with synthetic bytes and
    // matching fixture digests substituted in a copy of the router source.
    const audited = [
      "src/tests/unit/roomAtDawnCaptureSync.test.ts",
      "src/tests/unit/roomAtDawnReflectionCapture.test.ts",
      "src/tests/unit/roomAtDawnComparisonCapture.test.ts",
    ];
    const fixtures = [
      [audited[0], "test-sync", "ee7563ca79ca477988bcde5a7d515526b45506ba209bebe890150ae156a1b037"],
      ["experiments/room-at-dawn/capture-sync.cjs", "helper-sync", "d8ec1b767a648759cc0242c2b78ddb1a255befcd3ccf737cac8c464ccad10874"],
      [audited[1], "test-reflection", "b7993e6674135708663cc6f507c89d7104e31fb681ef0ca326f83dff95ee42ae"],
      ["experiments/room-at-dawn/reflection-capture.js", "helper-reflection", "75b358799453fd9b5b8cde386b03cbbbfbfaa74a819f1d0325d1fcb27d678ebf"],
      [audited[2], "test-comparison", "aca2d1ce20cd31c52dde8d5391371fc870af1574ec339d3ee25eb6c5c144d58c"],
      ["experiments/room-at-dawn/comparison-capture.ts", "helper-comparison", "9f5747c40f86cc016a4f4a1bb09413ef3f5b969ef89bc7bc8a0969e5bd12b597"],
    ];
    const temp = mkdtempSync(resolve(tmpdir(), "historical-capture-audit-"));
    try {
      mkdirSync(resolve(temp, "scripts"), { recursive: true });
      writeFileSync(resolve(temp, "scripts/historical-evidence-manifest.json"),
        readFileSync(resolve(process.cwd(), "scripts/historical-evidence-manifest.json")));
      let routing = readFileSync(resolve(process.cwd(), "scripts/historical-evidence-routing.mjs"), "utf8");
      for (const [path, contents, digest] of fixtures) {
        expect(routing).toContain(digest);
        routing = routing.replace(digest, createHash("sha256").update(contents).digest("hex"));
        const target = resolve(temp, path);
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(target, contents);
      }
      writeFileSync(resolve(temp, "routing.mjs"), routing);
      const route = (paths: string[]) => JSON.parse(execFileSync(process.execPath, [
        "--input-type=module", "-e",
        `import { classifyChangedPaths } from './routing.mjs'; console.log(JSON.stringify(classifyChangedPaths(${JSON.stringify(paths)})));`,
      ], { cwd: temp, encoding: "utf8" }));

      for (const path of audited) expect(route([path])).toMatchObject({ decision: "NOT_APPLICABLE", families: [], broad: false });
      expect(route(audited)).toMatchObject({ decision: "NOT_APPLICABLE", families: [], broad: false });
      for (const helper of ["experiments/room-at-dawn/capture-sync.cjs", "experiments/room-at-dawn/reflection-capture.js", "experiments/room-at-dawn/comparison-capture.ts"]) {
        expect(route([helper])).toMatchObject({ decision: "NOT_APPLICABLE", families: [], broad: false });
      }
      for (const unknown of ["src/tests/unit/roomAtDawnCaptureSyncExtra.test.ts", "src/tests/unit/roomAtDawnReflectionCapture.test.ts.backup", "src/tests/unit/roomAtDawnComparisonCaptureExtra.test.ts", "src/tests/unit/roomatdawncapturesync.test.ts", "src/tests/unit/newCaptureEvidence.test.ts"]) {
        for (const owner of audited) {
          expect(route([owner, unknown])).toMatchObject({ decision: "UNVERIFIED", families: allFamilies, broad: true });
        }
      }
      for (const [path, contents] of fixtures) {
        const target = resolve(temp, path);
        const pairIndex = Math.floor(fixtures.findIndex(([fixturePath]) => fixturePath === path) / 2);
        const owner = audited[pairIndex];
        const helper = fixtures[pairIndex * 2 + 1][0];
        writeFileSync(target, `${contents}-modified`);
        for (const trigger of [owner, helper]) {
          expect(route([trigger])).toMatchObject({ decision: "UNVERIFIED", families: allFamilies, broad: true });
        }
        rmSync(target);
        for (const trigger of [owner, helper]) {
          expect(route([trigger])).toMatchObject({ decision: "UNVERIFIED", families: allFamilies, broad: true });
        }
        // A directory at the audited file path exercises a real read error
        // without relying on chmod behavior or the test user's privileges.
        mkdirSync(target);
        for (const trigger of [owner, helper]) {
          expect(route([trigger])).toMatchObject({ decision: "UNVERIFIED", families: allFamilies, broad: true });
        }
        rmSync(target, { recursive: true });
        writeFileSync(target, contents);
      }
      const historical = "docs/architecture/ground-glass-m7e-r187-gather-b1/captures/architecture-rise.json";
      expect(route([...audited, historical])).toMatchObject({ decision: "QUALIFIED", families: classifyChangedPaths([historical]).families, broad: false });
      expect(route([audited[2], historical])).toMatchObject({ decision: "QUALIFIED", families: classifyChangedPaths([historical]).families, broad: false });
    } finally { rmSync(temp, { recursive: true, force: true }); }
  });

  it("treats a verified empty event diff as non-applicable while unavailable paths fail closed", () => {
    expect(classifyCompleteChangedPaths([])).toMatchObject({
      decision: "NOT_APPLICABLE",
      families: [],
      reasons: ["complete-changed-file-set-is-empty"],
    });
    expect(classifyChangedPaths([]).decision).toBe("UNVERIFIED");
  });

  it("routes the native qualification prerequisite policy test through all supported historical families", () => {
    const result = classifyChangedPaths(["src/tests/unit/nativeWebGpuQualificationPrerequisite.test.ts"]);
    expect(result.decision).toBe("QUALIFIED");
    expect(result.families).toEqual(["M7E", "M7F", "M7G", "M7H", "M7I", "M7J", "M7K", "M7L", "M7M", "M7N", "M7O", "M7P", "M7Q", "M7W"]);
    expect(result.reasons).toContain("shared-qualification-path:src/tests/unit/nativeWebGpuQualificationPrerequisite.test.ts");
  });

  it("routes an M7E capture change through its standalone replay and M7G consumer", () => {
    expect(classifyChangedPaths([
      "docs/architecture/ground-glass-m7e-r187-gather-b1/captures/architecture-rise.json",
    ])).toMatchObject({
      decision: "QUALIFIED",
      families: ["M7E", "M7G", "M7H", "M7I", "M7J", "M7K", "M7L", "M7M", "M7Q"],
    });
  });

  it("routes both M7E architecture documents through the registered replay owner", () => {
    expect(classifyChangedPaths([
      "docs/architecture/GROUND_GLASS_M7E_R187_GATHER_B1.md",
      "docs/architecture/GROUND_GLASS_M7E_R187_GATHER_B1_AUDIT.md",
    ])).toMatchObject({
      decision: "QUALIFIED",
      families: ["M7E", "M7G", "M7H", "M7I", "M7J", "M7K", "M7L", "M7M", "M7Q"],
      broad: false,
    });
  });

  it("routes scene-capacity qualification source and test changes to their ordinary unit-test owner", () => {
    expect(classifyChangedPaths([
      "src/render/sceneCapacityBenchmarkQualification.ts",
      "src/tests/unit/sceneCapacityBenchmarkQualification.test.ts",
    ])).toMatchObject({
      decision: "NOT_APPLICABLE",
      families: [],
      broad: false,
      currentOwners: ["ordinary-ci:unit-tests"],
      pathOwnership: [
        expect.objectContaining({ classification: "ordinary-ci", ordinaryCiOwners: ["ordinary-ci:unit-tests"] }),
        expect.objectContaining({ classification: "ordinary-ci", ordinaryCiOwners: ["ordinary-ci:unit-tests"] }),
      ],
    });
  });

  it("routes multiple report families and closes shared report dependencies", () => {
    expect(classifyChangedPaths([
      "docs/architecture/GROUND_GLASS_M7H_BROAD_E2E_TRIAGE_REPORT.json",
      "docs/architecture/ground-glass-m7q-light-peer-trace-ab/capture/final/normalized-captures.json",
    ])).toMatchObject({
      decision: "QUALIFIED",
      families: ["M7H", "M7I", "M7J", "M7K", "M7L", "M7M", "M7Q"],
      currentOwners: ["ordinary-ci:evidence:check:m7r"],
    });
  });

  it("routes shared runtime modules used by the M7E and M7F replay graphs", () => {
    for (const family of HISTORICAL_EVIDENCE_MANIFEST.families.filter(({ id }) => id === "M7E" || id === "M7F")) {
      for (const path of family.replaySourcePaths ?? []) {
        const result = classifyChangedPaths([path]);
        expect(result.decision, path).toBe("QUALIFIED");
        expect(result.families, path).toContain(family.id);
      }
    }

    for (const [familyId, replayEntry] of [
      ["M7E", "scripts/replayM7eEvidence.ts"],
      ["M7F", "scripts/replayM7fPresentationEvidence.ts"],
    ] as const) {
      const family = HISTORICAL_EVIDENCE_MANIFEST.families.find(({ id }) => id === familyId);
      expect(family?.replaySourcePaths?.slice().sort()).toEqual(runtimeLocalImportClosure(replayEntry));
    }

    for (const path of [
      "src/render/webgpu/groundGlassPresentationReference.ts",
      "src/render/groundGlassM6bSpatialConformance.ts",
      "src/render/groundGlassInspectionWindow.ts",
    ]) {
      const result = classifyChangedPaths([path]);
      expect(result.families, path).toContain("M7F");
      expect(result.families, path).toContain("M7G");
    }
  });

  it("routes changed M7G, M7H, M7I, and M7J inputs to every retained report consumer", () => {
    const m7g = classifyChangedPaths([
      "docs/architecture/ground-glass-m7g-r187/validation/broad-e2e-playwright.json",
    ]);
    expect(m7g.families).toEqual([
      "M7G", "M7H", "M7I", "M7J", "M7K", "M7L", "M7M", "M7Q",
    ]);
    expect(m7g.currentOwners).toContain("ordinary-ci:evidence:check:m7r");

    for (const [path, expectedInitial] of [
      ["docs/architecture/GROUND_GLASS_M7H_BROAD_E2E_TRIAGE_REPORT.json", "M7H"],
      ["docs/architecture/GROUND_GLASS_M7I_BROAD_E2E_REMEDIATION_REPORT.json", "M7I"],
      ["docs/architecture/GROUND_GLASS_M7J_FOUR_WORKER_STABILITY_REPORT.json", "M7J"],
    ] as const) {
      const result = classifyChangedPaths([path]);
      expect(result.families).toContain(expectedInitial);
      expect(result.families).toContain("M7K");
      expect(result.families).toContain("M7L");
      expect(result.families).toContain("M7M");
    }

    expect(classifyChangedPaths([
      "docs/architecture/GROUND_GLASS_M7O_CANVAS_ASSERTION_TIMING_REPORT.json",
    ]).families).toEqual(["M7O", "M7Q"]);
    expect(classifyChangedPaths([
      "docs/architecture/GROUND_GLASS_M7P_ASSERTION_SCHEDULING_REPORT.json",
    ]).families).toEqual(["M7P", "M7Q"]);
  });

  it("routes changes to shared verification code, declarations, tests, schema, and workflows broadly", () => {
    for (const path of [
      "package-lock.json",
      ".github/workflows/historical-qualification.yml",
      "scripts/historical-evidence-manifest.json",
      "scripts/fixtures/historical-qualification-production-incident.json",
      "scripts/historical-qualification-baseline.json",
      "scripts/historical-qualification-baseline.d.mts",
      "scripts/historical-qualification-baseline.mjs",
      "scripts/historical-production-release.d.mts",
      "scripts/historical-production-release.mjs",
      "scripts/run-historical-qualification-incident-regression.mjs",
      "scripts/historical-evidence-routing.d.mts",
      "scripts/historical-qualification-ci-gate.d.mts",
      "src/tests/unit/historicalEvidenceRouting.test.ts",
      "src/tests/unit/historicalQualificationGate.test.ts",
      "src/tests/unit/historicalProductionRelease.test.ts",
      "src/tests/unit/historicalQualificationBaseline.test.ts",
      "src/tests/unit/m7kCaptureWorkflow.test.ts",
    ]) {
      expect(classifyChangedPaths([path])).toMatchObject({ decision: "QUALIFIED", families: allFamilies, broad: true });
    }
  });

  it("routes report deletion and both sides of a rename", () => {
    const deleted = classifyChangedPaths(["docs/architecture/GROUND_GLASS_M7P_ASSERTION_SCHEDULING_REPORT.json"]);
    const renamed = classifyChangedPaths([
      "docs/architecture/GROUND_GLASS_M7P_ASSERTION_SCHEDULING_REPORT.json",
      "docs/archive/retired-m7p-report.json",
    ]);
    expect(deleted.families).toContain("M7P");
    expect(renamed.families).toContain("M7P");
  });

  it("keeps M7V current-policy ownership in ordinary CI and routes its inputs to M7W", () => {
    expect(classifyChangedPaths([
      "docs/architecture/GROUND_GLASS_M7V_E2E_SKIP_GOVERNANCE_REPORT.json",
    ])).toMatchObject({
      decision: "QUALIFIED",
      families: ["M7W"],
      currentOwners: ["ordinary-ci:evidence:check:m7v"],
      pathOwnership: [expect.objectContaining({
        classification: "historical-validator",
        historicalValidators: ["M7W"],
        ordinaryCiOwners: ["ordinary-ci:evidence:check:m7v"],
      })],
    });
  });

  it("retains M7R's immutable workflow contract in ordinary CI without running it twice", () => {
    expect(classifyChangedPaths([
      "docs/architecture/GROUND_GLASS_M7R_BROAD_E2E_QUALIFICATION_RECOVERY_REPORT.json",
    ])).toMatchObject({
      decision: "NOT_APPLICABLE",
      families: [],
      currentOwners: ["ordinary-ci:evidence:check:m7r"],
      pathOwnership: [expect.objectContaining({
        classification: "ordinary-ci",
        ordinaryCiOwners: ["ordinary-ci:evidence:check:m7r"],
      })],
    });
  });

  it("includes ordinary-CI-owned families in an explicit full archive replay", () => {
    const full = classifyChangedPaths([], { forceFull: true, includeUnsupported: true });
    expect(full.families).toContain("M7R");
    expect(full.decision).toBe("UNVERIFIED");
    expect(full.unsupported.map(({ id }) => id)).toEqual(["M7S", "M7T", "M7U"]);
  });

  it("does not invent verifiers for unsupported or unknown evidence inputs", () => {
    const unsupported = classifyChangedPaths(["docs/architecture/GROUND_GLASS_M7U_CAPTURE_REPORT.json"]);
    const unknown = classifyChangedPaths(["docs/architecture/new-capture-evidence-index.json"]);
    expect(unsupported.decision).toBe("UNVERIFIED");
    expect(unsupported.unsupported).toContainEqual(expect.objectContaining({ id: "M7U" }));
    expect(unsupported.families).toEqual(allFamilies);
    expect(unknown.decision).toBe("UNVERIFIED");
    expect(unknown.families).toEqual(allFamilies);
  });

  it("keeps fail-closed outcomes distinct from a successful or non-applicable route", () => {
    expect(determineQualificationDecision({ routeDecision: "NOT_APPLICABLE", hasFamilies: false })).toBe("NOT_APPLICABLE");
    expect(determineQualificationDecision({ routeDecision: "QUALIFIED", hasFamilies: true })).toBe("QUALIFIED");
    expect(determineQualificationDecision({ routeDecision: "QUALIFIED_WITH_LEGACY_ARCHIVAL", hasFamilies: true })).toBe("QUALIFIED_WITH_LEGACY_ARCHIVAL");
    expect(determineQualificationDecision({ routeDecision: "QUALIFIED_WITH_LEGACY_ARCHIVAL", hasFamilies: true, validatorFailure: true })).toBe("FAILED");
    expect(determineQualificationDecision({ routeDecision: "QUALIFIED_WITH_LEGACY_ARCHIVAL", hasFamilies: true, sourceFailure: true })).toBe("UNVERIFIED");
    expect(determineQualificationDecision({ routeDecision: "QUALIFIED", hasFamilies: true, validatorFailure: true })).toBe("FAILED");
    expect(determineQualificationDecision({ routeDecision: "QUALIFIED", hasFamilies: true, sourceFailure: true, validatorFailure: true })).toBe("UNVERIFIED");
    expect(determineQualificationDecision({ routeDecision: "QUALIFIED", hasFamilies: true, sourceFailure: true })).toBe("UNVERIFIED");
    expect(determineQualificationDecision({ routeDecision: "QUALIFIED", hasFamilies: true, missingArtifacts: true })).toBe("UNVERIFIED");
    expect(determineQualificationDecision({ routeDecision: "UNVERIFIED", hasFamilies: true })).toBe("UNVERIFIED");
    expect(failedClosedRoute("api-unavailable")).toMatchObject({ decision: "UNVERIFIED", families: allFamilies, broad: true });
  });
});

describe("historical evidence event discovery", () => {
  const repository = "chau-hm/view-camera-simulator";
  const eventForPull = () => ({
    repository: { full_name: repository },
    pull_request: {
      number: 42,
      head: { sha: sha("a"), ref: "feature/evidence", repo: { full_name: "fork/evidence" } },
      base: { sha: sha("b"), ref: "main", repo: { full_name: repository } },
    },
  });

  it("reads every PR file page and includes the source side of a rename", async () => {
    const calls: string[] = [];
    const apiRequest = async (path: string) => {
      calls.push(path);
      if (path.endsWith("/pulls/42")) {
        return { number: 42, state: "open", changed_files: 101, head: { sha: sha("a") }, base: { sha: sha("b"), ref: "main", repo: { full_name: repository } } };
      }
      if (path.endsWith("page=1")) return Array.from({ length: 100 }, (_, index) => ({ filename: `src/tests/e2e/m7e-case-${index}.spec.ts`, status: "modified" }));
      if (path.endsWith("page=2")) return [{ filename: "docs/architecture/new-m7f-report.json", previous_filename: "docs/architecture/old-m7f-report.json", status: "renamed" }];
      return [];
    };
    const result = await discoverPullRequestPaths(eventForPull(), { repository, apiRequest });
    expect(calls).toHaveLength(4);
    expect(result.paths).toContain("docs/architecture/old-m7f-report.json");
    expect(result.paths).toContain("docs/architecture/new-m7f-report.json");
    expect(result.paths).toHaveLength(102);
  });

  it("rejects a stale PR head or base revision", async () => {
    const apiRequest = async (path: string) => path.endsWith("/pulls/42")
      ? { number: 42, state: "open", changed_files: 1, head: { sha: sha("c") }, base: { sha: sha("b"), ref: "main", repo: { full_name: repository } } }
      : [];
    await expect(discoverPullRequestPaths(eventForPull(), { repository, apiRequest })).rejects.toThrow("stale");
  });

  it("rejects a PR revision that changes while file pagination is in progress", async () => {
    let pullReads = 0;
    const apiRequest = async (path: string) => {
      if (path.endsWith("/pulls/42")) {
        pullReads += 1;
        return { number: 42, state: "open", changed_files: 1, head: { sha: pullReads === 1 ? sha("a") : sha("c") }, base: { sha: sha("b"), ref: "main", repo: { full_name: repository } } };
      }
      return [{ filename: "docs/architecture/GROUND_GLASS_M7E_REPORT.json", status: "modified" }];
    };
    await expect(discoverPullRequestPaths(eventForPull(), { repository, apiRequest })).rejects.toThrow("changed-during-file-pagination");
  });

  it("rejects failed and incomplete PR file pagination instead of treating it as N/A", async () => {
    const staleCountApi = async (path: string) => path.endsWith("/pulls/42")
      ? { number: 42, state: "open", changed_files: 101, head: { sha: sha("a") }, base: { sha: sha("b"), ref: "main", repo: { full_name: repository } } }
      : path.endsWith("page=1")
        ? Array.from({ length: 100 }, (_, index) => ({ filename: `src/evidence-${index}.json`, status: "modified" }))
        : [];
    await expect(discoverPullRequestPaths(eventForPull(), { repository, apiRequest: staleCountApi })).rejects.toThrow("pagination-incomplete");
    await expect(discoverPullRequestPaths(eventForPull(), { repository, apiRequest: async () => { throw new Error("rate limited"); } })).rejects.toThrow("rate limited");
  });

  it("parses additions, deletions, modifications, and rename pairs from the push diff", () => {
    expect(parseNameStatusZ("A\0added.json\0D\0deleted.json\0M\0changed.json\0R100\0old.json\0new.json\0"))
      .toEqual(["added.json", "deleted.json", "changed.json", "old.json", "new.json"]);
  });

  it("discovers an exact push range and the main merge-base for a newly created branch", async () => {
    const before = sha("b");
    const after = sha("a");
    const runGit = async (args: string[]) => {
      if (args[0] === "rev-parse") return `${after}\n`;
      if (args[0] === "cat-file") return { status: 0, stdout: "", stderr: "" };
      if (args[0] === "diff") return "M\0docs/architecture/GROUND_GLASS_M7E_REPORT.json\0";
      if (args[0] === "merge-base") return `${before}\n`;
      if (args[0] === "fetch") return "";
      throw new Error(`unexpected git command ${args[0]}`);
    };
    const push = await discoverPushPaths({ before, after }, { runGit });
    expect(push.paths).toEqual(["docs/architecture/GROUND_GLASS_M7E_REPORT.json"]);
    const newBranch = await discoverPushPaths({ before: "0".repeat(40), after }, { runGit });
    expect(newBranch.comparisonBaseSha).toBe(before);
    expect(newBranch.paths).toEqual(push.paths);
  });

  it("returns a routing failure when a push predecessor is absent", async () => {
    let beforeChecks = 0;
    const runGit = async (args: string[], _cwd: string, allowFailure = false) => {
      if (args[0] === "rev-parse") return `${sha("a")}\n`;
      if (args[0] === "cat-file") {
        if (args[2].startsWith(sha("b"))) {
          beforeChecks += 1;
          return { status: beforeChecks === 1 ? 1 : 1, stdout: "", stderr: "missing" };
        }
        return { status: 0, stdout: "", stderr: "" };
      }
      if (args[0] === "fetch") return "";
      if (allowFailure) return { status: 1, stdout: "", stderr: "missing" };
      throw new Error(`unexpected git command ${args[0]}`);
    };
    await expect(discoverPushPaths({ before: sha("b"), after: sha("a") }, { runGit })).rejects.toThrow("before-commit-unavailable");
  });
});
