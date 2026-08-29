import React, { useEffect, useId, useLayoutEffect, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { CAMERA_CONSTANTS } from "../utils/constants";
import { ACCEPTABLE_COC_DIAMETER_MM } from "../core/optics/physicalSharpness";

const SKY_COLOR = new THREE.Color("#dfe5ec");
const GROUND_GLASS_GL_OPTIONS = { preserveDrawingBuffer: false } as const;
import { vecToWorld } from "./rttUtils";
import {
  CAMERA_MOVEMENT_BASELINE_RENDER_MODEL,
  resolveCameraMovementLatticeRenderModel,
} from "./cameraMovementLatticeRenderModel";
import {
  getGroundGlassSceneProfile,
  type GroundGlassSceneProfileContext,
  type GroundGlassSceneProfileUpdateContext,
  type MountedGroundGlassSceneSubject,
} from "./groundGlassSceneProfiles";
import {
  configureGroundGlassCamera,
  readGroundGlassCameraPose,
} from "./configureGroundGlassCamera";
import {
  applyGroundGlassDofUniformState,
  createGroundGlassDofUniformState,
  synchronizeGroundGlassDofClipRange,
} from "./createGroundGlassDofUniformState";
import {
  groundGlassApertureGatherFragmentShader,
  groundGlassCompositeFragmentShader,
  groundGlassPhysicalCocFragmentShader,
  groundGlassVertexShader,
} from "./groundGlassDofShaderSources";
import type { DerivedOpticsState } from "../types/optics";
import type { SceneDefinition } from "../types/scene";
import type { EffectiveCameraMovementCalibration } from "../scenes/cameraMovementEffectiveCalibration";
import type { WebGLRenderer } from "three";
import { getRenderQualitySettings } from "./renderQuality";
import {
  getGroundGlassClipRangeWorld,
  resolveGroundGlassImageDistanceMm,
} from "./groundGlassRttScenes";
import {
  getGroundGlassDofVisualSettings,
  resolveGroundGlassDisplayOpticsState,
} from "./groundGlassVisualSettings";
import { analyzeGroundGlassRenderSanity } from "./groundGlassRenderSanity";
import { resolveGroundGlassRttDimensions } from "./groundGlassRttDimensions";
import { createGroundGlassRenderSanityStateKey } from "./groundGlassRenderSanityKey";
import { resizeGroundGlassRttResources } from "./groundGlassRttResources";
import {
  createGroundGlassCocTarget,
  resolveGroundGlassCocStorageMaxMm,
  type GroundGlassCocStorageFormat,
} from "./groundGlassCocTarget";
import {
  GroundGlassProfiler,
  isGroundGlassProfilingEnabled,
  type GroundGlassProfilingConfiguration,
  type GroundGlassProfilingPass,
} from "./groundGlassProfiling";
import type {
  GroundGlassRttChannel,
  GroundGlassRttRuntimeInfo,
  GroundGlassRttRuntimeInfoChangeHandler,
} from "./groundGlassRttDimensions";
import type { CameraMovementPresentationRegion } from "../scenes/cameraMovementSceneCalibration";

export type GroundGlassRTTProps = {
  opticsState: DerivedOpticsState;
  focalLengthMm: number;
  /** Explicit scene definition for bounds and focus-target projection. */
  scene: SceneDefinition;
  widthPx: number;
  heightPx: number;
  aperture?: number; // f-number for DOF calculations
  previewMode?: "raw" | "upright";
  rawDebug?: boolean;
  renderQuality?: import("../types/ui").RenderQualityProfile;
  zoomEnabled?: boolean;
  /** Independent RTT resource/diagnostic channel for comparison panes. */
  channel?: GroundGlassRttChannel;
  /** Explicit visual lattice presentation for comparison panes. */
  presentationRegion?: CameraMovementPresentationRegion;
  /** Effective calibration selected by the application boundary. */
  effectiveCameraMovementCalibration?: EffectiveCameraMovementCalibration;
  /** Application-owned diagnostics adapter. */
  onRuntimeInfoChange?: GroundGlassRttRuntimeInfoChangeHandler;
};

const tupleMatches = (
  left: [number, number, number] | undefined,
  right: [number, number, number],
): boolean =>
  Boolean(left?.every((value, index) => Math.abs(value - right[index]) < 1e-9));

function OffscreenRenderer({ opticsState, focalLengthMm, scene: sceneDefinition, widthPx, heightPx, aperture = 11.0, previewMode = 'raw', rawDebug = false, renderQuality = "standard", zoomEnabled = false, channel = "default", presentationRegion: explicitPresentationRegion, effectiveCameraMovementCalibration, onRuntimeInfoChange, }: GroundGlassRTTProps) {
  // React gives each mounted renderer a stable identity without a module-level
  // mutable registry. It survives ordinary prop changes and is replaced only
  // when this OffscreenRenderer instance is actually remounted.
  const runtimeOwnerId = `ground-glass-rtt-owner-${useId()}`;
  // single-frame flag to avoid repeating uniform-preparation warnings every frame
  const reportedUniformPreparationErrorRef = React.useRef<string | null>(null);
  const reportedCameraConfigurationErrorRef = React.useRef<string | null>(null);
  const lastRenderSanityStateKeyRef = React.useRef<string | null>(null);
  const renderTarget = useRef<THREE.WebGLRenderTarget | null>(null);
  const offscreenScene = useRef<THREE.Scene | null>(null);
  const groundGlassCamera = useRef<THREE.PerspectiveCamera | null>(null);
  const presentationRegionRef = useRef<CameraMovementPresentationRegion>("middle");
  const runtimeInfoRef = useRef<GroundGlassRttRuntimeInfo | null>(null);
  const runtimeInfoChangeRef = useRef(onRuntimeInfoChange);
  runtimeInfoChangeRef.current = onRuntimeInfoChange;

  const { gl } = useThree();
  const presentationRegion = explicitPresentationRegion ?? "middle";
  presentationRegionRef.current = presentationRegion;
  const cameraMovementRenderModel = effectiveCameraMovementCalibration
    ? resolveCameraMovementLatticeRenderModel(effectiveCameraMovementCalibration)
    : CAMERA_MOVEMENT_BASELINE_RENDER_MODEL;
  const resolvedSceneId = sceneDefinition.id;
  const sceneProfile = getGroundGlassSceneProfile(sceneDefinition);
  const { maximumBlurRadiusPx } = getGroundGlassDofVisualSettings(resolvedSceneId);
  const profilingEnabled = isGroundGlassProfilingEnabled();

  // RTT dimensions reference so both effect and frame loop can access current internal sizes
  const dimsRef = React.useRef(resolveGroundGlassRttDimensions({ logicalWidth: widthPx, logicalHeight: heightPx, renderQuality: renderQuality || "standard", devicePixelRatio: 1, zoomEnabled }));

  // refs for instance-owned resources (avoid storing on function object)
  type PostResources = {
    postSceneCoc: THREE.Scene;
    postSceneGather: THREE.Scene;
    postSceneComposite: THREE.Scene;
    orthoCam: THREE.OrthographicCamera;
    cocRT: THREE.WebGLRenderTarget;
    cocStorageFormat: GroundGlassCocStorageFormat;
    gatherRT: THREE.WebGLRenderTarget;
    nearGatherRT: THREE.WebGLRenderTarget;
    finalRT: THREE.WebGLRenderTarget;
    rawDiagnosticRT: THREE.WebGLRenderTarget;
    finalDiagnosticRT: THREE.WebGLRenderTarget;
    displayScene: THREE.Scene;
    copyMaterial: THREE.ShaderMaterial;
  };
  const postResourcesRef = React.useRef<PostResources | null>(null);
  const groundGlassProfilerRef = React.useRef<GroundGlassProfiler | null>(null);
  const fallbackDepthRef = React.useRef<THREE.DataTexture | null>(null);
  const resourceGenerationRef = React.useRef<number>(0);
  const focalLengthMmRef = React.useRef(focalLengthMm);
  focalLengthMmRef.current = focalLengthMm;
  const lightingRigRef = React.useRef<{
    keyLight: THREE.DirectionalLight;
    fillLight: THREE.DirectionalLight;
    target: THREE.Object3D;
  } | null>(null);
  const mountedSceneSubjectRef = useRef<MountedGroundGlassSceneSubject | null>(null);
  const sizeInputsRef = React.useRef({ widthPx, heightPx, renderQuality, zoomEnabled });
  sizeInputsRef.current = { widthPx, heightPx, renderQuality, zoomEnabled };

  const readRuntimeInfo = React.useCallback(() => runtimeInfoRef.current, []);
  const setRuntimeInfo = React.useCallback(
    (info: GroundGlassRttRuntimeInfo | null) => {
      const enriched = info
        ? { ...info, channel, ownerId: runtimeOwnerId }
        : null;
      runtimeInfoRef.current = enriched;
      runtimeInfoChangeRef.current?.(channel, enriched, runtimeOwnerId);
    },
    [channel, runtimeOwnerId],
  );

  // clear RTT runtime diagnostics when this renderer unmounts or is recreated
  React.useEffect(() => {
    return () => {
      try {
        setRuntimeInfo(null);
      } catch (err) { void err; }
    };
  }, [setRuntimeInfo]);

  // expose preview/ring hints on the function object so runtime code inside useFrame can access them

  useEffect(() => {
    const sizeInputs = sizeInputsRef.current;
    const initialQualitySettings = getRenderQualitySettings(
      sizeInputs.renderQuality || "standard",
    );
    const initialMaximumCoCRadiusPx = Math.min(
      maximumBlurRadiusPx,
      initialQualitySettings.maximumCoCRadiusPx,
    );
    // resolve desired internal RTT dimensions from quality profile, DPR and zoom state
    const rendererPixelRatio = (gl && typeof gl.getPixelRatio === 'function') ? gl.getPixelRatio() : (typeof window !== 'undefined' && window.devicePixelRatio) ? window.devicePixelRatio : 1;

    // collect canvas DOM and size info. Canvas DPR is authoritative from parent Canvas dpr prop
    const canvas = (gl && (gl as unknown as WebGLRenderer).domElement) as HTMLCanvasElement | undefined;
    const canvasRect = canvas ? canvas.getBoundingClientRect() : { width: sizeInputs.widthPx, height: sizeInputs.heightPx };
    const canvasCssWidth = Math.round(canvasRect.width);
    const canvasCssHeight = Math.round(canvasRect.height);
    const drawingBufferWidth = canvas ? canvas.width : Math.round(sizeInputs.widthPx * rendererPixelRatio);
    const drawingBufferHeight = canvas ? canvas.height : Math.round(sizeInputs.heightPx * rendererPixelRatio);

    const dims = resolveGroundGlassRttDimensions({
      logicalWidth: sizeInputs.widthPx,
      logicalHeight: sizeInputs.heightPx,
      renderQuality: sizeInputs.renderQuality || "standard",
      devicePixelRatio: rendererPixelRatio,
      zoomEnabled: sizeInputs.zoomEnabled,
    });
    dimsRef.current = dims;

    // create main render target at the resolved internal size
    const rt = new THREE.WebGLRenderTarget(dimsRef.current.internalWidthPx, dimsRef.current.internalHeightPx);
    // attach a depth texture so we can do depth-aware DOF
    // DepthTexture constructor typing varies across three.js versions; access via unknown and a conservative factory
    type UnknownCtor = new (...args: unknown[]) => unknown;
    const DepthTextureCtor = (THREE as unknown as { DepthTexture?: UnknownCtor }).DepthTexture;
    const depthTex = DepthTextureCtor ? new DepthTextureCtor(dimsRef.current.internalWidthPx, dimsRef.current.internalHeightPx) : undefined;
    if (depthTex) {
      (depthTex as unknown as { type?: number }).type = (THREE as unknown as { UnsignedShortType?: number }).UnsignedShortType ?? (THREE as unknown as { UnsignedIntType?: number }).UnsignedIntType;
      (rt as unknown as { depthTexture?: unknown }).depthTexture = depthTex as unknown;
      rt.depthBuffer = true;
    } else {
      // depth texture not available in this three.js build — still proceed without it
      rt.depthBuffer = true;
    }
    // Do not set texture encoding here — some three.js builds do not export sRGBEncoding
    // and static bundlers warn. Rely on default texture encoding for safety.
    renderTarget.current = rt;

    // create a tiny 1x1 depth fallback texture used when the renderer/build does not supply a depthTexture
    const depthFallbackData = new Uint8Array([255, 255, 255, 255]);
    const fallbackDepth = new THREE.DataTexture(depthFallbackData, 1, 1, THREE.RGBAFormat);
    fallbackDepth.needsUpdate = true;
    fallbackDepthRef.current = fallbackDepth;

    // increment resource generation — used for diagnostics to detect recreations
    resourceGenerationRef.current += 1;


    const scene = new THREE.Scene();
    offscreenScene.current = scene;
    const camera = new THREE.PerspectiveCamera(
      45,
      dims.logicalWidthPx / dims.logicalHeightPx,
      0.01,
      100,
    );
    groundGlassCamera.current = camera;

    // set a light, sky and floor that match the studio look for Focus Fundamentals
    // We'll add a Hemisphere + key + fill lighting setup below so materials look natural;
    // For consistency we do not add ambient light here to avoid double-lighting when the subject factory also supplies lights.

    // No immediate lights added here; the standardized lighting is applied per-scene in the rendering pipeline below.
    // scene.add(...) will be done after subject group setup where appropriate.
    

    // Create the explicit physical DOF pipeline:
    // scene color/depth -> full-resolution signed CoC -> near/far gathers -> composite.
    const postSceneCoc = new THREE.Scene();
    const postSceneGather = new THREE.Scene();
    const postSceneComposite = new THREE.Scene();
    const orthoCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const cocStorage = createGroundGlassCocTarget(
      gl as unknown as WebGLRenderer,
      dimsRef.current.internalWidthPx,
      dimsRef.current.internalHeightPx,
    );
    const cocRT = cocStorage.target;
    cocRT.depthBuffer = false;
    const initialCocStorageMaxMm = resolveGroundGlassCocStorageMaxMm({
      maximumCoCRadiusPx: initialMaximumCoCRadiusPx,
      filmWidthMm: CAMERA_CONSTANTS.filmWidthMm,
      renderWidthPx: dimsRef.current.internalWidthPx,
    });
    const initialFootprintStorageMaxMm = Math.max(1e-6, initialCocStorageMaxMm * 0.5);
    const gatherRT = new THREE.WebGLRenderTarget(
      Math.max(1, Math.floor(dimsRef.current.internalWidthPx * initialQualitySettings.gatherScale)),
      Math.max(1, Math.floor(dimsRef.current.internalHeightPx * initialQualitySettings.gatherScale)),
      {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        depthBuffer: false,
        stencilBuffer: false,
      },
    );
    gatherRT.depthBuffer = false;
    const nearGatherRT = new THREE.WebGLRenderTarget(
      Math.max(1, Math.floor(dimsRef.current.internalWidthPx * initialQualitySettings.gatherScale)),
      Math.max(1, Math.floor(dimsRef.current.internalHeightPx * initialQualitySettings.gatherScale)),
      {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        depthBuffer: false,
        stencilBuffer: false,
      },
    );
    nearGatherRT.depthBuffer = false;
    const finalRT = new THREE.WebGLRenderTarget(
      dimsRef.current.internalWidthPx,
      dimsRef.current.internalHeightPx,
    );
    finalRT.depthBuffer = false;
    const rawDiagnosticRT = new THREE.WebGLRenderTarget(32, 32);
    rawDiagnosticRT.depthBuffer = false;
    const finalDiagnosticRT = new THREE.WebGLRenderTarget(32, 32);
    finalDiagnosticRT.depthBuffer = false;
    const displayScene = new THREE.Scene();


    // set scene background to a neutral studio sky for better visibility
    scene.background = SKY_COLOR;
    // create full-screen quad geometry and placeholder materials
    const quadGeo = new THREE.PlaneGeometry(2, 2);

    const vertexShader = groundGlassVertexShader;

    const cocMaterial = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader: groundGlassPhysicalCocFragmentShader,
      uniforms: {
        tDepth: { value: null },
        near: { value: 0.01 },
        far: { value: 12.0 },
        imageDistanceMm: { value: 100.0 },
        focalLengthMm: { value: focalLengthMmRef.current },
        fNumber: { value: 11.0 },
        renderWidth: { value: dimsRef.current.internalWidthPx },
        renderHeight: { value: dimsRef.current.internalHeightPx },
        useRaw: { value: 0.0 },
        dofMode: { value: 0.0 },
        lensCenterWorld: { value: new THREE.Vector3() },
        lensPlaneNormal: { value: new THREE.Vector3(0, 0, 1) },
        lensPlaneBasisX: { value: new THREE.Vector3(1, 0, 0) },
        lensPlaneBasisY: { value: new THREE.Vector3(0, 1, 0) },
        filmPlanePoint: { value: new THREE.Vector3(0, 0, -0.15) },
        filmPlaneNormal: { value: new THREE.Vector3(0, 0, 1) },
        filmPlaneBasisX: { value: new THREE.Vector3(1, 0, 0) },
        filmPlaneBasisY: { value: new THREE.Vector3(0, 1, 0) },
        focusPlanePoint: { value: new THREE.Vector3() },
        focusPlaneNormal: { value: new THREE.Vector3() },
        nearPlanePoint: { value: new THREE.Vector3() },
        nearPlaneNormal: { value: new THREE.Vector3() },
        farPlanePoint: { value: new THREE.Vector3() },
        farPlaneNormal: { value: new THREE.Vector3() },
        hasFiniteFar: { value: 0.0 },
        inverseProjectionMatrix: { value: new THREE.Matrix4() },
        cameraMatrixWorld: { value: new THREE.Matrix4() },
        maximumCoCRadiusPx: { value: initialMaximumCoCRadiusPx },
        circleOfConfusionMm: { value: ACCEPTABLE_COC_DIAMETER_MM },
        filmWidthMm: { value: CAMERA_CONSTANTS.filmWidthMm },
        filmHeightMm: { value: CAMERA_CONSTANTS.filmHeightMm },
        sampleCount: { value: initialQualitySettings.sampleCount },
        cocStorageEncoded: { value: cocStorage.storageFormat === "encoded-byte" ? 1.0 : 0.0 },
        cocStorageMaxMm: { value: initialCocStorageMaxMm },
        footprintStorageMaxMm: { value: initialFootprintStorageMaxMm },
      },
    });

    const gatherMaterial = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader: groundGlassApertureGatherFragmentShader,
      uniforms: {
        tColor: { value: null },
        tDepth: { value: null },
        tCoC: { value: cocRT.texture },
        renderWidth: { value: dimsRef.current.internalWidthPx },
        renderHeight: { value: dimsRef.current.internalHeightPx },
        focalLengthMm: { value: focalLengthMmRef.current },
        fNumber: { value: 11.0 },
        imageDistanceMm: { value: 100.0 },
        near: { value: 0.01 },
        far: { value: 12.0 },
        useRaw: { value: 0.0 },
        displayUpright: { value: 0.0 },
        dofMode: { value: 0.0 },
        lensCenterWorld: { value: new THREE.Vector3() },
        lensPlaneNormal: { value: new THREE.Vector3(0, 0, 1) },
        lensPlaneBasisX: { value: new THREE.Vector3(1, 0, 0) },
        lensPlaneBasisY: { value: new THREE.Vector3(0, 1, 0) },
        filmPlanePoint: { value: new THREE.Vector3(0, 0, -0.15) },
        filmPlaneNormal: { value: new THREE.Vector3(0, 0, 1) },
        filmPlaneBasisX: { value: new THREE.Vector3(1, 0, 0) },
        filmPlaneBasisY: { value: new THREE.Vector3(0, 1, 0) },
        focusPlanePoint: { value: new THREE.Vector3() },
        focusPlaneNormal: { value: new THREE.Vector3() },
        nearPlanePoint: { value: new THREE.Vector3() },
        nearPlaneNormal: { value: new THREE.Vector3() },
        farPlanePoint: { value: new THREE.Vector3() },
        farPlaneNormal: { value: new THREE.Vector3() },
        hasFiniteFar: { value: 0.0 },
        inverseProjectionMatrix: { value: new THREE.Matrix4() },
        cameraMatrixWorld: { value: new THREE.Matrix4() },
        maximumCoCRadiusPx: { value: initialMaximumCoCRadiusPx },
        circleOfConfusionMm: { value: ACCEPTABLE_COC_DIAMETER_MM },
        filmWidthMm: { value: CAMERA_CONSTANTS.filmWidthMm },
        filmHeightMm: { value: CAMERA_CONSTANTS.filmHeightMm },
        sampleCount: { value: initialQualitySettings.sampleCount },
        cocStorageEncoded: { value: cocStorage.storageFormat === "encoded-byte" ? 1.0 : 0.0 },
        cocStorageMaxMm: { value: initialCocStorageMaxMm },
        footprintStorageMaxMm: { value: initialFootprintStorageMaxMm },
        gatherLayer: { value: 0.0 },
      },
    });

    const compositeMaterial = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader: groundGlassCompositeFragmentShader,
      uniforms: {
        tGather: { value: gatherRT.texture },
        tNearGather: { value: nearGatherRT.texture },
        useNearGather: { value: 1.0 },
        renderWidth: { value: dimsRef.current.internalWidthPx },
        renderHeight: { value: dimsRef.current.internalHeightPx },
        displayUpright: { value: 0.0 },
      },
    });

    const cocQuad = new THREE.Mesh(quadGeo, cocMaterial);
    const gatherQuad = new THREE.Mesh(quadGeo, gatherMaterial);
    const compositeQuad = new THREE.Mesh(quadGeo, compositeMaterial);
    const copyMaterial = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader: `precision highp float; varying vec2 vUv; uniform sampler2D tColor; void main(){ gl_FragColor = texture2D(tColor, vUv); }`,
      uniforms: { tColor: { value: finalRT.texture } },
      depthTest: false,
      depthWrite: false,
    });
    const displayQuad = new THREE.Mesh(quadGeo, copyMaterial);
    postSceneCoc.add(cocQuad);
    postSceneGather.add(gatherQuad);
    postSceneComposite.add(compositeQuad);
    displayScene.add(displayQuad);

    // store post resources (per-instance ref)
    const postResources: PostResources = {
      postSceneCoc,
      postSceneGather,
      postSceneComposite,
      orthoCam,
      cocRT,
      cocStorageFormat: cocStorage.storageFormat,
      gatherRT,
      nearGatherRT,
      finalRT,
      rawDiagnosticRT,
      finalDiagnosticRT,
      displayScene,
      copyMaterial,
    };
    postResourcesRef.current = postResources;

    const profiler = new GroundGlassProfiler(
      profilingEnabled,
      gl,
      (snapshot) => {
        const currentInfo = readRuntimeInfo();
        if (!currentInfo) return;
        setRuntimeInfo({
          ...currentInfo,
          profilingEnabled: true,
          profilingBackend: snapshot.profilingBackend,
          profilingSnapshot: snapshot,
        });
      },
    );
    groundGlassProfilerRef.current = profiler;

    // After resources are created, update runtime info with actual resource sizes
    try {
      if (setRuntimeInfo) {
        const resolvedProfile =
          (sizeInputs.renderQuality as import("../types/ui").RenderQualityProfile) ||
          ("standard" as import("../types/ui").RenderQualityProfile);
        const configuredCanvasDpr = getRenderQualitySettings(resolvedProfile).dpr;
        const actualColorW = (renderTarget.current as THREE.WebGLRenderTarget).width;
        const actualColorH = (renderTarget.current as THREE.WebGLRenderTarget).height;
        const actualDepthW = (renderTarget.current as unknown as { depthTexture?: { image?: { width?: number; height?: number } } }).depthTexture?.image?.width ?? actualColorW;
        const actualDepthH = (renderTarget.current as unknown as { depthTexture?: { image?: { width?: number; height?: number } } }).depthTexture?.image?.height ?? actualColorH;
        const cocW = cocRT.width;
        const cocH = cocRT.height;
        const gatherW = gatherRT.width;
        const gatherH = gatherRT.height;
        const nearGatherW = nearGatherRT.width;
        const nearGatherH = nearGatherRT.height;

        setRuntimeInfo({
          profile: resolvedProfile,
          logicalWidthPx: dims.logicalWidthPx,
          logicalHeightPx: dims.logicalHeightPx,
          internalWidthPx: dims.internalWidthPx,
          internalHeightPx: dims.internalHeightPx,
          resolutionScale: dims.resolutionScale,
          effectiveDevicePixelRatio: dims.effectiveDevicePixelRatio,
          zoomRenderScale: dims.zoomRenderScale,
          wasClamped: dims.wasClamped,
          configuredCanvasDpr,
          rendererPixelRatio: rendererPixelRatio,
          canvasCssWidthPx: canvasCssWidth,
          canvasCssHeightPx: canvasCssHeight,
          drawingBufferWidthPx: drawingBufferWidth,
          drawingBufferHeightPx: drawingBufferHeight,
          colorTargetWidthPx: actualColorW,
          colorTargetHeightPx: actualColorH,
          depthTargetWidthPx: actualDepthW,
          depthTargetHeightPx: actualDepthH,
          blurTargetWidthPx: gatherW,
          blurTargetHeightPx: gatherH,
          dofTechnique: "physical-coc-near-far-oriented-gather",
          footprintRepresentation: "local-affine-ellipse",
          gatherScale: initialQualitySettings.gatherScale,
          sampleCount: initialQualitySettings.sampleCount,
          maximumCoCRadiusPx: initialMaximumCoCRadiusPx,
          cocStorageFormat: cocStorage.storageFormat,
          cocAvailable: true,
          cocTargetWidthPx: cocW,
          cocTargetHeightPx: cocH,
          gatherTargetWidthPx: gatherW,
          gatherTargetHeightPx: gatherH,
          farGatherTargetWidthPx: gatherW,
          farGatherTargetHeightPx: gatherH,
          nearGatherTargetWidthPx: nearGatherW,
          nearGatherTargetHeightPx: nearGatherH,
          finalTargetWidthPx: finalRT.width,
          finalTargetHeightPx: finalRT.height,
          horizontalShaderRenderWidthPx: cocMaterial.uniforms.renderWidth.value as number,
          horizontalShaderRenderHeightPx: cocMaterial.uniforms.renderHeight.value as number,
          verticalShaderRenderWidthPx: gatherMaterial.uniforms.renderWidth.value as number,
          verticalShaderRenderHeightPx: gatherMaterial.uniforms.renderHeight.value as number,
          depthTextureAvailable: Boolean(
            (renderTarget.current as unknown as { depthTexture?: THREE.Texture }).depthTexture,
          ),
          resourceGeneration: resourceGenerationRef.current,
          profilingEnabled,
          profilingBackend: profiler.backend,
        });
      }
    } catch (err) { void err; }

    // Lighting: standardized studio lights for visibility
    const hemi = new THREE.HemisphereLight(new THREE.Color("#ffffff"), new THREE.Color("#64748b"), 0.9);
    scene.add(hemi);
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.6);
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.45);
    const lightTarget = new THREE.Object3D();
    scene.add(lightTarget);
    keyLight.position.set(-2, 4, 3);
    keyLight.target = lightTarget;
    scene.add(keyLight);
    fillLight.position.set(2, 1, 1);
    fillLight.target = lightTarget;
    scene.add(fillLight);
    lightingRigRef.current = { keyLight, fillLight, target: lightTarget };

    return () => {
      try {
        profiler.dispose();
        if (groundGlassProfilerRef.current === profiler) {
          groundGlassProfilerRef.current = null;
        }
        // dispose main color target
        try { rt.dispose(); } catch (err) { void err; }
        if (renderTarget.current === rt) renderTarget.current = null;
        // dispose physical CoC and aperture-gather targets
        try { cocRT.dispose(); } catch (err) { void err; }
        try { gatherRT.dispose(); } catch (err) { void err; }
        try { nearGatherRT.dispose(); } catch (err) { void err; }
        try { finalRT.dispose(); } catch (err) { void err; }
        try { rawDiagnosticRT.dispose(); } catch (err) { void err; }
        try { finalDiagnosticRT.dispose(); } catch (err) { void err; }

        // dispose fallback depth
        try { fallbackDepth.dispose(); } catch (err) { void err; }
        if (fallbackDepthRef.current === fallbackDepth) fallbackDepthRef.current = null;

        // remove and dispose post resources
        const post = postResources;
        if (postResourcesRef.current === post) {
          try {
            // dispose quad materials and geometry
            const geometries = new Set<THREE.BufferGeometry>();
            const materials = new Set<THREE.Material>();
            [post.postSceneCoc, post.postSceneGather, post.postSceneComposite, post.displayScene].forEach((s) => {
              s.children.forEach((c) => {
                const m = c as THREE.Mesh;
                if (m.material) materials.add(m.material as THREE.Material);
                if (m.geometry) geometries.add(m.geometry as THREE.BufferGeometry);
              });
            });
            materials.forEach((material) => material.dispose());
            geometries.forEach((geometryResource) => geometryResource.dispose());
            // remove scenes
            post.postSceneCoc.clear();
            post.postSceneGather.clear();
            post.postSceneComposite.clear();
            post.displayScene.clear();
          } catch (err) { void err; }
          postResourcesRef.current = null;
        }

        if (lightingRigRef.current?.keyLight === keyLight) {
          lightingRigRef.current = null;
        }
        if (offscreenScene.current === scene) offscreenScene.current = null;
        if (groundGlassCamera.current === camera) groundGlassCamera.current = null;
        lastRenderSanityStateKeyRef.current = null;
      } finally {
        // update diagnostics to indicate resources cleared
        try {
          setRuntimeInfo(null);
        } catch (err) { void err; }
      }
    };
  }, [
    gl,
    maximumBlurRadiusPx,
    profilingEnabled,
    readRuntimeInfo,
    resolvedSceneId,
    setRuntimeInfo,
  ]);

  useEffect(() => {
    const scene = offscreenScene.current;
    if (!scene) return;

    const profileContext: GroundGlassSceneProfileContext = {
      scene: sceneDefinition,
      cameraMovementRenderModel,
      presentationRegion: presentationRegionRef.current,
    };
    const lighting = sceneProfile.resolveRttLighting(profileContext);
    const lightingRig = lightingRigRef.current;
    if (lighting && lightingRig) {
      const lightingTarget = new THREE.Vector3(
        ...vecToWorld(lighting.targetMm),
      );
      lightingRig.target.position.copy(lightingTarget);
      lightingRig.keyLight.position.set(
        lightingTarget.x + lighting.keyOffsetWorld.x,
        lightingTarget.y + lighting.keyOffsetWorld.y,
        lightingTarget.z + lighting.keyOffsetWorld.z,
      );
      lightingRig.fillLight.position.set(
        lightingTarget.x + lighting.fillOffsetWorld.x,
        lightingTarget.y + lighting.fillOffsetWorld.y,
        lightingTarget.z + lighting.fillOffsetWorld.z,
      );
    }

    const mounted = sceneProfile.mountSubject(scene, profileContext);
    if (!mounted) return;
    mountedSceneSubjectRef.current = mounted;

    const runtimeInfo = mounted.runtimeInfo;
    const currentInfo = readRuntimeInfo();
    if (runtimeInfo && currentInfo) {
      setRuntimeInfo({
        ...currentInfo,
        latticeEdgeCount: runtimeInfo.edgeCount,
        latticeGeometryId: runtimeInfo.geometryId,
        latticeGeometryKey: runtimeInfo.geometryKey,
        latticePresentationKey: runtimeInfo.presentationKey,
        latticeResourceKey: runtimeInfo.resourceKey,
        latticePresentationRegion: runtimeInfo.presentationRegion,
        latticeSubjectGeneration: runtimeInfo.generation,
      });
    }

    return () => {
      if (mountedSceneSubjectRef.current === mounted) {
        mountedSceneSubjectRef.current = null;
      }
      mounted.dispose();
      const latestInfo = readRuntimeInfo();
      if (
        runtimeInfo &&
        latestInfo?.latticeSubjectGeneration === runtimeInfo.generation
      ) {
        setRuntimeInfo({
          ...latestInfo,
          latticeEdgeCount: undefined,
          latticeGeometryId: undefined,
          latticeGeometryKey: undefined,
          latticePresentationKey: undefined,
          latticeResourceKey: undefined,
          latticePresentationRegion: undefined,
          latticeSubjectGeneration: undefined,
        });
      }
    };
  }, [
    cameraMovementRenderModel,
    sceneDefinition,
    sceneProfile,
    readRuntimeInfo,
    setRuntimeInfo,
  ]);

  // Scene profiles own any scene-specific mutation of their mounted subject.
  useEffect(() => {
    const mounted = mountedSceneSubjectRef.current;
    if (!mounted) return;

    const profileUpdateContext: GroundGlassSceneProfileUpdateContext = {
      scene: sceneDefinition,
      cameraMovementRenderModel,
      presentationRegion,
      opticsState,
    };
    mounted.update?.(profileUpdateContext);

    const runtimeInfo = mounted.runtimeInfo;
    const currentInfo = readRuntimeInfo();
    if (
      !runtimeInfo ||
      currentInfo?.latticeSubjectGeneration !== runtimeInfo.generation
    ) {
      return;
    }
    setRuntimeInfo({
      ...currentInfo,
      latticePresentationRegion: presentationRegion,
    });
  }, [
    cameraMovementRenderModel,
    opticsState,
    presentationRegion,
    readRuntimeInfo,
    sceneDefinition,
    setRuntimeInfo,
  ]);

  // Logical size, quality, DPR, and zoom affect only internal RTT resolution.
  // Keep the scene subject, camera, materials, post-processing scenes, and
  // Canvas mounted while owned targets resize as one synchronous transaction.
  useLayoutEffect(() => {
    const rt = renderTarget.current;
    const post = postResourcesRef.current;
    if (!rt || !post) return;

    const rendererPixelRatio =
      gl && typeof gl.getPixelRatio === "function"
        ? gl.getPixelRatio()
        : typeof window !== "undefined" && window.devicePixelRatio
          ? window.devicePixelRatio
          : 1;
    const dims = resolveGroundGlassRttDimensions({
      logicalWidth: widthPx,
      logicalHeight: heightPx,
      renderQuality: renderQuality || "standard",
      devicePixelRatio: rendererPixelRatio,
      zoomEnabled,
    });
    const cocMaterial = (post.postSceneCoc.children[0] as THREE.Mesh)
      .material as THREE.ShaderMaterial;
    const gatherMaterial = (post.postSceneGather.children[0] as THREE.Mesh)
      .material as THREE.ShaderMaterial;
    const compositeMaterial = (post.postSceneComposite.children[0] as THREE.Mesh)
      .material as THREE.ShaderMaterial;
    const qualitySettings = getRenderQualitySettings(
      renderQuality || "standard",
    );
    const resizedMaximumCoCRadiusPx = Math.min(
      maximumBlurRadiusPx,
      qualitySettings.maximumCoCRadiusPx,
    );
    const cocStorageMaxMm = resolveGroundGlassCocStorageMaxMm({
      maximumCoCRadiusPx: resizedMaximumCoCRadiusPx,
      filmWidthMm: CAMERA_CONSTANTS.filmWidthMm,
      renderWidthPx: dims.internalWidthPx,
    });
    cocMaterial.uniforms.cocStorageMaxMm.value = cocStorageMaxMm;
    gatherMaterial.uniforms.cocStorageMaxMm.value = cocStorageMaxMm;
    cocMaterial.uniforms.footprintStorageMaxMm.value = Math.max(1e-6, cocStorageMaxMm * 0.5);
    gatherMaterial.uniforms.footprintStorageMaxMm.value = Math.max(1e-6, cocStorageMaxMm * 0.5);

    resizeGroundGlassRttResources(
      {
        renderTarget: rt,
        cocTarget: post.cocRT,
        gatherTarget: post.gatherRT,
        nearGatherTarget: post.nearGatherRT,
        finalTarget: post.finalRT,
        cocMaterial,
        gatherMaterial,
        compositeMaterial,
      },
      dims.internalWidthPx,
      dims.internalHeightPx,
      qualitySettings.gatherScale,
    );
    dimsRef.current = dims;
    groundGlassProfilerRef.current?.resetSession("resource-resize");

    // Preserve content and sanity diagnostics until the next frame publishes a
    // sample for the resized targets. A normal view zoom/reset is not teardown.
    const currentInfo = readRuntimeInfo();
    if (!currentInfo) return;
    const canvas = (gl as unknown as WebGLRenderer).domElement;
    const canvasRect = canvas?.getBoundingClientRect();
    const resolvedProfile =
      (renderQuality as import("../types/ui").RenderQualityProfile) ||
      ("standard" as import("../types/ui").RenderQualityProfile);
    const depthImage = rt.depthTexture?.image as
      | { width?: number; height?: number }
      | undefined;
    setRuntimeInfo({
      ...currentInfo,
      ...dims,
      profile: resolvedProfile,
      configuredCanvasDpr: getRenderQualitySettings(resolvedProfile).dpr,
      rendererPixelRatio,
      canvasCssWidthPx: Math.round(canvasRect?.width ?? widthPx),
      canvasCssHeightPx: Math.round(canvasRect?.height ?? heightPx),
      drawingBufferWidthPx: canvas?.width ?? Math.round(widthPx * rendererPixelRatio),
      drawingBufferHeightPx: canvas?.height ?? Math.round(heightPx * rendererPixelRatio),
      colorTargetWidthPx: rt.width,
      colorTargetHeightPx: rt.height,
      depthTargetWidthPx: depthImage?.width ?? rt.width,
      depthTargetHeightPx: depthImage?.height ?? rt.height,
      blurTargetWidthPx: post.gatherRT.width,
      blurTargetHeightPx: post.gatherRT.height,
      dofTechnique: "physical-coc-near-far-oriented-gather",
      footprintRepresentation: "local-affine-ellipse",
      gatherScale: qualitySettings.gatherScale,
      sampleCount: qualitySettings.sampleCount,
      maximumCoCRadiusPx: Math.min(
        maximumBlurRadiusPx,
        qualitySettings.maximumCoCRadiusPx,
      ),
      cocStorageFormat: post.cocStorageFormat,
      cocAvailable: true,
      cocTargetWidthPx: post.cocRT.width,
      cocTargetHeightPx: post.cocRT.height,
      gatherTargetWidthPx: post.gatherRT.width,
      gatherTargetHeightPx: post.gatherRT.height,
      farGatherTargetWidthPx: post.gatherRT.width,
      farGatherTargetHeightPx: post.gatherRT.height,
      nearGatherTargetWidthPx: post.nearGatherRT.width,
      nearGatherTargetHeightPx: post.nearGatherRT.height,
      finalTargetWidthPx: post.finalRT.width,
      finalTargetHeightPx: post.finalRT.height,
      horizontalShaderRenderWidthPx: cocMaterial.uniforms.renderWidth.value as number,
      horizontalShaderRenderHeightPx: cocMaterial.uniforms.renderHeight.value as number,
      verticalShaderRenderWidthPx: gatherMaterial.uniforms.renderWidth.value as number,
      verticalShaderRenderHeightPx: gatherMaterial.uniforms.renderHeight.value as number,
      resourceGeneration: resourceGenerationRef.current,
      profilingSnapshot: undefined,
    });
  }, [gl, heightPx, maximumBlurRadiusPx, readRuntimeInfo, renderQuality, setRuntimeInfo, widthPx, zoomEnabled]);

  useFrame((_state, frameDelta) => {
    if (!renderTarget.current || !offscreenScene.current) return;
    const imgDist = resolveGroundGlassImageDistanceMm(opticsState);
    const cam = groundGlassCamera.current;
    if (!cam) return;

    // Configure once with a conservative preliminary range so the actual
    // Three.js camera forward vector can drive the final pitch-safe range.
    const profileContext: GroundGlassSceneProfileContext = {
      scene: sceneDefinition,
      cameraMovementRenderModel,
      presentationRegion,
    };
    const effectiveBounds = sceneProfile.resolveRenderBounds(profileContext);
    const sceneDef =
      effectiveBounds === sceneDefinition.bounds
        ? sceneDefinition
        : { ...sceneDefinition, bounds: effectiveBounds };
    const preliminaryClipRange = getGroundGlassClipRangeWorld(
      sceneDef,
      opticsState.lensCenterWorld,
    );
    let nearWorld = preliminaryClipRange.near;
    let farWorld = preliminaryClipRange.far;

    cam.near = nearWorld;
    cam.far = farWorld;

    // configure an off-axis projection matrix that matches opticsState.filmPlaneCornersWorld and lens center
    let cfg = configureGroundGlassCamera(cam, opticsState, nearWorld, farWorld);
    if (cfg.ok) {
      const [forwardX, forwardY, forwardZ] = cfg.pose.forwardWorld;
      const finalClipRange = getGroundGlassClipRangeWorld(
        sceneDef,
        opticsState.lensCenterWorld,
        { x: forwardX, y: forwardY, z: forwardZ },
      );
      nearWorld = finalClipRange.near;
      farWorld = finalClipRange.far;
      cam.near = nearWorld;
      cam.far = farWorld;
      cfg = configureGroundGlassCamera(cam, opticsState, nearWorld, farWorld);
    }
    if (!cfg.ok) {
      // Do not silently swallow errors — record diagnostic and fall back to symmetric perspective
      const reason = cfg.reason;
      if (reportedCameraConfigurationErrorRef.current !== reason) {
        console.warn("GroundGlass camera configuration failed:", reason);
        reportedCameraConfigurationErrorRef.current = reason;
      }
      // fallback symmetric camera
      const vertFovRad = 2 * Math.atan(CAMERA_CONSTANTS.filmHeightMm / (2 * imgDist));
      const vertFovDeg2 = (vertFovRad * 180) / Math.PI;
      cam.fov = vertFovDeg2;
      cam.aspect = widthPx / heightPx;
      cam.updateProjectionMatrix();
      const lensPos = new THREE.Vector3(opticsState.lensCenterWorld.x * 0.001, opticsState.lensCenterWorld.y * 0.001, opticsState.lensCenterWorld.z * 0.001);
      cam.position.copy(lensPos);
      const dir = new THREE.Vector3(opticsState.opticalAxis.direction.x, opticsState.opticalAxis.direction.y, opticsState.opticalAxis.direction.z);
      const lookAt = new THREE.Vector3().copy(lensPos).add(dir.multiplyScalar(1000));
      cam.lookAt(lookAt);
      cam.updateMatrixWorld(true);
      cam.matrixWorldInverse.copy(cam.matrixWorld).invert();
    } else {
      reportedCameraConfigurationErrorRef.current = null;
    }

    const configuredPose = cfg.ok ? cfg.pose : readGroundGlassCameraPose(cam);
    const projectionDeterminant = cfg.ok
      ? cfg.determinant
      : cam.projectionMatrix.determinant();
    const currentCameraInfo = readRuntimeInfo();
    if (
      currentCameraInfo &&
      (
        currentCameraInfo.cameraNearWorld !== cam.near ||
        currentCameraInfo.cameraFarWorld !== cam.far ||
        currentCameraInfo.cameraConfigurationOk !== cfg.ok ||
        currentCameraInfo.cameraConfigurationError !== (cfg.ok ? null : cfg.reason) ||
        currentCameraInfo.projectionDeterminant !== projectionDeterminant ||
        !tupleMatches(currentCameraInfo.cameraPositionWorld, configuredPose.positionWorld) ||
        !tupleMatches(currentCameraInfo.cameraUpWorld, configuredPose.upWorld) ||
        !tupleMatches(currentCameraInfo.cameraForwardWorld, configuredPose.forwardWorld)
      )
    ) {
      setRuntimeInfo({
        ...currentCameraInfo,
        cameraNearWorld: cam.near,
        cameraFarWorld: cam.far,
        cameraConfigurationOk: cfg.ok,
        cameraConfigurationError: cfg.ok ? null : cfg.reason,
        projectionDeterminant,
        cameraPositionWorld: configuredPose.positionWorld,
        cameraUpWorld: configuredPose.upWorld,
        cameraForwardWorld: configuredPose.forwardWorld,
      });
    }


    // expose last cam far for debug / unit assertions
    // expose last cam far for debug via diagnostics (not logged per-frame)

    // update dynamic mesh positions created earlier
    try {
      // update rear if present
      const scene = offscreenScene.current as THREE.Scene;
      const rearMesh = scene.children.find((c) => (c as THREE.Mesh).geometry && (c as THREE.Mesh).material && (c as THREE.Mesh).geometry.type === 'BoxGeometry') as THREE.Mesh | undefined;
      if (rearMesh) {
        const f = vecToWorld(opticsState.filmCenterWorld);
        rearMesh.position.set(f[0], f[1], f[2]);
      }

      // update target meshes if any
      // assume target sphere geometries use 'SphereGeometry'
      scene.children.forEach((c) => {
        const m = c as THREE.Mesh;
        if (m.geometry && m.geometry.type === 'SphereGeometry') {
          // update from scene definition positions in case they changed (rare)
          // no-op here
        }
      });
    } catch (err) { void err; }

    const post = postResourcesRef.current;
    const currentQualitySettings = getRenderQualitySettings(
      sizeInputsRef.current.renderQuality || "standard",
    );
    const currentMaximumCoCRadiusPx = Math.min(
      maximumBlurRadiusPx,
      currentQualitySettings.maximumCoCRadiusPx,
    );
    const profiler = groundGlassProfilerRef.current;
    const profilingActive = profiler !== null && profiler.backend !== "disabled";
    if (profilingActive) {
      const profilingConfiguration: GroundGlassProfilingConfiguration = {
        sceneId: resolvedSceneId,
        renderQuality: sizeInputsRef.current.renderQuality || "standard",
        internalResolution: [
          dimsRef.current.internalWidthPx,
          dimsRef.current.internalHeightPx,
        ],
        gatherResolution: [
          post?.gatherRT.width ?? Math.max(
            1,
            Math.floor(dimsRef.current.internalWidthPx * currentQualitySettings.gatherScale),
          ),
          post?.gatherRT.height ?? Math.max(
            1,
            Math.floor(dimsRef.current.internalHeightPx * currentQualitySettings.gatherScale),
          ),
        ],
        gatherScale: currentQualitySettings.gatherScale,
        sampleCount: currentQualitySettings.sampleCount,
        maximumCoCRadiusPx: currentMaximumCoCRadiusPx,
        cocStorageFormat: post?.cocStorageFormat ?? null,
        footprintRepresentation: "local-affine-ellipse",
        dofTechnique: "physical-coc-near-far-oriented-gather",
        previewMode: previewMode === "raw" ? "raw" : "upright",
        rawDebug: Boolean(rawDebug),
        devicePixelRatio:
          typeof gl.getPixelRatio === "function"
            ? gl.getPixelRatio()
            : typeof window !== "undefined"
              ? window.devicePixelRatio
              : 1,
        zoomEnabled: Boolean(zoomEnabled),
      };
      profiler.beginFrame(
        profilingConfiguration,
        Number.isFinite(frameDelta) ? (frameDelta as number) * 1000 : undefined,
      );
    }
    const measurePass = profilingActive
      ? (pass: GroundGlassProfilingPass, renderPass: () => void): void => {
          const scope = profiler.beginPass(pass);
          try {
            renderPass();
          } finally {
            scope.end();
          }
        }
      : (_pass: GroundGlassProfilingPass, renderPass: () => void): void => {
          renderPass();
        };

    // 1) render scene to color+depth renderTarget
    const prev = gl.getRenderTarget();
    measurePass("sceneRender", () => {
      gl.setRenderTarget(renderTarget.current);
      gl.setClearColor(SKY_COLOR.getHex(), 1);
      gl.clear(true, true, true);
      gl.render(offscreenScene.current!, cam);
    });

    // 2) Full-resolution signed CoC, near/far aperture gathers, then composite.
    if (post) {
      const {
        postSceneCoc,
        postSceneGather,
        postSceneComposite,
        orthoCam,
        cocRT,
        gatherRT,
        nearGatherRT,
        finalRT,
        rawDiagnosticRT,
        finalDiagnosticRT,
        displayScene,
        copyMaterial,
      } = post;
      // prefer the renderTarget.depthTexture when available, otherwise use a 1.0 depth fallback
      const depthTex = (renderTarget.current as unknown as { depthTexture?: THREE.Texture }).depthTexture ?? fallbackDepthRef.current ?? null;
      // A missing depth texture is surfaced through diagnostics. Keep the DOF
      // path active with the explicit far-depth texture instead of silently
      // changing the user's preview to Raw RTT.
      const isFallbackDepth = depthTex === fallbackDepthRef.current;
      const cocStorageMaxMm = resolveGroundGlassCocStorageMaxMm({
        maximumCoCRadiusPx: currentMaximumCoCRadiusPx,
        filmWidthMm: CAMERA_CONSTANTS.filmWidthMm,
        renderWidthPx: dimsRef.current.internalWidthPx,
      });
      const footprintStorageMaxMm = Math.max(1e-6, cocStorageMaxMm * 0.5);

      const cocMesh = postSceneCoc.children[0] as THREE.Mesh;
      const cocMaterial = cocMesh.material as THREE.ShaderMaterial;
      const gatherMesh = postSceneGather.children[0] as THREE.Mesh;
      const gatherMaterial = gatherMesh.material as THREE.ShaderMaterial;
      synchronizeGroundGlassDofClipRange(
        [cocMaterial, gatherMaterial],
        cam.near,
        cam.far,
      );
      cocMaterial.uniforms.tDepth.value = depthTex;
      cocMaterial.uniforms.useRaw.value = 0.0;
      cocMaterial.uniforms.renderWidth.value = dimsRef.current.internalWidthPx;
      cocMaterial.uniforms.renderHeight.value = dimsRef.current.internalHeightPx;
      cocMaterial.uniforms.cocStorageMaxMm.value = cocStorageMaxMm;
      cocMaterial.uniforms.footprintStorageMaxMm.value = footprintStorageMaxMm;
      gatherMaterial.uniforms.cocStorageMaxMm.value = cocStorageMaxMm;
      gatherMaterial.uniforms.footprintStorageMaxMm.value = footprintStorageMaxMm;

      // Prepare typed optical state once and apply it to both CoC and gather.
      let uniformPreparationError: string | null = null;
      let preparedDofState: ReturnType<typeof createGroundGlassDofUniformState> | null = null;
      try {
        const displayOpticsState = resolveGroundGlassDisplayOpticsState(resolvedSceneId, opticsState);
        preparedDofState = createGroundGlassDofUniformState(
          displayOpticsState,
          cam,
          focalLengthMm,
          CAMERA_CONSTANTS.filmWidthMm,
          CAMERA_CONSTANTS.filmHeightMm,
          ACCEPTABLE_COC_DIAMETER_MM,
          aperture,
          dimsRef.current.internalWidthPx,
          dimsRef.current.internalHeightPx,
          currentMaximumCoCRadiusPx,
        );
      } catch (err) {
        uniformPreparationError = err instanceof Error ? err.message : String(err);
      }

      if (preparedDofState) {
        applyGroundGlassDofUniformState(cocMaterial, preparedDofState);
        reportedUniformPreparationErrorRef.current = null;
      } else {
        // Keep the last valid shader state. Do not conceal configuration errors
        // by silently switching the user to Raw RTT.
        if (uniformPreparationError && reportedUniformPreparationErrorRef.current !== uniformPreparationError) {
          console.warn("GroundGlass DOF uniform preparation failed:", uniformPreparationError);
          reportedUniformPreparationErrorRef.current = uniformPreparationError ?? "unknown";
        }
      }

      // Raw debug is a true bypass: the full-resolution scene color remains
      // the source of truth and never passes through the scaled gather target.
      if (!rawDebug) {
        measurePass("cocFootprint", () => {
          gl.setRenderTarget(cocRT);
          gl.setClearColor(SKY_COLOR.getHex(), 1);
          gl.clear(true, true, true);
          gl.render(postSceneCoc, orthoCam);
        });

        gatherMaterial.uniforms.tColor.value = (renderTarget.current as THREE.WebGLRenderTarget).texture;
        gatherMaterial.uniforms.tDepth.value = depthTex;
        gatherMaterial.uniforms.tCoC.value = cocRT.texture;
        gatherMaterial.uniforms.useRaw.value = 0.0;
        gatherMaterial.uniforms.sampleCount.value = currentQualitySettings.sampleCount;
        gatherMaterial.uniforms.maximumCoCRadiusPx.value = currentMaximumCoCRadiusPx;
        gatherMaterial.uniforms.renderWidth.value = dimsRef.current.internalWidthPx;
        gatherMaterial.uniforms.renderHeight.value = dimsRef.current.internalHeightPx;
        if (preparedDofState) {
          applyGroundGlassDofUniformState(gatherMaterial, preparedDofState);
        } else {
          if (uniformPreparationError && reportedUniformPreparationErrorRef.current !== uniformPreparationError) {
            console.warn("GroundGlass DOF uniform preparation failed:", uniformPreparationError);
            reportedUniformPreparationErrorRef.current = uniformPreparationError ?? "unknown";
          }
        }

        measurePass("farGather", () => {
          gl.setRenderTarget(gatherRT);
          gl.setClearColor(SKY_COLOR.getHex(), 1);
          gl.clear(true, true, true);
          gatherMaterial.uniforms.gatherLayer.value = 0.0;
          gl.render(postSceneGather, orthoCam);
        });

        measurePass("nearGather", () => {
          gl.setRenderTarget(nearGatherRT);
          gl.setClearColor(SKY_COLOR.getHex(), 0);
          gl.clear(true, true, true);
          gatherMaterial.uniforms.gatherLayer.value = 1.0;
          gl.render(postSceneGather, orthoCam);
        });
      }

      const compositeMesh = postSceneComposite.children[0] as THREE.Mesh;
      const compositeMaterial = compositeMesh.material as THREE.ShaderMaterial;
      compositeMaterial.uniforms.tGather.value = rawDebug
        ? (renderTarget.current as THREE.WebGLRenderTarget).texture
        : gatherRT.texture;
      compositeMaterial.uniforms.tNearGather.value = nearGatherRT.texture;
      compositeMaterial.uniforms.useNearGather.value = rawDebug ? 0.0 : 1.0;
      compositeMaterial.uniforms.displayUpright.value = previewMode === "raw" ? 1.0 : 0.0;
      compositeMaterial.uniforms.renderWidth.value = dimsRef.current.internalWidthPx;
      compositeMaterial.uniforms.renderHeight.value = dimsRef.current.internalHeightPx;

      // Keep the final DOF result in an owned target. Besides enabling a
      // deterministic render sanity readback, this prevents a transient empty
      // default framebuffer from becoming the Ground Glass source of truth.
      measurePass("composite", () => {
        gl.setRenderTarget(finalRT);
        gl.setClearColor(SKY_COLOR.getHex(), 1);
        gl.clear(true, true, true);
        gl.render(postSceneComposite, orthoCam);
      });

      const sanityStateKey = createGroundGlassRenderSanityStateKey({
        resourceGeneration: resourceGenerationRef.current,
        sceneId: resolvedSceneId,
        previewMode,
        rawDebug: rawDebug,
        zoomEnabled: zoomEnabled,
        aperture: aperture,
        internalWidthPx: dimsRef.current.internalWidthPx,
        internalHeightPx: dimsRef.current.internalHeightPx,
        opticsState,
        configuredCameraPose: configuredPose,
      });

      const renderSanityEnabled =
        import.meta.env.DEV &&
        typeof window !== "undefined" &&
        new URLSearchParams(window.location.search).get("rttDiagnostics") === "1";
      if (renderSanityEnabled && lastRenderSanityStateKeyRef.current !== sanityStateKey) {
        const rawPixels = new Uint8Array(32 * 32 * 4);
        const finalPixels = new Uint8Array(32 * 32 * 4);
        lastRenderSanityStateKeyRef.current = sanityStateKey;
        try {
          copyMaterial.uniforms.tColor.value = renderTarget.current.texture;
          gl.setRenderTarget(rawDiagnosticRT);
          gl.setClearColor(SKY_COLOR.getHex(), 1);
          gl.clear(true, true, true);
          gl.render(displayScene, orthoCam);
          gl.readRenderTargetPixels(rawDiagnosticRT, 0, 0, 32, 32, rawPixels);

          copyMaterial.uniforms.tColor.value = finalRT.texture;
          gl.setRenderTarget(finalDiagnosticRT);
          gl.setClearColor(SKY_COLOR.getHex(), 1);
          gl.clear(true, true, true);
          gl.render(displayScene, orthoCam);
          gl.readRenderTargetPixels(finalDiagnosticRT, 0, 0, 32, 32, finalPixels);

          const rawSanity = analyzeGroundGlassRenderSanity(rawPixels);
          const finalSanity = analyzeGroundGlassRenderSanity(finalPixels);
          const currentInfo = readRuntimeInfo();
          if (currentInfo) {
            setRuntimeInfo({
              ...currentInfo,
              cameraNearWorld: cam.near,
              cameraFarWorld: cam.far,
              cameraConfigurationOk: cfg.ok,
              cameraConfigurationError: cfg.ok ? null : cfg.reason,
              projectionDeterminant,
              cameraPositionWorld: configuredPose.positionWorld,
              cameraUpWorld: configuredPose.upWorld,
              cameraForwardWorld: configuredPose.forwardWorld,
              depthTextureAvailable: !isFallbackDepth,
              dofMode:
                preparedDofState?.mode === 1
                  ? "derived-planes"
                  : opticsState.diagnostics.groundGlassDofModel ?? "parallel-thin-lens",
              uniformsFinite: Boolean(preparedDofState),
              uniformPreparationError,
              focalLengthMm: preparedDofState?.focalLengthMm,
              rawColorVariance: rawSanity.luminanceVariance,
              rawNonBackgroundPixelCount: rawSanity.nonBackgroundPixelCount,
              rawContentful: rawSanity.contentful,
              finalColorVariance: finalSanity.luminanceVariance,
              finalNonBackgroundPixelCount: finalSanity.nonBackgroundPixelCount,
              finalContentful: finalSanity.contentful,
              renderSanitySampleCount: rawSanity.sampleCount,
              renderSanityStateKey: sanityStateKey,
              renderSanityError: null,
            });
          }
        } catch (error) {
          const currentInfo = readRuntimeInfo();
          if (currentInfo) {
            setRuntimeInfo({
              ...currentInfo,
              renderSanityStateKey: sanityStateKey,
              renderSanityError: error instanceof Error ? error.message : String(error),
            });
          }
        }
        copyMaterial.uniforms.tColor.value = finalRT.texture;
      }

      // Final blit always samples the owned composited target.
      copyMaterial.uniforms.tColor.value = finalRT.texture;
      gl.setRenderTarget(null);
      gl.setClearColor(SKY_COLOR.getHex(), 1);
      gl.clear(true, true, true);
      gl.render(displayScene, orthoCam);
    } else {
      gl.setRenderTarget(null);
    }

    if (profilingActive) profiler.endFrame();
    gl.setRenderTarget(prev);
  }, 1);

  return null;
}

