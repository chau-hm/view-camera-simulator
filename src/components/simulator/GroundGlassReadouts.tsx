import { UI_COPY } from "../../ui/copy";
import { formatDegrees, formatMillimeter } from "../../utils/formatters";
import type { RenderQualityProfile } from "../../types/ui";
import type { GroundGlassDofPipeline } from "../../render/groundGlassPipeline";
import { getRenderQualitySettings } from "../../render/renderQuality";

type GroundGlassReadoutsProps = {
  riseMm: number;
  tiltDeg: number;
  swingDeg: number;
  focusDistanceMm: number;
  aperture: number | string;
  renderQuality: RenderQualityProfile;
  pipeline: GroundGlassDofPipeline;
  qualitySettings: ReturnType<typeof getRenderQualitySettings>;
  lastFiniteFocusDepthMm?: number | null;
  focusTargets?: { id: string; sharpnessPercent: number }[];
};

export const GroundGlassReadouts = ({
  riseMm,
  tiltDeg,
  swingDeg,
  focusDistanceMm,
  aperture,
  renderQuality,
  pipeline,
  qualitySettings,
  lastFiniteFocusDepthMm,
  focusTargets,
}: GroundGlassReadoutsProps) => {
  return (
    <div aria-label="GroundGlassReadouts" style={{ display: 'grid', gap: '0.5rem' }}>
      {/* Current Settings */}
      <div style={{ display: "grid", gap: "0.25rem", fontSize: 12 }}>
        <strong>{UI_COPY.simulator.groundGlassCurrentSettings}</strong>
        <span>
          Rise {formatMillimeter(riseMm)} | Tilt {formatDegrees(tiltDeg)} | Swing {formatDegrees(swingDeg)}
        </span>
        <span>
          {typeof focusDistanceMm === 'number' && isFinite(focusDistanceMm) ? (
            <span>Focus {formatMillimeter(focusDistanceMm)} | Aperture f/{aperture}</span>
          ) : (
            <span>Focus ∞ | Aperture f/{aperture} <span style={{ fontSize: 11, color: '#94a3b8' }}> (Last finite: {lastFiniteFocusDepthMm ? formatMillimeter(lastFiniteFocusDepthMm) : '—'})</span></span>
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

      {/* Focus targets readout (if any) */}
      {focusTargets && (
        <div style={{ display: "grid", gap: "0.25rem", fontSize: 12 }}>
          <strong>{UI_COPY.simulator.groundGlassFocusTargets}</strong>
          {focusTargets.map((target) => (
            <span key={target.id}>
              {target.id} — {target.sharpnessPercent}%
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
