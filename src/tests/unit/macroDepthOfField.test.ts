import { describe, expect, it } from "vitest";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import { resolvePhysicalFocusTargetPresentationMetric } from "../../render/postprocessing/FocusAssistPass";
import {
  projectSceneFocusTargetsToGroundGlass,
  type GroundGlassPreviewMode,
} from "../../render/groundGlassTargetProjection";
import { quantizeFocusDistributionDisplayUv } from "../../components/simulator/focusDistributionLayout";
import { getSceneById, getSceneFocusDistanceRange, sceneOrder } from "../../scenes/definitions";
import {
  MACRO_DEPTH_FOCUS_DISTANCE_RANGE_MM,
  MACRO_DEPTH_FOCUS_ZONE_SPECS,
  MACRO_DEPTH_INITIAL_FOCUS_DISTANCE_MM,
  macroDepthOfFieldFocusTargets,
} from "../../scenes/macroDepthOfFieldGeometry";
import { macroDepthOfFieldScene } from "../../scenes/definitions/macro-depth-of-field";
import type { ApertureValue, CameraState } from "../../types/camera";
import { DEFAULT_CAMERA_STATE } from "../../utils/constants";

const cameraAt = (
  focusDistanceMm: number,
  aperture: ApertureValue = 5.6,
): CameraState => ({
  ...DEFAULT_CAMERA_STATE,
  ...macroDepthOfFieldScene.cameraPreset,
  activeSceneId: macroDepthOfFieldScene.id,
  mode: "free",
  activeTaskId: null,
  focusDistanceMm,
  aperture,
  focusMode: "finite",
});

const targetById = (id: string) => {
  const target = macroDepthOfFieldFocusTargets.find((candidate) => candidate.id === id);
  if (!target) throw new Error(`Missing Macro Scene 2 target: ${id}`);
  return target;
};

const physicalMetricsAt = (focusDistanceMm: number, aperture: ApertureValue) => {
  const optics = deriveOpticsState(cameraAt(focusDistanceMm, aperture), macroDepthOfFieldScene);
  return new Map(
    optics.focusTargets.map((target) => [
      target.id,
      resolvePhysicalFocusTargetPresentationMetric(target, "patch"),
    ]),
  );
};

