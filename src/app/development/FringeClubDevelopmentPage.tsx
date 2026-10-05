import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Link } from "react-router-dom";
import * as THREE from "three";
import { AppShell } from "../../components/layout/AppShell";
import { FringeClubRuntimeSubject } from "../../render/SceneAssetSubjects";
import {
  FRINGE_CLUB_ASSET_URL,
  FringeClubRuntimeAudit,
  FringeClubSourceAssetLoader,
} from "../../render/assets/FringeClubRuntimeAsset";
import type {
  FringeClubSourceOwnerLease,
  FringeClubVector3,
} from "../../render/assets/FringeClubRuntimeAsset";
import {
  DEFAULT_PRESENTATION_LIGHTING,
  PRESENTATION_SHADOW_MAP_TYPE,
} from "../../render/presentationLightingContract";
import { PresentationLighting, TeachingShadowParticipation } from "../../render/TeachingLighting";
import { getRenderQualitySettings } from "../../render/renderQuality";

type LoadState = "idle" | "loading" | "ready" | "cancelled" | "error";

type RendererSnapshot = Readonly<{
  geometries: number;
  textures: number;
  calls: number;
  triangles: number;
  fringeMeshes: number;
  instanceAMeshes: number;
  instanceBMeshes: number;
  instanceARootId: string;
  instanceBRootId: string;
  maxAnisotropy: number;
  webglVersion: string;
  threeVersion: string;
  rendererVendor: string;
  rendererDevice: string;
}>;

const RendererMetricsProbe = ({
  onSnapshot,
}: {
  onSnapshot: (snapshot: RendererSnapshot) => void;
}) => {
  const { gl, scene } = useThree();
  const lastSampleAt = useRef(0);
  const hasSampled = useRef(false);

  useFrame(({ clock }) => {
    if (hasSampled.current && clock.elapsedTime - lastSampleAt.current < 0.35) return;
    hasSampled.current = true;
    lastSampleAt.current = clock.elapsedTime;
    const context = gl.getContext();
    const debugInfo = context.getExtension("WEBGL_debug_renderer_info") as {
      UNMASKED_VENDOR_WEBGL: number;
      UNMASKED_RENDERER_WEBGL: number;
    } | null;
    let fringeMeshes = 0;
    let instanceAMeshes = 0;
    let instanceBMeshes = 0;
    let instanceARootId = "";
    let instanceBRootId = "";
    scene.traverse((object) => {
      if (
        object instanceof THREE.Group &&
        typeof object.userData.fringeClubSourceId === "string"
      ) {
        if (object.userData.fringeClubInstanceId === "A") instanceARootId = object.uuid;
        if (object.userData.fringeClubInstanceId === "B") instanceBRootId = object.uuid;
      }
      if (
        object instanceof THREE.Mesh &&
        typeof object.userData.fringeClubSourceId === "string"
      ) {
        fringeMeshes += 1;
        if (object.userData.fringeClubInstanceId === "A") instanceAMeshes += 1;
        if (object.userData.fringeClubInstanceId === "B") instanceBMeshes += 1;
      }
    });
    onSnapshot({
      geometries: gl.info.memory.geometries,
      textures: gl.info.memory.textures,
      calls: gl.info.render.calls,
      triangles: gl.info.render.triangles,
      fringeMeshes,
      instanceAMeshes,
      instanceBMeshes,
      instanceARootId,
      instanceBRootId,
      maxAnisotropy: gl.capabilities.getMaxAnisotropy(),
      webglVersion: gl.capabilities.isWebGL2 ? "WebGL 2" : "WebGL 1",
      threeVersion: THREE.REVISION,
      rendererVendor: String(
        context.getParameter(debugInfo?.UNMASKED_VENDOR_WEBGL ?? context.VENDOR),
      ),
      rendererDevice: String(
        context.getParameter(debugInfo?.UNMASKED_RENDERER_WEBGL ?? context.RENDERER),
      ),
    });
  });

  return null;
};

const FringeCameraFrame = ({
  owner,
  showA,
  showB,
}: {
  owner: FringeClubSourceOwnerLease;
  showA: boolean;
  showB: boolean;
}) => {
  const camera = useThree((state) => state.camera);

  useEffect(() => {
    const [sizeX, sizeY, sizeZ] = owner.boundsMeters.size;
    const separation = sizeX * 1.12;
    const centerX = showA && showB ? 0 : showA ? -separation / 2 : showB ? separation / 2 : 0;
    const center = new THREE.Vector3(centerX, 0, 0);
    const width = sizeX * (showA && showB ? 2.12 : 1.2);
    const radius = Math.max(width, sizeY, sizeZ, 1);
    const direction = new THREE.Vector3(1, 0.72, 1).normalize();
    camera.position.copy(center).addScaledVector(direction, radius * 1.65);
    camera.up.set(0, 1, 0);
    camera.lookAt(center);
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.near = Math.max(0.01, radius / 1000);
      camera.far = radius * 8;
      camera.updateProjectionMatrix();
    }
  }, [camera, owner, showA, showB]);

  return null;
};

