import { describe, expect, it } from "vitest";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import { pointToPlaneDistance } from "../../core/math/plane";
import { resolvePhysicalFocusTargetPresentationMetric } from "../../render/postprocessing/FocusAssistPass";
import { getSceneById, getSceneFocusDistanceRange, sceneOrder } from "../../scenes/definitions";
import {
  MACRO_OBLIQUE_PLANE_FOCUS_DISTANCE_RANGE_MM,
  MACRO_OBLIQUE_PLANE_FOCAL_LENGTH_MM,
  MACRO_OBLIQUE_PLANE_INITIAL_FOCUS_DISTANCE_MM,
  MACRO_OBLIQUE_PLANE_PUBLIC_CALIBRATION,
  MACRO_OBLIQUE_PLANE_SURFACE_SLOPE,
  macroObliquePlaneFocusTargets,
} from "../../scenes/macroObliquePlaneGeometry";
import { macroObliquePlaneScene } from "../../scenes/definitions/macro-oblique-plane";
import type { ApertureValue, CameraState } from "../../types/camera";
import { DEFAULT_CAMERA_STATE } from "../../utils/constants";

const cameraAt = (
  focusDistanceMm: number,
  frontTiltDeg = 0,
  aperture: ApertureValue = 5.6,
): CameraState => ({
  ...DEFAULT_CAMERA_STATE,
  ...macroObliquePlaneScene.cameraPreset,
  activeSceneId: macroObliquePlaneScene.id,
  mode: "free",
  activeTaskId: null,
  focusDistanceMm,
  frontTiltDeg,
  frontSwingDeg: 0,
  aperture,
  focusMode: "finite",
});

const physicalMetricsAt = (focusDistanceMm: number, frontTiltDeg = 0) => {
  const optics = deriveOpticsState(
    cameraAt(focusDistanceMm, frontTiltDeg),
    macroObliquePlaneScene,
  );
  return {
    optics,
    metrics: optics.focusTargets.map((target) =>
      resolvePhysicalFocusTargetPresentationMetric(target, "patch"),
    ),
  };
};

