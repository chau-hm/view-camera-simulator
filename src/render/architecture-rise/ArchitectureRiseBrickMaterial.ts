import * as THREE from "three";
import type { ArchitectureRiseDetailStyle } from "./ArchitectureRiseDetailConfig";
import type { ArchitectureRiseBrickAppearance } from "../../scenes/architectureRiseMaterialVariation";

type BrickTextureSet = Readonly<{
  map: THREE.DataTexture;
  roughnessMap: THREE.DataTexture;
  normalMap: THREE.DataTexture;
  tileWidthMm: number;
  tileHeightMm: number;
}>;

type BrickColor = readonly [number, number, number];

const BRICK_PALETTE: readonly BrickColor[] = [
  [151, 83, 62],
  [157, 89, 67],
  [145, 79, 61],
  [165, 96, 72],
  [153, 86, 64],
  [142, 78, 59],
  [160, 92, 68],
  [149, 83, 64],
];

const clampByte = (value: number): number => Math.max(0, Math.min(255, Math.round(value)));
const positiveMod = (value: number, modulus: number): number => ((value % modulus) + modulus) % modulus;

const hash = (seed: number, row: number, column: number): number => {
  let value = seed ^ Math.imul(row + 0x9e3779b9, 0x85ebca6b) ^ Math.imul(column + 0x7f4a7c15, 0xc2b2ae35);
  value = Math.imul(value ^ (value >>> 16), 0x7feb352d);
  value = Math.imul(value ^ (value >>> 15), 0x846ca68b);
  return (value ^ (value >>> 16)) >>> 0;
};

const makeTexture = (data: Uint8Array, width: number, height: number, srgb = false): THREE.DataTexture => {
  const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat, THREE.UnsignedByteType);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
};