const MountedFringeInstances = ({
  owner,
  showA,
  showB,
}: {
  owner: FringeClubSourceOwnerLease;
  showA: boolean;
  showB: boolean;
}) => {
  const [centerX, centerY, centerZ] = owner.boundsMeters.center;
  const [sizeX] = owner.boundsMeters.size;
  const separation = sizeX * 1.12;
  const requestA = useMemo(
    () =>
      Object.freeze({
        sourceOwner: owner,
        instanceId: "A",
        transform: Object.freeze({
          positionMeters: [
            -separation / 2 - centerX,
            -centerY,
            -centerZ,
          ] as const satisfies FringeClubVector3,
        }),
      }),
    [centerX, centerY, centerZ, owner, separation],
  );
  const requestB = useMemo(
    () =>
      Object.freeze({
        sourceOwner: owner,
        instanceId: "B",
        transform: Object.freeze({
          positionMeters: [
            separation / 2 - centerX,
            -centerY,
            -centerZ,
          ] as const satisfies FringeClubVector3,
        }),
      }),
    [centerX, centerY, centerZ, owner, separation],
  );

  return (
    <>
      <FringeCameraFrame owner={owner} showA={showA} showB={showB} />
      <TeachingShadowParticipation subjectKey="fringe-club-development-fixture">
        {showA ? <FringeClubRuntimeSubject request={requestA} /> : null}
        {showB ? <FringeClubRuntimeSubject request={requestB} /> : null}
      </TeachingShadowParticipation>
    </>
  );
};

const AssetSession = ({
  loader,
  showA,
  showB,
  onLoadState,
}: {
  loader: FringeClubSourceAssetLoader;
  showA: boolean;
  showB: boolean;
  onLoadState: (generation: number, state: LoadState, error?: string) => void;
}) => {
  const { gl } = useThree();
  const [owner, setOwner] = useState<FringeClubSourceOwnerLease | null>(null);
  const ownerRef = useRef<FringeClubSourceOwnerLease | null>(null);

  useEffect(() => {
    let active = true;
    let settled = false;
    ownerRef.current = null;
    setOwner(null);
    const handle = loader.start(gl.capabilities.getMaxAnisotropy());
    onLoadState(handle.generation, "loading");

    void handle.ready.then(
      (readyOwner) => {
        if (!readyOwner) {
          if (active && handle.isCurrent()) {
            onLoadState(handle.generation, "cancelled");
          }
          return;
        }
        if (!active || !handle.isCurrent()) {
          readyOwner.release();
          return;
        }
        ownerRef.current = readyOwner;
        setOwner(readyOwner);
        settled = true;
        onLoadState(handle.generation, "ready");
      },
      (error: unknown) => {
        if (!active || !handle.isCurrent()) return;
        settled = true;
        onLoadState(
          handle.generation,
          "error",
          error instanceof Error ? error.message : String(error),
        );
      },
    );

    return () => {
      active = false;
      const wasCurrent = handle.isCurrent();
      handle.cancel();
      const currentOwner = ownerRef.current;
      ownerRef.current = null;
      currentOwner?.release();
      if (wasCurrent && !settled) {
        settled = true;
        onLoadState(handle.generation, "cancelled");
      }
    };
  }, [gl, loader, onLoadState]);

  if (!owner) return null;
  return (
    <MountedFringeInstances owner={owner} showA={showA} showB={showB} />
  );
};

const useAuditSnapshot = (audit: FringeClubRuntimeAudit) => {
  const [snapshot, setSnapshot] = useState(() => audit.snapshot());
  useEffect(
    () => audit.subscribe(() => setSnapshot(audit.snapshot())),
    [audit],
  );
  return snapshot;
};

const renderQuality = getRenderQualitySettings("standard");

