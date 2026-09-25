import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import { ACCEPTABLE_COC_DIAMETER_MM } from "../../core/optics/physicalSharpness";
import { resolveGroundGlassDisplayBlurScale } from "../../render/groundGlassBlurCalibration";
import {
  createGroundGlassCocTarget,
  decodeGroundGlassSignedCoC,
  decodeGroundGlassSignedCoCByte,
  encodeGroundGlassSignedCoCByte,
  GROUND_GLASS_SIGNED_COC_NEUTRAL_BYTE,
  encodeGroundGlassSignedCoC,
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
  it("keeps the half-float millimetre representation when its framebuffer is complete", () => {
    const { renderer, context } = createRendererWithFramebufferStatuses([
      contextComplete(),
    ]);

    const result = createGroundGlassCocTarget(renderer, 64, 32);

    expect(result.storageFormat).toBe("half-float-mm");
    expect(result.target.texture.type).toBe(THREE.HalfFloatType);
    expect(result.target.texture.minFilter).toBe(THREE.NearestFilter);
    expect(result.target.texture.magFilter).toBe(THREE.NearestFilter);
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
    expect(result.target.texture.minFilter).toBe(THREE.NearestFilter);
    expect(result.target.texture.magFilter).toBe(THREE.NearestFilter);
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
      }),
    ).toBeCloseTo(14.4, 10);
  });

  it("keeps the scale-1 range and reduces the physical byte range by the display scale", () => {
    const input = {
      maximumCoCRadiusPx: 60,
      filmWidthMm: 127,
      renderWidthPx: 320,
    };
    const scale1RangeMm = resolveGroundGlassCocStorageMaxMm({
      ...input,
      displayBlurScale: 1,
    });
    const displayBlurScale = resolveGroundGlassDisplayBlurScale({
      acceptableCoCDiameterMm: ACCEPTABLE_COC_DIAMETER_MM,
      filmWidthMm: input.filmWidthMm,
      displayWidthPx: input.renderWidthPx,
    });
    const calibratedRangeMm = resolveGroundGlassCocStorageMaxMm({
      ...input,
      displayBlurScale,
    });

    expect(scale1RangeMm).toBeCloseTo((2 * 60 * 127) / 320, 12);
    expect(displayBlurScale).toBeCloseTo(7.9375, 12);
    expect(calibratedRangeMm).toBeCloseTo(scale1RangeMm / displayBlurScale, 12);
  });

  it("preserves both signs of the Architecture Rise CoC using the resolved display scale", () => {
    const renderWidthPx = 320;
    const filmWidthMm = 127;
    const maximumCoCRadiusPx = 60;
    const displayBlurScale = resolveGroundGlassDisplayBlurScale({
      acceptableCoCDiameterMm: ACCEPTABLE_COC_DIAMETER_MM,
      filmWidthMm,
      displayWidthPx: renderWidthPx,
    });
    const maximumCoCMm = resolveGroundGlassCocStorageMaxMm({
      maximumCoCRadiusPx,
      filmWidthMm,
      renderWidthPx,
      displayBlurScale,
    });
    const cocMagnitudeMm = 0.169;
    const cases = [cocMagnitudeMm, -cocMagnitudeMm];

    for (const physicalMm of cases) {
      const byteCode = encodeGroundGlassSignedCoCByte(physicalMm, maximumCoCMm);
      const stored = encodeGroundGlassSignedCoC(
        physicalMm,
        "encoded-byte",
        maximumCoCMm,
      );
      const decodedMm = decodeGroundGlassSignedCoC(
        stored,
        "encoded-byte",
        maximumCoCMm,
      );

      expect(quantizeGroundGlassSignedCoCByte(stored)).toBe(byteCode);
      if (physicalMm > 0) {
        expect(byteCode).toBeGreaterThan(128);
      } else {
        expect(byteCode).toBeLessThan(128);
      }
      expect(Math.sign(decodedMm)).toBe(Math.sign(physicalMm));
      expect(Math.abs(decodedMm - physicalMm)).toBeLessThanOrEqual(
        maximumCoCMm / 127 / 2 + 1e-12,
      );
    }
  });

  it("keeps neutral and saturated signed CoC codes exact under the reduced byte range", () => {
    const displayBlurScale = resolveGroundGlassDisplayBlurScale({
      acceptableCoCDiameterMm: ACCEPTABLE_COC_DIAMETER_MM,
      filmWidthMm: 127,
      displayWidthPx: 320,
    });
    const maximumCoCMm = resolveGroundGlassCocStorageMaxMm({
      maximumCoCRadiusPx: 60,
      filmWidthMm: 127,
      renderWidthPx: 320,
      displayBlurScale,
    });

    expect(encodeGroundGlassSignedCoCByte(0, maximumCoCMm)).toBe(128);
    expect(
      decodeGroundGlassSignedCoC(
        encodeGroundGlassSignedCoC(0, "encoded-byte", maximumCoCMm),
        "encoded-byte",
        maximumCoCMm,
      ),
    ).toBe(0);

    const negativeSaturatedByte = encodeGroundGlassSignedCoCByte(
      -2 * maximumCoCMm,
      maximumCoCMm,
    );
    const positiveSaturatedByte = encodeGroundGlassSignedCoCByte(
      2 * maximumCoCMm,
      maximumCoCMm,
    );
    const negativeDecodedMm = decodeGroundGlassSignedCoCByte(
      negativeSaturatedByte,
      maximumCoCMm,
    );
    const positiveDecodedMm = decodeGroundGlassSignedCoCByte(
      positiveSaturatedByte,
      maximumCoCMm,
    );

    expect(negativeSaturatedByte).toBe(0);
    expect(positiveSaturatedByte).toBe(255);
    expect(negativeDecodedMm).toBe(-maximumCoCMm);
    expect(positiveDecodedMm).toBe(maximumCoCMm);
    expect(negativeDecodedMm).toBeLessThan(0);
    expect(positiveDecodedMm).toBeGreaterThan(0);
  });

  it("maps the largest represented physical CoC diameter to the display-space radius cap", () => {
    const displayWidthPx = 320;
    const displayBlurScale = resolveGroundGlassDisplayBlurScale({
      acceptableCoCDiameterMm: ACCEPTABLE_COC_DIAMETER_MM,
      filmWidthMm: 127,
      displayWidthPx,
    });
    const maximumCoCRadiusPx = 60;
    const filmWidthMm = 127;
    const renderWidthPx = 320;
    const maximumRepresentedCocMm = resolveGroundGlassCocStorageMaxMm({
      maximumCoCRadiusPx,
      filmWidthMm,
      renderWidthPx,
      displayBlurScale,
    });
    const displayRadiusPx =
      maximumRepresentedCocMm * renderWidthPx / filmWidthMm * displayBlurScale / 2;

    expect(displayRadiusPx).toBeCloseTo(maximumCoCRadiusPx, 12);
  });

  it("keeps half-float CoC values in physical millimetres regardless of display calibration", () => {
    for (const displayWidthPx of [320, 640]) {
      const displayBlurScale = resolveGroundGlassDisplayBlurScale({
        acceptableCoCDiameterMm: ACCEPTABLE_COC_DIAMETER_MM,
        filmWidthMm: 127,
        displayWidthPx,
      });
      const range = resolveGroundGlassCocStorageMaxMm({
        maximumCoCRadiusPx: 60,
        filmWidthMm: 127,
        renderWidthPx: displayWidthPx,
        displayBlurScale,
      });

      for (const signedCocMm of [-0.169, 0.169]) {
        const storedMm = encodeGroundGlassSignedCoC(
          signedCocMm,
          "half-float-mm",
          range,
        );
        expect(storedMm).toBe(signedCocMm);
        expect(
          decodeGroundGlassSignedCoC(storedMm, "half-float-mm", range),
        ).toBe(signedCocMm);
      }
    }
  });

  it("preserves an exact neutral byte code through normalized RGBA8 quantization", () => {
    const encoded = encodeGroundGlassSignedCoC(0, "encoded-byte", 7.2);

    expect(encodeGroundGlassSignedCoCByte(0, 7.2)).toBe(
      GROUND_GLASS_SIGNED_COC_NEUTRAL_BYTE,
    );
    expect(quantizeGroundGlassSignedCoCByte(encoded)).toBe(
      GROUND_GLASS_SIGNED_COC_NEUTRAL_BYTE,
    );
    expect(decodeGroundGlassSignedCoC(encoded, "encoded-byte", 7.2)).toBe(0);
    expect(
      decodeGroundGlassSignedCoCByte(GROUND_GLASS_SIGNED_COC_NEUTRAL_BYTE, 7.2),
    ).toBe(0);
  });

  it("keeps representative negative and positive signs after byte quantization", () => {
    const maximumCoCMm = 7.2;
    const cases = [
      { value: -maximumCoCMm, expectedByte: 0 },
      { value: -maximumCoCMm / 128, expectedByte: 127 },
      { value: maximumCoCMm / 127, expectedByte: 129 },
      { value: maximumCoCMm, expectedByte: 255 },
    ];

    for (const { value, expectedByte } of cases) {
      const byteCode = encodeGroundGlassSignedCoCByte(value, maximumCoCMm);
      const encoded = encodeGroundGlassSignedCoC(value, "encoded-byte", maximumCoCMm);

      expect(byteCode).toBe(expectedByte);
      expect(quantizeGroundGlassSignedCoCByte(encoded)).toBe(expectedByte);
      expect(Math.sign(decodeGroundGlassSignedCoC(encoded, "encoded-byte", maximumCoCMm))).toBe(
        Math.sign(value),
      );
    }
  });

  it("keeps byte mapping bounded and monotonic on each side of neutral", () => {
    const maximumCoCMm = 7.2;
    const negativeCodes = [-maximumCoCMm, -maximumCoCMm / 2, -maximumCoCMm / 128]
      .map((value) => encodeGroundGlassSignedCoCByte(value, maximumCoCMm));
    const positiveCodes = [maximumCoCMm / 127, maximumCoCMm / 2, maximumCoCMm]
      .map((value) => encodeGroundGlassSignedCoCByte(value, maximumCoCMm));

    expect(negativeCodes).toEqual([0, 64, 127]);
    expect(positiveCodes).toEqual([129, 192, 255]);
    expect(negativeCodes.every((code) => code < GROUND_GLASS_SIGNED_COC_NEUTRAL_BYTE)).toBe(true);
    expect(positiveCodes.every((code) => code > GROUND_GLASS_SIGNED_COC_NEUTRAL_BYTE)).toBe(true);
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
