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
import { resolveGroundGlassImageDistanceMm } from "../../render/groundGlassRttScenes";

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
    "applies supplied %imm focal and finite-focus image distance to both shader passes",
    (focalLengthMm) => {
      const focusDistanceMm =
        understandingCameraMovementsScene.cameraPreset.focusDistanceMm;
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

      const expectedImageDistanceMm =
        (focalLengthMm * focusDistanceMm) /
        (focusDistanceMm - focalLengthMm);
      expect(state.focalLengthMm).toBe(focalLengthMm);
      expect(state.imageDistanceMm).toBeCloseTo(expectedImageDistanceMm, 8);
      expect(state.imageDistanceMm).not.toBe(focalLengthMm);
      expect(horizontal.uniforms.focalLengthMm.value).toBe(focalLengthMm);
      expect(vertical.uniforms.focalLengthMm.value).toBe(focalLengthMm);
      expect(horizontal.uniforms.imageDistanceMm.value).toBeCloseTo(
        expectedImageDistanceMm,
        8,
      );
      expect(vertical.uniforms.imageDistanceMm.value).toBeCloseTo(
        expectedImageDistanceMm,
        8,
      );
      horizontal.dispose();
      vertical.dispose();
    },
  );

  it("uses f=105mm and v=110.81794195mm for the corrected scene preset", () => {
    const cameraState = {
      ...DEFAULT_CAMERA_STATE,
      ...understandingCameraMovementsScene.cameraPreset,
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
      cameraState.focalLengthMm,
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

    expect(horizontal.uniforms.focalLengthMm.value).toBe(105);
    expect(vertical.uniforms.focalLengthMm.value).toBe(105);
    expect(horizontal.uniforms.imageDistanceMm.value).toBeCloseTo(110.81794195, 8);
    expect(vertical.uniforms.imageDistanceMm.value).toBeCloseTo(110.81794195, 8);
    expect(horizontal.uniforms.imageDistanceMm.value).not.toBe(
      horizontal.uniforms.focalLengthMm.value,
    );
    horizontal.dispose();
    vertical.dispose();
  });

  it("keeps RTT image distance invariant under rigid camera body pitch", () => {
    const baseState = {
      ...DEFAULT_CAMERA_STATE,
      ...understandingCameraMovementsScene.cameraPreset,
      cameraBodyPitchDeg: 0,
      activeSceneId: understandingCameraMovementsScene.id,
    };
    const base = deriveOpticsState(baseState, understandingCameraMovementsScene);
    const pitched = deriveOpticsState(
      { ...baseState, cameraBodyPitchDeg: 8 },
      understandingCameraMovementsScene,
    );

    expect(resolveGroundGlassImageDistanceMm(pitched)).toBeCloseTo(
      resolveGroundGlassImageDistanceMm(base),
      8,
    );
    expect(Math.abs(pitched.filmPlane.point.z - pitched.lensCenterWorld.z)).not.toBeCloseTo(
      resolveGroundGlassImageDistanceMm(pitched),
      4,
    );
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

  it("reports finite configured extrinsics that follow camera body pitch", () => {
    const state = useAppStore.getState().camera;
    const zero = deriveOpticsState(
      { ...state, cameraBodyPitchDeg: 0 },
      understandingCameraMovementsScene,
    );
    const pitched = deriveOpticsState(
      { ...state, cameraBodyPitchDeg: 8 },
      understandingCameraMovementsScene,
    );
    const zeroCamera = new THREE.PerspectiveCamera();
    const pitchedCamera = new THREE.PerspectiveCamera();
    const zeroClip = getGroundGlassClipRangeWorld(
      understandingCameraMovementsScene,
      zero.lensCenterWorld,
    );
    const pitchedClip = getGroundGlassClipRangeWorld(
      understandingCameraMovementsScene,
      pitched.lensCenterWorld,
    );
    const zeroResult = configureGroundGlassCamera(
      zeroCamera,
      zero,
      zeroClip.near,
      zeroClip.far,
    );
    const pitchedResult = configureGroundGlassCamera(
      pitchedCamera,
      pitched,
      pitchedClip.near,
      pitchedClip.far,
    );

    expect(zeroResult.ok).toBe(true);
    expect(pitchedResult.ok).toBe(true);
    if (zeroResult.ok && pitchedResult.ok) {
      expect([
        ...pitchedResult.pose.positionWorld,
        ...pitchedResult.pose.upWorld,
        ...pitchedResult.pose.forwardWorld,
      ].every(Number.isFinite)).toBe(true);
      expect(pitchedResult.pose.positionWorld).not.toEqual(zeroResult.pose.positionWorld);
      expect(pitchedResult.pose.forwardWorld).not.toEqual(zeroResult.pose.forwardWorld);
    }
  });

  it("clip range includes the canonical camera-movements subject bounds", () => {
    const s = useAppStore.getState().camera;
    const optics = deriveOpticsState(s, understandingCameraMovementsScene);
    const clip = getGroundGlassClipRangeWorld(understandingCameraMovementsScene, optics.lensCenterWorld);
    // Scene bounds extend past the 2 m cube plane to keep overlays visible.
    expect(clip.far).toBeGreaterThan(4);
    expect(clip.near).toBeLessThan(0.1);
  });
});
