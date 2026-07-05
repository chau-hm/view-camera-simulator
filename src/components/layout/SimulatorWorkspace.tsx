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

  return (
    <div style={{ display: "grid", gap: "1rem" }} data-reduced-motion={reducedMotion ? "true" : "false"}>
      {mode === "free" && (
        <section aria-label={UI_COPY.simulator.scenePickerLabel}>
          <label>
            {UI_COPY.simulator.scenePickerLabel}
            <select value={camera.activeSceneId} onChange={(event) => setActiveScene(event.target.value)}>
              {allScenes.map((registeredScene) => (
                <option key={registeredScene.id} value={registeredScene.id}>
                  {registeredScene.name}
                </option>
              ))}
            </select>
          </label>
        </section>
      )}
      {opticsState.diagnostics.fallbackApplied && (
        <p role="alert">
          {UI_COPY.simulator.opticsFallbackPrefix}: {opticsState.diagnostics.errorMessage}
        </p>
      )}
      <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
        <SceneViewport
          scene={safeScene}
          opticsState={opticsState}
          renderQuality={renderQuality}
          setRenderQuality={setRenderQuality}
          simulateAssetFailure={simulateAssetFailure}
        />

        {/* GroundGlassColumn: GroundGlassViewport + Readouts + FocusFundamentalsDebugPanel as siblings */}
        <div style={{ display: 'grid', gap: '0.75rem' }} aria-label="GroundGlassColumn">
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

          {/* Compute pipeline and derived settings for readouts at workspace level to avoid making readouts descendants of the viewport */}
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

        <GeometryViewport opticsState={opticsState} geometryView={camera.geometryView} scene={scene} />
      </div>
      <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        <MovementControls
          riseEnabled={enabledControls.has("rise")}
          tiltEnabled={enabledControls.has("tilt")}
          swingEnabled={enabledControls.has("swing")}
          lockReason={lockReason}
        />
        <FocusControl focusEnabled={enabledControls.has("focusDistance")} lockReason={lockReason} />
        <ApertureControl apertureEnabled={enabledControls.has("aperture")} lockReason={lockReason} />
        <ResetControls />
        <section aria-label="Developer Tools">
          <h3>Developer Tools</h3>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input
              type="checkbox"
              checked={rawRttDebug}
              onChange={(e) => setRawRttDebug(e.target.checked)}
            />
            RTT Debug: Raw ON/OFF
          </label>
        </section>
      </div>
      <TaskPanel task={task} />
      <FeedbackPanel evaluation={evaluation} />
    </div>
  );
};
