import * as THREE from "three";
import type { ArchitectureForegroundPresentation } from "../../scenes/presentation/architectureForeground";
import type { ArchitectureForegroundMaterialVariations } from "../../scenes/architectureForegroundMaterialVariation";
import { createProceduralSurfaceMaterial } from "../ProceduralSurfaceMaterials";

type Ground = ArchitectureForegroundPresentation["geometry"]["ground"];

function solid(name: string, color: string, roughness = 0.85) {
  return new THREE.MeshStandardMaterial({
    name: "architecture-foreground-" + name, color, roughness,
  });
}

export function createBuildingMaterials(variations?: ArchitectureForegroundMaterialVariations) {
  const plaster = createProceduralSurfaceMaterial({
    color: variations?.plaster.color ?? "#ded2bf",
    pattern: "plaster",
    repeat: variations?.plaster.repeat ?? [1, 1],
    roughness: variations?.plaster.roughness ?? 0.91,
    normalStrength: variations?.plaster.normalStrength ?? 0.16,
    ...(variations ? { variationSeed: variations.plaster.variationSeed } : {}),
  });
  plaster.name = "architecture-foreground-plaster";
  const stone = createProceduralSurfaceMaterial({
    color: variations?.rusticatedLimestone.color ?? "#bfaf97",
    pattern: "limestone",
    repeat: variations?.rusticatedLimestone.repeat ?? [1.12, 2.1],
    roughness: variations?.rusticatedLimestone.roughness ?? 0.91,
    normalStrength: variations?.rusticatedLimestone.normalStrength ?? 0.25,
    ...(variations ? { variationSeed: variations.rusticatedLimestone.variationSeed } : {}),
  });
  stone.name = "architecture-foreground-rusticated-stone";
  return {
    plaster,
    stone,
    trim: solid("limestone-trim", variations?.trim.color ?? "#d1c0a4", variations?.trim.roughness),
    cap: solid("limestone-edges", variations?.cap.color ?? "#e0cfb2", variations?.cap.roughness),
    mullion: solid("mullion", variations?.mullion.color ?? "#b2a48d", variations?.mullion.roughness),
    sash: solid("sash", "#332e28", 0.5),
    glazing: solid("glazing", "#33434a", 0.32),
    transom: solid("transom-glazing", "#52636f", 0.31),
    roof: solid("roof-slate", variations?.roof.color ?? "#777776", variations?.roof.roughness ?? 0.95),
  };
}

export type BuildingMaterials = ReturnType<typeof createBuildingMaterials>;

export function createPavingMaterials(
  ground: Ground,
  variations?: ArchitectureForegroundMaterialVariations,
) {
  const cells = 4;
  const samplesPerSlab = 64;
  const size = cells * samplesPerSlab;
  const pixels = new Uint8Array(size * size * 4);
  const halfJointX = ground.seamWidthMm / ground.slabWidthMm / 2;
  const halfJointZ = ground.seamWidthMm / ground.slabDepthMm / 2;
  for (let y = 0; y < size; y++) {
    const v = ((y % samplesPerSlab) + 0.5) / samplesPerSlab;
    for (let x = 0; x < size; x++) {
      const u = ((x % samplesPerSlab) + 0.5) / samplesPerSlab;
      const joint = Math.min(u, 1 - u) < halfJointX || Math.min(v, 1 - v) < halfJointZ;
      const slabX = Math.floor(x / samplesPerSlab);
      const slabY = Math.floor(y / samplesPerSlab);
      const shade = ((slabX * 17 + slabY * 13 + slabX * slabY * 5) % 11) - 5;
      const grain = ((Math.imul(x + 1, 374761393) ^ Math.imul(y + 1, 668265263)) >>> 14) % 7 - 3;
      const light = joint ? 140 + grain : 194 + shade + grain;
      const index = (y * size + x) * 4;
      pixels[index] = light;
      pixels[index + 1] = light - 5;
      pixels[index + 2] = light - 13;
      pixels[index + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(pixels, size, size);
  texture.name = "architecture-foreground-flush-paving-joints";
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 4;
  texture.repeat.set(ground.width / ground.slabWidthMm / cells, ground.depth / ground.slabDepthMm / cells);
  // PlaneGeometry's V runs opposite world Z after the ground rotation.
  texture.offset.y = -texture.repeat.y;
  texture.needsUpdate = true;

  const paving = solid(
    "paving-stone",
    variations?.paving.color ?? "#ffffff",
    variations?.paving.roughness ?? 0.99,
  );
  paving.map = texture;
  return {
    paving,
    curb: solid("curb-stone", variations?.curb.color ?? "#b0a594", variations?.curb.roughness),
    returns: solid("curb-return-stone", variations?.returns.color ?? "#aaa08e", variations?.returns.roughness),
  };
}
