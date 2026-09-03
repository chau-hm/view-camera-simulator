import { afterEach, describe, expect, it } from "vitest";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import { getSceneFocusDistanceRange } from "../../scenes/definitions";
import { obliqueTabletopScene } from "../../scenes/definitions/oblique-tabletop";
import obliqueTabletopGeometry from "../../scenes/obliqueTabletopGeometry";
import type { CameraState } from "../../types/camera";
import { ACCEPTABLE_COC_DIAMETER_MM } from "../../core/optics/physicalSharpness";
import { useAppStore } from "../../state/appStore";
import { CAMERA_CONSTANTS, CAMERA_CONTROL_STEPS, DEFAULT_CAMERA_STATE } from "../../utils/constants";

const cameraFor = (overrides: Partial<CameraState> = {}): CameraState => ({
  ...DEFAULT_CAMERA_STATE,
  ...obliqueTabletopScene.cameraPreset,
  activeSceneId: obliqueTabletopScene.id,
  activeTaskId: null,
  mode: "free",
  ...overrides,
});

const evaluate = (frontTiltDeg: number, focusDistanceMm: number) =>
  deriveOpticsState(
    cameraFor({ frontTiltDeg, focusDistanceMm }),
    obliqueTabletopScene,
  );

const targetMap = (frontTiltDeg: number, focusDistanceMm: number) =>
  new Map(
    evaluate(frontTiltDeg, focusDistanceMm).focusTargets.map((target) => [
      target.id,
      target,
    ]),
  );

const physicalCoc = (target: { pointEquivalentCoCDiameterMm?: number | null }): number =>
  target.pointEquivalentCoCDiameterMm ?? Number.POSITIVE_INFINITY;

const physicalCocValues = (
  targets: Map<string, { pointEquivalentCoCDiameterMm?: number | null }>,
  ids: readonly string[],
): number[] => ids.map((id) => physicalCoc(targets.get(id)!));

const spread = (values: number[]): number => Math.max(...values) - Math.min(...values);

const average = (values: number[]): number =>
  values.reduce((sum, value) => sum + value, 0) / values.length;

afterEach(() => {
  useAppStore.getState().resetCamera();
});

