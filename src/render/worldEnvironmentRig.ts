import * as THREE from "three";
import type { WorldProceduralSkyGroundEnvironment } from "./worldIlluminationContract";
import { createProceduralSkyGroundTexture } from "./proceduralWorldEnvironment";

export type WorldEnvironmentRig = {
  readonly renderTarget: THREE.WebGLRenderTarget;
  readonly environmentTexture: THREE.Texture;
  readonly previousEnvironment: THREE.Texture | null;
  readonly previousEnvironmentIntensity: number;
  readonly appliedIntensity: number;
  disposed: boolean;
};

/** Creates and applies renderer-owned PMREM resources for one scene and renderer. */
export const createWorldEnvironmentRig = (
  scene: THREE.Scene,
  renderer: THREE.WebGLRenderer,
  environment: WorldProceduralSkyGroundEnvironment,
): WorldEnvironmentRig => {
  const sourceTexture = createProceduralSkyGroundTexture(environment);
  let renderTarget: THREE.WebGLRenderTarget | undefined;

  try {
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    try {
      // Three.js r186 PMREMGenerator writes a linear-sRGB CubeUV render target.
      // The source DataTexture is sRGB encoded, so WebGL decodes its texels on
      // sampling before the PMREM conversion.
      renderTarget = pmremGenerator.fromEquirectangular(sourceTexture);
    } finally {
      pmremGenerator.dispose();
    }
  } finally {
    sourceTexture.dispose();
  }
  if (!renderTarget) throw new Error("World environment PMREM conversion returned no target");

  const previousEnvironment = scene.environment;
  const previousEnvironmentIntensity = scene.environmentIntensity;
  scene.environment = renderTarget.texture;
  scene.environmentIntensity = environment.intensity;

  return {
    renderTarget,
    environmentTexture: renderTarget.texture,
    previousEnvironment,
    previousEnvironmentIntensity,
    appliedIntensity: environment.intensity,
    disposed: false,
  };
};

/** Restores only scene state still owned by this rig and releases its PMREM target. */
export const disposeWorldEnvironmentRig = (
  scene: THREE.Scene,
  rig: WorldEnvironmentRig,
): void => {
  if (rig.disposed) return;
  rig.disposed = true;

  if (scene.environment === rig.environmentTexture) {
    scene.environment = rig.previousEnvironment;
    if (scene.environmentIntensity === rig.appliedIntensity) {
      scene.environmentIntensity = rig.previousEnvironmentIntensity;
    }
  }

  rig.renderTarget.dispose();
};
