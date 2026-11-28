/**
 * Compare paired RGBA readbacks of one unchanged scene in Raw and Upright
 * display orientation. Both arrays must use the same raster origin.
 * This measures image correspondence, not whether the frames are current.
 */
export function compareGroundGlassOrientations(
  raw: Uint8Array,
  upright: Uint8Array,
  width: number,
  height: number,
  maximumMeanError: number,
  minimumAlternativeSeparation: number,
) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 2 || height < 2 ||
      raw.length !== width * height * 4 || upright.length !== raw.length ||
      !Number.isFinite(maximumMeanError) || maximumMeanError < 0 ||
      !Number.isFinite(minimumAlternativeSeparation) || minimumAlternativeSeparation <= 0) {
    throw new Error("Invalid orientation readback or comparison limits");
  }

  const sums = { rotated: 0, horizontal: 0, vertical: 0, unchanged: 0 };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const rawOffset = (y * width + x) * 4;
      const offsets = {
        rotated: ((height - 1 - y) * width + width - 1 - x) * 4,
        horizontal: (y * width + width - 1 - x) * 4,
        vertical: ((height - 1 - y) * width + x) * 4,
        unchanged: rawOffset,
      };
      for (const key of Object.keys(sums) as Array<keyof typeof sums>) {
        for (let channel = 0; channel < 3; channel++) {
          sums[key] += Math.abs(raw[rawOffset + channel] - upright[offsets[key] + channel]);
        }
      }
    }
  }
  const count = width * height * 3;
  const errors = {
    rotated: sums.rotated / count,
    horizontal: sums.horizontal / count,
    vertical: sums.vertical / count,
    unchanged: sums.unchanged / count,
  };
  const closestAlternative = Math.min(errors.horizontal, errors.vertical, errors.unchanged);
  return {
    errors,
    accepted: errors.rotated <= maximumMeanError &&
      closestAlternative - errors.rotated >= minimumAlternativeSeparation,
  };
}
