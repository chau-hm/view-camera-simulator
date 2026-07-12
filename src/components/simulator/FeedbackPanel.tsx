import type { TaskEvaluation, TaskDefinition } from "../../types/task";
import { UI_COPY } from "../../ui/copy";
import { getFeedbackStatus, getPassedCriteriaCount, getPrimaryFailedCriterion, formatFinalCameraState, getFreePracticeFeedback } from './taskHelpers';

type FeedbackPanelProps = {
  mode: string;
  sceneId: string;
  task: TaskDefinition | null;
  evaluation: TaskEvaluation | null;
  showTitle?: boolean;
};

export const FeedbackPanel = ({ mode, sceneId, evaluation, showTitle = true }: FeedbackPanelProps) => {
  const status = getFeedbackStatus(mode, evaluation);
  const { passed, total } = getPassedCriteriaCount(evaluation);
  const primaryFailed = getPrimaryFailedCriterion(evaluation);

  if (!evaluation && mode !== 'guided') {
    // Free mode neutral observation: use scene-specific observation and a single live badge
    const freeObs = getFreePracticeFeedback(sceneId);
    return (
      <section aria-label={UI_COPY.simulator.feedbackTitle} className="feedback-panel feedback-panel--idle">
        {showTitle ? <h2>{UI_COPY.simulator.feedbackTitle}</h2> : null}
        <div className="feedback-summary">
          <div className="feedback-summary__header">
            <span className="feedback-status">{UI_COPY.simulator.liveObservation}</span>
          </div>
          <p style={{ marginTop: 8 }}>{UI_COPY.simulator.changesReflected}</p>
          <p style={{ marginTop: 6, color: 'var(--text-muted)' }}>{freeObs.observation}</p>
        </div>
      </section>
    );
  }

  if (!evaluation && mode === 'guided') {
    return (
      <section aria-label={UI_COPY.simulator.feedbackTitle} className="feedback-panel feedback-panel--idle">
        {showTitle ? <h2>{UI_COPY.simulator.feedbackTitle}</h2> : null}
        <div>
          <div className="feedback-status">{UI_COPY.simulator.notStarted}</div>
          <p style={{ marginTop: 8 }}>{UI_COPY.simulator.freePracticeIntro}</p>
        </div>
      </section>
    );
  }

  // With an evaluation
  const progressLabel = `${passed} of ${total} requirements met`;
  const primaryText = evaluation?.primaryFeedback ?? '';

  return (
    <section aria-label={UI_COPY.simulator.feedbackTitle} className={`simulator-info-card simulator-info-card--feedback feedback-panel ${evaluation && evaluation.status === 'passed' ? 'feedback-panel--complete' : 'feedback-panel--progress'}`}>
      {showTitle ? <h2>{UI_COPY.simulator.feedbackTitle}</h2> : null}

      <div className="feedback-summary">
        <div className="feedback-summary__header">
          <span className="feedback-status">{status}</span>
          <span style={{ marginLeft: 8 }}>{UI_COPY.simulator.scoreLabel}: {evaluation?.score}</span>
        </div>

        <h3 style={{ marginTop: 8 }}>{primaryText}</h3>

        <div style={{ marginTop: 8 }}>
          <div><strong>{UI_COPY.simulator.nextAdjustmentLabel}</strong></div>
          <div style={{ marginTop: 6, fontWeight: 600 }}>{primaryFailed ? primaryFailed.message : UI_COPY.simulator.noAdjustmentNeeded}</div>
        </div>

        <div style={{ marginTop: 12 }}>
          <div><strong>{UI_COPY.simulator.requirementsMetLabel}</strong></div>
          <div role="progressbar" aria-label="Task requirements completed" aria-valuemin={0} aria-valuemax={total} aria-valuenow={passed} style={{ height: 10, background: 'rgba(0,0,0,0.06)', borderRadius: 6, overflow: 'hidden', marginTop: 6 }}>
            <div style={{ height: '100%', width: `${total === 0 ? 0 : (passed/total)*100}%`, background: 'var(--primary)' }} />
          </div>
          <div style={{ marginTop: 6 }}>{progressLabel}</div>
        </div>

        <details style={{ marginTop: 12 }}>
          <summary>{UI_COPY.simulator.viewRequirementsLabel}</summary>
          <div style={{ marginTop: 8 }}>
            <div className="feedback-criteria">
              {evaluation?.criteria.map((c) => (
                <div key={c.criterionId} className={`feedback-criterion ${c.passed ? 'feedback-criterion--passed' : 'feedback-criterion--failed'}`} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 8, borderRadius: 6 }}>
                  <span aria-hidden>{c.passed ? '✔' : '⚠'}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>{c.label}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{c.message}</div>
                  </div>
                  <div style={{ fontWeight: 700 }}>{c.passed ? 'Passed' : 'Needs adjustment'}</div>
                </div>
              ))}
            </div>
          </div>
        </details>

        {evaluation?.status === 'passed' && (
          <div style={{ marginTop: 12 }}>
            <h3>{UI_COPY.simulator.taskCompletedTitle}</h3>
            <div style={{ marginTop: 6 }}>{formatFinalCameraState(evaluation.finalCameraState)}</div>
          </div>
        )}
      </div>
    </section>
  );
};
