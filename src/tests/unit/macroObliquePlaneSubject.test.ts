import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  createMacroObliquePlaneGroup,
  disposeMacroObliquePlaneGroup,
} from "../../render/MacroObliquePlaneSubjectFactory";
import {
  MACRO_OBLIQUE_PLANE_SURFACE_NORMAL,
  MACRO_OBLIQUE_PLANE_SURFACE_CENTER_Z_MM,
  MACRO_OBLIQUE_PLATE_DIMENSIONS_MM,
  macroObliquePlaneCameraPlacement,
  macroObliquePlaneFocusTargets,
  macroObliquePlaneSubjectBoundsMm,
} from "../../scenes/macroObliquePlaneGeometry";
import { getSceneSubjectRegistration } from "../../render/sceneSubjectRegistry";
import { isGroundGlassRttScene } from "../../render/groundGlassRttScenes";
import { MacroObliquePlaneSubject } from "../../render/MacroObliquePlaneSubjectFactory";

describe("Macro Scene 3 planar PCB subject contract", () => {
  it("registers one shared viewport/RTT subject with bounds and disposal", () => {
    const registration = getSceneSubjectRegistration("macro-oblique-plane");

    expect(registration).toBeDefined();
    expect(isGroundGlassRttScene("macro-oblique-plane")).toBe(true);
    expect(registration?.SceneSubject).toBe(MacroObliquePlaneSubject);
    expect(registration?.createRttGroup).toBe(createMacroObliquePlaneGroup);
    expect(registration?.disposeRttGroup).toBe(disposeMacroObliquePlaneGroup);
    expect(registration?.rttBounds).toBe(macroObliquePlaneSubjectBoundsMm);
  });

  it("renders a genuinely oblique planar surface and keeps every focus sample on it", () => {
    const group = createMacroObliquePlaneGroup();
    group.updateMatrixWorld(true);

    const plateAssembly = group.getObjectByName("macro-oblique-plane-plate-assembly");
    const basePlate = group.getObjectByName("macro-oblique-base-plate");
    const fiberglass = group.getObjectByName("macro-oblique-pcb-fiberglass-edge");
    expect(plateAssembly).toBeInstanceOf(THREE.Group);
    expect(basePlate).toBeInstanceOf(THREE.Mesh);
    expect(fiberglass).toBeInstanceOf(THREE.Mesh);

    const renderedNormal = new THREE.Vector3(0, 0, -1).transformDirection(
      plateAssembly!.matrixWorld,
    );
    expect(renderedNormal.x).toBeCloseTo(MACRO_OBLIQUE_PLANE_SURFACE_NORMAL.x, 10);
    expect(renderedNormal.y).toBeCloseTo(MACRO_OBLIQUE_PLANE_SURFACE_NORMAL.y, 10);
    expect(renderedNormal.z).toBeCloseTo(MACRO_OBLIQUE_PLANE_SURFACE_NORMAL.z, 10);

    const renderedSurfacePoint = new THREE.Vector3(
      0,
      0,
      -MACRO_OBLIQUE_PLATE_DIMENSIONS_MM.thickness * 0.5 / 1000,
    ).applyMatrix4(plateAssembly!.matrixWorld);
    expect(renderedSurfacePoint.x).toBeCloseTo(0, 10);
    expect(renderedSurfacePoint.y).toBeCloseTo(0, 10);
    expect(renderedSurfacePoint.z).toBeCloseTo(MACRO_OBLIQUE_PLANE_SURFACE_CENTER_Z_MM / 1000, 10);

    const frontFaceZ = (mesh: THREE.Mesh): number => {
      mesh.geometry.computeBoundingBox();
      const localFront = mesh.geometry.boundingBox?.min.z;
      if (localFront === undefined) throw new Error(`${mesh.name} has no bounds`);
      return new THREE.Vector3(0, 0, localFront).applyMatrix4(mesh.matrixWorld).z;
    };
    expect(frontFaceZ(fiberglass as THREE.Mesh)).toBeGreaterThan(
      frontFaceZ(basePlate as THREE.Mesh) + 1e-4,
    );

    const subjectBounds = new THREE.Box3().setFromObject(group);
    expect(subjectBounds.min.x).toBeGreaterThanOrEqual(macroObliquePlaneSubjectBoundsMm.min.x / 1000 - 1e-6);
    expect(subjectBounds.max.x).toBeLessThanOrEqual(macroObliquePlaneSubjectBoundsMm.max.x / 1000 + 1e-6);
    expect(subjectBounds.min.y).toBeGreaterThanOrEqual(macroObliquePlaneSubjectBoundsMm.min.y / 1000 - 1e-6);
    expect(subjectBounds.max.y).toBeLessThanOrEqual(macroObliquePlaneSubjectBoundsMm.max.y / 1000 + 1e-6);
    expect(subjectBounds.min.z).toBeGreaterThanOrEqual(macroObliquePlaneSubjectBoundsMm.min.z / 1000 - 1e-6);
    expect(subjectBounds.max.z).toBeLessThanOrEqual(macroObliquePlaneSubjectBoundsMm.max.z / 1000 + 1e-6);

    for (const target of macroObliquePlaneFocusTargets) {
      for (const sample of [target.worldPosition, ...(target.sampleWorldPositions ?? [])]) {
        const ray = new THREE.Raycaster(
          new THREE.Vector3(sample.x / 1000, sample.y / 1000, 0),
          new THREE.Vector3(0, 0, 1),
        );
        const hit = ray.intersectObject(group, true)[0];
        expect(hit, `${target.id} sample (${sample.x}, ${sample.y}, ${sample.z})`).toBeDefined();
        expect(hit?.object.name).toBe("macro-oblique-base-plate");
        expect(hit?.point.z).toBeCloseTo(sample.z / 1000, 6);
      }
    }

    disposeMacroObliquePlaneGroup(group);
  });

  it("contains asymmetric PCB layers with distinct visual material roles", () => {
    const group = createMacroObliquePlaneGroup();
    group.updateMatrixWorld(true);

    for (const name of [
      "macro-oblique-pcb-board",
      "macro-oblique-pcb-pad",
      "macro-oblique-pcb-via",
      "macro-oblique-pcb-trace",
      "macro-oblique-pcb-silkscreen",
    ]) {
      const semanticLayer = group.getObjectByName(name);
      expect(semanticLayer, `${name} is missing`).toBeInstanceOf(THREE.Group);
      expect(semanticLayer?.children.length, `${name} is empty`).toBeGreaterThan(0);
    }

    expect(group.getObjectByName("macro-oblique-pcb-j1-footprint-top")).toBeDefined();
    expect(group.getObjectByName("macro-oblique-pcb-u1-outline-top")).toBeDefined();
    expect(group.getObjectByName("macro-oblique-pcb-far-footprint-top")).toBeDefined();

    const expectGlyphString = (name: string, glyphs: readonly string[]) => {
      const label = group.getObjectByName(name);
      expect(label, `${name} is missing`).toBeInstanceOf(THREE.Group);
      expect(label?.children.length, `${name} is empty`).toBeGreaterThan(1);
      for (const glyph of glyphs) {
        expect(
          label?.children.some((child) => child.name.includes(`-${glyph}-`)),
          `${name} is missing ${glyph}`,
        ).toBe(true);
      }
    };
    expectGlyphString("macro-oblique-pcb-j1-label", ["J", "1"]);
    expectGlyphString("macro-oblique-pcb-tp1-label", ["T", "P", "1"]);
    expectGlyphString("macro-oblique-pcb-u1-label", ["U", "1"]);

    const board = group.getObjectByName("macro-oblique-base-plate") as THREE.Mesh;
    const pad = group.getObjectByName("macro-oblique-pcb-connector-pad") as THREE.Mesh;
    const silkscreen = group.getObjectByName("macro-oblique-pcb-board-outline-top") as THREE.Mesh;
    const boardMaterial = board.material as THREE.MeshStandardMaterial;
    const padMaterial = pad.material as THREE.MeshStandardMaterial;
    const silkscreenMaterial = silkscreen.material as THREE.MeshStandardMaterial;

    expect(boardMaterial.metalness).toBeLessThan(0.1);
    expect(padMaterial.metalness).toBeGreaterThan(0.8);
    expect(silkscreenMaterial.metalness).toBe(0);
    expect(padMaterial.roughness).toBeLessThan(boardMaterial.roughness);

    disposeMacroObliquePlaneGroup(group);
  });

  it("shows each semantic detail region from the default Scene observer", () => {
    const group = createMacroObliquePlaneGroup();
    group.updateMatrixWorld(true);
    const observer = new THREE.Vector3(
      macroObliquePlaneCameraPlacement.position.x / 1000,
      macroObliquePlaneCameraPlacement.position.y / 1000,
      macroObliquePlaneCameraPlacement.position.z / 1000,
    );

    for (const target of macroObliquePlaneFocusTargets) {
      const targetPoint = new THREE.Vector3(
        target.worldPosition.x / 1000,
        target.worldPosition.y / 1000,
        target.worldPosition.z / 1000,
      );
      const direction = targetPoint.clone().sub(observer).normalize();
      const hit = new THREE.Raycaster(observer, direction).intersectObject(group, true)[0];

      expect(hit, `${target.id} is not visible from the default observer`).toBeDefined();
      expect(hit?.point.z).toBeCloseTo(target.worldPosition.z / 1000, 6);
    }

    disposeMacroObliquePlaneGroup(group);
  });
});
