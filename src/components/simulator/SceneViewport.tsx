import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { SceneRenderer } from "../../render/SceneRenderer";
import { SceneOverlayControls } from "./SceneOverlayControls";
import { getLazySceneAssets, getPreloadSceneAssets, getRequiredSceneAssets } from "../../scenes/definitions";
import { isWebGLAvailable } from "../../utils/webgl";
import type { UiErrorState } from "../../types/ui";
import type { SceneDefinition } from "../../types/scene";
import type { DerivedOpticsState } from "../../types/optics";
import type { RenderQualityProfile } from "../../types/ui";
import { UI_COPY } from "../../ui/copy";
import { deriveScheimpflugConstruction } from "../../core/optics/scheimpflugConstruction";
import { supportsScheimpflugConstruction as sceneSupportsScheimpflugConstruction } from "../../render/scheimpflugSceneSupport";
import type { SceneViewFocus } from "../../render/sceneViewFraming";
import { useAppStore } from "../../state/appStore";

type SceneViewportProps = {
  scene: SceneDefinition;
  opticsState: DerivedOpticsState;
  renderQuality: RenderQualityProfile;
  setRenderQuality: Dispatch<SetStateAction<RenderQualityProfile>>;
  simulateAssetFailure: boolean;
  expanded: boolean;
  onRequestExpand: () => void;
  onRequestRestore: () => void;
  onToggleGeometryPanel?: (trigger: HTMLButtonElement) => void;
  showHeader?: boolean;
};

const parseRenderQuality = (value: string): RenderQualityProfile => {
  if (value === "high" || value === "standard" || value === "low") {
    return value;
  }
return "high";
};

