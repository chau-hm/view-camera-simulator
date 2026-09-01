/* eslint-disable react-refresh/only-export-components */
import { useCallback, useMemo, useState } from "react";
import { GroundGlassStage } from "./GroundGlassStage";
import { GroundGlassRenderSurface } from "./GroundGlassRenderSurface";
import { GroundGlassTransformedOverlays, GroundGlassFixedOverlays } from "./GroundGlassOverlays";
import { GroundGlassFocusRing } from "./GroundGlassFocusRing";
import { projectSceneFocusTargetsToGroundGlass } from "./groundGlassTargetProjection";
import type { ApertureValue, CameraState } from "../types/camera";
import type { DerivedOpticsState } from "../types/optics";
import type { SceneDefinition } from "../types/scene";
export { projectWorldPointToGroundGlass } from "./groundGlassProjection";
import type { RenderQualityProfile } from "../types/ui";
import { resolvePhysicalFocusTargetPresentationMetric } from "./postprocessing/FocusAssistPass";
import { isGroundGlassRttScene } from "./groundGlassRttScenes";
import { createGroundGlassDofPipeline } from "./groundGlassPipeline";
import { createDepthOfFieldPass } from "./postprocessing/DepthOfFieldPass";
import { formatGroundGlassFocusLabel } from "./groundGlassFocusLabel";
import { resolveGroundGlassPresentationPolicy } from "./groundGlassPresentationPolicy";
import type {
  GroundGlassRttChannel,
  GroundGlassRttRuntimeInfo,
  GroundGlassRttRuntimeInfoChangeHandler,
} from "./groundGlassRttDimensions";
import type { CameraMovementPresentationRegion } from "../scenes/cameraMovementSceneCalibration";
import type { EffectiveCameraMovementCalibration } from "../scenes/cameraMovementEffectiveCalibration";

export type GroundGlassRendererProps = {
  opticsState: DerivedOpticsState;
  assistEnabled: boolean;
  gridEnabled: boolean;
  riseMm: number;
  tiltDeg: number;
  swingDeg: number;
  focusDistanceMm: number;
  aperture: ApertureValue;
  renderQuality: RenderQualityProfile;
  /** Explicit scene definition for focus-target projection and RTT framing. */
  scene: SceneDefinition;
  // previewMode is controlled by the parent GroundGlassViewport and REQUIRED
  previewMode: "raw" | "upright";
  // rawDebug (developer-only) is controlled at workspace and passed down
  rawDebug?: boolean;
  focusMetric?: "point" | "patch";
  zoomEnabled?: boolean;
  onZoomChange?: (nextZoomed: boolean) => void;
  interactionResetKey?: string;
  /** Explicit camera input for comparison panes. */
  cameraState?: CameraState;
  /** Explicit focal length input for the renderer. */
  focalLengthMm: number;
  channel?: GroundGlassRttChannel;
  presentationRegion?: CameraMovementPresentationRegion;
  effectiveCameraMovementCalibration?: EffectiveCameraMovementCalibration;
  runtimeInfo?: GroundGlassRttRuntimeInfo | null;
  onRuntimeInfoChange?: GroundGlassRttRuntimeInfoChangeHandler;
  accessibleLabel?: string;
  stageLabel?: string;
  zoomInLabel?: string;
  panLabel?: string;
  resetViewLabel?: string;
  resetActionLabel?: string;
  lastFiniteFocusDepthMm?: number;
};

const PANEL_WIDTH_PX = 500;
const PANEL_HEIGHT_PX = 400;

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

