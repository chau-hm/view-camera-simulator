import { useTranslation } from "react-i18next";
import { deriveMacroFocusMetrics } from "../../core/optics/deriveMacroFocusMetrics";
import type { DerivedOpticsState } from "../../types/optics";
import { CAMERA_CONTROL_STEPS } from "../../utils/constants";
import { readoutMessageKeys } from "../../i18n/readoutMessageKeys";

export const MacroFocusReadout = ({ diagnostics, focalLengthMm }: {
  diagnostics: DerivedOpticsState["diagnostics"];
  focalLengthMm: number;
}) => {
  const { t } = useTranslation();
  const keys = readoutMessageKeys.macroFocus;
  const { focusObjectDistanceMm, imageDistanceMm } = diagnostics;
  if (diagnostics.fallbackApplied || focusObjectDistanceMm == null || imageDistanceMm == null) return null;
  const metrics = deriveMacroFocusMetrics({
    focalLengthMm, objectDistanceMm: focusObjectDistanceMm, imageDistanceMm,
  });
  if (!metrics) return null;
  // One public focus step expressed as a magnification tolerance keeps the
  // indication reachable without treating floating-point equality as a task.
  const lifeSizeTolerance = CAMERA_CONTROL_STEPS.focusDistanceMm / Math.max(1, Math.abs(focusObjectDistanceMm));
  const lifeSize = Math.abs(metrics.magnification - 1) <= lifeSizeTolerance;
  return (
    <section className="simulator-info-card macro-focus-readout" aria-label={t(keys.title)}>
      <h3>{t(keys.title)}</h3>
      <dl>
        <div><dt>{t(keys.extension)}</dt><dd>{metrics.bellowsExtensionMm.toFixed(1)} mm</dd></div>
        <div><dt>{t(keys.magnification)}</dt><dd>{metrics.magnification.toFixed(2)}×</dd></div>
        <div><dt>{t(keys.factor)}</dt><dd>{metrics.bellowsFactor.toFixed(2)}×</dd></div>
        <div><dt>{t(keys.exposure)}</dt><dd>{t(keys.stops, { value: metrics.exposureCompensationStops.toFixed(2) })}</dd></div>
      </dl>
      {lifeSize && <p>{t(keys.lifeSize)}</p>}
      <small className="control-help">{t(keys.note)}</small>
    </section>
  );
};
