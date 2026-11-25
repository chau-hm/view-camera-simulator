import * as THREE from "three";
import { createProceduralSurfaceMaterial } from "../../ProceduralSurfaceMaterials";

function slateMap() {
  const size = 128;
  const pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    const row = Math.floor(y / 16);
    for (let x = 0; x < size; x++) {
      const u = (x + (row % 2) * 8) % size;
      const stone = Math.floor(u / 16);
      const grain = ((Math.imul(x + y * size + 31, 16777619) >>> 12) % 9) - 4;
      const joint = y % 16 < 2 || u % 16 === 0;
      const tone = joint ? 78 : 101 + (stone * 7 + row * 17 + stone * row * 3) % 24;
      const i = (y * size + x) * 4;
      pixels.set([tone + grain, tone + grain + 3, tone + grain + 7, 255], i);
    }
  }
  const map = new THREE.DataTexture(pixels, size, size);
  map.name = "courtyard-overlapping-slate";
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.magFilter = THREE.LinearFilter;
  map.minFilter = THREE.LinearMipmapLinearFilter;
  map.generateMipmaps = true;
  map.anisotropy = 4;
  map.needsUpdate = true;
  return map;
}

export function createCourtyardMaterials() {
  const solid = (name: string, color: string, roughness = 0.88, metalness = 0) =>
    new THREE.MeshStandardMaterial({ name: "courtyard-" + name, color, roughness, metalness });
  const stone = (name: string, color: string, pattern: "limestone" | "plaster", variationSeed: number) =>
    Object.assign(createProceduralSurfaceMaterial({
      color, pattern, repeat: [0.66, 0.64], normalStrength: 0.12, roughness: 0.91, variationSeed,
    }), { name: "courtyard-" + name });

  return {
    limestone: stone("limestone", "#c8b7a0", "limestone", 114),
    plaster: stone("plaster", "#d1bfa9", "plaster", 253),
    trim: solid("moulded-stone", "#cbb99d"),
    plinth: solid("plinth-stone", "#9a907e"),
    cap: solid("stone-coping", "#cec1ab"),
    slate: Object.assign(solid("slate", "#ffffff", 0.9), { map: slateMap() }),
    ridge: solid("slate-ridge", "#706f6f"),
    joinery: solid("painted-joinery", "#45483f", 0.69),
    glazing: solid("courtyard-sash-glass", "#59645c", 0.34),
    lanternPane: solid("lantern-glass", "#9a8b6f", 0.46),
    iron: solid("ironwork", "#41423a", 0.55, 0.24),
    oak: solid("bench-oak", "#93724f", 0.78),
    soil: solid("garden-soil", "#5f5442"),
    bark: solid("tree-bark", "#695e49"),
    leaves: new THREE.MeshStandardMaterial({
      name: "courtyard-leaves", vertexColors: true, side: THREE.DoubleSide, roughness: 0.96,
    }),
  };
}

export type CourtyardMaterials = ReturnType<typeof createCourtyardMaterials>;
