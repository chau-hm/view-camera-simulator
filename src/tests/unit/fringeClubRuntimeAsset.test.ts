import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import * as THREE from "three";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import { describe, expect, it, vi } from "vitest";
import {
  FRINGE_CLUB_RUNTIME_ASSET_KEY,
  FRINGE_CLUB_RUNTIME_IMPLEMENTATION_ID,
  createRegisteredSceneAsset,
  disposeRegisteredSceneAsset,
  resolveSceneAsset,
} from "../../render/assets/sceneAssetRegistry";
import {
  DEFAULT_FRINGE_RUNTIME_CANDIDATE,
  FRINGE_CLUB_ASSET_URL,
  FRINGE_CLUB_CANDIDATE_ASSET_URLS,
  FringeClubRuntimeAudit,
  FringeClubSourceAssetLoader,
  disposeFringeClubRegisteredGroup,
  getFringeClubCandidateAssetUrl,
} from "../../render/assets/FringeClubRuntimeAsset";

const makeGltf = () => {
  const imageBacking = { close: vi.fn() };
  const texture = new THREE.Texture(imageBacking as unknown as TexImageSource);
  const geometry = new THREE.BoxGeometry(2, 3, 4);
  const material = new THREE.MeshStandardMaterial({ map: texture });
  const scene = new THREE.Group();
  scene.add(new THREE.Mesh(geometry, material));
  const gltf = { scene, scenes: [scene] } as unknown as GLTF;
  return { gltf, scene, geometry, material, texture, imageBacking };
};

const okResponse = (): Response =>
  ({
    ok: true,
    status: 200,
    statusText: "OK",
    arrayBuffer: async () => new ArrayBuffer(16),
  }) as Response;

const waitForParse = async (parseGlb: ReturnType<typeof vi.fn>) => {
  for (let attempt = 0; attempt < 10 && parseGlb.mock.calls.length === 0; attempt += 1) {
    await Promise.resolve();
  }
  expect(parseGlb).toHaveBeenCalledTimes(1);
};

