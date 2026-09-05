import { useTranslation } from "react-i18next";
import type { GuidedTaskMessageRef, TaskEvaluation, TaskDefinition } from "../../types/task";
import "../../i18n";
import {
  simulatorMessageKeys,
  type SimulatorMessageKey,
} from "../../i18n/simulatorMessageKeys";
import { guidedTaskMessageKeys } from "../../i18n/guidedTaskMessageKeys";
import type { InteriorCornerRiseCompositionEvaluation } from "../../scenes/interiorCornerRiseComposition";
import type {
  InteriorCornerFocusAlignmentStatus,
  InteriorCornerSwingFocusEvaluation,
} from "../../scenes/interiorCornerSwingFocus";
import {
  getFeedbackStatus,
  getPassedCriteriaCount,
  getPrimaryFailedCriterion,
  formatFinalCameraState,
  getFreePracticeFeedbackKey,
} from "./taskHelpers";

type FeedbackPanelProps = {
  mode: string;
  sceneId: string;
  task: TaskDefinition | null;
  evaluation: TaskEvaluation | null;
  freeCompositionEvaluation?: InteriorCornerRiseCompositionEvaluation | null;
  freeFocusEvaluation?: InteriorCornerSwingFocusEvaluation | null;
  showTitle?: boolean;
};

const interiorCornerFocusStatusKeys: Record<InteriorCornerFocusAlignmentStatus, SimulatorMessageKey> = {
  "open-aperture-required": simulatorMessageKeys.freePractice.interiorCorner.focusAlignment.openApertureRequiredStatus,
  misaligned: simulatorMessageKeys.freePractice.interiorCorner.focusAlignment.misalignedStatus,
  "refine-focus": simulatorMessageKeys.freePractice.interiorCorner.focusAlignment.refineFocusStatus,
  aligned: simulatorMessageKeys.freePractice.interiorCorner.focusAlignment.alignedStatus,
};

const interiorCornerFocusMessageKeys: Record<InteriorCornerFocusAlignmentStatus, SimulatorMessageKey> = {
  "open-aperture-required": simulatorMessageKeys.freePractice.interiorCorner.focusAlignment.openApertureRequired,
  misaligned: simulatorMessageKeys.freePractice.interiorCorner.focusAlignment.misaligned,
  "refine-focus": simulatorMessageKeys.freePractice.interiorCorner.focusAlignment.refineFocus,
  aligned: simulatorMessageKeys.freePractice.interiorCorner.focusAlignment.aligned,
};

