import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import {
  createGroundGlassCocTarget,
  decodeGroundGlassSignedCoC,
  encodeGroundGlassSignedCoC,
  isGroundGlassColorRenderTargetRenderable,
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
  it("keeps the half-float millimetre representation when its framebuffer is complete", () => {
    const { renderer, context } = createRendererWithFramebufferStatuses([
      contextComplete(),
    ]);

    const result = createGroundGlassCocTarget(renderer, 64, 32);

    expect(result.storageFormat).toBe("half-float-mm");
    expect(result.target.texture.type).toBe(THREE.HalfFloatType);
    expect(context.checkFramebufferStatus).toHaveBeenCalledTimes(1);
    result.target.dispose();
  });

  it("falls back to a byte-encoded CoC target when half-float attachment is incomplete", () => {
    const { renderer, context } = createRendererWithFramebufferStatuses([
      0x8cd6,
      contextComplete(),
    ]);

    const result = createGroundGlassCocTarget(renderer, 64, 32);

    expect(result.storageFormat).toBe("encoded-byte");
    expect(result.target.texture.type).toBe(THREE.UnsignedByteType);
    expect(context.checkFramebufferStatus).toHaveBeenCalledTimes(2);
    result.target.dispose();
  });

  it("reports an explicit failure when neither supported representation is renderable", () => {
    const { renderer } = createRendererWithFramebufferStatuses([0x8cd6, 0x8cd6]);

    expect(() => createGroundGlassCocTarget(renderer, 64, 32)).toThrow(
      "No renderable Ground Glass CoC color target is available",
    );
  });

  it("derives the encoded range from the visible maximum physical gather radius", () => {
    expect(
      resolveGroundGlassCocStorageMaxMm({
        maximumCoCRadiusPx: 48,
        filmWidthMm: 180,
        renderWidthPx: 1200,
        displayBlurScale: 2,
      }),
    ).toBeCloseTo(7.2, 10);
  });

  it.each([
    -7.2,
    -2.4,
    0,
    1.8,
    7.2,
  ])("round-trips signed byte storage for %s mm", (signedCocMm) => {
    const encoded = encodeGroundGlassSignedCoC(signedCocMm, "encoded-byte", 7.2);
    expect(decodeGroundGlassSignedCoC(encoded, "encoded-byte", 7.2)).toBeCloseTo(
      signedCocMm,
      12,
    );
  });

  it("keeps signed half-float storage lossless at the contract boundary", () => {
    for (const signedCocMm of [-7.2, 0, 7.2]) {
      const encoded = encodeGroundGlassSignedCoC(signedCocMm, "half-float-mm", 7.2);
      expect(decodeGroundGlassSignedCoC(encoded, "half-float-mm", 7.2)).toBe(
        signedCocMm,
      );
    }
  });
});

function contextComplete() {
  return 0x8cd5;
}

describe("Ground Glass CoC framebuffer validation", () => {
  it("restores the previously bound target after checking completeness", () => {
    const { renderer } = createRendererWithFramebufferStatuses([contextComplete()]);
    const target = new THREE.WebGLRenderTarget(8, 8, {
      type: THREE.HalfFloatType,
      depthBuffer: false,
      stencilBuffer: false,
    });

    expect(isGroundGlassColorRenderTargetRenderable(renderer, target)).toBe(true);
    expect(renderer.setRenderTarget).toHaveBeenCalledWith(null);
    target.dispose();
  });
});
