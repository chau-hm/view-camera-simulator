/* eslint-disable react-refresh/only-export-components */
import { useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import {
  resolveObserverRendererRuntime,
  resolveObserverVisualPipelineCapabilities,
} from "./backend/observerVisualPipelineCapabilities";
import {
  calculateAnatomyProjectedBounds,
  type AnatomyProjectedRegion,
  type AnatomyWorldBounds,
} from "./anatomyProjectedBounds";
import {
  classifyAnatomyMaterialTransparency,
  excludeAnatomyRenderables,
  findAnatomyTransparentOverlapCandidates,
  hasMixedAnatomyMaterialTransparencySlots,
  isAnatomyRendererGenerationCurrent,
  resolveAnatomyRenderableSelection,
  restoreAnatomyRenderables,
  type AnatomyMaterialTransparencyInput,
  type AnatomyRenderableSelectionRecord,
  type AnatomyRenderableSelector,
  type AnatomyVisibilitySnapshot,
} from "./anatomyRenderableContribution";
import { classifyAnatomyMaterialRole } from "./anatomyMaterialRoles";
import { readObserverOutputSourceMaterial } from "./backend/observerMaterialOutputIdentity";
import {
  ANATOMY_BELLOWS_COMPOSITING_INTERVENTION_EVENT,
  ANATOMY_BELLOWS_COMPOSITING_INTERVENTION_RESULT_EVENT,
  createAnatomyBellowsCompositingMaterialClone,
  isAnatomyBellowsCompositingCondition,
  registerAnatomyBellowsCompositingOverride,
  resolveAnatomyBellowsCompositingTarget,
  type AnatomyBellowsCompositingCandidate,
  type AnatomyBellowsCompositingCondition,
} from "./backend/anatomyBellowsCompositingIntervention";
import type { ConceptualCameraAnatomyPresentation } from "./ConceptualViewCamera";

export const ANATOMY_MATERIAL_AUDIT_REQUEST_EVENT =
  "vcs:observer-verification:anatomy-material-audit";
export const ANATOMY_MATERIAL_AUDIT_RESULT_EVENT =
  "vcs:observer-verification:anatomy-material-audit-result";
export const ANATOMY_RENDER_OBJECT_VISIBILITY_EVENT =
  "vcs:observer-verification:anatomy-object-visibility";
export const ANATOMY_RENDER_OBJECT_VISIBILITY_RESULT_EVENT =
  "vcs:observer-verification:anatomy-object-visibility-result";

type AnatomyMaterialAuditRequest = Readonly<{ requestId: string }>;

type AnatomyBellowsCompositingRequest = Readonly<{
  requestId: string;
  generation: number;
  operation: "apply" | "restore";
  transactionId: string;
  condition?: AnatomyBellowsCompositingCondition;
  renderableId?: string;
  sourceMaterialId?: string;
}>;

type ActiveBellowsCompositingTransaction = Readonly<{
  requestId: string;
  generation: number;
  transactionId: string;
  condition: Exclude<AnatomyBellowsCompositingCondition, "C0">;
  renderable: THREE.Object3D & { material: THREE.Material | THREE.Material[]; geometry: THREE.BufferGeometry };
  originalRenderableMaterial: THREE.Material | THREE.Material[];
  sourceMaterial: THREE.Material;
  sourceMaterialSnapshot: ReturnType<typeof getMaterialProperties>;
  geometry: THREE.BufferGeometry;
  visible: boolean;
  diagnosticClone: THREE.Material | null;
  releaseNativeOverride: (() => void) | null;
  diagnosticCloneDisposeCount: number;
  readBorrowedDisposeCounts: () => Readonly<{ sourceMaterial: number; geometry: number; textures: number }>;
  releaseBorrowedDisposalGuards: () => void;
}>;

type AnatomyRenderableVisibilityRequest = Readonly<{
  requestId: string;
  generation: number;
  operation: "exclude" | "restore" | "noop";
  transactionId?: string;
  selector?: AnatomyRenderableSelector;
}>;

type AnatomyRenderableContributionRecord = Readonly<{
  id: string;
  objectName: string;
  type: string;
  role: string;
  cameraPart: string | null;
  visible: boolean;
  parentHierarchy: readonly Readonly<{ id: string; name: string; type: string }>[];
  worldMatrix: readonly number[];
  castShadow: boolean;
  receiveShadow: boolean;
  renderOrder: number;
  materialAssignments: readonly Readonly<{
    slot: number;
    transparencyCategories: readonly string[];
    source: ReturnType<typeof getMaterialProperties>;
  }>[];
  projectedBounds: AnatomyProjectedRegion | null;
  object: THREE.Object3D & { visible: boolean };
  materialSlots: readonly AnatomyMaterialTransparencyInput[];
}>;

type AnatomyVisibilityTransaction = Readonly<{
  generation: number;
  snapshots: readonly AnatomyVisibilitySnapshot[];
  targets: readonly AnatomyRenderableSelectionRecord<THREE.Object3D & { visible: boolean }>[];
  sourceResourceReferences: readonly Readonly<{
    id: string;
    geometry: THREE.BufferGeometry;
    material: THREE.Material | THREE.Material[];
  }>[];
}>;

const isRenderable = (
  object: THREE.Object3D,
): object is (THREE.Mesh | THREE.Line | THREE.Points) & {
  material: THREE.Material | THREE.Material[];
  geometry: THREE.BufferGeometry;
} =>
  (object as THREE.Mesh).isMesh === true ||
  (object as THREE.Line).isLine === true ||
  (object as THREE.Points).isPoints === true;

const getAncestors = (object: THREE.Object3D, scene: THREE.Scene): THREE.Object3D[] => {
  const ancestors: THREE.Object3D[] = [];
  let current: THREE.Object3D | null = object;
  while (current && current !== scene) {
    ancestors.push(current);
    current = current.parent;
  }
  return ancestors;
};

const textureSlots = (material: THREE.Material): Record<string, Readonly<{
  uuid: string;
  type: string;
  colorSpace: string;
}>> => Object.fromEntries(
  Object.entries(material)
    .filter(([, value]) => typeof value === "object" && value !== null &&
      (value as THREE.Texture).isTexture === true)
    .map(([key, value]) => {
      const texture = value as THREE.Texture;
      return [key, { uuid: texture.uuid, type: String(texture.type), colorSpace: texture.colorSpace }];
    }),
);

const getMaterialProperties = (material: THREE.Material) => {
  const materialWithSceneProperties = material as THREE.Material & {
    color?: THREE.Color;
    emissive?: THREE.Color;
    emissiveIntensity?: number;
    roughness?: number;
    metalness?: number;
    map?: THREE.Texture | null;
    outputTransform?: string;
    outputInterventionId?: string;
    outputGraphBuildCount?: number;
  };
  const side = material.side === THREE.DoubleSide
    ? "double"
    : material.side === THREE.BackSide
      ? "back"
      : "front";
  return {
    id: material.uuid,
    type: material.type,
    family: material.constructor.name,
    color: materialWithSceneProperties.color?.getHexString() ?? null,
    emissive: materialWithSceneProperties.emissive?.getHexString() ?? null,
    emissiveIntensity: materialWithSceneProperties.emissiveIntensity ?? null,
    toneMapped: material.toneMapped,
    opacity: material.opacity,
    transparent: material.transparent,
    blending: material.blending,
    premultipliedAlpha: material.premultipliedAlpha,
    depthTest: material.depthTest,
    depthWrite: material.depthWrite,
    side,
    alphaTest: material.alphaTest,
    roughness: materialWithSceneProperties.roughness ?? null,
    metalness: materialWithSceneProperties.metalness ?? null,
    outputTransform: materialWithSceneProperties.outputTransform ?? null,
    outputInterventionId: materialWithSceneProperties.outputInterventionId ?? null,
    outputGraphBuildCount: materialWithSceneProperties.outputGraphBuildCount ?? null,
    forceSinglePass: (material as THREE.Material & { forceSinglePass?: boolean }).forceSinglePass ?? null,
    alphaWrite: (material as THREE.Material & { alphaWrite?: boolean }).alphaWrite ?? null,
    materialVersion: material.version,
    textureSlots: textureSlots(material),
  };
};

const geometryContentFingerprint = (geometry: THREE.BufferGeometry): string => {
  let hash = 0x811c9dc5;
  const add = (value: string) => {
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 0x01000193);
    }
    hash ^= 0xff;
    hash = Math.imul(hash, 0x01000193);
  };
  Object.entries(geometry.attributes).sort(([left], [right]) => left.localeCompare(right)).forEach(([name, attribute]) => {
    add(`${name}/${attribute.itemSize}/${attribute.count}`);
    for (let vertex = 0; vertex < attribute.count; vertex += 1) {
      for (let component = 0; component < attribute.itemSize; component += 1) {
        add(String(attribute.getComponent(vertex, component)));
      }
    }
  });
  if (geometry.index) {
    add(`index/${geometry.index.count}`);
    for (let index = 0; index < geometry.index.count; index += 1) {
      add(String(geometry.index.getX(index)));
    }
  } else {
    add("no-index");
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
};

