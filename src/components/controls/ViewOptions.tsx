import { useShallow } from "zustand/react/shallow";
import { useTranslation } from "react-i18next";
import { useAppStore } from "../../state/appStore";
import { selectViewOptionState } from "../../state/selectors";
import "../../i18n";
import { simulatorMessageKeys } from "../../i18n/simulatorMessageKeys";

type ViewOptionsProps = {
  // permissions: whether the user is allowed to toggle each option in the current mode/task
  canToggleGrid: boolean;
  lockReason: string;
  compact?: boolean;
};

export const ViewOptions = ({
  canToggleGrid,
  lockReason,
  compact = false,
}: ViewOptionsProps) => {
  const { t } = useTranslation();
  const viewOptions = useAppStore(useShallow(selectViewOptionState));
  const toggleGrid = useAppStore((state) => state.toggleGrid);

  return (
    <section aria-label={t(simulatorMessageKeys.controls.viewOptionsTitle)} className={compact ? 'view-options view-options--compact' : 'view-options'}>
      {!compact && <h3 className="control-group-title">{t(simulatorMessageKeys.controls.viewOptionsTitle)}</h3>}
      <div className={compact ? 'choice-list choice-list--stacked' : 'choice-list'}>
        <label className="choice-label">
          <input
            className="form-checkbox"
            aria-label={t(simulatorMessageKeys.controls.gridLabel)}
            type="checkbox"
            checked={viewOptions.gridEnabled}
            disabled={!canToggleGrid}
            onChange={() => toggleGrid()}
          />
          <span>{t(simulatorMessageKeys.controls.gridLabel)}</span>
          {!canToggleGrid && <small className="control-help">{lockReason}</small>}
        </label>
      </div>
    </section>
  );
};
