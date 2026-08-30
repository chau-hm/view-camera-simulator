import { useEffect, useMemo, useRef, useState, type Dispatch, type Ref, type SetStateAction } from "react";
import { useTranslation } from "react-i18next";
import { SceneRenderer } from "../../render/SceneRenderer";
import type { ConceptualCameraPresentation } from "../../render/ConceptualViewCamera";
import { SceneOverlayControls } from "./SceneOverlayControls";
import { isWebGLAvailable } from "../../utils/webgl";
import type { UiErrorState } from "../../types/ui";
import type { SceneDefinition } from "../../types/scene";
import type { DerivedOpticsState } from "../../types/optics";
import type { RenderQualityProfile } from "../../types/ui";
import "../../i18n";
import { simulatorMessageKeys } from "../../i18n/simulatorMessageKeys";
import { deriveScheimpflugConstruction } from "../../core/optics/scheimpflugConstruction";
import { supportsScheimpflugConstruction as sceneSupportsScheimpflugConstruction } from "../../render/scheimpflugSceneSupport";
import {
  resolveSceneViewportFraming,
  resolveCameraInspectionTargetWorld,
  type CameraInspectionTarget,
  type SceneViewFocus,
} from "../../render/sceneViewFraming";
import { useAppStore } from "../../state/appStore";

