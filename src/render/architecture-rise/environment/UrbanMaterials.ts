import * as THREE from "three";
import { createProceduralSurfaceMaterial } from "../../ProceduralSurfaceMaterials";

const solid = (name: string, color: THREE.ColorRepresentation, roughness = 0.9, metalness = 0) =>
  Object.assign(new THREE.MeshStandardMaterial({ color, roughness, metalness }), { name });

function stonePattern(name: string, width: number, depth: number, color: THREE.ColorRepresentation) {
  // Prime-offset rows break repetition. The surface contains only material
  // colors and joints, without baked illumination or directional shadows.
  const size = 256;
  const pixels = new Uint8Array(size * size * 4);
  const tint = new THREE.Color(color);
  const srgb = tint.getHex(THREE.SRGBColorSpace);
  const channels = [srgb >> 16 & 255, srgb >> 8 & 255, srgb & 255];
  for (let y = 0; y < size; y++) {
    const v = y / size * depth;
    const row = Math.floor(v);
    for (let x = 0; x < size; x++) {
      const u = x / size * width + (row * 3 % 7) / 7;
      const col = Math.floor(u) % width;
      const noise = ((Math.imul(x + size * y + 337, 16777619) >>> 15) & 255) / 255;
      const tileTone = ((col * 47 + row * 109 + col * row * 11) % 43) / 43;
      const diagonal = Math.abs(u - Math.floor(u) - 0.5) + Math.abs(v - row - 0.5);
      const joint = Math.max(Math.abs(u - Math.floor(u) - .5), Math.abs(v - row - .5)) > .474 || diagonal > .905;
      const multiplier = joint ? .74 + noise * .07 : .92 + tileTone * .15 + noise * .055;
      const i = (y * size + x) * 4;
      for (let c = 0; c < 3; c++) pixels[i + c] = Math.min(255, Math.round(channels[c] * multiplier));
      pixels[i + 3] = 255;
    }
  }
  const map = new THREE.DataTexture(pixels, size, size);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.magFilter = THREE.LinearFilter;
  map.minFilter = THREE.LinearMipmapLinearFilter;
  map.generateMipmaps = true;
  map.needsUpdate = true;
  const material = solid(name, "#ffffff");
  material.map = map;
  return material;
}

export function createUrbanMaterials(groundTint: THREE.Color) {
  const roadColor = new THREE.Color("#827a6f").lerp(groundTint, 0.12);
  const stone = (name: string, color: string, pattern: "limestone" | "plaster" | "cut-stone") =>
    Object.assign(createProceduralSurfaceMaterial({
      color, pattern, repeat: [1, 1], roughness: 0.93, normalStrength: 0.09,
    }), { name });
  const masonry = (
    name: string, color: string,
    columns: number, courses: number, tileMm: readonly [number, number],
  ) => {
    const material = stonePattern(name, columns, courses, color);
    material.userData.urbanFacadeTileMm = tileMm;
    return material;
  };
  return {
    setts: stonePattern("setts", 6, 7, roadColor),
    flags: stonePattern("flags", 3, 4, "#a99e8c"),
    pavingTrim: solid("granite-curb", "#a69d8f"),
    drainage: solid("drainage-channel", "#6c6962"),
    limestone: masonry("limestone", "#ad9e88", 4, 7, [1740, 1460]),
    tanBrick: masonry("buff-brick", "#9d8673", 7, 7, [1370, 518]),
    umberBrick: masonry("umber-brick", "#927767", 7, 7, [1370, 518]),
    plaster: stone("plaster", "#b4a99a", "plaster"),
    band: solid("window-stone", "#b1a48e"),
    roof: stonePattern("slate", 6, 7, "#605f5e"),
    roofCap: solid("weathered-lead", "#655d57"),
    chimneyPot: solid("chimney-terracotta", "#896958"),
    glass: solid("sash-glass", "#5a645e", .43),
    shopGlass: solid("shop-display-glass", "#746957", .5),
    joinery: solid("sash-and-door", "#514d44"),
    paintedWood: solid("shop-joinery", "#565d4d"),
    canvas: solid("canvas", "#b5a488"),
    canvasStripe: solid("canvas-stripe", "#90816c"),
    iron: solid("cast-iron", "#454842", .54, .2),
    lampPane: solid("lantern-pane", "#b4a58a", .68),
    timber: solid("oak", "#826b50"),
    treeBark: solid("tree-bark", "#6d6352"),
    leafShade: solid("foliage-shadow", "#626b46"),
    leaf: solid("foliage", "#788055"),
    leafLight: solid("foliage-tips", "#8c8e5f"),
  };
}

export type UrbanMaterials = ReturnType<typeof createUrbanMaterials>;
