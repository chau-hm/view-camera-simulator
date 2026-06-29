import { create } from "zustand";
import { clamp } from "../core/math/clamps";
import { DEFAULT_CAMERA_STATE, CAMERA_CONSTANTS } from "../utils/constants";
import type { ApertureValue, CameraState, GeometryView, SimulatorMode } from "../types/camera";

type AppStore = {
  camera: CameraState;
  setMode: (mode: SimulatorMode) => void;
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
  resetCamera: () => void;
};

export const useAppStore = create<AppStore>((set) => ({
  camera: DEFAULT_CAMERA_STATE,
  setMode: (mode) => set((state) => ({ camera: { ...state.camera, mode } })),
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
  resetCamera: () => set({ camera: DEFAULT_CAMERA_STATE }),
}));
