import { useAppStore } from "../../state/appStore";

export const ResetControls = () => {
  const resetMovements = useAppStore((state) => state.resetMovements);
  const restartTask = useAppStore((state) => state.restartTask);

  return (
    <section>
      <h3>Reset</h3>
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        <button type="button" onClick={resetMovements}>
          Reset movements
        </button>
        <button type="button" onClick={restartTask}>
          Restart task
        </button>
      </div>
    </section>
  );
};
