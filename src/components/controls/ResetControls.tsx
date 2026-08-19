import { useTranslation } from "react-i18next";
import { useAppStore } from "../../state/appStore";
import "../../i18n";
import { simulatorMessageKeys } from "../../i18n/simulatorMessageKeys";

export const ResetControls = ({
  showTitle = true,
  showMovementReset = true,
}: {
  showTitle?: boolean;
  showMovementReset?: boolean;
}) => {
  const { t } = useTranslation();
  const resetMovements = useAppStore((state) => state.resetMovements);
  const restartTask = useAppStore((state) => state.restartTask);
  const activeTaskId = useAppStore((state) => state.task.activeTaskId);
  const mode = useAppStore((state) => state.ui.mode);
  const hasTask = activeTaskId !== null && mode === "guided";

  return (
    <section aria-label={t(simulatorMessageKeys.controls.resetTitle)}>
      {showTitle && <h3>{t(simulatorMessageKeys.controls.resetTitle)}</h3>}
      <div className="control-row">
        {showMovementReset && (
          <button type="button" onClick={resetMovements} aria-label={t(simulatorMessageKeys.controls.resetMovementsButton)} className="btn btn--danger">
            {t(simulatorMessageKeys.controls.resetMovementsButton)}
          </button>
        )}
        {hasTask && (
          <button type="button" onClick={restartTask} aria-label={t(simulatorMessageKeys.controls.restartTaskButton)} className="btn btn--secondary">
            {t(simulatorMessageKeys.controls.restartTaskButton)}
          </button>
        )}
      </div>
    </section>
  );
};
