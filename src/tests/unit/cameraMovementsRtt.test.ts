import { describe, expect, it, beforeEach } from "vitest";
import { isGroundGlassRttScene, RTT_SCENES } from "../../render/groundGlassRttScenes";
import { createRegisteredRttSubject, getSceneSubjectRegistration } from "../../render/sceneSubjectRegistry";
import { useAppStore } from "../../state/appStore";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import { understandingCameraMovementsScene } from "../../scenes/definitions/understanding-camera-movements";
import { configureGroundGlassCamera } from "../../render/configureGroundGlassCamera";
import * as THREE from "three";
import { getGroundGlassClipRangeWorld } from "../../render/groundGlassRttScenes";
import {
  applyGroundGlassDofUniformState,
  createGroundGlassDofUniformState,
} from "../../render/createGroundGlassDofUniformState";
import { CAMERA_CONSTANTS, DEFAULT_CAMERA_STATE } from "../../utils/constants";
import { getSubjectLayout } from "../../scenes/understandingCameraMovementsGeometry";

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

  it.each([1, 2, 3] as const)(
    "createRegisteredRttSubject returns the canonical %i-cube group",
    (subjectCount) => {
      const group = createRegisteredRttSubject(
        "understanding-camera-movements",
        { subjectCount },
      );
      expect(group?.userData.subjectCount).toBe(subjectCount);
      getSubjectLayout(subjectCount).cubes.forEach((cube) => {
        expect(group?.getObjectByName(cube.id)).not.toBeNull();
      });
    },
  );
});

describe("Camera Movements RTT focal uniforms", () => {
  const createUniformMaterial = () =>
    new THREE.ShaderMaterial({
      uniforms: {
        dofMode: { value: 0 },
        lensCenterWorld: { value: new THREE.Vector3() },
        focusPlanePoint: { value: new THREE.Vector3() },
        focusPlaneNormal: { value: new THREE.Vector3() },
        nearPlanePoint: { value: new THREE.Vector3() },
        nearPlaneNormal: { value: new THREE.Vector3() },
        farPlanePoint: { value: new THREE.Vector3() },
        farPlaneNormal: { value: new THREE.Vector3() },
        hasFiniteFar: { value: 0 },
        inverseProjectionMatrix: { value: new THREE.Matrix4() },
        cameraMatrixWorld: { value: new THREE.Matrix4() },
        maximumBlurRadiusPx: { value: 0 },
        displayBlurScale: { value: 0 },
        focalLengthMm: { value: 0 },
        filmWidthMm: { value: 0 },
        fNumber: { value: 0 },
        imageDistanceMm: { value: 0 },
        renderWidth: { value: 0 },
        renderHeight: { value: 0 },
      },
    });

  it.each([90, 105, 120, 150])(
    "applies supplied %imm focal length identically to horizontal and vertical passes",
    (focalLengthMm) => {
      const cameraState = {
        ...DEFAULT_CAMERA_STATE,
        ...understandingCameraMovementsScene.cameraPreset,
        focalLengthMm,
        activeSceneId: understandingCameraMovementsScene.id,
      };
      const optics = deriveOpticsState(cameraState, understandingCameraMovementsScene);
      const camera = new THREE.PerspectiveCamera();
      const clip = getGroundGlassClipRangeWorld(
        understandingCameraMovementsScene,
        optics.lensCenterWorld,
      );
      expect(configureGroundGlassCamera(camera, optics, clip.near, clip.far).ok).toBe(true);
      const state = createGroundGlassDofUniformState(
        optics,
        camera,
        focalLengthMm,
        CAMERA_CONSTANTS.filmWidthMm,
        CAMERA_CONSTANTS.filmHeightMm,
        0.1,
        cameraState.aperture,
        500,
        400,
        24,
      );
      const horizontal = createUniformMaterial();
      const vertical = createUniformMaterial();
      applyGroundGlassDofUniformState(horizontal, state);
      applyGroundGlassDofUniformState(vertical, state);

      expect(state.focalLengthMm).toBe(focalLengthMm);
      expect(horizontal.uniforms.focalLengthMm.value).toBe(focalLengthMm);
      expect(vertical.uniforms.focalLengthMm.value).toBe(focalLengthMm);
      horizontal.dispose();
      vertical.dispose();
    },
  );
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
