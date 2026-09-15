import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  createMacroDepthOfFieldGroup,
  disposeMacroDepthOfFieldGroup,
  MacroDepthOfFieldSubject,
} from "../../render/MacroDepthOfFieldSubjectFactory";
import { getSceneSubjectRegistration } from "../../render/sceneSubjectRegistry";
import { isGroundGlassRttScene } from "../../render/groundGlassRttScenes";
import {
  macroDepthOfFieldFocusTargets,
  macroDepthOfFieldCameraPlacement,
  macroDepthOfFieldSubjectBoundsMm,
} from "../../scenes/macroDepthOfFieldGeometry";
import { macroDepthOfFieldScene } from "../../scenes/definitions/macro-depth-of-field";

describe("Macro Scene 2 physical renderer contract", () => {
  it("uses one shared React subject, RTT factory, bounds, and disposer", () => {
    const registration = getSceneSubjectRegistration("macro-depth-of-field");

    expect(registration).toBeDefined();
    expect(isGroundGlassRttScene("macro-depth-of-field")).toBe(true);
    expect(registration?.SceneSubject).toBe(MacroDepthOfFieldSubject);
    expect(registration?.createRttGroup).toBe(createMacroDepthOfFieldGroup);
    expect(registration?.disposeRttGroup).toBe(disposeMacroDepthOfFieldGroup);
    expect(registration?.rttBounds).toBe(macroDepthOfFieldSubjectBoundsMm);
  });

  it("renders a connected three-dimensional specimen with valid physical focus surfaces", () => {
    const group = createMacroDepthOfFieldGroup();
    group.updateMatrixWorld(true);

    const bounds = new THREE.Box3().setFromObject(group);
    expect(bounds.min.x).toBeGreaterThanOrEqual(macroDepthOfFieldSubjectBoundsMm.min.x / 1000 - 1e-6);
    expect(bounds.max.x).toBeLessThanOrEqual(macroDepthOfFieldSubjectBoundsMm.max.x / 1000 + 1e-6);
    expect(bounds.min.y).toBeGreaterThanOrEqual(macroDepthOfFieldSubjectBoundsMm.min.y / 1000 - 1e-6);
    expect(bounds.max.y).toBeLessThanOrEqual(macroDepthOfFieldSubjectBoundsMm.max.y / 1000 + 1e-6);
    expect(bounds.min.z).toBeGreaterThanOrEqual(macroDepthOfFieldSubjectBoundsMm.min.z / 1000 - 1e-6);
    expect(bounds.max.z).toBeLessThanOrEqual(macroDepthOfFieldSubjectBoundsMm.max.z / 1000 + 1e-6);

    for (const part of [
      "chassis",
      "bridge",
      "front-lip",
      "station-0-face",
      "station-0-support",
      "station-1-outer-ring",
      "station-1-support",
      "station-2-inner-ring",
      "station-2-support",
      "station-1-gear-tooth-0",
      "station-1-radial-groove-0",
      "station-1-screw-head",
      "station-1-fine-slot",
      "station-1-micro-dot-0",
    ]) {
      expect(group.getObjectByName(`macro-depth-${part}`)).toBeInstanceOf(THREE.Mesh);
    }

    const boundsFor = (name: string) => {
      const object = group.getObjectByName(`macro-depth-${name}`);
      expect(object, `missing ${name}`).toBeDefined();
      return new THREE.Box3().setFromObject(object!);
    };
    const bridgeBounds = boundsFor("bridge");
    const frontLipBounds = boundsFor("front-lip");
    const chassisBounds = boundsFor("chassis");
    expect(bridgeBounds.intersectsBox(frontLipBounds)).toBe(true);
    expect(frontLipBounds.intersectsBox(chassisBounds)).toBe(true);
    for (const stationIndex of [0, 1, 2]) {
      const supportBounds = boundsFor(`station-${stationIndex}-support`);
      const bodyBounds = boundsFor(`station-${stationIndex}-body`);
      expect(bodyBounds.intersectsBox(supportBounds)).toBe(true);
      expect(supportBounds.intersectsBox(bridgeBounds)).toBe(true);
    }

    // Every declared point must meet the first lens-facing intersection of
    // actual rendered geometry, not just lie within the subject bounds.
    for (const target of macroDepthOfFieldFocusTargets) {
      const samples = [target.worldPosition, ...(target.sampleWorldPositions ?? [])];
      for (const { x, y, z } of samples) {
        const ray = new THREE.Raycaster(
          new THREE.Vector3(x / 1000, y / 1000, 0),
          new THREE.Vector3(0, 0, 1),
        );
        const hit = ray.intersectObject(group, true)[0];
        expect(hit, `${target.id} sample (${x}, ${y}, ${z})`).toBeDefined();
        expect(hit?.point.z).toBeCloseTo(z / 1000, 6);
      }
    }

    disposeMacroDepthOfFieldGroup(group);
  });

  it("shows each lens-facing detail surface from the default Scene observer", () => {
    const group = createMacroDepthOfFieldGroup();
    group.updateMatrixWorld(true);
    const observer = new THREE.Vector3(
      macroDepthOfFieldCameraPlacement.position.x / 1000,
      macroDepthOfFieldCameraPlacement.position.y / 1000,
      macroDepthOfFieldCameraPlacement.position.z / 1000,
    );

    for (const [stationIndex, target] of macroDepthOfFieldFocusTargets.entries()) {
      const targetPoint = new THREE.Vector3(
        target.worldPosition.x / 1000,
        target.worldPosition.y / 1000,
        target.worldPosition.z / 1000,
      );
      const direction = targetPoint.clone().sub(observer).normalize();
      const hit = new THREE.Raycaster(observer, direction).intersectObject(group, true)[0];

      expect(hit, `${target.id} is not visible from the default observer`).toBeDefined();
      expect(hit?.point.z).toBeCloseTo(target.worldPosition.z / 1000, 6);
      expect(hit?.object.name).toBe(`macro-depth-station-${stationIndex}-face`);
    }

    expect(macroDepthOfFieldScene.cameraPlacement).toBe(macroDepthOfFieldCameraPlacement);
    disposeMacroDepthOfFieldGroup(group);
  });
});
