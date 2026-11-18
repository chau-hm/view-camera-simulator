import { createHash } from "node:crypto";
import { cleanup, render } from "@testing-library/react";
import * as THREE from "three";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createArchitectureForegroundGroup,
  disposeArchitectureForegroundGroup,
} from "../../render/ArchitectureForegroundSubjectFactory";
import {
  createTableTiltGroup,
  disposeTableTiltGroup,
} from "../../render/TableTiltSubjectFactory";
import {
  ArchitectureForegroundSubject,
  TableTiltSubject,
} from "../../render/SceneAssetSubjects";
import {
  createRegisteredRttSubject,
  disposeRegisteredRttSubject,
} from "../../render/sceneSubjectRegistry";
import * as architectureForegroundAsset from "../../render/ArchitectureForegroundSubjectFactory";
import * as tableTiltAsset from "../../render/TableTiltSubjectFactory";
import architectureGeometry from "../../scenes/architectureForegroundGeometry";
import tableTiltGeometry from "../../scenes/tableTiltGeometry";
import { architectureForegroundScene } from "../../scenes/definitions/architecture-foreground";
import { tableTiltScene } from "../../scenes/definitions/table-tilt";
import { ARCHITECTURE_FOREGROUND_PRESENTATION } from "../../scenes/presentation/architectureForeground";
import { TABLE_TILT_PRESENTATION } from "../../scenes/presentation/tableTilt";
import {
  ARCHITECTURE_FOREGROUND_MATERIAL_ROLE_IDS,
  resolveArchitectureForegroundMaterialVariations,
} from "../../scenes/architectureForegroundMaterialVariation";
import {
  TABLE_TILT_MATERIAL_ROLE_IDS,
  resolveTableTiltMaterialVariations,
} from "../../scenes/tableTiltMaterialVariation";
import {
  createSceneVariantIdentity,
  resolveSceneVariationDescriptor,
} from "../../scenes/sceneVariation";
import type { SceneVariationDescriptor } from "../../types/sceneVariation";

const SEEDS = [0, 1, 284719, 0xffff_ffff] as const;

const descriptorFor = (
  scene: typeof architectureForegroundScene | typeof tableTiltScene,
  seed: number,
): SceneVariationDescriptor => {
  const descriptor = resolveSceneVariationDescriptor(
    scene,
    createSceneVariantIdentity(scene.id, seed, 1),
  );
  if (!descriptor) throw new Error(`Expected schema-v1 descriptor for ${scene.id}`);
  return descriptor;
};

const hashBytes = (bytes: Uint8Array): string =>
  createHash("sha256").update(bytes).digest("hex");

const materialSignature = (material: THREE.Material): unknown => {
  const candidate = material as THREE.Material & {
    color?: THREE.Color;
    roughness?: number;
    metalness?: number;
    normalScale?: THREE.Vector2;
  };
  const textureSlots = ["map", "roughnessMap", "normalMap"] as const;
  return {
    type: material.type,
    color: candidate.color?.getHexString(),
    roughness: candidate.roughness,
    metalness: candidate.metalness,
    normalScale: candidate.normalScale?.toArray(),
    textures: textureSlots.map((slot) => {
      const texture = (material as THREE.Material & Record<string, unknown>)[slot];
      if (!(texture instanceof THREE.DataTexture)) return [slot, null];
      const image = texture.image as { data: Uint8Array; width: number; height: number };
      return [
        slot,
        hashBytes(image.data),
        image.width,
        image.height,
        texture.repeat.toArray(),
        texture.colorSpace,
      ];
    }),
  };
};

const materialFor = (root: THREE.Group, name: string): THREE.Material => {
  const object = root.getObjectByName(name);
  if (!(object instanceof THREE.Mesh)) throw new Error(`Missing mesh ${name}`);
  return Array.isArray(object.material) ? object.material[0]! : object.material;
};

const renderSubjectSignature = (root: THREE.Group): string => {
  root.updateMatrixWorld(true);
  const nodes: unknown[] = [];
  root.traverse((object) => {
    const mesh = object instanceof THREE.Mesh ? object : null;
    const materials = mesh
      ? (Array.isArray(mesh.material) ? mesh.material : [mesh.material])
          .map(materialSignature)
      : undefined;
    nodes.push({
      type: object.type,
      name: object.name,
      matrix: object.matrix.elements.map((value) => Number(value.toPrecision(12))),
      geometry: mesh
        ? { type: mesh.geometry.type, parameters: mesh.geometry.parameters }
        : undefined,
      materials,
    });
  });
  return createHash("sha256").update(JSON.stringify(nodes)).digest("hex");
};

