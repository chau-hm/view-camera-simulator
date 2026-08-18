import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { GuidedLessonContext, GuidedLessonStageId } from "../../app/guidedLesson";
import {
  guidedLessonMessageKeys,
  type GuidedLessonMessageKey,
} from "../../i18n/guidedLessonMessageKeys";
import type { TaskEvaluation } from "../../types/task";

type GuidedLessonProgressProps = {
  context: GuidedLessonContext;
  evaluation: TaskEvaluation | null;
};

const stageMessageKey = (stage: GuidedLessonStageId): GuidedLessonMessageKey => {
  switch (stage) {
    case "observe":
      return guidedLessonMessageKeys.stages.observe;
    case "compose":
      return guidedLessonMessageKeys.stages.compose;
    case "align-focus":
      return guidedLessonMessageKeys.stages.alignFocus;
    case "final-challenge":
      return guidedLessonMessageKeys.stages.finalChallenge;
  }
};

export const GuidedLessonProgress = ({
  context,
  evaluation,
}: GuidedLessonProgressProps) => {
  const { t } = useTranslation();
  const isObserve = context.stage === "observe";
  const isComplete = evaluation?.status === "passed";
  const canContinue = isObserve || isComplete;

  return (
    <section
      className="guided-lesson-progress"
      aria-label={t(guidedLessonMessageKeys.common.progressAria)}
      data-guided-lesson-id={context.lessonId}
      data-guided-lesson-stage={context.stage}
    >
      <div className="guided-lesson-progress__header">
        <strong>{t(guidedLessonMessageKeys.common.lessonName)}</strong>
        <span>{t(guidedLessonMessageKeys.common.stepOf, {
          current: context.stageIndex + 1,
          total: context.stages.length,
        })}</span>
      </div>

      <ol className="guided-lesson-progress__stages">
        {context.stages.map((stage, index) => (
          <li
            key={stage.id}
            aria-current={index === context.stageIndex ? "step" : undefined}
            data-stage-status={
              index < context.stageIndex
                ? "previous"
                : index === context.stageIndex
                  ? "current"
                  : "upcoming"
            }
          >
            <span className="guided-lesson-progress__stage-index">{index + 1}</span>
            <span>{t(stageMessageKey(stage.id))}</span>
          </li>
        ))}
      </ol>

      {isObserve ? (
        <div className="guided-lesson-progress__observe">
          <h3>{t(guidedLessonMessageKeys.observe.title)}</h3>
          <p>{t(guidedLessonMessageKeys.observe.body)}</p>
        </div>
      ) : null}

      {!isObserve && context.nextHref === null && isComplete ? (
        <p className="guided-lesson-progress__completion-body">
          {t(guidedLessonMessageKeys.common.completionBody)}
        </p>
      ) : null}

      <nav className="guided-lesson-progress__actions" aria-label={t(guidedLessonMessageKeys.common.title)}>
        {context.previousHref ? (
          <Link className="btn btn--secondary" to={context.previousHref}>
            {t(guidedLessonMessageKeys.common.previous)}
          </Link>
        ) : null}

        {context.nextHref ? (
          canContinue ? (
            <Link className="btn btn--primary" to={context.nextHref}>
              {t(guidedLessonMessageKeys.common.continue)}
            </Link>
          ) : (
            <button className="btn btn--primary" type="button" disabled>
              {t(guidedLessonMessageKeys.common.continue)}
            </button>
          )
        ) : (
          <>
            <span
              className={`guided-lesson-progress__completion${isComplete ? " guided-lesson-progress__completion--complete" : ""}`}
              role={isComplete ? "status" : undefined}
            >
              {isComplete
                ? t(guidedLessonMessageKeys.common.lessonComplete)
                : t(guidedLessonMessageKeys.common.finalChallengePending)}
            </span>
            <Link className="btn btn--secondary" to="/scenes">
              {t(guidedLessonMessageKeys.common.backToScenes)}
            </Link>
          </>
        )}
      </nav>
    </section>
  );
};
