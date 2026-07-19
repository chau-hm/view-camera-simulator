import type { DerivedOpticsState } from "../types/optics";

export type SceneViewFocus = "scene" | "camera";

export type ObserverViewState = {
  position: [number, number, number];
  target: [number, number, number];
};

export type ObserverViewPresets = Record<SceneViewFocus, ObserverViewState>;

const WORLD_SCALE = 0.001;
const CAMERA_INSPECTION_DISTANCE_WORLD = 0.72;
const CAMERA_INSPECTION_FALLBACK_DIRECTION: [number, number, number] = [0.68, 0.42, -1];

const normalize = (value: [number, number, number]): [number, number, number] => {
  const length = Math.hypot(...value);
  if (length < 1e-6) return [0, 0, -1];
  return [value[0] / length, value[1] / length, value[2] / length];
};

export const resolvePhysicalCameraCenter = (
  opticsState: Pick<DerivedOpticsState, "filmCenterWorld" | "lensCenterWorld">,
): [number, number, number] => [
  ((opticsState.filmCenterWorld.x + opticsState.lensCenterWorld.x) / 2) * WORLD_SCALE,
  ((opticsState.filmCenterWorld.y + opticsState.lensCenterWorld.y) / 2) * WORLD_SCALE,
  ((opticsState.filmCenterWorld.z + opticsState.lensCenterWorld.z) / 2) * WORLD_SCALE,
];

export const createCameraInspectionView = (
  sceneView: ObserverViewState,
  cameraTarget: [number, number, number],
): ObserverViewState => {
  let direction: [number, number, number] = [
    sceneView.position[0] - sceneView.target[0],
    sceneView.position[1] - sceneView.target[1],
    sceneView.position[2] - sceneView.target[2],
  ];

  // A head-on scene observer hides the bellows and rail. Give that one case a
  // stable three-quarter inspection angle while preserving scene-specific
  // observer directions everywhere else.
  if (Math.hypot(direction[0], direction[1]) < Math.abs(direction[2]) * 0.08) {
    direction = CAMERA_INSPECTION_FALLBACK_DIRECTION;
  }

  const unitDirection = normalize(direction);
  return {
    target: [...cameraTarget],
    position: [
      cameraTarget[0] + unitDirection[0] * CAMERA_INSPECTION_DISTANCE_WORLD,
      cameraTarget[1] + unitDirection[1] * CAMERA_INSPECTION_DISTANCE_WORLD,
      cameraTarget[2] + unitDirection[2] * CAMERA_INSPECTION_DISTANCE_WORLD,
    ],
  };
};

export const createObserverViewPresets = (
  sceneView: ObserverViewState,
  opticsState: Pick<DerivedOpticsState, "filmCenterWorld" | "lensCenterWorld">,
): ObserverViewPresets => ({
  scene: sceneView,
  camera: createCameraInspectionView(sceneView, resolvePhysicalCameraCenter(opticsState)),
});

export const translateObserverViewToTarget = (
  view: ObserverViewState,
  target: [number, number, number],
): ObserverViewState => {
  const offset: [number, number, number] = [
    view.position[0] - view.target[0],
    view.position[1] - view.target[1],
    view.position[2] - view.target[2],
  ];
  return {
    target: [...target],
    position: [target[0] + offset[0], target[1] + offset[1], target[2] + offset[2]],
  };
};
