import React, { useEffect, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { CAMERA_CONSTANTS } from "../utils/constants";

const SKY_COLOR = new THREE.Color("#dfe5ec");
const FLOOR_COLOR = new THREE.Color("#9aa6b5");
import { vecToWorld, toWorld } from "./rttUtils";
import geometry from "../scenes/architectureRiseGeometry";
import { getSceneById } from "../scenes/definitions";
import { projectSceneFocusTargetsToGroundGlass } from "./groundGlassTargetProjection";
import { createFocusFundamentalsGroup } from "./FocusFundamentalsSubjectFactory";
import { createArchitectureRiseGroup } from "./ArchitectureRiseSubjectFactory";
import { configureGroundGlassCamera } from "./configureGroundGlassCamera";
import { createGroundGlassDofUniformState } from "./createGroundGlassDofUniformState";
import { groundGlassSharedGlsl, groundGlassUniformDecls } from "./groundGlassDofShaders";
import type { DerivedOpticsState } from "../types/optics";
import type { ApertureValue } from "../types/camera";
import { useAppStore } from "../state/appStore";
import type { WebGLRenderer } from "three";
import { getRenderQualitySettings } from "./renderQuality";

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


import { resolveGroundGlassRttDimensions } from "./groundGlassRttDimensions";

function OffscreenRenderer({ opticsState, sceneId, widthPx, heightPx, aperture = 11.0, previewMode = 'raw', focusRingRadiusPx = 68, focusRingOpacity = 0.8, rawDebug = false, focusAssistEnabled = false, renderQuality = "standard", zoomEnabled = false, }: GroundGlassRTTProps) {
  const renderTarget = useRef<THREE.WebGLRenderTarget | null>(null);
  const offscreenScene = useRef<THREE.Scene | null>(null);
  const groundGlassCamera = useRef<THREE.PerspectiveCamera | null>(null);

  const { gl } = useThree();

  // RTT dimensions reference so both effect and frame loop can access current internal sizes
  const dimsRef = React.useRef(resolveGroundGlassRttDimensions({ logicalWidth: widthPx, logicalHeight: heightPx, renderQuality: renderQuality || "standard", devicePixelRatio: 1, zoomEnabled }));

  // refs for instance-owned resources (avoid storing on function object)
  type PostResources = {
    postSceneH: THREE.Scene;
    postSceneV: THREE.Scene;
    orthoCam: THREE.OrthographicCamera;
    tempRT: THREE.WebGLRenderTarget;
  };
  const postResourcesRef = React.useRef<PostResources | null>(null);
  const fallbackDepthRef = React.useRef<THREE.DataTexture | null>(null);
  const resourceGenerationRef = React.useRef<number>(0);

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
    // resolve desired internal RTT dimensions from quality profile, DPR and zoom state
    const rendererPixelRatio = (gl && typeof gl.getPixelRatio === 'function') ? gl.getPixelRatio() : (typeof window !== 'undefined' && window.devicePixelRatio) ? window.devicePixelRatio : 1;

    // collect canvas DOM and size info. Canvas DPR is authoritative from parent Canvas dpr prop
    const canvas = (gl && (gl as unknown as WebGLRenderer).domElement) as HTMLCanvasElement | undefined;
    const canvasRect = canvas ? canvas.getBoundingClientRect() : { width: widthPx, height: heightPx };
    const canvasCssWidth = Math.round(canvasRect.width);
    const canvasCssHeight = Math.round(canvasRect.height);
    const drawingBufferWidth = canvas ? canvas.width : Math.round(widthPx * rendererPixelRatio);
    const drawingBufferHeight = canvas ? canvas.height : Math.round(heightPx * rendererPixelRatio);

    const dims = resolveGroundGlassRttDimensions({ logicalWidth: widthPx, logicalHeight: heightPx, renderQuality: renderQuality || "standard", devicePixelRatio: rendererPixelRatio, zoomEnabled });
    dimsRef.current = dims;

    try {
      // store initial runtime RTT dims for UI readouts (best-effort placeholder until resources created)
      const setInfo = useAppStore.getState().setGroundGlassRttRuntimeInfo;
      if (setInfo) {
        const resolvedProfile = (renderQuality as import("../types/ui").RenderQualityProfile) || ("standard" as import("../types/ui").RenderQualityProfile);
        const configuredCanvasDpr = getRenderQualitySettings(resolvedProfile).dpr;
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
          colorTargetWidthPx: dims.internalWidthPx,
          colorTargetHeightPx: dims.internalHeightPx,
          depthTargetWidthPx: dims.internalWidthPx,
          depthTargetHeightPx: dims.internalHeightPx,
          blurTargetWidthPx: dims.internalWidthPx,
          blurTargetHeightPx: dims.internalHeightPx,
          resourceGeneration: resourceGenerationRef.current,
        });
      }
    } catch (err) {
      void err;
    }

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


    // set scene background to a neutral studio sky for better visibility
    scene.background = SKY_COLOR;
    // create full-screen quad geometry and placeholder materials
    const quadGeo = new THREE.PlaneGeometry(2, 2);

    const vertexShader = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position,1.0); }`;

    // Horizontal pass shader: includes shared uniform declarations and shared helper functions
    const fragH = `precision highp float; varying vec2 vUv; uniform sampler2D tColor; uniform sampler2D tDepth; ${groundGlassUniformDecls} ${groundGlassSharedGlsl}

    void main(){
      vec2 uv = vUv;
      if(useRaw > 0.5){ gl_FragColor = texture2D(tColor, uv); return; }
      float centerDepth = texture2D(tDepth, uv).x;
      float radius = 0.0;
      if (dofMode < 0.5) {
        radius = calculateParallelBlurRadiusPxFromDepth(centerDepth);
      } else {
        vec3 worldPos = reconstructWorldPosition(uv, centerDepth, inverseProjectionMatrix, cameraMatrixWorld);
        radius = calculateWedgeBlurRadiusPxFromWorldPosition(worldPos);
      }

      // fast-path: exact in-focus, avoid costly sampling for tiny radii
      float zeroBlurThreshold = 0.125; // px threshold in internal-target pixels
      if (radius <= zeroBlurThreshold) {
        gl_FragColor = texture2D(tColor, uv);
        return;
      }
      // symmetric sub-pixel handling for small radii (<1 px)
      if (radius < 1.0) {
        float frac = smoothstep(zeroBlurThreshold, 1.0, radius);
        float neighbourWeight = 0.25 * frac;
        float centreWeight = 1.0 - 2.0 * neighbourWeight;
        vec3 c0 = texture2D(tColor, uv).rgb;
        vec3 c1 = texture2D(tColor, uv + vec2(1.0 / renderWidth, 0.0)).rgb;
        vec3 cm1 = texture2D(tColor, uv - vec2(1.0 / renderWidth, 0.0)).rgb;
        vec3 color = cm1 * neighbourWeight + c0 * centreWeight + c1 * neighbourWeight;
        gl_FragColor = vec4(color, 1.0);
        return;
      }

      // multi-tap symmetric kernel
      float halfSampleCount = clamp(ceil(radius), 1.0, 7.0);
      float sigma = max(0.5, radius * 0.5);
      vec3 accum = vec3(0.0);
      float total = 0.0;
      for(int i=0;i<15;i++){
        float idx = float(i) - (halfSampleCount);
        // valid indices are -halfSampleCount .. +halfSampleCount
        if(idx < -halfSampleCount || idx > halfSampleCount) continue;
        float offsetPx = idx * (radius / halfSampleCount);
        vec2 o = vec2(offsetPx / renderWidth, 0.0);
        float sampleDepth = texture2D(tDepth, uv + o).x;
        if(dofMode >= 0.5){
          vec3 worldSample = reconstructWorldPosition(uv + o, sampleDepth, inverseProjectionMatrix, cameraMatrixWorld);
          float sampleRadius = calculateWedgeBlurRadiusPxFromWorldPosition(worldSample);
          if(abs(sampleRadius - radius) > max(2.0, radius * 0.5)) continue;
        }
        float sampleUmm = abs(viewZFromDepth(sampleDepth, near, far)) * 1000.0;
        float depthDeltaMm = abs(sampleUmm - (abs(viewZFromDepth(centerDepth, near, far)) * 1000.0));
        float depthRejectMm = max(20.0, (abs(viewZFromDepth(centerDepth, near, far)) * 1000.0) * 0.015);
        float depthWeight = 1.0 - smoothstep(depthRejectMm * 0.5, depthRejectMm, depthDeltaMm);
        vec3 c = texture2D(tColor, uv + o).rgb;
        float gaussW = exp(-0.5 * (offsetPx*offsetPx) / (sigma*sigma));
        float w = gaussW * depthWeight;
        if(w < 1e-3) continue;
        accum += c * w;
        total += w;
      }
      gl_FragColor = vec4(accum / max(total, 1e-6), 1.0);
    }`;

    // Vertical pass shader: uses same shared helpers and uniforms, plus ring UI uniforms
    const fragV = `precision highp float; varying vec2 vUv; uniform sampler2D tColor; uniform sampler2D tDepth; ${groundGlassUniformDecls} ${groundGlassSharedGlsl} uniform vec2 ringCenter; uniform float ringRadiusPx; uniform vec3 ringColor; uniform float ringOpacity; uniform float showRing; uniform float displayUpright;

    void main(){
      vec2 screenUv = vUv;
      vec2 sampleUv = (displayUpright > 0.5) ? vec2(1.0 - screenUv.x, 1.0 - screenUv.y) : screenUv;
      if(useRaw > 0.5){ vec3 colorRaw = texture2D(tColor, sampleUv).rgb; vec3 color = colorRaw; if(showRing > 0.5){ vec2 ringCenterScreen = (displayUpright > 0.5) ? vec2(1.0 - ringCenter.x, 1.0 - ringCenter.y) : ringCenter; vec2 px = screenUv * vec2(renderWidth, renderHeight); vec2 centerPx = ringCenterScreen * vec2(renderWidth, renderHeight); float d = distance(px, centerPx); float r = ringRadiusPx; float ring = smoothstep(r - 1.5, r - 0.5, d) - smoothstep(r + 0.5, r + 1.5, d); color = mix(color, ringColor, clamp(ring * ringOpacity, 0.0, 1.0)); } gl_FragColor = vec4(color,1.0); return; }
      float centerDepth = texture2D(tDepth, sampleUv).x;
      float radius = 0.0;
      if (dofMode < 0.5) {
        radius = calculateParallelBlurRadiusPxFromDepth(centerDepth);
      } else {
        vec3 worldPos = reconstructWorldPosition(sampleUv, centerDepth, inverseProjectionMatrix, cameraMatrixWorld);
        radius = calculateWedgeBlurRadiusPxFromWorldPosition(worldPos);
      }

      // fast-path: exact in-focus, avoid costly sampling for tiny radii
      float zeroBlurThreshold = 0.125; // px threshold in internal-target pixels
      if (radius <= zeroBlurThreshold) {
        vec3 color = texture2D(tColor, sampleUv).rgb;
        if(showRing > 0.5){ vec2 ringCenterScreen = (displayUpright > 0.5) ? vec2(1.0 - ringCenter.x, 1.0 - ringCenter.y) : ringCenter; vec2 px = screenUv * vec2(renderWidth, renderHeight); vec2 centerPx = ringCenterScreen * vec2(renderWidth, renderHeight); float d = distance(px, centerPx); float r = ringRadiusPx; float ring = smoothstep(r - 1.5, r - 0.5, d) - smoothstep(r + 0.5, r + 1.5, d); color = mix(color, ringColor, clamp(ring * ringOpacity, 0.0, 1.0)); }
        gl_FragColor = vec4(color,1.0);
        return;
      }

      if (radius < 1.0) {
        float frac = smoothstep(zeroBlurThreshold, 1.0, radius);
        float neighbourWeight = 0.25 * frac;
        float centreWeight = 1.0 - 2.0 * neighbourWeight;
        vec3 c0 = texture2D(tColor, sampleUv).rgb;
        vec3 c1 = texture2D(tColor, sampleUv + vec2(0.0, 1.0 / renderHeight)).rgb;
        vec3 cm1 = texture2D(tColor, sampleUv - vec2(0.0, 1.0 / renderHeight)).rgb;
        vec3 color = cm1 * neighbourWeight + c0 * centreWeight + c1 * neighbourWeight;
        if(showRing > 0.5){ vec2 ringCenterScreen = (displayUpright > 0.5) ? vec2(1.0 - ringCenter.x, 1.0 - ringCenter.y) : ringCenter; vec2 px = screenUv * vec2(renderWidth, renderHeight); vec2 centerPx = ringCenterScreen * vec2(renderWidth, renderHeight); float d = distance(px, centerPx); float r = ringRadiusPx; float ring = smoothstep(r - 1.5, r - 0.5, d) - smoothstep(r + 0.5, r + 1.5, d); color = mix(color, ringColor, clamp(ring * ringOpacity, 0.0, 1.0)); }
        gl_FragColor = vec4(color,1.0);
        return;
      }

      float halfSampleCount = clamp(ceil(radius), 1.0, 7.0);
      float sigma = max(0.5, radius * 0.5);
      vec3 accum = vec3(0.0);
      float total = 0.0;
      for(int i=0;i<15;i++){
        float idx = float(i) - (halfSampleCount);
        if(idx < -halfSampleCount || idx > halfSampleCount) continue;
        float offsetPx = idx * (radius / halfSampleCount);
        vec2 o = vec2(0.0, offsetPx / renderHeight);
        float sampleDepth = texture2D(tDepth, sampleUv + o).x;
        if(dofMode >= 0.5){
          vec3 worldSample = reconstructWorldPosition(sampleUv + o, sampleDepth, inverseProjectionMatrix, cameraMatrixWorld);
          float sampleRadius = calculateWedgeBlurRadiusPxFromWorldPosition(worldSample);
          if(abs(sampleRadius - radius) > max(2.0, radius * 0.5)) continue;
        }
        float sampleUmm = abs(viewZFromDepth(sampleDepth, near, far)) * 1000.0;
        float depthDeltaMm = abs(sampleUmm - (abs(viewZFromDepth(centerDepth, near, far)) * 1000.0));
        float depthRejectMm = max(20.0, (abs(viewZFromDepth(centerDepth, near, far)) * 1000.0) * 0.015);
        float depthWeight = 1.0 - smoothstep(depthRejectMm * 0.5, depthRejectMm, depthDeltaMm);
        vec3 c = texture2D(tColor, sampleUv + o).rgb;
        float gaussW = exp(-0.5 * (offsetPx*offsetPx) / (sigma*sigma));
        float w = gaussW * depthWeight;
        if(w < 1e-3) continue;
        accum += c * w;
        total += w;
      }
      vec3 color = accum / max(total, 1e-6);
      if(showRing > 0.5){ vec2 ringCenterScreen = (displayUpright > 0.5) ? vec2(1.0 - ringCenter.x, 1.0 - ringCenter.y) : ringCenter; vec2 px = screenUv * vec2(renderWidth, renderHeight); vec2 centerPx = ringCenterScreen * vec2(renderWidth, renderHeight); float d = distance(px, centerPx); float r = ringRadiusPx; float ring = smoothstep(r - 1.5, r - 0.5, d) - smoothstep(r + 0.5, r + 1.5, d); color = mix(color, ringColor, clamp(ring * ringOpacity, 0.0, 1.0)); }
      gl_FragColor = vec4(color,1.0);
    }`;

    const matH = new THREE.ShaderMaterial({ vertexShader, fragmentShader: fragH, uniforms: {
      tColor: { value: null }, tDepth: { value: null }, near: { value: 0.01 }, far: { value: 12.0 }, imageDistanceMm: { value: 100.0 }, focalLengthMm: { value: CAMERA_CONSTANTS.focalLengthMm }, fNumber: { value: 11.0 }, sensorWidthMm: { value: CAMERA_CONSTANTS.filmWidthMm }, renderWidth: { value: dimsRef.current.internalWidthPx }, renderHeight: { value: dimsRef.current.internalHeightPx }, maxCoC: { value: 60.0 }, useRaw: { value: 0.0 }, dofMode: { value: 0.0 }, lensCenterWorld: { value: new THREE.Vector3() }, focusPlanePoint: { value: new THREE.Vector3() }, focusPlaneNormal: { value: new THREE.Vector3() }, nearPlanePoint: { value: new THREE.Vector3() }, nearPlaneNormal: { value: new THREE.Vector3() }, farPlanePoint: { value: new THREE.Vector3() }, farPlaneNormal: { value: new THREE.Vector3() }, hasFiniteFar: { value: 0.0 }, inverseProjectionMatrix: { value: new THREE.Matrix4() }, cameraMatrixWorld: { value: new THREE.Matrix4() }, maximumBlurRadiusPx: { value: 60.0 }, circleOfConfusionMm: { value: 0.1 }, boundaryBlurRadiusPx: { value: 0.0 }, filmWidthMm: { value: CAMERA_CONSTANTS.filmWidthMm }, displayBlurScale: { value: 1.0 }
    }});
    const matV = new THREE.ShaderMaterial({ vertexShader, fragmentShader: fragV, uniforms: {
      tColor: { value: null }, tDepth: { value: null }, renderWidth: { value: dimsRef.current.internalWidthPx }, renderHeight: { value: dimsRef.current.internalHeightPx }, maxCoC: { value: 60.0 }, focalLengthMm: { value: CAMERA_CONSTANTS.focalLengthMm }, fNumber: { value: 11.0 }, imageDistanceMm: { value: 100.0 }, sensorWidthMm: { value: CAMERA_CONSTANTS.filmWidthMm }, near: { value: 0.01 }, far: { value: 12.0 }, ringCenter: { value: new THREE.Vector2(-1, -1) }, ringRadiusPx: { value: 0.0 }, ringColor: { value: new THREE.Vector3(59/255,130/255,246/255) }, ringOpacity: { value: 0.8 }, showRing: { value: 0.0 }, useRaw: { value: 0.0 }, displayUpright: { value: 0.0 }, dofMode: { value: 0.0 }, lensCenterWorld: { value: new THREE.Vector3() }, focusPlanePoint: { value: new THREE.Vector3() }, focusPlaneNormal: { value: new THREE.Vector3() }, nearPlanePoint: { value: new THREE.Vector3() }, nearPlaneNormal: { value: new THREE.Vector3() }, farPlanePoint: { value: new THREE.Vector3() }, farPlaneNormal: { value: new THREE.Vector3() }, hasFiniteFar: { value: 0.0 }, inverseProjectionMatrix: { value: new THREE.Matrix4() }, cameraMatrixWorld: { value: new THREE.Matrix4() }, maximumBlurRadiusPx: { value: 60.0 }, circleOfConfusionMm: { value: 0.1 }, boundaryBlurRadiusPx: { value: 0.0 }, filmWidthMm: { value: CAMERA_CONSTANTS.filmWidthMm }, displayBlurScale: { value: 1.0 }
    }});

    const quadH = new THREE.Mesh(quadGeo, matH);
    const quadV = new THREE.Mesh(quadGeo, matV);
    postSceneH.add(quadH);
    postSceneV.add(quadV);

    // store post resources (per-instance ref)
    postResourcesRef.current = { postSceneH, postSceneV, orthoCam, tempRT };

    // After resources are created, update runtime info with actual resource sizes
    try {
      const setInfo = useAppStore.getState().setGroundGlassRttRuntimeInfo;
      if (setInfo) {
        const resolvedProfile = (renderQuality as import("../types/ui").RenderQualityProfile) || ("standard" as import("../types/ui").RenderQualityProfile);
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
          resourceGeneration: resourceGenerationRef.current,
        });
      }
    } catch (err) { void err; }

    // For Focus Fundamentals use the shared subject factory (boards, floor)
    const sceneDef = sceneId ? getSceneById(sceneId) : undefined;
    let subjectGroup: THREE.Group | null = null;
    if (sceneDef && sceneId === "focus-fundamentals-two-targets") {
      subjectGroup = createFocusFundamentalsGroup();
      scene.add(subjectGroup);
    } else if (sceneDef && sceneId === "architecture-rise") {
      subjectGroup = createArchitectureRiseGroup();
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

    // If architecture scene, aim lights at the facade center for readable illumination
    if (sceneDef && sceneId === "architecture-rise") {
      const facadeCenter = new THREE.Vector3(
        geometry.building.center.x * 0.001,
        geometry.building.center.y * 0.001,
        geometry.facade.frontFacadeZ * 0.001,
      );
      const lightTarget = new THREE.Object3D();
      lightTarget.position.copy(facadeCenter);
      scene.add(lightTarget);

      // Key light: camera-left, above, slightly forward
      keyLight.position.set(facadeCenter.x - 2.5, facadeCenter.y + 3.5, facadeCenter.z - 2.0);
      keyLight.target = lightTarget;
      scene.add(keyLight);

      // Fill light: camera-right, lower intensity
      fillLight.position.set(facadeCenter.x + 2.0, facadeCenter.y + 1.5, facadeCenter.z - 3.0);
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
        if (renderTarget.current) {
          try { (renderTarget.current as THREE.WebGLRenderTarget).dispose(); } catch (err) { void err; }
          renderTarget.current = null;
        }
        // dispose temporary blur target
        try { tempRT.dispose(); } catch (err) { void err; }

        // dispose fallback depth
        if (fallbackDepthRef.current) {
          try { fallbackDepthRef.current.dispose(); } catch (err) { void err; }
          fallbackDepthRef.current = null;
        }

        // remove and dispose post resources
        const post = postResourcesRef.current;
        if (post) {
          try {
            // dispose quad materials and geometry
            [post.postSceneH, post.postSceneV].forEach((s) => {
              s.children.forEach((c) => {
                const m = c as THREE.Mesh;
                if (m.material) {
                  try { (m.material as THREE.Material).dispose(); } catch (err) { void err; }
                }
                if (m.geometry) {
                  try { (m.geometry as THREE.BufferGeometry).dispose(); } catch (err) { void err; }
                }
              });
            });
            // dispose tempRT already done above
            // remove scenes
            post.postSceneH.clear();
            post.postSceneV.clear();
          } catch (err) { void err; }
          postResourcesRef.current = null;
        }

        // remove subject group if it was added
        if (subjectGroup && scene) {
          scene.remove(subjectGroup);
        }
      } finally {
        // update diagnostics to indicate resources cleared
        try {
          const setInfo = useAppStore.getState().setGroundGlassRttRuntimeInfo;
          if (setInfo) setInfo(null);
        } catch (err) { void err; }
      }
    };
  }, [gl, widthPx, heightPx, sceneId, renderQuality, zoomEnabled]);

  useFrame(() => {
    if (!renderTarget.current || !offscreenScene.current) return;
    const imgDist = Math.abs(opticsState.filmPlane.point.z - opticsState.lensCenterWorld.z);
    const vertFovRad = 2 * Math.atan(CAMERA_CONSTANTS.filmHeightMm / (2 * imgDist));
    const vertFovDeg = (vertFovRad * 180) / Math.PI;

    if (!groundGlassCamera.current) {
      const cam = new THREE.PerspectiveCamera(vertFovDeg, widthPx / heightPx, 0.01, 100.0);
      groundGlassCamera.current = cam;
    }

    const cam = groundGlassCamera.current as THREE.PerspectiveCamera;

    // Scene-aware clipping for Focus Fundamentals and Architecture Rise
    const sceneDef = sceneId ? getSceneById(sceneId) : undefined;
    let nearWorld = 0.01;
    let farWorld = 10000;
    if (sceneDef && (sceneId === "focus-fundamentals-two-targets" || sceneId === "architecture-rise")) {
      const sceneMaxDepthMm = sceneDef.bounds?.max?.z ?? 12000;
      const computed = Math.max(4, (sceneMaxDepthMm - opticsState.lensCenterWorld.z) / 1000 + 1);
      farWorld = computed;
      nearWorld = 0.01;
    }

    cam.near = nearWorld;
    cam.far = farWorld;

    // configure an off-axis projection matrix that matches opticsState.filmPlaneCornersWorld and lens center
    // configure an off-axis projection matrix that matches opticsState.filmPlaneCornersWorld and lens center
    const cfg = configureGroundGlassCamera(cam, opticsState, nearWorld, farWorld);
    if (!cfg.ok) {
      // Do not silently swallow errors — record diagnostic and fall back to symmetric perspective
      const reason = cfg.reason;
      console.warn("GroundGlass camera configuration failed:", reason);
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
    } else {
      // success — optionally expose last cam frustum for debug
      // configuration successful; frustum extents available for debug via developer tools if needed
      // TODO: surface typed diagnostics through component state or callback in future
      // (avoid global state).
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
      const { postSceneH, postSceneV, orthoCam, tempRT } = post;
      // update H uniforms
      const meshH = postSceneH.children[0] as THREE.Mesh;
      const matH = meshH.material as THREE.ShaderMaterial;
      matH.uniforms.tColor.value = (renderTarget.current as THREE.WebGLRenderTarget).texture;
      // prefer the renderTarget.depthTexture when available, otherwise use a 1.0 depth fallback
      const depthTex = (renderTarget.current as unknown as { depthTexture?: THREE.Texture }).depthTexture ?? fallbackDepthRef.current ?? null;
      matH.uniforms.tDepth.value = depthTex;
      matH.uniforms.imageDistanceMm.value = imgDist;
      matH.uniforms.focalLengthMm.value = CAMERA_CONSTANTS.focalLengthMm;
      matH.uniforms.fNumber.value = aperture;
      matH.uniforms.renderWidth.value = dimsRef.current.internalWidthPx;
      matH.uniforms.renderHeight.value = dimsRef.current.internalHeightPx;
      matH.uniforms.near.value = cam.near;
      matH.uniforms.far.value = cam.far;
      // displayUpright is applied only in the final vertical pass (matV) so DOF and horizontal pass are identical for both preview modes
      // matH remains orientation-agnostic to ensure identical processing for raw/upright
      // matH.uniforms.displayUpright.value = previewMode === "upright" ? 1.0 : 0.0;
      // if depthTex is the 1x1 fallback we should bypass DOF and show raw color for debugging
      const isFallbackDepth = depthTex === fallbackDepthRef.current;
      // honor raw debug mode (bypass DOF) or fallback depth
      // For Architecture Rise, temporarily bypass DOF and show raw color to ensure subject is visible
      matH.uniforms.useRaw.value = (isFallbackDepth || rawDebug) ? 1.0 : 0.0;

      // prepare typed DOF uniform state and populate shader uniforms (single state applied to both passes)
      let uniformPreparationError: string | null = null;
      let preparedDofState: ReturnType<typeof createGroundGlassDofUniformState> | null = null;
      try {
        preparedDofState = createGroundGlassDofUniformState(
          opticsState,
          cam,
          CAMERA_CONSTANTS.focalLengthMm,
          CAMERA_CONSTANTS.filmWidthMm,
          CAMERA_CONSTANTS.filmHeightMm,
          0.1, // circleOfConfusionMm (must match core optics)
          aperture,
          dimsRef.current.internalWidthPx,
          dimsRef.current.internalHeightPx,
          matH.uniforms.maximumBlurRadiusPx.value as number,
          1.0, // displayBlurScale
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
        mat.uniforms.boundaryBlurRadiusPx.value = state.boundaryBlurRadiusPx;
        mat.uniforms.displayBlurScale.value = state.displayBlurScale;
        mat.uniforms.focalLengthMm.value = state.focalLengthMm;
        mat.uniforms.sensorWidthMm.value = state.sensorWidthMm;
        mat.uniforms.fNumber.value = state.fNumber;
        mat.uniforms.imageDistanceMm.value = state.imageDistanceMm;
        mat.uniforms.renderWidth.value = state.renderWidth;
        mat.uniforms.renderHeight.value = state.renderHeight;
      }

      if (preparedDofState) {
        applyDofStateToMaterial(matH, preparedDofState);
      } else {
        const coreModel = opticsState.diagnostics.depthOfFieldModel ?? "parallel";
        if (coreModel === "scheimpflug-wedge") {
          matH.uniforms.useRaw.value = 1.0; // bypass DOF visually
          matH.uniforms.dofMode.value = 0.0; // force parallel in shader to avoid uninitialized planes
          console.warn("GroundGlass DOF uniform preparation failed:", uniformPreparationError);
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
      matV.uniforms.imageDistanceMm.value = imgDist;
      matV.uniforms.focalLengthMm.value = CAMERA_CONSTANTS.focalLengthMm;
      matV.uniforms.fNumber.value = aperture;
      matV.uniforms.near.value = cam.near;
      matV.uniforms.far.value = cam.far;
      // honor raw debug mode (bypass DOF) or fallback depth
      matV.uniforms.useRaw.value = (isFallbackDepth || rawDebug) ? 1.0 : 0.0;
      // apply previously prepared DOF uniform state to vertical pass
      if (preparedDofState) {
        applyDofStateToMaterial(matV, preparedDofState);
      } else {
        const coreModel = opticsState.diagnostics.depthOfFieldModel ?? "parallel";
        if (coreModel === "scheimpflug-wedge") {
          matV.uniforms.useRaw.value = 1.0;
          matV.uniforms.dofMode.value = 0.0;
          console.warn("GroundGlass DOF uniform preparation failed:", uniformPreparationError);
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

      gl.setRenderTarget(null);
      gl.setClearColor(SKY_COLOR.getHex(), 1);
      gl.clear(true, true, true);
      gl.render(postSceneV, orthoCam);
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
      <Canvas dpr={qualitySettings.dpr} style={{ width: "100%", height: "100%" }} gl={{ preserveDrawingBuffer: false }} orthographic={false}>
        <OffscreenRenderer opticsState={opticsState} sceneId={sceneId} widthPx={widthPx} heightPx={heightPx} aperture={aperture} previewMode={previewMode} focusRingRadiusPx={focusRingRadiusPx} focusRingOpacity={focusRingOpacity} rawDebug={rawDebug} focusAssistEnabled={focusAssistEnabled} renderQuality={renderQuality} zoomEnabled={zoomEnabled} />
      </Canvas>
    </div>
  );
};

export default GroundGlassRTT;
