import * as THREE from "three";
import type { CameraMovementPresentationRegion } from "../scenes/cameraMovementSceneCalibration";
import type { DerivedOpticsState, Bounds3 } from "../types/optics";
import type { SceneDefinition } from "../types/scene";
import {
  updateMirrorShiftCameraReflection,
} from "./MirrorShiftSubjectFactory";
import type { CameraMovementLatticeRenderModel } from "./cameraMovementLatticeRenderModel";
import {
  mountCameraMovementRttSubject,
  unmountCameraMovementRttSubject,
  updateCameraMovementRttSubjectTarget,
} from "./cameraMovementRttSubjectLifecycle";
import type { RttLatticeRuntimeInfo } from "./cameraMovementLatticeRuntime";
import {
  createRegisteredRttSubject,
  disposeRegisteredRttSubject,
  getSceneSubjectRegistration,
  type SceneSubjectRttLighting,
  type SceneSubjectRttOptions,
} from "./sceneSubjectRegistry";

export type GroundGlassSceneProfileContext = Readonly<{
  scene: SceneDefinition;
  cameraMovementRenderModel: CameraMovementLatticeRenderModel;
  presentationRegion: CameraMovementPresentationRegion;
}>;

export type GroundGlassSceneProfileUpdateContext =
  GroundGlassSceneProfileContext &
    Readonly<{
      opticsState: DerivedOpticsState;
    }>;

export type MountedGroundGlassSceneSubject = Readonly<{
  group: THREE.Group;
  runtimeInfo?: RttLatticeRuntimeInfo;
  update?: (context: GroundGlassSceneProfileUpdateContext) => void;
  dispose: () => void;
}>;

export type GroundGlassSceneProfile = Readonly<{
  resolveRttLighting: (
    context: GroundGlassSceneProfileContext,
  ) => SceneSubjectRttLighting | undefined;
  mountSubject: (
    scene: THREE.Scene,
    context: GroundGlassSceneProfileContext,
  ) => MountedGroundGlassSceneSubject | null;
  resolveRenderBounds: (context: GroundGlassSceneProfileContext) => Bounds3;
}>;

type GroundGlassSceneProfileDefinition = Readonly<{
  resolveSubjectOptions?: (
    context: GroundGlassSceneProfileContext,
  ) => SceneSubjectRttOptions;
  mountSubject?: (
    scene: THREE.Scene,
    context: GroundGlassSceneProfileContext,
    options: SceneSubjectRttOptions | undefined,
  ) => MountedGroundGlassSceneSubject | null;
  resolveRenderBounds?: (context: GroundGlassSceneProfileContext) => Bounds3;
}>;

const resolveRegisteredRttLighting = (
  context: GroundGlassSceneProfileContext,
  options: SceneSubjectRttOptions | undefined,
): SceneSubjectRttLighting | undefined => {
  const registration = getSceneSubjectRegistration(context.scene.id);
  return registration?.resolveRttLighting?.(options) ?? registration?.rttLighting;
};

const mountRegisteredSubject = (
  scene: THREE.Scene,
  context: GroundGlassSceneProfileContext,
  options: SceneSubjectRttOptions | undefined,
): MountedGroundGlassSceneSubject | null => {
  const subjectGroup = createRegisteredRttSubject(context.scene.id, options);
  if (!subjectGroup) return null;

  scene.add(subjectGroup);
  return {
    group: subjectGroup,
    dispose: () => {
      scene.remove(subjectGroup);
      disposeRegisteredRttSubject(context.scene.id, subjectGroup);
    },
  };
};

const createProfile = (
  definition: GroundGlassSceneProfileDefinition = {},
): GroundGlassSceneProfile => ({
  resolveRttLighting: (context) =>
    resolveRegisteredRttLighting(
      context,
      definition.resolveSubjectOptions?.(context),
    ),
  mountSubject: (scene, context) => {
    const options = definition.resolveSubjectOptions?.(context);
    if (definition.mountSubject) {
      return definition.mountSubject(scene, context, options);
    }
    return mountRegisteredSubject(scene, context, options);
  },
  resolveRenderBounds: (context) =>
    definition.resolveRenderBounds?.(context) ??
    getSceneSubjectRegistration(context.scene.id)?.rttBounds ??
    context.scene.bounds,
});

const ordinarySceneProfile = createProfile();

const cameraMovementSceneProfile = createProfile({
  resolveSubjectOptions: ({ cameraMovementRenderModel, presentationRegion }) => ({
    cameraMovementRenderModel,
    presentationRegion,
  }),
  mountSubject: (scene, context) => {
    const mounted = mountCameraMovementRttSubject(
      scene,
      context.cameraMovementRenderModel,
      context.presentationRegion,
    );
    return {
      group: mounted.group,
      runtimeInfo: mounted.runtimeInfo,
      update: ({ cameraMovementRenderModel, presentationRegion }) => {
        updateCameraMovementRttSubjectTarget(
          mounted,
          cameraMovementRenderModel,
          presentationRegion,
        );
      },
      dispose: () => unmountCameraMovementRttSubject(mounted),
    };
  },
  resolveRenderBounds: ({ cameraMovementRenderModel }) =>
    cameraMovementRenderModel.subjectBounds,
});

const mirrorShiftSceneProfile = createProfile({
  mountSubject: (scene, context, options) => {
    const mounted = mountRegisteredSubject(scene, context, options);
    if (!mounted) return null;

    return {
      ...mounted,
      update: ({ opticsState }) => {
        updateMirrorShiftCameraReflection(
          mounted.group,
          opticsState.cameraRigTransform.rigOriginWorld,
          opticsState.cameraBodyLocalGeometry.lensCenterLocal.x,
        );
      },
    };
  },
});

const groundGlassSceneProfiles: Readonly<
  Partial<Record<string, GroundGlassSceneProfile>>
> = {
  "understanding-camera-movements": cameraMovementSceneProfile,
  "mirror-shift": mirrorShiftSceneProfile,
};

export const getGroundGlassSceneProfile = (
  scene: SceneDefinition,
): GroundGlassSceneProfile =>
  groundGlassSceneProfiles[scene.id] ?? ordinarySceneProfile;
