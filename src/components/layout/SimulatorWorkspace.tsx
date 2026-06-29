import { useEffect, useMemo } from "react";
import { evaluateTask } from "../../core/tasks/evaluateTask";
import { getTaskById } from "../../core/tasks/taskRegistry";
import { getSceneById } from "../../scenes/definitions";
import { architectureRiseScene } from "../../scenes/definitions/architecture-rise";
import { useAppStore } from "../../state/appStore";
import { selectDerivedOpticsState } from "../../state/selectors";
import type { SimulatorMode } from "../../types/camera";
import { UI_COPY } from "../../ui/copy";
import { ApertureControl } from "../controls/ApertureControl";
import { FocusControl } from "../controls/FocusControl";
import { MovementControls } from "../controls/MovementControls";
import { ResetControls } from "../controls/ResetControls";
import { ViewOptions } from "../controls/ViewOptions";
import { FeedbackPanel } from "../simulator/FeedbackPanel";
import { GeometryViewport } from "../simulator/GeometryViewport";
import { GroundGlassViewport } from "../simulator/GroundGlassViewport";
import { SceneViewport } from "../simulator/SceneViewport";
import { TaskPanel } from "../simulator/TaskPanel";

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

  useEffect(() => {
    if (camera.mode !== mode) {
      setMode(mode);
    }
    if (camera.activeSceneId !== sceneId) {
      setActiveScene(sceneId);
    }
    if (camera.activeTaskId !== taskId) {
      setActiveTask(taskId);
    }
  }, [camera.activeSceneId, camera.activeTaskId, camera.mode, mode, sceneId, setActiveScene, setActiveTask, setMode, taskId]);

  const scene = getSceneById(sceneId);
  const safeScene = scene ?? architectureRiseScene;

  const opticsState = selectDerivedOpticsState(camera);
  const task = taskId ? getTaskById(taskId) ?? null : null;
  const evaluation = useMemo(
    () => (task ? evaluateTask(task, safeScene, opticsState) : null),
    [opticsState, safeScene, task],
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
    <div style={{ display: "grid", gap: "1rem" }}>
      {opticsState.diagnostics.fallbackApplied && (
        <p role="alert">
          {UI_COPY.simulator.opticsFallbackPrefix}: {opticsState.diagnostics.errorMessage}
        </p>
      )}
      <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
        <SceneViewport scene={scene} simulateAssetFailure={simulateAssetFailure} />
        <GroundGlassViewport
          opticsState={opticsState}
          focusAssistEnabled={camera.focusAssistEnabled}
          gridEnabled={camera.gridEnabled}
        />
        <GeometryViewport opticsState={opticsState} />
      </div>
      <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        <MovementControls />
        <FocusControl />
        <ApertureControl />
        <ViewOptions />
        <ResetControls />
      </div>
      <TaskPanel task={task} />
      <FeedbackPanel evaluation={evaluation} />
    </div>
  );
};
