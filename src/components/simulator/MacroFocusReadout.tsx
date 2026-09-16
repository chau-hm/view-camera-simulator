import { useTranslation } from "react-i18next";
import { deriveMacroFocusMetrics, type MacroFocusMetrics } from "../../core/optics/deriveMacroFocusMetrics";
import type { DerivedOpticsState } from "../../types/optics";
import type { SceneMacroTeachingCapability } from "../../types/scene";
import { readoutMessageKeys } from "../../i18n/readoutMessageKeys";
import {
  formatMacroReproductionRatio,
  isMacroLifeSizeMagnification,
} from "../../scenes/macroBellowsExtensionTeaching";

export type MacroFocusReadoutProps = {
  diagnostics: DerivedOpticsState["diagnostics"];
  focalLengthMm: number;
  /** Optional workspace-derived metrics so all readers share one resolved model. */
  metrics?: MacroFocusMetrics | null;
  teachingCapability?: SceneMacroTeachingCapability;
};

export const MacroFocusReadout = ({
  diagnostics,
  focalLengthMm,
  metrics: resolvedMetrics,
  teachingCapability,
}: MacroFocusReadoutProps) => {
  const { t } = useTranslation();
  const keys = readoutMessageKeys.macroFocus;
  const { focusObjectDistanceMm, imageDistanceMm } = diagnostics;
  if (diagnostics.fallbackApplied || focusObjectDistanceMm == null || imageDistanceMm == null) return null;
  const metrics = resolvedMetrics ?? deriveMacroFocusMetrics({
    focalLengthMm, objectDistanceMm: focusObjectDistanceMm, imageDistanceMm,
  });
  if (!metrics) return null;
  const bellowsTeachingCapability = teachingCapability?.kind === "bellows-extension"
    ? teachingCapability
    : null;
  const lifeSize = bellowsTeachingCapability !== null && isMacroLifeSizeMagnification({
    magnification: metrics.magnification,
    focusObjectDistanceMm,
  });
  const capacityWarning = bellowsTeachingCapability !== null &&
    metrics.bellowsExtensionMm >= bellowsTeachingCapability.availableBellowsTravelMm * 0.85;
  return (
    <section className="simulator-info-card macro-focus-readout" aria-label={t(keys.title)}>
      <h3>{t(keys.title)}</h3>
      <dl>
        <div><dt>{t(bellowsTeachingCapability ? keys.requiredExtension : keys.extension)}</dt><dd>{metrics.bellowsExtensionMm.toFixed(1)} mm</dd></div>
        <div><dt>{t(keys.magnification)}</dt><dd>{metrics.magnification.toFixed(2)}×</dd></div>
        {bellowsTeachingCapability && (
          <div><dt>{t(keys.reproductionRatio)}</dt><dd>{formatMacroReproductionRatio(metrics.magnification)}</dd></div>
        )}
        <div><dt>{t(keys.factor)}</dt><dd>{metrics.bellowsFactor.toFixed(2)}×</dd></div>
        <div><dt>{t(keys.exposure)}</dt><dd>{t(keys.stops, { value: metrics.exposureCompensationStops.toFixed(2) })}</dd></div>
        {bellowsTeachingCapability && (
          <div><dt>{t(keys.availableTravel)}</dt><dd>{bellowsTeachingCapability.availableBellowsTravelMm.toFixed(1)} mm</dd></div>
        )}
      </dl>
      {capacityWarning && <p className="macro-focus-readout__warning">{t(keys.travelWarning)}</p>}
      {lifeSize && <p data-testid="macro-life-size-message" role="status" aria-live="polite">{t(keys.lifeSize)}</p>}
      <small className="control-help">{t(keys.note)}</small>
    </section>
  );
};
