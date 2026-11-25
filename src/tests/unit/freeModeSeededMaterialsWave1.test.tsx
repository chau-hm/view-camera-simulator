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
import {
  canonicalGeometrySignature as geometrySignature,
  completeSubjectSignature as renderSubjectSignature,
  namedMaterialSignature as namedRoleSignature,
} from "./helpers/canonicalSubjectSignatures";

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

const hash = (value: string): string => createHash("sha256").update(value).digest("hex");

const SEEDED_MATERIAL_BATCHES = [
  {
    label: "seeds 0–3",
    seeds: FROZEN_FAMILY_COVERAGE_SEEDS.slice(0, 4),
    architectureDigest: "e4dfaf9d0c479bd1d14a49d5bff470f60d89a97fbe0fefa539537e73f0ce96d3",
    tableDigest: "16c42a72bd9c5a1a3550ba0d319d32888d361e549190fe946b06f7ffff1f930e",
  },
  {
    label: "seeds 4–7",
    seeds: FROZEN_FAMILY_COVERAGE_SEEDS.slice(4, 8),
    architectureDigest: "4c2a0fee1262af30407315361a8d2225e2d46ae035603a7466cf1073d7cf4533",
    tableDigest: "76ca8690a3618fe21599f32e294081ec500a591c4dfe41057d205a5969814871",
  },
  {
    label: "seeds 8–11",
    seeds: FROZEN_FAMILY_COVERAGE_SEEDS.slice(8, 12),
    architectureDigest: "a0fe38f918ffbf5c37f89596d19524e03665e1f25d4d872b668c52c6d4fc2c8b",
    tableDigest: "8b5b2b48ec66a5c7ed2dd509ca775c745d46ba31a718ea5730b3affe3ba581d4",
  },
] as const;

const materialFor = (root: THREE.Group, name: string): THREE.Material => {
  const object = root.getObjectByName(name);
  if (!(object instanceof THREE.Mesh)) throw new Error(`Missing mesh ${name}`);
  return Array.isArray(object.material) ? object.material[0]! : object.material;
};

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
      // Historical pre-courtyard source cec404a8 had signature 57f9feb2... and 66 nodes.
      // Accepted #369 head 0ca1707e and merge 9e5a71be have 212 nodes; #350 keeps this
      // accepted no-descriptor subject signature while adding seeded material options.
      expect(renderSubjectSignature(architecture)).toBe(
        "df9302abdd2e9f92c764a823803499ceae9be136fdb120901baae366d5bc7fe2",
      );
      expect(geometrySignature(architecture, {
        skipSubtreeNames: ["architecture-foreground-courtyard-environment"],
      })).toBe("5eab841a88899a2e6a69fca2ba7c1bac689a23d963560860a0cc2369cf9445c5");
      expect(renderSubjectSignature(table)).toBe(
        "3c415e52fede840a64a4ad2fd40957b6d059f3ee237c9c4f4b5415748629164d",
      );
      expect(geometrySignature(table)).toBe(
        "cd6af7323ca3e7136f95d8a5993bb3d312f896a75e4cf34b0f97f0ffdd16566d",
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

  it.each(SEEDED_MATERIAL_BATCHES)("replays seed maps and varies valid material realizations for $label", ({
    seeds,
    architectureDigest,
    tableDigest,
  }) => {
    const fixtures = [
      {
        sceneId: architectureForegroundScene.id,
        make: (seed: number) => createArchitectureForegroundGroup({
          presentation: ARCHITECTURE_FOREGROUND_PRESENTATION,
          variationDescriptor: descriptorFor(architectureForegroundScene, seed),
        }),
        dispose: disposeArchitectureForegroundGroup,
        names: architectureRoleNames,
        mapNames: architectureRoleNames,
        digest: architectureDigest,
      },
      {
        sceneId: tableTiltScene.id,
        make: (seed: number) => createTableTiltGroup({
          presentation: TABLE_TILT_PRESENTATION,
          variationDescriptor: descriptorFor(tableTiltScene, seed),
        }),
        dispose: disposeTableTiltGroup,
        names: tableRoleNames,
        mapNames: ["table-tilt-tabletop", "table-tilt-context-near-tray"],
        digest: tableDigest,
      },
    ];

    fixtures.forEach(({ sceneId, make, dispose, names, mapNames, digest }) => {
      const signatures: string[] = [];
      const mapSignatures: string[] = [];
      for (const seed of seeds) {
        const group = make(seed);
        try {
          const signature = surfaceMapSignature(group, names);
          signatures.push(signature);
          mapSignatures.push(mapBytesSignature(group, mapNames));
          const replay = make(seed);
          try {
            expect(surfaceMapSignature(replay, names)).toBe(signature);
          } finally {
            dispose(replay);
          }
          for (const name of names) {
            const material = materialFor(group, name);
            expect(material).toBeInstanceOf(THREE.MeshStandardMaterial);
            if (!(material instanceof THREE.MeshStandardMaterial)) continue;
            const textures = [material.map, material.roughnessMap, material.normalMap];
            if (sceneId === "table-tilt") {
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
          dispose(group);
        }
      }
      expect(new Set(signatures).size).toBe(seeds.length);
      expect(new Set(mapSignatures).size).toBe(seeds.length);
      expect(hash(JSON.stringify({ signatures, mapSignatures }))).toBe(digest);
    });
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
  }, 30_000);

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
