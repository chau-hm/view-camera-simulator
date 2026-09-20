import { describe, expect, it } from "vitest";
import { deriveMacroFocusMetrics } from "../../core/optics/deriveMacroFocusMetrics";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import { pointToPlaneDistance } from "../../core/math/plane";
import { resolvePhysicalFocusTargetPresentationMetric } from "../../render/postprocessing/FocusAssistPass";
import { projectWorldPointToFilmPlaneGroundGlass } from "../../render/groundGlassFilmPlaneProjection";
import { getSceneById, getSceneFocusDistanceRange, sceneOrder } from "../../scenes/definitions";
import { macroCompoundMovementsScene } from "../../scenes/definitions/macro-compound-movements";
import {
  MACRO_COMPOUND_MOVEMENTS_APERTURE,
  MACRO_COMPOUND_MOVEMENTS_FOCAL_LENGTH_MM,
  MACRO_COMPOUND_MOVEMENTS_FOCUS_DISTANCE_RANGE_MM,
  MACRO_COMPOUND_MOVEMENTS_INITIAL_FOCUS_DISTANCE_MM,
  macroCompoundMovementsCanonicalPlane,
  macroCompoundMovementsCompositionTargetBounds,
  macroCompoundMovementsContinuousCalibration,
  macroCompoundMovementsFocusFaceCorners,
  macroCompoundMovementsFocusTargets,
  macroCompoundMovementsPublicCalibration,
  macroCompoundMovementsStationSpecs,
} from "../../scenes/macroCompoundMovementsGeometry";
import type { ApertureValue, CameraState } from "../../types/camera";
import { DEFAULT_CAMERA_STATE } from "../../utils/constants";

const cameraAt = (
  focusDistanceMm: number,
  frontTiltDeg = 0,
  frontSwingDeg = 0,
  aperture: ApertureValue = MACRO_COMPOUND_MOVEMENTS_APERTURE,
): CameraState => ({
  ...DEFAULT_CAMERA_STATE,
  ...macroCompoundMovementsScene.cameraPreset,
  activeSceneId: macroCompoundMovementsScene.id,
  activeTaskId: null,
  mode: "free",
  focusDistanceMm,
  frontTiltDeg,
  frontSwingDeg,
  aperture,
  focusMode: "finite",
});

const physicalMetricsAt = (
  focusDistanceMm: number,
  frontTiltDeg = 0,
  frontSwingDeg = 0,
) => {
  const optics = deriveOpticsState(
    cameraAt(focusDistanceMm, frontTiltDeg, frontSwingDeg),
    macroCompoundMovementsScene,
  );
  return {
    optics,
    metrics: optics.focusTargets.map((target) =>
      resolvePhysicalFocusTargetPresentationMetric(target, "patch"),
    ),
  };
};

type SearchResult = {
  frontTiltDeg: number;
  frontSwingDeg: number;
  focusDistanceMm: number;
  metrics: ReturnType<typeof physicalMetricsAt>["metrics"];
  minimumSharpness: number;
  worstCoC: number;
};

const scoreResult = (
  frontTiltDeg: number,
  frontSwingDeg: number,
  focusDistanceMm: number,
): SearchResult => {
  const metrics = physicalMetricsAt(focusDistanceMm, frontTiltDeg, frontSwingDeg).metrics;
  return {
    frontTiltDeg,
    frontSwingDeg,
    focusDistanceMm,
    metrics,
    minimumSharpness: Math.min(...metrics.map((metric) => metric.sharpness)),
    worstCoC: Math.max(
      ...metrics.map((metric) => metric.equivalentCoCDiameterMm ?? Number.POSITIVE_INFINITY),
    ),
  };
};

const betterResult = (candidate: SearchResult, current: SearchResult | null): SearchResult => {
  if (!current) return candidate;
  if (candidate.minimumSharpness !== current.minimumSharpness) {
    return candidate.minimumSharpness > current.minimumSharpness ? candidate : current;
  }
  return candidate.worstCoC < current.worstCoC ? candidate : current;
};

