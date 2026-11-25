import { describe, expect, it, vi } from "vitest";
import {
  GroundGlassCleanupEvidenceCoordinator,
  observeGroundGlassCanvasRetirement,
} from "../../render/groundGlassCleanupEvidence";

describe("Ground Glass cleanup evidence", () => {
  it("confirms only after owned resources and Canvas renderer retirement complete", () => {
    const completed = vi.fn();
    const coordinator = new GroundGlassCleanupEvidenceCoordinator(completed);
    let contextLost = false;
    const canvas = document.createElement("canvas");
    const renderer = {
      dispose: vi.fn(),
      forceContextLoss: vi.fn(() => {
        contextLost = true;
        canvas.dispatchEvent(new Event("webglcontextlost", { cancelable: true }));
      }),
      getContext: () => ({ isContextLost: () => contextLost }),
      domElement: canvas,
    };

    coordinator.acquired("rtt-targets");
    coordinator.acquired("scene-subject");
    coordinator.ownerCleanupCompleted("rtt-targets", "confirmed");
    observeGroundGlassCanvasRetirement(renderer, coordinator);
    expect(completed).not.toHaveBeenCalled();

    coordinator.ownerCleanupCompleted("scene-subject", "confirmed");
    expect(completed).not.toHaveBeenCalled();
    renderer.dispose();
    expect(completed).not.toHaveBeenCalled();
    renderer.forceContextLoss();

    expect(completed).toHaveBeenCalledTimes(1);
    expect(completed).toHaveBeenLastCalledWith("confirmed", undefined);
  });

  it("reports uncertain when Canvas retirement arrives before an acquired owner completes", () => {
    const completed = vi.fn();
    const coordinator = new GroundGlassCleanupEvidenceCoordinator(completed);
    coordinator.acquired("scene-subject");

    coordinator.rendererRetired("confirmed");
    expect(completed).toHaveBeenCalledTimes(1);
    expect(completed).toHaveBeenLastCalledWith(
      "uncertain",
      "scene-subject cleanup did not report completion before Canvas retirement",
    );
    coordinator.ownerCleanupCompleted("scene-subject", "confirmed");
    expect(completed).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["scene-subject", "subject dispose failed"],
    ["rtt-targets", "target dispose failed"],
  ] as const)("preserves %s disposal failures as failed cleanup evidence", (owner, reason) => {
    const completed = vi.fn();
    const coordinator = new GroundGlassCleanupEvidenceCoordinator(completed);
    coordinator.acquired(owner);
    coordinator.ownerCleanupCompleted(owner, "failed", reason);
    coordinator.rendererRetired("confirmed");

    expect(completed).toHaveBeenCalledTimes(1);
    expect(completed).toHaveBeenLastCalledWith("failed", reason);
  });

  it("keeps cleanup outcomes one-shot and failure-sticky", () => {
    const completed = vi.fn();
    const coordinator = new GroundGlassCleanupEvidenceCoordinator(completed);
    coordinator.acquired("rtt-targets");
    coordinator.ownerCleanupCompleted("rtt-targets", "failed", "first disposal error");
    coordinator.ownerCleanupCompleted("rtt-targets", "confirmed");
    coordinator.rendererRetired("confirmed");
    coordinator.rendererRetired("confirmed");
    coordinator.rendererRetired("failed", "late duplicate");

    expect(completed).toHaveBeenCalledTimes(1);
    expect(completed).toHaveBeenLastCalledWith("failed", "first disposal error");
  });

  it("reports failed when renderer disposal throws even if context loss follows", () => {
    const completed = vi.fn();
    const coordinator = new GroundGlassCleanupEvidenceCoordinator(completed);
    let contextLost = false;
    const canvas = document.createElement("canvas");
    const renderer = {
      dispose: vi.fn(() => { throw new Error("renderer dispose failed"); }),
      forceContextLoss: vi.fn(() => {
        contextLost = true;
        canvas.dispatchEvent(new Event("webglcontextlost", { cancelable: true }));
      }),
      getContext: () => ({ isContextLost: () => contextLost }),
      domElement: canvas,
    };
    observeGroundGlassCanvasRetirement(renderer, coordinator);

    expect(() => renderer.dispose()).toThrow("renderer dispose failed");
    renderer.forceContextLoss();
    expect(completed).toHaveBeenCalledTimes(1);
    expect(completed).toHaveBeenLastCalledWith("failed", "renderer dispose failed");
  });

  it("waits for asynchronous context-loss evidence after forceContextLoss returns", () => {
    const completed = vi.fn();
    const coordinator = new GroundGlassCleanupEvidenceCoordinator(completed);
    let contextLost = false;
    const canvas = document.createElement("canvas");
    const renderer = {
      dispose: vi.fn(),
      forceContextLoss: vi.fn(),
      getContext: () => ({ isContextLost: () => contextLost }),
      domElement: canvas,
    };
    observeGroundGlassCanvasRetirement(renderer, coordinator);

    renderer.dispose();
    renderer.forceContextLoss();
    expect(completed).not.toHaveBeenCalled();

    contextLost = true;
    canvas.dispatchEvent(new Event("webglcontextlost"));
    expect(completed).toHaveBeenCalledTimes(1);
    expect(completed).toHaveBeenLastCalledWith("confirmed", undefined);
  });

  it("reports uncertain when the Canvas renderer cannot request context loss", () => {
    const completed = vi.fn();
    const coordinator = new GroundGlassCleanupEvidenceCoordinator(completed);
    const renderer = {
      dispose: vi.fn(),
      getContext: () => ({ isContextLost: () => false }),
      domElement: document.createElement("canvas"),
    };
    observeGroundGlassCanvasRetirement(renderer, coordinator);

    renderer.dispose();

    expect(completed).toHaveBeenCalledTimes(1);
    expect(completed).toHaveBeenLastCalledWith(
      "uncertain",
      "Canvas renderer has no forceContextLoss operation",
    );
  });
});
