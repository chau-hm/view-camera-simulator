import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import { DEFAULT_CAMERA_STATE } from "../../utils/constants";
import {
  mirrorShiftGeometry,
  mirrorShiftMirrorPlane,
  reflectPointAcrossMirrorPlane,
} from "../../scenes/mirrorShiftGeometry";
import { mirrorShiftScene } from "../../scenes/definitions/mirror-shift";
import {
  createMirrorShiftGroup,
  createMirrorShiftRttGroup,
  createMirrorShiftViewportGroup,
  disposeMirrorShiftGroup,
} from "../../render/MirrorShiftSubjectFactory";
import { isGroundGlassRttScene } from "../../render/groundGlassRttScenes";

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
