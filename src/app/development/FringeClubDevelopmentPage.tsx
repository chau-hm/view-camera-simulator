import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Link } from "react-router-dom";
import * as THREE from "three";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import { GroundGlassRTT } from "../../render/GroundGlassRTT";
import type {
  GroundGlassRttRuntimeInfo,
  GroundGlassRttRuntimeInfoChangeHandler,
} from "../../render/groundGlassRttDimensions";
import { architectureRiseScene } from "../../scenes/definitions/architecture-rise";
import { DEFAULT_CAMERA_STATE } from "../../utils/constants";
import {
  createFringeClubGroundGlassDevelopmentProfile,
  type FringeClubGroundGlassSubjectIdentity,
} from "./fringeClubGroundGlassProfile";
import { AppShell } from "../../components/layout/AppShell";
import { FringeClubRuntimeSubject } from "../../render/SceneAssetSubjects";
import {
  DEFAULT_FRINGE_RUNTIME_CANDIDATE,
  FRINGE_CLUB_CANDIDATE_ASSET_URLS,
  FringeClubRuntimeAudit,
  FringeClubSourceAssetLoader,
} from "../../render/assets/FringeClubRuntimeAsset";
import type {
  FringeClubSourceOwnerLease,
  FringeClubVector3,
  FringeRuntimeCandidate,
} from "../../render/assets/FringeClubRuntimeAsset";
import {
  DEFAULT_PRESENTATION_LIGHTING,
  PRESENTATION_SHADOW_MAP_TYPE,
} from "../../render/presentationLightingContract";
import { PresentationLighting, TeachingShadowParticipation } from "../../render/TeachingLighting";
import { getRenderQualitySettings } from "../../render/renderQuality";

type LoadState = "idle" | "loading" | "ready" | "cancelled" | "error";
type RendererMode = "observer" | "ground-glass" | "both";
type ProbeMotionId = "center" | "left" | "right" | "near" | "far";

type FringeProbe = Readonly<{
  id: string;
  label: string;
  family: string;
  cameraPosition: FringeClubVector3;
  target: FringeClubVector3;
  focalLengthMm: number;
}>;

const PROBE_MOTIONS: readonly Readonly<{ id: ProbeMotionId; label: string }>[] =
  Object.freeze([
    { id: "center", label: "Center" },
    { id: "left", label: "Slight left (40 mm)" },
    { id: "right", label: "Slight right (40 mm)" },
    { id: "near", label: "Slight near (40 mm)" },
    { id: "far", label: "Slight far (40 mm)" },
  ]);

const getProbeMotionOffset = (
  probe: FringeProbe,
  motionId: ProbeMotionId,
): FringeClubVector3 => {
  if (motionId === "center") return [0, 0, 0];

  const forward = new THREE.Vector3(
    probe.target[0] - probe.cameraPosition[0],
    probe.target[1] - probe.cameraPosition[1],
    probe.target[2] - probe.cameraPosition[2],
  ).normalize();
  const right = forward.clone().cross(new THREE.Vector3(0, 1, 0)).normalize();
  const offset = motionId === "left"
    ? right.multiplyScalar(-0.04)
    : motionId === "right"
      ? right.multiplyScalar(0.04)
      : forward.multiplyScalar(motionId === "near" ? 0.04 : -0.04);
  return Object.freeze([offset.x, offset.y, offset.z]);
};