export const FringeClubDevelopmentPage = () => {
  const audit = useMemo(() => new FringeClubRuntimeAudit(), []);
  const loader = useMemo(() => new FringeClubSourceAssetLoader(audit), [audit]);
  const auditSnapshot = useAuditSnapshot(audit);
  const [sessionActive, setSessionActive] = useState(false);
  const [showA, setShowA] = useState(true);
  const [showB, setShowB] = useState(false);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [rendererSnapshot, setRendererSnapshot] =
    useState<RendererSnapshot | null>(null);
  const [rendererBaseline, setRendererBaseline] =
    useState<RendererSnapshot | null>(null);
  const rendererBaselineRef = useRef<RendererSnapshot | null>(null);
  const rendererBaselineCandidate = useRef<RendererSnapshot | null>(null);
  const rendererBaselineStableSamples = useRef(0);
  const latestGeneration = useRef(0);

  const captureRendererSnapshot = useCallback((snapshot: RendererSnapshot) => {
    setRendererSnapshot(snapshot);
    if (snapshot.fringeMeshes === 0 && rendererBaselineRef.current === null) {
      const candidate = rendererBaselineCandidate.current;
      if (
        candidate &&
        candidate.geometries === snapshot.geometries &&
        candidate.textures === snapshot.textures
      ) {
        rendererBaselineStableSamples.current += 1;
      } else {
        rendererBaselineCandidate.current = snapshot;
        rendererBaselineStableSamples.current = 1;
      }
      if (rendererBaselineStableSamples.current >= 3) {
        rendererBaselineRef.current = snapshot;
        setRendererBaseline(snapshot);
      }
    }
  }, []);

  const updateLoadState = useCallback(
    (generation: number, nextState: LoadState, error?: string) => {
      if (generation < latestGeneration.current) return;
      latestGeneration.current = generation;
      setLoadState(nextState);
      setLoadError(error ?? null);
    },
    [],
  );

  const setInstanceChecked = (
    setter: (checked: boolean) => void,
  ) =>
    (event: ChangeEvent<HTMLInputElement>) => setter(event.currentTarget.checked);

  const handleReleaseSource = () => {
    if (loadState === "loading") setLoadState("cancelled");
    else setLoadState("idle");
    setLoadError(null);
    setSessionActive(false);
  };

  const handleLoadSource = () => {
    setShowA(true);
    setShowB(false);
    setLoadError(null);
    setSessionActive(true);
  };

  return (
    <AppShell title="Fringe Club runtime integration — development only" fullBleed>
      <div style={{ padding: "1rem", overflow: "auto" }}>
        <p role="note">
          <strong>NOT A PUBLIC SCENE.</strong> Do not use this fixture as a lesson
          or catalog entry. It validates the Stage 2H visual asset lifecycle only.
        </p>
        <p>
          GLB: <code data-testid="fringe-asset-url">{FRINGE_CLUB_ASSET_URL}</code>
        </p>
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "center" }}>
          {sessionActive ? (
            <button type="button" onClick={handleReleaseSource}>
              Release source asset
            </button>
          ) : (
            <button
              type="button"
              onClick={handleLoadSource}
              disabled={!rendererBaseline}
            >
              Load source asset
            </button>
          )}
          {sessionActive ? (
            <>
              <label>
                <input
                  type="checkbox"
                  aria-label="Mount instance A"
                  checked={showA}
                  onChange={setInstanceChecked(setShowA)}
                  disabled={loadState !== "ready"}
                />{" "}
                Instance A
              </label>
              <label>
                <input
                  type="checkbox"
                  aria-label="Mount instance B"
                  checked={showB}
                  onChange={setInstanceChecked(setShowB)}
                  disabled={loadState !== "ready"}
                />{" "}
                Instance B
              </label>
            </>
          ) : null}
          <Link to="/scenes">Exit development fixture</Link>
        </div>

        <p
          role={loadState === "error" ? "alert" : "status"}
          data-testid="fringe-load-state"
          data-state={loadState}
          style={{ minHeight: "1.5em" }}
        >
          {loadState === "error"
            ? `Load failed: ${loadError ?? "Unknown error"}`
            : loadState === "loading"
              ? "Loading Fringe Club GLB…"
              : loadState === "ready"
                ? "Fringe Club source ready"
                : loadState === "cancelled"
                  ? "Fringe Club load cancelled"
                  : "Source asset released"}
        </p>

        <div
          data-testid="fringe-renderer-metrics"
          data-geometries={rendererSnapshot?.geometries ?? ""}
          data-textures={rendererSnapshot?.textures ?? ""}
          data-calls={rendererSnapshot?.calls ?? ""}
          data-triangles={rendererSnapshot?.triangles ?? ""}
          data-fringe-meshes={rendererSnapshot?.fringeMeshes ?? ""}
          data-instance-a-meshes={rendererSnapshot?.instanceAMeshes ?? ""}
          data-instance-b-meshes={rendererSnapshot?.instanceBMeshes ?? ""}
          data-instance-a-root-id={rendererSnapshot?.instanceARootId ?? ""}
          data-instance-b-root-id={rendererSnapshot?.instanceBRootId ?? ""}
          data-anisotropy-max={rendererSnapshot?.maxAnisotropy ?? ""}
          data-webgl-version={rendererSnapshot?.webglVersion ?? ""}
          data-three-version={rendererSnapshot?.threeVersion ?? ""}
          data-renderer-vendor={rendererSnapshot?.rendererVendor ?? ""}
          data-renderer-device={rendererSnapshot?.rendererDevice ?? ""}
          data-baseline-geometries={rendererBaseline?.geometries ?? ""}
          data-baseline-textures={rendererBaseline?.textures ?? ""}
          data-source-assets={auditSnapshot.activeSources}
          data-owner-leases={auditSnapshot.activeOwnerLeases}
          data-instance-leases={auditSnapshot.activeInstanceLeases}
          data-source-geometries={auditSnapshot.liveSourceGeometries}
          data-source-materials={auditSnapshot.liveSourceMaterialTemplates}
          data-source-textures={auditSnapshot.liveSourceTextures}
          data-image-backings={auditSnapshot.liveImageBackings}
          data-instance-materials={auditSnapshot.liveInstanceMaterials}
          data-final-source-releases={auditSnapshot.finalSourceReleases}
          data-stale-results-disposed={auditSnapshot.staleResultsDisposed}
          data-applied-anisotropy={auditSnapshot.lastAppliedAnisotropy ?? ""}
          data-load-ms={auditSnapshot.lastLoadDurationMs ?? ""}
        >
          {rendererSnapshot ? (
            <p>
              {rendererSnapshot.webglVersion}; renderer geometries {rendererSnapshot.geometries},
              textures {rendererSnapshot.textures}, calls {rendererSnapshot.calls},
              triangles {rendererSnapshot.triangles}; Fringe meshes {rendererSnapshot.fringeMeshes};
              max anisotropy {rendererSnapshot.maxAnisotropy}.
            </p>
          ) : (
            <p>Waiting for the application renderer metrics…</p>
          )}
          <p>
            Asset-owned source resources: {auditSnapshot.liveSourceGeometries} geometries, {auditSnapshot.liveSourceMaterialTemplates} material templates, {auditSnapshot.liveSourceTextures} textures, {auditSnapshot.liveImageBackings} image backings; {auditSnapshot.activeOwnerLeases} owner leases and {auditSnapshot.activeInstanceLeases} instance leases.
          </p>
          <p>
            Loads completed: {auditSnapshot.completedLoads}; cancelled: {auditSnapshot.cancelledLoads}; stale results disposed: {auditSnapshot.staleResultsDisposed}; last load: {auditSnapshot.lastLoadDurationMs === null ? "—" : `${auditSnapshot.lastLoadDurationMs.toFixed(1)} ms`}.
          </p>
          <p>
            Requested anisotropy: 4×; applied: {auditSnapshot.lastAppliedAnisotropy ?? "—"}× (renderer capability: {rendererSnapshot?.maxAnisotropy ?? "—"}×).
          </p>
        </div>

        <div
          data-testid="fringe-app-canvas"
          style={{ height: "min(68vh, 720px)", minHeight: 360, border: "1px solid #cbd5e1" }}
        >
          <Canvas
            dpr={renderQuality.dpr}
            camera={{ position: [30, 24, 30], fov: 45, near: 0.01, far: 1000 }}
            gl={{ antialias: renderQuality.antialias }}
            shadows={{ type: PRESENTATION_SHADOW_MAP_TYPE }}
          >
            <color attach="background" args={["#f8fafc"]} />
            <PresentationLighting lighting={DEFAULT_PRESENTATION_LIGHTING} />
            <RendererMetricsProbe onSnapshot={captureRendererSnapshot} />
            {sessionActive ? (
              <AssetSession
                key={String(sessionActive)}
                loader={loader}
                showA={showA}
                showB={showB}
                onLoadState={updateLoadState}
              />
            ) : null}
          </Canvas>
        </div>
        <p>
          This development fixture uses the application’s R3F Canvas settings,
          teaching-lighting/shadow policy, typed scene-asset registry, and
          registered disposer. Its preview camera is presentation-only; no
          canonical simulator or Ground Glass state is mounted.
        </p>
      </div>
    </AppShell>
  );
};
