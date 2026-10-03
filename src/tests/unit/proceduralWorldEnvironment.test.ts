import { createHash } from "node:crypto";
import * as THREE from "three";
import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveSceneWorldIllumination } from "../../scenes/illumination/sceneWorldIllumination";
import {
  createProceduralSkyGroundPixels,
  createProceduralSkyGroundTexture,
  PROCEDURAL_WORLD_ENVIRONMENT_HEIGHT,
  PROCEDURAL_WORLD_ENVIRONMENT_WIDTH,
} from "../../render/proceduralWorldEnvironment";
import {
  createWorldEnvironmentRig,
  disposeWorldEnvironmentRig,
} from "../../render/worldEnvironmentRig";

const environment = resolveSceneWorldIllumination("architecture-rise").environment;
if (!environment) throw new Error("Expected the Architecture Rise environment recipe");

const pixelHash = (pixels: Uint8Array): string =>
  createHash("sha256").update(pixels).digest("hex");

afterEach(() => vi.restoreAllMocks());

describe("procedural world environment source", () => {
  it("generates a stable low-resolution sRGB map from the scene-neutral recipe", () => {
    const first = createProceduralSkyGroundPixels(environment);
    const second = createProceduralSkyGroundPixels(environment);
    expect(first).toEqual(second);
    expect(pixelHash(first)).toBe(pixelHash(second));
    expect(pixelHash(first)).toBe(
      "95c7f067cc69a4508b6ca0d9c71af0cefdfa76c8f204c01da02cc2886ade3898",
    );
    expect(first).toHaveLength(
      PROCEDURAL_WORLD_ENVIRONMENT_WIDTH * PROCEDURAL_WORLD_ENVIRONMENT_HEIGHT * 4,
    );

    const differentRecipe = {
      ...environment,
      skyHorizonColor: "#b8c4c8",
    };
    expect(pixelHash(createProceduralSkyGroundPixels(differentRecipe))).not.toBe(
      pixelHash(first),
    );
  });

  it("marks encoded color bytes and sampling settings explicitly for PMREM input", () => {
    const texture = createProceduralSkyGroundTexture(environment);
    expect(texture.image.width).toBe(128);
    expect(texture.image.height).toBe(64);
    expect(texture.image.data).toBeInstanceOf(Uint8Array);
    expect(texture.format).toBe(THREE.RGBAFormat);
    expect(texture.type).toBe(THREE.UnsignedByteType);
    expect(texture.mapping).toBe(THREE.EquirectangularReflectionMapping);
    expect(texture.colorSpace).toBe(THREE.SRGBColorSpace);
    expect(texture.wrapS).toBe(THREE.RepeatWrapping);
    expect(texture.wrapT).toBe(THREE.ClampToEdgeWrapping);
    expect(texture.magFilter).toBe(THREE.LinearFilter);
    expect(texture.minFilter).toBe(THREE.LinearFilter);
    expect(texture.generateMipmaps).toBe(false);
    texture.dispose();
  });
});

