import * as THREE from "three";

export type MacroMaterialOptions = {
  color: THREE.ColorRepresentation;
  roughness: number;
  metalness: number;
  seed: number;
  roughnessVariation?: number;
  repeat?: readonly [number, number];
};

const TEXTURE_SIZE = 64;

const hash = (x: number, y: number, seed: number): number => {
  const value = Math.sin((x + seed * 17.13) * 12.9898 + (y + seed * 7.31) * 78.233) * 43758.5453;
  return value - Math.floor(value);
};

/**
 * Create a subject-owned roughness texture with restrained machining grain.
 * The directional component helps highlights reveal relief without turning the
 * macro subjects into a noisy screen-space texture.
 */
export const createMacroRoughnessTexture = ({
  baseRoughness,
  variation = 0.08,
  seed,
  repeat = [1, 1],
}: {
  baseRoughness: number;
  variation?: number;
  seed: number;
  repeat?: readonly [number, number];
}): THREE.DataTexture => {
  const data = new Uint8Array(TEXTURE_SIZE * TEXTURE_SIZE * 4);

  for (let y = 0; y < TEXTURE_SIZE; y += 1) {
    for (let x = 0; x < TEXTURE_SIZE; x += 1) {
      const microGrain = hash(x, y, seed) - 0.5;
      const machiningBand = Math.sin((x + seed * 11) * 0.72) * 0.5;
      const roughness = THREE.MathUtils.clamp(
        baseRoughness + variation * (microGrain * 0.8 + machiningBand * 0.2),
        0.05,
        1,
      );
      const value = Math.round(roughness * 255);
      const offset = (y * TEXTURE_SIZE + x) * 4;
      data[offset] = value;
      data[offset + 1] = value;
      data[offset + 2] = value;
      data[offset + 3] = 255;
    }
  }

  const texture = new THREE.DataTexture(
    data,
    TEXTURE_SIZE,
    TEXTURE_SIZE,
    THREE.RGBAFormat,
    THREE.UnsignedByteType,
  );
  texture.colorSpace = THREE.NoColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat[0], repeat[1]);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
};

/** Build a lit macro material with a deterministic, subject-owned roughness map. */
export const createMacroMaterial = ({
  color,
  roughness,
  metalness,
  seed,
  roughnessVariation,
  repeat,
}: MacroMaterialOptions): THREE.MeshStandardMaterial => {
  const roughnessMap = createMacroRoughnessTexture({
    baseRoughness: 1,
    variation: roughnessVariation,
    seed,
    repeat,
  });

  return new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness,
    roughnessMap,
  });
};
