import { useTranslation } from "react-i18next";
import "../../i18n";
import { readoutMessageKeys, type ReadoutMessageKey } from "../../i18n/readoutMessageKeys";
import { formatDegrees, formatMillimeter } from "../../utils/formatters";
import type { RenderQualityProfile } from "../../types/ui";
import type { CameraMovementField } from "../../types/scene";
import type { FocusStandard } from "../../types/camera";
import type { CameraMovementPublicReadout } from "../../scenes/cameraMovementPublicTeaching";
import type { LearnerReadoutSettingsVariant } from "./learnerReadoutPolicy";

type ActiveMovementInfo = {
  field: CameraMovementField;
  value: number;
};

type GroundGlassReadoutsProps = {
  riseMm: number;
  tiltDeg: number;
  swingDeg: number;
  focusDistanceMm: number;
  aperture: number | string;
  renderQuality: RenderQualityProfile;
  focusTargets?: { id: string; sharpnessPercent: number }[];
  /** Optional active movement info for single-movement scenes. */
  activeMovement?: ActiveMovementInfo | null;
  /** Optional public teaching readout for Understanding Camera Movements. */
  teachingReadout?: CameraMovementPublicReadout | null;
  /** Focus-standard teaching readout, used only by Focus Fundamentals. */
  focusStandard?: FocusStandard;
  /** Presentation variant selected by the scene-aware learner-readout policy. */
  settingsVariant?: LearnerReadoutSettingsVariant;
  /** Scene-specific whole-camera lateral position used by Mirror Shift. */
  cameraPositionMm?: number;
  /** Scene-specific front-standard shift used by Mirror Shift. */
  frontShiftMm?: number;
};

export type FocusTargetMetric = "point" | "patch" | "focus";

const MOVEMENT_LABEL_KEYS: Record<CameraMovementField, ReadoutMessageKey> = {
  frontRiseMm: readoutMessageKeys.controls.frontRise,
  rearRiseMm: readoutMessageKeys.controls.rearRise,
  frontTiltDeg: readoutMessageKeys.controls.frontTilt,
  rearTiltDeg: readoutMessageKeys.controls.rearTilt,
  frontSwingDeg: readoutMessageKeys.controls.frontSwing,
};

const formatMovementValue = (field: CameraMovementField, value: number): string => {
  if (field === "frontRiseMm" || field === "rearRiseMm") return formatMillimeter(value);
  return formatDegrees(value);
};

const FRONT_MOVEMENT_FIELDS: ReadonlyArray<{
  field: "frontRiseMm" | "frontTiltDeg" | "frontSwingDeg";
  valueKey: "riseMm" | "tiltDeg" | "swingDeg";
}> = [
  { field: "frontRiseMm", valueKey: "riseMm" },
  { field: "frontTiltDeg", valueKey: "tiltDeg" },
  { field: "frontSwingDeg", valueKey: "swingDeg" },
];

const focusTargetMetricKey = (metric: FocusTargetMetric): ReadoutMessageKey => {
  switch (metric) {
    case "point":
      return readoutMessageKeys.focusTargets.pointFocus;
    case "patch":
      return readoutMessageKeys.focusTargets.patchCoverage;
    case "focus":
      return readoutMessageKeys.focusTargets.focus;
  }
};

const focusTargetStatusKey = (status: string | undefined): ReadoutMessageKey => {
  switch (status) {
    case "sharp":
      return readoutMessageKeys.focusTargets.sharp;
    case "acceptable":
      return readoutMessageKeys.focusTargets.acceptable;
    default:
      return readoutMessageKeys.focusTargets.soft;
  }
};

