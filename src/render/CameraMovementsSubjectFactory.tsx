/* eslint-disable react-refresh/only-export-components */
import { useEffect, useMemo, useRef } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { resolveCameraMovementLatticePresentation } from "../scenes/presentation/understandingCameraMovements";
import type {
  CameraMovementPresentationRegion,
  CameraMovementTargetRegion,
} from "../scenes/cameraMovementSceneCalibration";
import {
  applyCameraMovementsGroupStyle,
  cameraMovementsGroupOptionsFromPresentation,
  disposeCameraMovementsGroup,
} from "./assets/CameraMovementLatticeAsset";
import { createCameraMovementLatticeAsset } from "./cameraMovementLatticeAssetConsumer";
import {
  nextInteractiveLatticeGeneration,
  readInteractiveLatticeRuntimeInfo,
  type InteractiveLatticeRuntimeInfo,
} from "./cameraMovementLatticeRuntime";
import {
  CAMERA_MOVEMENT_PUBLIC_TEACHING_CASES,
  matchCameraMovementTeachingCase,
} from "../scenes/cameraMovementPublicTeaching";
import { resolveCameraMovementLessonPresentationTargetRegion } from "../scenes/cameraMovementLessonState";
import type { CameraState } from "../types/camera";
import { useAppStore } from "../state/appStore";
import { selectEffectiveCameraMovementCalibration } from "../state/selectors";
import type { SceneDefinition } from "../types/scene";

export {
  CAMERA_MOVEMENT_LATTICE_GEOMETRY_ID,
  applyCameraMovementsGroupStyle,
  cameraMovementsGroupOptionsFromPresentation,
  createCameraMovementsGroup,
  disposeCameraMovementsGroup,
} from "./assets/CameraMovementLatticeAsset";
export type { CameraMovementsGroupOptions } from "./assets/CameraMovementLatticeAsset";

const resolveTeachingPresentationTargetRegion = (
  camera: CameraState,
  targetRegion: CameraMovementTargetRegion,
  calibrationActive: boolean,
): CameraMovementPresentationRegion => {
  if (calibrationActive || camera.activeSceneId !== "understanding-camera-movements") {
    return targetRegion;
  }
  const lessonPresentationRegion = camera.cameraMovementLessonState
    ? resolveCameraMovementLessonPresentationTargetRegion(
        camera.cameraMovementLessonState,
      )
    : undefined;
  if (lessonPresentationRegion !== undefined) return lessonPresentationRegion;
  const caseId = matchCameraMovementTeachingCase({
    anchor: camera.viewpointAnchor,
    targetRegion,
    camera,
  });
  return caseId
    ? CAMERA_MOVEMENT_PUBLIC_TEACHING_CASES[caseId].presentationTargetRegion
    : targetRegion;
};

export type CameraMovementsSubjectProps = {
  scene?: SceneDefinition;
  onGroupChange?: (group: THREE.Group | null) => void;
};

const belongsToScene = (group: THREE.Group, scene: THREE.Scene): boolean => {
  let current: THREE.Object3D | null = group;
  while (current) {
    if (current === scene) return true;
    current = current.parent;
  }
  return false;
};

export const publishAttachedInteractiveLatticeRuntime = (
  group: THREE.Group,
  scene: THREE.Scene,
): InteractiveLatticeRuntimeInfo | null => {
  if (!belongsToScene(group, scene)) return null;
  group.userData.interactiveMountGeneration =
    nextInteractiveLatticeGeneration();
  const runtimeInfo = readInteractiveLatticeRuntimeInfo(group);
  useAppStore.getState().setInteractiveLatticeRuntimeInfo(runtimeInfo);
  return runtimeInfo;
};

/** Publish a target-only presentation update without changing mount identity. */
export const updateAttachedInteractiveLatticeRuntime = (
  group: THREE.Group,
  presentationRegion: CameraMovementPresentationRegion,
): InteractiveLatticeRuntimeInfo | null => {
  group.userData.presentationRegion = presentationRegion;
  const current = useAppStore.getState().interactiveLatticeRuntimeInfo;
  const generation = group.userData.interactiveMountGeneration;
  if (!current || current.generation !== generation) return null;
  const runtimeInfo = readInteractiveLatticeRuntimeInfo(group);
  useAppStore.getState().setInteractiveLatticeRuntimeInfo(runtimeInfo);
  return runtimeInfo;
};

export const clearInteractiveLatticeRuntime = (
  runtimeInfo: InteractiveLatticeRuntimeInfo | null,
): void => {
  if (!runtimeInfo) return;
  const currentRuntime =
    useAppStore.getState().interactiveLatticeRuntimeInfo;
  if (currentRuntime?.generation === runtimeInfo.generation) {
    useAppStore.getState().setInteractiveLatticeRuntimeInfo(null);
  }
};

export const CameraMovementsSubject: React.FC<CameraMovementsSubjectProps> = ({
  onGroupChange,
}) => {
  const onGroupChangeRef = useRef(onGroupChange);
  onGroupChangeRef.current = onGroupChange;
  const camera = useAppStore((state) => state.camera);
  const targetRegion = useAppStore((state) => state.scene.targetRegion);
  const calibrationActive = useAppStore(
    (state) => state.cameraMovementCalibrationSession.active,
  );
  const presentationTargetRegion = resolveTeachingPresentationTargetRegion(
    camera,
    targetRegion,
    calibrationActive,
  );
  const effectiveCalibration = useAppStore(
    selectEffectiveCameraMovementCalibration,
  );
  const r3fScene = useThree((state) => state.scene);
  const presentation = resolveCameraMovementLatticePresentation(
    effectiveCalibration,
  );
  const group = useMemo(
    () =>
      createCameraMovementLatticeAsset(
        cameraMovementsGroupOptionsFromPresentation(presentation),
      ),
    [presentation],
  );

  useEffect(() => {
    applyCameraMovementsGroupStyle(
      group,
      presentation.presentation,
      presentationTargetRegion,
    );
    updateAttachedInteractiveLatticeRuntime(group, presentationTargetRegion);
  }, [group, presentation, presentationTargetRegion]);

  useEffect(() => {
    const runtimeInfo =
      publishAttachedInteractiveLatticeRuntime(group, r3fScene);
    onGroupChangeRef.current?.(group);
    return () => {
      disposeCameraMovementsGroup(group);
      clearInteractiveLatticeRuntime(runtimeInfo);
      onGroupChangeRef.current?.(null);
    };
  }, [group, r3fScene]);

  return <primitive object={group} dispose={null} />;
};
