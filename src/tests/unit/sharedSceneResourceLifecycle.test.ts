import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as THREE from "three";
import { afterEach, describe, expect, it, vi } from "vitest";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import { taskRegistry } from "../../core/tasks/taskRegistry";
import { publicSceneCatalog } from "../../app/publicScenes";
import type { SceneDefinition } from "../../types/scene";
import { DEFAULT_CAMERA_STATE } from "../../utils/constants";
import {
  FocusFundamentalsSubject,
  ViewCameraAnatomySubject,
} from "../../render/SceneAssetSubjects";
import {
  FOCUS_FUNDAMENTALS_ASSET_KEY,
  VIEW_CAMERA_ANATOMY_ASSET_KEY,
  createRegisteredSceneAsset,
  disposeRegisteredSceneAsset,
  resolveSceneAsset,
  type ModuleSharedSceneAssetKey,
  type SceneAssetRequestMap,
} from "../../render/assets/sceneAssetRegistry";
import {
  getGroundGlassSceneProfile,
} from "../../render/groundGlassSceneProfiles";
import {
  getRegisteredSceneSubject,
  getSceneSubjectRegistration,
} from "../../render/sceneSubjectRegistry";
import { focusFundamentalsTwoTargets } from "../../scenes/definitions/focus-fundamentals-two-targets";
import { viewCameraAnatomyScene } from "../../scenes/definitions/view-camera-anatomy";
import {
  focusFundamentalsFocusDetails,
  focusFundamentalsFrameGeometry,
} from "../../scenes/focusFundamentalsTargets";
import { lessonZeroGroundGlassSubjectGeometry } from "../../scenes/lessonZeroGroundGlassSubject";
import { CAMERA_MOVEMENT_BASELINE_PRESENTATION } from "../../scenes/presentation/understandingCameraMovements";
import { FOCUS_FUNDAMENTALS_PRESENTATION } from "../../scenes/presentation/focusFundamentals";
import { VIEW_CAMERA_ANATOMY_PRESENTATION } from "../../scenes/presentation/viewCameraAnatomy";
import {
  deriveFocusFundamentalsReferenceOptics,
  resolveFocusFundamentalsTeachingCue,
} from "../../scenes/focusFundamentalsPresentation";

afterEach(() => vi.restoreAllMocks());

type SharedResourceCandidate = {
  scene: SceneDefinition;
  subject: typeof FocusFundamentalsSubject | typeof ViewCameraAnatomySubject;
  assetKey: ModuleSharedSceneAssetKey;
  registryKeyName: string;
  request: SceneAssetRequestMap[ModuleSharedSceneAssetKey];
  factoryPath: string;
  factoryName: string;
  expectedResourceCounts: {
    geometries: number;
    materials: number;
    textures: number;
  };
};

const sharedResourceCandidates: readonly SharedResourceCandidate[] = [
  {
    scene: focusFundamentalsTwoTargets,
    subject: FocusFundamentalsSubject,
    assetKey: FOCUS_FUNDAMENTALS_ASSET_KEY,
    registryKeyName: "FOCUS_FUNDAMENTALS_ASSET_KEY",
    request: { presentation: FOCUS_FUNDAMENTALS_PRESENTATION },
    factoryPath: "src/render/FocusFundamentalsSubjectFactory.tsx",
    factoryName: "createFocusFundamentalsGroup",
    expectedResourceCounts: { geometries: 11, materials: 7, textures: 2 },
  },
  {
    scene: viewCameraAnatomyScene,
    subject: ViewCameraAnatomySubject,
    assetKey: VIEW_CAMERA_ANATOMY_ASSET_KEY,
    registryKeyName: "VIEW_CAMERA_ANATOMY_ASSET_KEY",
    request: { presentation: VIEW_CAMERA_ANATOMY_PRESENTATION },
    factoryPath: "src/render/LessonZeroGroundGlassSubjectFactory.tsx",
    factoryName: "createLessonZeroGroundGlassGroup",
    expectedResourceCounts: { geometries: 1, materials: 5, textures: 0 },
  },
];

const materialTextureSlots = [
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
] as const;

