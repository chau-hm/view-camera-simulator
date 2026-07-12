import { UI_COPY } from "../../ui/copy";
import { formatDegrees, formatMillimeter } from "../../utils/formatters";
import type { RenderQualityProfile } from "../../types/ui";
import { calculateFocusTargetDisplaySharpness } from './focusTargetDisplay';

type GroundGlassReadoutsProps = {
  riseMm: number;
  tiltDeg: number;
  swingDeg: number;
  focusDistanceMm: number;
  aperture: number | string;
  renderQuality: RenderQualityProfile;
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
}: GroundGlassReadoutsProps) => {
  return (
    <div aria-label="CurrentSettingsReadout" className="simulator-info-card simulator-info-card--settings">
      <h4>{UI_COPY.simulator.groundGlassCurrentSettings}</h4>
      <dl className="current-settings-groups">
        <div className="current-settings-group">
          <dt>Movement</dt>
          <dd>
            <div className="current-settings-row">Rise {formatMillimeter(riseMm)}</div>
            <div className="current-settings-row">Tilt {formatDegrees(tiltDeg)}</div>
            <div className="current-settings-row">Swing {formatDegrees(swingDeg)}</div>
          </dd>
        </div>

        <div className="current-settings-group">
          <dt>Exposure &amp; focus</dt>
          <dd>
            <div className="current-settings-row">Focus {typeof focusDistanceMm === 'number' && isFinite(focusDistanceMm) ? formatMillimeter(focusDistanceMm) : '∞'}</div>
            <div className="current-settings-row">Aperture f/{aperture}</div>
          </dd>
        </div>

        <div className="current-settings-group">
          <dt>Display</dt>
          <dd>
            <div className="current-settings-row">Quality {String(renderQuality).charAt(0).toUpperCase() + String(renderQuality).slice(1)}</div>
          </dd>
        </div>
      </dl>
    </div>
  );
};
export const FocusTargetsReadout = ({ focusTargets }: { focusTargets?: { id: string; sharpnessPercent: number }[] }) => {
  return (
    <div aria-label="FocusTargetsReadout" className="simulator-info-card simulator-info-card--focus-targets">
      <h4>{UI_COPY.simulator.groundGlassFocusTargets}</h4>
      <div className="focus-target-list">
        {focusTargets && focusTargets.length > 0 ? (
          focusTargets.map((target) => {
            const display = calculateFocusTargetDisplaySharpness({ sharpness: target.sharpnessPercent / 100, id: target.id });
            const statusText = display === 100 ? 'Sharp' : display >= 65 ? 'Acceptable' : 'Soft';
            const cls = `focus-target-row ${display === 100 ? 'focus-target-row--sharp' : display >= 65 ? 'focus-target-row--acceptable' : 'focus-target-row--soft'}`;
            return (
              <div key={target.id} className={cls}>
                <div className="focus-target-row__header">
                  <span className="focus-target-row__name" title={target.id}>{formatTargetId(target.id)}</span>
                  <span className="focus-target-row__value">{display}%</span>
                </div>

                <div className="focus-target-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={display} aria-label={`${target.id} sharpness`}>
                  <div className="focus-target-progress__fill" style={{ width: `${display}%` }} />
                </div>

                <div className="focus-target-row__meta">{statusText}</div>
              </div>
            );
          })
        ) : (
          <div style={{ color: 'var(--text-muted)' }}>No focus targets</div>
        )}
      </div>
    </div>
  );
};

function formatTargetId(id: string) {
  // simple presentation cleanup: replace dashes with spaces and capitalize
  return id.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export const GroundGlassReadouts = ({
  riseMm,
  tiltDeg,
  swingDeg,
  focusDistanceMm,
  aperture,
  renderQuality,
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
      />

      <FocusTargetsReadout focusTargets={focusTargets} />
    </div>
  );
};
