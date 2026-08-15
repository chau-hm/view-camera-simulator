import { useTranslation } from "react-i18next";
import type { TaskDefinition } from "../../types/task";
import { UI_COPY } from "../../ui/copy";
import "../../i18n";
import { simulatorMessageKeys } from "../../i18n/simulatorMessageKeys";
import { formatControlLabel, getFreePracticeGuidanceKeys } from './taskHelpers';

type TaskPanelProps = {
  task: TaskDefinition | null;
  sceneId?: string;
  showTitle?: boolean;
};

export const TaskPanel = ({ task, sceneId, showTitle = true }: TaskPanelProps) => {
  const { t } = useTranslation();
  const freeGuidance = getFreePracticeGuidanceKeys(sceneId);

  if (!task) {
    // Free mode guidance (content-only; outer card shell and heading provided by Workspace)
    return (
      <section aria-label={t(simulatorMessageKeys.task.title)} className="task-panel task-panel--free">
        {showTitle ? <h2>{t(simulatorMessageKeys.task.title)}</h2> : null}
        <div className="task-summary">
          <div className="task-summary__header">
            <span className="task-status task-status--free">{t(simulatorMessageKeys.task.freePractice)}</span>
          </div>

          {/* single objective paragraph (scene-specific) */}
          <p className="task-summary__objective">{t(freeGuidance.objectiveKey)}</p>

          {freeGuidance.bulletKeys.length > 0 && (
            <ul className="task-summary__guidance">
              {freeGuidance.bulletKeys.map((bulletKey) => (
                <li key={bulletKey}>{t(bulletKey)}</li>
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
    <section aria-label={t(simulatorMessageKeys.task.title)} className="task-panel task-panel--guided">
      {showTitle ? <h2>{t(simulatorMessageKeys.task.title)}</h2> : null}
      <div className="task-summary">
        <div className="task-summary__header">
          <span className="task-status task-status--progress">Guided task</span>
        </div>
        <h3 className="task-summary__title">{task.title}</h3>
        {/* objective may be an optional presentation field on some task definitions */}
        <p className="task-summary__objective">{task.objective ?? objectiveNote}</p>

        <div className="task-summary__controls">
          <strong>{UI_COPY.simulator.allowedControlsLabel}:</strong>{' '}
          {task.enabledControls.map((c) => (
            <span key={c} className="chip" style={{ marginLeft: 8 }}>{formatControlLabel(c)}</span>
          ))}
        </div>

        <details>
          <summary>{UI_COPY.simulator.viewRequirementsLabel}</summary>
          <div className="task-requirements" style={{ marginTop: 8 }}>
            {remainingNotes.length > 0 ? (
              <ul className="task-requirements__list">
                {remainingNotes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            ) : (
              <div className="task-requirements__empty">{UI_COPY.simulator.noAdjustmentNeeded}</div>
            )}
          </div>
        </details>
      </div>
    </section>
  );
};
