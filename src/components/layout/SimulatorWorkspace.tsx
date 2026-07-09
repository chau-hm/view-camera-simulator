import { useEffect, useMemo, useState } from "react";
import { evaluateTask } from "../../core/tasks/evaluateTask";
import { getTaskById } from "../../core/tasks/taskRegistry";
import { getAllScenes, getSceneById } from "../../scenes/definitions";
import { architectureRiseScene } from "../../scenes/definitions/architecture-rise";
import { useAppStore } from "../../state/appStore";
import { selectDerivedOpticsState } from "../../state/selectors";
import type { SimulatorMode } from "../../types/camera";
import type { RenderQualityProfile } from "../../types/ui";
import { UI_COPY } from "../../ui/copy";
import { ApertureControl } from "../controls/ApertureControl";
import { FocusControl } from "../controls/FocusControl";
import { MovementControls } from "../controls/MovementControls";
import { ResetControls } from "../controls/ResetControls";
import { FeedbackPanel } from "../simulator/FeedbackPanel";
import { GeometryViewport } from "../simulator/GeometryViewport";
import { GroundGlassViewport } from "../simulator/GroundGlassViewport";
import { GroundGlassReadouts } from "../simulator/GroundGlassReadouts";
import { FocusFundamentalsDebugPanel } from "../simulator/FocusFundamentalsDebugPanel";
import { SceneViewport } from "../simulator/SceneViewport";
import { TaskPanel } from "../simulator/TaskPanel";
import { createGroundGlassDofPipeline } from "../../render/groundGlassPipeline";
import { getRenderQualitySettings } from "../../render/renderQuality";
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
  const [renderQuality, setRenderQuality] = useState<RenderQualityProfile>("standard");
  const [showGeometryPanel, setShowGeometryPanel] = useState(false);
  const allScenes = getAllScenes();
  const task = taskId ? getTaskById(taskId) ?? null : null;
  const reducedMotion = useMemo(
    () =>
      typeof window !== "undefined" && typeof window.matchMedia === "function"
        ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
        : false,
    [],
  );

  useEffect(() => {
    setMode(mode);
    setActiveScene(sceneId);
    setActiveTask(taskId);
  }, [mode, sceneId, setActiveScene, setActiveTask, setMode, taskId]);

  const scene = getSceneById(camera.activeSceneId);
  const safeScene = scene ?? architectureRiseScene;

  const opticsState = selectDerivedOpticsState(camera);
  const lockReason = UI_COPY.controls.guidedControlLockedReason;
  const [rawRttDebug, setRawRttDebug] = useState(false);
  const enabledControls = useMemo(() => {
    const focusFundamentals = camera.activeSceneId === "focus-fundamentals-two-targets";
    if (focusFundamentals) {
      return new Set(["focusDistance", "aperture", "geometryView", "focusAssist", "grid", "groundGlassAssist"]);
    }

    if (mode === "free" || !task) {
      return new Set(["rise", "tilt", "swing", "focusDistance", "aperture", "geometryView", "focusAssist", "grid", "groundGlassAssist"]);
    }
    return new Set([...task.enabledControls]);
  }, [mode, task, camera.activeSceneId]);

  const evaluation = useMemo(() => (task ? evaluateTask(task, safeScene, camera, opticsState) : null), [camera, opticsState, safeScene, task]);
  useEffect(() => {
    setCurrentTaskEvaluation(evaluation);
  }, [evaluation, setCurrentTaskEvaluation]);

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
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 8, background: 'linear-gradient(135deg, #eef2ff, #e6f0ff)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: 'var(--primary)' }}>CV</div>
          <div>
            <div className="title">Simulator Workspace</div>
            <div className="subtitle">View Camera Focus & Movements Trainer</div>
          </div>
        </div>

        {mode === "free" && (
          <section aria-label={UI_COPY.simulator.scenePickerLabel} style={{ marginLeft: "auto", display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ color: 'var(--text-muted)' }}>Scene</label>
            <select aria-label="Scene" value={camera.activeSceneId} onChange={(event) => setActiveScene(event.target.value)}>
              {allScenes.map((registeredScene) => (
                <option key={registeredScene.id} value={registeredScene.id}>
                  {registeredScene.name}
                </option>
              ))}
            </select>
          </section>
        )}
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
                <h2>3D Scene</h2>
              </div>
              <div className="simulator-control-strip">
                {/* SceneViewport includes its own controls; keep it as-is inside card */}
              </div>

              <SceneViewport
                scene={safeScene}
                opticsState={opticsState}
                renderQuality={renderQuality}
                setRenderQuality={setRenderQuality}
                simulateAssetFailure={simulateAssetFailure}
                onToggleGeometryPanel={() => setShowGeometryPanel((s) => !s)}
              />
            </div>

            <div className="simulator-card" aria-label="GroundGlassColumn">
              <div className="simulator-card-header">
                <h2>Ground Glass</h2>
              </div>

              <GroundGlassViewport
                opticsState={opticsState}
                orientationAssistEnabled={mode === "free"}
                focusAssistEnabled={camera.focusAssistEnabled}
                gridEnabled={camera.gridEnabled}
                canToggleFocusAssist={enabledControls.has("focusAssist")}
                canToggleGrid={enabledControls.has("grid")}
                canToggleGroundGlassAssist={enabledControls.has("groundGlassAssist")}
                riseMm={camera.frontRiseMm}
                tiltDeg={camera.frontTiltDeg}
                swingDeg={camera.frontSwingDeg}
                focusDistanceMm={camera.focusDistanceMm}
                aperture={camera.aperture}
                renderQuality={renderQuality}
                sceneId={camera.activeSceneId}
                lockReason={lockReason}
                rawRttDebug={rawRttDebug}
              />
            </div>
          </div>
        </main>

        {/* Right aside: independent scroll */}
        <aside className="simulator-aside">
          <section aria-label="Camera Controls">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>Camera Controls</h3>
              <button className="btn" type="button" onClick={() => useAppStore.getState().setInfinityFocus()}>Infinity Reset</button>
            </div>

            <div style={{ display: "grid", gap: "0.75rem", marginTop: 12 }}>
              <MovementControls riseEnabled={enabledControls.has("rise")} tiltEnabled={enabledControls.has("tilt")} swingEnabled={enabledControls.has("swing")} lockReason={lockReason} />

              <FocusControl focusEnabled={enabledControls.has("focusDistance")} lockReason={lockReason} />

              <ApertureControl apertureEnabled={enabledControls.has("aperture")} lockReason={lockReason} />

              <ResetControls />
            </div>

          </section>

          <section aria-label="Developer Tools" style={{ marginTop: "1rem", padding: 8 }}>
            <h3 style={{ margin: 0 }}>Developer Tools</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: 8 }}>
              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <input type="checkbox" checked={rawRttDebug} onChange={(e) => setRawRttDebug(e.target.checked)} />
                RTT Debug: Raw ON/OFF
              </label>

              <div style={{ fontSize: 12, color: '#6b7280' }}>2D Geometry: use the Scene controls</div>
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
            <button type="button" onClick={() => setShowGeometryPanel(false)} aria-label="Close 2D Geometry">
              Close
            </button>
          </div>

          <GeometryViewport opticsState={opticsState} geometryView={camera.geometryView} scene={scene} />
        </div>
      )}

      {/* Footer as normal grid row */}
      <footer
        style={{
          minHeight: 0,
          maxHeight: "32dvh",
          overflowY: "auto",
          overflowX: "hidden",
          borderTop: "1px solid rgba(0,0,0,0.06)",
          padding: "0.75rem 1rem",
          boxSizing: "border-box",
          background: "var(--panel-bg, #fff)",
        }}
      >
        <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
          <GroundGlassReadouts
            riseMm={camera.frontRiseMm}
            tiltDeg={camera.frontTiltDeg}
            swingDeg={camera.frontSwingDeg}
            focusDistanceMm={camera.focusDistanceMm}
            aperture={camera.aperture}
            renderQuality={renderQuality}
            pipeline={createGroundGlassDofPipeline(opticsState, 500, 400, renderQuality)}
            qualitySettings={getRenderQualitySettings(renderQuality)}
            lastFiniteFocusDepthMm={camera.lastFiniteFocusDepthMm}
            focusTargets={createFocusAssistPass({ enabled: camera.focusAssistEnabled, targets: opticsState.focusTargets }).targets}
          />

          {camera.activeSceneId === "focus-fundamentals-two-targets" && (
            <FocusFundamentalsDebugPanel sceneId={camera.activeSceneId} opticsState={opticsState} focusDistanceMm={camera.focusDistanceMm} aperture={camera.aperture as number} />
          )}
        </div>

        <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "1fr 1fr", marginTop: "0.75rem" }}>
          <TaskPanel task={task} />
          <FeedbackPanel evaluation={evaluation} />
        </div>
      </footer>
    </div>
  );
};
