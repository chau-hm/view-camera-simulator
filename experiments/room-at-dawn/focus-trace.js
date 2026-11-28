/** Development-only event log; completed-frame reports are not compositor presentation. */
export function createFocusTrace({ maxEntries = 10000, now = () => performance.now(), wallClock = () => new Date().toISOString() } = {}) {
  if (!Number.isInteger(maxEntries) || maxEntries < 1) throw new Error("Focus trace needs a positive entry limit");
  const trace = { version: 1, startedAt: wallClock(), timeOrigin: now(), entries: [], dropped: 0, serializationErrors: 0, stoppedAt: null,
    limitation: "Frame completion is reported after the WebGL blit, not proof of compositor presentation. Attach a synchronized screen recording for visible behavior." };
  let active = true;
  return {
    record(kind, payload) {
      if (!active) return;
      if (trace.entries.length >= maxEntries) { trace.dropped++; return; }
      try {
        trace.entries.push({ kind, timeMs: now(), payload: structuredClone(payload) });
      } catch {
        // Diagnostic failure must not interrupt a photographic frame.
        trace.serializationErrors++;
      }
    },
    stop() { if (active) { active = false; trace.stoppedAt = wallClock(); } return structuredClone(trace); },
  };
}
