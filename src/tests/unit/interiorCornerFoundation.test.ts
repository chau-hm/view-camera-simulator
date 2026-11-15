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
import geometry, { furnitureSupportSurfacesMm } from "../../scenes/interiorCornerGeometry";
import { DEFAULT_CAMERA_STATE } from "../../utils/constants";
import { INTERIOR_CORNER_PRESENTATION } from "../../scenes/presentation/interiorCorner";
import { toWorld } from "../../render/rttUtils";
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

const createAcceptedV1SubjectSignature = (group: THREE.Group): string => {
  group.updateMatrixWorld(true);
  const entries: unknown[] = [];
  group.traverse((object) => {
    const entry: Record<string, unknown> = {
      type: object.type,
      name: object.name,
      matrix: object.matrix.elements.map((value) => Number(value.toPrecision(12))),
    };
    if (object instanceof THREE.Mesh) {
      const geometryAttributes = object.geometry.attributes as Record<string, THREE.BufferAttribute>;
      entry.geometry = Object.entries(geometryAttributes)
        .map(([name, attribute]) => {
          const view = new Uint8Array(
            attribute.array.buffer,
            attribute.array.byteOffset,
            attribute.array.byteLength,
          );
          return [
            name,
            createHash("sha256").update(view).digest("hex"),
            attribute.itemSize,
            attribute.count,
          ];
        })
        .sort(([a], [b]) => String(a).localeCompare(String(b)));
      const index = object.geometry.index;
      if (index) {
        const view = new Uint8Array(index.array.buffer, index.array.byteOffset, index.array.byteLength);
        entry.index = createHash("sha256").update(view).digest("hex");
      }
      const meshMaterials = Array.isArray(object.material) ? object.material : [object.material];
      entry.materials = meshMaterials.map((material) => {
        const result: Record<string, unknown> = {
          type: material.type,
          name: material.name,
          transparent: material.transparent,
          opacity: material.opacity,
        };
        if (material instanceof THREE.MeshStandardMaterial) {
          result.color = material.color.getHexString();
          result.roughness = material.roughness;
          result.metalness = material.metalness;
          result.normalScale = material.normalScale.toArray();
        }
        const candidate = material as THREE.Material & Record<string, unknown>;
        result.textures = ["map", "normalMap", "roughnessMap"].map((slot) => {
          const texture = candidate[slot];
          if (!(texture instanceof THREE.DataTexture)) return [slot, null];
          const data = texture.image.data as Uint8Array;
          return [
            slot,
            createHash("sha256").update(data).digest("hex"),
            texture.image.width,
            texture.image.height,
          ];
        });
        return result;
      });
    }
    entries.push(entry);
  });
  return createHash("sha256").update(JSON.stringify(entries)).digest("hex");
};

const createVariationSubtreeSignature = (group: THREE.Group): string => {
  group.updateMatrixWorld(true);
  const meshes: unknown[] = [];
  group.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const geometryAttributes = object.geometry.attributes as Record<string, THREE.BufferAttribute>;
    const position = geometryAttributes.position;
    const positionBytes = position
      ? new Uint8Array(position.array.buffer, position.array.byteOffset, position.array.byteLength)
      : new Uint8Array();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    meshes.push({
      name: object.name,
      matrixWorld: object.matrixWorld.elements.map((value) => Number(value.toPrecision(12))),
      positionHash: createHash("sha256").update(positionBytes).digest("hex"),
      castShadow: object.castShadow,
      receiveShadow: object.receiveShadow,
      materials: materials.map((material) => {
        const result: Record<string, unknown> = { type: material.type };
        if (material instanceof THREE.MeshStandardMaterial) {
          result.color = material.color.getHexString();
          result.roughness = material.roughness;
          result.metalness = material.metalness;
        }
        const withTextures = material as THREE.Material & { map?: THREE.Texture | null };
        const texture = withTextures.map;
        if (texture instanceof THREE.DataTexture) {
          result.mapHash = createHash("sha256")
            .update(texture.image.data as Uint8Array)
            .digest("hex");
        }
        return result;
      }),
    });
  });
  meshes.sort((left, right) => {
    const leftName = (left as { name: string }).name;
    const rightName = (right as { name: string }).name;
    return leftName.localeCompare(rightName);
  });
  return createHash("sha256").update(JSON.stringify(meshes)).digest("hex");
};

// Captured before edits from accepted PR #337 reviewed HEAD 22ed40b1bbc4696de109f2c6fd2acebfe8f0628c.
const ACCEPTED_V1_SUBJECT_SIGNATURES: Readonly<Record<number, string>> = {
  0: "2fe78f16df3a0a5f1a959c8fba50169cd1553dbeedd20d4a1cdd57dee8d7f9fd",
  1: "4344861526dd05bb3e96837af505aafc947b4ce6f0d350870915e6f5e486b1f1",
  284719: "76e86cab45f0cd07709e1e815874852e09cdbddd3932b9c56749ed58979d0268",
  [0xffff_ffff]: "202e14ae54416b3e44dedcb3a504014a91c685228b6b3e94ee233d87a91dfc7e",
};