describe("Fringe Club runtime asset", () => {

  it("preserves the exact self-contained Stage 2N-A candidate bytes and provenance", () => {
    const assetPath =
      "public/assets/generated/fringe-club/development/stage-2n-a-candidate.glb";
    const manifestPath =
      "public/assets/generated/fringe-club/development/stage-2n-a-candidate.manifest.json";
    const bytes = readFileSync(assetPath);
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
      candidateId: string;
      status: string;
      sha256: string;
      units: string;
      up: string;
      rootTransform: string;
    };
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(
      "7a505f6c2d25ecb93943a6770356cdaffa529c3b86324a4da9ee819984eb9301",
    );
    expect(manifest).toMatchObject({
      candidateId: "stage2n-a",
      status: "CANDIDATE_RUNTIME_AUTHORITY",
      sha256: "7a505f6c2d25ecb93943a6770356cdaffa529c3b86324a4da9ee819984eb9301",
      units: "metres",
      up: "+Y",
      rootTransform: "identity",
      selfContained: true,
      embeddedCameras: 0,
      embeddedLights: 0,
    });

    expect(bytes.toString("ascii", 0, 4)).toBe("glTF");
    const jsonLength = bytes.readUInt32LE(12);
    const gltf = JSON.parse(bytes.toString("utf8", 20, 20 + jsonLength).trim()) as {
      buffers?: Array<{ uri?: string }>;
      images?: Array<{ uri?: string }>;
      cameras?: unknown[];
      nodes?: Array<{ extensions?: Record<string, unknown> }>;
    };
    expect(gltf.buffers?.every((buffer) => buffer.uri === undefined)).toBe(true);
    expect(gltf.images?.every((image) => image.uri === undefined)).toBe(true);
    expect(gltf.cameras ?? []).toHaveLength(0);
    expect(gltf.nodes?.some((node) => "KHR_lights_punctual" in (node.extensions ?? {}))).toBe(false);
  });

  it("bridges an asynchronously loaded SourceAsset into the synchronous registered factory", async () => {
    const asset = makeGltf();
    const audit = new FringeClubRuntimeAudit();
    const loader = new FringeClubSourceAssetLoader(audit, {
      fetchAsset: vi.fn(async () => okResponse()),
      parseGlb: vi.fn(async () => asset.gltf),
      now: vi.fn()
        .mockReturnValueOnce(10)
        .mockReturnValueOnce(13)
        .mockReturnValueOnce(15)
        .mockReturnValueOnce(17)
        .mockReturnValueOnce(18),
    });

    const registration = resolveSceneAsset(FRINGE_CLUB_RUNTIME_ASSET_KEY);
    expect(registration.implementationId).toBe(FRINGE_CLUB_RUNTIME_IMPLEMENTATION_ID);
    expect(registration.renderResourceLifetime).toBe("instance-owned");

    expect(DEFAULT_FRINGE_RUNTIME_CANDIDATE).toBe("stage2h");
    expect(FRINGE_CLUB_CANDIDATE_ASSET_URLS.stage2h).toBe(FRINGE_CLUB_ASSET_URL);
    expect(getFringeClubCandidateAssetUrl("stage2n-a")).toContain(
      "assets/generated/fringe-club/development/stage-2n-a-candidate.glb",
    );

    const handle = loader.start(2);
    const sourceOwner = await handle.ready;
    expect(sourceOwner).not.toBeNull();
    if (!sourceOwner) throw new Error("Expected a ready Fringe Club source owner");
    expect(handle.isCurrent()).toBe(true);
    expect(sourceOwner.appliedAnisotropy).toBe(2);
    expect(asset.texture.anisotropy).toBe(2);
    expect(audit.snapshot()).toMatchObject({
      completedLoads: 1,
      activeSources: 1,
      activeOwnerLeases: 1,
      activeInstanceLeases: 0,
      lastLoadDurationMs: 8,
      lastFetchDurationMs: 3,
      lastParseDurationMs: 2,
    });
    expect(sourceOwner.candidateId).toBe("stage2h");
    expect(audit.snapshotForCandidate("stage2h").completedLoads).toBe(1);
    expect(audit.snapshotForCandidate("stage2n-a").completedLoads).toBe(0);

    const root = createRegisteredSceneAsset(FRINGE_CLUB_RUNTIME_ASSET_KEY, {
      sourceOwner,
      instanceId: "A",
    });
    expect(root).toBeInstanceOf(THREE.Group);
    expect(root.userData.assetImplementationId).toBe(
      FRINGE_CLUB_RUNTIME_IMPLEMENTATION_ID,
    );
    expect(root.name).toBe("fringe-club-runtime-subject");
    expect(audit.snapshot().activeInstanceLeases).toBe(1);

    disposeRegisteredSceneAsset(FRINGE_CLUB_RUNTIME_ASSET_KEY, root);
    disposeRegisteredSceneAsset(FRINGE_CLUB_RUNTIME_ASSET_KEY, root);
    sourceOwner.release();
    sourceOwner.release();
    expect(root.userData.resourcesDisposed).toBe(true);
    expect(audit.snapshot()).toMatchObject({
      activeSources: 0,
      activeOwnerLeases: 0,
      activeInstanceLeases: 0,
      liveSourceGeometries: 0,
      liveSourceMaterialTemplates: 0,
      liveSourceTextures: 0,
      liveImageBackings: 0,
      liveInstanceMaterials: 0,
      finalSourceReleases: 1,
    });
  });

  it("keeps shared source resources alive until the final instance lease releases", async () => {
    const asset = makeGltf();
    const geometryDispose = vi.spyOn(asset.geometry, "dispose");
    const templateDispose = vi.spyOn(asset.material, "dispose");
    const textureDispose = vi.spyOn(asset.texture, "dispose");
    const audit = new FringeClubRuntimeAudit();
    const loader = new FringeClubSourceAssetLoader(audit, {
      fetchAsset: vi.fn(async () => okResponse()),
      parseGlb: vi.fn(async () => asset.gltf),
    });
    const sourceOwner = await loader.start(16).ready;
    if (!sourceOwner) throw new Error("Expected a ready Fringe Club source owner");

    const groupA = createRegisteredSceneAsset(FRINGE_CLUB_RUNTIME_ASSET_KEY, {
      sourceOwner,
      instanceId: "A",
    });
    const groupB = createRegisteredSceneAsset(FRINGE_CLUB_RUNTIME_ASSET_KEY, {
      sourceOwner,
      instanceId: "B",
    });
    const meshA = groupA.getObjectByProperty("type", "Mesh") as THREE.Mesh;
    const meshB = groupB.getObjectByProperty("type", "Mesh") as THREE.Mesh;
    const materialA = meshA.material as THREE.MeshStandardMaterial;
    const materialB = meshB.material as THREE.MeshStandardMaterial;
    const materialADispose = vi.spyOn(materialA, "dispose");
    const materialBDispose = vi.spyOn(materialB, "dispose");

    expect(meshA.geometry).toBe(asset.geometry);
    expect(meshB.geometry).toBe(asset.geometry);
    expect(materialA).not.toBe(materialB);
    expect(materialA.map).toBe(asset.texture);
    expect(materialB.map).toBe(asset.texture);
    expect(audit.snapshot().activeInstanceLeases).toBe(2);

    sourceOwner.release();
    expect(audit.snapshot()).toMatchObject({
      activeOwnerLeases: 0,
      activeInstanceLeases: 2,
      activeSources: 1,
    });
    expect(() =>
      sourceOwner.acquireInstance("late"),
    ).toThrow("Fringe Club SourceAsset owner lease is no longer active");

    disposeFringeClubRegisteredGroup(groupA);
    expect(groupB.children).toHaveLength(1);
    expect(meshB.geometry).toBe(asset.geometry);
    expect(materialB.map).toBe(asset.texture);
    expect(materialADispose).toHaveBeenCalledTimes(1);
    expect(materialBDispose).not.toHaveBeenCalled();
    expect(geometryDispose).not.toHaveBeenCalled();
    expect(templateDispose).not.toHaveBeenCalled();
    expect(textureDispose).not.toHaveBeenCalled();
    expect(asset.imageBacking.close).not.toHaveBeenCalled();

    disposeFringeClubRegisteredGroup(groupB);
    disposeFringeClubRegisteredGroup(groupB);
    expect(materialBDispose).toHaveBeenCalledTimes(1);
    expect(geometryDispose).toHaveBeenCalledTimes(1);
    expect(templateDispose).toHaveBeenCalledTimes(1);
    expect(textureDispose).toHaveBeenCalledTimes(1);
    expect(asset.imageBacking.close).toHaveBeenCalledTimes(1);
    expect(audit.snapshot()).toMatchObject({
      activeSources: 0,
      activeInstanceLeases: 0,
      liveSourceGeometries: 0,
      liveSourceTextures: 0,
      liveImageBackings: 0,
      liveInstanceMaterials: 0,
      finalSourceReleases: 1,
    });
  });

  it("aborts a pending fetch and never invokes the parser", async () => {
    const parseGlb = vi.fn(async () => makeGltf().gltf);
    const fetchAsset: typeof fetch = vi.fn(
      (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener(
            "abort",
            () => reject(new DOMException("Aborted", "AbortError")),
            { once: true },
          );
        }),
    );
    const audit = new FringeClubRuntimeAudit();
    const loader = new FringeClubSourceAssetLoader(audit, { fetchAsset, parseGlb });
    const handle = loader.start(4);
    handle.cancel();

    await expect(handle.ready).resolves.toBeNull();
    expect(parseGlb).not.toHaveBeenCalled();
    expect(audit.snapshot()).toMatchObject({
      cancelledLoads: 1,
      activeSources: 0,
      liveSourceGeometries: 0,
      liveSourceTextures: 0,
    });
  });

  it("disposes a late parse after the request is superseded and publishes only the current generation", async () => {
    const staleAsset = makeGltf();
    const currentAsset = makeGltf();
    const staleGeometryDispose = vi.spyOn(staleAsset.geometry, "dispose");
    const currentGeometryDispose = vi.spyOn(currentAsset.geometry, "dispose");
    let resolveStale!: (gltf: GLTF) => void;
    let resolveCurrent!: (gltf: GLTF) => void;
    const parseGlb = vi
      .fn<(bytes: ArrayBuffer, path: string) => Promise<GLTF>>()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveStale = resolve;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveCurrent = resolve;
          }),
      );
    const audit = new FringeClubRuntimeAudit();
    const loader = new FringeClubSourceAssetLoader(audit, {
      fetchAsset: vi.fn(async () => okResponse()),
      parseGlb,
    });

    const staleRequest = loader.start(8);
    await waitForParse(parseGlb);
    const currentRequest = loader.start(16);
    for (let attempt = 0; attempt < 10 && parseGlb.mock.calls.length < 2; attempt += 1) {
      await Promise.resolve();
    }
    expect(parseGlb).toHaveBeenCalledTimes(2);

    resolveStale(staleAsset.gltf);
    await expect(staleRequest.ready).resolves.toBeNull();
    expect(staleGeometryDispose).toHaveBeenCalledTimes(1);
    expect(audit.snapshot()).toMatchObject({
      staleResultsDisposed: 1,
      activeSources: 0,
      activeInstanceLeases: 0,
    });

    resolveCurrent(currentAsset.gltf);
    const currentOwner = await currentRequest.ready;
    expect(currentOwner).not.toBeNull();
    if (!currentOwner) throw new Error("Expected the current generation to load");
    expect(currentRequest.isCurrent()).toBe(true);
    expect(currentOwner.appliedAnisotropy).toBe(4);
    expect(currentGeometryDispose).not.toHaveBeenCalled();
    currentOwner.release();
    expect(currentGeometryDispose).toHaveBeenCalledTimes(1);
  });


  it("loads each typed candidate through its own URL and candidate-scoped lifecycle", async () => {
    const hAsset = makeGltf();
    const nAsset = makeGltf();
    const parsed = [hAsset.gltf, nAsset.gltf];
    const fetchAsset = vi.fn<typeof fetch>(async () => okResponse());
    const parseGlb = vi.fn(async () => parsed.shift()!);
    const audit = new FringeClubRuntimeAudit();
    const loader = new FringeClubSourceAssetLoader(audit, { fetchAsset, parseGlb });

    const hOwner = await loader.start(8, "stage2h").ready;
    if (!hOwner) throw new Error("Expected Stage 2H source owner");
    expect(hOwner.candidateId).toBe("stage2h");
    expect(hOwner.sourceId).not.toBe("");
    hOwner.release();

    const nOwner = await loader.start(8, "stage2n-a").ready;
    if (!nOwner) throw new Error("Expected Stage 2N-A source owner");
    expect(nOwner.candidateId).toBe("stage2n-a");
    expect(nOwner.sourceId).not.toBe(hOwner.sourceId);
    expect(fetchAsset.mock.calls.map(([url]) => url)).toEqual([
      FRINGE_CLUB_CANDIDATE_ASSET_URLS.stage2h,
      FRINGE_CLUB_CANDIDATE_ASSET_URLS["stage2n-a"],
    ]);
    expect(audit.snapshotForCandidate("stage2h")).toMatchObject({
      completedLoads: 1,
      activeSources: 0,
      finalSourceReleases: 1,
    });
    expect(audit.snapshotForCandidate("stage2n-a")).toMatchObject({
      completedLoads: 1,
      activeSources: 1,
      activeOwnerLeases: 1,
    });
    nOwner.release();
  });

  it("disposes a stale Stage 2H parse when Stage 2N-A becomes the selected generation", async () => {
    const staleAsset = makeGltf();
    const currentAsset = makeGltf();
    const staleGeometryDispose = vi.spyOn(staleAsset.geometry, "dispose");
    let resolveStale!: (gltf: GLTF) => void;
    const parseGlb = vi
      .fn<(bytes: ArrayBuffer, path: string) => Promise<GLTF>>()
      .mockImplementationOnce(
        () => new Promise((resolve) => { resolveStale = resolve; }),
      )
      .mockImplementationOnce(async () => currentAsset.gltf);
    const audit = new FringeClubRuntimeAudit();
    const loader = new FringeClubSourceAssetLoader(audit, {
      fetchAsset: vi.fn(async () => okResponse()),
      parseGlb,
    });

    const hRequest = loader.start(8, "stage2h");
    await waitForParse(parseGlb);
    const nRequest = loader.start(8, "stage2n-a");
    for (let attempt = 0; attempt < 10 && parseGlb.mock.calls.length < 2; attempt += 1) {
      await Promise.resolve();
    }
    expect(parseGlb).toHaveBeenCalledTimes(2);
    resolveStale(staleAsset.gltf);
    await expect(hRequest.ready).resolves.toBeNull();
    expect(staleGeometryDispose).toHaveBeenCalledTimes(1);
    const nOwner = await nRequest.ready;
    expect(nOwner?.candidateId).toBe("stage2n-a");
    expect(nRequest.isCurrent()).toBe(true);
    expect(audit.snapshotForCandidate("stage2h")).toMatchObject({
      staleResultsDisposed: 1,
      activeSources: 0,
    });
    expect(audit.snapshotForCandidate("stage2n-a")).toMatchObject({
      staleResultsDisposed: 0,
      activeSources: 1,
    });
    nOwner?.release();
  });

  it("cleans up failed HTTP loads without publishing a source", async () => {
    const parseGlb = vi.fn(async () => makeGltf().gltf);
    const fetchAsset = vi.fn(
      async () =>
        ({
          ok: false,
          status: 404,
          statusText: "Not Found",
        }) as Response,
    );
    const audit = new FringeClubRuntimeAudit();
    const loader = new FringeClubSourceAssetLoader(audit, {
      fetchAsset,
      parseGlb,
    });

    await expect(loader.start(16).ready).rejects.toThrow(
      "Fringe Club GLB request failed (404 Not Found)",
    );
    expect(parseGlb).not.toHaveBeenCalled();
    expect(audit.snapshot()).toMatchObject({
      failedLoads: 1,
      activeSources: 0,
      activeOwnerLeases: 0,
      activeInstanceLeases: 0,
      liveSourceGeometries: 0,
      liveSourceTextures: 0,
    });
  });
});
