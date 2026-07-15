export type GroundGlassRenderSanity = {
  sampleCount: number;
  opaquePixelCount: number;
  nonBackgroundPixelCount: number;
  luminanceVariance: number;
  contentful: boolean;
};

const SKY_RGB = { r: 223, g: 229, b: 236 } as const;

/** Analyze a small GPU-downsampled RGBA buffer without reading the full RTT. */
export function analyzeGroundGlassRenderSanity(
  pixels: Uint8Array,
): GroundGlassRenderSanity {
  const sampleCount = Math.floor(pixels.length / 4);
  if (sampleCount === 0) {
    return {
      sampleCount: 0,
      opaquePixelCount: 0,
      nonBackgroundPixelCount: 0,
      luminanceVariance: 0,
      contentful: false,
    };
  }

  let opaquePixelCount = 0;
  let nonBackgroundPixelCount = 0;
  let luminanceSum = 0;
  let luminanceSquareSum = 0;

  for (let index = 0; index < sampleCount; index += 1) {
    const offset = index * 4;
    const r = pixels[offset];
    const g = pixels[offset + 1];
    const b = pixels[offset + 2];
    const a = pixels[offset + 3];
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    luminanceSum += luminance;
    luminanceSquareSum += luminance * luminance;
    if (a >= 240) opaquePixelCount += 1;
    const colorDistance = Math.hypot(r - SKY_RGB.r, g - SKY_RGB.g, b - SKY_RGB.b);
    if (a >= 240 && colorDistance >= 12) nonBackgroundPixelCount += 1;
  }

  const mean = luminanceSum / sampleCount;
  const luminanceVariance = Math.max(0, luminanceSquareSum / sampleCount - mean * mean);
  const contentful =
    opaquePixelCount >= sampleCount * 0.95 &&
    nonBackgroundPixelCount >= Math.max(4, sampleCount * 0.02) &&
    luminanceVariance >= 4;

  return {
    sampleCount,
    opaquePixelCount,
    nonBackgroundPixelCount,
    luminanceVariance,
    contentful,
  };
}
