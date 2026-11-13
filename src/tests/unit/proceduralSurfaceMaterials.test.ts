import { createHash } from "node:crypto";
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
  color: "#cfb992",
  pattern: "limestone",
  repeat: [4, 4] as const,
  roughness: 0.9,
  normalStrength: 0.38,
} as const;

const surfacePatterns = [
  "limestone",
  "cut-stone",
  "concrete",
  "plaster",
  "wood",
  "paper",
  "fabric",
] as const satisfies readonly ProceduralSurfacePattern[];

const existingPatterns = [
  "limestone",
  "cut-stone",
  "concrete",
  "plaster",
  "wood",
] as const;

const existingPatternMapHashes: Record<(typeof existingPatterns)[number], readonly string[]> = {
  limestone: [
    "078aa6ca975ca84639965cdb50de9d498894925a94d3e91d6e7d95ab5ee717f4",
    "f9480559508fb5d13fcc28e2905602fbf738aae2070b7b76838499599edcba8f",
    "28348dbeaa4f05ea6704d024c7c30257aef35f17dd478d4463bb874e46170273",
  ],
  "cut-stone": [
    "0b8b5b576b5f6b896101aecf32da1ac8d86ed5540a0bdff7a80095f2313e193f",
    "e5c63584c76459da719bb810c7cd78ca32d649a88f4d58a97b2e92eabfdfac0c",
    "bfa6000abd7bd12d50ce0e812f1d0339d10511d22e47c81a217863decaa5bd89",
  ],
  concrete: [
    "c46c90059629e4069aea9b4e9be9d9017cbac01a1570613ce5479f974a225a14",
    "6f680e4e5de30b1b5a68a57648bb9490fe3d7132f786655301bf44167ee12e6a",
    "81a86c11b1318af1f29e588ba552c2eafa662cef4c6e8cd1d3501417755ab968",
  ],
  plaster: [
    "71fe1a9ea0458350ccafad67b6dcf6ab59cc7548bf91ceba3f0ed5276bc522f0",
    "eaddfc2b47f4451023e68c72ead0a506e4b3e6d0154ad07658b384766c6a6476",
    "76e7564d7c3376acfe2f9579ae8971bf4f7d7c37bf14f8bd6abc3cba3155482a",
  ],
  wood: [
    "0c7eb4520a34beeb6d651158b3686aa2e0d7325e0e745904dafb0d317674fe74",
    "ebee11a1610d9134dc64b4970f30c2201c5c8a48b19ad390b3d0b919dca741d9",
    "0571e83205e73331a2b6ec26a40b6376fd6a45ff7e940cfdf36e68fef11c74c7",
  ],
};

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
      const secondMaps = mapBytes(second);
      mapBytes(first).forEach((bytes, index) => {
        expect(bytes).toEqual(secondMaps[index]);
      });
    } finally {
      disposeMaterial(first);
      disposeMaterial(second);
    }
  });

  it.each(surfacePatterns)("attaches the standard maps and material options for %s", (pattern) => {
    const material = createProceduralSurfaceMaterial({ ...materialOptions, pattern });

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
        expect(texture?.repeat.x).toBe(4);
        expect(texture?.repeat.y).toBe(4);
      });

      expect(albedo?.colorSpace).toBe(THREE.SRGBColorSpace);
      expect(roughness?.colorSpace).toBe(THREE.NoColorSpace);
      expect(normal?.colorSpace).toBe(THREE.NoColorSpace);
      expect(material.roughness).toBe(0.9);
      expect(material.metalness).toBe(0);
      expect(material.normalScale.x).toBe(0.38);
      expect(material.normalScale.y).toBe(0.38);
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

  it.each(existingPatterns)("preserves the original %s map bytes", (pattern) => {
    const material = createProceduralSurfaceMaterial({ ...materialOptions, pattern });

    try {
      const hashes = mapBytes(material).map((bytes) =>
        createHash("sha256").update(bytes).digest("hex"),
      );
      expect(hashes).toEqual(existingPatternMapHashes[pattern]);
    } finally {
      disposeMaterial(material);
    }
  });

  it.each(["paper", "fabric"] as const)("keeps the %s texture wrap boundary continuous", (pattern) => {
    const material = createProceduralSurfaceMaterial({ ...materialOptions, pattern });

    try {
      const averageDifference = (data: Uint8Array, leftX: number, rightX: number): number => {
        let total = 0;
        for (let y = 0; y < 128; y += 1) {
          const left = (y * 128 + leftX) * 4;
          const right = (y * 128 + rightX) * 4;
          total += Math.abs(data[left] - data[right]);
          total += Math.abs(data[left + 1] - data[right + 1]);
          total += Math.abs(data[left + 2] - data[right + 2]);
        }
        return total / (128 * 3);
      };
      const [albedo] = mapBytes(material);
      const seamDifference = averageDifference(albedo, 127, 0);
      const typicalDifference = averageDifference(albedo, 63, 64);

      expect(seamDifference).toBeLessThanOrEqual(typicalDifference * 1.35 + 0.5);
    } finally {
      disposeMaterial(material);
    }
  });

  it.each(["paper", "fabric"] as const)("keeps %s appearance variation restrained", (pattern) => {
    const material = createProceduralSurfaceMaterial({ ...materialOptions, pattern });

    try {
      const [albedo, roughness] = mapBytes(material);
      let minimumAlbedo = Infinity;
      let maximumAlbedo = -Infinity;
      let minimumRoughness = Infinity;
      let maximumRoughness = -Infinity;
      for (let index = 0; index < albedo.length; index += 4) {
        const tone = (albedo[index] + albedo[index + 1] + albedo[index + 2]) / 3;
        minimumAlbedo = Math.min(minimumAlbedo, tone);
        maximumAlbedo = Math.max(maximumAlbedo, tone);
        minimumRoughness = Math.min(minimumRoughness, roughness[index]);
        maximumRoughness = Math.max(maximumRoughness, roughness[index]);
      }

      expect(maximumAlbedo - minimumAlbedo).toBeLessThanOrEqual(18);
      expect(maximumRoughness).toBeGreaterThanOrEqual(235);
      expect(maximumRoughness - minimumRoughness).toBeLessThanOrEqual(24);
    } finally {
      disposeMaterial(material);
    }
  });

  it.each(surfacePatterns)("constructs a neutral-forward tangent-space normal map for %s", (pattern) => {
    const material = createProceduralSurfaceMaterial({ ...materialOptions, pattern });

    try {
      const normal = material.normalMap;
      expect(normal).toBeInstanceOf(THREE.DataTexture);
      if (!(normal instanceof THREE.DataTexture)) return;
      const bytes = normal.image.data as Uint8Array;
      const red = new Set<number>();
      const green = new Set<number>();
      for (let index = 0; index < bytes.length; index += 4) {
        red.add(bytes[index]);
        green.add(bytes[index + 1]);
        expect(bytes[index + 2]).toBe(255);
        expect(bytes[index + 3]).toBe(255);
      }

      expect(red.size).toBeGreaterThan(1);
      expect(green.size).toBeGreaterThan(1);
      expect([...red]).toContain(128);
      expect([...green]).toContain(128);
    } finally {
      disposeMaterial(material);
    }
  });

  it.each(surfacePatterns)("routes all %s maps through the existing subject disposer", (pattern) => {
    const root = new THREE.Group();
    const material = createProceduralSurfaceMaterial({ ...materialOptions, pattern });
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
      { name: "architecture-rise-primary-facade", repeat: [4, 4], normalStrength: 0.38 },
      { name: "architecture-rise-roof-parapet", repeat: [1, 1], normalStrength: 0.18 },
      { name: "architecture-rise-roof-coping-front", repeat: [1, 1], normalStrength: 0.09 },
      { name: "architecture-rise-sidewalk-slab", repeat: [12, 10], normalStrength: 0.14 },
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
