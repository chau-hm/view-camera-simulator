import { describe, expect, it } from "vitest";
import { computeOpticalSectionData } from "../../components/geometry/opticalSectionProjection";
import { getGeometryPresentationProfile } from "../../components/geometry/geometryPresentationProfiles";
import { distance, magnitude } from "../../core/math/vec";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import {
  CAMERA_MOVEMENT_CALIBRATION_SEARCH_SPACE,
  CAMERA_MOVEMENT_PROVISIONAL_TEACHING_MOVEMENTS,
  CAMERA_MOVEMENT_SELECTED_PHYSICAL_CALIBRATION,
  CAMERA_MOVEMENT_SELECTED_TEACHING_CALIBRATION,
  CAMERA_MOVEMENT_TEACHING_CASE_IDS,
  createCameraMovementTeachingCases,
  evaluateCameraMovementTeachingCalibrationCandidate,
  getCameraMovementTeachingCase,
} from "../../scenes/cameraMovementTeachingCalibration";
import { resolveCameraRigViewpointAnchor } from "../../scenes/cameraRigViewpointGeometry";
import { understandingCameraMovementsScene } from "../../scenes/definitions/understanding-camera-movements";
import { CAMERA_MOVEMENT_SCENE_CALIBRATION } from "../../scenes/cameraMovementSceneCalibration";
import geometry from "../../scenes/understandingCameraMovementsGeometry";
import type { CameraMovementTeachingCase } from "../../scenes/cameraMovementTeachingCalibration";
import type { CameraState } from "../../types/camera";
import { DEFAULT_CAMERA_STATE } from "../../utils/constants";

const selected = CAMERA_MOVEMENT_SELECTED_TEACHING_CALIBRATION;
const evaluation = evaluateCameraMovementTeachingCalibrationCandidate(selected);
const teachingCases = createCameraMovementTeachingCases(selected);
const presentationProfile = getGeometryPresentationProfile(
  understandingCameraMovementsScene,
);

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
        distanceMm: 2000,
      },
      focalLengthMm: 90,
      arcAngleDeg: 20,
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
    expect(CAMERA_MOVEMENT_SCENE_CALIBRATION.subject).toMatchObject({
      columns: selected.subject.columns,
      rows: selected.subject.rows,
      levels: selected.subject.levels,
      cubeSizeMm: selected.subject.cubeSizeMm,
      horizontalGapMm: selected.subject.horizontalGapMm,
      verticalGapMm: selected.subject.verticalGapMm,
      originWorld: { x: 0, y: 0, z: selected.subject.distanceMm },
    });
    expect(CAMERA_MOVEMENT_SCENE_CALIBRATION.optics).toMatchObject({
      provisionalFocalLengthMm: selected.focalLengthMm,
      provisionalFocusDistanceMm: selected.subject.distanceMm,
    });
    expect(CAMERA_MOVEMENT_SCENE_CALIBRATION.cameraRig).toMatchObject({
      arcCenterWorld: CAMERA_MOVEMENT_SCENE_CALIBRATION.subject.originWorld,
      arcRadiusMm: selected.subject.distanceMm,
      highArcAngleDeg: selected.arcAngleDeg,
      lowArcAngleDeg: -selected.arcAngleDeg,
      provisionalBasePitchDeg: 0,
    });
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
        distanceMm: [1800, 2000, 2400, 3000],
      },
      focalLengthMm: [90, 105, 120, 150],
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
      expect(metrics.identity.geometryId).toBe(
        evaluation.effectiveCalibration.subjectGeometryKey,
      );
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
    expect(d1.targetDeltaFromNeutralUv.v).toBeCloseTo(
      -c1.targetDeltaFromNeutralUv.v,
      12,
    );
    expect(c2.targetDeltaFromNeutralUv.v).toBeGreaterThan(0.19);
    expect(d2.targetDeltaFromNeutralUv.v).toBeCloseTo(
      -c2.targetDeltaFromNeutralUv.v,
      12,
    );
    for (const id of [
      "C1-front-rise",
      "C2-rear-rise",
      "D1-front-fall",
      "D2-rear-fall",
    ] as const) {
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

  it("keeps opposite rear tilt finite and signed without changing the lens standard", () => {
    const positive = deriveOpticsState(
      cameraForTeachingCase(teachingCases["B-rear-tilt"]),
      understandingCameraMovementsScene,
    );
    const negative = deriveOpticsState(
      cameraForTeachingCase(teachingCases["B-rear-tilt"], { rearTiltDeg: -5 }),
      understandingCameraMovementsScene,
    );
    const neutral = deriveOpticsState(
      cameraForTeachingCase(teachingCases.neutral),
      understandingCameraMovementsScene,
    );

    expect(positive.diagnostics.fallbackApplied).toBe(false);
    expect(negative.diagnostics.fallbackApplied).toBe(false);
    expect(positive.lensNormalWorld).toEqual(neutral.lensNormalWorld);
    expect(negative.lensNormalWorld).toEqual(neutral.lensNormalWorld);
    expect(positive.filmNormalWorld.y).toBeCloseTo(-negative.filmNormalWorld.y, 12);
    expect(positive.filmNormalWorld.z).toBeCloseTo(negative.filmNormalWorld.z, 12);
    expect(positive.focusPlane?.normal).not.toEqual(negative.focusPlane?.normal);
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

    expect(distance(high.lensCenterWorld, high.filmCenterWorld)).toBeCloseTo(
      neutralLensFilm,
      12,
    );
    expect(distance(low.lensCenterWorld, low.filmCenterWorld)).toBeCloseTo(
      neutralLensFilm,
      12,
    );
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
        subject: { ...selected.subject, distanceMm: 100 },
      }),
    ).toThrow("Invalid camera-movement teaching calibration candidate");
  });
});
