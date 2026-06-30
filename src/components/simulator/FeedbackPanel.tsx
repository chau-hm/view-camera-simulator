import type { TaskEvaluation } from "../../types/task";
import { UI_COPY } from "../../ui/copy";

type FeedbackPanelProps = {
  evaluation: TaskEvaluation | null;
};

export const FeedbackPanel = ({ evaluation }: FeedbackPanelProps) => (
  <section aria-label={UI_COPY.simulator.feedbackTitle}>
    <h2>{UI_COPY.simulator.feedbackTitle}</h2>
    {evaluation ? (
      <>
        <p>
          {UI_COPY.simulator.scoreLabel}: {evaluation.score}
        </p>
        <p>
          {UI_COPY.simulator.primaryFeedbackLabel}: {evaluation.primaryFeedback}
        </p>
        <h3>{UI_COPY.simulator.criteriaLabel}</h3>
        <ul>
          {evaluation.criteria.map((criterion) => (
            <li key={criterion.criterionId}>
              <strong>{criterion.label}</strong>: {criterion.passed ? "pass" : "fail"} |{" "}
              {UI_COPY.simulator.criterionCurrentLabel} {(criterion.score * 100).toFixed(0)}% |{" "}
              {UI_COPY.simulator.criterionExpectedLabel} pass | {criterion.message}
            </li>
          ))}
        </ul>
        {evaluation.secondaryFeedback.length > 0 && (
          <>
            <h3>{UI_COPY.simulator.secondaryFeedbackLabel}</h3>
            <ul>
              {evaluation.secondaryFeedback.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          </>
        )}
        {evaluation.status === "passed" && (
          <div role="status" style={{ border: "1px solid #16a34a", borderRadius: 8, padding: "0.75rem" }}>
            <h3>{UI_COPY.simulator.taskCompletedTitle}</h3>
            <p>
              {UI_COPY.simulator.scoreLabel}: {evaluation.score}
            </p>
            <p>
              {UI_COPY.simulator.taskCompletedSummaryLabel}: rise {evaluation.finalCameraState?.frontRiseMm ?? 0}mm, tilt{" "}
              {evaluation.finalCameraState?.frontTiltDeg ?? 0}°, swing {evaluation.finalCameraState?.frontSwingDeg ?? 0}°,
              focus {evaluation.finalCameraState?.focusDistanceMm ?? 0}mm, aperture f/
              {evaluation.finalCameraState?.aperture ?? 11}.
            </p>
          </div>
        )}
      </>
    ) : (
      <p>{UI_COPY.simulator.noEvaluationYet}</p>
    )}
  </section>
);
