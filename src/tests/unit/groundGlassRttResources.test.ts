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
  it("keeps CoC full resolution while scaling the aperture gather target", () => {
    const renderTarget = new THREE.WebGLRenderTarget(100, 80);
    renderTarget.depthTexture = new THREE.DepthTexture(100, 80);
    const cocTarget = new THREE.WebGLRenderTarget(100, 80);
    const gatherTarget = new THREE.WebGLRenderTarget(100, 80);
    const nearGatherTarget = new THREE.WebGLRenderTarget(100, 80);
    const finalTarget = new THREE.WebGLRenderTarget(100, 80);
    const cocMaterial = createMaterial(100, 80);
    const gatherMaterial = createMaterial(100, 80);
    const compositeMaterial = createMaterial(100, 80);
    const targets = [renderTarget, cocTarget, gatherTarget, nearGatherTarget, finalTarget];
    const setSizeSpies = targets.map((target) => vi.spyOn(target, "setSize"));

    const changed = resizeGroundGlassRttResources(
      { renderTarget, cocTarget, gatherTarget, nearGatherTarget, finalTarget, cocMaterial, gatherMaterial, compositeMaterial },
      640,
      512,
      0.5,
    );

    expect(changed).toBe(true);
    expect(renderTarget.width).toBe(640);
    expect(renderTarget.height).toBe(512);
    expect(cocTarget.width).toBe(640);
    expect(cocTarget.height).toBe(512);
    expect(gatherTarget.width).toBe(320);
    expect(gatherTarget.height).toBe(256);
    expect(nearGatherTarget.width).toBe(320);
    expect(nearGatherTarget.height).toBe(256);
    expect(finalTarget.width).toBe(640);
    expect(finalTarget.height).toBe(512);
    expect(renderTarget.depthTexture.image.width).toBe(640);
    expect(renderTarget.depthTexture.image.height).toBe(512);
    for (const material of [cocMaterial, gatherMaterial, compositeMaterial]) {
      expect(material.uniforms.renderWidth.value).toBe(640);
      expect(material.uniforms.renderHeight.value).toBe(512);
    }
    setSizeSpies.forEach((spy) => expect(spy).toHaveBeenCalledTimes(1));

    targets.forEach((target) => target.dispose());
    cocMaterial.dispose();
    gatherMaterial.dispose();
    compositeMaterial.dispose();
  });

  it("does not perform redundant target resizes for an unchanged desired size", () => {
    const renderTarget = new THREE.WebGLRenderTarget(640, 512);
    renderTarget.depthTexture = new THREE.DepthTexture(640, 512);
    const cocTarget = new THREE.WebGLRenderTarget(640, 512);
    const gatherTarget = new THREE.WebGLRenderTarget(320, 256);
    const nearGatherTarget = new THREE.WebGLRenderTarget(320, 256);
    const finalTarget = new THREE.WebGLRenderTarget(640, 512);
    const cocMaterial = createMaterial(640, 512);
    const gatherMaterial = createMaterial(640, 512);
    const compositeMaterial = createMaterial(640, 512);
    const targets = [renderTarget, cocTarget, gatherTarget, nearGatherTarget, finalTarget];
    const setSizeSpies = targets.map((target) => vi.spyOn(target, "setSize"));

    const changed = resizeGroundGlassRttResources(
      { renderTarget, cocTarget, gatherTarget, nearGatherTarget, finalTarget, cocMaterial, gatherMaterial, compositeMaterial },
      640,
      512,
      0.5,
    );

    expect(changed).toBe(false);
    setSizeSpies.forEach((spy) => expect(spy).not.toHaveBeenCalled());

    targets.forEach((target) => target.dispose());
    cocMaterial.dispose();
    gatherMaterial.dispose();
    compositeMaterial.dispose();
  });
});
