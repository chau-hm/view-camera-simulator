import * as THREE from "three";

/** Small, deterministic surface patterns used by photographic teaching subjects. */
export type TeachingTexturePattern =
  | "fine-grid"
  | "linear-grain"
  | "subtle-checker"
  | "bands";

export type TeachingTextureOptions = {
  pattern: TeachingTexturePattern;
  primaryColor: THREE.ColorRepresentation;
  secondaryColor: THREE.ColorRepresentation;
  repeat?: readonly [number, number];
};

const TEXTURE_SIZE = 64;

const colorBytes = (color: THREE.ColorRepresentation): [number, number, number] => {
  const hex = new THREE.Color(color).getHex();
  return [(hex >> 16) & 0xff, (hex >> 8) & 0xff, hex & 0xff];
};

const isSecondaryColor = (
  pattern: TeachingTexturePattern,
  x: number,
  y: number,
): boolean => {
  switch (pattern) {
    case "fine-grid":
      return x % 16 < 2 || y % 16 < 2;
    case "linear-grain":
      return y % 12 < 2 || (x + y * 3) % 47 === 0;
    case "subtle-checker":
      return (Math.floor(x / 8) + Math.floor(y / 8)) % 2 === 1;
    case "bands":
      return y % 14 < 3;
  }
};

/**
 * Create one owned albedo texture for a subject factory.
 *
 * The pattern is deliberately small and low contrast so it contributes useful
 * focus detail without becoming a decorative screen-space overlay or a moire
 * test. The caller owns the returned texture and must dispose it with the
 * subject's other material resources.
 */
export const createTeachingTexture = ({
  pattern,
  primaryColor,
  secondaryColor,
  repeat = [1, 1],
}: TeachingTextureOptions): THREE.DataTexture => {
  const primary = colorBytes(primaryColor);
  const secondary = colorBytes(secondaryColor);
  const data = new Uint8Array(TEXTURE_SIZE * TEXTURE_SIZE * 4);

  for (let y = 0; y < TEXTURE_SIZE; y += 1) {
    for (let x = 0; x < TEXTURE_SIZE; x += 1) {
      const offset = (y * TEXTURE_SIZE + x) * 4;
      const color = isSecondaryColor(pattern, x, y) ? secondary : primary;
      data[offset] = color[0];
      data[offset + 1] = color[1];
      data[offset + 2] = color[2];
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
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat[0], repeat[1]);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
};
