import { useTranslation } from "react-i18next";
import type { GuidedTaskMessageRef, TaskDefinition } from "../../types/task";
import "../../i18n";
import { simulatorMessageKeys } from "../../i18n/simulatorMessageKeys";
import { guidedTaskMessageKeys } from "../../i18n/guidedTaskMessageKeys";
import { getFreePracticeGuidanceKeys } from "./taskHelpers";
import {
  getGuidedControlMessageKey,
  getGuidedTaskCopy,
} from "../../core/tasks/guidedTaskCopyKeys";

type TaskPanelProps = {
  task: TaskDefinition | null;
  sceneId?: string;
  showTitle?: boolean;
};

export const TaskPanel = ({ task, sceneId, showTitle = true }: TaskPanelProps) => {
  const { t } = useTranslation();
  const translateMessage = (message: GuidedTaskMessageRef): string =>
    String(message.values ? t(message.key, message.values as never) : t(message.key));
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
  const guidedCopy = getGuidedTaskCopy(task);

  return (
    <section aria-label={t(simulatorMessageKeys.task.title)} className="task-panel task-panel--guided">
      {showTitle ? <h2>{t(simulatorMessageKeys.task.title)}</h2> : null}
      <div className="task-summary">
        <div className="task-summary__header">
          <span className="task-status task-status--progress">{t(guidedTaskMessageKeys.common.guidedTask)}</span>
        </div>
        <h3 className="task-summary__title">{translateMessage(guidedCopy.title)}</h3>
        <p className="task-summary__objective">{translateMessage(guidedCopy.objective)}</p>

        <div className="task-summary__controls">
          <strong>{t(guidedTaskMessageKeys.common.allowedControls)}:</strong>{" "}
          {task.enabledControls.map((c) => (
            <span key={c} className="chip" style={{ marginLeft: 8 }}>
              {t(getGuidedControlMessageKey(c))}
            </span>
          ))}
        </div>

        <details>
          <summary>{t(guidedTaskMessageKeys.common.viewRequirements)}</summary>
          <div className="task-requirements" style={{ marginTop: 8 }}>
            {guidedCopy.notes.length > 0 ? (
              <ul className="task-requirements__list">
                {guidedCopy.notes.map((note) => (
                  <li key={note.key}>{translateMessage(note)}</li>
                ))}
              </ul>
            ) : (
              <div className="task-requirements__empty">
                {t(guidedTaskMessageKeys.common.noAdjustmentNeeded)}
              </div>
            )}
          </div>
        </details>
      </div>
    </section>
  );
};
