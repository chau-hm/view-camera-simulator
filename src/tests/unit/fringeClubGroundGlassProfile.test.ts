import * as THREE from "three";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import { describe, expect, it, vi } from "vitest";
import {
  FringeClubRuntimeAudit,
  FringeClubSourceAssetLoader,
  type FringeClubSourceOwnerLease,
} from "../../render/assets/FringeClubRuntimeAsset";
import {
  FRINGE_CLUB_RUNTIME_ASSET_KEY,
  createRegisteredSceneAsset,
  disposeRegisteredSceneAsset,
} from "../../render/assets/sceneAssetRegistry";
import { CAMERA_MOVEMENT_BASELINE_PRESENTATION } from "../../scenes/presentation/understandingCameraMovements";
import { architectureRiseScene } from "../../scenes/definitions/architecture-rise";
import {
  createFringeClubGroundGlassDevelopmentProfile,
  type FringeClubGroundGlassSubjectIdentity,
} from "../../app/development/fringeClubGroundGlassProfile";
import type { GroundGlassSceneProfileContext } from "../../render/groundGlassSceneProfiles";

const makeGltf = () => {
  const imageBacking = { close: vi.fn() };
  const texture = new THREE.Texture(imageBacking as unknown as TexImageSource);
  const geometry = new THREE.BoxGeometry(2, 4, 6);
  const material = new THREE.MeshStandardMaterial({ map: texture });
  const disposeGeometry = vi.spyOn(geometry, "dispose");
  const disposeMaterial = vi.spyOn(material, "dispose");
  const disposeTexture = vi.spyOn(texture, "dispose");
  const scene = new THREE.Group();
  scene.add(new THREE.Mesh(geometry, material));
  const gltf = { scene, scenes: [scene] } as unknown as GLTF;
  return {
    gltf,
    geometry,
    material,
    texture,
    imageBacking,
    disposeGeometry,
    disposeMaterial,
    disposeTexture,
  };
};

const loadOwner = async (gltf: GLTF): Promise<{
  owner: FringeClubSourceOwnerLease;
  audit: FringeClubRuntimeAudit;
}> => {
  const audit = new FringeClubRuntimeAudit();
  const loader = new FringeClubSourceAssetLoader(audit, {
    fetchAsset: vi.fn(async () =>
      ({
        ok: true,
        status: 200,
        statusText: "OK",
        arrayBuffer: async () => new ArrayBuffer(16),
      }) as Response,
    ),
    parseGlb: vi.fn(async () => gltf),
  });
  const owner = await loader.start(16).ready;
  if (!owner) throw new Error("Expected a ready SourceAsset owner");
  return { owner, audit };
};

const profileContext: GroundGlassSceneProfileContext = {
  scene: architectureRiseScene,
  cameraMovementPresentation: CAMERA_MOVEMENT_BASELINE_PRESENTATION,
  presentationRegion: "middle",
};

