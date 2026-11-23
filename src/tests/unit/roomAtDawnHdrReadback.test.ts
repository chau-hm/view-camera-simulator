import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
// @ts-expect-error Development-only JavaScript HDR readback.
import { createHdrReadback, decodeHdrProbePixels, HDR_PROBE_SCALE } from "../../../experiments/room-at-dawn/hdr-readback.js";

const encode = (values: number[]) => new Uint8Array(values.flatMap((v) => {
  const n = Math.round(v * HDR_PROBE_SCALE);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255];
}));

function fixture() {
  const old = new THREE.WebGLRenderTarget(1, 1);
  const context = { NO_ERROR: 0, FRAMEBUFFER: 1, FRAMEBUFFER_COMPLETE: 2,
    isContextLost: () => false, getError: () => 0, checkFramebufferStatus: vi.fn(() => 2) };
  let active = old;
  const renderer = {
    isWebGLRenderer: true, getContext: () => context,
    getRenderTarget: () => active, getActiveCubeFace: () => 0, getActiveMipmapLevel: () => 0,
    getViewport: (v: THREE.Vector4) => v.set(2, 3, 4, 5),
    getScissor: (v: THREE.Vector4) => v.set(6, 7, 8, 9),
    getScissorTest: () => true, getClearColor: (v: THREE.Color) => v.setRGB(.1, .2, .3),
    getClearAlpha: () => .4, autoClear: true, xr: { enabled: true },
    setRenderTarget: vi.fn((v) => { active = v; }), setViewport: vi.fn(), setScissor: vi.fn(),
    setScissorTest: vi.fn(), setClearColor: vi.fn(), render: vi.fn(),
    readRenderTargetPixels: vi.fn((_t, _x, _y, _w, _h, out) => out.set(encode([.1, 1, 4, 8]))),
  };
  const input = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, format: THREE.RGBAFormat });
  return { renderer, context, input, old };
}

describe("room HDR linear readback encoding", () => {
  it("retains mixed-channel values above one to the stated quantization step", () => {
    const expected = [.1, .5, 2, 8];
    expect(decodeHdrProbePixels(encode(expected))).toEqual(expected.map((v) => Math.round(v * HDR_PROBE_SCALE) / HDR_PROBE_SCALE));
    const invalid = encode(expected); invalid[7] = 0;
    expect(() => decodeHdrProbePixels(invalid)).toThrow(/invalid or out of range/);
  });
  it("restores renderer state after success and framebuffer failure, and rejects byte input", () => {
    const { renderer, context, input, old } = fixture();
    // JS helper intentionally checks the actual Three renderer contract at runtime.
    const probe = createHdrReadback(renderer);
    expect(probe.read(input, 1, 2)[2]).toBe(4);
    expect(renderer.getRenderTarget()).toBe(old);
    expect(renderer.xr.enabled).toBe(true);
    expect(renderer.autoClear).toBe(true);
    context.checkFramebufferStatus.mockReturnValue(99);
    expect(() => probe.read(input, 1, 2)).toThrow(/framebuffer incomplete/);
    expect(renderer.getRenderTarget()).toBe(old);
    expect(renderer.setViewport).toHaveBeenLastCalledWith(new THREE.Vector4(2, 3, 4, 5));
    expect(renderer.setScissor).toHaveBeenLastCalledWith(new THREE.Vector4(6, 7, 8, 9));
    expect(renderer.setScissorTest).toHaveBeenLastCalledWith(true);
    expect(() => probe.read(old, 0, 0)).toThrow(/HalfFloat/);
    expect(() => probe.read(input, -1, 0)).toThrow(/out of bounds/);
    probe.dispose(); probe.dispose();
    expect(() => probe.read(input, 0, 0)).toThrow(/disposed/);
    old.dispose(); input.dispose();
  });
});

// @ts-expect-error Development-only JavaScript calibration fixture.
import { createHdrConstantFieldProfile } from "../../../experiments/room-at-dawn/hdr-fixture.js";

describe("room HDR calibration fixture", () => {
  it("owns a separately mounted unlit linear field with configurable depth and radiance", () => {
    const scene = new THREE.Scene();
    const profile = createHdrConstantFieldProfile({ rgb: [.1, 2, 8], depthMetres: 1.25 });
    const mounted = profile.mountSubject(scene);
    const mesh = mounted.group.children[0] as THREE.Mesh;
    const material = mesh.material as THREE.ShaderMaterial;
    const geometryDispose = vi.spyOn(mesh.geometry, "dispose");
    const materialDispose = vi.spyOn(material, "dispose");
    expect(material.uniforms.radiance.value.toArray()).toEqual([.1, 2, 8]);
    expect(material.toneMapped).toBe(false);
    expect(mesh.position.z).toBe(1.25);
    expect(profile.resolveRenderBounds().min.z).toBe(1249);
    mounted.dispose(); mounted.dispose();
    expect(scene.children).toHaveLength(0);
    expect(geometryDispose).toHaveBeenCalledTimes(1);
    expect(materialDispose).toHaveBeenCalledTimes(1);
    expect(() => createHdrConstantFieldProfile({ rgb: [1, Infinity, 1] })).toThrow();
  });
});
