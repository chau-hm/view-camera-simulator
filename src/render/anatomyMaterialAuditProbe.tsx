/* eslint-disable react-refresh/only-export-components */
import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { resolveObserverVisualPipelineCapabilities } from "./backend/observerVisualPipelineCapabilities";
import {
  calculateAnatomyProjectedBounds,
  type AnatomyProjectedRegion,
  type AnatomyWorldBounds,
} from "./anatomyProjectedBounds";
import { classifyAnatomyMaterialRole } from "./anatomyMaterialRoles";
import { readObserverOutputSourceMaterial } from "./backend/observerMaterialOutputIdentity";

export const ANATOMY_MATERIAL_AUDIT_REQUEST_EVENT =
  "vcs:observer-verification:anatomy-material-audit";
export const ANATOMY_MATERIAL_AUDIT_RESULT_EVENT =
  "vcs:observer-verification:anatomy-material-audit-result";
export const ANATOMY_RENDER_OBJECT_VISIBILITY_EVENT =
  "vcs:observer-verification:anatomy-object-visibility";

type AnatomyMaterialAuditRequest = Readonly<{ requestId: string }>;

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
    textureSlots: textureSlots(material),
  };
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
      return {
        slot,
        adapted: material !== sourceMaterial,
        source: getMaterialProperties(sourceMaterial),
        output: getMaterialProperties(material),
      };
    });
    renderableSnapshots.push({
      name: objectName,
      type: object.type,
      role: category,
      cameraPart: classification.cameraPart,
      localPosition: object.position.toArray(),
      worldPosition: object.getWorldPosition(new THREE.Vector3()).toArray(),
      renderOrder: object.renderOrder,
      visible: effectiveVisible,
      castShadow: object.castShadow,
      receiveShadow: object.receiveShadow,
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

  return {
    schemaVersion: 1,
    sceneId: "view-camera-anatomy",
    generation,
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
}: Readonly<{ generation: number }>) => {
  const { camera, gl, scene } = useThree();

  useEffect(() => {
    if (!import.meta.env.DEV || typeof window === "undefined") return;
    const container = gl.domElement.closest<HTMLElement>('[data-testid="scene-canvas"]');
    if (!container) return;

    const handleRequest = (event: Event) => {
      const request = (event as CustomEvent<unknown>).detail as AnatomyMaterialAuditRequest | null;
      if (!request || typeof request.requestId !== "string") return;
      const snapshot = collectAnatomyMaterialAuditSnapshot(scene, camera, gl, generation, container);
      container.dispatchEvent(new CustomEvent(ANATOMY_MATERIAL_AUDIT_RESULT_EVENT, {
        detail: { requestId: request.requestId, snapshot },
      }));
    };
    const visibilityBeforeTest = new Map<THREE.Object3D, boolean>();
    const handleVisibilityRequest = (event: Event) => {
      const request = (event as CustomEvent<unknown>).detail as
        Readonly<{ objectName: string; visible: boolean }> | null;
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
    return () => {
      visibilityBeforeTest.forEach((visible, object) => { object.visible = visible; });
      container.removeEventListener(ANATOMY_MATERIAL_AUDIT_REQUEST_EVENT, handleRequest);
      container.removeEventListener(ANATOMY_RENDER_OBJECT_VISIBILITY_EVENT, handleVisibilityRequest);
      container.removeAttribute("data-observer-test-object-visibility");
      container.removeAttribute("data-observer-test-object-visibility-error");
    };
  }, [camera, generation, gl, scene]);

  return null;
};
