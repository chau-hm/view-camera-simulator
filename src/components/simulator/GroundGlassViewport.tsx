import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { GroundGlassRenderer } from "../../render/GroundGlassRenderer";
import { ViewOptions } from "../controls/ViewOptions";
import "../../i18n";
import { simulatorMessageKeys } from "../../i18n/simulatorMessageKeys";
import type { ApertureValue } from "../../types/camera";
import type { DerivedOpticsState } from "../../types/optics";
import type { SceneDefinition } from "../../types/scene";
import type { RenderQualityProfile } from "../../types/ui";
import type { CameraMovementGroundGlassComparison } from "../../scenes/cameraMovementGroundGlassComparison";
import type { CameraMovementPresentationRegion } from "../../scenes/cameraMovementSceneCalibration";
import type { EffectiveCameraMovementCalibration } from "../../scenes/cameraMovementEffectiveCalibration";
import type {
  GroundGlassRttRuntimeInfoByChannel,
  GroundGlassRttRuntimeInfoChangeHandler,
} from "../../render/groundGlassRttDimensions";

type GroundGlassViewportProps = {
  opticsState: DerivedOpticsState;
  scene: SceneDefinition;
  runtimeInfoByChannel: GroundGlassRttRuntimeInfoByChannel;
  onRuntimeInfoChange: GroundGlassRttRuntimeInfoChangeHandler;
  groundGlassAssistEnabled: boolean;
  onGroundGlassAssistEnabledChange: (enabled: boolean) => void;
  // current state (from camera)
  focusAssistEnabled: boolean;
  gridEnabled: boolean;
  // permissions (from enabledControls) — whether the control is allowed in current mode/task
  canToggleFocusAssist?: boolean;
  canToggleGrid?: boolean;
  riseMm: number;
  tiltDeg: number;
  swingDeg: number;
  focusDistanceMm: number;
  aperture: ApertureValue;
  renderQuality: RenderQualityProfile;
  focalLengthMm: number;
  lastFiniteFocusDepthMm?: number;
  effectiveCameraMovementCalibration?: EffectiveCameraMovementCalibration;
  presentationRegion?: CameraMovementPresentationRegion;
  lockReason?: string;
  rawRttDebug?: boolean;
  focusMetric?: "point" | "patch";
  showHeader?: boolean;
  interactionResetKey?: string;
  expanded: boolean;
  restoreFocusOnCollapse: boolean;
  onRequestExpand: () => void;
  onRequestRestore: () => void;
  comparison?: CameraMovementGroundGlassComparison | null;
  comparisonLabels?: { original: string; current: string };
};

