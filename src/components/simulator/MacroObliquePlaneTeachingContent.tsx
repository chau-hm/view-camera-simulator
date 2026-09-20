import { useTranslation } from "react-i18next";
import { readoutMessageKeys } from "../../i18n/readoutMessageKeys";
import { simulatorMessageKeys } from "../../i18n/simulatorMessageKeys";
import type {
  MacroObliquePlaneTeachingModel,
  MacroObliquePlaneTeachingStage,
} from "../../scenes/macroObliquePlaneTeaching";

type MacroObliquePlaneTeachingContentProps = {
  model: MacroObliquePlaneTeachingModel;
  variant: "task" | "feedback";
};

const stageKeyById: Record<
  MacroObliquePlaneTeachingStage,
  keyof typeof simulatorMessageKeys.freePractice.macroObliquePlane.stages
> = {
  "parallel-exploration": "parallelExploration",
  "tilt-and-focus": "tiltAndFocus",
  "refine-alignment": "refineAlignment",
  aligned: "aligned",
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

const formatTilt = (frontTiltDeg: number): string =>
  `${frontTiltDeg > 0 ? "+" : ""}${frontTiltDeg.toFixed(1)}°`;

export const MacroObliquePlaneTeachingContent = ({
  model,
  variant,
}: MacroObliquePlaneTeachingContentProps) => {
  const { t } = useTranslation();
  const messages = simulatorMessageKeys.freePractice.macroObliquePlane;
  const stage = messages.stages[stageKeyById[model.stage]];
  const values = {
    strongestRegion: t(messages.regions[model.strongestRegion]),
    weakestRegion: t(messages.regions[model.weakestRegion]),
    weakestStatus: t(statusMessageKey(model.statuses[model.weakestRegion])),
    nearStatus: t(statusMessageKey(model.statuses.near)),
    middleStatus: t(statusMessageKey(model.statuses.middle)),
    farStatus: t(statusMessageKey(model.statuses.far)),
    tilt: formatTilt(model.frontTiltDeg),
    focus: `${model.focusObjectDistanceMm.toFixed(0)} mm`,
  };

  const dataAttributes = {
    "data-stage": model.stage,
    "data-sharp-count": String(model.sharpCount),
    "data-strongest-region": model.strongestRegion,
    "data-weakest-region": model.weakestRegion,
    "data-all-sharp": String(model.allSharp),
  };

  if (variant === "feedback") {
    return (
      <section
        className="macro-oblique-teaching macro-oblique-teaching--feedback"
        data-testid="macro-oblique-feedback"
        role="status"
        aria-live="polite"
        {...dataAttributes}
      >
        <h3>{t(stage.title)}</h3>
        <p>{t(stage.observe, values)}</p>
        <p className="macro-oblique-teaching__muted">{t(stage.whyItMatters, values)}</p>
      </section>
    );
  }

  return (
    <section
      className="macro-oblique-teaching"
      data-testid="macro-oblique-teaching"
      aria-label={t(messages.title)}
      {...dataAttributes}
    >
      <h3>{t(messages.title)}</h3>
      <div className="macro-oblique-teaching__sections">
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
    </section>
  );
};

export type { MacroObliquePlaneTeachingContentProps };
