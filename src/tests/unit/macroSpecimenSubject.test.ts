import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { MacroSpecimenSubject, createMacroSpecimenGroup, disposeMacroSpecimenGroup } from "../../render/MacroSpecimenSubjectFactory";
import { getSceneSubjectRegistration } from "../../render/sceneSubjectRegistry";
import { isGroundGlassRttScene } from "../../render/groundGlassRttScenes";
import { macroSpecimenBoundsMm, macroBellowsExtensionFocusTargets } from "../../scenes/macroSpecimenGeometry";
import { resolveGenericConceptualSupportRail } from "../../render/ConceptualViewCamera";

describe("macro specimen physical renderer contract", () => {
  it("uses the same physical subject factory in viewport and RTT", () => {
    const registration = getSceneSubjectRegistration("macro-bellows-extension")!;
    expect(isGroundGlassRttScene("macro-bellows-extension")).toBe(true);
    expect(registration.SceneSubject).toBe(MacroSpecimenSubject);
    expect(registration.createRttGroup).toBe(createMacroSpecimenGroup);
    expect(registration.disposeRttGroup).toBe(disposeMacroSpecimenGroup);
    const group = registration.createRttGroup();
    const bounds = new THREE.Box3().setFromObject(group);
    expect(bounds.min.x).toBeCloseTo(-0.045, 6);
    expect(bounds.max.x).toBeCloseTo(0.045, 6);
    expect(bounds.min.z).toBeCloseTo(macroSpecimenBoundsMm.min.z / 1000, 6);
    expect(bounds.max.z).toBeCloseTo(macroSpecimenBoundsMm.max.z / 1000, 6);
    for (const part of ["outer-rim", "inner-ring", "central-relief", "radial-mark-0", "fine-line-0", "surface-dot-0"]) {
      expect(group.getObjectByName(`macro-specimen-${part}`)).toBeInstanceOf(THREE.Mesh);
    }
    for (const part of [
      "face-plate",
      "face-inset",
      "engraved-channel-0",
      "edge-knurl-0",
      "radial-engraving-0",
      "fastener-0",
      "fastener-slot-0",
      "back-cap",
      "back-outer-ring",
      "back-relief",
    ]) {
      expect(group.getObjectByName(`macro-specimen-${part}`)).toBeInstanceOf(THREE.Mesh);
    }
    const specimenMeshes = group.children.filter((object): object is THREE.Mesh => object instanceof THREE.Mesh);
    const specimenMaterials = specimenMeshes
      .map(({ material }) => material)
      .filter((material): material is THREE.MeshStandardMaterial => material instanceof THREE.MeshStandardMaterial);
    expect(new Set(specimenMaterials).size).toBeGreaterThanOrEqual(4);
    expect(specimenMaterials.every(({ roughnessMap }) => roughnessMap instanceof THREE.DataTexture)).toBe(true);
    group.updateMatrixWorld(true);
    // Every focus sample must land on the first lens-facing surface of real
    // rendered geometry, not merely inside the subject bounds.
    for (const target of macroBellowsExtensionFocusTargets) {
      const samples = [target.worldPosition, ...(target.sampleWorldPositions ?? [])];
      for (const { x, y, z } of samples) {
        const ray = new THREE.Raycaster(
          new THREE.Vector3(x / 1000, y / 1000, 0),
          new THREE.Vector3(0, 0, 1),
        );
        const hit = ray.intersectObject(group, true)[0];
        expect(hit).toBeDefined();
        expect(hit.point.z).toBeCloseTo(z / 1000, 6);
      }
    }
    disposeMacroSpecimenGroup(group);
  });

  it.each([180, 225, 300])("contains the rear carriage at %s mm without moving the front support", (distance) => {
    const rail = resolveGenericConceptualSupportRail({ x: 0, y: 0, z: -distance });
    const front = rail.centerRigLocal.z + rail.dimensionsMm.z / 2;
    const rear = rail.centerRigLocal.z - rail.dimensionsMm.z / 2;
    expect(front).toBeCloseTo(60);
    expect(rear).toBeCloseTo(-distance - 60);
    expect(front - rear).toBeCloseTo(distance + 120);
  });
});
