import { useShallow } from "zustand/react/shallow";
import { useAppStore } from "../../state/appStore";
import { selectViewOptionState } from "../../state/selectors";
import { UI_COPY } from "../../ui/copy";

type ViewOptionsProps = {
  orientationAssistEnabled: boolean;
  focusAssistEnabled: boolean;
  gridEnabled: boolean;
  lockReason: string;
};

export const ViewOptions = ({
  orientationAssistEnabled,
  focusAssistEnabled,
  gridEnabled,
  lockReason,
}: ViewOptionsProps) => {
  const viewOptions = useAppStore(useShallow(selectViewOptionState));
  const toggleGroundGlassAssist = useAppStore((state) => state.toggleGroundGlassAssist);
  const toggleFocusAssist = useAppStore((state) => state.toggleFocusAssist);
  const toggleGrid = useAppStore((state) => state.toggleGrid);

  return (
    <section aria-label={UI_COPY.controls.viewOptionsTitle}>
      <h3>{UI_COPY.controls.viewOptionsTitle}</h3>
      <label>
        <input
          aria-label={UI_COPY.controls.groundGlassAssistLabel}
          type="checkbox"
          checked={viewOptions.groundGlassAssistEnabled}
          disabled={!orientationAssistEnabled}
          onChange={toggleGroundGlassAssist}
        />
        {UI_COPY.controls.groundGlassAssistLabel}
        {!orientationAssistEnabled && <small>{lockReason}</small>}
      </label>
      <label>
        <input
          aria-label={UI_COPY.controls.focusAssistLabel}
          type="checkbox"
          checked={viewOptions.focusAssistEnabled}
          disabled={!focusAssistEnabled}
          onChange={toggleFocusAssist}
        />
        {UI_COPY.controls.focusAssistLabel}
        {!focusAssistEnabled && <small>{lockReason}</small>}
      </label>
      <label>
        <input
          aria-label={UI_COPY.controls.gridLabel}
          type="checkbox"
          checked={viewOptions.gridEnabled}
          disabled={!gridEnabled}
          onChange={toggleGrid}
        />
        {UI_COPY.controls.gridLabel}
        {!gridEnabled && <small>{lockReason}</small>}
      </label>
    </section>
  );
};
