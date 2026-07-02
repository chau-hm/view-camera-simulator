import { create } from "zustand";
import { getTaskById } from "../core/tasks/taskRegistry";
import { clamp } from "../core/math/clamps";
import { getSceneFocusDistanceRange } from "../scenes/definitions";
import type { ApertureValue, CameraState, GeometryView, SimulatorMode } from "../types/camera";
import type { TaskEvaluation } from "../types/task";
import { CAMERA_CONSTANTS, DEFAULT_CAMERA_STATE, isApertureValue } from "../utils/constants";

const defaultControlState = {
  frontRiseMm: DEFAULT_CAMERA_STATE.frontRiseMm,
  frontTiltDeg: DEFAULT_CAMERA_STATE.frontTiltDeg,
  frontSwingDeg: DEFAULT_CAMERA_STATE.frontSwingDeg,
  focusDistanceMm: DEFAULT_CAMERA_STATE.focusDistanceMm,
  aperture: DEFAULT_CAMERA_STATE.aperture,
};

const clampFocusDistanceForScene = (sceneId: string, value: number) => {
  const range = getSceneFocusDistanceRange(sceneId);
  return clamp(value, range.min, range.max);
};

type SceneRuntimeState = {
  activeSceneId: string;
};

type TaskRuntimeState = {
  activeTaskId: string | null;
  currentTaskEvaluation: TaskEvaluation | null;
};

type UIState = {
  mode: SimulatorMode;
  geometryView: GeometryView;
  groundGlassAssistEnabled: boolean;
  focusAssistEnabled: boolean;
  gridEnabled: boolean;
};

export type AppStore = {
  camera: CameraState;
  scene: SceneRuntimeState;
  task: TaskRuntimeState;
  ui: UIState;
  setCurrentTaskEvaluation: (evaluation: TaskEvaluation | null) => void;
  setMode: (mode: SimulatorMode) => void;
  setActiveScene: (sceneId: string) => void;
  setActiveTask: (taskId: string | null) => void;
  setRise: (value: number) => void;
  setTilt: (value: number) => void;
  setSwing: (value: number) => void;
  setFocusDistance: (value: number) => void;
  setAperture: (value: ApertureValue) => void;
  setGeometryView: (value: GeometryView) => void;
  toggleGroundGlassAssist: () => void;
  toggleFocusAssist: () => void;
  toggleGrid: () => void;
  resetMovements: () => void;
  restartTask: () => void;
  resetCamera: () => void;
};

