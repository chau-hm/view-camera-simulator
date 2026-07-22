/* eslint-disable react-refresh/only-export-components */
import { useCallback, useMemo, useState } from "react";
import { GroundGlassStage } from "./GroundGlassStage";
import { GroundGlassRenderSurface } from "./GroundGlassRenderSurface";
import { LegacyGroundGlassScene } from "./LegacyGroundGlassScene";
import { GroundGlassTransformedOverlays, GroundGlassFixedOverlays } from "./GroundGlassOverlays";
import { GroundGlassFocusRing } from "./GroundGlassFocusRing";
import { useAppStore } from "../state/appStore";
import { projectSceneFocusTargetsToGroundGlass } from "./groundGlassTargetProjection";
import type { ApertureValue } from "../types/camera";
import type { DerivedOpticsState } from "../types/optics";
export { projectWorldPointToGroundGlass } from "./groundGlassProjection";
import type { RenderQualityProfile } from "../types/ui";
import { createFocusAssistPass } from "./postprocessing/FocusAssistPass";
import { isGroundGlassRttScene } from "./groundGlassRttScenes";
import { createGroundGlassDofPipeline } from "./groundGlassPipeline";
import { createDepthOfFieldPass } from "./postprocessing/DepthOfFieldPass";
import { getRenderQualitySettings } from "./renderQuality";
import { formatGroundGlassFocusLabel } from "./groundGlassFocusLabel";
import { CAMERA_CONSTANTS } from "../utils/constants";
import { getSceneById } from "../scenes/definitions";

type GroundGlassRendererProps = {
  opticsState: DerivedOpticsState;
  assistEnabled: boolean;
  focusAssistEnabled: boolean;
  gridEnabled: boolean;
  riseMm: number;
  tiltDeg: number;
  swingDeg: number;
  focusDistanceMm: number;
  aperture: ApertureValue;
  renderQuality: RenderQualityProfile;
  sceneId?: string;
  // previewMode is controlled by the parent GroundGlassViewport and REQUIRED
  previewMode: "raw" | "upright";
  // rawDebug (developer-only) is controlled at workspace and passed down
  rawDebug?: boolean;
  focusMetric?: "point" | "patch";
  zoomEnabled?: boolean;
  onZoomChange?: (nextZoomed: boolean) => void;
  interactionResetKey?: string;
};

const PANEL_WIDTH_PX = 500;
const PANEL_HEIGHT_PX = 400;

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

