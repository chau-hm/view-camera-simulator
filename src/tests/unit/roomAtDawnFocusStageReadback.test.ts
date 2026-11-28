import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
// @ts-expect-error Development-only JavaScript Ground Glass stage probe.
import { createFocusStageReadback, decodeFocusStageNormalizedPixels, decodeFocusStageSignedPixels, FOCUS_STAGE_NORMALIZED_PRECISION, FOCUS_STAGE_READBACK_FRAGMENT_SHADER, FOCUS_STAGE_SIGNED_PRECISION } from "../../../experiments/room-at-dawn/focus-stage-readback.js";

const rgba8 = (code: number[]) => [
  (code[0]! >> 16) & 255, (code[0]! >> 8) & 255, code[0]! & 255, 255,
  (code[1]! >> 16) & 255, (code[1]! >> 8) & 255, code[1]! & 255, 255,
  (code[2]! >> 16) & 255, (code[2]! >> 8) & 255, code[2]! & 255, 255,
  (code[3]! >> 16) & 255, (code[3]! >> 8) & 255, code[3]! & 255, 255,
];

const encodeSigned = (values: number[]) => new Uint8Array(rgba8(
  values.map((value) => Math.min(0xffffff, Math.floor((value + 2048) * 4096 + 0.5))),
));
const encodeNormalized = (value: number) => new Uint8Array(rgba8([
  value === 1 ? 0xffffff : Math.floor(value * 0xffffff + 0.5), 0, 0, 0,
]));

function fixture() {
  const old = new THREE.WebGLRenderTarget(2, 2);
  const source = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType });
  const depth = new THREE.DepthTexture(4, 4, THREE.UnsignedShortType);
  const context = {
    NO_ERROR: 0,
    FRAMEBUFFER: 1,
    FRAMEBUFFER_COMPLETE: 2,
    isContextLost: () => false,
    getError: () => 0,
    checkFramebufferStatus: vi.fn(() => 2),
  };
  let active = old;
  let bytes: Uint8Array<ArrayBufferLike> = encodeSigned([-2.5, -1 / 4096, 0, 13.25]);
  const renderer = {
    isWebGLRenderer: true,
    getContext: () => context,
    getRenderTarget: () => active,
    getActiveCubeFace: () => 0,
    getActiveMipmapLevel: () => 0,
    getViewport: (value: THREE.Vector4) => value.set(2, 3, 4, 5),
    getScissor: (value: THREE.Vector4) => value.set(6, 7, 8, 9),
    getScissorTest: () => true,
    getClearColor: (value: THREE.Color) => value.setRGB(0.1, 0.2, 0.3),
    getClearAlpha: () => 0.4,
    autoClear: true,
    xr: { enabled: true },
    setRenderTarget: vi.fn((value) => { active = value; }),
    setViewport: vi.fn(),
    setScissor: vi.fn(),
    setScissorTest: vi.fn(),
    setClearColor: vi.fn(),
    render: vi.fn(),
    readRenderTargetPixels: vi.fn((_target, _x, _y, _width, _height, output) => output.set(bytes)),
  };
  return { context, depth, old, renderer, setBytes: (next: Uint8Array<ArrayBufferLike>) => { bytes = next; }, source };
}

describe("room-at-dawn focus-stage readback", () => {
  it("decodes signed CoC and linear color with the declared 24-bit precision", () => {
    expect(decodeFocusStageSignedPixels(encodeSigned([-2.5, -1 / 4096, 0, 13.25])))
      .toEqual([-2.5, -1 / 4096, 0, 13.25]);
    const maximumRepresentable = 0xffffff / 4096 - 2048;
    expect(decodeFocusStageSignedPixels(encodeSigned([-2048, maximumRepresentable, 0, 0])))
      .toEqual([-2048, maximumRepresentable, 0, 0]);
    expect(FOCUS_STAGE_SIGNED_PRECISION).toBe(1 / 4096);
    const invalid = encodeSigned([0, 0, 0, 0]);
    invalid[3] = 0;
    expect(() => decodeFocusStageSignedPixels(invalid)).toThrow(/invalid or out of range/);
  });

  it("uses full 24-bit normalized precision for depth", () => {
    const decoded = decodeFocusStageNormalizedPixels(encodeNormalized(0.73541));
    expect(Math.abs(decoded - 0.73541)).toBeLessThanOrEqual(FOCUS_STAGE_NORMALIZED_PRECISION / 2);
    expect(decodeFocusStageNormalizedPixels(encodeNormalized(0))).toBe(0);
    expect(decodeFocusStageNormalizedPixels(encodeNormalized(1))).toBe(1);
    expect(FOCUS_STAGE_READBACK_FRAGMENT_SHADER).toContain("channel == 1.0 ? 16777215.0");
    expect(FOCUS_STAGE_READBACK_FRAGMENT_SHADER).toContain("scaled >= 16777215.0 ? 16777215.0");
    expect(FOCUS_STAGE_READBACK_FRAGMENT_SHADER).toContain("code <= 16777215.0");
    expect(FOCUS_STAGE_NORMALIZED_PRECISION).toBe(1 / 0xffffff);
  });

  it("samples borrowed RGBA targets and depth while restoring renderer state", () => {
    const { context, depth, old, renderer, setBytes, source } = fixture();
    const probe = createFocusStageReadback(renderer);
    expect(probe.readColor(source, 1, 2).rgba).toEqual([-2.5, -1 / 4096, 0, 13.25]);
    setBytes(encodeNormalized(0.625));
    expect(probe.readDepth(depth, 1, 2).depth).toBeCloseTo(0.625, 7);
    expect(renderer.getRenderTarget()).toBe(old);
    expect(renderer.xr.enabled).toBe(true);
    expect(renderer.autoClear).toBe(true);
    expect(renderer.setViewport).toHaveBeenLastCalledWith(new THREE.Vector4(2, 3, 4, 5));
    expect(renderer.setScissor).toHaveBeenLastCalledWith(new THREE.Vector4(6, 7, 8, 9));
    expect(renderer.setScissorTest).toHaveBeenLastCalledWith(true);

    context.checkFramebufferStatus.mockReturnValue(99);
    expect(() => probe.readColor(source, 1, 2)).toThrow(/framebuffer incomplete/);
    expect(renderer.getRenderTarget()).toBe(old);
    expect(renderer.xr.enabled).toBe(true);
    expect(renderer.autoClear).toBe(true);
    expect(() => probe.readColor(source, -1, 2)).toThrow(/out of bounds/);
    const unsupportedColor = new THREE.WebGLRenderTarget(2, 2, { type: THREE.FloatType });
    expect(() => probe.readColor(unsupportedColor, 0, 0)).toThrow(/linear RGBA/);
    const unsupportedDepth = new THREE.DataTexture(new Uint8Array([1]), 1, 1);
    expect(() => probe.readDepth(unsupportedDepth, 0, 0)).toThrow(/DepthTexture/);
    unsupportedColor.dispose();
    unsupportedDepth.dispose();
    probe.dispose();
    probe.dispose();
    expect(() => probe.readColor(source, 0, 0)).toThrow(/disposed/);
    old.dispose();
    source.dispose();
    depth.dispose();
  });
});
