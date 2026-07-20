import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { evaluateTask } from "../../core/tasks/evaluateTask";
import { getTaskById } from "../../core/tasks/taskRegistry";
import { getSceneById } from "../../scenes/definitions";
import { architectureRiseScene } from "../../scenes/definitions/architecture-rise";
import { useAppStore } from "../../state/appStore";
import { selectDerivedOpticsState } from "../../state/selectors";
import type { SimulatorMode } from "../../types/camera";
import type { RenderQualityProfile } from "../../types/ui";
import { UI_COPY } from "../../ui/copy";
import { AppBrand } from "./AppBrand";
import { Link } from "react-router-dom";
import { ApertureControl } from "../controls/ApertureControl";
import { FocusControl } from "../controls/FocusControl";
import { MovementControls } from "../controls/MovementControls";
import { ResetControls } from "../controls/ResetControls";
import { FeedbackPanel } from "../simulator/FeedbackPanel";
import { GeometryViewport } from "../simulator/GeometryViewport";
import { GroundGlassViewport } from "../simulator/GroundGlassViewport";
import { CurrentSettingsReadout, FocusTargetsReadout } from "../simulator/GroundGlassReadouts";
import { OpticalDebugPanel } from "../simulator/OpticalDebugPanel";
import { SceneViewport } from "../simulator/SceneViewport";
import { TaskPanel } from "../simulator/TaskPanel";
import { createFocusAssistPass } from "../../render/postprocessing/FocusAssistPass";

type SimulatorWorkspaceProps = {
  mode: SimulatorMode;
  sceneId: string;
  taskId: string | null;
  simulateAssetFailure: boolean;
};

export type ExpandedViewport = "scene" | "groundGlass" | null;

