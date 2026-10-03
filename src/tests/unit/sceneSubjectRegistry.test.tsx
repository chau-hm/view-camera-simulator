import { cleanup, render } from "@testing-library/react";
import { StrictMode } from "react";
import type { ComponentType } from "react";
import * as THREE from "three";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ArchitectureRiseSubject,
  MirrorShiftSubject,
  ShelfSwingSubject,
} from "../../render/SceneAssetSubjects";
import {
  ArchitectureRiseRegisteredSubject,
  createRegisteredRttSubject,
  disposeRegisteredRttSubject,
  getRegisteredSceneSubject,
  getSceneSubjectRegistration,
  sceneSubjectRegistry,
} from "../../render/sceneSubjectRegistry";
import { architectureRiseScene } from "../../scenes/definitions/architecture-rise";
import {
  getAvailablePublicSceneEntries,
  getPublishedPublicSceneEntries,
  getPublicSceneEntries,
  publicSceneIds,
  type PublicSceneId,
} from "../../app/publicScenes";
import { scenePublication } from "../../config/scenePublication";
import { getAllScenes } from "../../scenes/definitions";
import geometry from "../../scenes/shelfSwingGeometry";
import obliqueTabletopGeometry from "../../scenes/obliqueTabletopGeometry";
import { CAMERA_MOVEMENT_LATTICE } from "../../scenes/cameraMovementLatticeGeometry";
import { CAMERA_MOVEMENT_SCENE_CALIBRATION } from "../../scenes/cameraMovementSceneCalibration";
import { CAMERA_MOVEMENT_BASELINE_PRESENTATION } from "../../scenes/presentation/understandingCameraMovements";
import { CAMERA_MOVEMENT_LATTICE_GEOMETRY_ID } from "../../render/assets/CameraMovementLatticeAsset";
import { isGroundGlassRttScene, RTT_SCENES } from "../../render/groundGlassRttScenes";
import {
  mirrorShiftGeometry,
  reflectPointAcrossMirrorPlane,
} from "../../scenes/mirrorShiftGeometry";
import {
  lessonZeroGroundGlassSubjectBoundsMm,
  lessonZeroGroundGlassSubjectGeometry,
} from "../../scenes/lessonZeroGroundGlassSubject";
import {
  resolvePresentationLightingPlacement,
  resolveScenePresentationLighting,
} from "../../render/presentationLighting";
import {
  createPresentationLightingRig,
  disposePresentationLightingRig,
} from "../../render/TeachingLighting";
import {
  createWorldIlluminationRig,
  disposeWorldIlluminationRig,
} from "../../render/worldIlluminationRig";
import { resolveSceneWorldIllumination } from "../../scenes/illumination/sceneWorldIllumination";
import {
  DEFAULT_PRESENTATION_LIGHTING_PLACEMENT,
  TEACHING_PRESENTATION_LIGHTING_PROFILE,
} from "../../render/presentationLightingContract";
import { WORLD_SCALE } from "../../render/rttUtils";
import * as architectureRiseAsset from "../../render/ArchitectureRiseSubjectFactory";
import * as obliqueArchitectureAsset from "../../render/ObliqueArchitectureSubjectFactory";
import * as tableTiltAsset from "../../render/TableTiltSubjectFactory";
import * as shelfSwingAsset from "../../render/ShelfSwingSubjectFactory";
import * as architectureForegroundAsset from "../../render/ArchitectureForegroundSubjectFactory";
import * as interiorCornerAsset from "../../render/InteriorCornerSubjectFactory";
import * as obliqueTabletopAsset from "../../render/ObliqueTabletopSubjectFactory";
import * as mirrorShiftAsset from "../../render/MirrorShiftSubjectFactory";
import {
  CAMERA_MOVEMENT_LATTICE_ASSET_KEY,
  ARCHITECTURE_FOREGROUND_ASSET_KEY,
  ARCHITECTURE_RISE_ASSET_KEY,
  INTERIOR_CORNER_ASSET_KEY,
  OBLIQUE_TABLETOP_ASSET_KEY,
  OBLIQUE_ARCHITECTURE_ASSET_KEY,
  TABLE_TILT_ASSET_KEY,
  SHELF_SWING_ASSET_KEY,
  FOCUS_FUNDAMENTALS_ASSET_KEY,
  VIEW_CAMERA_ANATOMY_ASSET_KEY,
  MIRROR_SHIFT_ASSET_KEY,
  MACRO_BELLOWS_EXTENSION_ASSET_KEY,
  MACRO_DEPTH_OF_FIELD_ASSET_KEY,
  MACRO_OBLIQUE_PLANE_ASSET_KEY,
  MACRO_COMPOUND_MOVEMENTS_ASSET_KEY,
  createRegisteredSceneAsset,
  disposeRegisteredSceneAsset,
  resolveSceneAsset,
  sceneAssetRegistry,
  type SceneAssetKey,
} from "../../render/assets/sceneAssetRegistry";
import { ARCHITECTURE_RISE_PRESENTATION } from "../../scenes/presentation/architectureRise";
import { OBLIQUE_ARCHITECTURE_PRESENTATION } from "../../scenes/presentation/obliqueArchitecture";
import { TABLE_TILT_PRESENTATION } from "../../scenes/presentation/tableTilt";
import { SHELF_SWING_PRESENTATION } from "../../scenes/presentation/shelfSwing";
import { ARCHITECTURE_FOREGROUND_PRESENTATION } from "../../scenes/presentation/architectureForeground";
import { INTERIOR_CORNER_PRESENTATION } from "../../scenes/presentation/interiorCorner";
import { OBLIQUE_TABLETOP_PRESENTATION } from "../../scenes/presentation/obliqueTabletop";
import { MACRO_BELLOWS_EXTENSION_PRESENTATION } from "../../scenes/presentation/macroBellowsExtension";
import { MACRO_DEPTH_OF_FIELD_PRESENTATION } from "../../scenes/presentation/macroDepthOfField";
import { MACRO_OBLIQUE_PLANE_PRESENTATION } from "../../scenes/presentation/macroObliquePlane";
import { MACRO_COMPOUND_MOVEMENTS_PRESENTATION } from "../../scenes/presentation/macroCompoundMovements";
import { obliqueArchitectureScene } from "../../scenes/definitions/oblique-architecture";
import { tableTiltScene } from "../../scenes/definitions/table-tilt";
import { shelfSwingScene } from "../../scenes/definitions/shelf-swing";
import { architectureForegroundScene } from "../../scenes/definitions/architecture-foreground";
import { interiorCornerScene } from "../../scenes/definitions/interior-corner";
import { obliqueTabletopScene } from "../../scenes/definitions/oblique-tabletop";
import { macroBellowsExtensionScene } from "../../scenes/definitions/macro-bellows-extension";
import { macroDepthOfFieldScene } from "../../scenes/definitions/macro-depth-of-field";
import { macroObliquePlaneScene } from "../../scenes/definitions/macro-oblique-plane";
import { macroCompoundMovementsScene } from "../../scenes/definitions/macro-compound-movements";
import * as macroBellowsExtensionAsset from "../../render/MacroSpecimenSubjectFactory";
import * as macroDepthOfFieldAsset from "../../render/MacroDepthOfFieldSubjectFactory";
import * as macroObliquePlaneAsset from "../../render/MacroObliquePlaneSubjectFactory";
import * as macroCompoundMovementsAsset from "../../render/MacroCompoundMovementsSubjectFactory";

