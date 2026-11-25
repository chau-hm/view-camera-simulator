import { describe, expect, it, vi } from "vitest";
import type { WebGLRenderTarget } from "three";
import { withGroundGlassFrameState } from "../../render/groundGlassFrameExecution";

const makeRenderer = (events: string[] = []) => {
  const previousTarget = { name: "previous" } as unknown as WebGLRenderTarget;
  let currentTarget: WebGLRenderTarget | null = previousTarget;
  const renderer = {
    getRenderTarget: vi.fn(() => {
      events.push("getRenderTarget");
      return currentTarget;
    }),
    setRenderTarget: vi.fn((target: WebGLRenderTarget | null) => {
      events.push(target === previousTarget ? "restoreTarget" : "switchTarget");
      currentTarget = target;
    }),
    setClearColor: vi.fn(() => {
      events.push("restoreClearColor");
    }),
  };

  return { renderer, previousTarget, events };
};

const captureFailure = (callback: () => void): unknown => {
  try {
    callback();
  } catch (error) {
    return error;
  }
  return undefined;
};

describe("withGroundGlassFrameState", () => {
  it("restores the normal end state after successful frame execution", () => {
    const events: string[] = [];
    const { renderer, previousTarget } = makeRenderer(events);
    const switchedTarget = { name: "frame" } as unknown as WebGLRenderTarget;
    const executeFrame = vi.fn(() => {
      events.push("executeFrame");
      renderer.setRenderTarget(switchedTarget);
    });
    const onFailure = vi.fn();

    expect(
      captureFailure(() =>
        withGroundGlassFrameState(renderer, 0x123456, executeFrame, onFailure),
      ),
    ).toBeUndefined();

    expect(events).toEqual([
      "getRenderTarget",
      "executeFrame",
      "switchTarget",
      "restoreTarget",
      "restoreClearColor",
    ]);
    expect(renderer.setRenderTarget).toHaveBeenLastCalledWith(previousTarget);
    expect(renderer.setClearColor).toHaveBeenCalledWith(0x123456, 1);
    expect(onFailure).not.toHaveBeenCalled();
  });

  it("restores both states and rethrows the frame error after execution fails", () => {
    const events: string[] = [];
    const { renderer, previousTarget } = makeRenderer(events);
    const switchedTarget = { name: "frame" } as unknown as WebGLRenderTarget;
    const frameError = new Error("frame failed");
    const executeFrame = vi.fn(() => {
      events.push("executeFrame");
      renderer.setRenderTarget(switchedTarget);
      throw frameError;
    });
    const onFailure = vi.fn((error: unknown) => events.push(error === frameError ? "reportFrameError" : "reportOtherError"));

    expect(
      captureFailure(() =>
        withGroundGlassFrameState(renderer, 0x123456, executeFrame, onFailure),
      ),
    ).toBe(frameError);
    expect(events).toEqual([
      "getRenderTarget",
      "executeFrame",
      "switchTarget",
      "restoreTarget",
      "restoreClearColor",
      "reportFrameError",
    ]);
    expect(renderer.setRenderTarget).toHaveBeenLastCalledWith(previousTarget);
    expect(renderer.setClearColor).toHaveBeenCalledWith(0x123456, 1);
    expect(onFailure).toHaveBeenCalledTimes(1);
    expect(onFailure).toHaveBeenCalledWith(frameError);
  });

  it("continues clear-color cleanup and reports a render-target restoration error", () => {
    const events: string[] = [];
    const { renderer } = makeRenderer(events);
    const restoreError = new Error("render-target restoration failed");
    renderer.setRenderTarget.mockImplementation((target) => {
      events.push(target ? "restoreTarget" : "setNullTarget");
      throw restoreError;
    });
    const onFailure = vi.fn((error: unknown) => events.push(error === restoreError ? "reportRestoreError" : "reportOtherError"));

    expect(
      captureFailure(() =>
        withGroundGlassFrameState(renderer, 0x123456, vi.fn(), onFailure),
      ),
    ).toBe(restoreError);
    expect(events).toEqual([
      "getRenderTarget",
      "restoreTarget",
      "restoreClearColor",
      "reportRestoreError",
    ]);
    expect(renderer.setClearColor).toHaveBeenCalledWith(0x123456, 1);
    expect(onFailure).toHaveBeenCalledTimes(1);
    expect(onFailure).toHaveBeenCalledWith(restoreError);
  });

  it("reports a clear-color restoration error after restoring the target", () => {
    const events: string[] = [];
    const { renderer, previousTarget } = makeRenderer(events);
    const clearError = new Error("clear-color restoration failed");
    renderer.setClearColor.mockImplementation(() => {
      events.push("restoreClearColor");
      throw clearError;
    });
    const onFailure = vi.fn((error: unknown) => events.push(error === clearError ? "reportClearError" : "reportOtherError"));

    expect(
      captureFailure(() =>
        withGroundGlassFrameState(renderer, 0x123456, vi.fn(), onFailure),
      ),
    ).toBe(clearError);
    expect(events).toEqual([
      "getRenderTarget",
      "restoreTarget",
      "restoreClearColor",
      "reportClearError",
    ]);
    expect(renderer.setRenderTarget).toHaveBeenCalledWith(previousTarget);
    expect(onFailure).toHaveBeenCalledTimes(1);
    expect(onFailure).toHaveBeenCalledWith(clearError);
  });

  it("keeps the frame error primary when both cleanup operations also fail", () => {
    const events: string[] = [];
    const { renderer } = makeRenderer(events);
    const frameError = new Error("frame failed");
    renderer.setRenderTarget.mockImplementation(() => {
      events.push("restoreTarget");
      throw new Error("target cleanup failed");
    });
    renderer.setClearColor.mockImplementation(() => {
      events.push("restoreClearColor");
      throw new Error("clear cleanup failed");
    });
    const executeFrame = vi.fn(() => {
      events.push("executeFrame");
      throw frameError;
    });
    const onFailure = vi.fn((error: unknown) => events.push(error === frameError ? "reportFrameError" : "reportOtherError"));

    expect(
      captureFailure(() =>
        withGroundGlassFrameState(renderer, 0x123456, executeFrame, onFailure),
      ),
    ).toBe(frameError);
    expect(events).toEqual([
      "getRenderTarget",
      "executeFrame",
      "restoreTarget",
      "restoreClearColor",
      "reportFrameError",
    ]);
    expect(onFailure).toHaveBeenCalledTimes(1);
    expect(onFailure).toHaveBeenCalledWith(frameError);
  });

  it("does not let a throwing failure callback mask the primary error", () => {
    const { renderer } = makeRenderer();
    const frameError = new Error("frame failed");
    const callbackError = new Error("diagnostic callback failed");
    const onFailure = vi.fn(() => {
      throw callbackError;
    });

    expect(
      captureFailure(() =>
        withGroundGlassFrameState(renderer, 0x123456, () => {
          throw frameError;
        }, onFailure),
      ),
    ).toBe(frameError);
    expect(onFailure).toHaveBeenCalledTimes(1);
    expect(onFailure).toHaveBeenCalledWith(frameError);
  });

  it("continues applicable cleanup when reading the previous target fails", () => {
    const events: string[] = [];
    const { renderer } = makeRenderer(events);
    const acquisitionError = new Error("render-target read failed");
    renderer.getRenderTarget.mockImplementation(() => {
      events.push("getRenderTarget");
      throw acquisitionError;
    });
    const executeFrame = vi.fn();
    const onFailure = vi.fn((error: unknown) => events.push(error === acquisitionError ? "reportAcquisitionError" : "reportOtherError"));

    expect(
      captureFailure(() =>
        withGroundGlassFrameState(renderer, 0x123456, executeFrame, onFailure),
      ),
    ).toBe(acquisitionError);
    expect(events).toEqual([
      "getRenderTarget",
      "restoreClearColor",
      "reportAcquisitionError",
    ]);
    expect(executeFrame).not.toHaveBeenCalled();
    expect(renderer.setRenderTarget).not.toHaveBeenCalled();
    expect(renderer.setClearColor).toHaveBeenCalledWith(0x123456, 1);
    expect(onFailure).toHaveBeenCalledTimes(1);
    expect(onFailure).toHaveBeenCalledWith(acquisitionError);
  });
});
