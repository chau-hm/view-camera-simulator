import { describe, expect, it } from "vitest";
import {
  resolveObserverCanvasInitialization,
  selectObserverBackend,
} from "../../render/backend/observerBackend";

describe("Observer backend selection policy", () => {
  it("selects the current WebGL backend when browser availability permits it", () => {
    expect(selectObserverBackend({ webglAvailable: true })).toEqual({
      status: "selected",
      backend: "webgl",
    });
  });

  it("fails closed when no supported Observer backend is available", () => {
    expect(selectObserverBackend({ webglAvailable: false })).toEqual({
      status: "unavailable",
      backend: null,
      reason: "no-supported-backend",
    });
  });
});

describe("Observer Canvas initialization boundary", () => {
  it("preserves the current WebGL antialias option at the R3F initialization seam", () => {
    expect(resolveObserverCanvasInitialization("webgl", true)).toEqual({
      backend: "webgl",
      canvasProps: { gl: { antialias: true } },
    });
  });
});
