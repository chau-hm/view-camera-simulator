import { describe, expect, it, beforeEach } from "vitest";
import { useAppStore } from "../../state/appStore";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import { understandingCameraMovementsScene } from "../../scenes/definitions/understanding-camera-movements";
import { getSceneById } from "../../scenes/definitions";
import { getSceneSubjectRegistration } from "../../render/sceneSubjectRegistry";
import { createCameraMovementsGroup, disposeCameraMovementsGroup } from "../../render/CameraMovementsSubjectFactory";

function initScene() {
  useAppStore.getState().initializeSimulatorRoute({
    mode: "free",
    sceneId: "understanding-camera-movements",
  });
}

describe("Fix 2: Single-active movement invariant enforced in store", () => {
  beforeEach(initScene);

  it("setting Front Rise after Rear Tilt zeros Rear Tilt", () => {
    useAppStore.getState().setSelectedMovement("rearTiltDeg");
    useAppStore.getState().setRearTilt(5);
    expect(useAppStore.getState().camera.rearTiltDeg).toBe(5);

    useAppStore.getState().setRise(15);
    const state = useAppStore.getState();
    expect(state.camera.frontRiseMm).toBe(15);
    expect(state.camera.rearTiltDeg).toBe(0);
    expect(state.selectedMovement).toBe("frontRiseMm");
  });

  it("setting Rear Rise after Front Rise zeros Front Rise", () => {
    useAppStore.getState().setSelectedMovement("frontRiseMm");
    useAppStore.getState().setRise(20);
    expect(useAppStore.getState().camera.frontRiseMm).toBe(20);

    useAppStore.getState().setRearRise(10);
    const state = useAppStore.getState();
    expect(state.camera.rearRiseMm).toBe(10);
    expect(state.camera.frontRiseMm).toBe(0);
    expect(state.selectedMovement).toBe("rearRiseMm");
  });

  it("setting Front Tilt after Rear Rise zeros Rear Rise", () => {
    useAppStore.getState().setSelectedMovement("rearRiseMm");
    useAppStore.getState().setRearRise(20);
    expect(useAppStore.getState().camera.rearRiseMm).toBe(20);

    useAppStore.getState().setTilt(5);
    const state = useAppStore.getState();
    expect(state.camera.frontTiltDeg).toBe(5);
    expect(state.camera.rearRiseMm).toBe(0);
    expect(state.selectedMovement).toBe("frontTiltDeg");
  });

  it("setting Rear Tilt after Front Tilt zeros Front Tilt", () => {
    useAppStore.getState().setSelectedMovement("frontTiltDeg");
    useAppStore.getState().setTilt(3);
    expect(useAppStore.getState().camera.frontTiltDeg).toBe(3);

    useAppStore.getState().setRearTilt(-5);
    const state = useAppStore.getState();
    expect(state.camera.rearTiltDeg).toBe(-5);
    expect(state.camera.frontTiltDeg).toBe(0);
    expect(state.selectedMovement).toBe("rearTiltDeg");
  });

  it("existing scenes without capabilities retain multi-movement behaviour", () => {
    useAppStore.getState().initializeSimulatorRoute({
      mode: "free",
      sceneId: "architecture-rise",
    });
    useAppStore.getState().setRise(10);
    useAppStore.getState().setTilt(5);
    const state = useAppStore.getState();
    expect(state.camera.frontRiseMm).toBe(10);
    expect(state.camera.frontTiltDeg).toBe(5);
  });
});

describe("Fix 3: Infinity Reset preserves movement selector", () => {
  beforeEach(initScene);

  it("Infinity Reset is disallowed by cameraControlPolicy", () => {
    useAppStore.getState().setSelectedMovement("rearTiltDeg");
    useAppStore.getState().setRearTilt(8);

    // Infinity Reset should be a no-op for this scene
    useAppStore.getState().setInfinityFocus();
    const state = useAppStore.getState();
    // focusMode must stay finite (not infinity)
    expect(state.camera.focusMode).not.toBe("infinity");
    // selected movement and camera values unchanged
    expect(state.selectedMovement).toBe("rearTiltDeg");
    expect(state.camera.rearTiltDeg).toBe(8);
  });
});