export function createArchitectureRiseBrickTextures(
  style: ArchitectureRiseDetailStyle["masonry"],
  appearance?: ArchitectureRiseBrickAppearance,
): BrickTextureSet {
  const brickPitchMm = style.brickLengthMm + style.mortarJointMm;
  const coursePitchMm = style.brickHeightMm + style.mortarJointMm;
  const tileWidthMm = brickPitchMm * style.tileBrickPitches;
  const tileHeightMm = coursePitchMm * style.tileCourses;
  // Keep an approximately 2.4 mm texel in both directions while preserving
  // the real-world tile aspect ratio for physical UV mapping.
  const approximateTexelSizeMm = 2.4;
  const height = Math.round(tileHeightMm / approximateTexelSizeMm);
  const width = Math.round(height * tileWidthMm / tileHeightMm);
  const brickPixels = new Int16Array(width * height);
  const colorBytes = new Uint8Array(width * height * 4);
  const roughnessBytes = new Uint8Array(width * height * 4);
  const heights = new Float32Array(width * height);

  for (let y = 0; y < height; y += 1) {
    const yMm = (y / height) * tileHeightMm;
    const row = Math.floor(yMm / coursePitchMm);
    const courseY = positiveMod(yMm, coursePitchMm);
    const staggerMm = row % 2 === 0 ? 0 : brickPitchMm / 2;
    for (let x = 0; x < width; x += 1) {
      const xMm = (x / width) * tileWidthMm;
      const localX = positiveMod(xMm - staggerMm, brickPitchMm);
      const inMortar = courseY >= style.brickHeightMm || localX >= style.brickLengthMm;
      const column = Math.floor((xMm - staggerMm) / brickPitchMm);
      const pixelIndex = y * width + x;
      if (inMortar) {
        brickPixels[pixelIndex] = -1;
        heights[pixelIndex] = 0.18;
        continue;
      }

      const wrappedColumn = positiveMod(column, style.tileBrickPitches);
      const value = hash(appearance?.realizationSeed ?? style.seed, row, wrappedColumn);
      const familyPalette = appearance?.palette ?? BRICK_PALETTE;
      const palette = familyPalette[value % familyPalette.length]!;
      const shade = 0.96 + ((value >>> 8) % 10) / 100;
      const mottling = ((value >>> 16) % 7) - 3;
      const offset = pixelIndex * 4;
      colorBytes[offset] = clampByte(palette[0] * shade + mottling);
      colorBytes[offset + 1] = clampByte(palette[1] * shade + mottling * 0.6);
      colorBytes[offset + 2] = clampByte(palette[2] * shade + mottling * 0.45);
      colorBytes[offset + 3] = 255;
      const textureGrain = ((value >>> 4) % 7) - 3;
      const roughness = clampByte(208 + textureGrain);
      roughnessBytes[offset] = roughness;
      roughnessBytes[offset + 1] = roughness;
      roughnessBytes[offset + 2] = roughness;
      roughnessBytes[offset + 3] = 255;
      brickPixels[pixelIndex] = row * style.tileBrickPitches + wrappedColumn;
      heights[pixelIndex] = 1;
    }
  }

  const mortarColor: BrickColor = appearance?.mortarColor ?? [160, 144, 123];
  const mortarSeed = appearance?.mortarSeed ?? style.seed;
  const mortarRoughness = 238;
  for (let index = 0; index < brickPixels.length; index += 1) {
    if (brickPixels[index] !== -1) continue;
    const offset = index * 4;
    const variation = ((hash(mortarSeed, index, 0) % 7) - 3);
    colorBytes[offset] = clampByte(mortarColor[0] + variation);
    colorBytes[offset + 1] = clampByte(mortarColor[1] + variation);
    colorBytes[offset + 2] = clampByte(mortarColor[2] + variation);
    colorBytes[offset + 3] = 255;
    roughnessBytes[offset] = mortarRoughness;
    roughnessBytes[offset + 1] = mortarRoughness;
    roughnessBytes[offset + 2] = mortarRoughness;
    roughnessBytes[offset + 3] = 255;
  }

  const normalBytes = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const left = heights[y * width + positiveMod(x - 1, width)]!;
      const right = heights[y * width + positiveMod(x + 1, width)]!;
      const down = heights[positiveMod(y - 1, height) * width + x]!;
      const up = heights[positiveMod(y + 1, height) * width + x]!;
      const normal = new THREE.Vector3(-(right - left) * 0.38, -(up - down) * 0.38, 1).normalize();
      const offset = (y * width + x) * 4;
      normalBytes[offset] = clampByte((normal.x * 0.5 + 0.5) * 255);
      normalBytes[offset + 1] = clampByte((normal.y * 0.5 + 0.5) * 255);
      normalBytes[offset + 2] = clampByte((normal.z * 0.5 + 0.5) * 255);
      normalBytes[offset + 3] = 255;
    }
  }

  return {
    map: makeTexture(colorBytes, width, height, true),
    roughnessMap: makeTexture(roughnessBytes, width, height),
    normalMap: makeTexture(normalBytes, width, height),
    tileWidthMm,
    tileHeightMm,
  };
}

export function createArchitectureRiseBrickMaterial(
  style: ArchitectureRiseDetailStyle["masonry"],
  appearance?: ArchitectureRiseBrickAppearance,
): THREE.MeshStandardMaterial {
  const textures = createArchitectureRiseBrickTextures(style, appearance);
  const material = new THREE.MeshStandardMaterial({
    color: "#ffffff",
    map: textures.map,
    roughnessMap: textures.roughnessMap,
    normalMap: textures.normalMap,
    roughness: appearance?.roughness ?? 0.91,
    normalScale: new THREE.Vector2(appearance?.normalStrength ?? 0.11, appearance?.normalStrength ?? 0.11),
  });
  material.userData.architectureRiseBrick = {
    seed: style.seed,
    brickLengthMm: style.brickLengthMm,
    brickHeightMm: style.brickHeightMm,
    mortarJointMm: style.mortarJointMm,
    tileWidthMm: textures.tileWidthMm,
    tileHeightMm: textures.tileHeightMm,
    ...(appearance ? { familyPalette: appearance.palette, realizationSeed: appearance.realizationSeed } : {}),
  };
  return material;
}
