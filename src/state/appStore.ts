import { create } from "zustand";
import { getTaskById } from "../core/tasks/taskRegistry";
import { clamp } from "../core/math/clamps";
import { getSceneById, getSceneFocusDistanceRange } from "../scenes/definitions";
import type {
  ApertureValue,
  CameraState,
  GeometryView,
  SimulatorMode,
} from "../types/camera";
import type { CameraMovementField } from "../types/scene";
import type { TaskEvaluation } from "../types/task";
import {
  CAMERA_CONSTANTS,
  DEFAULT_CAMERA_STATE,
  isApertureValue,
} from "../utils/constants";
import {
  DEFAULT_SHOW_OPTICAL_GEOMETRY,
  resolveInitialOpticalGeometryVisibility,
} from "./sceneViewDefaults";

const defaultControlState = {
  frontRiseMm: DEFAULT_CAMERA_STATE.frontRiseMm,
  frontTiltDeg: DEFAULT_CAMERA_STATE.frontTiltDeg,
  frontSwingDeg: DEFAULT_CAMERA_STATE.frontSwingDeg,
  rearRiseMm: DEFAULT_CAMERA_STATE.rearRiseMm,
  rearTiltDeg: DEFAULT_CAMERA_STATE.rearTiltDeg,
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
  showOpticalGeometry: boolean;
};

import type { GroundGlassRttRuntimeInfo } from "../render/groundGlassRttDimensions";

