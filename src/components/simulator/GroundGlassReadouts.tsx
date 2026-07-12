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
  // new: RTT runtime info for RTT-capable scenes
  rttRuntimeInfo?: import("../../render/groundGlassRttDimensions").GroundGlassRttRuntimeInfo | null;
};

export const CurrentSettingsReadout = ({
  riseMm,
  tiltDeg,
  swingDeg,
  focusDistanceMm,
  aperture,
  renderQuality,
  pipeline,
  qualitySettings,
  lastFiniteFocusDepthMm,
  rttRuntimeInfo,
}: GroundGlassReadoutsProps) => {
  // RTT-specific compact readout when runtime info is available
  if (rttRuntimeInfo) {
    return (
      <div aria-label="CurrentSettingsReadout" className="simulator-info-card" style={{ display: 'grid', gap: '0.5rem' }}>
        <h4>{UI_COPY.simulator.groundGlassCurrentSettings}</h4>
        <div style={{ display: "grid", gap: "0.25rem", fontSize: 13 }}>
          <div>Rise {formatMillimeter(riseMm)} | Tilt {formatDegrees(tiltDeg)} | Swing {formatDegrees(swingDeg)}</div>
          <div>
            {typeof focusDistanceMm === 'number' && isFinite(focusDistanceMm) ? (
              <span>Focus {formatMillimeter(focusDistanceMm)} | Aperture f/{aperture}</span>
            ) : (
              <span>Focus ∞ | Aperture f/{aperture} <span style={{ fontSize: 12, color: 'var(--text-muted)' }}> (Last finite: {lastFiniteFocusDepthMm ? formatMillimeter(lastFiniteFocusDepthMm) : '—'})</span></span>
            )}
          </div>
          <div>Quality: {renderQuality}</div>
          <div>Display: {rttRuntimeInfo.logicalWidthPx}×{rttRuntimeInfo.logicalHeightPx}</div>
          <div>Canvas DPR: configured {rttRuntimeInfo.configuredCanvasDpr} / actual {rttRuntimeInfo.rendererPixelRatio}</div>
          <div>Drawing buffer: {rttRuntimeInfo.drawingBufferWidthPx}×{rttRuntimeInfo.drawingBufferHeightPx}</div>
          <div>RTT color: {rttRuntimeInfo.colorTargetWidthPx}×{rttRuntimeInfo.colorTargetHeightPx}</div>
          <div>RTT depth: {rttRuntimeInfo.depthTargetWidthPx}×{rttRuntimeInfo.depthTargetHeightPx}</div>
          <div>RTT blur: {rttRuntimeInfo.blurTargetWidthPx}×{rttRuntimeInfo.blurTargetHeightPx}</div>
          <div>Resolution scale: {rttRuntimeInfo.resolutionScale.toFixed(2)}×</div>
          <div>Zoom scale: {rttRuntimeInfo.zoomRenderScale.toFixed(2)}×</div>
          <div>Clamped: {rttRuntimeInfo.wasClamped ? 'Yes' : 'No'}</div>
          <div>Generation: {rttRuntimeInfo.resourceGeneration}</div>
        </div>
      </div>
    );
  }

  // fallback: legacy pipeline-shaped readout
  return (
    <div aria-label="CurrentSettingsReadout" className="simulator-info-card" style={{ display: 'grid', gap: '0.5rem' }}>
      <h4>{UI_COPY.simulator.groundGlassCurrentSettings}</h4>
      <div style={{ display: "grid", gap: "0.25rem", fontSize: 13 }}>
        <div>Rise {formatMillimeter(riseMm)} | Tilt {formatDegrees(tiltDeg)} | Swing {formatDegrees(swingDeg)}</div>
        <div>
          {typeof focusDistanceMm === 'number' && isFinite(focusDistanceMm) ? (
            <span>Focus {formatMillimeter(focusDistanceMm)} | Aperture f/{aperture}</span>
          ) : (
            <span>Focus ∞ | Aperture f/{aperture} <span style={{ fontSize: 12, color: 'var(--text-muted)' }}> (Last finite: {lastFiniteFocusDepthMm ? formatMillimeter(lastFiniteFocusDepthMm) : '—'})</span></span>
          )}
        </div>
        <div>Quality {renderQuality}</div>
        <div>Color target: {pipeline.colorTarget.widthPx}×{pipeline.colorTarget.heightPx}</div>
        <div>Blur pass: {pipeline.blurPass.widthPx}×{pipeline.blurPass.heightPx}</div>
        <div>Color target: {pipeline.colorTarget.textureId}, Depth target: {pipeline.depthTarget.depthTextureId}</div>
        <div>Camera source: {pipeline.camera.source}, Scale {qualitySettings.groundGlassScale}</div>
      </div>
    </div>
  );
};

export const FocusTargetsReadout = ({ focusTargets }: { focusTargets?: { id: string; sharpnessPercent: number }[] }) => {
  return (
    <div aria-label="FocusTargetsReadout" className="simulator-info-card" style={{ display: 'grid', gap: '0.5rem' }}>
      <h4>{UI_COPY.simulator.groundGlassFocusTargets}</h4>
      <div style={{ display: "grid", gap: "0.25rem", fontSize: 13 }}>
        {focusTargets && focusTargets.length > 0 ? (
          focusTargets.map((target) => (
            <div key={target.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ flex: 1 }}>{target.id}</div>
              <div style={{ width: 100, height: 8, background: '#eef2ff', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ width: `${target.sharpnessPercent}%`, height: '100%', background: 'var(--primary)' }} />
              </div>
              <div style={{ width: 46, textAlign: 'right' }}>{target.sharpnessPercent}%</div>
            </div>
          ))
        ) : (
          <div style={{ color: 'var(--text-muted)' }}>No focus targets</div>
        )}
      </div>
    </div>
  );
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
      <CurrentSettingsReadout
        riseMm={riseMm}
        tiltDeg={tiltDeg}
        swingDeg={swingDeg}
        focusDistanceMm={focusDistanceMm}
        aperture={aperture}
        renderQuality={renderQuality}
        pipeline={pipeline}
        qualitySettings={qualitySettings}
        lastFiniteFocusDepthMm={lastFiniteFocusDepthMm}
      />

      <FocusTargetsReadout focusTargets={focusTargets} />
    </div>
  );
};
