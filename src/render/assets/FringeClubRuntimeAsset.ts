import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/addons/loaders/GLTFLoader.js";
import { publicAssetUrl } from "../../utils/publicAssetUrl";

export const FRINGE_CLUB_ASSET_URL = publicAssetUrl(
  "assets/generated/fringe-club/stage-2h/preferred-runtime-candidate.glb",
);
export const FRINGE_CLUB_RUNTIME_SUBJECT_NAME = "fringe-club-runtime-subject";
export const FRINGE_CLUB_REQUESTED_ANISOTROPY = 4;

export type FringeClubVector3 = readonly [number, number, number];

export type FringeClubBoundsMeters = Readonly<{
  min: FringeClubVector3;
  max: FringeClubVector3;
  center: FringeClubVector3;
  size: FringeClubVector3;
}>;

export type FringeClubResourceCounts = Readonly<{
  geometries: number;
  materialTemplates: number;
  textures: number;
  imageBackings: number;
}>;

export type FringeClubRuntimeAuditSnapshot = Readonly<{
  requestsStarted: number;
  completedLoads: number;
  cancelledLoads: number;
  failedLoads: number;
  staleResultsDisposed: number;
  activeSources: number;
  activeOwnerLeases: number;
  activeInstanceLeases: number;
  liveSourceGeometries: number;
  liveSourceMaterialTemplates: number;
  liveSourceTextures: number;
  liveImageBackings: number;
  liveInstanceMaterials: number;
  finalSourceReleases: number;
  lastAppliedAnisotropy: number | null;
  lastLoadDurationMs: number | null;
  loadDurationsMs: readonly number[];
}>;

type MutableAuditSnapshot = {
  -readonly [K in keyof FringeClubRuntimeAuditSnapshot]: FringeClubRuntimeAuditSnapshot[K] extends readonly number[]
    ? number[]
    : FringeClubRuntimeAuditSnapshot[K];
};

/** Explicit, fixture-owned counters; this object never owns Three.js resources. */
export class FringeClubRuntimeAudit {
  private state: MutableAuditSnapshot = {
    requestsStarted: 0,
    completedLoads: 0,
    cancelledLoads: 0,
    failedLoads: 0,
    staleResultsDisposed: 0,
    activeSources: 0,
    activeOwnerLeases: 0,
    activeInstanceLeases: 0,
    liveSourceGeometries: 0,
    liveSourceMaterialTemplates: 0,
    liveSourceTextures: 0,
    liveImageBackings: 0,
    liveInstanceMaterials: 0,
    finalSourceReleases: 0,
    lastAppliedAnisotropy: null,
    lastLoadDurationMs: null,
    loadDurationsMs: [],
  };

  private readonly listeners = new Set<() => void>();

