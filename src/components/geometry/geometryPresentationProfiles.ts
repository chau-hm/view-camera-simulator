import type { SceneDefinition } from "../../types/scene";

export type GeometryPresentationProfile = {
  depthWindow:
    { mode: "fixed"; minMm: number; maxMm: number } | { mode: "scene-bounds"; marginMm: number };

  annotationMode: "minimal";
  lateralWindow?: {
    side: { minMm: number; maxMm: number };
    top: { minMm: number; maxMm: number };
  };
  diagramPaddingPx: number;
  showDepthStrip: boolean;
  showSwatchLegend: boolean;

  targetLabelMode: "none" | "short-local";
  showOpticalAxisLabel: boolean;
  showHingeMarker: boolean;
  showTabletopGuide: boolean;
  dofFillOpacity: number;
};

export function getGeometryPresentationProfile(
  scene: SceneDefinition,
): GeometryPresentationProfile {
  // Focus Fundamentals gets a fixed teaching window
  if (scene.id === "focus-fundamentals-two-targets") {
    return {
      depthWindow: { mode: "fixed", minMm: -250, maxMm: 4000 },
      annotationMode: "minimal",
      diagramPaddingPx: 24,
      showDepthStrip: true,
      showSwatchLegend: false,
      targetLabelMode: "short-local",
      showOpticalAxisLabel: true,
      showHingeMarker: false,
      showTabletopGuide: false,
      dofFillOpacity: 0.12,
    };
  }

  if (scene.id === "table-tilt") {
    return {
      depthWindow: { mode: "fixed", minMm: -250, maxMm: 6800 },
      lateralWindow: {
        side: { minMm: -1400, maxMm: 250 },
        top: { minMm: -1800, maxMm: 1800 },
      },
      diagramPaddingPx: 36,
      annotationMode: "minimal",
      showDepthStrip: true,
      showSwatchLegend: false,
      targetLabelMode: "short-local",
      showOpticalAxisLabel: true,
      showHingeMarker: true,
      showTabletopGuide: true,
      dofFillOpacity: 0.08,
    };
  }

  // Default: scene-bounds profile with minimal annotations
  return {
    depthWindow: { mode: "scene-bounds", marginMm: 300 },
    annotationMode: "minimal",
    diagramPaddingPx: 24,
    showDepthStrip: true,
    showSwatchLegend: false,
    targetLabelMode: "short-local",
    showOpticalAxisLabel: true,
    showHingeMarker: true,
    showTabletopGuide: false,
    dofFillOpacity: 0.12,
  };
}