type SceneViewportProps = {
  scene: SceneDefinition;
  opticsState: DerivedOpticsState;
  renderQuality: RenderQualityProfile;
  setRenderQuality: Dispatch<SetStateAction<RenderQualityProfile>>;
  requestedScheimpflugConstruction: boolean;
  onToggleScheimpflugConstruction: () => void;
  simulateAssetFailure: boolean;
  expanded: boolean;
  restoreFocusOnCollapse: boolean;
  onRequestExpand: () => void;
  onRequestRestore: () => void;
  onToggleGeometryPanel?: (trigger: HTMLButtonElement) => void;
  geometryTriggerRef?: Ref<HTMLButtonElement>;
  showHeader?: boolean;
  overlayMenuResetGeneration: number;
  cameraPresentation?: ConceptualCameraPresentation;
  cameraInspectionTarget?: CameraInspectionTarget;
  initialViewFocus?: SceneViewFocus;
  suppressOpticalOverlays?: boolean;
  viewResetKey?: string | number;
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
  requestedScheimpflugConstruction,
  onToggleScheimpflugConstruction,
  simulateAssetFailure,
  expanded,
  restoreFocusOnCollapse,
  onRequestExpand,
  onRequestRestore,
  onToggleGeometryPanel,
  geometryTriggerRef,
  showHeader,
  overlayMenuResetGeneration,
  cameraPresentation,
  cameraInspectionTarget,
  initialViewFocus = "scene",
  suppressOpticalOverlays = false,
  viewResetKey,
}: SceneViewportProps) => {
  const { t } = useTranslation();
  const [attempt, setAttempt] = useState(0);
  const [assetError, setAssetError] = useState<UiErrorState | null>(null);
  const [showFocusPlaneOverlay, setShowFocusPlaneOverlay] = useState(true);
  const [showDofOverlay, setShowDofOverlay] = useState(true);
  const [showLegends, setShowLegends] = useState(false);
  const showOpticalGeometry = useAppStore((state) => state.ui.showOpticalGeometry);
  const setShowOpticalGeometry = useAppStore((state) => state.setShowOpticalGeometry);
  const activeFocalLengthMm = useAppStore((state) => state.camera.focalLengthMm);
  const [viewResetNonce, setViewResetNonce] = useState(0);
  const [viewFocusState, setViewFocusState] = useState<{
    sceneId: string;
    focus: SceneViewFocus;
  }>({ sceneId: scene.id, focus: initialViewFocus });
  const expandTriggerRef = useRef<HTMLButtonElement | null>(null);
  const restoreTriggerRef = useRef<HTMLButtonElement | null>(null);
  const previouslyExpandedRef = useRef(expanded);
  const viewFocus = viewFocusState.sceneId === scene.id ? viewFocusState.focus : "scene";
  const observerViews = useMemo(
    () =>
      resolveSceneViewportFraming({
        scene,
        focalLengthMm: activeFocalLengthMm,
        cameraRigTransform: opticsState.cameraRigTransform,
        cameraInspectionTargetWorld: cameraInspectionTarget
          ? resolveCameraInspectionTargetWorld(cameraInspectionTarget, opticsState)
          : undefined,
      }),
    [activeFocalLengthMm, cameraInspectionTarget, opticsState, scene],
  );
  const webglAvailable = useMemo(() => isWebGLAvailable(), []);
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
  const constructionUnavailableReason = (() => {
    switch (scheimpflugConstruction.unavailableReason) {
      case "Film and lens planes are parallel.":
        return t(simulatorMessageKeys.viewport.scheimpflugReasonParallel);
      case "A finite plane of sharp focus is unavailable.":
        return t(simulatorMessageKeys.viewport.scheimpflugReasonNoFocus);
      case "The plane intersection produced non-finite geometry.":
        return t(simulatorMessageKeys.viewport.scheimpflugReasonNonFiniteIntersection);
      case "The construction residuals are non-finite.":
        return t(simulatorMessageKeys.viewport.scheimpflugReasonNonFiniteResidual);
      case "The focus plane does not contain the film/lens intersection line.":
        return t(simulatorMessageKeys.viewport.scheimpflugReasonInvalidFocusPlane);
      default:
        return scheimpflugConstruction.unavailableReason;
    }
  })();

  useEffect(() => {
    setViewFocusState({ sceneId: scene.id, focus: initialViewFocus });
  }, [initialViewFocus, scene.id]);

  useEffect(() => {
    if (viewResetKey === undefined) return;
    setViewResetNonce((value) => value + 1);
  }, [viewResetKey]);

  useEffect(() => {
    const wasExpanded = previouslyExpandedRef.current;
    previouslyExpandedRef.current = expanded;
    if (!expanded && !wasExpanded) return;

    const frame = window.requestAnimationFrame(() => {
      if (expanded) {
        restoreTriggerRef.current?.focus();
      } else if (restoreFocusOnCollapse) {
        expandTriggerRef.current?.focus();
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [expanded, restoreFocusOnCollapse]);

  if (!webglAvailable) {
    return (
      <section>
        <h2>{t(simulatorMessageKeys.viewport.sceneTitle)}</h2>
        <p>{t(simulatorMessageKeys.viewport.webglUnavailable)}</p>
      </section>
    );
  }

  if (assetError) {
    return (
      <section>
        <h2>{t(simulatorMessageKeys.viewport.sceneTitle)}</h2>
        <p>{assetError.message}</p>
        <button
          type="button"
          onClick={() => {
            setAssetError(null);
            setAttempt((value) => value + 1);
          }}
        >
          {t(simulatorMessageKeys.viewport.retryLoadScene)}
        </button>
      </section>
    );
  }

  return (
    <section className={`scene-panel${expanded ? " simulator-viewport-panel--expanded scene-panel--expanded" : ""}`}>
      {showHeader !== false && <h2>{t(simulatorMessageKeys.viewport.sceneTitle)}</h2>}

      <div className="scene-panel__controls">
        {/* Toolbar: left actions and right quality control */}
        <div className="scene-toolbar">
          <div className="scene-toolbar__actions">
            <button type="button" className="btn" onClick={() => setViewResetNonce((value) => value + 1)}>
              {t(simulatorMessageKeys.viewport.sceneViewReset)}
            </button>
            <fieldset className="scene-view-focus" aria-label={t(simulatorMessageKeys.viewport.sceneViewFocusLabel)}>
              <legend>{t(simulatorMessageKeys.viewport.sceneViewFocusLabel)}</legend>
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
                      ? t(simulatorMessageKeys.viewport.sceneViewFocusScene)
                      : t(simulatorMessageKeys.viewport.sceneViewFocusCamera)}
                  </button>
                ))}
              </div>
            </fieldset>
            {!suppressOpticalOverlays && onToggleGeometryPanel && (
              <button
                ref={geometryTriggerRef}
                type="button"
                onClick={(event) => onToggleGeometryPanel(event.currentTarget)}
                aria-label={t(simulatorMessageKeys.viewport.expandGeometry)}
                title={t(simulatorMessageKeys.viewport.expandGeometry)}
                data-viewport-expanded="false"
                className="btn btn--secondary scene-toolbar__geometry-action"
              >
                <span>{t(simulatorMessageKeys.viewport.geometryTitle)}</span>
                <span className="material-symbols-outlined" aria-hidden="true">
                  open_in_new
                </span>
              </button>
            )}
          </div>

          <label className="scene-toolbar__quality">
            <span>{t(simulatorMessageKeys.viewport.renderQualityLabel)}</span>
            <select className="form-select" value={renderQuality} onChange={(event) => setRenderQuality(parseRenderQuality(event.target.value))}>
              <option value="high">{t(simulatorMessageKeys.viewport.renderQualityHigh)}</option>
              <option value="standard">{t(simulatorMessageKeys.viewport.renderQualityStandard)}</option>
              <option value="low">{t(simulatorMessageKeys.viewport.renderQualityLow)}</option>
            </select>
          </label>
        </div>
      </div>
      <div className={`scene-viewport-shell${expanded ? " scene-viewport-shell--expanded" : ""}`}>
        <div className={`scene-viewport-host${expanded ? " scene-viewport-host--expanded" : ""}`}>
          <SceneRenderer
            scene={scene}
            opticsState={opticsState}
            attempt={attempt}
            showFocusPlaneOverlay={suppressOpticalOverlays ? false : showFocusPlaneOverlay}
            showDofOverlay={suppressOpticalOverlays ? false : showDofOverlay}
            showLegends={suppressOpticalOverlays ? false : showLegends}
            showOpticalGeometry={suppressOpticalOverlays ? false : showOpticalGeometry}
            showScheimpflugConstruction={suppressOpticalOverlays ? false : constructionActive}
            cameraPresentation={cameraPresentation}
            renderQuality={renderQuality}
            viewResetNonce={viewResetNonce}
            viewFocus={viewFocus}
            observerViews={observerViews}
            simulateAssetFailure={simulateAssetFailure}
            onAssetError={(message) => setAssetError({ title: t(simulatorMessageKeys.viewport.sceneLoadFailed), message })}
            containerStyle={{ width: "100%", height: "100%", border: "1px solid #d1d5db", borderRadius: 8, overflow: "hidden" }}
          />

          {!suppressOpticalOverlays ? <div className="scene-overlay-controls-wrap">
            <SceneOverlayControls
              resetGeneration={overlayMenuResetGeneration}
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
              onToggleScheimpflugConstruction={supportsScheimpflugConstruction ? onToggleScheimpflugConstruction : undefined}
            />
          </div> : null}

          <button
            ref={expanded ? restoreTriggerRef : expandTriggerRef}
            type="button"
            aria-label={expanded ? t(simulatorMessageKeys.viewport.restoreScene) : t(simulatorMessageKeys.viewport.expandScene)}
            title={expanded ? t(simulatorMessageKeys.viewport.restoreScene) : t(simulatorMessageKeys.viewport.expandScene)}
            data-viewport-expanded={expanded ? "true" : "false"}
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
              ? t(simulatorMessageKeys.viewport.scheimpflugConstructionNote)
              : constructionUnavailableReason}
          </p>
        ) : null}
      </div>
    </section>
  );
};
