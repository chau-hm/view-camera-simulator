import * as THREE from "three";
import { afterEach, describe, expect, it, vi } from "vitest";
import { resizeGroundGlassRttResources } from "../../render/groundGlassRttResources";

const createMaterial = (width: number, height: number) =>
  new THREE.ShaderMaterial({
    uniforms: {
      renderWidth: { value: width },
      renderHeight: { value: height },
    },
  });

afterEach(() => {
  vi.restoreAllMocks();
});

describe("resizeGroundGlassRttResources", () => {
  it("synchronizes color, depth, blur, final, and both shader dimension pairs", () => {
    const renderTarget = new THREE.WebGLRenderTarget(100, 80);
    renderTarget.depthTexture = new THREE.DepthTexture(100, 80);
    const tempTarget = new THREE.WebGLRenderTarget(100, 80);
    const finalTarget = new THREE.WebGLRenderTarget(100, 80);
    const horizontalMaterial = createMaterial(100, 80);
    const verticalMaterial = createMaterial(100, 80);
    const targets = [renderTarget, tempTarget, finalTarget];
    const setSizeSpies = targets.map((target) => vi.spyOn(target, "setSize"));

    const changed = resizeGroundGlassRttResources(
      { renderTarget, tempTarget, finalTarget, horizontalMaterial, verticalMaterial },
      640,
      512,
    );

    expect(changed).toBe(true);
    targets.forEach((target) => {
      expect(target.width).toBe(640);
      expect(target.height).toBe(512);
    });
    expect(renderTarget.depthTexture.image.width).toBe(640);
    expect(renderTarget.depthTexture.image.height).toBe(512);
    expect(horizontalMaterial.uniforms.renderWidth.value).toBe(640);
    expect(horizontalMaterial.uniforms.renderHeight.value).toBe(512);
    expect(verticalMaterial.uniforms.renderWidth.value).toBe(640);
    expect(verticalMaterial.uniforms.renderHeight.value).toBe(512);
    setSizeSpies.forEach((spy) => expect(spy).toHaveBeenCalledTimes(1));

    targets.forEach((target) => target.dispose());
    horizontalMaterial.dispose();
    verticalMaterial.dispose();
  });

  it("does not perform redundant target resizes for an unchanged desired size", () => {
    const renderTarget = new THREE.WebGLRenderTarget(640, 512);
    renderTarget.depthTexture = new THREE.DepthTexture(640, 512);
    const tempTarget = new THREE.WebGLRenderTarget(640, 512);
    const finalTarget = new THREE.WebGLRenderTarget(640, 512);
    const horizontalMaterial = createMaterial(640, 512);
    const verticalMaterial = createMaterial(640, 512);
    const targets = [renderTarget, tempTarget, finalTarget];
    const setSizeSpies = targets.map((target) => vi.spyOn(target, "setSize"));

    const changed = resizeGroundGlassRttResources(
      { renderTarget, tempTarget, finalTarget, horizontalMaterial, verticalMaterial },
      640,
      512,
    );

    expect(changed).toBe(false);
    setSizeSpies.forEach((spy) => expect(spy).not.toHaveBeenCalled());

    targets.forEach((target) => target.dispose());
    horizontalMaterial.dispose();
    verticalMaterial.dispose();
  });
});
