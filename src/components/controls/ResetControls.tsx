import { useAppStore } from "../../state/appStore";
import { UI_COPY } from "../../ui/copy";

export const ResetControls = ({
  showTitle = true,
  showMovementReset = true,
}: {
  showTitle?: boolean;
  showMovementReset?: boolean;
}) => {
  const resetMovements = useAppStore((state) => state.resetMovements);
  const restartTask = useAppStore((state) => state.restartTask);
  const activeTaskId = useAppStore((state) => state.task.activeTaskId);
  const mode = useAppStore((state) => state.ui.mode);
  const hasTask = activeTaskId !== null && mode === "guided";

  return (
    <section aria-label={UI_COPY.controls.resetTitle}>
      {showTitle && <h3>{UI_COPY.controls.resetTitle}</h3>}
      <div className="control-row">
        {showMovementReset && (
          <button type="button" onClick={resetMovements} aria-label={UI_COPY.controls.resetMovementsButton} className="btn btn--danger">
            {UI_COPY.controls.resetMovementsButton}
          </button>
        )}
        {hasTask && (
          <button type="button" onClick={restartTask} aria-label={UI_COPY.controls.restartTaskButton} className="btn btn--secondary">
            {UI_COPY.controls.restartTaskButton}
          </button>
        )}
      </div>
    </section>
  );
};
