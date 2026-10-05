import * as THREE from "three";
import { describe, expect, it } from "vitest";
import {
  createArchitectureRiseGroup,
  disposeArchitectureRiseGroup,
} from "../../render/ArchitectureRiseSubjectFactory";
import { ARCHITECTURE_RISE_PRESENTATION } from "../../scenes/presentation/architectureRise";

describe("Architecture Rise glazing material", () => {
  it("keeps one shared baseline PBR recipe for front and side glazing", () => {
    const group = createArchitectureRiseGroup({
      presentation: ARCHITECTURE_RISE_PRESENTATION,
    });
    let glassDisposed = false;

    try {
      const glazingMeshes: THREE.Mesh[] = [];
      group.traverse((object) => {
        if (object instanceof THREE.Mesh && object.name.endsWith("-glazing")) {
          glazingMeshes.push(object);
        }
      });

      const frontGlazing = glazingMeshes.find((mesh) =>
        mesh.name.startsWith("architecture-rise-facade-window-bay-"),
      );
      const sideGlazing = glazingMeshes.find((mesh) =>
        mesh.name.startsWith("architecture-rise-side-return-window-bay-"),
      );

      expect(frontGlazing).toBeDefined();
      expect(sideGlazing).toBeDefined();
      expect(glazingMeshes.length).toBeGreaterThan(1);
      expect(new Set(glazingMeshes.map((mesh) => mesh.material)).size).toBe(1);

      const glass = frontGlazing?.material;
      expect(glass?.constructor).toBe(THREE.MeshStandardMaterial);
      if (!(glass instanceof THREE.MeshStandardMaterial)) return;

      expect(sideGlazing?.material).toBe(glass);
      expect(glass.color.getHex()).toBe(0x182d37);
      expect(glass.roughness).toBe(0.24);
      expect(glass.metalness).toBe(0.08);

      glass.addEventListener("dispose", () => {
        glassDisposed = true;
      });
    } finally {
      disposeArchitectureRiseGroup(group);
    }

    expect(glassDisposed).toBe(true);
  });
});
