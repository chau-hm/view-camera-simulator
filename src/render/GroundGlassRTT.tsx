import React, { useEffect, useId, useLayoutEffect, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { CAMERA_CONSTANTS } from "../utils/constants";

const SKY_COLOR = new THREE.Color("#dfe5ec");
const GROUND_GLASS_GL_OPTIONS = { preserveDrawingBuffer: false } as const;
import { vecToWorld } from "./rttUtils";
import { getSceneById } from "../scenes/definitions";
import { projectSceneFocusTargetsToGroundGlass } from "./groundGlassTargetProjection";
import {
  createRegisteredRttSubject,
  disposeRegisteredRttSubject,
  getSceneSubjectRegistration,
} from "./sceneSubjectRegistry";
import { updateMirrorShiftCameraReflection } from "./MirrorShiftSubjectFactory";
import { selectEffectiveCameraMovementCalibration } from "../state/selectors";
import { resolveCameraMovementLatticeRenderModel } from "./cameraMovementLatticeRenderModel";
import {
  mountCameraMovementRttSubject,
  unmountCameraMovementRttSubject,
  updateCameraMovementRttSubjectTarget,
  type MountedCameraMovementRttSubject,
} from "./cameraMovementRttSubjectLifecycle";
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
import type { ApertureValue } from "../types/camera";
import { useAppStore } from "../state/appStore";
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
import type { GroundGlassRttChannel } from "./groundGlassRttDimensions";
import {
  resolveCameraMovementLessonPresentationTargetRegion,
} from "../scenes/cameraMovementLessonState";
import type { CameraMovementPresentationRegion } from "../scenes/cameraMovementSceneCalibration";

export type GroundGlassRTTProps = {
  opticsState: DerivedOpticsState;
  focalLengthMm: number;
  sceneId?: string;
  widthPx: number;
  heightPx: number;
  aperture?: number; // f-number for DOF calculations
  previewMode?: "raw" | "upright";
  focusRingRadiusPx?: number;
  focusRingOpacity?: number;
  rawDebug?: boolean;
  focusAssistEnabled?: boolean;
  renderQuality?: import("../types/ui").RenderQualityProfile;
  zoomEnabled?: boolean;
  /** Independent RTT resource/diagnostic channel for comparison panes. */
  channel?: GroundGlassRttChannel;
  /** Explicit visual lattice presentation for comparison panes. */
  presentationRegion?: CameraMovementPresentationRegion;
};

const tupleMatches = (
  left: [number, number, number] | undefined,
  right: [number, number, number],
): boolean =>
  Boolean(left?.every((value, index) => Math.abs(value - right[index]) < 1e-9));

function OffscreenRenderer({ opticsState, focalLengthMm, sceneId, widthPx, heightPx, aperture = 11.0, previewMode = 'raw', focusRingRadiusPx = 68, focusRingOpacity = 0.8, rawDebug = false, focusAssistEnabled = false, renderQuality = "standard", zoomEnabled = false, channel = "default", presentationRegion: explicitPresentationRegion, }: GroundGlassRTTProps) {
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

  const { gl } = useThree();
  const configuredPresentationRegion = useAppStore((state) =>
    explicitPresentationRegion === undefined
      ? state.camera.cameraMovementLessonState &&
        state.camera.activeSceneId === "understanding-camera-movements"
        ? resolveCameraMovementLessonPresentationTargetRegion(
            state.camera.cameraMovementLessonState,
          )
        : state.scene.targetRegion
      : undefined,
  );
  const presentationRegion =
    explicitPresentationRegion ?? configuredPresentationRegion ?? "middle";
  presentationRegionRef.current = presentationRegion;
  const effectiveCameraMovementCalibration = useAppStore(
    selectEffectiveCameraMovementCalibration,
  );
  const cameraMovementRenderModel = resolveCameraMovementLatticeRenderModel(
    effectiveCameraMovementCalibration,
  );
  const { maximumBlurRadiusPx, displayBlurScale } = getGroundGlassDofVisualSettings(sceneId);

  // RTT dimensions reference so both effect and frame loop can access current internal sizes
  const dimsRef = React.useRef(resolveGroundGlassRttDimensions({ logicalWidth: widthPx, logicalHeight: heightPx, renderQuality: renderQuality || "standard", devicePixelRatio: 1, zoomEnabled }));

  // refs for instance-owned resources (avoid storing on function object)
  type PostResources = {
    postSceneCoc: THREE.Scene;
    postSceneGather: THREE.Scene;
    postSceneComposite: THREE.Scene;
    orthoCam: THREE.OrthographicCamera;
    cocRT: THREE.WebGLRenderTarget;
    gatherRT: THREE.WebGLRenderTarget;
    finalRT: THREE.WebGLRenderTarget;
    rawDiagnosticRT: THREE.WebGLRenderTarget;
    finalDiagnosticRT: THREE.WebGLRenderTarget;
    displayScene: THREE.Scene;
    copyMaterial: THREE.ShaderMaterial;
  };
  const postResourcesRef = React.useRef<PostResources | null>(null);
  const fallbackDepthRef = React.useRef<THREE.DataTexture | null>(null);
  const resourceGenerationRef = React.useRef<number>(0);
  const lightingRigRef = React.useRef<{
    keyLight: THREE.DirectionalLight;
    fillLight: THREE.DirectionalLight;
    target: THREE.Object3D;
  } | null>(null);
  const mountedCameraMovementRttSubjectRef =
    useRef<MountedCameraMovementRttSubject | null>(null);
  const mirrorShiftRttSubjectRef = useRef<THREE.Group | null>(null);
  const sizeInputsRef = React.useRef({ widthPx, heightPx, renderQuality, zoomEnabled });
  sizeInputsRef.current = { widthPx, heightPx, renderQuality, zoomEnabled };

  const readRuntimeInfo = React.useCallback(() => {
    const state = useAppStore.getState();
    return channel === "default"
      ? state.groundGlassRttRuntimeInfo
      : state.groundGlassRttRuntimeInfoByChannel?.[channel] ?? null;
  }, [channel]);
  const setRuntimeInfo = React.useCallback(
    (info: import("./groundGlassRttDimensions").GroundGlassRttRuntimeInfo | null) => {
      const enriched = info
        ? { ...info, channel, ownerId: runtimeOwnerId }
        : null;
      if (channel === "default") {
        useAppStore.getState().setGroundGlassRttRuntimeInfo(enriched, runtimeOwnerId);
      } else {
        useAppStore.getState().setGroundGlassRttRuntimeInfoForChannel(
          channel,
          enriched,
          runtimeOwnerId,
        );
      }
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
    // scene color/depth -> full-resolution CoC -> aperture gather -> composite.
    const postSceneCoc = new THREE.Scene();
    const postSceneGather = new THREE.Scene();
    const postSceneComposite = new THREE.Scene();
    const orthoCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const cocRT = new THREE.WebGLRenderTarget(
      dimsRef.current.internalWidthPx,
      dimsRef.current.internalHeightPx,
      {
        type: THREE.HalfFloatType,
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        depthBuffer: false,
        stencilBuffer: false,
      },
    );
    cocRT.depthBuffer = false;
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
        focalLengthMm: { value: 1.0 },
        fNumber: { value: 11.0 },
        renderWidth: { value: dimsRef.current.internalWidthPx },
        renderHeight: { value: dimsRef.current.internalHeightPx },
        useRaw: { value: 0.0 },
        dofMode: { value: 0.0 },
        lensCenterWorld: { value: new THREE.Vector3() },
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
        circleOfConfusionMm: { value: 0.1 },
        filmWidthMm: { value: CAMERA_CONSTANTS.filmWidthMm },
        displayBlurScale: { value: displayBlurScale },
        sampleCount: { value: initialQualitySettings.sampleCount },
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
        focalLengthMm: { value: 1.0 },
        fNumber: { value: 11.0 },
        imageDistanceMm: { value: 100.0 },
        near: { value: 0.01 },
        far: { value: 12.0 },
        ringCenter: { value: new THREE.Vector2(-1, -1) },
        ringRadiusPx: { value: 0.0 },
        ringColor: { value: new THREE.Vector3(59/255,130/255,246/255) },
        ringOpacity: { value: 0.8 },
        showRing: { value: 0.0 },
        useRaw: { value: 0.0 },
        displayUpright: { value: 0.0 },
        dofMode: { value: 0.0 },
        lensCenterWorld: { value: new THREE.Vector3() },
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
        circleOfConfusionMm: { value: 0.1 },
        filmWidthMm: { value: CAMERA_CONSTANTS.filmWidthMm },
        displayBlurScale: { value: displayBlurScale },
        sampleCount: { value: initialQualitySettings.sampleCount },
      },
    });

    const compositeMaterial = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader: groundGlassCompositeFragmentShader,
      uniforms: {
        tGather: { value: gatherRT.texture },
        renderWidth: { value: dimsRef.current.internalWidthPx },
        renderHeight: { value: dimsRef.current.internalHeightPx },
        ringCenter: { value: new THREE.Vector2(-1, -1) },
        ringRadiusPx: { value: 0.0 },
        ringColor: { value: new THREE.Vector3(59 / 255, 130 / 255, 246 / 255) },
        ringOpacity: { value: 0.8 },
        showRing: { value: 0.0 },
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
      gatherRT,
      finalRT,
      rawDiagnosticRT,
      finalDiagnosticRT,
      displayScene,
      copyMaterial,
    };
    postResourcesRef.current = postResources;

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
          dofTechnique: "physical-coc-aperture-gather",
          gatherScale: initialQualitySettings.gatherScale,
          sampleCount: initialQualitySettings.sampleCount,
          maximumCoCRadiusPx: initialMaximumCoCRadiusPx,
          cocAvailable: true,
          cocTargetWidthPx: cocW,
          cocTargetHeightPx: cocH,
          gatherTargetWidthPx: gatherW,
          gatherTargetHeightPx: gatherH,
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
        // dispose main color target
        try { rt.dispose(); } catch (err) { void err; }
        if (renderTarget.current === rt) renderTarget.current = null;
        // dispose physical CoC and aperture-gather targets
        try { cocRT.dispose(); } catch (err) { void err; }
        try { gatherRT.dispose(); } catch (err) { void err; }
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
    displayBlurScale,
    gl,
    maximumBlurRadiusPx,
    sceneId,
    setRuntimeInfo,
  ]);

  useEffect(() => {
    const scene = offscreenScene.current;
    if (!sceneId || !scene) return;

    const registration = getSceneSubjectRegistration(sceneId);
    const subjectOptions = {
      presentationRegion: undefined,
      cameraMovementRenderModel:
        sceneId === "understanding-camera-movements"
          ? cameraMovementRenderModel
          : undefined,
    };
    const lighting =
      registration?.resolveRttLighting?.(subjectOptions) ??
      registration?.rttLighting;
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

    if (sceneId === "understanding-camera-movements") {
      const mounted = mountCameraMovementRttSubject(
        scene,
        cameraMovementRenderModel,
        presentationRegionRef.current,
      );
      mountedCameraMovementRttSubjectRef.current = mounted;
      const runtimeInfo = mounted.runtimeInfo;
      const currentInfo = readRuntimeInfo();
      if (currentInfo) {
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
        if (mountedCameraMovementRttSubjectRef.current === mounted) {
          mountedCameraMovementRttSubjectRef.current = null;
        }
        unmountCameraMovementRttSubject(mounted);
        const latestInfo = readRuntimeInfo();
        if (
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
    }

    const subjectGroup = createRegisteredRttSubject(sceneId, subjectOptions);
    if (!subjectGroup) return;
    if (sceneId === "mirror-shift") {
      mirrorShiftRttSubjectRef.current = subjectGroup;
    }
    scene.add(subjectGroup);
    return () => {
      if (mirrorShiftRttSubjectRef.current === subjectGroup) {
        mirrorShiftRttSubjectRef.current = null;
      }
      scene.remove(subjectGroup);
      disposeRegisteredRttSubject(sceneId, subjectGroup);
    };
  }, [
    cameraMovementRenderModel,
    sceneId,
    readRuntimeInfo,
    setRuntimeInfo,
  ]);

  const mirrorShiftRigOrigin = opticsState.cameraRigTransform.rigOriginWorld;
  const mirrorShiftFrontShiftMm = opticsState.cameraBodyLocalGeometry.lensCenterLocal.x;
  useEffect(() => {
    if (sceneId !== "mirror-shift") return;
    const subjectGroup = mirrorShiftRttSubjectRef.current;
    if (!subjectGroup) return;
    updateMirrorShiftCameraReflection(subjectGroup, {
      x: mirrorShiftRigOrigin.x,
      y: mirrorShiftRigOrigin.y,
      z: mirrorShiftRigOrigin.z,
    }, mirrorShiftFrontShiftMm);
  }, [
    mirrorShiftFrontShiftMm,
    mirrorShiftRigOrigin.x,
    mirrorShiftRigOrigin.y,
    mirrorShiftRigOrigin.z,
    sceneId,
  ]);

  // Target teaching steps are presentation-only. Keep the mounted subject and
  // all owned GPU resources stable while mutating its existing materials.
  useEffect(() => {
    if (sceneId !== "understanding-camera-movements") return;
    const mounted = mountedCameraMovementRttSubjectRef.current;
    if (!mounted) return;
    updateCameraMovementRttSubjectTarget(
      mounted,
      cameraMovementRenderModel,
      presentationRegion,
    );
    const currentInfo = readRuntimeInfo();
    if (currentInfo?.latticeSubjectGeneration !== mounted.runtimeInfo.generation) {
      return;
    }
    setRuntimeInfo({
      ...currentInfo,
      latticePresentationRegion: presentationRegion,
    });
  }, [cameraMovementRenderModel, presentationRegion, readRuntimeInfo, sceneId, setRuntimeInfo]);

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

    resizeGroundGlassRttResources(
      {
        renderTarget: rt,
        cocTarget: post.cocRT,
        gatherTarget: post.gatherRT,
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
      dofTechnique: "physical-coc-aperture-gather",
      gatherScale: qualitySettings.gatherScale,
      sampleCount: qualitySettings.sampleCount,
      maximumCoCRadiusPx: Math.min(
        maximumBlurRadiusPx,
        qualitySettings.maximumCoCRadiusPx,
      ),
      cocAvailable: true,
      cocTargetWidthPx: post.cocRT.width,
      cocTargetHeightPx: post.cocRT.height,
      gatherTargetWidthPx: post.gatherRT.width,
      gatherTargetHeightPx: post.gatherRT.height,
      finalTargetWidthPx: post.finalRT.width,
      finalTargetHeightPx: post.finalRT.height,
      horizontalShaderRenderWidthPx: cocMaterial.uniforms.renderWidth.value as number,
      horizontalShaderRenderHeightPx: cocMaterial.uniforms.renderHeight.value as number,
      verticalShaderRenderWidthPx: gatherMaterial.uniforms.renderWidth.value as number,
      verticalShaderRenderHeightPx: gatherMaterial.uniforms.renderHeight.value as number,
      resourceGeneration: resourceGenerationRef.current,
    });
  }, [gl, heightPx, maximumBlurRadiusPx, readRuntimeInfo, renderQuality, setRuntimeInfo, widthPx, zoomEnabled]);

  useFrame(() => {
    if (!renderTarget.current || !offscreenScene.current) return;
    const imgDist = resolveGroundGlassImageDistanceMm(opticsState);
    const cam = groundGlassCamera.current;
    if (!cam) return;

    // Configure once with a conservative preliminary range so the actual
    // Three.js camera forward vector can drive the final pitch-safe range.
    const registeredSceneDef = sceneId ? getSceneById(sceneId) : undefined;
    const sceneDef =
      registeredSceneDef?.id === "understanding-camera-movements"
        ? {
            ...registeredSceneDef,
            bounds: cameraMovementRenderModel.subjectBounds,
          }
        : registeredSceneDef;
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

    // 1) render scene to color+depth renderTarget
    const prev = gl.getRenderTarget();
    gl.setRenderTarget(renderTarget.current);
    gl.setClearColor(SKY_COLOR.getHex(), 1);
    gl.clear(true, true, true);
    gl.render(offscreenScene.current, cam);

    // 2) Physical CoC, neutral aperture gather, then full-resolution composite.
    const post = postResourcesRef.current;
    if (post) {
      const {
        postSceneCoc,
        postSceneGather,
        postSceneComposite,
        orthoCam,
        cocRT,
        gatherRT,
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
      const currentQualitySettings = getRenderQualitySettings(
        sizeInputsRef.current.renderQuality || "standard",
      );
      const currentMaximumCoCRadiusPx = Math.min(
        maximumBlurRadiusPx,
        currentQualitySettings.maximumCoCRadiusPx,
      );

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

      // Prepare typed optical state once and apply it to both CoC and gather.
      let uniformPreparationError: string | null = null;
      let preparedDofState: ReturnType<typeof createGroundGlassDofUniformState> | null = null;
      try {
        const displayOpticsState = resolveGroundGlassDisplayOpticsState(sceneId, opticsState);
        preparedDofState = createGroundGlassDofUniformState(
          displayOpticsState,
          cam,
          focalLengthMm,
          CAMERA_CONSTANTS.filmWidthMm,
          CAMERA_CONSTANTS.filmHeightMm,
          0.1, // circleOfConfusionMm (must match core optics)
          aperture,
          dimsRef.current.internalWidthPx,
          dimsRef.current.internalHeightPx,
          currentMaximumCoCRadiusPx,
          displayBlurScale,
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

      gl.setRenderTarget(cocRT);
      gl.setClearColor(SKY_COLOR.getHex(), 1);
      gl.clear(true, true, true);
      gl.render(postSceneCoc, orthoCam);

      gatherMaterial.uniforms.tColor.value = (renderTarget.current as THREE.WebGLRenderTarget).texture;
      gatherMaterial.uniforms.tDepth.value = depthTex;
      gatherMaterial.uniforms.tCoC.value = cocRT.texture;
      gatherMaterial.uniforms.useRaw.value = rawDebug ? 1.0 : 0.0;
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

      gl.setRenderTarget(gatherRT);
      gl.setClearColor(SKY_COLOR.getHex(), 1);
      gl.clear(true, true, true);
      gl.render(postSceneGather, orthoCam);

      const compositeMesh = postSceneComposite.children[0] as THREE.Mesh;
      const compositeMaterial = compositeMesh.material as THREE.ShaderMaterial;
      compositeMaterial.uniforms.tGather.value = gatherRT.texture;
      compositeMaterial.uniforms.displayUpright.value = previewMode === "raw" ? 1.0 : 0.0;
      compositeMaterial.uniforms.renderWidth.value = dimsRef.current.internalWidthPx;
      compositeMaterial.uniforms.renderHeight.value = dimsRef.current.internalHeightPx;
      compositeMaterial.uniforms.showRing.value = 0.0;

      // compute focus ring projection using the shared projection helper
      const sceneDefForProjection = sceneId ? getSceneById(sceneId) : undefined;
      const projectedTargets = projectSceneFocusTargetsToGroundGlass({
        sceneDef: sceneDefForProjection,
        opticsState,
        aperture: aperture as unknown as ApertureValue,
        previewMode,
      });
      const primaryProjectedTarget = projectedTargets.length > 0 ? projectedTargets[0] : null;

      const shouldShow = Boolean(focusAssistEnabled) && !rawDebug && Boolean(primaryProjectedTarget?.visible);
      if (shouldShow && primaryProjectedTarget) {
        // pass raw uRaw/vRaw to shader; shader applies display orientation when sampling
        compositeMaterial.uniforms.ringCenter.value.set(primaryProjectedTarget.rawUv.u, primaryProjectedTarget.rawUv.v);
        compositeMaterial.uniforms.ringRadiusPx.value = focusRingRadiusPx ?? 68;
        compositeMaterial.uniforms.ringOpacity.value = focusRingOpacity ?? 0.8;
        compositeMaterial.uniforms.showRing.value = 1.0;
      }

      // Keep the final DOF result in an owned target. Besides enabling a
      // deterministic render sanity readback, this prevents a transient empty
      // default framebuffer from becoming the Ground Glass source of truth.
      gl.setRenderTarget(finalRT);
      gl.setClearColor(SKY_COLOR.getHex(), 1);
      gl.clear(true, true, true);
      gl.render(postSceneComposite, orthoCam);

      const sanityStateKey = createGroundGlassRenderSanityStateKey({
        resourceGeneration: resourceGenerationRef.current,
        sceneId,
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

    gl.setRenderTarget(prev);
  }, 1);

  return null;
}

export const GroundGlassRTT: React.FC<GroundGlassRTTProps> = ({ opticsState, focalLengthMm, sceneId, widthPx, heightPx, aperture, previewMode, focusRingRadiusPx, focusRingOpacity, rawDebug, focusAssistEnabled, renderQuality, zoomEnabled, channel = "default", presentationRegion }) => {
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
        <OffscreenRenderer opticsState={opticsState} focalLengthMm={focalLengthMm} sceneId={sceneId} widthPx={widthPx} heightPx={heightPx} aperture={aperture} previewMode={previewMode} focusRingRadiusPx={focusRingRadiusPx} focusRingOpacity={focusRingOpacity} rawDebug={rawDebug} focusAssistEnabled={focusAssistEnabled} renderQuality={renderQuality} zoomEnabled={zoomEnabled} channel={channel} presentationRegion={presentationRegion} />
      </Canvas>
    </div>
  );
};

export default GroundGlassRTT;
