import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { buildScene } from "./vendor/src/scene/index.js";
import { inspectBake } from "./bake-check.js";
import { GI } from "./vendor/src/core/gi.js";
import { LOOK } from "./vendor/src/render/look.js";
import { ROOM_PRESETS } from "./presets.js";
import { captureRoomReflections } from "./reflection-capture.js";
import { createRoomView } from "./view-resources.js";
import { createOpticalFixtureProfile } from "./optical-fixture.js";
import { inspectOpticalFixture, measureVerticalEdgeRgba } from "./optical-measurement.js";
import { createHdrConstantFieldProfile } from "./hdr-fixture.js";
import { createHdrReadback } from "./hdr-readback.js";
import { createFocusTrace } from "./focus-trace.js";
import { createFocusStageReadback } from "./focus-stage-readback.js";
import { inspectRoomSurfaceProbes, measureRoomSurfacePatchRgba } from "./room-surface-inspection.js";
import {
  bindRoomComparisonIntent,
  createRoomComparisonIntent,
  createRoomComparisonState,
  evaluateRoomComparisonFrame,
  listRoomComparisonStateChanges,
  roomComparisonIntentMatchesGuard,
} from "./comparison-capture.ts";
import { calculateGroundGlassNaturalIlluminationGain } from "../../src/core/optics/groundGlassNaturalIllumination.ts";
import { calculateGroundGlassCoverageRenderGain } from "../../src/render/groundGlassCoverage.ts";
import bakeUrl from "./vendor/bake/gi.bin?url";
import { deriveOpticsState } from "../../src/core/optics/deriveOpticsState.ts";
import { SIMULATOR_LENS_DEFINITIONS } from "../../src/core/optics/lensCatalog.ts";
import { GroundGlassRTT } from "../../src/render/GroundGlassRTT.tsx";
import { projectWorldPointToFilmPlaneGroundGlass } from "../../src/render/groundGlassFilmPlaneProjection.ts";
import { resolveGroundGlassImageDistanceMm } from "../../src/render/groundGlassRttScenes.ts";
import { computePhysicalCoCDiameterMm } from "../../src/core/optics/thinLensModel.ts";
import { roomCameraScene } from "./room-camera-scene.ts";
import {
  DEFAULT_CAMERA_STATE,
  CAMERA_CONSTANTS,
  CAMERA_CONTROL_STEPS,
} from "../../src/utils/constants.ts";

// Each view owns its rigid room translation in metres. Canonical optics use mm.
let requestSequence = 0;
let observerRequestSequence = 0;
let observerGenerationSequence = 0;
const HDR_FIELDS = { "0.1": [0.1, 0.1, 0.1], "0.5": [0.5, 0.5, 0.5], "1": [1, 1, 1], "2": [2, 2, 2], "4": [4, 4, 4], "8": [8, 8, 8], mixed: [0.1, 2, 8] };
const focusStageEnabled = new URLSearchParams(window.location.search).get("focusStage") === "1";
const comparisonCaptureTestSeamEnabled = import.meta.env.DEV &&
  new URLSearchParams(window.location.search).get("roomCaptureTest") === "1";
const sceneDefinition = roomCameraScene;
const roomBounds = roomCameraScene.bounds;
const ROOM_RANGE_ROW_STYLE = {
  display: "grid",
  gridTemplateColumns: "minmax(8rem, 1fr) 8ch minmax(8rem, 1.2fr)",
  alignItems: "center",
  columnGap: 8,
  width: "min(100%, 640px)",
  minWidth: 0,
  marginBlock: 4,
};
const ROOM_RANGE_LABEL_STYLE = {
  minWidth: 0,
  lineHeight: 1.25,
};
const ROOM_RANGE_OUTPUT_STYLE = {
  display: "block",
  width: "8ch",
  minWidth: "8ch",
  boxSizing: "border-box",
  overflow: "hidden",
  textAlign: "right",
  whiteSpace: "nowrap",
  fontVariantNumeric: "tabular-nums",
};
const ROOM_RANGE_INPUT_STYLE = {
  width: "100%",
  minWidth: 0,
  margin: 0,
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
    this.props.onError?.(error);
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
function ComparisonCaptureTestFailureProbe({ active }) {
  if (active) throw new Error("Deterministic A/B Ground Glass renderer failure");
  return null;
}
class ObserverBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error: String(error?.message || error) };
  }
  componentDidCatch(error) {
    window.__roomObserver = {
      requestId: window.__roomOptics?.observerRequest?.requestId,
      status: "failed",
      error: String(error?.message || error),
    };
  }
  render() {
    return this.state.error ? (
      <p role="alert">Observer renderer failed: {this.state.error}</p>
    ) : (
      this.props.children
    );
  }
}
function ObserverView({
  owner,
  preset,
  reflectionsEnabled,
  displayExposure,
  request,
  lensCenterWorld,
  onStatus,
}) {
  const { gl, scene, camera, invalidate } = useThree();
  const [generation] = useState(() => `observer-generation-${++observerGenerationSequence}`);
  const sequence = useRef(0);
  const current = useRef(null);
  const lastReported = useRef(null);

  useLayoutEffect(() => {
    camera.position.set(
      lensCenterWorld.x * 0.001,
      lensCenterWorld.y * 0.001,
      lensCenterWorld.z * 0.001,
    );
    camera.up.set(0, 1, 0);
    camera.lookAt(camera.position.x, camera.position.y, camera.position.z + 1);
    camera.updateMatrixWorld(true);
    invalidate();
  }, [camera, invalidate, lensCenterWorld.x, lensCenterWorld.y, lensCenterWorld.z]);

  useLayoutEffect(() => {
    gl.outputColorSpace = THREE.SRGBColorSpace;
    gl.toneMapping = THREE.ReinhardToneMapping;
    gl.toneMappingExposure = displayExposure;
    invalidate();
  }, [gl, displayExposure, invalidate]);

  useLayoutEffect(() => {
    const view = createRoomView(owner.scene, preset.origin, GI.uniforms);
    let disposeReflection = () => {};
    let reflectionError = null;
    try {
      scene.add(view.group);
    } catch (error) {
      view.dispose();
      throw error;
    }
    try {
      if (reflectionsEnabled) {
        disposeReflection = captureRoomReflections({
          renderer: gl,
          scene,
          giUniforms: view.uniforms,
          roomBox: owner.ctx.roomBox,
          probe: new THREE.Vector3(2.35, 1.3, 2),
          roomOrigin: view.roomOrigin,
          captureExteriorScale: LOOK.ext,
        });
      }
    } catch (error) {
      reflectionError = String(error?.message || error);
    }
    current.current = { view, reflectionError };
    window.__roomObserverDebug = {
      setGiScale(value) {
        view.uniforms.giScale.value = value;
        invalidate();
      },
      giUniforms: view.uniforms,
      viewGroup: view.group,
    };
    invalidate();
    return () => {
      const errors = [];
      try {
        disposeReflection();
      } catch (error) {
        errors.push(String(error));
      }
      try {
        scene.remove(view.group);
      } catch (error) {
        errors.push(String(error));
      }
      try {
        view.dispose();
      } catch (error) {
        errors.push(String(error));
      }
      if (current.current?.view === view) current.current = null;
      if (window.__roomObserverDebug?.viewGroup === view.group) delete window.__roomObserverDebug;
      if (window.__roomObserver?.generationId === generation) delete window.__roomObserver;
      window.__roomObserverRetirements ||= [];
      window.__roomObserverRetirements.push({
        generationId: generation,
        reflectionDisposed: errors.length === 0,
        materialVariantsDisposed: errors.length === 0,
        errors,
      });
    };
  }, [owner, preset, reflectionsEnabled, gl, scene, invalidate, generation]);

  useLayoutEffect(() => {
    invalidate();
  }, [request, invalidate]);
  useFrame(() => {
    const active = current.current;
    if (!active) return;
    try {
      gl.render(scene, camera);
      const state = {
        requestId: request.requestId,
        generationId: generation,
        frameId: `${generation}:frame:${++sequence.current}`,
        status: active.reflectionError ? "failed" : "completed",
        error: active.reflectionError,
        presetKey: request.presetKey,
        hdrDiagnostic: request.hdr,
        reflectionsEnabled,
        displayExposure,
        toneMapping: gl.toneMapping,
        toneMappingExposure: gl.toneMappingExposure,
        outputColorSpace: gl.outputColorSpace,
        renderer: gl.constructor.name,
        environmentInstalled: Boolean(scene.environment),
        materialVariants: active.view.materialCount,
        giScale: active.view.uniforms.giScale.value,
        cameraPosition: camera.position.toArray(),
        cameraForward: camera.getWorldDirection(new THREE.Vector3()).toArray(),
      };
      window.__roomObserver = state;
      if (lastReported.current !== request.requestId) {
        lastReported.current = request.requestId;
        onStatus(state);
      }
    } catch (error) {
      const state = {
        requestId: request.requestId,
        generationId: generation,
        status: "failed",
        error: String(error?.message || error),
      };
      window.__roomObserver = state;
      onStatus(state);
    }
  }, 1);
  return null;
}

