import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  createMacroCompoundMovementsGroup,
  disposeMacroCompoundMovementsGroup,
} from "../../render/MacroCompoundMovementsSubjectFactory";
import { MacroCompoundMovementsSubject } from "../../render/SceneAssetSubjects";
import { getSceneSubjectRegistration } from "../../render/sceneSubjectRegistry";
import { isGroundGlassRttScene } from "../../render/groundGlassRttScenes";
import {
  macroCompoundMovementsCameraPlacement,
  macroCompoundMovementsFocusTargets,
  macroCompoundMovementsSubjectBoundsMm,
  macroCompoundMovementsStationSpecs,
} from "../../scenes/macroCompoundMovementsGeometry";
import { MACRO_COMPOUND_MOVEMENTS_PRESENTATION } from "../../scenes/presentation/macroCompoundMovements";

describe("Macro Scene 4 compound subject", () => {
  it("registers the typed subject slot for viewport and RTT with bounds and cleanup", () => {
    const registration = getSceneSubjectRegistration("macro-compound-movements");

    expect(registration).toBeDefined();
    expect(isGroundGlassRttScene("macro-compound-movements")).toBe(true);
    expect(registration?.SceneSubject).toBe(MacroCompoundMovementsSubject);
    expect(registration?.createRttGroup).toBeDefined();
    expect(registration?.disposeRttGroup).toBeDefined();
    expect(registration?.rttBounds).toBe(macroCompoundMovementsSubjectBoundsMm);
  });

  it("keeps every focus probe on the first rendered camera-facing focus face", () => {
    const group = createMacroCompoundMovementsGroup({ presentation: MACRO_COMPOUND_MOVEMENTS_PRESENTATION });
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
    const group = createMacroCompoundMovementsGroup({ presentation: MACRO_COMPOUND_MOVEMENTS_PRESENTATION });
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

  it("keeps differentiated, scene-local PBR roles under the existing presentation light", () => {
    const group = createMacroCompoundMovementsGroup({ presentation: MACRO_COMPOUND_MOVEMENTS_PRESENTATION });
    const materialFor = (meshName: string): THREE.MeshStandardMaterial => {
      const mesh = group.getObjectByName(meshName);
      expect(mesh, `${meshName} exists`).toBeInstanceOf(THREE.Mesh);
      const material = (mesh as THREE.Mesh).material;
      expect(material, `${meshName} uses one owned standard material`).toBeInstanceOf(THREE.MeshStandardMaterial);
      return material as THREE.MeshStandardMaterial;
    };

    const bronze = materialFor("macro-compound-near-left-gear-rim");
    const brass = materialFor("macro-compound-centre-outer-bezel");
    const machined = materialFor("macro-compound-near-left-focus-face");
    const ivory = materialFor("macro-compound-centre-focus-face");
    const accent = materialFor("macro-compound-far-right-pad-0-1");

    expect(bronze.metalness).toBe(0.62);
    expect(bronze.roughness).toBe(0.38);
    expect(brass.metalness).toBe(0.72);
    expect(brass.roughness).toBe(0.36);
    expect(machined.metalness).toBe(0.62);
    expect(machined.roughness).toBe(0.4);
    expect(ivory.metalness).toBe(0.05);
    expect(accent.metalness).toBe(0.28);
    expect(new Set([bronze, brass, machined, ivory, accent]).size).toBe(5);
    expect(new Set([bronze, brass, machined, ivory, accent].map((material) => material.roughnessMap)).size).toBe(5);

    const registration = getSceneSubjectRegistration("macro-compound-movements");
    expect(registration?.presentationLighting).toEqual({
      targetMm: MACRO_COMPOUND_MOVEMENTS_PRESENTATION.geometry.macroCompoundMovementsLightingTargetMm,
      keyOffsetWorld: { x: -2.5, y: 3.5, z: -4.5 },
    });
    disposeMacroCompoundMovementsGroup(group);
  });
});
