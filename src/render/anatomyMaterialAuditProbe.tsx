/* eslint-disable react-refresh/only-export-components */
import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { resolveObserverVisualPipelineCapabilities } from "./backend/observerVisualPipelineCapabilities";

export const ANATOMY_MATERIAL_AUDIT_REQUEST_EVENT =
  "vcs:observer-verification:anatomy-material-audit";
export const ANATOMY_MATERIAL_AUDIT_RESULT_EVENT =
  "vcs:observer-verification:anatomy-material-audit-result";

type AnatomyMaterialAuditRequest = Readonly<{ requestId: string }>;

type ProjectedBounds = Readonly<{
  left: number;
  top: number;
  right: number;
  bottom: number;
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

const classifyRole = (object: THREE.Object3D, scene: THREE.Scene): {
  role: string;
  cameraPart: string | null;
  owner: string;
} => {
  const ancestors = getAncestors(object, scene);
  const hasName = (name: string) => ancestors.some((candidate) => candidate.name === name);
  const cameraPart = ancestors.find(
    (candidate) => typeof candidate.userData.anatomyPart === "string",
  )?.userData.anatomyPart as string | undefined;

  if (hasName("view-camera-anatomy-subject")) {
    return {
      role: "registered-target-subject",
      cameraPart: null,
      owner: "module-shared-asset-source",
    };
  }
  if (hasName("original-ghost-camera-rig-placement")) {
    return {
      role: cameraPart ? `ghost-reference-camera/${cameraPart}` : "ghost-reference-camera",
      cameraPart: cameraPart ?? null,
      owner: "r3f-scene-component",
    };
  }
  if (hasName("camera-rig-placement")) {
    return {
      role: cameraPart ? `conceptual-camera/${cameraPart}` : "conceptual-camera",
      cameraPart: cameraPart ?? null,
      owner: object.name === "bellows-folded-surface"
        ? "component-owned-dynamic-geometry"
        : "r3f-scene-component",
    };
  }
  if ((object as THREE.Light).isLight === true) {
    return { role: "lighting", cameraPart: null, owner: "r3f-scene-component" };
  }
  if (/image-circle|coverage|lens-plane|film-plane|focus-plane|dof|scheimpflug|optical|fov|helper/i.test(
    ancestors.map((candidate) => candidate.name).join("/"),
  )) {
    return { role: "optical-helper", cameraPart: null, owner: "r3f-scene-component" };
  }
  return { role: "other-scene-renderable", cameraPart: null, owner: "r3f-scene-component" };
};

const projectedBounds = (
  object: THREE.Object3D,
  camera: THREE.Camera,
): ProjectedBounds | null => {
  const bounds = new THREE.Box3().setFromObject(object);
  if (bounds.isEmpty()) return null;
  const points: THREE.Vector3[] = [];
  for (const x of [bounds.min.x, bounds.max.x]) {
    for (const y of [bounds.min.y, bounds.max.y]) {
      for (const z of [bounds.min.z, bounds.max.z]) {
        points.push(new THREE.Vector3(x, y, z).project(camera));
      }
    }
  }
  const visiblePoints = points.filter((point) =>
    Number.isFinite(point.x) && Number.isFinite(point.y) && Number.isFinite(point.z) &&
    point.z >= -1 && point.z <= 1,
  );
  if (visiblePoints.length === 0) return null;
  const left = Math.max(0, Math.min(...visiblePoints.map((point) => point.x * 0.5 + 0.5)));
  const right = Math.min(1, Math.max(...visiblePoints.map((point) => point.x * 0.5 + 0.5)));
  const top = Math.max(0, Math.min(...visiblePoints.map((point) => 0.5 - point.y * 0.5)));
  const bottom = Math.min(1, Math.max(...visiblePoints.map((point) => 0.5 - point.y * 0.5)));
  return right > left && bottom > top ? { left, top, right, bottom } : null;
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
    toneMapped: material.toneMapped,
    opacity: material.opacity,
    transparent: material.transparent,
    blending: material.blending,
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
  const projectedRegions: Record<string, ProjectedBounds | null> = {};
  const lights: Array<Readonly<Record<string, unknown>>> = [];
  let renderableObjectCount = 0;
  let materialAssignmentCount = 0;

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
      projectedRegions.registeredTargetSubject = projectedBounds(object, camera);
    }
    if (typeof object.userData.subjectPartId === "string") {
      projectedRegions[`registeredTargetPart:${object.userData.subjectPartId}`] = projectedBounds(object, camera);
    }
    if (object.name === "camera-rig-placement") {
      projectedRegions.conceptualCamera = projectedBounds(object, camera);
    }
    if (object.name === "original-ghost-camera-rig-placement") {
      projectedRegions.ghostReferenceCamera = projectedBounds(object, camera);
    }
    if (typeof object.userData.anatomyPart === "string") {
      projectedRegions[`cameraPart:${object.userData.anatomyPart}`] = projectedBounds(object, camera);
    }
    if (/physical-image-circle|physical-coverage-conic|scheimpflug-construction|lens-plane-helper/.test(object.name)) {
      projectedRegions[`opticalHelper:${object.name}`] = projectedBounds(object, camera);
    }

    if (!isRenderable(object)) return;
    renderableObjectCount += 1;
    const classification = classifyRole(object, scene);
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
    materials.forEach((material) => {
      materialAssignmentCount += 1;
      const properties = getMaterialProperties(material);
      const materialKey = `${category}/${material.uuid}`;
      const materialEntry = materialGroups.get(materialKey) ?? {
        role: category,
        cameraPart: classification.cameraPart,
        owner: classification.owner === "module-shared-asset-source"
          ? "module-shared-asset-source"
          : "r3f-scene-component",
        properties,
        assignments: 0,
        objectNames: new Set<string>(),
      };
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
    container.addEventListener(ANATOMY_MATERIAL_AUDIT_REQUEST_EVENT, handleRequest);
    return () => container.removeEventListener(ANATOMY_MATERIAL_AUDIT_REQUEST_EVENT, handleRequest);
  }, [camera, generation, gl, scene]);

  return null;
};
