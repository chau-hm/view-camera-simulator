import { describe, expect, it } from "vitest";
import {
  evaluateGroundGlassA1Frame,
  type GroundGlassA1FrameEvidence,
} from "../e2e/helpers/groundGlassA1Frame";

function frame(): GroundGlassA1FrameEvidence {
  return {
    request: { requestId: "request-2", sceneId: "architecture-foreground", channelId: "default", rendererGeneration: "generation-1", subjectGeneration: 1 },
    completed: {
      requestId: "request-2", sceneId: "architecture-foreground", channelId: "default",
      rendererGeneration: "generation-1", subjectGeneration: 1, frameId: "frame-2",
      requiredOperations: "all-completed",
    },
    capture: {
      requestId: "request-2", rendererGeneration: "generation-1", subjectGeneration: 1,
      frameId: "frame-2", width: 2, height: 1, format: "rgba8",
      pixels: new Uint8Array([0, 0, 0, 255, 255, 255, 255, 255]),
    },
    preparation: {
      requestId: "request-2", rendererGeneration: "generation-1", subjectGeneration: 1, frameId: "frame-2",
      focalLengthMm: 150, apertureFNumber: 11, imageDistanceMm: 153, filmWidthMm: 127,
      filmHeightMm: 127, renderWidthPx: 655, renderHeightPx: 524,
    },
    executedPasses: ["sceneRender", "cocFootprint", "farGather", "nearGather", "composite", "display"],
  };
}

describe("A1 frame evidence comparator", () => {
  it("accepts a complete matching synthetic transaction", () => {
    expect(evaluateGroundGlassA1Frame(frame(), "processed")).toEqual([]);
  });

  it("rejects an earlier completed frame and mismatched captured generation", () => {
    const value = frame();
    value.request.requestId = "request-3";
    value.capture.subjectGeneration = 2;
    expect(evaluateGroundGlassA1Frame(value, "processed")).toEqual(
      expect.arrayContaining(["incomplete-current-frame", "capture-transaction-mismatch"]),
    );
  });

  it.each(["sceneId", "channelId"] as const)(
    "rejects a completed frame from a different %s",
    (key) => {
      const value = frame();
      if (!value.completed) throw new Error("Expected completed fixture");
      value.completed[key] = "different";
      expect(evaluateGroundGlassA1Frame(value, "processed")).toContain("incomplete-current-frame");
    },
  );

  it("rejects a capture from an older frame in the same renderer generation", () => {
    const value = frame();
    value.capture.frameId = "frame-1";
    expect(evaluateGroundGlassA1Frame(value, "processed")).toContain("capture-transaction-mismatch");
  });

  it("rejects missing, stale, nonfinite, missing-field and invalid preparation", () => {
    const value = frame();
    const valid = value.preparation!;
    for (const preparation of [
      null, { ...valid, requestId: "request-1" }, { ...valid, focalLengthMm: NaN },
      { ...valid, apertureFNumber: Infinity }, { ...valid, filmWidthMm: 0 },
      { ...valid, renderHeightPx: undefined }, { ...valid, frameId: "frame-1" },
    ]) {
      value.preparation = preparation as GroundGlassA1FrameEvidence["preparation"];
      expect(evaluateGroundGlassA1Frame(value, "processed")).toContain("invalid-current-preparation");
    }
  });

  it("rejects a consistently stale generation against the independent current generation", () => {
    const value = frame();
    value.request.rendererGeneration = "generation-2";
    value.request.subjectGeneration = 2;
    expect(evaluateGroundGlassA1Frame(value, "processed")).toEqual(
      expect.arrayContaining(["incomplete-current-frame", "invalid-current-preparation"]),
    );
  });

  it("rejects transparent nonuniform content", () => {
    const value = frame();
    value.capture.pixels = new Uint8Array([0, 0, 0, 0, 255, 255, 255, 0]);
    expect(evaluateGroundGlassA1Frame(value, "processed")).toContain("unexpected-alpha");
  });

  it("rejects malformed and uniform buffers", () => {
    const value = frame();
    value.capture.pixels = new Uint8Array(7);
    expect(evaluateGroundGlassA1Frame(value, "processed")).toContain("invalid-buffer");
    value.capture.pixels = new Uint8Array([5, 5, 5, 0, 5, 5, 5, 255]);
    expect(evaluateGroundGlassA1Frame(value, "processed")).toContain("uniform-buffer");
  });

  it("accepts bypass execution under its contract and rejects it as processed", () => {
    const value = frame();
    value.executedPasses = ["sceneRender", "composite", "display"];
    expect(evaluateGroundGlassA1Frame(value, "bypass")).toEqual([]);
    expect(evaluateGroundGlassA1Frame(value, "processed")).toContain("unexpected-pass-execution");
  });

  it("rejects missing completion and display execution", () => {
    const value = frame();
    value.completed = null;
    value.executedPasses = ["sceneRender"];
    expect(evaluateGroundGlassA1Frame(value, "bypass")).toEqual(
      expect.arrayContaining(["incomplete-current-frame", "capture-transaction-mismatch", "unexpected-pass-execution"]),
    );
  });
});

describe("A1 reference occupancy", () => {
  it("rejects blank, transparent and absent reference regions", async () => {
    const { evaluateA1ReferenceOccupancy } = await import("../e2e/helpers/groundGlassA1Frame");
    const pixels = new Uint8Array(32 * 32 * 4);
    for (let index = 3; index < pixels.length; index += 4) pixels[index] = 255;
    expect(evaluateA1ReferenceOccupancy(pixels)).toBe(false);
    for (let y = 27; y <= 29; y += 1) {
      for (let x = 27; x <= 29; x += 1) {
        const offset = (y * 32 + x) * 4;
        pixels.fill(120, offset, offset + 3);
      }
    }
    expect(evaluateA1ReferenceOccupancy(pixels)).toBe(true);
    pixels[(28 * 32 + 28) * 4 + 3] = 0;
    expect(evaluateA1ReferenceOccupancy(pixels)).toBe(false);
    expect(evaluateA1ReferenceOccupancy(new Uint8Array(1))).toBe(false);
  });
});
