import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as THREE from "three";
import { afterEach, describe, expect, it, vi } from "vitest";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import { taskRegistry } from "../../core/tasks/taskRegistry";
import { publicSceneCatalog } from "../../app/publicScenes";
import { focusFundamentalsTwoTargets } from "../../scenes/definitions/focus-fundamentals-two-targets";
import { viewCameraAnatomyScene } from "../../scenes/definitions/view-camera-anatomy";
import { mirrorShiftScene } from "../../scenes/definitions/mirror-shift";
import { architectureRiseScene } from "../../scenes/definitions/architecture-rise";
import { architectureForegroundScene } from "../../scenes/definitions/architecture-foreground";
import { interiorCornerScene } from "../../scenes/definitions/interior-corner";
import { obliqueArchitectureScene } from "../../scenes/definitions/oblique-architecture";
import { obliqueTabletopScene } from "../../scenes/definitions/oblique-tabletop";
import { shelfSwingScene } from "../../scenes/definitions/shelf-swing";
import { tableTiltScene } from "../../scenes/definitions/table-tilt";
import { macroBellowsExtensionScene } from "../../scenes/definitions/macro-bellows-extension";
import { macroDepthOfFieldScene } from "../../scenes/definitions/macro-depth-of-field";
import { macroObliquePlaneScene } from "../../scenes/definitions/macro-oblique-plane";
import { macroCompoundMovementsScene } from "../../scenes/definitions/macro-compound-movements";
import { ARCHITECTURE_RISE_PRESENTATION } from "../../scenes/presentation/architectureRise";
import { OBLIQUE_ARCHITECTURE_PRESENTATION } from "../../scenes/presentation/obliqueArchitecture";
import { SHELF_SWING_PRESENTATION } from "../../scenes/presentation/shelfSwing";
import { TABLE_TILT_PRESENTATION } from "../../scenes/presentation/tableTilt";
import { ARCHITECTURE_FOREGROUND_PRESENTATION } from "../../scenes/presentation/architectureForeground";
import { INTERIOR_CORNER_PRESENTATION } from "../../scenes/presentation/interiorCorner";
import { OBLIQUE_TABLETOP_PRESENTATION } from "../../scenes/presentation/obliqueTabletop";
import { FOCUS_FUNDAMENTALS_PRESENTATION } from "../../scenes/presentation/focusFundamentals";
import { VIEW_CAMERA_ANATOMY_PRESENTATION } from "../../scenes/presentation/viewCameraAnatomy";
import { MIRROR_SHIFT_PRESENTATION } from "../../scenes/presentation/mirrorShift";
import { MACRO_BELLOWS_EXTENSION_PRESENTATION } from "../../scenes/presentation/macroBellowsExtension";
import { MACRO_DEPTH_OF_FIELD_PRESENTATION } from "../../scenes/presentation/macroDepthOfField";
import { MACRO_OBLIQUE_PLANE_PRESENTATION } from "../../scenes/presentation/macroObliquePlane";
import { MACRO_COMPOUND_MOVEMENTS_PRESENTATION } from "../../scenes/presentation/macroCompoundMovements";
import * as architectureRiseAsset from "../../render/ArchitectureRiseSubjectFactory";
import * as obliqueArchitectureAsset from "../../render/ObliqueArchitectureSubjectFactory";
import * as shelfSwingAsset from "../../render/ShelfSwingSubjectFactory";
import * as tableTiltAsset from "../../render/TableTiltSubjectFactory";
import * as architectureForegroundAsset from "../../render/ArchitectureForegroundSubjectFactory";
import * as interiorCornerAsset from "../../render/InteriorCornerSubjectFactory";
import * as obliqueTabletopAsset from "../../render/ObliqueTabletopSubjectFactory";
import * as focusFundamentalsAsset from "../../render/FocusFundamentalsSubjectFactory";
import * as viewCameraAnatomyAsset from "../../render/LessonZeroGroundGlassSubjectFactory";
import * as mirrorShiftAsset from "../../render/MirrorShiftSubjectFactory";
import * as macroBellowsExtensionAsset from "../../render/MacroSpecimenSubjectFactory";
import * as macroDepthOfFieldAsset from "../../render/MacroDepthOfFieldSubjectFactory";
import * as macroObliquePlaneAsset from "../../render/MacroObliquePlaneSubjectFactory";
import * as macroCompoundMovementsAsset from "../../render/MacroCompoundMovementsSubjectFactory";
import * as macroSpecimenGeometry from "../../scenes/macroSpecimenGeometry";
import * as macroDepthOfFieldGeometry from "../../scenes/macroDepthOfFieldGeometry";
import * as macroObliquePlaneGeometry from "../../scenes/macroObliquePlaneGeometry";
import * as macroCompoundMovementsGeometry from "../../scenes/macroCompoundMovementsGeometry";
import {
  mirrorShiftGeometry,
  resolveMirrorShiftCameraAnchors,
} from "../../scenes/mirrorShiftGeometry";
import { resolveMirrorShiftTeachingState } from "../../scenes/mirrorShiftCalibration";
import { resolveMirrorShiftLighting } from "../../render/mirrorShiftLighting";
import {
  ARCHITECTURE_RISE_ASSET_KEY,
  ARCHITECTURE_FOREGROUND_ASSET_KEY,
  INTERIOR_CORNER_ASSET_KEY,
  OBLIQUE_ARCHITECTURE_ASSET_KEY,
  OBLIQUE_TABLETOP_ASSET_KEY,
  FOCUS_FUNDAMENTALS_ASSET_KEY,
  VIEW_CAMERA_ANATOMY_ASSET_KEY,
  MIRROR_SHIFT_ASSET_KEY,
  MACRO_BELLOWS_EXTENSION_ASSET_KEY,
  MACRO_DEPTH_OF_FIELD_ASSET_KEY,
  MACRO_OBLIQUE_PLANE_ASSET_KEY,
  MACRO_COMPOUND_MOVEMENTS_ASSET_KEY,
  SHELF_SWING_ASSET_KEY,
  TABLE_TILT_ASSET_KEY,
  createRegisteredSceneAsset,
  disposeRegisteredSceneAsset,
  resolveSceneAsset,
  sceneAssetRegistry,
  type InstanceOwnedSceneAssetKey,
  type ModuleSharedSceneAssetKey,
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
  focusFundamentalsTwoTargets,
  viewCameraAnatomyScene,
  mirrorShiftScene,
  macroBellowsExtensionScene,
  macroDepthOfFieldScene,
  macroObliquePlaneScene,
  macroCompoundMovementsScene,
] as const;

