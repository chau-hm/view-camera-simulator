import { afterEach, describe, expect, it } from "vitest";
import { useAppStore } from "../../state/appStore";
import {
  CAMERA_MOVEMENT_PUBLIC_TEACHING_CASES,
  buildCameraMovementTeachingCasePatch,
  formatCameraMovementPublicReadout,
  matchCameraMovementTeachingCase,
  CAMERA_MOVEMENT_CASE_MATCH_TOLERANCE,
} from "../../scenes/cameraMovementPublicTeaching";
import { CAMERA_MOVEMENT_PROVISIONAL_TEACHING_MOVEMENTS } from "../../scenes/cameraMovementTeachingCases";
import type { CameraState } from "../../types/camera";

const tilt = CAMERA_MOVEMENT_PROVISIONAL_TEACHING_MOVEMENTS.tiltDeg;
const rise = CAMERA_MOVEMENT_PROVISIONAL_TEACHING_MOVEMENTS.riseMm;
const pitch = CAMERA_MOVEMENT_PROVISIONAL_TEACHING_MOVEMENTS.bodyPitchDeg;

const neutralCamera = (): Pick<
  CameraState,
  | "frontRiseMm" | "rearRiseMm" | "frontTiltDeg" | "rearTiltDeg"
  | "frontSwingDeg" | "cameraBodyPitchDeg"
> => ({
  frontRiseMm: 0, rearRiseMm: 0, frontTiltDeg: 0, rearTiltDeg: 0,
  frontSwingDeg: 0, cameraBodyPitchDeg: 0,
});

afterEach(() => {
  useAppStore.getState().resetCamera();
});

describe("camera movement public teaching matcher", () => {
  it("matches neutral identity placement", () => {
    const id = matchCameraMovementTeachingCase({ anchor: "mid", targetRegion: "middle", camera: neutralCamera() });
    expect(id).toBe("neutral");
  });

  it("matches A/B by their respective tilt only", () => {
    expect(matchCameraMovementTeachingCase({ anchor: "mid", targetRegion: "middle", camera: { ...neutralCamera(), frontTiltDeg: tilt } })).toBe("A-front-tilt");
    expect(matchCameraMovementTeachingCase({ anchor: "mid", targetRegion: "middle", camera: { ...neutralCamera(), rearTiltDeg: tilt } })).toBe("B-rear-tilt");
  });

  it("matches C1/C2 positive rise and D1/D2 negative fall", () => {
    expect(matchCameraMovementTeachingCase({ anchor: "mid", targetRegion: "middle", camera: { ...neutralCamera(), frontRiseMm: rise } })).toBe("C1-front-rise");
    expect(matchCameraMovementTeachingCase({ anchor: "mid", targetRegion: "middle", camera: { ...neutralCamera(), rearRiseMm: rise } })).toBe("C2-rear-rise");
    expect(matchCameraMovementTeachingCase({ anchor: "mid", targetRegion: "middle", camera: { ...neutralCamera(), frontRiseMm: -rise } })).toBe("D1-front-fall");
    expect(matchCameraMovementTeachingCase({ anchor: "mid", targetRegion: "middle", camera: { ...neutralCamera(), rearRiseMm: -rise } })).toBe("D2-rear-fall");
  });

  it("matches C3/D3 high/low anchor, target region, and opposite body pitch", () => {
    expect(matchCameraMovementTeachingCase({ anchor: "high", targetRegion: "upper", camera: { ...neutralCamera(), cameraBodyPitchDeg: pitch } })).toBe("C3-high-viewpoint");
    expect(matchCameraMovementTeachingCase({ anchor: "low", targetRegion: "lower", camera: { ...neutralCamera(), cameraBodyPitchDeg: -pitch } })).toBe("D3-low-viewpoint");
  });

  it("returns null for custom states and stale movement residue", () => {
    expect(matchCameraMovementTeachingCase({ anchor: "mid", targetRegion: "middle", camera: { ...neutralCamera(), frontTiltDeg: 3.3 } })).toBeNull();
    // stale rear tilt after selecting A must not match
    expect(matchCameraMovementTeachingCase({ anchor: "mid", targetRegion: "middle", camera: { ...neutralCamera(), frontTiltDeg: tilt, rearTiltDeg: 2 } })).toBeNull();
    expect(matchCameraMovementTeachingCase({ anchor: "high", targetRegion: "upper", camera: { ...neutralCamera(), cameraBodyPitchDeg: pitch, frontRiseMm: 5 } })).toBeNull();
  });

  it("uses a tight documented tolerance that absorbs fp noise but not user drift", () => {
    const near = { ...neutralCamera(), frontRiseMm: rise + rise * CAMERA_MOVEMENT_CASE_MATCH_TOLERANCE / 10 };
    expect(matchCameraMovementTeachingCase({ anchor: "mid", targetRegion: "middle", camera: near })).toBe("C1-front-rise");
    const drifted = { ...neutralCamera(), frontRiseMm: rise + 1 };
    expect(matchCameraMovementTeachingCase({ anchor: "mid", targetRegion: "middle", camera: drifted })).toBeNull();
  });
});

