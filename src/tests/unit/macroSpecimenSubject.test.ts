import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { createTourbillonWatch } from "../../render/assets/tourbillon-watch/watch.mjs";
import {
  createMacroSpecimenGroup,
  disposeMacroSpecimenGroup,
  readMacroSpecimenCageAngle,
  updateMacroSpecimenCageAngle,
} from "../../render/MacroSpecimenSubjectFactory";
import { MacroSpecimenSubject } from "../../render/SceneAssetSubjects";
import { getSceneSubjectRegistration } from "../../render/sceneSubjectRegistry";
import { isGroundGlassRttScene } from "../../render/groundGlassRttScenes";
import {
  MACRO_BELLOWS_WATCH,
  macroBellowsExtensionDiagnosticSamplesMm,
  macroBellowsExtensionFocusTargets,
  macroBellowsExtensionWatchBoundsMm,
} from "../../scenes/macroSpecimenGeometry";
import { resolveGenericConceptualSupportRail } from "../../render/ConceptualViewCamera";
import {
  MACRO_BELLOWS_EXTENSION_PRESENTATION,
  MACRO_BELLOWS_WATCH_LIGHTING_PROFILE,
} from "../../scenes/presentation/macroBellowsExtension";
import { resolveScenePresentationLighting } from "../../render/presentationLighting";
import { configureTeachingShadowParticipation } from "../../render/TeachingLighting";
import { CAMERA_MOVEMENT_BASELINE_PRESENTATION } from "../../scenes/presentation/understandingCameraMovements";

