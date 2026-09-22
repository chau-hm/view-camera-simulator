import { describe, expect, it } from "vitest";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import { deriveMacroFocusMetrics } from "../../core/optics/deriveMacroFocusMetrics";
import { imageDistanceMm } from "../../core/optics/thinLensModel";
import {
  formatMacroReproductionRatio,
  isMacroLifeSizeMagnification,
  resolveMacroBellowsExtensionTeaching,
} from "../../scenes/macroBellowsExtensionTeaching";
import { macroBellowsExtensionScene } from "../../scenes/definitions/macro-bellows-extension";
import { DEFAULT_CAMERA_STATE } from "../../utils/constants";

const opticsAt = (objectDistanceMm: number) => deriveOpticsState({
  ...DEFAULT_CAMERA_STATE,
  ...macroBellowsExtensionScene.cameraPreset,
  activeSceneId: macroBellowsExtensionScene.id,
  focusDistanceMm: objectDistanceMm,
  focusMode: "finite",
}, macroBellowsExtensionScene);

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
        lensCoverage: opticsAt(focusObjectDistanceMm).lensCoverage,
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
      lensCoverage: opticsAt(450).lensCoverage,
    });
    const close = resolveMacroBellowsExtensionTeaching({
      capability,
      metrics: metricsAt(320),
      focusObjectDistanceMm: 320,
      lensCoverage: opticsAt(320).lensCoverage,
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
      lensCoverage: opticsAt(900).lensCoverage,
    })).toBeNull();
    expect(resolveMacroBellowsExtensionTeaching({
      capability: undefined,
      metrics: metricsAt(900),
      focusObjectDistanceMm: 900,
      lensCoverage: opticsAt(900).lensCoverage,
    })).toBeNull();
  });

  it("carries current canonical coverage at each magnification-based teaching stage", () => {
    const checkpoints = [
      [900, "early"],
      [450, "intermediate"],
      [320, "near-life-size"],
      [300, "life-size"],
    ] as const;
    const models = checkpoints.map(([focusObjectDistanceMm, stage]) => {
      const optics = opticsAt(focusObjectDistanceMm);
      const model = resolveMacroBellowsExtensionTeaching({
        capability: macroBellowsExtensionScene.macroTeachingCapability,
        metrics: metricsAt(focusObjectDistanceMm),
        focusObjectDistanceMm,
        lensCoverage: optics.lensCoverage,
      });
      expect(model?.stage).toBe(stage);
      expect(optics.lensCoverage?.kind).toBe("angular");
      expect(model?.imageCircleDiameterMm).toBe(optics.lensCoverage?.kind === "angular"
        ? optics.lensCoverage.imageCircleDiameterMm
        : null);
      return model;
    });
    expect(models[0]?.imageCircleDiameterMm).toBeLessThan(models[1]?.imageCircleDiameterMm ?? Infinity);
    expect(models[1]?.imageCircleDiameterMm).toBeLessThan(models[2]?.imageCircleDiameterMm ?? Infinity);
    expect(models[2]?.imageCircleDiameterMm).toBeLessThan(models[3]?.imageCircleDiameterMm ?? Infinity);
  });

  it("keeps macro stage selection available without finite angular coverage", () => {
    const model = resolveMacroBellowsExtensionTeaching({
      capability: macroBellowsExtensionScene.macroTeachingCapability,
      metrics: metricsAt(900),
      focusObjectDistanceMm: 900,
      lensCoverage: { kind: "unbounded-ideal", imageCircleRadiusMm: null, imageCircleDiameterMm: null },
    });
    expect(model?.stage).toBe("early");
    expect(model?.imageCircleDiameterMm).toBeNull();
  });
});
