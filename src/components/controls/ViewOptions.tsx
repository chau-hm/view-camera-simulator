import { useShallow } from "zustand/react/shallow";
import { useAppStore } from "../../state/appStore";
import { selectViewOptionState } from "../../state/selectors";

export const ViewOptions = () => {
  const viewOptions = useAppStore(useShallow(selectViewOptionState));
  const setGeometryView = useAppStore((state) => state.setGeometryView);
  const toggleGroundGlassAssist = useAppStore((state) => state.toggleGroundGlassAssist);
  const toggleFocusAssist = useAppStore((state) => state.toggleFocusAssist);
  const toggleGrid = useAppStore((state) => state.toggleGrid);

  return (
    <section>
      <h3>View Options</h3>
      <label>
        Geometry view
        <select
          value={viewOptions.geometryView}
          onChange={(event) => setGeometryView(event.target.value === "top" ? "top" : "side")}
        >
          <option value="side">Side</option>
          <option value="top">Top</option>
        </select>
      </label>
      <label>
        <input
          type="checkbox"
          checked={viewOptions.groundGlassAssistEnabled}
          onChange={toggleGroundGlassAssist}
        />
        Ground glass assist
      </label>
      <label>
        <input type="checkbox" checked={viewOptions.focusAssistEnabled} onChange={toggleFocusAssist} />
        Focus assist
      </label>
      <label>
        <input type="checkbox" checked={viewOptions.gridEnabled} onChange={toggleGrid} />
        Grid
      </label>
    </section>
  );
};