describe("renderer-owned world environment resources", () => {
  const createProcessedTarget = () => {
    const target = new THREE.WebGLRenderTarget(336, 128, {
      format: THREE.RGBAFormat,
      type: THREE.HalfFloatType,
      colorSpace: THREE.LinearSRGBColorSpace,
      depthBuffer: false,
    });
    target.texture.mapping = THREE.CubeUVReflectionMapping;
    return target;
  };

  it("applies a PMREM target without changing the visible background and restores prior scene state", () => {
    const scene = new THREE.Scene();
    const background = new THREE.Color("#f8fafc");
    const previousEnvironment = new THREE.DataTexture();
    scene.background = background;
    scene.environment = previousEnvironment;
    scene.environmentIntensity = 0.35;

    const target = createProcessedTarget();
    const targetDispose = vi.spyOn(target, "dispose");
    const sourceTextures: THREE.DataTexture[] = [];
    let sourceWasDisposed = false;
    const fromEquirectangular = vi
      .spyOn(THREE.PMREMGenerator.prototype, "fromEquirectangular")
      .mockImplementation((source) => {
        const sourceDataTexture = source as THREE.DataTexture;
        sourceTextures.push(sourceDataTexture);
        const originalDispose = source.dispose.bind(source);
        vi.spyOn(source, "dispose").mockImplementation(() => {
          sourceWasDisposed = true;
          originalDispose();
        });
        return target;
      });
    const generatorDispose = vi.spyOn(THREE.PMREMGenerator.prototype, "dispose");
    const renderer = {} as THREE.WebGLRenderer;

    const rig = createWorldEnvironmentRig(scene, renderer, environment);
    const [sourceTexture] = sourceTextures;
    expect(fromEquirectangular).toHaveBeenCalledTimes(1);
    expect(sourceTexture).toBeInstanceOf(THREE.DataTexture);
    expect(sourceWasDisposed).toBe(true);
    expect(sourceTexture?.colorSpace).toBe(THREE.SRGBColorSpace);
    expect(sourceTexture?.mapping).toBe(THREE.EquirectangularReflectionMapping);
    expect(generatorDispose).toHaveBeenCalledTimes(1);
    expect(rig.renderTarget.texture.colorSpace).toBe(THREE.LinearSRGBColorSpace);
    expect(rig.renderTarget.texture.mapping).toBe(THREE.CubeUVReflectionMapping);
    expect(scene.environment).toBe(rig.environmentTexture);
    expect(scene.environmentIntensity).toBe(environment.intensity);
    expect(scene.background).toBe(background);
    expect(sourceTexture?.image.width).toBe(PROCEDURAL_WORLD_ENVIRONMENT_WIDTH);
    expect(sourceTexture?.image.height).toBe(PROCEDURAL_WORLD_ENVIRONMENT_HEIGHT);

    disposeWorldEnvironmentRig(scene, rig);
    disposeWorldEnvironmentRig(scene, rig);
    expect(scene.environment).toBe(previousEnvironment);
    expect(scene.environmentIntensity).toBe(0.35);
    expect(scene.background).toBe(background);
    expect(targetDispose).toHaveBeenCalledTimes(1);
    previousEnvironment.dispose();
  });

  it("creates distinct processed GPU targets for separate renderer surfaces", () => {
    const sceneA = new THREE.Scene();
    const sceneB = new THREE.Scene();
    const targets = [createProcessedTarget(), createProcessedTarget()];
    const fromEquirectangular = vi
      .spyOn(THREE.PMREMGenerator.prototype, "fromEquirectangular")
      .mockImplementation(() => {
        const target = targets.shift();
        if (!target) throw new Error("Expected one processed target per renderer");
        return target;
      });

    const rigA = createWorldEnvironmentRig(
      sceneA,
      {} as THREE.WebGLRenderer,
      environment,
    );
    const rigB = createWorldEnvironmentRig(
      sceneB,
      {} as THREE.WebGLRenderer,
      environment,
    );

    expect(fromEquirectangular).toHaveBeenCalledTimes(2);
    expect(rigA.renderTarget).not.toBe(rigB.renderTarget);
    expect(rigA.environmentTexture).not.toBe(rigB.environmentTexture);
    disposeWorldEnvironmentRig(sceneA, rigA);
    disposeWorldEnvironmentRig(sceneB, rigB);
  });

  it("restores state after a previous environment is replaced by another owner", () => {
    const scene = new THREE.Scene();
    const target = createProcessedTarget();
    vi.spyOn(THREE.PMREMGenerator.prototype, "fromEquirectangular").mockReturnValue(target);
    const rig = createWorldEnvironmentRig(
      scene,
      {} as THREE.WebGLRenderer,
      environment,
    );
    const replacement = new THREE.DataTexture();
    scene.environment = replacement;
    scene.environmentIntensity = 0.42;

    disposeWorldEnvironmentRig(scene, rig);
    expect(scene.environment).toBe(replacement);
    expect(scene.environmentIntensity).toBe(0.42);
    expect(scene.background).toBeNull();
    replacement.dispose();
  });

  it("preserves replacement environment state when its intensity matches the rig", () => {
    const scene = new THREE.Scene();
    const previousEnvironment = new THREE.DataTexture();
    scene.environment = previousEnvironment;
    scene.environmentIntensity = 0.35;

    const target = createProcessedTarget();
    const targetDispose = vi.spyOn(target, "dispose");
    vi.spyOn(THREE.PMREMGenerator.prototype, "fromEquirectangular").mockReturnValue(target);
    const rig = createWorldEnvironmentRig(
      scene,
      {} as THREE.WebGLRenderer,
      environment,
    );
    const replacement = new THREE.DataTexture();
    scene.environment = replacement;
    scene.environmentIntensity = rig.appliedIntensity;

    disposeWorldEnvironmentRig(scene, rig);
    expect(scene.environment).toBe(replacement);
    expect(scene.environmentIntensity).toBe(rig.appliedIntensity);
    expect(targetDispose).toHaveBeenCalledTimes(1);

    disposeWorldEnvironmentRig(scene, rig);
    expect(scene.environment).toBe(replacement);
    expect(scene.environmentIntensity).toBe(rig.appliedIntensity);
    expect(targetDispose).toHaveBeenCalledTimes(1);
    previousEnvironment.dispose();
    replacement.dispose();
  });

  it("preserves an environment intensity changed by another owner", () => {
    const scene = new THREE.Scene();
    const target = createProcessedTarget();
    vi.spyOn(THREE.PMREMGenerator.prototype, "fromEquirectangular").mockReturnValue(target);
    const rig = createWorldEnvironmentRig(
      scene,
      {} as THREE.WebGLRenderer,
      environment,
    );
    scene.environmentIntensity = 0.42;

    disposeWorldEnvironmentRig(scene, rig);
    expect(scene.environment).toBeNull();
    expect(scene.environmentIntensity).toBe(0.42);
  });
});
