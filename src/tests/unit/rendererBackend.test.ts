import { describe, expect, it } from "vitest";
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
