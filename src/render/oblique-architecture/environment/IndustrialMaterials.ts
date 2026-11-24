import * as THREE from "three";
import type { MasonryMaterials } from "../MasonryMaterials";

const matte = (name: string, color: string, roughness = 0.88) =>
  new THREE.MeshStandardMaterial({ name, color, roughness });

function tiledSurface(
  name: string,
  width: number,
  height: number,
  sizeMetres: readonly [number, number],
  pixel: (u: number, v: number, noise: number) => readonly [number, number, number],
) {
  const bytes = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const noise = ((Math.imul(x + width * y + 337, 16777619) >>> 15) & 255) / 255;
      const offset = (y * width + x) * 4;
      bytes.set(pixel(x / width, y / height, noise), offset);
      bytes[offset + 3] = 255;
    }
  }
  const map = new THREE.DataTexture(bytes, width, height);
  map.name = name;
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(1 / sizeMetres[0], 1 / sizeMetres[1]);
  map.minFilter = THREE.LinearMipmapLinearFilter;
  map.magFilter = THREE.LinearFilter;
  map.generateMipmaps = true;
  map.anisotropy = 4;
  map.needsUpdate = true;
  return map;
}

export function createIndustrialMaterials(existing: MasonryMaterials) {
  // A single world-aligned road material spans the original ground and all
  // adjoining plots. Its paving pigment varies without painted shadows.
  const road = existing.ground;
  road.color.set("#ffffff");
  road.map = tiledSurface("industrial-granite-setts", 256, 256, [1.33, .78], (u, v, noise) => {
    const row = Math.floor(v * 8);
    const run = u * 8 + (row % 2) * .5;
    const col = Math.floor(run) % 8;
    const edgeX = Math.abs(run % 1 - .5);
    const edgeY = Math.abs(v * 8 - row - .5);
    const joint = Math.max(edgeX, edgeY) > .47 || edgeX + edgeY > .91;
    const grade = (row * 19 + col * 13 + row * col * 7) % 27;
    const gray = Math.round(joint ? 89 + noise * 7 : 112 + grade + noise * 8);
    return [gray + 8, gray + 4, gray - 2];
  });
  const warmer = matte("muted-fired-brick", "#a79282");
  warmer.map = existing.brick.map;
  const cooler = matte("smoke-brown-brick", "#8e8880");
  cooler.map = existing.brick.map;
  const slate = matte("profiled-slate", "#ffffff");
  slate.map = tiledSurface("industrial-standing-seam", 128, 128, [1.24, 1.4], (u, v, noise) => {
    const position = (u * 8) % 1;
    const seam = position < .075;
    const gray = Math.round((seam ? 79 : 103) + ((Math.floor(u * 8) * 13 + Math.floor(v * 5) * 7) % 17) + noise * 8);
    return [gray, gray + 2, gray + 2];
  });
  return {
    road, warmer, cooler, slate,
    pavers: existing.paving,
    trim: matte("weathered-sandstone", "#a49a88"),
    cap: matte("zinc-caps", "#636768"),
    steel: matte("dark-ironwork", "#444945", .63),
    factoryGlass: matte("factory-sash-glass", "#5d6c69", .42),
    roofLight: matte("north-light-glass", "#8b9997", .45),
    timber: matte("painted-loading-doors", "#565c4f"),
    wood: matte("crate-timber", "#8f7558"),
    woodTrim: matte("crate-battens", "#a48663"),
    brass: matte("lamp-enamel", "#8e8773"),
  };
}

export type IndustrialMaterials = ReturnType<typeof createIndustrialMaterials>;
