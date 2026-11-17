import { createHash } from "node:crypto";
import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import {
  createShelfSwingGroup,
  disposeShelfSwingGroup,
} from "../../render/ShelfSwingSubjectFactory";
import { shelfSwingScene } from "../../scenes/definitions/shelf-swing";
import { SHELF_SWING_PRESENTATION } from "../../scenes/presentation/shelfSwing";
import geometry, { subjectLocalToWorld } from "../../scenes/shelfSwingGeometry";
import { resolveShelfSwingPropVariationPlan } from "../../scenes/shelfSwingPropVariation";
import {
  createSceneVariantIdentity,
  resolveSceneVariationDescriptor,
} from "../../scenes/sceneVariation";
import { toWorld } from "../../render/rttUtils";
import { getYawRotatedBoxBoundsMm } from "../../scenes/variation/placementGeometry";

const renderNodeSignature = (root: THREE.Group, excludeDisplayObjects = false): string => {
  const nodes: unknown[] = [];
  root.traverse((object) => {
    const mesh = object instanceof THREE.Mesh ? object : null;
    if (excludeDisplayObjects && mesh && object.name.includes("-object-")) return;
    const materials = mesh
      ? (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).map((material) => {
          const candidate = material as THREE.Material & {
            color?: THREE.Color;
            roughness?: number;
            metalness?: number;
            map?: THREE.Texture | null;
          };
          const image = candidate.map?.image as { width?: number; height?: number } | undefined;
          return {
            type: material.type,
            color: candidate.color?.getHexString(),
            roughness: candidate.roughness,
            metalness: candidate.metalness,
            map: candidate.map
              ? {
                  type: candidate.map.type,
                  colorSpace: candidate.map.colorSpace,
                  repeat: [candidate.map.repeat.x, candidate.map.repeat.y],
                  imageSize: [image?.width, image?.height],
                }
              : null,
          };
        })
      : undefined;
    nodes.push({
      type: object.type,
      name: object.name,
      position: object.position.toArray(),
      rotation: object.rotation.toArray(),
      scale: object.scale.toArray(),
      userData: object.userData,
      geometry: mesh
        ? { type: mesh.geometry.type, parameters: mesh.geometry.parameters }
        : undefined,
      materials,
    });
  });
  return createHash("sha256").update(JSON.stringify(nodes)).digest("hex");
};

