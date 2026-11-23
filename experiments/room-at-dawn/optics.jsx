import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import { buildScene } from "./vendor/src/scene/index.js";
import { inspectBake } from "./bake-check.js";
import { GI } from "./vendor/src/core/gi.js";
import { LOOK } from "./vendor/src/render/look.js";
import { ROOM_PRESETS } from "./presets.js";
import { captureRoomReflections } from "./reflection-capture.js";
import bakeUrl from "./vendor/bake/gi.bin?url";
import { deriveOpticsState } from "../../src/core/optics/deriveOpticsState.ts";
import { GroundGlassRTT } from "../../src/render/GroundGlassRTT.tsx";
import { projectWorldPointToFilmPlaneGroundGlass } from "../../src/render/groundGlassFilmPlaneProjection.ts";
import { resolveGroundGlassImageDistanceMm } from "../../src/render/groundGlassRttScenes.ts";
import { computePhysicalCoCDiameterMm } from "../../src/core/optics/thinLensModel.ts";
import { architectureRiseScene } from "../../src/scenes/definitions/architecture-rise.ts";
import {
  DEFAULT_CAMERA_STATE,
  CAMERA_CONSTANTS,
  CAMERA_CONTROL_STEPS,
} from "../../src/utils/constants.ts";

// One rigid translation maps the desired upstream camera position to the VCS rig origin.
// Both render worlds use metres; only the scene metadata/optics boundary uses mm.
const roomOrigin = { value: new THREE.Vector3(...ROOM_PRESETS.wide.origin) };
const roomPreExposure = { value: 1 };
let requestSequence = 0;
const roomBounds = { min: { x: -2400, y: -1400, z: -15000 }, max: { x: 3000, y: 3000, z: 10000 } };
const sceneDefinition = {
  ...architectureRiseScene,
  bounds: roomBounds,
  focusTargets: [],
  compositionTargets: [],
  cameraRigTranslationCapability: { enabled: true, axis: "x", state: "mirrorShiftLessonState" },
};

