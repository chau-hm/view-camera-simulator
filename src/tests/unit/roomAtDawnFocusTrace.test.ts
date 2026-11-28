import { describe, expect, it } from "vitest";
// @ts-expect-error Experiment-only JavaScript trace.
import { createFocusTrace } from "../../../experiments/room-at-dawn/focus-trace.js";

describe("experiment focus trace", () => {
  it("snapshots inputs and frames, reports overflow, and stops recording", () => {
    let time = 10;
    const trace = createFocusTrace({ maxEntries: 2, now: () => time++, wallClock: () => "clock" });
    const state = { focusMm: 1200 };
    trace.record("commit", state);
    state.focusMm = 2000;
    trace.record("frame", { requestId: "r1" });
    trace.record("input", state);
    const saved = trace.stop();
    trace.record("frame", { requestId: "r2" });
    expect(saved.entries).toHaveLength(2);
    expect(saved.entries[0].payload.focusMm).toBe(1200);
    expect(saved.dropped).toBe(1);
    expect(trace.stop()).toEqual(saved);
    expect(saved.limitation).toContain("not proof of compositor presentation");
  });
  it("rejects an invalid bound", () => expect(() => createFocusTrace({ maxEntries: 0 })).toThrow());
  it("reports a non-cloneable diagnostic payload without interrupting rendering", () => {
    const trace = createFocusTrace();
    expect(() => trace.record("frame", { invalid: () => {} })).not.toThrow();
    expect(trace.stop().serializationErrors).toBe(1);
  });
});
