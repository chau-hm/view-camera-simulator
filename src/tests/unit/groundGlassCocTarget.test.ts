import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import {
  createGroundGlassCocTarget,
  decodeGroundGlassFootprintAxesMm,
  decodeGroundGlassSignedCoC,
  decodeGroundGlassSignedCoCByte,
  encodeGroundGlassFootprintAxesMm,
  encodeGroundGlassSignedCoC,
  encodeGroundGlassSignedCoCByte,
  GROUND_GLASS_SIGNED_COC_NEUTRAL_BYTE,
  isGroundGlassColorRenderTargetRenderable,
  quantizeGroundGlassSignedCoCByte,
  resolveGroundGlassCocStorageMaxMm,
} from "../../render/groundGlassCocTarget";

function createRendererWithFramebufferStatuses(statuses: number[]) {
  const context = {
    FRAMEBUFFER: 0x8d40,
    FRAMEBUFFER_COMPLETE: 0x8cd5,
    checkFramebufferStatus: vi.fn(() => statuses.shift() ?? 0x8cd5),
  } as unknown as WebGLRenderingContext;
  const renderer = {
    getContext: vi.fn(() => context),
    getRenderTarget: vi.fn(() => null),
    setRenderTarget: vi.fn(),
  } as unknown as THREE.WebGLRenderer;
  return { context, renderer };
}

