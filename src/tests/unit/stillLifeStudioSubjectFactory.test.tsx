import { createHash } from "node:crypto";
import * as THREE from "three";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  STILL_LIFE_STUDIO_ASSET_KEY,
  createRegisteredSceneAsset,
  disposeRegisteredSceneAsset,
} from "../../render/assets/sceneAssetRegistry";
import { createRegisteredRttSubject, disposeRegisteredRttSubject } from "../../render/sceneSubjectRegistry";
import { toWorld } from "../../render/rttUtils";
import { STILL_LIFE_STUDIO_PRESENTATION } from "../../scenes/presentation/stillLifeStudio";
import { stillLifeStudioScene } from "../../scenes/definitions/still-life-studio";
import { resolveStillLifeStudioPlan, getStillLifeObjectBoundsMm } from "../../scenes/stillLifeStudioVariation";
import { createSceneVariantIdentity, resolveSceneVariationDescriptor } from "../../scenes/sceneVariation";

const descriptorFor = (seed: number) => resolveSceneVariationDescriptor(
  stillLifeStudioScene,
  createSceneVariantIdentity(stillLifeStudioScene.id, seed, 1),
)!;

const collectResources = (group: THREE.Group) => {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  group.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    geometries.add(object.geometry);
    const meshMaterials = Array.isArray(object.material) ? object.material : [object.material];
    meshMaterials.forEach((material) => {
      materials.add(material);
      Object.values(material).forEach((value) => {
        if (value instanceof THREE.Texture) textures.add(value);
      });
    });
  });
  return { geometries, materials, textures };
};

const textureSignature = (texture: THREE.Texture): string => {
  const image = texture.image as { data?: Uint8Array };
  return image.data
    ? createHash("sha256").update(image.data).digest("hex")
    : "no-pixel-data";
};

const semanticSignature = (group: THREE.Group) => {
  group.updateMatrixWorld(true);
  const rows: unknown[] = [];
  group.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const meshMaterials = Array.isArray(object.material) ? object.material : [object.material];
    rows.push({
      name: object.name,
      castShadow: object.castShadow,
      receiveShadow: object.receiveShadow,
      position: object.position.toArray().map((value) => Number(value.toFixed(8))),
      rotation: [object.rotation.x, object.rotation.y, object.rotation.z]
        .map((value) => Number(value.toFixed(8))),
      scale: object.scale.toArray().map((value) => Number(value.toFixed(8))),
      geometry: object.geometry.type,
      vertexCount: object.geometry.getAttribute("position").count,
      materials: meshMaterials.map((material) => {
        const materialWithColor = material as THREE.Material & {
          color?: THREE.Color;
          roughness?: number;
        };
        const textures = Object.values(material).filter(
          (value): value is THREE.Texture => value instanceof THREE.Texture,
        );
        return {
          type: material.type,
          color: materialWithColor.color?.getHexString(),
          roughness: materialWithColor.roughness,
          textures: textures.map(textureSignature),
        };
      }),
    });
  });
  return rows;
};

const disposeSpiesFor = (group: THREE.Group) => {
  const resources = collectResources(group);
  return [
    ...[...resources.geometries].map((resource) => vi.spyOn(resource, "dispose")),
    ...[...resources.materials].map((resource) => vi.spyOn(resource, "dispose")),
    ...[...resources.textures].map((resource) => vi.spyOn(resource, "dispose")),
  ];
};

afterEach(() => vi.restoreAllMocks());

