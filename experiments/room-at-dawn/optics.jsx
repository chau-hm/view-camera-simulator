import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import { buildScene } from "./vendor/src/scene/index.js";
import { inspectBake } from "./bake-check.js";
import { GI } from "./vendor/src/core/gi.js";
import { LOOK } from "./vendor/src/render/look.js";
import bakeUrl from "./vendor/bake/gi.bin?url";
import { deriveOpticsState } from "../../src/core/optics/deriveOpticsState.ts";
import { GroundGlassRTT } from "../../src/render/GroundGlassRTT.tsx";
import { architectureRiseScene } from "../../src/scenes/definitions/architecture-rise.ts";
import {
  DEFAULT_CAMERA_STATE,
  CAMERA_CONSTANTS,
  CAMERA_CONTROL_STEPS,
} from "../../src/utils/constants.ts";

// One rigid translation maps the desired upstream camera position to the VCS rig origin.
// Both render worlds use metres; only the scene metadata/optics boundary uses mm.
const CAMERA_IN_ROOM = [2.6, 1.45, 0.7];
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
        shader.vertexShader = shader.vertexShader.replace(
          before,
          `vGiW = gw.xyz + vec3(${CAMERA_IN_ROOM.map((n) => n.toFixed(4)).join(",")});`,
        );
        // The original renderer applies this linear exposure before its film grade.
        // Applying it here is a deliberately lossy 8-bit RTT experiment, not an optical gain.
        if (!shader.fragmentShader.includes("#include <opaque_fragment>"))
          throw new Error("Upstream PBR output hook missing");
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <opaque_fragment>",
          `outgoingLight *= ${LOOK.exposure.toFixed(1)};\n#include <opaque_fragment>`,
        );
      };
      const oldKey = m.customProgramCacheKey.bind(m);
      m.customProgramCacheKey = () => oldKey() + "|room-translation";
    }
  });
}
function makeGroup(source) {
  const group = new THREE.Group();
  for (const child of source.children) group.add(child.clone(true));
  group.position.set(...CAMERA_IN_ROOM.map((n) => -n));
  return group;
}
function App() {
  const [owner, setOwner] = useState(null),
    [error, setError] = useState(""),
    [progress, setProgress] = useState("building");
  const [camera, setCamera] = useState({
    ...DEFAULT_CAMERA_STATE,
    mode: "free",
    activeTaskId: null,
    focusDistanceMm: 2000,
    aperture: 5.6,
    mirrorShiftLessonState: { rigLateralMm: 0 },
  });
  const [mode, setMode] = useState("upright"),
    [show, setShow] = useState(true),
    [rawDebug, setRawDebug] = useState(false),
    [info, setInfo] = useState(null);
  useEffect(() => {
    let cancelled = false,
      owned = null;
    (async () => {
      const { scene } = await buildScene((p) => {
        if (!cancelled) setProgress(p);
      });
      owned = scene;
      if (cancelled) {
        disposeRoom(scene);
        owned = null;
        return;
      }
      const response = await fetch(bakeUrl);
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
      setOwner({ scene, report });
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
      if (owned) {
        disposeRoom(owned);
        owned = null;
      }
    };
  }, []);
  const optics = useMemo(() => deriveOpticsState(camera, sceneDefinition), [camera]);
  const observerGroup = useMemo(() => (owner ? makeGroup(owner.scene) : null), [owner]);
  const profile = useMemo(
    () =>
      owner
        ? {
            renderSanityIdentity: "room-at-dawn",
            configureRttShadowParticipation: () => {},
            resolveRenderBounds: () => roomBounds,
            mountSubject: (scene) => {
              const group = makeGroup(owner.scene);
              const lights = [];
              scene.traverse((o) => {
                if (o.isLight) {
                  lights.push([o, o.visible]);
                  o.visible = false;
                }
              });
              scene.add(group);
              return {
                group,
                dispose: () => {
                  scene.remove(group);
                  lights.forEach(([light, visible]) => {
                    light.visible = visible;
                  });
                },
              };
            },
          }
        : undefined,
    [owner],
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
    window.__roomOptics = { camera, optics, info, ready: !!owner, error };
  }, [camera, optics, info, owner, error]);
  return (
    <main style={{ padding: 16 }}>
      <h1>Room at Dawn — experimental Ground Glass</h1>
      <p>
        Original GI; canonical WebGL Ground Glass. Upstream linear pre-exposure is applied before
        the 8-bit target; highlights may clip. Reflections are missing.
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
              <GroundGlassRTT
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
              />
            )}
          </div>
        </section>
      </div>
      <div>
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
        {range("Focus (mm)", "focusDistanceMm", 500, 8000, CAMERA_CONTROL_STEPS.focusDistanceMm)}
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
        <button onClick={() => setShow((s) => !s)}>
          {show ? "Unmount views" : "Remount views"}
        </button>
      </div>
      <pre style={{ whiteSpace: "pre-wrap" }}>
        {JSON.stringify(
          {
            camera,
            lens: optics.lensCenterWorld,
            focusPlane: optics.focusPlane,
            backend: "WebGL",
            sceneColor: "RGBA unsigned byte",
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