export const GroundGlassRenderer = ({
  opticsState,
  assistEnabled,
  focusAssistEnabled,
  gridEnabled,
  riseMm,
  tiltDeg,
  swingDeg,
  focusDistanceMm,
  aperture,
  renderQuality,
  sceneId,
  previewMode,
  rawDebug,
  focusMetric = "patch",
  zoomEnabled,
  onZoomChange,
  interactionResetKey,
}: GroundGlassRendererProps) => {
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

    const useThinLens = sceneId === "focus-fundamentals-two-targets";
    if (useThinLens) {
      const imageDistanceMm = Math.abs(opticsState.filmPlane.point.z - opticsState.lensCenterWorld.z);
      return createGroundGlassDofPipeline(opticsState, PANEL_WIDTH_PX, PANEL_HEIGHT_PX, renderQuality, {
        useThinLens: true,
        focalLengthMm: CAMERA_CONSTANTS.focalLengthMm,
        imageDistanceMm,
        sensorWidthMm: 127,
        sensorHeightMm: 101.6,
      });
    }

    return createGroundGlassDofPipeline(opticsState, PANEL_WIDTH_PX, PANEL_HEIGHT_PX, renderQuality);
  }, [opticsState, renderQuality, sceneId]);

  const qualitySettings = useMemo(() => getRenderQualitySettings(renderQuality), [renderQuality]);
  const focusAssist = useMemo(
    () => createFocusAssistPass({ enabled: focusAssistEnabled, targets: opticsState.focusTargets, metric: focusMetric }),
    [focusAssistEnabled, focusMetric, opticsState.focusTargets],
  );
  const dofSample = useMemo(
    () =>
      createDepthOfFieldPass(
        {
          enabled: true,
          widthPx: PANEL_WIDTH_PX,
          heightPx: PANEL_HEIGHT_PX,
          sampleDepth: 0.55,
          sampleUv: { u: 0.5, v: 0.5 },
          aperture,
          renderQuality,
        },
        opticsState,
      ),
    [aperture, opticsState, renderQuality],
  );

  const blurOpacity = Math.min(0.85, dofSample.blurStrength * 1.2);
  const blurRadiusPx = Math.max(0, dofSample.blurStrength * (qualitySettings.groundGlassScale > 0.8 ? 9 : 6));
  const backgroundPositionY = `${pipeline.verticalFrameOffsetPx}px`;
  const isFocusFundamentals = sceneId === "focus-fundamentals-two-targets";
  const isRttSceneFinal = isRttScene;
  const sceneShiftX = isRttSceneFinal ? 0 : clamp(swingDeg * 4 + (assistEnabled ? 0 : pipeline.verticalFrameOffsetPx * 0.2), -60, 60);
  const sceneShiftY = isRttSceneFinal ? 0 : clamp(-riseMm * 2 + tiltDeg * 4 - pipeline.verticalFrameOffsetPx * 0.15, -80, 80);
  const sceneRotationDeg = isRttSceneFinal ? 0 : clamp(tiltDeg * 1.25 + swingDeg * 0.75, -18, 18);
  const focusShift = clamp((focusDistanceMm - 2000) / 4000, -1, 1);
  const focusScale = 1 + focusShift * 0.04;
  const focusRingSize = 68 + dofSample.blurStrength * 56;
  const focusRingOpacity = 0.35 + (1 - dofSample.blurStrength) * 0.45;
  const sceneBackground = `radial-gradient(circle at ${50 + clamp(riseMm * 0.75, -18, 18)}% ${
    48 - clamp(tiltDeg * 2.2, -18, 18)
  }%, rgba(96,165,250,0.34), rgba(30,41,59,0.9) 42%, rgba(15,23,42,0.97) 100%)`;
  const isInfinityFocus = opticsState.diagnostics?.isInfinityFocus === true;
  // consider RTT scenes when hiding decorative background overlay
  const hideDecorativeBackground = isRttSceneFinal || rawDebug;
  const lastFiniteFocusDepthMm = useAppStore((s) => s.camera.lastFiniteFocusDepthMm);
  const primaryTarget = opticsState.focusTargets && opticsState.focusTargets.length > 0 ? opticsState.focusTargets[0] : null;

  const focusDistanceLabel = formatGroundGlassFocusLabel({
    isRttScene: isRttSceneFinal,
    isInfinityFocus,
    focusDistanceMm,
    lastFiniteFocusDepthMm,
    primaryTarget: primaryTarget
      ? {
          sharpness:
            focusMetric === "point"
              ? (primaryTarget.pointSharpness ?? primaryTarget.sharpness)
              : (primaryTarget.patchSharpness ?? primaryTarget.sharpness),
          normalizedDefocus:
            focusMetric === "point"
              ? (primaryTarget.pointNormalizedDefocus ?? primaryTarget.normalizedDefocus)
              : (primaryTarget.patchNormalizedDefocus ?? primaryTarget.normalizedDefocus),
          distanceToFocusPlaneMm: primaryTarget.distanceToFocusPlaneMm,
        }
      : null,
    legacyDistanceToFocusPlaneMm: dofSample.distanceToFocusPlaneMm,
  });

  // Project scene focus targets (if available) into ground-glass UV coordinates for positioning overlays
  const sceneDef = sceneId ? getSceneById(sceneId) : undefined;
  const projectedTargets = projectSceneFocusTargetsToGroundGlass({ sceneDef, opticsState, aperture, previewMode });
  const primaryProjectedTarget = projectedTargets.length > 0 ? projectedTargets[0] : null;
  const apertureNumber = typeof aperture === "number" ? aperture : Number(aperture as unknown as number);

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
          sceneId={sceneId}
          apertureNumber={apertureNumber}
          previewMode={previewMode}
          rawDebug={rawDebug}
          focusAssistEnabled={focusAssistEnabled}
          focusRingSize={focusRingSize}
          focusRingOpacity={focusRingOpacity}
          sceneShiftX={sceneShiftX}
          sceneShiftY={sceneShiftY}
          sceneRotationDeg={sceneRotationDeg}
          focusScale={focusScale}
          widthPx={isRttSceneFinal ? rttLogicalSize.width : PANEL_WIDTH_PX}
          heightPx={isRttSceneFinal ? rttLogicalSize.height : PANEL_HEIGHT_PX}
          renderQuality={renderQuality}
          zoomEnabled={zoomEnabled}
        />

        {!isRttSceneFinal && (
         <LegacyGroundGlassScene
           sceneId={sceneId}
           sceneHasFocusTargets={!!(sceneDef && sceneDef.focusTargets && sceneDef.focusTargets.length)}
           projectedTargets={projectedTargets}
           blurRadiusPx={blurRadiusPx}
           sceneShiftX={sceneShiftX}
           sceneShiftY={sceneShiftY}
           sceneRotationDeg={sceneRotationDeg}
           focusScale={focusScale}
           riseMm={riseMm}
           tiltDeg={tiltDeg}
           swingDeg={swingDeg}
         />
        )}

        <GroundGlassTransformedOverlays gridEnabled={gridEnabled} rawDebug={rawDebug} isFocusFundamentals={isFocusFundamentals} blurOpacity={blurOpacity} />
      </div>
    </>
  );

  const fixedOverlayLayer = (
    <>
      <GroundGlassFixedOverlays
        isInfinityFocus={isInfinityFocus}
        lastFiniteFocusDepthMm={lastFiniteFocusDepthMm}
        focusDistanceLabel={focusDistanceLabel}
        focusAssistVisible={focusAssist.enabled && !rawDebug}
      />

      {!isRttSceneFinal && (
        <GroundGlassFocusRing
          sceneId={sceneId}
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
        imageLayer={transformedImageLayer}
        fixedOverlayLayer={fixedOverlayLayer}
      />
      {/* Current Settings & Focus Fundamentals Debug and Focus Targets are rendered by the parent GroundGlassViewport to allow controls to appear immediately after the canvas. */}
    </div>
  );
};
