import { describe, expect, it } from "vitest";
import {
  compareAnatomyNativeFramebufferSignedDifferences,
  compareAnatomyNativeFramebuffers,
  mapAnatomyScreenshotPixelsToFramebuffer,
  normalizeAnatomyNativeFramebufferRgba,
  type AnatomyNativeFramebufferMetadata,
} from "../../render/backend/anatomyNativeFramebufferParity";

const metadata = (overrides: Partial<AnatomyNativeFramebufferMetadata> = {}): AnatomyNativeFramebufferMetadata => ({
  width: 2,
  height: 1,
  format: "bgra8unorm",
  channelOrder: "RGBA",
  rowOrder: "top-down",
  colorRepresentation: "raw native 8-bit normalized attachment bytes",
  sampleCount: 4,
  resolveTarget: true,
  depthFormat: "depth24plus",
  rendererFamily: "webgpu-renderer",
  executionBackend: "webgpu",
  outputColorSpace: "srgb-linear",
  toneMapping: 0,
  outputPolicy: "material-aware",
  sceneId: "view-camera-anatomy",
  teachingState: "Front Standard highlighted; Bellows dimmed",
  anatomyPresentation: { highlightedPart: "front-standard" },
  cameraPosition: [1, 2, 3],
  cameraQuaternion: [0, 0, 0, 1],
  cameraMatrixWorld: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 1, 2, 3, 1],
  devicePixelRatio: 1,
  viewportWidth: 514,
  viewportHeight: 411,
  ...overrides,
});

describe("native framebuffer parity normalization", () => {
  it("normalizes BGRA rows, removes 256-byte padding, and retains top-down orientation", () => {
    const padded = new Uint8Array(264);
    padded.set([3, 2, 1, 4, 7, 6, 5, 8], 0);
    padded.set([11, 10, 9, 12, 15, 14, 13, 16], 256);
    expect(normalizeAnatomyNativeFramebufferRgba(padded, 2, 2, "bgra8unorm")).toEqual(new Uint8Array([
      1, 2, 3, 4, 5, 6, 7, 8,
      9, 10, 11, 12, 13, 14, 15, 16,
    ]));
  });

  it("preserves RGBA channels for an asymmetric known pattern", () => {
    expect(normalizeAnatomyNativeFramebufferRgba(
      new Uint8Array([1, 20, 3, 40, 50, 6, 70, 8]),
      2,
      1,
      "rgba8unorm",
    )).toEqual(new Uint8Array([1, 20, 3, 40, 50, 6, 70, 8]));
  });
});

