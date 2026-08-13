import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import { DEFAULT_CAMERA_STATE } from "../../utils/constants";
import {
  mirrorShiftGeometry,
  mirrorShiftMirrorPlane,
  reflectPointAcrossMirrorPlane,
  resolveMirrorShiftCameraAnchors,
} from "../../scenes/mirrorShiftGeometry";
import { mirrorShiftScene } from "../../scenes/definitions/mirror-shift";
import {
  createMirrorShiftGroup,
  createMirrorShiftRttGroup,
  createMirrorShiftViewportGroup,
  disposeMirrorShiftGroup,
  updateMirrorShiftCameraReflection,
} from "../../render/MirrorShiftSubjectFactory";
import { isGroundGlassRttScene } from "../../render/groundGlassRttScenes";
import { projectWorldPointToFilmPlaneGroundGlass } from "../../render/groundGlassFilmPlaneProjection";

const toWorldMm = (millimetres: number): number => millimetres * 0.001;

describe("Mirror Shift planar reflection geometry", () => {
  it("reflects a point across the mirror plane while preserving parallel coordinates", () => {
    const point = { x: 240, y: -360, z: 3000 };
    const reflected = reflectPointAcrossMirrorPlane(point);

    expect(reflected).toEqual({ x: 240, y: -360, z: 5400 });
    expect(Math.abs(point.z - mirrorShiftMirrorPlane.point.z)).toBe(
      Math.abs(reflected.z - mirrorShiftMirrorPlane.point.z),
    );
  });

  it("keeps the plane fixed and derives every reflected prop from its real counterpart", () => {
    expect(
      reflectPointAcrossMirrorPlane(mirrorShiftMirrorPlane.point),
    ).toEqual(mirrorShiftMirrorPlane.point);

    mirrorShiftGeometry.props.forEach((prop, index) => {
      expect(mirrorShiftGeometry.reflectedProps[index].position).toEqual(
        reflectPointAcrossMirrorPlane(prop.position),
      );
    });
  });

  it("keeps the neutral camera state finite and routes the scene through RTT", () => {
    const camera = {
      ...DEFAULT_CAMERA_STATE,
      ...mirrorShiftScene.cameraPreset,
      activeSceneId: mirrorShiftScene.id,
      activeTaskId: null,
      mode: "free" as const,
    };
    const optics = deriveOpticsState(camera, mirrorShiftScene);

    expect(isGroundGlassRttScene(mirrorShiftScene.id)).toBe(true);
    expect(optics.diagnostics.fallbackApplied).toBe(false);
    expect(optics.diagnostics.errorMessage).toBeUndefined();
    expect([
      optics.lensCenterWorld,
      optics.filmCenterWorld,
      optics.opticalAxis.direction,
      optics.filmPlaneCornersWorld.topLeft,
      optics.filmPlaneCornersWorld.bottomRight,
    ].every((value) => Object.values(value).every(Number.isFinite))).toBe(true);
    expect(mirrorShiftScene.cameraPreset.frontRiseMm).toBe(0);
    expect(mirrorShiftScene.cameraPreset.frontTiltDeg).toBe(0);
    expect(mirrorShiftScene.cameraPreset.frontSwingDeg).toBe(0);
    expect(mirrorShiftScene.cameraPreset.rearRiseMm).toBe(0);
    expect(mirrorShiftScene.cameraPreset.rearTiltDeg).toBe(0);
  });

  it("translates the complete canonical rig without changing its orientation or relative geometry", () => {
    const neutralCamera = {
      ...DEFAULT_CAMERA_STATE,
      ...mirrorShiftScene.cameraPreset,
      activeSceneId: mirrorShiftScene.id,
      activeTaskId: null,
      mode: "free" as const,
      mirrorShiftLessonState: { rigLateralMm: 0 },
    };
    const movedCamera = {
      ...neutralCamera,
      mirrorShiftLessonState: { rigLateralMm: 1800 },
    };
    const neutral = deriveOpticsState(neutralCamera, mirrorShiftScene);
    const moved = deriveOpticsState(movedCamera, mirrorShiftScene);

    expect(moved.cameraRigTransform.rigOriginWorld).toEqual({
      x: 1800,
      y: 0,
      z: 0,
    });
    expect(moved.lensCenterWorld.x - neutral.lensCenterWorld.x).toBeCloseTo(1800, 10);
    expect(moved.filmCenterWorld.x - neutral.filmCenterWorld.x).toBeCloseTo(1800, 10);
    expect(moved.rearStandardFrame.centerWorld.x - neutral.rearStandardFrame.centerWorld.x).toBeCloseTo(1800, 10);
    for (const corner of ["topLeft", "topRight", "bottomLeft", "bottomRight"] as const) {
      expect(
        moved.filmPlaneCornersWorld[corner].x - neutral.filmPlaneCornersWorld[corner].x,
      ).toBeCloseTo(1800, 10);
    }
    expect(moved.lensNormalWorld).toEqual(neutral.lensNormalWorld);
    expect(moved.filmNormalWorld).toEqual(neutral.filmNormalWorld);
    expect(moved.opticalAxis.direction).toEqual(neutral.opticalAxis.direction);
    expect(moved.cameraBodyLocalGeometry).toEqual(neutral.cameraBodyLocalGeometry);
  });

  it("mounts reflected props and a camera proxy at the mirrored neutral positions", () => {
    const group = createMirrorShiftGroup();
    try {
      group.updateMatrixWorld(true);
      expect(group.name).toBe("mirror-shift-subject");
      expect(group.getObjectByName("mirror-shift-mirror-surface")).toBeInstanceOf(THREE.Mesh);
      expect(group.getObjectByName("mirror-shift-camera-reflection")).toBeInstanceOf(THREE.Group);

      mirrorShiftGeometry.props.forEach((prop) => {
        const real = group.getObjectByName(`mirror-shift-real-${prop.id}`);
        const reflected = group.getObjectByName(`mirror-shift-reflected-${prop.id}`);
        expect(real).toBeInstanceOf(THREE.Mesh);
        expect(reflected).toBeInstanceOf(THREE.Mesh);

        const realWorld = new THREE.Vector3();
        const reflectedWorld = new THREE.Vector3();
        real!.getWorldPosition(realWorld);
        reflected!.getWorldPosition(reflectedWorld);
        expect(realWorld.x).toBeCloseTo(toWorldMm(prop.position.x), 10);
        expect(reflectedWorld.x).toBeCloseTo(toWorldMm(prop.position.x), 10);
        expect(reflectedWorld.y).toBeCloseTo(toWorldMm(prop.position.y), 10);
        expect(reflectedWorld.z).toBeCloseTo(
          toWorldMm(reflectPointAcrossMirrorPlane(prop.position).z),
          10,
        );
      });

      const cameraReflection = group.getObjectByName("mirror-shift-camera-reflection")!;
      expect(cameraReflection.userData).toEqual({ reflectionOf: "neutral-view-camera" });
      const frontStandard = group.getObjectByName(
        "mirror-shift-camera-reflection-front-standard",
      )!;
      const frontWorld = new THREE.Vector3();
      frontStandard.getWorldPosition(frontWorld);
      expect(frontWorld.z).toBeCloseTo(
        toWorldMm(mirrorShiftGeometry.camera.reflectedAnchors.frontStandardCenter.z),
        10,
      );

      const realDetail = group.getObjectByName("mirror-shift-real-tall-marker-detail-1")!;
      const reflectedDetail = group.getObjectByName(
        "mirror-shift-reflected-tall-marker-detail-1",
      )!;
      const realDetailWorld = new THREE.Vector3();
      const reflectedDetailWorld = new THREE.Vector3();
      realDetail.getWorldPosition(realDetailWorld);
      reflectedDetail.getWorldPosition(reflectedDetailWorld);
      const realDetailMm = {
        x: realDetailWorld.x / 0.001,
        y: realDetailWorld.y / 0.001,
        z: realDetailWorld.z / 0.001,
      };
      const expectedReflectedDetail = reflectPointAcrossMirrorPlane(realDetailMm);

      expect(reflectedDetailWorld.x).toBeCloseTo(toWorldMm(expectedReflectedDetail.x), 10);
      expect(reflectedDetailWorld.y).toBeCloseTo(toWorldMm(expectedReflectedDetail.y), 10);
      expect(reflectedDetailWorld.z).toBeCloseTo(toWorldMm(expectedReflectedDetail.z), 10);
      expect(
        Math.abs(realDetailMm.z - mirrorShiftMirrorPlane.point.z),
      ).toBeCloseTo(
        Math.abs(expectedReflectedDetail.z - mirrorShiftMirrorPlane.point.z),
        10,
      );
    } finally {
      disposeMirrorShiftGroup(group);
    }
  });

  it("derives the reflected camera proxy from translated real anchors and mutates it in place", () => {
    const group = createMirrorShiftRttGroup();
    try {
      const reflectedProps = group.getObjectByName("mirror-shift-reflected-props")!;
      const staticProp = group.getObjectByName("mirror-shift-reflected-tall-marker") as THREE.Mesh;
      const staticGeometry = staticProp.geometry;
      const staticMaterial = staticProp.material;
      const staticPropPosition = staticProp.position.clone();
      const cameraGroup = group.getObjectByName("mirror-shift-camera-reflection")!;
      const frontStandard = group.getObjectByName(
        "mirror-shift-camera-reflection-front-standard",
      )!;
      const rearStandard = group.getObjectByName(
        "mirror-shift-camera-reflection-rear-standard",
      )!;
      const translatedAnchors = resolveMirrorShiftCameraAnchors({
        x: 1800,
        y: 0,
        z: 0,
      });

      expect(updateMirrorShiftCameraReflection(group, { x: 1800, y: 0, z: 0 })).toBe(true);
      group.updateMatrixWorld(true);

      const frontWorld = new THREE.Vector3();
      frontStandard.getWorldPosition(frontWorld);
      expect(frontWorld.x).toBeCloseTo(
        toWorldMm(translatedAnchors.reflected.frontStandardCenter.x),
        10,
      );
      expect(frontWorld.z).toBeCloseTo(
        toWorldMm(translatedAnchors.reflected.frontStandardCenter.z),
        10,
      );

      const rearWorld = new THREE.Vector3();
      rearStandard.getWorldPosition(rearWorld);
      expect(rearWorld.x).toBeCloseTo(
        toWorldMm(translatedAnchors.reflected.rearStandardCenter.x),
        10,
      );
      expect(rearWorld.z).toBeCloseTo(
        toWorldMm(translatedAnchors.reflected.rearStandardCenter.z),
        10,
      );
      expect(cameraGroup).toBe(group.getObjectByName("mirror-shift-camera-reflection"));
      expect(reflectedProps).toBe(group.getObjectByName("mirror-shift-reflected-props"));
      expect(staticProp.geometry).toBe(staticGeometry);
      expect(staticProp.material).toBe(staticMaterial);
      expect(staticProp.position).toEqual(staticPropPosition);
      expect(cameraGroup.userData.reflectedRigOriginWorld).toEqual({
        x: 1800,
        y: 0,
        z: 0,
      });
    } finally {
      disposeMirrorShiftGroup(group);
    }
  });

  it("produces different reflected-prop image displacement for different depths", () => {
    const baseCamera = {
      ...DEFAULT_CAMERA_STATE,
      ...mirrorShiftScene.cameraPreset,
      activeSceneId: mirrorShiftScene.id,
      activeTaskId: null,
      mode: "free" as const,
    };
    const neutral = deriveOpticsState(
      { ...baseCamera, mirrorShiftLessonState: { rigLateralMm: 0 } },
      mirrorShiftScene,
    );
    const moved = deriveOpticsState(
      { ...baseCamera, mirrorShiftLessonState: { rigLateralMm: 1800 } },
      mirrorShiftScene,
    );
    const project = (optics: ReturnType<typeof deriveOpticsState>, propIndex: number) =>
      projectWorldPointToFilmPlaneGroundGlass({
        worldPoint: mirrorShiftGeometry.reflectedProps[propIndex].position,
        lensCenterWorld: optics.lensCenterWorld,
        filmPlaneCornersWorld: optics.filmPlaneCornersWorld,
      });

    const neutralTall = project(neutral, 0);
    const neutralStool = project(neutral, 1);
    const movedTall = project(moved, 0);
    const movedStool = project(moved, 1);
    const neutralSeparation = neutralTall.uRaw - neutralStool.uRaw;
    const movedSeparation = movedTall.uRaw - movedStool.uRaw;

    expect(Math.abs(movedSeparation - neutralSeparation)).toBeGreaterThan(1e-5);
  });

  it("keeps virtual reflection geometry in RTT while keeping the viewport physical-only", () => {
    const viewportGroup = createMirrorShiftViewportGroup();
    const rttGroup = createMirrorShiftRttGroup();
    try {
      expect(viewportGroup.getObjectByName("mirror-shift-mirror-surface")).toBeInstanceOf(THREE.Mesh);
      expect(viewportGroup.getObjectByName("mirror-shift-real-tall-marker")).toBeInstanceOf(THREE.Mesh);
      expect(viewportGroup.getObjectByName("mirror-shift-reflected-props")).toBeUndefined();
      expect(viewportGroup.getObjectByName("mirror-shift-camera-reflection")).toBeUndefined();

      expect(rttGroup.getObjectByName("mirror-shift-reflected-props")).toBeInstanceOf(THREE.Group);
      expect(rttGroup.getObjectByName("mirror-shift-reflected-tall-marker")).toBeInstanceOf(THREE.Mesh);
      expect(rttGroup.getObjectByName("mirror-shift-camera-reflection")).toBeInstanceOf(THREE.Group);
    } finally {
      disposeMirrorShiftGroup(viewportGroup);
      disposeMirrorShiftGroup(rttGroup);
    }
  });

  it("disposes each owned geometry and material once", () => {
    const group = createMirrorShiftGroup();
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    group.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      geometries.add(object.geometry);
      const meshMaterials = Array.isArray(object.material) ? object.material : [object.material];
      meshMaterials.forEach((meshMaterial) => materials.add(meshMaterial));
    });
    const geometrySpies = [...geometries].map((geometry) => vi.spyOn(geometry, "dispose"));
    const materialSpies = [...materials].map((meshMaterial) => vi.spyOn(meshMaterial, "dispose"));

    disposeMirrorShiftGroup(group);

    geometrySpies.forEach((spy) => expect(spy).toHaveBeenCalledTimes(1));
    materialSpies.forEach((spy) => expect(spy).toHaveBeenCalledTimes(1));
  });
});