export const SimulatorWorkspace = ({
  mode,
  sceneId,
  taskId,
  simulateAssetFailure,
}: SimulatorWorkspaceProps) => {
  const setMode = useAppStore((state) => state.setMode);
  const setActiveScene = useAppStore((state) => state.setActiveScene);
  const setActiveTask = useAppStore((state) => state.setActiveTask);
  const setCurrentTaskEvaluation = useAppStore((state) => state.setCurrentTaskEvaluation);
  const camera = useAppStore((state) => state.camera);
  const [renderQuality, setRenderQuality] = useState<RenderQualityProfile>("high");
  const [expandedViewport, setExpandedViewport] = useState<ExpandedViewport>(null);
  const [restoreViewportFocus, setRestoreViewportFocus] = useState(true);
  const [showGeometryPanel, setShowGeometryPanel] = useState(false);
  const [geometryDialogStyle, setGeometryDialogStyle] = useState<CSSProperties | undefined>();
  const geometryTriggerRef = useRef<HTMLButtonElement | null>(null);
  const geometryCloseRef = useRef<HTMLButtonElement | null>(null);
  // All registered scenes still available through engine registry
  // const allScenes = getAllScenes();
  const task = taskId ? getTaskById(taskId) ?? null : null;
  const reducedMotion = useMemo(
    () =>
      typeof window !== "undefined" && typeof window.matchMedia === "function"
        ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
        : false,
    [],
  );

  useEffect(() => {
    // initialize route: apply scene presets (free) or task initialCameraState (guided) once when route changes
    const initRoute = (modeParam: SimulatorMode, sceneParam: string, taskParam: string | null | undefined) => {
      const initializeSimulatorRoute = useAppStore.getState().initializeSimulatorRoute;
      if (initializeSimulatorRoute) {
        initializeSimulatorRoute({ mode: modeParam, sceneId: sceneParam, taskId: taskParam ?? null });
      } else {
        // fall back to individual setters if the initialize action isn't available
        setMode(modeParam);
        setActiveScene(sceneParam);
        setActiveTask(taskParam ?? null);
      }
    };

    initRoute(mode, sceneId, taskId);
  }, [mode, sceneId, setActiveScene, setActiveTask, setMode, taskId]);

  const closeGeometryPanel = useCallback((restoreFocus = true) => {
    setShowGeometryPanel(false);
    setGeometryDialogStyle(undefined);
    if (restoreFocus) {
      window.requestAnimationFrame(() => geometryTriggerRef.current?.focus());
    }
  }, []);

  useEffect(() => {
    if (!showGeometryPanel) return;

    geometryCloseRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeGeometryPanel();
        return;
      }
      if (event.key === "Tab") {
        const dialog = document.querySelector<HTMLElement>(".geometry-dialog");
        if (!dialog) return;
        const focusable = Array.from(
          dialog.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'),
        ).filter((element) => !element.hasAttribute("disabled") && element.getAttribute("aria-hidden") !== "true");
        if (focusable.length === 0) {
          event.preventDefault();
          dialog.focus();
          return;
        }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    const handleFocusIn = (event: FocusEvent) => {
      const dialog = document.querySelector<HTMLElement>(".geometry-dialog");
      if (dialog && event.target instanceof Node && !dialog.contains(event.target)) {
        event.preventDefault();
        geometryCloseRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("focusin", handleFocusIn);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("focusin", handleFocusIn);
    };
  }, [closeGeometryPanel, showGeometryPanel]);

  useEffect(() => {
    setShowGeometryPanel(false);
    setGeometryDialogStyle(undefined);
  }, [mode, sceneId, taskId]);

  useEffect(() => {
    setRestoreViewportFocus(false);
    const activeElement = document.activeElement;
    if (
      activeElement instanceof HTMLElement &&
      activeElement.matches('.btn--viewport-action[aria-label^="Restore "]')
    ) {
      activeElement.blur();
    }
    setExpandedViewport(null);
  }, [mode, sceneId, taskId]);

  const requestViewportExpansion = useCallback((viewport: Exclude<ExpandedViewport, null>) => {
    setRestoreViewportFocus(true);
    setExpandedViewport(viewport);
  }, []);

  const requestViewportRestore = useCallback(() => {
    setRestoreViewportFocus(true);
    setExpandedViewport(null);
  }, []);

  useEffect(() => {
    if (expandedViewport === null || showGeometryPanel) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented) {
        event.preventDefault();
        setRestoreViewportFocus(true);
        setExpandedViewport(null);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [expandedViewport, showGeometryPanel]);

  const scene = getSceneById(camera.activeSceneId);
  const safeScene = scene ?? architectureRiseScene;

  const opticsState = selectDerivedOpticsState(camera);
  const lockReason = UI_COPY.controls.guidedControlLockedReason;
  const [rawRttDebug, setRawRttDebug] = useState(false);

  // enabled controls currently depend only on mode, task metadata, and active scene.
  // Avoid depending on the entire camera object because movement/focus changes should not recompute this set.
  const enabledControls = useMemo(() => {
    const focusFundamentals = camera.activeSceneId === "focus-fundamentals-two-targets";
    if (focusFundamentals) {
    return new Set(["focusDistance", "aperture", "geometryView", "focusAssist", "grid"]);
    }

    if (mode === "free" || !task) {
    return new Set(["rise", "tilt", "swing", "focusDistance", "aperture", "geometryView", "focusAssist", "grid"]);
    }
    return new Set([...task.enabledControls]);
  }, [mode, task, camera.activeSceneId]);

  const evaluation = useMemo(() => (task ? evaluateTask(task, safeScene, camera, opticsState) : null), [camera, opticsState, safeScene, task]);
  useEffect(() => {
    setCurrentTaskEvaluation(evaluation);
  }, [evaluation, setCurrentTaskEvaluation]);

  // RTT runtime info
  const rttRuntimeInfo = useAppStore((s) => s.groundGlassRttRuntimeInfo);

  const tableTiltFocusMetric =
    safeScene.id === "table-tilt" && mode === "free" ? "point" : "patch";
  const focusAssistTargets = useMemo(
    () =>
      createFocusAssistPass({
        enabled: camera.focusAssistEnabled,
        targets: opticsState.focusTargets,
        metric: tableTiltFocusMetric,
      }).targets,
    [camera.focusAssistEnabled, opticsState.focusTargets, tableTiltFocusMetric],
  );
  const closestPointTargetId = useMemo(() => {
    if (safeScene.id !== "table-tilt" || mode !== "free") return undefined;
    return opticsState.focusTargets.reduce<string | undefined>((closestId, target) => {
      if (!closestId) return target.id;
      const closest = opticsState.focusTargets.find((candidate) => candidate.id === closestId);
      return (target.pointSharpness ?? target.sharpness) >
        (closest?.pointSharpness ?? closest?.sharpness ?? -1)
        ? target.id
        : closestId;
    }, undefined);
  }, [mode, opticsState.focusTargets, safeScene.id]);

  const setInfinityFocus = useAppStore((state) => state.setInfinityFocus);
  const sceneExpanded = expandedViewport === "scene";
  const groundGlassExpanded = expandedViewport === "groundGlass";
  const viewportExpanded = expandedViewport !== null;

  if (!scene) {
    return (
      <p>
        {UI_COPY.simulator.unknownScenePrefix}: {sceneId}
      </p>
    );
  }

  return (
    <div className="simulator-shell" data-reduced-motion={reducedMotion ? "true" : "false"}>
      {/* Header */}
      <header className="simulator-header">
        <AppBrand />

        <div className="sim-header-actions">
          <Link className="btn btn--ghost" to="/scenes">All Scenes</Link>
        </div>
      </header>

      {/* Body: main (scrollable) + aside (scrollable) */}
      <div role="region" aria-label="Simulator body" className={`simulator-body${showGeometryPanel ? " simulator-body--modal-open" : ""}`}>
        {/* Main area: single scroll container for 3D Scene + Ground Glass */}
        <main className={`simulator-main${viewportExpanded ? " simulator-main--viewport-expanded" : ""}`}>
          {!viewportExpanded && opticsState.diagnostics.fallbackApplied && (
            <p role="alert">{UI_COPY.simulator.opticsFallbackPrefix}: {opticsState.diagnostics.errorMessage}</p>
          )}

          <div className={`simulator-viewport-grid${viewportExpanded ? " simulator-viewport-grid--expanded" : ""}`}>
            {!groundGlassExpanded && <div className={`simulator-card${sceneExpanded ? " simulator-card--expanded" : ""}`}>
              <div className="simulator-card-header">
                <div className="panel-icon" aria-hidden="true">
                  <span className="material-symbols-outlined" aria-hidden="true">view_in_ar</span>
                </div>
                <h2 className="simulator-card-title">3D Scene</h2>
              </div>

              <SceneViewport
                scene={safeScene}
                opticsState={opticsState}
                renderQuality={renderQuality}
                setRenderQuality={setRenderQuality}
                simulateAssetFailure={simulateAssetFailure}
                expanded={sceneExpanded}
                restoreFocusOnCollapse={restoreViewportFocus}
                onRequestExpand={() => requestViewportExpansion("scene")}
                onRequestRestore={requestViewportRestore}
                onToggleGeometryPanel={(trigger) => {
                  geometryTriggerRef.current = trigger;
                  const viewportWidth = typeof window === "undefined" ? 1024 : window.innerWidth;
                  const viewportHeight = typeof window === "undefined" ? 768 : window.innerHeight;
                  const width = Math.max(Math.min(viewportWidth * 0.7, viewportWidth - 32), Math.min(420, viewportWidth - 32));
                  const height = Math.max(Math.min(viewportHeight * 0.7, viewportHeight - 32), Math.min(320, viewportHeight - 32));
                  setGeometryDialogStyle({
                    left: `${Math.max(16, (viewportWidth - width) / 2)}px`,
                    top: `${Math.max(16, (viewportHeight - height) / 2)}px`,
                    width: `${width}px`,
                    height: `${height}px`,
                    maxWidth: `${Math.max(0, viewportWidth - Math.max(16, (viewportWidth - width) / 2) - 16)}px`,
                    maxHeight: `${Math.max(0, viewportHeight - Math.max(16, (viewportHeight - height) / 2) - 16)}px`,
                  });
                  setShowGeometryPanel(true);
                }}
                showHeader={false}
              />
            </div>}

            {!sceneExpanded && <div className={`simulator-card${groundGlassExpanded ? " simulator-card--expanded" : ""}`} aria-label="GroundGlassColumn">
              <div className="simulator-card-header">
                <div className="panel-icon panel-icon--muted" aria-hidden="true">
                  <span className="material-symbols-outlined" aria-hidden="true">center_focus_strong</span>
                </div>
                <h2 className="simulator-card-title">Ground Glass</h2>
              </div>

              <GroundGlassViewport
                opticsState={opticsState}
                orientationAssistEnabled={mode === "free"}
                focusAssistEnabled={camera.focusAssistEnabled}
                gridEnabled={camera.gridEnabled}
                canToggleFocusAssist={enabledControls.has("focusAssist")}
                canToggleGrid={enabledControls.has("grid")}
                riseMm={camera.frontRiseMm}
                tiltDeg={camera.frontTiltDeg}
                swingDeg={camera.frontSwingDeg}
                focusDistanceMm={camera.focusDistanceMm}
                aperture={camera.aperture}
                renderQuality={renderQuality}
                sceneId={camera.activeSceneId}
                lockReason={lockReason}
                rawRttDebug={rawRttDebug}
                focusMetric={tableTiltFocusMetric}
                showHeader={false}
                interactionResetKey={`${mode}:${sceneId}:${taskId ?? "free"}`}
                expanded={groundGlassExpanded}
                restoreFocusOnCollapse={restoreViewportFocus}
                onRequestExpand={() => requestViewportExpansion("groundGlass")}
                onRequestRestore={requestViewportRestore}
              />
            </div>}
          </div>

          {!viewportExpanded && <>
            {/* Row 1: Current Settings | Focus Targets */}
            <div className="simulator-primary-info-grid">
            <CurrentSettingsReadout
              riseMm={camera.frontRiseMm}
              tiltDeg={camera.frontTiltDeg}
              swingDeg={camera.frontSwingDeg}
              focusDistanceMm={camera.focusDistanceMm}
              aperture={camera.aperture as number}
              renderQuality={renderQuality}
            />

            <FocusTargetsReadout
              focusTargets={focusAssistTargets}
              metricLabel={tableTiltFocusMetric === "point" ? "Point focus" : safeScene.id === "table-tilt" ? "Patch coverage" : "Focus"}
              closestTargetId={closestPointTargetId}
            />
            </div>

            {/* Row 2: Task | Feedback (each wrapped in a card shell provided by Workspace) */}
            <div className="simulator-task-feedback-grid">
            <div className="simulator-info-card simulator-info-card--task">
              <h4>Task</h4>
              <TaskPanel task={task} sceneId={safeScene.id} showTitle={false} />
            </div>
            <div className="simulator-info-card simulator-info-card--feedback">
              <h4>Feedback</h4>
              <FeedbackPanel mode={mode} sceneId={safeScene.id} task={task} evaluation={evaluation} showTitle={false} />
            </div>
            </div>

            {/* Row 3: Optical Debug, full width (component owns its single card shell) */}
            <div className="simulator-debug-row">
            <OpticalDebugPanel
              sceneId={camera.activeSceneId}
              mode={camera.mode}
              taskId={camera.activeTaskId}
              opticsState={opticsState}
              focalLengthMm={camera.focalLengthMm}
              focusDistanceMm={camera.focusDistanceMm}
              aperture={camera.aperture as number}
              renderQuality={renderQuality}
              rttRuntimeInfo={rttRuntimeInfo}
            />
            </div>
          </>}

        </main>

        {/* Right aside: independent scroll */}
        <aside className="simulator-aside">
          <section aria-label="Camera Controls">
            <div className="aside-header">
              <h3 style={{ margin: 0 }}>Camera Controls</h3>
              <button className="btn btn--secondary" type="button" onClick={setInfinityFocus}>Infinity Reset</button>
            </div>

            <div style={{ marginTop: 8 }}>
              <div className="sim-section">
                <div className="sim-section-label">Movement</div>
                <MovementControls riseEnabled={enabledControls.has("rise")} tiltEnabled={enabledControls.has("tilt")} swingEnabled={enabledControls.has("swing")} lockReason={lockReason} showTitle={false} />
              </div>

              <div className="sim-section">
                <div className="sim-section-label">Focus</div>
                <FocusControl focusEnabled={enabledControls.has("focusDistance")} lockReason={lockReason} showTitle={false} />
              </div>

              <div className="sim-section">
                <div className="sim-section-label">Aperture</div>
                <ApertureControl apertureEnabled={enabledControls.has("aperture")} lockReason={lockReason} showTitle={false} />
              </div>

              <div className="sim-section reset" style={{ paddingBottom: 0 }}>
                <div className="sim-section-label">Reset</div>
                <ResetControls showTitle={false} />
              </div>
            </div>

          </section>

          <section aria-label="Developer Tools" className="developer-tools">
            <h3 style={{ margin: 0 }}>Developer Tools</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: 8 }}>
              <label className="developer-tools__control">
                <input className="form-checkbox" type="checkbox" checked={rawRttDebug} onChange={(e) => setRawRttDebug(e.target.checked)} />
                Raw RTT — bypass DOF
              </label>
              {rawRttDebug ? (
                <div style={{ fontSize: 12, color: 'rgba(15,23,42,0.7)', marginTop: 6 }}>Depth-of-field and focus blur are disabled in Raw RTT mode.</div>
              ) : null}
            </div>
          </section>
        </aside>
      </div>

      {/* Floating 2D Geometry panel (fixed) */}
      {showGeometryPanel && (
        <div className="geometry-dialog__backdrop" aria-hidden="true" />
      )}
      {showGeometryPanel && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="geometry-dialog-title"
          className="geometry-dialog"
          style={geometryDialogStyle}
          tabIndex={-1}
        >
          <div className="geometry-dialog__header">
            <strong id="geometry-dialog-title">2D Geometry</strong>
            <button
              ref={geometryCloseRef}
              className="btn btn--compact"
              type="button"
              onClick={() => closeGeometryPanel()}
              aria-label="Close 2D Geometry"
            >
              Close
            </button>
          </div>

          <GeometryViewport opticsState={opticsState} geometryView={camera.geometryView} scene={scene} riseMm={camera.frontRiseMm} />
        </div>
      )}

    </div>
  );
};
