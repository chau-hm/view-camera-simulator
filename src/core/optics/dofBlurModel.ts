export type DofBlurInput = {
  normalizedDefocus: number;
  circleOfConfusionMm: number;
  filmWidthMm: number;
  renderWidthPx: number;
  maximumBlurRadiusPx: number;
  displayBlurScale?: number;
};

export function calculateBoundaryCoCDiameterPx(
  circleOfConfusionMm: number,
  filmWidthMm: number,
  renderWidthPx: number,
): number {
  if (!Number.isFinite(circleOfConfusionMm) || circleOfConfusionMm <= 0) return 0;
  if (!Number.isFinite(filmWidthMm) || filmWidthMm <= 0) return 0;
  if (!Number.isFinite(renderWidthPx) || renderWidthPx <= 0) return 0;
  return (circleOfConfusionMm * renderWidthPx) / filmWidthMm;
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
    displayBlurScale = 1,
  } = input;

  const boundaryRadiusPx = calculateBoundaryBlurRadiusPx(
    circleOfConfusionMm,
    filmWidthMm,
    renderWidthPx,
  );

  if (!Number.isFinite(normalizedDefocus) || Number.isNaN(normalizedDefocus))
    return maximumBlurRadiusPx;
  if (normalizedDefocus <= 0) return 0;

  const radius = normalizedDefocus * boundaryRadiusPx * displayBlurScale;
  if (!Number.isFinite(radius) || Number.isNaN(radius)) return 0;
  return Math.min(maximumBlurRadiusPx, Math.max(0, radius));
}
