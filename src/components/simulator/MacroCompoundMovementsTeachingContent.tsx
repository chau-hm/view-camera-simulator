import { useTranslation } from "react-i18next";
import { readoutMessageKeys } from "../../i18n/readoutMessageKeys";
import { simulatorMessageKeys } from "../../i18n/simulatorMessageKeys";
import type {
  MacroCompoundMovementsTeachingModel,
  MacroCompoundMovementsTeachingStage,
} from "../../scenes/macroCompoundMovementsTeaching";
import type { FocusTargetStatus } from "../../types/optics";

type MacroCompoundMovementsTeachingContentProps = {
  model: MacroCompoundMovementsTeachingModel;
  variant: "task" | "feedback";
};

const stageKeyById: Record<
  MacroCompoundMovementsTeachingStage,
  keyof typeof simulatorMessageKeys.freePractice.macroCompoundMovements.stages
> = {
  "focus-exploration": "focusExploration",
  "tilt-only": "tiltOnly",
  "swing-only": "swingOnly",
  "compound-alignment": "compoundAlignment",
  "refine-compound": "refineCompound",
  aligned: "aligned",
};

const regionMessageKeyById = {
  "near-left": "nearLeft",
  centre: "centre",
  "far-right": "farRight",
} as const;

const statusMessageKey = (status: FocusTargetStatus) => {
  switch (status) {
    case "sharp":
      return readoutMessageKeys.focusTargets.sharp;
    case "acceptable":
      return readoutMessageKeys.focusTargets.acceptable;
    default:
      return readoutMessageKeys.focusTargets.soft;
  }
};

const formatSignedDegrees = (degrees: number): string =>
  `${degrees > 0 ? "+" : ""}${degrees.toFixed(1)}°`;

export const MacroCompoundMovementsTeachingContent = ({
  model,
  variant,
}: MacroCompoundMovementsTeachingContentProps) => {
  const { t } = useTranslation();
  const messages = simulatorMessageKeys.freePractice.macroCompoundMovements;
  const stage = messages.stages[stageKeyById[model.stage]];
  const values = {
    strongestRegion: t(messages.regions[regionMessageKeyById[model.strongestRegion]]),
    weakestRegion: t(messages.regions[regionMessageKeyById[model.weakestRegion]]),
    weakestStatus: t(statusMessageKey(model.statuses[model.weakestRegion])),
    nearLeftStatus: t(statusMessageKey(model.statuses["near-left"])),
    centreStatus: t(statusMessageKey(model.statuses.centre)),
    farRightStatus: t(statusMessageKey(model.statuses["far-right"])),
    sharpCount: model.sharpCount,
    tilt: formatSignedDegrees(model.frontTiltDeg),
    swing: formatSignedDegrees(model.frontSwingDeg),
    focus: `${model.focusObjectDistanceMm.toFixed(0)} mm`,
  };

  const dataAttributes = {
    "data-stage": model.stage,
    "data-sharp-count": String(model.sharpCount),
    "data-strongest-region": model.strongestRegion,
    "data-weakest-region": model.weakestRegion,
    "data-tilt-neutral": String(model.tiltNeutral),
    "data-swing-neutral": String(model.swingNeutral),
    "data-all-sharp": String(model.allSharp),
  };

  if (variant === "feedback") {
    return (
      <section
        className="macro-compound-teaching macro-compound-teaching--feedback"
        data-testid="macro-compound-feedback"
        role="status"
        aria-live="polite"
        {...dataAttributes}
      >
        <h3>{t(stage.title)}</h3>
        <p>{t(stage.observe, values)}</p>
        <p className="macro-compound-teaching__muted">{t(stage.whyItMatters, values)}</p>
      </section>
    );
  }

  return (
    <section
      className="macro-compound-teaching"
      data-testid="macro-compound-teaching"
      aria-label={t(messages.title)}
      {...dataAttributes}
    >
      <h3>{t(messages.title)}</h3>
      <div className="macro-compound-teaching__sections">
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

export type { MacroCompoundMovementsTeachingContentProps };
