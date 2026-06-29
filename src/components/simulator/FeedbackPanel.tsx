import type { TaskEvaluation } from "../../types/task";

type FeedbackPanelProps = {
  evaluation: TaskEvaluation | null;
};

export const FeedbackPanel = ({ evaluation }: FeedbackPanelProps) => (
  <section>
    <h2>Feedback</h2>
    {evaluation ? (
      <>
        <p>Score: {evaluation.score}</p>
        <ul>
          {evaluation.feedback.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      </>
    ) : (
      <p>No evaluation yet.</p>
    )}
  </section>
);
