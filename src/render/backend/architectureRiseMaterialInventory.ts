import * as THREE from "three";
import {
  isMaterialAwareRenderable,
  readObserverOutputSourceMaterial,
  type UnsupportedMaterialAssignment,
} from "./materialAwareMaterialTracker";
import { OBSERVER_MATERIAL_MAP_SLOTS } from "./materialAwareNodeMaterials";

type MaterialWithMaps = THREE.Material & Partial<
  Record<(typeof OBSERVER_MATERIAL_MAP_SLOTS)[number], THREE.Texture | null>
>;

export type ObserverMaterialInventoryEntry = Readonly<{
  role: string;
  sourceMaterialFamily: string;
  nodeMaterialFamily: string;
  materialInstances: number;
  meshAssignments: number;
  lit: boolean;
  transparentInstances: number;
  opacityRange: readonly [number, number];
  toneMappedInstances: number;
  depthTestInstances: number;
  depthWriteInstances: number;
  shadowCasterAssignments: number;
  shadowReceiverAssignments: number;
  blendingModes: readonly string[];
  sides: readonly string[];
  textureSlots: Readonly<Record<string, Readonly<{
    count: number;
    colorSpaces: readonly string[];
    repeatValues: readonly (readonly [number, number])[];
    wrapModes: readonly (readonly [number | null, number | null])[];
  }>>>;
  environmentMappedInstances: number;
  normalScaleValues: readonly (readonly [number, number])[];
  roughnessValues: readonly number[];
  metalnessValues: readonly number[];
  owner: string;
  status: "supported" | "unsupported";
}>;

export type ObserverMaterialInventory = Readonly<{
  sceneId: "architecture-rise" | "view-camera-anatomy";
  frame: number;
  totalMeshAssignments: number;
  distinctMaterialInstances: number;
  adaptedMaterialInstances: number;
  unsupportedMaterialInstances: number;
  unsupported: readonly UnsupportedMaterialAssignment[];
  families: readonly ObserverMaterialInventoryEntry[];
  background: Readonly<{ authoredColor: string; nodeInstalled: boolean }>;
  environment: Readonly<{
    assigned: boolean;
    textureType: string | null;
    colorSpace: string | null;
    intensity: number;
  }>;
  lighting: Readonly<{
    hemisphereLights: number;
    directionalLights: number;
    shadowCastingDirectionalLights: number;
    shadowMapSizes: readonly (readonly [number, number])[];
  }>;
}>;

const architectureRiseObjectRole = (object: THREE.Object3D): string => {
  let current: THREE.Object3D | null = object;
  const names: string[] = [];
  while (current) {
    names.push(current.name);
    if (current.name === "architecture-rise-subject") return "architecture-rise-subject";
    if (current.name === "camera-rig-placement" || current.name === "original-ghost-camera-rig-placement") {
      return "conceptual-camera";
    }
    current = current.parent;
  }
  if (names.includes("teaching-shadow-subject")) return "focus-targets";
  if (names.some((name) => /(?:overlay|optical|physical-image-circle|physical-coverage|scheimpflug|lens-plane-helper|focus-plane|dof-plane)/i.test(name))) {
    return "optical-helpers";
  }
  return "observer-other";
};

const mapProperties = (material: THREE.Material) => {
  const candidate = material as MaterialWithMaps;
  return Object.fromEntries(OBSERVER_MATERIAL_MAP_SLOTS.flatMap((slot) => {
    const texture = candidate[slot];
    if (!texture) return [];
    return [[slot, {
      colorSpace: texture.colorSpace || "none",
      repeat: [texture.repeat.x, texture.repeat.y] as const,
      wrapS: texture.wrapS,
      wrapT: texture.wrapT,
    }]];
  }));
};

type MutableInventoryFamily = {
  role: string;
  sourceMaterialFamily: string;
  nodeMaterialFamily: string;
  sources: Set<THREE.Material>;
  meshAssignments: number;
  lit: boolean;
  transparentInstances: number;
  opacityValues: number[];
  toneMappedInstances: number;
  depthTestInstances: number;
  depthWriteInstances: number;
  shadowCasterAssignments: number;
  shadowReceiverAssignments: number;
  blendingModes: Set<string>;
  sides: Set<string>;
  textureSlots: Map<string, {
    count: number;
    colorSpaces: Set<string>;
    repeats: Set<string>;
    wrapping: Set<string>;
  }>;
  environmentMappedInstances: number;
  normalScales: Set<string>;
  roughnessValues: Set<number>;
  metalnessValues: Set<number>;
  owner: string;
};