describe("camera movement public teaching patch builder", () => {
  it("builds an atomic canonical patch for every case without reproducing raw numbers in consumers", () => {
    const ids = Object.keys(CAMERA_MOVEMENT_PUBLIC_TEACHING_CASES) as Array<keyof typeof CAMERA_MOVEMENT_PUBLIC_TEACHING_CASES>;
    for (const id of ids) {
      const patch = buildCameraMovementTeachingCasePatch(id);
      expect(patch.camera.viewpointAnchor).toBe(CAMERA_MOVEMENT_PUBLIC_TEACHING_CASES[id].anchor);
      expect(patch.targetRegion).toBe(CAMERA_MOVEMENT_PUBLIC_TEACHING_CASES[id].targetRegion);
      expect(patch.camera.frontRiseMm).toBe(CAMERA_MOVEMENT_PUBLIC_TEACHING_CASES[id].camera.frontRiseMm);
      expect(patch.camera.rearRiseMm).toBe(CAMERA_MOVEMENT_PUBLIC_TEACHING_CASES[id].camera.rearRiseMm);
      expect(patch.camera.frontTiltDeg).toBe(CAMERA_MOVEMENT_PUBLIC_TEACHING_CASES[id].camera.frontTiltDeg);
      expect(patch.camera.rearTiltDeg).toBe(CAMERA_MOVEMENT_PUBLIC_TEACHING_CASES[id].camera.rearTiltDeg);
      expect(patch.camera.frontSwingDeg).toBe(CAMERA_MOVEMENT_PUBLIC_TEACHING_CASES[id].camera.frontSwingDeg);
      expect(patch.camera.cameraBodyPitchDeg).toBe(CAMERA_MOVEMENT_PUBLIC_TEACHING_CASES[id].camera.cameraBodyPitchDeg);
    }
  });

  it("applies negative fall without widening global rise ranges", () => {
    const d1 = buildCameraMovementTeachingCasePatch("D1-front-fall");
    expect(d1.camera.frontRiseMm).toBeLessThan(0);
    expect(d1.camera.rearRiseMm).toBe(0);
    const d2 = buildCameraMovementTeachingCasePatch("D2-rear-fall");
    expect(d2.camera.rearRiseMm).toBeLessThan(0);
    expect(d2.camera.frontRiseMm).toBe(0);
  });

  it("sequential patches clear every previous movement", () => {
    const c3 = buildCameraMovementTeachingCasePatch("C3-high-viewpoint");
    expect(c3.camera.rearTiltDeg).toBe(0);
    expect(c3.camera.viewpointAnchor).toBe("high");
    const d1 = buildCameraMovementTeachingCasePatch("D1-front-fall");
    expect(d1.camera.rearRiseMm).toBe(0);
    expect(d1.camera.cameraBodyPitchDeg).toBe(0);
    expect(d1.camera.viewpointAnchor).toBe("mid");
    const neutral = buildCameraMovementTeachingCasePatch("neutral");
    expect(neutral.camera.frontRiseMm).toBe(0);
    expect(neutral.camera.rearRiseMm).toBe(0);
    expect(neutral.camera.frontTiltDeg).toBe(0);
    expect(neutral.camera.rearTiltDeg).toBe(0);
    expect(neutral.camera.frontSwingDeg).toBe(0);
    expect(neutral.camera.cameraBodyPitchDeg).toBe(0);
    expect(neutral.camera.viewpointAnchor).toBe("mid");
    expect(neutral.targetRegion).toBe("middle");
  });
});

