import { render } from "@testing-library/react";
import { PerspectiveCamera, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import {
  applyObserverCameraReset,
  SceneAssetMesh,
  serializeFiniteRenderVector,
  shouldRenderReferenceCamera,
} from "../../render/SceneRenderer";
import { createShelfSwingGroup, disposeShelfSwingGroup } from "../../render/ShelfSwingSubjectFactory";
import { shelfSwingScene } from "../../scenes/definitions/shelf-swing";
import geometry from "../../scenes/shelfSwingGeometry";
import { toWorld } from "../../render/rttUtils";
import { understandingCameraMovementsScene } from "../../scenes/definitions/understanding-camera-movements";
import { CAMERA_MOVEMENT_SCENE_CALIBRATION } from "../../scenes/cameraMovementSceneCalibration";

describe("SceneRenderer Shelf Swing integration", () => {
  it("serializes only finite resolved renderer vectors", () => {
    expect(serializeFiniteRenderVector({ x: 0, y: -12.5, z: 42 })).toBe(
      "0.000000,-12.500000,42.000000",
    );
    expect(
      serializeFiniteRenderVector({ x: 0, y: Number.NaN, z: 42 }),
    ).toBeUndefined();
  });

  it("derives the camera-movements ghost visibility from scene calibration", () => {
    expect(
      CAMERA_MOVEMENT_SCENE_CALIBRATION.presentation.showReferenceCamera,
    ).toBe(false);
    expect(
      shouldRenderReferenceCamera(understandingCameraMovementsScene),
    ).toBe(false);
  });

  it.each(["shelf-floor", "shelf-diagonal-structure", "shelf-decor"])(
    "keeps legacy asset metadata %s non-rendering",
    (assetId) => {
      const view = render(<SceneAssetMesh assetId={assetId} />);
      expect(view.container).toBeEmptyDOMElement();
    },
  );

  it("the registered canonical subject contains exactly one floor and all stations", () => {
    const group = createShelfSwingGroup();
    try {
      const namedObjects: string[] = [];
      group.traverse((object) => namedObjects.push(object.name));
      expect(namedObjects.filter((name) => name === "shelf-swing-subject")).toHaveLength(1);
      expect(namedObjects.filter((name) => name === "shelf-swing-floor")).toHaveLength(1);
      geometry.subjects.forEach((subject) => {
        expect(namedObjects.filter((name) => name === subject.semanticName)).toHaveLength(1);
      });
    } finally {
      disposeShelfSwingGroup(group);
    }
  });

  it("resets the observer camera to canonical Shelf Swing placement and target", () => {
    const camera = new PerspectiveCamera();
    const target = new Vector3();
    const controls = {
      target,
      update: () => undefined,
    } as unknown as OrbitControlsImpl;
    const positionWorld = [
      toWorld(shelfSwingScene.cameraPlacement.position.x),
      toWorld(shelfSwingScene.cameraPlacement.position.y),
      toWorld(shelfSwingScene.cameraPlacement.position.z),
    ] as [number, number, number];
    const targetWorld = [
      toWorld(shelfSwingScene.cameraPlacement.target.x),
      toWorld(shelfSwingScene.cameraPlacement.target.y),
      toWorld(shelfSwingScene.cameraPlacement.target.z),
    ] as [number, number, number];

    applyObserverCameraReset(camera, controls, positionWorld, targetWorld);

    expect(camera.position.toArray()).toEqual(positionWorld);
    expect(target.toArray()).toEqual(targetWorld);
    expect(shelfSwingScene.cameraPlacement).toEqual(geometry.observerCamera);
  });

  it("Reset View restores the understanding-camera-movements scene and inspection presets", () => {
    const scene = understandingCameraMovementsScene;
    const resetScene = () => {
      const camera = new PerspectiveCamera();
      const target = new Vector3();
      const controls = {
        target,
        update: () => undefined,
      } as unknown as OrbitControlsImpl;
      const positionWorld = [
        toWorld(scene.cameraPlacement.position.x),
        toWorld(scene.cameraPlacement.position.y),
        toWorld(scene.cameraPlacement.position.z),
      ] as [number, number, number];
      const targetWorld = [
        toWorld(scene.cameraPlacement.target.x),
        toWorld(scene.cameraPlacement.target.y),
        toWorld(scene.cameraPlacement.target.z),
      ] as [number, number, number];
      applyObserverCameraReset(camera, controls, positionWorld, targetWorld);
      return { position: camera.position.toArray(), target: target.toArray() };
    };

    const resetInspection = () => {
      const camera = new PerspectiveCamera();
      const target = new Vector3();
      const controls = {
        target,
        update: () => undefined,
      } as unknown as OrbitControlsImpl;
      const inspection = scene.cameraInspectionPlacement!;
      const positionWorld = [
        toWorld(inspection.position.x),
        toWorld(inspection.position.y),
        toWorld(inspection.position.z),
      ] as [number, number, number];
      const targetWorld = [
        toWorld(inspection.target.x),
        toWorld(inspection.target.y),
        toWorld(inspection.target.z),
      ] as [number, number, number];
      applyObserverCameraReset(camera, controls, positionWorld, targetWorld);
      return { position: camera.position.toArray(), target: target.toArray() };
    };

    const sceneReset = resetScene();
    expect(sceneReset.position).toEqual([
      toWorld(scene.cameraPlacement.position.x),
      toWorld(scene.cameraPlacement.position.y),
      toWorld(scene.cameraPlacement.position.z),
    ]);
    expect(sceneReset.target).toEqual([
      toWorld(scene.cameraPlacement.target.x),
      toWorld(scene.cameraPlacement.target.y),
      toWorld(scene.cameraPlacement.target.z),
    ]);

    const inspectionReset = resetInspection();
    expect(inspectionReset.position).toEqual([
      toWorld(scene.cameraInspectionPlacement!.position.x),
      toWorld(scene.cameraInspectionPlacement!.position.y),
      toWorld(scene.cameraInspectionPlacement!.position.z),
    ]);
    expect(inspectionReset.target).toEqual([
      toWorld(scene.cameraInspectionPlacement!.target.x),
      toWorld(scene.cameraInspectionPlacement!.target.y),
      toWorld(scene.cameraInspectionPlacement!.target.z),
    ]);
  });
});
