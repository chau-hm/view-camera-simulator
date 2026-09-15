export type MacroFocusMetrics = {
  /** Full lens-to-film distance, not additional travel beyond infinity focus. */
  bellowsExtensionMm: number;
  /** Positive image-to-object size ratio; image inversion is not encoded here. */
  magnification: number;
  bellowsFactor: number;
  exposureCompensationStops: number;
};

/**
 * Metrics for a real, finite thin-lens focus solution, with distances in mm.
 * Callers supply canonical conjugate distances; this helper does not solve or
 * round focus geometry. The exposure model assumes a symmetric thin lens.
 */
export const deriveMacroFocusMetrics = ({
  focalLengthMm,
  objectDistanceMm,
  imageDistanceMm,
}: {
  focalLengthMm: number;
  objectDistanceMm: number;
  imageDistanceMm: number;
}): MacroFocusMetrics | null => {
  if (
    !Number.isFinite(focalLengthMm) || focalLengthMm <= 0 ||
    !Number.isFinite(objectDistanceMm) || objectDistanceMm <= focalLengthMm ||
    !Number.isFinite(imageDistanceMm) || imageDistanceMm <= focalLengthMm
  ) {
    return null;
  }

  const magnification = imageDistanceMm / objectDistanceMm;
  const bellowsFactor = (imageDistanceMm / focalLengthMm) ** 2;
  const exposureCompensationStops = Math.log2(bellowsFactor);
  if (
    !Number.isFinite(magnification) || magnification <= 0 ||
    !Number.isFinite(bellowsFactor) ||
    !Number.isFinite(exposureCompensationStops)
  ) {
    return null;
  }

  return {
    bellowsExtensionMm: imageDistanceMm,
    magnification,
    bellowsFactor,
    exposureCompensationStops,
  };
};
