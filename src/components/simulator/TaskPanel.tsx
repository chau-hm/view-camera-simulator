import type { TaskDefinition } from "../../types/task";
import { UI_COPY } from "../../ui/copy";
import { formatControlLabel, getFreePracticeGuidance } from './taskHelpers';

type TaskPanelProps = {
  task: TaskDefinition | null;
  sceneId?: string;
  showTitle?: boolean;
};

export const TaskPanel = ({ task, sceneId, showTitle = true }: TaskPanelProps) => {
  const freeGuidance = getFreePracticeGuidance(sceneId);

  if (!task) {
    // Free mode guidance
    return (
      <section aria-label={UI_COPY.simulator.taskTitle} className="simulator-info-card simulator-info-card--task task-panel task-panel--free">
        {showTitle ? <h2>{UI_COPY.simulator.taskTitle}</h2> : null}
        <div className="task-summary">
          <div className="task-summary__header">
            <span className="task-status task-status--free">{UI_COPY.simulator.freePractice}</span>
          </div>
          <h3 className="task-summary__title">{freeGuidance.heading}</h3>
          <p className="task-summary__objective">{freeGuidance.intro}</p>
          {freeGuidance.bullets.length > 0 && (
            <ul>
              {freeGuidance.bullets.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          )}
        </div>
      </section>
    );
  }

  // Guided task summary
  const objectiveNote = task.constraints.notes && task.constraints.notes.length > 0 ? task.constraints.notes[0] : '';
  const remainingNotes = task.constraints.notes && task.constraints.notes.length > 1 ? task.constraints.notes.slice(1) : [];

  return (
    <section aria-label={UI_COPY.simulator.taskTitle} className="simulator-info-card simulator-info-card--task task-panel task-panel--guided">
      {showTitle ? <h2>{UI_COPY.simulator.taskTitle}</h2> : null}
      <div className="task-summary">
        <div className="task-summary__header">
          <span className="task-status task-status--progress">Guided task</span>
        </div>
        <h3 className="task-summary__title">{task.title}</h3>
        <p className="task-summary__objective">{task['objective'] ?? objectiveNote}</p>

        <div className="task-summary__controls">
          <strong>{UI_COPY.simulator.allowedControlsLabel}:</strong>{' '}
          {task.enabledControls.map((c) => (
            <span key={c} className="chip" style={{ marginLeft: 8 }}>{formatControlLabel(c)}</span>
          ))}
        </div>

        <details>
          <summary>{UI_COPY.simulator.viewRequirementsLabel}</summary>
          <div style={{ marginTop: 8 }}>
            {remainingNotes.length > 0 ? (
              <ul>
                {remainingNotes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            ) : (
              <div>{UI_COPY.simulator.noAdjustmentNeeded}</div>
            )}

            <h4 style={{ marginTop: 8 }}>{UI_COPY.simulator.taskAllowedControlsLabel}</h4>
            <div>
              {task.enabledControls.map((c) => (
                <span key={c} className="chip" style={{ marginRight: 6 }}>{formatControlLabel(c)}</span>
              ))}
            </div>
          </div>
        </details>
      </div>
    </section>
  );
};
