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
  // RTT debug flag — lifted to workspace so the debug control can be placed in the Scene controls area
  const [rawRttDebug, setRawRttDebug] = useState(false);
  const enabledControls = useMemo(() => {
    // For the Focus Fundamentals scene, lock movement controls to only focusDistance and aperture
    const focusFundamentals = camera.activeSceneId === "focus-fundamentals-two-targets";
    if (focusFundamentals) {
      return new Set(["focusDistance", "aperture", "geometryView", "focusAssist", "grid", "groundGlassAssist"]);
    }

    if (mode === "free" || !task) {
      return new Set(["rise", "tilt", "swing", "focusDistance", "aperture", "geometryView", "focusAssist", "grid", "groundGlassAssist"]);
    }
    return new Set([...task.enabledControls]);
  }, [mode, task, camera.activeSceneId]);
  const evaluation = useMemo(
    () => (task ? evaluateTask(task, safeScene, camera, opticsState) : null),
    [camera, opticsState, safeScene, task],
  );
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


  const HEADER_HEIGHT = 64; // px
  const FOOTER_HEIGHT = 64; // px
  const mainContentHeight = `calc(100vh - ${HEADER_HEIGHT}px - ${FOOTER_HEIGHT}px)`;

  return (
    <div
      style={{
        minHeight: '100vh',
      }}
      data-reduced-motion={reducedMotion ? 'true' : 'false'}
    >
      {/* Fixed header / navigation */}
      <header
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          height: `${HEADER_HEIGHT}px`,
          zIndex: 1000,
          background: 'var(--panel-bg, #fff)',
          borderBottom: '1px solid rgba(0,0,0,0.06)',
          padding: '0.5rem 1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
        }}
      >
        {/* Title is provided by AppShell; avoid duplicate page title here. */}
        <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Simulator workspace</h2>

        {mode === 'free' && (
          <section aria-label={UI_COPY.simulator.scenePickerLabel} style={{ marginLeft: 'auto' }}>
            <label>
              <span style={{ marginRight: '0.5rem' }}>Scene</span>
              <select aria-label="Scene" value={camera.activeSceneId} onChange={(event) => setActiveScene(event.target.value)}>
                {allScenes.map((registeredScene) => (
                  <option key={registeredScene.id} value={registeredScene.id}>
                    {registeredScene.name}
                  </option>
                ))}
              </select>
            </label>
          </section>
        )}
      </header>

      {/* Middle content: main + aside. header is fixed so set explicit height and offset for the content area so children can scroll independently. */}
      <main style={{ height: mainContentHeight, marginTop: `${HEADER_HEIGHT}px`, marginBottom: `${FOOTER_HEIGHT}px`, overflow: 'hidden' }}>
        {/* layout grid with two columns; each column has its own scroll and sits within the main content box */}
        <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: '1fr 320px', height: '100%' }}>
          {/* Main area (left) */}
          <div style={{ display: 'grid', gap: '1rem', height: '100%', overflow: 'auto', padding: '1rem', boxSizing: 'border-box' }}>
            {opticsState.diagnostics.fallbackApplied && (
              <p role="alert">
                {UI_COPY.simulator.opticsFallbackPrefix}: {opticsState.diagnostics.errorMessage}
              </p>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', height: '100%' }}>
              <div style={{ display: 'block' }}>
                <SceneViewport
                  scene={safeScene}
                  opticsState={opticsState}
                  renderQuality={renderQuality}
                  setRenderQuality={setRenderQuality}
                  simulateAssetFailure={simulateAssetFailure}
                />
              </div>

              <div style={{ display: 'grid', gap: '0.75rem' }} aria-label="GroundGlassColumn">
                <GroundGlassViewport
                  opticsState={opticsState}
                  orientationAssistEnabled={mode === 'free'}
                  focusAssistEnabled={camera.focusAssistEnabled}
                  gridEnabled={camera.gridEnabled}
                  canToggleFocusAssist={enabledControls.has('focusAssist')}
                  canToggleGrid={enabledControls.has('grid')}
                  canToggleGroundGlassAssist={enabledControls.has('groundGlassAssist')}
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

                {/* GeometryViewport removed from main flow per request. Keep a hidden instance for tests and accessibility hooks. */}
                <div style={{ position: 'absolute', left: -9999, width: 1, height: 1, overflow: 'hidden' }} aria-hidden>
                  <GeometryViewport opticsState={opticsState} geometryView={camera.geometryView} scene={scene} />
                </div>
              </div>
            </div>
          </div>

          {/* Right aside */}
          <aside style={{ display: 'grid', gap: '1rem', height: '100%', overflow: 'auto', padding: '1rem', borderLeft: '1px solid rgba(0,0,0,0.04)', background: 'var(--panel-bg, #fafafa)' }}>
            <section aria-label="Camera Controls">
              <h3>Camera Controls</h3>
              <div style={{ display: 'grid', gap: '0.5rem' }}>
                {/* Infinity Reset */}
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={() => {
                      useAppStore.getState().setInfinityFocus();
                    }}
                  >
                    Infinity Reset
                  </button>
                </div>

                {/* Movement controls */}
                <MovementControls
                  riseEnabled={enabledControls.has('rise')}
                  tiltEnabled={enabledControls.has('tilt')}
                  swingEnabled={enabledControls.has('swing')}
                  lockReason={lockReason}
                />

                {/* Focus control */}
                <FocusControl focusEnabled={enabledControls.has('focusDistance')} lockReason={lockReason} />

                {/* Aperture control */}
                <ApertureControl apertureEnabled={enabledControls.has('aperture')} lockReason={lockReason} />

                {/* Reset controls (scene/camera reset group) */}
                <ResetControls />
              </div>
            </section>

            <section aria-label="Developer Tools">
              <h3>Developer Tools</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input type="checkbox" checked={rawRttDebug} onChange={(e) => setRawRttDebug(e.target.checked)} />
                  RTT Debug: Raw ON/OFF
                </label>

                {/* Toggle button for floating 2D Geometry panel */}
                <button type="button" onClick={() => setShowGeometryPanel((s) => !s)}>
                  {showGeometryPanel ? 'Close 2D Geometry' : 'Open 2D Geometry'}
                </button>
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
              position: 'fixed',
              top: '72px',
              right: '24px',
              width: '420px',
              height: '68vh',
              background: 'var(--panel-bg, #fff)',
              boxShadow: '0 8px 24px rgba(0,0,0,0.16)',
              borderRadius: '8px',
              zIndex: 1200,
              overflow: 'auto',
              padding: '0.75rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <strong>2D Geometry</strong>
              <button type="button" onClick={() => setShowGeometryPanel(false)} aria-label="Close 2D Geometry">
                Close
              </button>
            </div>

            <GeometryViewport opticsState={opticsState} geometryView={camera.geometryView} scene={scene} />
          </div>
        )}
      </main>
      {/* Fixed footer */}
      <footer
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 1000,
          background: 'var(--panel-bg, #fff)',
          borderTop: '1px solid rgba(0,0,0,0.06)',
          padding: '0.75rem 1rem',
        }}
      >
        <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
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

          {camera.activeSceneId === 'focus-fundamentals-two-targets' && (
            <FocusFundamentalsDebugPanel sceneId={camera.activeSceneId} opticsState={opticsState} focusDistanceMm={camera.focusDistanceMm} aperture={camera.aperture as number} />
          )}
        </div>

        <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: '1fr 1fr', marginTop: '0.75rem' }}>
          <TaskPanel task={task} />
          <FeedbackPanel evaluation={evaluation} />
        </div>
      </footer>
    </div>
  );
};