const geometrySignature = (root: THREE.Group): string => {
  root.updateMatrixWorld(true);
  const nodes: unknown[] = [];
  root.traverse((object) => {
    const mesh = object instanceof THREE.Mesh ? object : null;
    const geometry = mesh?.geometry;
    const attributes = geometry
      ? Object.entries(geometry.attributes)
          .map(([name, rawAttribute]) => {
            const attribute = rawAttribute as THREE.BufferAttribute;
            return [
              name,
              hashBytes(new Uint8Array(
                attribute.array.buffer,
                attribute.array.byteOffset,
                attribute.array.byteLength,
              )),
            ];
          })
          .sort(([first], [second]) => String(first).localeCompare(String(second)))
      : undefined;
    nodes.push({
      type: object.type,
      name: object.name,
      position: object.position.toArray(),
      rotation: object.rotation.toArray(),
      scale: object.scale.toArray(),
      matrixWorld: object.matrixWorld.elements.map((value) => Number(value.toPrecision(12))),
      userData: object.userData,
      geometry: geometry
        ? {
            type: geometry.type,
            parameters: geometry.parameters,
            attributes,
            index: geometry.index
              ? hashBytes(new Uint8Array(
                  geometry.index.array.buffer,
                  geometry.index.array.byteOffset,
                  geometry.index.array.byteLength,
                ))
              : null,
          }
        : undefined,
    });
  });
  return createHash("sha256").update(JSON.stringify(nodes)).digest("hex");
};

const namedRoleSignature = (
  root: THREE.Group,
  names: readonly string[],
): Readonly<Record<string, unknown>> => Object.fromEntries(
  names.map((name) => [name, materialSignature(materialFor(root, name))]),
);

const surfaceMapSignature = (root: THREE.Group, names: readonly string[]): string =>
  JSON.stringify(namedRoleSignature(root, names));

const mapBytesSignature = (root: THREE.Group, names: readonly string[]): string =>
  JSON.stringify(names.map((name) => {
    const material = materialFor(root, name) as THREE.MeshStandardMaterial;
    return [name, [material.map, material.roughnessMap, material.normalMap].map((texture) => {
      if (!(texture instanceof THREE.DataTexture)) return null;
      return hashBytes((texture.image as { data: Uint8Array }).data);
    })];
  }));

const disposalSpiesFor = (root: THREE.Group) => {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  const textureSlots = [
    "alphaMap",
    "aoMap",
    "bumpMap",
    "displacementMap",
    "emissiveMap",
    "lightMap",
    "map",
    "metalnessMap",
    "normalMap",
    "roughnessMap",
  ] as const;

  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    geometries.add(object.geometry);
    const meshMaterials = Array.isArray(object.material) ? object.material : [object.material];
    meshMaterials.forEach((material) => {
      materials.add(material);
      const withTextures = material as THREE.Material &
        Partial<Record<(typeof textureSlots)[number], THREE.Texture | null>>;
      textureSlots.forEach((slot) => {
        const texture = withTextures[slot];
        if (texture instanceof THREE.Texture) textures.add(texture);
      });
    });
  });

  return [
    ...[...geometries].map((resource) => vi.spyOn(resource, "dispose")),
    ...[...materials].map((resource) => vi.spyOn(resource, "dispose")),
    ...[...textures].map((resource) => vi.spyOn(resource, "dispose")),
  ];
};

const architectureRoleNames = [
  "architecture-foreground-building",
  "architecture-foreground-roof-parapet",
  "architecture-foreground-ground",
  "architecture-foreground-forecourt-near-curb",
  "window-1-1-top-frame",
] as const;

