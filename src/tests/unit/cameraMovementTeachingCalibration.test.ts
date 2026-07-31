import { describe, expect, it } from "vitest";
import { computeOpticalSectionData } from "../../components/geometry/opticalSectionProjection";
import { getGeometryPresentationProfile } from "../../components/geometry/geometryPresentationProfiles";
import { distance, magnitude } from "../../core/math/vec";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import {
  CAMERA_MOVEMENT_CALIBRATION_SEARCH_SPACE,
  CAMERA_MOVEMENT_FOCUS_DISTANCE_SAFE_EPSILON_MM,
  evaluateCameraMovementTeachingCalibrationCandidate,
} from "../../scenes/cameraMovementTeachingCalibration";
import {
  CAMERA_MOVEMENT_PROVISIONAL_TEACHING_MOVEMENTS,
  CAMERA_MOVEMENT_SELECTED_TEACHING_CALIBRATION,
  CAMERA_MOVEMENT_TEACHING_CASE_IDS,
  createCameraMovementTeachingCases,
  getCameraMovementTeachingCase,
} from "../../scenes/cameraMovementTeachingCases";
import { resolveCameraRigViewpointAnchor } from "../../scenes/cameraRigViewpointGeometry";
import { understandingCameraMovementsScene } from "../../scenes/definitions/understanding-camera-movements";
import {
  CAMERA_MOVEMENT_CONVERGENCE_EPSILON,
} from "../../scenes/cameraMovementProjectionDiagnostics";
import {
  CAMERA_MOVEMENT_SCENE_CALIBRATION,
  CAMERA_MOVEMENT_SELECTED_PHYSICAL_CALIBRATION,
} from "../../scenes/cameraMovementSceneCalibration";
import geometry from "../../scenes/understandingCameraMovementsGeometry";
import type { CameraMovementTeachingCase } from "../../scenes/cameraMovementTeachingCases";
import type { CameraState } from "../../types/camera";
import { DEFAULT_CAMERA_STATE } from "../../utils/constants";

const selected = CAMERA_MOVEMENT_SELECTED_TEACHING_CALIBRATION;
const evaluation = evaluateCameraMovementTeachingCalibrationCandidate(selected);
const teachingCases = createCameraMovementTeachingCases(selected);
const presentationProfile = getGeometryPresentationProfile(understandingCameraMovementsScene);

const cameraForTeachingCase = (
  teaching: CameraMovementTeachingCase,
  overrides: Partial<CameraState> = {},
): CameraState => ({
  ...DEFAULT_CAMERA_STATE,
  ...understandingCameraMovementsScene.cameraPreset,
  ...teaching.camera,
  cameraBodyPivotWorld: geometry.cameraBody.pivotRigLocal,
  viewpointAnchor: teaching.anchor,
  cameraRigPlacement: resolveCameraRigViewpointAnchor(
    CAMERA_MOVEMENT_SCENE_CALIBRATION.cameraRig,
    teaching.anchor,
  ),
  activeSceneId: understandingCameraMovementsScene.id,
  activeTaskId: null,
  mode: "free",
  ...overrides,
});

const collectNumbers = (value: unknown, result: number[] = []): number[] => {
  if (typeof value === "number") result.push(value);
  if (Array.isArray(value)) {
    value.forEach((child) => collectNumbers(child, result));
  } else if (value !== null && typeof value === "object") {
    Object.values(value).forEach((child) => collectNumbers(child, result));
  }
  return result;
};

