/**
 * Converts a physical film-plane ellipse into raw Ground Glass RTT pixels.
 *
 * The supplied orientation is defined in the physical film basis: +X points
 * toward the film right edge and +Y points toward the film top edge. Raw RTT
 * coordinates use U rightward and V downward, so physical +Y maps to -V.
 * Preview-upright inversion is intentionally not part of this conversion.
 */
export type GroundGlassFootprintPixelAxes = {
  majorAxisPx: readonly [number, number];
  minorAxisPx: readonly [number, number];
};

export const groundGlassFootprintAxesToRttPixels = (input: {
  majorRadiusMm: number;
  minorRadiusMm: number;
  orientationRad: number;
  renderWidthPx: number;
  renderHeightPx: number;
  filmWidthMm: number;
  filmHeightMm: number;
}): GroundGlassFootprintPixelAxes => {
  const values = [
    input.majorRadiusMm,
    input.minorRadiusMm,
    input.orientationRad,
    input.renderWidthPx,
    input.renderHeightPx,
    input.filmWidthMm,
    input.filmHeightMm,
  ];
  if (!values.every(Number.isFinite) ||
      input.majorRadiusMm <= 0 ||
      input.minorRadiusMm <= 0 ||
      input.renderWidthPx <= 0 ||
      input.renderHeightPx <= 0 ||
      input.filmWidthMm <= 0 ||
      input.filmHeightMm <= 0) {
    return { majorAxisPx: [0, 0], minorAxisPx: [0, 0] };
  }

  const cos = Math.cos(input.orientationRad);
  const sin = Math.sin(input.orientationRad);
  const scaleX = input.renderWidthPx / input.filmWidthMm;
  const scaleY = input.renderHeightPx / input.filmHeightMm;

  return {
    majorAxisPx: [
      cos * input.majorRadiusMm * scaleX,
      -sin * input.majorRadiusMm * scaleY,
    ],
    minorAxisPx: [
      -sin * input.minorRadiusMm * scaleX,
      -cos * input.minorRadiusMm * scaleY,
    ],
  };
};
