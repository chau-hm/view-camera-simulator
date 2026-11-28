import { describe, expect, it } from 'vitest';
// @ts-expect-error Development-only CommonJS capture helper.
import { summarizeFrameOrder } from '../../../experiments/room-at-dawn/focus-scrub-analysis.cjs';
const sample = (generationId: string, frameId: string, requestId: string, committedRequestId = requestId) => ({
  time: 1, committedFocusMm: 1200, request: {requestId: committedRequestId}, frame: { status: 'completed', generation: {generationId}, frameId, request: {requestId} },
});
describe('Focus scrub completion telemetry', () => {
  it('detects an older completed request after a newer one and ignores duplicate frames', () => {
    const a = sample('g1','f1','room-request-1');
    const result = summarizeFrameOrder([a,a,sample('g1','f2','room-request-3'),sample('g1','f3','room-request-2')]);
    expect(result.completions).toHaveLength(3);
    expect(result.regressions.map((x: {requestId: string}) => x.requestId)).toEqual(['room-request-2']);
  });
  it('distinguishes incomplete classification, renderer replacement, and a committed state ahead of a completion', () => {
    const result = summarizeFrameOrder([sample('g1','f1','room-request-10','room-request-11'), sample('g2','f1','room-request-1'),sample('g2','f2','unexpected')]);
    expect(result.regressions).toHaveLength(0);
    expect(result.unclassified).toHaveLength(2);
    expect(result.completions[0].committedRequestId).toBe('room-request-11');
    expect(result.completions[0].frameFocusMm).toBeNull();
  });
});
