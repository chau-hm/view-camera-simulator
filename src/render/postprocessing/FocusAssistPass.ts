import type { FocusTargetSharpness, FocusTargetStatus } from "../../types/optics";

export type FocusAssistMetric = "point" | "patch";

export type FocusAssistPassConfig = {
  enabled: boolean;
  targets: FocusTargetSharpness[];
  metric?: FocusAssistMetric;
};

export type FocusTargetPresentationMetric = {
  sharpness: number;
  status: FocusTargetStatus;
  equivalentCoCDiameterMm?: number | null;
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

/**
 * Resolve the learner-facing metric while keeping old task/fixture objects
 * compatible. Normal derived optics always provide the physical fields.
 */
export const resolveFocusTargetPresentationMetric = (
  target: FocusTargetSharpness,
  metric: FocusAssistMetric = "patch",
): FocusTargetPresentationMetric => {
  const usePoint = metric === "point";
  const physicalSharpness = usePoint
    ? target.physicalPointSharpness
    : target.physicalPatchSharpness;
  if (typeof physicalSharpness === "number" && Number.isFinite(physicalSharpness)) {
    return {
      sharpness: physicalSharpness,
      status: usePoint
        ? target.physicalPointStatus ?? target.status
        : target.physicalPatchStatus ?? target.status,
      equivalentCoCDiameterMm: usePoint
        ? target.pointEquivalentCoCDiameterMm
        : target.patchEquivalentCoCDiameterMm,
    };
  }

  return {
    sharpness: usePoint
      ? (target.pointSharpness ?? target.sharpness)
      : (target.patchSharpness ?? target.sharpness),
    status: usePoint ? (target.pointStatus ?? target.status) : (target.patchStatus ?? target.status),
  };
};

export const createFocusAssistPass = (config: FocusAssistPassConfig): FocusAssistPassResult => ({
  enabled: config.enabled,
  targets: config.targets.map((target) => {
    const metric = resolveFocusTargetPresentationMetric(target, config.metric);
    return {
      id: target.id,
      status: metric.status,
      pattern: statusPatternMap[metric.status],
      sharpnessPercent: Math.round(metric.sharpness * 100),
    };
  }),
});
