import { useAppStore } from "../../state/appStore";

export const ResetControls = () => {
  const resetCamera = useAppStore((state) => state.resetCamera);
  return (
    <section>
      <h3>Reset</h3>
      <button type="button" onClick={resetCamera}>
        Reset all controls
      </button>
    </section>
  );
};