describe("Fringe Club Ground Glass development profile", () => {
  it("uses the registered RTT instance while sharing immutable resources with the Observer lease", async () => {
    const asset = makeGltf();
    const { owner, audit } = await loadOwner(asset.gltf);
    const observerGroup = createRegisteredSceneAsset(FRINGE_CLUB_RUNTIME_ASSET_KEY, {
      sourceOwner: owner,
      instanceId: "observer",
    });
    const identities: Array<FringeClubGroundGlassSubjectIdentity | null> = [];
    const profile = createFringeClubGroundGlassDevelopmentProfile({
      sourceOwner: owner,
      mountSubject: true,
      onSubjectIdentityChange: (identity) => identities.push(identity),
    });
    const rttScene = new THREE.Scene();
    const mounted = profile.mountSubject(rttScene, profileContext);
    if (!mounted) throw new Error("Expected the RTT subject to mount");

    const observerMesh = observerGroup.getObjectByProperty("type", "Mesh") as THREE.Mesh;
    const rttMesh = mounted.group.getObjectByProperty("type", "Mesh") as THREE.Mesh;
    expect(observerMesh.geometry).toBe(asset.geometry);
    expect(rttMesh.geometry).toBe(asset.geometry);
    expect((observerMesh.material as THREE.MeshStandardMaterial).map).toBe(asset.texture);
    expect((rttMesh.material as THREE.MeshStandardMaterial).map).toBe(asset.texture);
    expect(observerMesh.material).not.toBe(rttMesh.material);
    expect(mounted.group.parent).toBe(rttScene);
    expect(mounted.group.userData.fringeClubSourceId).toBe(owner.sourceId);
    expect(mounted.group.userData.fringeClubInstanceId).toBe("ground-glass-rtt");
    expect(audit.snapshot()).toMatchObject({
      activeSources: 1,
      activeOwnerLeases: 1,
      activeInstanceLeases: 2,
      liveSourceGeometries: 1,
      liveSourceTextures: 1,
      liveImageBackings: 1,
      liveInstanceMaterials: 2,
    });

    const target = architectureRiseScene.focusTargets[0].worldPosition;
    const sourceNearZ = owner.boundsMeters.min[2];
    expect(
      (mounted.group.position.z + sourceNearZ) * 1000,
    ).toBeCloseTo(target.z, 6);
    expect(mounted.group.position.x + owner.boundsMeters.center[0]).toBeCloseTo(
      target.x / 1000,
      9,
    );
    expect(mounted.group.position.y + owner.boundsMeters.center[1]).toBeCloseTo(
      target.y / 1000,
      9,
    );

    const renderBounds = profile.resolveRenderBounds(profileContext);
    expect(renderBounds.min.x).toBeLessThanOrEqual(architectureRiseScene.bounds.min.x);
    expect(renderBounds.max.z).toBeGreaterThan(architectureRiseScene.bounds.max.z);
    expect(identities).toHaveLength(1);
    expect(identities[0]).toMatchObject({
      sourceId: owner.sourceId,
      instanceId: "ground-glass-rtt",
      rootId: mounted.group.uuid,
    });

    disposeRegisteredSceneAsset(FRINGE_CLUB_RUNTIME_ASSET_KEY, observerGroup);
    expect(asset.disposeGeometry).not.toHaveBeenCalled();
    expect(asset.disposeTexture).not.toHaveBeenCalled();
    expect(audit.snapshot().activeInstanceLeases).toBe(1);
    expect(mounted.group.parent).toBe(rttScene);

    mounted.dispose();
    mounted.dispose();
    expect(mounted.group.parent).toBeNull();
    expect(mounted.group.userData.resourcesDisposed).toBe(true);
    expect(identities[0]).toMatchObject({
      sourceId: owner.sourceId,
      instanceId: "ground-glass-rtt",
      rootId: mounted.group.uuid,
    });
    expect(identities[1]).toBeNull();
    expect(audit.snapshot()).toMatchObject({
      activeSources: 1,
      activeOwnerLeases: 1,
      activeInstanceLeases: 0,
      liveSourceGeometries: 1,
      liveSourceTextures: 1,
      liveImageBackings: 1,
      liveInstanceMaterials: 0,
    });

    owner.release();
    expect(asset.disposeGeometry).toHaveBeenCalledTimes(1);
    expect(asset.disposeMaterial).toHaveBeenCalledTimes(1);
    expect(asset.disposeTexture).toHaveBeenCalledTimes(1);
    expect(asset.imageBacking.close).toHaveBeenCalledTimes(1);
    expect(audit.snapshot()).toMatchObject({
      activeSources: 0,
      activeOwnerLeases: 0,
      activeInstanceLeases: 0,
      liveSourceGeometries: 0,
      liveSourceTextures: 0,
      liveImageBackings: 0,
      liveInstanceMaterials: 0,
      finalSourceReleases: 1,
    });
  });

  it("does not acquire an RTT lease when the development subject is switched off", async () => {
    const asset = makeGltf();
    const { owner, audit } = await loadOwner(asset.gltf);
    const profile = createFringeClubGroundGlassDevelopmentProfile({
      sourceOwner: owner,
      mountSubject: false,
    });
    const rttScene = new THREE.Scene();

    expect(profile.mountSubject(rttScene, profileContext)).toBeNull();
    expect(rttScene.children).toHaveLength(0);
    expect(profile.resolveRenderBounds(profileContext)).toEqual(
      architectureRiseScene.bounds,
    );
    expect(audit.snapshot().activeInstanceLeases).toBe(0);

    owner.release();
    expect(asset.disposeGeometry).toHaveBeenCalledTimes(1);
  });
});
