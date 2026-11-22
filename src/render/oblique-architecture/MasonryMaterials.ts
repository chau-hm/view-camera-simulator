import * as THREE from "three";

type Bond = Readonly<{
  unitWidthMm: number;
  unitHeightMm: number;
  jointMm: number;
  palette: readonly (readonly [number, number, number])[];
  mortar: readonly [number, number, number];
}>;

const masonry = (name: string, bond: Bond) => {
  const width = 256;
  const height = 128;
  const columns = 6;
  const rows = 8;
  const bytes = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    const v = (y + 0.5) * rows / height;
    const row = Math.floor(v);
    for (let x = 0; x < width; x++) {
      const u = (x + 0.5) * columns / width + (row % 2) * 0.5;
      const column = Math.floor(u) % columns;
      const edgeMm = Math.min((u % 1) * bond.unitWidthMm, (v % 1) * bond.unitHeightMm);
      const color = edgeMm < bond.jointMm
        ? bond.mortar
        : bond.palette[(row * 7 + column * 3 + row * column) % bond.palette.length];
      const grain = ((x * 11 ^ y * 31 ^ x * y * 3) % 13 - 6) * 0.6;
      const relief = edgeMm < bond.jointMm + 2 && edgeMm >= bond.jointMm ? -10 : 0;
      const offset = (y * width + x) * 4;
      for (let channel = 0; channel < 3; channel++) bytes[offset + channel] = color[channel] + grain + relief;
      bytes[offset + 3] = 255;
    }
  }
  const map = new THREE.DataTexture(bytes, width, height);
  map.name = name;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(1000 / (columns * bond.unitWidthMm), 1000 / (rows * bond.unitHeightMm));
  map.minFilter = THREE.LinearMipmapLinearFilter;
  map.magFilter = THREE.LinearFilter;
  map.generateMipmaps = true;
  map.anisotropy = 4;
  map.colorSpace = THREE.SRGBColorSpace;
  map.needsUpdate = true;
  return new THREE.MeshStandardMaterial({ name, map, roughness: 0.94 });
};

export const createMasonryMaterials = () => ({
  brick: masonry("oblique-architecture-fired-brick", {
    unitWidthMm: 146, unitHeightMm: 48, jointMm: 4,
    palette: [[205, 125, 86], [193, 111, 77], [212, 132, 90], [184, 108, 79], [200, 120, 83]],
    mortar: [178, 152, 124],
  }),
  ashlar: masonry("oblique-architecture-ashlar", {
    unitWidthMm: 378, unitHeightMm: 148, jointMm: 7,
    palette: [[212, 189, 161], [200, 178, 152], [221, 202, 173], [206, 186, 159]],
    mortar: [145, 129, 111],
  }),
  paving: masonry("oblique-architecture-paving", {
    unitWidthMm: 400, unitHeightMm: 284, jointMm: 6,
    palette: [[186, 177, 160], [194, 184, 167], [177, 170, 156], [189, 180, 165]],
    mortar: [145, 140, 131],
  }),
  stone: new THREE.MeshStandardMaterial({ name: "oblique-architecture-limestone", color: "#dfc7a6", roughness: 0.87 }),
  sash: new THREE.MeshStandardMaterial({ name: "oblique-architecture-sash", color: "#50463d", roughness: 0.8 }),
  glazing: new THREE.MeshStandardMaterial({ name: "oblique-architecture-glazing", color: "#7c9fad", roughness: 0.34, metalness: 0.12, vertexColors: true }),
  roof: new THREE.MeshStandardMaterial({ name: "oblique-architecture-roof-metal", color: "#586264", roughness: 0.78 }),
  ground: new THREE.MeshStandardMaterial({ name: "oblique-architecture-street", color: "#a4a39f", roughness: 1 }),
});

export type MasonryMaterials = ReturnType<typeof createMasonryMaterials>;