  snapshot(): FringeClubRuntimeAuditSnapshot {
    return Object.freeze({
      ...this.state,
      loadDurationsMs: Object.freeze([...this.state.loadDurationsMs]),
    });
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  requestStarted(): void {
    this.update((state) => {
      state.requestsStarted += 1;
    });
  }

  requestCompleted(durationMs: number): void {
    this.update((state) => {
      state.completedLoads += 1;
      state.lastLoadDurationMs = durationMs;
      state.loadDurationsMs.push(durationMs);
      if (state.loadDurationsMs.length > 8) state.loadDurationsMs.shift();
    });
  }

  requestCancelled(): void {
    this.update((state) => {
      state.cancelledLoads += 1;
    });
  }

  requestFailed(): void {
    this.update((state) => {
      state.failedLoads += 1;
    });
  }

  staleResultDisposed(): void {
    this.update((state) => {
      state.staleResultsDisposed += 1;
    });
  }

  sourceCreated(
    resources: FringeClubResourceCounts,
    appliedAnisotropy: number,
  ): void {
    this.update((state) => {
      state.activeSources += 1;
      state.activeOwnerLeases += 1;
      state.liveSourceGeometries += resources.geometries;
      state.liveSourceMaterialTemplates += resources.materialTemplates;
      state.liveSourceTextures += resources.textures;
      state.liveImageBackings += resources.imageBackings;
      state.lastAppliedAnisotropy = appliedAnisotropy;
    });
  }

  ownerLeaseReleased(): void {
    this.update((state) => {
      state.activeOwnerLeases -= 1;
    });
  }

  instanceLeaseCreated(materials: number): void {
    this.update((state) => {
      state.activeInstanceLeases += 1;
      state.liveInstanceMaterials += materials;
    });
  }

  instanceLeaseReleased(materials: number): void {
    this.update((state) => {
      state.activeInstanceLeases -= 1;
      state.liveInstanceMaterials -= materials;
    });
  }

  sourceFinallyReleased(resources: FringeClubResourceCounts): void {
    this.update((state) => {
      state.activeSources -= 1;
      state.liveSourceGeometries -= resources.geometries;
      state.liveSourceMaterialTemplates -= resources.materialTemplates;
      state.liveSourceTextures -= resources.textures;
      state.liveImageBackings -= resources.imageBackings;
      state.finalSourceReleases += 1;
    });
  }

  private update(change: (state: MutableAuditSnapshot) => void): void {
    change(this.state);
    for (const listener of this.listeners) listener();
  }
}

export type FringeClubInstanceTransform = Readonly<{
  positionMeters?: FringeClubVector3;
  rotationRadians?: FringeClubVector3;
}>;

export type FringeClubInstanceLease = Readonly<{
  root: THREE.Group;
  release: () => void;
}>;

export type FringeClubSourceOwnerLease = Readonly<{
  sourceId: string;
  boundsMeters: FringeClubBoundsMeters;
  appliedAnisotropy: number;
  resourceCounts: FringeClubResourceCounts;
  acquireInstance: (
    instanceId: string,
    transform?: FringeClubInstanceTransform,
  ) => FringeClubInstanceLease;
  release: () => void;
}>;

export type FringeClubAssetRequest = Readonly<{
  sourceOwner: FringeClubSourceOwnerLease;
  instanceId: string;
  transform?: FringeClubInstanceTransform;
}>;

export type FringeClubAssetLoaderDependencies = Readonly<{
  fetchAsset?: typeof fetch;
  parseGlb?: (bytes: ArrayBuffer, path: string) => Promise<GLTF>;
  now?: () => number;
}>;

type SourceResources = {
  scenes: THREE.Group[];
  geometries: Set<THREE.BufferGeometry>;
  materialTemplates: Set<THREE.Material>;
  textures: Set<THREE.Texture>;
  imageBackings: Set<{ close: () => void }>;
  boundsMeters: FringeClubBoundsMeters;
};

type InternalInstanceLease = {
  release: () => void;
};

const instanceLeaseByRoot = new WeakMap<THREE.Group, InternalInstanceLease>();

const countResources = (resources: SourceResources): FringeClubResourceCounts => ({
  geometries: resources.geometries.size,
  materialTemplates: resources.materialTemplates.size,
  textures: resources.textures.size,
  imageBackings: resources.imageBackings.size,
});

const vectorTuple = (vector: THREE.Vector3): FringeClubVector3 =>
  Object.freeze([vector.x, vector.y, vector.z]);

const findMaterialTextures = (
  material: THREE.Material,
  target: Set<THREE.Texture>,
): void => {
  const seen = new WeakSet<object>();
  const visit = (value: unknown): void => {
    if (value instanceof THREE.Texture) {
      target.add(value);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (value === null || typeof value !== "object") return;
    if (seen.has(value)) return;
    seen.add(value);
    Object.values(value).forEach(visit);
  };
  visit(material);
};

const collectImageBackings = (
  textures: Set<THREE.Texture>,
): Set<{ close: () => void }> => {
  const images = new Set<{ close: () => void }>();
  const addImage = (image: unknown): void => {
    if (Array.isArray(image)) {
      image.forEach(addImage);
      return;
    }
    if (
      image !== null &&
      typeof image === "object" &&
      "close" in image &&
      typeof image.close === "function"
    ) {
      images.add(image as { close: () => void });
    }
  };

  textures.forEach((texture) => {
    addImage(texture.image);
    addImage(texture.source.data);
  });
  return images;
};

const collectSourceResources = (gltf: GLTF): SourceResources => {
  const scenes = [...new Set(gltf.scenes.length > 0 ? gltf.scenes : [gltf.scene])];
  if (scenes.length === 0) throw new Error("Fringe Club GLB contains no scene");

  const geometries = new Set<THREE.BufferGeometry>();
  const materialTemplates = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  const bounds = new THREE.Box3();

  scenes.forEach((scene) => {
    bounds.expandByObject(scene);
    scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      geometries.add(object.geometry);
      const materials = Array.isArray(object.material)
        ? object.material
        : [object.material];
      materials.forEach((material) => {
        materialTemplates.add(material);
        findMaterialTextures(material, textures);
      });
    });
  });

  if (bounds.isEmpty()) throw new Error("Fringe Club GLB has empty scene bounds");
  const min = bounds.min.clone();
  const max = bounds.max.clone();
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const boundsMeters = Object.freeze({
    min: vectorTuple(min),
    max: vectorTuple(max),
    center: vectorTuple(center),
    size: vectorTuple(size),
  });

  return {
    scenes,
    geometries,
    materialTemplates,
    textures,
    imageBackings: collectImageBackings(textures),
    boundsMeters,
  };
};