export const GroundGlassRenderer = ({
  opticsState,
  assistEnabled,
  gridEnabled,
  riseMm,
  tiltDeg,
  swingDeg,
  focusDistanceMm,
  aperture,
  renderQuality,
  scene,
  previewMode,
  rawDebug,
  focusMetric = "patch",
  zoomEnabled,
  onZoomChange,
  interactionResetKey,
  cameraState,
  focalLengthMm,
  channel = "default",
  presentationRegion,
  effectiveCameraMovementCalibration,
  runtimeInfo,
  onRuntimeInfoChange,
  accessibleLabel,
  stageLabel,
  zoomInLabel,
  panLabel,
  resetViewLabel,
  resetActionLabel,
  lastFiniteFocusDepthMm: explicitLastFiniteFocusDepthMm,
}: GroundGlassRendererProps) => {
  const resolvedFocusDistanceMm = cameraState?.focusDistanceMm ?? focusDistanceMm;
  const resolvedAperture = cameraState?.aperture ?? aperture;
  const sceneId = scene.id;
  // Stage component handles pan/zoom and pointer capture. Pass zoomEnabled through to it.
  const isRttScene = isGroundGlassRttScene(sceneId);
  const [rttLogicalSize, setRttLogicalSize] = useState({
    width: PANEL_WIDTH_PX,
    height: PANEL_HEIGHT_PX,
  });
  const handleViewportSizeChange = useCallback((size: { width: number; height: number }) => {
    setRttLogicalSize((current) =>
      current.width === size.width && current.height === size.height ? current : size,
    );
  }, []);
  const pipeline = useMemo(() => {
    const isRtt = isGroundGlassRttScene(sceneId);
    if (isRtt) {
      // GroundGlassRTT owns the real camera, render targets, and post-processing
      // resources. This component only needs presentation metadata for RTT scenes.
      return { verticalFrameOffsetPx: 0 } as const;
    }

    return createGroundGlassDofPipeline(opticsState, PANEL_WIDTH_PX, PANEL_HEIGHT_PX, renderQuality);
  }, [opticsState, renderQuality, sceneId]);

  const dofSample = useMemo(
    () =>
      createDepthOfFieldPass(
        {
          enabled: true,
          widthPx: PANEL_WIDTH_PX,
          heightPx: PANEL_HEIGHT_PX,
          sampleDepth: 0.55,
          sampleUv: { u: 0.5, v: 0.5 },
          aperture: resolvedAperture,
          renderQuality,
        },
        opticsState,
      ),
    [opticsState, renderQuality, resolvedAperture],
  );

  const blurOpacity = Math.min(0.85, dofSample.blurStrength * 1.2);
  const backgroundPositionY = `${pipeline.verticalFrameOffsetPx}px`;
  const presentationPolicy = resolveGroundGlassPresentationPolicy(scene);
  const isRttSceneFinal = isRttScene;
  const sceneShiftX = isRttSceneFinal ? 0 : clamp(swingDeg * 4 + (assistEnabled ? 0 : pipeline.verticalFrameOffsetPx * 0.2), -60, 60);
  const sceneShiftY = isRttSceneFinal ? 0 : clamp(-riseMm * 2 + tiltDeg * 4 - pipeline.verticalFrameOffsetPx * 0.15, -80, 80);
  const sceneRotationDeg = isRttSceneFinal ? 0 : clamp(tiltDeg * 1.25 + swingDeg * 0.75, -18, 18);
  const focusShift = clamp((resolvedFocusDistanceMm - 2000) / 4000, -1, 1);
  const focusScale = 1 + focusShift * 0.04;
  const focusRingSize = 68 + dofSample.blurStrength * 56;
  const focusRingOpacity = 0.35 + (1 - dofSample.blurStrength) * 0.45;
  const sceneBackground = `radial-gradient(circle at ${50 + clamp(riseMm * 0.75, -18, 18)}% ${
    48 - clamp(tiltDeg * 2.2, -18, 18)
  }%, rgba(96,165,250,0.34), rgba(30,41,59,0.9) 42%, rgba(15,23,42,0.97) 100%)`;
  const isInfinityFocus = opticsState.diagnostics?.isInfinityFocus === true;
  // consider RTT scenes when hiding decorative background overlay
  const hideDecorativeBackground = isRttSceneFinal || rawDebug;
  const lastFiniteFocusDepthMm = explicitLastFiniteFocusDepthMm;
  const primaryTarget = opticsState.focusTargets && opticsState.focusTargets.length > 0 ? opticsState.focusTargets[0] : null;
  const primaryPresentationMetric = primaryTarget
    ? resolvePhysicalFocusTargetPresentationMetric(primaryTarget, focusMetric)
    : null;

  const focusDistanceLabel = formatGroundGlassFocusLabel({
    isRttScene: isRttSceneFinal,
    isInfinityFocus,
    focusDistanceMm: resolvedFocusDistanceMm,
    lastFiniteFocusDepthMm,
    primaryTarget: primaryPresentationMetric,
    legacyDistanceToFocusPlaneMm: dofSample.distanceToFocusPlaneMm,
  });

  // Project scene focus targets (if available) into ground-glass UV coordinates for positioning overlays
  const sceneDef = scene;
  const projectedTargets = projectSceneFocusTargetsToGroundGlass({ sceneDef, opticsState, aperture: resolvedAperture, previewMode });
  const primaryProjectedTarget = projectedTargets.length > 0 ? projectedTargets[0] : null;
  const apertureNumber = typeof resolvedAperture === "number" ? resolvedAperture : Number(resolvedAperture as unknown as number);

  const transformedImageLayer = (
    <>
      {/* Decorative background; hide for RTT scenes or when Raw RTT Debug is enabled */}
      {!hideDecorativeBackground && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: sceneBackground,
            backgroundPosition: `center ${backgroundPositionY}`,
            backgroundRepeat: "no-repeat",
          }}
        />
      )}

      <div
        style={{
          position: "absolute",
          inset: 0,
        }}
      >
        <GroundGlassRenderSurface
          opticsState={opticsState}
          focalLengthMm={focalLengthMm}
          scene={scene}
          apertureNumber={apertureNumber}
          previewMode={previewMode}
          rawDebug={rawDebug}
          sceneShiftX={sceneShiftX}
          sceneShiftY={sceneShiftY}
          sceneRotationDeg={sceneRotationDeg}
          focusScale={focusScale}
          widthPx={isRttSceneFinal ? rttLogicalSize.width : PANEL_WIDTH_PX}
          heightPx={isRttSceneFinal ? rttLogicalSize.height : PANEL_HEIGHT_PX}
          renderQuality={renderQuality}
          zoomEnabled={zoomEnabled}
          channel={channel}
          presentationRegion={presentationRegion}
          effectiveCameraMovementCalibration={effectiveCameraMovementCalibration}
          runtimeInfo={runtimeInfo}
          onRuntimeInfoChange={onRuntimeInfoChange}
        />

        <GroundGlassTransformedOverlays gridEnabled={gridEnabled} rawDebug={rawDebug} showDecorativeVignette={presentationPolicy.showDecorativeVignette} blurOpacity={blurOpacity} />
      </div>
    </>
  );

  const fixedOverlayLayer = (
    <>
      <GroundGlassFixedOverlays
        isInfinityFocus={isInfinityFocus}
        lastFiniteFocusDepthMm={lastFiniteFocusDepthMm}
        focusDistanceLabel={focusDistanceLabel}
      />

      {!isRttSceneFinal && (
        <GroundGlassFocusRing
          primaryProjectedTarget={primaryProjectedTarget}
          focusRingSize={focusRingSize}
          focusRingOpacity={focusRingOpacity}
          swingDeg={swingDeg}
          tiltDeg={tiltDeg}
        />
      )}
    </>
  );

  return (
    <div style={{ display: "grid", gap: "0.5rem" }}>
      <GroundGlassStage
        zoomEnabled={zoomEnabled}
        onZoomChange={onZoomChange}
        onViewportSizeChange={handleViewportSizeChange}
        interactionResetKey={interactionResetKey}
        accessibleLabel={accessibleLabel}
        stageLabel={stageLabel}
        zoomInLabel={zoomInLabel}
        panLabel={panLabel}
        resetViewLabel={resetViewLabel}
        resetActionLabel={resetActionLabel}
        imageLayer={transformedImageLayer}
        fixedOverlayLayer={fixedOverlayLayer}
      />
      {/* Current Settings & Focus Fundamentals Debug and Focus Targets are rendered by the parent GroundGlassViewport to allow controls to appear immediately after the canvas. */}
    </div>
  );
};