describe("native framebuffer raw comparison", () => {
  it("reports stable signed RGBA pixel differences and rejects incompatible metadata", () => {
    const first = { metadata: metadata(), rgba: new Uint8Array([100, 20, 30, 255, 10, 20, 30, 40]) };
    const second = { metadata: metadata(), rgba: new Uint8Array([99, 20, 30, 255, 10, 21, 30, 40]) };
    const result = compareAnatomyNativeFramebufferSignedDifferences(first, second);
    expect(result).toEqual({
      compatible: true,
      mismatches: [],
      changedPixels: [
        { index: 0, x: 0, y: 0, first: [100, 20, 30, 255], second: [99, 20, 30, 255], signedDelta: [-1, 0, 0, 0] },
        { index: 1, x: 1, y: 0, first: [10, 20, 30, 40], second: [10, 21, 30, 40], signedDelta: [0, 1, 0, 0] },
      ],
    });
    expect(compareAnatomyNativeFramebufferSignedDifferences(
      first,
      { metadata: metadata({ sampleCount: 1, resolveTarget: false }), rgba: second.rgba },
    )).toMatchObject({ compatible: false, mismatches: ["sampleCount", "resolveTarget"], changedPixels: [] });
  });

  it("reports RGBA, alpha, changed-pixel, exact-match, maxima, and per-channel distributions", () => {
    const result = compareAnatomyNativeFramebuffers(
      { metadata: metadata(), rgba: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]) },
      { metadata: metadata(), rgba: new Uint8Array([1, 2, 4, 6, 5, 6, 7, 8]) },
      { bellows: [0, 1] },
      [0],
    );
    expect(result.compatible).toBe(true);
    expect(result.fullFrame).toMatchObject({
      comparedPixelCount: 2,
      meanAbsoluteRgbError: 1 / 6,
      meanAbsoluteAlphaError: 1,
      maxAbsoluteError: 2,
      maxAbsoluteErrorByChannel: { red: 0, green: 0, blue: 1, alpha: 2 },
      changedPixelCount: 1,
      changedPixelPercentage: 50,
      exactRgbaMatchPixelCount: 1,
      meanAbsoluteErrorByChannel: { red: 0, green: 0, blue: 0.5, alpha: 1 },
      absoluteErrorHistogramByChannel: {
        red: { "0": 2 },
        green: { "0": 2 },
        blue: { "0": 1, "1": 1 },
        alpha: { "0": 1, "2": 1 },
      },
    });
    expect(result.regions?.bellows?.changedPixelCount).toBe(1);
    expect(result.fixedSamples?.[0]).toMatchObject({ index: 0, x: 0, y: 0, exactMatch: false, absoluteError: [0, 0, 1, 2] });
  });

  it("detects a deliberate synthetic color or alpha perturbation", () => {
    const baseline = { metadata: metadata(), rgba: new Uint8Array([10, 20, 30, 40, 50, 60, 70, 80]) };
    const perturbed = { metadata: metadata(), rgba: new Uint8Array([10, 20, 30, 41, 50, 61, 70, 80]) };
    const result = compareAnatomyNativeFramebuffers(baseline, perturbed, { fullFixture: [0, 1] }, [0, 1]);
    expect(result.compatible).toBe(true);
    expect(result.fullFrame?.changedPixelCount).toBe(2);
    expect(result.fullFrame?.meanAbsoluteAlphaError).toBe(0.5);
    expect(result.fullFrame?.maxAbsoluteError).toBe(1);
  });

  it.each([
    ["width", { width: 3 }],
    ["height", { height: 2 }],
    ["format", { format: "rgba8unorm" }],
    ["rowOrder", { rowOrder: "bottom-up" }],
    ["colorRepresentation", { colorRepresentation: "linear working color" }],
    ["sampleCount", { sampleCount: 1, resolveTarget: false }],
    ["depthFormat", { depthFormat: "depth32float" }],
    ["outputColorSpace", { outputColorSpace: "srgb" }],
    ["outputPolicy", { outputPolicy: "standard" }],
    ["sceneId", { sceneId: "other-scene" }],
    ["teachingState", { teachingState: "Bellows highlighted" }],
    ["cameraPosition", { cameraPosition: [1, 2, 4] }],
  ] as const)("rejects incompatible %s metadata", (field, overrides) => {
    const changedMetadata = metadata(overrides);
    const result = compareAnatomyNativeFramebuffers(
      { metadata: metadata(), rgba: new Uint8Array(8) },
      { metadata: changedMetadata, rgba: new Uint8Array(changedMetadata.width * changedMetadata.height * 4) },
      {},
      [],
    );
    expect(result.compatible).toBe(false);
    expect(result.mismatches).toContain(field);
  });

  it("rejects incomplete pixels, out-of-range masks, and missing baseline bytes", () => {
    const good = { metadata: metadata(), rgba: new Uint8Array(8) };
    expect(compareAnatomyNativeFramebuffers(
      { ...good, rgba: new Uint8Array(7) }, good, {}, [],
    ).mismatches).toContain("firstRGBAByteLength");
    expect(compareAnatomyNativeFramebuffers(good, good, { invalid: [2] }, []).mismatches)
      .toEqual(["region:invalid:pixel-index-out-of-range"]);
    expect(compareAnatomyNativeFramebuffers(good, good, {}, [2]).mismatches)
      .toEqual(["fixedSampleIndexOutOfRange"]);
    expect(() => normalizeAnatomyNativeFramebufferRgba(new Uint8Array(7), 2, 1, "bgra8unorm"))
      .toThrow(/truncated|expected/);
  });
});

describe("native framebuffer region coordinate mapping", () => {
  it("maps screenshot mask positions to explicit backing-framebuffer pixel centers", () => {
    expect(mapAnatomyScreenshotPixelsToFramebuffer([0, 1, 2, 3], 2, 2, 4, 4)).toMatchObject({
      indices: [5, 7, 13, 15],
      sourcePixelCount: 4,
      uniqueMappedPixelCount: 4,
    });
  });

  it("rejects invalid dimensions and screenshot indices", () => {
    expect(() => mapAnatomyScreenshotPixelsToFramebuffer([0], 0, 1, 1, 1)).toThrow(/dimensions/);
    expect(() => mapAnatomyScreenshotPixelsToFramebuffer([4], 2, 2, 4, 4)).toThrow(/outside/);
  });
});