const semanticResults = () => ({
  scenes: sceneDefinitions,
  tasks: Object.values(taskRegistry).filter((task) =>
    sceneDefinitions.some((scene) => scene.id === task.sceneId),
  ),
  anatomyLesson: publicSceneCatalog.find(({ id }) => id === viewCameraAnatomyScene.id)?.lesson,
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
    FOCUS_FUNDAMENTALS_PRESENTATION,
    VIEW_CAMERA_ANATOMY_PRESENTATION,
    MIRROR_SHIFT_PRESENTATION,
    MACRO_BELLOWS_EXTENSION_PRESENTATION,
    MACRO_DEPTH_OF_FIELD_PRESENTATION,
    MACRO_OBLIQUE_PLANE_PRESENTATION,
    MACRO_COMPOUND_MOVEMENTS_PRESENTATION,
  ],
  macroCanonicalGeometry: {
    specimen: macroSpecimenGeometry,
    depthOfField: macroDepthOfFieldGeometry,
    obliquePlane: macroObliquePlaneGeometry,
    compoundMovements: macroCompoundMovementsGeometry,
  },
  macroCalibrationOptics: {
    obliquePlane: (() => {
      const scene = macroObliquePlaneScene;
      const optics = deriveOpticsState(
        {
          ...DEFAULT_CAMERA_STATE,
          ...scene.cameraPreset,
          activeSceneId: scene.id,
          focusDistanceMm: 390,
          frontTiltDeg: 6.3,
        },
        scene,
      );
      return { focusPlane: optics.focusPlane, lensCenterWorld: optics.lensCenterWorld };
    })(),
    compoundMovements: (() => {
      const scene = macroCompoundMovementsScene;
      const optics = deriveOpticsState(
        {
          ...DEFAULT_CAMERA_STATE,
          ...scene.cameraPreset,
          activeSceneId: scene.id,
          focusDistanceMm: 490,
          frontTiltDeg: 3.4,
          frontSwingDeg: -2.8,
        },
        scene,
      );
      return { focusPlane: optics.focusPlane, lensCenterWorld: optics.lensCenterWorld };
    })(),
  },
  mirrorShift: (() => {
    const optics = deriveOpticsState(
      {
        ...DEFAULT_CAMERA_STATE,
        ...mirrorShiftScene.cameraPreset,
        activeSceneId: mirrorShiftScene.id,
        mirrorShiftLessonState: { rigLateralMm: 1800 },
        frontShiftMm: -50,
      },
      mirrorShiftScene,
    );
    return {
      mirrorPlane: mirrorShiftGeometry.mirror.plane,
      realProps: mirrorShiftGeometry.props,
      reflectedProps: mirrorShiftGeometry.reflectedProps,
      cameraAnchors: resolveMirrorShiftCameraAnchors(
        { x: 1800, y: 0, z: 0 },
        -50,
      ),
      taskStages: {
        cameraMoved: resolveMirrorShiftTeachingState("camera-moved"),
        framingRestored: resolveMirrorShiftTeachingState("framing-restored"),
      },
      optics: {
        rigOriginWorld: optics.cameraRigTransform.rigOriginWorld,
        lensCenterWorld: optics.lensCenterWorld,
        filmCenterWorld: optics.filmCenterWorld,
        focusPlane: optics.focusPlane,
      },
      lighting: resolveMirrorShiftLighting(),
    };
  })(),
});

