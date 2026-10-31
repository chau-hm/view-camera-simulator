import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  evaluateGroundGlassM7dPhysicalCocCapture,
  evaluateGroundGlassM7dPhysicalCocReport,
  GROUND_GLASS_M7D_PHYSICAL_COC_EVIDENCE_REVISION,
  GROUND_GLASS_M7D_REQUIRED_KERNEL_CASE_IDS,
  GROUND_GLASS_M7D_REQUIRED_SCENARIO_EVIDENCE_KINDS,
  GROUND_GLASS_M7D_REQUIRED_SCENARIO_IDS,
} from "../../render/webgpu/groundGlassM7dPhysicalCocEvidence";

type MutableRecord = Record<string, unknown>;
type Vector3 = { x: number; y: number; z: number };
type KernelOverride = {
  lens: { centerWorldM: Vector3; planeNormal: Vector3; planeBasisX: Vector3; planeBasisY: Vector3 };
  film: { planePointWorldM: Vector3; planeNormal: Vector3; planeBasisX: Vector3; planeBasisY: Vector3 };
  optics: { focalLengthMm: number; apertureFNumber: number };
};
type ControlledReference = {
  id: string;
  testCase: {
    id: string;
    probe: { id: string; controlledObjectPointMm: number[] };
    kernelOverride: KernelOverride;
  };
  cpuReference: {
    valid: boolean;
    signedCoCDiameterMm: number;
    majorRadiusMm: number;
    minorRadiusMm: number;
    orientationRad: number;
  };
};
type KernelOutput = {
  id: string;
  calculatedFootprintMm: number[];
  validityCode: number;
  storedHalfFloatBits: number[];
  readbackFootprintMm: number[];
  sampledFootprintMm: number[];
};
type CaptureArtifact = {
  sourceSha: string;
  controlledKernelReferences: ControlledReference[];
  probeReadback: { controlledKernelCases: KernelOutput[]; samples: Array<{ id: string; focalBranchCode: number }> };
};
type Scenario = { id: string; status: string; evidenceKind?: string; [key: string]: unknown };
type ReportArtifact = {
  scenarios: Scenario[];
  qualification?: string;
  scenarioCount?: number;
  counts: Record<string, unknown>;
};

const capturePath = resolve(
  process.cwd(),
  "docs/architecture/ground-glass-m7d-r187-physical-coc/captures/ground-glass-m4-physical-coc-native-evidence.json",
);
const reportPath = resolve(process.cwd(), "docs/architecture/GROUND_GLASS_M7D_R187_PHYSICAL_COC_REPORT.json");

const loadJson = <T>(path: string): T => JSON.parse(readFileSync(path, "utf8")) as T;
const loadCapture = (): CaptureArtifact => loadJson<CaptureArtifact>(capturePath);
const loadReport = (): ReportArtifact => loadJson<ReportArtifact>(reportPath);
const kernelReference = (capture: CaptureArtifact, id: string): ControlledReference =>
  capture.controlledKernelReferences.find((entry: MutableRecord) => entry.id === id)!;
const kernelOutput = (capture: CaptureArtifact, id: string): KernelOutput =>
  capture.probeReadback.controlledKernelCases.find((entry: MutableRecord) => entry.id === id)!;
const reportScenario = (report: ReportArtifact, id: string): Scenario =>
  report.scenarios.find((entry: MutableRecord) => entry.id === id)!;

const expectCaptureMutation = (
  label: string,
  mutate: (capture: CaptureArtifact) => void,
  expectedIssue: string,
) => it(`rejects ${label} for the relevant contract`, () => {
  const capture = loadCapture();
  mutate(capture);
  const result = evaluateGroundGlassM7dPhysicalCocCapture(capture);
  expect(result.status).toBe("failed");
  expect(result.issues.map((issue) => issue.code)).toContain(expectedIssue);
});

const expectReportMutation = (
  label: string,
  mutate: (report: ReportArtifact) => void,
  expectedIssue: string,
) => it(`rejects ${label} for the relevant contract`, () => {
  const report = loadReport();
  mutate(report);
  const result = evaluateGroundGlassM7dPhysicalCocReport(report);
  expect(result.status).toBe("failed");
  expect(result.issues.map((issue) => issue.code)).toContain(expectedIssue);
});

