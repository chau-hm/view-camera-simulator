import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as THREE from "three";
import { afterEach, describe, expect, it, vi } from "vitest";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import { getTaskById } from "../../core/tasks/taskRegistry";
import { architectureRiseScene } from "../../scenes/definitions/architecture-rise";
import { architectureForegroundScene } from "../../scenes/definitions/architecture-foreground";
import { interiorCornerScene } from "../../scenes/definitions/interior-corner";
import { obliqueArchitectureScene } from "../../scenes/definitions/oblique-architecture";
import { obliqueTabletopScene } from "../../scenes/definitions/oblique-tabletop";
import { shelfSwingScene } from "../../scenes/definitions/shelf-swing";
import { tableTiltScene } from "../../scenes/definitions/table-tilt";
import { ARCHITECTURE_RISE_PRESENTATION } from "../../scenes/presentation/architectureRise";
import { OBLIQUE_ARCHITECTURE_PRESENTATION } from "../../scenes/presentation/obliqueArchitecture";
import { SHELF_SWING_PRESENTATION } from "../../scenes/presentation/shelfSwing";
import { TABLE_TILT_PRESENTATION } from "../../scenes/presentation/tableTilt";
import { ARCHITECTURE_FOREGROUND_PRESENTATION } from "../../scenes/presentation/architectureForeground";
import { INTERIOR_CORNER_PRESENTATION } from "../../scenes/presentation/interiorCorner";
import { OBLIQUE_TABLETOP_PRESENTATION } from "../../scenes/presentation/obliqueTabletop";
import * as architectureRiseAsset from "../../render/ArchitectureRiseSubjectFactory";
import * as obliqueArchitectureAsset from "../../render/ObliqueArchitectureSubjectFactory";
import * as shelfSwingAsset from "../../render/ShelfSwingSubjectFactory";
import * as tableTiltAsset from "../../render/TableTiltSubjectFactory";
import * as architectureForegroundAsset from "../../render/ArchitectureForegroundSubjectFactory";
import * as interiorCornerAsset from "../../render/InteriorCornerSubjectFactory";
import * as obliqueTabletopAsset from "../../render/ObliqueTabletopSubjectFactory";
import {
  ARCHITECTURE_RISE_ASSET_KEY,
  ARCHITECTURE_FOREGROUND_ASSET_KEY,
  INTERIOR_CORNER_ASSET_KEY,
  OBLIQUE_ARCHITECTURE_ASSET_KEY,
  OBLIQUE_TABLETOP_ASSET_KEY,
  SHELF_SWING_ASSET_KEY,
  TABLE_TILT_ASSET_KEY,
  createRegisteredSceneAsset,
  disposeRegisteredSceneAsset,
  resolveSceneAsset,
  sceneAssetRegistry,
  type SceneAssetKey,
  type SceneAssetRegistration,
  type SceneAssetRegistry,
  type SceneAssetRequestMap,
} from "../../render/assets/sceneAssetRegistry";
import { DEFAULT_CAMERA_STATE } from "../../utils/constants";

afterEach(() => vi.restoreAllMocks());

type FactoryCallCounter = {
  calls: () => number;
  clear: () => void;
  firstRequest: () => unknown;
};

const countFactoryCalls = (spy: {
  mock: { calls: unknown[] };
  mockClear: () => void;
}): FactoryCallCounter => ({
  calls: () => spy.mock.calls.length,
  clear: () => spy.mockClear(),
  firstRequest: () => (spy.mock.calls[0] as unknown[] | undefined)?.[0],
});

const sceneDefinitions = [
  architectureRiseScene,
  architectureForegroundScene,
  interiorCornerScene,
  obliqueArchitectureScene,
  obliqueTabletopScene,
  tableTiltScene,
  shelfSwingScene,
] as const;

const semanticResults = () => ({
  scenes: sceneDefinitions,
  tasks: [
    "rise-01",
    "architecture-foreground-rise-01",
    "architecture-foreground-tilt-focus-01",
    "architecture-foreground-dof-01",
    "architecture-foreground-compound-01",
    "interior-corner-compose-01",
    "interior-corner-swing-01",
    "interior-corner-refine-01",
    "interior-corner-aperture-01",
    "oblique-swing-focus-01",
    "oblique-tabletop-focus-01",
    "oblique-tabletop-tilt-01",
    "oblique-tabletop-swing-01",
    "oblique-tabletop-refine-01",
    "oblique-tabletop-aperture-01",
    "tilt-01",
    "swing-01",
  ].map((taskId) => getTaskById(taskId)),
  optics: sceneDefinitions.map((scene) => {
    const optics = deriveOpticsState(
      {
        ...DEFAULT_CAMERA_STATE,
        ...scene.cameraPreset,
        activeSceneId: scene.id,
      },
      scene,
    );
    return {
      lensCenterWorld: optics.lensCenterWorld,
      filmCenterWorld: optics.filmCenterWorld,
      focusPlane: optics.focusPlane,
    };
  }),
  presentations: [
    ARCHITECTURE_RISE_PRESENTATION,
    ARCHITECTURE_FOREGROUND_PRESENTATION,
    INTERIOR_CORNER_PRESENTATION,
    OBLIQUE_ARCHITECTURE_PRESENTATION,
    OBLIQUE_TABLETOP_PRESENTATION,
    TABLE_TILT_PRESENTATION,
    SHELF_SWING_PRESENTATION,
  ],
});

