import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/addons/loaders/GLTFLoader.js";
import { publicAssetUrl } from "../../utils/publicAssetUrl";

export type FringeRuntimeCandidate = "stage2h" | "stage2n-a";

export const DEFAULT_FRINGE_RUNTIME_CANDIDATE: FringeRuntimeCandidate = "stage2h";
export const FRINGE_CLUB_CANDIDATE_ASSET_URLS: Readonly<
  Record<FringeRuntimeCandidate, string>
> = Object.freeze({
  stage2h: publicAssetUrl(
    "assets/generated/fringe-club/stage-2h/preferred-runtime-candidate.glb",
  ),
  "stage2n-a": publicAssetUrl(
    "assets/generated/fringe-club/development/stage-2n-a-candidate.glb",
  ),
});
export const getFringeClubCandidateAssetUrl = (
  candidateId: FringeRuntimeCandidate,
): string => FRINGE_CLUB_CANDIDATE_ASSET_URLS[candidateId];
/** Backwards-compatible Stage 2H authority URL. */
export const FRINGE_CLUB_ASSET_URL =
  FRINGE_CLUB_CANDIDATE_ASSET_URLS[DEFAULT_FRINGE_RUNTIME_CANDIDATE];
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
  lastFetchDurationMs: number | null;
  lastParseDurationMs: number | null;
  loadDurationsMs: readonly number[];
  fetchDurationsMs: readonly number[];
  parseDurationsMs: readonly number[];
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
    lastFetchDurationMs: null,
    lastParseDurationMs: null,
    loadDurationsMs: [],
    fetchDurationsMs: [],
    parseDurationsMs: [],
  };

  private readonly listeners = new Set<() => void>();

  private readonly candidateStates: Record<FringeRuntimeCandidate, MutableAuditSnapshot> = {
    stage2h: this.createEmptySnapshot(),
    "stage2n-a": this.createEmptySnapshot(),
  };

  private createEmptySnapshot(): MutableAuditSnapshot {
    return {
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
      lastFetchDurationMs: null,
      lastParseDurationMs: null,
      loadDurationsMs: [],
      fetchDurationsMs: [],
      parseDurationsMs: [],
    };
  }

  snapshot(): FringeClubRuntimeAuditSnapshot {
    return this.freezeSnapshot(this.state);
  }

  snapshotForCandidate(candidateId: FringeRuntimeCandidate): FringeClubRuntimeAuditSnapshot {
    return this.freezeSnapshot(this.candidateStates[candidateId]);
  }

  private freezeSnapshot(state: MutableAuditSnapshot): FringeClubRuntimeAuditSnapshot {
    return Object.freeze({
      ...state,
      loadDurationsMs: Object.freeze([...state.loadDurationsMs]),
      fetchDurationsMs: Object.freeze([...state.fetchDurationsMs]),
      parseDurationsMs: Object.freeze([...state.parseDurationsMs]),
    });
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  requestStarted(candidateId: FringeRuntimeCandidate): void {
    this.updateForCandidate(candidateId, (state) => {
      state.requestsStarted += 1;
    });
  }

  requestCompleted(
    candidateId: FringeRuntimeCandidate,
    totalDurationMs: number,
    fetchDurationMs: number,
    parseDurationMs: number,
  ): void {
    this.updateForCandidate(candidateId, (state) => {
      state.completedLoads += 1;
      state.lastLoadDurationMs = totalDurationMs;
      state.lastFetchDurationMs = fetchDurationMs;
      state.lastParseDurationMs = parseDurationMs;
      state.loadDurationsMs.push(totalDurationMs);
      state.fetchDurationsMs.push(fetchDurationMs);
      state.parseDurationsMs.push(parseDurationMs);
      if (state.loadDurationsMs.length > 8) state.loadDurationsMs.shift();
      if (state.fetchDurationsMs.length > 8) state.fetchDurationsMs.shift();
      if (state.parseDurationsMs.length > 8) state.parseDurationsMs.shift();
    });
  }

  requestCancelled(candidateId: FringeRuntimeCandidate): void {
    this.updateForCandidate(candidateId, (state) => {
      state.cancelledLoads += 1;
    });
  }

  requestFailed(candidateId: FringeRuntimeCandidate): void {
    this.updateForCandidate(candidateId, (state) => {
      state.failedLoads += 1;
    });
  }

  staleResultDisposed(candidateId: FringeRuntimeCandidate): void {
    this.updateForCandidate(candidateId, (state) => {
      state.staleResultsDisposed += 1;
    });
  }

  sourceCreated(
    candidateId: FringeRuntimeCandidate,
    resources: FringeClubResourceCounts,
    appliedAnisotropy: number,
  ): void {
    this.updateForCandidate(candidateId, (state) => {
      state.activeSources += 1;
      state.activeOwnerLeases += 1;
      state.liveSourceGeometries += resources.geometries;
      state.liveSourceMaterialTemplates += resources.materialTemplates;
      state.liveSourceTextures += resources.textures;
      state.liveImageBackings += resources.imageBackings;
      state.lastAppliedAnisotropy = appliedAnisotropy;
    });
  }

  ownerLeaseReleased(candidateId: FringeRuntimeCandidate): void {
    this.updateForCandidate(candidateId, (state) => {
      state.activeOwnerLeases -= 1;
    });
  }

  instanceLeaseCreated(candidateId: FringeRuntimeCandidate, materials: number): void {
    this.updateForCandidate(candidateId, (state) => {
      state.activeInstanceLeases += 1;
      state.liveInstanceMaterials += materials;
    });
  }

  instanceLeaseReleased(candidateId: FringeRuntimeCandidate, materials: number): void {
    this.updateForCandidate(candidateId, (state) => {
      state.activeInstanceLeases -= 1;
      state.liveInstanceMaterials -= materials;
    });
  }

  sourceFinallyReleased(
    candidateId: FringeRuntimeCandidate,
    resources: FringeClubResourceCounts,
  ): void {
    this.updateForCandidate(candidateId, (state) => {
      state.activeSources -= 1;
      state.liveSourceGeometries -= resources.geometries;
      state.liveSourceMaterialTemplates -= resources.materialTemplates;
      state.liveSourceTextures -= resources.textures;
      state.liveImageBackings -= resources.imageBackings;
      state.finalSourceReleases += 1;
    });
  }

  private updateForCandidate(
    candidateId: FringeRuntimeCandidate,
    change: (state: MutableAuditSnapshot) => void,
  ): void {
    change(this.state);
    change(this.candidateStates[candidateId]);
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
  readonly candidateId: FringeRuntimeCandidate;
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
  readonly candidateId: FringeRuntimeCandidate;

  constructor(
    defaultScene: THREE.Group,
    resources: SourceResources,
    audit: FringeClubRuntimeAudit,
    candidateId: FringeRuntimeCandidate,
    appliedAnisotropy: number,
  ) {
    this.defaultScene = defaultScene;
    this.audit = audit;
    this.resources = resources;
    this.candidateId = candidateId;
    this.boundsMeters = resources.boundsMeters;
    this.resourceCounts = countResources(resources);
    audit.sourceCreated(candidateId, this.resourceCounts, appliedAnisotropy);
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
        object.userData.fringeClubCandidateId = this.candidateId;
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
    root.userData.fringeClubCandidateId = this.candidateId;
    root.userData.fringeClubInstanceId = instanceId;
    root.userData.fringeClubResourceAuthority = "visual-subject-only";
    root.add(model);

    this.sourceLeaseCount += 1;
    this.audit.instanceLeaseCreated(this.candidateId, clonedMaterials.size);
    let released = false;
    const lease: InternalInstanceLease = {
      release: () => {
        if (released) return;
        released = true;
        root.removeFromParent();
        root.clear();
        clonedMaterials.forEach((material) => material.dispose());
        this.audit.instanceLeaseReleased(this.candidateId, clonedMaterials.size);
        this.releaseSourceLease();
      },
    };
    instanceLeaseByRoot.set(root, lease);
    return Object.freeze({ root, release: lease.release });
  }

  releaseOwner(): void {
    if (this.ownerReleased) return;
    this.ownerReleased = true;
    this.audit.ownerLeaseReleased(this.candidateId);
    this.releaseSourceLease();
  }

  private releaseSourceLease(): void {
    this.sourceLeaseCount -= 1;
    if (this.sourceLeaseCount !== 0 || this.disposed) return;
    this.disposed = true;
    disposeSourceResources(this.resources);
    this.audit.sourceFinallyReleased(this.candidateId, this.resourceCounts);
  }
}

const createSourceOwnerLease = (
  gltf: GLTF,
  rendererMaxAnisotropy: number,
  audit: FringeClubRuntimeAudit,
  candidateId: FringeRuntimeCandidate,
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
    candidateId,
    appliedAnisotropy,
  );
  let released = false;
  return Object.freeze({
    sourceId: source.sourceId,
    boundsMeters: source.boundsMeters,
    appliedAnisotropy,
    resourceCounts: source.resourceCounts,
    candidateId,
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

  start(
    rendererMaxAnisotropy: number,
    candidateId: FringeRuntimeCandidate = DEFAULT_FRINGE_RUNTIME_CANDIDATE,
  ): FringeClubLoadHandle {
    this.activeController?.abort();
    const generation = ++this.generation;
    const controller = new AbortController();
    this.activeController = controller;
    const startedAt = this.now();
    let fetchDurationMs = 0;
    let parseDurationMs = 0;
    let settled = false;
    this.audit.requestStarted(candidateId);

    const finishCancelled = (): void => {
      if (settled) return;
      settled = true;
      this.audit.requestCancelled(candidateId);
    };

    const ready = (async (): Promise<FringeClubSourceOwnerLease | null> => {
      try {
        const response = await this.fetchAsset(
          getFringeClubCandidateAssetUrl(candidateId),
          { signal: controller.signal },
        );
        if (!response.ok) {
          throw new Error(
            `Fringe Club GLB request failed (${response.status} ${response.statusText})`,
          );
        }
        const bytes = await response.arrayBuffer();
        const fetchedAt = this.now();
        fetchDurationMs = Math.max(0, fetchedAt - startedAt);
        if (controller.signal.aborted || generation !== this.generation) {
          finishCancelled();
          return null;
        }

        const parseStartedAt = this.now();
        const gltf = await this.parseGlb(bytes, "");
        const parsedAt = this.now();
        parseDurationMs = Math.max(0, parsedAt - parseStartedAt);
        const sourceOwner = createSourceOwnerLease(
          gltf,
          rendererMaxAnisotropy,
          this.audit,
          candidateId,
        );
        if (controller.signal.aborted || generation !== this.generation) {
          sourceOwner.release();
          this.audit.staleResultDisposed(candidateId);
          finishCancelled();
          return null;
        }

        settled = true;
        this.audit.requestCompleted(
          candidateId,
          Math.max(0, this.now() - startedAt),
          fetchDurationMs,
          parseDurationMs,
        );
        return sourceOwner;
      } catch (error) {
        if (controller.signal.aborted || generation !== this.generation) {
          finishCancelled();
          return null;
        }
        settled = true;
        this.audit.requestFailed(candidateId);
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
