import type { DerivedOpticsState } from "../types/optics";
import { GroundGlassRTT } from "./GroundGlassRTT";
import { isGroundGlassRttScene } from "./groundGlassRttScenes";
import { useAppStore } from "../state/appStore";

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
  const rttRuntimeInfo = useAppStore((state) => state.groundGlassRttRuntimeInfo);
  if (isGroundGlassRttScene(sceneId)) {
    return (
      <div
        data-testid="ground-glass-rtt"
        data-rtt-camera-ok={rttRuntimeInfo?.cameraConfigurationOk === undefined ? undefined : String(rttRuntimeInfo.cameraConfigurationOk)}
        data-rtt-depth-available={rttRuntimeInfo?.depthTextureAvailable === undefined ? undefined : String(rttRuntimeInfo.depthTextureAvailable)}
        data-rtt-uniforms-finite={rttRuntimeInfo?.uniformsFinite === undefined ? undefined : String(rttRuntimeInfo.uniformsFinite)}
        data-rtt-dof-mode={rttRuntimeInfo?.dofMode}
        data-rtt-raw-contentful={rttRuntimeInfo?.rawContentful === undefined ? undefined : String(rttRuntimeInfo.rawContentful)}
        data-rtt-final-contentful={rttRuntimeInfo?.finalContentful === undefined ? undefined : String(rttRuntimeInfo.finalContentful)}
        data-rtt-raw-variance={rttRuntimeInfo?.rawColorVariance}
        data-rtt-final-variance={rttRuntimeInfo?.finalColorVariance}
        data-rtt-raw-non-background={rttRuntimeInfo?.rawNonBackgroundPixelCount}
        data-rtt-final-non-background={rttRuntimeInfo?.finalNonBackgroundPixelCount}
        data-rtt-resource-generation={rttRuntimeInfo?.resourceGeneration}
        data-rtt-logical-width={rttRuntimeInfo?.logicalWidthPx}
        data-rtt-logical-height={rttRuntimeInfo?.logicalHeightPx}
        data-rtt-internal-width={rttRuntimeInfo?.internalWidthPx}
        data-rtt-internal-height={rttRuntimeInfo?.internalHeightPx}
        data-rtt-canvas-css-width={rttRuntimeInfo?.canvasCssWidthPx}
        data-rtt-canvas-css-height={rttRuntimeInfo?.canvasCssHeightPx}
        data-rtt-color-target-width={rttRuntimeInfo?.colorTargetWidthPx}
        data-rtt-color-target-height={rttRuntimeInfo?.colorTargetHeightPx}
        data-rtt-depth-target-width={rttRuntimeInfo?.depthTargetWidthPx}
        data-rtt-depth-target-height={rttRuntimeInfo?.depthTargetHeightPx}
        data-rtt-blur-target-width={rttRuntimeInfo?.blurTargetWidthPx}
        data-rtt-blur-target-height={rttRuntimeInfo?.blurTargetHeightPx}
        data-rtt-final-target-width={rttRuntimeInfo?.finalTargetWidthPx}
        data-rtt-final-target-height={rttRuntimeInfo?.finalTargetHeightPx}
        data-rtt-horizontal-shader-width={rttRuntimeInfo?.horizontalShaderRenderWidthPx}
        data-rtt-horizontal-shader-height={rttRuntimeInfo?.horizontalShaderRenderHeightPx}
        data-rtt-vertical-shader-width={rttRuntimeInfo?.verticalShaderRenderWidthPx}
        data-rtt-vertical-shader-height={rttRuntimeInfo?.verticalShaderRenderHeightPx}
        data-rtt-was-clamped={rttRuntimeInfo?.wasClamped === undefined ? undefined : String(rttRuntimeInfo.wasClamped)}
        data-rtt-sanity-state={rttRuntimeInfo?.renderSanityStateKey}
        data-rtt-sanity-error={rttRuntimeInfo?.renderSanityError ?? undefined}
        style={{ position: "absolute", inset: 0 }}
      >
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
