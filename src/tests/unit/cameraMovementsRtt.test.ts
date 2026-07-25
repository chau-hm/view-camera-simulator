import { describe, expect, it, beforeEach } from "vitest";
import { isGroundGlassRttScene, RTT_SCENES } from "../../render/groundGlassRttScenes";
import { createRegisteredRttSubject, getSceneSubjectRegistration } from "../../render/sceneSubjectRegistry";
import { useAppStore } from "../../state/appStore";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import { understandingCameraMovementsScene } from "../../scenes/definitions/understanding-camera-movements";
import { configureGroundGlassCamera } from "../../render/configureGroundGlassCamera";
import * as THREE from "three";
import { getGroundGlassClipRangeWorld } from "../../render/groundGlassRttScenes";

function setupCamera() {
  useAppStore.getState().initializeSimulatorRoute({
    mode: "free",
    sceneId: "understanding-camera-movements",
  });
}

describe("RTT scene registration", () => {
  it("is registered in RTT_SCENES", () => {
    expect(RTT_SCENES).toContain("understanding-camera-movements");
    expect(isGroundGlassRttScene("understanding-camera-movements")).toBe(true);
  });

  it("RTT subject registry returns a valid subject", () => {
    const reg = getSceneSubjectRegistration("understanding-camera-movements");
    expect(reg).toBeDefined();
    expect(reg?.createRttGroup).toBeDefined();
  });

  it("createRegisteredRttSubject returns a group with cube", () => {
    const group = createRegisteredRttSubject("understanding-camera-movements");
    expect(group).not.toBeNull();
    const cube = group?.getObjectByName("camera-movements-cube");
    expect(cube).not.toBeNull();
  });
});

describe("RTT camera configuration", () => {
  beforeEach(setupCamera);

  it("configures a valid off-axis projection at zero movement", () => {
    const camera = new THREE.PerspectiveCamera();
    const s = useAppStore.getState().camera;
    const optics = deriveOpticsState(s, understandingCameraMovementsScene);
    const clip = getGroundGlassClipRangeWorld(understandingCameraMovementsScene, optics.lensCenterWorld);

    const result = configureGroundGlassCamera(camera, optics, clip.near, clip.far);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.left).toBeLessThan(result.right);
      expect(result.bottom).toBeLessThan(result.top);
      expect(Number.isFinite(result.determinant)).toBe(true);
    }
  });

  it("produces valid projection with rear rise applied", () => {
    useAppStore.getState().setSelectedMovement("rearRiseMm");
    useAppStore.getState().setRearRise(20);
    const s = useAppStore.getState().camera;
    const optics = deriveOpticsState(s, understandingCameraMovementsScene);
    const clip = getGroundGlassClipRangeWorld(understandingCameraMovementsScene, optics.lensCenterWorld);

    const camera = new THREE.PerspectiveCamera();
    const result = configureGroundGlassCamera(camera, optics, clip.near, clip.far);
    expect(result.ok).toBe(true);
  });

  it("clip range includes the cube at ~4000mm", () => {
    const s = useAppStore.getState().camera;
    const optics = deriveOpticsState(s, understandingCameraMovementsScene);
    const clip = getGroundGlassClipRangeWorld(understandingCameraMovementsScene, optics.lensCenterWorld);
    // The cube is at z=4000mm (4m in world units). far should be >= 5m
    expect(clip.far).toBeGreaterThan(4);
    expect(clip.near).toBeLessThan(0.1);
  });
});