export const SceneViewport = ({
  scene,
  opticsState,
  renderQuality,
  setRenderQuality,
  simulateAssetFailure,
  expanded,
  onRequestExpand,
  onRequestRestore,
  onToggleGeometryPanel,
  showHeader,
}: SceneViewportProps) => {
  const [attempt, setAttempt] = useState(0);
  const [assetError, setAssetError] = useState<UiErrorState | null>(null);
  const [showFocusPlaneOverlay, setShowFocusPlaneOverlay] = useState(true);
  const [showDofOverlay, setShowDofOverlay] = useState(true);
  const [showLegends, setShowLegends] = useState(false);
  const showOpticalGeometry = useAppStore((state) => state.ui.showOpticalGeometry);
  const setShowOpticalGeometry = useAppStore((state) => state.setShowOpticalGeometry);
  const [requestedScheimpflugConstruction, setRequestedScheimpflugConstruction] = useState(false);
  const [viewResetNonce, setViewResetNonce] = useState(0);
  const [viewFocusState, setViewFocusState] = useState<{
    sceneId: string;
    focus: SceneViewFocus;
  }>({ sceneId: scene.id, focus: "scene" });
  const expandTriggerRef = useRef<HTMLButtonElement | null>(null);
  const restoreTriggerRef = useRef<HTMLButtonElement | null>(null);
  const previouslyExpandedRef = useRef(expanded);
  const viewFocus = viewFocusState.sceneId === scene.id ? viewFocusState.focus : "scene";
  const webglAvailable = useMemo(() => isWebGLAvailable(), []);
  const requiredAssets = useMemo(() => getRequiredSceneAssets(scene.id), [scene.id]);
  const lazyAssets = useMemo(() => getLazySceneAssets(scene.id), [scene.id]);
  const preloadAssets = useMemo(() => getPreloadSceneAssets(scene.id), [scene.id]);
  const scheimpflugConstruction = useMemo(
    () =>
      deriveScheimpflugConstruction({
        filmPlane: opticsState.filmPlane,
        lensPlane: opticsState.lensPlane,
        focusPlane: opticsState.focusPlane,
      }),
    [opticsState.filmPlane, opticsState.focusPlane, opticsState.lensPlane],
  );
  const supportsScheimpflugConstruction = sceneSupportsScheimpflugConstruction(scene.id);
  const constructionActive =
    supportsScheimpflugConstruction &&
    requestedScheimpflugConstruction &&
    scheimpflugConstruction.isValid;

  useEffect(() => {
    if (!supportsScheimpflugConstruction) {
      setRequestedScheimpflugConstruction(false);
    }
  }, [supportsScheimpflugConstruction]);

  useEffect(() => {
    setViewFocusState({ sceneId: scene.id, focus: "scene" });
  }, [scene.id]);

  useEffect(() => {
    const wasExpanded = previouslyExpandedRef.current;
    previouslyExpandedRef.current = expanded;
    if (!expanded && !wasExpanded) return;

    const frame = window.requestAnimationFrame(() => {
      if (expanded) {
        restoreTriggerRef.current?.focus();
      } else {
        expandTriggerRef.current?.focus();
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [expanded]);

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
    <section className={`scene-panel${expanded ? " scene-panel--expanded" : ""}`}>
      {showHeader !== false && <h2>{UI_COPY.simulator.sceneTitle}</h2>}

      <div className="scene-status-row">
        <p data-testid="scene-front-y-mm">Front standard Y: {opticsState.lensCenterWorld.y.toFixed(1)} mm</p>
        <p className="scene-assets">Loaded assets: {requiredAssets.length} required, {lazyAssets.length} lazy for current scene, {preloadAssets.length} preload for next scene.</p>
      </div>

      <div className="scene-panel__controls">
        {/* Toolbar: left actions and right quality control */}
        <div className="scene-toolbar">
          <div className="scene-toolbar__actions">
            <button type="button" className="btn" onClick={() => setViewResetNonce((value) => value + 1)}>
              {UI_COPY.simulator.sceneViewReset}
            </button>
            <fieldset className="scene-view-focus" aria-label={UI_COPY.simulator.sceneViewFocusLabel}>
              <legend>{UI_COPY.simulator.sceneViewFocusLabel}</legend>
              <div className="scene-view-focus__options">
                {(["scene", "camera"] as const).map((focus) => (
                  <button
                    key={focus}
                    type="button"
                    className="btn btn--compact"
                    aria-pressed={viewFocus === focus}
                    onClick={() => setViewFocusState({ sceneId: scene.id, focus })}
                  >
                    {focus === "scene"
                      ? UI_COPY.simulator.sceneViewFocusScene
                      : UI_COPY.simulator.sceneViewFocusCamera}
                  </button>
                ))}
              </div>
            </fieldset>
            {onToggleGeometryPanel && (
              <button
                type="button"
                onClick={(event) => onToggleGeometryPanel(event.currentTarget)}
                className="btn btn--secondary"
              >
                Open 2D Geometry
              </button>
            )}
          </div>

          <label className="scene-toolbar__quality">
            <span>{UI_COPY.simulator.renderQualityLabel}</span>
            <select className="form-select" value={renderQuality} onChange={(event) => setRenderQuality(parseRenderQuality(event.target.value))}>
              <option value="high">{UI_COPY.simulator.renderQualityHigh}</option>
              <option value="standard">{UI_COPY.simulator.renderQualityStandard}</option>
              <option value="low">{UI_COPY.simulator.renderQualityLow}</option>
            </select>
          </label>
        </div>
      </div>
      <div className={`scene-viewport-shell${expanded ? " scene-viewport-shell--expanded" : ""}`}>
        <div className="scene-renderer-stage">
          <SceneRenderer
            scene={scene}
            opticsState={opticsState}
            attempt={attempt}
            showFocusPlaneOverlay={showFocusPlaneOverlay}
            showDofOverlay={showDofOverlay}
            showLegends={showLegends}
            showOpticalGeometry={showOpticalGeometry}
            showScheimpflugConstruction={constructionActive}
            renderQuality={renderQuality}
            viewResetNonce={viewResetNonce}
            viewFocus={viewFocus}
            simulateAssetFailure={simulateAssetFailure}
            onAssetError={(message) => setAssetError({ title: UI_COPY.simulator.sceneLoadFailed, message })}
            containerStyle={{ width: "100%", height: "100%", border: "1px solid #d1d5db", borderRadius: 8, overflow: "hidden" }}
          />

          <div className="scene-overlay-controls-wrap">
            <SceneOverlayControls
              sceneId={scene.id}
              showFocusPlane={showFocusPlaneOverlay}
              showDofRegion={showDofOverlay}
              showLegends={showLegends}
              showOpticalGeometry={showOpticalGeometry}
              showScheimpflugConstruction={requestedScheimpflugConstruction}
              scheimpflugConstructionAvailable={scheimpflugConstruction.isValid}
              onToggleFocusPlane={() => setShowFocusPlaneOverlay((s) => !s)}
              onToggleDofRegion={() => setShowDofOverlay((s) => !s)}
              onToggleLegends={() => setShowLegends((s) => !s)}
              onToggleOpticalGeometry={() => setShowOpticalGeometry(!showOpticalGeometry)}
              onToggleScheimpflugConstruction={supportsScheimpflugConstruction ? () => setRequestedScheimpflugConstruction((state) => !state) : undefined}
            />
          </div>

          <button
            ref={expanded ? restoreTriggerRef : expandTriggerRef}
            type="button"
            aria-label={expanded ? "Restore 3D Scene" : "Expand 3D Scene"}
            title={expanded ? "Restore 3D Scene" : "Expand 3D Scene"}
            className="btn btn--icon btn--viewport-action"
            onClick={expanded ? onRequestRestore : onRequestExpand}
          >
            <span className="material-symbols-outlined" aria-hidden="true">
              {expanded ? "close_fullscreen" : "open_in_new"}
            </span>
          </button>
        </div>

        {supportsScheimpflugConstruction && requestedScheimpflugConstruction ? (
          <p className="scene-construction-note" data-testid="scheimpflug-construction-note">
            {scheimpflugConstruction.isValid
              ? "Film (blue), lens (slate), and sharp-focus (green) planes contain the violet Scheimpflug line. Open the Scheimpflug Section to view that line end-on."
              : scheimpflugConstruction.unavailableReason}
          </p>
        ) : null}
      </div>
    </section>
  );
};
