import { spawn, spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { classifyChangedPaths, determineQualificationDecision } from "../../../scripts/historical-evidence-routing.mjs";

const root = process.cwd();
const dispatcher = resolve(root, "scripts/evidence.mjs");
const copies: string[] = [];
const invoke = (...args: string[]) => spawnSync(process.execPath, [dispatcher, ...args], { cwd: root, encoding: "utf8" });
afterEach(() => copies.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true })));

describe("evidence command interface", () => {
  it("keeps explicit script targets and mode arguments for every operation", async () => {
    // Registry is a small JavaScript command table.
    // @ts-expect-error No declaration is needed by the runtime entrypoint.
    const { evidenceCommands } = await import("../../../scripts/evidence-commands.mjs");
    const expected: Record<string, string> = {
      "replay m7e": "run-m7e-offline-replay.mjs", "replay m7f": "run-m7f-presentation-evidence-replay.mjs", "replay m7g": "run-m7g-consolidation.mjs", "report m7g": "run-m7g-consolidation.mjs --diagnostic", "triage m7h": "run-m7h-triage.mjs --inventory", "compare m7h": "run-m7h-triage.mjs", "check m7h": "run-m7h-triage.mjs --diagnostic", "check m7i": "run-m7i-remediation.mjs --diagnostic", "check m7j": "run-m7j-four-worker-stability.mjs", "run m7k": "run-m7k-broad-e2e.mjs", "check m7k": "run-m7k-qualification.mjs", "require-qualified m7k": "run-m7k-qualification.mjs --require-qualified", "check m7l": "run-m7l-learning-drawer-remediation.mjs", "check m7m": "run-m7m-scene-readiness.mjs", "check m7n": "run-m7n-renderer-lifecycle.mjs", "capture m7o": "run-m7o-canvas-assertion-timing.mjs", "normalize m7o": "normalizeM7oCanvasAssertionTimingCapture.mjs", "normalize m7o-matrix": "normalizeM7oCanvasAssertionTimingMatrix.mjs", "check m7o": "run-m7o-evidence.mjs", "capture m7p": "run-m7p-assertion-scheduling.mjs", "normalize m7p": "normalizeM7pAssertionSchedulingCapture.mjs", "check m7p": "run-m7p-evidence.mjs", "capture m7q": "run-m7q-light-peer-trace-ab.mjs", "normalize m7q": "normalizeM7qLightPeerTraceAb.mjs", "check m7q": "run-m7q-evidence.mjs", "normalize m7r": "normalizeM7rBroadE2eCapture.mjs", "check m7r": "run-m7r-evidence.mjs", "check m7v": "run-m7v-qualification.mjs validate-policy", "require-approved m7v": "run-m7v-qualification.mjs require-approved", "require-qualified m7v": "run-m7v-qualification.mjs require-qualified", "normalize m7w": "normalizeM7wQualificationCapture.mjs", "check m7w": "run-m7w-evidence.mjs", qualify: "run-historical-qualification.mjs", "migrate m7e": "--experimental-strip-types migrateM7ePersistedCaptures.mjs",
    };
    const actual = Object.fromEntries(Object.entries(evidenceCommands).map(([key, args]) => [key, (args as string[]).map((arg) => arg.replace("./scripts/", "")).join(" ")]));
    expect(actual).toEqual(expected);
  });

  it("rejects unknown operations, paths, and unsupported combinations; help is inert", () => {
    for (const args of [["bogus", "m7p"], ["check", "bogus"], ["capture", "m7v"], ["check", "../../package.json"]]) expect(invoke(...args).status).not.toBe(0);
    expect(invoke("help").status).toBe(0);
    expect(invoke("list").stdout).toContain("normalize m7o-matrix");
  });

  it("runs the copied worktree target with fixed and forwarded arguments, propagating its result", () => {
    const temp = mkdtempSync(join(tmpdir(), "evidence test ")); copies.push(temp);
    mkdirSync(join(temp, "scripts"));
    for (const file of ["evidence.mjs", "evidence-commands.mjs"]) cpSync(join(root, "scripts", file), join(temp, "scripts", file));
    const sentinel = join(temp, "should-not-run");
    writeFileSync(join(temp, "scripts/run-m7h-triage.mjs"), `require("node:fs").writeFileSync(${JSON.stringify(sentinel)}, "ran");`);
    for (const mode of ["help", "list"]) expect(spawnSync(process.execPath, [join(temp, "scripts/evidence.mjs"), mode]).status).toBe(0);
    expect(() => readFileSync(sentinel)).toThrow();
    const target = join(temp, "scripts/run-m7h-triage.mjs");
    writeFileSync(target, 'console.log(JSON.stringify({cwd:process.cwd(),args:process.argv.slice(2)})); process.exit(Number(process.env.TEST_EXIT || 0));');
    const run = (exit: string) => spawnSync(process.execPath, [join(temp, "scripts/evidence.mjs"), "check", "m7h", "a path with spaces", "--last"], { cwd: root, env: { ...process.env, TEST_EXIT: exit }, encoding: "utf8" });
    expect(JSON.parse(run("0").stdout)).toEqual({ cwd: realpathSync(temp), args: ["--diagnostic", "a path with spaces", "--last"] });
    expect(run("7").status).toBe(7);
    rmSync(target);
    expect(run("0").status).not.toBe(0);
    const route = classifyChangedPaths(["scripts/evidence.mjs"]);
    expect(route.decision).not.toBe("NOT_APPLICABLE");
    expect(determineQualificationDecision({ routeDecision: route.decision, hasFamilies: route.families.length > 0, validatorFailure: true })).toBe("FAILED");
  });

  it("fails when spawning the selected executable errors", () => {
    const temp = mkdtempSync(join(tmpdir(), "evidence-spawn-")); copies.push(temp);
    const preload = join(temp, "spawn-error.cjs");
    writeFileSync(preload, `const child = require("node:child_process"); const {EventEmitter} = require("node:events"); child.spawn = () => { const proc = new EventEmitter(); proc.kill = () => false; process.nextTick(() => proc.emit("error", new Error("injected spawn error"))); return proc; }; require("node:module").syncBuiltinESMExports();`);
    const result = spawnSync(process.execPath, ["--require", preload, dispatcher, "check", "m7p"], { cwd: root, encoding: "utf8" });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("injected spawn error");
  });

  it("fails when a child is interrupted", async () => {
    const temp = mkdtempSync(join(tmpdir(), "evidence-signal-")); copies.push(temp);
    mkdirSync(join(temp, "scripts"));
    for (const file of ["evidence.mjs", "evidence-commands.mjs"]) cpSync(join(root, "scripts", file), join(temp, "scripts", file));
    writeFileSync(join(temp, "scripts/run-m7h-triage.mjs"), 'process.kill(process.pid, "SIGTERM");');
    const child = spawn(process.execPath, [join(temp, "scripts/evidence.mjs"), "check", "m7h"]);
    const code = await new Promise<number | null>((done) => child.on("exit", done));
    expect(code).not.toBe(0);
  });

  it("routes either dispatcher file broadly and unknown evidence conservatively", () => {
    for (const file of ["scripts/evidence.mjs", "scripts/evidence-commands.mjs"]) {
      expect(classifyChangedPaths([file])).toMatchObject({ broad: true });
      expect(classifyChangedPaths([file]).families.length).toBeGreaterThan(1);
    }
    expect(classifyChangedPaths(["docs/architecture/unknown-evidence-index.json"]).decision).toBe("UNVERIFIED");
    expect(readFileSync(resolve(root, "scripts/historical-evidence-manifest.json"), "utf8")).toContain('"scripts/evidence-commands.mjs"');
    expect(dirname(dispatcher)).toBe(resolve(root, "scripts"));
  });
});
