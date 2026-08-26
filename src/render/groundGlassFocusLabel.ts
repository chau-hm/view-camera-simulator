import type { FocusTargetPresentationMetric } from "./postprocessing/FocusAssistPass";
import { formatMillimeter } from "../utils/formatters";

export type GroundGlassFocusLabelInput = {
  isRttScene: boolean;
  isInfinityFocus: boolean;
  focusDistanceMm: number;
  lastFiniteFocusDepthMm?: number | null;
  /** Strict physical film-space metric selected by the presentation boundary. */
  primaryTarget?: FocusTargetPresentationMetric | null;
  legacyDistanceToFocusPlaneMm?: number;
};

export function formatGroundGlassFocusLabel(input: GroundGlassFocusLabelInput): string {
  const {
    isRttScene,
    isInfinityFocus,
    focusDistanceMm,
    primaryTarget,
    legacyDistanceToFocusPlaneMm,
  } = input;

  if (!isRttScene) {
    // legacy behaviour: keep previous delta if provided, otherwise show focus distance only
    if (
      typeof legacyDistanceToFocusPlaneMm === "number" &&
      Number.isFinite(legacyDistanceToFocusPlaneMm)
    ) {
      const delta = legacyDistanceToFocusPlaneMm;
      const base = Number.isFinite(focusDistanceMm) ? formatMillimeter(focusDistanceMm) : "∞";
      return `${base} / ${Math.round(delta)} mm delta`;
    }
    return Number.isFinite(focusDistanceMm) ? `${formatMillimeter(focusDistanceMm)}` : "∞";
  }

  // RTT scene
  if (isInfinityFocus) {
    return "Focus ∞";
  }

  const base = Number.isFinite(focusDistanceMm) ? `${formatMillimeter(focusDistanceMm)} focus` : "—";

  if (primaryTarget) {
    const sharpPct = Math.round(primaryTarget.sharpness * 100);
    if (primaryTarget.equivalentCoCDiameterMm !== null) {
      return `${base} / CoC ${primaryTarget.equivalentCoCDiameterMm.toFixed(3)} mm (${sharpPct}%)`;
    }
    return `${base} / target ${sharpPct}%`;
  }

  // fallback: just show focus distance
  return base;
}
