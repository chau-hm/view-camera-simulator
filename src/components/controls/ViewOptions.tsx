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
  compact?: boolean;
};

export const ViewOptions = ({
  canToggleFocusAssist,
  canToggleGrid,
  canToggleGroundGlassAssist = false,
  showGroundGlassAssist = true,
  lockReason,
  compact = false,
}: ViewOptionsProps) => {
  const viewOptions = useAppStore(useShallow(selectViewOptionState));
  const toggleGroundGlassAssist = useAppStore((state) => state.toggleGroundGlassAssist);
  const toggleFocusAssist = useAppStore((state) => state.toggleFocusAssist);
  const toggleGrid = useAppStore((state) => state.toggleGrid);

  return (
    <section aria-label={UI_COPY.controls.viewOptionsTitle} className={compact ? 'view-options view-options--compact' : 'view-options'}>
      <h3 className="control-group-title">{UI_COPY.controls.viewOptionsTitle}</h3>
      <div className={compact ? 'choice-list choice-list--inline' : 'choice-list'}>
        {showGroundGlassAssist && (
          <label className="choice-label">
            <input
              className="form-checkbox"
              aria-label={UI_COPY.controls.groundGlassAssistLabel}
              type="checkbox"
              checked={viewOptions.groundGlassAssistEnabled}
              disabled={!canToggleGroundGlassAssist}
              onChange={toggleGroundGlassAssist}
            />
            <span>{UI_COPY.controls.groundGlassAssistLabel}</span>
            {!canToggleGroundGlassAssist && <small className="control-help">{lockReason}</small>}
          </label>
        )}

        <label className="choice-label">
          <input
            className="form-checkbox"
            aria-label={UI_COPY.controls.focusAssistLabel}
            type="checkbox"
            checked={viewOptions.focusAssistEnabled}
            disabled={!canToggleFocusAssist}
            onChange={toggleFocusAssist}
          />
          <span>{UI_COPY.controls.focusAssistLabel}</span>
          {!canToggleFocusAssist && <small className="control-help">{lockReason}</small>}
        </label>

        <label className="choice-label">
          <input
            className="form-checkbox"
            aria-label={UI_COPY.controls.gridLabel}
            type="checkbox"
            checked={viewOptions.gridEnabled}
            disabled={!canToggleGrid}
            onChange={toggleGrid}
          />
          <span>{UI_COPY.controls.gridLabel}</span>
          {!canToggleGrid && <small className="control-help">{lockReason}</small>}
        </label>
      </div>
    </section>
  );
};