describe("Shelf Swing canonical registered subject signature", () => {
  it("preserves the accepted complete no-variation subject signature", () => {
    const group = createShelfSwingGroup({ presentation: SHELF_SWING_PRESENTATION });
    try {
      expect(renderNodeSignature(group)).toBe(
        "c0e91bfcf2721d99ff12c06f748bda06fac6def672bda30b442c462a79ced43f",
      );
    } finally {
      disposeShelfSwingGroup(group);
    }
  });

  it.each([0, 1, 284719, 0xffff_ffff])(
    "keeps teaching geometry on its accepted signature for seed %s",
    (seed) => {
      const descriptor = resolveSceneVariationDescriptor(
        shelfSwingScene,
        createSceneVariantIdentity("shelf-swing", seed, 1),
      );
      const plan = resolveShelfSwingPropVariationPlan(descriptor ?? undefined);
      expect(plan).not.toBeNull();
      const group = createShelfSwingGroup({
        presentation: SHELF_SWING_PRESENTATION,
        variationDescriptor: descriptor ?? undefined,
      });
      try {
        expect(renderNodeSignature(group, true)).toBe(
          "40a0d583b6935b0325d1acb934d1e81a3aad32ce3d1a3b1e96a96986e936486e",
        );
        group.updateMatrixWorld(true);
        geometry.subjects.forEach((subject) => {
          const plannedStation = plan!.stations.find((station) => station.stationId === subject.id)!;
          expect(plannedStation.props).toHaveLength(
            group.children.find((child) => child.name === subject.semanticName)!
              .children.filter((child) => child.name.includes("-variation-object-")).length,
          );
          plannedStation.props.forEach((prop) => {
            const object = group.getObjectByName(
              `${subject.semanticName}-variation-object-${prop.id}`,
            );
            expect(object).toBeInstanceOf(THREE.Mesh);
            expect(object!.userData).toMatchObject({
              variationPropId: prop.id,
              family: prop.family,
            });
            const actualWorld = new THREE.Vector3();
            object!.getWorldPosition(actualWorld);
            const expectedWorld = subjectLocalToWorld(subject, prop.positionMm);
            expect(actualWorld.x).toBeCloseTo(toWorld(expectedWorld.x), 9);
            expect(actualWorld.y).toBeCloseTo(toWorld(expectedWorld.y), 9);
            expect(actualWorld.z).toBeCloseTo(toWorld(expectedWorld.z), 9);
          });
        });
      } finally {
        disposeShelfSwingGroup(group);
      }
    },
  );

  it.each([0, 1, 284719, 0xffff_ffff])(
    "keeps teaching geometry and contains actual schema-v2 meshes for seed %s",
    (seed) => {
      const descriptor = resolveSceneVariationDescriptor(
        shelfSwingScene,
        createSceneVariantIdentity("shelf-swing", seed, 2),
      );
      const plan = resolveShelfSwingPropVariationPlan(descriptor ?? undefined);
      expect(plan?.schemaVersion).toBe(2);
      if (!descriptor || !plan || plan.schemaVersion !== 2) {
        throw new Error("Expected a Shelf Swing schema-v2 plan");
      }
      const group = createShelfSwingGroup({
        presentation: SHELF_SWING_PRESENTATION,
        variationDescriptor: descriptor,
      });
      try {
        expect(renderNodeSignature(group, true)).toBe(
          "40a0d583b6935b0325d1acb934d1e81a3aad32ce3d1a3b1e96a96986e936486e",
        );
        group.updateMatrixWorld(true);
        geometry.subjects.forEach((subject) => {
          const plannedStation = plan.stations.find((station) => station.stationId === subject.id)!;
          plannedStation.props.forEach((prop) => {
            const object = group.getObjectByName(
              `${subject.semanticName}-variation-object-${prop.id}`,
            );
            expect(object).toBeInstanceOf(THREE.Mesh);
            const mesh = object as THREE.Mesh;
            mesh.geometry.computeBoundingBox();
            const localBounds = mesh.geometry.boundingBox;
            expect(localBounds).not.toBeNull();
            const epsilon = 1e-8;
            expect(localBounds!.min.x).toBeGreaterThanOrEqual(-toWorld(prop.dimensionsMm.width / 2) - epsilon);
            expect(localBounds!.max.x).toBeLessThanOrEqual(toWorld(prop.dimensionsMm.width / 2) + epsilon);
            expect(localBounds!.min.y).toBeGreaterThanOrEqual(-toWorld(prop.dimensionsMm.height / 2) - epsilon);
            expect(localBounds!.max.y).toBeLessThanOrEqual(toWorld(prop.dimensionsMm.height / 2) + epsilon);
            expect(localBounds!.min.z).toBeGreaterThanOrEqual(-toWorld(prop.dimensionsMm.depth / 2) - epsilon);
            expect(localBounds!.max.z).toBeLessThanOrEqual(toWorld(prop.dimensionsMm.depth / 2) + epsilon);

            const actualWorld = new THREE.Vector3();
            mesh.getWorldPosition(actualWorld);
            const expectedWorld = subjectLocalToWorld(subject, prop.positionMm);
            expect(actualWorld.x).toBeCloseTo(toWorld(expectedWorld.x), 9);
            expect(actualWorld.y).toBeCloseTo(toWorld(expectedWorld.y), 9);
            expect(actualWorld.z).toBeCloseTo(toWorld(expectedWorld.z), 9);
            const actualWorldBounds = new THREE.Box3().setFromObject(mesh);
            const plannedWorldBounds = getYawRotatedBoxBoundsMm(
              expectedWorld,
              prop.dimensionsMm,
              subject.yawDeg + prop.rotationYDeg,
            );
            expect(actualWorldBounds.min.x * 1000).toBeGreaterThanOrEqual(plannedWorldBounds.min.x - 1e-4);
            expect(actualWorldBounds.max.x * 1000).toBeLessThanOrEqual(plannedWorldBounds.max.x + 1e-4);
            expect(actualWorldBounds.min.y * 1000).toBeGreaterThanOrEqual(plannedWorldBounds.min.y - 1e-4);
            expect(actualWorldBounds.max.y * 1000).toBeLessThanOrEqual(plannedWorldBounds.max.y + 1e-4);
            expect(actualWorldBounds.min.z * 1000).toBeGreaterThanOrEqual(plannedWorldBounds.min.z - 1e-4);
            expect(actualWorldBounds.max.z * 1000).toBeLessThanOrEqual(plannedWorldBounds.max.z + 1e-4);
          });
        });
      } finally {
        disposeShelfSwingGroup(group);
      }
    },
  );

  it("disposes ten generated subjects and repeats the same seed capacity", () => {
    const countsFor = (seed: number) => {
      const descriptor = resolveSceneVariationDescriptor(
        shelfSwingScene,
        createSceneVariantIdentity("shelf-swing", seed, 1),
      );
      const group = createShelfSwingGroup({
        presentation: SHELF_SWING_PRESENTATION,
        variationDescriptor: descriptor ?? undefined,
      });
      const geometries = new Set<THREE.BufferGeometry>();
      const materials = new Set<THREE.Material>();
      let meshes = 0;
      group.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        meshes += 1;
        geometries.add(object.geometry);
        (Array.isArray(object.material) ? object.material : [object.material])
          .forEach((material) => materials.add(material));
      });
      const geometryDisposals = [...geometries].map((geometry) => vi.spyOn(geometry, "dispose"));
      const materialDisposals = [...materials].map((material) => vi.spyOn(material, "dispose"));
      disposeShelfSwingGroup(group);
      expect(geometryDisposals.every((spy) => spy.mock.calls.length === 1)).toBe(true);
      expect(materialDisposals.every((spy) => spy.mock.calls.length === 1)).toBe(true);
      return { meshes, geometries: geometries.size, materials: materials.size };
    };

    const capacities = [0, 1, 284719, 0xffff_ffff, 7, 11, 29, 83, 101, 284719]
      .map(countsFor);
    expect(capacities[2]).toEqual(capacities[9]);
    expect(capacities.every((capacity) =>
      capacity.meshes > 0 && capacity.geometries > 0 && capacity.materials > 0,
    )).toBe(true);
  });
});