export const useAppStore = create<AppStore>((set) => ({
  camera: DEFAULT_CAMERA_STATE,
  scene: { activeSceneId: DEFAULT_CAMERA_STATE.activeSceneId },
  task: {
    activeTaskId: DEFAULT_CAMERA_STATE.activeTaskId,
    currentTaskEvaluation: null,
  },
  ui: {
    mode: DEFAULT_CAMERA_STATE.mode,
    geometryView: DEFAULT_CAMERA_STATE.geometryView,
    groundGlassAssistEnabled: DEFAULT_CAMERA_STATE.groundGlassAssistEnabled,
    focusAssistEnabled: DEFAULT_CAMERA_STATE.focusAssistEnabled,
    gridEnabled: DEFAULT_CAMERA_STATE.gridEnabled,
  },
  setCurrentTaskEvaluation: (evaluation) =>
    set((state) => ({
      task: { ...state.task, currentTaskEvaluation: evaluation },
    })),
  setMode: (mode) => set((state) => ({ camera: { ...state.camera, mode }, ui: { ...state.ui, mode } })),
  setActiveScene: (sceneId) =>
    set((state) => ({
      camera: {
        ...state.camera,
        activeSceneId: sceneId,
        focusDistanceMm: clampFocusDistanceForScene(sceneId, state.camera.focusDistanceMm),
      },
      scene: { ...state.scene, activeSceneId: sceneId },
      task: { ...state.task, currentTaskEvaluation: null },
    })),
  setActiveTask: (taskId) =>
    set((state) => ({
      camera: { ...state.camera, activeTaskId: taskId },
      task: { ...state.task, activeTaskId: taskId, currentTaskEvaluation: null },
    })),
  setRise: (value) =>
    set((state) => ({
      camera: {
        ...state.camera,
        frontRiseMm: clamp(value, CAMERA_CONSTANTS.riseMinMm, CAMERA_CONSTANTS.riseMaxMm),
      },
    })),
  setTilt: (value) =>
    set((state) => ({
      camera: {
        ...state.camera,
        frontTiltDeg: clamp(value, CAMERA_CONSTANTS.tiltMinDeg, CAMERA_CONSTANTS.tiltMaxDeg),
      },
    })),
  setSwing: (value) =>
    set((state) => ({
      camera: {
        ...state.camera,
        frontSwingDeg: clamp(value, CAMERA_CONSTANTS.swingMinDeg, CAMERA_CONSTANTS.swingMaxDeg),
      },
    })),
  setFocusDistance: (value) =>
    set((state) => ({
      camera: {
        ...state.camera,
        // Allow explicit Infinity for 'infinity reset' without clamping.
        focusDistanceMm: Number.isFinite(value)
          ? clampFocusDistanceForScene(state.camera.activeSceneId, value)
          : value,
      },
    })),

  setAperture: (value) =>
    set((state) => ({
      camera: {
        ...state.camera,
        aperture: isApertureValue(value) ? value : state.camera.aperture,
      },
    })),
  setGeometryView: (value) =>
    set((state) => ({ camera: { ...state.camera, geometryView: value }, ui: { ...state.ui, geometryView: value } })),
  toggleGroundGlassAssist: () =>
    set((state) => ({
      camera: {
        ...state.camera,
        groundGlassAssistEnabled: !state.camera.groundGlassAssistEnabled,
      },
      ui: {
        ...state.ui,
        groundGlassAssistEnabled: !state.ui.groundGlassAssistEnabled,
      },
    })),
  toggleFocusAssist: () =>
    set((state) => ({
      camera: {
        ...state.camera,
        focusAssistEnabled: !state.camera.focusAssistEnabled,
      },
      ui: {
        ...state.ui,
        focusAssistEnabled: !state.ui.focusAssistEnabled,
      },
    })),
  toggleGrid: () =>
    set((state) => ({
      camera: { ...state.camera, gridEnabled: !state.camera.gridEnabled },
      ui: { ...state.ui, gridEnabled: !state.ui.gridEnabled },
    })),
  resetMovements: () =>
    set((state) => ({
      camera: {
        ...state.camera,
        ...defaultControlState,
        focusDistanceMm: clampFocusDistanceForScene(
          state.camera.activeSceneId,
          defaultControlState.focusDistanceMm,
        ),
      },
      task: { ...state.task, currentTaskEvaluation: null },
    })),
  restartTask: () =>
    set((state) => {
      const activeTask = state.task.activeTaskId ? getTaskById(state.task.activeTaskId) : undefined;
      const nextSceneId = activeTask?.sceneId ?? state.scene.activeSceneId;
      const nextMode = activeTask?.mode ?? state.ui.mode;
      const nextControlState = activeTask?.initialCameraState ?? defaultControlState;
      const focusDistanceMm = clampFocusDistanceForScene(nextSceneId, nextControlState.focusDistanceMm);
      const nextGeometryView = activeTask?.initialCameraState?.geometryView ?? state.camera.geometryView;
      const nextGroundGlassAssistEnabled =
        activeTask?.initialCameraState?.groundGlassAssistEnabled ?? state.camera.groundGlassAssistEnabled;
      const nextFocusAssistEnabled =
        activeTask?.initialCameraState?.focusAssistEnabled ?? state.camera.focusAssistEnabled;
      const nextGridEnabled = activeTask?.initialCameraState?.gridEnabled ?? state.camera.gridEnabled;

      return {
        camera: {
          ...state.camera,
          activeSceneId: nextSceneId,
          mode: nextMode,
          ...nextControlState,
          geometryView: nextGeometryView,
          groundGlassAssistEnabled: nextGroundGlassAssistEnabled,
          focusAssistEnabled: nextFocusAssistEnabled,
          gridEnabled: nextGridEnabled,
          focusDistanceMm,
        },
        scene: { ...state.scene, activeSceneId: nextSceneId },
        task: { ...state.task, currentTaskEvaluation: null },
        ui: {
          ...state.ui,
          mode: nextMode,
          geometryView: nextGeometryView,
          groundGlassAssistEnabled: nextGroundGlassAssistEnabled,
          focusAssistEnabled: nextFocusAssistEnabled,
          gridEnabled: nextGridEnabled,
        },
      };
    }),
  resetCamera: () =>
    set({
      camera: DEFAULT_CAMERA_STATE,
      scene: { activeSceneId: DEFAULT_CAMERA_STATE.activeSceneId },
      task: {
        activeTaskId: DEFAULT_CAMERA_STATE.activeTaskId,
        currentTaskEvaluation: null,
      },
      ui: {
        mode: DEFAULT_CAMERA_STATE.mode,
        geometryView: DEFAULT_CAMERA_STATE.geometryView,
        groundGlassAssistEnabled: DEFAULT_CAMERA_STATE.groundGlassAssistEnabled,
        focusAssistEnabled: DEFAULT_CAMERA_STATE.focusAssistEnabled,
        gridEnabled: DEFAULT_CAMERA_STATE.gridEnabled,
      },
    }),
}));
