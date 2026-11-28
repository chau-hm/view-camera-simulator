import { describe, expect, it } from "vitest";
import {
  bindRoomComparisonIntent,
  createRoomComparisonIntent,
  createRoomComparisonState,
  evaluateRoomComparisonFrame,
  listRoomComparisonStateChanges,
  roomComparisonIntentMatchesGuard,
} from "../../../experiments/room-at-dawn/comparison-capture";

const state = () => createRoomComparisonState({
  camera: { focalLengthMm: 150, focusDistanceMm: 1800, aperture: 5.6, frontTiltDeg: 0, frontSwingDeg: 0 },
  presetKey: "depth",
  subjectMode: "room",
  renderQuality: "high",
  rawDebug: false,
  previewMode: "upright",
  hdr: true,
  displayExposure: 18.1,
  reflectionsEnabled: true,
});

function boundCapture() {
  const snapshot = state();
  return bindRoomComparisonIntent(createRoomComparisonIntent("A", snapshot),
    { requestId: "request-7" }, { generationId: "generation-3" });
}

function current(snapshot = state()) {
  return {
    request: { requestId: "request-7" },
    generation: { generationId: "generation-3" },
    state: snapshot,
  };
}

function frame(overrides = {}) {
  return {
    status: "completed" as const,
    request: { requestId: "request-7" },
    generation: { generationId: "generation-3" },
    frameId: "generation-3:frame:12",
    requiredOperations: "all-completed",
    ...overrides,
  };
}

describe("Room-at-Dawn A/B frame capture contract", () => {
  it("accepts only the completed frame and published canonical state for the pending request", () => {
    const pending = boundCapture();
    expect(evaluateRoomComparisonFrame(pending, frame(), current(pending.state), current(pending.state))).toEqual({
      kind: "capture", reason: null, frameId: "generation-3:frame:12",
    });
  });

  it("ignores earlier frames and refuses a newer committed camera state", () => {
    const pending = boundCapture();
    expect(evaluateRoomComparisonFrame(pending, frame({ request: { requestId: "request-6" } }), current(), current()).kind)
      .toBe("ignore");
    expect(evaluateRoomComparisonFrame(pending, frame({ generation: { generationId: "generation-4" } }), current(), current()).kind)
      .toBe("ignore");
    const changed = createRoomComparisonState({
      ...state(), camera: { ...state().camera, focusDistanceMm: 1900 },
    });
    expect(evaluateRoomComparisonFrame(pending, frame(), current(changed), current(changed))).toMatchObject({
      kind: "reject", reason: "Camera or presentation settings changed before the frame completed",
    });
  });

  it("refuses failed, partial, or unpublished frame results", () => {
    const pending = boundCapture();
    expect(evaluateRoomComparisonFrame(pending, frame({ status: "failed", failureReason: "draw failed" }), current(), current()))
      .toMatchObject({ kind: "reject", reason: "draw failed" });
    expect(evaluateRoomComparisonFrame(pending, frame({ requiredOperations: "partial" }), current(), current()).kind)
      .toBe("reject");
    expect(evaluateRoomComparisonFrame(pending, frame(), current(), null)).toMatchObject({ kind: "ignore" });
  });

  it("lists every differing optical and presentation setting for saved A/B frames", () => {
    const a = state();
    const b = createRoomComparisonState({ ...a,
      camera: { ...a.camera, focusDistanceMm: 2400, frontTiltDeg: 3 },
      displayExposure: 20,
    });
    expect(listRoomComparisonStateChanges(a, b)).toEqual([
      { key: "camera.focusDistanceMm", label: "Focus", a: 1800, b: 2400 },
      { key: "camera.frontTiltDeg", label: "Front tilt", a: 0, b: 3 },
      { key: "displayExposure", label: "Display exposure", a: 18.1, b: 20 },
    ]);
  });

  it("only cancels a pending capture for its matching slot, request, and renderer generation", () => {
    const pending = boundCapture();
    expect(roomComparisonIntentMatchesGuard(pending, { slot: "A", generationId: "generation-3" })).toBe(true);
    expect(roomComparisonIntentMatchesGuard(pending, { slot: "B" })).toBe(false);
    expect(roomComparisonIntentMatchesGuard(pending, { requestId: "request-8" })).toBe(false);
    expect(roomComparisonIntentMatchesGuard(pending, { generationId: "generation-4" })).toBe(false);
    expect(roomComparisonIntentMatchesGuard(null, {})).toBe(false);
  });
});
