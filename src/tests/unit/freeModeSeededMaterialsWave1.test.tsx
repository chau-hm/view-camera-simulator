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
  ARCHITECTURE_FOREGROUND_STYLE_IDS,
  resolveArchitectureForegroundMaterialVariations,
} from "../../scenes/architectureForegroundMaterialVariation";
import {
  TABLE_TILT_MATERIAL_ROLE_IDS,
  TABLE_TILT_STYLE_IDS,
  resolveTableTiltMaterialVariations,
} from "../../scenes/tableTiltMaterialVariation";
import {
  createSceneVariantIdentity,
  resolveSceneVariationDescriptor,
} from "../../scenes/sceneVariation";
import type { SceneVariationDescriptor } from "../../types/sceneVariation";

const SEEDS = [0, 1, 284719, 0xffff_ffff] as const;
const FROZEN_FAMILY_COVERAGE_SEEDS = [
  ...SEEDS,
  17,
  2024,
  8675309,
  123456789,
  987654321,
  2718281828,
  3141592653,
  4000000000,
] as const;

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
  "architecture-foreground-front-base",
  "architecture-foreground-front-window-stone",
  "architecture-foreground-front-window-edges",
  "architecture-foreground-front-mullions",
  "architecture-foreground-front-joinery",
  "architecture-foreground-front-glazing",
  "architecture-foreground-front-transom",
  "architecture-foreground-roof",
  "architecture-foreground-ground",
  "architecture-foreground-forecourt-near-curb",
  "architecture-foreground-forecourt-return-left",
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
    const families = new Set<string>();
    for (const seed of FROZEN_FAMILY_COVERAGE_SEEDS) {
      const descriptor = descriptorFor(architectureForegroundScene, seed);
      const variations = resolveArchitectureForegroundMaterialVariations(descriptor);
      const replay = resolveArchitectureForegroundMaterialVariations(descriptorFor(architectureForegroundScene, seed));
      expect(variations).toEqual(replay);
      expect(variations).toBeDefined();
      expect(ARCHITECTURE_FOREGROUND_STYLE_IDS).toContain(variations!.appearanceFamily);
      expect(variations!.appearanceFamily).toBe(
        descriptor.createRandomStream("materials", "scene-style")
          .pick(ARCHITECTURE_FOREGROUND_STYLE_IDS),
      );
      families.add(variations!.appearanceFamily);
      Object.entries(ARCHITECTURE_FOREGROUND_MATERIAL_ROLE_IDS).forEach(([role, roleId]) => {
        expect(variations![role as keyof typeof ARCHITECTURE_FOREGROUND_MATERIAL_ROLE_IDS].variationSeed).toBe(
          descriptor.createRandomStream("materials", roleId).nextUint32(),
        );
      });
      [variations!.plaster, variations!.rusticatedLimestone].forEach((role) => {
        expect(role.color).toMatch(/^#[0-9a-f]{6}$/i);
        expect(role.repeat.every((value) => value > 0 && value <= 3)).toBe(true);
        expect(role.roughness).toBeGreaterThanOrEqual(0.89);
        expect(role.roughness).toBeLessThanOrEqual(0.93);
        expect(role.normalStrength).toBeGreaterThan(0);
        expect(role.normalStrength).toBeLessThanOrEqual(0.28);
      });
      [
        variations!.trim,
        variations!.cap,
        variations!.mullion,
        variations!.roof,
        variations!.paving,
        variations!.curb,
        variations!.returns,
      ].forEach((role) => {
        expect(role.color).toMatch(/^#[0-9a-f]{6}$/i);
        expect(role.roughness).toBeGreaterThanOrEqual(0.76);
        expect(role.roughness).toBeLessThanOrEqual(0.995);
      });
      signatures.push(JSON.stringify(variations));
    }
    expect(new Set(signatures).size).toBe(FROZEN_FAMILY_COVERAGE_SEEDS.length);
    expect(families.size).toBeGreaterThanOrEqual(3);
    expect(resolveArchitectureForegroundMaterialVariations(undefined)).toBeUndefined();
  });

  it("resolves stable, bounded Table Tilt material roles for every uint32 sample", () => {
    const signatures: string[] = [];
    const families = new Set<string>();
    for (const seed of SEEDS) {
      const descriptor = descriptorFor(tableTiltScene, seed);
      const variations = resolveTableTiltMaterialVariations(descriptor);
      const replay = resolveTableTiltMaterialVariations(descriptorFor(tableTiltScene, seed));
      expect(variations).toEqual(replay);
      expect(variations).toBeDefined();
      expect(TABLE_TILT_STYLE_IDS).toContain(variations!.appearanceFamily);
      expect(variations!.appearanceFamily).toBe(
        descriptor.createRandomStream("materials", "scene-style").pick(TABLE_TILT_STYLE_IDS),
      );
      families.add(variations!.appearanceFamily);
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
        expect(role.roughness).toBeLessThanOrEqual(0.9);
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
    expect(families.size).toBeGreaterThanOrEqual(2);
    expect(resolveTableTiltMaterialVariations(undefined)).toBeUndefined();
  });

  it("covers multiple curated families over the frozen twelve-seed visual sample", () => {
    const architectureFamilies = new Set(FROZEN_FAMILY_COVERAGE_SEEDS.map((seed) =>
      resolveArchitectureForegroundMaterialVariations(
        descriptorFor(architectureForegroundScene, seed),
      )!.appearanceFamily,
    ));
    const tableFamilies = new Set(FROZEN_FAMILY_COVERAGE_SEEDS.map((seed) =>
      resolveTableTiltMaterialVariations(descriptorFor(tableTiltScene, seed))!.appearanceFamily,
    ));
    expect(architectureFamilies.size).toBeGreaterThanOrEqual(3);
    expect(tableFamilies.size).toBe(TABLE_TILT_STYLE_IDS.length);
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
        "57f9feb2d4e3a194d30bc35c526a7409b63994160dcea180e228aedfc5912e68",
      );
      expect(renderSubjectSignature(table)).toBe(
        "d8bcb9595b6b55b12652dd541aff1d68ce18735da5e3e5303d205b82e92c27f1",
      );
      expect(geometrySignature(table)).toBe(
        "eefdb7c6eabf7d8a3371cdfc594558165d250f97aeff7862236fe1223bab9c80",
      );
      expect(architectureForegroundScene.sceneVariation).toEqual({ enabled: true, schemaVersion: 1 });
      expect(tableTiltScene.sceneVariation).toEqual({ enabled: true, schemaVersion: 1 });
    } finally {
      disposeArchitectureForegroundGroup(architecture);
      disposeTableTiltGroup(table);
    }
  });

  it("keeps PR #357 finish sharing in Guided Mode and applies independent seeded Table Tilt roles", () => {
    const canonical = createTableTiltGroup({ presentation: TABLE_TILT_PRESENTATION });
    const seeded = createTableTiltGroup({
      presentation: TABLE_TILT_PRESENTATION,
      variationDescriptor: descriptorFor(tableTiltScene, 0),
    });
    const frameNames = [
      "table-tilt-apron-near",
      "table-tilt-side-rail-left",
      "table-tilt-underframe-crossbar",
      `table-tilt-support-${tableTiltGeometry.tableSupports[0]?.id}`,
    ];

    try {
      const canonicalWood = materialFor(canonical, "table-tilt-tabletop");
      expect(materialFor(canonical, "table-tilt-context-near-tray")).toBe(canonicalWood);
      expect(materialFor(canonical, "table-tilt-context-far-block")).toBe(canonicalWood);
      const canonicalFrame = materialFor(canonical, frameNames[0]!);
      frameNames.forEach((name) => expect(materialFor(canonical, name)).toBe(canonicalFrame));
      expect(materialFor(canonical, "table-tilt-context-middle-canister")).toBe(canonicalFrame);

      const seededWood = materialFor(seeded, "table-tilt-tabletop");
      const seededContextWood = materialFor(seeded, "table-tilt-context-near-tray");
      expect(seededContextWood).not.toBe(seededWood);
      expect(materialFor(seeded, "table-tilt-context-far-block")).toBe(seededContextWood);
      const seededFrame = materialFor(seeded, frameNames[0]!);
      frameNames.forEach((name) => expect(materialFor(seeded, name)).toBe(seededFrame));
      expect(materialFor(seeded, "table-tilt-context-middle-canister")).not.toBe(seededFrame);
    } finally {
      disposeTableTiltGroup(canonical);
      disposeTableTiltGroup(seeded);
    }
  });

  it.each([
    { scene: architectureForegroundScene, make: (seed: number) => createArchitectureForegroundGroup({ presentation: ARCHITECTURE_FOREGROUND_PRESENTATION, variationDescriptor: descriptorFor(architectureForegroundScene, seed) }), names: architectureRoleNames },
    { scene: tableTiltScene, make: (seed: number) => createTableTiltGroup({ presentation: TABLE_TILT_PRESENTATION, variationDescriptor: descriptorFor(tableTiltScene, seed) }), names: tableRoleNames },
  ])("replays seed maps and varies valid material realizations across representative seeds for $scene.id", ({ scene, make, names }) => {
    const signatures: string[] = [];
    const mapSignatures: string[] = [];
    for (const seed of FROZEN_FAMILY_COVERAGE_SEEDS) {
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
          if (scene.id === "table-tilt") {
            if (name === "table-tilt-apron-near" || name === "table-tilt-context-middle-canister") {
              expect(textures.every((texture) => texture === null)).toBe(true);
            } else {
              textures.forEach((texture) => {
                expect(texture).toBeInstanceOf(THREE.DataTexture);
                expect(texture?.image).toMatchObject({ width: 128, height: 128 });
              });
            }
          } else if (name === "architecture-foreground-ground") {
            expect(textures[0]).toBeInstanceOf(THREE.DataTexture);
            expect(textures[0]?.image).toMatchObject({ width: 256, height: 256 });
            expect(textures.slice(1).every((texture) => texture === null)).toBe(true);
          } else if (
            name === "architecture-foreground-building" ||
            name === "architecture-foreground-front-base"
          ) {
            textures.forEach((texture) => {
              expect(texture).toBeInstanceOf(THREE.DataTexture);
              expect(texture?.image).toMatchObject({ width: 128, height: 128 });
            });
          } else {
            expect(textures.every((texture) => texture === null)).toBe(true);
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
    expect(new Set(signatures).size).toBe(FROZEN_FAMILY_COVERAGE_SEEDS.length);
    expect(new Set(mapSignatures).size).toBe(FROZEN_FAMILY_COVERAGE_SEEDS.length);
  });

  it("records reviewed schema-v1 material-family map signatures for the four reference seeds", () => {
    const signatures: Record<string, Record<string, string>> = {
      "architecture-foreground": {},
      "table-tilt": {},
    };
    for (const seed of SEEDS) {
      const architecture = createArchitectureForegroundGroup({
        presentation: ARCHITECTURE_FOREGROUND_PRESENTATION,
        variationDescriptor: descriptorFor(architectureForegroundScene, seed),
      });
      const table = createTableTiltGroup({
        presentation: TABLE_TILT_PRESENTATION,
        variationDescriptor: descriptorFor(tableTiltScene, seed),
      });
      try {
        const architectureFamily = resolveArchitectureForegroundMaterialVariations(
          descriptorFor(architectureForegroundScene, seed),
        )!.appearanceFamily;
        const tableFamily = resolveTableTiltMaterialVariations(
          descriptorFor(tableTiltScene, seed),
        )!.appearanceFamily;
        const architectureMapHash = hashBytes(new TextEncoder().encode(
          mapBytesSignature(architecture, architectureRoleNames),
        ));
        const tableMapHash = hashBytes(new TextEncoder().encode(
          mapBytesSignature(table, ["table-tilt-tabletop", "table-tilt-context-near-tray"]),
        ));
        signatures["architecture-foreground"]![String(seed)] =
          `${architectureFamily}:${architectureMapHash}`;
        signatures["table-tilt"]![String(seed)] = `${tableFamily}:${tableMapHash}`;
      } finally {
        disposeArchitectureForegroundGroup(architecture);
        disposeTableTiltGroup(table);
      }
    }
    expect(signatures).toMatchInlineSnapshot(`
      {
        "architecture-foreground": {
          "0": "warm-stone:ef25db0b656897e27ad5895a60bb40b0a83b99787f58a63a7aa73e46b5545a5c",
          "1": "light-mineral:867459ad05bff7cb84780eb640723baf3f50be0dd18b636b3f5eb23c6386deeb",
          "284719": "dark-contemporary:96297aced6689cfc1bd4e29f728d987ddaaeba796af5faa3c274eabd411cfde6",
          "4294967295": "light-mineral:ce734dd2a7c856678a7e6783bfc0fb84ee084973569b4c6f73a83f651c7793b1",
        },
        "table-tilt": {
          "0": "medium-teak-like:e58e7a31f680a698538cf958bc9f4943db7f8407c343cee5bf745dbf945ae4d4",
          "1": "dark-walnut-like:d3cfc73cd1a48c1af0d4d86f49df0cee78f8eb0db0e5bd5a255f57a511723bd2",
          "284719": "light-oak-like:be906a80e99b36a0afb0d01a5e6ba14375c7e32b4605b687912b448153fa4614",
          "4294967295": "light-oak-like:5a5dc87e5af354e1adb985890cfddfd5290ed9462aac6b06d1bd75150e7390f9",
        },
      }
    `);
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
  }, 15_000);

  it.each([
    {
      scene: architectureForegroundScene,
      make: (seed: number) => createArchitectureForegroundGroup({ presentation: ARCHITECTURE_FOREGROUND_PRESENTATION, variationDescriptor: descriptorFor(architectureForegroundScene, seed) }),
      dispose: disposeArchitectureForegroundGroup,
      protectedNames: [
        "architecture-foreground-front-joinery",
        "architecture-foreground-front-glazing",
        "architecture-foreground-front-transom",
      ],
    },
    {
      scene: tableTiltScene,
      make: (seed: number) => createTableTiltGroup({ presentation: TABLE_TILT_PRESENTATION, variationDescriptor: descriptorFor(tableTiltScene, seed) }),
      dispose: disposeTableTiltGroup,
      protectedNames: ["table-tilt-tabletop-guide-1", "table-tilt-near-cup-focus-card-surface", "table-tilt-near-cup-focus-card-band-1", "table-tilt-mid-notebook-pages", "table-tilt-mid-notebook-line-pattern-surface", "table-tilt-mid-notebook-line-1", "table-tilt-far-book-focus-chart-surface", "table-tilt-far-book-chart-1-1", "table-tilt-far-book-fine-grid-1-1"],
    },
  ])("leaves $scene.id canonical geometry and focus-critical materials unchanged", ({ scene, make, dispose, protectedNames }) => {
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

  it("varies v2 paving finish while preserving canonical joint bytes and world alignment", () => {
    const canonical = createArchitectureForegroundGroup({
      presentation: ARCHITECTURE_FOREGROUND_PRESENTATION,
    });
    const canonicalPaving = materialFor(
      canonical,
      "architecture-foreground-ground",
    ) as THREE.MeshStandardMaterial;
    const canonicalTexture = canonicalPaving.map as THREE.DataTexture;
    const canonicalBytes = hashBytes(
      (canonicalTexture.image as { data: Uint8Array }).data,
    );
    const canonicalRepeat = canonicalTexture.repeat.toArray();
    const canonicalOffset = canonicalTexture.offset.toArray();
    const seededColors = new Set<string>();

    try {
      for (const seed of SEEDS) {
        const seeded = createArchitectureForegroundGroup({
          presentation: ARCHITECTURE_FOREGROUND_PRESENTATION,
          variationDescriptor: descriptorFor(architectureForegroundScene, seed),
        });
        try {
          const paving = materialFor(
            seeded,
            "architecture-foreground-ground",
          ) as THREE.MeshStandardMaterial;
          const texture = paving.map as THREE.DataTexture;
          expect(hashBytes((texture.image as { data: Uint8Array }).data)).toBe(canonicalBytes);
          expect(texture.repeat.toArray()).toEqual(canonicalRepeat);
          expect(texture.offset.toArray()).toEqual(canonicalOffset);
          seededColors.add(paving.color.getHexString());
        } finally {
          disposeArchitectureForegroundGroup(seeded);
        }
      }
      expect(seededColors.size).toBeGreaterThan(1);
    } finally {
      disposeArchitectureForegroundGroup(canonical);
    }
  });
});
