import { useCallback, useEffect, useId, useRef, useState } from "react";
import { GroundGlassRenderer } from "../../render/GroundGlassRenderer";
import { ViewOptions } from "../controls/ViewOptions";
import { UI_COPY } from "../../ui/copy";
import { useAppStore } from "../../state/appStore";
import type { ApertureValue } from "../../types/camera";
import type { DerivedOpticsState } from "../../types/optics";
import type { RenderQualityProfile } from "../../types/ui";
import type { CameraMovementGroundGlassComparison } from "../../scenes/cameraMovementGroundGlassComparison";

type GroundGlassViewportProps = {
  opticsState: DerivedOpticsState;
  // permission: whether orientation assist controls can be toggled in this mode
  orientationAssistEnabled: boolean;
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
  sceneId: string;
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
  sceneId,
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
  // Preview mode control local to the Ground Glass panel. Default to camera state
  const groundGlassAssistEnabled = useAppStore((s) => s.camera.groundGlassAssistEnabled);
  const setGroundGlassAssistEnabled = useAppStore((s) => s.setGroundGlassAssistEnabled);
  const [previewMode, setPreviewMode] = useState<"raw" | "upright">(groundGlassAssistEnabled ? "upright" : "raw");

  const [zoomEnabled, setZoomEnabled] = useState(false);
  const [originalZoomEnabled, setOriginalZoomEnabled] = useState(false);
  const [currentZoomEnabled, setCurrentZoomEnabled] = useState(false);
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
        <h3 id={headingId} className="groundglass-comparison__title">{label}</h3>
        <p id={descriptionId} className="groundglass-comparison__label">
          {label === "Original" ? comparisonLabels?.original : comparisonLabels?.current}
        </p>
        <GroundGlassRenderer
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
          renderQuality={renderQuality}
          sceneId={sceneId}
          previewMode={previewMode}
          rawDebug={rawRttDebug}
          focusMetric={focusMetric}
          zoomEnabled={layerZoomEnabled}
          onZoomChange={onLayerZoomChange}
          interactionResetKey={`${interactionResetKey ?? sceneId}:${previewMode}:${resetSuffix}`}
          cameraState={layer.camera}
          channel={label === "Original" ? "camera-movement-original" : "camera-movement-current"}
          targetRegion={layer.targetRegion}
          accessibleLabel={`${label} Ground Glass`}
          stageLabel={`${label} Ground Glass`}
          lastFiniteFocusDepthMm={layer.camera.lastFiniteFocusDepthMm}
        />
      </section>
    ),
    [comparisonLabels, focusAssistEnabled, focusMetric, gridEnabled, interactionResetKey, previewMode, rawRttDebug, renderQuality, sceneId],
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
      {showHeader !== false && <h2 className="simulator-card-title">{UI_COPY.simulator.groundGlassTitle}</h2>}

      <div className="groundglass-controls">
        <div className="groundglass-control-groups">
          <fieldset className="groundglass-control-group">
            <legend className="control-group-title">Preview</legend>
            <div className="groundglass-control-group__options">
              <div className="choice-list choice-list--stacked">
                <label className="choice-label">
                  <input
                    className="form-radio"
                    type="radio"
                    name={`gg-preview-${sceneId}`}
                    checked={previewMode === "raw"}
                    onChange={() => { setPreviewMode("raw"); setGroundGlassAssistEnabled(false); }}
                  />
                  <span>Raw Ground Glass</span>
                </label>

                <label className="choice-label">
                  <input
                    className="form-radio"
                    type="radio"
                    name={`gg-preview-${sceneId}`}
                    checked={previewMode === "upright"}
                    onChange={() => { setPreviewMode("upright"); setGroundGlassAssistEnabled(true); }}
                  />
                  <span>Upright Assist</span>
                </label>
              </div>
            </div>
          </fieldset>

          <fieldset className="groundglass-control-group">
            <legend className="control-group-title">View Options</legend>
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
            Original and Current Ground Glass comparison
          </h3>
          <p id={comparisonDescriptionId} className="groundglass-comparison__intro">
            Compare the neutral camera with the selected movement.
          </p>
        </>
      ) : null}

      <div
        className={`groundglass-viewport-frame${expanded ? " groundglass-viewport-frame--expanded" : ""}`}
        aria-label="GroundGlassViewport"
      >
        {comparison ? (
          <section
            className="groundglass-comparison"
            role="region"
            aria-label="Original and Current Ground Glass comparison"
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
              opticsState={opticsState}
              assistEnabled={opticsState.groundGlassProjection.assistModeEnabled}
              focusAssistEnabled={focusAssistEnabled}
              gridEnabled={gridEnabled}
              riseMm={riseMm}
              tiltDeg={tiltDeg}
              swingDeg={swingDeg}
              focusDistanceMm={focusDistanceMm}
              aperture={aperture}
              renderQuality={renderQuality}
              sceneId={sceneId}
              previewMode={previewMode}
              rawDebug={rawRttDebug}
              focusMetric={focusMetric}
              zoomEnabled={zoomEnabled}
              onZoomChange={handleZoomChange}
              interactionResetKey={`${interactionResetKey ?? sceneId}:${previewMode}`}
            />
          </div>
        )}

        <button
          ref={expanded ? restoreTriggerRef : expandTriggerRef}
          type="button"
          aria-label={expanded ? "Restore Ground Glass" : "Expand Ground Glass"}
          title={expanded ? "Restore Ground Glass" : "Expand Ground Glass"}
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