describe("macro-oblique-plane scene", () => {
  it("is a finite-only 150 mm, f/5.6 foundation with Front Tilt as its only movement", () => {
    expect(getSceneById(macroObliquePlaneScene.id)).toBe(macroObliquePlaneScene);
    expect(sceneOrder).toContain(macroObliquePlaneScene.id);
    expect(macroObliquePlaneScene.cameraPreset).toMatchObject({
      focalLengthMm: MACRO_OBLIQUE_PLANE_FOCAL_LENGTH_MM,
      focusDistanceMm: MACRO_OBLIQUE_PLANE_INITIAL_FOCUS_DISTANCE_MM,
      aperture: 5.6,
      frontRiseMm: 0,
      frontTiltDeg: 0,
      frontSwingDeg: 0,
      rearRiseMm: 0,
      rearShiftMm: 0,
      rearTiltDeg: 0,
      rearSwingDeg: 0,
    });
    expect(getSceneFocusDistanceRange(macroObliquePlaneScene.id, 150)).toEqual(
      MACRO_OBLIQUE_PLANE_FOCUS_DISTANCE_RANGE_MM,
    );
    expect(macroObliquePlaneScene.finiteFocusStrategy).toEqual({
      kind: "rear-standard-thin-lens",
      lensDatum: "baseline-origin",
      focusDistanceReference: "lens-to-focus-plane",
      filmDepthReference: "optical-axis-conjugate",
    });
    expect(macroObliquePlaneScene.movementCapabilities).toEqual({
      available: ["frontTiltDeg"],
      selectionMode: "single",
      defaultMovement: "frontTiltDeg",
    });
    expect(macroObliquePlaneScene.cameraControlPolicy).toEqual({
      aperture: "fixed",
      infinityReset: false,
    });
    expect(macroObliquePlaneScene.macroFocusMetricsCapability).toEqual({ enabled: true });
    expect(macroObliquePlaneScene.focusTargets.map(({ id }) => id)).toEqual([
      "macro-oblique-near",
      "macro-oblique-middle",
      "macro-oblique-far",
    ]);
  });

  it("keeps all focus target patches on one vertical oblique plane", () => {
    for (const target of macroObliquePlaneFocusTargets) {
      const points = [target.worldPosition, ...(target.sampleWorldPositions ?? [])];
      for (const point of points) {
        expect(point.z).toBeCloseTo(
          macroObliquePlaneFocusTargets[1].worldPosition.z +
            MACRO_OBLIQUE_PLANE_SURFACE_SLOPE * point.y,
          10,
        );
      }
    }

    const targetYs = macroObliquePlaneFocusTargets.map(({ worldPosition }) => worldPosition.y);
    expect(targetYs[0]).toBeLessThan(targetYs[1]);
    expect(targetYs[1]).toBeLessThan(targetYs[2]);

    const zByY = new Map<number, Set<number>>();
    const sampledPoints = macroObliquePlaneFocusTargets.flatMap((target) => [
      target.worldPosition,
      ...(target.sampleWorldPositions ?? []),
    ]);
    sampledPoints.forEach((point) => {
      const zValues = zByY.get(point.y) ?? new Set<number>();
      zValues.add(point.z);
      zByY.set(point.y, zValues);
    });
    expect([...zByY.values()].every((zValues) => zValues.size === 1)).toBe(true);
    expect(new Set(sampledPoints.map((point) => point.x)).size).toBeGreaterThan(1);
  });

  it("starts with the middle region sharp while parallel focus leaves both outer regions soft", () => {
    const { optics, metrics } = physicalMetricsAt(400, 0);

    expect(optics.diagnostics.fallbackApplied).toBe(false);
    expect(optics.diagnostics.focusObjectDistanceMm).toBeCloseTo(400, 12);
    expect(optics.diagnostics.imageDistanceMm).toBeCloseTo(240, 12);
    expect(metrics[0].status).toBe("soft");
    expect(metrics[1].status).toBe("sharp");
    expect(metrics[2].status).toBe("soft");
    expect(metrics[1].sharpness).toBeGreaterThan(metrics[0].sharpness);
    expect(metrics[1].sharpness).toBeGreaterThan(metrics[2].sharpness);
  });

  it("makes all three planar regions physically sharp at the reachable public calibration", () => {
    const { optics, metrics } = physicalMetricsAt(
      MACRO_OBLIQUE_PLANE_PUBLIC_CALIBRATION.focusDistanceMm,
      MACRO_OBLIQUE_PLANE_PUBLIC_CALIBRATION.frontTiltDeg,
    );

    expect(optics.diagnostics.fallbackApplied).toBe(false);
    expect(optics.diagnostics.tiltAngleDeg).toBeCloseTo(
      MACRO_OBLIQUE_PLANE_PUBLIC_CALIBRATION.frontTiltDeg,
      12,
    );
    expect(optics.diagnostics.swingAngleDeg).toBe(0);
    expect(optics.focusPlane).not.toBeNull();
    macroObliquePlaneFocusTargets.forEach((target) => {
      [target.worldPosition, ...(target.sampleWorldPositions ?? [])].forEach((point) => {
        expect(pointToPlaneDistance(point, optics.focusPlane!)).toBeLessThan(1e-6);
      });
    });
    expect(metrics).toHaveLength(3);
    metrics.forEach((metric) => {
      expect(metric.equivalentCoCDiameterMm).toEqual(expect.any(Number));
      expect(metric.equivalentCoCDiameterMm).toBeLessThan(0.1);
      expect(metric.sharpness).toBeGreaterThanOrEqual(0.8);
      expect(metric.status).toBe("sharp");
    });
  });

  it("cannot make the whole plane sharp with zero Tilt, and focus still matters after alignment", () => {
    const neutralResults = Array.from(
      { length: (440 - 360) / 10 + 1 },
      (_, index) => physicalMetricsAt(360 + index * 10, 0).metrics,
    );
    const bestNeutralMinimum = Math.max(
      ...neutralResults.map((metrics) => Math.min(...metrics.map(({ sharpness }) => sharpness))),
    );
    expect(bestNeutralMinimum).toBeLessThan(0.8);

    const offset = physicalMetricsAt(
      MACRO_OBLIQUE_PLANE_PUBLIC_CALIBRATION.focusDistanceMm + 20,
      MACRO_OBLIQUE_PLANE_PUBLIC_CALIBRATION.frontTiltDeg,
    ).metrics;
    expect(offset.some(({ sharpness }) => sharpness < 0.8)).toBe(true);
  });

  it("keeps the published calibration on the public tilt and focus lattices", () => {
    expect(
      MACRO_OBLIQUE_PLANE_PUBLIC_CALIBRATION.frontTiltDeg / 0.1,
    ).toBeCloseTo(
      Math.round(MACRO_OBLIQUE_PLANE_PUBLIC_CALIBRATION.frontTiltDeg / 0.1),
      12,
    );
    expect(
      (MACRO_OBLIQUE_PLANE_PUBLIC_CALIBRATION.focusDistanceMm -
        MACRO_OBLIQUE_PLANE_FOCUS_DISTANCE_RANGE_MM.min) /
        10,
    ).toBeCloseTo(
      Math.round(
        (MACRO_OBLIQUE_PLANE_PUBLIC_CALIBRATION.focusDistanceMm -
          MACRO_OBLIQUE_PLANE_FOCUS_DISTANCE_RANGE_MM.min) /
          10,
      ),
      12,
    );
  });
});
