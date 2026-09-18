import { describe, expect, it } from "vitest";
import { deriveMacroFocusMetrics } from "../../core/optics/deriveMacroFocusMetrics";
import { imageDistanceMm } from "../../core/optics/thinLensModel";
import {
  formatMacroReproductionRatio,
  isMacroLifeSizeMagnification,
  resolveMacroBellowsExtensionTeaching,
} from "../../scenes/macroBellowsExtensionTeaching";
import { macroBellowsExtensionScene } from "../../scenes/definitions/macro-bellows-extension";

const metricsAt = (objectDistanceMm: number) => {
  return deriveMacroFocusMetrics({
    focalLengthMm: 150,
    objectDistanceMm,
    imageDistanceMm: imageDistanceMm(150, objectDistanceMm),
  });
};

describe("Macro Scene 1 teaching model", () => {
  it("resolves reachable early, intermediate, near-life-size, and life-size states", () => {
    const capability = macroBellowsExtensionScene.macroTeachingCapability;
    expect(capability).toBeDefined();
    const states = [
      [900, "early"],
      [450, "intermediate"],
      [320, "near-life-size"],
      [300, "life-size"],
    ] as const;

    for (const [focusObjectDistanceMm, stage] of states) {
      const model = resolveMacroBellowsExtensionTeaching({
        capability,
        metrics: metricsAt(focusObjectDistanceMm),
        focusObjectDistanceMm,
      });
      expect(model?.stage).toBe(stage);
    }
  });

  it("signals the soft travel warning only near the configured teaching capacity", () => {
    const capability = macroBellowsExtensionScene.macroTeachingCapability;
    const early = resolveMacroBellowsExtensionTeaching({
      capability,
      metrics: metricsAt(450),
      focusObjectDistanceMm: 450,
    });
    const close = resolveMacroBellowsExtensionTeaching({
      capability,
      metrics: metricsAt(320),
      focusObjectDistanceMm: 320,
    });
    expect(early?.capacityWarning).toBe(false);
    expect(close?.capacityWarning).toBe(true);
  });

  it("formats canonical reproduction ratios without re-solving optics", () => {
    expect(formatMacroReproductionRatio(0.2)).toBe("1:5");
    expect(formatMacroReproductionRatio(0.5)).toBe("1:2");
    expect(formatMacroReproductionRatio(1)).toBe("1:1");
    expect(formatMacroReproductionRatio(1.25)).toBe("1.25:1");
    expect(formatMacroReproductionRatio(0)).toBe("—");
  });

  it("uses the public focus step as a reachable life-size tolerance", () => {
    expect(isMacroLifeSizeMagnification({ magnification: 1, focusObjectDistanceMm: 300 })).toBe(true);
    expect(isMacroLifeSizeMagnification({ magnification: 0.9375, focusObjectDistanceMm: 310 })).toBe(false);
    expect(isMacroLifeSizeMagnification({ magnification: 1, focusObjectDistanceMm: 0 })).toBe(false);
  });

  it("returns no teaching model when canonical metrics are unavailable", () => {
    expect(resolveMacroBellowsExtensionTeaching({
      capability: macroBellowsExtensionScene.macroTeachingCapability,
      metrics: null,
      focusObjectDistanceMm: 900,
    })).toBeNull();
    expect(resolveMacroBellowsExtensionTeaching({
      capability: undefined,
      metrics: metricsAt(900),
      focusObjectDistanceMm: 900,
    })).toBeNull();
  });
});
