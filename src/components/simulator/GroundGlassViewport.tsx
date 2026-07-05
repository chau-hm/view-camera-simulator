import { useState } from "react";
import { GroundGlassRenderer } from "../../render/GroundGlassRenderer";
import { ViewOptions } from "../controls/ViewOptions";
import { createGroundGlassDofPipeline } from "../../render/groundGlassPipeline";
import { getRenderQualitySettings } from "../../render/renderQuality";
import { createFocusAssistPass } from "../../render/postprocessing/FocusAssistPass";
import { UI_COPY } from "../../ui/copy";
import { formatDegrees, formatMillimeter } from "../../utils/formatters";
import { verticalFovDegreesFromImageDistance, focusPlaneWidthMm, focusPlaneHeightMm, cocDiameterMm } from "../../core/optics/thinLensModel";
import { CAMERA_CONSTANTS } from "../../utils/constants";
import { getSceneById } from "../../scenes/definitions";
import { dot, subtract } from "../../core/math/vec";
import { useAppStore } from "../../state/appStore";
import type { ApertureValue } from "../../types/camera";
import type { DerivedOpticsState } from "../../types/optics";
import type { RenderQualityProfile } from "../../types/ui";

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
}: GroundGlassViewportProps) => {
  // Preview mode control local to the Ground Glass panel. Default to 'raw'.
  const [previewMode, setPreviewMode] = useState<"raw" | "upright">("raw");

  // Derived parameters for readout (match GroundGlassRenderer pipeline settings)
  const PANEL_WIDTH_PX = 500;
  const PANEL_HEIGHT_PX = 400;
  const pipeline = createGroundGlassDofPipeline(opticsState, PANEL_WIDTH_PX, PANEL_HEIGHT_PX, renderQuality);
  const qualitySettings = getRenderQualitySettings(renderQuality);
  const focusAssist = createFocusAssistPass({ enabled: focusAssistEnabled, targets: opticsState.focusTargets });
  const lastFiniteFocusDepthMm = useAppStore((s) => s.camera.lastFiniteFocusDepthMm);

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
          rawDebug={rawRttDebug}
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

        {/* Current Settings (moved here so controls appear immediately under canvas) */}
        <div style={{ display: "grid", gap: "0.25rem", fontSize: 12 }}>
          <strong>{UI_COPY.simulator.groundGlassCurrentSettings}</strong>
          <span>
            Rise {formatMillimeter(riseMm)} | Tilt {formatDegrees(tiltDeg)} | Swing {formatDegrees(swingDeg)}
          </span>
          <span>
            {opticsState.diagnostics?.isInfinityFocus ? (
              <span>Focus ∞ | Aperture f/{aperture} <span style={{ fontSize: 11, color: '#94a3b8' }}> (Last finite: {lastFiniteFocusDepthMm ? formatMillimeter(lastFiniteFocusDepthMm) : '—'})</span></span>
            ) : (
              <span>Focus {formatMillimeter(focusDistanceMm)} | Aperture f/{aperture}</span>
            )}
          </span>
          <span>
            Quality {renderQuality} | Color target: {pipeline.colorTarget.widthPx}×{pipeline.colorTarget.heightPx} | Blur pass: {pipeline.blurPass.widthPx}×{pipeline.blurPass.heightPx}
          </span>
          <span>
            Color target: {pipeline.colorTarget.textureId}, Depth target: {pipeline.depthTarget.depthTextureId}
          </span>
          <span>
            Camera source: {pipeline.camera.source}, Blur pass: {pipeline.blurPass.widthPx}×{pipeline.blurPass.heightPx}, Scale {qualitySettings.groundGlassScale}
          </span>
        </div>

        {/* Focus Fundamentals Debug (read-only) */}
        {sceneId === "focus-fundamentals-two-targets" && (() => {
          const imgDist = Math.abs(opticsState.filmPlane.point.z - opticsState.lensCenterWorld.z);
          const vFov = verticalFovDegreesFromImageDistance(101.6, imgDist);
          const hFov = (2 * Math.atan(127 / (2 * imgDist))) * (180 / Math.PI);
          const focusW = focusPlaneWidthMm(127, focusDistanceMm, imgDist);
          const focusH = focusPlaneHeightMm(101.6, focusDistanceMm, imgDist);

          const sceneDef = sceneId ? getSceneById(sceneId) : undefined;

          const nearZ = opticsState.depthOfFieldNearPlane ? opticsState.depthOfFieldNearPlane.point.z : NaN;
          const farZ = opticsState.depthOfFieldFarPlane ? opticsState.depthOfFieldFarPlane.point.z : Number.POSITIVE_INFINITY;

          return (
            <div style={{ display: "grid", gap: "0.125rem", fontSize: 12, borderTop: "1px dashed #e5e7eb", paddingTop: "0.5rem" }}>
              <strong>Focus Fundamentals Debug</strong>
              <span>Focal length: {CAMERA_CONSTANTS.focalLengthMm} mm</span>
              <span>Aperture: f/{aperture}</span>
              {opticsState.diagnostics?.isInfinityFocus ? (
                <div style={{ color: '#e5e7eb', fontSize: 13 }}>
                  <div>Focus: ∞</div>
                  <div>Last finite focus: {formatMillimeter(focusDistanceMm)}</div>
                  <div>Lens extension: {formatMillimeter(Math.abs(opticsState.lensCenterWorld.z))}</div>
                  <div>Extension beyond infinity: 0.00 mm</div>
                  <div>Focus plane: ∞</div>
                  <div>
                    Near DOF: {opticsState.depthOfFieldNearPlane ? `${(opticsState.depthOfFieldNearPlane.point.z / 1000).toFixed(2)} m` : '—'}
                    {opticsState.depthOfFieldNearPlane ? (
                      (() => {
                        const nearDist = dot(subtract(opticsState.depthOfFieldNearPlane!.point, opticsState.lensCenterWorld), opticsState.opticalAxis.direction);
                        const cap = opticsState.sceneVisualCapDepthMm ?? 12000;
                        const visible = Number.isFinite(nearDist) && nearDist <= cap;
                        return <span> — {visible ? 'visible in current visual cap' : 'outside current visual cap'}</span>;
                      })()
                    ) : null}
                  </div>
                  <div>Far DOF: ∞</div>
                  <div>Visual cap: {(opticsState.sceneVisualCapDepthMm ? (opticsState.sceneVisualCapDepthMm / 1000).toFixed(2) : '12.00')} m</div>
                </div>
              ) : (
                <span>Focus distance: {formatMillimeter(focusDistanceMm)}</span>
              )}
              <span>Image distance: {imgDist.toFixed(2)} mm</span>
              <span>Sensor: {CAMERA_CONSTANTS.filmWidthMm} × {CAMERA_CONSTANTS.filmHeightMm} mm</span>
              <span>Vertical FOV: {vFov.toFixed(3)}° | Horizontal FOV: {hFov.toFixed(3)}°</span>
              {!opticsState.diagnostics?.isInfinityFocus && (
                <span>Focus plane dims: {focusW.toFixed(2)} × {focusH.toFixed(2)} mm</span>
              )}
              <span>
                DOF near Z: {Number.isFinite(nearZ) ? `${nearZ.toFixed(2)} mm` : '—'} | DOF far Z: {Number.isFinite(farZ) ? `${farZ.toFixed(2)} mm` : '∞'}
              </span>
              {sceneDef?.focusTargets.map((t) => {
                // compute axial distance U from lens center along optical axis — do NOT use world Z directly
                const U = Math.max(1e-6, dot(subtract(t.worldPosition, opticsState.lensCenterWorld), opticsState.opticalAxis.direction));
                const coc = cocDiameterMm(CAMERA_CONSTANTS.focalLengthMm, aperture as number, imgDist, U);
                return (
                  <span key={t.id}>{t.id}: axial depth {U.toFixed(2)} mm | CoC {coc.toFixed(3)} mm</span>
                );
              })}
            </div>
          );
        })()}

        {focusAssist.targets && (
          <div style={{ display: "grid", gap: "0.25rem", fontSize: 12 }}>
            <strong>{UI_COPY.simulator.groundGlassFocusTargets}</strong>
            {focusAssist.targets.map((target) => (
              <span key={target.id}>
                {target.id} — {target.sharpnessPercent}%
              </span>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};