export const CurrentSettingsReadout = ({
  riseMm,
  tiltDeg,
  swingDeg,
  focusDistanceMm,
  aperture,
  activeMovement,
  teachingReadout,
  focusStandard,
  settingsVariant = "standard",
  cameraPositionMm = 0,
  frontShiftMm = 0,
}: GroundGlassReadoutsProps) => {
  const { t } = useTranslation();

  const formatTeachingReadout = (readout: CameraMovementPublicReadout): string => {
    const translateMovementText = (text: string): string =>
      text
        .replace("Front tilt", t(readoutMessageKeys.teaching.frontTilt))
        .replace("Rear tilt", t(readoutMessageKeys.teaching.rearTilt))
        .replace("Front rise", t(readoutMessageKeys.teaching.frontRise))
        .replace("Rear rise", t(readoutMessageKeys.teaching.rearRise))
        .replace("Front fall", t(readoutMessageKeys.teaching.frontFall))
        .replace("Rear fall", t(readoutMessageKeys.teaching.rearFall))
        .replace("Higher viewpoint", t(readoutMessageKeys.teaching.higherViewpoint))
        .replace("Lower viewpoint", t(readoutMessageKeys.teaching.lowerViewpoint))
        .replace("Neutral viewpoint", t(readoutMessageKeys.teaching.neutralViewpoint))
        .replace("Body pitch", t(readoutMessageKeys.teaching.bodyPitch));

    if (readout.caseId === null) {
      if (readout.label === "Neutral viewpoint") {
        return t(readoutMessageKeys.teaching.neutralViewpoint);
      }

      const viewpointDirection = readout.label === "Higher viewpoint" ? "higher" : "lower";
      if (readout.title === "Viewpoint" && readout.value) {
        const percentMatch = readout.value.match(/^(\d+)% toward (higher|lower) viewpoint$/);
        if (percentMatch) {
          return t(
            percentMatch[2] === "higher"
              ? readoutMessageKeys.teaching.towardHigherViewpoint
              : readoutMessageKeys.teaching.towardLowerViewpoint,
            { percent: percentMatch[1] },
          );
        }
      }
      if (readout.title === "Viewpoint") {
        return t(
          viewpointDirection === "higher"
            ? readoutMessageKeys.teaching.higherViewpoint
            : readoutMessageKeys.teaching.lowerViewpoint,
        );
      }

      if (readout.title === "Tilt") {
        const labelKey = readout.label === "Front tilt"
          ? readoutMessageKeys.teaching.frontTilt
          : readoutMessageKeys.teaching.rearTilt;
        return `${t(labelKey)}${readout.value ? ` · ${readout.value}` : ""}`;
      }

      if (readout.title === "Vertical framing") {
        const standardKey = readout.label === "Front standard"
          ? readoutMessageKeys.teaching.frontVerticalFraming
          : readoutMessageKeys.teaching.rearVerticalFraming;
        const [position, movement] = readout.value.split(" · ");
        const positionKey = position === "Upper"
          ? readoutMessageKeys.teaching.upperFraming
          : position === "Lower"
            ? readoutMessageKeys.teaching.lowerFraming
            : readoutMessageKeys.teaching.middleFraming;
        return `${t(standardKey)} · ${t(positionKey)}${movement ? ` · ${movement}` : ""}`;
      }
    }

    // Legacy calibrated cases can still reach this presentation boundary.
    // Remove their internal A/B/C/D code while retaining the calibrated value.
    return translateMovementText(readout.label.replace(/^[A-Z]\d? · /, ""));
  };

  const renderMovement = settingsVariant === "movement" || settingsVariant === "standard";
  const renderExposureAndFocus = settingsVariant === "focus-fundamentals" || settingsVariant === "standard";
  const renderFocusMethod = settingsVariant === "focus-fundamentals";
  const renderViewpointAndFraming = settingsVariant === "mirror-shift";
  const movementGroupKey = settingsVariant === "movement"
    ? readoutMessageKeys.groups.movementRelationship
    : readoutMessageKeys.groups.movement;

  return (
    <div
      aria-label={t(readoutMessageKeys.currentSettings.ariaLabel)}
      className="simulator-info-card simulator-info-card--settings"
      data-testid="current-settings-readout"
    >
      <h4>{t(readoutMessageKeys.currentSettings.title)}</h4>
      <dl className="current-settings-groups">
        {renderMovement && (
          <div className="current-settings-group">
            <dt>{t(movementGroupKey)}</dt>
            <dd>
              {teachingReadout ? (
                <div className="current-settings-row">{formatTeachingReadout(teachingReadout)}</div>
              ) : activeMovement ? (
                <div className="current-settings-row">
                  {t(MOVEMENT_LABEL_KEYS[activeMovement.field])}: {formatMovementValue(activeMovement.field, activeMovement.value)}
                </div>
              ) : (
                FRONT_MOVEMENT_FIELDS.map(({ field, valueKey }) => {
                  const value = valueKey === "riseMm" ? riseMm : valueKey === "tiltDeg" ? tiltDeg : swingDeg;
                  return (
                    <div className="current-settings-row" key={field}>
                      {t(MOVEMENT_LABEL_KEYS[field])}: {formatMovementValue(field, value)}
                    </div>
                  );
                })
              )}
            </dd>
          </div>
        )}

        {renderFocusMethod && focusStandard && (
          <div className="current-settings-group">
            <dt>{t(readoutMessageKeys.groups.focusMethod)}</dt>
            <dd>
              <div className="current-settings-row">
                {t(focusStandard === "front" ? readoutMessageKeys.focusMethod.frontStandard : readoutMessageKeys.focusMethod.rearStandard)}
              </div>
              <div className="current-settings-row">
                {t(readoutMessageKeys.focusMethod.movement)} · {t(
                  focusStandard === "front"
                    ? readoutMessageKeys.focusMethod.frontRelationship
                    : readoutMessageKeys.focusMethod.rearRelationship,
                )}
              </div>
            </dd>
          </div>
        )}

        {renderExposureAndFocus && (
          <div className="current-settings-group">
            <dt>{t(readoutMessageKeys.groups.exposureFocus)}</dt>
            <dd>
              <div className="current-settings-row">
                {t(readoutMessageKeys.controls.focus)}: {typeof focusDistanceMm === "number" && isFinite(focusDistanceMm) ? formatMillimeter(focusDistanceMm) : "∞"}
              </div>
              <div className="current-settings-row">
                {t(readoutMessageKeys.controls.aperture)}: f/{aperture}
              </div>
            </dd>
          </div>
        )}

        {renderViewpointAndFraming && (
          <div className="current-settings-group">
            <dt>{t(readoutMessageKeys.groups.viewpointFraming)}</dt>
            <dd>
              <div className="current-settings-row">
                {t(readoutMessageKeys.controls.cameraPosition)}: {formatMillimeter(cameraPositionMm)}
              </div>
              <div className="current-settings-row">
                {t(readoutMessageKeys.controls.frontShift)}: {formatMillimeter(frontShiftMm)}
              </div>
            </dd>
          </div>
        )}
      </dl>
    </div>
  );
};

