import { create } from "zustand";
import { clamp } from "../core/math/clamps";
import type { ApertureValue, CameraState, GeometryView, SimulatorMode } from "../types/camera";
import type { TaskEvaluation } from "../types/task";
import { CAMERA_CONSTANTS, DEFAULT_CAMERA_STATE } from "../utils/constants";

const defaultMovementState = {
  frontRiseMm: DEFAULT_CAMERA_STATE.frontRiseMm,
  frontTiltDeg: DEFAULT_CAMERA_STATE.frontTiltDeg,
  frontSwingDeg: DEFAULT_CAMERA_STATE.frontSwingDeg,
};

const defaultControlState = {
  ...defaultMovementState,
  focusDistanceMm: DEFAULT_CAMERA_STATE.focusDistanceMm,
  aperture: DEFAULT_CAMERA_STATE.aperture,
};

export type AppStore = {
  camera: CameraState;
  currentTaskEvaluation: TaskEvaluation | null;
  setCurrentTaskEvaluation: (evaluation: TaskEvaluation | null) => void;
  setMode: (mode: SimulatorMode) => void;
  setActiveScene: (sceneId: string) => void;
  setActiveTask: (taskId: string | null) => void;
  setScene: (sceneId: string) => void;
  setTask: (taskId: string | null) => void;
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
  currentTaskEvaluation: null,
  setCurrentTaskEvaluation: (evaluation) => set({ currentTaskEvaluation: evaluation }),
  setMode: (mode) => set((state) => ({ camera: { ...state.camera, mode } })),
  setActiveScene: (sceneId) =>
    set((state) => ({ camera: { ...state.camera, activeSceneId: sceneId }, currentTaskEvaluation: null })),
  setActiveTask: (taskId) =>
    set((state) => ({ camera: { ...state.camera, activeTaskId: taskId }, currentTaskEvaluation: null })),
  setScene: (sceneId) => set((state) => ({ camera: { ...state.camera, activeSceneId: sceneId } })),
  setTask: (taskId) => set((state) => ({ camera: { ...state.camera, activeTaskId: taskId } })),
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
    set((state) => ({ camera: { ...state.camera, focusDistanceMm: Math.max(100, value) } })),
  setAperture: (value) => set((state) => ({ camera: { ...state.camera, aperture: value } })),
  setGeometryView: (value) => set((state) => ({ camera: { ...state.camera, geometryView: value } })),
  toggleGroundGlassAssist: () =>
    set((state) => ({
      camera: {
        ...state.camera,
        groundGlassAssistEnabled: !state.camera.groundGlassAssistEnabled,
      },
    })),
  toggleFocusAssist: () =>
    set((state) => ({
      camera: {
        ...state.camera,
        focusAssistEnabled: !state.camera.focusAssistEnabled,
      },
    })),
  toggleGrid: () => set((state) => ({ camera: { ...state.camera, gridEnabled: !state.camera.gridEnabled } })),
  resetMovements: () =>
    set((state) => ({
      camera: {
        ...state.camera,
        ...defaultMovementState,
      },
      currentTaskEvaluation: null,
    })),
  restartTask: () =>
    set((state) => ({
      camera: {
        ...state.camera,
        ...defaultControlState,
      },
      currentTaskEvaluation: null,
    })),
  resetCamera: () => set({ camera: DEFAULT_CAMERA_STATE, currentTaskEvaluation: null }),
}));
