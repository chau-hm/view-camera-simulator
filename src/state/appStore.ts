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
  DEFAULT_CAMERA_BODY_PIVOT_WORLD,
  isApertureValue,
} from "../utils/constants";
import {
  DEFAULT_SHOW_OPTICAL_GEOMETRY,
  resolveInitialOpticalGeometryVisibility,
} from "./sceneViewDefaults";
import {
  DEFAULT_SUBJECT_COUNT,
  type SubjectCount,
} from "../scenes/understandingCameraMovementsGeometry";
import {
  DEFAULT_CAMERA_CONFIGURATION_DIRECTION,
  DEFAULT_CAMERA_CONFIGURATION_MODE,
  neutralCameraConfigurationFields,
  resolveCameraConfigurationPreset,
  resolveSceneRiseRangeMm,
  type CameraConfigurationMode,
  type VerticalDirection,
} from "../scenes/cameraConfigurationPresets";

const defaultControlState = {
  focalLengthMm: DEFAULT_CAMERA_STATE.focalLengthMm,
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

/** Resolve the default movement for a scene, if any. */
const resolveDefaultMovement = (sceneId: string): CameraMovementField | null => {
  const scene = getSceneById(sceneId);
  return scene?.movementCapabilities?.defaultMovement ?? null;
};

const resolveCameraBodyReset = (sceneId: string): Pick<CameraState, "cameraBodyPitchDeg" | "cameraBodyPivotWorld"> => {
  const scene = getSceneById(sceneId);
  return {
    cameraBodyPitchDeg:
      scene?.cameraBodyPitchCapability?.enabled && Number.isFinite(scene.cameraPreset.cameraBodyPitchDeg)
        ? (scene.cameraPreset.cameraBodyPitchDeg as number)
        : 0,
    cameraBodyPivotWorld:
      scene?.cameraBodyPitchCapability?.enabled && scene.cameraPreset.cameraBodyPivotWorld
        ? scene.cameraPreset.cameraBodyPivotWorld
        : DEFAULT_CAMERA_BODY_PIVOT_WORLD,
  };
};

/** Whether the scene enforces at-most-one active movement. */
const isSingleMovementScene = (sceneId: string): boolean => {
  const scene = getSceneById(sceneId);
  return scene?.movementCapabilities?.selectionMode === "single";
};

/** Zero other supported movement fields when a single-movement scene sets one. */
const enforceSingleMovement = (
  camera: CameraState,
  sceneId: string,
  field: CameraMovementField,
): CameraState => {
  if (!isSingleMovementScene(sceneId)) return camera;
  return {
    ...camera,
    frontRiseMm: field === "frontRiseMm" ? camera.frontRiseMm : 0,
    rearRiseMm: field === "rearRiseMm" ? camera.rearRiseMm : 0,
    frontTiltDeg: field === "frontTiltDeg" ? camera.frontTiltDeg : 0,
    rearTiltDeg: field === "rearTiltDeg" ? camera.rearTiltDeg : 0,
    frontSwingDeg: 0,
  };
};

/** Restore camera state from the active scene preset for movement-comparison scenes. */
const resolveScenePresetReset = (
  sceneId: string,
): Partial<CameraState> => {
  const scene = getSceneById(sceneId);
  if (!scene?.movementCapabilities) return {};
  const preset = scene.cameraPreset;
  return {
    ...(preset.focalLengthMm === undefined ? {} : { focalLengthMm: preset.focalLengthMm }),
    frontRiseMm: preset.frontRiseMm,
    frontTiltDeg: preset.frontTiltDeg,
    frontSwingDeg: preset.frontSwingDeg,
    rearRiseMm: preset.rearRiseMm,
    rearTiltDeg: preset.rearTiltDeg,
    focusDistanceMm: preset.focusDistanceMm,
    aperture: preset.aperture,
    focusMode: "finite",
  };
};

type SceneRuntimeState = {
  activeSceneId: string;
  /** Presentation-only subject count for Understanding Camera Movements. */
  subjectCount: SubjectCount;
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


/** Whether the scene supports demo camera-configuration presets. */
const supportsCameraConfigurationPresets = (sceneId: string): boolean =>
  sceneId === "understanding-camera-movements";

/** Default configuration UI state for scene entry and reset. */
const defaultConfigurationState = () => ({
  configurationMode: DEFAULT_CAMERA_CONFIGURATION_MODE,
  configurationDirection: DEFAULT_CAMERA_CONFIGURATION_DIRECTION,
});

/** Check if focusDistance is locked by the active scene's cameraControlPolicy. */
const isFocusDistanceLocked = (sceneId: string): boolean => {
  const scene = getSceneById(sceneId);
  return scene?.cameraControlPolicy?.focusDistance === "fixed";
};

/** Check if aperture is locked by the active scene's cameraControlPolicy. */
const isApertureLocked = (sceneId: string): boolean => {
  const scene = getSceneById(sceneId);
  return scene?.cameraControlPolicy?.aperture === "fixed";
};

/** Check if infinity reset is disallowed by the active scene. */
const isInfinityResetDisallowed = (sceneId: string): boolean => {
  const scene = getSceneById(sceneId);
  return scene?.cameraControlPolicy?.infinityReset === false;
};

import type { GroundGlassRttRuntimeInfo } from "../render/groundGlassRttDimensions";

export type AppStore = {
  camera: CameraState;
  scene: SceneRuntimeState;
  task: TaskRuntimeState;
  ui: UIState;
  /** The currently selected movement for single-active scenes. */
  selectedMovement: CameraMovementField | null;
  /** Last-applied configuration preset mode, or null when no complete preset is active. */
  configurationMode: CameraConfigurationMode | null;
  /** Last-applied configuration preset direction (Understanding Camera Movements). */
  configurationDirection: VerticalDirection;
  /** Route-based initialization key. */
  lastInitializedRouteKey?: string | null;
  /** Optional runtime diagnostics for RTT scenes. */
  groundGlassRttRuntimeInfo?: GroundGlassRttRuntimeInfo | null;

  setGroundGlassRttRuntimeInfo: (info: GroundGlassRttRuntimeInfo | null) => void;
  setCurrentTaskEvaluation: (evaluation: TaskEvaluation | null) => void;
  setMode: (mode: SimulatorMode) => void;
  setActiveScene: (sceneId: string) => void;
  setActiveTask: (taskId: string | null) => void;
  setCameraBodyPitchDeg: (value: number) => void;
  setSubjectCount: (count: SubjectCount | number) => void;
  /** Atomically apply a conventional/corrected configuration preset. */
  applyCameraConfiguration: (
    mode: CameraConfigurationMode,
    direction: VerticalDirection,
  ) => void;
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
  scene: {
    activeSceneId: DEFAULT_CAMERA_STATE.activeSceneId,
    subjectCount: DEFAULT_SUBJECT_COUNT,
  },
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
  configurationMode: DEFAULT_CAMERA_CONFIGURATION_MODE,
  configurationDirection: DEFAULT_CAMERA_CONFIGURATION_DIRECTION,
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
    set((state) => {
      const scene = getSceneById(sceneId);
      return {
        camera: {
          ...state.camera,
          ...resolveCameraBodyReset(sceneId),
          ...neutralCameraConfigurationFields(),
          activeSceneId: sceneId,
          focalLengthMm:
            scene?.cameraPreset.focalLengthMm ??
            DEFAULT_CAMERA_STATE.focalLengthMm,
          focusDistanceMm: clampFocusDistanceForScene(
            sceneId,
            state.camera.focusDistanceMm,
          ),
        },
        scene: {
          activeSceneId: sceneId,
          subjectCount: DEFAULT_SUBJECT_COUNT,
        },
        task: { ...state.task, currentTaskEvaluation: null },
        ui: { ...state.ui, showOpticalGeometry: DEFAULT_SHOW_OPTICAL_GEOMETRY },
        ...defaultConfigurationState(),
      };
    }),

  setActiveTask: (taskId) =>
    set((state) => ({
      camera: { ...state.camera, activeTaskId: taskId },
      task: {
        ...state.task,
        activeTaskId: taskId,
        currentTaskEvaluation: null,
      },
    })),

  setSubjectCount: (count) =>
    set((state) => {
      if (state.scene.activeSceneId !== "understanding-camera-movements") return {};
      if (count !== 1 && count !== 2 && count !== 3) return {};
      return { scene: { ...state.scene, subjectCount: count } };
    }),

  setCameraBodyPitchDeg: (value) =>
    set((state) => {
      if (state.camera.activeSceneId !== "understanding-camera-movements" || !Number.isFinite(value)) return {};
      return { camera: { ...state.camera, cameraBodyPitchDeg: value } };
    }),

  applyCameraConfiguration: (mode, direction) =>
    set((state) => {
      if (!supportsCameraConfigurationPresets(state.camera.activeSceneId)) return {};
      if (
        (mode !== "whole-camera-pitch" && mode !== "direct-shift" && mode !== "indirect-shift") ||
        (direction !== "upward" && direction !== "downward")
      ) {
        return {};
      }
      const fields = resolveCameraConfigurationPreset(mode, direction);
      return {
        camera: {
          ...state.camera,
          ...fields,
        },
        configurationMode: mode,
        configurationDirection: direction,
      };
    }),

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
        if (scene) {
          const preset = scene.cameraPreset ?? {};
          nextCamera = {
            ...nextCamera,
            ...resolveCameraBodyReset(sceneId),
            focalLengthMm:
              preset.focalLengthMm ?? DEFAULT_CAMERA_STATE.focalLengthMm,
            ...preset,
            activeSceneId: sceneId,
          };
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

      const defaultMovement = resolveDefaultMovement(sceneId);

      const nextUi = {
        ...state.ui,
        mode,
        showOpticalGeometry: resolveInitialOpticalGeometryVisibility(routeTask),
      };

      return {
        camera: {
          ...nextCamera,
          ...neutralCameraConfigurationFields(),
          ...resolveCameraBodyReset(sceneId),
          activeSceneId: sceneId,
        },
        scene: {
          activeSceneId: sceneId,
          subjectCount: DEFAULT_SUBJECT_COUNT,
        },
        task: {
          ...state.task,
          activeTaskId: taskId ?? null,
          currentTaskEvaluation: null,
        },
        ui: nextUi,
        selectedMovement: defaultMovement,
        ...defaultConfigurationState(),
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
        ...(supportsCameraConfigurationPresets(state.camera.activeSceneId)
          ? { cameraBodyPitchDeg: 0 }
          : {}),
      },
      selectedMovement: movement,
      ...(supportsCameraConfigurationPresets(state.camera.activeSceneId)
        ? defaultConfigurationState()
        : {}),
    })),

  setRise: (value) =>
    set((state) => {
      const riseRange = resolveSceneRiseRangeMm(state.camera.activeSceneId);
      return {
        camera: enforceSingleMovement(
          {
            ...state.camera,
            frontRiseMm: clamp(value, riseRange.minMm, riseRange.maxMm),
            ...(supportsCameraConfigurationPresets(state.camera.activeSceneId)
              ? { cameraBodyPitchDeg: 0 }
              : {}),
          },
          state.camera.activeSceneId,
          "frontRiseMm",
        ),
        selectedMovement: isSingleMovementScene(state.camera.activeSceneId)
          ? "frontRiseMm"
          : state.selectedMovement,
        ...(supportsCameraConfigurationPresets(state.camera.activeSceneId)
          ? defaultConfigurationState()
          : {}),
      };
    }),

  setTilt: (value) =>
    set((state) => ({
      camera: enforceSingleMovement(
        {
          ...state.camera,
          frontTiltDeg: clamp(
            value,
            CAMERA_CONSTANTS.tiltMinDeg,
            CAMERA_CONSTANTS.tiltMaxDeg,
          ),
          ...(supportsCameraConfigurationPresets(state.camera.activeSceneId)
            ? { cameraBodyPitchDeg: 0 }
            : {}),
        },
        state.camera.activeSceneId,
        "frontTiltDeg",
      ),
      selectedMovement: isSingleMovementScene(state.camera.activeSceneId)
        ? "frontTiltDeg"
        : state.selectedMovement,
      ...(supportsCameraConfigurationPresets(state.camera.activeSceneId)
        ? defaultConfigurationState()
        : {}),
    })),

  setSwing: (value) =>
    set((state) => ({
      camera: enforceSingleMovement(
        {
          ...state.camera,
          frontSwingDeg: clamp(
            value,
            CAMERA_CONSTANTS.swingMinDeg,
            CAMERA_CONSTANTS.swingMaxDeg,
          ),
          ...(supportsCameraConfigurationPresets(state.camera.activeSceneId)
            ? { cameraBodyPitchDeg: 0 }
            : {}),
        },
        state.camera.activeSceneId,
        "frontSwingDeg",
      ),
      selectedMovement: isSingleMovementScene(state.camera.activeSceneId)
        ? "frontSwingDeg"
        : state.selectedMovement,
      ...(supportsCameraConfigurationPresets(state.camera.activeSceneId)
        ? defaultConfigurationState()
        : {}),
    })),

  setRearRise: (value) =>
    set((state) => {
      const riseRange = resolveSceneRiseRangeMm(state.camera.activeSceneId);
      return {
        camera: enforceSingleMovement(
          {
            ...state.camera,
            rearRiseMm: clamp(value, riseRange.minMm, riseRange.maxMm),
            ...(supportsCameraConfigurationPresets(state.camera.activeSceneId)
              ? { cameraBodyPitchDeg: 0 }
              : {}),
          },
          state.camera.activeSceneId,
          "rearRiseMm",
        ),
        selectedMovement: isSingleMovementScene(state.camera.activeSceneId)
          ? "rearRiseMm"
          : state.selectedMovement,
        ...(supportsCameraConfigurationPresets(state.camera.activeSceneId)
          ? defaultConfigurationState()
          : {}),
      };
    }),

  setRearTilt: (value) =>
    set((state) => ({
      camera: enforceSingleMovement(
        {
          ...state.camera,
          rearTiltDeg: clamp(
            value,
            CAMERA_CONSTANTS.tiltMinDeg,
            CAMERA_CONSTANTS.tiltMaxDeg,
          ),
          ...(supportsCameraConfigurationPresets(state.camera.activeSceneId)
            ? { cameraBodyPitchDeg: 0 }
            : {}),
        },
        state.camera.activeSceneId,
        "rearTiltDeg",
      ),
      selectedMovement: isSingleMovementScene(state.camera.activeSceneId)
        ? "rearTiltDeg"
        : state.selectedMovement,
      ...(supportsCameraConfigurationPresets(state.camera.activeSceneId)
        ? defaultConfigurationState()
        : {}),
    })),

  setFocusDistance: (value) =>
    set((state) => {
      if (isFocusDistanceLocked(state.camera.activeSceneId)) return {};
      return {
        camera: {
          ...state.camera,
          focusDistanceMm: Number.isFinite(value)
            ? clampFocusDistanceForScene(state.camera.activeSceneId, value)
            : value,
          focusMode: Number.isFinite(value) ? "finite" : state.camera.focusMode,
          lastFiniteFocusDepthMm: Number.isFinite(value)
            ? clampFocusDistanceForScene(state.camera.activeSceneId, value)
            : state.camera.lastFiniteFocusDepthMm,
        },
      };
    }),

  setInfinityFocus: () =>
    set((state) => {
      if (isInfinityResetDisallowed(state.camera.activeSceneId)) return {};
      const defaultMovement = resolveDefaultMovement(state.camera.activeSceneId);
      return {
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
          ...(supportsCameraConfigurationPresets(state.camera.activeSceneId)
            ? { cameraBodyPitchDeg: 0 }
            : {}),
        },
        selectedMovement: defaultMovement,
        ...(supportsCameraConfigurationPresets(state.camera.activeSceneId)
          ? defaultConfigurationState()
          : {}),
      };
    }),

  setAperture: (value) =>
    set((state) => ({
      camera: {
        ...state.camera,
        aperture: isApertureLocked(state.camera.activeSceneId)
          ? state.camera.aperture
          : isApertureValue(value) ? value : state.camera.aperture,
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
      const sceneId = state.camera.activeSceneId;
      const defaultMovement = resolveDefaultMovement(sceneId);
      const scenePreset = resolveScenePresetReset(sceneId);
      // For movement-comparison scenes, use the scene preset
      // For all other scenes, use the global defaultControlState
      const resetValues = Object.keys(scenePreset).length > 0
        ? scenePreset
        : defaultControlState;
      return {
        camera: {
          ...state.camera,
          ...resolveCameraBodyReset(sceneId),
          ...neutralCameraConfigurationFields(),
          ...resetValues,
          focusDistanceMm: clampFocusDistanceForScene(
            sceneId,
            resetValues.focusDistanceMm ?? defaultControlState.focusDistanceMm,
          ),
          aperture: (resetValues as Partial<CameraState>).aperture ?? state.camera.aperture,
        },
        task: { ...state.task, currentTaskEvaluation: null },
        selectedMovement: defaultMovement,
        ...defaultConfigurationState(),
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
        activeTask?.initialCameraState
          ?? (Object.keys(resolveScenePresetReset(nextSceneId)).length > 0
            ? resolveScenePresetReset(nextSceneId)
            : defaultControlState);
      const presetFocusDistanceMm = (nextControlState as Partial<Record<string, number>>).focusDistanceMm
        ?? defaultControlState.focusDistanceMm;
      const focusDistanceMm = clampFocusDistanceForScene(
        nextSceneId,
        presetFocusDistanceMm,
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

      const defaultMovement = resolveDefaultMovement(nextSceneId);

      return {
        camera: {
          ...state.camera,
          activeSceneId: nextSceneId,
          mode: nextMode,
          ...resolveCameraBodyReset(nextSceneId),
          ...neutralCameraConfigurationFields(),
          ...nextControlState,
          geometryView: nextGeometryView,
          groundGlassAssistEnabled: nextGroundGlassAssistEnabled,
          focusAssistEnabled: nextFocusAssistEnabled,
          gridEnabled: nextGridEnabled,
          focusDistanceMm,
        },
        scene: {
          activeSceneId: nextSceneId,
          subjectCount: DEFAULT_SUBJECT_COUNT,
        },
        task: { ...state.task, currentTaskEvaluation: null },
        selectedMovement: defaultMovement,
        ...defaultConfigurationState(),
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
      scene: {
        activeSceneId: DEFAULT_CAMERA_STATE.activeSceneId,
        subjectCount: DEFAULT_SUBJECT_COUNT,
      },
      task: {
        activeTaskId: DEFAULT_CAMERA_STATE.activeTaskId,
        currentTaskEvaluation: null,
      },
      selectedMovement: null,
      ...defaultConfigurationState(),
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