const collectDisposableSpies = (group: THREE.Group) => {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  group.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    geometries.add(object.geometry);
    const objectMaterials = Array.isArray(object.material)
      ? object.material
      : [object.material];
    objectMaterials.forEach((material) => {
      materials.add(material);
      const withTextures = material as THREE.Material & {
        map?: THREE.Texture | null;
      };
      if (withTextures.map) textures.add(withTextures.map);
    });
  });
  return [
    ...[...geometries].map((resource) => vi.spyOn(resource, "dispose")),
    ...[...materials].map((resource) => vi.spyOn(resource, "dispose")),
    ...[...textures].map((resource) => vi.spyOn(resource, "dispose")),
  ];
};

const exerciseReplacement = <K extends SceneAssetKey>(
  assetKey: K,
  request: SceneAssetRequestMap[K],
  productionFactoryCalls: FactoryCallCounter,
  expectedGroupName: string,
  expectedSceneId: string,
): void => {
  const productionRegistration = resolveSceneAsset(assetKey);
  expect(assetKey).not.toBe(expectedSceneId);
  let productionGroup: THREE.Group | null = null;
  let substituteGroup: THREE.Group | null = null;
  let substituteRegistryForCleanup: SceneAssetRegistry | null = null;
  const resultsBefore = semanticResults();

  try {
    productionGroup = createRegisteredSceneAsset(assetKey, request);
    expect(productionFactoryCalls.calls()).toBe(1);
    expect(productionFactoryCalls.firstRequest()).toBe(request);
    expect(productionGroup.name).toBe(expectedGroupName);
    expect(productionGroup.userData.assetImplementationId).toBe(
      productionRegistration.implementationId,
    );
    const productionResources = collectDisposableSpies(productionGroup);
    disposeRegisteredSceneAsset(assetKey, productionGroup);
    productionGroup = null;
    productionResources.forEach((spy) => expect(spy).toHaveBeenCalledTimes(1));

    productionFactoryCalls.clear();
    substituteGroup = new THREE.Group();
    substituteGroup.name = `substitute:${expectedSceneId}`;
    substituteGroup.position.set(3, -2, 5);
    substituteGroup.add(new THREE.Object3D());
    const substituteFactory = vi.fn(
      (receivedRequest: SceneAssetRequestMap[K]): THREE.Group => {
        expect(receivedRequest).toBe(request);
        return substituteGroup!;
      },
    );
    const substituteDisposer = vi.fn((group: THREE.Group) => group.clear());
    const substituteRegistration: SceneAssetRegistration<K> = Object.freeze({
      assetKey,
      implementationId: `test-substitute-${expectedSceneId}`,
      create: substituteFactory,
      dispose: substituteDisposer,
    });
    const substituteRegistry: SceneAssetRegistry = Object.freeze({
      [assetKey]: substituteRegistration,
    });
    substituteRegistryForCleanup = substituteRegistry;

    const mountedScene = new THREE.Scene();
    const createdSubstitute = createRegisteredSceneAsset(
      assetKey,
      request,
      substituteRegistry,
    );
    mountedScene.add(createdSubstitute);

    expect(substituteFactory).toHaveBeenCalledTimes(1);
    expect(substituteFactory.mock.calls[0]?.[0]).toBe(request);
    expect(createdSubstitute).toBe(substituteGroup);
    expect(createdSubstitute.parent).toBe(mountedScene);
    expect(createdSubstitute.name).toBe(`substitute:${expectedSceneId}`);
    expect(createdSubstitute.position.toArray()).toEqual([3, -2, 5]);
    expect(createdSubstitute.userData.assetImplementationId).toBe(
      substituteRegistration.implementationId,
    );
    expect(createdSubstitute.children).toHaveLength(1);
    expect(productionFactoryCalls.calls()).toBe(0);

    const resultsAfter = semanticResults();
    expect(resultsAfter).toEqual(resultsBefore);
    expect(
      resultsAfter.scenes.find((scene) => scene.id === expectedSceneId)?.focusTargets,
    ).toEqual(
      resultsBefore.scenes.find((scene) => scene.id === expectedSceneId)?.focusTargets,
    );
    expect(sceneAssetRegistry[assetKey]).toBe(productionRegistration);
    expect(resolveSceneAsset(assetKey)).toBe(productionRegistration);

    mountedScene.remove(createdSubstitute);
    disposeRegisteredSceneAsset(assetKey, createdSubstitute, substituteRegistry);
    substituteGroup = null;
    expect(substituteDisposer).toHaveBeenCalledTimes(1);
    expect(substituteDisposer).toHaveBeenCalledWith(createdSubstitute);
  } finally {
    if (productionGroup) disposeRegisteredSceneAsset(assetKey, productionGroup);
    if (substituteGroup && substituteRegistryForCleanup) {
      disposeRegisteredSceneAsset(
        assetKey,
        substituteGroup,
        substituteRegistryForCleanup,
      );
    }
  }
};