describe("M7D r187 Physical CoC evidence evaluator", () => {
  it("accepts the persisted native capture after recomputing every CPU oracle from its recorded vectors", () => {
    const result = evaluateGroundGlassM7dPhysicalCocCapture(loadCapture());
    expect(result.status, JSON.stringify(result.issues)).toBe("passed");
    expect(result).toMatchObject({
      evidenceRevision: GROUND_GLASS_M7D_PHYSICAL_COC_EVIDENCE_REVISION,
      requiredKernelCaseCount: 17,
      observedKernelCaseCount: 17,
      requiredSceneProbeCount: 5,
      observedSceneProbeCount: 5,
    });
    expect(result.maximumCpuReferenceErrorMm).toBe(0);
    expect(result.maximumCpuReferenceOrientationErrorRad).toBe(0);
    expect(result.issues).toEqual([]);
  });

  it("accepts the intentional invalid-geometry control only with validity 3 and zero stored output", () => {
    const capture = loadCapture();
    const reference = kernelReference(capture, "invalid-geometry-lens-basis");
    const output = kernelOutput(capture, "invalid-geometry-lens-basis");
    expect(reference.cpuReference.valid).toBe(false);
    expect(output.validityCode).toBe(3);
    expect(output.storedHalfFloatBits).toEqual([0, 0, 0, 0]);
    expect(output.readbackFootprintMm).toEqual([0, 0, 0, 0]);
    expect(evaluateGroundGlassM7dPhysicalCocCapture(capture).status).toBe("passed");
  });

  it("retains exact-zero, signed-small, near-limit, and over-range positive controls", () => {
    const capture = loadCapture();
    const byId = new Map<string, KernelOutput>(capture.probeReadback.controlledKernelCases.map((entry) => [entry.id, entry]));
    expect(byId.get("storage-exact-zero")!.calculatedFootprintMm[0]).toBe(0);
    expect(byId.get("storage-small-positive-coc")!.calculatedFootprintMm[0]).toBeGreaterThan(0);
    expect(byId.get("storage-small-negative-coc")!.calculatedFootprintMm[0]).toBeLessThan(0);
    expect(byId.get("storage-near-binary16-maximum")!.validityCode).toBe(1);
    for (const id of ["storage-overrange-positive-coc", "storage-overrange-negative-coc", "storage-overrange-ellipse-radius"]) {
      const output = byId.get(id)!;
      expect(output.validityCode).toBe(2);
      expect(output.storedHalfFloatBits).toEqual([0, 0, 0, 0]);
    }
    expect(GROUND_GLASS_M7D_REQUIRED_KERNEL_CASE_IDS).toHaveLength(17);
  });

  it("reproduces F1: the prior evaluator accepted a zeroed circular-case lens normal", () => {
    const capture = loadCapture();
    kernelReference(capture, "ellipse-circular").testCase.kernelOverride.lens.planeNormal = { x: 0, y: 0, z: 0 };
    const result = evaluateGroundGlassM7dPhysicalCocCapture(capture);
    expect(result.status).toBe("failed");
    expect(result.issues.map((issue) => issue.code)).toContain("controlled-input-identity");
    expect(result.issues.map((issue) => issue.code)).toContain("cpu-oracle-mismatch");
  });

  it("reproduces F1 with a materially changed finite lens normal", () => {
    const capture = loadCapture();
    kernelReference(capture, "ellipse-circular").testCase.kernelOverride.lens.planeNormal = {
      x: 0.5,
      y: 0,
      z: Math.sqrt(0.75),
    };
    const result = evaluateGroundGlassM7dPhysicalCocCapture(capture);
    expect(result.status).toBe("failed");
    expect(result.issues.map((issue) => issue.code)).toContain("controlled-input-identity");
  });

  expectCaptureMutation("lens basis X edited without matching evidence", (capture) => {
    kernelReference(capture, "ellipse-circular").testCase.kernelOverride.lens.planeBasisX.x = 0.8;
  }, "controlled-input-identity");
  expectCaptureMutation("lens basis Y edited without matching evidence", (capture) => {
    kernelReference(capture, "ellipse-circular").testCase.kernelOverride.lens.planeBasisY.y = 0.8;
  }, "controlled-input-identity");
  expectCaptureMutation("film normal edited without matching evidence", (capture) => {
    kernelReference(capture, "ellipse-film-tilt").testCase.kernelOverride.film.planeNormal.x += 0.02;
  }, "controlled-input-identity");
  expectCaptureMutation("film basis edited without matching evidence", (capture) => {
    kernelReference(capture, "ellipse-film-swing").testCase.kernelOverride.film.planeBasisX.x = 0.9;
  }, "controlled-input-identity");
  expectCaptureMutation("film-plane point edited without matching evidence", (capture) => {
    kernelReference(capture, "ellipse-circular").testCase.kernelOverride.film.planePointWorldM.z += 0.001;
  }, "controlled-input-identity");
  expectCaptureMutation("focal length edited without matching evidence", (capture) => {
    kernelReference(capture, "ellipse-circular").testCase.kernelOverride.optics.focalLengthMm += 1;
  }, "controlled-input-identity");
  expectCaptureMutation("aperture f-number edited without matching evidence", (capture) => {
    kernelReference(capture, "ellipse-circular").testCase.kernelOverride.optics.apertureFNumber += 1;
  }, "controlled-input-identity");
  expectCaptureMutation("controlled object point edited without matching evidence", (capture) => {
    kernelReference(capture, "ellipse-circular").testCase.probe.controlledObjectPointMm[2] += 1;
  }, "controlled-input-identity");
  expectCaptureMutation("lens centre edited without matching evidence", (capture) => {
    kernelReference(capture, "ellipse-circular").testCase.kernelOverride.lens.centerWorldM.x += 0.001;
  }, "controlled-input-identity");
  expectCaptureMutation("metres-to-millimetres input scale edited", (capture) => {
    kernelReference(capture, "ellipse-circular").testCase.kernelOverride.film.planePointWorldM.z *= 1000;
  }, "controlled-input-identity");
  expectCaptureMutation("controlled object point omitted", (capture) => {
    delete (kernelReference(capture, "ellipse-circular").testCase.probe as MutableRecord).controlledObjectPointMm;
  }, "controlled-input-shape");
  expectCaptureMutation("required nested film basis omitted", (capture) => {
    delete (kernelReference(capture, "ellipse-circular").testCase.kernelOverride.film as MutableRecord).planeBasisY;
  }, "controlled-input-shape");
  expectCaptureMutation("non-finite optical input inserted", (capture) => {
    kernelReference(capture, "ellipse-circular").testCase.kernelOverride.optics.focalLengthMm = Number.POSITIVE_INFINITY;
  }, "controlled-input-value");
  expectCaptureMutation("zero lens normal substituted for the circular case", (capture) => {
    kernelReference(capture, "ellipse-circular").testCase.kernelOverride.lens.planeNormal = { x: 0, y: 0, z: 0 };
  }, "controlled-input-identity");
  expectCaptureMutation("valid geometry substituted into the invalid-geometry case", (capture) => {
    kernelReference(capture, "invalid-geometry-lens-basis").testCase.kernelOverride.lens.planeNormal = { x: 0, y: 0, z: 1 };
  }, "controlled-input-identity");
  expectCaptureMutation("serialized CPU reference changed while captured inputs stay fixed", (capture) => {
    kernelReference(capture, "ellipse-circular").cpuReference.signedCoCDiameterMm += 0.1;
  }, "cpu-oracle-mismatch");
  expectCaptureMutation("serialized CPU valid flag contradicted", (capture) => {
    kernelReference(capture, "ellipse-circular").cpuReference.valid = false;
  }, "cpu-oracle-mismatch");
  expectCaptureMutation("serialized CPU signed CoC changed", (capture) => {
    kernelReference(capture, "ellipse-circular").cpuReference.signedCoCDiameterMm *= -1;
  }, "cpu-oracle-mismatch");
  expectCaptureMutation("serialized CPU major and minor axes changed", (capture) => {
    const cpu = kernelReference(capture, "ellipse-film-tilt").cpuReference;
    [cpu.majorRadiusMm, cpu.minorRadiusMm] = [cpu.minorRadiusMm, cpu.majorRadiusMm];
  }, "cpu-oracle-mismatch");
  expectCaptureMutation("serialized CPU orientation changed", (capture) => {
    kernelReference(capture, "ellipse-film-tilt").cpuReference.orientationRad += 0.1;
  }, "cpu-oracle-mismatch");
  expectCaptureMutation("entire CPU and GPU CoC results changed together", (capture) => {
    kernelReference(capture, "ellipse-circular").cpuReference.signedCoCDiameterMm += 0.1;
    kernelOutput(capture, "ellipse-circular").calculatedFootprintMm[0] += 0.1;
  }, "cpu-oracle-mismatch");
  expectCaptureMutation("GPU CoC sign changed", (capture) => {
    kernelOutput(capture, "storage-small-positive-coc").calculatedFootprintMm[0] *= -1;
  }, "signed-coc");
  expectCaptureMutation("GPU major and minor ellipse axes swapped", (capture) => {
    const values = kernelOutput(capture, "ellipse-compound-tilt-swing").calculatedFootprintMm;
    [values[1], values[2]] = [values[2], values[1]];
  }, "kernel-comparison");
  expectCaptureMutation("GPU orientation changed while stored bits remain plausible", (capture) => {
    kernelOutput(capture, "ellipse-film-tilt").calculatedFootprintMm[3] += 0.1;
  }, "orientation-error");
  expectCaptureMutation("GPU orientation changed together with matching stored bits", (capture) => {
    const output = kernelOutput(capture, "ellipse-film-tilt");
    output.calculatedFootprintMm[3] += 0.1;
    output.storedHalfFloatBits[3] = 0x3800;
    output.readbackFootprintMm[3] = 0.5;
    output.sampledFootprintMm[3] = 0.5;
  }, "orientation-error");
  expectCaptureMutation("required controlled input identity contradicted", (capture) => {
    kernelReference(capture, "ellipse-circular").testCase.probe.id = "different-case";
  }, "controlled-input-identity");

  it("reproduces F2: the prior evaluator accepted a native scenario relabeled as unit", () => {
    const report = loadReport();
    reportScenario(report, "native-r187-physical-kernel").evidenceKind = "unit";
    const result = evaluateGroundGlassM7dPhysicalCocReport(report);
    expect(result.status).toBe("failed");
    expect(result.issues.map((issue) => issue.code)).toContain("evidence-kind");
  });

  it("requires the persisted report's exact evidence-kind map", () => {
    const result = evaluateGroundGlassM7dPhysicalCocReport(loadReport());
    expect(result.status, JSON.stringify(result.issues)).toBe("passed");
    expect(result.computedCounts).toEqual({ passed: 8, failed: 0, blocked: 0, "not-run": 0 });
    expect(result.computedScenarioCount).toBe(8);
    expect(result.computedQualification).toBe("research-qualified-for-tested-environment");
    expect(GROUND_GLASS_M7D_REQUIRED_SCENARIO_IDS).toHaveLength(8);
    for (const [id, kind] of Object.entries(GROUND_GLASS_M7D_REQUIRED_SCENARIO_EVIDENCE_KINDS)) {
      expect(reportScenario(loadReport(), id).evidenceKind).toBe(kind);
    }
  });

  expectReportMutation("native evidence relabeled unit", (report) => {
    reportScenario(report, "native-r187-physical-kernel").evidenceKind = "unit";
  }, "evidence-kind");
  expectReportMutation("native evidence relabeled production preview", (report) => {
    reportScenario(report, "real-scene-depth-reconstruction").evidenceKind = "production-preview";
  }, "evidence-kind");
  expectReportMutation("native evidence kind omitted", (report) => {
    delete reportScenario(report, "native-storage-and-validity").evidenceKind;
  }, "evidence-kind");
  expectReportMutation("native evidence kind set to unknown", (report) => {
    reportScenario(report, "optional-pass-failure-raw-preservation").evidenceKind = "browser-claim";
  }, "evidence-kind");
  expectReportMutation("unit evidence mislabeled native", (report) => {
    reportScenario(report, "m5-m6-isolation").evidenceKind = "native";
  }, "evidence-kind");
  expectReportMutation("unit evidence mislabeled production preview", (report) => {
    reportScenario(report, "m5-m6-isolation").evidenceKind = "production-preview";
  }, "evidence-kind");
  expectReportMutation("production preview mislabeled unit", (report) => {
    reportScenario(report, "production-webgl-isolation").evidenceKind = "unit";
  }, "evidence-kind");
  expectReportMutation("production preview mislabeled native", (report) => {
    reportScenario(report, "production-webgl-isolation").evidenceKind = "native";
  }, "evidence-kind");
  expectReportMutation("native runtime identity removed after evidence kind alteration", (report) => {
    const scenario = reportScenario(report, "native-r187-physical-kernel");
    scenario.evidenceKind = "unit";
    delete scenario.runtimeIdentity;
  }, "runtime-identity");
  expectReportMutation("unknown scenario ID", (report) => {
    reportScenario(report, "native-r187-physical-kernel").id = "unknown-scenario";
  }, "unexpected-scenario");
  expectReportMutation("duplicate scenario ID", (report) => {
    report.scenarios[1].id = report.scenarios[0].id;
  }, "duplicate-scenario");

  it("reproduces F3: the prior evaluator accepted altered qualification and scenarioCount", () => {
    const report = loadReport();
    report.qualification = "not-qualified";
    report.scenarioCount = 7;
    const result = evaluateGroundGlassM7dPhysicalCocReport(report);
    expect(result.status).toBe("failed");
    expect(result.issues.map((issue) => issue.code)).toContain("scenario-count");
    expect(result.computedScenarioCount).toBe(8);
    expect(result.computedQualification).toBe("not-qualified");
  });

  expectReportMutation("qualification changed to not-qualified despite all scenarios passing", (report) => {
    report.qualification = "not-qualified";
  }, "qualification");
  expectReportMutation("qualification changed to an unknown value", (report) => {
    report.qualification = "future-qualified";
  }, "qualification");
  expectReportMutation("qualification omitted", (report) => {
    delete report.qualification;
  }, "qualification");
  expectReportMutation("scenarioCount set below the inventory size", (report) => {
    report.scenarioCount = 7;
  }, "scenario-count");
  expectReportMutation("scenarioCount set above the inventory size", (report) => {
    report.scenarioCount = 9;
  }, "scenario-count");
  expectReportMutation("scenarioCount omitted", (report) => {
    delete report.scenarioCount;
  }, "scenario-count");
  expectReportMutation("passed scenario changed to blocked with qualified claim intact", (report) => {
    reportScenario(report, "native-r187-physical-kernel").status = "blocked";
  }, "qualification");
  expectReportMutation("passed scenario changed to failed with qualified claim intact", (report) => {
    reportScenario(report, "native-r187-physical-kernel").status = "failed";
  }, "qualification");
  expectReportMutation("unexpected declared count key", (report) => {
    report.counts.skipped = 0;
  }, "report-counts");
  expectReportMutation("declared count changed to a numeric string", (report) => {
    report.counts.passed = "8";
  }, "report-counts");
  expectReportMutation("declared count changed to a fraction", (report) => {
    report.counts.passed = 7.5;
  }, "report-counts");
  expectReportMutation("declared count changed to a negative number", (report) => {
    report.counts.failed = -1;
  }, "report-counts");
  expectReportMutation("declared count status key omitted", (report) => {
    delete report.counts["not-run"];
  }, "report-counts");

  it("derives a partial decision when a required scenario is blocked and its metadata is updated consistently", () => {
    const report = loadReport();
    reportScenario(report, "native-r187-physical-kernel").status = "blocked";
    report.counts.passed = 7;
    report.counts.blocked = 1;
    report.qualification = "partially-qualified";
    const result = evaluateGroundGlassM7dPhysicalCocReport(report);
    expect(result.status, JSON.stringify(result.issues)).toBe("passed");
    expect(result.computedCounts).toEqual({ passed: 7, failed: 0, blocked: 1, "not-run": 0 });
    expect(result.computedQualification).toBe("partially-qualified");
  });

  it("rejects the report when native ordered-event provenance is missing", () => {
    const report = loadReport();
    delete report.scenarios[0].orderedEventEvidence;
    const result = evaluateGroundGlassM7dPhysicalCocReport(report);
    expect(result.status).toBe("failed");
    expect(result.issues.map((issue) => issue.code)).toContain("event-provenance");
    expect(result.computedQualification).toBe("not-qualified");
  });

  it("rejects native ordered events recorded out of sequence", () => {
    const report = loadReport();
    const events = report.scenarios[0]!.orderedEventEvidence as Array<{ sequenceNumbers: number[] }>;
    events[0]!.sequenceNumbers = [9, 4];
    const result = evaluateGroundGlassM7dPhysicalCocReport(report);
    expect(result.status).toBe("failed");
    expect(result.issues.map((issue) => issue.code)).toContain("event-order");
  });

  it("rejects scenario provenance with an incomplete source SHA", () => {
    const report = loadReport();
    report.scenarios[0].sourceSha = "short-sha";
    const result = evaluateGroundGlassM7dPhysicalCocReport(report);
    expect(result.status).toBe("failed");
    expect(result.issues.map((issue) => issue.code)).toContain("capture-provenance");
  });

  it("uses evaluator revision v2 while preserving the native capture's source provenance", () => {
    expect(GROUND_GLASS_M7D_PHYSICAL_COC_EVIDENCE_REVISION).toBe("m7d-physical-coc-evidence-v2");
    expect(loadCapture().sourceSha).toBe("7118694af4a32a0827e5575519dc49be82c3b23e");
  });
});
