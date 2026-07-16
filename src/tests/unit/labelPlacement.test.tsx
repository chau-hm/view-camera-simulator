import { describe, it, expect } from 'vitest';
import {
  getApproximateSvgTextBounds,
  getGeometryGuideLabelPlacement,
  getLocalTargetLabelPlacement,
} from '../../components/geometry/labelPlacement';

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

describe('getGeometryGuideLabelPlacement', () => {
  const svgWidth = 240;
  const svgHeight = 160;
  const safeMargin = 8;

  it('interpolates a diagonal guide away from its midpoint and stays inside the SVG', () => {
    const placement = getGeometryGuideLabelPlacement({
      start: { x: 20, y: 130 },
      end: { x: 220, y: 30 },
      positionT: 0.72,
      offsetPx: { x: 0, y: -20 },
      text: 'Diagonal subject plane',
      svgWidth,
      svgHeight,
      safeMargin,
    });
    const midpoint = { x: 120, y: 80 };
    expect(placement.positionT).toBe(0.72);
    expect(placement.x).not.toBe(midpoint.x);
    expect(placement.y).not.toBe(midpoint.y);
    expect([placement.x, placement.y].every(Number.isFinite)).toBe(true);
    const bounds = getApproximateSvgTextBounds({
      ...placement,
      text: 'Diagonal subject plane',
    });
    expect(bounds.left).toBeGreaterThanOrEqual(safeMargin);
    expect(bounds.top).toBeGreaterThanOrEqual(safeMargin);
    expect(bounds.right).toBeLessThanOrEqual(svgWidth - safeMargin);
    expect(bounds.bottom).toBeLessThanOrEqual(svgHeight - safeMargin);
  });

  it('applies positive and negative offsets to a vertical guide', () => {
    const base = {
      start: { x: 100, y: 20 },
      end: { x: 100, y: 140 },
      positionT: 0.5,
      text: 'Guide',
      svgWidth,
      svgHeight,
      safeMargin,
    };
    const negative = getGeometryGuideLabelPlacement({
      ...base,
      offsetPx: { x: -12, y: -8 },
    });
    const positive = getGeometryGuideLabelPlacement({
      ...base,
      offsetPx: { x: 12, y: 8 },
    });
    expect(negative.x).toBeLessThan(positive.x);
    expect(negative.y).toBeLessThan(positive.y);
  });

  it.each(['start', 'middle', 'end'] as const)('keeps the %s anchor inside bounds', (anchor) => {
    const placement = getGeometryGuideLabelPlacement({
      start: { x: 0, y: 40 },
      end: { x: 240, y: 40 },
      positionT: anchor === 'start' ? 0 : anchor === 'end' ? 1 : 0.5,
      anchor,
      text: 'Guide label',
      svgWidth,
      svgHeight,
      safeMargin,
    });
    const bounds = getApproximateSvgTextBounds({ ...placement, text: 'Guide label' });
    expect(bounds.left).toBeGreaterThanOrEqual(safeMargin);
    expect(bounds.right).toBeLessThanOrEqual(svgWidth - safeMargin);
  });

  it('clamps out-of-range positions and rejects non-finite input', () => {
    const input = {
      start: { x: 20, y: 20 },
      end: { x: 220, y: 140 },
      text: 'Guide',
      svgWidth,
      svgHeight,
      safeMargin,
    };
    expect(getGeometryGuideLabelPlacement({ ...input, positionT: -1 }).positionT).toBe(0);
    expect(getGeometryGuideLabelPlacement({ ...input, positionT: 2 }).positionT).toBe(1);
    expect(() =>
      getGeometryGuideLabelPlacement({ ...input, positionT: Number.NaN }),
    ).toThrow(/finite values/);
  });
});
