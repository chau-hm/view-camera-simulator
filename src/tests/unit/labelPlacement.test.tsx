import { describe, it, expect } from 'vitest';
import { getLocalTargetLabelPlacement } from '../../components/geometry/labelPlacement';

describe('getLocalTargetLabelPlacement', () => {
  const svgWidth = 200;
  const svgHeight = 120;
  const safeMargin = 8;

  it('normal: right + above', () => {
    const res = getLocalTargetLabelPlacement({ targetX: 80, targetY: 60, text: 'Target', svgWidth, svgHeight, safeMargin });
    const approxW = Math.min(132, 'Target'.length * 6.5);
    // anchor start, x should be >= safeMargin and x+approxW <= svgWidth - safeMargin
    expect(res.anchor).toBe('start');
    expect(res.x).toBeGreaterThanOrEqual(safeMargin);
    expect(res.x + approxW).toBeLessThanOrEqual(svgWidth - safeMargin);
    expect(res.y).toBeGreaterThanOrEqual(safeMargin);
    expect(res.y).toBeLessThanOrEqual(svgHeight - safeMargin);
  });

  it('near right edge: left + above', () => {
    const res = getLocalTargetLabelPlacement({ targetX: 190 - safeMargin, targetY: 60, text: 'TargetEdge', svgWidth, svgHeight, safeMargin });
    const approxW = Math.min(132, 'TargetEdge'.length * 6.5);
    expect(res.anchor).toBe('end');
    // rendered left = x - approxW, right = x
    expect(res.x - approxW).toBeGreaterThanOrEqual(safeMargin);
    expect(res.x).toBeLessThanOrEqual(svgWidth - safeMargin);
    expect(res.y).toBeGreaterThanOrEqual(safeMargin);
  });

  it('near top edge: right + below', () => {
    const res = getLocalTargetLabelPlacement({ targetX: 80, targetY: 5 + safeMargin, text: 'Top', svgWidth, svgHeight, safeMargin });
    const approxW = Math.min(132, 'Top'.length * 6.5);
    expect(res.anchor).toBe('start');
    expect(res.y).toBeGreaterThanOrEqual(safeMargin);
    expect(res.y + 12).toBeLessThanOrEqual(svgHeight - safeMargin);
    expect(res.x + approxW).toBeLessThanOrEqual(svgWidth - safeMargin);
  });

  it('near right+top edge: left + below', () => {
    const res = getLocalTargetLabelPlacement({ targetX: svgWidth - 4, targetY: 2, text: 'RTop', svgWidth, svgHeight, safeMargin });
    const approxW = Math.min(132, 'RTop'.length * 6.5);
    expect(res.anchor).toBe('end');
    expect(res.x - approxW).toBeGreaterThanOrEqual(safeMargin);
    expect(res.y).toBeGreaterThanOrEqual(safeMargin);
    expect(res.y).toBeLessThanOrEqual(svgHeight - safeMargin);
  });

  it('near bottom edge: prefers above or clamps', () => {
    const res = getLocalTargetLabelPlacement({ targetX: 100, targetY: svgHeight - 2, text: 'BottomLongText', svgWidth, svgHeight, safeMargin });
    const approxW = Math.min(132, 'BottomLongText'.length * 6.5);
    // ensure rendered bounds within margins
    const left = res.anchor === 'start' ? res.x : res.x - approxW;
    const right = res.anchor === 'start' ? res.x + approxW : res.x;
    expect(left).toBeGreaterThanOrEqual(safeMargin);
    expect(right).toBeLessThanOrEqual(svgWidth - safeMargin);
    expect(res.y).toBeGreaterThanOrEqual(safeMargin);
    expect(res.y).toBeLessThanOrEqual(svgHeight - safeMargin);
  });
});