describe("Ground Glass CoC target capability policy", () => {
  it("keeps half-float millimetre storage when its framebuffer is complete", () => {
    const { renderer, context } = createRendererWithFramebufferStatuses([contextComplete()]);
    const result = createGroundGlassCocTarget(renderer, 64, 32);
    expect(result.storageFormat).toBe("half-float-mm");
    expect(result.target.texture.type).toBe(THREE.HalfFloatType);
    expect(result.target.texture.minFilter).toBe(THREE.NearestFilter);
    expect(result.target.texture.magFilter).toBe(THREE.NearestFilter);
    expect(context.checkFramebufferStatus).toHaveBeenCalledTimes(1);
    result.target.dispose();
  });

  it("falls back to byte-encoded CoC when half-float attachment is incomplete", () => {
    const { renderer, context } = createRendererWithFramebufferStatuses([0x8cd6, contextComplete()]);
    const result = createGroundGlassCocTarget(renderer, 64, 32);
    expect(result.storageFormat).toBe("encoded-byte");
    expect(result.target.texture.type).toBe(THREE.UnsignedByteType);
    expect(result.target.texture.minFilter).toBe(THREE.NearestFilter);
    expect(result.target.texture.magFilter).toBe(THREE.NearestFilter);
    expect(context.checkFramebufferStatus).toHaveBeenCalledTimes(2);
    result.target.dispose();
  });

  it("reports failure when neither supported representation is renderable", () => {
    const { renderer } = createRendererWithFramebufferStatuses([0x8cd6, 0x8cd6]);
    expect(() => createGroundGlassCocTarget(renderer, 64, 32)).toThrow(
      "No renderable Ground Glass CoC color target is available",
    );
  });

  it("uses the physical CoC needed to reach the renderer gather cap", () => {
    const maximumCoCRadiusPx = 60;
    const filmWidthMm = 127;
    const renderWidthPx = 320;
    const range = resolveGroundGlassCocStorageMaxMm({ maximumCoCRadiusPx, filmWidthMm, renderWidthPx });
    expect(range).toBeCloseTo((maximumCoCRadiusPx * 2 * filmWidthMm) / renderWidthPx, 12);
    expect(range).toBeCloseTo(47.625, 12);
    expect(range * renderWidthPx / filmWidthMm / 2).toBeCloseTo(maximumCoCRadiusPx, 12);
  });

  it("preserves both signs of Architecture Rise's physical 0.169 mm CoC in byte fallback", () => {
    // Representative Standard-quality full-film RTT width at a 500px logical preview.
    const renderWidthPx = Math.round(500 * 0.85);
    const filmWidthMm = 127;
    const maximumCoCRadiusPx = 60;
    const maximumCoCMm = resolveGroundGlassCocStorageMaxMm({ maximumCoCRadiusPx, filmWidthMm, renderWidthPx });
    for (const physicalMm of [0.169, -0.169]) {
      const encoded = encodeGroundGlassSignedCoC(physicalMm, "encoded-byte", maximumCoCMm);
      const byte = quantizeGroundGlassSignedCoCByte(encoded);
      const decoded = decodeGroundGlassSignedCoC(encoded, "encoded-byte", maximumCoCMm);
      expect(byte).not.toBe(GROUND_GLASS_SIGNED_COC_NEUTRAL_BYTE);
      expect(Math.sign(decoded)).toBe(Math.sign(physicalMm));
      expect(Math.abs(decoded - physicalMm)).toBeLessThanOrEqual(maximumCoCMm / 127 / 2 + 1e-12);
    }
  });

  it("keeps neutral exact and saturates large signed CoC without losing sign", () => {
    const maximumCoCMm = resolveGroundGlassCocStorageMaxMm({
      maximumCoCRadiusPx: 60, filmWidthMm: 127, renderWidthPx: 425,
    });
    expect(encodeGroundGlassSignedCoCByte(0, maximumCoCMm)).toBe(128);
    const neutral = encodeGroundGlassSignedCoC(0, "encoded-byte", maximumCoCMm);
    expect(quantizeGroundGlassSignedCoCByte(neutral)).toBe(128);
    expect(decodeGroundGlassSignedCoC(neutral, "encoded-byte", maximumCoCMm)).toBe(0);

    const negativeCode = encodeGroundGlassSignedCoCByte(-2 * maximumCoCMm, maximumCoCMm);
    const positiveCode = encodeGroundGlassSignedCoCByte(2 * maximumCoCMm, maximumCoCMm);
    expect(negativeCode).toBe(0);
    expect(positiveCode).toBe(255);
    expect(decodeGroundGlassSignedCoCByte(negativeCode, maximumCoCMm)).toBeLessThan(0);
    expect(decodeGroundGlassSignedCoCByte(positiveCode, maximumCoCMm)).toBeGreaterThan(0);
  });

  it("keeps half-float storage as direct physical millimetres", () => {
    const maximumCoCMm = resolveGroundGlassCocStorageMaxMm({
      maximumCoCRadiusPx: 60, filmWidthMm: 127, renderWidthPx: 425,
    });
    for (const cocMm of [-0.169, 0.169]) {
      const stored = encodeGroundGlassSignedCoC(cocMm, "half-float-mm", maximumCoCMm);
      expect(stored).toBe(cocMm);
      expect(decodeGroundGlassSignedCoC(stored, "half-float-mm", maximumCoCMm)).toBe(cocMm);
    }
  });

  it("keeps encoded footprint radii nonzero and pair-scaled anisotropy recognizable", () => {
    const cocStorageMaxMm = resolveGroundGlassCocStorageMaxMm({
      maximumCoCRadiusPx: 60, filmWidthMm: 127, renderWidthPx: 425,
    });
    const footprintStorageMaxMm = cocStorageMaxMm * 0.5;
    const axes = { majorRadiusMm: 0.5, minorRadiusMm: 0.169 };
    const encoded = encodeGroundGlassFootprintAxesMm({
      ...axes, storageFormat: "encoded-byte", maximumRadiusMm: footprintStorageMaxMm,
    });
    const decoded = decodeGroundGlassFootprintAxesMm({
      ...encoded, storageFormat: "encoded-byte", maximumRadiusMm: footprintStorageMaxMm,
    });
    expect(decoded.majorRadiusMm).toBeGreaterThan(0);
    expect(decoded.minorRadiusMm).toBeGreaterThan(0);
    expect(
      Math.abs(decoded.majorRadiusMm / decoded.minorRadiusMm - axes.majorRadiusMm / axes.minorRadiusMm) /
        (axes.majorRadiusMm / axes.minorRadiusMm),
    ).toBeLessThan(0.2);
  });

  it("reports whether a color render target can be sampled", () => {
    const target = new THREE.WebGLRenderTarget(8, 8);
    const { renderer } = createRendererWithFramebufferStatuses([contextComplete()]);
    expect(isGroundGlassColorRenderTargetRenderable(renderer, target)).toBe(true);
    target.dispose();
  });
});

function contextComplete() {
  return 0x8cd5;
}
