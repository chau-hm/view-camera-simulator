import type { TaskEvaluation } from "../../types/task";
import { UI_COPY } from "../../ui/copy";

type FeedbackPanelProps = {
  evaluation: TaskEvaluation | null;
};

export const FeedbackPanel = ({ evaluation }: FeedbackPanelProps) => (
  <section>
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
              {criterion.label}: {criterion.passed ? "pass" : "fail"}
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
      </>
    ) : (
      <p>{UI_COPY.simulator.noEvaluationYet}</p>
    )}
  </section>
);
