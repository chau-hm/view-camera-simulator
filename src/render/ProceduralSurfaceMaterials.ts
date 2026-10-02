import * as THREE from "three";

const SURFACE_TEXTURE_SIZE = 128;

export type ProceduralSurfacePattern = "limestone" | "cut-stone" | "concrete";

export type ProceduralSurfaceMaterialOptions = Readonly<{
  color: THREE.ColorRepresentation;
  pattern: ProceduralSurfacePattern;
  repeat: readonly [number, number];
  roughness: number;
  normalStrength: number;
}>;

const clampByte = (value: number): number => Math.max(0, Math.min(255, Math.round(value)));

const hashNoise = (x: number, y: number, seed: number): number => {
  let value = Math.imul(x + seed * 17, 374761393) + Math.imul(y + seed * 31, 668265263);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 0xffffffff;
};

const tileableNoise = (x: number, y: number, cellSize: number, seed: number): number => {
  const cellCount = SURFACE_TEXTURE_SIZE / cellSize;
  const gridX = x / cellSize;
  const gridY = y / cellSize;
  const x0 = Math.floor(gridX);
  const y0 = Math.floor(gridY);
  const x1 = (x0 + 1) % cellCount;
  const y1 = (y0 + 1) % cellCount;
  const fade = (value: number) => value * value * (3 - 2 * value);
  const mix = (start: number, end: number, amount: number) => start + (end - start) * amount;
  const tx = fade(gridX - x0);
  const ty = fade(gridY - y0);
  const top = mix(hashNoise(x0, y0, seed), hashNoise(x1, y0, seed), tx);
  const bottom = mix(hashNoise(x0, y1, seed), hashNoise(x1, y1, seed), tx);
  return mix(top, bottom, ty);
};

const createSurfaceTexture = (
  data: Uint8Array,
  repeat: readonly [number, number],
  color: boolean,
): THREE.DataTexture => {
  const texture = new THREE.DataTexture(
    data,
    SURFACE_TEXTURE_SIZE,
    SURFACE_TEXTURE_SIZE,
    THREE.RGBAFormat,
    THREE.UnsignedByteType,
  );
  texture.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat[0], repeat[1]);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
};

/**
 * Build deterministic, subject-owned appearance maps. The generated relief
 * describes surface finish only; callers remain responsible for scene geometry.
 */
