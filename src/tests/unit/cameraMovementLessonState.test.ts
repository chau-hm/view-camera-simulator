import { beforeEach, describe, expect, it } from "vitest";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import { distance, magnitude } from "../../core/math/vec";
import { selectDerivedOpticsState } from "../../state/selectors";
import { useAppStore } from "../../state/appStore";
import type { CameraMovementLessonState } from "../../types/camera";
import type { CameraRigPlacement } from "../../types/optics";
import {
  CAMERA_MOVEMENT_SCENE_CALIBRATION,
} from "../../scenes/cameraMovementSceneCalibration";
import {
  CAMERA_MOVEMENT_PUBLIC_TEACHING_CASES,
} from "../../scenes/cameraMovementPublicTeaching";
import { resolveCameraMovementGroundGlassComparison } from "../../scenes/cameraMovementGroundGlassComparison";
import {
  CAMERA_MOVEMENT_PROVISIONAL_TEACHING_MOVEMENTS,
  DEFAULT_CAMERA_MOVEMENT_LESSON_STATE,
  normalizeCameraMovementLessonState,
  resolveCameraMovementLessonPresentationTargetRegion,
  resolveCameraMovementLessonState,
} from "../../scenes/cameraMovementLessonState";
import {
  resolveCameraRigViewpointAnchor,
  resolveCameraRigViewpointPlacementAtT,
} from "../../scenes/cameraRigViewpointGeometry";
import { understandingCameraMovementsScene } from "../../scenes/definitions/understanding-camera-movements";

const calibration = CAMERA_MOVEMENT_SCENE_CALIBRATION.cameraRig;

const arcAngle = (placement: CameraRigPlacement): number => {
  if (placement.kind !== "arc-anchor") throw new Error("expected calibrated arc placement");
  return placement.arcAngleDeg;
};

const expectVecClose = (
  actual: { x: number; y: number; z: number },
  expected: { x: number; y: number; z: number },
): void => {
  expect(actual.x).toBeCloseTo(expected.x, 10);
  expect(actual.y).toBeCloseTo(expected.y, 10);
  expect(actual.z).toBeCloseTo(expected.z, 10);
};

const allFiniteNumbers = (value: unknown): boolean => {
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(allFiniteNumbers);
  if (value !== null && typeof value === "object") {
    return Object.values(value).every(allFiniteNumbers);
  }
  return true;
};

const cameraForDerivedState = (
  derived: ReturnType<typeof resolveCameraMovementLessonState>,
  canonical: boolean,
) => {
  const base = useAppStore.getState().camera;
  return {
    ...base,
    frontRiseMm: derived.frontRiseMm,
    frontTiltDeg: derived.frontTiltDeg,
    frontSwingDeg: derived.frontSwingDeg,
    rearRiseMm: derived.rearRiseMm,
    rearTiltDeg: derived.rearTiltDeg,
    cameraBodyPitchDeg: derived.cameraBodyPitchDeg,
    viewpointAnchor: derived.viewpointAnchor,
    cameraRigPlacement: derived.cameraRigPlacement,
    cameraMovementLessonState: canonical ? derived.lessonState : undefined,
  };
};

