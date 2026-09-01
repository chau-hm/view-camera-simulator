import type {
  CameraInspectionAnchorSide,
  SceneDefinition,
} from "../types/scene";
import type { DerivedOpticsState, Vec3 } from "../types/optics";
import { transformRigLocalPointToWorld } from "../core/optics/applyCameraBodyPitch";
import type { CameraRigTransform } from "../types/optics";

export type SceneViewFocus = "scene" | "camera";

export type CameraInspectionTarget =
  | "whole-camera"
  | "front-standard"
  | "lens"
  | "lens-board"
  | "aperture"
  | "bellows"
  | "rear-standard"
  | "ground-glass"
  | "film-holder"
  | "camera-support";

export type ObserverViewState = {
  position: [number, number, number];
  target: [number, number, number];
};

export type ObserverViewPresets = Record<SceneViewFocus, ObserverViewState>;

export type SceneViewportFraming = {
  scene: ObserverViewState;
  camera: ObserverViewState;
};

type SceneViewportFramingScene = Pick<
  SceneDefinition,
  | "cameraPlacement"
  | "cameraInspectionAnchorSide"
  | "cameraInspectionPlacement"
  | "cameraBodyPitchCapability"
  | "cameraRigTranslationCapability"
>;

export type SceneViewportFramingInput = {
  scene: SceneViewportFramingScene;
  focalLengthMm: number;
  cameraRigTransform: CameraRigTransform;
  cameraInspectionTargetWorld?: [number, number, number];
  cameraInspectionTarget?: CameraInspectionTarget;
};

const WORLD_SCALE = 0.001;
const CAMERA_INSPECTION_DISTANCE_WORLD = 0.72;
const APERTURE_INSPECTION_DISTANCE_WORLD = 0.38;
const CAMERA_INSPECTION_FALLBACK_DIRECTION: [number, number, number] = [0.68, 0.42, -1];

const normalize = (
  value: [number, number, number],
): [number, number, number] => {
  const length = Math.hypot(...value);
  if (length < 1e-6) return [0, 0, -1];
  return [value[0] / length, value[1] / length, value[2] / length];
};

const toWorld = (mm: number) => mm * WORLD_SCALE;

const toWorldVector = (value: Vec3): [number, number, number] => [
  toWorld(value.x),
  toWorld(value.y),
  toWorld(value.z),
];

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

/** Resolve the stable body anchor used by scenes without a canonical rig transform. */
export const resolveStableCameraInspectionTarget = (
  cameraInspectionAnchorSide: CameraInspectionAnchorSide | undefined,
  focalLengthMm: number,
): [number, number, number] => {
  const nominalBodyCenterZMm =
    cameraInspectionAnchorSide === "front"
      ? focalLengthMm / 2
      : -focalLengthMm / 2;

  return [0, 0, nominalBodyCenterZMm * WORLD_SCALE];
};

const midpoint = (first: Vec3, second: Vec3): Vec3 => ({
  x: (first.x + second.x) / 2,
  y: (first.y + second.y) / 2,
  z: (first.z + second.z) / 2,
});

/**
 * Resolve lesson-facing anatomy targets from canonical camera geometry. This
 * is only an inspection pivot; it does not create an alternate camera model.
 */
export const resolveCameraInspectionTargetWorld = (
  target: CameraInspectionTarget,
  opticsState: Pick<DerivedOpticsState, "lensCenterWorld" | "filmCenterWorld">,
): [number, number, number] => {
  const lens = opticsState.lensCenterWorld;
  const rear = opticsState.filmCenterWorld;
  const center = midpoint(lens, rear);
  const point = (() => {
    switch (target) {
      case "front-standard":
      case "lens":
      case "lens-board":
      case "aperture":
        return lens;
      case "rear-standard":
      case "ground-glass":
      case "film-holder":
        return rear;
      case "camera-support":
        return { ...center, y: center.y - 140 };
      case "bellows":
      case "whole-camera":
      default:
        return center;
    }
  })();
  return toWorldVector(point);
};

