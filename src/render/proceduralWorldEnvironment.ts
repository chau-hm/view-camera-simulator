import * as THREE from "three";
import type { WorldProceduralSkyGroundEnvironment } from "./worldIlluminationContract";

export const PROCEDURAL_WORLD_ENVIRONMENT_WIDTH = 128;
export const PROCEDURAL_WORLD_ENVIRONMENT_HEIGHT = 64;

type LinearRgb = readonly [number, number, number];

const srgbChannelToLinear = (channel: number): number =>
  channel <= 0.04045
    ? channel / 12.92
    : ((channel + 0.055) / 1.055) ** 2.4;

const linearChannelToSrgb = (channel: number): number =>
  channel <= 0.0031308
    ? channel * 12.92
    : 1.055 * channel ** (1 / 2.4) - 0.055;

const parseSrgbHexToLinear = (value: string): LinearRgb => {
  const match = /^#([\da-f]{6})$/i.exec(value);
  if (!match) throw new Error(`Expected a six-digit sRGB color, received ${value}`);
  const hex = match[1];
  return [0, 2, 4].map((offset) =>
    srgbChannelToLinear(Number.parseInt(hex.slice(offset, offset + 2), 16) / 255),
  ) as unknown as LinearRgb;
};

const mixLinear = (from: LinearRgb, to: LinearRgb, amount: number): LinearRgb => [
  from[0] + (to[0] - from[0]) * amount,
  from[1] + (to[1] - from[1]) * amount,
  from[2] + (to[2] - from[2]) * amount,
];

const smoothstep = (edge0: number, edge1: number, value: number): number => {
  const t = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

const linearToSrgbByte = (channel: number): number =>
  Math.round(Math.max(0, Math.min(1, linearChannelToSrgb(channel))) * 255);

/**
 * Builds an sRGB-encoded RGBA equirectangular map in a linear-light gradient.
 * A broad, low-contrast sky opening toward world +X gives vertical surfaces a
 * small orientation-dependent reflection cue without introducing a sun or a
 * visible background.
 */
export const createProceduralSkyGroundPixels = (
  environment: WorldProceduralSkyGroundEnvironment,
): Uint8Array => {
  const zenith = parseSrgbHexToLinear(environment.zenithColor);
  const skyHorizon = parseSrgbHexToLinear(environment.skyHorizonColor);
  const groundHorizon = parseSrgbHexToLinear(environment.groundHorizonColor);
  const nadir = parseSrgbHexToLinear(environment.nadirColor);
  const width = PROCEDURAL_WORLD_ENVIRONMENT_WIDTH;
  const height = PROCEDURAL_WORLD_ENVIRONMENT_HEIGHT;
  const pixels = new Uint8Array(width * height * 4);
  const horizonHalfWidth = 0.055;

  for (let y = 0; y < height; y += 1) {
    // DataTexture row zero maps to equirectangular v=0 (the nadir).
    const v = (y + 0.5) / height;
    const altitude = Math.sin((v - 0.5) * Math.PI);
    let verticalColor: LinearRgb;

    if (altitude < -horizonHalfWidth) {
      const groundBlend = smoothstep(
        horizonHalfWidth,
        1,
        -altitude,
      );
      verticalColor = mixLinear(groundHorizon, nadir, groundBlend);
    } else if (altitude > horizonHalfWidth) {
      const skyBlend = smoothstep(0.34, 1, altitude);
      verticalColor = mixLinear(skyHorizon, zenith, skyBlend);
    } else {
      const horizonBlend = smoothstep(
        -horizonHalfWidth,
        horizonHalfWidth,
        altitude,
      );
      verticalColor = mixLinear(groundHorizon, skyHorizon, horizonBlend);
    }

    // Keep the low-frequency daylight opening visible close to the horizon,
    // where vertical glazing reflects its direction. This transition is soft
    // enough to avoid a hard horizon band and deliberately covers only sky.
    const skyOpeningWeight = smoothstep(-0.28, 0.08, altitude);
    for (let x = 0; x < width; x += 1) {
      const u = (x + 0.5) / width;
      const longitude = (u - 0.5) * Math.PI * 2;
      const broadSkyOpening = Math.max(0, Math.cos(longitude)) ** 2;
      const openingBlend = 0.24 * broadSkyOpening * skyOpeningWeight;
      const color = mixLinear(verticalColor, zenith, openingBlend);
      const offset = (y * width + x) * 4;
      pixels[offset] = linearToSrgbByte(color[0]);
      pixels[offset + 1] = linearToSrgbByte(color[1]);
      pixels[offset + 2] = linearToSrgbByte(color[2]);
      pixels[offset + 3] = 255;
    }
  }

  return pixels;
};

export const createProceduralSkyGroundTexture = (
  environment: WorldProceduralSkyGroundEnvironment,
): THREE.DataTexture => {
  const texture = new THREE.DataTexture(
    createProceduralSkyGroundPixels(environment),
    PROCEDURAL_WORLD_ENVIRONMENT_WIDTH,
    PROCEDURAL_WORLD_ENVIRONMENT_HEIGHT,
    THREE.RGBAFormat,
    THREE.UnsignedByteType,
  );
  texture.name = `${environment.id}-source`;
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
};
