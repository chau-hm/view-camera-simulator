/** Classify reported completed-frame order, not physical compositor presentation.
 * Frame ids repeat in rAF samples; inspect each generation/frame pair once. */
function summarizeFrameOrder(samples) {
  const seen = new Set(), completions = [], regressions = [], unclassified = [];
  const maxByGeneration = new Map(), requestFocus = new Map();
  for (const sample of samples) {
    if (sample?.request?.requestId && Number.isFinite(sample.committedFocusMm))
      requestFocus.set(sample.request.requestId, sample.committedFocusMm);
  }
  for (const sample of samples) {
    const frame = sample?.frame;
    if (frame?.status !== 'completed' || !frame.frameId) continue;
    const generationId = frame.generation?.generationId;
    const key = `${generationId}/${frame.frameId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const requestId = frame.request?.requestId;
    const match = typeof requestId === 'string' && /^room-request-(\d+)$/.exec(requestId);
    const entry = { time: sample.time, frameId: frame.frameId, generationId, requestId,
      requestSequence: match ? Number(match[1]) : null,
      frameFocusMm: requestFocus.get(requestId) ?? null,
      committedRequestId: sample.request?.requestId, committedFocusMm: sample.committedFocusMm };
    completions.push(entry);
    if (!generationId || !match) { unclassified.push(entry); continue; }
    if (entry.frameFocusMm === null) unclassified.push({ ...entry, reason: 'no sampled committed focus for completed request' });
    const highest = maxByGeneration.get(generationId);
    if (highest !== undefined && entry.requestSequence < highest) regressions.push(entry);
    maxByGeneration.set(generationId, Math.max(highest ?? -1, entry.requestSequence));
  }
  return {completions, regressions, unclassified,
    interpretation: 'Reported completion order only; rAF telemetry is not compositor presentation evidence.'};
}
module.exports = { summarizeFrameOrder };