const searchFocusLattice = (options: {
  tiltValues: readonly number[];
  swingValues: readonly number[];
}): SearchResult => {
  const focusRange = getSceneFocusDistanceRange(macroCompoundMovementsScene.id, 150);
  let best: SearchResult | null = null;
  for (const frontTiltDeg of options.tiltValues) {
    for (const frontSwingDeg of options.swingValues) {
      for (
        let focusDistanceMm = focusRange.min;
        focusDistanceMm <= focusRange.max;
        focusDistanceMm += 10
      ) {
        best = betterResult(
          scoreResult(frontTiltDeg, frontSwingDeg, focusDistanceMm),
          best,
        );
      }
    }
  }
  if (!best) throw new Error("No public macro compound candidate was evaluated");
  return best;
};

const PUBLIC_TILT_LATTICE = Array.from({ length: 201 }, (_, index) =>
  Number((-10 + index * 0.1).toFixed(1)),
);
const PUBLIC_SWING_LATTICE = Array.from({ length: 201 }, (_, index) =>
  Number((-10 + index * 0.1).toFixed(1)),
);

describe("macro-compound-movements scene foundation", () => {
  it("registers the finite compound scene with the requested public controls", () => {
    expect(getSceneById(macroCompoundMovementsScene.id)).toBe(macroCompoundMovementsScene);
    expect(sceneOrder.at(-1)).toBe(macroCompoundMovementsScene.id);
    expect(macroCompoundMovementsScene.cameraPreset).toMatchObject({
      focalLengthMm: MACRO_COMPOUND_MOVEMENTS_FOCAL_LENGTH_MM,
      focusDistanceMm: MACRO_COMPOUND_MOVEMENTS_INITIAL_FOCUS_DISTANCE_MM,
      aperture: MACRO_COMPOUND_MOVEMENTS_APERTURE,
      frontRiseMm: 0,
      frontShiftMm: 0,
      frontTiltDeg: 0,
      frontSwingDeg: 0,
      rearRiseMm: 0,
      rearShiftMm: 0,
      rearTiltDeg: 0,
      rearSwingDeg: 0,
    });
    expect(getSceneFocusDistanceRange(macroCompoundMovementsScene.id, 150)).toEqual(
      MACRO_COMPOUND_MOVEMENTS_FOCUS_DISTANCE_RANGE_MM,
    );
    expect(macroCompoundMovementsScene.finiteFocusStrategy).toEqual({
      kind: "rear-standard-thin-lens",
      lensDatum: "baseline-origin",
      focusDistanceReference: "lens-to-focus-plane",
      filmDepthReference: "optical-axis-conjugate",
    });
    expect(macroCompoundMovementsScene.movementCapabilities).toEqual({
      available: ["frontTiltDeg", "frontSwingDeg"],
      selectionMode: "multiple",
      defaultMovement: "frontTiltDeg",
    });
    expect(macroCompoundMovementsScene.cameraControlPolicy).toEqual({
      aperture: "fixed",
      infinityReset: false,
    });
    expect(macroCompoundMovementsScene.macroFocusMetricsCapability).toEqual({ enabled: true });
    expect(macroCompoundMovementsScene.macroTeachingCapability).toEqual({
      kind: "compound-movements",
    });
    expect(macroCompoundMovementsScene.focusTargets.map(({ id }) => id)).toEqual([
      "macro-compound-near-left",
      "macro-compound-centre",
      "macro-compound-far-right",
    ]);
  });

  it("derives a non-zero two-axis canonical plane and coplanar probes", () => {
    expect(Math.abs(macroCompoundMovementsCanonicalPlane.normal.x)).toBeGreaterThan(0.1);
    expect(Math.abs(macroCompoundMovementsCanonicalPlane.normal.y)).toBeGreaterThan(0.1);
    expect(Math.abs(macroCompoundMovementsContinuousCalibration.frontTiltDeg)).toBeGreaterThan(1);
    expect(Math.abs(macroCompoundMovementsContinuousCalibration.frontSwingDeg)).toBeGreaterThan(1);
    expect(macroCompoundMovementsContinuousCalibration.frontTiltDeg).toBeGreaterThan(-10);
    expect(macroCompoundMovementsContinuousCalibration.frontTiltDeg).toBeLessThan(10);
    expect(macroCompoundMovementsContinuousCalibration.frontSwingDeg).toBeGreaterThan(-10);
    expect(macroCompoundMovementsContinuousCalibration.frontSwingDeg).toBeLessThan(10);
    expect(macroCompoundMovementsContinuousCalibration.frontTiltDeg).toBeCloseTo(3.4, 10);
    expect(macroCompoundMovementsContinuousCalibration.frontSwingDeg).toBeCloseTo(-2.8, 10);
    expect(macroCompoundMovementsContinuousCalibration.focusDistanceMm).toBeCloseTo(490, 10);
    expect(macroCompoundMovementsPublicCalibration).toMatchObject({
      frontTiltDeg: 3.4,
      frontSwingDeg: -2.8,
      focusDistanceMm: 490,
      aperture: 5.6,
    });

    const continuousOptics = physicalMetricsAt(
      macroCompoundMovementsContinuousCalibration.focusDistanceMm,
      macroCompoundMovementsContinuousCalibration.frontTiltDeg,
      macroCompoundMovementsContinuousCalibration.frontSwingDeg,
    ).optics;
    expect(continuousOptics.focusPlane).not.toBeNull();
    expect(
      Math.abs(
        continuousOptics.focusPlane!.normal.x * macroCompoundMovementsCanonicalPlane.normal.x +
          continuousOptics.focusPlane!.normal.y * macroCompoundMovementsCanonicalPlane.normal.y +
          continuousOptics.focusPlane!.normal.z * macroCompoundMovementsCanonicalPlane.normal.z,
      ),
    ).toBeCloseTo(1, 8);
    expect(
      pointToPlaneDistance(
        macroCompoundMovementsCanonicalPlane.point,
        continuousOptics.focusPlane!,
      ),
    ).toBeLessThan(1e-6);

    macroCompoundMovementsFocusTargets.forEach((target) => {
      const points = [target.worldPosition, ...(target.sampleWorldPositions ?? [])];
      points.forEach((point) => {
        expect(pointToPlaneDistance(point, macroCompoundMovementsCanonicalPlane)).toBeLessThan(1e-8);
      });
    });
    expect(macroCompoundMovementsStationSpecs.every((station) =>
      (station.patchSampleOffsetsLocalMm?.length ?? 0) >= 5,
    )).toBe(true);
  });

  it("starts with the centre reference strongest while the separated regions disagree", () => {
    const { optics, metrics } = physicalMetricsAt(
      MACRO_COMPOUND_MOVEMENTS_INITIAL_FOCUS_DISTANCE_MM,
    );
    expect(optics.diagnostics.fallbackApplied).toBe(false);
    expect(metrics[1].sharpness).toBeGreaterThan(metrics[0].sharpness);
    expect(metrics[1].sharpness).toBeGreaterThan(metrics[2].sharpness);
    expect(metrics.some((metric) => metric.status !== "sharp")).toBe(true);
  });

  it("derives composition bounds from every canonical critical-face corner", () => {
    const allCriticalCorners = macroCompoundMovementsStationSpecs.flatMap(
      macroCompoundMovementsFocusFaceCorners,
    );
    const expectedBounds = {
      min: {
        x: Math.min(...allCriticalCorners.map((point) => point.x)),
        y: Math.min(...allCriticalCorners.map((point) => point.y)),
        z: Math.min(...allCriticalCorners.map((point) => point.z)),
      },
      max: {
        x: Math.max(...allCriticalCorners.map((point) => point.x)),
        y: Math.max(...allCriticalCorners.map((point) => point.y)),
        z: Math.max(...allCriticalCorners.map((point) => point.z)),
      },
    };

    expect(allCriticalCorners).toHaveLength(12);
    expect(macroCompoundMovementsCompositionTargetBounds.min.x).toBeCloseTo(expectedBounds.min.x, 10);
    expect(macroCompoundMovementsCompositionTargetBounds.min.y).toBeCloseTo(expectedBounds.min.y, 10);
    expect(macroCompoundMovementsCompositionTargetBounds.min.z).toBeCloseTo(expectedBounds.min.z, 10);
    expect(macroCompoundMovementsCompositionTargetBounds.max.x).toBeCloseTo(expectedBounds.max.x, 10);
    expect(macroCompoundMovementsCompositionTargetBounds.max.y).toBeCloseTo(expectedBounds.max.y, 10);
    expect(macroCompoundMovementsCompositionTargetBounds.max.z).toBeCloseTo(expectedBounds.max.z, 10);

    for (const corner of allCriticalCorners) {
      expect(corner.x).toBeGreaterThanOrEqual(macroCompoundMovementsCompositionTargetBounds.min.x);
      expect(corner.x).toBeLessThanOrEqual(macroCompoundMovementsCompositionTargetBounds.max.x);
      expect(corner.y).toBeGreaterThanOrEqual(macroCompoundMovementsCompositionTargetBounds.min.y);
      expect(corner.y).toBeLessThanOrEqual(macroCompoundMovementsCompositionTargetBounds.max.y);
      expect(corner.z).toBeGreaterThanOrEqual(macroCompoundMovementsCompositionTargetBounds.min.z);
      expect(corner.z).toBeLessThanOrEqual(macroCompoundMovementsCompositionTargetBounds.max.z);
    }
  });

  it("makes all three critical regions sharp at the derived public compound state", () => {
    const { optics, metrics } = physicalMetricsAt(
      macroCompoundMovementsPublicCalibration.focusDistanceMm,
      macroCompoundMovementsPublicCalibration.frontTiltDeg,
      macroCompoundMovementsPublicCalibration.frontSwingDeg,
    );
    expect(optics.diagnostics.fallbackApplied).toBe(false);
    expect(optics.focusPlane).not.toBeNull();
    metrics.forEach((metric) => {
      expect(metric.status).toBe("sharp");
      expect(metric.sharpness).toBeGreaterThanOrEqual(0.8);
      expect(metric.equivalentCoCDiameterMm).toBeLessThan(0.1);
    });
  });

  it("keeps the shared macro conjugate readout at the compound solution", () => {
    const { optics } = physicalMetricsAt(
      macroCompoundMovementsPublicCalibration.focusDistanceMm,
      macroCompoundMovementsPublicCalibration.frontTiltDeg,
      macroCompoundMovementsPublicCalibration.frontSwingDeg,
    );
    const { focusObjectDistanceMm, imageDistanceMm } = optics.diagnostics;
    const macroMetrics = deriveMacroFocusMetrics({
      focalLengthMm: MACRO_COMPOUND_MOVEMENTS_FOCAL_LENGTH_MM,
      objectDistanceMm: focusObjectDistanceMm!,
      imageDistanceMm: imageDistanceMm!,
    });

    expect(focusObjectDistanceMm).toBeCloseTo(490, 10);
    expect(imageDistanceMm).toBeCloseTo(216.1764705882, 10);
    expect(macroMetrics?.magnification).toBeCloseTo(0.4411764706, 10);
    expect(macroMetrics?.bellowsExtensionMm).toBeCloseTo(216.1764705882, 10);
  });

  it("proves Focus-only, Tilt-plus-Focus, and Swing-plus-Focus cannot solve all regions", () => {
    const focusOnly = searchFocusLattice({ tiltValues: [0], swingValues: [0] });
    const tiltPlusFocus = searchFocusLattice({
      tiltValues: PUBLIC_TILT_LATTICE,
      swingValues: [0],
    });
    const swingPlusFocus = searchFocusLattice({
      tiltValues: [0],
      swingValues: PUBLIC_SWING_LATTICE,
    });

    expect(focusOnly.minimumSharpness).toBeLessThan(0.8);
    expect(tiltPlusFocus.minimumSharpness).toBeLessThan(0.8);
    expect(swingPlusFocus.minimumSharpness).toBeLessThan(0.8);
    expect(tiltPlusFocus.frontSwingDeg).toBe(0);
    expect(swingPlusFocus.frontTiltDeg).toBe(0);
  });

  it("keeps the public compound state on the real control lattices and inside the film", () => {
    const { optics, metrics } = physicalMetricsAt(
      macroCompoundMovementsPublicCalibration.focusDistanceMm,
      macroCompoundMovementsPublicCalibration.frontTiltDeg,
      macroCompoundMovementsPublicCalibration.frontSwingDeg,
    );
    expect(macroCompoundMovementsPublicCalibration.frontTiltDeg / 0.1).toBeCloseTo(
      Math.round(macroCompoundMovementsPublicCalibration.frontTiltDeg / 0.1),
      10,
    );
    expect(macroCompoundMovementsPublicCalibration.frontSwingDeg / 0.1).toBeCloseTo(
      Math.round(macroCompoundMovementsPublicCalibration.frontSwingDeg / 0.1),
      10,
    );
    expect(macroCompoundMovementsPublicCalibration.focusDistanceMm % 10).toBe(0);
    expect(metrics.every((metric) => metric.status === "sharp")).toBe(true);

    macroCompoundMovementsFocusTargets.forEach((target) => {
      const points = [target.worldPosition, ...(target.sampleWorldPositions ?? [])];
      points.forEach((worldPoint) => {
        expect(
          projectWorldPointToFilmPlaneGroundGlass({
            worldPoint,
            lensCenterWorld: optics.lensCenterWorld,
            filmPlaneCornersWorld: optics.filmPlaneCornersWorld,
          }).visible,
        ).toBe(true);
      });
    });
    macroCompoundMovementsStationSpecs.forEach((station) => {
      macroCompoundMovementsFocusFaceCorners(station).forEach((worldPoint) => {
        expect(
          projectWorldPointToFilmPlaneGroundGlass({
            worldPoint,
            lensCenterWorld: optics.lensCenterWorld,
            filmPlaneCornersWorld: optics.filmPlaneCornersWorld,
          }).visible,
        ).toBe(true);
      });
    });
  });

  it("requires each control at the compound solution and preserves the derived sign", () => {
    const solution = macroCompoundMovementsPublicCalibration;
    const perturbations = [
      scoreResult(solution.frontTiltDeg - 0.5, solution.frontSwingDeg, solution.focusDistanceMm),
      scoreResult(solution.frontTiltDeg + 0.5, solution.frontSwingDeg, solution.focusDistanceMm),
      scoreResult(solution.frontTiltDeg, solution.frontSwingDeg - 0.5, solution.focusDistanceMm),
      scoreResult(solution.frontTiltDeg, solution.frontSwingDeg + 0.5, solution.focusDistanceMm),
      scoreResult(solution.frontTiltDeg, solution.frontSwingDeg, solution.focusDistanceMm - 20),
      scoreResult(solution.frontTiltDeg, solution.frontSwingDeg, solution.focusDistanceMm + 20),
      scoreResult(-solution.frontTiltDeg, solution.frontSwingDeg, solution.focusDistanceMm),
      scoreResult(solution.frontTiltDeg, -solution.frontSwingDeg, solution.focusDistanceMm),
    ];
    expect(perturbations.every((result) => result.minimumSharpness < 0.8)).toBe(true);
  });
});
