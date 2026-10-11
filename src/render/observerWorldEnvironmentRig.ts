import * as THREE from "three";
import type { WebGPURenderer } from "three/webgpu";
import { resolveObserverRendererRuntime } from "./backend/observerVisualPipelineCapabilities";
import { createProceduralSkyGroundTexture } from "./proceduralWorldEnvironment";
import type { WorldProceduralSkyGroundEnvironment } from "./worldIlluminationContract";
import {
  createWorldEnvironmentRig,
  createWorldEnvironmentRigFromTarget,
  type OwnedWorldEnvironmentTarget,
  type WorldEnvironmentRig,
} from "./worldEnvironmentRig";

export type ObserverWorldEnvironmentStatus =
  | "not-configured"
  | "pending"
  | "active"
  | "unsupported"
  | "failed";

type WebGpuPmremGenerator = Readonly<{
  fromEquirectangular: (texture: THREE.Texture) => OwnedWorldEnvironmentTarget;
  dispose: () => void;
}>;

export type WebGpuPmremGeneratorFactory = (
  renderer: WebGPURenderer,
) => WebGpuPmremGenerator;

export type LoadWebGpuPmremGeneratorFactory = () => Promise<WebGpuPmremGeneratorFactory>;
export type ObserverWorldEnvironmentRigResult =
  | WorldEnvironmentRig
  | Promise<WorldEnvironmentRig | null>
  | null;

const loadWebGpuPmremGeneratorFactory: LoadWebGpuPmremGeneratorFactory = async () => {
  const { PMREMGenerator } = await import("three/webgpu");
  return (renderer) => new PMREMGenerator(renderer);
};

export class UnsupportedObserverEnvironmentRendererError extends Error {
  constructor() {
    super("World environment PMREM requires a recognized WebGLRenderer or WebGPURenderer");
    this.name = "UnsupportedObserverEnvironmentRendererError";
  }
}

const realizeWebGpuEnvironment = async (
  scene: THREE.Scene,
  renderer: unknown,
  environment: WorldProceduralSkyGroundEnvironment,
  isCurrent: () => boolean,
  loadPmremFactory: LoadWebGpuPmremGeneratorFactory,
): Promise<WorldEnvironmentRig | null> => {
  const createGenerator = await loadPmremFactory();
  if (!isCurrent()) return null;

  const sourceTexture = createProceduralSkyGroundTexture(environment);
  let generator: WebGpuPmremGenerator | undefined;
  let renderTarget: OwnedWorldEnvironmentTarget | undefined;
  let failure: unknown;

  try {
    // The renderer-family check below is based on the mounted Three.js
    // identity; it is not the WebGPU backend module or a browser capability hint.
    generator = createGenerator(renderer as WebGPURenderer);
    renderTarget = generator.fromEquirectangular(sourceTexture);
  } catch (error) {
    failure = error;
  }

  try {
    generator?.dispose();
  } catch (error) {
    failure ??= error;
  }
  try {
    sourceTexture.dispose();
  } catch (error) {
    failure ??= error;
  }

  if (failure !== undefined) {
    try {
      renderTarget?.dispose();
    } catch {
      // Preserve the PMREM or cleanup failure as the primary diagnostic.
    }
    throw failure;
  }
  if (!renderTarget) throw new Error("WebGPU world environment PMREM returned no target");
  if (!isCurrent()) {
    renderTarget.dispose();
    return null;
  }

  return createWorldEnvironmentRigFromTarget(scene, renderTarget, environment);
};

/**
 * Realizes the same environment recipe with the PMREM implementation for the
 * actual mounted Observer renderer. The WebGL and Ground Glass factory remains
 * synchronous and unchanged; only the lazy WebGPU module load is asynchronous.
 */
export const createObserverWorldEnvironmentRig = (
  scene: THREE.Scene,
  renderer: unknown,
  environment: WorldProceduralSkyGroundEnvironment,
  isCurrent: () => boolean = () => true,
  loadPmremFactory: LoadWebGpuPmremGeneratorFactory = loadWebGpuPmremGeneratorFactory,
): ObserverWorldEnvironmentRigResult => {
  if (!isCurrent()) return null;

  const runtime = resolveObserverRendererRuntime(renderer);
  if (runtime.rendererFamily === "webgl-renderer") {
    // Runtime classification proves this is the WebGL family before passing
    // it to the legacy renderer-specific PMREM constructor. Keep this path
    // synchronous so existing effect cleanup owns the rig before unmount.
    return createWorldEnvironmentRig(
      scene,
      renderer as THREE.WebGLRenderer,
      environment,
    );
  }

  if (runtime.rendererFamily === "webgpu-renderer") {
    return realizeWebGpuEnvironment(
      scene,
      renderer,
      environment,
      isCurrent,
      loadPmremFactory,
    );
  }

  throw new UnsupportedObserverEnvironmentRendererError();
};
