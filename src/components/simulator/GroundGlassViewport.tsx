import { useCallback, useEffect, useRef, useState } from "react";
import { GroundGlassRenderer } from "../../render/GroundGlassRenderer";
import { ViewOptions } from "../controls/ViewOptions";
import { UI_COPY } from "../../ui/copy";
import { useAppStore } from "../../state/appStore";
import type { ApertureValue } from "../../types/camera";
import type { DerivedOpticsState } from "../../types/optics";
import type { RenderQualityProfile } from "../../types/ui";

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
}: GroundGlassViewportProps) => {
  // Preview mode control local to the Ground Glass panel. Default to camera state
  const groundGlassAssistEnabled = useAppStore((s) => s.camera.groundGlassAssistEnabled);
  const setGroundGlassAssistEnabled = useAppStore((s) => s.setGroundGlassAssistEnabled);
  const [previewMode, setPreviewMode] = useState<"raw" | "upright">(groundGlassAssistEnabled ? "upright" : "raw");

  const [zoomEnabled, setZoomEnabled] = useState(false);
  const expandTriggerRef = useRef<HTMLButtonElement | null>(null);
  const restoreTriggerRef = useRef<HTMLButtonElement | null>(null);
  const previouslyExpandedRef = useRef(expanded);
  const handleZoomChange = useCallback((nextZoomed: boolean) => {
    setZoomEnabled(nextZoomed);
  }, []);

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

      <div
        className={`groundglass-viewport-frame${expanded ? " groundglass-viewport-frame--expanded" : ""}`}
        aria-label="GroundGlassViewport"
        onKeyDownCapture={(event) => {
          if (expanded && event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            onRequestRestore();
          }
        }}
      >
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
