import { beforeEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";

const capture = vi.hoisted(() => ({
  targets: [] as Array<{ dispose: ReturnType<typeof vi.fn>; texture: { mipmaps: unknown[] } }>,
  cameras: [] as Array<{ position: { toArray: () => number[] } }>,
  updates: [] as unknown[],
  generators: [] as Array<{
    dispose: ReturnType<typeof vi.fn>;
    fromCubemap: ReturnType<typeof vi.fn>;
  }>,
  failUpdate: 0,
}));
vi.mock("three", async (importOriginal) => {
  const actual = await importOriginal<typeof import("three")>();
  return {
    ...actual,
    WebGLCubeRenderTarget: class {
      texture = { mipmaps: [] as unknown[] };
      dispose = vi.fn();
      constructor() {
        capture.targets.push(this);
      }
    },
    CubeCamera: class {
      position = new actual.Vector3();
      constructor() {
        capture.cameras.push(this);
      }
      update(_renderer: unknown, scene: { environment: unknown }) {
        capture.updates.push(scene.environment);
        if (capture.failUpdate === capture.updates.length) throw new Error("capture failed");
      }
    },
    PMREMGenerator: class {
      dispose = vi.fn();
      fromCubemap = vi.fn((_source: unknown, target: unknown) => target);
      constructor() {
        capture.generators.push(this);
      }
    },
  };
});
// The dev-only experiment intentionally ships as plain JavaScript, outside the TypeScript build.
// @ts-expect-error The experiment has no TypeScript declaration.
import { captureRoomReflections } from "../../../experiments/room-at-dawn/reflection-capture.js";

function fixture() {
  const borrowed = { id: "borrowed", dispose: vi.fn() };
  const scene = new THREE.Scene();
  scene.environment = borrowed as unknown as THREE.Texture;
  const giUniforms = {
    giBoxMin: { value: new THREE.Vector3(-1, -1, -1) },
    giBoxMax: { value: new THREE.Vector3(1, 1, 1) },
    giProbePos: { value: new THREE.Vector3(7, 8, 9) },
    giExt: { value: 0.8 },
  };
  const context = {
    FRAMEBUFFER: 1,
    FRAMEBUFFER_COMPLETE: 2,
    checkFramebufferStatus: vi.fn(() => 2),
  };
  const previousTarget = { id: "outer" };
  const renderer = {
    isWebGLRenderer: true,
    xr: { enabled: true },
    autoClear: false,
    toneMapping: THREE.ACESFilmicToneMapping,
    toneMappingExposure: 1.7,
    getRenderTarget: vi.fn(() => previousTarget),
    getActiveCubeFace: vi.fn(() => 3),
    getActiveMipmapLevel: vi.fn(() => 2),
    getViewport: vi.fn((v: THREE.Vector4) => v.set(1, 2, 3, 4)),
    getScissor: vi.fn((v: THREE.Vector4) => v.set(5, 6, 7, 8)),
    getScissorTest: vi.fn(() => true),
    getClearColor: vi.fn((c: THREE.Color) => c.setRGB(0.1, 0.2, 0.3)),
    getClearAlpha: vi.fn(() => 0.4),
    getContext: vi.fn(() => context),
    setRenderTarget: vi.fn(),
    setViewport: vi.fn(),
    setScissor: vi.fn(),
    setScissorTest: vi.fn(),
    setClearColor: vi.fn(),
  };
  return {
    borrowed,
    scene,
    giUniforms,
    context,
    previousTarget,
    renderer,
    args: {
      renderer,
      scene,
      giUniforms,
      roomBox: { min: new THREE.Vector3(0, 0, 0), max: new THREE.Vector3(4.8, 2.5, 4) },
      probe: new THREE.Vector3(2.35, 1.3, 2),
      roomOrigin: new THREE.Vector3(1.7, 0.85, 0.35),
    },
  };
}
beforeEach(() => {
  capture.targets.length = 0;
  capture.cameras.length = 0;
  capture.updates.length = 0;
  capture.generators.length = 0;
  capture.failUpdate = 0;
});

describe("room-at-dawn renderer-owned reflection capture", () => {
  it("uses separate targets, original GI coordinates, translated probe and idempotent ownership", () => {
    const f = fixture();
    const cleanup = captureRoomReflections(f.args);
    expect(capture.cameras[0].position.toArray()).toEqual([
      0.6500000000000001, 0.45000000000000007, 1.65,
    ]);
    expect(capture.updates).toEqual([null, capture.targets[1].texture]);
    expect(f.scene.environment).toBe(capture.targets[2].texture);
    expect(f.giUniforms.giProbePos.value.toArray()).toEqual([2.35, 1.3, 2]);
    expect(f.giUniforms.giBoxMax.value.toArray()).toEqual([4.8, 2.5, 4]);
    expect(f.giUniforms.giExt.value).toBe(0.8);
    expect(f.renderer.setRenderTarget).toHaveBeenLastCalledWith(f.previousTarget, 3, 2);
    expect(f.renderer.xr.enabled).toBe(true);
    expect(f.renderer.autoClear).toBe(false);
    expect(f.renderer.toneMapping).toBe(THREE.ACESFilmicToneMapping);
    expect(capture.targets[0].dispose).toHaveBeenCalledTimes(1);
    expect(capture.targets[1].dispose).toHaveBeenCalledTimes(1);
    expect(capture.targets[2].dispose).not.toHaveBeenCalled();
    expect(capture.generators[0].dispose).toHaveBeenCalledTimes(1);
    cleanup();
    cleanup();
    expect(f.scene.environment).toBe(f.borrowed);
    expect(f.borrowed.dispose).not.toHaveBeenCalled();
    expect(f.giUniforms.giProbePos.value.toArray()).toEqual([7, 8, 9]);
    expect(capture.targets[2].dispose).toHaveBeenCalledTimes(1);
  });
  it("fails closed on incomplete framebuffer and disposes all allocated targets", () => {
    const f = fixture();
    f.context.checkFramebufferStatus.mockReturnValue(0);
    expect(() => captureRoomReflections(f.args)).toThrow(/framebuffer incomplete/);
    expect(f.scene.environment).toBe(f.borrowed);
    expect(f.borrowed.dispose).not.toHaveBeenCalled();
    expect(capture.targets).toHaveLength(3);
    capture.targets.forEach((target) => expect(target.dispose).toHaveBeenCalledTimes(1));
  });
  it("restores borrowed state and disposes targets when capture throws", () => {
    const f = fixture();
    capture.failUpdate = 2;
    expect(() => captureRoomReflections(f.args)).toThrow("capture failed");
    expect(f.scene.environment).toBe(f.borrowed);
    expect(f.giUniforms.giBoxMin.value.toArray()).toEqual([-1, -1, -1]);
    expect(f.giUniforms.giProbePos.value.toArray()).toEqual([7, 8, 9]);
    expect(f.renderer.setRenderTarget).toHaveBeenLastCalledWith(f.previousTarget, 3, 2);
    capture.targets.forEach((target) => expect(target.dispose).toHaveBeenCalledTimes(1));
    expect(capture.generators[0].dispose).toHaveBeenCalledTimes(1);
  });
  it("continues cleanup when a renderer restoration operation fails", () => {
    const f = fixture();
    f.renderer.setViewport.mockImplementation(() => {
      throw new Error("restore failed");
    });
    expect(() => captureRoomReflections(f.args)).toThrow(/could not restore/);
    expect(f.renderer.setScissor).toHaveBeenCalled();
    expect(f.scene.environment).toBe(f.borrowed);
    capture.targets.forEach((target) => expect(target.dispose).toHaveBeenCalledTimes(1));
  });
});
