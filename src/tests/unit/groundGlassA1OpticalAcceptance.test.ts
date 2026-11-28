import { describe, expect, it } from "vitest";
import { deriveGroundGlassA1OpticalExpectation, evaluateGroundGlassA1OpticalResponse } from "../render-quality/groundGlassA1OpticalAcceptance";

describe("A1 optical acceptance reference", () => {
  it("derives an untilted thin-lens diameter and rejects malformed source evidence", () => {
    const row = Array.from({ length: 512 }, (_, x) => x % 16 < 8 ? 20 : 100);
    const expected = deriveGroundGlassA1OpticalExpectation(row, 40);
    expect(expected.signedCoCDiameterMm).toBeCloseTo(0.783972, 5);
    expect(expected.majorRadiusMm).toBeCloseTo(0.391986, 5);
    const observed = {
      signedCoCDiameterMm: expected.signedCoCDiameterMm,
      majorRadiusMm: expected.majorRadiusMm,
      majorRadiusPx: expected.majorRadiusPx,
      sourceDefocusedContrast: 40,
      processedDefocusedContrast: expected.localContrastRatio * 40,
      sourceFocusedContrast: 40,
      processedFocusedContrast: 40,
      edgeRedIncrease: 0,
    };
    expect(evaluateGroundGlassA1OpticalResponse(observed, row).accepted).toBe(true);
    expect(evaluateGroundGlassA1OpticalResponse(observed, []).accepted).toBe(false);
    expect(evaluateGroundGlassA1OpticalResponse({ ...observed, majorRadiusMm: expected.majorRadiusMm * 3 }, row).failureReasons)
      .toContain("optical-footprint-mismatch");
  });
});
