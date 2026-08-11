import type { FocusStandard } from "../types/camera";

export type FocusStandardVisualState = {
  active: boolean;
  bodyColor: string;
  detailColor: string;
  lensColor: string;
  emissiveColor: string;
  emissiveIntensity: number;
};

/** Resolve the presentation-only accent for the selected focus standard. */
export const resolveFocusStandardVisualState = (
  standard: FocusStandard,
  activeStandard: FocusStandard | null,
): FocusStandardVisualState => {
  const active = activeStandard === standard;
  if (standard === "front") {
    return {
      active,
      bodyColor: active ? "#2563eb" : "#6b7280",
      detailColor: active ? "#60a5fa" : "#9ca3af",
      lensColor: active ? "#0f172a" : "#1f2937",
      emissiveColor: active ? "#0e7490" : "#000000",
      emissiveIntensity: active ? 0.18 : 0,
    };
  }

  return {
    active,
    bodyColor: active ? "#2563eb" : "#4b5563",
    detailColor: active ? "#60a5fa" : "#4b5563",
    lensColor: active ? "#0f172a" : "#1f2937",
    emissiveColor: active ? "#0e7490" : "#000000",
    emissiveIntensity: active ? 0.18 : 0,
  };
};
