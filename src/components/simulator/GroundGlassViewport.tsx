import { useState } from "react";
import { GroundGlassRenderer } from "../../render/GroundGlassRenderer";
import { ViewOptions } from "../controls/ViewOptions";
import { UI_COPY } from "../../ui/copy";
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
  canToggleGroundGlassAssist?: boolean;
  riseMm: number;
  tiltDeg: number;
  swingDeg: number;
  focusDistanceMm: number;
  aperture: ApertureValue;
  renderQuality: RenderQualityProfile;
  sceneId: string;
  lockReason?: string;
  rawRttDebug?: boolean;
  showHeader?: boolean;
};

export const GroundGlassViewport = ({
  opticsState,
  orientationAssistEnabled,
  focusAssistEnabled,
  gridEnabled,
  canToggleFocusAssist,
  canToggleGrid,
  canToggleGroundGlassAssist,
  riseMm,
  tiltDeg,
  swingDeg,
  focusDistanceMm,
  aperture,
  renderQuality,
  sceneId,
  lockReason,
  rawRttDebug,
  showHeader,
}: GroundGlassViewportProps) => {
  // Preview mode control local to the Ground Glass panel. Default to 'raw'.
  const [previewMode, setPreviewMode] = useState<"raw" | "upright">("raw");

  const [zoomEnabled, setZoomEnabled] = useState(false);

  return (
    <section className="groundglass-panel">
      {showHeader !== false && <h2 className="simulator-card-title">{UI_COPY.simulator.groundGlassTitle}</h2>}

      <div className="groundglass-controls">
        {/* Row 1: Preview label + radio choices inline */}
        <div className="groundglass-row">
          <div className="groundglass-label"><h3 className="control-group-title">Preview</h3></div>
          <div className="choice-list choice-list--inline">
            <label className="choice-label">
              <input
                className="form-radio"
                type="radio"
                name={`gg-preview-${sceneId}`}
                checked={previewMode === "raw"}
                onChange={() => setPreviewMode("raw")}
              />
              <span>Raw Ground Glass</span>
            </label>

            <label className="choice-label">
              <input
                className="form-radio"
                type="radio"
                name={`gg-preview-${sceneId}`}
                checked={previewMode === "upright"}
                onChange={() => setPreviewMode("upright")}
              />
              <span>Upright Assist</span>
            </label>
          </div>
        </div>

        {/* Row 2: View Options label + inline checkboxes */}
        <div className="groundglass-row">
          <div className="groundglass-label"><h3 className="control-group-title">View Options</h3></div>
          <div className="choice-list choice-list--inline">
            <ViewOptions
              canToggleGroundGlassAssist={sceneId !== "focus-fundamentals-two-targets" ? (canToggleGroundGlassAssist ?? orientationAssistEnabled) : false}
              showGroundGlassAssist={sceneId !== "focus-fundamentals-two-targets"}
              canToggleFocusAssist={canToggleFocusAssist ?? true}
              canToggleGrid={canToggleGrid ?? true}
              lockReason={lockReason ?? ""}
              compact
            />
          </div>
        </div>

        {/* Row 3: Zoom button right-aligned */}
        <div className="groundglass-row groundglass-zoom-row">
          <div />
          <div className="groundglass-zoom">
            <button
              type="button"
              onClick={() => setZoomEnabled((s) => !s)}
              aria-pressed={zoomEnabled}
              className={`btn btn--compact btn--nowrap ${zoomEnabled ? 'btn--primary' : 'btn--secondary'}`}
            >
              <span className="material-symbols-outlined" aria-hidden="true">{zoomEnabled ? 'zoom_out' : 'zoom_in'}</span>
              <span style={{ marginLeft: 6 }}>{zoomEnabled ? UI_COPY.simulator.groundGlassZoomOut : UI_COPY.simulator.groundGlassZoomIn}</span>
            </button>
          </div>
        </div>

      </div>

      <div className="groundglass-viewport-frame" aria-label="GroundGlassViewport">
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
          zoomEnabled={zoomEnabled}
        />
      </div>
    </section>
  );
};