const disposeSourceResources = (resources: SourceResources): void => {
  resources.geometries.forEach((geometry) => geometry.dispose());
  resources.materialTemplates.forEach((material) => material.dispose());
  resources.textures.forEach((texture) => texture.dispose());
  resources.imageBackings.forEach((image) => image.close());
  resources.scenes.forEach((scene) => scene.clear());
  resources.geometries.clear();
  resources.materialTemplates.clear();
  resources.textures.clear();
  resources.imageBackings.clear();
  resources.scenes.length = 0;
};

const configureSourceTextures = (
  textures: Set<THREE.Texture>,
  rendererMaxAnisotropy: number,
): number => {
  const safeMaximum = Number.isFinite(rendererMaxAnisotropy)
    ? Math.max(1, Math.floor(rendererMaxAnisotropy))
    : 1;
  const anisotropy = Math.min(FRINGE_CLUB_REQUESTED_ANISOTROPY, safeMaximum);
  textures.forEach((texture) => {
    texture.anisotropy = anisotropy;
  });
  return anisotropy;
};

class FringeClubSourceAsset {
  readonly sourceId = `fringe-club-source-${THREE.MathUtils.generateUUID()}`;
  readonly boundsMeters: FringeClubBoundsMeters;
  readonly resourceCounts: FringeClubResourceCounts;

  private sourceLeaseCount = 1;
  private ownerReleased = false;
  private disposed = false;
  private readonly resources: SourceResources;
  private readonly defaultScene: THREE.Group;
  private readonly audit: FringeClubRuntimeAudit;

  constructor(
    defaultScene: THREE.Group,
    resources: SourceResources,
    audit: FringeClubRuntimeAudit,
    appliedAnisotropy: number,
  ) {
    this.defaultScene = defaultScene;
    this.audit = audit;
    this.resources = resources;
    this.boundsMeters = resources.boundsMeters;
    this.resourceCounts = countResources(resources);
    audit.sourceCreated(this.resourceCounts, appliedAnisotropy);
  }

  acquireInstance(
    instanceId: string,
    transform: FringeClubInstanceTransform = {},
  ): FringeClubInstanceLease {
    if (this.ownerReleased || this.disposed) {
      throw new Error("Fringe Club SourceAsset owner lease is no longer active");
    }

    const clonedMaterials = new Set<THREE.Material>();
    const materialClones = new Map<THREE.Material, THREE.Material>();
    const model = this.defaultScene.clone(true);

    try {
      model.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        const cloneMaterial = (source: THREE.Material): THREE.Material => {
          const existing = materialClones.get(source);
          if (existing) return existing;
          const clone = source.clone();
          materialClones.set(source, clone);
          clonedMaterials.add(clone);
          return clone;
        };
        object.material = Array.isArray(object.material)
          ? object.material.map(cloneMaterial)
          : cloneMaterial(object.material);
        object.userData.fringeClubSourceId = this.sourceId;
        object.userData.fringeClubInstanceId = instanceId;
      });
    } catch (error) {
      clonedMaterials.forEach((material) => material.dispose());
      model.clear();
      throw error;
    }

    const root = new THREE.Group();
    root.name = FRINGE_CLUB_RUNTIME_SUBJECT_NAME;
    root.position.set(...(transform.positionMeters ?? [0, 0, 0]));
    root.rotation.set(...(transform.rotationRadians ?? [0, 0, 0]));
    root.scale.setScalar(1);
    root.userData.fringeClubSourceId = this.sourceId;
    root.userData.fringeClubInstanceId = instanceId;
    root.userData.fringeClubResourceAuthority = "visual-subject-only";
    root.add(model);

    this.sourceLeaseCount += 1;
    this.audit.instanceLeaseCreated(clonedMaterials.size);
    let released = false;
    const lease: InternalInstanceLease = {
      release: () => {
        if (released) return;
        released = true;
        root.removeFromParent();
        root.clear();
        clonedMaterials.forEach((material) => material.dispose());
        this.audit.instanceLeaseReleased(clonedMaterials.size);
        this.releaseSourceLease();
      },
    };
    instanceLeaseByRoot.set(root, lease);
    return Object.freeze({ root, release: lease.release });
  }

  releaseOwner(): void {
    if (this.ownerReleased) return;
    this.ownerReleased = true;
    this.audit.ownerLeaseReleased();
    this.releaseSourceLease();
  }

  private releaseSourceLease(): void {
    this.sourceLeaseCount -= 1;
    if (this.sourceLeaseCount !== 0 || this.disposed) return;
    this.disposed = true;
    disposeSourceResources(this.resources);
    this.audit.sourceFinallyReleased(this.resourceCounts);
  }
}

