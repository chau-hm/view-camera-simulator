import React, { useEffect, useLayoutEffect, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { CAMERA_CONSTANTS } from "../utils/constants";

const SKY_COLOR = new THREE.Color("#dfe5ec");
const FLOOR_COLOR = new THREE.Color("#9aa6b5");
const GROUND_GLASS_GL_OPTIONS = { preserveDrawingBuffer: false } as const;
import { vecToWorld, toWorld } from "./rttUtils";
import { getSceneById } from "../scenes/definitions";
import { projectSceneFocusTargetsToGroundGlass } from "./groundGlassTargetProjection";
import {
  createRegisteredRttSubject,
  disposeRegisteredRttSubject,
  getSceneSubjectRegistration,
} from "./sceneSubjectRegistry";
import { configureGroundGlassCamera } from "./configureGroundGlassCamera";
import { createGroundGlassDofUniformState } from "./createGroundGlassDofUniformState";
import { groundGlassVertexShader, groundGlassHorizontalFragmentShader, groundGlassVerticalFragmentShader } from "./groundGlassDofShaderSources";
import type { DerivedOpticsState } from "../types/optics";
import type { ApertureValue } from "../types/camera";
import { useAppStore } from "../state/appStore";
import type { WebGLRenderer } from "three";
import { getRenderQualitySettings } from "./renderQuality";
import { getGroundGlassClipRangeWorld } from "./groundGlassRttScenes";
import {
  getGroundGlassDofVisualSettings,
  resolveGroundGlassDisplayOpticsState,
} from "./groundGlassVisualSettings";
import { analyzeGroundGlassRenderSanity } from "./groundGlassRenderSanity";
import { resolveGroundGlassRttDimensions } from "./groundGlassRttDimensions";
import { resizeGroundGlassRttResources } from "./groundGlassRttResources";

type GroundGlassRTTProps = {
  opticsState: DerivedOpticsState;
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
};

function OffscreenRenderer({ opticsState, sceneId, widthPx, heightPx, aperture = 11.0, previewMode = 'raw', focusRingRadiusPx = 68, focusRingOpacity = 0.8, rawDebug = false, focusAssistEnabled = false, renderQuality = "standard", zoomEnabled = false, }: GroundGlassRTTProps) {
  // single-frame flag to avoid repeating uniform-preparation warnings every frame
  const reportedUniformPreparationErrorRef = React.useRef<string | null>(null);
  const reportedCameraConfigurationErrorRef = React.useRef<string | null>(null);
  const lastRenderSanityStateKeyRef = React.useRef<string | null>(null);
  const renderTarget = useRef<THREE.WebGLRenderTarget | null>(null);
  const offscreenScene = useRef<THREE.Scene | null>(null);
  const groundGlassCamera = useRef<THREE.PerspectiveCamera | null>(null);

  const { gl } = useThree();
  const { maximumBlurRadiusPx, displayBlurScale } = getGroundGlassDofVisualSettings(sceneId);

  // RTT dimensions reference so both effect and frame loop can access current internal sizes
  const dimsRef = React.useRef(resolveGroundGlassRttDimensions({ logicalWidth: widthPx, logicalHeight: heightPx, renderQuality: renderQuality || "standard", devicePixelRatio: 1, zoomEnabled }));

  // refs for instance-owned resources (avoid storing on function object)
  type PostResources = {
    postSceneH: THREE.Scene;
    postSceneV: THREE.Scene;
    orthoCam: THREE.OrthographicCamera;
    tempRT: THREE.WebGLRenderTarget;
    finalRT: THREE.WebGLRenderTarget;
    rawDiagnosticRT: THREE.WebGLRenderTarget;
    finalDiagnosticRT: THREE.WebGLRenderTarget;
    displayScene: THREE.Scene;
    copyMaterial: THREE.ShaderMaterial;
  };
  const postResourcesRef = React.useRef<PostResources | null>(null);
  const fallbackDepthRef = React.useRef<THREE.DataTexture | null>(null);
  const resourceGenerationRef = React.useRef<number>(0);
  const sizeInputsRef = React.useRef({ widthPx, heightPx, renderQuality, zoomEnabled });
  sizeInputsRef.current = { widthPx, heightPx, renderQuality, zoomEnabled };

  // clear RTT runtime diagnostics when this renderer unmounts or is recreated
  React.useEffect(() => {
    return () => {
      try {
        const setInfo = useAppStore.getState().setGroundGlassRttRuntimeInfo;
        if (setInfo) setInfo(null);
      } catch (err) { void err; }
    };
  }, []);

  // expose preview/ring hints on the function object so runtime code inside useFrame can access them

  useEffect(() => {
    const sizeInputs = sizeInputsRef.current;
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
    

    // create postprocessing scenes and resources for separable DOF
    const postSceneH = new THREE.Scene();
    const postSceneV = new THREE.Scene();
    const orthoCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const tempRT = new THREE.WebGLRenderTarget(dimsRef.current.internalWidthPx, dimsRef.current.internalHeightPx);
    tempRT.depthBuffer = false;
    const finalRT = new THREE.WebGLRenderTarget(dimsRef.current.internalWidthPx, dimsRef.current.internalHeightPx);
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

    // Horizontal/Vertical fragment shaders are imported from groundGlassDofShaderSources
    const fragH = groundGlassHorizontalFragmentShader;

    // Vertical pass shader: uses the imported vertical fragment shader
    const fragV = groundGlassVerticalFragmentShader;

    // NOTE: fragH and fragV now import shared GLSL helpers and uniform decls from groundGlassDofShaders.



    const matH = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader: fragH,
      uniforms: {
        tColor: { value: null },
        tDepth: { value: null },
        near: { value: 0.01 },
        far: { value: 12.0 },
        imageDistanceMm: { value: 100.0 },
        focalLengthMm: { value: CAMERA_CONSTANTS.focalLengthMm },
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
        maximumBlurRadiusPx: { value: maximumBlurRadiusPx },
        circleOfConfusionMm: { value: 0.1 },
        filmWidthMm: { value: CAMERA_CONSTANTS.filmWidthMm },
        displayBlurScale: { value: displayBlurScale },
      },
    });

    const matV = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader: fragV,
      uniforms: {
        tColor: { value: null },
        tDepth: { value: null },
        renderWidth: { value: dimsRef.current.internalWidthPx },
        renderHeight: { value: dimsRef.current.internalHeightPx },
        focalLengthMm: { value: CAMERA_CONSTANTS.focalLengthMm },
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
        maximumBlurRadiusPx: { value: maximumBlurRadiusPx },
        circleOfConfusionMm: { value: 0.1 },
        filmWidthMm: { value: CAMERA_CONSTANTS.filmWidthMm },
        displayBlurScale: { value: displayBlurScale },
      },
    });

    const quadH = new THREE.Mesh(quadGeo, matH);
    const quadV = new THREE.Mesh(quadGeo, matV);
    const copyMaterial = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader: `precision highp float; varying vec2 vUv; uniform sampler2D tColor; void main(){ gl_FragColor = texture2D(tColor, vUv); }`,
      uniforms: { tColor: { value: finalRT.texture } },
      depthTest: false,
      depthWrite: false,
    });
    const displayQuad = new THREE.Mesh(quadGeo, copyMaterial);
    postSceneH.add(quadH);
    postSceneV.add(quadV);
    displayScene.add(displayQuad);

    // store post resources (per-instance ref)
    const postResources: PostResources = {
      postSceneH,
      postSceneV,
      orthoCam,
      tempRT,
      finalRT,
      rawDiagnosticRT,
      finalDiagnosticRT,
      displayScene,
      copyMaterial,
    };
    postResourcesRef.current = postResources;

    // After resources are created, update runtime info with actual resource sizes
    try {
      const setInfo = useAppStore.getState().setGroundGlassRttRuntimeInfo;
      if (setInfo) {
        const resolvedProfile =
          (sizeInputs.renderQuality as import("../types/ui").RenderQualityProfile) ||
          ("standard" as import("../types/ui").RenderQualityProfile);
        const configuredCanvasDpr = getRenderQualitySettings(resolvedProfile).dpr;
        const actualColorW = (renderTarget.current as THREE.WebGLRenderTarget).width;
        const actualColorH = (renderTarget.current as THREE.WebGLRenderTarget).height;
        const actualDepthW = (renderTarget.current as unknown as { depthTexture?: { image?: { width?: number; height?: number } } }).depthTexture?.image?.width ?? actualColorW;
        const actualDepthH = (renderTarget.current as unknown as { depthTexture?: { image?: { width?: number; height?: number } } }).depthTexture?.image?.height ?? actualColorH;
        const tempW = tempRT.width;
        const tempH = tempRT.height;

        setInfo({
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
          blurTargetWidthPx: tempW,
          blurTargetHeightPx: tempH,
          finalTargetWidthPx: finalRT.width,
          finalTargetHeightPx: finalRT.height,
          horizontalShaderRenderWidthPx: matH.uniforms.renderWidth.value as number,
          horizontalShaderRenderHeightPx: matH.uniforms.renderHeight.value as number,
          verticalShaderRenderWidthPx: matV.uniforms.renderWidth.value as number,
          verticalShaderRenderHeightPx: matV.uniforms.renderHeight.value as number,
          depthTextureAvailable: Boolean(
            (renderTarget.current as unknown as { depthTexture?: THREE.Texture }).depthTexture,
          ),
          resourceGeneration: resourceGenerationRef.current,
        });
      }
    } catch (err) { void err; }

    // Build the offscreen subject through the same registry used by R3F.
    const sceneDef = sceneId ? getSceneById(sceneId) : undefined;
    const registration = sceneId ? getSceneSubjectRegistration(sceneId) : undefined;
    const subjectGroup = sceneDef && sceneId ? createRegisteredRttSubject(sceneId) : null;
    if (subjectGroup) {
      scene.add(subjectGroup);
    } else {
      // Simple rear/front standards and a lens block for other scenes
      let rear: THREE.Mesh | null = null;
      rear = new THREE.Mesh(new THREE.BoxGeometry(toWorld(180), toWorld(140), toWorld(18)), new THREE.MeshStandardMaterial({ color: "#4b5563" }));
      // initial position — updated each frame using opticsState in useFrame
      rear.position.set(0, 0, 0);
      scene.add(rear);

      const floor = new THREE.Mesh(new THREE.PlaneGeometry(toWorld(4000), toWorld(4000)), new THREE.MeshStandardMaterial({ color: FLOOR_COLOR }));
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = -toWorld(200);
      scene.add(floor);
    }

    // Lighting: standardized studio lights for visibility
    const hemi = new THREE.HemisphereLight(new THREE.Color("#ffffff"), new THREE.Color("#64748b"), 0.9);
    scene.add(hemi);
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.6);
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.45);

    const lighting = registration?.rttLighting;
    if (sceneDef && lighting) {
      const targetWorld = vecToWorld(lighting.targetMm);
      const lightingTarget = new THREE.Vector3(...targetWorld);
      const lightTarget = new THREE.Object3D();
      lightTarget.position.copy(lightingTarget);
      scene.add(lightTarget);

      keyLight.position.set(
        lightingTarget.x + lighting.keyOffsetWorld.x,
        lightingTarget.y + lighting.keyOffsetWorld.y,
        lightingTarget.z + lighting.keyOffsetWorld.z,
      );
      keyLight.target = lightTarget;
      scene.add(keyLight);

      fillLight.position.set(
        lightingTarget.x + lighting.fillOffsetWorld.x,
        lightingTarget.y + lighting.fillOffsetWorld.y,
        lightingTarget.z + lighting.fillOffsetWorld.z,
      );
      fillLight.target = lightTarget;
      scene.add(fillLight);
    } else {
      // default key/fill positions for other scenes
      keyLight.position.set(-2, 4, 3);
      scene.add(keyLight);
      fillLight.position.set(2, 1, 1);
      scene.add(fillLight);
    }

    return () => {
      try {
        // dispose main color target
        try { rt.dispose(); } catch (err) { void err; }
        if (renderTarget.current === rt) renderTarget.current = null;
        // dispose temporary blur target
        try { tempRT.dispose(); } catch (err) { void err; }
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
            [post.postSceneH, post.postSceneV, post.displayScene].forEach((s) => {
              s.children.forEach((c) => {
                const m = c as THREE.Mesh;
                if (m.material) materials.add(m.material as THREE.Material);
                if (m.geometry) geometries.add(m.geometry as THREE.BufferGeometry);
              });
            });
            materials.forEach((material) => material.dispose());
            geometries.forEach((geometryResource) => geometryResource.dispose());
            // dispose tempRT already done above
            // remove scenes
            post.postSceneH.clear();
            post.postSceneV.clear();
            post.displayScene.clear();
          } catch (err) { void err; }
          postResourcesRef.current = null;
        }

        // remove subject group if it was added
        if (subjectGroup && scene) {
          scene.remove(subjectGroup);
          if (sceneId) disposeRegisteredRttSubject(sceneId, subjectGroup);
        }
        if (offscreenScene.current === scene) offscreenScene.current = null;
        if (groundGlassCamera.current === camera) groundGlassCamera.current = null;
        lastRenderSanityStateKeyRef.current = null;
      } finally {
        // update diagnostics to indicate resources cleared
        try {
          const setInfo = useAppStore.getState().setGroundGlassRttRuntimeInfo;
          if (setInfo) setInfo(null);
        } catch (err) { void err; }
      }
    };
  }, [displayBlurScale, gl, maximumBlurRadiusPx, sceneId]);

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
    const horizontalMaterial = (post.postSceneH.children[0] as THREE.Mesh)
      .material as THREE.ShaderMaterial;
    const verticalMaterial = (post.postSceneV.children[0] as THREE.Mesh)
      .material as THREE.ShaderMaterial;

    resizeGroundGlassRttResources(
      {
        renderTarget: rt,
        tempTarget: post.tempRT,
        finalTarget: post.finalRT,
        horizontalMaterial,
        verticalMaterial,
      },
      dims.internalWidthPx,
      dims.internalHeightPx,
    );
    dimsRef.current = dims;

    // Preserve content and sanity diagnostics until the next frame publishes a
    // sample for the resized targets. A normal view zoom/reset is not teardown.
    const currentInfo = useAppStore.getState().groundGlassRttRuntimeInfo;
    if (!currentInfo) return;
    const canvas = (gl as unknown as WebGLRenderer).domElement;
    const canvasRect = canvas?.getBoundingClientRect();
    const resolvedProfile =
      (renderQuality as import("../types/ui").RenderQualityProfile) ||
      ("standard" as import("../types/ui").RenderQualityProfile);
    const depthImage = rt.depthTexture?.image as
      | { width?: number; height?: number }
      | undefined;
    useAppStore.getState().setGroundGlassRttRuntimeInfo({
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
      blurTargetWidthPx: post.tempRT.width,
      blurTargetHeightPx: post.tempRT.height,
      finalTargetWidthPx: post.finalRT.width,
      finalTargetHeightPx: post.finalRT.height,
      horizontalShaderRenderWidthPx: horizontalMaterial.uniforms.renderWidth.value as number,
      horizontalShaderRenderHeightPx: horizontalMaterial.uniforms.renderHeight.value as number,
      verticalShaderRenderWidthPx: verticalMaterial.uniforms.renderWidth.value as number,
      verticalShaderRenderHeightPx: verticalMaterial.uniforms.renderHeight.value as number,
      resourceGeneration: resourceGenerationRef.current,
    });
  }, [gl, heightPx, renderQuality, widthPx, zoomEnabled]);

  useFrame(() => {
    if (!renderTarget.current || !offscreenScene.current) return;
    const imgDist = Math.abs(opticsState.filmPlane.point.z - opticsState.lensCenterWorld.z);
    const cam = groundGlassCamera.current;
    if (!cam) return;

    // Scene-aware clipping from the canonical bounds of every RTT scene.
    const sceneDef = sceneId ? getSceneById(sceneId) : undefined;
    const clipRange = getGroundGlassClipRangeWorld(sceneDef, opticsState.lensCenterWorld);
    const nearWorld = clipRange.near;
    const farWorld = clipRange.far;

    cam.near = nearWorld;
    cam.far = farWorld;

    // configure an off-axis projection matrix that matches opticsState.filmPlaneCornersWorld and lens center
    const cfg = configureGroundGlassCamera(cam, opticsState, nearWorld, farWorld);
    if (!cfg.ok) {
      // Do not silently swallow errors — record diagnostic and fall back to symmetric perspective
      const reason = cfg.reason;
      if (reportedCameraConfigurationErrorRef.current !== reason) {
        console.warn("GroundGlass camera configuration failed:", reason);
        reportedCameraConfigurationErrorRef.current = reason;
      }
      // fallback symmetric camera
      const imgDist = Math.abs(opticsState.filmPlane.point.z - opticsState.lensCenterWorld.z);
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

    // 2) horizontal separable pass -> tempRT
    const post = postResourcesRef.current;
    if (post) {
      const {
        postSceneH,
        postSceneV,
        orthoCam,
        tempRT,
        finalRT,
        rawDiagnosticRT,
        finalDiagnosticRT,
        displayScene,
        copyMaterial,
      } = post;
      // update H uniforms
      const meshH = postSceneH.children[0] as THREE.Mesh;
      const matH = meshH.material as THREE.ShaderMaterial;
      matH.uniforms.tColor.value = (renderTarget.current as THREE.WebGLRenderTarget).texture;
      // prefer the renderTarget.depthTexture when available, otherwise use a 1.0 depth fallback
      const depthTex = (renderTarget.current as unknown as { depthTexture?: THREE.Texture }).depthTexture ?? fallbackDepthRef.current ?? null;
      matH.uniforms.tDepth.value = depthTex;
      // ensure imageDistance uniform is never zero; use small positive fallback if necessary
      matH.uniforms.imageDistanceMm.value = Math.max(1e-6, imgDist);
      matH.uniforms.focalLengthMm.value = CAMERA_CONSTANTS.focalLengthMm;
      matH.uniforms.fNumber.value = aperture;
      matH.uniforms.renderWidth.value = dimsRef.current.internalWidthPx;
      matH.uniforms.renderHeight.value = dimsRef.current.internalHeightPx;
      matH.uniforms.near.value = cam.near;
      matH.uniforms.far.value = cam.far;
      // displayUpright is applied only in the final vertical pass (matV) so DOF and horizontal pass are identical for both preview modes
      // matH remains orientation-agnostic to ensure identical processing for raw/upright
      // matH.uniforms.displayUpright.value = previewMode === "upright" ? 1.0 : 0.0;
      // A missing depth texture is surfaced through diagnostics. Keep the DOF
      // path active with the explicit far-depth texture instead of silently
      // changing the user's preview to Raw RTT.
      const isFallbackDepth = depthTex === fallbackDepthRef.current;
      matH.uniforms.useRaw.value = rawDebug ? 1.0 : 0.0;

      // prepare typed DOF uniform state and populate shader uniforms (single state applied to both passes)
      let uniformPreparationError: string | null = null;
      let preparedDofState: ReturnType<typeof createGroundGlassDofUniformState> | null = null;
      try {
        const displayOpticsState = resolveGroundGlassDisplayOpticsState(sceneId, opticsState);
        preparedDofState = createGroundGlassDofUniformState(
          displayOpticsState,
          cam,
          CAMERA_CONSTANTS.focalLengthMm,
          CAMERA_CONSTANTS.filmWidthMm,
          CAMERA_CONSTANTS.filmHeightMm,
          0.1, // circleOfConfusionMm (must match core optics)
          aperture,
          dimsRef.current.internalWidthPx,
          dimsRef.current.internalHeightPx,
          matH.uniforms.maximumBlurRadiusPx.value as number,
          displayBlurScale,
        );
      } catch (err) {
        uniformPreparationError = err instanceof Error ? err.message : String(err);
      }

      function applyDofStateToMaterial(mat: THREE.ShaderMaterial, state: ReturnType<typeof createGroundGlassDofUniformState>) {
        mat.uniforms.dofMode.value = state.mode;
        mat.uniforms.lensCenterWorld.value.set(state.lensCenterWorld[0], state.lensCenterWorld[1], state.lensCenterWorld[2]);
        mat.uniforms.focusPlanePoint.value.set(state.focusPlanePoint[0], state.focusPlanePoint[1], state.focusPlanePoint[2]);
        mat.uniforms.focusPlaneNormal.value.set(state.focusPlaneNormal[0], state.focusPlaneNormal[1], state.focusPlaneNormal[2]);
        if (state.nearPlanePoint) mat.uniforms.nearPlanePoint.value.set(state.nearPlanePoint[0], state.nearPlanePoint[1], state.nearPlanePoint[2]);
        if (state.nearPlaneNormal) mat.uniforms.nearPlaneNormal.value.set(state.nearPlaneNormal[0], state.nearPlaneNormal[1], state.nearPlaneNormal[2]);
        if (state.farPlanePoint) mat.uniforms.farPlanePoint.value.set(state.farPlanePoint[0], state.farPlanePoint[1], state.farPlanePoint[2]);
        if (state.farPlaneNormal) mat.uniforms.farPlaneNormal.value.set(state.farPlaneNormal[0], state.farPlaneNormal[1], state.farPlaneNormal[2]);
        mat.uniforms.hasFiniteFar.value = state.hasFiniteFarPlane ? 1.0 : 0.0;
        mat.uniforms.inverseProjectionMatrix.value.copy(new THREE.Matrix4().fromArray(state.inverseProjectionMatrix));
        mat.uniforms.cameraMatrixWorld.value.copy(new THREE.Matrix4().fromArray(state.cameraMatrixWorld));
        mat.uniforms.maximumBlurRadiusPx.value = state.maximumBlurRadiusPx;
        mat.uniforms.displayBlurScale.value = state.displayBlurScale;
        mat.uniforms.focalLengthMm.value = state.focalLengthMm;
        mat.uniforms.filmWidthMm.value = state.filmWidthMm;
        mat.uniforms.fNumber.value = state.fNumber;
        mat.uniforms.imageDistanceMm.value = state.imageDistanceMm;
        mat.uniforms.renderWidth.value = state.renderWidth;
        mat.uniforms.renderHeight.value = state.renderHeight;
      }

      if (preparedDofState) {
        applyDofStateToMaterial(matH, preparedDofState);
        reportedUniformPreparationErrorRef.current = null;
      } else {
        // Keep the last valid shader state. Do not conceal configuration errors
        // by silently switching the user to Raw RTT.
        if (uniformPreparationError && reportedUniformPreparationErrorRef.current !== uniformPreparationError) {
          console.warn("GroundGlass DOF uniform preparation failed:", uniformPreparationError);
          reportedUniformPreparationErrorRef.current = uniformPreparationError ?? "unknown";
        }
      }

      gl.setRenderTarget(tempRT);
      gl.setClearColor(SKY_COLOR.getHex(), 1);
      gl.clear(true, true, true);
      gl.render(postSceneH, orthoCam);

      // 3) vertical pass -> screen
      const meshV = postSceneV.children[0] as THREE.Mesh;
      const matV = meshV.material as THREE.ShaderMaterial;
      matV.uniforms.tColor.value = (tempRT as THREE.WebGLRenderTarget).texture;
      matV.uniforms.tDepth.value = depthTex;
      matV.uniforms.renderWidth.value = dimsRef.current.internalWidthPx;
      matV.uniforms.renderHeight.value = dimsRef.current.internalHeightPx;
      // ensure imageDistance uniform is never zero; use small positive fallback if necessary
      matV.uniforms.imageDistanceMm.value = Math.max(1e-6, imgDist);
      matV.uniforms.focalLengthMm.value = CAMERA_CONSTANTS.focalLengthMm;
      matV.uniforms.fNumber.value = aperture;
      matV.uniforms.near.value = cam.near;
      matV.uniforms.far.value = cam.far;
      // Only the explicit developer toggle bypasses DOF.
      matV.uniforms.useRaw.value = rawDebug ? 1.0 : 0.0;
      // apply previously prepared DOF uniform state to vertical pass
      if (preparedDofState) {
        applyDofStateToMaterial(matV, preparedDofState);
      } else {
        if (uniformPreparationError && reportedUniformPreparationErrorRef.current !== uniformPreparationError) {
          console.warn("GroundGlass DOF uniform preparation failed:", uniformPreparationError);
          reportedUniformPreparationErrorRef.current = uniformPreparationError ?? "unknown";
        }
      }

      // For Architecture we still allow final display inversion to be applied (displayUpright)
      // apply final display orientation only here (final blit)
      // map previewMode to display orientation: raw = physical inversion, upright = no inversion
      matV.uniforms.displayUpright.value = previewMode === "raw" ? 1.0 : 0.0;
      // hide focus ring in raw debug mode
      if (rawDebug) matV.uniforms.showRing.value = 0.0;

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
        matV.uniforms.ringCenter.value.set(primaryProjectedTarget.rawUv.u, primaryProjectedTarget.rawUv.v);
        matV.uniforms.ringRadiusPx.value = focusRingRadiusPx ?? 68;
        matV.uniforms.ringOpacity.value = focusRingOpacity ?? 0.8;
        matV.uniforms.showRing.value = 1.0;
      } else {
        matV.uniforms.showRing.value = 0.0;
      }

      // Keep the final DOF result in an owned target. Besides enabling a
      // deterministic render sanity readback, this prevents a transient empty
      // default framebuffer from becoming the Ground Glass source of truth.
      gl.setRenderTarget(finalRT);
      gl.setClearColor(SKY_COLOR.getHex(), 1);
      gl.clear(true, true, true);
      gl.render(postSceneV, orthoCam);

      const sanityStateKey = [
        resourceGenerationRef.current,
        sceneId,
        previewMode,
        rawDebug ? 1 : 0,
        zoomEnabled ? 1 : 0,
        aperture,
        dimsRef.current.internalWidthPx,
        dimsRef.current.internalHeightPx,
        opticsState.focusPlane?.point.x,
        opticsState.focusPlane?.point.y,
        opticsState.focusPlane?.point.z,
        opticsState.focusPlane?.normal.x,
        opticsState.focusPlane?.normal.y,
        opticsState.focusPlane?.normal.z,
        opticsState.depthOfFieldNearPlane?.point.z,
        opticsState.depthOfFieldFarPlane?.point.z,
      ].join(":");

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
          const currentInfo = useAppStore.getState().groundGlassRttRuntimeInfo;
          if (currentInfo) {
            useAppStore.getState().setGroundGlassRttRuntimeInfo({
              ...currentInfo,
              cameraNearWorld: cam.near,
              cameraFarWorld: cam.far,
              cameraConfigurationOk: cfg.ok,
              cameraConfigurationError: cfg.ok ? null : cfg.reason,
              projectionDeterminant: cfg.ok ? cfg.determinant : cam.projectionMatrix.determinant(),
              depthTextureAvailable: !isFallbackDepth,
              dofMode:
                preparedDofState?.mode === 1
                  ? "derived-planes"
                  : opticsState.diagnostics.groundGlassDofModel ?? "parallel-thin-lens",
              uniformsFinite: Boolean(preparedDofState),
              uniformPreparationError,
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
          const currentInfo = useAppStore.getState().groundGlassRttRuntimeInfo;
          if (currentInfo) {
            useAppStore.getState().setGroundGlassRttRuntimeInfo({
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

export const GroundGlassRTT: React.FC<GroundGlassRTTProps> = ({ opticsState, sceneId, widthPx, heightPx, aperture, previewMode, focusRingRadiusPx, focusRingOpacity, rawDebug, focusAssistEnabled, renderQuality, zoomEnabled }) => {
  // Canvas is used to host the three.js scene that displays the render target as a fullscreen quad.
  const resolvedProfile = renderQuality ?? ("standard" as import("../types/ui").RenderQualityProfile);
  const qualitySettings = getRenderQualitySettings(resolvedProfile);

  return (
    <div style={{ width: "100%", height: "100%" }}>
      <Canvas dpr={qualitySettings.dpr} style={{ width: "100%", height: "100%" }} gl={GROUND_GLASS_GL_OPTIONS} orthographic={false}>
        <OffscreenRenderer opticsState={opticsState} sceneId={sceneId} widthPx={widthPx} heightPx={heightPx} aperture={aperture} previewMode={previewMode} focusRingRadiusPx={focusRingRadiusPx} focusRingOpacity={focusRingOpacity} rawDebug={rawDebug} focusAssistEnabled={focusAssistEnabled} renderQuality={renderQuality} zoomEnabled={zoomEnabled} />
      </Canvas>
    </div>
  );
};

export default GroundGlassRTT;