const publicSceneAssetSlots = {
  "view-camera-anatomy": VIEW_CAMERA_ANATOMY_ASSET_KEY,
  "understanding-camera-movements": CAMERA_MOVEMENT_LATTICE_ASSET_KEY,
  "focus-fundamentals-two-targets": FOCUS_FUNDAMENTALS_ASSET_KEY,
  "architecture-rise": ARCHITECTURE_RISE_ASSET_KEY,
  "table-tilt": TABLE_TILT_ASSET_KEY,
  "shelf-swing": SHELF_SWING_ASSET_KEY,
  "oblique-tabletop": OBLIQUE_TABLETOP_ASSET_KEY,
  "mirror-shift": MIRROR_SHIFT_ASSET_KEY,
  "oblique-architecture": OBLIQUE_ARCHITECTURE_ASSET_KEY,
  "architecture-foreground": ARCHITECTURE_FOREGROUND_ASSET_KEY,
  "interior-corner": INTERIOR_CORNER_ASSET_KEY,
  "macro-bellows-extension": MACRO_BELLOWS_EXTENSION_ASSET_KEY,
  "macro-depth-of-field": MACRO_DEPTH_OF_FIELD_ASSET_KEY,
  "macro-oblique-plane": MACRO_OBLIQUE_PLANE_ASSET_KEY,
  "macro-compound-movements": MACRO_COMPOUND_MOVEMENTS_ASSET_KEY,
} as const satisfies Record<PublicSceneId, SceneAssetKey>;

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const collectDisposableSpies = (group: THREE.Group) => {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  group.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    geometries.add(object.geometry);
    const meshMaterials = Array.isArray(object.material) ? object.material : [object.material];
    meshMaterials.forEach((material) => materials.add(material));
  });
  return [
    ...[...geometries].map((resource) => vi.spyOn(resource, "dispose")),
    ...[...materials].map((resource) => vi.spyOn(resource, "dispose")),
  ];
};

type BoardFootprint = {
  center: { x: number; z: number };
  width: number;
  depth: number;
};

const boardFootprintFullyCovers = (
  outer: BoardFootprint,
  inner: BoardFootprint,
) =>
  Math.abs(outer.center.x - inner.center.x) + inner.width / 2 <= outer.width / 2 &&
  Math.abs(outer.center.z - inner.center.z) + inner.depth / 2 <= outer.depth / 2;

const boardFootprintsSeparated = (first: BoardFootprint, second: BoardFootprint) =>
  Math.abs(first.center.x - second.center.x) >= (first.width + second.width) / 2 ||
  Math.abs(first.center.z - second.center.z) >= (first.depth + second.depth) / 2;

