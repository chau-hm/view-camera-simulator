import { Color, DataTexture, LinearFilter, RGBAFormat, SRGBColorSpace } from "three";

const TEXTURE_WIDTH = 256;
// One shade profile from an outward ridge, through the inward crease, to
// the next ridge. The broad slope values keep the black cloth readable even
// on faces outside the key light.
const FOLD_TONES = [0.76, 0.43, 0.27, 0.24, 0.21, 0.36, 0.48, 0.56, 0.76] as const;

const foldShade = (section: number): number => {
  const sample = ((section % 2) / 2) * (FOLD_TONES.length - 1);
  const left = Math.floor(sample);
  const fraction = sample - left;
  return FOLD_TONES[left] * (1 - fraction) + FOLD_TONES[left + 1] * fraction;
};

export const createBellowsFabricTexture = (sectionCount: number): DataTexture => {
  const texels = new Uint8Array(TEXTURE_WIDTH * 4);
  const lastSection = sectionCount - 1;
  const color = new Color();
  for (let x = 0; x < TEXTURE_WIDTH; x += 1) {
    const section = ((x + 0.5) / TEXTURE_WIDTH) * lastSection;
    // The two terminal sections seat against the collars and are not ridges.
    const collarFade = Math.min(1, section * 3, (lastSection - section) * 3);
    const linearShade = 0.37 + (foldShade(section) - 0.37) * collarFade;
    const shade = Math.round(color.setScalar(linearShade).getRGB(color, SRGBColorSpace).r * 255);
    const channel = x * 4;
    texels[channel] = shade;
    texels[channel + 1] = shade;
    texels[channel + 2] = shade;
    texels[channel + 3] = 255;
  }
  const texture = new DataTexture(texels, TEXTURE_WIDTH, 1, RGBAFormat);
  texture.name = "bellows-fabric-fold-shading";
  texture.colorSpace = SRGBColorSpace;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearFilter;
  texture.needsUpdate = true;
  return texture;
};

/** A strip follows the indexed sections while their positions and normals deform. */
export const createBellowsFabricUv = (sectionCount: number, vertexCount: number): Float32Array => {
  const uv = new Float32Array(vertexCount * 2);
  const verticesPerSection = vertexCount / sectionCount;
  for (let vertex = 0; vertex < vertexCount; vertex += 1) {
    uv[vertex * 2] = Math.floor(vertex / verticesPerSection) / (sectionCount - 1);
    uv[vertex * 2 + 1] = 0.5;
  }
  return uv;
};