describe("Still-Life Studio registered subject", () => {
  it("renders one deterministic plan through Observer and Ground Glass with independent resources", () => {
    const variationDescriptor = descriptorFor(284719);
    const observer = createRegisteredSceneAsset(STILL_LIFE_STUDIO_ASSET_KEY, {
      presentation: STILL_LIFE_STUDIO_PRESENTATION,
      variationDescriptor,
    });
    const groundGlass = createRegisteredRttSubject("still-life-studio", {
      variationDescriptor,
    });
    if (!groundGlass) throw new Error("Expected the registered Still-Life Studio RTT subject");

    try {
      expect(observer.name).toBe("still-life-studio-subject");
      expect(groundGlass.name).toBe("still-life-studio-subject");
      expect(observer.userData.sceneVariationPlan).toEqual(groundGlass.userData.sceneVariationPlan);
      expect(observer.userData.assetImplementationId).toBe("threejs-still-life-studio");
      expect(semanticSignature(observer)).toEqual(semanticSignature(groundGlass));

      const observerResources = collectResources(observer);
      const groundGlassResources = collectResources(groundGlass);
      for (const resource of observerResources.geometries) expect(groundGlassResources.geometries.has(resource)).toBe(false);
      for (const resource of observerResources.materials) expect(groundGlassResources.materials.has(resource)).toBe(false);
      for (const resource of observerResources.textures) expect(groundGlassResources.textures.has(resource)).toBe(false);
    } finally {
      disposeRegisteredSceneAsset(STILL_LIFE_STUDIO_ASSET_KEY, observer);
      disposeRegisteredRttSubject("still-life-studio", groundGlass);
    }
  });

  it("keeps generated mesh bottoms on the tabletop and inside their planned bounds", () => {
    const seedByFamily = new Map<string, number>();
    for (let seed = 0; seed < 256 && seedByFamily.size < 4; seed += 1) {
      const plan = resolveStillLifeStudioPlan(descriptorFor(seed));
      plan.objects.forEach(({ family }) => {
        if (!seedByFamily.has(family)) seedByFamily.set(family, seed);
      });
    }
    expect([...seedByFamily.keys()].sort()).toEqual(["books", "bowl", "vessel", "wooden-form"]);

    for (const seed of seedByFamily.values()) {
      const variationDescriptor = descriptorFor(seed);
      const plan = resolveStillLifeStudioPlan(variationDescriptor);
      const group = createRegisteredSceneAsset(STILL_LIFE_STUDIO_ASSET_KEY, {
        presentation: STILL_LIFE_STUDIO_PRESENTATION,
        variationDescriptor,
      });
      try {
        group.updateMatrixWorld(true);
        for (const placement of plan.objects) {
          const object = group.getObjectByName(`still-life-studio-object-${placement.id}`);
          if (!object) throw new Error(`Missing generated object ${placement.id}`);
          const actual = new THREE.Box3().setFromObject(object);
          const actualMm = {
            min: { x: actual.min.x * 1000, y: actual.min.y * 1000, z: actual.min.z * 1000 },
            max: { x: actual.max.x * 1000, y: actual.max.y * 1000, z: actual.max.z * 1000 },
          };
          const planned = getStillLifeObjectBoundsMm(placement);
          expect(actualMm.min.y).toBeCloseTo(0, 2);
          expect(actualMm.min.x).toBeGreaterThanOrEqual(planned.min.x - 10);
          expect(actualMm.max.x).toBeLessThanOrEqual(planned.max.x + 10);
          expect(actualMm.min.z).toBeGreaterThanOrEqual(planned.min.z - 10);
          expect(actualMm.max.z).toBeLessThanOrEqual(planned.max.z + 10);
          expect(actualMm.max.y).toBeLessThanOrEqual(planned.max.y + 1);
          expect(object.position.y).toBeCloseTo(toWorld(placement.positionMm.y), 10);
        }
      } finally {
        disposeRegisteredSceneAsset(STILL_LIFE_STUDIO_ASSET_KEY, group);
      }
    }
  });

  it("disposes each subject's owned geometry, material and texture resources once", () => {
    const variationDescriptor = descriptorFor(1);
    const observer = createRegisteredSceneAsset(STILL_LIFE_STUDIO_ASSET_KEY, {
      presentation: STILL_LIFE_STUDIO_PRESENTATION,
      variationDescriptor,
    });
    const groundGlass = createRegisteredRttSubject("still-life-studio", {
      variationDescriptor,
    });
    if (!groundGlass) throw new Error("Expected the registered Still-Life Studio RTT subject");
    const observerSpies = disposeSpiesFor(observer);
    const groundGlassSpies = disposeSpiesFor(groundGlass);

    disposeRegisteredSceneAsset(STILL_LIFE_STUDIO_ASSET_KEY, observer);
    disposeRegisteredRttSubject("still-life-studio", groundGlass);

    [...observerSpies, ...groundGlassSpies].forEach((spy) => expect(spy).toHaveBeenCalledTimes(1));
  });

});

