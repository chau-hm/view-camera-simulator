import { useAppStore } from "../../state/appStore";

export const ViewOptions = () => {
  const camera = useAppStore((state) => state.camera);
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
          value={camera.geometryView}
          onChange={(event) => setGeometryView(event.target.value === "top" ? "top" : "side")}
        >
          <option value="side">Side</option>
          <option value="top">Top</option>
        </select>
      </label>
      <label>
        <input type="checkbox" checked={camera.groundGlassAssistEnabled} onChange={toggleGroundGlassAssist} />
        Ground glass assist
      </label>
      <label>
        <input type="checkbox" checked={camera.focusAssistEnabled} onChange={toggleFocusAssist} />
        Focus assist
      </label>
      <label>
        <input type="checkbox" checked={camera.gridEnabled} onChange={toggleGrid} />
        Grid
      </label>
    </section>
  );
};
