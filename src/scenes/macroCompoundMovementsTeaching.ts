import type { FocusTargetSharpness, FocusTargetStatus } from "../types/optics";
import type { SceneMacroTeachingCapability } from "../types/scene";
import {
  resolvePhysicalFocusTargetPresentationMetric,
  type FocusTargetPresentationMetric,
} from "../render/postprocessing/FocusAssistPass";
import { CAMERA_CONTROL_STEPS } from "../utils/constants";
import { compareFocusTargetPresentationMetrics } from "./focusTargetPresentationMetrics";

export type MacroCompoundMovementsRegion = "near-left" | "centre" | "far-right";

export type MacroCompoundMovementsTeachingStage =
  | "focus-exploration"
  | "tilt-only"
  | "swing-only"
  | "compound-alignment"
  | "refine-compound"
  | "aligned";

export type MacroCompoundMovementsTeachingModel = {
  stage: MacroCompoundMovementsTeachingStage;
  frontTiltDeg: number;
  frontSwingDeg: number;
  focusObjectDistanceMm: number;
  metrics: Record<MacroCompoundMovementsRegion, FocusTargetPresentationMetric>;
  statuses: Record<MacroCompoundMovementsRegion, FocusTargetStatus>;
  sharpRegions: MacroCompoundMovementsRegion[];
  acceptableRegions: MacroCompoundMovementsRegion[];
  softRegions: MacroCompoundMovementsRegion[];
  sharpCount: number;
  strongestRegion: MacroCompoundMovementsRegion;
  weakestRegion: MacroCompoundMovementsRegion;
  tiltNeutral: boolean;
  swingNeutral: boolean;
  allSharp: boolean;
};

export const MACRO_COMPOUND_MOVEMENTS_REGION_ORDER: readonly MacroCompoundMovementsRegion[] = [
  "near-left",
  "centre",
  "far-right",
];

const TARGET_ID_BY_REGION: Record<MacroCompoundMovementsRegion, string> = {
  "near-left": "macro-compound-near-left",
  centre: "macro-compound-centre",
  "far-right": "macro-compound-far-right",
};

const REGION_BY_TARGET_ID = Object.fromEntries(
  Object.entries(TARGET_ID_BY_REGION).map(([region, targetId]) => [targetId, region]),
) as Record<string, MacroCompoundMovementsRegion>;

/** Public-step neutral means that the learner has not applied Front Tilt. */
export const isMacroCompoundMovementsNeutralTilt = (frontTiltDeg: number): boolean =>
  Number.isFinite(frontTiltDeg) &&
  Math.abs(frontTiltDeg) < CAMERA_CONTROL_STEPS.tiltDeg / 2;

/** Public-step neutral means that the learner has not applied Front Swing. */
export const isMacroCompoundMovementsNeutralSwing = (frontSwingDeg: number): boolean =>
  Number.isFinite(frontSwingDeg) &&
  Math.abs(frontSwingDeg) < CAMERA_CONTROL_STEPS.swingDeg / 2;

const resolveStrongestRegion = (
  metrics: Record<MacroCompoundMovementsRegion, FocusTargetPresentationMetric>,
): MacroCompoundMovementsRegion =>
  MACRO_COMPOUND_MOVEMENTS_REGION_ORDER.reduce(
    (strongest, region) =>
      compareFocusTargetPresentationMetrics(metrics[region], metrics[strongest]) > 0
        ? region
        : strongest,
    "near-left",
  );

const resolveWeakestRegion = (
  metrics: Record<MacroCompoundMovementsRegion, FocusTargetPresentationMetric>,
): MacroCompoundMovementsRegion =>
  MACRO_COMPOUND_MOVEMENTS_REGION_ORDER.reduce(
    (weakest, region) =>
      compareFocusTargetPresentationMetrics(metrics[region], metrics[weakest]) < 0
        ? region
        : weakest,
    "near-left",
  );

/**
 * Resolve Scene 4 teaching state from the physical patch metrics used by
 * Focus Distribution. This model interprets the canonical optics output; it
 * does not solve the compound plane or compare controls to a stored answer.
 */
export const resolveMacroCompoundMovementsTeaching = ({
  capability,
  frontTiltDeg,
  frontSwingDeg,
  focusObjectDistanceMm,
  focusTargets,
}: {
  capability?: SceneMacroTeachingCapability;
  frontTiltDeg: number;
  frontSwingDeg: number;
  focusObjectDistanceMm: number | null | undefined;
  focusTargets: readonly FocusTargetSharpness[];
}): MacroCompoundMovementsTeachingModel | null => {
  if (
    capability?.kind !== "compound-movements" ||
    !Number.isFinite(frontTiltDeg) ||
    !Number.isFinite(frontSwingDeg) ||
    typeof focusObjectDistanceMm !== "number" ||
    !Number.isFinite(focusObjectDistanceMm) ||
    focusObjectDistanceMm <= 0
  ) {
    return null;
  }

  const metrics = {} as Record<MacroCompoundMovementsRegion, FocusTargetPresentationMetric>;
  for (const target of focusTargets) {
    const region = REGION_BY_TARGET_ID[target.id];
    if (!region) continue;
    const metric = resolvePhysicalFocusTargetPresentationMetric(target, "patch");
    if (metric.equivalentCoCDiameterMm === null) return null;
    metrics[region] = metric;
  }

  if (MACRO_COMPOUND_MOVEMENTS_REGION_ORDER.some((region) => !metrics[region])) {
    return null;
  }

  const statuses = MACRO_COMPOUND_MOVEMENTS_REGION_ORDER.reduce(
    (result, region) => {
      result[region] = metrics[region].status;
      return result;
    },
    {} as Record<MacroCompoundMovementsRegion, FocusTargetStatus>,
  );
  const sharpRegions = MACRO_COMPOUND_MOVEMENTS_REGION_ORDER.filter(
    (region) => statuses[region] === "sharp",
  );
  const acceptableRegions = MACRO_COMPOUND_MOVEMENTS_REGION_ORDER.filter(
    (region) => statuses[region] === "acceptable",
  );
  const softRegions = MACRO_COMPOUND_MOVEMENTS_REGION_ORDER.filter(
    (region) => statuses[region] === "soft",
  );
  const sharpCount = sharpRegions.length;
  const allSharp = sharpCount === MACRO_COMPOUND_MOVEMENTS_REGION_ORDER.length;
  const tiltNeutral = isMacroCompoundMovementsNeutralTilt(frontTiltDeg);
  const swingNeutral = isMacroCompoundMovementsNeutralSwing(frontSwingDeg);

  const stage: MacroCompoundMovementsTeachingStage = allSharp
    ? "aligned"
    : !tiltNeutral && !swingNeutral && sharpCount === 2
      ? "refine-compound"
      : !tiltNeutral && !swingNeutral
        ? "compound-alignment"
        : !tiltNeutral
          ? "tilt-only"
          : !swingNeutral
            ? "swing-only"
            : "focus-exploration";

  return {
    stage,
    frontTiltDeg,
    frontSwingDeg,
    focusObjectDistanceMm,
    metrics,
    statuses,
    sharpRegions,
    acceptableRegions,
    softRegions,
    sharpCount,
    strongestRegion: resolveStrongestRegion(metrics),
    weakestRegion: resolveWeakestRegion(metrics),
    tiltNeutral,
    swingNeutral,
    allSharp,
  };
};
