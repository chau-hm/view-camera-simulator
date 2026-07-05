import { useState } from "react";
import { GroundGlassRenderer } from "../../render/GroundGlassRenderer";
import { ViewOptions } from "../controls/ViewOptions";
import type { ApertureValue } from "../../types/camera";
import type { DerivedOpticsState } from "../../types/optics";
import type { RenderQualityProfile } from "../../types/ui";
import { UI_COPY } from "../../ui/copy";

type GroundGlassViewportProps = {
  opticsState: DerivedOpticsState;
  orientationAssistEnabled: boolean;
  focusAssistEnabled: boolean;
  gridEnabled: boolean;
  riseMm: number;
  tiltDeg: number;
  swingDeg: number;
  focusDistanceMm: number;
  aperture: ApertureValue;
  renderQuality: RenderQualityProfile;
  sceneId: string;
  lockReason?: string;
  rawRttDebug?: boolean;
  onRawRttDebugChange?: (v: boolean) => void;
};

export const GroundGlassViewport = ({
  opticsState,
  orientationAssistEnabled,
  focusAssistEnabled,
  gridEnabled,
  riseMm,
  tiltDeg,
  swingDeg,
  focusDistanceMm,
  aperture,
  renderQuality,
  sceneId,
  lockReason,
  rawRttDebug,
  onRawRttDebugChange,
}: GroundGlassViewportProps) => {
  // Preview mode control local to the Ground Glass panel. Default to 'raw'.
  const [previewMode, setPreviewMode] = useState<"raw" | "upright">("raw");

  return (
    <section>
      <h2>{UI_COPY.simulator.groundGlassTitle}</h2>
      <div style={{ display: "grid", gap: "0.5rem" }}>
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
          onPreviewModeChange={setPreviewMode}
          rawDebug={rawRttDebug}
          onRawDebugChange={onRawRttDebugChange}
        />

        {/* Preview selector placed adjacent to the Ground Glass view */}
        <section aria-label={UI_COPY.render.groundGlassPreview}>
          <h4>{UI_COPY.render.groundGlassPreview}</h4>
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
        </section>

        {/* View Options grouped near the Ground Glass view */}
        <ViewOptions
          orientationAssistEnabled={orientationAssistEnabled}
          focusAssistEnabled={focusAssistEnabled}
          gridEnabled={gridEnabled}
          lockReason={lockReason ?? ""}
        />
      </div>
    </section>
  );
};