export const GroundGlassViewport = ({
  opticsState,
  scene,
  groundGlassAssistEnabled,
  onGroundGlassAssistEnabledChange,
  focusAssistEnabled,
  gridEnabled,
  canToggleFocusAssist,
  canToggleGrid,
  riseMm,
  tiltDeg,
  swingDeg,
  focusDistanceMm,
  aperture,
  renderQuality,
  focalLengthMm,
  runtimeInfoByChannel,
  onRuntimeInfoChange,
  lastFiniteFocusDepthMm,
  effectiveCameraMovementCalibration,
  presentationRegion,
  lockReason,
  rawRttDebug,
  focusMetric,
  showHeader,
  interactionResetKey,
  expanded,
  restoreFocusOnCollapse,
  onRequestExpand,
  onRequestRestore,
  comparison,
  comparisonLabels,
}: GroundGlassViewportProps) => {
  const { t } = useTranslation();
  const sceneId = scene.id;
  // Preview mode control local to the Ground Glass panel. Default to camera state
  const [previewMode, setPreviewMode] = useState<"raw" | "upright">(groundGlassAssistEnabled ? "upright" : "raw");

  const [zoomEnabled, setZoomEnabled] = useState(false);
  const [originalZoomEnabled, setOriginalZoomEnabled] = useState(false);
  const [currentZoomEnabled, setCurrentZoomEnabled] = useState(false);
  const singleViewAccessibleLabel =
    sceneId === "understanding-camera-movements"
      ? t(simulatorMessageKeys.viewport.previewLabel)
      : t(simulatorMessageKeys.viewport.groundGlassTitle);
  const zoomInLabel = t(simulatorMessageKeys.viewport.zoomIn);
  const zoomOutLabel = t(simulatorMessageKeys.viewport.zoomOut);
  const resetViewLabel = t(simulatorMessageKeys.viewport.resetView);
  const resetActionLabel = t(simulatorMessageKeys.viewport.resetAction);
  const originalStageLabel = t(simulatorMessageKeys.viewport.originalGroundGlass);
  const currentStageLabel = t(simulatorMessageKeys.viewport.currentGroundGlass);
  const originalHeadingId = useId();
  const currentHeadingId = useId();
  const originalDescriptionId = useId();
  const currentDescriptionId = useId();
  const comparisonHeadingId = useId();
  const comparisonDescriptionId = useId();
  const expandTriggerRef = useRef<HTMLButtonElement | null>(null);
  const restoreTriggerRef = useRef<HTMLButtonElement | null>(null);
  const previouslyExpandedRef = useRef(expanded);
  const handleZoomChange = useCallback((nextZoomed: boolean) => {
    setZoomEnabled(nextZoomed);
  }, []);

  const renderLayer = useCallback(
    ({
      label,
      headingId,
      layer,
      descriptionId,
      layerZoomEnabled,
      onLayerZoomChange,
      resetSuffix,
    }: {
      label: "Original" | "Current";
      headingId: string;
      descriptionId: string;
      layer: CameraMovementGroundGlassComparison["original"];
      layerZoomEnabled: boolean;
      onLayerZoomChange: (nextZoomed: boolean) => void;
      resetSuffix: string;
    }) => (
      <section className="groundglass-comparison__panel" aria-labelledby={headingId} aria-describedby={descriptionId}>
        <h3 id={headingId} className="groundglass-comparison__title">
          {label === "Original"
            ? t(simulatorMessageKeys.viewport.originalLabel)
            : t(simulatorMessageKeys.viewport.currentLabel)}
        </h3>
        <p id={descriptionId} className="groundglass-comparison__label">
          {label === "Original" ? comparisonLabels?.original : comparisonLabels?.current}
        </p>
          <GroundGlassRenderer
          scene={scene}
          opticsState={layer.opticsState}
          assistEnabled={layer.opticsState.groundGlassProjection.assistModeEnabled}
          focusAssistEnabled={focusAssistEnabled}
          gridEnabled={gridEnabled}
          riseMm={layer.camera.frontRiseMm}
          tiltDeg={layer.camera.frontTiltDeg}
          swingDeg={layer.camera.frontSwingDeg}
          focusDistanceMm={layer.camera.focusDistanceMm}
          aperture={layer.camera.aperture}
          focalLengthMm={layer.camera.focalLengthMm}
          effectiveCameraMovementCalibration={effectiveCameraMovementCalibration}
          renderQuality={renderQuality}
          previewMode={previewMode}
          rawDebug={rawRttDebug}
          focusMetric={focusMetric}
          zoomEnabled={layerZoomEnabled}
          onZoomChange={onLayerZoomChange}
          interactionResetKey={`${interactionResetKey ?? sceneId}:${previewMode}:${resetSuffix}`}
          cameraState={layer.camera}
          channel={label === "Original" ? "camera-movement-original" : "camera-movement-current"}
          presentationRegion={layer.presentationTargetRegion}
          runtimeInfo={runtimeInfoByChannel[label === "Original" ? "camera-movement-original" : "camera-movement-current"]}
          onRuntimeInfoChange={onRuntimeInfoChange}
          accessibleLabel={label === "Original" ? originalStageLabel : currentStageLabel}
          stageLabel={label === "Original" ? originalStageLabel : currentStageLabel}
          zoomInLabel={zoomInLabel}
          zoomOutLabel={zoomOutLabel}
          resetViewLabel={resetViewLabel}
          resetActionLabel={resetActionLabel}
          lastFiniteFocusDepthMm={layer.camera.lastFiniteFocusDepthMm}
        />
      </section>
    ),
    [comparisonLabels, currentStageLabel, effectiveCameraMovementCalibration, focusAssistEnabled, focusMetric, gridEnabled, interactionResetKey, onRuntimeInfoChange, originalStageLabel, previewMode, rawRttDebug, renderQuality, resetActionLabel, resetViewLabel, runtimeInfoByChannel, scene, sceneId, t, zoomInLabel, zoomOutLabel],
  );

  useEffect(() => {
    const wasExpanded = previouslyExpandedRef.current;
    previouslyExpandedRef.current = expanded;
    if (!expanded && !wasExpanded) return;

    const frame = window.requestAnimationFrame(() => {
      if (expanded) {
        restoreTriggerRef.current?.focus();
      } else if (restoreFocusOnCollapse) {
        expandTriggerRef.current?.focus();
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [expanded, restoreFocusOnCollapse]);

  return (
    <section className={`groundglass-panel${expanded ? " simulator-viewport-panel--expanded groundglass-panel--expanded" : ""}`}>
      {showHeader !== false && <h2 className="simulator-card-title">{t(simulatorMessageKeys.viewport.groundGlassTitle)}</h2>}

      <div className="groundglass-controls">
        <div className="groundglass-control-groups">
          <fieldset className="groundglass-control-group">
            <legend className="control-group-title">{t(simulatorMessageKeys.viewport.preview)}</legend>
            <div className="groundglass-control-group__options">
              <div className="choice-list choice-list--stacked">
                <label className="choice-label">
                  <input
                    className="form-radio"
                    type="radio"
                    name={`gg-preview-${sceneId}`}
                    checked={previewMode === "raw"}
                    onChange={() => { setPreviewMode("raw"); onGroundGlassAssistEnabledChange(false); }}
                  />
                  <span>{t(simulatorMessageKeys.viewport.rawGroundGlass)}</span>
                </label>

                <label className="choice-label">
                  <input
                    className="form-radio"
                    type="radio"
                    name={`gg-preview-${sceneId}`}
                    checked={previewMode === "upright"}
                    onChange={() => { setPreviewMode("upright"); onGroundGlassAssistEnabledChange(true); }}
                  />
                  <span>{t(simulatorMessageKeys.viewport.uprightAssist)}</span>
                </label>
              </div>
            </div>
          </fieldset>

          <fieldset className="groundglass-control-group">
            <legend className="control-group-title">{t(simulatorMessageKeys.viewport.viewOptions)}</legend>
            <div className="groundglass-control-group__options">
              <ViewOptions
                canToggleFocusAssist={canToggleFocusAssist ?? true}
                canToggleGrid={canToggleGrid ?? true}
                lockReason={lockReason ?? ""}
                compact
              />
            </div>
          </fieldset>
        </div>
      </div>

      {comparison ? (
        <>
          <h3 id={comparisonHeadingId} className="groundglass-comparison__heading">
            {t(simulatorMessageKeys.viewport.comparisonHeading)}
          </h3>
          <p id={comparisonDescriptionId} className="groundglass-comparison__intro">
            {t(simulatorMessageKeys.viewport.comparisonDescription)}
          </p>
        </>
      ) : null}

      <div
        className={`groundglass-viewport-frame${expanded ? " groundglass-viewport-frame--expanded" : ""}`}
        aria-label={t(simulatorMessageKeys.viewport.groundGlassViewportLabel)}
      >
        {comparison ? (
          <section
            className="groundglass-comparison"
            role="region"
            aria-label={t(simulatorMessageKeys.viewport.comparisonRegion)}
            aria-labelledby={comparisonHeadingId}
            aria-describedby={comparisonDescriptionId}
          >
            {renderLayer({
              label: "Original",
              headingId: originalHeadingId,
              descriptionId: originalDescriptionId,
              layer: comparison.original,
              layerZoomEnabled: originalZoomEnabled,
              onLayerZoomChange: setOriginalZoomEnabled,
              resetSuffix: "original",
            })}
            {renderLayer({
              label: "Current",
              headingId: currentHeadingId,
              descriptionId: currentDescriptionId,
              layer: comparison.current,
              layerZoomEnabled: currentZoomEnabled,
              onLayerZoomChange: setCurrentZoomEnabled,
              resetSuffix: "current",
            })}
          </section>
        ) : (
          <div className={`groundglass-renderer-host${expanded ? " groundglass-renderer-host--expanded" : ""}`}>
            {/* Expanded presentation intentionally keeps the existing logical RTT size; container-aware RTT sizing is a renderer-focused follow-up. */}
            <GroundGlassRenderer
              scene={scene}
              opticsState={opticsState}
              assistEnabled={opticsState.groundGlassProjection.assistModeEnabled}
              focusAssistEnabled={focusAssistEnabled}
              gridEnabled={gridEnabled}
              riseMm={riseMm}
              tiltDeg={tiltDeg}
              swingDeg={swingDeg}
              focusDistanceMm={focusDistanceMm}
              aperture={aperture}
              focalLengthMm={focalLengthMm}
              lastFiniteFocusDepthMm={lastFiniteFocusDepthMm}
              effectiveCameraMovementCalibration={effectiveCameraMovementCalibration}
              renderQuality={renderQuality}
              runtimeInfo={runtimeInfoByChannel.default}
              onRuntimeInfoChange={onRuntimeInfoChange}
              previewMode={previewMode}
              rawDebug={rawRttDebug}
              focusMetric={focusMetric}
              zoomEnabled={zoomEnabled}
              onZoomChange={handleZoomChange}
              interactionResetKey={`${interactionResetKey ?? sceneId}:${previewMode}`}
              accessibleLabel={singleViewAccessibleLabel}
              stageLabel={singleViewAccessibleLabel}
              zoomInLabel={zoomInLabel}
              zoomOutLabel={zoomOutLabel}
              resetViewLabel={resetViewLabel}
              resetActionLabel={resetActionLabel}
              presentationRegion={presentationRegion}
            />
          </div>
        )}

        <button
          ref={expanded ? restoreTriggerRef : expandTriggerRef}
          type="button"
          aria-label={expanded ? t(simulatorMessageKeys.viewport.restoreGroundGlass) : t(simulatorMessageKeys.viewport.expandGroundGlass)}
          title={expanded ? t(simulatorMessageKeys.viewport.restoreGroundGlass) : t(simulatorMessageKeys.viewport.expandGroundGlass)}
          data-viewport-expanded={expanded ? "true" : "false"}
          className="btn btn--icon btn--viewport-action"
          onClick={expanded ? onRequestRestore : onRequestExpand}
        >
          <span className="material-symbols-outlined" aria-hidden="true">
            {expanded ? "close_fullscreen" : "open_in_new"}
          </span>
        </button>
      </div>
    </section>
  );
};
