import type { SceneDefinition } from "../../types/scene";

export type GeometryPresentationProfile = {
  depthWindow:
    { mode: "fixed"; minMm: number; maxMm: number } | { mode: "scene-bounds"; marginMm: number };

  annotationMode: "minimal";
  showDepthStrip: boolean;
  showSwatchLegend: boolean;

  targetLabelMode: "none" | "short-local";
  showOpticalAxisLabel: boolean;
  showHingeMarker: boolean;
};

export function getGeometryPresentationProfile(
  scene: SceneDefinition,
): GeometryPresentationProfile {
  // Focus Fundamentals gets a fixed teaching window
  if (scene.id === "focus-fundamentals-two-targets") {
    return {
      depthWindow: { mode: "fixed", minMm: -250, maxMm: 4000 },
      annotationMode: "minimal",
      showDepthStrip: true,
      showSwatchLegend: false,
      targetLabelMode: "short-local",
      showOpticalAxisLabel: true,
      showHingeMarker: false,
    };
  }

  // Default: scene-bounds profile with minimal annotations
  return {
    depthWindow: { mode: "scene-bounds", marginMm: 300 },
    annotationMode: "minimal",
    showDepthStrip: true,
    showSwatchLegend: false,
    targetLabelMode: "short-local",
    showOpticalAxisLabel: true,
    showHingeMarker: true,
  };
}
