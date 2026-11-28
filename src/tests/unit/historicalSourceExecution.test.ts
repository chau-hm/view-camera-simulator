import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
// @ts-expect-error JavaScript helper without declarations
import { expectedSourcePins } from "../../../scripts/historical-source-pins.mjs";
import { HISTORICAL_EVIDENCE_MANIFEST } from "../../../scripts/historical-evidence-routing.mjs";
// @ts-expect-error JavaScript helper without declarations
import { compatibleHistoricalManifest, compatibleSourceRouter, executeSourceValidators } from "../../../scripts/historical-source-execution.mjs";

const sourceSha = "a".repeat(40), sourceTreeSha = "b".repeat(40);
const families = HISTORICAL_EVIDENCE_MANIFEST.families.filter(({ alwaysInOrdinaryCi }) => !alwaysInOrdinaryCi);
const pinInventory = () => expectedSourcePins(sourceSha, families.map(({ id }) => id), process.cwd(), (path: string) => readFileSync(path));
const validators = families.flatMap((family) => family.commands.map((command) => ({ family: family.id, name: command.name, exitCode: 0 })));
validators.push({ family: "M7F", name: "standalone versus M7G child replay equivalence", exitCode: 0 });

describe("exact-source historical validation evidence", () => {
  it("accepts only the reviewed router versions for module-relative loading", () => {
    const current = "3a6800c5f91df9b7f65499b6ab428bdc83a6a3eb";
    expect(compatibleSourceRouter("3154067aa1e0de98b14b31ff7ccb513d607f5793", current)).toBe(true);
    expect(compatibleSourceRouter("f1e895f1db08b29a427c7500b24e4737b9800066", current)).toBe(true);
    expect(compatibleSourceRouter("0".repeat(40), current)).toBe(false);
    expect(compatibleSourceRouter("f1e895f1db08b29a427c7500b24e4737b9800066", "0".repeat(40))).toBe(false);
  });
  it("allows only the reviewed source-registration additions across manifest versions", () => {
    const trusted = JSON.parse(readFileSync("scripts/historical-evidence-manifest.json", "utf8")) as { sharedQualificationPaths: string[]; families: { commands: { name: string }[] }[] };
    const older = structuredClone(trusted);
    older.sharedQualificationPaths = older.sharedQualificationPaths.filter((path) => path !== "scripts/historical-source-execution.mjs" && path !== "scripts/release-artifact-qualify.mjs" && path !== "src/tests/unit/historicalSourceExecution.test.ts" && path !== "src/tests/unit/releaseArtifactQualification.test.ts");
    expect(compatibleHistoricalManifest(older, trusted)).toBe(true);
    const unreviewed = structuredClone(trusted);
    unreviewed.sharedQualificationPaths.push("scripts/unreviewed.mjs");
    expect(compatibleHistoricalManifest(older, unreviewed)).toBe(false);
    const changed = structuredClone(trusted);
    changed.families[0]!.commands[0]!.name = "changed validator";
    expect(compatibleHistoricalManifest(older, changed)).toBe(false);
  });
  it.each(["success", "wrong-tree", "wrong-head", "incompatible", "validator-failure", "fetch-failure", "missing-artifact", "mutated-checkout", "install-failure", "runner-failure"]) ("handles %s and cleans its own staging", (mode) => {
    const root = mkdtempSync(join(tmpdir(), "vcs-source-validation-test-"));
    const calls: string[][] = [];
    let checkoutChecks = 0;
    const run = (command: string, args: string[], options: { env: Record<string, string> }) => {
      calls.push([command, ...args]);
      let stdout = "";
      if (command === "git") {
        if (args[0] === "worktree" && args[1] === "add") mkdirSync(args[3]!, { recursive: true });
        else if (args[0] === "worktree" && args[1] === "remove") rmSync(args[3]!, { recursive: true, force: true });
        else if (args[0] === "status") stdout = mode === "mutated-checkout" && checkoutChecks > 1 ? " M source.ts" : "";
        else if (args[0] === "rev-parse") {
          if (args[1] === "HEAD") { checkoutChecks++; stdout = mode === "wrong-head" ? "c".repeat(40) : sourceSha; }
          else if (args[1] === "HEAD^{tree}" || args[1] === `${sourceSha}^{tree}`) stdout = mode === "wrong-tree" ? "c".repeat(40) : sourceTreeSha;
          else stdout = mode === "incompatible" && args[1]!.startsWith("HEAD:") ? "c".repeat(40) : "d".repeat(40);
        }
      } else if (command === process.execPath) {
        const report = { checkedOutSha: sourceSha, decision: "QUALIFIED", families: families.map(({ id }) => id), validators: validators.map((v, i) => ({ ...v, exitCode: mode === "validator-failure" && i === 0 ? 1 : 0 })), sourceFetches: pinInventory().map((pin: object, i: number) => ({ ...pin, exitCode: mode === "fetch-failure" && i === 0 ? 1 : 0 })), missingArtifacts: mode === "missing-artifact" ? ["missing"] : [], unsupported: [] };
        writeFileSync(options.env.HISTORICAL_QUALIFICATION_RESULT_PATH!, JSON.stringify(report));
      }
      return { status: ((command === "npm" && mode === "install-failure") || (command === process.execPath && mode === "runner-failure")) ? 1 : 0, stdout, stderr: "", signal: null };
    };
    try {
      if (mode === "success") {
        expect(executeSourceValidators({ sourceSha, sourceTreeSha }, { repositoryRoot: root, tempRoot: root, run, pinInventory })).toMatchObject({ evidenceOnly: true, sourceSha, sourceTreeSha });
      } else expect(() => executeSourceValidators({ sourceSha, sourceTreeSha }, { repositoryRoot: root, tempRoot: root, run, pinInventory })).toThrow();
      expect(readdirSync(root)).toEqual([]);
      expect(calls.filter(([command]) => command === "npm").every(([, action]) => action === "ci")).toBe(true);
      expect(calls.some((call) => call.includes("push") || call.includes("deploy-pages") || call.includes("build"))).toBe(false);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
});