type TeachingMaterialTextureSlot =
  | "map"
  | "alphaMap"
  | "aoMap"
  | "bumpMap"
  | "displacementMap"
  | "emissiveMap"
  | "lightMap"
  | "metalnessMap"
  | "normalMap"
  | "roughnessMap";

// Mirror the texture slots currently traversed by disposeTeachingSubjectResources.
// Keep the collector aligned with that production ownership contract.
const teachingMaterialTextureSlots: readonly TeachingMaterialTextureSlot[] = [
  "map",
  "alphaMap",
  "aoMap",
  "bumpMap",
  "displacementMap",
  "emissiveMap",
  "lightMap",
  "metalnessMap",
  "normalMap",
  "roughnessMap",
];

const collectDisposableResources = (group: THREE.Group) => {
  const geometryReferences: THREE.BufferGeometry[] = [];
  const materialReferences: THREE.Material[] = [];
  const textureReferences: THREE.Texture[] = [];
  group.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    geometryReferences.push(object.geometry);
    const objectMaterials = Array.isArray(object.material)
      ? object.material
      : [object.material];
    objectMaterials.forEach((material) => {
      materialReferences.push(material);
      const withTextures = material as THREE.Material &
        Partial<Record<TeachingMaterialTextureSlot, THREE.Texture | null>>;
      teachingMaterialTextureSlots.forEach((slot) => {
        const texture = withTextures[slot];
        if (texture instanceof THREE.Texture) textureReferences.push(texture);
      });
    });
  });

  return {
    geometryReferences,
    materialReferences,
    textureReferences,
    geometries: new Set(geometryReferences),
    materials: new Set(materialReferences),
    textures: new Set(textureReferences),
  };
};

const collectDisposableSpies = (
  resources: ReturnType<typeof collectDisposableResources>,
) => [
  ...[...resources.geometries].map((resource) => vi.spyOn(resource, "dispose")),
  ...[...resources.textures].map((resource) => vi.spyOn(resource, "dispose")),
  ...[...resources.materials].map((resource) => vi.spyOn(resource, "dispose")),
];

