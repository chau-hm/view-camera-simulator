import * as THREE from "three";
import { MeshBasicNodeMaterial, type WebGPURenderer } from "three/webgpu";
import {
  createGroundGlassResearchCompositeNode,
} from "./groundGlassApertureGatherNodes";
import type {
  GroundGlassM6dCompositeContractProbeCase,
  GroundGlassM6dCompositeContractProbeReadback,
} from "./groundGlassWebGpuTestSeam";

type ProbeRenderer = InstanceType<typeof WebGPURenderer>;

const PROBE_COVERAGES = [0, 0.25, 0.5, 0.75, 1] as const;
const FAR_RGBA = [0.75, 0.5, 0.25, 1] as const;
const NEAR_RGB = [0.25, 0.75, 0.5] as const;

const makeHalfFloatTexture = (data: Uint16Array, width: number): THREE.DataTexture => {
  const texture = new THREE.DataTexture(data, width, 1, THREE.RGBAFormat, THREE.HalfFloatType);
  texture.colorSpace = THREE.NoColorSpace;
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
};

/**
 * Render the production M5 research-composite TSL node against five bounded
 * synthetic Near coverage values using the already-mounted Native WebGPU
 * renderer. This test seam creates no renderer and is called only for an
 * explicit development capture request.
 */