describe("camera movement public readout formatting", () => {
  it("identifies front versus rear and rise versus fall without hard-coded values", () => {
    expect(formatCameraMovementPublicReadout("A-front-tilt").label).toContain("A · Front tilt");
    expect(formatCameraMovementPublicReadout("B-rear-tilt").label).toContain("B · Rear tilt");
    expect(formatCameraMovementPublicReadout("C1-front-rise").label).toContain("C1 · Front rise");
    expect(formatCameraMovementPublicReadout("C2-rear-rise").label).toContain("C2 · Rear rise");
    expect(formatCameraMovementPublicReadout("D1-front-fall").label).toContain("D1 · Front fall");
    expect(formatCameraMovementPublicReadout("D1-front-fall").label).toContain("fall");
    expect(formatCameraMovementPublicReadout("D2-rear-fall").label).toContain("D2 · Rear fall");
    expect(formatCameraMovementPublicReadout("D2-rear-fall").label).toContain("fall");
    expect(formatCameraMovementPublicReadout("C3-high-viewpoint").label).toContain("Body pitch +");
    expect(formatCameraMovementPublicReadout("D3-low-viewpoint").label).toContain("Body pitch −");
    expect(formatCameraMovementPublicReadout("neutral").label).toContain("Neutral · No movement");
  });

  it("does not display C2/D2 as front rise zero", () => {
    const c2 = formatCameraMovementPublicReadout("C2-rear-rise");
    expect(c2.label).not.toContain("Front rise");
    const d2 = formatCameraMovementPublicReadout("D2-rear-fall");
    expect(d2.label).not.toContain("Front rise");
  });
});