const expectInstanceOwnedResourcesDisposedOnce = (
  assetKey: InstanceOwnedSceneAssetKey,
  request: SceneAssetRequestMap[InstanceOwnedSceneAssetKey],
): void => {
  const group = createRegisteredSceneAsset(assetKey, request);
  const resources = collectDisposableResources(group);
  let disposalStarted = false;

  try {
    expect(resources.geometries.size).toBeGreaterThan(0);
    expect(resources.materials.size).toBeGreaterThan(0);
    expect(resources.textures.size).toBeGreaterThan(0);
    // These subjects intentionally reuse per-instance resources across meshes.
    // The production disposer must deduplicate each resource during one traversal.
    // Some factories reuse geometries within one subject and some intentionally
    // allocate each mesh geometry separately; every unique geometry is checked.
    expect(resources.geometryReferences.length).toBeGreaterThanOrEqual(
      resources.geometries.size,
    );
    expect(resources.materialReferences.length).toBeGreaterThan(
      resources.materials.size,
    );

    const disposalSpies = collectDisposableSpies(resources);
    disposalStarted = true;
    disposeRegisteredSceneAsset(assetKey, group);
    disposalSpies.forEach((spy) => expect(spy).toHaveBeenCalledTimes(1));
  } finally {
    if (!disposalStarted) disposeRegisteredSceneAsset(assetKey, group);
  }
};

const expectAssetInstancesOwnDisjointResources = (
  assetKey: InstanceOwnedSceneAssetKey,
  request: SceneAssetRequestMap[InstanceOwnedSceneAssetKey],
): void => {
  const first = createRegisteredSceneAsset(assetKey, request);
  const second = createRegisteredSceneAsset(assetKey, request);
  const firstResources = collectDisposableResources(first);
  const secondResources = collectDisposableResources(second);
  const firstDisposalSpies = collectDisposableSpies(firstResources);
  const secondDisposalSpies = collectDisposableSpies(secondResources);
  const expectDisjoint = <T,>(left: Set<T>, right: Set<T>): void => {
    expect([...left].filter((resource) => right.has(resource))).toEqual([]);
  };
  let firstDisposed = false;
  let secondDisposed = false;

  try {
    expect(first).not.toBe(second);
    expectDisjoint(firstResources.geometries, secondResources.geometries);
    expectDisjoint(firstResources.materials, secondResources.materials);
    expectDisjoint(firstResources.textures, secondResources.textures);

    disposeRegisteredSceneAsset(assetKey, first);
    firstDisposed = true;
    firstDisposalSpies.forEach((spy) => expect(spy).toHaveBeenCalledTimes(1));
    secondDisposalSpies.forEach((spy) => expect(spy).not.toHaveBeenCalled());
    expect(second.children.length).toBeGreaterThan(0);
    second.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      expect(object.geometry).toBeDefined();
      expect(object.material).toBeDefined();
    });

    disposeRegisteredSceneAsset(assetKey, second);
    secondDisposed = true;
    secondDisposalSpies.forEach((spy) => expect(spy).toHaveBeenCalledTimes(1));
  } finally {
    if (!firstDisposed) disposeRegisteredSceneAsset(assetKey, first);
    if (!secondDisposed) disposeRegisteredSceneAsset(assetKey, second);
  }
};

