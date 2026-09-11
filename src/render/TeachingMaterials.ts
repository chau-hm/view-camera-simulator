import * as THREE from "three";
import {
  createTeachingTexture,
  type TeachingTexturePattern,
} from "./TeachingTextures";

export type FocusFriendlyMaterialOptions = {
  pattern: TeachingTexturePattern;
  primaryColor: THREE.ColorRepresentation;
  secondaryColor: THREE.ColorRepresentation;
  repeat?: readonly [number, number];
  roughness?: number;
  metalness?: number;
};

/**
 * Build a lit material and its subject-owned albedo texture as one resource.
 * The white material tint leaves the authored pattern colors intact.
 */
export const createFocusFriendlyMaterial = ({
  pattern,
  primaryColor,
  secondaryColor,
  repeat,
  roughness = 0.88,
  metalness = 0,
}: FocusFriendlyMaterialOptions): THREE.MeshStandardMaterial => {
  const map = createTeachingTexture({
    pattern,
    primaryColor,
    secondaryColor,
    repeat,
  });
  return new THREE.MeshStandardMaterial({
    color: "#ffffff",
    map,
    roughness,
    metalness,
  });
};

type TextureSlot =
  | "map"
  | "alphaMap"
  | "aoMap"
  | "bumpMap"
  | "displacementMap"
  | "emissiveMap"
  | "lightMap"
  | "metalnessMap"
  | "normalMap"
  | "roughnessMap";

const textureSlots: readonly TextureSlot[] = [
  "map",
  "alphaMap",
  "aoMap",
  "bumpMap",
  "displacementMap",
  "emissiveMap",
  "lightMap",
  "metalnessMap",
  "normalMap",
  "roughnessMap",
];

/** Dispose one factory-owned subject tree, including maps not released by Material.dispose(). */
export const disposeTeachingSubjectResources = (root: THREE.Object3D): void => {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();

  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    geometries.add(object.geometry);
    const meshMaterials = Array.isArray(object.material)
      ? object.material
      : [object.material];
    meshMaterials.forEach((material) => {
      materials.add(material);
      const materialWithTextures = material as THREE.Material &
        Partial<Record<TextureSlot, THREE.Texture | null>>;
      textureSlots.forEach((slot) => {
        const texture = materialWithTextures[slot];
        if (texture instanceof THREE.Texture) textures.add(texture);
      });
    });
  });

  geometries.forEach((geometry) => geometry.dispose());
  textures.forEach((texture) => texture.dispose());
  materials.forEach((material) => material.dispose());
};