describe("camera movement public teaching store action", () => {
  it("neutral is selected on public route entry", () => {
    const store = useAppStore.getState();
    store.initializeSimulatorRoute({ mode: "free", sceneId: "understanding-camera-movements" });
    const state = useAppStore.getState();
    expect(matchCameraMovementTeachingCase({ anchor: state.camera.viewpointAnchor, targetRegion: state.scene.targetRegion, camera: state.camera })).toBe("neutral");
  });

  it("applies each case exactly and stays selected after rerender", () => {
    const store = useAppStore.getState();
    store.initializeSimulatorRoute({ mode: "free", sceneId: "understanding-camera-movements" });
    const cases = [
      "A-front-tilt", "B-rear-tilt", "C1-front-rise", "C2-rear-rise",
      "C3-high-viewpoint", "D1-front-fall", "D2-rear-fall", "D3-low-viewpoint",
    ] as const;
    for (const id of cases) {
      useAppStore.getState().applyCameraMovementTeachingCase(id);
      const state = useAppStore.getState();
      expect(state.camera.frontRiseMm).toBe(CAMERA_MOVEMENT_PUBLIC_TEACHING_CASES[id].camera.frontRiseMm);
      expect(state.camera.rearRiseMm).toBe(CAMERA_MOVEMENT_PUBLIC_TEACHING_CASES[id].camera.rearRiseMm);
      expect(state.camera.frontTiltDeg).toBe(CAMERA_MOVEMENT_PUBLIC_TEACHING_CASES[id].camera.frontTiltDeg);
      expect(state.camera.rearTiltDeg).toBe(CAMERA_MOVEMENT_PUBLIC_TEACHING_CASES[id].camera.rearTiltDeg);
      expect(state.camera.cameraBodyPitchDeg).toBe(CAMERA_MOVEMENT_PUBLIC_TEACHING_CASES[id].camera.cameraBodyPitchDeg);
      expect(state.camera.viewpointAnchor).toBe(CAMERA_MOVEMENT_PUBLIC_TEACHING_CASES[id].anchor);
      expect(state.scene.targetRegion).toBe(CAMERA_MOVEMENT_PUBLIC_TEACHING_CASES[id].targetRegion);
      expect(matchCameraMovementTeachingCase({ anchor: state.camera.viewpointAnchor, targetRegion: state.scene.targetRegion, camera: state.camera })).toBe(id);
    }
  });

  it("is a no-op on other scenes and when calibration is active", () => {
    const store = useAppStore.getState();
    store.initializeSimulatorRoute({ mode: "free", sceneId: "architecture-rise" });
    useAppStore.getState().applyCameraMovementTeachingCase("C3-high-viewpoint");
    expect(useAppStore.getState().camera.viewpointAnchor).toBe("mid");

    useAppStore.getState().initializeSimulatorRoute({ mode: "free", sceneId: "understanding-camera-movements", calibrationEnabled: true });
    useAppStore.getState().applyCameraMovementTeachingCase("C3-high-viewpoint");
    expect(useAppStore.getState().camera.viewpointAnchor).toBe("mid");
    expect(useAppStore.getState().cameraMovementCalibrationSession.active).toBe(true);
  });

  it("applies one completed case transition atomically (no intermediate mixed states)", () => {
    const store = useAppStore.getState();
    store.initializeSimulatorRoute({ mode: "free", sceneId: "understanding-camera-movements" });

    // Set a previous case so a transition is observable.
    useAppStore.getState().applyCameraMovementTeachingCase("B-rear-tilt");
    expect(matchCameraMovementTeachingCase({
      anchor: useAppStore.getState().camera.viewpointAnchor,
      targetRegion: useAppStore.getState().scene.targetRegion,
      camera: useAppStore.getState().camera,
    })).toBe("B-rear-tilt");

    // Subscribers observe the post-transition state only; they never see a
    // mixed state with stale rear tilt plus C1's front rise.
    const observed: Array<{ frontRiseMm: number; rearTiltDeg: number }> = [];
    const unsubscribe = useAppStore.subscribe((state) => {
      observed.push({ frontRiseMm: state.camera.frontRiseMm, rearTiltDeg: state.camera.rearTiltDeg });
    });

    useAppStore.getState().applyCameraMovementTeachingCase("C1-front-rise");

    const finalState = useAppStore.getState();
    const expected = CAMERA_MOVEMENT_PUBLIC_TEACHING_CASES["C1-front-rise"].camera;
    expect(finalState.camera.frontRiseMm).toBe(expected.frontRiseMm);
    expect(finalState.camera.rearTiltDeg).toBe(0);
    expect(finalState.camera.rearRiseMm).toBe(0);

    // Every observed snapshot must already reflect the completed C1 state:
    // no snapshot may carry stale rear tilt while front rise is mid-apply.
    for (const snap of observed) {
      expect(snap.rearTiltDeg).toBe(0);
      expect(snap.frontRiseMm).toBe(expected.frontRiseMm);
    }
    unsubscribe();
  });

  it("preserves focal length, focus distance, and aperture", () => {
    const store = useAppStore.getState();
    store.initializeSimulatorRoute({ mode: "free", sceneId: "understanding-camera-movements" });
    const before = useAppStore.getState().camera;
    useAppStore.getState().applyCameraMovementTeachingCase("C3-high-viewpoint");
    const after = useAppStore.getState().camera;
    expect(after.focalLengthMm).toBe(before.focalLengthMm);
    expect(after.focusDistanceMm).toBe(before.focusDistanceMm);
    expect(after.aperture).toBe(before.aperture);
  });
});