describe("Interior Corner scene foundation", () => {
  it.each(Object.entries(ACCEPTED_V1_SUBJECT_SIGNATURES))(
    "preserves accepted v1 scene and material signature for seed %s",
    (seedText, expectedSignature) => {
      const descriptor = resolveSceneVariationDescriptor(
        interiorCornerScene,
        createSceneVariantIdentity("interior-corner", Number(seedText), 1),
      );
      if (!descriptor) throw new Error("Expected the v1 Interior Corner descriptor");
      const group = createInteriorCornerGroup({
        presentation: INTERIOR_CORNER_PRESENTATION,
        variationDescriptor: descriptor,
      });
      try {
        expect(createAcceptedV1SubjectSignature(group)).toBe(expectedSignature);
        expect(group.getObjectByName("interior-corner-console-vase")).toBeInstanceOf(THREE.Mesh);
        expect(group.getObjectByName("interior-corner-bench-cushion-left")).toBeUndefined();
      } finally {
        disposeInteriorCornerGroup(group);
      }
    },
  );

  it.each([284719, 0xffff_ffff])(
    "builds equivalent but separately owned v2 prop subjects for Observer and RTT seed %s",
    (seed) => {
      const descriptor = resolveSceneVariationDescriptor(
        interiorCornerScene,
        createSceneVariantIdentity("interior-corner", seed, 2),
      );
      if (!descriptor) throw new Error("Expected the v2 Interior Corner descriptor");
      const observer = createInteriorCornerGroup({
        presentation: INTERIOR_CORNER_PRESENTATION,
        variationDescriptor: descriptor,
      });
      const rtt = createRegisteredRttSubject("interior-corner", {
        variationDescriptor: descriptor,
      });
      if (!rtt) throw new Error("Expected the registered v2 RTT subject");
      const observerProps = observer.getObjectByName("interior-corner-seeded-props");
      const rttProps = rtt.getObjectByName("interior-corner-seeded-props");
      if (!(observerProps instanceof THREE.Group) || !(rttProps instanceof THREE.Group)) {
        throw new Error("Expected v2 seeded prop groups in both subject owners");
      }
      const observerResources = collectDisposableSpies(observer);
      const rttResources = collectDisposableSpies(rtt);

      try {
        expect(createVariationSubtreeSignature(observerProps)).toBe(
          createVariationSubtreeSignature(rttProps),
        );
        const observerMeshes = new Map<string, THREE.Mesh>();
        observerProps.traverse((object) => {
          if (object instanceof THREE.Mesh) observerMeshes.set(object.name, object);
        });
        rttProps.traverse((object) => {
          if (!(object instanceof THREE.Mesh)) return;
          const counterpart = observerMeshes.get(object.name);
          expect(counterpart).toBeInstanceOf(THREE.Mesh);
          expect(counterpart?.geometry).not.toBe(object.geometry);
          const counterpartMaterial = counterpart?.material;
          expect(counterpartMaterial).not.toBe(object.material);
          const observerMaterial = Array.isArray(counterpartMaterial)
            ? counterpartMaterial[0]
            : counterpartMaterial;
          const rttMaterial = Array.isArray(object.material) ? object.material[0] : object.material;
          if (observerMaterial instanceof THREE.MeshStandardMaterial &&
            rttMaterial instanceof THREE.MeshStandardMaterial &&
            observerMaterial.map && rttMaterial.map) {
            expect(observerMaterial.map).not.toBe(rttMaterial.map);
          }
        });
        const plannedVase = observerProps.getObjectByName("interior-corner-console-vase");
        const plannedCushions = ["interior-corner-bench-cushion-single", "interior-corner-bench-cushion-left", "interior-corner-bench-cushion-right"]
          .filter((name) => observerProps.getObjectByName(name) !== undefined);
        expect(plannedVase).toBeInstanceOf(THREE.Mesh);
        expect(plannedCushions.length).toBeGreaterThanOrEqual(1);
        expect(plannedCushions.length).toBeLessThanOrEqual(2);
        const furnitureStructure = observer.getObjectByName("interior-corner-furniture-structure");
        expect(furnitureStructure?.getObjectByName("interior-corner-console-vase")).toBeUndefined();
        expect(observer.getObjectByName("interior-corner-ceiling")?.castShadow).toBe(false);
      } finally {
        disposeInteriorCornerGroup(observer);
        disposeRegisteredRttSubject("interior-corner", rtt);
        observerResources.forEach((spy) => expect(spy).toHaveBeenCalledTimes(1));
        rttResources.forEach((spy) => expect(spy).toHaveBeenCalledTimes(1));
      }
    },
    30_000,
  );

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

  it("keeps variation support data aligned with the rendered console, bench, and rug surfaces", () => {
    const group = createInteriorCornerGroup({ presentation: INTERIOR_CORNER_PRESENTATION });
    const surfaces = [
      ["interior-corner-console-top", furnitureSupportSurfacesMm.consoleTop],
      ["interior-corner-bench-seat", furnitureSupportSurfacesMm.benchSeat],
      ["interior-corner-rug", furnitureSupportSurfacesMm.rug],
    ] as const;
    try {
      surfaces.forEach(([name, support]) => {
        const mesh = group.getObjectByName(name);
        expect(mesh).toBeInstanceOf(THREE.Mesh);
        const supportedMesh = mesh as THREE.Mesh<THREE.BoxGeometry>;
        expect(supportedMesh.position.toArray()).toEqual([
          toWorld(support.center.x),
          toWorld(support.center.y),
          toWorld(support.center.z),
        ]);
        expect(supportedMesh.geometry.parameters).toMatchObject({
          width: toWorld(support.size.x),
          height: toWorld(support.size.y),
          depth: toWorld(support.size.z),
        });
      });
    } finally {
      disposeInteriorCornerGroup(group);
    }
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