const resolveInspectionPosition = (
  scene: Pick<SceneDefinition, "cameraInspectionPlacement">,
  sceneView: ObserverViewState,
  target: [number, number, number],
  inspectionTarget?: CameraInspectionTarget,
): [number, number, number] => {
  if (scene.cameraInspectionPlacement) {
    return toWorldVector(scene.cameraInspectionPlacement.position);
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
  const distance = inspectionTarget === "aperture"
    ? APERTURE_INSPECTION_DISTANCE_WORLD
    : CAMERA_INSPECTION_DISTANCE_WORLD;
  return [
    target[0] + unitDirection[0] * distance,
    target[1] + unitDirection[1] * distance,
    target[2] + unitDirection[2] * distance,
  ];
};

export const createCameraInspectionView = (
  scene: Pick<SceneDefinition, "cameraInspectionPlacement">,
  sceneView: ObserverViewState,
  target: [number, number, number],
  inspectionTarget?: CameraInspectionTarget,
): ObserverViewState => {
  const position = resolveInspectionPosition(scene, sceneView, target, inspectionTarget);
  return { target: [...target], position };
};

/**
 * Resolve the complete calibrated Scene/Camera viewport framing contract.
 * Scene focus uses the scene composition target. Camera focus uses the
 * canonical physical rig pivot when the scene exposes one, otherwise the
 * stable generic body anchor. Rigid translation capabilities move the whole
 * inspection view without changing its orbit offset.
 */
export const resolveSceneViewportFraming = ({
  scene,
  focalLengthMm,
  cameraRigTransform,
  cameraInspectionTargetWorld,
  cameraInspectionTarget,
}: SceneViewportFramingInput): SceneViewportFraming => {
  const sceneView: ObserverViewState = {
    position: toWorldVector(scene.cameraPlacement.position),
    target: toWorldVector(scene.cameraPlacement.target),
  };
  const usesCanonicalPhysicalPivot = scene.cameraBodyPitchCapability?.enabled === true;
  const cameraTarget = cameraInspectionTargetWorld ?? (
    usesCanonicalPhysicalPivot
      ? resolveCameraInspectionFocusTargetWorld(cameraRigTransform)
      : resolveStableCameraInspectionTarget(
          scene.cameraInspectionAnchorSide,
          focalLengthMm,
        )
  );
  const calibratedCameraTarget = usesCanonicalPhysicalPivot
    ? resolveCameraInspectionFocusTargetWorld({
        ...cameraRigTransform,
        rigOriginWorld: { x: 0, y: 0, z: 0 },
        bodyPitchDeg: 0,
      })
    : cameraTarget;
  const calibratedCameraView = createCameraInspectionView(
    scene,
    sceneView,
    calibratedCameraTarget,
    cameraInspectionTarget,
  );
  const cameraView =
    usesCanonicalPhysicalPivot
      ? translateObserverViewToTarget(calibratedCameraView, cameraTarget)
      : scene.cameraRigTranslationCapability?.enabled
        ? translateObserverViewByRigOrigin(
            calibratedCameraView,
            cameraRigTransform.rigOriginWorld,
          )
        : calibratedCameraView;

  return { scene: sceneView, camera: cameraView };
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

/**
 * Translate a calibrated camera-inspection view by the canonical rigid-rig
 * origin while preserving its observer-to-target orbit offset.
 */
export const translateObserverViewByRigOrigin = (
  view: ObserverViewState,
  rigOriginWorld: Vec3,
): ObserverViewState =>
  translateObserverViewToTarget(view, [
    view.target[0] + toWorld(rigOriginWorld.x),
    view.target[1] + toWorld(rigOriginWorld.y),
    view.target[2] + toWorld(rigOriginWorld.z),
  ]);
