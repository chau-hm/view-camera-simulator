import * as THREE from "three";
import { describe, expect, it } from "vitest";
import {
  createProceduralSurfaceMaterial,
  type ProceduralSurfacePattern,
} from "../../render/ProceduralSurfaceMaterials";
import { disposeTeachingSubjectResources } from "../../render/TeachingMaterials";
import {
  createArchitectureRiseGroup,
  disposeArchitectureRiseGroup,
} from "../../render/ArchitectureRiseSubjectFactory";
import { ARCHITECTURE_RISE_PRESENTATION } from "../../scenes/presentation/architectureRise";

const materialOptions = {
  color: "#d7c19c",
  pattern: "limestone",
  repeat: [3, 3] as const,
  roughness: 0.94,
  normalStrength: 0.3,
} as const;

const surfacePatterns = [
  "limestone",
  "cut-stone",
  "concrete",
  "plaster",
  "wood",
] as const satisfies readonly ProceduralSurfacePattern[];

const disposeMaterial = (material: THREE.MeshStandardMaterial): void => {
  const root = new THREE.Group();
  root.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material));
  disposeTeachingSubjectResources(root);
};

const mapBytes = (material: THREE.MeshStandardMaterial): Uint8Array[] => {
  const maps = [material.map, material.roughnessMap, material.normalMap];
  return maps.map((map) => {
    if (!(map instanceof THREE.DataTexture)) {
      throw new Error("Expected all procedural maps to be DataTextures");
    }
    return map.image.data as Uint8Array;
  });
};

describe("procedural surface materials", () => {
  it.each(surfacePatterns)("generates deterministic map bytes for the %s pattern", (pattern) => {
    const options = { ...materialOptions, pattern };
    const first = createProceduralSurfaceMaterial(options);
    const second = createProceduralSurfaceMaterial(options);

    try {
      mapBytes(first).forEach((bytes, index) => {
        expect(bytes).toEqual(mapBytes(second)[index]);
      });
    } finally {
      disposeMaterial(first);
      disposeMaterial(second);
    }
  });

  it("attaches 128 by 128 maps with the expected color spaces and sampling", () => {
    const material = createProceduralSurfaceMaterial(materialOptions);

    try {
      expect(material).toBeInstanceOf(THREE.MeshStandardMaterial);
      expect(material.map).toBeInstanceOf(THREE.DataTexture);
      expect(material.roughnessMap).toBeInstanceOf(THREE.DataTexture);
      expect(material.normalMap).toBeInstanceOf(THREE.DataTexture);

      const [albedo, roughness, normal] = [
        material.map,
        material.roughnessMap,
        material.normalMap,
      ];
      [albedo, roughness, normal].forEach((texture) => {
        expect(texture?.image).toMatchObject({ width: 128, height: 128 });
        expect(texture?.wrapS).toBe(THREE.RepeatWrapping);
        expect(texture?.wrapT).toBe(THREE.RepeatWrapping);
        expect(texture?.magFilter).toBe(THREE.LinearFilter);
        expect(texture?.minFilter).toBe(THREE.LinearMipmapLinearFilter);
        expect(texture?.generateMipmaps).toBe(true);
        expect(texture?.repeat.x).toBe(3);
        expect(texture?.repeat.y).toBe(3);
      });

      expect(albedo?.colorSpace).toBe(THREE.SRGBColorSpace);
      expect(roughness?.colorSpace).toBe(THREE.NoColorSpace);
      expect(normal?.colorSpace).toBe(THREE.NoColorSpace);
      expect(material.roughness).toBe(0.94);
      expect(material.metalness).toBe(0);
      expect(material.normalScale.x).toBe(0.3);
      expect(material.normalScale.y).toBe(0.3);
    } finally {
      disposeMaterial(material);
    }
  });

  it("keeps each supported surface pattern structurally distinct", () => {
    const materials = surfacePatterns.map((pattern) =>
      createProceduralSurfaceMaterial({ ...materialOptions, pattern }),
    );

    try {
      const signatures = materials.map((material) =>
        mapBytes(material).map((bytes) => Array.from(bytes).join(",")).join("|"),
      );
      expect(new Set(signatures).size).toBe(surfacePatterns.length);
    } finally {
      materials.forEach(disposeMaterial);
    }
  });

  it("routes all generated maps through the existing subject disposer", () => {
    const root = new THREE.Group();
    const material = createProceduralSurfaceMaterial(materialOptions);
    const maps = [material.map, material.roughnessMap, material.normalMap];
    const disposed = maps.map(() => false);
    maps.forEach((map, index) => {
      map?.addEventListener("dispose", () => {
        disposed[index] = true;
      });
    });
    root.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material));

    disposeTeachingSubjectResources(root);

    expect(disposed).toEqual([true, true, true]);
  });

  it("keeps Architecture Rise recipe ownership and mapped surface shape", () => {
    const group = createArchitectureRiseGroup({
      presentation: ARCHITECTURE_RISE_PRESENTATION,
    });
    const expectedSurfaces = [
      { name: "architecture-rise-primary-facade", repeat: [3, 3], normalStrength: 0.3 },
      { name: "architecture-rise-roof-parapet", repeat: [1, 1], normalStrength: 0.14 },
      { name: "architecture-rise-roof-coping-front", repeat: [1, 1], normalStrength: 0.12 },
      { name: "architecture-rise-sidewalk-slab", repeat: [10, 8], normalStrength: 0.1 },
    ] as const;

    try {
      const recipeMaterials = new Set<THREE.MeshStandardMaterial>();
      expectedSurfaces.forEach(({ name, repeat, normalStrength }) => {
        const mesh = group.getObjectByName(name);
        expect(mesh).toBeInstanceOf(THREE.Mesh);
        if (!(mesh instanceof THREE.Mesh)) return;
        expect(mesh.material).toBeInstanceOf(THREE.MeshStandardMaterial);
        if (!(mesh.material instanceof THREE.MeshStandardMaterial)) return;
        recipeMaterials.add(mesh.material);
        expect(mesh.material.map).toBeInstanceOf(THREE.DataTexture);
        expect(mesh.material.roughnessMap).toBeInstanceOf(THREE.DataTexture);
        expect(mesh.material.normalMap).toBeInstanceOf(THREE.DataTexture);
        expect(mesh.material.map?.repeat.x).toBe(repeat[0]);
        expect(mesh.material.map?.repeat.y).toBe(repeat[1]);
        expect(mesh.material.normalScale.x).toBe(normalStrength);
        expect(mesh.material.normalScale.y).toBe(normalStrength);
      });

      expect(recipeMaterials.size).toBe(4);
      expect(
        new Set(
          [...recipeMaterials].flatMap((material) => [
            material.map,
            material.roughnessMap,
            material.normalMap,
          ]),
        ).size,
      ).toBe(12);
    } finally {
      disposeArchitectureRiseGroup(group);
    }
  });
});
