import type { MacroFocusMetrics } from "../core/optics/deriveMacroFocusMetrics";
import { CAMERA_CONTROL_STEPS } from "../utils/constants";
import type { SceneMacroTeachingCapability } from "../types/scene";

export type MacroBellowsExtensionTeachingStage =
  | "early"
  | "intermediate"
  | "near-life-size"
  | "life-size";

export type MacroBellowsExtensionTeachingModel = {
  stage: MacroBellowsExtensionTeachingStage;
  metrics: MacroFocusMetrics;
  focusObjectDistanceMm: number;
  availableBellowsTravelMm: number;
  capacityWarning: boolean;
  lifeSize: boolean;
};

const INTERMEDIATE_MAGNIFICATION = 0.4;
const NEAR_LIFE_SIZE_MAGNIFICATION = 0.8;
export const MACRO_BELLOWS_CAPACITY_WARNING_FRACTION = 0.85;

export const isMacroBellowsCapacityWarning = ({
  bellowsExtensionMm,
  availableBellowsTravelMm,
}: {
  bellowsExtensionMm: number;
  availableBellowsTravelMm: number;
}): boolean =>
  Number.isFinite(bellowsExtensionMm) &&
  Number.isFinite(availableBellowsTravelMm) &&
  availableBellowsTravelMm > 0 &&
  bellowsExtensionMm >= availableBellowsTravelMm * MACRO_BELLOWS_CAPACITY_WARNING_FRACTION;

/**
 * A public focus step is the useful tolerance for the life-size indication.
 * This keeps the teaching milestone reachable without using exact float equality.
 */
export const isMacroLifeSizeMagnification = ({
  magnification,
  focusObjectDistanceMm,
}: {
  magnification: number;
  focusObjectDistanceMm: number;
}): boolean => {
  if (!Number.isFinite(magnification) || !Number.isFinite(focusObjectDistanceMm) || focusObjectDistanceMm <= 0) {
    return false;
  }
  const tolerance = CAMERA_CONTROL_STEPS.focusDistanceMm / Math.max(1, Math.abs(focusObjectDistanceMm));
  return Math.abs(magnification - 1) <= tolerance;
};

/**
 * Formats a positive magnification as a learner-facing reproduction ratio.
 * Scene 1 stays within the usual 1:n macro domain, while the fallback also
 * keeps the formatter sensible if a future finite scene exceeds life size.
 */
export const formatMacroReproductionRatio = (magnification: number): string => {
  if (!Number.isFinite(magnification) || magnification <= 0) return "—";
  if (Math.abs(magnification - 1) <= 1e-9) return "1:1";

  const reciprocal = magnification < 1 ? 1 / magnification : magnification;
  const rounded = Math.round(reciprocal * 100) / 100;
  const formatted = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  return magnification < 1 ? `1:${formatted}` : `${formatted}:1`;
};

export const resolveMacroBellowsExtensionTeaching = ({
  capability,
  metrics,
  focusObjectDistanceMm,
}: {
  capability?: SceneMacroTeachingCapability;
  metrics: MacroFocusMetrics | null;
  focusObjectDistanceMm: number | null | undefined;
}): MacroBellowsExtensionTeachingModel | null => {
  if (
    capability?.kind !== "bellows-extension" ||
    !metrics ||
    typeof focusObjectDistanceMm !== "number" ||
    !Number.isFinite(focusObjectDistanceMm) ||
    focusObjectDistanceMm <= 0 ||
    !Number.isFinite(capability.availableBellowsTravelMm) ||
    capability.availableBellowsTravelMm <= 0
  ) {
    return null;
  }

  const resolvedFocusObjectDistanceMm = focusObjectDistanceMm as number;
  const lifeSize = isMacroLifeSizeMagnification({
    magnification: metrics.magnification,
    focusObjectDistanceMm: resolvedFocusObjectDistanceMm,
  });
  const stage: MacroBellowsExtensionTeachingStage = lifeSize
    ? "life-size"
    : metrics.magnification >= NEAR_LIFE_SIZE_MAGNIFICATION
      ? "near-life-size"
      : metrics.magnification >= INTERMEDIATE_MAGNIFICATION
        ? "intermediate"
        : "early";

  return {
    stage,
    metrics,
    focusObjectDistanceMm: resolvedFocusObjectDistanceMm,
    availableBellowsTravelMm: capability.availableBellowsTravelMm,
    capacityWarning: isMacroBellowsCapacityWarning({
      bellowsExtensionMm: metrics.bellowsExtensionMm,
      availableBellowsTravelMm: capability.availableBellowsTravelMm,
    }),
    lifeSize,
  };
};