describe("static teaching scene asset migrations", () => {
  it("routes production and displaced substitute implementations through the same typed registry seam", () => {
    const architectureRiseFactorySpy = vi.spyOn(
      architectureRiseAsset,
      "createArchitectureRiseGroup",
    );
    const obliqueArchitectureFactorySpy = vi.spyOn(
      obliqueArchitectureAsset,
      "createObliqueArchitectureGroup",
    );
    const tableTiltFactorySpy = vi.spyOn(
      tableTiltAsset,
      "createTableTiltGroup",
    );
    const shelfSwingFactorySpy = vi.spyOn(
      shelfSwingAsset,
      "createShelfSwingGroup",
    );
    const architectureForegroundFactorySpy = vi.spyOn(
      architectureForegroundAsset,
      "createArchitectureForegroundGroup",
    );
    const interiorCornerFactorySpy = vi.spyOn(
      interiorCornerAsset,
      "createInteriorCornerGroup",
    );
    const obliqueTabletopFactorySpy = vi.spyOn(
      obliqueTabletopAsset,
      "createObliqueTabletopGroup",
    );

    exerciseReplacement(
      ARCHITECTURE_RISE_ASSET_KEY,
      { presentation: ARCHITECTURE_RISE_PRESENTATION },
      countFactoryCalls(architectureRiseFactorySpy),
      "architecture-rise-subject",
      "architecture-rise",
    );
    exerciseReplacement(
      OBLIQUE_ARCHITECTURE_ASSET_KEY,
      { presentation: OBLIQUE_ARCHITECTURE_PRESENTATION },
      countFactoryCalls(obliqueArchitectureFactorySpy),
      "oblique-architecture-subject",
      "oblique-architecture",
    );
    exerciseReplacement(
      TABLE_TILT_ASSET_KEY,
      { presentation: TABLE_TILT_PRESENTATION },
      countFactoryCalls(tableTiltFactorySpy),
      "table-tilt-subject",
      "table-tilt",
    );
    exerciseReplacement(
      SHELF_SWING_ASSET_KEY,
      { presentation: SHELF_SWING_PRESENTATION },
      countFactoryCalls(shelfSwingFactorySpy),
      "shelf-swing-subject",
      "shelf-swing",
    );
    exerciseReplacement(
      ARCHITECTURE_FOREGROUND_ASSET_KEY,
      { presentation: ARCHITECTURE_FOREGROUND_PRESENTATION },
      countFactoryCalls(architectureForegroundFactorySpy),
      "architecture-foreground-subject",
      "architecture-foreground",
    );
    exerciseReplacement(
      INTERIOR_CORNER_ASSET_KEY,
      { presentation: INTERIOR_CORNER_PRESENTATION },
      countFactoryCalls(interiorCornerFactorySpy),
      "interior-corner-subject",
      "interior-corner",
    );
    exerciseReplacement(
      OBLIQUE_TABLETOP_ASSET_KEY,
      { presentation: OBLIQUE_TABLETOP_PRESENTATION },
      countFactoryCalls(obliqueTabletopFactorySpy),
      "oblique-tabletop-subject",
      "oblique-tabletop",
    );
  });

  it("keeps scene definitions and renderer-neutral presentations outside Three.js and asset implementation modules", () => {
    const paths = [
      "src/scenes/definitions/architecture-rise.ts",
      "src/scenes/definitions/architecture-foreground.ts",
      "src/scenes/definitions/interior-corner.ts",
      "src/scenes/definitions/oblique-architecture.ts",
      "src/scenes/definitions/oblique-tabletop.ts",
      "src/scenes/definitions/table-tilt.ts",
      "src/scenes/definitions/shelf-swing.ts",
      "src/scenes/presentation/architectureRise.ts",
      "src/scenes/presentation/architectureForeground.ts",
      "src/scenes/presentation/interiorCorner.ts",
      "src/scenes/presentation/obliqueArchitecture.ts",
      "src/scenes/presentation/obliqueTabletop.ts",
      "src/scenes/presentation/tableTilt.ts",
      "src/scenes/presentation/shelfSwing.ts",
    ];

    paths.forEach((path) => {
      const source = readFileSync(resolve(process.cwd(), path), "utf8");
      expect(source, path).not.toMatch(/from\s+["']three(?:\/|["'])/);
      expect(source, path).not.toMatch(/sceneAssetRegistry/);
      expect(source, path).not.toMatch(/from\s+["'][^"']*render\/assets\//);
    });
    const registrySource = readFileSync(
      resolve(process.cwd(), "src/render/assets/sceneAssetRegistry.ts"),
      "utf8",
    );
    expect(registrySource).not.toMatch(
      /CameraMovementLatticePresentation\[["']object["']\]\[["']id["']\]/,
    );
  });
});
