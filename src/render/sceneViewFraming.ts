import type { SceneDefinition } from "../types/scene";
import { transformRigLocalPointToWorld } from "../core/optics/applyCameraBodyPitch";
import type { CameraRigTransform } from "../types/optics";

export type SceneViewFocus = "scene" | "camera";

export type ObserverViewState = {
  position: [number, number, number];
  target: [number, number, number];
};

export type ObserverViewPresets = Record<SceneViewFocus, ObserverViewState>;

const WORLD_SCALE = 0.001;
const CAMERA_INSPECTION_DISTANCE_WORLD = 0.72;
const CAMERA_INSPECTION_FALLBACK_DIRECTION: [number, number, number] = [0.68, 0.42, -1];

const normalize = (
  value: [number, number, number],
): [number, number, number] => {
  const length = Math.hypot(...value);
  if (length < 1e-6) return [0, 0, -1];
  return [value[0] / length, value[1] / length, value[2] / length];
};

const toWorld = (mm: number) => mm * WORLD_SCALE;

/**
 * Resolve the inspection pivot from the same canonical rig transform used by
 * the rendered camera assembly. The body-pitch pivot is stable within the
 * complete camera body and moves with both the viewpoint anchor and pitch.
 */
export const resolveCameraInspectionFocusTargetWorld = (
  rigTransform: CameraRigTransform,
): [number, number, number] => {
  const pivotWorld = transformRigLocalPointToWorld(
    rigTransform.bodyPitchPivotRigLocal,
    rigTransform,
  );
  return [toWorld(pivotWorld.x), toWorld(pivotWorld.y), toWorld(pivotWorld.z)];
};

const resolveInspectionTarget = (
  scene: Pick<SceneDefinition, "id" | "cameraInspectionPlacement">,
  focalLengthMm: number,
): [number, number, number] => {
  // Prefer scene-specific cameraInspectionPlacement
  if (scene.cameraInspectionPlacement) {
    return [
      toWorld(scene.cameraInspectionPlacement.target.x),
      toWorld(scene.cameraInspectionPlacement.target.y),
      toWorld(scene.cameraInspectionPlacement.target.z),
    ];
  }

  // Legacy fallback: nominal body midpoint
  const nominalBodyCenterZMm =
    scene.id === "focus-fundamentals-two-targets"
      ? focalLengthMm / 2
      : -focalLengthMm / 2;

  return [0, 0, nominalBodyCenterZMm * WORLD_SCALE];
};

const resolveInspectionPosition = (
  scene: Pick<SceneDefinition, "id" | "cameraInspectionPlacement">,
  sceneView: ObserverViewState,
  target: [number, number, number],
): [number, number, number] => {
  // Prefer scene-specific cameraInspectionPlacement
  if (scene.cameraInspectionPlacement) {
    return [
      toWorld(scene.cameraInspectionPlacement.position.x),
      toWorld(scene.cameraInspectionPlacement.position.y),
      toWorld(scene.cameraInspectionPlacement.position.z),
    ];
  }

  // Fallback: compute direction from scene observer
  let direction: [number, number, number] = [
    sceneView.position[0] - sceneView.target[0],
    sceneView.position[1] - sceneView.target[1],
    sceneView.position[2] - sceneView.target[2],
  ];

  if (Math.hypot(direction[0], direction[1]) < Math.abs(direction[2]) * 0.08) {
    direction = CAMERA_INSPECTION_FALLBACK_DIRECTION;
  }

  const unitDirection = normalize(direction);
  return [
    target[0] + unitDirection[0] * CAMERA_INSPECTION_DISTANCE_WORLD,
    target[1] + unitDirection[1] * CAMERA_INSPECTION_DISTANCE_WORLD,
    target[2] + unitDirection[2] * CAMERA_INSPECTION_DISTANCE_WORLD,
  ];
};

export const resolveStableCameraInspectionTarget = (
  sceneId: string,
  focalLengthMm: number,
): [number, number, number] => {
  // For generic access, use the legacy midpoint
  const nominalBodyCenterZMm =
    sceneId === "focus-fundamentals-two-targets"
      ? focalLengthMm / 2
      : -focalLengthMm / 2;
  return [0, 0, nominalBodyCenterZMm * WORLD_SCALE];
};

export const createCameraInspectionView = (
  scene: Pick<SceneDefinition, "id" | "cameraInspectionPlacement">,
  sceneView: ObserverViewState,
  focalLengthMm: number,
  targetOverride?: [number, number, number],
): ObserverViewState => {
  const target = resolveInspectionTarget(scene, focalLengthMm);
  const position = resolveInspectionPosition(scene, sceneView, target);
  const baseView = { target, position };
  return targetOverride
    ? translateObserverViewToTarget(baseView, targetOverride)
    : baseView;
};

export const createObserverViewPresets = (
  sceneView: ObserverViewState,
  cameraTarget: [number, number, number],
): ObserverViewPresets => ({
  scene: sceneView,
  camera: {
    target: [...cameraTarget] as [number, number, number],
    position: (() => {
      let direction: [number, number, number] = [
        sceneView.position[0] - sceneView.target[0],
        sceneView.position[1] - sceneView.target[1],
        sceneView.position[2] - sceneView.target[2],
      ];
      if (
        Math.hypot(direction[0], direction[1]) <
        Math.abs(direction[2]) * 0.08
      ) {
        direction = CAMERA_INSPECTION_FALLBACK_DIRECTION;
      }
      const unitDirection = normalize(direction);
      return [
        cameraTarget[0] + unitDirection[0] * CAMERA_INSPECTION_DISTANCE_WORLD,
        cameraTarget[1] + unitDirection[1] * CAMERA_INSPECTION_DISTANCE_WORLD,
        cameraTarget[2] + unitDirection[2] * CAMERA_INSPECTION_DISTANCE_WORLD,
      ] as [number, number, number];
    })(),
  },
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
    position: [
      target[0] + offset[0],
      target[1] + offset[1],
      target[2] + offset[2],
    ],
  };
};
