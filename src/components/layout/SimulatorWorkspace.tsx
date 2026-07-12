import { useEffect, useMemo, useState } from "react";
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
  const [showGeometryPanel, setShowGeometryPanel] = useState(false);
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

  const focusAssistTargets = useMemo(
    () =>
      createFocusAssistPass({
        enabled: camera.focusAssistEnabled,
        targets: opticsState.focusTargets,
      }).targets,
    [camera.focusAssistEnabled, opticsState.focusTargets],
  );

  const setInfinityFocus = useAppStore((state) => state.setInfinityFocus);

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
      <div role="region" aria-label="Simulator body" className="simulator-body">
        {/* Main area: single scroll container for 3D Scene + Ground Glass */}
        <main className="simulator-main">
          {opticsState.diagnostics.fallbackApplied && (
            <p role="alert">{UI_COPY.simulator.opticsFallbackPrefix}: {opticsState.diagnostics.errorMessage}</p>
          )}

          <div className="simulator-viewport-grid">
            <div className="simulator-card">
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
                onToggleGeometryPanel={() => setShowGeometryPanel((s) => !s)}
                showHeader={false}
              />
            </div>

            <div className="simulator-card" aria-label="GroundGlassColumn">
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
                showHeader={false}
              />
            </div>
          </div>

          {/* Info grid: current settings, focus targets, debug */}
          <div className="simulator-info-grid">
              <CurrentSettingsReadout
                riseMm={camera.frontRiseMm}
                tiltDeg={camera.frontTiltDeg}
                swingDeg={camera.frontSwingDeg}
                focusDistanceMm={camera.focusDistanceMm}
                aperture={camera.aperture as number}
                renderQuality={renderQuality}
              />

              <FocusTargetsReadout focusTargets={focusAssistTargets} />

              <div className="simulator-info-card" aria-label="Optical Debug">
                <h4>Optical Debug</h4>
                <div style={{ paddingTop: 8 }}>
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
              </div>
          </div>

          <div className="simulator-task-feedback-grid">
            <div className="simulator-info-card simulator-info-card--task">
              <h4>Task</h4>
              <TaskPanel task={task} sceneId={safeScene.id} showTitle={false} />
            </div>
            <div className="simulator-info-card simulator-info-card--feedback">
              <h4>Feedback</h4>
              <FeedbackPanel mode={mode} task={task} evaluation={evaluation} showTitle={false} />
            </div>
          </div>

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
        <div
          role="dialog"
          aria-label="2D Geometry Panel"
          style={{
            position: "fixed",
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
            width: "70vw",
            height: "70vh",
            maxWidth: "90vw",
            maxHeight: "90vh",
            minWidth: "420px",
            minHeight: "320px",
            background: "var(--panel-bg, #fff)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.16)",
            borderRadius: "8px",
            zIndex: 1200,
            overflow: "auto",
            padding: "0.75rem",
            resize: 'both',
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
            <strong>2D Geometry</strong>
            <button className="btn btn--compact" type="button" onClick={() => setShowGeometryPanel(false)} aria-label="Close 2D Geometry">
              Close
            </button>
          </div>

          <GeometryViewport opticsState={opticsState} geometryView={camera.geometryView} scene={scene} riseMm={camera.frontRiseMm} />
        </div>
      )}

    </div>
  );
};
