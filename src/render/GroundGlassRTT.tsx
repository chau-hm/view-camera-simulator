import React, { useEffect, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { CAMERA_CONSTANTS } from "../utils/constants";
import { vecToWorld, toWorld } from "./rttUtils";
import { getSceneById } from "../scenes/definitions";
import { projectWorldPointToGroundGlass } from "./groundGlassProjection";
import type { DerivedOpticsState } from "../types/optics";

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
};

type PostResources = {
  postSceneH: THREE.Scene;
  postSceneV: THREE.Scene;
  orthoCam: THREE.OrthographicCamera;
  tempRT: THREE.WebGLRenderTarget;
};

function OffscreenRenderer({ opticsState, sceneId, widthPx, heightPx, aperture = 11.0, previewMode = 'raw', focusRingRadiusPx = 68, focusRingOpacity = 0.8, rawDebug = false, }: GroundGlassRTTProps) {
  const renderTarget = useRef<THREE.WebGLRenderTarget | null>(null);
  const offscreenScene = useRef<THREE.Scene | null>(null);
  const groundGlassCamera = useRef<THREE.PerspectiveCamera | null>(null);

  const { gl } = useThree();
  // expose preview/ring hints on the function object so runtime code inside useFrame can access them

  useEffect(() => {
    const rt = new THREE.WebGLRenderTarget(widthPx, heightPx);
    // attach a depth texture so we can do depth-aware DOF
    // DepthTexture constructor typing varies across three.js versions; access via unknown and a conservative factory
    type UnknownCtor = new (...args: unknown[]) => unknown;
    const DepthTextureCtor = (THREE as unknown as { DepthTexture?: UnknownCtor }).DepthTexture;
    const depthTex = DepthTextureCtor ? new DepthTextureCtor(widthPx, heightPx) : undefined;
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

    const scene = new THREE.Scene();
    offscreenScene.current = scene;

    // add simple lighting so MeshStandardMaterial is visible in offscreen render
    const ambient = new THREE.AmbientLight(0xffffff, 0.45);
    scene.add(ambient);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(0, 10, 10);
    scene.add(dirLight);

    // create postprocessing scenes and resources for separable DOF
    const postSceneH = new THREE.Scene();
    const postSceneV = new THREE.Scene();
    const orthoCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const tempRT = new THREE.WebGLRenderTarget(widthPx, heightPx);

    // fallback 1x1 depth texture (depth=1.0) for builds without DepthTexture support
    const depthFallbackData = new Uint8Array([255, 255, 255, 255]);
    const fallbackDepth = new THREE.DataTexture(depthFallbackData, 1, 1, THREE.RGBAFormat);
    fallbackDepth.needsUpdate = true;
    // expose fallback for cleanup if needed
    (OffscreenRenderer as unknown as { _fallbackDepth?: THREE.DataTexture })._fallbackDepth = fallbackDepth;

    // create full-screen quad geometry and placeholder materials
    const quadGeo = new THREE.PlaneGeometry(2, 2);

    type PostResources = {
      postSceneH: THREE.Scene;
      postSceneV: THREE.Scene;
      orthoCam: THREE.OrthographicCamera;
      tempRT: THREE.WebGLRenderTarget;
    };
    const vertexShader = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position,1.0); }`;
    const fragH = `precision highp float; varying vec2 vUv; uniform sampler2D tColor; uniform sampler2D tDepth; uniform float near; uniform float far; uniform float imageDistanceMm; uniform float focalLengthMm; uniform float fNumber; uniform float sensorWidthMm; uniform float renderWidth; uniform float renderHeight; uniform float maxCoC; uniform float useRaw;
    float viewZFromDepth(float depth){ float z_n = depth * 2.0 - 1.0; return (2.0 * near * far) / (far + near - z_n * (far - near)); }
    float computeCoCPx(float depth){ float viewZ = viewZFromDepth(depth); float U = abs(viewZ) * 1000.0; float f = focalLengthMm; float vObject = (f * U) / max(0.0001, (U - f)); float apertureDiameter = f / max(1.0, fNumber); float cocMm = apertureDiameter * abs(1.0 - (imageDistanceMm / vObject)); float pixelsPerMm = renderWidth / sensorWidthMm; return clamp(cocMm * pixelsPerMm, 0.0, maxCoC); }
    void main(){ vec2 uv = vUv; if(useRaw > 0.5){ gl_FragColor = texture2D(tColor, uv); return; } float depth = texture2D(tDepth, uv).x; float coc = computeCoCPx(depth); float radius = min(maxCoC, coc); // blur radius in pixels
    float sampleStep = 1.0; // px step
    float sampleCountF = clamp(floor(radius / sampleStep) * 2.0 + 1.0, 1.0, 15.0);
    float halfSamples = floor((sampleCountF - 1.0) * 0.5);
    float sigma = max(0.5, radius * 0.35);
    vec3 accum = vec3(0.0); float total = 0.0; for(int i=0;i<15;i++){ float idx = float(i) - halfSamples; if(abs(idx) > halfSamples) continue; float offsetPx = (halfSamples < 0.5) ? 0.0 : idx * (radius / max(halfSamples, 1.0)); vec2 o = vec2(offsetPx / renderWidth, 0.0); vec3 c = texture2D(tColor, uv + o).rgb; float w = exp(-0.5 * (offsetPx*offsetPx) / (sigma*sigma)); accum += c * w; total += w; } gl_FragColor = vec4(accum / max(total, 1e-6), 1.0); }`;
    const fragV = `precision highp float; varying vec2 vUv; uniform sampler2D tColor; uniform sampler2D tDepth; uniform float renderWidth; uniform float renderHeight; uniform float maxCoC; uniform float focalLengthMm; uniform float fNumber; uniform float imageDistanceMm; uniform float sensorWidthMm; uniform float near; uniform float far; uniform vec2 ringCenter; uniform float ringRadiusPx; uniform vec3 ringColor; uniform float ringOpacity; uniform float showRing; uniform float useRaw;
    float viewZFromDepth(float depth){ float z_n = depth * 2.0 - 1.0; return (2.0 * near * far) / (far + near - z_n * (far - near)); }
    float computeCoCPx(float depth){ float viewZ = viewZFromDepth(depth); float U = abs(viewZ) * 1000.0; float f = focalLengthMm; float vObject = (f * U) / max(0.0001, (U - f)); float apertureDiameter = f / max(1.0, fNumber); float cocMm = apertureDiameter * abs(1.0 - (imageDistanceMm / vObject)); float pixelsPerMm = renderWidth / sensorWidthMm; return clamp(cocMm * pixelsPerMm, 0.0, maxCoC); }
    void main(){ vec2 uv = vUv; if(useRaw > 0.5){ vec3 colorRaw = texture2D(tColor, uv).rgb; vec3 color = colorRaw; if(showRing > 0.5){ vec2 px = uv * vec2(renderWidth, renderHeight); vec2 centerPx = ringCenter * vec2(renderWidth, renderHeight); float d = distance(px, centerPx); float r = ringRadiusPx; float ring = smoothstep(r - 1.5, r - 0.5, d) - smoothstep(r + 0.5, r + 1.5, d); color = mix(color, ringColor, clamp(ring * ringOpacity, 0.0, 1.0)); } gl_FragColor = vec4(color,1.0); return; } float depth = texture2D(tDepth, uv).x; float coc = computeCoCPx(depth); float radius = min(maxCoC, coc); float sampleStep = 1.0; float sampleCountF = clamp(floor(radius / sampleStep) * 2.0 + 1.0, 1.0, 15.0); float halfSamples = floor((sampleCountF - 1.0) * 0.5); float sigma = max(0.5, radius * 0.35); vec3 accum = vec3(0.0); float total = 0.0; for(int i=0;i<15;i++){ float idx = float(i) - halfSamples; if(abs(idx) > halfSamples) continue; float offsetPx = (halfSamples < 0.5) ? 0.0 : idx * (radius / max(halfSamples, 1.0)); vec2 o = vec2(0.0, offsetPx / renderHeight); vec3 c = texture2D(tColor, uv + o).rgb; float w = exp(-0.5 * (offsetPx*offsetPx) / (sigma*sigma)); accum += c * w; total += w; } vec3 color = accum / max(total, 1e-6);
    if(showRing > 0.5){ vec2 px = uv * vec2(renderWidth, renderHeight); vec2 centerPx = ringCenter * vec2(renderWidth, renderHeight); float d = distance(px, centerPx); float r = ringRadiusPx; float ring = smoothstep(r - 1.5, r - 0.5, d) - smoothstep(r + 0.5, r + 1.5, d); color = mix(color, ringColor, clamp(ring * ringOpacity, 0.0, 1.0)); }
    gl_FragColor = vec4(color,1.0); }`;

    const matH = new THREE.ShaderMaterial({ vertexShader, fragmentShader: fragH, uniforms: {
      tColor: { value: null }, tDepth: { value: null }, near: { value: 0.1 }, far: { value: 10000.0 }, imageDistanceMm: { value: 100.0 }, focalLengthMm: { value: CAMERA_CONSTANTS.focalLengthMm }, fNumber: { value: 11.0 }, sensorWidthMm: { value: CAMERA_CONSTANTS.filmWidthMm }, renderWidth: { value: widthPx }, renderHeight: { value: heightPx }, maxCoC: { value: 60.0 }, useRaw: { value: 0.0 }
    }});
    const matV = new THREE.ShaderMaterial({ vertexShader, fragmentShader: fragV, uniforms: {
      tColor: { value: null }, tDepth: { value: null }, renderWidth: { value: widthPx }, renderHeight: { value: heightPx }, maxCoC: { value: 60.0 }, focalLengthMm: { value: CAMERA_CONSTANTS.focalLengthMm }, fNumber: { value: 11.0 }, imageDistanceMm: { value: 100.0 }, sensorWidthMm: { value: CAMERA_CONSTANTS.filmWidthMm }, near: { value: 0.1 }, far: { value: 10000.0 }, ringCenter: { value: new THREE.Vector2(-1, -1) }, ringRadiusPx: { value: 0.0 }, ringColor: { value: new THREE.Vector3(59/255,130/255,246/255) }, ringOpacity: { value: 0.8 }, showRing: { value: 0.0 }, useRaw: { value: 0.0 }
    }});

    const quadH = new THREE.Mesh(quadGeo, matH);
    const quadV = new THREE.Mesh(quadGeo, matV);
    postSceneH.add(quadH);
    postSceneV.add(quadV);

    // store post resources
    (OffscreenRenderer as unknown as { _post?: PostResources })._post = { postSceneH, postSceneV, orthoCam, tempRT };

    // Simple rear/front standards and a lens block
    let rear: THREE.Mesh | null = null;
    rear = new THREE.Mesh(new THREE.BoxGeometry(toWorld(180), toWorld(140), toWorld(18)), new THREE.MeshStandardMaterial({ color: "#4b5563" }));
    // initial position — updated each frame using opticsState
    rear.position.set(0, 0, 0);
    scene.add(rear);

    // frontGroup is intentionally not added to the offscreen scene to avoid occlusion
    const frontGroup = new THREE.Group();
    const frontBox = new THREE.Mesh(new THREE.BoxGeometry(toWorld(180), toWorld(140), toWorld(12)), new THREE.MeshStandardMaterial({ color: "#6b7280" }));
    frontGroup.add(frontBox);
    const frontPanel = new THREE.Mesh(new THREE.BoxGeometry(toWorld(100), toWorld(100), toWorld(8)), new THREE.MeshStandardMaterial({ color: "#9ca3af" }));
    frontPanel.position.set(0, 0, toWorld(8));
    frontGroup.add(frontPanel);
    const lensCyl = new THREE.Mesh(new THREE.CylinderGeometry(toWorld(18), toWorld(18), toWorld(18), 24), new THREE.MeshStandardMaterial({ color: "#1f2937" }));
    lensCyl.rotation.x = Math.PI / 2;
    lensCyl.position.set(0, 0, toWorld(16));
    frontGroup.add(lensCyl);

    // focus targets — positions are scene-local and independent of opticsState
    const sceneDef = sceneId ? getSceneById(sceneId) : undefined;
    const targetMeshes: THREE.Mesh[] = [];
    (sceneDef?.focusTargets ?? []).forEach((t) => {
      const s = new THREE.Mesh(new THREE.SphereGeometry(toWorld(20), 16, 12), new THREE.MeshStandardMaterial({ color: "#ef4444" }));
      s.position.set(...vecToWorld(t.worldPosition));
      scene.add(s);
      targetMeshes.push(s);
    });

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(toWorld(4000), toWorld(4000)), new THREE.MeshStandardMaterial({ color: "#0b1220" }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -toWorld(200);
    scene.add(floor);

    return () => {
      rt.dispose();
      tempRT.dispose();
      // clear post resources
      (OffscreenRenderer as unknown as { _post?: PostResources })._post = undefined;
    };
  }, [gl, widthPx, heightPx, sceneId]);

  useFrame(() => {
    if (!renderTarget.current || !offscreenScene.current) return;
    const imgDist = Math.abs(opticsState.filmPlane.point.z - opticsState.lensCenterWorld.z);
    const vertFovRad = 2 * Math.atan(CAMERA_CONSTANTS.filmHeightMm / (2 * imgDist));
    const vertFovDeg = (vertFovRad * 180) / Math.PI;

    if (!groundGlassCamera.current) {
      const cam = new THREE.PerspectiveCamera(vertFovDeg, widthPx / heightPx, 0.1, 10000);
      groundGlassCamera.current = cam;
    }

    const cam = groundGlassCamera.current as THREE.PerspectiveCamera;
    cam.fov = vertFovDeg;
    cam.aspect = widthPx / heightPx;
    cam.updateProjectionMatrix();
    const lensPos = new THREE.Vector3(opticsState.lensCenterWorld.x * 0.001, opticsState.lensCenterWorld.y * 0.001, opticsState.lensCenterWorld.z * 0.001);
    cam.position.copy(lensPos);
    const dir = new THREE.Vector3(opticsState.opticalAxis.direction.x, opticsState.opticalAxis.direction.y, opticsState.opticalAxis.direction.z);
    const lookAt = new THREE.Vector3().copy(lensPos).add(dir.multiplyScalar(1000));
    cam.lookAt(lookAt);

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
    } catch {
      // ignore
    }

    // 1) render scene to color+depth renderTarget
    const prev = gl.getRenderTarget();
    gl.setRenderTarget(renderTarget.current);
    gl.setClearColor(0x0b1220, 1);
    gl.clear(true, true, true);
    gl.render(offscreenScene.current, cam);

    // 2) horizontal separable pass -> tempRT
    const post = (OffscreenRenderer as unknown as { _post?: PostResources })._post;
    if (post) {
      const { postSceneH, postSceneV, orthoCam, tempRT } = post;
      // update H uniforms
      const meshH = postSceneH.children[0] as THREE.Mesh;
      const matH = meshH.material as THREE.ShaderMaterial;
      matH.uniforms.tColor.value = (renderTarget.current as THREE.WebGLRenderTarget).texture;
      // prefer the renderTarget.depthTexture when available, otherwise use a 1.0 depth fallback
      const depthTex = (renderTarget.current as unknown as { depthTexture?: THREE.Texture }).depthTexture ?? (OffscreenRenderer as unknown as { _fallbackDepth?: THREE.DataTexture })._fallbackDepth ?? null;
      matH.uniforms.tDepth.value = depthTex;
      matH.uniforms.imageDistanceMm.value = imgDist;
      matH.uniforms.focalLengthMm.value = CAMERA_CONSTANTS.focalLengthMm;
      matH.uniforms.fNumber.value = aperture;
      matH.uniforms.renderWidth.value = widthPx;
      matH.uniforms.renderHeight.value = heightPx;
      matH.uniforms.near.value = cam.near;
      matH.uniforms.far.value = cam.far;
      // if depthTex is the 1x1 fallback we should bypass DOF and show raw color for debugging
      const isFallbackDepth = depthTex === (OffscreenRenderer as unknown as { _fallbackDepth?: THREE.DataTexture })._fallbackDepth;
      // honor raw debug mode (bypass DOF) or fallback depth
      matH.uniforms.useRaw.value = (isFallbackDepth || rawDebug) ? 1.0 : 0.0;

      gl.setRenderTarget(tempRT);
      gl.setClearColor(0x0b1220, 1);
      gl.clear(true, true, true);
      gl.render(postSceneH, orthoCam);

      // 3) vertical pass -> screen
      const meshV = postSceneV.children[0] as THREE.Mesh;
      const matV = meshV.material as THREE.ShaderMaterial;
      matV.uniforms.tColor.value = (tempRT as THREE.WebGLRenderTarget).texture;
      matV.uniforms.tDepth.value = depthTex;
      matV.uniforms.renderWidth.value = widthPx;
      matV.uniforms.renderHeight.value = heightPx;
      matV.uniforms.imageDistanceMm.value = imgDist;
      matV.uniforms.focalLengthMm.value = CAMERA_CONSTANTS.focalLengthMm;
      matV.uniforms.fNumber.value = aperture;
      matV.uniforms.near.value = cam.near;
      matV.uniforms.far.value = cam.far;
      // honor raw debug mode (bypass DOF) or fallback depth
      matV.uniforms.useRaw.value = (isFallbackDepth || rawDebug) ? 1.0 : 0.0;
      // hide focus ring in raw debug mode
      if (rawDebug) matV.uniforms.showRing.value = 0.0;

      // compute focus ring projection for first focus target (if available)
      const sceneDef = sceneId ? getSceneById(sceneId) : undefined;
      if (sceneDef && sceneDef.focusTargets && sceneDef.focusTargets.length > 0) {
        const t = sceneDef.focusTargets[0];
        const imgDistMm = Math.abs(opticsState.filmPlane.point.z - opticsState.lensCenterWorld.z);
        const p = projectWorldPointToGroundGlass(t.worldPosition, opticsState.lensCenterWorld, imgDistMm, CAMERA_CONSTANTS.filmWidthMm, CAMERA_CONSTANTS.filmHeightMm);
        if (p.visible) {
          const u = previewMode === "upright" ? 1 - p.uRaw : p.uRaw;
          const v = previewMode === "upright" ? 1 - p.vRaw : p.vRaw;
          matV.uniforms.ringCenter.value.set(u, v);
          matV.uniforms.ringRadiusPx.value = focusRingRadiusPx ?? 68;
          matV.uniforms.ringOpacity.value = focusRingOpacity ?? 0.8;
          matV.uniforms.showRing.value = 1.0;
        } else {
          matV.uniforms.showRing.value = 0.0;
        }
      } else {
        matV.uniforms.showRing.value = 0.0;
      }

      gl.setRenderTarget(null);
      gl.setClearColor(0x0b1220, 1);
      gl.clear(true, true, true);
      gl.render(postSceneV, orthoCam);
    } else {
      gl.setRenderTarget(null);
    }

    gl.setRenderTarget(prev);
  }, 1);

  return null;
}

export const GroundGlassRTT: React.FC<GroundGlassRTTProps> = ({ opticsState, sceneId, widthPx, heightPx, aperture, previewMode, focusRingRadiusPx, focusRingOpacity, rawDebug }) => {
  // Canvas is used to host the three.js scene that displays the render target as a fullscreen quad.
  return (
    <div style={{ width: "100%", height: "100%" }}>
      <Canvas style={{ width: "100%", height: "100%" }} gl={{ preserveDrawingBuffer: false }} orthographic={false}>
        <OffscreenRenderer opticsState={opticsState} sceneId={sceneId} widthPx={widthPx} heightPx={heightPx} aperture={aperture} previewMode={previewMode} focusRingRadiusPx={focusRingRadiusPx} focusRingOpacity={focusRingOpacity} rawDebug={rawDebug} />
      </Canvas>
    </div>
  );
};

export default GroundGlassRTT;