describe("continuous camera-movement lesson state", () => {
  beforeEach(() => {
    useAppStore.getState().resetCamera();
    useAppStore.getState().initializeSimulatorRoute({
      mode: "free",
      sceneId: "understanding-camera-movements",
    });
  });

  it("normalizes the continuous ranges and clears inactive study dimensions", () => {
    expect(
      normalizeCameraMovementLessonState({
        study: "tilt",
        viewpointT: 3,
        activeStandard: "rear",
        tiltDeg: 999,
        framingT: -3,
      }),
    ).toEqual({
      study: "tilt",
      viewpointT: 0,
      activeStandard: "rear",
      tiltDeg: 10,
      framingT: 0,
    });
  });

  it("maps the legacy teaching cases through the continuous contract", () => {
    expect(CAMERA_MOVEMENT_PUBLIC_TEACHING_CASES.neutral.lessonState).toEqual(
      DEFAULT_CAMERA_MOVEMENT_LESSON_STATE,
    );
    expect(CAMERA_MOVEMENT_PUBLIC_TEACHING_CASES["A-front-tilt"].lessonState).toMatchObject({
      study: "tilt",
      activeStandard: "front",
      tiltDeg: CAMERA_MOVEMENT_PROVISIONAL_TEACHING_MOVEMENTS.tiltDeg,
    });
    expect(CAMERA_MOVEMENT_PUBLIC_TEACHING_CASES["B-rear-tilt"].lessonState).toMatchObject({
      study: "tilt",
      activeStandard: "rear",
    });
    expect(CAMERA_MOVEMENT_PUBLIC_TEACHING_CASES["C1-front-rise"].lessonState).toMatchObject({
      study: "vertical-framing",
      activeStandard: "front",
      framingT: 1,
    });
    expect(CAMERA_MOVEMENT_PUBLIC_TEACHING_CASES["D2-rear-fall"].lessonState).toMatchObject({
      study: "vertical-framing",
      activeStandard: "rear",
      framingT: -1,
    });
    expect(CAMERA_MOVEMENT_PUBLIC_TEACHING_CASES["C3-high-viewpoint"].lessonState).toMatchObject({
      study: "viewpoint",
      viewpointT: 1,
    });
    expect(CAMERA_MOVEMENT_PUBLIC_TEACHING_CASES["D3-low-viewpoint"].lessonState).toMatchObject({
      study: "viewpoint",
      viewpointT: -1,
    });
  });

  it("interpolates viewpoint placement and body pitch continuously", () => {
    const lower = resolveCameraMovementLessonState(
      { ...DEFAULT_CAMERA_MOVEMENT_LESSON_STATE, viewpointT: -1 },
      calibration,
    );
    const middle = resolveCameraMovementLessonState(
      DEFAULT_CAMERA_MOVEMENT_LESSON_STATE,
      calibration,
    );
    const half = resolveCameraMovementLessonState(
      { ...DEFAULT_CAMERA_MOVEMENT_LESSON_STATE, viewpointT: 0.5 },
      calibration,
    );
    const higher = resolveCameraMovementLessonState(
      { ...DEFAULT_CAMERA_MOVEMENT_LESSON_STATE, viewpointT: 1 },
      calibration,
    );

    expect(lower.cameraBodyPitchDeg).toBe(-CAMERA_MOVEMENT_PROVISIONAL_TEACHING_MOVEMENTS.bodyPitchDeg);
    expect(higher.cameraBodyPitchDeg).toBe(CAMERA_MOVEMENT_PROVISIONAL_TEACHING_MOVEMENTS.bodyPitchDeg);
    expect(half.cameraBodyPitchDeg).toBe(
      CAMERA_MOVEMENT_PROVISIONAL_TEACHING_MOVEMENTS.bodyPitchDeg / 2,
    );
    expect(distance(half.cameraRigPlacement.rigOriginWorld, calibration.arcCenterWorld)).toBeLessThan(
      distance(middle.cameraRigPlacement.rigOriginWorld, calibration.arcCenterWorld),
    );
    expect(arcAngle(half.cameraRigPlacement)).toBeCloseTo(
      arcAngle(higher.cameraRigPlacement) / 2,
      12,
    );
    expect(resolveCameraRigViewpointPlacementAtT(calibration, 0)).toEqual(
      middle.cameraRigPlacement,
    );
  });

  it("matches every legacy public endpoint in resolved physical optics", () => {
    const endpointIds = [
      "neutral",
      "A-front-tilt",
      "B-rear-tilt",
      "C1-front-rise",
      "C2-rear-rise",
      "C3-high-viewpoint",
      "D1-front-fall",
      "D2-rear-fall",
      "D3-low-viewpoint",
    ] as const;

    for (const id of endpointIds) {
      const lessonState = CAMERA_MOVEMENT_PUBLIC_TEACHING_CASES[id].lessonState;
      const resolved = resolveCameraMovementLessonState(lessonState, calibration);
      const canonicalOptics = deriveOpticsState(
        cameraForDerivedState(resolved, true),
        understandingCameraMovementsScene,
      );
      const teachingCase = CAMERA_MOVEMENT_PUBLIC_TEACHING_CASES[id];
      const legacyCamera = {
        ...useAppStore.getState().camera,
        ...teachingCase.camera,
        viewpointAnchor: teachingCase.anchor,
        cameraRigPlacement: resolveCameraRigViewpointAnchor(
          calibration,
          teachingCase.anchor,
        ),
        cameraMovementLessonState: undefined,
      };
      const legacyOptics = deriveOpticsState(
        legacyCamera,
        understandingCameraMovementsScene,
      );

      expectVecClose(canonicalOptics.lensCenterWorld, legacyOptics.lensCenterWorld);
      expectVecClose(canonicalOptics.focusPointWorld, legacyOptics.focusPointWorld);
      expectVecClose(canonicalOptics.opticalAxis.direction, legacyOptics.opticalAxis.direction);
      expect(canonicalOptics.cameraRigTransform.bodyPitchDeg).toBeCloseTo(
        legacyOptics.cameraRigTransform.bodyPitchDeg,
        10,
      );
      expect(canonicalOptics.diagnostics.fallbackApplied).toBe(false);
      expect(legacyOptics.diagnostics.fallbackApplied).toBe(false);
    }
  });

  it("keeps Low/Mid/High continuous at the branch boundary", () => {
    const values = [-1, -0.75, -0.5, -0.25, -0.01, 0, 0.01, 0.25, 0.5, 0.75, 1];
    const resolved = values.map((viewpointT) =>
      resolveCameraMovementLessonState(
        { ...DEFAULT_CAMERA_MOVEMENT_LESSON_STATE, viewpointT },
        calibration,
      ),
    );
    const optics = resolved.map((state) =>
      deriveOpticsState(
        cameraForDerivedState(state, true),
        understandingCameraMovementsScene,
      ),
    );

    optics.forEach((state) => {
      expect(allFiniteNumbers(state)).toBe(true);
      expect(magnitude(state.opticalAxis.direction)).toBeCloseTo(1, 10);
      expect(state.diagnostics.fallbackApplied).toBe(false);
    });

    const heights = optics.map((state) => state.lensCenterWorld.y);
    expect(heights).toEqual([...heights].sort((a, b) => a - b));
    expect(distance(optics[4].lensCenterWorld, optics[5].lensCenterWorld)).toBeLessThan(
      distance(optics[3].lensCenterWorld, optics[5].lensCenterWorld),
    );
    expect(distance(optics[6].lensCenterWorld, optics[5].lensCenterWorld)).toBeLessThan(
      distance(optics[7].lensCenterWorld, optics[5].lensCenterWorld),
    );
    expect(distance(optics[4].focusPointWorld, optics[5].focusPointWorld)).toBeLessThan(
      distance(optics[3].focusPointWorld, optics[5].focusPointWorld),
    );
    expect(distance(optics[6].focusPointWorld, optics[5].focusPointWorld)).toBeLessThan(
      distance(optics[7].focusPointWorld, optics[5].focusPointWorld),
    );
    expect(distance(optics[4].opticalAxis.direction, optics[5].opticalAxis.direction)).toBeLessThan(
      distance(optics[3].opticalAxis.direction, optics[5].opticalAxis.direction),
    );
    expect(distance(optics[6].opticalAxis.direction, optics[5].opticalAxis.direction)).toBeLessThan(
      distance(optics[7].opticalAxis.direction, optics[5].opticalAxis.direction),
    );
    expect(optics[5].cameraRigTransform.bodyPitchDeg).toBe(0);
  });

  it("enforces study and active-standard invariants centrally", () => {
    const cases: Array<[
      CameraMovementLessonState,
      Partial<ReturnType<typeof resolveCameraMovementLessonState>>,
    ]> = [
      [
        { study: "viewpoint", viewpointT: 0.5, activeStandard: "front", tiltDeg: 6, framingT: 0.5 },
        { frontTiltDeg: 0, rearTiltDeg: 0, frontRiseMm: 0, rearRiseMm: 0 },
      ],
      [
        { study: "tilt", viewpointT: 0.5, activeStandard: "front", tiltDeg: 6, framingT: 0.5 },
        { viewpointT: 0, cameraBodyPitchDeg: 0, frontTiltDeg: 6, rearTiltDeg: 0, frontRiseMm: 0, rearRiseMm: 0 },
      ],
      [
        { study: "tilt", viewpointT: -0.5, activeStandard: "rear", tiltDeg: -4, framingT: -0.5 },
        { viewpointT: 0, cameraBodyPitchDeg: 0, frontTiltDeg: 0, rearTiltDeg: -4, frontRiseMm: 0, rearRiseMm: 0 },
      ],
      [
        { study: "vertical-framing", viewpointT: 0.5, activeStandard: "front", tiltDeg: 6, framingT: 0.5 },
        { viewpointT: 0, cameraBodyPitchDeg: 0, frontTiltDeg: 0, rearTiltDeg: 0, frontRiseMm: 10, rearRiseMm: 0 },
      ],
      [
        { study: "vertical-framing", viewpointT: -0.5, activeStandard: "rear", tiltDeg: -4, framingT: -0.5 },
        { viewpointT: 0, cameraBodyPitchDeg: 0, frontTiltDeg: 0, rearTiltDeg: 0, frontRiseMm: 0, rearRiseMm: -10 },
      ],
    ];

    for (const [input, expected] of cases) {
      const resolved = resolveCameraMovementLessonState(input, calibration);
      for (const [field, value] of Object.entries(expected)) {
        expect(resolved[field as keyof typeof resolved]).toBe(value);
      }
      const expectedViewpointT = input.study === "viewpoint" ? input.viewpointT : 0;
      expect(resolved.cameraRigPlacement.rigOriginWorld).toEqual(
        resolveCameraRigViewpointPlacementAtT(calibration, expectedViewpointT).rigOriginWorld,
      );
    }
  });

  it("derives standard movement fields from the active standard", () => {
    const front = resolveCameraMovementLessonState(
      {
        study: "vertical-framing",
        viewpointT: 0,
        activeStandard: "front",
        tiltDeg: 0,
        framingT: 1,
      },
      calibration,
    );
    const rear = resolveCameraMovementLessonState(
      {
        study: "tilt",
        viewpointT: 0,
        activeStandard: "rear",
        tiltDeg: 5,
        framingT: 0,
      },
      calibration,
    );

    expect(front.frontRiseMm).toBe(CAMERA_MOVEMENT_PROVISIONAL_TEACHING_MOVEMENTS.riseMm);
    expect(front.rearRiseMm).toBe(0);
    expect(rear.frontTiltDeg).toBe(0);
    expect(rear.rearTiltDeg).toBe(CAMERA_MOVEMENT_PROVISIONAL_TEACHING_MOVEMENTS.tiltDeg);
  });

  it("keeps viewpoint cases unhighlighted while framing cases select a region", () => {
    expect(
      resolveCameraMovementLessonPresentationTargetRegion(
        CAMERA_MOVEMENT_PUBLIC_TEACHING_CASES["C3-high-viewpoint"].lessonState,
      ),
    ).toBe("middle");
    expect(
      resolveCameraMovementLessonPresentationTargetRegion(
        CAMERA_MOVEMENT_PUBLIC_TEACHING_CASES["D3-low-viewpoint"].lessonState,
      ),
    ).toBe("middle");
    expect(
      resolveCameraMovementLessonPresentationTargetRegion(
        CAMERA_MOVEMENT_PUBLIC_TEACHING_CASES["C1-front-rise"].lessonState,
      ),
    ).toBe("upper");
    expect(
      resolveCameraMovementLessonPresentationTargetRegion(
        CAMERA_MOVEMENT_PUBLIC_TEACHING_CASES["D2-rear-fall"].lessonState,
      ),
    ).toBe("lower");
  });

  it("projects public compatibility cases into canonical store state", () => {
    useAppStore.getState().applyCameraMovementTeachingCase("C3-high-viewpoint");
    let state = useAppStore.getState();
    expect(state.camera.cameraMovementLessonState).toEqual(
      CAMERA_MOVEMENT_PUBLIC_TEACHING_CASES["C3-high-viewpoint"].lessonState,
    );
    expect(selectDerivedOpticsState(state.camera).cameraRigTransform.bodyPitchDeg).toBe(
      CAMERA_MOVEMENT_PROVISIONAL_TEACHING_MOVEMENTS.bodyPitchDeg,
    );

    useAppStore.getState().setCameraMovementLessonState({
      study: "viewpoint",
      viewpointT: -0.5,
      activeStandard: "front",
      tiltDeg: 0,
      framingT: 0,
    } satisfies CameraMovementLessonState);
    state = useAppStore.getState();
    expect(state.camera.cameraMovementLessonState?.viewpointT).toBe(-0.5);
    expect(state.camera.viewpointAnchor).toBe("low");
    expect(state.camera.cameraBodyPitchDeg).toBe(
      -CAMERA_MOVEMENT_PROVISIONAL_TEACHING_MOVEMENTS.bodyPitchDeg / 2,
    );
  });

  it("resets every legacy case and continuous study to the same neutral physical state", () => {
    const neutral = selectDerivedOpticsState(useAppStore.getState().camera);
    const legacyIds = Object.keys(CAMERA_MOVEMENT_PUBLIC_TEACHING_CASES) as Array<
      keyof typeof CAMERA_MOVEMENT_PUBLIC_TEACHING_CASES
    >;

    for (const id of legacyIds) {
      useAppStore.getState().applyCameraMovementTeachingCase(id);
      useAppStore.getState().resetMovements();
      const state = useAppStore.getState();
      const optics = selectDerivedOpticsState(state.camera);
      expect(state.camera.cameraMovementLessonState).toEqual(
        DEFAULT_CAMERA_MOVEMENT_LESSON_STATE,
      );
      expectVecClose(optics.lensCenterWorld, neutral.lensCenterWorld);
      expectVecClose(optics.focusPointWorld, neutral.focusPointWorld);
      expectVecClose(optics.opticalAxis.direction, neutral.opticalAxis.direction);
      expect(optics.cameraRigTransform.bodyPitchDeg).toBe(
        neutral.cameraRigTransform.bodyPitchDeg,
      );
    }

    const studies: CameraMovementLessonState[] = [
      { study: "viewpoint", viewpointT: -0.75, activeStandard: "front", tiltDeg: 0, framingT: 0 },
      { study: "tilt", viewpointT: 0, activeStandard: "rear", tiltDeg: 7, framingT: 0 },
      { study: "vertical-framing", viewpointT: 0, activeStandard: "front", tiltDeg: 0, framingT: -0.75 },
    ];
    for (const lessonState of studies) {
      useAppStore.getState().setCameraMovementLessonState(lessonState);
      useAppStore.getState().resetMovements();
      const optics = selectDerivedOpticsState(useAppStore.getState().camera);
      expectVecClose(optics.lensCenterWorld, neutral.lensCenterWorld);
      expectVecClose(optics.focusPointWorld, neutral.focusPointWorld);
      expectVecClose(optics.opticalAxis.direction, neutral.opticalAxis.direction);
      expect(optics.cameraRigTransform.bodyPitchDeg).toBe(
        neutral.cameraRigTransform.bodyPitchDeg,
      );
    }
  });

  it("propagates canonical case presentation to both Ground Glass layers", () => {
    useAppStore.getState().applyCameraMovementTeachingCase("C3-high-viewpoint");
    let state = useAppStore.getState();
    let comparison = resolveCameraMovementGroundGlassComparison({
      camera: state.camera,
      currentTargetRegion: state.scene.targetRegion,
    });
    expect(comparison.activeTeachingCaseId).toBe("C3-high-viewpoint");
    expect(comparison.presentationTargetRegion).toBe("middle");
    expect(comparison.original.presentationTargetRegion).toBe("middle");
    expect(comparison.current.presentationTargetRegion).toBe("middle");

    useAppStore.getState().applyCameraMovementTeachingCase("C1-front-rise");
    state = useAppStore.getState();
    comparison = resolveCameraMovementGroundGlassComparison({
      camera: state.camera,
      currentTargetRegion: state.scene.targetRegion,
    });
    expect(comparison.activeTeachingCaseId).toBe("C1-front-rise");
    expect(comparison.targetRegion).toBe("middle");
    expect(comparison.presentationTargetRegion).toBe("upper");
    expect(comparison.original.presentationTargetRegion).toBe("upper");
    expect(comparison.current.presentationTargetRegion).toBe("upper");
  });
});