describe("camera-movement teaching calibration", () => {
  it("keeps the selected physical calibration separate from internal teaching movements", () => {
    expect(CAMERA_MOVEMENT_SELECTED_PHYSICAL_CALIBRATION).toEqual({
      subject: {
        columns: 3,
        rows: 3,
        levels: 5,
        cubeSizeMm: 260,
        horizontalGapMm: 0,
        verticalGapMm: 0,
        subjectDistanceMm: 2000,
      },
      optics: {
        focalLengthMm: 90,
        focusDistanceMm: 2000,
      },
      cameraRig: {
        arcRadiusMm: 2000,
        arcAngleDeg: 20,
      },
    });
    expect(CAMERA_MOVEMENT_PROVISIONAL_TEACHING_MOVEMENTS).toEqual({
      tiltDeg: 5,
      riseMm: 20,
      bodyPitchDeg: 6,
    });
    expect(CAMERA_MOVEMENT_SELECTED_PHYSICAL_CALIBRATION).not.toBe(
      CAMERA_MOVEMENT_PROVISIONAL_TEACHING_MOVEMENTS,
    );
    expect(Object.isFrozen(CAMERA_MOVEMENT_SELECTED_PHYSICAL_CALIBRATION)).toBe(true);
    expect(Object.isFrozen(CAMERA_MOVEMENT_PROVISIONAL_TEACHING_MOVEMENTS)).toBe(true);
  });

  it("keeps the production calibration aligned to the selected physical candidate", () => {
    const physical = CAMERA_MOVEMENT_SELECTED_PHYSICAL_CALIBRATION;
    expect(CAMERA_MOVEMENT_SCENE_CALIBRATION.subject).toMatchObject({
      columns: physical.subject.columns,
      rows: physical.subject.rows,
      levels: physical.subject.levels,
      cubeSizeMm: physical.subject.cubeSizeMm,
      horizontalGapMm: physical.subject.horizontalGapMm,
      verticalGapMm: physical.subject.verticalGapMm,
      originWorld: { x: 0, y: 0, z: physical.subject.subjectDistanceMm },
    });
    expect(CAMERA_MOVEMENT_SCENE_CALIBRATION.optics).toMatchObject({
      provisionalFocalLengthMm: physical.optics.focalLengthMm,
      provisionalFocusDistanceMm: physical.optics.focusDistanceMm,
    });
    expect(CAMERA_MOVEMENT_SCENE_CALIBRATION.cameraRig).toMatchObject({
      arcCenterWorld: CAMERA_MOVEMENT_SCENE_CALIBRATION.subject.originWorld,
      arcRadiusMm: physical.cameraRig.arcRadiusMm,
      highArcAngleDeg: physical.cameraRig.arcAngleDeg,
      lowArcAngleDeg: -physical.cameraRig.arcAngleDeg,
      provisionalBasePitchDeg: 0,
    });
    expect(selected).toMatchObject({
      subjectDistanceMm: physical.subject.subjectDistanceMm,
      focusDistanceMm: physical.optics.focusDistanceMm,
      focalLengthMm: physical.optics.focalLengthMm,
      arcRadiusMm: physical.cameraRig.arcRadiusMm,
      arcAngleDeg: physical.cameraRig.arcAngleDeg,
    });
    expect(selected.subject).not.toHaveProperty("subjectDistanceMm");
  });

  it("exposes the bounded one-factor search space including the visibility follow-up", () => {
    expect(CAMERA_MOVEMENT_CALIBRATION_SEARCH_SPACE).toMatchObject({
      subject: {
        columns: [3],
        rows: [3],
        levels: [5],
        cubeSizeMm: [200, 260, 320],
        horizontalGapMm: [0, 50, 100],
        verticalGapMm: [0, 50, 100],
        subjectDistanceMm: [1800, 2000, 2400, 3000],
      },
      focalLengthMm: [90, 105, 120, 150],
      focusDistanceMm: [1800, 2000, 2400, 3000],
      arcRadiusMm: [1800, 2000, 2400, 3000],
      arcAngleDeg: [10, 12, 15, 18, 20],
      tiltDeg: [5, 7.5, 10],
      riseMm: [20, 40, 60, 80, 120, 160],
      bodyPitchDeg: [6, 8, 10, 12],
    });
  });

  it("creates the immutable canonical case set and throws for invalid IDs", () => {
    const cases = createCameraMovementTeachingCases(selected);

    expect(Object.keys(cases)).toEqual(CAMERA_MOVEMENT_TEACHING_CASE_IDS);
    expect(Object.isFrozen(cases)).toBe(true);
    for (const id of CAMERA_MOVEMENT_TEACHING_CASE_IDS) {
      expect(Object.isFrozen(cases[id])).toBe(true);
      expect(Object.isFrozen(cases[id].camera)).toBe(true);
      expect(cases[id].camera.frontSwingDeg).toBe(0);
      expect(getCameraMovementTeachingCase(cases, id)).toBe(cases[id]);
    }
    expect(() => getCameraMovementTeachingCase(cases, "C4")).toThrow(
      "Unknown camera-movement teaching case: C4",
    );
  });

  it("maps neutral, tilt, rise/fall, and viewpoint cases without mixed movements", () => {
    const cases = createCameraMovementTeachingCases(selected);
    expect(cases.neutral).toMatchObject({
      anchor: "mid",
      targetRegion: "middle",
      camera: {
        frontRiseMm: 0,
        rearRiseMm: 0,
        frontTiltDeg: 0,
        rearTiltDeg: 0,
        cameraBodyPitchDeg: 0,
      },
    });
    expect(cases["A-front-tilt"].camera).toMatchObject({
      frontTiltDeg: 5,
      rearTiltDeg: 0,
    });
    expect(cases["B-rear-tilt"].camera).toMatchObject({
      frontTiltDeg: 0,
      rearTiltDeg: 5,
    });
    expect(cases["C1-front-rise"].camera.frontRiseMm).toBe(20);
    expect(cases["D1-front-fall"].camera.frontRiseMm).toBe(-20);
    expect(cases["C2-rear-rise"].camera.rearRiseMm).toBe(20);
    expect(cases["D2-rear-fall"].camera.rearRiseMm).toBe(-20);
    expect(cases["C3-high-viewpoint"]).toMatchObject({
      anchor: "high",
      targetRegion: "upper",
      camera: { cameraBodyPitchDeg: 6 },
    });
    expect(cases["D3-low-viewpoint"]).toMatchObject({
      anchor: "low",
      targetRegion: "lower",
      camera: { cameraBodyPitchDeg: -6 },
    });
  });

  it("returns only finite measured numbers with explicit identity and fallback evidence", () => {
    expect(collectNumbers(evaluation).every(Number.isFinite)).toBe(true);
    expect(Object.isFrozen(evaluation)).toBe(true);
    for (const metrics of Object.values(evaluation.cases)) {
      expect(metrics.fallback).toEqual({ applied: false, reason: null });
      expect(metrics.identity.geometryId).toBe(evaluation.effectiveCalibration.subjectGeometryKey);
      expect(metrics.identity.edgeCount).toBeGreaterThan(0);
      expect(metrics.lensTargetDistanceMm).toBeGreaterThan(0);
      expect(metrics.lensFilmDistanceMm).toBeGreaterThan(selected.focalLengthMm);
      expect(metrics.lensNormalMagnitude).toBeCloseTo(1, 12);
      expect(metrics.filmNormalMagnitude).toBeCloseTo(1, 12);
      expect(metrics.focusNormalMagnitude).toBeCloseTo(1, 12);
      expect(magnitude(metrics.focusNormalWorld)).toBeCloseTo(1, 12);
    }
  });

  it("uses plane geometry—not a fabricated target shift—to distinguish front and rear tilt", () => {
    const front = evaluation.comparisons["A-front-tilt"];
    const rear = evaluation.comparisons["B-rear-tilt"];

    expect(front.targetDisplacementFromNeutralUv).toBeCloseTo(0, 12);
    expect(rear.targetDisplacementFromNeutralUv).toBeCloseTo(0, 12);
    expect(front.lensNormalAngleFromNeutralDeg).toBeCloseTo(5, 12);
    expect(front.filmNormalAngleFromNeutralDeg).toBeCloseTo(0, 12);
    expect(rear.lensNormalAngleFromNeutralDeg).toBeCloseTo(0, 12);
    expect(rear.filmNormalAngleFromNeutralDeg).toBeCloseTo(5, 12);
    expect(front.focusNormalAngleFromNeutralDeg).not.toBeCloseTo(
      rear.focusNormalAngleFromNeutralDeg,
      3,
    );
  });

  it("keeps the smallest clear rise/fall case visible with equal-and-opposite response", () => {
    const c1 = evaluation.comparisons["C1-front-rise"];
    const c2 = evaluation.comparisons["C2-rear-rise"];
    const d1 = evaluation.comparisons["D1-front-fall"];
    const d2 = evaluation.comparisons["D2-rear-fall"];

    expect(c1.targetDeltaFromNeutralUv.v).toBeLessThan(-0.2);
    expect(d1.targetDeltaFromNeutralUv.v).toBeCloseTo(-c1.targetDeltaFromNeutralUv.v, 12);
    expect(c2.targetDeltaFromNeutralUv.v).toBeGreaterThan(0.19);
    expect(d2.targetDeltaFromNeutralUv.v).toBeCloseTo(-c2.targetDeltaFromNeutralUv.v, 12);
    for (const id of ["C1-front-rise", "C2-rear-rise", "D1-front-fall", "D2-rear-fall"] as const) {
      expect(evaluation.cases[id].targetInFrame).toBe(true);
      expect(evaluation.cases[id].statusCode).toBe("partially-off-frame");
      expect(evaluation.cases[id].coverage.projectedBoundsInsideFrame).toBeGreaterThan(0.77);
    }
  });

  it("centres the intended high/low region with signed, opposite pitch convergence", () => {
    const high = evaluation.cases["C3-high-viewpoint"];
    const low = evaluation.cases["D3-low-viewpoint"];

    expect(high.targetInFrame).toBe(true);
    expect(low.targetInFrame).toBe(true);
    expect(high.rigOriginWorld.y).toBeGreaterThan(0);
    expect(low.rigOriginWorld.y).toBeLessThan(0);
    expect(high.convergenceSignal).toBeGreaterThan(0.08);
    expect(low.convergenceSignal).toBeLessThan(-0.08);
    expect(high.targetOffsetFromFilmCentreUv.u).toBeCloseTo(0, 12);
    expect(low.targetOffsetFromFilmCentreUv.u).toBeCloseTo(0, 12);
    expect(Math.abs(high.targetOffsetFromFilmCentreUv.v)).toBeLessThan(0.02);
    expect(Math.abs(low.targetOffsetFromFilmCentreUv.v)).toBeLessThan(0.02);
  });

  it("projects opposite rear tilts with finite, symmetric convergence signs", () => {
    const positive = evaluation.cases["B-rear-tilt"];
    const negative = evaluation.probes.oppositeRearTilt;
    const neutral = evaluation.cases.neutral;

    expect(negative.id).toBe("B-opposite-rear-tilt-probe");
    expect(positive.fallback.applied).toBe(false);
    expect(negative.fallback.applied).toBe(false);
    expect(positive.camera.rearTiltDeg).toBe(selected.tiltDeg);
    expect(negative.camera.rearTiltDeg).toBe(-selected.tiltDeg);
    expect(positive.lensNormalWorld).toEqual(neutral.lensNormalWorld);
    expect(negative.lensNormalWorld).toEqual(neutral.lensNormalWorld);
    expect(positive.filmNormalWorld.y).toBeCloseTo(-negative.filmNormalWorld.y, 12);
    expect(positive.filmNormalWorld.z).toBeCloseTo(negative.filmNormalWorld.z, 12);
    expect(positive.focusNormalWorld.y).toBeCloseTo(-negative.focusNormalWorld.y, 12);
    expect(positive.focusNormalWorld.z).toBeCloseTo(negative.focusNormalWorld.z, 12);
    expect(Math.abs(neutral.convergenceSignal)).toBeLessThanOrEqual(
      CAMERA_MOVEMENT_CONVERGENCE_EPSILON,
    );
    expect(positive.convergenceSignal).toBeGreaterThan(
      CAMERA_MOVEMENT_CONVERGENCE_EPSILON,
    );
    expect(negative.convergenceSignal).toBeLessThan(
      -CAMERA_MOVEMENT_CONVERGENCE_EPSILON,
    );
    expect(Math.abs(positive.convergenceSignal)).toBeCloseTo(
      Math.abs(negative.convergenceSignal),
      12,
    );
    for (const probe of [positive, negative]) {
      expect(probe.targetInFrame).toBe(true);
      expect(probe.statusCode).not.toBe("fully-off-frame");
      expect(probe.coverage.projectedBoundsInsideFrame).toBeGreaterThan(0);
      expect(probe.fallback).toEqual({ applied: false, reason: null });
      expect(collectNumbers(probe).every(Number.isFinite)).toBe(true);
    }
  });

  it("preserves rigid lens-film geometry and the canonical subject across C3/D3", () => {
    const neutral = deriveOpticsState(
      cameraForTeachingCase(teachingCases.neutral),
      understandingCameraMovementsScene,
    );
    const high = deriveOpticsState(
      cameraForTeachingCase(teachingCases["C3-high-viewpoint"]),
      understandingCameraMovementsScene,
    );
    const low = deriveOpticsState(
      cameraForTeachingCase(teachingCases["D3-low-viewpoint"]),
      understandingCameraMovementsScene,
    );
    const neutralLensFilm = distance(neutral.lensCenterWorld, neutral.filmCenterWorld);

    expect(distance(high.lensCenterWorld, high.filmCenterWorld)).toBeCloseTo(neutralLensFilm, 12);
    expect(distance(low.lensCenterWorld, low.filmCenterWorld)).toBeCloseTo(neutralLensFilm, 12);
    expect(evaluation.comparisons["C3-high-viewpoint"].lensNormalAngleFromNeutralDeg).toBeCloseTo(
      selected.bodyPitchDeg,
      12,
    );
    expect(evaluation.comparisons["C3-high-viewpoint"].filmNormalAngleFromNeutralDeg).toBeCloseTo(
      selected.bodyPitchDeg,
      12,
    );
    expect(evaluation.comparisons["D3-low-viewpoint"].lensNormalAngleFromNeutralDeg).toBeCloseTo(
      selected.bodyPitchDeg,
      12,
    );
    expect(evaluation.comparisons["D3-low-viewpoint"].filmNormalAngleFromNeutralDeg).toBeCloseTo(
      selected.bodyPitchDeg,
      12,
    );
    expect(high.lensNormalWorld.y).toBeCloseTo(-low.lensNormalWorld.y, 12);
    expect(high.lensNormalWorld.z).toBeCloseTo(low.lensNormalWorld.z, 12);
    expect(high.filmNormalWorld.y).toBeCloseTo(-low.filmNormalWorld.y, 12);
    expect(high.filmNormalWorld.z).toBeCloseTo(low.filmNormalWorld.z, 12);
    expect(evaluation.cases["C3-high-viewpoint"].camera.cameraBodyPitchDeg).toBe(
      selected.bodyPitchDeg,
    );
    expect(evaluation.cases["D3-low-viewpoint"].camera.cameraBodyPitchDeg).toBe(
      -selected.bodyPitchDeg,
    );
    const highMetrics = evaluation.cases["C3-high-viewpoint"];
    const lowMetrics = evaluation.cases["D3-low-viewpoint"];
    expect(
      distance(
        highMetrics.rigOriginWorld,
        CAMERA_MOVEMENT_SCENE_CALIBRATION.cameraRig.arcCenterWorld,
      ),
    ).toBeCloseTo(selected.arcRadiusMm, 9);
    expect(
      distance(
        lowMetrics.rigOriginWorld,
        CAMERA_MOVEMENT_SCENE_CALIBRATION.cameraRig.arcCenterWorld,
      ),
    ).toBeCloseTo(selected.arcRadiusMm, 9);
    expect(highMetrics.rigOriginWorld.y).toBeCloseTo(-lowMetrics.rigOriginWorld.y, 12);
    expect(highMetrics.rigOriginWorld.z).toBeCloseTo(lowMetrics.rigOriginWorld.z, 12);
    expect(highMetrics.convergenceSignal).toBeGreaterThan(0);
    expect(lowMetrics.convergenceSignal).toBeLessThan(0);
    const convergenceAsymmetry =
      Math.abs(Math.abs(highMetrics.convergenceSignal) - Math.abs(lowMetrics.convergenceSignal)) /
      Math.max(Math.abs(highMetrics.convergenceSignal), Math.abs(lowMetrics.convergenceSignal));
    expect(convergenceAsymmetry).toBeLessThanOrEqual(0.2);
    const coverageAsymmetry =
      Math.abs(
        highMetrics.coverage.projectedBoundsInsideFrame -
          lowMetrics.coverage.projectedBoundsInsideFrame,
      ) /
      Math.max(
        highMetrics.coverage.projectedBoundsInsideFrame,
        lowMetrics.coverage.projectedBoundsInsideFrame,
      );
    expect(coverageAsymmetry).toBeLessThanOrEqual(0.2);
    expect(highMetrics.lensFilmDistanceMm).toBeCloseTo(lowMetrics.lensFilmDistanceMm, 12);
    expect(evaluation.subjectBoundsWorld).toEqual(geometry.subjectBounds);
    expect(evaluation.cases["C3-high-viewpoint"].identity.edgeCount).toBe(
      evaluation.cases["D3-low-viewpoint"].identity.edgeCount,
    );
  });

  it("keeps legacy transform fields and all 2D optical sections finite for every case", () => {
    for (const id of CAMERA_MOVEMENT_TEACHING_CASE_IDS) {
      const optics = deriveOpticsState(
        cameraForTeachingCase(teachingCases[id]),
        understandingCameraMovementsScene,
      );
      const projection = computeOpticalSectionData({
        opticsState: optics,
        scene: understandingCameraMovementsScene,
        svgWidth: 640,
        svgHeight: 360,
        depthWindow: { minMm: -250, maxMm: 3000 },
        lateralWindow: presentationProfile.lateralWindow,
        paddingPx: presentationProfile.diagramPaddingPx,
      });

      expect(optics.diagnostics.fallbackApplied).toBe(false);
      expect(collectNumbers(optics.cameraBodyTransform).every(Number.isFinite)).toBe(true);
      expect(collectNumbers(projection).every(Number.isFinite)).toBe(true);
      for (const view of Object.values(projection.views)) {
        expect(view.planeSegments.length).toBeGreaterThan(0);
        expect(view.physicalPlaneSegments.length).toBeGreaterThan(0);
      }
    }
  });

  it("rejects invalid candidate inputs before returning partial measurements", () => {
    expect(() =>
      evaluateCameraMovementTeachingCalibrationCandidate({
        ...selected,
        tiltDeg: Number.NaN,
      }),
    ).toThrow("tiltDeg must be finite and positive");
    expect(() =>
      evaluateCameraMovementTeachingCalibrationCandidate({
        ...selected,
        subjectDistanceMm: Number.NaN,
      }),
    ).toThrow("subjectDistanceMm must be finite");
    expect(() =>
      evaluateCameraMovementTeachingCalibrationCandidate({
        ...selected,
        focusDistanceMm: selected.focalLengthMm + CAMERA_MOVEMENT_FOCUS_DISTANCE_SAFE_EPSILON_MM,
      }),
    ).toThrow("focusDistanceMm must exceed focalLengthMm");
    expect(() =>
      evaluateCameraMovementTeachingCalibrationCandidate({
        ...selected,
        focusDistanceMm: Number.POSITIVE_INFINITY,
      }),
    ).toThrow("focusDistanceMm must be finite");
  });

  it("keeps subject, focus, focal length, and rig radius independent in evaluation", () => {
    const independent = evaluateCameraMovementTeachingCalibrationCandidate({
      ...selected,
      subjectDistanceMm: 2400,
      focusDistanceMm: 1800,
      focalLengthMm: 105,
      arcRadiusMm: 2100,
    });

    expect(independent.effectiveCalibration.subject.originWorld.z).toBe(2400);
    expect(independent.effectiveCalibration.optics.provisionalFocusDistanceMm).toBe(1800);
    expect(independent.effectiveCalibration.optics.provisionalFocalLengthMm).toBe(105);
    expect(independent.effectiveCalibration.cameraRig.arcRadiusMm).toBe(2100);
    expect(collectNumbers(independent).every(Number.isFinite)).toBe(true);
  });
});
