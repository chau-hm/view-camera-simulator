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
    <section>
      {showHeader !== false && <h2>{UI_COPY.simulator.groundGlassTitle}</h2>}

      {/* GroundGlassColumn */}
      <div style={{ display: "flex", gap: "0.75rem", flexWrap: 'wrap', alignItems: 'flex-start' }}>
        {/* Preview block */}
        <section aria-label={UI_COPY.render.groundGlassPreview} style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 200 }}>
          <h3>Preview</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label>
              <input
                type="radio"
                name={`gg-preview-${sceneId}`}
                checked={previewMode === "raw"}
                onChange={() => setPreviewMode("raw")}
              />
              Raw Ground Glass
            </label>
            <label>
              <input
                type="radio"
                name={`gg-preview-${sceneId}`}
                checked={previewMode === "upright"}
                onChange={() => setPreviewMode("upright")}
              />
              Upright Assist
            </label>
          </div>
        </section>

        {/* View Options grouped near the Ground Glass view */}
        <div style={{ minWidth: 180 }}>
          <ViewOptions
            canToggleGroundGlassAssist={sceneId !== "focus-fundamentals-two-targets" ? (canToggleGroundGlassAssist ?? orientationAssistEnabled) : false}
            showGroundGlassAssist={sceneId !== "focus-fundamentals-two-targets"}
            canToggleFocusAssist={canToggleFocusAssist ?? true}
            canToggleGrid={canToggleGrid ?? true}
            lockReason={lockReason ?? ""}
          />
        </div>

        {/* Zoom controls aligned to the right */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => setZoomEnabled((s) => !s)}
            aria-pressed={zoomEnabled}
            style={{
              background: zoomEnabled ? '#0f172a' : '#ffffff',
              color: zoomEnabled ? '#ffffff' : '#0f172a',
              border: '1px solid rgba(2,6,23,0.08)',
              padding: '6px 10px',
              borderRadius: 6,
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            {zoomEnabled ? UI_COPY.simulator.groundGlassZoomOut : UI_COPY.simulator.groundGlassZoomIn}
          </button>
        </div>

        {/* GroundGlassViewport block: canvas and zoom (below controls) */}
        <div aria-label="GroundGlassViewport" style={{ display: 'grid', gap: '0.5rem', width: '100%' }}>
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

      </div>
    </section>
  );
};
