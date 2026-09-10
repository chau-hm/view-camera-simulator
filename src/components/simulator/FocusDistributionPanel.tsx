import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import "../../i18n";
import { readoutMessageKeys } from "../../i18n/readoutMessageKeys";
import {
  createFocusDistributionLayout,
  type FocusDistributionTarget,
} from "./focusDistributionLayout";
import type { GroundGlassPreviewMode } from "../../render/groundGlassTargetProjection";

export type FocusTargetMetric = "point" | "patch" | "focus";

type FocusDistributionPanelProps = {
  sceneId: string;
  focusTargets?: readonly FocusDistributionTarget[];
  previewMode: GroundGlassPreviewMode;
  metric?: FocusTargetMetric;
  closestTargetId?: string;
};

const focusTargetMetricKey = (metric: FocusTargetMetric) => {
  switch (metric) {
    case "point":
      return readoutMessageKeys.focusTargets.pointFocus;
    case "patch":
      return readoutMessageKeys.focusTargets.patchCoverage;
    case "focus":
      return readoutMessageKeys.focusTargets.focus;
  }
};

const focusTargetStatusKey = (status: string | undefined) => {
  switch (status) {
    case "sharp":
      return readoutMessageKeys.focusTargets.sharp;
    case "acceptable":
      return readoutMessageKeys.focusTargets.acceptable;
    default:
      return readoutMessageKeys.focusTargets.soft;
  }
};

const clampSharpnessPercent = (value: number): number =>
  Math.max(0, Math.min(100, Math.round(value ?? 0)));

const statusClass = (status: string | undefined): string => {
  if (status === "sharp") return "focus-distribution-cell--sharp";
  if (status === "acceptable") return "focus-distribution-cell--acceptable";
  return "focus-distribution-cell--soft";
};

const statusGlyph = (status: string | undefined): string => {
  if (status === "sharp") return "✓";
  if (status === "acceptable") return "~";
  return "—";
};

const focusDistributionCellStyle = (display: number): CSSProperties => ({
  "--focus-distribution-tint": `rgba(53, 200, 237, ${0.04 + (display / 100) * 0.2})`,
  "--focus-distribution-border": `rgba(143, 234, 255, ${0.16 + (display / 100) * 0.52})`,
  "--focus-distribution-glow": `rgba(53, 200, 237, ${0.04 + (display / 100) * 0.14})`,
} as CSSProperties);

export const FocusDistributionPanel = ({
  sceneId,
  focusTargets,
  previewMode,
  metric,
  closestTargetId,
}: FocusDistributionPanelProps) => {
  const { t } = useTranslation();
  if (!focusTargets || focusTargets.length === 0) return null;

  const layout = createFocusDistributionLayout(sceneId, focusTargets);
  const title = t(readoutMessageKeys.focusDistribution.title);
  const orientationLabel = t(
    previewMode === "raw"
      ? readoutMessageKeys.focusDistribution.raw
      : readoutMessageKeys.focusDistribution.upright,
  );
  const metricLabel = metric ? t(focusTargetMetricKey(metric)) : null;
  const statusForTarget = (status: string | undefined) => t(focusTargetStatusKey(status));

  return (
    <section
      aria-label={metricLabel ? `${t(readoutMessageKeys.focusDistribution.ariaLabel)} · ${metricLabel}` : t(readoutMessageKeys.focusDistribution.ariaLabel)}
      className="simulator-info-card simulator-info-card--focus-distribution"
      data-testid="focus-distribution-panel"
    >
      <div className="focus-distribution-panel__header">
        <h4 className="focus-distribution-panel__title">{title}</h4>
        <span
          aria-label={t(readoutMessageKeys.focusDistribution.orientationAria, { orientation: orientationLabel })}
          className="focus-distribution-panel__orientation"
          data-testid="focus-distribution-orientation"
        >
          {orientationLabel}
        </span>
      </div>

      <table
        aria-label={title}
        className="focus-distribution-panel__table"
      >
        <caption className="focus-distribution-panel__visually-hidden">{title}</caption>
        <tbody>
          {layout.rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell) => {
                if (!cell.target) {
                  return <td aria-hidden="true" className="focus-distribution-cell focus-distribution-cell--empty" key={`${cell.rowIndex}-${cell.columnIndex}`} />;
                }

                const target = cell.target;
                const display = clampSharpnessPercent(target.sharpnessPercent);
                const positionLabel = t(cell.positionLabelKey);
                const targetLabel = target.targetLabelKey ? t(target.targetLabelKey) : positionLabel;
                const accessibleTargetLabel = targetLabel === positionLabel
                  ? positionLabel
                  : `${positionLabel} · ${targetLabel}`;
                const statusLabel = statusForTarget(target.status);
                const closestLabel = target.id === closestTargetId
                  ? ` · ${t(readoutMessageKeys.focusTargets.closestPoint)}`
                  : "";

                return (
                  <td
                    aria-label={t(readoutMessageKeys.focusDistribution.targetAria, {
                      target: accessibleTargetLabel,
                      percent: `${display}%`,
                      status: statusLabel,
                      closest: closestLabel,
                    })}
                    className={`focus-distribution-cell ${statusClass(target.status)}`}
                    data-focus-target-id={target.id}
                    key={`${cell.rowIndex}-${cell.columnIndex}`}
                    style={focusDistributionCellStyle(display)}
                  >
                    <span className="focus-distribution-cell__position" title={positionLabel}>{targetLabel}</span>
                    <span className="focus-distribution-cell__value">
                      {display}%
                      <span aria-hidden="true" className="focus-distribution-cell__status">
                        {statusGlyph(target.status)}
                      </span>
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {layout.unplaced.length > 0 ? (
        <div
          aria-label={t(readoutMessageKeys.focusDistribution.additionalTargetsAria)}
          className="focus-distribution-panel__additional"
        >
          {layout.unplaced.map((target) => {
            const display = clampSharpnessPercent(target.sharpnessPercent);
            const targetLabel = target.targetLabelKey
              ? t(target.targetLabelKey)
              : t(readoutMessageKeys.focusDistribution.unplacedTarget);
            const statusLabel = statusForTarget(target.status);
            return (
              <span
                aria-label={t(readoutMessageKeys.focusDistribution.targetAria, {
                  target: targetLabel,
                  percent: `${display}%`,
                  status: statusLabel,
                  closest: target.id === closestTargetId
                    ? ` · ${t(readoutMessageKeys.focusTargets.closestPoint)}`
                    : "",
                })}
                className={`focus-distribution-panel__additional-item ${statusClass(target.status)}`}
                data-focus-target-id={target.id}
                key={target.id}
              >
                <span>{targetLabel}</span>
                <strong>{display}%</strong>
                <span aria-hidden="true">{statusGlyph(target.status)}</span>
              </span>
            );
          })}
        </div>
      ) : null}
    </section>
  );
};
