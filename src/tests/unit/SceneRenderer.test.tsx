import { render } from "@testing-library/react";
import { PerspectiveCamera, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import {
  applyObserverCameraReset,
  SceneAssetMesh,
  shouldRenderReferenceCamera,
} from "../../render/SceneRenderer";
import { createShelfSwingGroup, disposeShelfSwingGroup } from "../../render/ShelfSwingSubjectFactory";
import { shelfSwingScene } from "../../scenes/definitions/shelf-swing";
import geometry from "../../scenes/shelfSwingGeometry";
import { toWorld } from "../../render/rttUtils";
import { understandingCameraMovementsScene } from "../../scenes/definitions/understanding-camera-movements";
import { CAMERA_MOVEMENT_SCENE_CALIBRATION } from "../../scenes/cameraMovementSceneCalibration";

describe("SceneRenderer Shelf Swing integration", () => {
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
});
