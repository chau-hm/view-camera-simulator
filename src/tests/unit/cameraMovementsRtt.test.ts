import { describe, expect, it, beforeEach, vi } from "vitest";
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
import { createGroundGlassDofRenderState } from "../../render/groundGlassDofRenderState";
import {
  bindGroundGlassDofStateToCocMaterial,
  bindGroundGlassDofStateToGatherMaterial,
} from "../../render/groundGlassShaderBindings";
import { CAMERA_CONSTANTS, DEFAULT_CAMERA_STATE } from "../../utils/constants";
import { resolveGroundGlassImageDistanceMm } from "../../render/groundGlassRttScenes";
import {
  CAMERA_MOVEMENT_LATTICE_GEOMETRY_ID,
  createCameraMovementsGroup,
  disposeCameraMovementsGroup,
} from "../../render/CameraMovementsSubjectFactory";
import {
  mountCameraMovementRttSubject,
  unmountCameraMovementRttSubject,
  updateCameraMovementRttSubjectTarget,
} from "../../render/cameraMovementRttSubjectLifecycle";
import { CAMERA_MOVEMENT_BASELINE_RENDER_MODEL } from "../../render/cameraMovementLatticeRenderModel";
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

  it.each(["whole", "upper", "middle", "lower"] as const)(
    "3D and RTT resolve the identical canonical lattice for the %s presentation region",
    (presentationRegion) => {
      const rttGroup = createRegisteredRttSubject(
        "understanding-camera-movements",
        { presentationRegion },
      );
      const interactiveGroup = createCameraMovementsGroup(presentationRegion);
      try {
        expect(rttGroup?.userData.presentationRegion).toBe(presentationRegion);
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
  const createDofStateUniforms = () => ({
    dofMode: { value: 0 },
    lensCenterWorld: { value: new THREE.Vector3() },
    lensPlaneNormal: { value: new THREE.Vector3() },
    lensPlaneBasisX: { value: new THREE.Vector3() },
    lensPlaneBasisY: { value: new THREE.Vector3() },
    filmPlanePoint: { value: new THREE.Vector3() },
    filmPlaneNormal: { value: new THREE.Vector3() },
    filmPlaneBasisX: { value: new THREE.Vector3() },
    filmPlaneBasisY: { value: new THREE.Vector3() },
    focusPlanePoint: { value: new THREE.Vector3() },
    focusPlaneNormal: { value: new THREE.Vector3() },
    nearPlanePoint: { value: new THREE.Vector3() },
    nearPlaneNormal: { value: new THREE.Vector3() },
    farPlanePoint: { value: new THREE.Vector3() },
    farPlaneNormal: { value: new THREE.Vector3() },
    hasFiniteFar: { value: 0 },
    inverseProjectionMatrix: { value: new THREE.Matrix4() },
    cameraMatrixWorld: { value: new THREE.Matrix4() },
    maximumCoCRadiusPx: { value: 0 },
    focalLengthMm: { value: 0 },
    sampledFilmWidthMm: { value: 0 },
    sampledFilmHeightMm: { value: 0 },
    fNumber: { value: 0 },
    imageDistanceMm: { value: 0 },
    renderWidth: { value: 0 },
    renderHeight: { value: 0 },
    circleOfConfusionMm: { value: 0 },
  });

  const createCocMaterial = () => new THREE.ShaderMaterial({
    uniforms: {
      tDepth: { value: null },
      ...createDofStateUniforms(),
    },
  });

  const createGatherMaterial = () => new THREE.ShaderMaterial({
    uniforms: {
      tColor: { value: null },
      tDepth: { value: null },
      tCoC: { value: null },
      gatherLayer: { value: 0 },
      ...createDofStateUniforms(),
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
      const state = createGroundGlassDofRenderState(
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
      const cocMaterial = createCocMaterial();
      const gatherMaterial = createGatherMaterial();
      bindGroundGlassDofStateToCocMaterial(cocMaterial, state);
      bindGroundGlassDofStateToGatherMaterial(gatherMaterial, state);

      const expectedImageDistanceMm =
        (focalLengthMm * focusDistanceMm) /
        (focusDistanceMm - focalLengthMm);
      expect(state.optics.focalLengthMm).toBe(focalLengthMm);
      expect(state.optics.imageDistanceMm).toBeCloseTo(expectedImageDistanceMm, 8);
      expect(state.optics.imageDistanceMm).not.toBe(focalLengthMm);
      expect(cocMaterial.uniforms.focalLengthMm.value).toBe(focalLengthMm);
      expect(gatherMaterial.uniforms.focalLengthMm.value).toBe(focalLengthMm);
      expect(cocMaterial.uniforms.imageDistanceMm.value).toBeCloseTo(
        expectedImageDistanceMm,
        8,
      );
      expect(gatherMaterial.uniforms.imageDistanceMm.value).toBeCloseTo(
        expectedImageDistanceMm,
        8,
      );
      cocMaterial.dispose();
      gatherMaterial.dispose();
    },
  );

  it("uses f=90mm and v=94.24083770mm for the calibrated scene preset", () => {
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
    const state = createGroundGlassDofRenderState(
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
    const cocMaterial = createCocMaterial();
    const gatherMaterial = createGatherMaterial();
    bindGroundGlassDofStateToCocMaterial(cocMaterial, state);
    bindGroundGlassDofStateToGatherMaterial(gatherMaterial, state);

    expect(cocMaterial.uniforms.focalLengthMm.value).toBe(90);
    expect(gatherMaterial.uniforms.focalLengthMm.value).toBe(90);
    expect(cocMaterial.uniforms.imageDistanceMm.value).toBeCloseTo(94.2408377, 8);
    expect(gatherMaterial.uniforms.imageDistanceMm.value).toBeCloseTo(94.2408377, 8);
    expect(cocMaterial.uniforms.imageDistanceMm.value).not.toBe(
      cocMaterial.uniforms.focalLengthMm.value,
    );
    cocMaterial.dispose();
    gatherMaterial.dispose();
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

  it("keeps one RTT subject generation and owned resources across target teaching transitions", () => {
    const scene = new THREE.Scene();
    const mounted = mountCameraMovementRttSubject(
      scene,
      CAMERA_MOVEMENT_BASELINE_RENDER_MODEL,
      "middle",
    );
    const group = mounted.group;
    const generation = mounted.runtimeInfo.generation;
    const resourceKey = group.userData.resourceKey;
    const geometryId = group.userData.canonicalGeometryId;
    const geometryKey = group.userData.canonicalGeometryKey;
    const presentationKey = group.userData.presentationKey;
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    group.traverse((object) => {
      const candidate = object as THREE.Mesh;
      if (candidate.geometry) geometries.add(candidate.geometry);
      const objectMaterials = Array.isArray(candidate.material)
        ? candidate.material
        : candidate.material
          ? [candidate.material]
          : [];
      objectMaterials.forEach((material) => materials.add(material));
    });
    const geometryDisposals = [...geometries].map((geometry) =>
      vi.spyOn(geometry, "dispose"),
    );
    const materialDisposals = [...materials].map((material) =>
      vi.spyOn(material, "dispose"),
    );
    const expectedColourByTargetRegion = {
      upper: CAMERA_MOVEMENT_BASELINE_RENDER_MODEL.presentation.upperRegionColour,
      middle: CAMERA_MOVEMENT_BASELINE_RENDER_MODEL.presentation.middleRegionColour,
      lower: CAMERA_MOVEMENT_BASELINE_RENDER_MODEL.presentation.lowerRegionColour,
      neutral: CAMERA_MOVEMENT_BASELINE_RENDER_MODEL.presentation.inactiveColour,
    } as const;

    (["whole", "upper", "lower", "middle"] as const).forEach((presentationRegion) => {
      updateCameraMovementRttSubjectTarget(
        mounted,
        CAMERA_MOVEMENT_BASELINE_RENDER_MODEL,
        presentationRegion,
      );
      expect(group.userData.presentationRegion).toBe(presentationRegion);
      expect(group.userData.rttMountGeneration).toBe(generation);
      expect(group.userData.canonicalGeometryId).toBe(geometryId);
      expect(group.userData.canonicalGeometryKey).toBe(geometryKey);
      expect(group.userData.presentationKey).toBe(presentationKey);
      expect(group.userData.resourceKey).toBe(resourceKey);
      expect(group.userData.canonicalEdgeCount).toBe(
        CAMERA_MOVEMENT_LATTICE.edges.length,
      );
      group.children
        .filter((child) => child.userData.edgeRole)
        .forEach((child) => {
          const line = child as THREE.LineSegments & {
            material: THREE.Material & { color?: THREE.Color };
          };
          const targetRegion = child.userData.edgeTargetRegion as keyof typeof expectedColourByTargetRegion;
          expect(line.material.color?.getHexString()).toBe(
            expectedColourByTargetRegion[targetRegion].slice(1),
          );
          expect(line.userData.selectedTarget).toBe(
            presentationRegion !== "whole" && targetRegion === presentationRegion,
          );
        });
      geometryDisposals.forEach((spy) => expect(spy).not.toHaveBeenCalled());
      materialDisposals.forEach((spy) => expect(spy).not.toHaveBeenCalled());
    });

    unmountCameraMovementRttSubject(mounted);
    geometryDisposals.forEach((spy) => expect(spy).toHaveBeenCalledTimes(1));
    materialDisposals.forEach((spy) => expect(spy).toHaveBeenCalledTimes(1));
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
      cameraRigPlacement: cameraMovementsGeometry.cameraRig.viewpointAnchors.high,
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
      expect(placedResult.pose.forwardWorld).toEqual(
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
