export type DofBlurInput = {
  normalizedDefocus: number;
  circleOfConfusionMm: number;
  filmWidthMm: number;
  renderWidthPx: number;
  maximumBlurRadiusPx: number;
};

export function calculateBoundaryCoCDiameterPx(
  circleOfConfusionMm: number,
  filmWidthMm: number,
  renderWidthPx: number,
): number {
  if (!Number.isFinite(circleOfConfusionMm) || circleOfConfusionMm <= 0) return 0;
  if (!Number.isFinite(filmWidthMm) || filmWidthMm <= 0) return 0;
  if (!Number.isFinite(renderWidthPx) || renderWidthPx <= 0) return 0;
  const diameterPx = (circleOfConfusionMm * renderWidthPx) / filmWidthMm;
  return Number.isFinite(diameterPx) && diameterPx >= 0 ? diameterPx : 0;
}

export function calculateBoundaryBlurRadiusPx(
  circleOfConfusionMm: number,
  filmWidthMm: number,
  renderWidthPx: number,
): number {
  const diameter = calculateBoundaryCoCDiameterPx(circleOfConfusionMm, filmWidthMm, renderWidthPx);
  return diameter / 2;
}

export function calculateDofBlurRadiusPx(input: DofBlurInput): number {
  const {
    normalizedDefocus,
    circleOfConfusionMm,
    filmWidthMm,
    renderWidthPx,
    maximumBlurRadiusPx,
  } = input;

  const boundaryRadiusPx = calculateBoundaryBlurRadiusPx(
    circleOfConfusionMm,
    filmWidthMm,
    renderWidthPx,
  );

  // An unresolved sample must fail closed. Returning the maximum radius here
  // turns an upstream invalid wedge into a full-frame-looking blur and makes
  // numerical defects much harder to diagnose.
  if (
    !Number.isFinite(normalizedDefocus) ||
    !Number.isFinite(maximumBlurRadiusPx) ||
    maximumBlurRadiusPx < 0
  ) {
    return 0;
  }
  if (normalizedDefocus <= 0) return 0;

  const radius = normalizedDefocus * boundaryRadiusPx;
  if (!Number.isFinite(radius) || Number.isNaN(radius)) return 0;
  return Math.min(maximumBlurRadiusPx, Math.max(0, radius));
}
