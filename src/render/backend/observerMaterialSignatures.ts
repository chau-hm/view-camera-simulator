import * as THREE from "three";
import { OBSERVER_MATERIAL_MAP_SLOTS } from "./materialAwareNodeMaterials";

type MaterialWithMaps = THREE.Material & Partial<
  Record<(typeof OBSERVER_MATERIAL_MAP_SLOTS)[number], THREE.Texture | null>
>;

export type ObserverMaterialSignatures = Readonly<{
  signature: string;
  shaderSignature: string;
}>;

const stableValue = (value: unknown): unknown => {
  if (value === null || value === undefined || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value)) return value.map(stableValue);
  if (typeof value === "object") {
    const record = value as Record<string, unknown> & { isColor?: boolean; isTexture?: boolean };
    if (record.isColor === true) {
      const colorValue = value as THREE.Color;
      return [colorValue.r, colorValue.g, colorValue.b];
    }
    if (record.isTexture === true) {
      const texture = value as THREE.Texture;
      return [texture.uuid, texture.colorSpace, texture.wrapS, texture.wrapT, texture.repeat.x, texture.repeat.y];
    }
    if ("x" in record && "y" in record && Object.keys(record).length < 8) {
      return [record.x, record.y, "z" in record ? record.z : null, "w" in record ? record.w : null];
    }
  }
  return undefined;
};

export const observerMaterialSignature = (material: THREE.Material): string => JSON.stringify(
  Object.entries(material)
    .map(([key, value]) => [key, stableValue(value)] as const)
    .filter((entry) => entry[1] !== undefined)
    .sort(([left], [right]) => left.localeCompare(right)),
);

export const observerMaterialShaderSignature = (material: THREE.Material): string => {
  const candidate = material as MaterialWithMaps & {
    alphaTest?: number;
    alphaHash?: boolean;
    alphaToCoverage?: boolean;
    clipIntersection?: boolean;
    flatShading?: boolean;
    fog?: boolean;
    lights?: boolean;
    wireframe?: boolean;
    vertexColors?: boolean;
  };
  return JSON.stringify([
    material.type,
    material.transparent,
    material.side,
    material.blending,
    material.depthTest,
    material.depthWrite,
    material.colorWrite,
    material.toneMapped,
    candidate.alphaTest,
    candidate.alphaHash,
    candidate.alphaToCoverage,
    candidate.clipIntersection,
    candidate.flatShading,
    candidate.fog,
    candidate.lights,
    candidate.wireframe,
    candidate.vertexColors,
    ...OBSERVER_MATERIAL_MAP_SLOTS.map((slot) => candidate[slot]?.uuid ?? null),
  ]);
};

export const getObserverMaterialSignatures = (
  material: THREE.Material,
): ObserverMaterialSignatures => ({
  signature: observerMaterialSignature(material),
  shaderSignature: observerMaterialShaderSignature(material),
});