describe("Oblique Tabletop Tilt limitation", () => {
  it("exposes Front Tilt and Focus while withholding every other movement", () => {
    expect(obliqueTabletopScene.movementCapabilities).toEqual({
      available: ["frontTiltDeg"],
      selectionMode: "single",
      defaultMovement: "frontTiltDeg",
    });
    expect(obliqueTabletopScene.cameraControlPolicy).toEqual({
      aperture: "fixed",
      infinityReset: false,
    });
    expect(obliqueTabletopScene.cameraPreset.aperture).toBe(11);
    expect(obliqueTabletopScene.cameraPreset.frontSwingDeg).toBe(0);
    expect(obliqueTabletopScene.cameraPreset.frontRiseMm).toBe(0);
    expect(obliqueTabletopScene.cameraPreset.frontShiftMm ?? 0).toBe(0);
    expect(obliqueTabletopScene.cameraPreset.rearRiseMm).toBe(0);
    expect(obliqueTabletopScene.cameraPreset.rearShiftMm).toBe(0);
    expect(obliqueTabletopScene.cameraPreset.rearTiltDeg).toBe(0);
    expect(obliqueTabletopScene.cameraPreset.rearSwingDeg).toBe(0);
  });

  it("keeps the selected Tilt + Focus evidence on public control steps", () => {
    const calibration = obliqueTabletopGeometry.tiltOnlyCalibration;
    const focusRange = getSceneFocusDistanceRange(obliqueTabletopScene.id);
    const tiltStepIndex =
      (calibration.frontTiltDeg - CAMERA_CONSTANTS.tiltMinDeg) /
      CAMERA_CONTROL_STEPS.tiltDeg;
    const focusStepIndex =
      (calibration.focusDistanceMm - focusRange.min) /
      CAMERA_CONTROL_STEPS.focusDistanceMm;

    expect(tiltStepIndex).toBeCloseTo(Math.round(tiltStepIndex), 10);
    expect(focusStepIndex).toBeCloseTo(Math.round(focusStepIndex), 10);
    expect(calibration.frontTiltDeg).toBeGreaterThanOrEqual(CAMERA_CONSTANTS.tiltMinDeg);
    expect(calibration.frontTiltDeg).toBeLessThanOrEqual(CAMERA_CONSTANTS.tiltMaxDeg);
    expect(calibration.focusDistanceMm).toBeGreaterThanOrEqual(focusRange.min);
    expect(calibration.focusDistanceMm).toBeLessThanOrEqual(focusRange.max);
    expect(calibration.aperture).toBe(obliqueTabletopScene.cameraPreset.aperture);
  });

  it("makes the selected public Tilt + Focus state reachable through the scene route", () => {
    const calibration = obliqueTabletopGeometry.tiltOnlyCalibration;
    const store = useAppStore.getState();
    store.clearSimulatorRouteInitialization();
    store.initializeSimulatorRoute({
      mode: "free",
      sceneId: obliqueTabletopScene.id,
    });
    store.setTilt(calibration.frontTiltDeg);
    store.setFocusDistance(calibration.focusDistanceMm);

    const camera = useAppStore.getState().camera;
    expect(useAppStore.getState().selectedMovement).toBe("frontTiltDeg");
    expect(camera.frontTiltDeg).toBe(calibration.frontTiltDeg);
    expect(camera.focusDistanceMm).toBe(calibration.focusDistanceMm);
    expect(camera.frontSwingDeg).toBe(0);
    expect(camera.aperture).toBe(11);
  });

  it("derives non-collinear coverage samples from the canonical tabletop plane", () => {
    const sampleIds = obliqueTabletopGeometry.tabletopSurfaceSamples.map((sample) => sample.id);
    expect(sampleIds).toEqual([
      "near-left",
      "near-centre",
      "near-right",
      "middle",
      "far-left",
      "far-centre",
      "far-right",
    ]);

    obliqueTabletopGeometry.tabletopSurfaceSamples.forEach((sample) => {
      expect(sample.worldPosition).toEqual(
        obliqueTabletopGeometry.tabletopLocalToWorld({
          localX: sample.localPosition.x,
          localDepth: sample.localPosition.z,
        }),
      );
      expect(
        Math.abs(
          obliqueTabletopGeometry.tabletopTopSurfacePlane.normal.x *
              (sample.worldPosition.x - obliqueTabletopGeometry.tabletopTopSurfacePlane.point.x) +
            obliqueTabletopGeometry.tabletopTopSurfacePlane.normal.y *
              (sample.worldPosition.y - obliqueTabletopGeometry.tabletopTopSurfacePlane.point.y) +
            obliqueTabletopGeometry.tabletopTopSurfacePlane.normal.z *
              (sample.worldPosition.z - obliqueTabletopGeometry.tabletopTopSurfacePlane.point.z),
        ),
      ).toBeLessThan(1e-8);
    });

    const nearLeft = obliqueTabletopGeometry.tabletopSurfaceSamples[0].localPosition;
    const nearRight = obliqueTabletopGeometry.tabletopSurfaceSamples[2].localPosition;
    const farLeft = obliqueTabletopGeometry.tabletopSurfaceSamples[4].localPosition;
    expect((nearRight.x - nearLeft.x) * (farLeft.z - nearLeft.z)).not.toBe(0);
  });

  it("keeps the neutral f/11 setup physically inconsistent across the tabletop", () => {
    const neutral = targetMap(
      0,
      obliqueTabletopScene.cameraPreset.focusDistanceMm,
    );
    const axisCoc = physicalCocValues(
      neutral,
      obliqueTabletopGeometry.tabletopPrincipalDepthSampleIds,
    );
    const offAxisCoc = physicalCocValues(
      neutral,
      obliqueTabletopGeometry.tabletopOffAxisSampleIds,
    );

    expect(spread(axisCoc)).toBeGreaterThan(ACCEPTABLE_COC_DIAMETER_MM);
    expect(Math.max(...offAxisCoc)).toBeGreaterThan(ACCEPTABLE_COC_DIAMETER_MM);
    expect(
      evaluate(0, obliqueTabletopScene.cameraPreset.focusDistanceMm).focusTargets.some(
        (target) => target.physicalPointStatus === "soft",
      ),
    ).toBe(true);
  });

  it("uses the correct negative Tilt sign and materially improves one depth axis", () => {
    const neutral = targetMap(
      0,
      obliqueTabletopScene.cameraPreset.focusDistanceMm,
    );
    const tilted = targetMap(
      obliqueTabletopGeometry.tiltOnlyCalibration.frontTiltDeg,
      obliqueTabletopGeometry.tiltOnlyCalibration.focusDistanceMm,
    );
    const neutralAxisCoc = physicalCocValues(
      neutral,
      obliqueTabletopGeometry.tabletopPrincipalDepthSampleIds,
    );
    const tiltedAxisCoc = physicalCocValues(
      tilted,
      obliqueTabletopGeometry.tabletopPrincipalDepthSampleIds,
    );

    expect(obliqueTabletopGeometry.tiltOnlyCalibration.frontTiltDeg).toBeLessThan(0);
    expect(spread(tiltedAxisCoc)).toBeLessThan(spread(neutralAxisCoc) * 0.7);
    expect(Math.max(...tiltedAxisCoc)).toBeLessThan(Math.max(...neutralAxisCoc) * 0.8);
    expect(
      [...tilted.values()].some((target) =>
        (target.physicalPointSharpness ?? 0) >= 0.6,
      ),
    ).toBe(true);
  });

  it("leaves a measurable off-axis disagreement after Tilt + Focus", () => {
    const tilted = targetMap(
      obliqueTabletopGeometry.tiltOnlyCalibration.frontTiltDeg,
      obliqueTabletopGeometry.tiltOnlyCalibration.focusDistanceMm,
    );
    const axisCoc = physicalCocValues(
      tilted,
      obliqueTabletopGeometry.tabletopPrincipalDepthSampleIds,
    );
    const offAxisCoc = physicalCocValues(
      tilted,
      obliqueTabletopGeometry.tabletopOffAxisSampleIds,
    );

    expect(average(offAxisCoc)).toBeGreaterThan(average(axisCoc) * 1.1);
    expect(Math.max(...offAxisCoc)).toBeGreaterThan(Math.max(...axisCoc) * 1.1);
    expect(offAxisCoc.some((coc) => coc > ACCEPTABLE_COC_DIAMETER_MM)).toBe(true);
    expect(
      obliqueTabletopGeometry.tabletopOffAxisSampleIds.some(
        (id) => (tilted.get(id)?.physicalPointSharpness ?? 0) < 0.8,
      ),
    ).toBe(true);
  });
});
