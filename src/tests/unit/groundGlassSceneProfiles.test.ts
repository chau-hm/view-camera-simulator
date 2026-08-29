import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import {
  CAMERA_MOVEMENT_BASELINE_RENDER_MODEL,
  type CameraMovementLatticeRenderModel,
} from "../../render/cameraMovementLatticeRenderModel";
import {
  getGroundGlassSceneProfile,
  type GroundGlassSceneProfileContext,
} from "../../render/groundGlassSceneProfiles";
import { architectureRiseScene } from "../../scenes/definitions/architecture-rise";
import { mirrorShiftScene } from "../../scenes/definitions/mirror-shift";
import { understandingCameraMovementsScene } from "../../scenes/definitions/understanding-camera-movements";
import { resolveMirrorShiftTeachingState } from "../../scenes/mirrorShiftCalibration";
import { DEFAULT_CAMERA_STATE } from "../../utils/constants";

const contextFor = (
  scene: GroundGlassSceneProfileContext["scene"],
  cameraMovementRenderModel: CameraMovementLatticeRenderModel =
    CAMERA_MOVEMENT_BASELINE_RENDER_MODEL,
  presentationRegion: GroundGlassSceneProfileContext["presentationRegion"] =
    "middle",
): GroundGlassSceneProfileContext => ({
  scene,
  cameraMovementRenderModel,
  presentationRegion,
});

const opticsForMirrorShift = (rigLateralMm: number, frontShiftMm: number) =>
  deriveOpticsState(
    {
      ...DEFAULT_CAMERA_STATE,
      ...mirrorShiftScene.cameraPreset,
      activeSceneId: mirrorShiftScene.id,
      activeTaskId: null,
      mode: "free",
      mirrorShiftLessonState: { rigLateralMm },
      frontShiftMm,
    },
    mirrorShiftScene,
  );

describe("Ground Glass scene profiles", () => {
  it("uses the ordinary registered lifecycle and SceneDefinition bounds", () => {
    const scene = architectureRiseScene;
    const profile = getGroundGlassSceneProfile(scene);
    const context = contextFor(scene);
    const rttScene = new THREE.Scene();
    const mounted = profile.mountSubject(rttScene, context);

    expect(profile.resolveRenderBounds(context)).toBe(scene.bounds);
    expect(mounted).not.toBeNull();
    expect(mounted?.runtimeInfo).toBeUndefined();
    expect(mounted?.update).toBeUndefined();
    expect(mounted?.group.parent).toBe(rttScene);

    mounted?.dispose();
    expect(mounted?.group.parent).toBeNull();
  });

  it("selects the Camera Movement lifecycle and its dynamic bounds", () => {
    const scene = understandingCameraMovementsScene;
    const profile = getGroundGlassSceneProfile(scene);
    const context = contextFor(scene);
    const rttScene = new THREE.Scene();
    const mounted = profile.mountSubject(rttScene, context);

    expect(profile.resolveRenderBounds(context)).toBe(
      CAMERA_MOVEMENT_BASELINE_RENDER_MODEL.subjectBounds,
    );
    expect(profile.resolveRenderBounds(context)).not.toBe(scene.bounds);
    expect(mounted?.runtimeInfo?.mounted).toBe(true);
    expect(mounted?.update).toBeTypeOf("function");

    const group = mounted!.group;
    const generation = mounted!.runtimeInfo!.generation;
    mounted!.update?.({
      ...context,
      presentationRegion: "upper",
      opticsState: deriveOpticsState(
        {
          ...DEFAULT_CAMERA_STATE,
          ...scene.cameraPreset,
          activeSceneId: scene.id,
        },
        scene,
      ),
    });

    expect(mounted!.group).toBe(group);
    expect(group.userData.presentationRegion).toBe("upper");
    expect(mounted!.runtimeInfo!.generation).toBe(generation);

    mounted!.dispose();
    expect(group.parent).toBeNull();
  });

  it("selects the Mirror Shift lifecycle and mutates its proxy in place", () => {
    const scene = mirrorShiftScene;
    const profile = getGroundGlassSceneProfile(scene);
    const context = contextFor(scene);
    const rttScene = new THREE.Scene();
    const mounted = profile.mountSubject(rttScene, context);
    expect(mounted?.update).toBeTypeOf("function");

    const group = mounted!.group;
    const cameraReflection = group.getObjectByName(
      "mirror-shift-camera-reflection",
    )!;
    const staticProp = group.getObjectByName(
      "mirror-shift-reflected-tall-marker",
    ) as THREE.Mesh;
    const staticGeometry = staticProp.geometry;
    const staticMaterial = staticProp.material;

    const neutralOptics = opticsForMirrorShift(0, 0);
    mounted!.update?.({
      ...context,
      opticsState: neutralOptics,
    });
    const movedOptics = opticsForMirrorShift(
      resolveMirrorShiftTeachingState("camera-moved").rigLateralMm,
      resolveMirrorShiftTeachingState("framing-restored").frontShiftMm,
    );
    mounted!.update?.({
      ...context,
      opticsState: movedOptics,
    });
    group.updateMatrixWorld(true);

    expect(mounted!.group).toBe(group);
    expect(cameraReflection).toBe(
      group.getObjectByName("mirror-shift-camera-reflection"),
    );
    expect(cameraReflection.userData.reflectedRigOriginWorld).toEqual(
      movedOptics.cameraRigTransform.rigOriginWorld,
    );
    expect(cameraReflection.userData.reflectedFrontShiftMm).toBe(
      movedOptics.cameraBodyLocalGeometry.lensCenterLocal.x,
    );
    expect(staticProp.geometry).toBe(staticGeometry);
    expect(staticProp.material).toBe(staticMaterial);

    mounted!.dispose();
    expect(group.parent).toBeNull();
  });
});