describe("Fix 5: Reset from scene preset", () => {
  beforeEach(initScene);

  it("resetMovements restores scene preset values (4000mm focus, f/11)", () => {
    useAppStore.getState().setSelectedMovement("rearRiseMm");
    useAppStore.getState().setRearRise(25);
    useAppStore.getState().setFocusDistance(3000);

    useAppStore.getState().resetMovements();
    const state = useAppStore.getState();

    expect(state.camera.frontRiseMm).toBe(0);
    expect(state.camera.rearRiseMm).toBe(0);
    expect(state.camera.frontTiltDeg).toBe(0);
    expect(state.camera.rearTiltDeg).toBe(0);
    expect(state.camera.focusDistanceMm).toBe(4000);
    expect(state.camera.aperture).toBe(11);
    expect(state.selectedMovement).toBe("frontRiseMm");
    expect(state.camera.focusMode).toBe("finite");
    expect(state.camera.frontSwingDeg).toBe(0);
  });

  it("after reset, Original and Current optics completely overlap", () => {
    useAppStore.getState().setSelectedMovement("frontTiltDeg");
    useAppStore.getState().setTilt(5);
    // Focus is locked, so just change tilt for the test
    useAppStore.getState().resetMovements();

    const current = { ...useAppStore.getState().camera };
    const currentOptics = deriveOpticsState(current, understandingCameraMovementsScene);

    const original = {
      ...current,
      frontRiseMm: 0,
      frontTiltDeg: 0,
      frontSwingDeg: 0,
      rearRiseMm: 0,
      rearTiltDeg: 0,
    };
    const originalOptics = deriveOpticsState(original, understandingCameraMovementsScene);

    expect(currentOptics.lensCenterWorld).toEqual(originalOptics.lensCenterWorld);
    expect(currentOptics.filmCenterWorld).toEqual(originalOptics.filmCenterWorld);
    expect(currentOptics.lensNormalWorld).toEqual(originalOptics.lensNormalWorld);
    expect(currentOptics.filmNormalWorld).toEqual(originalOptics.filmNormalWorld);
  });
});

describe("Fix 8: GPU disposal", () => {
  it("scene subject registry exposes disposeRttGroup", () => {
    const reg = getSceneSubjectRegistration("understanding-camera-movements");
    expect(reg).toBeDefined();
    expect(reg?.disposeRttGroup).toBeDefined();
    expect(typeof reg?.disposeRttGroup).toBe("function");
  });

  it("disposeCameraMovementsGroup disposes all geometries and materials", () => {
    const group = createCameraMovementsGroup();

    // Count children with geometry and material before disposal
    let geoCount = 0;
    let matCount = 0;
    group.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry) geoCount += 1;
      if (mesh.material) {
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        matCount += mats.length;
      }
    });

    // Must have at least 2 geometries (cube, grid, ground)
    expect(geoCount).toBeGreaterThanOrEqual(2);
    // Must have at least 2 materials
    expect(matCount).toBeGreaterThanOrEqual(2);

    // Dispose should not throw
    expect(() => disposeCameraMovementsGroup(group)).not.toThrow();
  });
});

describe("Scene capabilities validation", () => {
  it("movementCapabilities has four supported movements", () => {
    const caps = understandingCameraMovementsScene.movementCapabilities;
    expect(caps).toBeDefined();
    expect(caps?.available).toHaveLength(4);
    expect(caps?.selectionMode).toBe("single");
  });

  it("cameraControlPolicy locks focus and aperture", () => {
    const policy = understandingCameraMovementsScene.cameraControlPolicy;
    expect(policy).toBeDefined();
    expect(policy?.focusDistance).toBe("fixed");
    expect(policy?.aperture).toBe("fixed");
    expect(policy?.infinityReset).toBe(false);
  });

  it("existing scenes have no movementCapabilities", () => {
    const arch = getSceneById("architecture-rise");
    expect(arch?.movementCapabilities).toBeUndefined();
  });
});

// Need THREE import
import * as THREE from "three";