const tableRoleNames = [
  "table-tilt-tabletop",
  "table-tilt-apron-near",
  "table-tilt-context-near-tray",
  "table-tilt-context-middle-canister",
] as const;

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("Free Mode seeded material role resolvers", () => {
  it("resolves stable, bounded Architecture + Foreground material roles for every uint32 sample", () => {
    const signatures: string[] = [];
    for (const seed of SEEDS) {
      const descriptor = descriptorFor(architectureForegroundScene, seed);
      const variations = resolveArchitectureForegroundMaterialVariations(descriptor);
      const replay = resolveArchitectureForegroundMaterialVariations(descriptorFor(architectureForegroundScene, seed));
      expect(variations).toEqual(replay);
      expect(variations).toBeDefined();
      Object.entries(ARCHITECTURE_FOREGROUND_MATERIAL_ROLE_IDS).forEach(([role, roleId]) => {
        expect(variations![role as keyof typeof ARCHITECTURE_FOREGROUND_MATERIAL_ROLE_IDS].variationSeed).toBe(
          descriptor.createRandomStream("materials", roleId).nextUint32(),
        );
      });
      Object.values(variations!).forEach((role) => {
        expect(role.color).toMatch(/^#[0-9a-f]{6}$/i);
        expect(role.repeat.every((value) => value > 0 && value <= 6)).toBe(true);
        expect(role.roughness).toBeGreaterThanOrEqual(0.78);
        expect(role.roughness).toBeLessThanOrEqual(0.99);
        expect(role.normalStrength).toBeGreaterThan(0);
        expect(role.normalStrength).toBeLessThanOrEqual(0.07);
      });
      signatures.push(JSON.stringify(variations));
    }
    expect(new Set(signatures).size).toBe(SEEDS.length);
    expect(resolveArchitectureForegroundMaterialVariations(undefined)).toBeUndefined();
  });

  it("resolves stable, bounded Table Tilt material roles for every uint32 sample", () => {
    const signatures: string[] = [];
    for (const seed of SEEDS) {
      const descriptor = descriptorFor(tableTiltScene, seed);
      const variations = resolveTableTiltMaterialVariations(descriptor);
      const replay = resolveTableTiltMaterialVariations(descriptorFor(tableTiltScene, seed));
      expect(variations).toEqual(replay);
      expect(variations).toBeDefined();
      Object.entries(TABLE_TILT_MATERIAL_ROLE_IDS).forEach(([role, roleId]) => {
        const roleParameters = variations![role as keyof typeof TABLE_TILT_MATERIAL_ROLE_IDS];
        expect(roleParameters?.variationSeed).toBe(
          descriptor.createRandomStream("materials", roleId).nextUint32(),
        );
      });
      [variations!.tabletopWood, variations!.contextWood].forEach((role) => {
        expect(role.color).toMatch(/^#[0-9a-f]{6}$/i);
        expect(role.repeat.every((value) => value > 0 && value <= 6)).toBe(true);
        expect(role.roughness).toBeGreaterThanOrEqual(0.78);
        expect(role.roughness).toBeLessThanOrEqual(0.86);
        expect(role.normalStrength).toBeGreaterThan(0);
        expect(role.normalStrength).toBeLessThanOrEqual(0.05);
      });
      [variations!.tableFrame, variations!.contextAccent].forEach((role) => {
        expect(role.color).toMatch(/^#[0-9a-f]{6}$/i);
        expect(role.roughness).toBeGreaterThanOrEqual(0.72);
        expect(role.roughness).toBeLessThanOrEqual(0.94);
      });
      signatures.push(JSON.stringify(variations));
    }
    expect(new Set(signatures).size).toBe(SEEDS.length);
    expect(resolveTableTiltMaterialVariations(undefined)).toBeUndefined();
  });
});

describe("Free Mode seeded material subject factories", () => {
  it("preserves exact no-descriptor Architecture + Foreground and Table Tilt subjects", () => {
    const architecture = createArchitectureForegroundGroup({
      presentation: ARCHITECTURE_FOREGROUND_PRESENTATION,
    });
    const table = createTableTiltGroup({ presentation: TABLE_TILT_PRESENTATION });
    try {
      expect(renderSubjectSignature(architecture)).toBe(
        "9df7d060bf087b997143dc8c21767455083f392879b79d59230a13d7be349061",
      );
      expect(renderSubjectSignature(table)).toBe(
        "f2a65b0dab19898cd2235a17b02c23f04f84982992b5ea909873d31de0291fdc",
      );
      expect(architectureForegroundScene.sceneVariation).toEqual({ enabled: true, schemaVersion: 1 });
      expect(tableTiltScene.sceneVariation).toEqual({ enabled: true, schemaVersion: 1 });
    } finally {
      disposeArchitectureForegroundGroup(architecture);
      disposeTableTiltGroup(table);
    }
  });

  it.each([
    { scene: architectureForegroundScene, make: (seed: number) => createArchitectureForegroundGroup({ presentation: ARCHITECTURE_FOREGROUND_PRESENTATION, variationDescriptor: descriptorFor(architectureForegroundScene, seed) }), names: architectureRoleNames },
    { scene: tableTiltScene, make: (seed: number) => createTableTiltGroup({ presentation: TABLE_TILT_PRESENTATION, variationDescriptor: descriptorFor(tableTiltScene, seed) }), names: tableRoleNames },
  ])("replays seed maps and varies valid material realizations across representative seeds for $scene.id", ({ scene, make, names }) => {
    const signatures: string[] = [];
    const mapSignatures: string[] = [];
    for (const seed of SEEDS) {
      const group = make(seed);
      try {
        const signature = surfaceMapSignature(group, names);
        signatures.push(signature);
        const mappedNames = scene.id === "table-tilt"
          ? ["table-tilt-tabletop", "table-tilt-context-near-tray"]
          : names;
        mapSignatures.push(mapBytesSignature(group, mappedNames));
        const replay = make(seed);
        try {
          expect(surfaceMapSignature(replay, names)).toBe(signature);
        } finally {
          if (scene.id === "architecture-foreground") {
            disposeArchitectureForegroundGroup(replay);
          } else {
            disposeTableTiltGroup(replay);
          }
        }
        for (const name of names) {
          const material = materialFor(group, name);
          expect(material).toBeInstanceOf(THREE.MeshStandardMaterial);
          if (!(material instanceof THREE.MeshStandardMaterial)) continue;
          const textures = [material.map, material.roughnessMap, material.normalMap];
          if (name === "table-tilt-apron-near" || name === "table-tilt-context-middle-canister") {
            expect(textures.every((texture) => texture === null)).toBe(true);
          } else {
            textures.forEach((texture) => {
              expect(texture).toBeInstanceOf(THREE.DataTexture);
              expect(texture?.image).toMatchObject({ width: 128, height: 128 });
            });
          }
        }
      } finally {
        if (scene.id === "architecture-foreground") {
          disposeArchitectureForegroundGroup(group);
        } else {
          disposeTableTiltGroup(group);
        }
      }
    }
    expect(new Set(signatures).size).toBe(SEEDS.length);
    expect(new Set(mapSignatures).size).toBe(SEEDS.length);
  });

  it("routes the Architecture + Foreground descriptor to independent Observer and RTT resources", () => {
    const descriptor = descriptorFor(architectureForegroundScene, 284719);
    const factory = vi.spyOn(architectureForegroundAsset, "createArchitectureForegroundGroup");
    const view = render(<ArchitectureForegroundSubject variationDescriptor={descriptor} />);
    const observer = factory.mock.results[0]?.value as THREE.Group;
    const rtt = createRegisteredRttSubject("architecture-foreground", {
      variationDescriptor: descriptor,
    });
    if (!observer || !rtt) throw new Error("Expected both Architecture + Foreground subjects");
    const observerSpies = disposalSpiesFor(observer);
    const rttSpies = disposalSpiesFor(rtt);

    try {
      expect(factory).toHaveBeenCalledTimes(2);
      expect(factory.mock.calls.map(([request]) => request.variationDescriptor?.identity)).toEqual([
        descriptor.identity,
        descriptor.identity,
      ]);
      expect(surfaceMapSignature(observer, architectureRoleNames)).toBe(
        surfaceMapSignature(rtt, architectureRoleNames),
      );
      for (const name of architectureRoleNames) {
        const observerMesh = observer.getObjectByName(name) as THREE.Mesh;
        const rttMesh = rtt.getObjectByName(name) as THREE.Mesh;
        expect(observerMesh.geometry).not.toBe(rttMesh.geometry);
        expect(observerMesh.material).not.toBe(rttMesh.material);
        const observerMaterial = observerMesh.material as THREE.MeshStandardMaterial;
        const rttMaterial = rttMesh.material as THREE.MeshStandardMaterial;
        [observerMaterial.map, observerMaterial.roughnessMap, observerMaterial.normalMap]
          .forEach((texture, index) => {
            if (texture) {
              expect(texture).not.toBe([
                rttMaterial.map,
                rttMaterial.roughnessMap,
                rttMaterial.normalMap,
              ][index]);
            }
          });
      }
    } finally {
      view.unmount();
      disposeRegisteredRttSubject("architecture-foreground", rtt);
      observerSpies.forEach((spy) => expect(spy).toHaveBeenCalledTimes(1));
      rttSpies.forEach((spy) => expect(spy).toHaveBeenCalledTimes(1));
    }
  }, 15_000);

  it("routes the Table Tilt descriptor to independent Observer and RTT resources", () => {
    const descriptor = descriptorFor(tableTiltScene, 284719);
    const factory = vi.spyOn(tableTiltAsset, "createTableTiltGroup");
    const view = render(<TableTiltSubject variationDescriptor={descriptor} />);
    const observer = factory.mock.results[0]?.value as THREE.Group;
    const rtt = createRegisteredRttSubject("table-tilt", {
      variationDescriptor: descriptor,
    });
    if (!observer || !rtt) throw new Error("Expected both Table Tilt subjects");
    const observerSpies = disposalSpiesFor(observer);
    const rttSpies = disposalSpiesFor(rtt);

    try {
      expect(factory).toHaveBeenCalledTimes(2);
      expect(factory.mock.calls.map(([request]) => request.variationDescriptor?.identity)).toEqual([
        descriptor.identity,
        descriptor.identity,
      ]);
      expect(surfaceMapSignature(observer, tableRoleNames)).toBe(
        surfaceMapSignature(rtt, tableRoleNames),
      );
      for (const name of tableRoleNames) {
        const observerMesh = observer.getObjectByName(name) as THREE.Mesh;
        const rttMesh = rtt.getObjectByName(name) as THREE.Mesh;
        expect(observerMesh.geometry).not.toBe(rttMesh.geometry);
        expect(observerMesh.material).not.toBe(rttMesh.material);
        const observerMaterial = observerMesh.material as THREE.MeshStandardMaterial;
        const rttMaterial = rttMesh.material as THREE.MeshStandardMaterial;
        [observerMaterial.map, observerMaterial.roughnessMap, observerMaterial.normalMap]
          .forEach((texture, index) => {
            if (texture) {
              expect(texture).not.toBe([
                rttMaterial.map,
                rttMaterial.roughnessMap,
                rttMaterial.normalMap,
              ][index]);
            }
          });
      }
      const observerFrame = materialFor(observer, "table-tilt-apron-near");
      const observerSupport = materialFor(observer, "table-tilt-support-near-left");
      expect(observerFrame).toBe(observerSupport);
    } finally {
      view.unmount();
      disposeRegisteredRttSubject("table-tilt", rtt);
      observerSpies.forEach((spy) => expect(spy).toHaveBeenCalledTimes(1));
      rttSpies.forEach((spy) => expect(spy).toHaveBeenCalledTimes(1));
    }
  });

  it.each([
    {
      scene: architectureForegroundScene,
      make: (seed: number) => createArchitectureForegroundGroup({ presentation: ARCHITECTURE_FOREGROUND_PRESENTATION, variationDescriptor: descriptorFor(architectureForegroundScene, seed) }),
      dispose: disposeArchitectureForegroundGroup,
      facade: "architecture-foreground-front-facade",
      protectedNames: ["architecture-foreground-front-facade"],
    },
    {
      scene: tableTiltScene,
      make: (seed: number) => createTableTiltGroup({ presentation: TABLE_TILT_PRESENTATION, variationDescriptor: descriptorFor(tableTiltScene, seed) }),
      dispose: disposeTableTiltGroup,
      protectedNames: ["table-tilt-tabletop-guide-1", "table-tilt-near-cup-stripe-1", "table-tilt-near-cup-focus-card-band-1", "table-tilt-mid-notebook-line-1", "table-tilt-far-book-focus-chart-surface", "table-tilt-far-book-chart-1-1"],
      facade: undefined,
    },
  ])("leaves $scene.id canonical geometry and focus-critical materials unchanged", ({ scene, make, dispose, protectedNames, facade }) => {
    const canonical = scene.id === "architecture-foreground"
      ? createArchitectureForegroundGroup({ presentation: ARCHITECTURE_FOREGROUND_PRESENTATION })
      : createTableTiltGroup({ presentation: TABLE_TILT_PRESENTATION });
    const expectedGeometry = geometrySignature(canonical);
    const expectedProtectedMaterials = namedRoleSignature(canonical, protectedNames);

    try {
      for (const seed of SEEDS) {
        const seeded = make(seed);
        try {
          expect(geometrySignature(seeded)).toBe(expectedGeometry);
          expect(namedRoleSignature(seeded, protectedNames)).toEqual(expectedProtectedMaterials);
          if (facade) {
            expect(materialSignature(materialFor(seeded, facade))).toEqual(
              materialSignature(materialFor(canonical, facade)),
            );
          }
        } finally {
          dispose(seeded);
        }
      }
      if (scene.id === "architecture-foreground") {
        expect(architectureForegroundScene.focusTargets).toEqual(architectureGeometry.focusTargets);
        expect(architectureForegroundScene.compositionTargets.map(({ worldBounds }) => worldBounds))
          .toEqual([
            architectureGeometry.compositionTargets.buildingTop,
            architectureGeometry.compositionTargets.buildingBase,
            architectureGeometry.compositionTargets.buildingMain,
          ]);
      } else {
        expect(tableTiltScene.focusTargets).toEqual(tableTiltGeometry.focusTargets);
        expect(tableTiltScene.compositionTargets[0]?.worldBounds).toEqual(tableTiltGeometry.compositionTargetBounds);
      }
    } finally {
      if (scene.id === "architecture-foreground") {
        disposeArchitectureForegroundGroup(canonical);
      } else {
        disposeTableTiltGroup(canonical);
      }
    }
  });
});