const collectSubjectObjectsAndResources = (group: THREE.Group) => {
  const objects = new Set<THREE.Object3D>();
  const meshes = new Set<THREE.Mesh>();
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();

  group.traverse((object) => {
    objects.add(object);
    if (!(object instanceof THREE.Mesh)) return;

    meshes.add(object);
    geometries.add(object.geometry);
    const meshMaterials = Array.isArray(object.material)
      ? object.material
      : [object.material];
    meshMaterials.forEach((material) => {
      materials.add(material);
      const materialWithTextureSlots = material as THREE.Material &
        Partial<Record<(typeof materialTextureSlots)[number], THREE.Texture | null>>;
      materialTextureSlots.forEach((slot) => {
        const texture = materialWithTextureSlots[slot];
        if (texture instanceof THREE.Texture) textures.add(texture);
      });
    });
  });

  return { objects, meshes, geometries, materials, textures };
};

const expectSameIdentitySet = <T,>(first: ReadonlySet<T>, second: ReadonlySet<T>) => {
  expect(second.size).toBe(first.size);
  first.forEach((value) => expect(second.has(value)).toBe(true));
};

const spyOnResourceDisposal = (
  resources: ReturnType<typeof collectSubjectObjectsAndResources>,
) => [
  ...[...resources.geometries].map((resource) => vi.spyOn(resource, "dispose")),
  ...[...resources.materials].map((resource) => vi.spyOn(resource, "dispose")),
  ...[...resources.textures].map((resource) => vi.spyOn(resource, "dispose")),
];

const canonicalSceneSnapshot = () => {
  const scenes = sharedResourceCandidates.map(({ scene }) => scene);
  const sceneIds = new Set(scenes.map(({ id }) => id));
  const focusOptics = deriveOpticsState(
    {
      ...DEFAULT_CAMERA_STATE,
      ...focusFundamentalsTwoTargets.cameraPreset,
      activeSceneId: focusFundamentalsTwoTargets.id,
    },
    focusFundamentalsTwoTargets,
  );
  const focusReferenceOptics = deriveFocusFundamentalsReferenceOptics(
    focusOptics,
    focusFundamentalsTwoTargets,
  );
  const optics = scenes.map((scene) => {
    const state = deriveOpticsState(
      {
        ...DEFAULT_CAMERA_STATE,
        ...scene.cameraPreset,
        activeSceneId: scene.id,
      },
      scene,
    );
    return {
      sceneId: scene.id,
      lensCenterWorld: state.lensCenterWorld,
      focusPointWorld: state.focusPointWorld,
      focusPlane: state.focusPlane,
      focusStandard: state.diagnostics.focusStandard,
      fallbackApplied: state.diagnostics.fallbackApplied,
    };
  });

  return structuredClone({
    scenes,
    tasks: Object.values(taskRegistry).filter((task) => sceneIds.has(task.sceneId)),
    anatomyLesson: publicSceneCatalog.find(
      ({ id }) => id === viewCameraAnatomyScene.id,
    )?.lesson,
    focusFundamentals: {
      focusDetails: focusFundamentalsFocusDetails,
      frameGeometry: focusFundamentalsFrameGeometry,
      teachingCue:
        focusReferenceOptics === null
          ? null
          : resolveFocusFundamentalsTeachingCue(focusOptics, focusReferenceOptics),
    },
    anatomyGeometry: lessonZeroGroundGlassSubjectGeometry,
    optics,
  });
};

const createGroundGlassContext = (scene: SceneDefinition) => ({
  scene,
  cameraMovementPresentation: CAMERA_MOVEMENT_BASELINE_PRESENTATION,
  presentationRegion: "whole" as const,
});

