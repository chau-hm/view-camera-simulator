import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { SceneRenderer } from "../../render/SceneRenderer";
import { getLazySceneAssets, getPreloadSceneAssets, getRequiredSceneAssets } from "../../scenes/definitions";
import { isWebGLAvailable } from "../../utils/webgl";
import type { UiErrorState } from "../../types/ui";
import type { SceneDefinition } from "../../types/scene";
import type { DerivedOpticsState } from "../../types/optics";
import type { RenderQualityProfile } from "../../types/ui";
import { UI_COPY } from "../../ui/copy";

type SceneViewportProps = {
  scene: SceneDefinition;
  opticsState: DerivedOpticsState;
  renderQuality: RenderQualityProfile;
  setRenderQuality: Dispatch<SetStateAction<RenderQualityProfile>>;
  simulateAssetFailure: boolean;
  onSceneSwitchSample?: (sampleMs: number) => void;
};

const parseRenderQuality = (value: string): RenderQualityProfile => {
  if (value === "high" || value === "standard" || value === "low") {
    return value;
  }
  return "standard";
};

export const SceneViewport = ({
  scene,
  opticsState,
  renderQuality,
  setRenderQuality,
  simulateAssetFailure,
  onSceneSwitchSample,
}: SceneViewportProps) => {
  const [attempt, setAttempt] = useState(0);
  const [assetError, setAssetError] = useState<UiErrorState | null>(null);
  const [showFocusPlaneOverlay, setShowFocusPlaneOverlay] = useState(true);
  const [showDofOverlay, setShowDofOverlay] = useState(true);
  const [viewResetNonce, setViewResetNonce] = useState(0);
  const webglAvailable = useMemo(() => isWebGLAvailable(), []);
  const requiredAssets = useMemo(() => getRequiredSceneAssets(scene.id), [scene.id]);
  const lazyAssets = useMemo(() => getLazySceneAssets(scene.id), [scene.id]);
  const preloadAssets = useMemo(() => getPreloadSceneAssets(scene.id), [scene.id]);

  if (!webglAvailable) {
    return (
      <section>
        <h2>{UI_COPY.simulator.sceneTitle}</h2>
        <p data-testid="scene-front-y-mm">Front standard Y: {opticsState.lensCenterWorld.y.toFixed(1)} mm</p>
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
      <p data-testid="scene-front-y-mm">Front standard Y: {opticsState.lensCenterWorld.y.toFixed(1)} mm</p>
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
      <p style={{ fontSize: 12, color: "#4b5563", marginTop: 0 }}>
        Loaded assets: {requiredAssets.length} required, {lazyAssets.length} lazy for current scene,{" "}
        {preloadAssets.length} preload for next scene.
      </p>
      {onSceneSwitchSample && (
        <p style={{ fontSize: 12, color: "#4b5563", marginTop: 0 }}>Scene switch timing is being sampled live.</p>
      )}
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
        onSceneSwitchSample={onSceneSwitchSample}
      />
    </section>
  );
};
