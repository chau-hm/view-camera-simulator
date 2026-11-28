import { describe, expect, it } from "vitest";
import {
  bootstrapMedianInterval,
  compareEdgeMetrics,
  firstWebGlNearProposalRadiusPx,
  measureVerticalEdgeRows,
} from "../../../experiments/room-at-dawn/optical-calibration/edge-metrics.mjs";

function makeStepCrop({ width = 28, height = 16, edgeOffset = 14.25, spread10to90Px = 3.2 } = {}) {
  const pixels = new Uint8Array(width * height * 4);
  const rampWidth = spread10to90Px / 0.8;
  for (let y = 0; y < height; y += 1) {
    const rowPhase = (y % 8) / 8;
    for (let x = 0; x < width; x += 1) {
      const normalized = Math.max(0, Math.min(1, (x + 0.5 - edgeOffset - rowPhase) / rampWidth + 0.5));
      const value = Math.round(35 + normalized * 175);
      const offset = (y * width + x) * 4;
      pixels.set([value, value, value, 255], offset);
    }
  }
  return { pixels, width, height };
}

describe("Room-at-Dawn optical calibration analysis", () => {
  it("reports deterministic row-bootstrap uncertainty and observed pixel phases", () => {
    const crop = makeStepCrop();
    const first = measureVerticalEdgeRows(crop.pixels, crop.width, crop.height, { seed: 419, replicates: 1000 });
    const repeat = measureVerticalEdgeRows(crop.pixels, crop.width, crop.height, { seed: 419, replicates: 1000 });
    if (!first.valid || !repeat.valid) throw new Error("synthetic edge should be measurable");
    expect(first.valid).toBe(true);
    expect(first).toMatchObject({ validRowCount: 16, phaseCoverage: { adequate: true } });
    expect(first.phaseSweep).toMatchObject({ adequate: true, sampleCount: 8 });
    expect(first.width10to90Px).toBeGreaterThan(2.5);
    expect(first.width10to90Px).toBeLessThan(4.5);
    expect(first.bootstrap95Px[0]).toBeLessThanOrEqual(first.width10to90Px);
    expect(first.bootstrap95Px[1]).toBeGreaterThanOrEqual(first.width10to90Px);
    expect(repeat.bootstrap95Px).toEqual(first.bootstrap95Px);
    expect(first.phaseCoverage.rowsPerBin.reduce((sum: number, count: number) => sum + count, 0)).toBe(16);
  });

  it("keeps phase-limited comparisons inconclusive instead of calling them optical discrepancies", () => {
    const raw = {
      valid: true,
      width10to90Px: 1,
      bootstrap95Px: [0.95, 1.05] as const,
      phaseSweep: { adequate: false, envelopePx: null },
    };
    const processed = {
      valid: true,
      width10to90Px: 3,
      bootstrap95Px: [2.95, 3.05] as const,
      phaseSweep: { adequate: true, envelopePx: 0.1 },
    };
    expect(compareEdgeMetrics(raw, processed).status).toBe("INCONCLUSIVE_PHASE_COVERAGE");
  });

  it("requires a resolved difference beyond bootstrap, phase, and quarter-pixel floors", () => {
    const raw = {
      valid: true,
      width10to90Px: 1,
      bootstrap95Px: [0.95, 1.05] as const,
      phaseSweep: { adequate: true, envelopePx: 0.1 },
    };
    const processed = {
      valid: true,
      width10to90Px: 2,
      bootstrap95Px: [1.95, 2.05] as const,
      phaseSweep: { adequate: true, envelopePx: 0.1 },
    };
    expect(compareEdgeMetrics(raw, processed).status).toBe("PROCESSED_EDGE_SPREAD_RESOLVED");
    expect(firstWebGlNearProposalRadiusPx(60, 32)).toBe(7.5);
    expect(firstWebGlNearProposalRadiusPx(64, 32)).toBe(8);
  });

  it("does not bootstrap invalid samples", () => {
    expect(bootstrapMedianInterval([])).toMatchObject({ valid: false });
    expect(() => bootstrapMedianInterval([1, 2], { replicates: 10 })).toThrow("at least 100 replicates");
  });
});
