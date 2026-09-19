import { useTranslation } from "react-i18next";
import { readoutMessageKeys } from "../../i18n/readoutMessageKeys";
import { simulatorMessageKeys } from "../../i18n/simulatorMessageKeys";
import type {
  MacroDepthOfFieldTeachingModel,
  MacroDepthOfFieldTeachingStage,
} from "../../scenes/macroDepthOfFieldTeaching";

type MacroDepthOfFieldTeachingContentProps = {
  model: MacroDepthOfFieldTeachingModel;
  variant: "task" | "feedback";
};

const stageKeyById: Record<
  MacroDepthOfFieldTeachingStage,
  keyof typeof simulatorMessageKeys.freePractice.macroDepthOfField.stages
> = {
  "wide-open": "wideOpen",
  "begin-stopping-down": "beginStoppingDown",
  "moderate-stopping-down": "moderateStoppingDown",
  "minimum-aperture": "minimumAperture",
};

const statusMessageKey = (status: "sharp" | "acceptable" | "soft") => {
  switch (status) {
    case "sharp":
      return readoutMessageKeys.focusTargets.sharp;
    case "acceptable":
      return readoutMessageKeys.focusTargets.acceptable;
    default:
      return readoutMessageKeys.focusTargets.soft;
  }
};

export const MacroDepthOfFieldTeachingContent = ({
  model,
  variant,
}: MacroDepthOfFieldTeachingContentProps) => {
  const { t } = useTranslation();
  const messages = simulatorMessageKeys.freePractice.macroDepthOfField;
  const stage = messages.stages[stageKeyById[model.stage]];
  const observeKey = model.stage === "minimum-aperture" && model.softRegions.length === 0
    ? messages.stages.minimumAperture.observeAllSharp
    : stage.observe;
  const values = {
    aperture: `f/${model.aperture}`,
    focusedRegion: t(messages.regions[model.focusedRegion]),
    nearStatus: t(statusMessageKey(model.statuses.near)),
    middleStatus: t(statusMessageKey(model.statuses.middle)),
    farStatus: t(statusMessageKey(model.statuses.far)),
    softRegions: model.softRegions.length > 0
      ? model.softRegions.map((region) => t(messages.regions[region])).join(t(messages.listSeparator))
      : "—",
  };

  if (variant === "feedback") {
    return (
      <section
        className="macro-depth-teaching macro-depth-teaching--feedback"
        data-stage={model.stage}
        data-focused-region={model.focusedRegion}
        data-testid="macro-depth-feedback"
        role="status"
        aria-live="polite"
      >
        <h3>{t(stage.title)}</h3>
        <p>{t(observeKey, values)}</p>
        <p className="macro-depth-teaching__muted">{t(stage.whyItMatters, values)}</p>
      </section>
    );
  }

  return (
    <section
      className="macro-depth-teaching"
      data-stage={model.stage}
      data-focused-region={model.focusedRegion}
      data-testid="macro-depth-teaching"
      aria-label={t(messages.title)}
    >
      <h3>{t(messages.title)}</h3>
      <div className="macro-depth-teaching__sections">
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
          <p>{t(observeKey, values)}</p>
        </div>
        <div>
          <strong>{t(messages.labels.whyItMatters)}</strong>
          <p>{t(stage.whyItMatters, values)}</p>
        </div>
      </div>
    </section>
  );
};

export type { MacroDepthOfFieldTeachingContentProps };