const createSourceOwnerLease = (
  gltf: GLTF,
  rendererMaxAnisotropy: number,
  audit: FringeClubRuntimeAudit,
): FringeClubSourceOwnerLease => {
  const resources = collectSourceResources(gltf);
  let appliedAnisotropy: number;
  try {
    appliedAnisotropy = configureSourceTextures(
      resources.textures,
      rendererMaxAnisotropy,
    );
  } catch (error) {
    disposeSourceResources(resources);
    throw error;
  }

  const source = new FringeClubSourceAsset(
    gltf.scene,
    resources,
    audit,
    appliedAnisotropy,
  );
  let released = false;
  return Object.freeze({
    sourceId: source.sourceId,
    boundsMeters: source.boundsMeters,
    appliedAnisotropy,
    resourceCounts: source.resourceCounts,
    acquireInstance: (instanceId, transform) => {
      if (released) {
        throw new Error("Fringe Club SourceAsset owner lease is no longer active");
      }
      return source.acquireInstance(instanceId, transform);
    },
    release: () => {
      if (released) return;
      released = true;
      source.releaseOwner();
    },
  });
};

export const createFringeClubRegisteredGroup = (
  request: FringeClubAssetRequest,
): THREE.Group => {
  const lease = request.sourceOwner.acquireInstance(
    request.instanceId,
    request.transform,
  );
  return lease.root;
};

export const disposeFringeClubRegisteredGroup = (group: THREE.Group): void => {
  const lease = instanceLeaseByRoot.get(group);
  if (!lease) return;
  instanceLeaseByRoot.delete(group);
  lease.release();
  group.userData.resourcesDisposed = true;
};

export type FringeClubLoadHandle = Readonly<{
  generation: number;
  ready: Promise<FringeClubSourceOwnerLease | null>;
  cancel: () => void;
  isCurrent: () => boolean;
}>;

/**
 * A request-scoped loader. Network reads can abort; a late GLTF parse is
 * generation-checked and its complete SourceAsset is immediately released.
 */
export class FringeClubSourceAssetLoader {
  private generation = 0;
  private activeController: AbortController | null = null;

  private readonly fetchAsset: typeof fetch;
  private readonly parseGlb: (bytes: ArrayBuffer, path: string) => Promise<GLTF>;
  private readonly now: () => number;
  private readonly audit: FringeClubRuntimeAudit;

  constructor(
    audit: FringeClubRuntimeAudit,
    dependencies: FringeClubAssetLoaderDependencies = {},
  ) {
    this.audit = audit;
    this.fetchAsset =
      dependencies.fetchAsset ?? ((input, init) => fetch(input, init));
    this.parseGlb =
      dependencies.parseGlb ??
      ((bytes, path) => new GLTFLoader().parseAsync(bytes, path));
    this.now = dependencies.now ?? (() => performance.now());
  }

  start(rendererMaxAnisotropy: number): FringeClubLoadHandle {
    this.activeController?.abort();
    const generation = ++this.generation;
    const controller = new AbortController();
    this.activeController = controller;
    const startedAt = this.now();
    let settled = false;
    this.audit.requestStarted();

    const finishCancelled = (): void => {
      if (settled) return;
      settled = true;
      this.audit.requestCancelled();
    };

    const ready = (async (): Promise<FringeClubSourceOwnerLease | null> => {
      try {
        const response = await this.fetchAsset(FRINGE_CLUB_ASSET_URL, {
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(
            `Fringe Club GLB request failed (${response.status} ${response.statusText})`,
          );
        }
        const bytes = await response.arrayBuffer();
        if (controller.signal.aborted || generation !== this.generation) {
          finishCancelled();
          return null;
        }

        const gltf = await this.parseGlb(bytes, "");
        const sourceOwner = createSourceOwnerLease(
          gltf,
          rendererMaxAnisotropy,
          this.audit,
        );
        if (controller.signal.aborted || generation !== this.generation) {
          sourceOwner.release();
          this.audit.staleResultDisposed();
          finishCancelled();
          return null;
        }

        settled = true;
        this.audit.requestCompleted(Math.max(0, this.now() - startedAt));
        return sourceOwner;
      } catch (error) {
        if (controller.signal.aborted || generation !== this.generation) {
          finishCancelled();
          return null;
        }
        settled = true;
        this.audit.requestFailed();
        throw error;
      } finally {
        if (this.activeController === controller) this.activeController = null;
      }
    })();

    return Object.freeze({
      generation,
      ready,
      cancel: () => {
        if (generation !== this.generation) return;
        this.generation += 1;
        controller.abort();
        finishCancelled();
      },
      isCurrent: () => generation === this.generation,
    });
  }
}
