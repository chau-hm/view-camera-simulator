import type { FocusTargetSharpness, FocusTargetStatus } from "../types/optics";
import type { SceneMacroTeachingCapability } from "../types/scene";
import {
  resolvePhysicalFocusTargetPresentationMetric,
  type FocusTargetPresentationMetric,
} from "../render/postprocessing/FocusAssistPass";
import { compareFocusTargetPresentationMetrics } from "./focusTargetPresentationMetrics";
import { CAMERA_CONTROL_STEPS } from "../utils/constants";

export type MacroObliquePlaneRegion = "near" | "middle" | "far";

export type MacroObliquePlaneTeachingStage =
  | "parallel-exploration"
  | "tilt-and-focus"
  | "refine-alignment"
  | "aligned";

export type MacroObliquePlaneTeachingModel = {
  stage: MacroObliquePlaneTeachingStage;
  frontTiltDeg: number;
  focusObjectDistanceMm: number;
  metrics: Record<MacroObliquePlaneRegion, FocusTargetPresentationMetric>;
  statuses: Record<MacroObliquePlaneRegion, FocusTargetStatus>;
  sharpRegions: MacroObliquePlaneRegion[];
  acceptableRegions: MacroObliquePlaneRegion[];
  softRegions: MacroObliquePlaneRegion[];
  sharpCount: number;
  strongestRegion: MacroObliquePlaneRegion;
  weakestRegion: MacroObliquePlaneRegion;
  allSharp: boolean;
};

const REGION_ORDER: readonly MacroObliquePlaneRegion[] = ["near", "middle", "far"];

const TARGET_ID_BY_REGION: Record<MacroObliquePlaneRegion, string> = {
  near: "macro-oblique-near",
  middle: "macro-oblique-middle",
  far: "macro-oblique-far",
};

const REGION_BY_TARGET_ID = Object.fromEntries(
  Object.entries(TARGET_ID_BY_REGION).map(([region, targetId]) => [targetId, region]),
) as Record<string, MacroObliquePlaneRegion>;

/** Public-step neutral means that the learner has not applied Front Tilt. */
export const isMacroObliquePlaneNeutralTilt = (frontTiltDeg: number): boolean =>
  Number.isFinite(frontTiltDeg) &&
  Math.abs(frontTiltDeg) < CAMERA_CONTROL_STEPS.tiltDeg / 2;

const resolveStrongestRegion = (
  metrics: Record<MacroObliquePlaneRegion, FocusTargetPresentationMetric>,
): MacroObliquePlaneRegion =>
  REGION_ORDER.reduce(
    (strongest, region) =>
      compareFocusTargetPresentationMetrics(metrics[region], metrics[strongest]) > 0
        ? region
        : strongest,
    "near",
  );

const resolveWeakestRegion = (
  metrics: Record<MacroObliquePlaneRegion, FocusTargetPresentationMetric>,
): MacroObliquePlaneRegion =>
  REGION_ORDER.reduce(
    (weakest, region) =>
      compareFocusTargetPresentationMetrics(metrics[region], metrics[weakest]) < 0
        ? region
        : weakest,
    "near",
  );

/**
 * Resolve Scene 3 teaching state from the strict physical patch metrics used
 * by Focus Distribution. This interprets canonical optics output only; it
 * does not solve Scheimpflug geometry or invent a scene-specific threshold.
 */
export const resolveMacroObliquePlaneTeaching = ({
  capability,
  frontTiltDeg,
  focusObjectDistanceMm,
  focusTargets,
}: {
  capability?: SceneMacroTeachingCapability;
  frontTiltDeg: number;
  focusObjectDistanceMm: number | null | undefined;
  focusTargets: readonly FocusTargetSharpness[];
}): MacroObliquePlaneTeachingModel | null => {
  if (
    capability?.kind !== "oblique-plane" ||
    !Number.isFinite(frontTiltDeg) ||
    typeof focusObjectDistanceMm !== "number" ||
    !Number.isFinite(focusObjectDistanceMm) ||
    focusObjectDistanceMm <= 0
  ) {
    return null;
  }

  const metrics = {} as Record<MacroObliquePlaneRegion, FocusTargetPresentationMetric>;
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
    {} as Record<MacroObliquePlaneRegion, FocusTargetStatus>,
  );
  const sharpRegions = REGION_ORDER.filter((region) => statuses[region] === "sharp");
  const acceptableRegions = REGION_ORDER.filter((region) => statuses[region] === "acceptable");
  const softRegions = REGION_ORDER.filter((region) => statuses[region] === "soft");
  const sharpCount = sharpRegions.length;
  const allSharp = sharpCount === REGION_ORDER.length;
  const neutralTilt = isMacroObliquePlaneNeutralTilt(frontTiltDeg);

  const stage: MacroObliquePlaneTeachingStage = allSharp
    ? "aligned"
    : neutralTilt
      ? "parallel-exploration"
      : sharpCount === 2
        ? "refine-alignment"
        : "tilt-and-focus";

  return {
    stage,
    frontTiltDeg,
    focusObjectDistanceMm,
    metrics,
    statuses,
    sharpRegions,
    acceptableRegions,
    softRegions,
    sharpCount,
    strongestRegion: resolveStrongestRegion(metrics),
    weakestRegion: resolveWeakestRegion(metrics),
    allSharp,
  };
};