describe("module-shared scene subject resource lifecycle", () => {
  for (const candidate of sharedResourceCandidates) {
    it(`${candidate.scene.id} shares render resources safely across consumers and remounts`, () => {
      const before = canonicalSceneSnapshot();
      const registration = getSceneSubjectRegistration(candidate.scene.id);
      expect(registration?.SceneSubject).toBe(candidate.subject);
      expect(getRegisteredSceneSubject(candidate.scene.id)).toBe(candidate.subject);
      expect(registration?.disposeRttGroup).toBeDefined();
      const assetRegistration = resolveSceneAsset(candidate.assetKey);
      expect(assetRegistration.renderResourceLifetime).toBe("module-shared");

      const interactiveScene = new THREE.Scene();
      const rttScene = new THREE.Scene();
      const interactiveGroup = createRegisteredSceneAsset(
        candidate.assetKey,
        candidate.request,
      );
      expect(interactiveGroup.userData.assetImplementationId).toBe(
        assetRegistration.implementationId,
      );
      interactiveScene.add(interactiveGroup);
      const interactiveResources = collectSubjectObjectsAndResources(interactiveGroup);

      expect(interactiveResources.geometries.size).toBe(
        candidate.expectedResourceCounts.geometries,
      );
      expect(interactiveResources.materials.size).toBe(
        candidate.expectedResourceCounts.materials,
      );
      expect(interactiveResources.textures.size).toBe(
        candidate.expectedResourceCounts.textures,
      );

      const profile = getGroundGlassSceneProfile(candidate.scene);
      const mountedRtt = profile.mountSubject(
        rttScene,
        createGroundGlassContext(candidate.scene),
      );
      if (!mountedRtt) throw new Error(`Expected RTT subject for ${candidate.scene.id}`);
      profile.configureRttShadowParticipation(mountedRtt.group);

      expect(rttScene.children).toContain(mountedRtt.group);
      expect(mountedRtt.group.userData.assetImplementationId).toBe(
        assetRegistration.implementationId,
      );
      expect(mountedRtt.group).not.toBe(interactiveGroup);
      const rttResources = collectSubjectObjectsAndResources(mountedRtt.group);
      expect(rttResources.meshes.size).toBeGreaterThan(0);
      expectSameIdentitySet(interactiveResources.geometries, rttResources.geometries);
      expectSameIdentitySet(interactiveResources.materials, rttResources.materials);
      expectSameIdentitySet(interactiveResources.textures, rttResources.textures);
      expect(
        [...interactiveResources.objects].some((object) => rttResources.objects.has(object)),
      ).toBe(false);

      const disposalSpies = spyOnResourceDisposal(interactiveResources);
      mountedRtt.dispose();

      expect(rttScene.children).not.toContain(mountedRtt.group);
      expect(interactiveScene.children).toContain(interactiveGroup);
      disposalSpies.forEach((spy) => expect(spy).not.toHaveBeenCalled());

      const remountedRtt = profile.mountSubject(
        rttScene,
        createGroundGlassContext(candidate.scene),
      );
      if (!remountedRtt) throw new Error(`Expected RTT remount for ${candidate.scene.id}`);
      const remountedResources = collectSubjectObjectsAndResources(remountedRtt.group);
      expectSameIdentitySet(interactiveResources.geometries, remountedResources.geometries);
      expectSameIdentitySet(interactiveResources.materials, remountedResources.materials);
      expectSameIdentitySet(interactiveResources.textures, remountedResources.textures);

      // Simulate removal of the interactive Object3D graph while RTT still borrows
      // the same module resources. R3F uses dispose={null} for these primitives.
      interactiveScene.remove(interactiveGroup);
      disposeRegisteredSceneAsset(candidate.assetKey, interactiveGroup);
      expect(rttScene.children).toContain(remountedRtt.group);
      disposalSpies.forEach((spy) => expect(spy).not.toHaveBeenCalled());

      remountedRtt.dispose();
      expect(rttScene.children).not.toContain(remountedRtt.group);

      const afterRemount = createRegisteredSceneAsset(
        candidate.assetKey,
        candidate.request,
      );
      const afterRemountResources = collectSubjectObjectsAndResources(afterRemount);
      expectSameIdentitySet(interactiveResources.geometries, afterRemountResources.geometries);
      expectSameIdentitySet(interactiveResources.materials, afterRemountResources.materials);
      expectSameIdentitySet(interactiveResources.textures, afterRemountResources.textures);
      disposalSpies.forEach((spy) => expect(spy).not.toHaveBeenCalled());
      expect(canonicalSceneSnapshot()).toEqual(before);
    });

    it(`${candidate.scene.id} keeps R3F automatic disposal disabled for borrowed resources`, () => {
      const source = readFileSync(
        resolve(process.cwd(), "src/render/SceneAssetSubjects.tsx"),
        "utf8",
      );
      const registrySource = readFileSync(
        resolve(process.cwd(), "src/render/assets/sceneAssetRegistry.ts"),
        "utf8",
      );
      expect(source).toContain("<primitive object={group} dispose={null} />");
      expect(source).toContain("createRegisteredSceneAsset");
      expect(source).toContain("disposeRegisteredSceneAsset");
      expect(registrySource).toContain(candidate.factoryName);
      const sceneRegistrySource = readFileSync(
        resolve(process.cwd(), "src/render/sceneSubjectRegistry.tsx"),
        "utf8",
      );
      expect(sceneRegistrySource).toContain("createRegisteredSceneAsset");
      expect(sceneRegistrySource).toContain(candidate.registryKeyName);
      const factorySource = readFileSync(
        resolve(process.cwd(), candidate.factoryPath),
        "utf8",
      );
      expect(factorySource).not.toContain("disposeTeachingSubjectResources");
    });
  }
});
