import { describe, expect, it } from "vitest";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import {
  calculateAngularImageCircleDiameterMm,
  deriveLensCoverage,
} from "../../core/optics/lensCoverage";
import { resolveLensDefinitionForFocalLengthMm } from "../../core/optics/lensCatalog";
import { macroBellowsExtensionScene } from "../../scenes/definitions/macro-bellows-extension";
import { architectureRiseScene } from "../../scenes/definitions/architecture-rise";
import type { LensCoverageSpec } from "../../types/lens";
import { DEFAULT_CAMERA_STATE } from "../../utils/constants";

const angularCoverage: LensCoverageSpec = {
  kind: "angular",
  fullCoverageAngleDeg: 72,
};

const unboundedCoverage: LensCoverageSpec = {
  kind: "unbounded-ideal",
};

describe("lens coverage model", () => {
  it("represents ideal thin-lens coverage without fabricating an image circle", () => {
    expect(deriveLensCoverage(unboundedCoverage, 150)).toEqual({
      kind: "unbounded-ideal",
      imageCircleRadiusMm: null,
      imageCircleDiameterMm: null,
    });
  });

  it("uses the complete included angle to derive a perpendicular image-plane circle", () => {
    const result = deriveLensCoverage(angularCoverage, 150);
    const expectedDiameterMm = 2 * 150 * Math.tan((36 * Math.PI) / 180);

    expect(result).toMatchObject({
      kind: "angular",
      fullCoverageAngleDeg: 72,
      halfCoverageAngleDeg: 36,
      imageDistanceMm: 150,
    });
    expect(result?.imageCircleDiameterMm).toBeCloseTo(expectedDiameterMm, 10);
    expect(result?.imageCircleDiameterMm).toBeCloseTo(217.96, 2);
    expect(result?.imageCircleRadiusMm).toBeCloseTo(expectedDiameterMm / 2, 10);
    expect(calculateAngularImageCircleDiameterMm(72, 150)).toBeCloseTo(expectedDiameterMm, 10);
  });

  it("scales angular coverage diameter exactly with bellows image distance", () => {
    const at150Mm = deriveLensCoverage(angularCoverage, 150);
    const at300Mm = deriveLensCoverage(angularCoverage, 300);

    expect(at150Mm?.kind).toBe("angular");
    expect(at300Mm?.kind).toBe("angular");
    if (at150Mm?.kind !== "angular" || at300Mm?.kind !== "angular") return;

    expect(at300Mm.imageCircleDiameterMm).toBeCloseTo(at150Mm.imageCircleDiameterMm * 2, 12);
    expect(at300Mm.imageCircleRadiusMm).toBeCloseTo(at150Mm.imageCircleRadiusMm * 2, 12);
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    "fails closed for non-physical image distance %s",
    (imageDistanceMm) => {
      expect(deriveLensCoverage(angularCoverage, imageDistanceMm)).toBeNull();
      expect(deriveLensCoverage(unboundedCoverage, imageDistanceMm)).toBeNull();
    },
  );

  it.each([0, -1, 180, 181, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    "fails closed for invalid full coverage angle %s",
    (fullCoverageAngleDeg) => {
      expect(deriveLensCoverage({ kind: "angular", fullCoverageAngleDeg }, 150)).toBeNull();
      expect(calculateAngularImageCircleDiameterMm(fullCoverageAngleDeg, 150)).toBeNull();
    },
  );
});

describe("lens specification compatibility boundary", () => {
  it("resolves the 150 mm simulator lens to its explicit parametric profile", () => {
    expect(resolveLensDefinitionForFocalLengthMm(150)).toMatchObject({
      id: "simulator-parametric-150mm",
      focalLengthMm: 150,
      coverage: { kind: "angular", fullCoverageAngleDeg: 72 },
    });
  });

  it("keeps other current focal lengths unbounded in this PR", () => {
    for (const focalLengthMm of [90, 105, 120]) {
      expect(resolveLensDefinitionForFocalLengthMm(focalLengthMm)).toMatchObject({
        focalLengthMm,
        coverage: { kind: "unbounded-ideal" },
      });
    }
  });

  it("does not invent a finite profile for an otherwise valid unknown focal length", () => {
    expect(resolveLensDefinitionForFocalLengthMm(210)).toMatchObject({
      id: "simulator-ideal-210mm",
      focalLengthMm: 210,
      coverage: { kind: "unbounded-ideal" },
    });
    expect(resolveLensDefinitionForFocalLengthMm(0)).toBeNull();
    expect(resolveLensDefinitionForFocalLengthMm(Number.NaN)).toBeNull();
  });
});

describe("canonical derived lens state", () => {
  it("exposes the resolved 150 mm parametric lens and derived finite coverage", () => {
    const optics = deriveOpticsState(DEFAULT_CAMERA_STATE, architectureRiseScene);

    expect(optics.lensDefinition).toMatchObject({
      id: "simulator-parametric-150mm",
      focalLengthMm: 150,
      coverage: { kind: "angular", fullCoverageAngleDeg: 72 },
    });
    expect(optics.lensCoverage?.kind).toBe("angular");
    if (optics.lensCoverage?.kind !== "angular") return;
    expect(optics.lensCoverage.imageCircleRadiusMm).toBeGreaterThan(100);
    expect(optics.groundGlassCoverage).toMatchObject({
      kind: "parallel-circle",
      imageCircleRadiusMm: optics.lensCoverage.imageCircleRadiusMm,
      opticalAxisOffsetXMm: 0,
      opticalAxisOffsetYMm: 0,
    });
  });

  it("keeps macro image distance available to the coverage derivation boundary", () => {
    const optics = deriveOpticsState(
      {
        ...DEFAULT_CAMERA_STATE,
        ...macroBellowsExtensionScene.cameraPreset,
        activeSceneId: macroBellowsExtensionScene.id,
        focusDistanceMm: 300,
      },
      macroBellowsExtensionScene,
    );

    expect(optics.diagnostics.imageDistanceMm).toBeCloseTo(300, 12);
    expect(optics.lensCoverage?.kind).toBe("angular");
    expect(optics.groundGlassCoverage.kind).toBe("parallel-circle");
    if (optics.lensCoverage?.kind !== "angular") return;
    expect(optics.lensCoverage.imageCircleRadiusMm).toBeGreaterThan(120);
  });

  it("does not derive lens coverage from an invalid camera fallback", () => {
    const optics = deriveOpticsState(
      { ...DEFAULT_CAMERA_STATE, focalLengthMm: Number.NaN },
      architectureRiseScene,
    );

    expect(optics.diagnostics.fallbackApplied).toBe(true);
    expect(optics.lensDefinition).toBeNull();
    expect(optics.lensCoverage).toBeNull();
  });
});
