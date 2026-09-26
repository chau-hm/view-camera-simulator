import { describe, expect, it, vi } from "vitest";
import { resolveRendererBackend } from "../../render/backend/rendererBackend";

describe("renderer backend identity", () => {
  it("classifies the current Three.js renderer by its backend marker", () => {
    expect(resolveRendererBackend({ isWebGLRenderer: true })).toBe("webgl");
  });

  it("does not classify unknown or inactive renderer implementations as WebGL", () => {
    expect(resolveRendererBackend({ isWebGLRenderer: false })).toBeNull();
    expect(resolveRendererBackend({ isWebGPURenderer: true })).toBeNull();
    expect(resolveRendererBackend(null)).toBeNull();
  });
});

describe("browser WebGL availability", () => {
  it("checks browser WebGL availability without inferring renderer identity", async () => {
    const { detectAvailableWebGLBackend } = await vi.importActual<
      typeof import("../../render/backend/rendererBackend")
    >("../../render/backend/rendererBackend");
    const canvas = {
      getContext: vi.fn((contextType: string) =>
        contextType === "webgl2" ? {} : null,
      ),
    };
    vi.stubGlobal("document", { createElement: vi.fn(() => canvas) });

    try {
      expect(detectAvailableWebGLBackend()).toBe("webgl");
      expect(canvas.getContext).toHaveBeenCalledWith("webgl2");
      expect(resolveRendererBackend({ isWebGLRenderer: false })).toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
