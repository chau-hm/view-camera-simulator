import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import { projectWorldPointToFilmPlaneGroundGlass } from "../../render/groundGlassFilmPlaneProjection";
import {
  createInteriorCornerGroup,
  disposeInteriorCornerGroup,
} from "../../render/InteriorCornerSubjectFactory";
import {
  createRegisteredRttSubject,
  disposeRegisteredRttSubject,
} from "../../render/sceneSubjectRegistry";
import { interiorCornerScene } from "../../scenes/definitions/interior-corner";
import geometry from "../../scenes/interiorCornerGeometry";
import { DEFAULT_CAMERA_STATE } from "../../utils/constants";
import { INTERIOR_CORNER_PRESENTATION } from "../../scenes/presentation/interiorCorner";
import {
  createSceneVariantIdentity,
  resolveSceneVariationDescriptor,
} from "../../scenes/sceneVariation";
import { resolveInteriorCornerMaterialVariationSeeds } from "../../scenes/interiorCornerMaterialVariation";
import type { SceneVariationDescriptor } from "../../types/sceneVariation";

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
  const textures = new Set<THREE.Texture>();
  const textureSlots = [
    "alphaMap",
    "aoMap",
    "bumpMap",
    "displacementMap",
    "emissiveMap",
    "lightMap",
    "map",
    "metalnessMap",
    "normalMap",
    "roughnessMap",
  ] as const;
  group.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    geometries.add(object.geometry);
    const meshMaterials = Array.isArray(object.material) ? object.material : [object.material];
    meshMaterials.forEach((material) => {
      materials.add(material);
      const withTextureSlots = material as THREE.Material &
        Partial<Record<(typeof textureSlots)[number], THREE.Texture | null>>;
      textureSlots.forEach((slot) => {
        const texture = withTextureSlots[slot];
        if (texture instanceof THREE.Texture) textures.add(texture);
      });
    });
  });
  return [
    ...[...geometries].map((resource) => vi.spyOn(resource, "dispose")),
    ...[...materials].map((resource) => vi.spyOn(resource, "dispose")),
    ...[...textures].map((resource) => vi.spyOn(resource, "dispose")),
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
    const group = createInteriorCornerGroup({
      presentation: INTERIOR_CORNER_PRESENTATION,
    });

    expect(group.name).toBe("interior-corner-subject");
    expect(group.getObjectByName("interior-corner-floor")).toBeInstanceOf(THREE.Mesh);
    expect(group.getObjectByName("interior-corner-back-wall")).toBeInstanceOf(THREE.Mesh);
    expect(group.getObjectByName("interior-corner-receding-side-wall")).toBeInstanceOf(THREE.Mesh);
    expect(group.getObjectByName("interior-corner-room-corner")).toBeInstanceOf(THREE.Mesh);
    expect(group.getObjectByName("interior-corner-ceiling")).toBeInstanceOf(THREE.Mesh);
    expect(group.getObjectByName("interior-corner-side-cornice")).toBeInstanceOf(THREE.Mesh);
    expect(group.getObjectByName("interior-corner-rear-wall-artwork")).toBeInstanceOf(THREE.Group);
    const practicalLights: THREE.PointLight[] = [];
    group.traverse((object) => {
      if (object instanceof THREE.PointLight) practicalLights.push(object);
    });
    expect(practicalLights).toHaveLength(0);

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

  it.each([0, 1, 284719, 0xffff_ffff])(
    "resolves deterministic role materials for seed %s with independent Observer and RTT ownership",
    (seed) => {
      const descriptor = resolveSceneVariationDescriptor(
        interiorCornerScene,
        createSceneVariantIdentity("interior-corner", seed, 1),
      );
      if (!descriptor) throw new Error("Expected the Interior Corner variation descriptor");
      const observer = createInteriorCornerGroup({
        presentation: INTERIOR_CORNER_PRESENTATION,
        variationDescriptor: descriptor,
      });
      const rtt = createRegisteredRttSubject("interior-corner", {
        variationDescriptor: descriptor,
      });
      if (!rtt) throw new Error("Expected the registered RTT subject");
      const observerResources = collectDisposableSpies(observer);
      const rttResources = collectDisposableSpies(rtt);

      const signature = (group: THREE.Group, meshName: string): string => {
        const mesh = group.getObjectByName(meshName);
        if (!(mesh instanceof THREE.Mesh) || Array.isArray(mesh.material)) {
          throw new Error(`Expected one material on ${meshName}`);
        }
        const material = mesh.material as THREE.MeshStandardMaterial;
        const maps = [material.map, material.roughnessMap, material.normalMap];
        return maps.map((map) => {
          if (!(map instanceof THREE.DataTexture)) throw new Error("Expected generated DataTexture maps");
          return createHash("sha256").update(map.image.data as Uint8Array).digest("hex");
        }).join("|");
      };
      const materialMeshes = [
        "interior-corner-back-wall",
        "interior-corner-ceiling",
        "interior-corner-floor",
        "interior-corner-back-cornice",
        "interior-corner-console",
        "interior-corner-rear-artwork-panel",
        "interior-corner-bench-seat",
      ];

      try {
        materialMeshes.forEach((meshName) => {
          expect(signature(observer, meshName)).toBe(signature(rtt, meshName));
          const observerMesh = observer.getObjectByName(meshName) as THREE.Mesh;
          const rttMesh = rtt.getObjectByName(meshName) as THREE.Mesh;
          expect(observerMesh.geometry).not.toBe(rttMesh.geometry);
          expect(observerMesh.material).not.toBe(rttMesh.material);
          expect((observerMesh.material as THREE.MeshStandardMaterial).map)
            .not.toBe((rttMesh.material as THREE.MeshStandardMaterial).map);
        });

        const seeds = resolveInteriorCornerMaterialVariationSeeds(descriptor);
        expect(seeds).toMatchObject({
          wall: expect.any(Number),
          ceiling: expect.any(Number),
          floor: expect.any(Number),
          trim: expect.any(Number),
          wood: expect.any(Number),
          artwork: expect.any(Number),
          fabric: expect.any(Number),
        });
        expect(observer.getObjectByName("interior-corner-ceiling")?.castShadow).toBe(false);
        expect(observer.getObjectByName("interior-corner-focus-interior-wall-middle")?.userData.focusProbeWorldMm)
          .toEqual(geometry.focusTargets[1]?.worldPosition);
      } finally {
        disposeInteriorCornerGroup(observer);
        disposeRegisteredRttSubject("interior-corner", rtt);
        observerResources.forEach((spy) => expect(spy).toHaveBeenCalledTimes(1));
        rttResources.forEach((spy) => expect(spy).toHaveBeenCalledTimes(1));
      }
    },
    30_000,
  );

  it("keeps material role substreams independent", () => {
    const identity = createSceneVariantIdentity("interior-corner", 284719, 1);
    const descriptor = resolveSceneVariationDescriptor(interiorCornerScene, identity);
    if (!descriptor) throw new Error("Expected the Interior Corner variation descriptor");
    const baseline = resolveInteriorCornerMaterialVariationSeeds(descriptor);
    const fabricDrawShifted: SceneVariationDescriptor = {
      identity,
      createRandomStream: (domain, objectId) => {
        const stream = descriptor.createRandomStream(domain, objectId);
        if (objectId === "bench-fabric") stream.nextUint32();
        return stream;
      },
    };
    const shifted = resolveInteriorCornerMaterialVariationSeeds(fabricDrawShifted);

    expect(shifted?.fabric).not.toBe(baseline?.fabric);
    expect(shifted?.wall).toBe(baseline?.wall);
    expect(shifted?.floor).toBe(baseline?.floor);
    expect(shifted?.wood).toBe(baseline?.wood);
    expect(shifted?.artwork).toBe(baseline?.artwork);
  });

  it("keeps world illumination out of the registered Ground Glass subject", () => {
    const group = createRegisteredRttSubject("interior-corner");
    if (!group) throw new Error("Expected the registered Interior Corner subject");

    try {
      const practicalLights: THREE.PointLight[] = [];
      group.traverse((object) => {
        if (object instanceof THREE.PointLight) practicalLights.push(object);
      });
      expect(practicalLights).toHaveLength(0);
    } finally {
      disposeRegisteredRttSubject("interior-corner", group);
    }
  });
});