export type ObserverMaterialInventoryProfile = Readonly<{
  sceneId: ObserverMaterialInventory["sceneId"];
  roleForObject: (object: THREE.Object3D, scene: THREE.Scene) => string;
  outputOwnerForRole: (role: string) => string;
}>;

/** Shared material inventory mechanics with scene-specific role and ownership interpretation. */
export const buildObserverMaterialInventory = (
  scene: THREE.Scene,
  frame: number,
  unsupported: readonly UnsupportedMaterialAssignment[],
  profile: ObserverMaterialInventoryProfile,
): ObserverMaterialInventory => {
  const families = new Map<string, MutableInventoryFamily>();
  const adaptedSources = new Set<THREE.Material>();
  const unsupportedSources = new Set<THREE.Material>();
  let totalMeshAssignments = 0;
  scene.traverse((object) => {
    if (!isMaterialAwareRenderable(object)) return;
    const role = profile.roleForObject(object, scene);
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach((attached) => {
      totalMeshAssignments += 1;
      const adaptedSource = readObserverOutputSourceMaterial(attached);
      const source = adaptedSource ?? attached;
      const nodeFamily = attached.type;
      const familyKey = `${role}/${source.type}/${nodeFamily}`;
      let family = families.get(familyKey);
      if (!family) {
        family = {
          role,
          sourceMaterialFamily: source.type,
          nodeMaterialFamily: nodeFamily,
          sources: new Set(),
          meshAssignments: 0,
          lit: source instanceof THREE.MeshStandardMaterial,
          transparentInstances: 0,
          opacityValues: [],
          toneMappedInstances: 0,
          depthTestInstances: 0,
          depthWriteInstances: 0,
          shadowCasterAssignments: 0,
          shadowReceiverAssignments: 0,
          blendingModes: new Set(),
          sides: new Set(),
          textureSlots: new Map(),
          environmentMappedInstances: 0,
          normalScales: new Set(),
          roughnessValues: new Set(),
          metalnessValues: new Set(),
          owner: profile.outputOwnerForRole(role),
        };
        families.set(familyKey, family);
      }
      family.sources.add(source);
      if (adaptedSource) adaptedSources.add(source);
      else unsupportedSources.add(source);
      family.meshAssignments += 1;
      if (source.transparent) family.transparentInstances += 1;
      family.opacityValues.push(source.opacity);
      if (source.toneMapped) family.toneMappedInstances += 1;
      if (source.depthTest) family.depthTestInstances += 1;
      if (source.depthWrite) family.depthWriteInstances += 1;
      if (object.castShadow) family.shadowCasterAssignments += 1;
      if (object.receiveShadow) family.shadowReceiverAssignments += 1;
      family.blendingModes.add(String(source.blending));
      family.sides.add(String(source.side));
      const mapped = mapProperties(source);
      Object.entries(mapped).forEach(([slot, details]) => {
        const typed = details as {
          colorSpace: string;
          repeat: readonly [number, number];
          wrapS: number;
          wrapT: number;
        };
        const slotSummary = family!.textureSlots.get(slot) ?? {
          count: 0,
          colorSpaces: new Set<string>(),
          repeats: new Set<string>(),
          wrapping: new Set<string>(),
        };
        slotSummary.count += 1;
        slotSummary.colorSpaces.add(typed.colorSpace);
        slotSummary.repeats.add(JSON.stringify(typed.repeat));
        slotSummary.wrapping.add(JSON.stringify([typed.wrapS, typed.wrapT]));
        family!.textureSlots.set(slot, slotSummary);
      });
      if ((source as MaterialWithMaps & { envMap?: THREE.Texture | null }).envMap) {
        family.environmentMappedInstances += 1;
      }
      const sourceWithPbr = source as THREE.MeshStandardMaterial;
      if (sourceWithPbr.normalScale) family.normalScales.add(JSON.stringify(sourceWithPbr.normalScale.toArray()));
      if (Number.isFinite(sourceWithPbr.roughness)) family.roughnessValues.add(sourceWithPbr.roughness);
      if (Number.isFinite(sourceWithPbr.metalness)) family.metalnessValues.add(sourceWithPbr.metalness);
    });
  });

  let hemisphereLights = 0;
  let directionalLights = 0;
  let shadowCastingDirectionalLights = 0;
  const shadowMapSizes = new Set<string>();
  scene.traverse((object) => {
    if (object instanceof THREE.HemisphereLight) hemisphereLights += 1;
    if (object instanceof THREE.DirectionalLight) {
      directionalLights += 1;
      if (object.castShadow) shadowCastingDirectionalLights += 1;
      shadowMapSizes.add(JSON.stringify([object.shadow.mapSize.x, object.shadow.mapSize.y]));
    }
  });
  const environment = scene.environment;
  const supportedFamilies = [...families.values()].map((family): ObserverMaterialInventoryEntry => {
    const textureSlots = Object.fromEntries([...family.textureSlots.entries()].map(([slot, value]) => [slot, {
      count: value.count,
      colorSpaces: [...value.colorSpaces].sort(),
      repeatValues: [...value.repeats].map((entry) => JSON.parse(entry) as readonly [number, number]),
      wrapModes: [...value.wrapping].map((entry) => JSON.parse(entry) as readonly [number, number]),
    }]));
    const opacityMin = Math.min(...family.opacityValues);
    const opacityMax = Math.max(...family.opacityValues);
    return {
      role: family.role,
      sourceMaterialFamily: family.sourceMaterialFamily,
      nodeMaterialFamily: family.nodeMaterialFamily,
      materialInstances: family.sources.size,
      meshAssignments: family.meshAssignments,
      lit: family.lit,
      transparentInstances: family.transparentInstances,
      opacityRange: [opacityMin, opacityMax],
      toneMappedInstances: family.toneMappedInstances,
      depthTestInstances: family.depthTestInstances,
      depthWriteInstances: family.depthWriteInstances,
      shadowCasterAssignments: family.shadowCasterAssignments,
      shadowReceiverAssignments: family.shadowReceiverAssignments,
      blendingModes: [...family.blendingModes].sort(),
      sides: [...family.sides].sort(),
      textureSlots,
      environmentMappedInstances: family.environmentMappedInstances,
      normalScaleValues: [...family.normalScales].map((entry) => JSON.parse(entry) as readonly [number, number]),
      roughnessValues: [...family.roughnessValues].sort((left, right) => left - right),
      metalnessValues: [...family.metalnessValues].sort((left, right) => left - right),
      owner: family.owner,
      status: family.sources.size > 0 && [...family.sources].every((source) => adaptedSources.has(source))
        ? "supported"
        : "unsupported",
    };
  }).sort((left, right) => `${left.role}/${left.sourceMaterialFamily}`.localeCompare(`${right.role}/${right.sourceMaterialFamily}`));

  return {
    sceneId: profile.sceneId,
    frame,
    totalMeshAssignments,
    distinctMaterialInstances: new Set([...families.values()].flatMap((family) => [...family.sources])).size,
    adaptedMaterialInstances: adaptedSources.size,
    unsupportedMaterialInstances: unsupportedSources.size,
    unsupported,
    families: supportedFamilies,
    background: { authoredColor: "#f8fafc", nodeInstalled: scene.backgroundNode !== null },
    environment: {
      assigned: environment !== null,
      textureType: environment ? String(environment.type) : null,
      colorSpace: environment?.colorSpace ?? null,
      intensity: scene.environmentIntensity,
    },
    lighting: {
      hemisphereLights,
      directionalLights,
      shadowCastingDirectionalLights,
      shadowMapSizes: [...shadowMapSizes].map((value) => JSON.parse(value) as readonly [number, number]),
    },
  };
};

/** Architecture Rise's scene-specific diagnostic interpretation of shared material tracking. */
export const buildArchitectureRiseMaterialInventory = (
  scene: THREE.Scene,
  frame: number,
  unsupported: readonly UnsupportedMaterialAssignment[],
): ObserverMaterialInventory => buildObserverMaterialInventory(scene, frame, unsupported, {
  sceneId: "architecture-rise",
  roleForObject: architectureRiseObjectRole,
  outputOwnerForRole: (role) => role === "architecture-rise-subject"
    ? "disposeArchitectureRiseGroup -> disposeTeachingSubjectResources"
    : "Observer output-policy controller (NodeMaterial); React Three Fiber (authored material)",
});
