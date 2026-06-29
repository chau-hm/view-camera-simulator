import { useShallow } from "zustand/react/shallow";
import { useAppStore } from "../../state/appStore";
import { selectViewOptionState } from "../../state/selectors";
import { UI_COPY } from "../../ui/copy";

export const ViewOptions = () => {
  const viewOptions = useAppStore(useShallow(selectViewOptionState));
  const setGeometryView = useAppStore((state) => state.setGeometryView);
  const toggleGroundGlassAssist = useAppStore((state) => state.toggleGroundGlassAssist);
  const toggleFocusAssist = useAppStore((state) => state.toggleFocusAssist);
  const toggleGrid = useAppStore((state) => state.toggleGrid);

  return (
    <section>
      <h3>{UI_COPY.controls.viewOptionsTitle}</h3>
      <label>
        {UI_COPY.controls.geometryViewLabel}
        <select
          value={viewOptions.geometryView}
          onChange={(event) => setGeometryView(event.target.value === "top" ? "top" : "side")}
        >
          <option value="side">{UI_COPY.controls.geometryViewSide}</option>
          <option value="top">{UI_COPY.controls.geometryViewTop}</option>
        </select>
      </label>
      <label>
        <input
          type="checkbox"
          checked={viewOptions.groundGlassAssistEnabled}
          onChange={toggleGroundGlassAssist}
        />
        {UI_COPY.controls.groundGlassAssistLabel}
      </label>
      <label>
        <input type="checkbox" checked={viewOptions.focusAssistEnabled} onChange={toggleFocusAssist} />
        {UI_COPY.controls.focusAssistLabel}
      </label>
      <label>
        <input type="checkbox" checked={viewOptions.gridEnabled} onChange={toggleGrid} />
        {UI_COPY.controls.gridLabel}
      </label>
    </section>
  );
};