const FRINGE_PROBES: readonly FringeProbe[] = Object.freeze([
  {
    id: "wyndham-rect-pair",
    label: "Wyndham — rectangular sash pair",
    family: "WINDOW_WY_RECT_PAIR",
    cameraPosition: [1, 3, -22],
    target: [-11, 2, -6],
    focalLengthMm: 35,
  },
  {
    id: "wyndham-segmental",
    label: "Wyndham — segmental window",
    family: "WINDOW_WY_SEGMENTAL",
    cameraPosition: [-2.3442, 5.5, -12.2137],
    target: [-3.7442, 5.45, -6.2137],
    focalLengthMm: 70,
  },
  {
    id: "wyndham-transom",
    label: "Wyndham — main transom",
    family: "WINDOW_WY_MAIN_TRANSOM",
    cameraPosition: [-4, 1, -24],
    target: [10, 1, -6],
    focalLengthMm: 35,
  },
  {
    id: "wyndham-vent-louver",
    label: "Wyndham — vent/louver close view",
    family: "VENT_WY_LOUVER",
    cameraPosition: [-4, 1, -24],
    target: [10, 1, -6],
    focalLengthMm: 70,
  },
  {
    id: "wyndham-frieze",
    label: "Wyndham — frieze",
    family: "FRIEZE_WY_PANEL",
    cameraPosition: [2.3609, -0.28, -10.7137],
    target: [1.1609, -0.36, -6.2137],
    focalLengthMm: 60,
  },
  {
    id: "lower-albert-timber",
    label: "Lower Albert — timber window",
    family: "WINDOW_LA_TIMBER",
    cameraPosition: [-11, 4, 24],
    target: [1, 3, 6],
    focalLengthMm: 42,
  },
  {
    id: "lower-albert-louver-light",
    label: "Lower Albert — light louver door",
    family: "DOOR_LA_LOUVER_LIGHT",
    cameraPosition: [-0.259, 1.7, 11.7137],
    target: [-1.159, 1.65, 6.2137],
    focalLengthMm: 52,
  },
  {
    id: "lower-albert-louver-dark",
    label: "Lower Albert — dark louver door",
    family: "DOOR_LA_LOUVER_DARK",
    cameraPosition: [3.2, 1.8, 11.7137],
    target: [2.3, 1.7, 6.2137],
    focalLengthMm: 52,
  },
  {
    id: "entrance-timber-pair",
    label: "Entrance — timber window",
    family: "WINDOW_EN_TIMBER",
    cameraPosition: [14.632, 4.35, 12.2137],
    target: [12.132, 4.25, 6.2137],
    focalLengthMm: 55,
  },
  {
    id: "entrance-paired-entry",
    label: "Entrance — paired glazed entry",
    family: "DOOR_EN_PAIRED_GLAZED",
    cameraPosition: [16.581, -0.93, 12.2137],
    target: [14.081, -1.03, 6.2137],
    focalLengthMm: 55,
  },
  {
    id: "join-wy-window-frame",
    label: "Seam — Wyndham window/frame",
    family: "WINDOW_WY_SEGMENTAL_JOIN",
    cameraPosition: [-2.3442, 5.5, -12.2137],
    target: [-3.7442, 5.45, -6.2137],
    focalLengthMm: 70,
  },
  {
    id: "join-la-louver-frame",
    label: "Seam — Lower Albert louver/frame",
    family: "DOOR_LA_LOUVER_LIGHT_JOIN",
    cameraPosition: [-1.509, 1.7, 7.7137],
    target: [-1.159, 1.65, 6.2137],
    focalLengthMm: 70,
  },
  {
    id: "join-entrance-frame-glass",
    label: "Seam — entrance frame/glass",
    family: "DOOR_EN_PAIRED_FRAME_GLASS_JOIN",
    cameraPosition: [13.981, -0.93, 7.7137],
    target: [14.081, -1.03, 6.2137],
    focalLengthMm: 70,
  },
  {
    id: "join-wy-sill-frame",
    label: "Seam — Wyndham sill/frame",
    family: "WINDOW_WY_SILL_FRAME_JOIN",
    cameraPosition: [-2.3442, 3.3, -12.2137],
    target: [-3.7442, 3.25, -6.2137],
    focalLengthMm: 70,
  },
]);

const REFERENCE_TARGET_METERS: FringeClubVector3 = Object.freeze([
  architectureRiseScene.focusTargets[0].worldPosition.x / 1000,
  architectureRiseScene.focusTargets[0].worldPosition.y / 1000,
  architectureRiseScene.focusTargets[0].worldPosition.z / 1000,
]);

const rendererModeHasObserver = (mode: RendererMode): boolean =>
  mode === "observer" || mode === "both";
const rendererModeHasGroundGlass = (mode: RendererMode): boolean =>
  mode === "ground-glass" || mode === "both";

const positionForProbe = (probe: FringeProbe): FringeClubVector3 =>
  Object.freeze([
    REFERENCE_TARGET_METERS[0] - probe.target[0],
    REFERENCE_TARGET_METERS[1] - probe.target[1],
    REFERENCE_TARGET_METERS[2] - probe.target[2],
  ]);

type RendererSnapshot = Readonly<{
  geometries: number;
  textures: number;
  calls: number;
  triangles: number;
  points: number;
  lines: number;
  fringeMeshes: number;
  candidateId: string;
  rootId: string;
  sampledAtMs: number;
  maxAnisotropy: number;
  webglVersion: string;
  threeVersion: string;
  rendererVendor: string;
  rendererDevice: string;
}>;

