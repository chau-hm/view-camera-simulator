import type { FocusTargetSharpness } from "../../types/optics";

export type FocusAssistPassConfig = {
  enabled: boolean;
  targets: FocusTargetSharpness[];
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
  targets: config.targets.map((target) => ({
    id: target.id,
    status: target.status,
    pattern: statusPatternMap[target.status],
    sharpnessPercent: Math.round(target.sharpness * 100),
  })),
});