function App() {
  const [owner, setOwner] = useState(null),
    [error, setError] = useState(""),
    [progress, setProgress] = useState("building");
  const [presetKey, setPresetKey] = useState("wide");
  const preset = ROOM_PRESETS[presetKey];
  const [activeReferenceStateId, setActiveReferenceStateId] = useState("");
  const [generationEpoch, setGenerationEpoch] = useState(1);
  const [hdr, setHdr] = useState(true);
  const [renderQuality, setRenderQuality] = useState("high");
  const [comparisonCaptureNonce, setComparisonCaptureNonce] = useState(0);
  const [comparisonPendingSlot, setComparisonPendingSlot] = useState(null);
  const [comparisonStatus, setComparisonStatus] = useState("A/B captures stay in memory until replaced or cleared.");
  const [comparisonImages, setComparisonImages] = useState({ A: null, B: null });
  const [comparisonZoom, setComparisonZoom] = useState(1);
  const [comparisonTestRendererFailure, setComparisonTestRendererFailure] = useState(false);
  const comparisonIntentRef = useRef(null);
  const comparisonCommittedRef = useRef(null);
  const comparisonTimeoutRef = useRef(null);
  const comparisonTimeoutHandlerRef = useRef(null);
  const comparisonCaptureTokenRef = useRef(0);
  const cancelComparisonCaptureRef = useRef(null);
  const comparisonTestHarnessRef = useRef({
    failureMode: null,
    deferNextCompletedFrame: false,
    blockedRequest: null,
    deferredFrames: [],
  });
  const comparisonFrameHandlerRef = useRef(null);
  const [subjectMode, setSubjectMode] = useState("room");
  const [hdrField, setHdrField] = useState("mixed");
  const [hdrDepth, setHdrDepth] = useState(2.5);
  const probedRequest = useRef(null);
  const lastFocusStageRequest = useRef(null);
  const manualTrace = useRef(null);
  const tracedRequest = useRef(null);
  const [tracingFocus, setTracingFocus] = useState(false);
  const [reflectionsEnabled, setReflectionsEnabled] = useState(true);
  const [observerEnabled, setObserverEnabled] = useState(true);
  const [groundEnabled, setGroundEnabled] = useState(true);
  const [observerStatus, setObserverStatus] = useState(null);
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
  const observerRequest = useMemo(
    () => ({
      requestId: `observer-request-${++observerRequestSequence}`,
      presetKey,
      hdr,
      displayExposure,
      reflectionsEnabled,
      lensCenterWorld: { ...optics.lensCenterWorld },
    }),
    [
      presetKey,
      hdr,
      displayExposure,
      reflectionsEnabled,
      optics.lensCenterWorld.x,
      optics.lensCenterWorld.y,
      optics.lensCenterWorld.z,
    ],
  );
  const profile = useMemo(
    () => {
      if (subjectMode === "hdr-probe") {
        return createHdrConstantFieldProfile({ rgb: HDR_FIELDS[hdrField], depthMetres: hdrDepth });
      }
      if (subjectMode === "fixture") {
        return createOpticalFixtureProfile({
          onMount(group) {
            window.__roomFixtureGroup = group;
            group.updateWorldMatrix(true, true);
            window.__roomFixtureStagePoints = group.children.map((mesh) => ({
              id: mesh.name, worldM: mesh.getWorldPosition(new THREE.Vector3()).toArray(),
            }));
            window.__roomFixtureInspect = (dimensions) =>
              inspectOpticalFixture(group, window.__roomOptics.optics, window.__roomOptics.camera, dimensions);
            window.__roomMeasureVerticalEdge = measureVerticalEdgeRgba;
          },
          onDispose(group) {
            if (window.__roomFixtureGroup === group) {
              delete window.__roomFixtureGroup;
              delete window.__roomFixtureInspect;
              delete window.__roomMeasureVerticalEdge;
              delete window.__roomFixtureStagePoints;
            }
          },
        });
      }
      return owner
        ? {
            renderSanityIdentity: `room-at-dawn:${presetKey}`,
            configureRttShadowParticipation: () => {},
            resolveRenderBounds: () => roomBounds,
            mountSubject: (scene) => {
              const view = createRoomView(owner.scene, preset.origin, GI.uniforms, {
                bytePreExposure: hdr ? null : LOOK.exposure,
              });
              const group = view.group;
              const previousGiUniforms = scene.userData.roomGiUniforms;
              const previousRoomOrigin = scene.userData.roomOrigin;
              scene.userData.roomGiUniforms = view.uniforms;
              scene.userData.roomOrigin = view.roomOrigin;
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
                if (window.__roomSurfaceViewGroup === group) {
                  delete window.__roomSurfaceViewGroup;
                  delete window.__roomSurfaceInspect;
                  delete window.__roomSurfaceMeasureRgba;
                }
                scene.environment = previousEnvironment;
                scene.userData.roomGiUniforms = previousGiUniforms;
                scene.userData.roomOrigin = previousRoomOrigin;
                view.dispose();
                lights.forEach(([light, visible]) => {
                  light.visible = visible;
                });
              };
              try {
                scene.add(group);
                window.__roomSurfaceViewGroup = group;
                window.__roomSurfaceInspect = (probes, frameIdentity, previewMode = "upright") => {
                  const current = window.__roomOptics;
                  if (!current || current.subjectMode !== "room" || current.previewMode !== previewMode ||
                      current.request?.requestId !== frameIdentity?.requestId ||
                      current.generation?.generationId !== frameIdentity?.generationId)
                    throw new Error("Room surface probe requires the current request and renderer generation");
                  return inspectRoomSurfaceProbes({ viewGroup: group, raycastScene: scene, optics: current.optics,
                    camera: current.camera, preset, probes, frameIdentity, previewMode });
                };
                window.__roomSurfaceMeasureRgba = measureRoomSurfacePatchRgba;
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
        : undefined;
    },
    [owner, preset, presetKey, hdr, subjectMode, hdrField, hdrDepth],
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
    [camera, mode, rawDebug, presetKey, generationEpoch, hdr, displayExposure, reflectionsEnabled, renderQuality, subjectMode, hdrField, hdrDepth, comparisonCaptureNonce],
  );
  const comparisonState = useMemo(() => createRoomComparisonState({
    camera,
    presetKey,
    subjectMode,
    renderQuality,
    rawDebug,
    previewMode: mode,
    hdr,
    displayExposure,
    reflectionsEnabled,
  }), [camera, presetKey, subjectMode, renderQuality, rawDebug, mode, hdr, displayExposure, reflectionsEnabled]);
  const finishComparisonCapture = useCallback((pending) => {
    if (!pending || comparisonIntentRef.current !== pending) return false;
    comparisonIntentRef.current = null;
    comparisonCaptureTokenRef.current += 1;
    if (comparisonTimeoutRef.current !== null) window.clearTimeout(comparisonTimeoutRef.current);
    comparisonTimeoutRef.current = null;
    comparisonTimeoutHandlerRef.current = null;
    setComparisonPendingSlot(null);
    return true;
  }, []);
  const cancelComparisonCapture = useCallback((reason, guard = {}) => {
    const pending = comparisonIntentRef.current;
    if (!roomComparisonIntentMatchesGuard(pending, guard)) return false;
    if (!finishComparisonCapture(pending)) return false;
    setComparisonStatus(reason);
    return true;
  }, [finishComparisonCapture]);
  cancelComparisonCaptureRef.current = cancelComparisonCapture;
  useLayoutEffect(() => {
    const current = { request, generation, state: comparisonState };
    comparisonCommittedRef.current = current;
    const pending = comparisonIntentRef.current;
    if (!pending) return;
    if (!pending.requestId) {
      if (pending.state.fingerprint !== comparisonState.fingerprint) {
        cancelComparisonCapture("Capture cancelled because the camera or presentation changed before its request started.", {
          slot: pending.slot,
        });
        return;
      }
      comparisonIntentRef.current = bindRoomComparisonIntent(pending, request, generation);
      setComparisonStatus(`Waiting for completed ${pending.slot} frame…`);
      return;
    }
    if (pending.requestId !== request.requestId || pending.generationId !== generation.generationId ||
        pending.state.fingerprint !== comparisonState.fingerprint) {
      cancelComparisonCapture("Capture cancelled because the camera or presentation changed before the frame completed. Capture again.", {
        slot: pending.slot,
        requestId: pending.requestId,
        generationId: pending.generationId,
      });
    }
  }, [request, generation, comparisonState, cancelComparisonCapture]);
  const captureComparison = (slot) => {
    if (comparisonIntentRef.current) cancelComparisonCaptureRef.current?.("Previous capture cancelled; starting a new request.");
    const token = ++comparisonCaptureTokenRef.current;
    const state = comparisonCommittedRef.current?.state || comparisonState;
    comparisonIntentRef.current = createRoomComparisonIntent(slot, state);
    setComparisonPendingSlot(slot);
    setComparisonStatus(`Requesting a fresh Ground Glass frame for ${slot} (up to 120 seconds)…`);
    if (comparisonTimeoutRef.current !== null) window.clearTimeout(comparisonTimeoutRef.current);
    const timeoutHandler = () => {
      if (comparisonCaptureTokenRef.current !== token) return;
      cancelComparisonCaptureRef.current?.("Capture timed out waiting for its completed Ground Glass frame. Check renderer diagnostics and try again.");
    };
    comparisonTimeoutHandlerRef.current = timeoutHandler;
    comparisonTimeoutRef.current = window.setTimeout(timeoutHandler, 120_000);
    setComparisonCaptureNonce((value) => value + 1);
  };
  const clearComparison = (slot) => {
    cancelComparisonCaptureRef.current?.(`Cancelled ${slot} capture.`, { slot });
    setComparisonImages((current) => ({ ...current, [slot]: null }));
  };
  useEffect(() => () => {
    comparisonCaptureTokenRef.current += 1;
    comparisonIntentRef.current = null;
    if (comparisonTimeoutRef.current !== null) window.clearTimeout(comparisonTimeoutRef.current);
    comparisonTimeoutRef.current = null;
    comparisonTimeoutHandlerRef.current = null;
  }, []);
  useEffect(() => {
    if (!show) cancelComparisonCaptureRef.current?.("Capture cancelled because the views were unmounted.");
    else if (!groundEnabled) cancelComparisonCaptureRef.current?.("Capture cancelled because Ground Glass was unmounted.");
  }, [show, groundEnabled]);
  const handleFrame = useCallback((frame) => {
    const pendingAtEntry = comparisonIntentRef.current;
    const testHarness = comparisonTestHarnessRef.current;
    if (
      testHarness.blockedRequest && pendingAtEntry?.requestId &&
      pendingAtEntry.requestId !== testHarness.blockedRequest.requestId
    ) {
      testHarness.blockedRequest = null;
    }
    if (
      comparisonCaptureTestSeamEnabled && frame.status === "completed" && pendingAtEntry?.requestId &&
      pendingAtEntry.requestId === frame.request?.requestId &&
      pendingAtEntry.generationId === frame.generation?.generationId
    ) {
      if (testHarness.blockedRequest?.requestId === frame.request.requestId &&
          testHarness.blockedRequest?.generationId === frame.generation.generationId) return;
      if (testHarness.deferNextCompletedFrame) {
        testHarness.deferNextCompletedFrame = false;
        testHarness.blockedRequest = {
          requestId: pendingAtEntry.requestId,
          generationId: pendingAtEntry.generationId,
        };
        testHarness.deferredFrames.push(frame);
        return;
      }
      if (testHarness.failureMode) {
        const failureMode = testHarness.failureMode;
        testHarness.failureMode = null;
        testHarness.blockedRequest = {
          requestId: pendingAtEntry.requestId,
          generationId: pendingAtEntry.generationId,
        };
        testHarness.deferredFrames.push(frame);
        if (failureMode === "renderer") setComparisonTestRendererFailure(true);
        return;
      }
    }
    manualTrace.current?.record("frame-completed", { frame });
    const samples = window.__focusStageSamples;
    const sample = samples?.[samples.length - 1];
    if (sample?.frameId === frame.frameId && sample.request?.requestId === frame.request?.requestId &&
        sample.generation?.generationId === frame.generation?.generationId) {
      sample.completion = frame;
      if (frame.status === "completed" && window.__focusStageControl?.captureCanvas) {
        try {
          const canvas = document.querySelector('[data-rtt-resource-channel="default"] canvas');
          if (!canvas) throw new Error("Ground Glass canvas is unavailable");
          sample.canvasDataUrl = canvas.toDataURL("image/png");
        } catch (error) {
          sample.canvasCaptureError = String(error?.message || error);
        }
      }
    }
    if (window.__roomOptics) window.__roomOptics.frame = frame;
    const pending = comparisonIntentRef.current;
    if (!pending) return;
    const current = comparisonCommittedRef.current;
    const published = window.__roomOptics;
    const publishedState = published?.camera ? createRoomComparisonState({
      camera: published.camera,
      presetKey: published.presetKey,
      subjectMode: published.subjectMode,
      renderQuality: published.renderQuality,
      rawDebug: published.rawDebug,
      previewMode: published.previewMode,
      hdr: published.hdr,
      displayExposure: published.displayExposure,
      reflectionsEnabled: published.reflectionsEnabled,
    }) : null;
    const decision = evaluateRoomComparisonFrame(
      pending,
      frame,
      current,
      published?.request && published?.generation && publishedState
        ? { request: published.request, generation: published.generation, state: publishedState }
        : null,
    );
    if (decision.kind === "ignore") return;
    if (decision.kind === "reject") {
      cancelComparisonCaptureRef.current?.(`Capture failed: ${decision.reason}`, {
        slot: pending.slot,
        requestId: pending.requestId,
        generationId: pending.generationId,
      });
      return;
    }
    if (!finishComparisonCapture(pending)) return;
    try {
      const canvas = document.querySelector('[data-rtt-resource-channel="default"] canvas');
      if (!canvas) throw new Error("Ground Glass canvas is unavailable");
      const image = canvas.toDataURL("image/png");
      const snapshot = pending.state;
      const captured = {
        image,
        provenance: {
          composition: snapshot.presetKey,
          focalLengthMm: snapshot.camera.focalLengthMm,
          focusDistanceMm: snapshot.camera.focusDistanceMm,
          aperture: snapshot.camera.aperture,
          frontTiltDeg: snapshot.camera.frontTiltDeg,
          frontSwingDeg: snapshot.camera.frontSwingDeg,
          frontRiseMm: snapshot.camera.frontRiseMm,
          frontShiftMm: snapshot.camera.frontShiftMm,
          rearTiltDeg: snapshot.camera.rearTiltDeg,
          rearSwingDeg: snapshot.camera.rearSwingDeg,
          displayExposure: snapshot.displayExposure,
          renderQuality: snapshot.renderQuality,
          previewMode: snapshot.previewMode,
          rawDebug: snapshot.rawDebug,
          hdr: snapshot.hdr,
          reflectionsEnabled: snapshot.reflectionsEnabled,
          requestId: pending.requestId,
          generationId: pending.generationId,
          frameId: decision.frameId,
          capturedAt: new Date().toISOString(),
          width: canvas.width,
          height: canvas.height,
          comparisonState: snapshot,
          presentation: "synchronous canvas snapshot from completed Ground Glass frame callback",
        },
      };
      setComparisonImages((images) => ({ ...images, [pending.slot]: captured }));
      setComparisonStatus(`Saved ${pending.slot} from ${pending.requestId} / ${decision.frameId}.`);
    } catch (error) {
      setComparisonStatus(`Capture failed: ${String(error?.message || error)}`);
    }
  }, [finishComparisonCapture]);
  comparisonFrameHandlerRef.current = handleFrame;
  useEffect(() => {
    if (!comparisonCaptureTestSeamEnabled) return undefined;
    const harness = comparisonTestHarnessRef.current;
    const api = {
      armTimeout: () => { harness.failureMode = "timeout"; },
      armRendererFailure: () => { harness.failureMode = "renderer"; },
      deferNextCompletedFrame: () => { harness.deferNextCompletedFrame = true; },
      deferredFrameCount: () => harness.deferredFrames.length,
      deferredFrameIdentities: () => harness.deferredFrames.map((frame) => ({
        status: frame.status,
        frameId: frame.frameId,
        requestId: frame.request?.requestId ?? null,
        generationId: frame.generation?.generationId ?? null,
      })),
      replayDeferredFrame: (index) => {
        const frame = harness.deferredFrames[index];
        if (!frame) throw new Error(`No deferred completed frame at index ${index}`);
        if (harness.blockedRequest?.requestId === frame.request?.requestId &&
            harness.blockedRequest?.generationId === frame.generation?.generationId) {
          harness.blockedRequest = null;
        }
        comparisonFrameHandlerRef.current?.(frame);
      },
      firePendingTimeout: () => {
        if (!comparisonTimeoutHandlerRef.current) throw new Error("No pending A/B capture timeout is armed");
        comparisonTimeoutHandlerRef.current();
      },
      releaseRendererFailureProbe: () => setComparisonTestRendererFailure(false),
    };
    window.__roomComparisonCaptureTest = api;
    return () => {
      if (window.__roomComparisonCaptureTest === api) delete window.__roomComparisonCaptureTest;
    };
  }, []);
  const handleDisposed = useCallback((retiredGeneration, outcome, reason) => {
    cancelComparisonCaptureRef.current?.(
      `Capture cancelled because renderer generation ${retiredGeneration?.generationId || "unknown"} was disposed${reason ? `: ${reason}` : ` (${outcome || "renderer retired"})`}.`,
      { generationId: retiredGeneration?.generationId },
    );
    window.__roomRetirements ||= [];
    window.__roomRetirements.push({
      generation: retiredGeneration,
      outcome,
      reason: reason ?? null,
    });
  }, []);
  const handleRttBoundaryError = useCallback((error) => {
    const pending = comparisonIntentRef.current;
    if (!pending) return;
    cancelComparisonCaptureRef.current?.(
      `Capture cancelled after Ground Glass renderer error: ${String(error?.message || error)}.`,
      { slot: pending.slot, requestId: pending.requestId || undefined, generationId: pending.generationId || undefined },
    );
  }, []);
  const handleObservation = useCallback((observation) => {
    if (observation.scope === "request") {
      const info = observation.info;
      manualTrace.current?.record("runtime-observation", {
        request: observation.requestIdentity, generation: observation.generation,
        projectionMatrix: info?.projectionMatrix, cameraConfigurationOk: info?.cameraConfigurationOk,
        uniformPreparationError: info?.uniformPreparationError, frameExecutionError: info?.frameExecutionError,
      });
    }
    const current = window.__roomOptics;
    if (!current) return;
    current.observation = observation;
    const pending = comparisonIntentRef.current;
    const observationFailure = observation.info?.frameExecutionError || observation.info?.uniformPreparationError || observation.info?.failedPass;
    if (pending && observationFailure &&
        observation.requestIdentity?.requestId === pending.requestId &&
        observation.generation?.generationId === pending.generationId) {
      cancelComparisonCaptureRef.current?.(`Capture cancelled after Ground Glass renderer failure: ${observationFailure}.`, {
        requestId: pending.requestId,
        generationId: pending.generationId,
      });
    }
    if (
      observation.scope === "request" &&
      observation.requestIdentity?.requestId === current.request?.requestId &&
      observation.generation?.generationId === current.generation?.generationId
    )
      setInfo(observation.info);
  }, []);
  const prepareReflections = useCallback(
    (scene, renderer) => {
      if (!reflectionsEnabled || subjectMode !== "room") return () => {};
      return captureRoomReflections({
        scene,
        renderer,
        giUniforms: scene.userData.roomGiUniforms,
        roomBox: owner.ctx.roomBox,
        probe: new THREE.Vector3(2.35, 1.3, 2),
        roomOrigin: scene.userData.roomOrigin,
        captureExteriorScale: LOOK.ext,
      });
    },
    [owner, reflectionsEnabled, preset, subjectMode],
  );
  const handleInfo = useCallback((_channel, next) => setInfo(next), []);
  const handleHdrProbe = useCallback((frame) => {
    if (subjectMode !== "hdr-probe" || probedRequest.current === frame.request.requestId) return;
    probedRequest.current = frame.request.requestId;
    let reader;
    try {
      reader = createHdrReadback(frame.renderer);
      const stages = {};
      for (const [name, target] of Object.entries(frame.targets)) {
        const x = Math.floor(target.width / 2), y = Math.floor(target.height / 2);
        stages[name] = { rgba: reader.read(target, x, y), x, y, width: target.width, height: target.height, type: "RGBA HalfFloat", colorSpace: target.texture.colorSpace };
      }
      const composite = stages.composite;
      const windowMm = frame.physical.naturalIllumination.filmWindow;
      let u = (composite.x + 0.5) / composite.width, v = (composite.y + 0.5) / composite.height;
      if (mode === "raw") { u = 1 - u; v = 1 - v; }
      const filmX = windowMm.centerXMm + (u - 0.5) * windowMm.widthMm;
      const filmY = windowMm.centerYMm - (v - 0.5) * windowMm.heightMm;
      const natural = frame.physical.naturalIllumination;
      const naturalGain = natural.enabled && natural.geometry ? calculateGroundGlassNaturalIlluminationGain(natural.geometry, filmX, filmY) : 1;
      const coverageGain = calculateGroundGlassCoverageRenderGain(frame.physical.coverage, filmX, filmY);
      const gain = frame.physical.relativeIlluminanceGain * naturalGain * coverageGain;
      const nearAlpha = Math.min(1, Math.max(0, stages.near.rgba[3]));
      const expectedComposite = stages.far.rgba.slice(0, 3).map((value, i) => (value * (1 - nearAlpha) + stages.near.rgba[i] * nearAlpha) * gain);
      window.__roomHdrProbe = { status: "sampled", request: frame.request, generation: frame.generation, frameId: frame.frameId, input: HDR_FIELDS[hdrField], depthMetres: hdrDepth, physical: frame.physical, displayExposure: frame.displayExposure, renderer: { type: frame.renderer.constructor.name, outputColorSpace: frame.renderer.outputColorSpace, toneMapping: frame.renderer.toneMapping, toneMappingExposure: frame.renderer.toneMappingExposure }, stages, expectedComposite, filmPointMm: [filmX, filmY], naturalGain, coverageGain, readback: "GPU fixed-point RGBA8 transport, 1/4096 linear units" };
    } catch (error) {
      window.__roomHdrProbe = { status: "failed", request: frame.request, generation: frame.generation, frameId: frame.frameId, error: String(error?.message || error) };
    } finally {
      reader?.dispose();
    }
  }, [subjectMode, hdrField, hdrDepth, mode]);
  const handleFocusStage = useCallback((frame) => {
    const config = window.__focusStageControl;
    if (!focusStageEnabled || !config?.enabled || lastFocusStageRequest.current === frame.request.requestId) return;
    lastFocusStageRequest.current = frame.request.requestId;
    let reader;
    const base = { request: frame.request, generation: frame.generation, frameId: frame.frameId,
      resourceGeneration: frame.resourceGeneration, timestampMs: performance.now(), camera: frame.camera,
      physical: frame.physical, cocStorageFormat: frame.cocStorageFormat, cocStorageMaxMm: frame.cocStorageMaxMm,
      footprintStorageMaxMm: frame.footprintStorageMaxMm, depthSource: frame.depthSource,
      renderQuality: frame.renderQuality, targetStorage: frame.targetStorage };
    try {
      if (!Array.isArray(config.points) || config.points.length === 0 || config.points.length > 8)
        throw new Error("Focus stage probe requires one to eight explicit world-space points");
      if (!frame.depthTexture || frame.depthSource !== "scene-depth-texture")
        throw new Error("Focus stage probe requires the actual scene depth texture");
      reader = createFocusStageReadback(frame.renderer);
      const view = new THREE.Matrix4().fromArray(frame.camera.matrixWorldInverse);
      const projection = new THREE.Matrix4().fromArray(frame.camera.projectionMatrix);
      const points = config.points.map((point) => {
        let u, v, ndcZ = null;
        if (Array.isArray(point.uv) && point.uv.length === 2 && point.uv.every(Number.isFinite)) {
          [u, v] = point.uv;
        } else if (Array.isArray(point.worldM) && point.worldM.length === 3 && point.worldM.every(Number.isFinite)) {
          const ndc = new THREE.Vector3(...point.worldM).applyMatrix4(view).applyMatrix4(projection);
          u = (ndc.x + 1) / 2; v = (ndc.y + 1) / 2; ndcZ = ndc.z;
        } else throw new Error(`Focus stage point ${point.id || "unknown"} requires finite world metres or UV`);
        if (![u, v].every(Number.isFinite) || u < 0 || u >= 1 || v < 0 || v >= 1 || (ndcZ !== null && (!Number.isFinite(ndcZ) || ndcZ < -1 || ndcZ > 1)))
          return { id: point.id, worldM: point.worldM, valid: false, rejection: "outside current camera frustum" };
        const coordinate = (target) => [Math.min(target.width - 1, Math.floor(u * target.width)), Math.min(target.height - 1, Math.floor(v * target.height))];
        const sampleColor = (target) => reader.readColor(target, ...coordinate(target));
        const [dx, dy] = coordinate(frame.targets.scene);
        return { id: point.id, worldM: point.worldM ?? null, valid: true, sourceUv: [u, v], ndcZ,
          scene: sampleColor(frame.targets.scene), depth: reader.readDepth(frame.depthTexture, dx, dy),
          coc: sampleColor(frame.cocTarget), far: sampleColor(frame.targets.far),
          near: sampleColor(frame.targets.near), composite: sampleColor(frame.targets.composite) };
      });
      window.__focusStageSamples ||= [];
      window.__focusStageSamples.push({ ...base, status: "sampled", points });
      if (window.__focusStageSamples.length > 256) { window.__focusStageSamples.shift(); window.__focusStageDropped = (window.__focusStageDropped || 0) + 1; }
    } catch (error) {
      window.__focusStageSamples ||= [];
      window.__focusStageSamples.push({ ...base, status: "failed", error: String(error?.message || error) });
      if (window.__focusStageSamples.length > 256) { window.__focusStageSamples.shift(); window.__focusStageDropped = (window.__focusStageDropped || 0) + 1; }
    } finally {
      reader?.dispose();
    }
  }, []);
  const handleObserverStatus = useCallback((next) => setObserverStatus(next), []);
  const set = (key, value) => {
    setActiveReferenceStateId("");
    setCamera((c) => ({ ...c, [key]: value }));
  };
  const rangeControl = (id, label, value, min, max, step, onChange) => (
    <div style={ROOM_RANGE_ROW_STYLE}>
      <label htmlFor={`room-at-dawn-${id}`} style={ROOM_RANGE_LABEL_STYLE}>
        {label}:
      </label>
      <output
        htmlFor={`room-at-dawn-${id}`}
        aria-hidden="true"
        style={ROOM_RANGE_OUTPUT_STYLE}
      >
        {value}
      </output>
      <input
        id={`room-at-dawn-${id}`}
        aria-label={label}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value), e)}
        style={ROOM_RANGE_INPUT_STYLE}
      />
    </div>
  );
  const range = (label, key, min, max, step) =>
    rangeControl(key, label, camera[key], min, max, step, (value, event) => {
      if (key === "focusDistanceMm")
        manualTrace.current?.record("focus-input", {
          focusDistanceMm: value,
          trusted: event.nativeEvent.isTrusted,
        });
      set(key, value);
    });
  useEffect(() => {
    if (manualTrace.current && tracedRequest.current !== request.requestId) {
      tracedRequest.current = request.requestId;
      manualTrace.current.record("state-committed", {
        request, generation, camera, lensCenterWorld: optics.lensCenterWorld,
        filmPlane: optics.filmPlane, filmPlaneCornersWorld: optics.filmPlaneCornersWorld,
        focusPlane: optics.focusPlane, imageDistanceMm: resolveGroundGlassImageDistanceMm(optics),
        presetKey, subjectMode, renderQuality, rawDebug, previewMode: mode, hdr,
        displayExposure, reflectionsEnabled,
      });
    }
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
      subjectIdentity: subjectMode === "fixture" ? "room-optical-fixture" : subjectMode === "hdr-probe" ? `hdr-constant:${HDR_FIELDS[hdrField].join(",")}:${hdrDepth}` : `room-at-dawn:${presetKey}`,
      subjectMode,
      hdrField,
      hdrDepth,
      preset,
      hdr,
      renderQuality,
      displayExposure,
      reflectionsEnabled,
      observerRequest,
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
    renderQuality,
    subjectMode,
    hdrField,
    hdrDepth,
    displayExposure,
    reflectionsEnabled,
    observerRequest,
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
      {subjectMode === "hdr-probe" && (!hdr || rawDebug) && (
        <p role="alert">HDR radiance readback requires the HalfFloat color path and processed RTT; the byte and Raw RTT diagnostic paths are unsupported.</p>
      )}
      <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
        <section>
          <h2>Room observer</h2>
          <div style={{ width: 480, height: 360, background: "#111" }}>
            {owner && show && observerEnabled && (
              <ObserverBoundary>
                <Canvas
                  frameloop="demand"
                  camera={{ position: [0, 0, 0], fov: 65, near: 0.02, far: 100 }}
                >
                  <ObserverView
                    owner={owner}
                    preset={preset}
                    reflectionsEnabled={reflectionsEnabled}
                    displayExposure={displayExposure}
                    request={observerRequest}
                    lensCenterWorld={optics.lensCenterWorld}
                    onStatus={handleObserverStatus}
                  />
                </Canvas>
              </ObserverBoundary>
            )}
            {observerStatus?.status === "failed" && (
              <p role="alert">
                Observer renderer or reflection capture failed: {observerStatus.error}
              </p>
            )}
          </div>
        </section>
        <section>
          <h2>Ground Glass ({mode})</h2>
          <div style={{ width: 480, height: 360, background: "#111" }}>
            {owner && show && groundEnabled && (
              <RenderBoundary key={generationEpoch} onError={handleRttBoundaryError}>
                {comparisonCaptureTestSeamEnabled && (
                  <ComparisonCaptureTestFailureProbe active={comparisonTestRendererFailure} />
                )}
                <GroundGlassRTT
                  key={generationEpoch}
                  developmentHdrColor={hdr}
                  developmentDisplayExposure={displayExposure}
                  developmentPrepareScene={prepareReflections}
                  developmentProbeFrame={subjectMode === "hdr-probe" ? handleHdrProbe : focusStageEnabled ? handleFocusStage : undefined}
                  opticsState={optics}
                  focalLengthMm={camera.focalLengthMm}
                  scene={sceneDefinition}
                  widthPx={480}
                  heightPx={360}
                  aperture={camera.aperture}
                  previewMode={mode}
                  rawDebug={rawDebug}
                  renderQuality={renderQuality}
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
          Subject{" "}
          <select aria-label="Subject" value={subjectMode} onChange={(e) => {
            setSubjectMode(e.target.value);
            setGenerationEpoch((n) => n + 1);
          }}>
            <option value="room">Original room</option>
            <option value="fixture">Optical diagnostic fixture</option>
            <option value="hdr-probe">HDR radiance diagnostic</option>
          </select>
        </label>
        {subjectMode === "hdr-probe" && <>
          <label>HDR input <select aria-label="HDR input" value={hdrField} onChange={(e) => { setHdrField(e.target.value); setGenerationEpoch((n) => n + 1); }}>
            {Object.keys(HDR_FIELDS).map((key) => <option key={key} value={key}>{key}</option>)}
          </select></label>
          <label>HDR field depth <select aria-label="HDR field depth" value={hdrDepth} onChange={(e) => { setHdrDepth(Number(e.target.value)); setGenerationEpoch((n) => n + 1); }}>
            <option value={2.5}>2.5 m focused</option><option value={0.8}>0.8 m near</option>
          </select></label>
        </>}
        <label>
          Render quality{" "}
          <select aria-label="Render quality" value={renderQuality} onChange={(e) => setRenderQuality(e.target.value)}>
            <option value="low">Low</option>
            <option value="standard">Standard</option>
            <option value="high">High</option>
          </select>
        </label>
        <label>
          Lens{" "}
          <select
            aria-label="Lens"
            value={camera.focalLengthMm}
            onChange={(event) => set("focalLengthMm", Number(event.target.value))}
          >
            {SIMULATOR_LENS_DEFINITIONS.map((lens) => (
              <option key={lens.id} value={lens.focalLengthMm}>
                {lens.focalLengthMm} mm
                {lens.coverage.kind === "angular" ? ` · ${lens.coverage.fullCoverageAngleDeg}° coverage` : ""}
              </option>
            ))}
          </select>
        </label>
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
            max="400"
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
        <small>Display-only exposure for viewing; it does not alter physical aperture illumination.</small>
        <label>
          Composition{" "}
          <select
            aria-label="Composition"
            value={presetKey}
            onChange={(e) => {
              const key = e.target.value;
              const selected = ROOM_PRESETS[key];
              setActiveReferenceStateId("");
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
        {Array.isArray(preset.referenceStates) && preset.referenceStates.length > 0 && (
          <label>
            Optical reference state{" "}
            <select
              aria-label="Optical reference state"
              value={activeReferenceStateId}
              onChange={(event) => {
                const reference = preset.referenceStates.find((item) => item.id === event.target.value);
                if (!reference) {
                  setActiveReferenceStateId("");
                  return;
                }
                const allowedCameraKeys = new Set([
                  "focalLengthMm", "focusDistanceMm", "aperture",
                  "frontRiseMm", "frontShiftMm", "frontTiltDeg", "frontSwingDeg",
                  "rearRiseMm", "rearShiftMm", "rearTiltDeg", "rearSwingDeg",
                ]);
                const updates = Object.fromEntries(Object.entries(reference.camera || {}).filter(
                  ([key, value]) => allowedCameraKeys.has(key) && typeof value === "number" && Number.isFinite(value),
                ));
                setCamera((current) => ({ ...current, ...updates }));
                setActiveReferenceStateId(reference.id);
              }}
            >
              <option value="">Manual camera settings</option>
              {preset.referenceStates.map((reference) => (
                <option key={reference.id} value={reference.id}>{reference.label}</option>
              ))}
            </select>
          </label>
        )}
        {rangeControl(
          "cameraLateralMm",
          "Camera lateral position (mm)",
          camera.mirrorShiftLessonState.rigLateralMm,
          -1000,
          1000,
          50,
          (value) => set("mirrorShiftLessonState", { rigLateralMm: value }),
        )}
        {range("Rise (mm)", "frontRiseMm", 0, 40, CAMERA_CONTROL_STEPS.riseMm)}
        {range("Shift (mm)", "frontShiftMm", -60, 60, CAMERA_CONTROL_STEPS.shiftMm)}
        {range("Tilt (degrees)", "frontTiltDeg", -10, 10, CAMERA_CONTROL_STEPS.tiltDeg)}
        {range("Swing (degrees)", "frontSwingDeg", -10, 10, CAMERA_CONTROL_STEPS.swingDeg)}
        {range("Focus (mm)", "focusDistanceMm", 100, 8000, CAMERA_CONTROL_STEPS.focusDistanceMm)}
        <button type="button" onClick={() => {
          if (!tracingFocus) {
            manualTrace.current = createFocusTrace();
            tracedRequest.current = null;
            manualTrace.current.record("initial-state", { request, generation, camera, presetKey, subjectMode, renderQuality, rawDebug, hdr, displayExposure, reflectionsEnabled });
            setTracingFocus(true);
          } else {
            const data = manualTrace.current?.stop();
            manualTrace.current = null;
            setTracingFocus(false);
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a"); link.href = url; link.download = "room-focus-trace.json"; link.click(); setTimeout(() => URL.revokeObjectURL(url), 0);
          }
        }}>{tracingFocus ? "Stop and download Focus trace" : "Record Focus trace"}</button>
        {tracingFocus && <span> Recording frame completion telemetry; this does not prove display presentation.</span>}
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
            if (groundEnabled) cancelComparisonCaptureRef.current?.("Capture cancelled because Ground Glass was unmounted.");
            if (!groundEnabled) setGenerationEpoch((n) => n + 1);
            setGroundEnabled((v) => !v);
          }}
        >
          {groundEnabled ? "Unmount Ground Glass" : "Remount Ground Glass"}
        </button>{" "}
        <button onClick={() => setObserverEnabled((v) => !v)}>
          {observerEnabled ? "Unmount Observer" : "Remount Observer"}
        </button>{" "}
        <button
          onClick={() => {
            if (show) cancelComparisonCaptureRef.current?.("Capture cancelled because the views were unmounted.");
            if (!show) setGenerationEpoch((n) => n + 1);
            setShow((s) => !s);
          }}
        >
          {show ? "Unmount views" : "Remount views"}
        </button>
      </div>
      <section aria-label="Ground Glass A/B comparison" style={{ marginBlock: 24, maxWidth: 1000 }}>
        <h2>Ground Glass A/B comparison</h2>
        <p>Captures use the next completed Ground Glass frame and retain native pixels in this page's memory.</p>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          {["A", "B"].map((slot) => (
            <span key={slot}>
              <button
                type="button"
                disabled={!owner || !show || !groundEnabled || subjectMode !== "room" || Boolean(comparisonPendingSlot)}
                onClick={() => captureComparison(slot)}
              >
                {comparisonPendingSlot === slot ? `Capturing ${slot}…` : `${comparisonImages[slot] ? `Replace ${slot}` : `Capture ${slot}`}`}
              </button>{" "}
              <button type="button" disabled={!comparisonImages[slot] && comparisonPendingSlot !== slot} onClick={() => clearComparison(slot)}>
                Clear {slot}
              </button>
            </span>
          ))}
          <label>
            Shared crop zoom{" "}
            <input aria-label="Comparison zoom" type="range" min="1" max="4" step="0.25" value={comparisonZoom} onChange={(event) => setComparisonZoom(Number(event.target.value))} />
            {comparisonZoom.toFixed(2)}×
          </label>
          <span role="status" aria-live="polite">{comparisonStatus}</span>
        </div>
        {comparisonImages.A && comparisonImages.B && (() => {
          const changes = listRoomComparisonStateChanges(
            comparisonImages.A.provenance.comparisonState,
            comparisonImages.B.provenance.comparisonState,
          );
          return (
            <div aria-label="A/B camera state differences" style={{ marginBlock: 12 }}>
              <strong>{changes.length ? `${changes.length} recorded setting${changes.length === 1 ? "" : "s"} changed:` : "No recorded camera or presentation settings changed."}</strong>
              {changes.length > 0 && <ul>
                {changes.map((change) => <li key={change.key}>{change.label}: A {String(change.a)} → B {String(change.b)}</li>)}
              </ul>}
            </div>
          );
        })()}
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-start", marginTop: 12 }}>
          {["A", "B"].map((slot) => {
            const capture = comparisonImages[slot];
            return (
              <article key={slot} aria-label={`Capture ${slot}`} style={{ width: 480, maxWidth: "100%" }}>
                <h3>{slot}{capture ? ` · ${capture.provenance.focalLengthMm} mm · ${capture.provenance.focusDistanceMm} mm · f/${capture.provenance.aperture}` : " · empty"}</h3>
                <div style={{ width: "100%", aspectRatio: "4 / 3", overflow: "hidden", background: "#111", display: "grid", placeItems: "center" }}>
                  {capture ? <img
                    src={capture.image}
                    alt={`Ground Glass capture ${slot} at ${capture.provenance.focusDistanceMm} millimetres focus`}
                    style={{ width: "100%", height: "100%", objectFit: "contain", transform: `scale(${comparisonZoom})`, transformOrigin: "center" }}
                  /> : <span>No capture</span>}
                </div>
                {capture && <details>
                  <summary>Frame and camera details</summary>
                  <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(capture.provenance, null, 2)}</pre>
                </details>}
              </article>
            );
          })}
        </div>
      </section>
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
            observer: observerStatus,
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
