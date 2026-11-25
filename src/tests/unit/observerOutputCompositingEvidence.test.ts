import { describe, expect, it } from "vitest";
import {
  compareRepeatCaptureEvidence,
  getCaptureStorageKey,
  storeCaptureWithoutReplacement,
  type RepeatCaptureEvidence,
} from "../benchmarks/observerOutputCompositingEvidence";

const fullImageRegion = { left: 0, top: 0, right: 2, bottom: 2 };

const pixelBuffer = (changedLastPixel = false): Buffer => Buffer.from([
  10, 20, 30,
  10, 20, 30,
  10, 20, 30,
  changedLastPixel ? 90 : 10, 20, 30,
]);

const makeCapture = (
  captureId: string,
  pixels = pixelBuffer(),
): RepeatCaptureEvidence => ({
  captureId,
  rendererVariant: "webgpu-material-aware",
  rendererFamily: "webgpu-renderer",
  executionBackend: "webgpu",
  rendererAlpha: "true",
  toneMapping: "0",
  outputColorSpace: "srgb-linear",
  initializationAttempts: 1,
  applicationFallback: "none",
  initializationFailure: "none",
  background: "light",
  overlay: "overlap",
  view: "front",
  viewport: { width: 1280, height: 720 },
  devicePixelRatio: 1,
  canvas: { width: 2, height: 2 },
  decoded: { width: 2, height: 2, channels: 3, pixels },
});

describe("Observer output compositing repeat-capture evidence", () => {
  it("reports a nonzero difference for independently captured images with a changed region", () => {
    const original = makeCapture("capture-1");
    const repeated = makeCapture("capture-2", pixelBuffer(true));

    const difference = compareRepeatCaptureEvidence(original, repeated, fullImageRegion);

    expect(difference.meanAbsoluteRgbDifference).toBeGreaterThan(0);
    expect(difference.changedPixelCount).toBeGreaterThan(0);
    expect(difference.changedPixelFraction).toBeGreaterThan(0);
  });

  it("reports zero only for separately allocated, pixel-identical captures", () => {
    const original = makeCapture("capture-1", pixelBuffer());
    const repeated = makeCapture("capture-2", pixelBuffer());

    expect(compareRepeatCaptureEvidence(original, repeated, fullImageRegion)).toEqual({
      meanAbsoluteRgbDifference: 0,
      changedPixelCount: 0,
      changedPixelFraction: 0,
      meanSignedLuminanceDifference: 0,
    });
    expect(original.decoded.pixels).not.toBe(repeated.decoded.pixels);
  });

  it("stores repeat captures separately and refuses to replace the canonical image", () => {
    const canonicalKey = "webgpu-material-aware/light/overlap/front";
    const original = makeCapture("capture-1");
    const repeated = makeCapture("capture-2", pixelBuffer(true));
    const repeatKey = getCaptureStorageKey(canonicalKey, { kind: "repeat", captureId: repeated.captureId });
    const captures = new Map<string, RepeatCaptureEvidence>();

    storeCaptureWithoutReplacement(captures, getCaptureStorageKey(canonicalKey, { kind: "canonical" }), original);
    storeCaptureWithoutReplacement(captures, repeatKey, repeated);

    expect(repeatKey).not.toBe(canonicalKey);
    expect(captures.get(canonicalKey)).toBe(original);
    expect(captures.get(repeatKey)).toBe(repeated);
    expect(() => storeCaptureWithoutReplacement(captures, canonicalKey, repeated)).toThrow(/already exists/);
    expect(captures.get(canonicalKey)).toBe(original);
  });

  it("rejects missing, incompatible, or empty-region repeat evidence", () => {
    const original = makeCapture("capture-1");
    const repeated = makeCapture("capture-2");

    expect(() => compareRepeatCaptureEvidence(undefined, repeated, fullImageRegion)).toThrow(/original.*missing/i);
    expect(() => compareRepeatCaptureEvidence(original, null, fullImageRegion)).toThrow(/repeated.*missing/i);
    expect(() => compareRepeatCaptureEvidence(
      original,
      {
        ...repeated,
        decoded: {
          ...repeated.decoded,
          width: 1,
          pixels: Buffer.alloc(1 * 2 * repeated.decoded.channels),
        },
      },
      fullImageRegion,
    )).toThrow(/different dimensions/);
    expect(() => compareRepeatCaptureEvidence(
      original,
      { ...repeated, view: "oblique" },
      fullImageRegion,
    )).toThrow(/camera view changed/);
    expect(() => compareRepeatCaptureEvidence(
      original,
      repeated,
      { left: 0, top: 0, right: 0, bottom: 0 },
    )).toThrow(/region is empty/);
  });

  it("rejects reusing the same capture identity or pixel buffer", () => {
    const original = makeCapture("capture-1");
    const anotherRecordWithSameId = makeCapture("capture-1", pixelBuffer());
    const samePixelBuffer = makeCapture("capture-2", original.decoded.pixels);

    expect(() => compareRepeatCaptureEvidence(original, anotherRecordWithSameId, fullImageRegion))
      .toThrow(/independently captured/);
    expect(() => compareRepeatCaptureEvidence(original, samePixelBuffer, fullImageRegion))
      .toThrow(/independently captured/);
  });
});