export const runGroundGlassM6dCompositeContractProbe = async (input: Readonly<{
  token: string;
  requestId: string;
  channelId: string;
  sceneId: string;
  rendererGenerationId: string;
  rendererRevision: string;
  renderer: ProbeRenderer;
  queue: Readonly<{ onSubmittedWorkDone: () => Promise<void> }>;
  isCurrent: () => boolean;
  textureFormat: (texture: THREE.Texture) => string | null;
}>): Promise<GroundGlassM6dCompositeContractProbeReadback> => {
  const farData = new Uint16Array(PROBE_COVERAGES.length * 4);
  const nearData = new Uint16Array(PROBE_COVERAGES.length * 4);
  PROBE_COVERAGES.forEach((coverage, index) => {
    const offset = index * 4;
    FAR_RGBA.forEach((value, channel) => {
      farData[offset + channel] = THREE.DataUtils.toHalfFloat(value);
    });
    NEAR_RGB.forEach((value, channel) => {
      nearData[offset + channel] = THREE.DataUtils.toHalfFloat(value);
    });
    nearData[offset + 3] = THREE.DataUtils.toHalfFloat(coverage);
  });

  const farTexture = makeHalfFloatTexture(farData, PROBE_COVERAGES.length);
  const nearTexture = makeHalfFloatTexture(nearData, PROBE_COVERAGES.length);
  const target = new THREE.RenderTarget(PROBE_COVERAGES.length, 1, {
    format: THREE.RGBAFormat,
    type: THREE.HalfFloatType,
    depthBuffer: false,
    stencilBuffer: false,
    samples: 0,
    generateMipmaps: false,
  });
  target.texture.colorSpace = THREE.NoColorSpace;
  target.texture.minFilter = THREE.NearestFilter;
  target.texture.magFilter = THREE.NearestFilter;
  target.texture.generateMipmaps = false;

  const geometry = new THREE.PlaneGeometry(2, 2);
  const material = new MeshBasicNodeMaterial({ toneMapped: false });
  material.outputNode = createGroundGlassResearchCompositeNode({ farTexture, nearTexture });
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(geometry, material));
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  camera.position.z = 1;
  camera.coordinateSystem = input.renderer.coordinateSystem;
  camera.updateProjectionMatrix();

  const previousTarget = input.renderer.getRenderTarget();
  const previousViewport = input.renderer.getViewport(new THREE.Vector4());
  const previousScissor = input.renderer.getScissor(new THREE.Vector4());
  const previousScissorTest = input.renderer.getScissorTest();
  const previousClearColor = input.renderer.getClearColor(new THREE.Color()).clone();
  const previousClearAlpha = input.renderer.getClearAlpha();
  const previousAutoClear = input.renderer.autoClear;
  const previousOutputColorSpace = input.renderer.outputColorSpace;
  const previousToneMapping = input.renderer.toneMapping;
  let safeToDispose = true;
  let rendererStateRestored = false;
  let cases: GroundGlassM6dCompositeContractProbeCase[] | null = null;
  let sourceTextureFormat: string | null = null;
  let nearTextureFormat: string | null = null;
  let targetFormat: string | null = null;
  let targetAllocationObserved = false;
  let temporaryResourcesDisposed = false;

  try {
    if (!input.isCurrent()) throw new Error("M6D composite contract probe request became stale before rendering");
    input.renderer.initTexture(farTexture);
    input.renderer.initTexture(nearTexture);
    input.renderer.initRenderTarget(target);
    targetAllocationObserved = true;
    input.renderer.setRenderTarget(target);
    input.renderer.setViewport(0, 0, PROBE_COVERAGES.length, 1);
    input.renderer.setScissorTest(false);
    input.renderer.autoClear = false;
    safeToDispose = false;
    input.renderer.clear(true, false, false);
    input.renderer.render(scene, camera);
    await input.queue.onSubmittedWorkDone();
    safeToDispose = true;
    if (!input.isCurrent()) throw new Error("M6D composite contract probe request became stale after rendering");

    safeToDispose = false;
    const rawReadback = await input.renderer.readRenderTargetPixelsAsync(
      target,
      0,
      0,
      PROBE_COVERAGES.length,
      1,
    );
    safeToDispose = true;
    if (!(rawReadback instanceof Uint16Array) || rawReadback.length !== PROBE_COVERAGES.length * 4) {
      throw new Error("M6D composite contract probe expected five RGBA16F readback pixels");
    }
    if (!input.isCurrent()) throw new Error("M6D composite contract probe request became stale during readback");

    cases = PROBE_COVERAGES.map((coverage, index) => {
      const offset = index * 4;
      const measuredCompositeRgba = [
        THREE.DataUtils.fromHalfFloat(rawReadback[offset]!),
        THREE.DataUtils.fromHalfFloat(rawReadback[offset + 1]!),
        THREE.DataUtils.fromHalfFloat(rawReadback[offset + 2]!),
        THREE.DataUtils.fromHalfFloat(rawReadback[offset + 3]!),
      ] as const;
      const nearRgba = [NEAR_RGB[0], NEAR_RGB[1], NEAR_RGB[2], coverage] as const;
      return {
        id: `near-coverage-${coverage}`,
        coverage,
        farRgba: FAR_RGBA,
        nearRgba,
        measuredCompositeRgba,
      };
    });
    sourceTextureFormat = input.textureFormat(farTexture);
    nearTextureFormat = input.textureFormat(nearTexture);
    targetFormat = input.textureFormat(target.texture);
  } finally {
    if (!safeToDispose) {
      try {
        await input.queue.onSubmittedWorkDone();
        safeToDispose = true;
      } catch {
        // Keep test resources alive if submitted work completion is uncertain.
      }
    }

    try {
      input.renderer.setRenderTarget(previousTarget);
      input.renderer.setViewport(previousViewport);
      input.renderer.setScissor(previousScissor);
      input.renderer.setScissorTest(previousScissorTest);
      input.renderer.setClearColor(previousClearColor, previousClearAlpha);
      input.renderer.autoClear = previousAutoClear;
      input.renderer.outputColorSpace = previousOutputColorSpace;
      input.renderer.toneMapping = previousToneMapping;
      rendererStateRestored = true;
    } finally {
      if (safeToDispose) {
        scene.clear();
        material.dispose();
        geometry.dispose();
        target.dispose();
        farTexture.dispose();
        nearTexture.dispose();
        temporaryResourcesDisposed = true;
      }
    }
  }

  if (!rendererStateRestored) throw new Error("M6D composite contract probe failed to restore renderer state");
  if (!cases) throw new Error("M6D composite contract probe produced no readback cases");
  return {
    token: input.token,
    contractRevision: "m6d-opaque-presentation-v1",
    requestId: input.requestId,
    channelId: input.channelId,
    sceneId: input.sceneId,
    rendererGenerationId: input.rendererGenerationId,
    rendererRevision: input.rendererRevision,
    rendererFamily: "webgpu-renderer",
    actualExecutionApi: "webgpu",
    internalFallback: "none",
    applicationFallback: false,
    sourceTextureIdentity: { farUuid: farTexture.uuid, nearUuid: nearTexture.uuid },
    sourceTextureFormat,
    nearTextureFormat,
    targetIdentity: { uuid: target.texture.uuid, widthPx: target.width, heightPx: target.height },
    targetFormat,
    targetColorSpace: "no-color-space",
    targetAllocationObserved,
    rendererStateRestored,
    temporaryResourcesDisposed,
    cases,
  };
};
