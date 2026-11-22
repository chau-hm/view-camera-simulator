import { createHash } from "node:crypto";
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import {
  createArchitectureRiseGroup,
  disposeArchitectureRiseGroup,
} from "../../render/ArchitectureRiseSubjectFactory";
import {
  ARCHITECTURE_RISE_MATERIAL_ROLE_IDS,
  resolveArchitectureRiseMaterialVariation,
} from "../../scenes/architectureRiseMaterialVariation";
import { architectureRiseScene } from "../../scenes/definitions/architecture-rise";
import { ARCHITECTURE_RISE_PRESENTATION } from "../../scenes/presentation/architectureRise";
import { createSceneVariantIdentity, resolveSceneVariationDescriptor } from "../../scenes/sceneVariation";
import { collectSceneGraphCapacity } from "../../render/sceneCapacityProfiling";

type ArchitectureRiseResources = Readonly<Record<string, unknown>>;

const EXPECTED_ARCHITECTURE_RISE_CAPACITY = {
  meshCount: 474,
  renderableMeshCount: 474,
  uniqueGeometryCount: 63,
  uniqueMaterialCount: 17,
  uniqueTextureCount: 18,
  triangleCount: 6734,
  effectiveTriangleCount: 6734,
  renderableEffectiveTriangleCount: 6734,
} as const;

const sha256 = (bytes: ArrayBufferView): string =>
  createHash("sha256")
    .update(Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength))
    .digest("hex");

const textureSignature = (texture: THREE.Texture | null): unknown => {
  if (!texture) return null;
  const image = texture.image as { data?: ArrayBufferView; width?: number; height?: number };
  return {
    width: image.width,
    height: image.height,
    bytes: image.data ? sha256(image.data) : null,
    colorSpace: texture.colorSpace,
    wrapS: texture.wrapS,
    wrapT: texture.wrapT,
    magFilter: texture.magFilter,
    minFilter: texture.minFilter,
    generateMipmaps: texture.generateMipmaps,
    anisotropy: texture.anisotropy,
    repeat: texture.repeat.toArray(),
    offset: texture.offset.toArray(),
  };
};

const materialSignature = (material: THREE.Material): unknown => {
  const standard = material as THREE.MeshStandardMaterial;
  return {
    type: material.type,
    color: "color" in material && material.color instanceof THREE.Color
      ? `#${material.color.getHexString(THREE.SRGBColorSpace)}`
      : undefined,
    roughness: "roughness" in material ? standard.roughness : undefined,
    metalness: "metalness" in material ? standard.metalness : undefined,
    normalScale: "normalScale" in material ? standard.normalScale.toArray() : undefined,
    map: textureSignature(standard.map ?? null),
    roughnessMap: textureSignature(standard.roughnessMap ?? null),
    normalMap: textureSignature(standard.normalMap ?? null),
  };
};

const resourceMaterialSnapshot = (resources: ArchitectureRiseResources): unknown =>
  Object.fromEntries(Object.entries(resources)
    .filter(([, resource]) => resource instanceof THREE.Material)
    .map(([name, material]) => [name, materialSignature(material as THREE.Material)])
    .sort(([left], [right]) => String(left).localeCompare(String(right))));

const groupGeometrySignature = (group: THREE.Group): string => {
  group.updateMatrixWorld(true);
  const meshes: unknown[] = [];
  group.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const attributes = Object.fromEntries(Object.entries(
      object.geometry.attributes as Record<string, THREE.BufferAttribute>,
    )
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([name, attribute]) => [name, sha256(attribute.array)]));
    meshes.push({
      name: object.name,
      matrixWorld: object.matrixWorld.elements,
      attributes,
      index: object.geometry.index ? sha256(object.geometry.index.array) : null,
    });
  });
  return createHash("sha256").update(JSON.stringify(meshes)).digest("hex");
};

