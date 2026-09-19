import type { ApertureValue } from "../types/camera";
import type { FocusTargetSharpness, FocusTargetStatus } from "../types/optics";
import type { SceneMacroTeachingCapability } from "../types/scene";
import {
  resolvePhysicalFocusTargetPresentationMetric,
  type FocusTargetPresentationMetric,
} from "../render/postprocessing/FocusAssistPass";

export type MacroDepthOfFieldRegion = "near" | "middle" | "far";

export type MacroDepthOfFieldTeachingStage =
  | "wide-open"
  | "begin-stopping-down"
  | "moderate-stopping-down"
  | "minimum-aperture";

export type MacroDepthOfFieldTeachingModel = {
  stage: MacroDepthOfFieldTeachingStage;
  aperture: ApertureValue;
  focusObjectDistanceMm: number;
  focusedRegion: MacroDepthOfFieldRegion;
  metrics: Record<MacroDepthOfFieldRegion, FocusTargetPresentationMetric>;
  softRegions: MacroDepthOfFieldRegion[];
  statuses: Record<MacroDepthOfFieldRegion, FocusTargetStatus>;
};

const REGION_ORDER: readonly MacroDepthOfFieldRegion[] = ["near", "middle", "far"];

const TARGET_ID_BY_REGION: Record<MacroDepthOfFieldRegion, string> = {
  near: "macro-depth-near",
  middle: "macro-depth-middle",
  far: "macro-depth-far",
};

const REGION_BY_TARGET_ID = Object.fromEntries(
  Object.entries(TARGET_ID_BY_REGION).map(([region, targetId]) => [targetId, region]),
) as Record<string, MacroDepthOfFieldRegion>;

export const resolveMacroDepthOfFieldTeachingStage = (
  aperture: ApertureValue,
): MacroDepthOfFieldTeachingStage => {
  if (aperture === 5.6) return "wide-open";
  if (aperture <= 11) return "begin-stopping-down";
  if (aperture < 32) return "moderate-stopping-down";
  return "minimum-aperture";
};

const resolveStrongestRegion = (
  metrics: Record<MacroDepthOfFieldRegion, FocusTargetPresentationMetric>,
): MacroDepthOfFieldRegion =>
  REGION_ORDER.reduce((strongest, region) =>
    metrics[region].sharpness > metrics[strongest].sharpness ? region : strongest,
  "middle");

/**
 * Resolve Scene 2 teaching state from the same strict physical patch metrics
 * that power Focus Distribution. This model only interprets canonical output;
 * it does not re-solve focus or depth of field.
 */
export const resolveMacroDepthOfFieldTeaching = ({
  capability,
  focusObjectDistanceMm,
  aperture,
  focusTargets,
}: {
  capability?: SceneMacroTeachingCapability;
  focusObjectDistanceMm: number | null | undefined;
  aperture: ApertureValue;
  focusTargets: readonly FocusTargetSharpness[];
}): MacroDepthOfFieldTeachingModel | null => {
  if (
    capability?.kind !== "depth-of-field" ||
    typeof focusObjectDistanceMm !== "number" ||
    !Number.isFinite(focusObjectDistanceMm) ||
    focusObjectDistanceMm <= 0
  ) {
    return null;
  }

  const metrics = {} as Record<MacroDepthOfFieldRegion, FocusTargetPresentationMetric>;
  for (const target of focusTargets) {
    const region = REGION_BY_TARGET_ID[target.id];
    if (!region) continue;
    const metric = resolvePhysicalFocusTargetPresentationMetric(target, "patch");
    if (metric.equivalentCoCDiameterMm === null) return null;
    metrics[region] = metric;
  }

  if (REGION_ORDER.some((region) => !metrics[region])) return null;

  const statuses = REGION_ORDER.reduce(
    (result, region) => {
      result[region] = metrics[region].status;
      return result;
    },
    {} as Record<MacroDepthOfFieldRegion, FocusTargetStatus>,
  );

  return {
    stage: resolveMacroDepthOfFieldTeachingStage(aperture),
    aperture,
    focusObjectDistanceMm,
    focusedRegion: resolveStrongestRegion(metrics),
    metrics,
    softRegions: REGION_ORDER.filter((region) => statuses[region] === "soft"),
    statuses,
  };
};

