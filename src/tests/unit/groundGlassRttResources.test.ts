import * as THREE from "three";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createGroundGlassRttResources,
  resizeGroundGlassRttResources,
} from "../../render/groundGlassRttResources";

const FRAMEBUFFER_COMPLETE = 0x8cd5;

const createRenderer = () => {
  const previousTarget = null;
  const boundTargets: Array<THREE.WebGLRenderTarget | null> = [];
  let currentTarget: THREE.WebGLRenderTarget | null = previousTarget;
  const context = {
    FRAMEBUFFER: 0x8d40,
    FRAMEBUFFER_COMPLETE,
    checkFramebufferStatus: vi.fn(() => FRAMEBUFFER_COMPLETE),
  } as unknown as WebGLRenderingContext;
  const renderer = {
    isWebGLRenderer: true,
    getContext: vi.fn(() => context),
    getRenderTarget: vi.fn(() => currentTarget),
    setRenderTarget: vi.fn((target: THREE.WebGLRenderTarget | null) => {
      boundTargets.push(target);
      currentTarget = target;
    }),
  } as unknown as THREE.WebGLRenderer;
  return { renderer, context, boundTargets, previousTarget };
};

const createMaterial = (width: number, height: number) =>
  new THREE.ShaderMaterial({
    uniforms: {
      renderWidth: { value: width },
      renderHeight: { value: height },
    },
  });

const disposeMaterials = (materials: readonly THREE.ShaderMaterial[]) =>
  materials.forEach((material) => material.dispose());

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Ground Glass RTT semantic resource ownership", () => {
  it("creates stage-owned targets, preserves the W1 CoC probe, and resizes the consuming resources", () => {
    const { renderer, context, boundTargets, previousTarget } = createRenderer();
    const resources = createGroundGlassRttResources({
      renderer,
      widthPx: 100,
      heightPx: 80,
      gatherScale: 0.5,
    });
    const materials = {
      coc: createMaterial(100, 80),
      gather: createMaterial(100, 80),
      composite: createMaterial(100, 80),
    };
    const resizableTargets = [
      resources.scene.colorDepthTarget,
      resources.coc.classificationTarget,
      resources.gather.farTarget,
      resources.gather.nearTarget,
      resources.composite.outputTarget,
    ];
    const setSizeSpies = resizableTargets.map((target) =>
      vi.spyOn(target, "setSize"),
    );

    expect(resources.scene.colorDepthTarget.depthTexture).toBeInstanceOf(
      THREE.DepthTexture,
    );
    expect(resources.gather.farTarget.width).toBe(50);
    expect(resources.gather.farTarget.height).toBe(40);
    expect(resources.gather.nearTarget.width).toBe(50);
    expect(resources.gather.nearTarget.height).toBe(40);
    expect(resources.diagnostics.rawSceneTarget.width).toBe(32);
    expect(resources.diagnostics.compositeOutputTarget.width).toBe(32);
    expect(context.checkFramebufferStatus).toHaveBeenCalledTimes(1);
    expect(boundTargets).toContain(resources.coc.classificationTarget);
    expect(boundTargets[boundTargets.length - 1]).toBe(previousTarget);

    const changed = resizeGroundGlassRttResources(
      resources,
      materials,
      640,
      512,
      0.5,
    );

    expect(changed).toBe(true);
    expect(resources.scene.colorDepthTarget.width).toBe(640);
    expect(resources.scene.colorDepthTarget.height).toBe(512);
    expect(resources.coc.classificationTarget.width).toBe(640);
    expect(resources.coc.classificationTarget.height).toBe(512);
    expect(resources.gather.farTarget.width).toBe(320);
    expect(resources.gather.farTarget.height).toBe(256);
    expect(resources.gather.nearTarget.width).toBe(320);
    expect(resources.gather.nearTarget.height).toBe(256);
    expect(resources.composite.outputTarget.width).toBe(640);
    expect(resources.composite.outputTarget.height).toBe(512);
    expect(resources.scene.colorDepthTarget.depthTexture?.image).toMatchObject({
      width: 640,
      height: 512,
    });
    expect(resources.diagnostics.rawSceneTarget.width).toBe(32);
    expect(resources.diagnostics.compositeOutputTarget.width).toBe(32);
    for (const material of Object.values(materials)) {
      expect(material.uniforms.renderWidth.value).toBe(640);
      expect(material.uniforms.renderHeight.value).toBe(512);
    }
    setSizeSpies.forEach((spy) => expect(spy).toHaveBeenCalledTimes(1));

    resources.dispose();
    disposeMaterials(Object.values(materials));
  });

  it("does not resize targets or change uniforms when the semantic dimensions are unchanged", () => {
    const { renderer } = createRenderer();
    const resources = createGroundGlassRttResources({
      renderer,
      widthPx: 640,
      heightPx: 512,
      gatherScale: 0.5,
    });
    const materials = {
      coc: createMaterial(640, 512),
      gather: createMaterial(640, 512),
      composite: createMaterial(640, 512),
    };
    const resizableTargets = [
      resources.scene.colorDepthTarget,
      resources.coc.classificationTarget,
      resources.gather.farTarget,
      resources.gather.nearTarget,
      resources.composite.outputTarget,
    ];
    const setSizeSpies = resizableTargets.map((target) =>
      vi.spyOn(target, "setSize"),
    );

    expect(
      resizeGroundGlassRttResources(resources, materials, 640, 512, 0.5),
    ).toBe(false);
    setSizeSpies.forEach((spy) => expect(spy).not.toHaveBeenCalled());

    resources.dispose();
    disposeMaterials(Object.values(materials));
  });

  it("disposes every owned target and fallback texture exactly once", () => {
    const { renderer } = createRenderer();
    const resources = createGroundGlassRttResources({
      renderer,
      widthPx: 100,
      heightPx: 80,
      gatherScale: 1,
    });
    const ownedTargets = [
      resources.scene.colorDepthTarget,
      resources.coc.classificationTarget,
      resources.gather.farTarget,
      resources.gather.nearTarget,
      resources.composite.outputTarget,
      resources.diagnostics.rawSceneTarget,
      resources.diagnostics.compositeOutputTarget,
    ];
    const targetDisposeSpies = ownedTargets.map((target) =>
      vi.spyOn(target, "dispose"),
    );
    const depthFallbackDispose = vi.spyOn(resources.scene.depthFallback, "dispose");

    resources.dispose();
    resources.dispose();

    targetDisposeSpies.forEach((spy) => expect(spy).toHaveBeenCalledTimes(1));
    expect(depthFallbackDispose).toHaveBeenCalledTimes(1);
  });
});
