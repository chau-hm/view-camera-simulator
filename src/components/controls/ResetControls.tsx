import { useAppStore } from "../../state/appStore";
import { UI_COPY } from "../../ui/copy";

export const ResetControls = () => {
  const resetMovements = useAppStore((state) => state.resetMovements);
  const restartTask = useAppStore((state) => state.restartTask);

  return (
    <section aria-label={UI_COPY.controls.resetTitle}>
      <h3>{UI_COPY.controls.resetTitle}</h3>
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        <button type="button" onClick={resetMovements} aria-label={UI_COPY.controls.resetMovementsButton}>
          {UI_COPY.controls.resetMovementsButton}
        </button>
        <button type="button" onClick={restartTask} aria-label={UI_COPY.controls.restartTaskButton}>
          {UI_COPY.controls.restartTaskButton}
        </button>
      </div>
    </section>
  );
};
