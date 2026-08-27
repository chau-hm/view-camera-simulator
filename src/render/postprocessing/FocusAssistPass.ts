import type { FocusTargetSharpness, FocusTargetStatus } from "../../types/optics";
import { focusTargetStatusForSharpness } from "../../core/optics/physicalSharpness";

export type FocusAssistMetric = "point" | "patch";

export type FocusAssistPassConfig = {
  enabled: boolean;
  targets: FocusTargetSharpness[];
  metric?: FocusAssistMetric;
};

export type FocusTargetPresentationMetric = {
  sharpness: number;
  status: FocusTargetStatus;
  equivalentCoCDiameterMm: number | null;
};

export type FocusAssistDisplayTarget = {
  id: string;
  status: FocusTargetSharpness["status"];
  pattern: "solid" | "hatch" | "cross";
  sharpnessPercent: number;
};

export type FocusAssistPassResult = {
  enabled: boolean;
  targets: FocusAssistDisplayTarget[];
};

const statusPatternMap: Record<FocusTargetSharpness["status"], FocusAssistDisplayTarget["pattern"]> = {
  sharp: "solid",
  acceptable: "hatch",
  soft: "cross",
};

const unresolvedPhysicalPresentationMetric = (): FocusTargetPresentationMetric => ({
  sharpness: 0,
  status: "soft",
  equivalentCoCDiameterMm: null,
});

const isValidPhysicalPresentationMetric = (
  sharpness: unknown,
  equivalentCoCDiameterMm: unknown,
): sharpness is number =>
  typeof sharpness === "number" &&
  Number.isFinite(sharpness) &&
  sharpness >= 0 &&
  sharpness <= 1 &&
  typeof equivalentCoCDiameterMm === "number" &&
  Number.isFinite(equivalentCoCDiameterMm) &&
  equivalentCoCDiameterMm >= 0;

/**
 * Resolve the strict learner-facing physical metric.
 *
 * Normal derived optics always provide both the bounded physical score and its
 * equivalent film-space CoC. Missing or invalid physical data fails closed;
 * legacy wedge scores are intentionally not a presentation fallback.
 */
export const resolvePhysicalFocusTargetPresentationMetric = (
  target: FocusTargetSharpness,
  metric: FocusAssistMetric = "patch",
): FocusTargetPresentationMetric => {
  const usePoint = metric === "point";
  const physicalSharpness = usePoint
    ? target.physicalPointSharpness
    : target.physicalPatchSharpness;
  const equivalentCoCDiameterMm = usePoint
    ? target.pointEquivalentCoCDiameterMm
    : target.patchEquivalentCoCDiameterMm;
  if (!isValidPhysicalPresentationMetric(physicalSharpness, equivalentCoCDiameterMm)) {
    return unresolvedPhysicalPresentationMetric();
  }
  return {
    sharpness: physicalSharpness,
    status: focusTargetStatusForSharpness(physicalSharpness),
    equivalentCoCDiameterMm: equivalentCoCDiameterMm as number,
  };
};

/**
 * @deprecated Use the explicitly named physical resolver. This compatibility
 * alias is strict as well and never falls back to legacy wedge fields.
 */
export const resolveFocusTargetPresentationMetric =
  resolvePhysicalFocusTargetPresentationMetric;

export const createFocusAssistPass = (config: FocusAssistPassConfig): FocusAssistPassResult => ({
  enabled: config.enabled,
  targets: config.targets.map((target) => {
    const metric = resolvePhysicalFocusTargetPresentationMetric(target, config.metric);
    return {
      id: target.id,
      status: metric.status,
      pattern: statusPatternMap[metric.status],
      sharpnessPercent: Math.round(metric.sharpness * 100),
    };
  }),
});