export const FeedbackPanel = ({
  mode,
  sceneId,
  evaluation,
  freeCompositionEvaluation,
  freeFocusEvaluation,
  showTitle = true,
}: FeedbackPanelProps) => {
  const { t } = useTranslation();
  const translateMessage = (message: GuidedTaskMessageRef): string =>
    String(message.values ? t(message.key, message.values as never) : t(message.key));
  const status = getFeedbackStatus(mode, evaluation);
  const { passed, total } = getPassedCriteriaCount(evaluation);
  const primaryFailed = getPrimaryFailedCriterion(evaluation);

  if (!evaluation && mode !== 'guided') {
    // Free mode neutral observation: use scene-specific observation and a single live badge
    const freeObs = getFreePracticeFeedbackKey(sceneId);
    const genericObservationKey = simulatorMessageKeys.freePractice.generic.observation;
    const riseCompositionKey =
      sceneId === "interior-corner" && freeCompositionEvaluation
        ? freeCompositionEvaluation.passed
          ? simulatorMessageKeys.freePractice.interiorCorner.riseComposition.ready
          : simulatorMessageKeys.freePractice.interiorCorner.riseComposition.needsAdjustment
        : null;
    const riseCompositionStatusKey =
      sceneId === "interior-corner" && freeCompositionEvaluation
        ? freeCompositionEvaluation.passed
          ? simulatorMessageKeys.freePractice.interiorCorner.riseComposition.readyStatus
          : simulatorMessageKeys.freePractice.interiorCorner.riseComposition.needsAdjustmentStatus
          : null;
    const focusAlignmentStatusKey =
      sceneId === "interior-corner" && freeFocusEvaluation
        ? interiorCornerFocusStatusKeys[freeFocusEvaluation.status]
        : null;
    const focusAlignmentMessageKey =
      sceneId === "interior-corner" && freeFocusEvaluation
        ? interiorCornerFocusMessageKeys[freeFocusEvaluation.status]
        : null;
    return (
      <section aria-label={t(simulatorMessageKeys.feedback.title)} className="feedback-panel feedback-panel--idle">
        {showTitle ? <h2>{t(simulatorMessageKeys.feedback.title)}</h2> : null}
        <div className="feedback-summary">
          <div className="feedback-summary__header">
            <span className="feedback-status">{t(simulatorMessageKeys.feedback.liveObservation)}</span>
            {riseCompositionStatusKey ? (
              <span style={{ marginLeft: 8 }}>{t(riseCompositionStatusKey)}</span>
            ) : null}
            {focusAlignmentStatusKey ? (
              <span style={{ marginLeft: 8 }}>{t(focusAlignmentStatusKey)}</span>
            ) : null}
          </div>
          <p style={{ marginTop: 8 }}>{t(genericObservationKey)}</p>
          {freeObs.observationKey !== genericObservationKey ? (
            <p style={{ marginTop: 6, color: 'var(--text-muted)' }}>{t(freeObs.observationKey)}</p>
          ) : null}
          {riseCompositionKey ? (
            <p
              data-testid="interior-corner-rise-composition-feedback"
              role="status"
              aria-live="polite"
              style={{ marginTop: 8 }}
            >
              {t(riseCompositionKey)}
            </p>
          ) : null}
          {focusAlignmentMessageKey ? (
            <p
              data-testid="interior-corner-focus-feedback"
              role="status"
              aria-live="polite"
              style={{ marginTop: 8 }}
            >
              {t(focusAlignmentMessageKey)}
            </p>
          ) : null}
        </div>
      </section>
    );
  }

  if (!evaluation && mode === 'guided') {
    return (
      <section aria-label={t(simulatorMessageKeys.feedback.title)} className="feedback-panel feedback-panel--idle">
        {showTitle ? <h2>{t(simulatorMessageKeys.feedback.title)}</h2> : null}
        <div>
          <div className="feedback-status">{t(guidedTaskMessageKeys.common.notStarted)}</div>
          <p style={{ marginTop: 8 }}>{t(guidedTaskMessageKeys.common.waitingForEvaluation)}</p>
        </div>
      </section>
    );
  }

  // With an evaluation
  const progressLabel = t(guidedTaskMessageKeys.common.progress, { passed, total });
  const primaryText = evaluation
    ? translateMessage(evaluation.primaryFeedback)
    : "";
  const finalCameraStateLines = formatFinalCameraState(evaluation?.finalCameraState);

  return (
    <section aria-label={t(simulatorMessageKeys.feedback.title)} className={`feedback-panel ${evaluation && evaluation.status === 'passed' ? 'feedback-panel--complete' : 'feedback-panel--progress'}`}>
      {showTitle ? <h2>{t(simulatorMessageKeys.feedback.title)}</h2> : null}

      <div className="feedback-summary">
        <div className="feedback-summary__header">
          <span className="feedback-status">{t(status)}</span>
          <span style={{ marginLeft: 8 }}>{t(guidedTaskMessageKeys.common.score)}: {evaluation?.score}</span>
        </div>

        <h3 style={{ marginTop: 8 }}>{primaryText}</h3>

        {evaluation && evaluation.secondaryFeedback.length > 0 ? (
          <div aria-label={t(guidedTaskMessageKeys.common.secondaryFeedback)} style={{ marginTop: 8 }}>
            {evaluation.secondaryFeedback.map((feedback, index) => (
              <p key={`${feedback.key}-${index}`} style={{ margin: "4px 0", color: "var(--text-muted)" }}>
                {translateMessage(feedback)}
              </p>
            ))}
          </div>
        ) : null}

        <div style={{ marginTop: 8 }}>
          <div><strong>{t(guidedTaskMessageKeys.common.nextAdjustment)}</strong></div>
          <div style={{ marginTop: 6, fontWeight: 600 }}>
            {primaryFailed
              ? translateMessage(primaryFailed.message)
              : t(guidedTaskMessageKeys.common.noAdjustmentNeeded)}
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <div><strong>{t(guidedTaskMessageKeys.common.requirementsMet)}</strong></div>
          <div role="progressbar" aria-label={t(guidedTaskMessageKeys.common.requirementsCompletedAria)} aria-valuemin={0} aria-valuemax={total} aria-valuenow={passed} style={{ height: 10, background: 'rgba(0,0,0,0.06)', borderRadius: 6, overflow: 'hidden', marginTop: 6 }}>
            <div style={{ height: '100%', width: `${total === 0 ? 0 : (passed/total)*100}%`, background: 'var(--primary)' }} />
          </div>
          <div style={{ marginTop: 6 }}>{progressLabel}</div>
        </div>

        <details style={{ marginTop: 12 }}>
          <summary>{t(guidedTaskMessageKeys.common.viewRequirements)}</summary>
          <div style={{ marginTop: 8 }}>
            <div className="feedback-criteria">
              {evaluation?.criteria.map((c) => (
                <div key={c.criterionId} className={`feedback-criterion ${c.passed ? 'feedback-criterion--passed' : 'feedback-criterion--failed'}`} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 8, borderRadius: 6 }}>
                  <span aria-hidden>{c.passed ? '✔' : '⚠'}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>{translateMessage(c.label)}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{translateMessage(c.message)}</div>
                  </div>
                  <div style={{ fontWeight: 700 }}>
                    {t(c.passed ? guidedTaskMessageKeys.common.passed : guidedTaskMessageKeys.common.needsAdjustment)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </details>

        {evaluation?.status === 'passed' && (
          <div style={{ marginTop: 12 }}>
            <h3>{t(guidedTaskMessageKeys.common.taskCompleted)}</h3>
            <div style={{ marginTop: 6 }}>
              <div><strong>{t(guidedTaskMessageKeys.common.finalSettings)}</strong></div>
              <div>
                {finalCameraStateLines.map((line, index) => (
                  <span key={line.labelKey}>
                    {index > 0 ? " · " : null}
                    {t(line.labelKey)}: {line.value}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
