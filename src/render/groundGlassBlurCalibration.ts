export const GROUND_GLASS_TARGET_BOUNDARY_BLUR_RADIUS_PX = 1;

export type GroundGlassDisplayBlurCalibrationInput = {
  acceptableCoCDiameterMm: number;
  filmWidthMm: number;
  /** Visible Ground Glass width in CSS pixels, before RTT quality scaling. */
  displayWidthPx: number;
  targetBoundaryBlurRadiusPx?: number;
};

/**
 * Resolve a display-only teaching calibration that maps the acceptable
 * physical CoC boundary to a stable visible radius. This is presentation
 * calibration, not a claim about physical photographic resolution.
 *
 * Callers supply the complete film width and visible preview width. RTT
 * resolution and Focus Loupe crop dimensions are deliberately excluded: the
 * former must not change visible blur size, and the latter must retain its
 * natural visual magnification.
 */
export const resolveGroundGlassDisplayBlurScale = ({
  acceptableCoCDiameterMm,
  filmWidthMm,
  displayWidthPx,
  targetBoundaryBlurRadiusPx = GROUND_GLASS_TARGET_BOUNDARY_BLUR_RADIUS_PX,
}: GroundGlassDisplayBlurCalibrationInput): number => {
  if (
    !Number.isFinite(acceptableCoCDiameterMm) || acceptableCoCDiameterMm <= 0 ||
    !Number.isFinite(filmWidthMm) || filmWidthMm <= 0 ||
    !Number.isFinite(displayWidthPx) || displayWidthPx <= 0 ||
    !Number.isFinite(targetBoundaryBlurRadiusPx) || targetBoundaryBlurRadiusPx <= 0
  ) {
    return 1;
  }

  const physicalBoundaryRadiusPx =
    (acceptableCoCDiameterMm * displayWidthPx / filmWidthMm) / 2;
  const scale = targetBoundaryBlurRadiusPx / physicalBoundaryRadiusPx;
  return Number.isFinite(scale) && scale > 0 ? scale : 1;
};