describe("macro-depth-of-field scene", () => {
  it("is registered as a finite-only 150 mm macro scene with editable focus and aperture", () => {
    expect(getSceneById(macroDepthOfFieldScene.id)).toBe(macroDepthOfFieldScene);
    expect(sceneOrder).toContain(macroDepthOfFieldScene.id);
    expect(macroDepthOfFieldScene.cameraPreset).toMatchObject({
      focalLengthMm: 150,
      focusDistanceMm: MACRO_DEPTH_INITIAL_FOCUS_DISTANCE_MM,
      aperture: 5.6,
      frontRiseMm: 0,
      frontShiftMm: 0,
      frontTiltDeg: 0,
      frontSwingDeg: 0,
      rearRiseMm: 0,
      rearShiftMm: 0,
      rearTiltDeg: 0,
      rearSwingDeg: 0,
      cameraBodyPitchDeg: 0,
    });
    expect(getSceneFocusDistanceRange(macroDepthOfFieldScene.id, 150)).toEqual(
      MACRO_DEPTH_FOCUS_DISTANCE_RANGE_MM,
    );
    expect(macroDepthOfFieldScene.finiteFocusStrategy).toEqual({
      kind: "rear-standard-thin-lens",
      lensDatum: "baseline-origin",
      focusDistanceReference: "lens-to-focus-plane",
      filmDepthReference: "optical-axis-conjugate",
    });
    expect(macroDepthOfFieldScene.cameraControlPolicy).toEqual({
      movement: "fixed",
      infinityReset: false,
    });
    expect(macroDepthOfFieldScene.movementCapabilities).toBeUndefined();
    expect(macroDepthOfFieldScene.focalLengthCapability).toBeUndefined();
    expect(macroDepthOfFieldScene.focusStandardCapability).toBeUndefined();
    expect(macroDepthOfFieldScene.macroFocusMetricsCapability).toEqual({ enabled: true });
    expect(macroDepthOfFieldScene.focusTargets.map(({ id }) => id)).toEqual([
      "macro-depth-near",
      "macro-depth-middle",
      "macro-depth-far",
    ]);
    expect(macroDepthOfFieldScene.focusTargets).toHaveLength(3);
    expect(MACRO_DEPTH_FOCUS_ZONE_SPECS.map(({ surfaceZMm }) => surfaceZMm)).toEqual([
      390,
      400,
      410,
    ]);
    expect(
      MACRO_DEPTH_FOCUS_ZONE_SPECS.every(
        ({ surfaceZMm }) =>
          surfaceZMm >= MACRO_DEPTH_FOCUS_DISTANCE_RANGE_MM.min &&
          surfaceZMm <= MACRO_DEPTH_FOCUS_DISTANCE_RANGE_MM.max &&
          (surfaceZMm - MACRO_DEPTH_FOCUS_DISTANCE_RANGE_MM.min) % 10 === 0,
      ),
    ).toBe(true);
  });

  it("resolves the nominal middle focus through canonical rear-standard geometry", () => {
    const optics = deriveOpticsState(cameraAt(400), macroDepthOfFieldScene);

    expect(optics.diagnostics.fallbackApplied).toBe(false);
    expect(optics.diagnostics.focusObjectDistanceMm).toBeCloseTo(400, 12);
    expect(optics.diagnostics.imageDistanceMm).toBeCloseTo(240, 12);
    expect(optics.filmCenterWorld.z).toBeCloseTo(-240, 12);
    expect(optics.rearStandardFrame.centerWorld.z).toBeCloseTo(-240, 12);
  });

  it("starts with only the middle physical target sharp at f/5.6", () => {
    const metrics = physicalMetricsAt(400, 5.6);

    expect(metrics.get("macro-depth-middle")?.status).toBe("sharp");
    expect(metrics.get("macro-depth-near")?.status).toBe("soft");
    expect(metrics.get("macro-depth-far")?.status).toBe("soft");
    expect(metrics.get("macro-depth-middle")?.sharpness).toBeGreaterThan(
      metrics.get("macro-depth-near")?.sharpness ?? 1,
    );
    expect(metrics.get("macro-depth-middle")?.sharpness).toBeGreaterThan(
      metrics.get("macro-depth-far")?.sharpness ?? 1,
    );
  });

  it("reduces physical CoC monotonically as the aperture closes", () => {
    const apertures: ApertureValue[] = [5.6, 11, 22, 32];
    for (const targetId of ["macro-depth-near", "macro-depth-far"]) {
      const metrics = apertures.map((aperture) => physicalMetricsAt(400, aperture).get(targetId)!);
      for (let index = 1; index < metrics.length; index += 1) {
        const currentCoC = metrics[index].equivalentCoCDiameterMm;
        const previousCoC = metrics[index - 1].equivalentCoCDiameterMm;
        expect(currentCoC).toEqual(expect.any(Number));
        expect(previousCoC).toEqual(expect.any(Number));
        expect(currentCoC as number).toBeLessThan(previousCoC as number);
        expect(metrics[index].sharpness).toBeGreaterThanOrEqual(metrics[index - 1].sharpness);
      }
      expect(metrics.at(-1)?.sharpness).toBeGreaterThan(metrics[0].sharpness);
    }

    const stoppedDown = [
      ...physicalMetricsAt(400, 32).values(),
    ];
    expect(stoppedDown.some((metric) => metric.status === "soft")).toBe(true);
  });

  it("lets wide-aperture focus select the near, middle, or far depth", () => {
    const nearFocus = physicalMetricsAt(390, 5.6);
    const middleFocus = physicalMetricsAt(400, 5.6);
    const farFocus = physicalMetricsAt(410, 5.6);

    expect(nearFocus.get("macro-depth-near")?.sharpness).toBeGreaterThan(
      nearFocus.get("macro-depth-middle")?.sharpness ?? -1,
    );
    expect(nearFocus.get("macro-depth-near")?.status).toBe("sharp");
    expect(nearFocus.get("macro-depth-middle")?.status).toBe("soft");
    expect(nearFocus.get("macro-depth-far")?.status).toBe("soft");
    expect(middleFocus.get("macro-depth-middle")?.sharpness).toBeGreaterThan(
      middleFocus.get("macro-depth-near")?.sharpness ?? -1,
    );
    expect(middleFocus.get("macro-depth-middle")?.sharpness).toBeGreaterThan(
      middleFocus.get("macro-depth-far")?.sharpness ?? -1,
    );
    expect(farFocus.get("macro-depth-far")?.sharpness).toBeGreaterThan(
      farFocus.get("macro-depth-middle")?.sharpness ?? -1,
    );
    expect(farFocus.get("macro-depth-far")?.status).toBe("sharp");
    expect(farFocus.get("macro-depth-near")?.status).toBe("soft");
    expect(farFocus.get("macro-depth-middle")?.status).toBe("soft");
  });

  it("keeps target geometry samples aligned with their declared depth planes", () => {
    macroDepthOfFieldFocusTargets.forEach((target) => {
      const zone = MACRO_DEPTH_FOCUS_ZONE_SPECS.find((candidate) => candidate.id === target.id)!;
      expect(target.worldPosition.z).toBe(zone.surfaceZMm);
      target.sampleWorldPositions?.forEach((sample) => {
        expect(sample.z).toBe(zone.surfaceZMm);
      });
    });
    expect(targetById("macro-depth-middle").worldPosition).toEqual({ x: 0, y: 5, z: 400 });
  });

  it("projects the three semantic regions through the canonical Ground Glass path", () => {
    const targetIds = [
      "macro-depth-near",
      "macro-depth-middle",
      "macro-depth-far",
    ] as const;
    const expectedColumns: Record<GroundGlassPreviewMode, Record<(typeof targetIds)[number], number>> = {
      upright: {
        "macro-depth-near": 0,
        "macro-depth-middle": 1,
        "macro-depth-far": 2,
      },
      raw: {
        "macro-depth-near": 2,
        "macro-depth-middle": 1,
        "macro-depth-far": 0,
      },
    };

    for (const previewMode of ["upright", "raw"] as const) {
      const camera = cameraAt(400);
      const projected = projectSceneFocusTargetsToGroundGlass({
        sceneDef: macroDepthOfFieldScene,
        opticsState: deriveOpticsState(camera, macroDepthOfFieldScene),
        aperture: camera.aperture,
        previewMode,
      });
      const byId = new Map(projected.map((target) => [target.id, target]));

      expect(projected.map(({ id }) => id)).toEqual(targetIds);
      expect(projected.every(({ visible, displayUv }) =>
        visible &&
        Number.isFinite(displayUv.u) &&
        Number.isFinite(displayUv.v),
      )).toBe(true);
      const expectedHorizontalOrder = previewMode === "upright"
        ? targetIds
        : [...targetIds].reverse();
      expect(
        [...byId.values()]
          .sort((first, second) => first.displayUv.u - second.displayUv.u)
          .map(({ id }) => id),
      ).toEqual(expectedHorizontalOrder);

      for (const targetId of targetIds) {
        const target = byId.get(targetId)!;
        expect(quantizeFocusDistributionDisplayUv(target.displayUv, target.visible)).toMatchObject({
          rowIndex: 1,
          columnIndex: expectedColumns[previewMode][targetId],
        });
      }

      expect(
        new Set(projected.map(({ displayUv }) =>
          `${displayUv.u.toFixed(4)}:${displayUv.v.toFixed(4)}`,
        )).size,
      ).toBe(3);
    }
  });

  it("keeps semantic sharpness and horizontal display placement aligned at each depth station", () => {
    const cases = [
      { focusDistanceMm: 390, sharpTargetId: "macro-depth-near", expectedUprightColumn: 0 },
      { focusDistanceMm: 400, sharpTargetId: "macro-depth-middle", expectedUprightColumn: 1 },
      { focusDistanceMm: 410, sharpTargetId: "macro-depth-far", expectedUprightColumn: 2 },
    ] as const;

    for (const { focusDistanceMm, sharpTargetId, expectedUprightColumn } of cases) {
      const metrics = physicalMetricsAt(focusDistanceMm, 5.6);
      expect(metrics.get(sharpTargetId)?.status).toBe("sharp");

      const camera = cameraAt(focusDistanceMm);
      const optics = deriveOpticsState(camera, macroDepthOfFieldScene);
      const upright = projectSceneFocusTargetsToGroundGlass({
        sceneDef: macroDepthOfFieldScene,
        opticsState: optics,
        aperture: camera.aperture,
        previewMode: "upright",
      });
      const raw = projectSceneFocusTargetsToGroundGlass({
        sceneDef: macroDepthOfFieldScene,
        opticsState: optics,
        aperture: camera.aperture,
        previewMode: "raw",
      });
      const uprightTarget = upright.find(({ id }) => id === sharpTargetId)!;
      const rawTarget = raw.find(({ id }) => id === sharpTargetId)!;
      expect(quantizeFocusDistributionDisplayUv(uprightTarget.displayUv, uprightTarget.visible)).toMatchObject({
        rowIndex: 1,
        columnIndex: expectedUprightColumn,
      });
      expect(quantizeFocusDistributionDisplayUv(rawTarget.displayUv, rawTarget.visible)).toMatchObject({
        rowIndex: 1,
        columnIndex: 2 - expectedUprightColumn,
      });
    }
  });
});
