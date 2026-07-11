import { formatMillimeter } from "../utils/formatters";

export type GroundGlassFocusLabelInput = {
  isRttScene: boolean;
  isInfinityFocus: boolean;
  focusDistanceMm: number;
  lastFiniteFocusDepthMm?: number | null;
  primaryTarget?: {
    sharpness?: number; // 0..1
    normalizedDefocus?: number; // -inf..inf
    distanceToFocusPlaneMm?: number;
  } | null;
  legacyDistanceToFocusPlaneMm?: number;
};

export function formatGroundGlassFocusLabel(input: GroundGlassFocusLabelInput): string {
  const {
    isRttScene,
    isInfinityFocus,
    focusDistanceMm,
    lastFiniteFocusDepthMm,
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

  const base = Number.isFinite(focusDistanceMm) ? formatMillimeter(focusDistanceMm) : "—";

  if (primaryTarget && typeof primaryTarget.sharpness === "number") {
    const sharpPct = Math.round((primaryTarget.sharpness ?? 0) * 100);
    if (typeof primaryTarget.normalizedDefocus === "number") {
      const nd = primaryTarget.normalizedDefocus;
      return `${base} / defocus ${nd.toFixed(2)} (${sharpPct}%)`;
    }
    return `${base} / target ${sharpPct}%`;
  }

  // fallback: just show focus distance
  return base;
}
