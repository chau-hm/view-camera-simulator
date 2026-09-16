import { useTranslation } from "react-i18next";
import { simulatorMessageKeys } from "../../i18n/simulatorMessageKeys";
import type {
  MacroBellowsExtensionTeachingModel,
  MacroBellowsExtensionTeachingStage,
} from "../../scenes/macroBellowsExtensionTeaching";
import { formatMacroReproductionRatio } from "../../scenes/macroBellowsExtensionTeaching";

type MacroBellowsExtensionTeachingContentProps = {
  model: MacroBellowsExtensionTeachingModel;
  variant: "task" | "feedback";
};

const stageKeyById: Record<
  MacroBellowsExtensionTeachingStage,
  keyof typeof simulatorMessageKeys.freePractice.macroBellowsExtension.stages
> = {
  early: "early",
  intermediate: "intermediate",
  "near-life-size": "nearLifeSize",
  "life-size": "lifeSize",
};

const formatTeachingValues = (model: MacroBellowsExtensionTeachingModel) => ({
  magnification: `${model.metrics.magnification.toFixed(2)}×`,
  ratio: formatMacroReproductionRatio(model.metrics.magnification),
  extension: `${model.metrics.bellowsExtensionMm.toFixed(1)} mm`,
  factor: `${model.metrics.bellowsFactor.toFixed(2)}×`,
  stops: `+${model.metrics.exposureCompensationStops.toFixed(2)} stops`,
  availableTravel: `${model.availableBellowsTravelMm.toFixed(1)} mm`,
});

export const MacroBellowsExtensionTeachingContent = ({
  model,
  variant,
}: MacroBellowsExtensionTeachingContentProps) => {
  const { t } = useTranslation();
  const messages = simulatorMessageKeys.freePractice.macroBellowsExtension;
  const stage = messages.stages[stageKeyById[model.stage]];
  const values = formatTeachingValues(model);

  if (variant === "feedback") {
    return (
      <section
        className="macro-bellows-teaching macro-bellows-teaching--feedback"
        data-testid="macro-bellows-feedback"
        role="status"
        aria-live="polite"
      >
        <h3>{t(stage.title)}</h3>
        <p>{t(stage.observe, values)}</p>
        <p className="macro-bellows-teaching__muted">{t(stage.whyItMatters, values)}</p>
        {model.capacityWarning ? (
          <p className="macro-bellows-teaching__warning">
            {t(messages.capacityWarning, values)}
          </p>
        ) : null}
      </section>
    );
  }

  return (
    <section
      className="macro-bellows-teaching"
      data-testid="macro-bellows-teaching"
      aria-label={t(messages.title)}
    >
      <h3>{t(messages.title)}</h3>
      <div className="macro-bellows-teaching__sections">
        <div>
          <strong>{t(messages.labels.goal)}</strong>
          <p>{t(messages.goal)}</p>
        </div>
        <div>
          <strong>{t(messages.labels.try)}</strong>
          <p>{t(stage.try, values)}</p>
        </div>
        <div>
          <strong>{t(messages.labels.observe)}</strong>
          <p>{t(stage.observe, values)}</p>
        </div>
        <div>
          <strong>{t(messages.labels.whyItMatters)}</strong>
          <p>{t(stage.whyItMatters, values)}</p>
        </div>
      </div>
      {model.capacityWarning ? (
        <p className="macro-bellows-teaching__warning">
          {t(messages.capacityWarning, values)}
        </p>
      ) : null}
    </section>
  );
};

export type { MacroBellowsExtensionTeachingContentProps };
