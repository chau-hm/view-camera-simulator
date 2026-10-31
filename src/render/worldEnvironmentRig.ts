import * as THREE from "three";
import type { WorldProceduralSkyGroundEnvironment } from "./worldIlluminationContract";
import { createProceduralSkyGroundTexture } from "./proceduralWorldEnvironment";

export type OwnedWorldEnvironmentTarget = Readonly<{
  texture: THREE.Texture;
  dispose: () => void;
}>;

export type WorldEnvironmentRig<
  Target extends OwnedWorldEnvironmentTarget = OwnedWorldEnvironmentTarget,
> = {
  readonly renderTarget: Target;
  readonly environmentTexture: THREE.Texture;
  readonly previousEnvironment: THREE.Texture | null;
  readonly previousEnvironmentIntensity: number;
  readonly appliedIntensity: number;
  readonly suppressedEnvironmentIntensity: number;
  suppressed: boolean;
  disposed: boolean;
};

/** Assigns a renderer-owned PMREM target while preserving other scene state. */
export const createWorldEnvironmentRigFromTarget = <
  Target extends OwnedWorldEnvironmentTarget,
>(
  scene: THREE.Scene,
  renderTarget: Target,
  environment: WorldProceduralSkyGroundEnvironment,
): WorldEnvironmentRig<Target> => {
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
    suppressedEnvironmentIntensity: 0,
    suppressed: false,
    disposed: false,
  };
};

/** Creates and applies renderer-owned PMREM resources for one scene and renderer. */
export const createWorldEnvironmentRig = (
  scene: THREE.Scene,
  renderer: THREE.WebGLRenderer,
  environment: WorldProceduralSkyGroundEnvironment,
): WorldEnvironmentRig<THREE.WebGLRenderTarget> => {
  const sourceTexture = createProceduralSkyGroundTexture(environment);
  let pmremGenerator: THREE.PMREMGenerator | undefined;
  let renderTarget: THREE.WebGLRenderTarget | undefined;
  let failure: unknown;

  try {
    pmremGenerator = new THREE.PMREMGenerator(renderer);
    // Three.js r187 writes a linear-sRGB cube target. WebGL decodes the
    // sRGB-encoded DataTexture while sampling it for PMREM conversion.
    renderTarget = pmremGenerator.fromEquirectangular(sourceTexture);
  } catch (error) {
    failure = error;
  }

  try {
    pmremGenerator?.dispose();
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
      // Keep the conversion or cleanup failure as the reported cause.
    }
    throw failure;
  }
  if (!renderTarget) throw new Error("World environment PMREM conversion returned no target");

  return createWorldEnvironmentRigFromTarget(scene, renderTarget, environment);
};

/** Changes only the intensity owned by this live rig, without detaching its texture. */
export const setWorldEnvironmentRigSuppressed = (
  scene: THREE.Scene,
  rig: WorldEnvironmentRig,
  suppressed: boolean,
): boolean => {
  if (rig.disposed || scene.environment !== rig.environmentTexture) return false;
  if (suppressed === rig.suppressed) return true;

  if (suppressed) {
    if (scene.environmentIntensity !== rig.appliedIntensity) return false;
    scene.environmentIntensity = rig.suppressedEnvironmentIntensity;
    rig.suppressed = true;
    return true;
  }

  if (scene.environmentIntensity !== rig.suppressedEnvironmentIntensity) return false;
  scene.environmentIntensity = rig.appliedIntensity;
  rig.suppressed = false;
  return true;
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
    if (scene.environmentIntensity === rig.appliedIntensity ||
      (rig.suppressed && scene.environmentIntensity === rig.suppressedEnvironmentIntensity)) {
      scene.environmentIntensity = rig.previousEnvironmentIntensity;
    }
  }
  rig.suppressed = false;

  rig.renderTarget.dispose();
};
