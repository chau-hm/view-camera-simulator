import { useShallow } from "zustand/react/shallow";
import { useAppStore } from "../../state/appStore";
import { selectViewOptionState } from "../../state/selectors";
import { UI_COPY } from "../../ui/copy";

type ViewOptionsProps = {
  // permissions: whether the user is allowed to toggle each option in the current mode/task
  canToggleFocusAssist: boolean;
  canToggleGrid: boolean;
  canToggleGroundGlassAssist?: boolean;
  // show/hide the ground glass assist control if needed (optional)
  showGroundGlassAssist?: boolean;
  lockReason: string;
};

export const ViewOptions = ({
  canToggleFocusAssist,
  canToggleGrid,
  canToggleGroundGlassAssist = false,
  showGroundGlassAssist = true,
  lockReason,
}: ViewOptionsProps) => {
  const viewOptions = useAppStore(useShallow(selectViewOptionState));
  const toggleGroundGlassAssist = useAppStore((state) => state.toggleGroundGlassAssist);
  const toggleFocusAssist = useAppStore((state) => state.toggleFocusAssist);
  const toggleGrid = useAppStore((state) => state.toggleGrid);

  return (
    <section aria-label={UI_COPY.controls.viewOptionsTitle} style={{ display: 'grid', gap: '0.5rem' }}>
      <h3>{UI_COPY.controls.viewOptionsTitle}</h3>
      {showGroundGlassAssist && (
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <input
            aria-label={UI_COPY.controls.groundGlassAssistLabel}
            type="checkbox"
            checked={viewOptions.groundGlassAssistEnabled}
            disabled={!canToggleGroundGlassAssist}
            onChange={toggleGroundGlassAssist}
          />
          <span>{UI_COPY.controls.groundGlassAssistLabel}</span>
          {!canToggleGroundGlassAssist && <small style={{ color: '#94a3b8' }}>{lockReason}</small>}
        </label>
      )}
      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <input
          aria-label={UI_COPY.controls.focusAssistLabel}
          type="checkbox"
          checked={viewOptions.focusAssistEnabled}
          disabled={!canToggleFocusAssist}
          onChange={toggleFocusAssist}
        />
        <span>{UI_COPY.controls.focusAssistLabel}</span>
        {!canToggleFocusAssist && <small style={{ color: '#94a3b8' }}>{lockReason}</small>}
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <input
          aria-label={UI_COPY.controls.gridLabel}
          type="checkbox"
          checked={viewOptions.gridEnabled}
          disabled={!canToggleGrid}
          onChange={toggleGrid}
        />
        <span>{UI_COPY.controls.gridLabel}</span>
        {!canToggleGrid && <small style={{ color: '#94a3b8' }}>{lockReason}</small>}
      </label>
    </section>
  );
};