export type AppStore = {
  camera: CameraState;
  scene: SceneRuntimeState;
  task: TaskRuntimeState;
  ui: UIState;
  /** The currently selected movement for single-active scenes. */
  selectedMovement: CameraMovementField | null;
  /** Route-based initialization key. */
  lastInitializedRouteKey?: string | null;
  /** Optional runtime diagnostics for RTT scenes. */
  groundGlassRttRuntimeInfo?: GroundGlassRttRuntimeInfo | null;

  setGroundGlassRttRuntimeInfo: (info: GroundGlassRttRuntimeInfo | null) => void;
  setCurrentTaskEvaluation: (evaluation: TaskEvaluation | null) => void;
  setMode: (mode: SimulatorMode) => void;
  setActiveScene: (sceneId: string) => void;
  setActiveTask: (taskId: string | null) => void;
  initializeSimulatorRoute: (init: {
    mode: SimulatorMode;
    sceneId: string;
    taskId?: string | null;
  }) => void;

  /** Set the currently active movement for single-active scenes. Zeros all four supported movements first. */
  setSelectedMovement: (movement: CameraMovementField) => void;

  setRise: (value: number) => void;
  setTilt: (value: number) => void;
  setSwing: (value: number) => void;
  setRearRise: (value: number) => void;
  setRearTilt: (value: number) => void;

  setFocusDistance: (value: number) => void;
  setInfinityFocus: () => void;
  setAperture: (value: ApertureValue) => void;
  setGeometryView: (value: GeometryView) => void;
  toggleGroundGlassAssist: () => void;
  setGroundGlassAssistEnabled: (enabled: boolean) => void;
  toggleFocusAssist: () => void;
  toggleGrid: () => void;
  setShowOpticalGeometry: (enabled: boolean) => void;
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
    showOpticalGeometry: DEFAULT_SHOW_OPTICAL_GEOMETRY,
  },
  selectedMovement: null,
  lastInitializedRouteKey: null,
  groundGlassRttRuntimeInfo: null,

  setGroundGlassRttRuntimeInfo: (info) =>
    set(() => ({ groundGlassRttRuntimeInfo: info })),

  setCurrentTaskEvaluation: (evaluation) =>
    set((state) => ({
      task: { ...state.task, currentTaskEvaluation: evaluation },
    })),

  setMode: (mode) =>
    set((state) => ({
      camera: { ...state.camera, mode },
      ui: { ...state.ui, mode },
    })),

  setActiveScene: (sceneId) =>
    set((state) => ({
      camera: {
        ...state.camera,
        activeSceneId: sceneId,
        focusDistanceMm: clampFocusDistanceForScene(
          sceneId,
          state.camera.focusDistanceMm,
        ),
      },
      scene: { ...state.scene, activeSceneId: sceneId },
      task: { ...state.task, currentTaskEvaluation: null },
      ui: { ...state.ui, showOpticalGeometry: DEFAULT_SHOW_OPTICAL_GEOMETRY },
    })),

  setActiveTask: (taskId) =>
    set((state) => ({
      camera: { ...state.camera, activeTaskId: taskId },
      task: {
        ...state.task,
        activeTaskId: taskId,
        currentTaskEvaluation: null,
      },
    })),

  initializeSimulatorRoute: (init) =>
    set((state) => {
      const { mode, sceneId, taskId } = init;
      const routeKey = `${mode}:${sceneId}:${taskId ?? ""}`;
      if (state.lastInitializedRouteKey === routeKey) {
        return {
          scene: { ...state.scene, activeSceneId: sceneId },
          task: { ...state.task, activeTaskId: taskId ?? null },
          ui: { ...state.ui, mode },
        };
      }

      let nextCamera: CameraState = { ...state.camera };
      const routeTask = taskId ? getTaskById(taskId) : undefined;

      try {
        const scene = getSceneById(sceneId);
        if (scene && !taskId) {
          const preset = scene.cameraPreset ?? {};
          nextCamera = { ...nextCamera, ...preset, activeSceneId: sceneId };
        } else {
          nextCamera.activeSceneId = sceneId;
        }
      } catch {
        nextCamera.activeSceneId = sceneId;
      }

      if (taskId) {
        try {
          const task = routeTask;
          if (task && task.initialCameraState) {
            nextCamera = {
              ...nextCamera,
              ...task.initialCameraState,
              activeTaskId: taskId,
            };
          } else {
            nextCamera.activeTaskId = taskId;
          }
        } catch {
          nextCamera.activeTaskId = taskId;
        }
      }

      // Resolve default selected movement from scene capabilities
      const scene = getSceneById(sceneId);
      const defaultMovement =
        scene?.movementCapabilities?.defaultMovement ?? null;

      const nextUi = {
        ...state.ui,
        mode,
        showOpticalGeometry: resolveInitialOpticalGeometryVisibility(routeTask),
      };

      return {
        camera: nextCamera,
        scene: { ...state.scene, activeSceneId: sceneId },
        task: {
          ...state.task,
          activeTaskId: taskId ?? null,
          currentTaskEvaluation: null,
        },
        ui: nextUi,
        selectedMovement: defaultMovement,
        lastInitializedRouteKey: routeKey,
      };
    }),

  setSelectedMovement: (movement) =>
    set((state) => ({
      camera: {
        ...state.camera,
        frontRiseMm: 0,
        frontTiltDeg: 0,
        frontSwingDeg: 0,
        rearRiseMm: 0,
        rearTiltDeg: 0,
      },
      selectedMovement: movement,
    })),

  setRise: (value) =>
    set((state) => ({
      camera: {
        ...state.camera,
        frontRiseMm: clamp(
          value,
          CAMERA_CONSTANTS.riseMinMm,
          CAMERA_CONSTANTS.riseMaxMm,
        ),
      },
    })),

  setTilt: (value) =>
    set((state) => ({
      camera: {
        ...state.camera,
        frontTiltDeg: clamp(
          value,
          CAMERA_CONSTANTS.tiltMinDeg,
          CAMERA_CONSTANTS.tiltMaxDeg,
        ),
      },
    })),

  setSwing: (value) =>
    set((state) => ({
      camera: {
        ...state.camera,
        frontSwingDeg: clamp(
          value,
          CAMERA_CONSTANTS.swingMinDeg,
          CAMERA_CONSTANTS.swingMaxDeg,
        ),
      },
    })),

  setRearRise: (value) =>
    set((state) => ({
      camera: {
        ...state.camera,
        rearRiseMm: clamp(
          value,
          CAMERA_CONSTANTS.riseMinMm,
          CAMERA_CONSTANTS.riseMaxMm,
        ),
      },
    })),

  setRearTilt: (value) =>
    set((state) => ({
      camera: {
        ...state.camera,
        rearTiltDeg: clamp(
          value,
          CAMERA_CONSTANTS.tiltMinDeg,
          CAMERA_CONSTANTS.tiltMaxDeg,
        ),
      },
    })),

  setFocusDistance: (value) =>
    set((state) => ({
      camera: {
        ...state.camera,
        focusDistanceMm: clampFocusDistanceForScene(
          state.camera.activeSceneId,
          value,
        ),
        focusMode: "finite",
      },
    })),

  setInfinityFocus: () =>
    set((state) => ({
      camera: {
        ...state.camera,
        focusMode: "infinity",
        lastFiniteFocusDepthMm: Number.isFinite(state.camera.focusDistanceMm)
          ? state.camera.focusDistanceMm
          : (state.camera.lastFiniteFocusDepthMm ??
            state.camera.focusDistanceMm),
        frontRiseMm: 0,
        frontTiltDeg: 0,
        frontSwingDeg: 0,
        rearRiseMm: 0,
        rearTiltDeg: 0,
      },
      selectedMovement: null,
    })),

  setAperture: (value) =>
    set((state) => ({
      camera: {
        ...state.camera,
        aperture: isApertureValue(value) ? value : state.camera.aperture,
      },
    })),

  setGeometryView: (value) =>
    set((state) => ({
      camera: { ...state.camera, geometryView: value },
      ui: { ...state.ui, geometryView: value },
    })),

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

  setGroundGlassAssistEnabled: (enabled: boolean) =>
    set((state) => ({
      camera: {
        ...state.camera,
        groundGlassAssistEnabled: enabled,
      },
      ui: {
        ...state.ui,
        groundGlassAssistEnabled: enabled,
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

  setShowOpticalGeometry: (enabled) =>
    set((state) => ({
      ui: { ...state.ui, showOpticalGeometry: enabled },
    })),

  resetMovements: () =>
    set((state) => {
      const scene = getSceneById(state.camera.activeSceneId);
      const defaultMovement =
        scene?.movementCapabilities?.defaultMovement ?? null;
      return {
        camera: {
          ...state.camera,
          ...defaultControlState,
          focusDistanceMm: clampFocusDistanceForScene(
            state.camera.activeSceneId,
            defaultControlState.focusDistanceMm,
          ),
        },
        task: { ...state.task, currentTaskEvaluation: null },
        selectedMovement: defaultMovement,
      };
    }),

  restartTask: () =>
    set((state) => {
      const activeTask = state.task.activeTaskId
        ? getTaskById(state.task.activeTaskId)
        : undefined;
      const nextSceneId =
        activeTask?.sceneId ?? state.scene.activeSceneId;
      const nextMode = activeTask?.mode ?? state.ui.mode;
      const nextControlState =
        activeTask?.initialCameraState ?? defaultControlState;
      const focusDistanceMm = clampFocusDistanceForScene(
        nextSceneId,
        nextControlState.focusDistanceMm,
      );
      const nextGeometryView =
        activeTask?.initialCameraState?.geometryView ??
        state.camera.geometryView;
      const nextGroundGlassAssistEnabled =
        activeTask?.initialCameraState?.groundGlassAssistEnabled ??
        state.camera.groundGlassAssistEnabled;
      const nextFocusAssistEnabled =
        activeTask?.initialCameraState?.focusAssistEnabled ??
        state.camera.focusAssistEnabled;
      const nextGridEnabled =
        activeTask?.initialCameraState?.gridEnabled ??
        state.camera.gridEnabled;
      const nextShowOpticalGeometry =
        resolveInitialOpticalGeometryVisibility(activeTask);

      // Resolve default movement from the target scene
      const nextScene = getSceneById(nextSceneId);
      const defaultMovement =
        nextScene?.movementCapabilities?.defaultMovement ?? null;

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
        selectedMovement: defaultMovement,
        ui: {
          ...state.ui,
          mode: nextMode,
          geometryView: nextGeometryView,
          groundGlassAssistEnabled: nextGroundGlassAssistEnabled,
          focusAssistEnabled: nextFocusAssistEnabled,
          gridEnabled: nextGridEnabled,
          showOpticalGeometry: nextShowOpticalGeometry,
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
      selectedMovement: null,
      ui: {
        mode: DEFAULT_CAMERA_STATE.mode,
        geometryView: DEFAULT_CAMERA_STATE.geometryView,
        groundGlassAssistEnabled:
          DEFAULT_CAMERA_STATE.groundGlassAssistEnabled,
        focusAssistEnabled: DEFAULT_CAMERA_STATE.focusAssistEnabled,
        gridEnabled: DEFAULT_CAMERA_STATE.gridEnabled,
        showOpticalGeometry: DEFAULT_SHOW_OPTICAL_GEOMETRY,
      },
    }),
}));