const RendererMetricsProbe = ({
  enabled,
  onSnapshot,
}: {
  enabled: boolean;
  onSnapshot: (snapshot: RendererSnapshot) => void;
}) => {
  const { gl, scene } = useThree();
  const lastSampleAt = useRef(0);
  const hasSampled = useRef(false);

  useFrame(({ clock }) => {
    if (!enabled) return;
    if (hasSampled.current && clock.elapsedTime - lastSampleAt.current < 0.35) return;
    hasSampled.current = true;
    lastSampleAt.current = clock.elapsedTime;
    const context = gl.getContext();
    const debugInfo = context.getExtension("WEBGL_debug_renderer_info") as {
      UNMASKED_VENDOR_WEBGL: number;
      UNMASKED_RENDERER_WEBGL: number;
    } | null;
    let fringeMeshes = 0;
    let candidateId = "";
    let rootId = "";
    scene.traverse((object) => {
      if (
        object instanceof THREE.Group &&
        typeof object.userData.fringeClubSourceId === "string"
      ) {
        candidateId = String(object.userData.fringeClubCandidateId ?? "");
        rootId = object.uuid;
      }
      if (
        object instanceof THREE.Mesh &&
        typeof object.userData.fringeClubSourceId === "string"
      ) {
        fringeMeshes += 1;
      }
    });
    onSnapshot({
      geometries: gl.info.memory.geometries,
      textures: gl.info.memory.textures,
      calls: gl.info.render.calls,
      triangles: gl.info.render.triangles,
      points: gl.info.render.points,
      lines: gl.info.render.lines,
      fringeMeshes,
      candidateId,
      rootId,
      sampledAtMs: performance.now(),
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

const ObserverCameraFrame = ({
  probe,
  motionOffset,
}: {
  probe: FringeProbe;
  motionOffset: FringeClubVector3;
}) => {
  const camera = useThree((state) => state.camera);

  useEffect(() => {
    const direction = new THREE.Vector3(
      probe.cameraPosition[0] - probe.target[0],
      probe.cameraPosition[1] - probe.target[1],
      probe.cameraPosition[2] - probe.target[2],
    );
    camera.position.set(
      REFERENCE_TARGET_METERS[0] + direction.x + motionOffset[0],
      REFERENCE_TARGET_METERS[1] + direction.y + motionOffset[1],
      REFERENCE_TARGET_METERS[2] + direction.z + motionOffset[2],
    );
    camera.up.set(0, 1, 0);
    camera.lookAt(
      REFERENCE_TARGET_METERS[0] + motionOffset[0],
      REFERENCE_TARGET_METERS[1] + motionOffset[1],
      REFERENCE_TARGET_METERS[2] + motionOffset[2],
    );
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = THREE.MathUtils.radToDeg(
        2 * Math.atan(24 / (2 * probe.focalLengthMm)),
      );
      camera.near = 0.01;
      camera.far = 1000;
      camera.updateProjectionMatrix();
    }
  }, [camera, motionOffset, probe]);

  return null;
};

const ObserverFringeSubject = ({
  owner,
  probe,
}: {
  owner: FringeClubSourceOwnerLease;
  probe: FringeProbe;
}) => {
  const positionMeters = useMemo(() => positionForProbe(probe), [probe]);
  const request = useMemo(
    () =>
      Object.freeze({
        sourceOwner: owner,
        instanceId: "observer",
        transform: Object.freeze({ positionMeters }),
      }),
    [owner, positionMeters],
  );

  return (
    <TeachingShadowParticipation subjectKey="fringe-club-development-fixture">
      <FringeClubRuntimeSubject request={request} />
    </TeachingShadowParticipation>
  );
};

const AssetSession = ({
  loader,
  candidateId,
  probe,
  motionOffset,
  showObserver,
  onLoadState,
  onSourceOwnerChanged,
}: {
  loader: FringeClubSourceAssetLoader;
  candidateId: FringeRuntimeCandidate;
  probe: FringeProbe;
  motionOffset: FringeClubVector3;
  showObserver: boolean;
  onLoadState: (generation: number, state: LoadState, error?: string) => void;
  onSourceOwnerChanged: (owner: FringeClubSourceOwnerLease | null) => void;
}) => {
  const { gl } = useThree();
  const [owner, setOwner] = useState<FringeClubSourceOwnerLease | null>(null);
  const ownerRef = useRef<FringeClubSourceOwnerLease | null>(null);

  useEffect(() => {
    let active = true;
    let settled = false;
    ownerRef.current = null;
    setOwner(null);
    onSourceOwnerChanged(null);
    const handle = loader.start(gl.capabilities.getMaxAnisotropy(), candidateId);
    onLoadState(handle.generation, "loading");

    void handle.ready.then(
      (readyOwner) => {
        if (!readyOwner) {
          if (active && handle.isCurrent()) {
            onLoadState(handle.generation, "cancelled");
          }
          return;
        }
        if (!active || !handle.isCurrent() || readyOwner.candidateId !== candidateId) {
          readyOwner.release();
          return;
        }
        ownerRef.current = readyOwner;
        onSourceOwnerChanged(readyOwner);
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
      onSourceOwnerChanged(null);
      if (wasCurrent && !settled) {
        settled = true;
        onLoadState(handle.generation, "cancelled");
      }
    };
  }, [candidateId, gl, loader, onLoadState, onSourceOwnerChanged]);

  if (!owner || owner.candidateId !== candidateId) return null;
  return (
    <>
      <ObserverCameraFrame probe={probe} motionOffset={motionOffset} />
      {showObserver ? <ObserverFringeSubject owner={owner} probe={probe} /> : null}
    </>
  );
};

const useAuditSnapshot = (
  audit: FringeClubRuntimeAudit,
  candidateId: FringeRuntimeCandidate,
) => {
  const [snapshot, setSnapshot] = useState(() => ({
    all: audit.snapshot(),
    candidate: audit.snapshotForCandidate(candidateId),
  }));
  useEffect(() => {
    const update = () =>
      setSnapshot({
        all: audit.snapshot(),
        candidate: audit.snapshotForCandidate(candidateId),
      });
    update();
    return audit.subscribe(update);
  }, [audit, candidateId]);
  return snapshot;
};

const renderQuality = getRenderQualitySettings("standard");

export const FringeClubDevelopmentPage = ({
  enableGroundGlass = false,
}: {
  enableGroundGlass?: boolean;
}) => {
  const audit = useMemo(() => new FringeClubRuntimeAudit(), []);
  const loader = useMemo(() => new FringeClubSourceAssetLoader(audit), [audit]);
  const [candidateId, setCandidateId] = useState<FringeRuntimeCandidate>(
    DEFAULT_FRINGE_RUNTIME_CANDIDATE,
  );
  const [rendererMode, setRendererMode] = useState<RendererMode>(
    enableGroundGlass ? "both" : "observer",
  );
  const [probeId, setProbeId] = useState(FRINGE_PROBES[0].id);
  const probe = FRINGE_PROBES.find((item) => item.id === probeId) ?? FRINGE_PROBES[0];
  const [probeMotionId, setProbeMotionId] = useState<ProbeMotionId>("center");
  const probeMotionOffset = useMemo(
    () => getProbeMotionOffset(probe, probeMotionId),
    [probe, probeMotionId],
  );
  const auditSnapshot = useAuditSnapshot(audit, candidateId);
  const [sessionActive, setSessionActive] = useState(false);
  const [sourceOwner, setSourceOwner] = useState<FringeClubSourceOwnerLease | null>(null);
  const [groundGlassInfo, setGroundGlassInfo] =
    useState<GroundGlassRttRuntimeInfo | null>(null);
  const [groundGlassSubjectIdentity, setGroundGlassSubjectIdentity] =
    useState<FringeClubGroundGlassSubjectIdentity | null>(null);
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
  const observerEnabled = rendererModeHasObserver(rendererMode);
  const groundGlassEnabled = rendererModeHasGroundGlass(rendererMode);
  const referenceCamera = useMemo(
    () => ({
      ...DEFAULT_CAMERA_STATE,
      ...architectureRiseScene.cameraPreset,
      activeSceneId: architectureRiseScene.id,
    }),
    [],
  );
  const referenceOptics = useMemo(
    () => deriveOpticsState(referenceCamera, architectureRiseScene),
    [referenceCamera],
  );
  const handleSourceOwnerChanged = useCallback(
    (nextOwner: FringeClubSourceOwnerLease | null) => setSourceOwner(nextOwner),
    [],
  );
  const handleGroundGlassInfoChange =
    useCallback<GroundGlassRttRuntimeInfoChangeHandler>((_channel, info) => {
      setGroundGlassInfo(info);
    }, []);
  const handleGroundGlassSubjectIdentityChange = useCallback(
    (identity: FringeClubGroundGlassSubjectIdentity | null) => {
      setGroundGlassSubjectIdentity(identity);
    },
    [],
  );
  const groundGlassProfile = useMemo(
    () =>
      sourceOwner
        ? createFringeClubGroundGlassDevelopmentProfile({
            sourceOwner,
            alignmentTargetMeters: Object.freeze([
              probe.target[0] + probeMotionOffset[0],
              probe.target[1] + probeMotionOffset[1],
              probe.target[2] + probeMotionOffset[2],
            ]),
            probeId: probe.id,
            probeMotionId,
            mountSubject: groundGlassEnabled,
            onSubjectIdentityChange: handleGroundGlassSubjectIdentityChange,
          })
        : undefined,
    [
      groundGlassEnabled,
      handleGroundGlassSubjectIdentityChange,
      probeMotionId,
      probeMotionOffset,
      probe,
      sourceOwner,
    ],
  );

  const captureRendererSnapshot = useCallback(
    (snapshot: RendererSnapshot) => {
      if (!observerEnabled) return;
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
    },
    [observerEnabled],
  );

  const updateLoadState = useCallback(
    (generation: number, nextState: LoadState, error?: string) => {
      if (generation < latestGeneration.current) return;
      latestGeneration.current = generation;
      setLoadState(nextState);
      setLoadError(error ?? null);
    },
    [],
  );

  useEffect(() => {
    if (!observerEnabled) setRendererSnapshot(null);
  }, [observerEnabled]);

  const handleCandidateChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextCandidate = event.currentTarget.value as FringeRuntimeCandidate;
    setCandidateId(nextCandidate);
    setSourceOwner(null);
    setGroundGlassInfo(null);
    setGroundGlassSubjectIdentity(null);
    setRendererSnapshot(null);
    setLoadError(null);
    setLoadState(sessionActive ? "loading" : "idle");
  };

  const handleReleaseSource = () => {
    setLoadState(loadState === "loading" ? "cancelled" : "idle");
    setLoadError(null);
    setSourceOwner(null);
    setGroundGlassInfo(null);
    setGroundGlassSubjectIdentity(null);
    setRendererSnapshot(null);
    setSessionActive(false);
  };

  const handleLoadSource = () => {
    setLoadError(null);
    setGroundGlassInfo(null);
    setGroundGlassSubjectIdentity(null);
    setSessionActive(true);
  };

  const candidateAudit = auditSnapshot.candidate;
  const expectedGroundGlassIdentity =
    candidateId +
    "|probe:" +
    probe.id +
    (probeMotionId === "center" ? "" : "|motion:" + probeMotionId);
  const activeGroundGlassInfo =
    groundGlassInfo?.renderSanitySubjectIdentity === expectedGroundGlassIdentity
      ? groundGlassInfo
      : null;

  return (
    <AppShell title="Fringe Club runtime A/B validation — development only" fullBleed>
      <div style={{ padding: "1rem", overflow: "auto" }}>
        <p role="note">
          <strong>NOT A PUBLIC SCENE.</strong> Stage 2H remains the current runtime
          authority. Stage 2N-A is a development candidate only. Camera and focus
          probes are <strong>DEVELOPMENT_PROBE_ONLY</strong>; they are not Fringe
          Club camera calibration or lesson targets.
        </p>
        <p>
          Fixed Ground Glass reference: Architecture Rise scene/profile, focal length{" "}
          {referenceCamera.focalLengthMm} mm, aperture f/{referenceCamera.aperture},
          standard render quality, raw RTT orientation. The selected diagnostic
          probe only aligns the asset subject; it does not change VCS optics.
        </p>
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "center" }}>
          <label>
            Runtime candidate{" "}
            <select
              aria-label="Runtime candidate"
              data-testid="fringe-candidate-select"
              value={candidateId}
              onChange={handleCandidateChange}
            >
              <option value="stage2h">Stage 2H — current authority</option>
              <option value="stage2n-a">Stage 2N-A — candidate</option>
            </select>
          </label>
          <label>
            Renderer mode{" "}
            <select
              aria-label="Renderer mode"
              data-testid="fringe-renderer-mode-select"
              value={rendererMode}
              onChange={(event) => setRendererMode(event.currentTarget.value as RendererMode)}
            >
              <option value="observer">Observer only</option>
              <option value="ground-glass">Ground Glass only</option>
              <option value="both">Observer + Ground Glass</option>
            </select>
          </label>
          <label>
            Diagnostic probe{" "}
            <select
              aria-label="Diagnostic probe"
              data-testid="fringe-probe-select"
              value={probeId}
              onChange={(event) => {
                setProbeId(event.currentTarget.value);
                setProbeMotionId("center");
              }}
            >
              {FRINGE_PROBES.map((item) => (
                <option key={item.id} value={item.id}>{item.label}</option>
              ))}
            </select>
          </label>
          <label>
            Bounded view movement{" "}
            <select
              aria-label="Bounded view movement"
              data-testid="fringe-probe-motion-select"
              value={probeMotionId}
              onChange={(event) => setProbeMotionId(event.currentTarget.value as ProbeMotionId)}
            >
              {PROBE_MOTIONS.map((motion) => (
                <option key={motion.id} value={motion.id}>{motion.label}</option>
              ))}
            </select>
          </label>
          {sessionActive ? (
            <button type="button" onClick={handleReleaseSource}>Release source asset</button>
          ) : (
            <button
              type="button"
              onClick={handleLoadSource}
              disabled={!rendererBaseline}
            >
              Load selected candidate
            </button>
          )}
          <Link to="/scenes">Exit development fixture</Link>
        </div>
        <p>
          Probe family: <code>{probe.family}</code>. Observer probe lens: {probe.focalLengthMm} mm;
          target ({probe.target.join(", ")}) m. Both candidates receive the same
          Observer camera, target alignment, Ground Glass optics, viewport, DPR,
          lighting, tone mapping, and anisotropy.
        </p>
        <p data-testid="fringe-probe-motion-state" data-motion-id={probeMotionId}>
          Motion sample: {PROBE_MOTIONS.find((motion) => motion.id === probeMotionId)?.label};
          the Observer camera shifts by ({probeMotionOffset.map((value) => (value * 1000).toFixed(1)).join(", ")}) mm,
          with the matching opposite scene-relative translation in the fixed Ground Glass profile.
        </p>
        <p>
          Selected GLB: <code data-testid="fringe-asset-url">{FRINGE_CLUB_CANDIDATE_ASSET_URLS[candidateId]}</code>
        </p>

        <p
          role={loadState === "error" ? "alert" : "status"}
          data-testid="fringe-load-state"
          data-state={loadState}
          data-candidate-id={candidateId}
          style={{ minHeight: "1.5em" }}
        >
          {loadState === "error"
            ? "Load failed: " + (loadError ?? "Unknown error")
            : loadState === "loading"
              ? "Loading selected Fringe Club candidate…"
              : loadState === "ready"
                ? "Selected Fringe Club source ready"
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
          data-points={rendererSnapshot?.points ?? ""}
          data-lines={rendererSnapshot?.lines ?? ""}
          data-fringe-meshes={rendererSnapshot?.fringeMeshes ?? ""}
          data-observer-candidate-id={rendererSnapshot?.candidateId ?? ""}
          data-observer-root-id={rendererSnapshot?.rootId ?? ""}
          data-observer-sampled-at-ms={rendererSnapshot?.sampledAtMs ?? ""}
          data-anisotropy-max={rendererSnapshot?.maxAnisotropy ?? ""}
          data-webgl-version={rendererSnapshot?.webglVersion ?? ""}
          data-three-version={rendererSnapshot?.threeVersion ?? ""}
          data-renderer-vendor={rendererSnapshot?.rendererVendor ?? ""}
          data-renderer-device={rendererSnapshot?.rendererDevice ?? ""}
          data-baseline-geometries={rendererBaseline?.geometries ?? ""}
          data-baseline-textures={rendererBaseline?.textures ?? ""}
          data-source-assets={auditSnapshot.all.activeSources}
          data-owner-leases={auditSnapshot.all.activeOwnerLeases}
          data-instance-leases={auditSnapshot.all.activeInstanceLeases}
          data-source-geometries={auditSnapshot.all.liveSourceGeometries}
          data-source-materials={auditSnapshot.all.liveSourceMaterialTemplates}
          data-source-textures={auditSnapshot.all.liveSourceTextures}
          data-image-backings={auditSnapshot.all.liveImageBackings}
          data-instance-materials={auditSnapshot.all.liveInstanceMaterials}
          data-final-source-releases={auditSnapshot.all.finalSourceReleases}
          data-stale-results-disposed={auditSnapshot.all.staleResultsDisposed}
          data-selected-candidate-requests={candidateAudit.requestsStarted}
          data-selected-candidate-completed={candidateAudit.completedLoads}
          data-selected-candidate-cancelled={candidateAudit.cancelledLoads}
          data-selected-candidate-stale-disposed={candidateAudit.staleResultsDisposed}
          data-selected-candidate-geometries={candidateAudit.liveSourceGeometries}
          data-selected-candidate-textures={candidateAudit.liveSourceTextures}
          data-applied-anisotropy={candidateAudit.lastAppliedAnisotropy ?? ""}
          data-load-ms={candidateAudit.lastLoadDurationMs ?? ""}
          data-fetch-ms={candidateAudit.lastFetchDurationMs ?? ""}
          data-parse-ms={candidateAudit.lastParseDurationMs ?? ""}
          data-stage2h-requests={audit.snapshotForCandidate("stage2h").requestsStarted}
          data-stage2n-a-requests={audit.snapshotForCandidate("stage2n-a").requestsStarted}
        >
          {rendererSnapshot ? (
            <p>
              Observer renderer: {rendererSnapshot.webglVersion}; geometries {rendererSnapshot.geometries},
              textures {rendererSnapshot.textures} (count, not MiB), calls {rendererSnapshot.calls},
              triangles {rendererSnapshot.triangles}, points {rendererSnapshot.points},
              lines {rendererSnapshot.lines}; Fringe meshes {rendererSnapshot.fringeMeshes};
              max anisotropy {rendererSnapshot.maxAnisotropy}.
            </p>
          ) : (
            <p>{observerEnabled ? "Waiting for Observer renderer metrics…" : "Observer renderer is off in this mode."}</p>
          )}
          <p>
            Source lifecycle — active source owners {auditSnapshot.all.activeOwnerLeases},
            Observer/RTT instance leases {auditSnapshot.all.activeInstanceLeases}; source
            geometries {auditSnapshot.all.liveSourceGeometries}, material templates {auditSnapshot.all.liveSourceMaterialTemplates},
            textures {auditSnapshot.all.liveSourceTextures}, ImageBitmap backings {auditSnapshot.all.liveImageBackings}.
          </p>
          <p>
            {candidateId} loads: requests {candidateAudit.requestsStarted}, completed {candidateAudit.completedLoads},
            cancelled {candidateAudit.cancelledLoads}, stale parsed results disposed {candidateAudit.staleResultsDisposed};
            fetch {candidateAudit.lastFetchDurationMs?.toFixed(1) ?? "—"} ms, parse {candidateAudit.lastParseDurationMs?.toFixed(1) ?? "—"} ms,
            total {candidateAudit.lastLoadDurationMs?.toFixed(1) ?? "—"} ms. These are observations, not FPS or GPU-memory claims.
          </p>
          <p>
            Requested anisotropy 4×; applied {candidateAudit.lastAppliedAnisotropy ?? "—"}×
            (Observer renderer maximum {rendererSnapshot?.maxAnisotropy ?? "—"}×).
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: groundGlassEnabled
              ? "repeat(auto-fit, minmax(min(100%, 34rem), 1fr))"
              : "minmax(0, 1fr)",
            gap: "1rem",
          }}
        >
          <section
            aria-labelledby="fringe-observer-heading"
            style={{ display: observerEnabled ? "block" : "none" }}
          >
            <h2 id="fringe-observer-heading">Observer renderer</h2>
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
                <RendererMetricsProbe enabled={observerEnabled} onSnapshot={captureRendererSnapshot} />
                {sessionActive ? (
                  <AssetSession
                    loader={loader}
                    candidateId={candidateId}
                    probe={probe}
                    motionOffset={probeMotionOffset}
                    showObserver={observerEnabled}
                    onLoadState={updateLoadState}
                    onSourceOwnerChanged={handleSourceOwnerChanged}
                  />
                ) : null}
              </Canvas>
            </div>
          </section>
          <section
            aria-labelledby="fringe-ground-glass-heading"
            style={{ display: groundGlassEnabled ? "block" : "none" }}
          >
              <h2 id="fringe-ground-glass-heading">Actual Ground Glass RTT — Architecture Rise reference</h2>
              <p>
                Development probe family: <code>{probe.family}</code>. Only the
                registered visual subject translation changes with the selected
                diagnostic position. Canonical optics and the actual GroundGlassRTT
                pass graph stay fixed.
              </p>
              <div
                data-testid="fringe-rtt-metrics"
                data-candidate-id={activeGroundGlassInfo?.renderSanitySubjectIdentity ?? ""}
                data-source-id={sourceOwner?.sourceId ?? ""}
                data-subject-candidate-id={groundGlassSubjectIdentity?.candidateId ?? ""}
                data-subject-probe-id={groundGlassSubjectIdentity?.probeId ?? ""}
                data-subject-motion-id={groundGlassSubjectIdentity?.motionId ?? ""}
                data-subject-source-id={groundGlassSubjectIdentity?.sourceId ?? ""}
                data-subject-instance-id={groundGlassSubjectIdentity?.instanceId ?? ""}
                data-subject-root-id={groundGlassSubjectIdentity?.rootId ?? ""}
                data-instance-leases={auditSnapshot.all.activeInstanceLeases}
                data-active-sources={auditSnapshot.all.activeSources}
                data-rtt-camera-ok={activeGroundGlassInfo?.cameraConfigurationOk === undefined ? "" : String(activeGroundGlassInfo.cameraConfigurationOk)}
                data-rtt-raw-contentful={activeGroundGlassInfo?.rawContentful === undefined ? "" : String(activeGroundGlassInfo.rawContentful)}
                data-rtt-final-contentful={activeGroundGlassInfo?.finalContentful === undefined ? "" : String(activeGroundGlassInfo.finalContentful)}
                data-rtt-render-sanity-generation={activeGroundGlassInfo?.renderSanitySubjectGeneration ?? ""}
                data-rtt-sampled-at-ms={activeGroundGlassInfo?.rendererStats?.sampledAtMs ?? ""}
                data-rtt-render-sanity-state={activeGroundGlassInfo?.renderSanityStateKey ?? ""}
                data-rtt-render-sanity-error={activeGroundGlassInfo?.renderSanityError ?? ""}
                data-rtt-subject-meshes={activeGroundGlassInfo?.sceneCapacity?.rttSubject?.meshCount ?? ""}
                data-rtt-subject-triangles={activeGroundGlassInfo?.sceneCapacity?.rttSubject?.triangleCount ?? ""}
                data-rtt-renderer-geometries={activeGroundGlassInfo?.rendererStats?.geometries ?? activeGroundGlassInfo?.sceneCapacity?.rendererResources?.geometries ?? ""}
                data-rtt-renderer-textures={activeGroundGlassInfo?.rendererStats?.textures ?? activeGroundGlassInfo?.sceneCapacity?.rendererResources?.textures ?? ""}
                data-rtt-calls={activeGroundGlassInfo?.rendererStats?.calls ?? ""}
                data-rtt-triangles={activeGroundGlassInfo?.rendererStats?.triangles ?? ""}
                data-rtt-points={activeGroundGlassInfo?.rendererStats?.points ?? ""}
                data-rtt-lines={activeGroundGlassInfo?.rendererStats?.lines ?? ""}
                data-rtt-render-sanity-identity={activeGroundGlassInfo?.renderSanitySubjectIdentity ?? ""}
              >
                {activeGroundGlassInfo ? (
                  <p>
                    RTT camera {activeGroundGlassInfo.cameraConfigurationOk ? "ready" : "not ready"}; raw contentful {String(activeGroundGlassInfo.rawContentful ?? false)};
                    final contentful {String(activeGroundGlassInfo.finalContentful ?? false)}; candidate identity {activeGroundGlassInfo.renderSanitySubjectIdentity ?? "pending"};
                    RTT calls {activeGroundGlassInfo.rendererStats?.calls ?? "pending"}, triangles {activeGroundGlassInfo.rendererStats?.triangles ?? "pending"},
                    points {activeGroundGlassInfo.rendererStats?.points ?? "pending"}, lines {activeGroundGlassInfo.rendererStats?.lines ?? "pending"}; renderer geometries {activeGroundGlassInfo.rendererStats?.geometries ?? activeGroundGlassInfo.sceneCapacity?.rendererResources?.geometries ?? "pending"},
                    textures {activeGroundGlassInfo.rendererStats?.textures ?? activeGroundGlassInfo.sceneCapacity?.rendererResources?.textures ?? "pending"} (count, not MiB).
                  </p>
                ) : (
                  <p>Waiting for current-candidate Ground Glass RTT diagnostics…</p>
                )}
              </div>
              <div
                data-testid="fringe-ground-glass-canvas"
                style={{ height: "min(68vh, 720px)", minHeight: 360, border: "1px solid #cbd5e1" }}
              >
                {groundGlassEnabled && sourceOwner && sessionActive && groundGlassProfile ? (
                  <GroundGlassRTT
                    opticsState={referenceOptics}
                    focalLengthMm={referenceCamera.focalLengthMm}
                    scene={architectureRiseScene}
                    widthPx={500}
                    heightPx={400}
                    aperture={referenceCamera.aperture}
                    previewMode="raw"
                    renderQuality="standard"
                    channel="default"
                    developmentSceneProfileOverride={groundGlassProfile}
                    onRuntimeInfoChange={handleGroundGlassInfoChange}
                  />
                ) : null}
              </div>
          </section>
        </div>
        <p>
          The Observer and Ground Glass use one selected source owner and, when both
          are enabled, distinct registered instance roots. The Ground Glass panel
          mounts the actual GroundGlassRTT component with its VCS camera, pass graph,
          diagnostics, and cleanup. Renderer counters are per renderer; texture
          counters are counts, not measured GPU memory.
        </p>
      </div>
    </AppShell>
  );
};
