import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import { projectWorldPointToFilmPlaneGroundGlass } from "../../render/groundGlassFilmPlaneProjection";
import {
  createInteriorCornerGroup,
  disposeInteriorCornerGroup,
} from "../../render/InteriorCornerSubjectFactory";
import { interiorCornerScene } from "../../scenes/definitions/interior-corner";
import geometry from "../../scenes/interiorCornerGeometry";
import { DEFAULT_CAMERA_STATE } from "../../utils/constants";

const neutralCamera = {
  ...DEFAULT_CAMERA_STATE,
  ...interiorCornerScene.cameraPreset,
  activeSceneId: interiorCornerScene.id,
  activeTaskId: null,
  mode: "free" as const,
};

const collectDisposableSpies = (group: THREE.Group) => {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  group.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    geometries.add(object.geometry);
    const meshMaterials = Array.isArray(object.material) ? object.material : [object.material];
    meshMaterials.forEach((material) => materials.add(material));
  });
  return [
    ...[...geometries].map((resource) => vi.spyOn(resource, "dispose")),
    ...[...materials].map((resource) => vi.spyOn(resource, "dispose")),
  ];
};

describe("Interior Corner scene foundation", () => {
  it("defines a free-only neutral scene with level Rise/Swing controls", () => {
    expect(interiorCornerScene).toMatchObject({
      id: "interior-corner",
      name: "Interior Corner — Rise + Swing",
      cameraPreset: {
        frontRiseMm: 0,
        frontTiltDeg: 0,
        frontSwingDeg: 0,
        rearRiseMm: 0,
        rearTiltDeg: 0,
        rearSwingDeg: 0,
        focusDistanceMm: geometry.canonicalFocusDistanceMm,
        aperture: 5.6,
      },
      movementCapabilities: {
        available: ["frontRiseMm", "frontSwingDeg"],
        selectionMode: "multiple",
        defaultMovement: "frontRiseMm",
      },
      cameraControlPolicy: { infinityReset: false },
      showReferenceCamera: false,
    });
    expect(interiorCornerScene.focusTargets.map((target) => target.id)).toEqual([
      "interior-wall-near",
      "interior-wall-middle",
      "interior-wall-far",
    ]);
    expect(interiorCornerScene.focusTargets.map((target) => target.worldPosition.z)).toEqual([
      5800,
      8000,
      10400,
    ]);
    expect(new Set(interiorCornerScene.focusTargets.map((target) => target.worldPosition.x)).size).toBe(1);
    expect(interiorCornerScene.focusDistanceRangeMm).toEqual(geometry.focusDistanceRangeMm);
  });

  it("keeps the camera level while leaving upper architecture cropped at neutral framing", () => {
    const optics = deriveOpticsState(neutralCamera, interiorCornerScene);
    const project = (worldPoint: { x: number; y: number; z: number }) =>
      projectWorldPointToFilmPlaneGroundGlass({
        worldPoint,
        lensCenterWorld: optics.lensCenterWorld,
        filmPlaneCornersWorld: optics.filmPlaneCornersWorld,
      });

    expect(optics.opticalAxis.direction.y).toBeCloseTo(0, 8);
    expect(optics.diagnostics.tiltAngleDeg).toBe(0);
    expect(optics.diagnostics.swingAngleDeg).toBe(0);
    expect(project(geometry.upperArchitectureFocusPoint).visible).toBe(false);
    expect(
      project({ x: 0, y: geometry.room.floorY, z: geometry.canonicalFocusDistanceMm }).visible,
    ).toBe(true);
    expect(geometry.sceneBounds.min.z).toBeLessThan(geometry.focusTargets[0].worldPosition.z);
    expect(geometry.focusTargets[0].worldPosition.z).toBeLessThan(
      geometry.focusTargets[1].worldPosition.z,
    );
    expect(geometry.focusTargets[1].worldPosition.z).toBeLessThan(
      geometry.focusTargets[2].worldPosition.z,
    );
  });

  it("builds one shared room subject with stable wall anchors and explicit disposal", () => {
    const group = createInteriorCornerGroup();

    expect(group.name).toBe("interior-corner-subject");
    expect(group.getObjectByName("interior-corner-floor")).toBeInstanceOf(THREE.Mesh);
    expect(group.getObjectByName("interior-corner-back-wall")).toBeInstanceOf(THREE.Mesh);
    expect(group.getObjectByName("interior-corner-receding-side-wall")).toBeInstanceOf(THREE.Mesh);
    expect(group.getObjectByName("interior-corner-room-corner")).toBeInstanceOf(THREE.Mesh);
    expect(group.getObjectByName("interior-corner-ceiling")).toBeInstanceOf(THREE.Mesh);
    expect(group.getObjectByName("interior-corner-side-cornice")).toBeInstanceOf(THREE.Mesh);
    expect(group.getObjectByName("interior-corner-rear-wall-artwork")).toBeInstanceOf(THREE.Group);

    geometry.focusTargets.forEach((target) => {
      const probe = group.getObjectByName(`interior-corner-focus-${target.id}`);
      expect(probe).toBeInstanceOf(THREE.Object3D);
      expect(probe?.userData.focusTargetId).toBe(target.id);
      expect(probe?.userData.focusProbeWorldMm).toEqual(target.worldPosition);
    });

    const spies = collectDisposableSpies(group);
    disposeInteriorCornerGroup(group);
    spies.forEach((spy) => expect(spy).toHaveBeenCalledTimes(1));
  });
});
