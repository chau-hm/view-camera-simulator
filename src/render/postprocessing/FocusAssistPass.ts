import type { FocusTargetSharpness } from "../../types/optics";

export type FocusAssistPassConfig = {
  enabled: boolean;
  targets: FocusTargetSharpness[];
  metric?: "point" | "patch";
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

export const createFocusAssistPass = (config: FocusAssistPassConfig): FocusAssistPassResult => ({
  enabled: config.enabled,
  targets: config.targets.map((target) => {
    const usePoint = config.metric === "point";
    const sharpness = usePoint ? (target.pointSharpness ?? target.sharpness) : (target.patchSharpness ?? target.sharpness);
    const status = usePoint ? (target.pointStatus ?? target.status) : (target.patchStatus ?? target.status);
    return {
      id: target.id,
      status,
      pattern: statusPatternMap[status],
      sharpnessPercent: Math.round(sharpness * 100),
    };
  }),
});