describe("Architecture Rise material variation baseline", () => {
  it("records the current canonical material and mounted geometry signatures", () => {
    const group = createArchitectureRiseGroup({ presentation: ARCHITECTURE_RISE_PRESENTATION });
    const resources = group.userData.resources as ArchitectureRiseResources;
    try {
      expect(groupGeometrySignature(group)).toBe(
        "280080d8806991845b56aaf2f2ea2ad5aba6b0407213bbcc29fdbf168e9f4da4",
      );
      expect(collectSceneGraphCapacity(group)).toMatchObject(EXPECTED_ARCHITECTURE_RISE_CAPACITY);
      expect(createHash("sha256").update(JSON.stringify(resourceMaterialSnapshot(resources))).digest("hex"))
        .toBe("eb7c64c6ce11ba1330fd533b6a16d6b68ad251e8b039fe0b91865ecf31ce71bc");
      const facade = resources.facade as THREE.MeshStandardMaterial;
      expect([
        textureSignature(facade.map),
        textureSignature(facade.roughnessMap),
        textureSignature(facade.normalMap),
      ]).toEqual([
        expect.objectContaining({ bytes: "1640a923fda3bef2da1123a633e02ea4f4962e6e116e4bd821ddf81cd6d27fc4" }),
        expect.objectContaining({ bytes: "12ec52ae47528dded4a86eaeddf6287acce3790de9c55ca7e9792339bbe9bc98" }),
        expect.objectContaining({ bytes: "a03c6cbb2779c57f1ad4f7f2c50a1d1cc2ddd367720c6d38ec9c6401eea00cb2" }),
      ]);
    } finally {
      disposeArchitectureRiseGroup(group);
    }
  });

  it("advertises the schema-v1 Free Mode variation contract", () => {
    expect(architectureRiseScene.sceneVariation).toEqual({ enabled: true, schemaVersion: 1 });
  });

  it("resolves all four coherent families across the frozen seed sample", () => {
    const seeds = [
      0, 1, 284719, 4294967295, 3079748268, 654013979,
      4041585854, 2762659077, 2004402848, 1824298367,
      2130322642, 4065361417,
    ];
    const plans = seeds.map((seed) => resolveArchitectureRiseMaterialVariation(
      resolveSceneVariationDescriptor(
        architectureRiseScene,
        createSceneVariantIdentity(architectureRiseScene.id, seed, 1),
      ) ?? undefined,
    )!);
    const families = new Set(plans.map((plan) => plan.familyId));
    expect(plans.map((plan) => plan.familyId)).toEqual([
      "weathered-brown-brick",
      "weathered-brown-brick",
      "traditional-red-brick",
      "weathered-brown-brick",
      "light-clay-brick",
      "light-clay-brick",
      "weathered-brown-brick",
      "traditional-red-brick",
      "light-clay-brick",
      "light-clay-brick",
      "dark-fired-brick",
      "dark-fired-brick",
    ]);
    expect(families).toEqual(new Set([
      "traditional-red-brick",
      "weathered-brown-brick",
      "light-clay-brick",
      "dark-fired-brick",
    ]));
    expect(new Set(Object.values(ARCHITECTURE_RISE_MATERIAL_ROLE_IDS)).size)
      .toBe(Object.keys(ARCHITECTURE_RISE_MATERIAL_ROLE_IDS).length);
    expect(plans[2]).toEqual(resolveArchitectureRiseMaterialVariation(
      resolveSceneVariationDescriptor(
        architectureRiseScene,
        createSceneVariantIdentity(architectureRiseScene.id, 284719, 1),
      ) ?? undefined,
    ));
  });

  it("keeps seeded geometry and material maps deterministic while owning each subject independently", () => {
    const descriptor = resolveSceneVariationDescriptor(
      architectureRiseScene,
      createSceneVariantIdentity(architectureRiseScene.id, 284719, 1),
    )!;
    const first = createArchitectureRiseGroup({
      presentation: ARCHITECTURE_RISE_PRESENTATION,
      variationDescriptor: descriptor,
    });
    const second = createArchitectureRiseGroup({
      presentation: ARCHITECTURE_RISE_PRESENTATION,
      variationDescriptor: descriptor,
    });
    const firstResources = first.userData.resources as ArchitectureRiseResources;
    const secondResources = second.userData.resources as ArchitectureRiseResources;
    try {
      expect(groupGeometrySignature(first)).toBe(
        "280080d8806991845b56aaf2f2ea2ad5aba6b0407213bbcc29fdbf168e9f4da4",
      );
      expect(groupGeometrySignature(second)).toBe(groupGeometrySignature(first));
      expect(collectSceneGraphCapacity(first)).toMatchObject(EXPECTED_ARCHITECTURE_RISE_CAPACITY);
      expect(collectSceneGraphCapacity(second)).toMatchObject(EXPECTED_ARCHITECTURE_RISE_CAPACITY);
      expect(resourceMaterialSnapshot(secondResources)).toEqual(resourceMaterialSnapshot(firstResources));
      expect(firstResources.facade).not.toBe(secondResources.facade);
      expect((firstResources.facade as THREE.MeshStandardMaterial).map)
        .not.toBe((secondResources.facade as THREE.MeshStandardMaterial).map);
      expect((firstResources.facade as THREE.MeshStandardMaterial).userData.architectureRiseBrick)
        .toMatchObject({
          brickLengthMm: 220,
          brickHeightMm: 68,
          mortarJointMm: 8,
          tileWidthMm: 1824,
          tileHeightMm: 608,
          realizationSeed: expect.any(Number),
        });
      expect(architectureRiseScene.focusTargets).toMatchObject([
        {
          id: "building-mid-facade",
          worldPosition: { x: 0, y: 900, z: 8890 },
          weight: 1,
        },
      ]);
      expect(architectureRiseScene.compositionTargets).toMatchObject([
        {
          id: "building-top",
          worldBounds: {
            min: { x: -900, y: 2920, z: 8500 },
            max: { x: 900, y: 3730, z: 10500 },
          },
        },
        {
          id: "building-main-body",
          worldBounds: {
            min: { x: -1400, y: -1000, z: 8300 },
            max: { x: 1400, y: 2600, z: 11500 },
          },
        },
      ]);
    } finally {
      disposeArchitectureRiseGroup(first);
      disposeArchitectureRiseGroup(second);
    }
  }, 20_000);

  it("changes the selected material realization without changing geometry", () => {
    const build = (seed: number) => createArchitectureRiseGroup({
      presentation: ARCHITECTURE_RISE_PRESENTATION,
      variationDescriptor: resolveSceneVariationDescriptor(
        architectureRiseScene,
        createSceneVariantIdentity(architectureRiseScene.id, seed, 1),
      )!,
    });
    const first = build(0);
    const second = build(284719);
    try {
      expect(groupGeometrySignature(second)).toBe(groupGeometrySignature(first));
      const firstResources = first.userData.resources as ArchitectureRiseResources;
      const secondResources = second.userData.resources as ArchitectureRiseResources;
      expect(resourceMaterialSnapshot(secondResources)).not.toEqual(resourceMaterialSnapshot(firstResources));
    } finally {
      disposeArchitectureRiseGroup(first);
      disposeArchitectureRiseGroup(second);
    }
  });
});