export const GroundGlassRTT: React.FC<GroundGlassRTTProps> = ({ opticsState, focalLengthMm, scene, widthPx, heightPx, aperture, previewMode, rawDebug, renderQuality, zoomEnabled, channel = "default", presentationRegion, effectiveCameraMovementCalibration, onRuntimeInfoChange }) => {
  // Canvas is used to host the three.js scene that displays the render target as a fullscreen quad.
  const resolvedProfile = renderQuality ?? ("standard" as import("../types/ui").RenderQualityProfile);
  const qualitySettings = getRenderQualitySettings(resolvedProfile);

  return (
    <div data-rtt-resource-channel={channel} style={{ width: "100%", height: "100%" }}>
      <Canvas
        dpr={qualitySettings.dpr}
        resize={{ offsetSize: true }}
        style={{ width: "100%", height: "100%" }}
        gl={GROUND_GLASS_GL_OPTIONS}
        orthographic={false}
      >
        <OffscreenRenderer opticsState={opticsState} focalLengthMm={focalLengthMm} scene={scene} widthPx={widthPx} heightPx={heightPx} aperture={aperture} previewMode={previewMode} rawDebug={rawDebug} renderQuality={renderQuality} zoomEnabled={zoomEnabled} channel={channel} presentationRegion={presentationRegion} effectiveCameraMovementCalibration={effectiveCameraMovementCalibration} onRuntimeInfoChange={onRuntimeInfoChange} />
      </Canvas>
    </div>
  );
};

export default GroundGlassRTT;