function disposeRoom(root) {
  const geometries = new Set(),
    materials = new Set(),
    textures = new Set();
  root.traverse((o) => {
    if (o.geometry) geometries.add(o.geometry);
    for (const m of Array.isArray(o.material) ? o.material : o.material ? [o.material] : []) {
      materials.add(m);
      for (const value of Object.values(m)) if (value?.isTexture) textures.add(value);
      for (const uniform of Object.values(m.uniforms || {}))
        if (uniform?.value?.isTexture) textures.add(uniform.value);
    }
  });
  textures.forEach((t) => t.dispose());
  materials.forEach((m) => m.dispose());
  geometries.forEach((g) => g.dispose());
}
function adaptGiMaterials(root) {
  const done = new Set();
  root.traverse((o) => {
    for (const m of Array.isArray(o.material) ? o.material : o.material ? [o.material] : []) {
      if (!m.defines || m.defines.USE_GI === undefined || done.has(m)) continue;
      done.add(m);
      const original = m.onBeforeCompile;
      m.onBeforeCompile = function (shader, renderer) {
        original.call(this, shader, renderer);
        const before = "vGiW = gw.xyz;";
        if (!shader.vertexShader.includes(before))
          throw new Error("Upstream GI shader world-position hook missing");
        shader.uniforms.roomOrigin = roomOrigin;
        shader.vertexShader =
          "uniform vec3 roomOrigin;\n" +
          shader.vertexShader.replace(before, "vGiW = gw.xyz + roomOrigin;");
        // HDR uses unity scene radiance; only the labelled byte comparison uses upstream pre-exposure.
        if (!shader.fragmentShader.includes("#include <opaque_fragment>"))
          throw new Error("Upstream PBR output hook missing");
        if (roomPreExposure.value !== 1) {
          shader.fragmentShader = shader.fragmentShader.replace(
            "#include <opaque_fragment>",
            `outgoingLight *= ${LOOK.exposure.toFixed(1)};\n#include <opaque_fragment>`,
          );
        }
      };
      const oldKey = m.customProgramCacheKey.bind(m);
      m.customProgramCacheKey = () =>
        oldKey() + "|room-translation|" + (roomPreExposure.value === 1 ? "hdr" : "byte");
    }
  });
}
function makeGroup(source, origin) {
  const group = new THREE.Group();
  for (const child of source.children) group.add(child.clone(true));
  group.position.set(...origin.map((n) => -n));
  return group;
}
// Authored source coordinates, not yet confirmed unoccluded surface samples.
const SOURCE_FEATURES = [
  {
    id: "laptop-center",
    sourceM: [3.13, 0.7506, 0.385],
    provenance: "parts/desk.js laptop center",
  },
  {
    id: "mug-rim",
    sourceM: [3.388, 0.829, 0.518],
    provenance: "parts/desk.js mug origin plus rim height",
  },
  {
    id: "nightstand-top",
    sourceM: [1.85, 0.5, 3.75],
    provenance: "scene/layout.js nightstand top bounds",
  },
];
function inspectFeatures(optics, camera, preset) {
  return SOURCE_FEATURES.map((feature) => {
    const [x, y, z] = feature.sourceM.map((value, i) => (value - preset.origin[i]) * 1000);
    const point = { x, y, z };
    const plane = optics.focusPlane;
    const signedFocusDistanceMm = plane
      ? (x - plane.point.x) * plane.normal.x +
        (y - plane.point.y) * plane.normal.y +
        (z - plane.point.z) * plane.normal.z
      : null;
    const projected = projectWorldPointToFilmPlaneGroundGlass({
      worldPoint: point,
      lensCenterWorld: optics.lensCenterWorld,
      filmPlaneCornersWorld: optics.filmPlaneCornersWorld,
    });
    const axialDepthMm = z - optics.lensCenterWorld.z;
    const neutral =
      camera.frontTiltDeg === 0 &&
      camera.frontSwingDeg === 0 &&
      camera.rearTiltDeg === 0 &&
      camera.rearSwingDeg === 0;
    const cocDiameterMm =
      neutral && axialDepthMm > camera.focalLengthMm
        ? computePhysicalCoCDiameterMm({
            focalLengthMm: camera.focalLengthMm,
            apertureFNumber: camera.aperture,
            objectDistanceMm: axialDepthMm,
            filmDistanceMm: resolveGroundGlassImageDistanceMm(optics),
          })
        : null;
    return {
      ...feature,
      worldMm: point,
      axialDepthMm,
      signedFocusDistanceMm,
      projected,
      cocDiameterMm,
      visibility: "projection only; occlusion and texture not verified",
    };
  });
}
class RenderBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error: String(error?.message || error) };
  }
  componentDidCatch(error) {
    if (window.__roomOptics) window.__roomOptics.renderError = String(error?.message || error);
  }
  render() {
    return this.state.error ? (
      <p role="alert">
        Ground Glass renderer failed: {this.state.error}. Try the Byte diagnostic path.
      </p>
    ) : (
      this.props.children
    );
  }
}
function App() {
  const [owner, setOwner] = useState(null),
    [error, setError] = useState(""),
    [progress, setProgress] = useState("building");
  const [presetKey, setPresetKey] = useState("wide");
  const preset = ROOM_PRESETS[presetKey];
  const [generationEpoch, setGenerationEpoch] = useState(1);
  const [hdr, setHdr] = useState(true);
  const [reflectionsEnabled, setReflectionsEnabled] = useState(true);
  const [displayExposure, setDisplayExposure] = useState(LOOK.exposure);
  const [camera, setCamera] = useState({
    ...DEFAULT_CAMERA_STATE,
    mode: "free",
    activeTaskId: null,
    focalLengthMm: ROOM_PRESETS.wide.focalLengthMm,
    focusDistanceMm: ROOM_PRESETS.wide.focusDistanceMm,
    aperture: ROOM_PRESETS.wide.aperture,
    mirrorShiftLessonState: { rigLateralMm: 0 },
  });
  const [mode, setMode] = useState("upright"),
    [show, setShow] = useState(true),
    [rawDebug, setRawDebug] = useState(false),
    [info, setInfo] = useState(null);
  useEffect(() => {
    let cancelled = false,
      owned = null;
    const bakeAbort = new AbortController();
    (async () => {
      const { scene, ctx } = await buildScene((p) => {
        if (!cancelled) setProgress(p);
      });
      owned = scene;
      if (cancelled) {
        disposeRoom(scene);
        owned = null;
        return;
      }
      const response = await fetch(bakeUrl, { signal: bakeAbort.signal });
      if (!response.ok) throw new Error(`GI fetch ${response.status}`);
      const buffer = await response.arrayBuffer();
      if (cancelled) return;
      const report = inspectBake(scene, buffer);
      GI.uniforms.giExt.value = 1;
      adaptGiMaterials(scene);
      if (cancelled) {
        disposeRoom(scene);
        owned = null;
        return;
      }
      setOwner({ scene, ctx, report });
      setProgress("ready");
    })().catch((e) => {
      if (owned) {
        disposeRoom(owned);
        owned = null;
      }
      if (!cancelled) setError(String(e.stack || e));
    });
    return () => {
      cancelled = true;
      bakeAbort.abort();
      if (owned) {
        disposeRoom(owned);
        owned = null;
      }
    };
  }, []);
  const optics = useMemo(() => deriveOpticsState(camera, sceneDefinition), [camera]);
  const features = useMemo(() => inspectFeatures(optics, camera, preset), [optics, camera, preset]);
  const observerGroup = useMemo(
    () => (owner ? makeGroup(owner.scene, preset.origin) : null),
    [owner, preset, presetKey],
  );
  const profile = useMemo(
    () =>
      owner
        ? {
            renderSanityIdentity: `room-at-dawn:${presetKey}`,
            configureRttShadowParticipation: () => {},
            resolveRenderBounds: () => roomBounds,
            mountSubject: (scene) => {
              const group = makeGroup(owner.scene, preset.origin);
              const previousEnvironment = scene.environment;
              scene.environment = null;
              const lights = [];
              scene.traverse((o) => {
                if (o.isLight) {
                  lights.push([o, o.visible]);
                  o.visible = false;
                }
              });
              const restore = () => {
                scene.remove(group);
                scene.environment = previousEnvironment;
                lights.forEach(([light, visible]) => {
                  light.visible = visible;
                });
              };
              try {
                scene.add(group);
              } catch (error) {
                restore();
                throw error;
              }
              let disposed = false;
              return {
                group,
                dispose: () => {
                  if (disposed) return;
                  disposed = true;
                  restore();
                },
              };
            },
          }
        : undefined,
    [owner, preset, presetKey],
  );
  const generation = useMemo(
    () => ({ generationId: `room-generation-${generationEpoch}`, channelId: "default" }),
    [generationEpoch],
  );
  const request = useMemo(
    () => ({
      requestId: `room-request-${++requestSequence}`,
      channelId: "default",
      sceneId: sceneDefinition.id,
    }),
    [camera, mode, rawDebug, presetKey, generationEpoch, hdr, displayExposure, reflectionsEnabled],
  );
  const handleFrame = useCallback((frame) => {
    if (window.__roomOptics) window.__roomOptics.frame = frame;
  }, []);
  const handleDisposed = useCallback((retiredGeneration, outcome, reason) => {
    window.__roomRetirements ||= [];
    window.__roomRetirements.push({
      generation: retiredGeneration,
      outcome,
      reason: reason ?? null,
    });
  }, []);
  const handleObservation = useCallback((observation) => {
    const current = window.__roomOptics;
    if (!current) return;
    current.observation = observation;
    if (
      observation.scope === "request" &&
      observation.requestIdentity?.requestId === current.request?.requestId &&
      observation.generation?.generationId === current.generation?.generationId
    )
      setInfo(observation.info);
  }, []);
  const prepareReflections = useCallback(
    (scene, renderer) => {
      if (!reflectionsEnabled) return () => {};
      return captureRoomReflections({
        scene,
        renderer,
        giUniforms: GI.uniforms,
        roomBox: owner.ctx.roomBox,
        probe: new THREE.Vector3(2.35, 1.3, 2),
        roomOrigin: roomOrigin.value,
        captureExteriorScale: LOOK.ext,
      });
    },
    [owner, reflectionsEnabled, preset],
  );
  const handleInfo = useCallback((_channel, next) => setInfo(next), []);
  const set = (key, value) => setCamera((c) => ({ ...c, [key]: value }));
  const range = (label, key, min, max, step) => (
    <label style={{ display: "block" }}>
      {label}: {camera[key]}{" "}
      <input
        aria-label={label}
        type="range"
        min={min}
        max={max}
        step={step}
        value={camera[key]}
        onChange={(e) => set(key, Number(e.target.value))}
      />
    </label>
  );
  useEffect(() => {
    window.__roomOptics = {
      ...window.__roomOptics,
      renderError:
        window.__roomOptics?.generation?.generationId === generation.generationId
          ? window.__roomOptics?.renderError
          : null,
      camera,
      optics,
      features,
      info,
      ready: !!owner,
      error,
      request,
      generation,
      previewMode: mode,
      rawDebug,
      presetKey,
      subjectIdentity: `room-at-dawn:${presetKey}`,
      preset,
      hdr,
      displayExposure,
      reflectionsEnabled,
    };
  }, [
    camera,
    optics,
    features,
    info,
    owner,
    error,
    request,
    generation,
    mode,
    rawDebug,
    presetKey,
    preset,
    hdr,
    displayExposure,
    reflectionsEnabled,
  ]);
  return (
    <main style={{ padding: 16 }}>
      <h1>Room at Dawn — experimental Ground Glass</h1>
      <p>
        Original GI; canonical WebGL Ground Glass. HDR uses linear HalfFloat color and display-only
        exposure. The byte comparison uses lossy upstream pre-exposure. Reflections use a
        renderer-owned probe; custom glass remains unsupported.
      </p>
      <p role="status">
        {error ||
          (owner
            ? `Ready: GI ${owner.report.matched}/${owner.report.expected}; WebGL RTT`
            : `Loading: ${progress}`)}
      </p>
      <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
        <section>
          <h2>Room observer</h2>
          <div style={{ width: 480, height: 360, background: "#111" }}>
            {owner && show && (
              <Canvas
                frameloop="demand"
                camera={{ position: [0, 0, -0.15], fov: 65, near: 0.02, far: 100 }}
              >
                <primitive object={observerGroup} dispose={null} />
              </Canvas>
            )}
          </div>
        </section>
        <section>
          <h2>Ground Glass ({mode})</h2>
          <div style={{ width: 480, height: 360, background: "#111" }}>
            {owner && show && (
              <RenderBoundary key={generationEpoch}>
                <GroundGlassRTT
                  key={generationEpoch}
                  developmentHdrColor={hdr}
                  developmentDisplayExposure={displayExposure}
                  developmentPrepareScene={prepareReflections}
                  opticsState={optics}
                  focalLengthMm={camera.focalLengthMm}
                  scene={sceneDefinition}
                  widthPx={480}
                  heightPx={360}
                  aperture={camera.aperture}
                  previewMode={mode}
                  rawDebug={rawDebug}
                  renderQuality="low"
                  developmentSceneProfileOverride={profile}
                  onRuntimeInfoChange={handleInfo}
                  rendererGeneration={generation}
                  acceptedRequestIdentity={request}
                  onFrameResult={handleFrame}
                  onAdapterDisposed={handleDisposed}
                  onRuntimeObservation={handleObservation}
                />
              </RenderBoundary>
            )}
          </div>
        </section>
      </div>
      <div>
        <label>
          <input
            aria-label="Reflections"
            type="checkbox"
            checked={reflectionsEnabled}
            onChange={(e) => {
              setReflectionsEnabled(e.target.checked);
              setGenerationEpoch((n) => n + 1);
            }}
          />{" "}
          Reflections
        </label>
        <label>
          Color path{" "}
          <select
            aria-label="Color path"
            value={hdr ? "hdr" : "byte"}
            onChange={(e) => {
              const enabled = e.target.value === "hdr";
              roomPreExposure.value = enabled ? 1 : LOOK.exposure;
              owner?.scene.traverse((o) => {
                for (const material of Array.isArray(o.material)
                  ? o.material
                  : o.material
                    ? [o.material]
                    : [])
                  if (material.defines?.USE_GI !== undefined) material.needsUpdate = true;
              });
              setHdr(enabled);
              setGenerationEpoch((n) => n + 1);
            }}
          >
            <option value="hdr">HDR HalfFloat</option>
            <option value="byte">Byte diagnostic</option>
          </select>
        </label>
        <label>
          Display exposure{" "}
          <input
            aria-label="Display exposure"
            type="number"
            min="0.1"
            max="100"
            step="1"
            value={displayExposure}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (n > 0 && Number.isFinite(n)) {
                setDisplayExposure(n);
                setGenerationEpoch((v) => v + 1);
              }
            }}
          />
        </label>
        <label>
          Composition{" "}
          <select
            aria-label="Composition"
            value={presetKey}
            onChange={(e) => {
              const key = e.target.value;
              const selected = ROOM_PRESETS[key];
              roomOrigin.value.fromArray(selected.origin);
              setGenerationEpoch((n) => n + 1);
              setPresetKey(key);
              setCamera((c) => ({
                ...c,
                focalLengthMm: selected.focalLengthMm,
                focusDistanceMm: selected.focusDistanceMm,
                aperture: selected.aperture,
                frontRiseMm: 0,
                frontShiftMm: 0,
                frontTiltDeg: 0,
                frontSwingDeg: 0,
                mirrorShiftLessonState: { rigLateralMm: 0 },
              }));
            }}
          >
            {Object.entries(ROOM_PRESETS).map(([key, p]) => (
              <option key={key} value={key}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Camera lateral position (mm): {camera.mirrorShiftLessonState.rigLateralMm}{" "}
          <input
            aria-label="Camera lateral position (mm)"
            type="range"
            min="-1000"
            max="1000"
            step="50"
            value={camera.mirrorShiftLessonState.rigLateralMm}
            onChange={(e) =>
              set("mirrorShiftLessonState", { rigLateralMm: Number(e.target.value) })
            }
          />
        </label>
        {range("Rise (mm)", "frontRiseMm", 0, 40, CAMERA_CONTROL_STEPS.riseMm)}
        {range("Shift (mm)", "frontShiftMm", -60, 60, CAMERA_CONTROL_STEPS.shiftMm)}
        {range("Tilt (degrees)", "frontTiltDeg", -10, 10, CAMERA_CONTROL_STEPS.tiltDeg)}
        {range("Swing (degrees)", "frontSwingDeg", -10, 10, CAMERA_CONTROL_STEPS.swingDeg)}
        {range("Focus (mm)", "focusDistanceMm", 100, 8000, CAMERA_CONTROL_STEPS.focusDistanceMm)}
        <label>
          Aperture{" "}
          <select
            aria-label="Aperture"
            value={camera.aperture}
            onChange={(e) => set("aperture", Number(e.target.value))}
          >
            {CAMERA_CONSTANTS.apertureOptions.map((a) => (
              <option key={a} value={a}>
                f/{a}
              </option>
            ))}
          </select>
        </label>{" "}
        <button onClick={() => setMode((m) => (m === "raw" ? "upright" : "raw"))}>
          Toggle Raw/Upright
        </button>{" "}
        <button onClick={() => setRawDebug((s) => !s)}>
          {rawDebug ? "Processed" : "Raw RTT debug"}
        </button>{" "}
        <button
          onClick={() => {
            if (!show) setGenerationEpoch((n) => n + 1);
            setShow((s) => !s);
          }}
        >
          {show ? "Unmount views" : "Remount views"}
        </button>
      </div>
      <pre style={{ whiteSpace: "pre-wrap" }}>
        {JSON.stringify(
          {
            camera,
            lens: optics.lensCenterWorld,
            focusPlane: optics.focusPlane,
            features,
            backend: "WebGL",
            sceneColor: hdr ? "RGBA half-float (requested)" : "RGBA unsigned byte",
            displayExposure,
            reflectionsEnabled,
            nearM: info?.cameraNearWorld,
            farM: info?.cameraFarWorld,
            cameraOk: info?.cameraConfigurationOk,
            rawContentful: info?.rawContentful,
            finalContentful: info?.finalContentful,
            renderSanityError: info?.renderSanityError,
            frameExecutionError: info?.frameExecutionError,
            failedPass: info?.failedPass,
          },
          null,
          2,
        )}
      </pre>
    </main>
  );
}
const root = import.meta.hot?.data.root ?? createRoot(document.getElementById("root"));
if (import.meta.hot) import.meta.hot.data.root = root;
root.render(<App />);
