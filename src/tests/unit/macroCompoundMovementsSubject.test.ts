import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  createMacroCompoundMovementsGroup,
  disposeMacroCompoundMovementsGroup,
  MacroCompoundMovementsSubject,
} from "../../render/MacroCompoundMovementsSubjectFactory";
import { getSceneSubjectRegistration } from "../../render/sceneSubjectRegistry";
import { isGroundGlassRttScene } from "../../render/groundGlassRttScenes";
import {
  macroCompoundMovementsCameraPlacement,
  macroCompoundMovementsFocusTargets,
  macroCompoundMovementsSubjectBoundsMm,
  macroCompoundMovementsStationSpecs,
} from "../../scenes/macroCompoundMovementsGeometry";

describe("Macro Scene 4 compound subject", () => {
  it("uses one shared React subject, RTT factory, bounds, and disposer", () => {
    const registration = getSceneSubjectRegistration("macro-compound-movements");

    expect(registration).toBeDefined();
    expect(isGroundGlassRttScene("macro-compound-movements")).toBe(true);
    expect(registration?.SceneSubject).toBe(MacroCompoundMovementsSubject);
    expect(registration?.createRttGroup).toBe(createMacroCompoundMovementsGroup);
    expect(registration?.disposeRttGroup).toBe(disposeMacroCompoundMovementsGroup);
    expect(registration?.rttBounds).toBe(macroCompoundMovementsSubjectBoundsMm);
  });

  it("keeps every focus probe on the first rendered camera-facing focus face", () => {
    const group = createMacroCompoundMovementsGroup();
    group.updateMatrixWorld(true);

    const bounds = new THREE.Box3().setFromObject(group);
    expect(bounds.min.x).toBeGreaterThanOrEqual(macroCompoundMovementsSubjectBoundsMm.min.x / 1000 - 1e-6);
    expect(bounds.max.x).toBeLessThanOrEqual(macroCompoundMovementsSubjectBoundsMm.max.x / 1000 + 1e-6);
    expect(bounds.min.y).toBeGreaterThanOrEqual(macroCompoundMovementsSubjectBoundsMm.min.y / 1000 - 1e-6);
    expect(bounds.max.y).toBeLessThanOrEqual(macroCompoundMovementsSubjectBoundsMm.max.y / 1000 + 1e-6);
    expect(bounds.min.z).toBeGreaterThanOrEqual(macroCompoundMovementsSubjectBoundsMm.min.z / 1000 - 1e-6);
    expect(bounds.max.z).toBeLessThanOrEqual(macroCompoundMovementsSubjectBoundsMm.max.z / 1000 + 1e-6);

    for (const station of macroCompoundMovementsStationSpecs) {
      expect(group.getObjectByName(`macro-compound-${station.id}-focus-face`)).toBeInstanceOf(THREE.Mesh);
      expect(group.getObjectByName(`macro-compound-${station.id}-body`)).toBeInstanceOf(THREE.Mesh);
      expect(group.getObjectByName(`macro-compound-${station.id}-support-arm`)).toBeInstanceOf(THREE.Mesh);
    }
    expect(group.getObjectByName("macro-compound-near-left-gear-rim")).toBeInstanceOf(THREE.Mesh);
    expect(group.getObjectByName("macro-compound-centre-target-ring-a")).toBeInstanceOf(THREE.Mesh);
    expect(group.getObjectByName("macro-compound-far-right-pad-2-3")).toBeInstanceOf(THREE.Mesh);

    for (const target of macroCompoundMovementsFocusTargets) {
      const samples = [target.worldPosition, ...(target.sampleWorldPositions ?? [])];
      for (const { x, y } of samples) {
        const ray = new THREE.Raycaster(
          new THREE.Vector3(x / 1000, y / 1000, 0),
          new THREE.Vector3(0, 0, 1),
        );
        const hit = ray.intersectObject(group, true)[0];
        expect(hit, `${target.id} sample (${x}, ${y})`).toBeDefined();
        expect(hit?.object.name).toBe(`${target.id}-focus-face`);
      }
    }

    disposeMacroCompoundMovementsGroup(group);
  });

  it("keeps all three stations visible from the default observer", () => {
    const group = createMacroCompoundMovementsGroup();
    group.updateMatrixWorld(true);
    const observer = new THREE.Vector3(
      macroCompoundMovementsCameraPlacement.position.x / 1000,
      macroCompoundMovementsCameraPlacement.position.y / 1000,
      macroCompoundMovementsCameraPlacement.position.z / 1000,
    );

    for (const target of macroCompoundMovementsFocusTargets) {
      const targetPoint = new THREE.Vector3(
        target.worldPosition.x / 1000,
        target.worldPosition.y / 1000,
        target.worldPosition.z / 1000,
      );
      const direction = targetPoint.clone().sub(observer).normalize();
      const hit = new THREE.Raycaster(observer, direction).intersectObject(group, true)[0];
      expect(hit, `${target.id} is not visible from the default observer`).toBeDefined();
      expect(hit?.object.name).toBe(`${target.id}-focus-face`);
    }

    disposeMacroCompoundMovementsGroup(group);
  });
});