const getGeometryProperties = (geometry: THREE.BufferGeometry) => {
  const position = geometry.getAttribute("position");
  const positionAttributeVersion = position
    ? "version" in position ? position.version : position.data.version
    : null;
  return {
    id: geometry.uuid,
    type: geometry.type,
    vertexCount: position?.count ?? 0,
    positionAttributeVersion,
    indexCount: geometry.index?.count ?? 0,
    indexVersion: geometry.index?.version ?? null,
    contentFingerprint: geometryContentFingerprint(geometry),
    cachedBoundingBox: geometry.boundingBox
      ? {
          min: geometry.boundingBox.min.toArray(),
          max: geometry.boundingBox.max.toArray(),
        }
      : null,
  };
};

export const collectAnatomyMaterialAuditSnapshot = (
  scene: THREE.Scene,
  camera: THREE.Camera,
  renderer: unknown,
  generation: number,
  container: HTMLElement,
  anatomyPresentation: ConceptualCameraAnatomyPresentation | null,
) => {
  scene.updateMatrixWorld(true);
  camera.updateMatrixWorld(true);

  const categoryCounts = new Map<string, {
    objectCount: number;
    visibleObjectCount: number;
    hiddenObjectCount: number;
    shadowCasterCount: number;
    shadowReceiverCount: number;
    objectNames: Set<string>;
    visibleObjectNames: Set<string>;
    hiddenObjectNames: Set<string>;
    shadowCasterObjectNames: Set<string>;
    shadowReceiverObjectNames: Set<string>;
    renderOrderCounts: Map<number, number>;
  }>();
  const materialGroups = new Map<string, {
    role: string;
    cameraPart: string | null;
    owner: string;
    properties: ReturnType<typeof getMaterialProperties>;
    outputMaterialIds: Set<string>;
    outputMaterialFamilies: Set<string>;
    adapted: boolean;
    assignments: number;
    objectNames: Set<string>;
  }>();
  const geometryGroups = new Map<string, {
    role: string;
    owner: string;
    properties: ReturnType<typeof getGeometryProperties>;
    assignments: number;
    objectNames: Set<string>;
  }>();
  const projectedRegions: Record<string, AnatomyProjectedRegion | null> = {};
  const worldBounds: Record<string, AnatomyWorldBounds | null> = {};
  const lights: Array<Readonly<Record<string, unknown>>> = [];
  const renderableSnapshots: Array<Readonly<Record<string, unknown>>> = [];
  const renderableContributionRecords: AnatomyRenderableContributionRecord[] = [];
  let renderableObjectCount = 0;
  let materialAssignmentCount = 0;

  const recordBounds = (name: string, object: THREE.Object3D) => {
    const bounds = calculateAnatomyProjectedBounds(object, camera);
    projectedRegions[name] = bounds.projectedBounds;
    worldBounds[name] = bounds.worldBounds;
  };

  scene.traverse((object) => {
    if ((object as THREE.Light).isLight === true) {
      const light = object as THREE.Light & {
        intensity?: number;
        color?: THREE.Color;
        castShadow?: boolean;
        shadow?: { mapSize?: { width: number; height: number } };
      };
      lights.push({
        name: object.name,
        family: light.constructor.name,
        color: light.color?.getHexString() ?? null,
        intensity: light.intensity ?? null,
        castShadow: light.castShadow ?? false,
        shadowMapSize: light.shadow?.mapSize
          ? [light.shadow.mapSize.width, light.shadow.mapSize.height]
          : null,
      });
    }

    if (object.name === "view-camera-anatomy-subject") {
      recordBounds("registeredTargetSubject", object);
    }
    if (typeof object.userData.subjectPartId === "string") {
      recordBounds(`registeredTargetPart:${object.userData.subjectPartId}`, object);
    }
    if (object.name === "camera-rig-placement") {
      recordBounds("conceptualCamera", object);
    }
    if (object.name === "original-ghost-camera-rig-placement") {
      recordBounds("ghostReferenceCamera", object);
    }
    if (typeof object.userData.anatomyPart === "string") {
      recordBounds(`cameraPart:${object.userData.anatomyPart}`, object);
    }
    if (/physical-image-circle|physical-coverage-conic|scheimpflug-construction|lens-plane-helper/.test(object.name)) {
      recordBounds(`opticalHelper:${object.name}`, object);
    }

    if (!isRenderable(object)) return;
    renderableObjectCount += 1;
    const classification = classifyAnatomyMaterialRole(object, scene);
    const category = classification.role;
    const categoryEntry = categoryCounts.get(category) ?? {
      objectCount: 0,
      visibleObjectCount: 0,
      hiddenObjectCount: 0,
      shadowCasterCount: 0,
      shadowReceiverCount: 0,
      objectNames: new Set<string>(),
      visibleObjectNames: new Set<string>(),
      hiddenObjectNames: new Set<string>(),
      shadowCasterObjectNames: new Set<string>(),
      shadowReceiverObjectNames: new Set<string>(),
      renderOrderCounts: new Map<number, number>(),
    };
    categoryEntry.objectCount += 1;
    const objectName = object.name || `${category}#${object.id}`;
    const effectiveVisible = getAncestors(object, scene).every((ancestor) => ancestor.visible);
    categoryEntry.objectNames.add(objectName);
    if (effectiveVisible) {
      categoryEntry.visibleObjectCount += 1;
      categoryEntry.visibleObjectNames.add(objectName);
    } else {
      categoryEntry.hiddenObjectCount += 1;
      categoryEntry.hiddenObjectNames.add(objectName);
    }
    if (object.castShadow) {
      categoryEntry.shadowCasterCount += 1;
      categoryEntry.shadowCasterObjectNames.add(objectName);
    }
    if (object.receiveShadow) {
      categoryEntry.shadowReceiverCount += 1;
      categoryEntry.shadowReceiverObjectNames.add(objectName);
    }
    categoryEntry.renderOrderCounts.set(
      object.renderOrder,
      (categoryEntry.renderOrderCounts.get(object.renderOrder) ?? 0) + 1,
    );
    categoryCounts.set(category, categoryEntry);

    const geometry = getGeometryProperties(object.geometry);
    const geometryKey = `${category}/${geometry.id}`;
    const geometryEntry = geometryGroups.get(geometryKey) ?? {
      role: category,
      owner: classification.owner,
      properties: geometry,
      assignments: 0,
      objectNames: new Set<string>(),
    };
    geometryEntry.assignments += 1;
    geometryEntry.objectNames.add(object.name || object.type);
    geometryGroups.set(geometryKey, geometryEntry);

    const materials = Array.isArray(object.material) ? object.material : [object.material];
    const materialAssignments = materials.map((material, slot) => {
      const sourceMaterial = readObserverOutputSourceMaterial(material) ?? material;
      const sourceProperties = getMaterialProperties(sourceMaterial);
      const sourceTransparency = {
        transparent: sourceMaterial.transparent,
        opacity: sourceMaterial.opacity,
        alphaTest: sourceMaterial.alphaTest,
        hasAlphaMap: Boolean((sourceMaterial as THREE.Material & { alphaMap?: THREE.Texture | null }).alphaMap),
      };
      return {
        slot,
        adapted: material !== sourceMaterial,
        source: sourceProperties,
        output: getMaterialProperties(material),
        transparencyCategories: classifyAnatomyMaterialTransparency(sourceTransparency),
        sourceTransparency,
      };
    });
    const transparencyClasses = new Set<string>(materialAssignments.flatMap((assignment) => assignment.transparencyCategories));
    if (hasMixedAnatomyMaterialTransparencySlots(materialAssignments.map((assignment) => assignment.sourceTransparency))) {
      transparencyClasses.add("T4");
    }
    const projectedBounds = calculateAnatomyProjectedBounds(object, camera).projectedBounds;
    const materialSlots = materialAssignments.map((assignment) => assignment.sourceTransparency);
    const contributionRecord: AnatomyRenderableContributionRecord = {
      id: object.uuid,
      objectName,
      type: object.type,
      role: category,
      cameraPart: classification.cameraPart,
      visible: effectiveVisible,
      parentHierarchy: getAncestors(object, scene).slice(1).reverse().map((ancestor) => ({
        id: ancestor.uuid,
        name: ancestor.name,
        type: ancestor.type,
      })),
      worldMatrix: object.matrixWorld.elements.slice(),
      castShadow: object.castShadow,
      receiveShadow: object.receiveShadow,
      renderOrder: object.renderOrder,
      materialAssignments: materialAssignments.map((assignment) => ({
        slot: assignment.slot,
        transparencyCategories: assignment.transparencyCategories,
        source: assignment.source,
      })),
      projectedBounds,
      object,
      materialSlots,
    };
    renderableContributionRecords.push(contributionRecord);
    renderableSnapshots.push({
      objectId: object.uuid,
      name: objectName,
      type: object.type,
      role: category,
      cameraPart: classification.cameraPart,
      parentHierarchy: contributionRecord.parentHierarchy,
      localPosition: object.position.toArray(),
      worldPosition: object.getWorldPosition(new THREE.Vector3()).toArray(),
      worldMatrix: contributionRecord.worldMatrix,
      renderOrder: object.renderOrder,
      visible: effectiveVisible,
      castShadow: object.castShadow,
      receiveShadow: object.receiveShadow,
      transparencyCategories: [...transparencyClasses].sort(),
      projectedBounds,
      geometry,
      materialAssignments,
    });
    materials.forEach((material) => {
      materialAssignmentCount += 1;
      const sourceMaterial = readObserverOutputSourceMaterial(material) ?? material;
      const properties = getMaterialProperties(sourceMaterial);
      const materialKey = `${category}/${sourceMaterial.uuid}`;
      const materialEntry = materialGroups.get(materialKey) ?? {
        role: category,
        cameraPart: classification.cameraPart,
        owner: classification.owner === "module-shared-asset-source"
          ? "module-shared-asset-source"
          : "r3f-scene-component",
        properties,
        outputMaterialIds: new Set<string>(),
        outputMaterialFamilies: new Set<string>(),
        adapted: false,
        assignments: 0,
        objectNames: new Set<string>(),
      };
      materialEntry.outputMaterialIds.add(material.uuid);
      materialEntry.outputMaterialFamilies.add(material.constructor.name);
      materialEntry.adapted ||= material !== sourceMaterial;
      materialEntry.assignments += 1;
      materialEntry.objectNames.add(object.name || object.type);
      materialGroups.set(materialKey, materialEntry);
    });
  });

  const background = scene.background instanceof THREE.Color
    ? `#${scene.background.getHexString()}`
    : scene.background?.type ?? null;
  const environment = scene.environment as THREE.Texture | null;
  const canvas = renderer && typeof renderer === "object"
    ? (renderer as { domElement?: HTMLCanvasElement }).domElement
    : undefined;
  const rect = canvas?.getBoundingClientRect();
  const transparencyAssignmentCounts = new Map<string, number>();
  renderableContributionRecords.forEach((renderable) => {
    renderable.materialAssignments.forEach((assignment) => {
      const family = assignment.source.family;
      assignment.transparencyCategories.forEach((classification) => {
        const key = JSON.stringify({
          role: renderable.role,
          cameraPart: renderable.cameraPart,
          classification,
          materialFamily: family,
        });
        transparencyAssignmentCounts.set(key, (transparencyAssignmentCounts.get(key) ?? 0) + 1);
      });
    });
  });
  const transparentOverlapCandidates = findAnatomyTransparentOverlapCandidates(
    renderableContributionRecords,
  ).map((candidate) => ({
    ...candidate,
    firstObjectName: renderableContributionRecords.find((record) => record.id === candidate.firstId)?.objectName ?? null,
    secondObjectName: renderableContributionRecords.find((record) => record.id === candidate.secondId)?.objectName ?? null,
    interpretation: "projected rectangular bounds overlap; this is a candidate, not exact silhouette or visible-pixel overlap",
  }));

  return {
    schemaVersion: 1,
    sceneId: "view-camera-anatomy",
    generation,
    anatomyPresentation,
    renderer: resolveObserverVisualPipelineCapabilities(renderer),
    browser: {
      webgpuApiPresent: container.dataset.observerWebgpuApiPresent === "true",
      adapterAvailability: container.dataset.observerAdapterAvailability ?? "unknown",
      requestedRenderer: container.dataset.observerRendererRequest ?? "unknown",
      rendererAttempt: container.dataset.observerRendererAttempt ?? "unknown",
      applicationFallback: container.dataset.observerApplicationFallback ?? "unknown",
      outputPolicy: container.dataset.observerOutputPolicyInstalled ?? "standard",
    },
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
      devicePixelRatio: window.devicePixelRatio,
      canvasCssWidth: rect?.width ?? null,
      canvasCssHeight: rect?.height ?? null,
      canvasBackingWidth: canvas?.width ?? null,
      canvasBackingHeight: canvas?.height ?? null,
      cameraPosition: camera.position.toArray(),
      cameraQuaternion: camera.quaternion.toArray(),
      cameraProjectionMatrix: camera.projectionMatrix.elements,
      orbitTarget: container.dataset.orbitTarget?.split(",").map(Number) ?? null,
    },
    background,
    environment: environment
      ? { assigned: true, type: environment.type, colorSpace: environment.colorSpace }
      : { assigned: false, type: null, colorSpace: null },
    lights,
    renderables: renderableSnapshots,
    transparencyInventory: {
      materialAssignmentCounts: [...transparencyAssignmentCounts.entries()].map(([key, count]) => ({
        ...JSON.parse(key) as Readonly<Record<string, unknown>>,
        assignmentCount: count,
      })).sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right))),
      mixedMaterialRenderableCount: renderableSnapshots.filter((renderable) =>
        Array.isArray(renderable.transparencyCategories) && renderable.transparencyCategories.includes("T4"),
      ).length,
      visibleExplicitTransparentRenderableCount: renderableContributionRecords.filter((renderable) =>
        renderable.visible && renderable.materialSlots.some((material) => material.transparent),
      ).length,
      transparentOverlapCandidateCount: transparentOverlapCandidates.length,
      transparentOverlapCandidates,
    },
    counts: {
      renderableObjects: renderableObjectCount,
      materialAssignments: materialAssignmentCount,
      distinctMaterialInstances: materialGroups.size,
      distinctGeometryInstances: geometryGroups.size,
      sharedMaterialInstances: [...materialGroups.values()].filter((entry) => entry.assignments > 1).length,
      sharedGeometryInstances: [...geometryGroups.values()].filter((entry) => entry.assignments > 1).length,
    },
    categories: [...categoryCounts.entries()].map(([role, value]) => ({
      role,
      objectCount: value.objectCount,
      visibleObjectCount: value.visibleObjectCount,
      hiddenObjectCount: value.hiddenObjectCount,
      shadowCasterCount: value.shadowCasterCount,
      shadowReceiverCount: value.shadowReceiverCount,
      objectNames: [...value.objectNames].sort(),
      visibleObjectNames: [...value.visibleObjectNames].sort(),
      hiddenObjectNames: [...value.hiddenObjectNames].sort(),
      shadowCasterObjectNames: [...value.shadowCasterObjectNames].sort(),
      shadowReceiverObjectNames: [...value.shadowReceiverObjectNames].sort(),
      renderOrderCounts: Object.fromEntries([...value.renderOrderCounts.entries()].sort(([a], [b]) => a - b)),
    })).sort((left, right) => left.role.localeCompare(right.role)),
    materials: [...materialGroups.values()].map((entry) => ({
      ...entry,
      sourceMaterialId: entry.properties.id,
      outputMaterialIds: [...entry.outputMaterialIds].sort(),
      outputMaterialFamilies: [...entry.outputMaterialFamilies].sort(),
      objectNames: [...entry.objectNames].sort(),
    })).sort((left, right) =>
      `${left.role}/${left.properties.family}/${left.properties.id}`.localeCompare(
        `${right.role}/${right.properties.family}/${right.properties.id}`,
      ),
    ),
    geometries: [...geometryGroups.values()].map((entry) => ({
      ...entry,
      objectNames: [...entry.objectNames].sort(),
    })).sort((left, right) =>
      `${left.role}/${left.properties.type}/${left.properties.id}`.localeCompare(
        `${right.role}/${right.properties.type}/${right.properties.id}`,
      ),
    ),
    projectedRegions,
    worldBounds,
  };
};