export const FocusTargetsReadout = ({
  focusTargets,
  metric,
  metricLabel,
  closestTargetId,
}: {
  focusTargets?: { id: string; status?: string; sharpnessPercent: number }[];
  metric?: FocusTargetMetric;
  /** Compatibility input for existing presentation callers; new callers use the semantic metric. */
  metricLabel?: "Point focus" | "Patch coverage" | "Focus";
  closestTargetId?: string;
}) => {
  const { t } = useTranslation();
  if (!focusTargets || focusTargets.length === 0) return null;

  const resolvedMetric: FocusTargetMetric = metric ?? (
    metricLabel === "Point focus" ? "point" : metricLabel === "Patch coverage" ? "patch" : "focus"
  );
  const localizedMetricLabel = t(focusTargetMetricKey(resolvedMetric));

  return (
    <div
      aria-label={t(readoutMessageKeys.focusTargets.ariaLabel)}
      className="simulator-info-card simulator-info-card--focus-targets"
      data-testid="focus-targets-readout"
    >
      <h4>{t(readoutMessageKeys.focusTargets.title)} · {localizedMetricLabel}</h4>
      <div className="focus-target-list">
        {focusTargets.map((target) => {
          const display = Math.max(0, Math.min(100, Math.round(target.sharpnessPercent ?? 0)));
          const statusKey = focusTargetStatusKey(target.status);
          const cls = `focus-target-row ${target.status === "sharp" ? "focus-target-row--sharp" : target.status === "acceptable" ? "focus-target-row--acceptable" : "focus-target-row--soft"}`;
          return (
            <div key={target.id} className={cls}>
              <div className="focus-target-row__header">
                <span className="focus-target-row__name" title={target.id}>{formatTargetId(target.id)}</span>
                <span className="focus-target-row__value">{display}%</span>
              </div>
              <div
                className="focus-target-progress"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={display}
                aria-label={t(readoutMessageKeys.focusTargets.sharpnessAria, { target: target.id })}
              >
                <div className="focus-target-progress__fill" style={{ width: `${display}%` }} />
              </div>
              <div className="focus-target-row__meta">
                {localizedMetricLabel} · {t(statusKey)}
                {target.id === closestTargetId ? ` · ${t(readoutMessageKeys.focusTargets.closestPoint)}` : ""}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

function formatTargetId(id: string) {
  return id.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export const GroundGlassReadouts = ({
  riseMm,
  tiltDeg,
  swingDeg,
  focusDistanceMm,
  aperture,
  renderQuality,
  focusTargets,
  activeMovement,
  focusStandard,
  settingsVariant,
  cameraPositionMm,
  frontShiftMm,
}: GroundGlassReadoutsProps) => {
  const { t } = useTranslation();

  return (
    <div aria-label={t(readoutMessageKeys.container.ariaLabel)} data-testid="ground-glass-readouts" style={{ display: "grid", gap: "0.5rem" }}>
      <CurrentSettingsReadout
        riseMm={riseMm}
        tiltDeg={tiltDeg}
        swingDeg={swingDeg}
        focusDistanceMm={focusDistanceMm}
        aperture={aperture}
        renderQuality={renderQuality}
        activeMovement={activeMovement}
        focusStandard={focusStandard}
        settingsVariant={settingsVariant}
        cameraPositionMm={cameraPositionMm}
        frontShiftMm={frontShiftMm}
      />
      <FocusTargetsReadout focusTargets={focusTargets} />
    </div>
  );
};