export const createProceduralSurfaceMaterial = ({
  color,
  pattern,
  repeat,
  roughness,
  normalStrength,
}: ProceduralSurfaceMaterialOptions): THREE.MeshStandardMaterial => {
  const base = new THREE.Color(color).convertLinearToSRGB();
  const baseRgb: [number, number, number] = [
    base.r * 255,
    base.g * 255,
    base.b * 255,
  ];
  const pixelCount = SURFACE_TEXTURE_SIZE * SURFACE_TEXTURE_SIZE;
  const albedo = new Uint8Array(pixelCount * 4);
  const roughnessMap = new Uint8Array(pixelCount * 4);
  const normalMap = new Uint8Array(pixelCount * 4);
  const heights = new Float32Array(pixelCount);
  const twoPi = Math.PI * 2;
  const isLimestone = pattern === "limestone";

  const surfaceSample = (x: number, y: number) => {
    const wave =
      Math.sin(twoPi * (2 * x + 3 * y) / SURFACE_TEXTURE_SIZE + 0.8) * 0.42 +
      Math.sin(twoPi * (5 * x - y) / SURFACE_TEXTURE_SIZE + 2.1) * 0.27 +
      Math.sin(twoPi * (3 * x + 6 * y) / SURFACE_TEXTURE_SIZE + 4.3) * 0.2;
    const broadNoise = tileableNoise(x, y, 16, isLimestone ? 13 : 29) - 0.5;
    const fineNoise = tileableNoise(x, y, 4, isLimestone ? 41 : 53) - 0.5;
    let joint = false;
    let blockTint = 0;
    let relief = wave * 0.045 + broadNoise * 0.055 + fineNoise * 0.02;

    if (isLimestone) {
      const course = Math.floor(y / 64);
      const stagger = (course % 2) * 32;
      const shiftedX = (x + stagger) % SURFACE_TEXTURE_SIZE;
      const verticalDistance = Math.min(shiftedX % 64, 64 - (shiftedX % 64));
      const horizontalDistance = Math.min(y % 64, 64 - (y % 64));
      joint = verticalDistance < 2 || horizontalDistance < 2;
      // Let adjacent limestone blocks read at the pilot's normal viewport
      // size while keeping the variation subordinate to the teaching marks.
      blockTint =
        (hashNoise(Math.floor(shiftedX / 64), course, 67) - 0.5) * 14;
      if (joint) relief -= 0.13;
    } else if (pattern === "cut-stone") {
      relief *= 0.62;
    } else {
      relief *= 0.48;
    }

    const variation = wave * (isLimestone ? 4.2 : pattern === "concrete" ? 3.4 : 2.8) + broadNoise * 5.5;
    return { joint, blockTint, relief, variation };
  };

  for (let y = 0; y < SURFACE_TEXTURE_SIZE; y += 1) {
    for (let x = 0; x < SURFACE_TEXTURE_SIZE; x += 1) {
      const index = y * SURFACE_TEXTURE_SIZE + x;
      const offset = index * 4;
      const { joint, blockTint, relief, variation } = surfaceSample(x, y);
      const jointTone = joint ? -15 : 0;
      const channels = [
        baseRgb[0] + blockTint + variation * 1.06 + jointTone,
        baseRgb[1] + blockTint * 0.82 + variation * 0.94 + jointTone,
        baseRgb[2] + blockTint * 0.58 + variation * 0.78 + jointTone,
      ];
      albedo[offset] = clampByte(channels[0]);
      albedo[offset + 1] = clampByte(channels[1]);
      albedo[offset + 2] = clampByte(channels[2]);
      albedo[offset + 3] = 255;

      const roughnessValue = pattern === "cut-stone" ? 224 : pattern === "concrete" ? 236 : 239;
      roughnessMap[offset] = clampByte(roughnessValue + variation * 1.3 + (joint ? 8 : 0));
      roughnessMap[offset + 1] = roughnessMap[offset];
      roughnessMap[offset + 2] = roughnessMap[offset];
      roughnessMap[offset + 3] = 255;
      heights[index] = relief;
    }
  }

  for (let y = 0; y < SURFACE_TEXTURE_SIZE; y += 1) {
    for (let x = 0; x < SURFACE_TEXTURE_SIZE; x += 1) {
      const index = y * SURFACE_TEXTURE_SIZE + x;
      const offset = index * 4;
      const left = y * SURFACE_TEXTURE_SIZE + (x + SURFACE_TEXTURE_SIZE - 1) % SURFACE_TEXTURE_SIZE;
      const right = y * SURFACE_TEXTURE_SIZE + (x + 1) % SURFACE_TEXTURE_SIZE;
      const up = ((y + SURFACE_TEXTURE_SIZE - 1) % SURFACE_TEXTURE_SIZE) * SURFACE_TEXTURE_SIZE + x;
      const down = ((y + 1) % SURFACE_TEXTURE_SIZE) * SURFACE_TEXTURE_SIZE + x;
      const dx = (heights[right] - heights[left]) * 220;
      const dy = (heights[down] - heights[up]) * 220;
      normalMap[offset] = clampByte(128 - dx);
      normalMap[offset + 1] = clampByte(128 - dy);
      normalMap[offset + 2] = 255;
      normalMap[offset + 3] = 255;
    }
  }

  const material = new THREE.MeshStandardMaterial({
    color: "#ffffff",
    map: createSurfaceTexture(albedo, repeat, true),
    roughnessMap: createSurfaceTexture(roughnessMap, repeat, false),
    normalMap: createSurfaceTexture(normalMap, repeat, false),
    roughness,
    metalness: 0,
  });
  material.normalScale.set(normalStrength, normalStrength);
  return material;
};
