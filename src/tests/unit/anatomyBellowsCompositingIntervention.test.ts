import * as THREE from "three";
import { describe, expect, it } from "vitest";
import {
  anatomyBellowsCompositingOverrides,
  createAnatomyBellowsCompositingMaterialClone,
  registerAnatomyBellowsCompositingOverride,
  resolveAnatomyBellowsCompositingTarget,
  readAnatomyBellowsCompositingOverride,
  summarizeAnatomyDifferenceOfResponses,
  summarizeAnatomyFactorialInteraction,
  summarizeSignedAnatomyImageResponse,
  type AnatomyBellowsCompositingCandidate,
} from "../../render/backend/anatomyBellowsCompositingIntervention";
import { readObserverOutputSourceMaterial } from "../../render/backend/observerMaterialOutputIdentity";

const makeCandidate = (overrides: Partial<AnatomyBellowsCompositingCandidate> = {}): AnatomyBellowsCompositingCandidate => ({
  id: "mounted-bellows",
  name: "bellows-folded-surface",
  role: "conceptual-camera/bellows",
  cameraPart: "bellows",
  visible: true,
  source: {
    id: "authored-source",
    type: "MeshStandardMaterial",
    opacity: 0.16,
    transparent: true,
    blending: THREE.NormalBlending,
    premultipliedAlpha: false,
    depthTest: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    forceSinglePass: false,
  },
  ...overrides,
});

describe("in-situ Anatomy Bellows compositing interventions", () => {
  it("keeps the 2x2 condition table bounded to the two named mechanisms", () => {
    expect(anatomyBellowsCompositingOverrides("C1")).toEqual({ forceSinglePass: true });
    expect(anatomyBellowsCompositingOverrides("C2")).toEqual({ blending: THREE.NoBlending });
    expect(anatomyBellowsCompositingOverrides("C3")).toEqual({
      forceSinglePass: true,
      blending: THREE.NoBlending,
    });
  });

  it("rejects stale, semantically different, hidden, and non-baseline mounted sources", () => {
    expect(resolveAnatomyBellowsCompositingTarget("missing", "authored-source", [makeCandidate()]))
      .toMatchObject({ ok: false, reason: "stale-renderable-id" });
    expect(resolveAnatomyBellowsCompositingTarget("mounted-bellows", "authored-source", [
      makeCandidate({ name: "another-mesh" }),
    ])).toMatchObject({ ok: false, reason: "wrong-semantic-renderable" });
    expect(resolveAnatomyBellowsCompositingTarget("mounted-bellows", "authored-source", [
      makeCandidate({ visible: false }),
    ])).toMatchObject({ ok: false, reason: "selected-renderable-not-visible" });
    expect(resolveAnatomyBellowsCompositingTarget("mounted-bellows", "authored-source", [
      makeCandidate({ source: { ...makeCandidate().source, opacity: 0.5 } }),
    ])).toMatchObject({ ok: false, reason: "non-baseline-source-material" });
    expect(resolveAnatomyBellowsCompositingTarget("mounted-bellows", "wrong-source", [makeCandidate()]))
      .toMatchObject({ ok: false, reason: "source-material-mismatch" });
    expect(resolveAnatomyBellowsCompositingTarget("mounted-bellows", "authored-source", [makeCandidate()]))
      .toMatchObject({ ok: true, target: { id: "mounted-bellows" } });
  });

  it("owns only a diagnostic material clone and preserves its borrowed source and textures", () => {
    const texture = new THREE.Texture();
    const source = new THREE.MeshStandardMaterial({
      color: "#111827",
      map: texture,
      opacity: 0.16,
      transparent: true,
      blending: THREE.NormalBlending,
      premultipliedAlpha: false,
      depthTest: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const sourceDispose = source.dispose.bind(source);
    const textureDispose = texture.dispose.bind(texture);
    let sourceDisposed = 0;
    let textureDisposed = 0;
    source.addEventListener("dispose", () => { sourceDisposed += 1; });
    texture.addEventListener("dispose", () => { textureDisposed += 1; });
    const clone = createAnatomyBellowsCompositingMaterialClone(source, "C3");

    expect(clone).not.toBe(source);
    expect(readObserverOutputSourceMaterial(clone)).toBe(source);
    expect(clone).toMatchObject({
      opacity: 0.16,
      transparent: true,
      blending: THREE.NoBlending,
      premultipliedAlpha: false,
      depthTest: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      forceSinglePass: true,
    });
    expect((clone as THREE.MeshStandardMaterial).map).toBe(texture);
    clone.dispose();
    expect(sourceDisposed).toBe(0);
    expect(textureDisposed).toBe(0);
    sourceDispose();
    textureDispose();
  });

  it("uses per-renderable generation identity so releasing an old token cannot clear a newer trial", () => {
    const renderable = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial());
    const first = registerAnatomyBellowsCompositingOverride(renderable, 8, "C1");
    const second = registerAnatomyBellowsCompositingOverride(renderable, 8, "C2");
    expect(readAnatomyBellowsCompositingOverride(renderable, 8)).toBe(second.registration);
    expect(readAnatomyBellowsCompositingOverride(renderable, 9)).toBeNull();
    first.release();
    expect(readAnatomyBellowsCompositingOverride(renderable, 8)).toBe(second.registration);
    second.release();
    expect(readAnatomyBellowsCompositingOverride(renderable, 8)).toBeNull();
    renderable.geometry.dispose();
    (renderable.material as THREE.Material).dispose();
  });

  it("compares signed responses only in a fixed ROI and computes difference-of-responses and interaction", () => {
    const image = (rgb: readonly [number, number, number]): THREE.DataTexture => {
      const pixels = new Uint8Array([rgb[0], rgb[1], rgb[2], 255, 200, 201, 202, 255]);
      return new THREE.DataTexture(pixels, 2, 1, THREE.RGBAFormat);
    };
    const toImage = (texture: THREE.DataTexture) => ({
      width: 2,
      height: 1,
      channels: 4,
      pixels: texture.image.data as Uint8Array,
    });
    const c0 = toImage(image([10, 20, 30]));
    const c1 = toImage(image([14, 18, 35]));
    const c2 = toImage(image([16, 24, 28]));
    const c3 = toImage(image([22, 26, 32]));
    const mask = { width: 2, height: 1, pixels: new Uint8Array([1, 0]) };
    expect(summarizeSignedAnatomyImageResponse(c0, c1, mask, 1)).toMatchObject({
      sampleCount: 1,
      perChannelMeanSignedDifference: [4, -2, 5],
      changedPixelCount: 1,
    });
    expect(summarizeAnatomyDifferenceOfResponses(c0, c1, c2, c3, mask, 1)).toMatchObject({
      sampleCount: 1,
      perChannelMeanSignedDifference: [2, 4, -1],
    });
    expect(summarizeAnatomyFactorialInteraction(c0, c1, c2, c3, mask, 1)).toMatchObject({
      sampleCount: 1,
      perChannelMeanSignedDifference: [2, 4, -1],
    });
    expect(() => summarizeSignedAnatomyImageResponse(c0, c1, { ...mask, pixels: new Uint8Array([0, 0]) }))
      .toThrow(/empty-anatomy-mask/);
  });
});
