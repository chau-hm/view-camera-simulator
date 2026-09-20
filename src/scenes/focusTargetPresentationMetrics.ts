import type { FocusTargetPresentationMetric } from "../render/postprocessing/FocusAssistPass";

/**
 * Compare learner-facing physical target metrics from strongest to weakest.
 * Bounded sharpness can saturate at zero, so equivalent film-space CoC is the
 * physical tie-breaker rather than target order or scene distance.
 */
export const compareFocusTargetPresentationMetrics = (
  candidate: FocusTargetPresentationMetric,
  current: FocusTargetPresentationMetric,
): number => {
  if (candidate.sharpness !== current.sharpness) {
    return candidate.sharpness - current.sharpness;
  }

  if (candidate.equivalentCoCDiameterMm === null) {
    return current.equivalentCoCDiameterMm === null ? 0 : -1;
  }
  if (current.equivalentCoCDiameterMm === null) return 1;

  return current.equivalentCoCDiameterMm - candidate.equivalentCoCDiameterMm;
};