export const AnatomyMaterialAuditProbe = ({
  generation,
  anatomyPresentation,
}: Readonly<{
  generation: number;
  anatomyPresentation: ConceptualCameraAnatomyPresentation | null;
}>) => {
  const { camera, gl, scene } = useThree();
  const anatomyPresentationRef = useRef(anatomyPresentation);
  anatomyPresentationRef.current = anatomyPresentation;

  useEffect(() => {
    if (!import.meta.env.DEV || typeof window === "undefined") return;
    const container = gl.domElement.closest<HTMLElement>('[data-testid="scene-canvas"]');
    if (!container) return;

    const handleRequest = (event: Event) => {
      const request = (event as CustomEvent<unknown>).detail as AnatomyMaterialAuditRequest | null;
      if (!request || typeof request.requestId !== "string") return;
      const snapshot = collectAnatomyMaterialAuditSnapshot(
        scene,
        camera,
        gl,
        generation,
        container,
        anatomyPresentationRef.current,
      );
      container.dispatchEvent(new CustomEvent(ANATOMY_MATERIAL_AUDIT_RESULT_EVENT, {
        detail: { requestId: request.requestId, snapshot },
      }));
    };
    const visibilityBeforeTest = new Map<THREE.Object3D, boolean>();
    const visibilityTransactions = new Map<string, AnatomyVisibilityTransaction>();
    let activeBellowsCompositingTransaction: ActiveBellowsCompositingTransaction | null = null;
    const emitBellowsCompositingResult = (result: Readonly<Record<string, unknown>>) => {
      container.dispatchEvent(new CustomEvent(ANATOMY_BELLOWS_COMPOSITING_INTERVENTION_RESULT_EVENT, {
        detail: result,
      }));
    };
    const collectBellowsCompositingCandidates = (): AnatomyBellowsCompositingCandidate[] => {
      const candidates: AnatomyBellowsCompositingCandidate[] = [];
      scene.traverse((object) => {
        if (!isRenderable(object)) return;
        const classification = classifyAnatomyMaterialRole(object, scene);
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        if (materials.length !== 1) return;
        const source = readObserverOutputSourceMaterial(materials[0]!) ?? materials[0]!;
        const renderState = source as THREE.Material & { forceSinglePass?: boolean };
        candidates.push({
          id: object.uuid,
          name: object.name,
          role: classification.role,
          cameraPart: classification.cameraPart,
          visible: getAncestors(object, scene).every((ancestor) => ancestor.visible),
          source: {
            id: source.uuid,
            type: source.type,
            opacity: source.opacity,
            transparent: source.transparent,
            blending: source.blending,
            premultipliedAlpha: source.premultipliedAlpha,
            depthTest: source.depthTest,
            depthWrite: source.depthWrite,
            side: source.side,
            forceSinglePass: renderState.forceSinglePass ?? false,
          },
        });
      });
      return candidates;
    };
    const restoreBellowsCompositingTransaction = (
      transaction: ActiveBellowsCompositingTransaction,
    ): Readonly<Record<string, unknown>> => {
      transaction.releaseNativeOverride?.();
      let renderableMaterialIdentityRestored = false;
      if (transaction.diagnosticClone) {
        if (transaction.renderable.material === transaction.diagnosticClone) {
          transaction.renderable.material = transaction.originalRenderableMaterial;
        }
        transaction.diagnosticClone.dispose();
        renderableMaterialIdentityRestored = transaction.renderable.material === transaction.originalRenderableMaterial;
      }
      const borrowedDisposeCounts = transaction.readBorrowedDisposeCounts();
      transaction.releaseBorrowedDisposalGuards();
      const sourcePropertiesPreserved = JSON.stringify(getMaterialProperties(transaction.sourceMaterial)) ===
        JSON.stringify(transaction.sourceMaterialSnapshot);
      return {
        operation: "restore",
        transactionId: transaction.transactionId,
        renderableId: transaction.renderable.uuid,
        sourceMaterialId: transaction.sourceMaterial.uuid,
        renderableMaterialIdentityRestored,
        geometryIdentityPreserved: transaction.renderable.geometry === transaction.geometry,
        originalVisibilityPreserved: getAncestors(transaction.renderable, scene).every((ancestor) => ancestor.visible) ===
          transaction.visible,
        sourcePropertiesPreserved,
        diagnosticCloneDisposeCount: transaction.diagnosticCloneDisposeCount,
        borrowedDisposeCounts,
        borrowedResourceDisposed: borrowedDisposeCounts.sourceMaterial > 0 || borrowedDisposeCounts.geometry > 0 ||
          borrowedDisposeCounts.textures > 0,
        nativeOutputRestoration: transaction.releaseNativeOverride ? "controller-restores-on-next-frame" : null,
      };
    };
    const handleBellowsCompositingIntervention = (event: Event) => {
      const request = (event as CustomEvent<unknown>).detail as AnatomyBellowsCompositingRequest | null;
      const requestId = typeof request?.requestId === "string" ? request.requestId : "";
      const fail = (reason: string) => emitBellowsCompositingResult({
        requestId,
        generation,
        ok: false,
        reason,
      });
      if (!request || requestId.length === 0 || !isAnatomyRendererGenerationCurrent(request.generation, generation)) {
        fail("stale-renderer-generation");
        return;
      }
      if (typeof request.transactionId !== "string" || request.transactionId.length === 0) {
        fail("invalid-transaction-id");
        return;
      }
      if (request.operation === "restore") {
        const transaction = activeBellowsCompositingTransaction;
        if (!transaction || transaction.transactionId !== request.transactionId || transaction.generation !== generation) {
          fail("unknown-or-stale-compositing-transaction");
          return;
        }
        const restored = restoreBellowsCompositingTransaction(transaction);
        activeBellowsCompositingTransaction = null;
        emitBellowsCompositingResult({ requestId, generation, ok: true, ...restored });
        return;
      }
      if (request.operation !== "apply" || !isAnatomyBellowsCompositingCondition(request.condition) || request.condition === "C0") {
        fail("invalid-compositing-intervention");
        return;
      }
      if (activeBellowsCompositingTransaction) {
        fail("compositing-intervention-already-active");
        return;
      }
      const targetResolution = resolveAnatomyBellowsCompositingTarget(
        request.renderableId,
        request.sourceMaterialId,
        collectBellowsCompositingCandidates(),
      );
      if (!targetResolution.ok) {
        fail(targetResolution.reason);
        return;
      }
      const renderable = scene.getObjectByProperty("uuid", targetResolution.target.id);
      if (!renderable || !isRenderable(renderable)) {
        fail("stale-renderable-id");
        return;
      }
      if (Array.isArray(renderable.material)) {
        fail("unsupported-material-slot-count");
        return;
      }
      const originalRenderableMaterial = renderable.material;
      const sourceMaterial = readObserverOutputSourceMaterial(originalRenderableMaterial) ?? originalRenderableMaterial;
      if (sourceMaterial.uuid !== targetResolution.target.source.id) {
        fail("source-material-mismatch");
        return;
      }
      const sourceMaterialSnapshot = getMaterialProperties(sourceMaterial);
      const runtime = resolveObserverRendererRuntime(gl);
      let diagnosticClone: THREE.Material | null = null;
      let releaseNativeOverride: (() => void) | null = null;
      let diagnosticCloneDisposeCount = 0;
      if (runtime.executionBackend === "webgl2" && runtime.rendererFamily === "webgl-renderer") {
        if (sourceMaterial !== originalRenderableMaterial) {
          fail("webgl-authored-source-material-not-active");
          return;
        }
        try {
          diagnosticClone = createAnatomyBellowsCompositingMaterialClone(
            sourceMaterial,
            request.condition,
          );
          diagnosticClone.addEventListener("dispose", () => { diagnosticCloneDisposeCount += 1; });
          renderable.material = diagnosticClone;
        } catch (error) {
          diagnosticClone?.dispose();
          fail(error instanceof Error ? error.message : String(error));
          return;
        }
      } else if (runtime.executionBackend === "webgpu" && runtime.rendererFamily === "webgpu-renderer") {
        const output = originalRenderableMaterial as THREE.Material & {
          outputTransform?: string;
          outputInterventionId?: string;
        };
        if (readObserverOutputSourceMaterial(originalRenderableMaterial) !== sourceMaterial ||
            output.outputTransform !== "material-aware" || output.outputInterventionId !== "B0") {
          fail("native-material-aware-b0-output-not-active");
          return;
        }
        const registration = registerAnatomyBellowsCompositingOverride(
          renderable,
          generation,
          request.condition,
        );
        releaseNativeOverride = registration.release;
      } else {
        fail(`unqualified-renderer:${runtime.rendererFamily}/${runtime.executionBackend}`);
        return;
      }
      let sourceMaterialDisposeCount = 0;
      let geometryDisposeCount = 0;
      let textureDisposeCount = 0;
      const onSourceMaterialDispose = () => { sourceMaterialDisposeCount += 1; };
      const onGeometryDispose = () => { geometryDisposeCount += 1; };
      const onTextureDispose = () => { textureDisposeCount += 1; };
      const borrowedTextures = [...new Set(Object.values(sourceMaterial).filter((value): value is THREE.Texture =>
        typeof value === "object" && value !== null && (value as THREE.Texture).isTexture === true,
      ))];
      sourceMaterial.addEventListener("dispose", onSourceMaterialDispose);
      renderable.geometry.addEventListener("dispose", onGeometryDispose);
      borrowedTextures.forEach((texture) => texture.addEventListener("dispose", onTextureDispose));
      const transaction: ActiveBellowsCompositingTransaction = {
        requestId,
        generation,
        transactionId: request.transactionId,
        condition: request.condition,
        renderable,
        originalRenderableMaterial,
        sourceMaterial,
        sourceMaterialSnapshot,
        geometry: renderable.geometry,
        visible: getAncestors(renderable, scene).every((ancestor) => ancestor.visible),
        diagnosticClone,
        releaseNativeOverride,
        get diagnosticCloneDisposeCount() { return diagnosticCloneDisposeCount; },
        readBorrowedDisposeCounts: () => ({
          sourceMaterial: sourceMaterialDisposeCount,
          geometry: geometryDisposeCount,
          textures: textureDisposeCount,
        }),
        releaseBorrowedDisposalGuards: () => {
          sourceMaterial.removeEventListener("dispose", onSourceMaterialDispose);
          renderable.geometry.removeEventListener("dispose", onGeometryDispose);
          borrowedTextures.forEach((texture) => texture.removeEventListener("dispose", onTextureDispose));
        },
      };
      activeBellowsCompositingTransaction = transaction;
      emitBellowsCompositingResult({
        requestId,
        generation,
        ok: true,
        operation: "apply",
        condition: request.condition,
        transactionId: request.transactionId,
        renderableId: renderable.uuid,
        renderableName: renderable.name,
        sourceMaterialId: sourceMaterial.uuid,
        originalOutputMaterialId: originalRenderableMaterial.uuid,
        activeOutputMaterialId: diagnosticClone?.uuid ?? originalRenderableMaterial.uuid,
        sourcePropertiesPreserved: JSON.stringify(getMaterialProperties(sourceMaterial)) ===
          JSON.stringify(sourceMaterialSnapshot),
        baselineSourceProperties: transaction.sourceMaterialSnapshot,
        requestedOverrides: request.condition === "C1"
          ? { forceSinglePass: true }
        : request.condition === "C2"
            ? { blending: THREE.NoBlending }
            : { forceSinglePass: true, blending: THREE.NoBlending },
        effectiveMaterialProperties: getMaterialProperties(diagnosticClone ?? originalRenderableMaterial),
        executionBackend: runtime.executionBackend,
        outputVariantUpdatePendingFrame: releaseNativeOverride !== null,
      });
    };
    const emitVisibilityResult = (result: Readonly<Record<string, unknown>>) => {
      container.dispatchEvent(new CustomEvent(ANATOMY_RENDER_OBJECT_VISIBILITY_RESULT_EVENT, {
        detail: result,
      }));
    };
    const isSelector = (value: unknown): value is AnatomyRenderableSelector => {
      if (!value || typeof value !== "object") return false;
      const selector = value as Record<string, unknown>;
      if (selector.kind === "all-renderables" || selector.kind === "explicit-transparent" ||
          selector.kind === "conceptual-camera") return true;
      if (selector.kind === "semantic-role") return typeof selector.role === "string";
      if (selector.kind === "camera-part") return typeof selector.cameraPart === "string";
      if (selector.kind === "camera-parts") return Array.isArray(selector.cameraParts) &&
        selector.cameraParts.every((part) => typeof part === "string");
      return selector.kind === "renderable-ids" && Array.isArray(selector.renderableIds) &&
        selector.renderableIds.every((id) => typeof id === "string");
    };
    const collectSelectionRecords = (): AnatomyRenderableSelectionRecord<THREE.Object3D & { visible: boolean }>[] => {
      const records: AnatomyRenderableSelectionRecord<THREE.Object3D & { visible: boolean }>[] = [];
      scene.traverse((object) => {
        if (!isRenderable(object)) return;
        const classification = classifyAnatomyMaterialRole(object, scene);
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        records.push({
          id: object.uuid,
          name: object.name || `${classification.role}#${object.id}`,
          role: classification.role,
          cameraPart: classification.cameraPart,
          visible: getAncestors(object, scene).every((ancestor) => ancestor.visible),
          materialSlots: materials.map((material) => {
            const source = readObserverOutputSourceMaterial(material) ?? material;
            return {
              transparent: source.transparent,
              opacity: source.opacity,
              alphaTest: source.alphaTest,
              hasAlphaMap: Boolean((source as THREE.Material & { alphaMap?: THREE.Texture | null }).alphaMap),
            };
          }),
          value: object,
        });
      });
      return records;
    };
    const handleStructuredVisibilityRequest = (request: AnatomyRenderableVisibilityRequest) => {
      const fail = (reason: string) => emitVisibilityResult({
        requestId: request.requestId,
        generation: request.generation,
        ok: false,
        reason,
      });
      if (typeof request.requestId !== "string" || request.requestId.length === 0 ||
          !isAnatomyRendererGenerationCurrent(request.generation, generation)) {
        fail("stale-renderer-generation");
        return;
      }
      if (request.operation === "noop") {
        if (visibilityTransactions.size > 0) {
          fail("cannot-noop-during-active-exclusion");
          return;
        }
        emitVisibilityResult({ requestId: request.requestId, generation, ok: true, operation: "noop", targetCount: 0 });
        return;
      }
      if (request.operation === "exclude") {
        if (visibilityTransactions.size > 0) {
          fail("another-exclusion-is-active");
          return;
        }
        if (typeof request.transactionId !== "string" || request.transactionId.length === 0 ||
            !isSelector(request.selector)) {
          fail("invalid-exclusion-request");
          return;
        }
        const selection = resolveAnatomyRenderableSelection(collectSelectionRecords(), request.selector);
        if (!selection.ok) {
          fail(selection.reason);
          return;
        }
        const sourceResourceReferences = selection.records.flatMap((record) => isRenderable(record.value)
          ? [{ id: record.id, geometry: record.value.geometry, material: record.value.material }]
          : []);
        if (sourceResourceReferences.length !== selection.records.length) {
          fail("selection-contains-unsupported-renderable");
          return;
        }
        try {
          const snapshots = excludeAnatomyRenderables(selection.records.map((record) => ({
            id: record.id,
            value: record.value,
          })));
          const originalVisibilityById = new Map(snapshots.map((snapshot) => [snapshot.id, snapshot.visible]));
          visibilityTransactions.set(request.transactionId, {
            generation,
            snapshots,
            targets: selection.records,
            sourceResourceReferences,
          });
          const sourceResourceIdentityPreserved = sourceResourceReferences.every((reference) => {
            const target = selection.records.find((record) => record.id === reference.id)?.value;
            return target !== undefined && isRenderable(target) && target.geometry === reference.geometry &&
              target.material === reference.material;
          });
          emitVisibilityResult({
            requestId: request.requestId,
            generation,
            ok: true,
            operation: "exclude",
            transactionId: request.transactionId,
            selector: request.selector,
            targetCount: selection.records.length,
            sourceResourceIdentityPreserved,
            targets: selection.records.map((record) => ({
              id: record.id,
              name: record.name,
              type: record.value.type,
              role: record.role,
              cameraPart: record.cameraPart,
              originalVisibility: originalVisibilityById.get(record.id) ?? false,
              castShadow: record.value.castShadow,
              receiveShadow: record.value.receiveShadow,
              renderOrder: record.value.renderOrder,
              geometryId: (record.value as THREE.Mesh).geometry?.uuid ?? null,
              materialSlots: record.materialSlots.map((material) => ({
                ...material,
                categories: classifyAnatomyMaterialTransparency(material),
              })),
            })),
          });
        } catch (error) {
          fail(error instanceof Error ? error.message : String(error));
        }
        return;
      }
      if (request.operation === "restore") {
        if (typeof request.transactionId !== "string" || request.transactionId.length === 0) {
          fail("invalid-restore-request");
          return;
        }
        const transaction = visibilityTransactions.get(request.transactionId);
        if (!transaction || transaction.generation !== generation) {
          fail("unknown-or-stale-visibility-transaction");
          return;
        }
        const sourceResourceReferencesAtRestore = transaction.targets.flatMap((record) => isRenderable(record.value)
          ? [{ id: record.id, geometry: record.value.geometry, material: record.value.material }]
          : []);
        restoreAnatomyRenderables(transaction.snapshots);
        const sourceResourceIdentityPreserved = sourceResourceReferencesAtRestore.every((reference) => {
          const target = transaction.targets.find((record) => record.id === reference.id)?.value;
          return target !== undefined && isRenderable(target) && target.geometry === reference.geometry &&
            target.material === reference.material;
        });
        const sourceResourceIdentityMatchesInitialExclusion = transaction.sourceResourceReferences.every((reference) => {
          const target = transaction.targets.find((record) => record.id === reference.id)?.value;
          return target !== undefined && isRenderable(target) && target.geometry === reference.geometry &&
            target.material === reference.material;
        });
        visibilityTransactions.delete(request.transactionId);
        emitVisibilityResult({
          requestId: request.requestId,
          generation,
          ok: true,
          operation: "restore",
          transactionId: request.transactionId,
          targetCount: transaction.snapshots.length,
          sourceResourceIdentityPreserved,
          sourceResourceIdentityMatchesInitialExclusion,
          restored: transaction.snapshots.map((snapshot) => ({ id: snapshot.id, visible: snapshot.visible })),
        });
        return;
      }
      fail("unsupported-operation");
    };
    const handleVisibilityRequest = (event: Event) => {
      const request = (event as CustomEvent<unknown>).detail as
        Readonly<{ objectName?: string; visible?: boolean; operation?: string }> | null;
      if (request && "operation" in request) {
        handleStructuredVisibilityRequest(request as AnatomyRenderableVisibilityRequest);
        return;
      }
      if (!request || typeof request.objectName !== "string" || typeof request.visible !== "boolean") return;
      if (request.objectName !== "camera-anatomy-front-standard" &&
          request.objectName !== "original-ghost-camera-rig-placement") return;
      const object = scene.getObjectByName(request.objectName);
      if (!object) {
        container.setAttribute("data-observer-test-object-visibility-error", `${request.objectName}:not-mounted`);
        return;
      }
      if (!visibilityBeforeTest.has(object)) visibilityBeforeTest.set(object, object.visible);
      object.visible = request.visible;
      container.setAttribute("data-observer-test-object-visibility", JSON.stringify({
        objectName: request.objectName,
        visible: object.visible,
      }));
    };
    container.addEventListener(ANATOMY_MATERIAL_AUDIT_REQUEST_EVENT, handleRequest);
    container.addEventListener(ANATOMY_RENDER_OBJECT_VISIBILITY_EVENT, handleVisibilityRequest);
    container.addEventListener(ANATOMY_BELLOWS_COMPOSITING_INTERVENTION_EVENT, handleBellowsCompositingIntervention);
    container.setAttribute("data-observer-test-renderable-contribution-hook", "ready");
    return () => {
      visibilityBeforeTest.forEach((visible, object) => { object.visible = visible; });
      visibilityTransactions.forEach((transaction) => restoreAnatomyRenderables(transaction.snapshots));
      visibilityTransactions.clear();
      if (activeBellowsCompositingTransaction) {
        restoreBellowsCompositingTransaction(activeBellowsCompositingTransaction);
        activeBellowsCompositingTransaction = null;
      }
      container.removeEventListener(ANATOMY_MATERIAL_AUDIT_REQUEST_EVENT, handleRequest);
      container.removeEventListener(ANATOMY_RENDER_OBJECT_VISIBILITY_EVENT, handleVisibilityRequest);
      container.removeEventListener(ANATOMY_BELLOWS_COMPOSITING_INTERVENTION_EVENT, handleBellowsCompositingIntervention);
      container.removeAttribute("data-observer-test-renderable-contribution-hook");
      container.removeAttribute("data-observer-test-object-visibility");
      container.removeAttribute("data-observer-test-object-visibility-error");
    };
  }, [camera, generation, gl, scene]);

  return null;
};