const exerciseReplacement = (
  assetKey: InstanceOwnedSceneAssetKey,
  request: SceneAssetRequestMap[InstanceOwnedSceneAssetKey],
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
    const productionResources = collectDisposableSpies(
      collectDisposableResources(productionGroup),
    );
    disposeRegisteredSceneAsset(assetKey, productionGroup);
    productionGroup = null;
    productionResources.forEach((spy) => expect(spy).toHaveBeenCalledTimes(1));

    productionFactoryCalls.clear();
    substituteGroup = new THREE.Group();
    substituteGroup.name = `substitute:${expectedSceneId}`;
    substituteGroup.position.set(3, -2, 5);
    substituteGroup.add(new THREE.Object3D());
    const substituteFactory = vi.fn(
      (receivedRequest: SceneAssetRequestMap[InstanceOwnedSceneAssetKey]): THREE.Group => {
        expect(receivedRequest).toBe(request);
        return substituteGroup!;
      },
    );
    const substituteDisposer = vi.fn((group: THREE.Group) => group.clear());
    const substituteRegistration: SceneAssetRegistration<InstanceOwnedSceneAssetKey> = Object.freeze({
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

const exerciseSharedReplacement = (
  assetKey: ModuleSharedSceneAssetKey,
  request: SceneAssetRequestMap[ModuleSharedSceneAssetKey],
  productionFactoryCalls: FactoryCallCounter,
  expectedGroupName: string,
  expectedSceneId: string,
): void => {
  const productionRegistration = resolveSceneAsset(assetKey);
  expect(productionRegistration.renderResourceLifetime).toBe("module-shared");
  expect(assetKey).not.toBe(expectedSceneId);
  const resultsBefore = semanticResults();
  const productionGroup = createRegisteredSceneAsset(assetKey, request);
  const productionResourceDisposals = collectDisposableSpies(
    collectDisposableResources(productionGroup),
  );

  try {
    expect(productionFactoryCalls.calls()).toBe(1);
    expect(productionFactoryCalls.firstRequest()).toBe(request);
    expect(productionGroup.name).toBe(expectedGroupName);
    expect(productionGroup.userData.assetImplementationId).toBe(
      productionRegistration.implementationId,
    );
    productionResourceDisposals.forEach((spy) => expect(spy).not.toHaveBeenCalled());
    disposeRegisteredSceneAsset(assetKey, productionGroup);
    productionResourceDisposals.forEach((spy) => expect(spy).not.toHaveBeenCalled());

    productionFactoryCalls.clear();
    const substituteGroup = new THREE.Group();
    substituteGroup.name = `substitute:${expectedSceneId}`;
    substituteGroup.position.set(3, -2, 5);
    substituteGroup.add(new THREE.Object3D());
    const substituteFactory = vi.fn(
      (receivedRequest: SceneAssetRequestMap[ModuleSharedSceneAssetKey]): THREE.Group => {
        expect(receivedRequest).toBe(request);
        return substituteGroup;
      },
    );
    const substituteRegistration: SceneAssetRegistration<ModuleSharedSceneAssetKey> = Object.freeze({
      assetKey,
      implementationId: `test-substitute-${expectedSceneId}`,
      renderResourceLifetime: "module-shared",
      create: substituteFactory,
    });
    const substituteRegistry: SceneAssetRegistry = Object.freeze({
      [assetKey]: substituteRegistration,
    });
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
    expect(createdSubstitute.position.toArray()).toEqual([3, -2, 5]);
    expect(createdSubstitute.children).toHaveLength(1);
    expect(createdSubstitute.userData.assetImplementationId).toBe(
      substituteRegistration.implementationId,
    );
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
    expect(createdSubstitute.parent).toBeNull();
    expect(productionResourceDisposals.every((spy) => !spy.mock.calls.length)).toBe(true);
  } finally {
    disposeRegisteredSceneAsset(assetKey, productionGroup);
    productionResourceDisposals.forEach((spy) => expect(spy).not.toHaveBeenCalled());
  }
};

describe("static teaching scene asset migrations", () => {
  it("disposes each Macro asset instance without sharing or invalidating another instance", () => {
    const macroAssets = [
      [MACRO_BELLOWS_EXTENSION_ASSET_KEY, { presentation: MACRO_BELLOWS_EXTENSION_PRESENTATION }],
      [MACRO_DEPTH_OF_FIELD_ASSET_KEY, { presentation: MACRO_DEPTH_OF_FIELD_PRESENTATION }],
      [MACRO_OBLIQUE_PLANE_ASSET_KEY, { presentation: MACRO_OBLIQUE_PLANE_PRESENTATION }],
      [MACRO_COMPOUND_MOVEMENTS_ASSET_KEY, { presentation: MACRO_COMPOUND_MOVEMENTS_PRESENTATION }],
    ] as const;

    macroAssets.forEach(([assetKey, request]) => {
      expectInstanceOwnedResourcesDisposedOnce(assetKey, request);
      expectAssetInstancesOwnDisjointResources(assetKey, request);
    });
  });

  it("disposes SA3B per-instance resources once through the production registry", () => {
    expectInstanceOwnedResourcesDisposedOnce(
      ARCHITECTURE_FOREGROUND_ASSET_KEY,
      { presentation: ARCHITECTURE_FOREGROUND_PRESENTATION },
    );
    expectInstanceOwnedResourcesDisposedOnce(INTERIOR_CORNER_ASSET_KEY, {
      presentation: INTERIOR_CORNER_PRESENTATION,
    });
    expectInstanceOwnedResourcesDisposedOnce(OBLIQUE_TABLETOP_ASSET_KEY, {
      presentation: OBLIQUE_TABLETOP_PRESENTATION,
    });
  });

  it("creates viewport and RTT representations through one instance-owned registered implementation", () => {
    const registration = resolveSceneAsset(MIRROR_SHIFT_ASSET_KEY);
    const viewportRequest: SceneAssetRequestMap[typeof MIRROR_SHIFT_ASSET_KEY] = {
      presentation: MIRROR_SHIFT_PRESENTATION,
      representation: "viewport",
    };
    const rttRequest: SceneAssetRequestMap[typeof MIRROR_SHIFT_ASSET_KEY] = {
      presentation: MIRROR_SHIFT_PRESENTATION,
      representation: "rtt",
    };
    const factorySpy = vi.spyOn(mirrorShiftAsset, "createMirrorShiftAssetGroup");
    const viewport = createRegisteredSceneAsset(
      MIRROR_SHIFT_ASSET_KEY,
      viewportRequest,
    );
    const rtt = createRegisteredSceneAsset(MIRROR_SHIFT_ASSET_KEY, rttRequest);
    const viewportResources = collectDisposableResources(viewport);
    const rttResources = collectDisposableResources(rtt);
    const viewportDisposals = collectDisposableSpies(viewportResources);
    const rttDisposals = collectDisposableSpies(rttResources);
    const viewportProp = viewport.getObjectByName("mirror-shift-real-tall-marker");
    const reflectedProp = rtt.getObjectByName("mirror-shift-reflected-tall-marker");
    const reflectedPropGeometry = (reflectedProp as THREE.Mesh).geometry;
    const mountedScene = new THREE.Scene();
    let viewportDisposed = false;
    let rttDisposed = false;

    try {
      expect(registration.implementationId).toBe("threejs-mirror-shift");
      expect(registration.renderResourceLifetime ?? "instance-owned").toBe(
        "instance-owned",
      );
      expect(registration.dispose).toBeTypeOf("function");
      expect(MIRROR_SHIFT_ASSET_KEY).not.toBe(mirrorShiftScene.id);
      expect(viewport).not.toBe(rtt);
      expect(viewport.userData.assetImplementationId).toBe(
        registration.implementationId,
      );
      expect(rtt.userData.assetImplementationId).toBe(registration.implementationId);
      expect(factorySpy).toHaveBeenNthCalledWith(1, viewportRequest);
      expect(factorySpy).toHaveBeenNthCalledWith(2, rttRequest);

      expect(viewport.getObjectByName("mirror-shift-mirror-surface")).toBeInstanceOf(
        THREE.Mesh,
      );
      expect(viewportProp).toBeInstanceOf(THREE.Mesh);
      expect(viewport.getObjectByName("mirror-shift-reflected-props")).toBeUndefined();
      expect(viewport.getObjectByName("mirror-shift-reflected-floor")).toBeUndefined();
      expect(viewport.getObjectByName("mirror-shift-camera-reflection")).toBeUndefined();
      expect(rtt.getObjectByName("mirror-shift-mirror-surface")).toBeInstanceOf(
        THREE.Mesh,
      );
      expect(reflectedProp).toBeInstanceOf(THREE.Mesh);
      expect(rtt.getObjectByName("mirror-shift-reflected-floor")).toBeInstanceOf(
        THREE.Mesh,
      );
      expect(rtt.getObjectByName("mirror-shift-camera-reflection")).toBeInstanceOf(
        THREE.Group,
      );

      expect(viewportResources.geometries.size).toBeGreaterThan(0);
      expect(viewportResources.materials.size).toBeGreaterThan(0);
      expect(viewportResources.textures.size).toBeGreaterThan(0);
      expect(rttResources.geometries.size).toBeGreaterThan(0);
      expect(rttResources.materials.size).toBeGreaterThan(0);
      expect(rttResources.textures.size).toBeGreaterThan(0);
      expect([...viewportResources.geometries].some((value) => rttResources.geometries.has(value))).toBe(false);
      expect([...viewportResources.materials].some((value) => rttResources.materials.has(value))).toBe(false);
      expect([...viewportResources.textures].some((value) => rttResources.textures.has(value))).toBe(false);

      mountedScene.add(viewport, rtt);
      mountedScene.remove(viewport);
      disposeRegisteredSceneAsset(MIRROR_SHIFT_ASSET_KEY, viewport);
      viewportDisposed = true;
      viewportDisposals.forEach((spy) => expect(spy).toHaveBeenCalledTimes(1));
      rttDisposals.forEach((spy) => expect(spy).not.toHaveBeenCalled());
      expect(rtt.parent).toBe(mountedScene);
      expect((reflectedProp as THREE.Mesh).geometry).toBe(reflectedPropGeometry);
      expect(rttResources.geometries.has(reflectedPropGeometry)).toBe(true);
      expect(rttDisposals.every((spy) => spy.mock.calls.length === 0)).toBe(true);

      mountedScene.remove(rtt);
      disposeRegisteredSceneAsset(MIRROR_SHIFT_ASSET_KEY, rtt);
      rttDisposed = true;
      rttDisposals.forEach((spy) => expect(spy).toHaveBeenCalledTimes(1));
    } finally {
      if (!viewportDisposed) disposeRegisteredSceneAsset(MIRROR_SHIFT_ASSET_KEY, viewport);
      if (!rttDisposed) disposeRegisteredSceneAsset(MIRROR_SHIFT_ASSET_KEY, rtt);
      vi.restoreAllMocks();
    }
  });

  it("keeps the Interior Corner practical light in its subject object graph", () => {
    const group = createRegisteredSceneAsset(INTERIOR_CORNER_ASSET_KEY, {
      presentation: INTERIOR_CORNER_PRESENTATION,
    });
    let disposalStarted = false;

    try {
      const light = group.getObjectByName("interior-corner-local-light");
      expect(light).toBeInstanceOf(THREE.PointLight);
      expect(light?.parent).toBe(group);
      if (!(light instanceof THREE.PointLight)) return;
      const lightDispose = vi.spyOn(light, "dispose");

      expect(light.color.getHexString()).toBe(
        new THREE.Color("#fff1d6").getHexString(),
      );
      expect(light.intensity).toBe(5);
      expect(light.distance).toBe(7.5);
      expect(light.decay).toBe(2);
      expect(light.position.x).toBeCloseTo(0.42);
      expect(light.position.y).toBeCloseTo(
        (INTERIOR_CORNER_PRESENTATION.geometry.room.floorY + 1310) / 1000,
      );
      expect(light.position.z).toBeCloseTo(8.3);
      expect(light.castShadow).toBe(false);
      expect(light.shadow.map).toBeNull();

      // This PointLight belongs to the object graph. With shadows disabled it
      // has no allocated shadow target; the teaching-resource disposer handles
      // mesh-owned geometries, materials, and textures without disposing it.
      disposalStarted = true;
      disposeRegisteredSceneAsset(INTERIOR_CORNER_ASSET_KEY, group);
      expect(lightDispose).not.toHaveBeenCalled();
    } finally {
      if (!disposalStarted) {
        disposeRegisteredSceneAsset(INTERIOR_CORNER_ASSET_KEY, group);
      }
    }
  });

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
    const focusFundamentalsFactorySpy = vi.spyOn(
      focusFundamentalsAsset,
      "createFocusFundamentalsGroup",
    );
    const viewCameraAnatomyFactorySpy = vi.spyOn(
      viewCameraAnatomyAsset,
      "createLessonZeroGroundGlassGroup",
    );
    const mirrorShiftFactorySpy = vi.spyOn(
      mirrorShiftAsset,
      "createMirrorShiftAssetGroup",
    );
    const macroBellowsExtensionFactorySpy = vi.spyOn(
      macroBellowsExtensionAsset,
      "createMacroSpecimenGroup",
    );
    const macroDepthOfFieldFactorySpy = vi.spyOn(
      macroDepthOfFieldAsset,
      "createMacroDepthOfFieldGroup",
    );
    const macroObliquePlaneFactorySpy = vi.spyOn(
      macroObliquePlaneAsset,
      "createMacroObliquePlaneGroup",
    );
    const macroCompoundMovementsFactorySpy = vi.spyOn(
      macroCompoundMovementsAsset,
      "createMacroCompoundMovementsGroup",
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
    exerciseSharedReplacement(
      FOCUS_FUNDAMENTALS_ASSET_KEY,
      { presentation: FOCUS_FUNDAMENTALS_PRESENTATION },
      countFactoryCalls(focusFundamentalsFactorySpy),
      "focus-fundamentals-subject",
      "focus-fundamentals-two-targets",
    );
    exerciseSharedReplacement(
      VIEW_CAMERA_ANATOMY_ASSET_KEY,
      { presentation: VIEW_CAMERA_ANATOMY_PRESENTATION },
      countFactoryCalls(viewCameraAnatomyFactorySpy),
      "view-camera-anatomy-subject",
      "view-camera-anatomy",
    );
    exerciseReplacement(
      MACRO_BELLOWS_EXTENSION_ASSET_KEY,
      { presentation: MACRO_BELLOWS_EXTENSION_PRESENTATION },
      countFactoryCalls(macroBellowsExtensionFactorySpy),
      "macro-bellows-extension-subject",
      "macro-bellows-extension",
    );
    exerciseReplacement(
      MACRO_DEPTH_OF_FIELD_ASSET_KEY,
      { presentation: MACRO_DEPTH_OF_FIELD_PRESENTATION },
      countFactoryCalls(macroDepthOfFieldFactorySpy),
      "macro-depth-of-field-subject",
      "macro-depth-of-field",
    );
    exerciseReplacement(
      MACRO_OBLIQUE_PLANE_ASSET_KEY,
      { presentation: MACRO_OBLIQUE_PLANE_PRESENTATION },
      countFactoryCalls(macroObliquePlaneFactorySpy),
      "macro-oblique-plane-subject",
      "macro-oblique-plane",
    );
    exerciseReplacement(
      MACRO_COMPOUND_MOVEMENTS_ASSET_KEY,
      { presentation: MACRO_COMPOUND_MOVEMENTS_PRESENTATION },
      countFactoryCalls(macroCompoundMovementsFactorySpy),
      "macro-compound-movements-subject",
      "macro-compound-movements",
    );
    exerciseReplacement(
      MIRROR_SHIFT_ASSET_KEY,
      {
        presentation: MIRROR_SHIFT_PRESENTATION,
        representation: "rtt",
      },
      countFactoryCalls(mirrorShiftFactorySpy),
      "mirror-shift-subject",
      "mirror-shift",
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
      "src/scenes/definitions/focus-fundamentals-two-targets.ts",
      "src/scenes/definitions/view-camera-anatomy.ts",
      "src/scenes/presentation/focusFundamentals.ts",
      "src/scenes/presentation/viewCameraAnatomy.ts",
      "src/scenes/definitions/mirror-shift.ts",
      "src/scenes/presentation/mirrorShift.ts",
      "src/scenes/definitions/macro-bellows-extension.ts",
      "src/scenes/definitions/macro-depth-of-field.ts",
      "src/scenes/definitions/macro-oblique-plane.ts",
      "src/scenes/definitions/macro-compound-movements.ts",
      "src/scenes/presentation/macroBellowsExtension.ts",
      "src/scenes/presentation/macroDepthOfField.ts",
      "src/scenes/presentation/macroObliquePlane.ts",
      "src/scenes/presentation/macroCompoundMovements.ts",
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
