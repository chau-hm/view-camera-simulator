import { createHash } from "node:crypto";
import { cpSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { evaluateM7rBroadE2eRecovery } from "../../../scripts/evaluateM7rBroadE2eRecovery";

type Row = ReturnType<typeof JSON.parse>;
const read = (path: string): Row => JSON.parse(readFileSync(path, "utf8"));
const write = (path: string, value: Row) => {
  const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
  writeFileSync(path, bytes);
  return { sha256: createHash("sha256").update(bytes).digest("hex"), sizeBytes: bytes.length };
};

it("derives M7R failure groups from a changed raw failed assertion", () => {
  const root = process.cwd();
  const fixture = mkdtempSync(join(tmpdir(), "m7r-raw-classification-"));
  const source = "docs/architecture/ground-glass-m7r-e2e-recovery";
  const reportPath = "docs/architecture/GROUND_GLASS_M7R_BROAD_E2E_QUALIFICATION_RECOVERY_REPORT.json";
  const linkEntries = (from: string, to: string, excluded: string[]) => {
    mkdirSync(to, { recursive: true });
    for (const name of readdirSync(from)) {
      if (excluded.includes(name)) continue;
      const path = join(from, name);
      symlinkSync(path, join(to, name), statSync(path).isDirectory() ? "dir" : "file");
    }
  };
  try {
    linkEntries(root, fixture, ["docs", ".worktrees"]);
    linkEntries(join(root, "docs"), join(fixture, "docs"), ["architecture"]);
    linkEntries(join(root, "docs/architecture"), join(fixture, "docs/architecture"), ["ground-glass-m7r-e2e-recovery"]);
    cpSync(join(root, source), join(fixture, source), { recursive: true });
    const report = read(join(root, reportPath));
    const baseline = evaluateM7rBroadE2eRecovery(report, fixture);
    expect(baseline.passed, baseline.issues.join(", ")).toBe(true);
    const rawPath = join(fixture, report.artifacts.rawReports.ordinary.path);
    const raw = read(rawPath);
    const title = "Architecture + Foreground DOF task starts solved through PR7C and completes with Aperture only";
    const identity = `architecture-foreground-dof.spec.ts::${title}`;
    let error: Row | undefined;
    const visit = (suites: Row[]) => {
      for (const suite of suites) {
        for (const spec of suite.specs ?? []) {
          if (spec.title === title) error = spec.tests[0].results.at(-1).errors[0];
        }
        visit(suite.suites ?? []);
      }
    };
    visit(raw.suites);
    expect(error).toBeDefined();
    expect(error!.message).toContain("toHaveCSS");
    const normalizedPath = join(fixture, report.artifacts.normalizedCapture.path);
    const normalized = read(normalizedPath);
    const groups: Row[] = normalized.lanes.ordinary.summary.failureGroups;
    expect(groups.find((group) => group.signature === "css-assertion")!.identities).toContain(identity);
    error!.message = error!.message.replace("toHaveCSS", "toHaveCount");
    const rawInfo = write(rawPath, raw);
    const manifestPath = join(fixture, report.artifacts.captureManifest.path);
    const manifest = read(manifestPath);
    const lane = manifest.lanes.ordinary;
    lane.rawReportSha256 = rawInfo.sha256;
    lane.rawReportBytes = rawInfo.sizeBytes;
    Object.assign(manifest.artifactManifest.find((entry: Row) => entry.path === "raw/ordinary-playwright.json"), rawInfo);
    const manifestInfo = write(manifestPath, manifest);
    report.artifacts.captureManifest.sha256 = manifestInfo.sha256;
    report.artifacts.rawReports.ordinary.sha256 = rawInfo.sha256;
    normalized.provenance.captureManifestSha256 = manifestInfo.sha256;
    Object.assign(normalized.provenance.rawArtifacts.find((entry: Row) => entry.path === report.artifacts.rawReports.ordinary.path), rawInfo);
    normalized.lanes.ordinary.rawSha256 = rawInfo.sha256;
    normalized.lanes.ordinary.rawBytes = rawInfo.sizeBytes;
    const checked = normalized.artifactIntegrity.artifacts.find((entry: Row) => entry.path === "raw/ordinary-playwright.json");
    Object.assign(checked, { sha256: rawInfo.sha256, expectedSha256: rawInfo.sha256, sizeBytes: rawInfo.sizeBytes, expectedSizeBytes: rawInfo.sizeBytes });
    report.artifacts.normalizedCapture.sha256 = write(normalizedPath, normalized).sha256;
    const stale = evaluateM7rBroadE2eRecovery(report, fixture);
    expect(stale.passed).toBe(false);
    expect(stale.issues).toContain("m7r-ordinary-normalized-outcomes-mismatch");
    expect(stale.issues).toContain("m7r-per-test-inventory-not-derived-from-raw");
    expect(stale.issues.filter((issue) => /digest|size-mismatch|manifest-link|metadata-mismatch/.test(issue))).toEqual([]);
    // Correct only the lane's failure groups. Its reconciliation becoming valid
    // proves the raw message now derives count-assertion, not just a mismatch.
    const css = groups.find((group) => group.signature === "css-assertion")!;
    const count = groups.find((group) => group.signature === "count-assertion")!;
    css.identities = css.identities.filter((id: string) => id !== identity);
    css.count--;
    count.identities.push(identity);
    count.count++;
    const order = new Map((normalized.testInventory as Row[]).map((entry, index) => [String(entry.canonicalIdentity).replace(/^chromium::/, ""), index]));
    count.identities.sort((a: string, b: string) => Number(order.get(a)) - Number(order.get(b)));
    groups.sort((a, b) => b.count - a.count || String(a.signature).localeCompare(String(b.signature), "en"));
    report.artifacts.normalizedCapture.sha256 = write(normalizedPath, normalized).sha256;
    const corrected = evaluateM7rBroadE2eRecovery(report, fixture);
    expect(corrected.issues).not.toContain("m7r-ordinary-normalized-outcomes-mismatch");
    expect(corrected.issues).toContain("m7r-per-test-inventory-not-derived-from-raw");
    expect(corrected.broadE2eQualification).toBe("not-qualified");
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});
