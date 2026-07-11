import type { DerivedOpticsState } from "../types/optics";
import { GroundGlassRTT } from "./GroundGlassRTT";
import { isGroundGlassRttScene } from "./groundGlassRttScenes";

export type GroundGlassRenderSurfaceProps = {
  opticsState: DerivedOpticsState;
  sceneId?: string;
  apertureNumber: number;
  previewMode: "raw" | "upright";
  rawDebug?: boolean;
  focusAssistEnabled: boolean;
  focusRingSize: number;
  focusRingOpacity: number;
  sceneShiftX: number;
  sceneShiftY: number;
  sceneRotationDeg: number;
  focusScale: number;
  widthPx: number;
  heightPx: number;
  renderQuality: import("../types/ui").RenderQualityProfile;
  zoomEnabled?: boolean;
};

export const GroundGlassRenderSurface = ({
  opticsState,
  sceneId,
  apertureNumber,
  previewMode,
  rawDebug,
  focusAssistEnabled,
  focusRingSize,
  focusRingOpacity,
  sceneShiftX,
  sceneShiftY,
  sceneRotationDeg,
  focusScale,
  widthPx,
  heightPx,
  renderQuality,
  zoomEnabled,
}: GroundGlassRenderSurfaceProps) => {
  if (isGroundGlassRttScene(sceneId)) {
    return (
      <div data-testid="ground-glass-rtt" style={{ position: "absolute", inset: 0 }}>
        <GroundGlassRTT
          opticsState={opticsState}
          sceneId={sceneId}
          widthPx={widthPx}
          heightPx={heightPx}
          aperture={apertureNumber}
          previewMode={previewMode}
          focusRingRadiusPx={focusRingSize}
          focusRingOpacity={focusRingOpacity}
          rawDebug={rawDebug}
          focusAssistEnabled={focusAssistEnabled}
          renderQuality={renderQuality}
          zoomEnabled={zoomEnabled}
        />
      </div>
    );
  }

  return (
    <canvas
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        transform: `translate(${sceneShiftX}px, ${sceneShiftY}px) rotate(${sceneRotationDeg}deg) scale(${focusScale})`,
        transformOrigin: "center",
      }}
    />
  );
};
