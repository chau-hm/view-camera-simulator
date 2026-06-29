import { useMemo, useState } from "react";
import { SceneRenderer } from "../../render/SceneRenderer";
import { isWebGLAvailable } from "../../utils/webgl";
import type { UiErrorState } from "../../types/ui";
import type { SceneDefinition } from "../../types/scene";
import type { DerivedOpticsState } from "../../types/optics";
import type { RenderQualityProfile } from "../../types/ui";
import { UI_COPY } from "../../ui/copy";

type SceneViewportProps = {
  scene: SceneDefinition;
  opticsState: DerivedOpticsState;
  simulateAssetFailure: boolean;
};

const parseRenderQuality = (value: string): RenderQualityProfile => {
  if (value === "high" || value === "standard" || value === "low") {
    return value;
  }
  return "standard";
};

export const SceneViewport = ({ scene, opticsState, simulateAssetFailure }: SceneViewportProps) => {
  const [attempt, setAttempt] = useState(0);
  const [assetError, setAssetError] = useState<UiErrorState | null>(null);
  const [showFocusPlaneOverlay, setShowFocusPlaneOverlay] = useState(true);
  const [showDofOverlay, setShowDofOverlay] = useState(true);
  const [renderQuality, setRenderQuality] = useState<RenderQualityProfile>("standard");
  const [viewResetNonce, setViewResetNonce] = useState(0);
  const webglAvailable = useMemo(() => isWebGLAvailable(), []);

  if (!webglAvailable) {
    return (
      <section>
        <h2>{UI_COPY.simulator.sceneTitle}</h2>
        <p>{UI_COPY.simulator.webglUnavailable}</p>
      </section>
    );
  }

  if (assetError) {
    return (
      <section>
        <h2>{UI_COPY.simulator.sceneTitle}</h2>
        <p>{assetError.message}</p>
        <button
          type="button"
          onClick={() => {
            setAssetError(null);
            setAttempt((value) => value + 1);
          }}
        >
          {UI_COPY.simulator.retryLoadScene}
        </button>
      </section>
    );
  }

  return (
    <section>
      <h2>{UI_COPY.simulator.sceneTitle}</h2>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
        <label style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
          <input
            type="checkbox"
            checked={showFocusPlaneOverlay}
            onChange={(event) => setShowFocusPlaneOverlay(event.target.checked)}
          />
          {UI_COPY.simulator.focusPlaneOverlayLabel}
        </label>
        <label style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
          <input type="checkbox" checked={showDofOverlay} onChange={(event) => setShowDofOverlay(event.target.checked)} />
          {UI_COPY.simulator.dofOverlayLabel}
        </label>
        <label style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
          <span>{UI_COPY.simulator.renderQualityLabel}</span>
          <select
            value={renderQuality}
            onChange={(event) => setRenderQuality(parseRenderQuality(event.target.value))}
          >
            <option value="high">{UI_COPY.simulator.renderQualityHigh}</option>
            <option value="standard">{UI_COPY.simulator.renderQualityStandard}</option>
            <option value="low">{UI_COPY.simulator.renderQualityLow}</option>
          </select>
        </label>
        <button type="button" onClick={() => setViewResetNonce((value) => value + 1)}>
          {UI_COPY.simulator.sceneViewReset}
        </button>
      </div>
      <SceneRenderer
        scene={scene}
        opticsState={opticsState}
        attempt={attempt}
        showFocusPlaneOverlay={showFocusPlaneOverlay}
        showDofOverlay={showDofOverlay}
        renderQuality={renderQuality}
        viewResetNonce={viewResetNonce}
        simulateAssetFailure={simulateAssetFailure}
        onAssetError={(message) => setAssetError({ title: UI_COPY.simulator.sceneLoadFailed, message })}
      />
    </section>
  );
};