describe("macro tourbillon watch physical renderer contract", () => {
  it("routes one strapless native watch head through the registered Observer and RTT slot", () => {
    const registration = getSceneSubjectRegistration("macro-bellows-extension")!;
    expect(isGroundGlassRttScene("macro-bellows-extension")).toBe(true);
    expect(registration.SceneSubject).toBe(MacroSpecimenSubject);
    expect(registration.createRttGroup).toBeDefined();
    expect(registration.disposeRttGroup).toBeDefined();
    expect(registration.rttBounds).toEqual(macroBellowsExtensionWatchBoundsMm);

    const group = createMacroSpecimenGroup({ presentation: MACRO_BELLOWS_EXTENSION_PRESENTATION });
    const bounds = new THREE.Box3().setFromObject(group);
    expect(group.name).toBe("macro-bellows-extension-watch-head");
    expect(group.position.z).toBeCloseTo(MACRO_BELLOWS_WATCH.caseOriginMm.z / 1000, 9);
    expect(group.rotation.y).toBeCloseTo(Math.PI, 12);
    expect(group.scale.toArray()).toEqual([0.001, 0.001, 0.001]);
    expect(bounds.min.x).toBeCloseTo(macroBellowsExtensionWatchBoundsMm.min.x / 1000, 6);
    expect(bounds.max.x).toBeCloseTo(macroBellowsExtensionWatchBoundsMm.max.x / 1000, 6);
    expect(bounds.min.y).toBeCloseTo(macroBellowsExtensionWatchBoundsMm.min.y / 1000, 6);
    expect(bounds.max.y).toBeCloseTo(macroBellowsExtensionWatchBoundsMm.max.y / 1000, 6);
    expect(bounds.min.z).toBeCloseTo(macroBellowsExtensionWatchBoundsMm.min.z / 1000, 6);
    expect(bounds.max.z).toBeCloseTo(macroBellowsExtensionWatchBoundsMm.max.z / 1000, 6);
    expect(group.getObjectByName("Strap assembly")).toBeUndefined();
    expect(group.getObjectByName("Rotating one-minute tourbillon cage")?.rotation.z).toBe(0);
    expect(group.userData.macroWatch).toEqual({
      strapIncluded: false,
      cageAngleRad: 0,
      crystalVisible: true,
    });
    expect(updateMacroSpecimenCageAngle(group, -Math.PI / 2)).toBe(true);
    expect(readMacroSpecimenCageAngle(group)).toBeCloseTo(-Math.PI / 2, 12);
    expect(group.userData.macroWatch.cageAngleRad).toBeCloseTo(-Math.PI / 2, 12);
    expect(updateMacroSpecimenCageAngle(group, 0)).toBe(true);

    const head = group.getObjectByName("Watch head");
    expect(head).toBeInstanceOf(THREE.Group);
    expect(head?.children.map(({ name }) => name)).toEqual([
      "Case assembly", "Dial assembly", "Hand assembly", "Tourbillon assembly", "Rear movement",
    ]);
    for (const name of [
      "front-sapphire",
      "Satin Roman chapter ring",
      "Recessed engine-turned hobnail field",
      "Polished hand collet",
      "Stationary wheel with four relieved openings",
      "exhibition-caseback-rim",
    ]) {
      expect(group.getObjectByName(name)).toBeInstanceOf(THREE.Mesh);
    }

    const crystal = group.getObjectByName("front-sapphire") as THREE.Mesh;
    expect(crystal.material).toBeInstanceOf(THREE.MeshPhysicalMaterial);
    expect((crystal.material as THREE.MeshPhysicalMaterial).transparent).toBe(true);
    expect((crystal.material as THREE.MeshPhysicalMaterial).depthWrite).toBe(false);
    expect((crystal.material as THREE.MeshPhysicalMaterial).opacity).toBeCloseTo(0.115, 6);
    configureTeachingShadowParticipation(group);
    expect(crystal.castShadow).toBe(false);
    expect((group.getObjectByName("rear-sapphire") as THREE.Mesh).castShadow).toBe(false);
    expect((group.getObjectByName("Stationary wheel with four relieved openings") as THREE.Mesh).castShadow).toBe(true);

    const samples = [
      ...macroBellowsExtensionFocusTargets.flatMap((target) => [
        { surface: "Satin Roman chapter ring", worldPosition: target.worldPosition },
        ...(target.sampleWorldPositions ?? []).map((worldPosition) => ({
          surface: "Satin Roman chapter ring", worldPosition,
        })),
      ]),
      ...macroBellowsExtensionDiagnosticSamplesMm,
    ];
    const headChildren = head?.children ?? [];
    const caseAssembly = group.getObjectByName("Case assembly");
    const surfaceAssemblies = headChildren.filter((child) => child !== caseAssembly);
    const rayAt = (point: { x: number; y: number }, targets: THREE.Object3D[]) => {
      const ray = new THREE.Raycaster(
        new THREE.Vector3(point.x / 1000, point.y / 1000, 0),
        new THREE.Vector3(0, 0, 1),
      );
      return ray.intersectObjects(targets, true)[0];
    };
    group.updateMatrixWorld(true);
    for (const sample of samples) {
      const hit = sample.surface === "front bezel"
        ? rayAt(sample.worldPosition, caseAssembly ? [caseAssembly] : [])
        : rayAt(sample.worldPosition, surfaceAssemblies);
      expect(hit, `no ${sample.surface} geometry at ${JSON.stringify(sample.worldPosition)}`).toBeDefined();
      expect(hit?.object.name).toContain(
        sample.surface === "hobnail dial field" ? "hobnail field" :
          sample.surface === "hand collet" ? "hand collet" :
            sample.surface === "tourbillon wheel" ? "Stationary wheel" :
              sample.surface === "front bezel" ? "front-bezel" : "chapter ring",
      );
      expect(hit?.point.z).toBeCloseTo(sample.worldPosition.z / 1000, 6);
    }
    const crystalHit = rayAt(macroBellowsExtensionFocusTargets[0].worldPosition, [group]);
    expect(crystalHit?.object.name).toBe("front-sapphire");

    const materials = new Set<THREE.Material>();
    const geometries = new Set<THREE.BufferGeometry>();
    group.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      geometries.add(object.geometry);
      (Array.isArray(object.material) ? object.material : [object.material]).forEach((material) => materials.add(material));
    });
    expect(geometries.size).toBeGreaterThan(180);
    expect(materials.size).toBeGreaterThanOrEqual(15);
    const chapterFinish = [...materials].find((material) => material.name === "Spun silver chapter ring");
    const roseGoldFinish = [...materials].find((material) => material.name === "Polished rose gold");
    expect(chapterFinish).toBeInstanceOf(THREE.MeshStandardMaterial);
    expect((chapterFinish as THREE.MeshStandardMaterial).metalness).toBeCloseTo(0.69, 6);
    expect((chapterFinish as THREE.MeshStandardMaterial).roughness).toBeCloseTo(0.45, 6);
    expect((chapterFinish as THREE.MeshStandardMaterial).emissiveIntensity).toBe(1);
    expect(roseGoldFinish).toBeInstanceOf(THREE.MeshStandardMaterial);
    expect((roseGoldFinish as THREE.MeshStandardMaterial).metalness).toBeCloseTo(0.92, 6);
    expect((roseGoldFinish as THREE.MeshStandardMaterial).roughness).toBeCloseTo(0.165, 6);
    expect((roseGoldFinish as THREE.MeshStandardMaterial).emissive.getHex()).toBe(0x000000);

    const stripeFinish = [...materials].find((material) => material.name === "Rhodium bridges") as THREE.MeshStandardMaterial;
    const perlageFinish = [...materials].find((material) => material.name === "Perlage mainplate") as THREE.MeshStandardMaterial;
    const ratchetFinish = [...materials].find((material) => material.name === "Concentrically brushed ratchet steel") as THREE.MeshStandardMaterial;
    expect(stripeFinish.bumpScale).toBeCloseTo(0.0003, 9);
    expect(perlageFinish.bumpScale).toBeCloseTo(0.00038, 9);
    expect((chapterFinish as THREE.MeshStandardMaterial).bumpScale).toBeCloseTo(0.00014, 9);
    expect(ratchetFinish.bumpScale).toBeCloseTo(0.000073, 9);

    const secondGroup = createMacroSpecimenGroup({ presentation: MACRO_BELLOWS_EXTENSION_PRESENTATION });
    const secondChapter = secondGroup.getObjectByName("Satin Roman chapter ring") as THREE.Mesh;
    expect(secondChapter.material).not.toBe(chapterFinish);
    expect((secondChapter.material as THREE.MeshStandardMaterial).bumpScale).toBeCloseTo(0.00014, 9);

    const nativeWatch = createTourbillonWatch({ includeStrap: false });
    const nativeChapter = nativeWatch.materials.find(({ name }) => name === "Spun silver chapter ring") as THREE.MeshStandardMaterial;
    const nativeRatchet = nativeWatch.materials.find(({ name }) => name === "Concentrically brushed ratchet steel") as THREE.MeshStandardMaterial;
    expect(nativeChapter.bumpScale).toBeCloseTo(0.14, 6);
    expect(nativeRatchet.bumpScale).toBeCloseTo(0.073, 6);
    nativeWatch.dispose();
    disposeMacroSpecimenGroup(secondGroup);
    disposeMacroSpecimenGroup(group);
  }, 15_000);

  it("creates reproducible independent heads and disposes each owned resource once", () => {
    const first = createMacroSpecimenGroup({ presentation: MACRO_BELLOWS_EXTENSION_PRESENTATION });
    const second = createMacroSpecimenGroup({ presentation: MACRO_BELLOWS_EXTENSION_PRESENTATION });
    const firstNames: string[] = [];
    const secondNames: string[] = [];
    first.traverse((object) => { if (object instanceof THREE.Mesh) firstNames.push(object.name); });
    second.traverse((object) => { if (object instanceof THREE.Mesh) secondNames.push(object.name); });
    expect(firstNames).toEqual(secondNames);
    expect(new THREE.Box3().setFromObject(first).min.toArray()).toEqual(
      new THREE.Box3().setFromObject(second).min.toArray(),
    );

    const resources = {
      geometries: new Set<THREE.BufferGeometry>(),
      materials: new Set<THREE.Material>(),
      textures: new Set<THREE.Texture>(),
    };
    first.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      resources.geometries.add(object.geometry);
      (Array.isArray(object.material) ? object.material : [object.material]).forEach((material) => {
        resources.materials.add(material);
        Object.values(material).forEach((value) => {
          if (value instanceof THREE.Texture) resources.textures.add(value);
        });
      });
    });
    const geometryDisposals = vi.fn();
    const materialDisposals = vi.fn();
    const textureDisposals = vi.fn();
    resources.geometries.forEach((geometry) => geometry.addEventListener("dispose", geometryDisposals));
    resources.materials.forEach((material) => material.addEventListener("dispose", materialDisposals));
    resources.textures.forEach((texture) => texture.addEventListener("dispose", textureDisposals));
    disposeMacroSpecimenGroup(first);
    expect(geometryDisposals).toHaveBeenCalledTimes(resources.geometries.size);
    expect(materialDisposals).toHaveBeenCalledTimes(resources.materials.size);
    expect(textureDisposals).toHaveBeenCalledTimes(resources.textures.size);
    disposeMacroSpecimenGroup(first);
    expect(geometryDisposals).toHaveBeenCalledTimes(resources.geometries.size);
    expect(materialDisposals).toHaveBeenCalledTimes(resources.materials.size);
    expect(textureDisposals).toHaveBeenCalledTimes(resources.textures.size);
    disposeMacroSpecimenGroup(second);
  });

  it("hides the real front sapphire mesh only for the development diagnostic query", () => {
    const previousUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    try {
      window.history.replaceState({}, "", "/simulator/free/macro-bellows-extension?macroWatchCrystal=off");
      const group = createMacroSpecimenGroup({ presentation: MACRO_BELLOWS_EXTENSION_PRESENTATION });
      expect(group.getObjectByName("front-sapphire")?.visible).toBe(false);
      expect(group.userData.macroWatch.crystalVisible).toBe(false);
      disposeMacroSpecimenGroup(group);
    } finally {
      window.history.replaceState({}, "", previousUrl);
    }
  });

  it("uses one watch-scale presentation recipe for Observer and Ground Glass", () => {
    const context = {
      cameraMovementPresentation: CAMERA_MOVEMENT_BASELINE_PRESENTATION,
      presentationRegion: "middle" as const,
    };
    const observer = resolveScenePresentationLighting("macro-bellows-extension", {
      ...context, surface: "observer",
    });
    const groundGlass = resolveScenePresentationLighting("macro-bellows-extension", {
      ...context, surface: "ground-glass",
    });
    expect(observer.profile).toBe(MACRO_BELLOWS_WATCH_LIGHTING_PROFILE);
    expect(groundGlass.profile).toBe(MACRO_BELLOWS_WATCH_LIGHTING_PROFILE);
    expect(observer.placement).toEqual(groundGlass.placement);
    expect(observer.placement.targetWorld).toEqual([0, 0, 0.3]);
    expect(observer.placement.keyOffsetWorld).toEqual([0.22, 0.21, -0.36]);
    expect(MACRO_BELLOWS_WATCH_LIGHTING_PROFILE.key.shadowCamera).toMatchObject({
      left: -0.029, right: 0.029, top: 0.031, bottom: -0.031,
      near: 0.0005, far: 0.088,
    });
  });

  it.each([180, 225, 300])("contains the rear carriage at %s mm without moving the front support", (distance) => {
    const rail = resolveGenericConceptualSupportRail({ x: 0, y: 0, z: -distance });
    const front = rail.centerRigLocal.z + rail.dimensionsMm.z / 2;
    const rear = rail.centerRigLocal.z - rail.dimensionsMm.z / 2;
    expect(front).toBeCloseTo(60);
    expect(rear).toBeCloseTo(-distance - 60);
    expect(front - rear).toBeCloseTo(distance + 120);
  });
});