describe("scene subject registry", () => {
  it("keeps public scenes, RTT subjects, and typed asset slots complete and aligned", () => {
    const publicIds = [...publicSceneIds].sort();
    const publishedIds = getPublishedPublicSceneEntries()
      .map(({ meta }) => meta.id)
      .sort();
    const publicEntryIds = getPublicSceneEntries()
      .map(({ meta }) => meta.id)
      .sort();
    const availableIds = getAvailablePublicSceneEntries()
      .map(({ meta }) => meta.id)
      .sort();
    const definedSceneIds = new Set(getAllScenes().map(({ id }) => id));

    expect(publishedIds.every((sceneId) => publicIds.includes(sceneId))).toBe(true);
    expect(publicEntryIds.every((sceneId) => publishedIds.includes(sceneId))).toBe(true);
    expect(availableIds.every((sceneId) => publicEntryIds.includes(sceneId))).toBe(true);
    expect([...RTT_SCENES].sort()).toEqual(publicIds);
    expect(Object.keys(sceneSubjectRegistry).sort()).toEqual(publicIds);
    expect(Object.keys(publicSceneAssetSlots).sort()).toEqual(publicIds);
    expect(Object.values(publicSceneAssetSlots).sort()).toEqual(
      Object.keys(sceneAssetRegistry).sort(),
    );
    publicIds.forEach((sceneId) => expect(definedSceneIds.has(sceneId)).toBe(true));

    const implementationIds: string[] = [];
    for (const sceneId of publicSceneIds) {
      const assetKey = publicSceneAssetSlots[sceneId];
      const registration = resolveSceneAsset(assetKey);
      implementationIds.push(registration.implementationId);

      const group = createRegisteredRttSubject(sceneId);
      try {
        expect(group, `public scene ${sceneId} must construct an RTT group`).not.toBeNull();
        expect(group?.userData.assetImplementationId).toBe(
          registration.implementationId,
        );
      } finally {
        if (group) disposeRegisteredRttSubject(sceneId, group);
      }
    }
    expect(new Set(implementationIds).size).toBe(publicSceneIds.length);
  });

  it("keeps implementation architecture when a published scene is hidden", () => {
    const hiddenSceneId: PublicSceneId = "macro-compound-movements";
    const isolatedPublication = {
      ...scenePublication,
      [hiddenSceneId]: false,
    };
    const publishedIds = getPublishedPublicSceneEntries(isolatedPublication).map(
      ({ meta }) => meta.id,
    );
    const publicEntryIds = getPublicSceneEntries(isolatedPublication).map(
      ({ meta }) => meta.id,
    );
    const availableIds = getAvailablePublicSceneEntries(isolatedPublication).map(
      ({ meta }) => meta.id,
    );

    expect(publishedIds).toHaveLength(publicSceneIds.length - 1);
    expect(publishedIds).not.toContain(hiddenSceneId);
    expect(publicEntryIds).not.toContain(hiddenSceneId);
    expect(availableIds).not.toContain(hiddenSceneId);

    expect(publicSceneIds).toContain(hiddenSceneId);
    expect(publicSceneAssetSlots[hiddenSceneId]).toBe(
      MACRO_COMPOUND_MOVEMENTS_ASSET_KEY,
    );
    expect(RTT_SCENES).toContain(hiddenSceneId);
    expect(sceneSubjectRegistry[hiddenSceneId]).toBeDefined();
    expect(resolveSceneAsset(publicSceneAssetSlots[hiddenSceneId])).toBeDefined();
  });

  it("registers every canonical rendered scene and rejects unknown IDs", () => {
    expect(Object.keys(sceneSubjectRegistry)).toEqual([
      "macro-bellows-extension",
      "macro-depth-of-field",
      "macro-oblique-plane",
      "macro-compound-movements",
      "view-camera-anatomy",
      "understanding-camera-movements",
      "focus-fundamentals-two-targets",
      "architecture-rise",
      "architecture-foreground",
      "oblique-architecture",
      "table-tilt",
      "shelf-swing",
      "oblique-tabletop",
      "mirror-shift",
      "interior-corner",
    ]);
    Object.keys(sceneSubjectRegistry).forEach((sceneId) => {
      expect(getSceneSubjectRegistration(sceneId)).toBeDefined();
      expect(getRegisteredSceneSubject(sceneId)).toBeDefined();
    });
    expect(getSceneSubjectRegistration("not-a-scene")).toBeUndefined();
    expect(getRegisteredSceneSubject("not-a-scene")).toBeUndefined();
    expect(createRegisteredRttSubject("not-a-scene")).toBeNull();
  });

  it("pairs every Strict Mode interactive asset creation with one registered disposer", () => {
    const factory = vi.spyOn(architectureRiseAsset, "createArchitectureRiseGroup");
    const disposer = vi.spyOn(architectureRiseAsset, "disposeArchitectureRiseGroup");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const view = render(
      <StrictMode>
        <ArchitectureRiseSubject />
      </StrictMode>,
    );
    consoleError.mockRestore();

    const createdGroups = factory.mock.results
      .filter((result) => result.type === "return")
      .map((result) => result.value as THREE.Group);
    expect(createdGroups.length).toBeGreaterThan(1);

    view.unmount();

    const disposedGroups = disposer.mock.calls.map(([group]) => group);
    expect(disposedGroups).toHaveLength(createdGroups.length);
    createdGroups.forEach((group) => {
      expect(disposedGroups.filter((disposedGroup) => disposedGroup === group)).toHaveLength(1);
    });
  });

  it("registers the Lesson 0 subject with canonical RTT bounds", () => {
    const registration = getSceneSubjectRegistration("view-camera-anatomy");
    expect(registration).toBeDefined();
    expect(getRegisteredSceneSubject("view-camera-anatomy")).toBe(registration?.SceneSubject);
    expect(registration?.rttBounds).toBe(lessonZeroGroundGlassSubjectBoundsMm);

    const group = createRegisteredRttSubject("view-camera-anatomy");
    expect(group?.name).toBe("view-camera-anatomy-subject");
    expect(group?.getObjectByName("view-camera-anatomy-target-board")).toBeInstanceOf(THREE.Mesh);
    expect(group?.children.length).toBe(lessonZeroGroundGlassSubjectGeometry.boxes.length);
    group?.traverse((object) => {
      expect(Number.isFinite(object.position.x)).toBe(true);
      expect(Number.isFinite(object.position.y)).toBe(true);
      expect(Number.isFinite(object.position.z)).toBe(true);
    });
  });

  it("requires every available public scene to declare the RTT subject contract", () => {
    for (const { meta: entry } of getAvailablePublicSceneEntries()) {
      expect(isGroundGlassRttScene(entry.id), `public scene ${entry.id} must use RTT`).toBe(true);
      expect(getSceneSubjectRegistration(entry.id), `public scene ${entry.id} needs a subject registration`).toBeDefined();
      expect(getRegisteredSceneSubject(entry.id), `public scene ${entry.id} needs a React subject`).toBeDefined();

      const group = createRegisteredRttSubject(entry.id);
      expect(group, `public scene ${entry.id} needs an RTT subject factory`).not.toBeNull();
      if (group) disposeRegisteredRttSubject(entry.id, group);
    }
  });

  it("registers Macro Scene 4 with its shared subject contract", () => {
    expect(isGroundGlassRttScene("macro-compound-movements")).toBe(true);
    expect(getSceneSubjectRegistration("macro-compound-movements")).toBeDefined();
    expect(getRegisteredSceneSubject("macro-compound-movements")).toBeDefined();
  });

  it("resolves Shelf Swing to its shared React subject and canonical RTT factory", () => {
    expect(getRegisteredSceneSubject("shelf-swing")).toBe(ShelfSwingSubject);
    const group = createRegisteredRttSubject("shelf-swing");
    expect(group).not.toBeNull();
    expect(group?.name).toBe("shelf-swing-subject");
    expect(group?.getObjectByName("shelf-swing-floor")).toBeInstanceOf(THREE.Mesh);
    geometry.subjects.forEach((subject) => {
      expect(group?.getObjectByName(subject.semanticName)).toBeInstanceOf(THREE.Group);
      expect(group?.getObjectByName(subject.focusChart.semanticName)).toBeInstanceOf(THREE.Group);
    });
    disposeRegisteredRttSubject("shelf-swing", group!);
  });

  it("routes each migrated interactive subject and RTT through the same registered presentation factory", () => {
    const candidates = [
      {
        scene: architectureRiseScene,
        assetKey: ARCHITECTURE_RISE_ASSET_KEY,
        presentation: ARCHITECTURE_RISE_PRESENTATION,
        factory: vi.spyOn(architectureRiseAsset, "createArchitectureRiseGroup"),
        disposer: vi.spyOn(architectureRiseAsset, "disposeArchitectureRiseGroup"),
      },
      {
        scene: obliqueArchitectureScene,
        assetKey: OBLIQUE_ARCHITECTURE_ASSET_KEY,
        presentation: OBLIQUE_ARCHITECTURE_PRESENTATION,
        factory: vi.spyOn(obliqueArchitectureAsset, "createObliqueArchitectureGroup"),
        disposer: vi.spyOn(obliqueArchitectureAsset, "disposeObliqueArchitectureGroup"),
      },
      {
        scene: tableTiltScene,
        assetKey: TABLE_TILT_ASSET_KEY,
        presentation: TABLE_TILT_PRESENTATION,
        factory: vi.spyOn(tableTiltAsset, "createTableTiltGroup"),
        disposer: vi.spyOn(tableTiltAsset, "disposeTableTiltGroup"),
      },
      {
        scene: shelfSwingScene,
        assetKey: SHELF_SWING_ASSET_KEY,
        presentation: SHELF_SWING_PRESENTATION,
        factory: vi.spyOn(shelfSwingAsset, "createShelfSwingGroup"),
        disposer: vi.spyOn(shelfSwingAsset, "disposeShelfSwingGroup"),
      },
      {
        scene: architectureForegroundScene,
        assetKey: ARCHITECTURE_FOREGROUND_ASSET_KEY,
        presentation: ARCHITECTURE_FOREGROUND_PRESENTATION,
        factory: vi.spyOn(
          architectureForegroundAsset,
          "createArchitectureForegroundGroup",
        ),
        disposer: vi.spyOn(
          architectureForegroundAsset,
          "disposeArchitectureForegroundGroup",
        ),
      },
      {
        scene: interiorCornerScene,
        assetKey: INTERIOR_CORNER_ASSET_KEY,
        presentation: INTERIOR_CORNER_PRESENTATION,
        factory: vi.spyOn(interiorCornerAsset, "createInteriorCornerGroup"),
        disposer: vi.spyOn(interiorCornerAsset, "disposeInteriorCornerGroup"),
      },
      {
        scene: obliqueTabletopScene,
        assetKey: OBLIQUE_TABLETOP_ASSET_KEY,
        presentation: OBLIQUE_TABLETOP_PRESENTATION,
        factory: vi.spyOn(obliqueTabletopAsset, "createObliqueTabletopGroup"),
        disposer: vi.spyOn(obliqueTabletopAsset, "disposeObliqueTabletopGroup"),
      },
      {
        scene: macroBellowsExtensionScene,
        assetKey: MACRO_BELLOWS_EXTENSION_ASSET_KEY,
        presentation: MACRO_BELLOWS_EXTENSION_PRESENTATION,
        factory: vi.spyOn(macroBellowsExtensionAsset, "createMacroSpecimenGroup"),
        disposer: vi.spyOn(macroBellowsExtensionAsset, "disposeMacroSpecimenGroup"),
      },
      {
        scene: macroDepthOfFieldScene,
        assetKey: MACRO_DEPTH_OF_FIELD_ASSET_KEY,
        presentation: MACRO_DEPTH_OF_FIELD_PRESENTATION,
        factory: vi.spyOn(macroDepthOfFieldAsset, "createMacroDepthOfFieldGroup"),
        disposer: vi.spyOn(macroDepthOfFieldAsset, "disposeMacroDepthOfFieldGroup"),
      },
      {
        scene: macroObliquePlaneScene,
        assetKey: MACRO_OBLIQUE_PLANE_ASSET_KEY,
        presentation: MACRO_OBLIQUE_PLANE_PRESENTATION,
        factory: vi.spyOn(macroObliquePlaneAsset, "createMacroObliquePlaneGroup"),
        disposer: vi.spyOn(macroObliquePlaneAsset, "disposeMacroObliquePlaneGroup"),
      },
      {
        scene: macroCompoundMovementsScene,
        assetKey: MACRO_COMPOUND_MOVEMENTS_ASSET_KEY,
        presentation: MACRO_COMPOUND_MOVEMENTS_PRESENTATION,
        factory: vi.spyOn(macroCompoundMovementsAsset, "createMacroCompoundMovementsGroup"),
        disposer: vi.spyOn(macroCompoundMovementsAsset, "disposeMacroCompoundMovementsGroup"),
      },
    ];

    candidates.forEach(({ scene, assetKey, presentation, factory, disposer }) => {
      const subject = getRegisteredSceneSubject(scene.id);
      expect(subject).toBeDefined();
      const Subject = subject as ComponentType<{ scene: typeof scene }>;
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
      const view = render(<Subject scene={scene} />);
      consoleError.mockRestore();
      const rttGroup = createRegisteredRttSubject(scene.id);

      expect(rttGroup).toBeInstanceOf(THREE.Group);
      const interactiveGroup = factory.mock.results[0]?.value as THREE.Group;
      expect(interactiveGroup).toBeInstanceOf(THREE.Group);
      expect(interactiveGroup).not.toBe(rttGroup);
      expect(factory).toHaveBeenCalledTimes(2);
      expect(factory.mock.calls[0]?.[0]?.presentation).toBe(presentation);
      expect(factory.mock.calls[1]?.[0]?.presentation).toBe(presentation);
      expect(interactiveGroup.userData.assetImplementationId).toBe(
        resolveSceneAsset(assetKey).implementationId,
      );
      expect(rttGroup?.userData.assetImplementationId).toBe(
        resolveSceneAsset(assetKey).implementationId,
      );

      disposeRegisteredRttSubject(scene.id, rttGroup!);
      view.unmount();
      expect(disposer).toHaveBeenCalledTimes(2);
      expect(disposer.mock.calls[0]?.[0]).toBe(rttGroup);
    });
  });

  it("routes Mirror Shift interactive and RTT consumers through the same registered factory", () => {
    const registration = getSceneSubjectRegistration("mirror-shift");
    expect(registration).toBeDefined();
    expect(getRegisteredSceneSubject("mirror-shift")).toBe(MirrorShiftSubject);
    const factory = vi.spyOn(mirrorShiftAsset, "createMirrorShiftAssetGroup");
    const disposer = vi.spyOn(mirrorShiftAsset, "disposeMirrorShiftGroup");
    const view = render(<MirrorShiftSubject />);

    const group = createRegisteredRttSubject("mirror-shift");
    const viewportGroup = factory.mock.results[0]?.value as THREE.Group;
    const rttGroup = factory.mock.results[1]?.value as THREE.Group;
    const assetRegistration = resolveSceneAsset(MIRROR_SHIFT_ASSET_KEY);

    expect(factory).toHaveBeenCalledTimes(2);
    expect(factory.mock.calls[0]?.[0]).toMatchObject({ representation: "viewport" });
    expect(factory.mock.calls[1]?.[0]).toMatchObject({ representation: "rtt" });
    expect(viewportGroup).toBeInstanceOf(THREE.Group);
    expect(rttGroup).toBe(group);
    expect(viewportGroup).not.toBe(rttGroup);
    expect(viewportGroup.userData.assetImplementationId).toBe(
      assetRegistration.implementationId,
    );
    expect(rttGroup.userData.assetImplementationId).toBe(
      assetRegistration.implementationId,
    );
    expect(factory.mock.calls[0]?.[0]?.presentation).toBe(
      factory.mock.calls[1]?.[0]?.presentation,
    );
    expect(group?.name).toBe("mirror-shift-subject");
    expect(group?.getObjectByName("mirror-shift-mirror-surface")).toBeInstanceOf(THREE.Mesh);
    expect(group?.getObjectByName("mirror-shift-camera-reflection")).toBeInstanceOf(THREE.Group);
    disposeRegisteredRttSubject("mirror-shift", group!);
    expect(disposer).toHaveBeenCalledTimes(1);
    expect(disposer.mock.calls[0]?.[0]).toBe(rttGroup);
    view.unmount();
    expect(disposer).toHaveBeenCalledTimes(2);
    expect(disposer.mock.calls[1]?.[0]).toBe(viewportGroup);
  });

  it("resolves Interior Corner to one shared static subject for 3D and RTT", () => {
    const registration = getSceneSubjectRegistration("interior-corner");
    expect(registration).toBeDefined();
    expect(getRegisteredSceneSubject("interior-corner")).toBe(registration?.SceneSubject);

    const group = createRegisteredRttSubject("interior-corner");
    expect(group?.name).toBe("interior-corner-subject");
    expect(group?.getObjectByName("interior-corner-floor")).toBeInstanceOf(THREE.Mesh);
    expect(group?.getObjectByName("interior-corner-back-wall")).toBeInstanceOf(THREE.Mesh);
    expect(group?.getObjectByName("interior-corner-receding-side-wall")).toBeInstanceOf(THREE.Mesh);
    expect(group?.getObjectByName("interior-corner-room-corner")).toBeInstanceOf(THREE.Mesh);
    expect(group?.getObjectByName("interior-corner-side-cornice")).toBeInstanceOf(THREE.Mesh);
    expect(group?.getObjectByName("interior-corner-wall-detail-interior-wall-near")).toBeInstanceOf(THREE.Group);
    expect(group?.getObjectByName("interior-corner-wall-detail-interior-wall-middle")).toBeInstanceOf(THREE.Group);
    expect(group?.getObjectByName("interior-corner-wall-detail-interior-wall-far")).toBeInstanceOf(THREE.Group);
    expect(group?.getObjectByName("interior-corner-focus-interior-wall-near")).toBeInstanceOf(THREE.Object3D);
    expect(group?.getObjectByName("interior-corner-focus-interior-wall-middle")).toBeInstanceOf(THREE.Object3D);
    expect(group?.getObjectByName("interior-corner-focus-interior-wall-far")).toBeInstanceOf(THREE.Object3D);

    const spies = collectDisposableSpies(group!);
    disposeRegisteredRttSubject("interior-corner", group!);
    spies.forEach((spy) => expect(spy).toHaveBeenCalledTimes(1));
  });

  it("composes one world-owned Interior Corner practical with the shared presentation rig on both surfaces", () => {
    const observerScene = new THREE.Scene();
    const groundGlassScene = new THREE.Scene();
    const observerSubject = createRegisteredSceneAsset(
      INTERIOR_CORNER_ASSET_KEY,
      { presentation: INTERIOR_CORNER_PRESENTATION },
    );
    const groundGlassSubject = createRegisteredRttSubject("interior-corner");
    if (!groundGlassSubject) throw new Error("Expected the registered Ground Glass subject");

    const lightingContext = {
      cameraMovementPresentation: CAMERA_MOVEMENT_BASELINE_PRESENTATION,
      presentationRegion: "middle" as const,
    };
    const observerRig = createPresentationLightingRig(
      observerScene,
      resolveScenePresentationLighting("interior-corner", {
        ...lightingContext,
        surface: "observer",
      }),
    );
    const groundGlassRig = createPresentationLightingRig(
      groundGlassScene,
      resolveScenePresentationLighting("interior-corner", {
        ...lightingContext,
        surface: "ground-glass",
      }),
    );
    const observerWorldRig = createWorldIlluminationRig(
      observerScene,
      resolveSceneWorldIllumination("interior-corner"),
    );
    const groundGlassWorldRig = createWorldIlluminationRig(
      groundGlassScene,
      resolveSceneWorldIllumination("interior-corner"),
    );
    observerScene.add(observerSubject);
    groundGlassScene.add(groundGlassSubject);

    const collectLights = (scene: THREE.Scene) => {
      const lights: THREE.Light[] = [];
      scene.traverse((object) => {
        if (object instanceof THREE.Light) lights.push(object);
      });
      return lights;
    };

    try {
      expect(observerSubject.userData.assetImplementationId).toBe(
        groundGlassSubject.userData.assetImplementationId,
      );
      expect(observerSubject.getObjectsByProperty("type", "PointLight")).toHaveLength(0);
      expect(groundGlassSubject.getObjectsByProperty("type", "PointLight")).toHaveLength(0);
      for (const [scene, rig] of [
        [observerScene, observerRig],
        [groundGlassScene, groundGlassRig],
      ] as const) {
        const lights = collectLights(scene);
        const practicalLights = lights.filter(
          (light): light is THREE.PointLight => light instanceof THREE.PointLight,
        );
        const shadowCastingLights = lights.filter((light) => light.castShadow);

        expect(lights).toHaveLength(3);
        expect(lights).toContain(rig.fillLight);
        expect(lights).toContain(rig.keyLight);
        expect(practicalLights).toHaveLength(1);
        expect(practicalLights[0].name).toBe("interior-corner-local-light");
        expect(practicalLights[0].color.equals(new THREE.Color("#fff1d6"))).toBe(true);
        expect(practicalLights[0].intensity).toBe(5);
        expect(practicalLights[0].distance).toBe(7.5);
        expect(practicalLights[0].decay).toBe(2);
        expect(practicalLights[0].position.toArray()).toEqual([
          0.42,
          (INTERIOR_CORNER_PRESENTATION.geometry.room.floorY + 1310) / 1000,
          8.3,
        ]);
        expect(shadowCastingLights).toEqual([rig.keyLight]);
      }
    } finally {
      observerScene.remove(observerSubject);
      groundGlassScene.remove(groundGlassSubject);
      disposeRegisteredSceneAsset(INTERIOR_CORNER_ASSET_KEY, observerSubject);
      disposeRegisteredRttSubject("interior-corner", groundGlassSubject);
      disposePresentationLightingRig(observerScene, observerRig);
      disposePresentationLightingRig(groundGlassScene, groundGlassRig);
      disposeWorldIlluminationRig(observerScene, observerWorldRig);
      disposeWorldIlluminationRig(groundGlassScene, groundGlassWorldRig);
    }
  });

  it("resolves Oblique Architecture to one shared static subject for 3D and RTT", () => {
    const registration = getSceneSubjectRegistration("oblique-architecture");
    expect(registration).toBeDefined();
    const group = createRegisteredRttSubject("oblique-architecture");
    expect(group?.name).toBe("oblique-architecture-subject");
    expect(group?.getObjectByName("oblique-architecture-building")).toBeInstanceOf(THREE.Mesh);
    expect(group?.getObjectByName("oblique-architecture-corner")).toBeInstanceOf(THREE.Mesh);
    expect(group?.getObjectByName("oblique-architecture-target-facade")).toBeInstanceOf(THREE.Mesh);
    expect(group?.getObjectByName("oblique-architecture-side-window-2-1")).toBeInstanceOf(THREE.Group);
    expect(group?.getObjectByName("oblique-architecture-side-window-2-7")).toBeInstanceOf(THREE.Group);
    expect(group?.getObjectByName("oblique-architecture-focus-facade-middle")).toBeInstanceOf(THREE.Object3D);
    const spies = collectDisposableSpies(group!);
    disposeRegisteredRttSubject("oblique-architecture", group!);
    spies.forEach((spy) => expect(spy).toHaveBeenCalledTimes(1));
  });

  it("resolves Oblique Tabletop focus probes before the first render", () => {
    const group = createRegisteredRttSubject("oblique-tabletop")!;
    try {
      for (const marker of obliqueTabletopGeometry.boardMarkers) {
        const probe = group.getObjectByName(`oblique-tabletop-focus-${marker.id}`)!;
        // Do not force updateMatrixWorld: getWorldPosition must update the
        // manually assigned board matrix even before a renderer has visited it.
        const position = probe.getWorldPosition(new THREE.Vector3());
        expect(position.x).toBeCloseTo(marker.worldPosition.x * 0.001, 10);
        expect(position.y).toBeCloseTo(marker.worldPosition.y * 0.001, 10);
        expect(position.z).toBeCloseTo(marker.worldPosition.z * 0.001, 10);
      }
    } finally {
      disposeRegisteredRttSubject("oblique-tabletop", group);
    }
  });

  it("resolves Oblique Tabletop to one shared static subject for 3D and RTT", () => {
    const registration = getSceneSubjectRegistration("oblique-tabletop");
    expect(registration).toBeDefined();
    const group = createRegisteredRttSubject("oblique-tabletop");
    expect(group?.name).toBe("oblique-tabletop-subject");
    expect(group?.getObjectByName("oblique-tabletop-tabletop")).toBeInstanceOf(THREE.Mesh);
    expect(group?.getObjectByName("oblique-tabletop-floor")).toBeInstanceOf(THREE.Mesh);

    group?.updateMatrixWorld(true);
    const tabletopAssembly = group?.getObjectByName("oblique-tabletop-tabletop-assembly");
    expect(tabletopAssembly).toBeInstanceOf(THREE.Group);
    const renderedTableNormal = new THREE.Vector3(0, 1, 0).transformDirection(
      tabletopAssembly!.matrixWorld,
    );
    expect(renderedTableNormal.x).toBeCloseTo(obliqueTabletopGeometry.tabletopTopSurfacePlane.normal.x, 10);
    expect(renderedTableNormal.y).toBeCloseTo(obliqueTabletopGeometry.tabletopTopSurfacePlane.normal.y, 10);
    expect(renderedTableNormal.z).toBeCloseTo(obliqueTabletopGeometry.tabletopTopSurfacePlane.normal.z, 10);

    const boardAssembly = group?.getObjectByName("oblique-tabletop-subject-board-assembly");
    expect(boardAssembly).toBeInstanceOf(THREE.Group);
    const renderedBoardNormal = new THREE.Vector3(0, 1, 0).transformDirection(
      boardAssembly!.matrixWorld,
    );
    expect(renderedBoardNormal.x).toBeCloseTo(obliqueTabletopGeometry.subjectBoardPlane.normal.x, 10);
    expect(renderedBoardNormal.y).toBeCloseTo(obliqueTabletopGeometry.subjectBoardPlane.normal.y, 10);
    expect(renderedBoardNormal.z).toBeCloseTo(obliqueTabletopGeometry.subjectBoardPlane.normal.z, 10);

    const boardMesh = group?.getObjectByName("oblique-tabletop-subject-board");
    expect(boardMesh).toBeInstanceOf(THREE.Mesh);
    const renderedFacePoint = new THREE.Vector3(
      0,
      obliqueTabletopGeometry.subjectBoard.thickness * 0.001 / 2,
      0,
    ).applyMatrix4(boardMesh!.matrixWorld);
    expect(renderedFacePoint.x).toBeCloseTo(
      obliqueTabletopGeometry.subjectBoardFrontSurfacePlane.point.x * 0.001,
      10,
    );
    expect(renderedFacePoint.y).toBeCloseTo(
      obliqueTabletopGeometry.subjectBoardFrontSurfacePlane.point.y * 0.001,
      10,
    );
    expect(renderedFacePoint.z).toBeCloseTo(
      obliqueTabletopGeometry.subjectBoardFrontSurfacePlane.point.z * 0.001,
      10,
    );

    const presentationNodes: THREE.Object3D[] = [];
    const planSurfaceNodes: THREE.Object3D[] = [];
    group?.traverse((object) => {
      if (object.name.includes("presentation")) presentationNodes.push(object);
      if (object.name === "oblique-tabletop-subject-board-plan-surface") {
        planSurfaceNodes.push(object);
      }
    });
    expect(presentationNodes).toHaveLength(0);
    expect(planSurfaceNodes).toHaveLength(1);
    expect(
      group?.getObjectByName("oblique-tabletop-subject-board-plan-surface-presentation"),
    ).toBeUndefined();

    obliqueTabletopGeometry.boardMarkers.forEach((marker) => {
      const markerGroup = group?.getObjectByName(`oblique-tabletop-marker-${marker.id}`);
      expect(markerGroup).toBeInstanceOf(THREE.Group);
      expect(markerGroup?.userData.markerId).toBe(marker.id);
      expect(markerGroup?.userData.focusTargetId).toBeUndefined();
      const probe = group?.getObjectByName(`oblique-tabletop-focus-${marker.id}`);
      expect(probe).toBeInstanceOf(THREE.Object3D);
      expect(probe?.userData.markerId).toBe(marker.id);
      expect(probe?.userData.focusTargetId).toBeUndefined();
      const probeWorld = new THREE.Vector3();
      probe?.getWorldPosition(probeWorld);
      expect(probeWorld.x).toBeCloseTo(marker.worldPosition.x * 0.001, 10);
      expect(probeWorld.y).toBeCloseTo(marker.worldPosition.y * 0.001, 10);
      expect(probeWorld.z).toBeCloseTo(marker.worldPosition.z * 0.001, 10);
    });
    obliqueTabletopGeometry.subjectBoardAnalyticalSurfaceSamples.forEach((sample) => {
      const sampleNode = group?.getObjectByName(
        `oblique-tabletop-board-surface-sample-${sample.id}`,
      );
      expect(sampleNode).toBeInstanceOf(THREE.Object3D);
      const sampleWorld = new THREE.Vector3();
      sampleNode?.getWorldPosition(sampleWorld);
      expect(sampleWorld.x).toBeCloseTo(sample.worldPosition.x * 0.001, 10);
      expect(sampleWorld.y).toBeCloseTo(sample.worldPosition.y * 0.001, 10);
      expect(sampleWorld.z).toBeCloseTo(sample.worldPosition.z * 0.001, 10);
      expect(sampleNode?.userData.analyticalCoverageSampleId).toBe(sample.id);
      expect(sampleNode?.userData.geometryAnchor).toBe("canonical-subject-board-surface");
      expect(sampleNode?.userData.focusTargetId).toBeUndefined();
    });
    obliqueTabletopGeometry.subjectBoardVisibleFocusSamples.forEach((sample) => {
      const detail = group?.getObjectByName(
        `oblique-tabletop-board-detail-${sample.id}`,
      );
      expect(detail).toBeInstanceOf(THREE.Group);
      expect(detail?.userData.focusTargetId).toBe(sample.id);
      expect(detail?.userData.geometryAnchor).toBe("visible-subject-board-detail");

      const focusProbe = group?.getObjectByName(
        `oblique-tabletop-focus-detail-${sample.id}`,
      );
      expect(focusProbe).toBeInstanceOf(THREE.Object3D);
      const focusWorld = new THREE.Vector3();
      focusProbe?.getWorldPosition(focusWorld);
      expect(focusWorld.x).toBeCloseTo(sample.worldPosition.x * 0.001, 10);
      expect(focusWorld.y).toBeCloseTo(sample.worldPosition.y * 0.001, 10);
      expect(focusWorld.z).toBeCloseTo(sample.worldPosition.z * 0.001, 10);
      expect(focusProbe?.userData.focusTargetId).toBe(sample.id);
      expect(focusProbe?.userData.geometryAnchor).toBe("visible-subject-board-focus-probe");

      const detailSurface = detail?.getObjectByName(
        `oblique-tabletop-board-detail-${sample.id}-surface`,
      );
      expect(detailSurface).toBeInstanceOf(THREE.Mesh);
      const detailOuterSurfaceWorld = new THREE.Vector3(
        0,
        obliqueTabletopGeometry.focusDetailGeometry.height * 0.001 / 2,
        0,
      ).applyMatrix4(detailSurface!.matrixWorld);
      expect(detailOuterSurfaceWorld.x).toBeCloseTo(focusWorld.x, 10);
      expect(detailOuterSurfaceWorld.y).toBeCloseTo(focusWorld.y, 10);
      expect(detailOuterSurfaceWorld.z).toBeCloseTo(focusWorld.z, 10);
    });

    const visibleDetailFootprints = obliqueTabletopGeometry.subjectBoardVisibleFocusSamples.map(
      (sample) => ({
        center: sample.localPosition,
        width: obliqueTabletopGeometry.focusDetailGeometry.width,
        depth: obliqueTabletopGeometry.focusDetailGeometry.depth,
      }),
    );
    obliqueTabletopGeometry.boardMarkers.forEach((marker) => {
      const markerFootprint = {
        center: marker.localPosition,
        width: obliqueTabletopGeometry.markerGeometry.width,
        depth: obliqueTabletopGeometry.markerGeometry.depth,
      };
      visibleDetailFootprints.forEach((detailFootprint) => {
        expect(boardFootprintFullyCovers(markerFootprint, detailFootprint)).toBe(false);
      });
    });

    const middleMarkerFootprint = {
      center: obliqueTabletopGeometry.middleBoardMarker.localPosition,
      width: obliqueTabletopGeometry.markerGeometry.width,
      depth: obliqueTabletopGeometry.markerGeometry.depth,
    };
    const middleDetail = obliqueTabletopGeometry.subjectBoardVisibleFocusSamples.find(
      (sample) => sample.id === "middle",
    )!;
    const middleDetailFootprint = {
      center: middleDetail.localPosition,
      width: obliqueTabletopGeometry.focusDetailGeometry.width,
      depth: obliqueTabletopGeometry.focusDetailGeometry.depth,
    };
    expect(middleDetail.localPosition).toEqual({ x: 0, z: 0 });
    expect(boardFootprintsSeparated(middleMarkerFootprint, middleDetailFootprint)).toBe(true);

    const renderedMiddleMarker = group?.getObjectByName("oblique-tabletop-marker-middle");
    const renderedMiddleMarkerWorld = new THREE.Vector3();
    renderedMiddleMarker?.getWorldPosition(renderedMiddleMarkerWorld);
    const expectedMiddleMarkerWorld = obliqueTabletopGeometry.subjectBoardLocalPointToWorld({
      x: obliqueTabletopGeometry.middleBoardMarker.localPosition.x,
      y: 0,
      z: obliqueTabletopGeometry.middleBoardMarker.localPosition.z,
    });
    expect(renderedMiddleMarkerWorld.x).toBeCloseTo(expectedMiddleMarkerWorld.x * 0.001, 10);
    expect(renderedMiddleMarkerWorld.y).toBeCloseTo(expectedMiddleMarkerWorld.y * 0.001, 10);
    expect(renderedMiddleMarkerWorld.z).toBeCloseTo(expectedMiddleMarkerWorld.z * 0.001, 10);

    const spies = collectDisposableSpies(group!);
    disposeRegisteredRttSubject("oblique-tabletop", group!);
    spies.forEach((spy) => expect(spy).toHaveBeenCalledTimes(1));
  });

  it("registers canonical lattice identity and calibration-driven ghost policy", () => {
    const registration = getSceneSubjectRegistration(
      "understanding-camera-movements",
    );
    expect(registration?.canonicalLattice).toEqual({
      geometryId: CAMERA_MOVEMENT_LATTICE_GEOMETRY_ID,
      edgeCount: CAMERA_MOVEMENT_LATTICE.edges.length,
    });
    expect(registration?.showReferenceCamera).toBe(
      CAMERA_MOVEMENT_SCENE_CALIBRATION.presentation.showReferenceCamera,
    );
    expect(registration?.showReferenceCamera).toBe(false);
  });

  it.each(["macro-bellows-extension", "shelf-swing", "table-tilt", "oblique-architecture", "architecture-rise"])(
    "uses the explicit unique-resource disposer for %s",
    (sceneId) => {
      const group = createRegisteredRttSubject(sceneId)!;
      const spies = collectDisposableSpies(group);
      expect(spies.length).toBeGreaterThan(0);

      disposeRegisteredRttSubject(sceneId, group);

      spies.forEach((spy) => expect(spy).toHaveBeenCalledTimes(1));
    },
  );

  it.each([
    ["focus-fundamentals-two-targets", FOCUS_FUNDAMENTALS_ASSET_KEY],
    ["view-camera-anatomy", VIEW_CAMERA_ANATOMY_ASSET_KEY],
  ] as const)(
    "%s delegates cleanup to its module-shared asset policy",
    (sceneId, assetKey) => {
      const registration = getSceneSubjectRegistration(sceneId);
      expect(registration?.disposeRttGroup).toBeDefined();
      expect(resolveSceneAsset(assetKey).renderResourceLifetime).toBe(
        "module-shared",
      );

      const group = createRegisteredRttSubject(sceneId);
      if (!group) throw new Error(`Expected RTT group for ${sceneId}`);
      const spies = collectDisposableSpies(group);
      disposeRegisteredRttSubject(sceneId, group);
      spies.forEach((spy) => expect(spy).not.toHaveBeenCalled());
    },
  );

  it("keeps Architecture Rise canonical focus markers in registered rendering", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const view = render(<ArchitectureRiseRegisteredSubject scene={architectureRiseScene} />);
    consoleError.mockRestore();

    architectureRiseScene.focusTargets.forEach((target) => {
      expect(
        view.container.querySelector(
          `[name="architecture-focus-target-${target.id}"]`,
        ),
      ).not.toBeNull();
    });
  });

  it.each([
    "architecture-rise",
    "table-tilt",
    "interior-corner",
    "macro-depth-of-field",
  ] as const)(
    "%s uses one presentation placement and recipe on Observer and Ground Glass",
    (sceneId) => {
      const intent = getSceneSubjectRegistration(sceneId)?.presentationLighting;
      if (!intent) throw new Error("Expected presentation lighting for " + sceneId);
      const context = {
        cameraMovementPresentation: CAMERA_MOVEMENT_BASELINE_PRESENTATION,
        presentationRegion: "middle" as const,
      };
      const observer = resolveScenePresentationLighting(sceneId, {
        ...context,
        surface: "observer",
      });
      const groundGlass = resolveScenePresentationLighting(sceneId, {
        ...context,
        surface: "ground-glass",
      });
      const expectedPlacement = resolvePresentationLightingPlacement(intent);

      expect(observer.profile).toBe(TEACHING_PRESENTATION_LIGHTING_PROFILE);
      expect(groundGlass.profile).toBe(TEACHING_PRESENTATION_LIGHTING_PROFILE);
      expect(observer.placement).toEqual(expectedPlacement);
      expect(groundGlass.placement).toEqual(expectedPlacement);
    },
  );

  it("derives Shelf Swing presentation placement from the middle canonical focus chart", () => {
    const lighting = getSceneSubjectRegistration("shelf-swing")?.presentationLighting;
    expect(lighting?.targetMm).toEqual(geometry.middleSubject.focusDetailProbeWorld);
    expect(lighting?.keyOffsetWorld).toEqual({ x: -2.5, y: 3.5, z: -2.5 });
  });

  it("keeps Mirror Shift observer and Ground Glass key placements on their respective sides", () => {
    const context = {
      cameraMovementPresentation: CAMERA_MOVEMENT_BASELINE_PRESENTATION,
      presentationRegion: "middle" as const,
    };
    const observer = resolveScenePresentationLighting("mirror-shift", {
      ...context,
      surface: "observer",
    });
    const groundGlass = resolveScenePresentationLighting("mirror-shift", {
      ...context,
      surface: "ground-glass",
    });
    const realTargetMm = {
      x: mirrorShiftGeometry.mirror.center.x,
      y: mirrorShiftGeometry.mirror.center.y,
      z: mirrorShiftGeometry.floor.centerZ,
    };
    const realKeyPositionMm = {
      x: realTargetMm.x + DEFAULT_PRESENTATION_LIGHTING_PLACEMENT.keyOffsetWorld[0] / WORLD_SCALE,
      y: realTargetMm.y + DEFAULT_PRESENTATION_LIGHTING_PLACEMENT.keyOffsetWorld[1] / WORLD_SCALE,
      z: realTargetMm.z + DEFAULT_PRESENTATION_LIGHTING_PLACEMENT.keyOffsetWorld[2] / WORLD_SCALE,
    };
    const reflectedTargetMm = reflectPointAcrossMirrorPlane(realTargetMm);
    const reflectedKeyPositionMm = reflectPointAcrossMirrorPlane(realKeyPositionMm);

    expect(observer.profile).toBe(groundGlass.profile);
    expect(observer.placement).not.toEqual(groundGlass.placement);
    expect(observer.placement.targetWorld).toEqual([
      realTargetMm.x * WORLD_SCALE,
      realTargetMm.y * WORLD_SCALE,
      realTargetMm.z * WORLD_SCALE,
    ]);
    expect(observer.placement.keyOffsetWorld).toEqual(
      DEFAULT_PRESENTATION_LIGHTING_PLACEMENT.keyOffsetWorld,
    );
    expect(groundGlass.placement.targetWorld).toEqual([
      reflectedTargetMm.x * WORLD_SCALE,
      reflectedTargetMm.y * WORLD_SCALE,
      reflectedTargetMm.z * WORLD_SCALE,
    ]);
    expect(groundGlass.placement.keyOffsetWorld).toEqual([
      (reflectedKeyPositionMm.x - reflectedTargetMm.x) * WORLD_SCALE,
      (reflectedKeyPositionMm.y - reflectedTargetMm.y) * WORLD_SCALE,
      (reflectedKeyPositionMm.z - reflectedTargetMm.z) * WORLD_SCALE,
    ]);
  });
});
