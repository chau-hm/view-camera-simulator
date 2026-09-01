import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { ReactNode } from "react";
import {
  getLessonZeroStep,
  LESSON_ZERO_STEPS,
  type LessonZeroStep,
} from "../../app/anatomyLesson";
import { lessonZeroMessageKeys } from "../../i18n/lessonZeroMessageKeys";

type AnatomyLessonPanelProps = {
  stepIndex: number;
  onStepIndexChange: (index: number) => void;
  showSmallAperture: boolean;
  onShowSmallApertureChange: (showSmallAperture: boolean) => void;
  onReset: () => void;
  canAdvance?: boolean;
  controlContent?: ReactNode;
};

export const AnatomyLessonPanel = ({
  stepIndex,
  onStepIndexChange,
  showSmallAperture,
  onShowSmallApertureChange,
  onReset,
  canAdvance = true,
  controlContent,
}: AnatomyLessonPanelProps) => {
  const { t } = useTranslation();
  const step: LessonZeroStep = getLessonZeroStep(stepIndex);
  const isFirstStep = stepIndex <= 0;
  const isLastStep = stepIndex >= LESSON_ZERO_STEPS.length - 1;

  return (
    <section className="anatomy-lesson-panel" aria-labelledby="anatomy-lesson-title">
      <div className="anatomy-lesson-panel__header">
        <p className="anatomy-lesson-panel__label">
          {t(lessonZeroMessageKeys.common.lessonLabel)}
        </p>
        <p
          className="anatomy-lesson-panel__progress"
          aria-label={t(lessonZeroMessageKeys.common.progressAria)}
        >
          {t(lessonZeroMessageKeys.common.stepOf, {
            current: stepIndex + 1,
            total: LESSON_ZERO_STEPS.length,
          })}
        </p>
      </div>

      <div className="anatomy-lesson-panel__content" aria-live="polite">
        <h3 id="anatomy-lesson-title">{t(step.titleKey)}</h3>
        <p>{t(step.bodyKey)}</p>
        <p className="anatomy-lesson-panel__cue">{t(step.cueKey)}</p>

        {controlContent}

        {step.id === "aperture" ? (
          <button
            type="button"
            className="btn btn--secondary anatomy-lesson-panel__aperture-toggle"
            aria-pressed={showSmallAperture}
            onClick={() => onShowSmallApertureChange(!showSmallAperture)}
          >
            {t(
              showSmallAperture
                ? lessonZeroMessageKeys.common.showWideAperture
                : lessonZeroMessageKeys.common.showSmallAperture,
            )}
          </button>
        ) : null}
      </div>

      <div className="anatomy-lesson-panel__actions">
        <button
          type="button"
          className="btn btn--secondary"
          disabled={isFirstStep}
          onClick={() => onStepIndexChange(Math.max(0, stepIndex - 1))}
        >
          {t(lessonZeroMessageKeys.common.previous)}
        </button>
        {!isLastStep ? (
          <button
            type="button"
            className={`btn btn--primary${canAdvance ? "" : " btn--disabled"}`}
            disabled={!canAdvance}
            onClick={() => onStepIndexChange(Math.min(LESSON_ZERO_STEPS.length - 1, stepIndex + 1))}
          >
            {t(lessonZeroMessageKeys.common.next)}
          </button>
        ) : null}
      </div>

      {isLastStep ? (
        <p className="anatomy-lesson-panel__complete" role="status">
          {t(lessonZeroMessageKeys.common.lessonComplete)}
        </p>
      ) : null}

      <div className="anatomy-lesson-panel__footer">
        <button type="button" className="btn btn--ghost" onClick={onReset}>
          {t(lessonZeroMessageKeys.common.reset)}
        </button>
        <Link className="btn btn--ghost" to="/scenes">
          {t(lessonZeroMessageKeys.common.backToScenes)}
        </Link>
      </div>
    </section>
  );
};

export default AnatomyLessonPanel;
