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
  onToggleGeometryPanel?: () => void;
  showHeader?: boolean;
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
  onToggleGeometryPanel,
  showHeader,
}: SceneViewportProps) => {
  const [attempt, setAttempt] = useState(0);
  const [assetError, setAssetError] = useState<UiErrorState | null>(null);
  const [showFocusPlaneOverlay, setShowFocusPlaneOverlay] = useState(true);
  const [showDofOverlay, setShowDofOverlay] = useState(true);
  const [viewResetNonce, setViewResetNonce] = useState(0);
  const [bigView, setBigView] = useState(false);
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
      {showHeader !== false && <h2>{UI_COPY.simulator.sceneTitle}</h2>}
      <p data-testid="scene-front-y-mm">Front standard Y: {opticsState.lensCenterWorld.y.toFixed(1)} mm</p>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "0.5rem" }}>
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
          <label style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
            <input className="form-checkbox" type="checkbox" checked={showFocusPlaneOverlay} onChange={(event) => setShowFocusPlaneOverlay(event.target.checked)} />
            {UI_COPY.simulator.focusPlaneOverlayLabel}
          </label>
          <label style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
            <input className="form-checkbox" type="checkbox" checked={showDofOverlay} onChange={(event) => setShowDofOverlay(event.target.checked)} />
            {UI_COPY.simulator.dofOverlayLabel}
          </label>

          {/* move render quality up into this row */}
          <label style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
            <span>{UI_COPY.simulator.renderQualityLabel}</span>
            <select className="form-select" value={renderQuality} onChange={(event) => setRenderQuality(parseRenderQuality(event.target.value))}>
              <option value="high">{UI_COPY.simulator.renderQualityHigh}</option>
              <option value="standard">{UI_COPY.simulator.renderQualityStandard}</option>
              <option value="low">{UI_COPY.simulator.renderQualityLow}</option>
            </select>
          </label>
        </div>

        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
          <button type="button" className="btn" onClick={() => setViewResetNonce((value) => value + 1)}>
            {UI_COPY.simulator.sceneViewReset}
          </button>

          {/* Geometry panel toggle moved into Scene controls */}
          {onToggleGeometryPanel && (
            <button type="button" onClick={onToggleGeometryPanel} className="btn btn--secondary">
              Open 2D Geometry
            </button>
          )}

          {/* Big view toggle removed from this row; replaced by overlay icon in the renderer container */}
        </div>
      </div>
      <p style={{ fontSize: 12, color: "#4b5563", marginTop: 0 }}>
        Loaded assets: {requiredAssets.length} required, {lazyAssets.length} lazy for current scene,{" "}
        {preloadAssets.length} preload for next scene.
      </p>
      {/* Scene renderer container - either inline or shown as an overlay when bigView is true. */}
      {bigView ? (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
            width: "70vw",
            height: "70vh",
            background: "white",
            zIndex: 2000,
            boxShadow: "0 20px 60px rgba(2,6,23,0.5)",
            borderRadius: 8,
            padding: "0.5rem",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem" }}>
            <strong>{UI_COPY.simulator.sceneTitle}</strong>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button className="btn btn--compact" type="button" onClick={() => setBigView(false)}>
                Close
              </button>
            </div>
          </div>
          <div style={{ flex: 1, marginTop: "0.5rem" }}>
            <SceneRenderer
              scene={scene}
              opticsState={opticsState}
              attempt={attempt}
              showFocusPlaneOverlay={showFocusPlaneOverlay}
              showDofOverlay={showDofOverlay}
              showOpticalDebugPlanes={false}
              renderQuality={renderQuality}
              viewResetNonce={viewResetNonce}
              simulateAssetFailure={simulateAssetFailure}
              onAssetError={(message) => setAssetError({ title: UI_COPY.simulator.sceneLoadFailed, message })}
              containerStyle={{ width: "100%", height: "100%" }}
            />
          </div>
        </div>
      ) : (
        <div style={{ position: 'relative' }}>
          <div>
            <SceneRenderer
              scene={scene}
              opticsState={opticsState}
              attempt={attempt}
              showFocusPlaneOverlay={showFocusPlaneOverlay}
              showDofOverlay={showDofOverlay}
              showOpticalDebugPlanes={false}
              renderQuality={renderQuality}
              viewResetNonce={viewResetNonce}
              simulateAssetFailure={simulateAssetFailure}
              onAssetError={(message) => setAssetError({ title: UI_COPY.simulator.sceneLoadFailed, message })}
              containerStyle={{ width: '100%', aspectRatio: '5 / 4', border: "1px solid #d1d5db", borderRadius: 8, overflow: "hidden" }}
            />
          </div>

          {/* fullscreen icon button at top-right of the scene renderer */}
          <button
            aria-label={bigView ? 'Exit full screen' : 'Open big view'}
            title={bigView ? 'Exit full screen' : 'Open big view'}
            className="btn btn--icon btn--viewport-action"
            onClick={() => setBigView(true)}
          >
            <span className="material-symbols-outlined" aria-hidden="true">open_in_new</span>
          </button>
        </div>
      )}
    </section>
  );
};
