import { describe, expect, it, beforeEach } from "vitest";
import { isGroundGlassRttScene, RTT_SCENES } from "../../render/groundGlassRttScenes";
import {
  createRegisteredRttSubject,
  disposeRegisteredRttSubject,
  getSceneSubjectRegistration,
} from "../../render/sceneSubjectRegistry";
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
import { resolveGroundGlassImageDistanceMm } from "../../render/groundGlassRttScenes";
import {
  CAMERA_MOVEMENT_LATTICE_GEOMETRY_ID,
  createCameraMovementsGroup,
  disposeCameraMovementsGroup,
} from "../../render/CameraMovementsSubjectFactory";
import { CAMERA_MOVEMENT_LATTICE } from "../../scenes/cameraMovementLatticeGeometry";
import cameraMovementsGeometry from "../../scenes/understandingCameraMovementsGeometry";

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

  it.each(["upper", "middle", "lower"] as const)(
    "3D and RTT resolve the identical canonical lattice for the %s target region",
    (targetRegion) => {
      const rttGroup = createRegisteredRttSubject(
        "understanding-camera-movements",
        { targetRegion },
      );
      const interactiveGroup = createCameraMovementsGroup(targetRegion);
      try {
        expect(rttGroup?.userData.targetRegion).toBe(targetRegion);
        expect(rttGroup?.userData.canonicalGeometryId).toBe(
          CAMERA_MOVEMENT_LATTICE_GEOMETRY_ID,
        );
        expect(rttGroup?.userData.canonicalGeometryId).toBe(
          interactiveGroup.userData.canonicalGeometryId,
        );
        expect(rttGroup?.userData.canonicalEdgeIds).toEqual(
          interactiveGroup.userData.canonicalEdgeIds,
        );
        expect(rttGroup?.userData.canonicalEdgeIds).toEqual(
          CAMERA_MOVEMENT_LATTICE.edges.map(({ id }) => id),
        );
      } finally {
        if (rttGroup) {
          disposeRegisteredRttSubject(
            "understanding-camera-movements",
            rttGroup,
          );
        }
        disposeCameraMovementsGroup(interactiveGroup);
      }
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

  it("reports finite configured extrinsics that follow outer rig placement", () => {
    const state = useAppStore.getState().camera;
    const placedState = {
      ...state,
      viewpointAnchor: "high" as const,
      cameraRigPlacement: {
        ...cameraMovementsGeometry.cameraRig.viewpointAnchors.high,
        basePitchDeg: 12,
      },
    };
    const midpoint = deriveOpticsState(state, understandingCameraMovementsScene);
    const placed = deriveOpticsState(
      placedState,
      understandingCameraMovementsScene,
    );
    const midpointCamera = new THREE.PerspectiveCamera();
    const placedCamera = new THREE.PerspectiveCamera();
    const midpointClip = getGroundGlassClipRangeWorld(
      understandingCameraMovementsScene,
      midpoint.lensCenterWorld,
    );
    const placedClip = getGroundGlassClipRangeWorld(
      understandingCameraMovementsScene,
      placed.lensCenterWorld,
    );
    const midpointResult = configureGroundGlassCamera(
      midpointCamera,
      midpoint,
      midpointClip.near,
      midpointClip.far,
    );
    const placedResult = configureGroundGlassCamera(
      placedCamera,
      placed,
      placedClip.near,
      placedClip.far,
    );

    expect(midpointResult.ok).toBe(true);
    expect(placedResult.ok).toBe(true);
    if (midpointResult.ok && placedResult.ok) {
      expect([
        ...placedResult.pose.positionWorld,
        ...placedResult.pose.upWorld,
        ...placedResult.pose.forwardWorld,
      ].every(Number.isFinite)).toBe(true);
      expect(placedResult.pose.positionWorld).not.toEqual(
        midpointResult.pose.positionWorld,
      );
      expect(placedResult.pose.forwardWorld).not.toEqual(
        midpointResult.pose.forwardWorld,
      );
    }
  });

  it("clip range includes the canonical camera-movements subject bounds", () => {
    const s = useAppStore.getState().camera;
    const optics = deriveOpticsState(s, understandingCameraMovementsScene);
    const clip = getGroundGlassClipRangeWorld(understandingCameraMovementsScene, optics.lensCenterWorld);
    const farthestSubjectDepthWorld =
      (understandingCameraMovementsScene.bounds.max.z -
        optics.lensCenterWorld.z) *
      0.001;
    expect(Number.isFinite(clip.far)).toBe(true);
    expect(clip.far).toBeGreaterThan(farthestSubjectDepthWorld);
    expect(clip.near).toBeLessThan(0.1);
  });
});
