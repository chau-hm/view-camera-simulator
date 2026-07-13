import { render, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { GroundGlassStage } from "../../render/GroundGlassStage";

afterEach(() => cleanup());

const RECT = {
  left: 100,
  top: 50,
  width: 500,
  height: 400,
  right: 600,
  bottom: 450,
  x: 100,
  y: 50,
  toJSON: () => {},
};

function parseTransform(transform: string) {
  const m = /translate3d\(([-0-9.]+)px,\s*([-0-9.]+)px,\s*0\)\s*scale\(([-0-9.]+)\)/.exec(transform);
  if (!m) return null;
  return { x: parseFloat(m[1]), y: parseFloat(m[2]), scale: parseFloat(m[3]) };
}

describe("GroundGlassStage zoom anchoring and pan state", () => {
  // Controlled harness to toggle zoom state
  const ControlledGroundGlassStage = () => {
    const [zoomed, setZoomed] = useState(false);
    return (
      <GroundGlassStage
        zoomEnabled={zoomed}
        onToggleZoom={() => setZoomed((s) => !s)}
        imageLayer={<div data-testid="image-content" />}
        fixedOverlayLayer={<div data-testid="overlay" />}
      />
    );
  };

  it('center click zooms in centered', () => {
    const { getByRole, getByTestId } = render(<ControlledGroundGlassStage />);
    const stage = getByRole('button');
    // mock geometry
    Object.defineProperty(stage, 'getBoundingClientRect', { value: () => RECT });

    const img = getByTestId('image-content');

    // click at center
    const cx = RECT.left + RECT.width / 2;
    const cy = RECT.top + RECT.height / 2;

    fireEvent.pointerDown(stage, { pointerId: 1, button: 0, clientX: cx, clientY: cy });
    fireEvent.pointerUp(stage, { pointerId: 1, button: 0, clientX: cx, clientY: cy });
    fireEvent.click(stage, { clientX: cx, clientY: cy, detail: 1 });

    // now zoomed
    expect(stage.getAttribute('data-zoomed')).toBe('true');
    const transformed = img.parentElement as HTMLElement;
    const parsed = parseTransform(transformed.style.transform || '');
    expect(parsed).not.toBeNull();
    expect(parsed!.scale).toBeCloseTo(1.9, 6);
    // centered => translation approximately zero
    expect(parsed!.x).toBeCloseTo(0, 1);
    expect(parsed!.y).toBeCloseTo(0, 1);
  });

  it('off-center clicks produce anchored pan and are clamped', () => {
    const { getByRole, getByTestId } = render(<ControlledGroundGlassStage />);
    const stage = getByRole('button');
    Object.defineProperty(stage, 'getBoundingClientRect', { value: () => RECT });
    const img = getByTestId('image-content');

    const leftX = RECT.left + RECT.width * 0.25;
    const topY = RECT.top + RECT.height * 0.25;

    // left-top click
    fireEvent.pointerDown(stage, { pointerId: 2, button: 0, clientX: leftX, clientY: topY });
    fireEvent.pointerUp(stage, { pointerId: 2, button: 0, clientX: leftX, clientY: topY });
    fireEvent.click(stage, { clientX: leftX, clientY: topY, detail: 1 });

    expect(stage.getAttribute('data-zoomed')).toBe('true');
    const parsed1 = parseTransform(img.parentElement!.style.transform || '');
    expect(parsed1).not.toBeNull();
    // click left of center => positive pan.x
    expect(parsed1!.x).toBeGreaterThan(0);
    // click above center => positive pan.y
    expect(parsed1!.y).toBeGreaterThan(0);

    // reset by zooming out
    fireEvent.pointerDown(stage, { pointerId: 3, button: 0, clientX: RECT.left + 10, clientY: RECT.top + 10 });
    fireEvent.pointerUp(stage, { pointerId: 3, button: 0, clientX: RECT.left + 10, clientY: RECT.top + 10 });
    fireEvent.click(stage, { clientX: RECT.left + 10, clientY: RECT.top + 10, detail: 1 });
    expect(stage.getAttribute('data-zoomed')).toBe('false');

    // right-bottom click
    const rightX = RECT.left + RECT.width * 0.75;
    const bottomY = RECT.top + RECT.height * 0.75;
    fireEvent.pointerDown(stage, { pointerId: 4, button: 0, clientX: rightX, clientY: bottomY });
    fireEvent.pointerUp(stage, { pointerId: 4, button: 0, clientX: rightX, clientY: bottomY });
    fireEvent.click(stage, { clientX: rightX, clientY: bottomY, detail: 1 });
    expect(stage.getAttribute('data-zoomed')).toBe('true');
    const parsed2 = parseTransform(img.parentElement!.style.transform || '');
    expect(parsed2).not.toBeNull();
    expect(parsed2!.x).toBeLessThan(0);
    expect(parsed2!.y).toBeLessThan(0);

    // extreme click clamp test: ensure we are unzoomed first, then click far beyond right-bottom
    // zoom out first
    fireEvent.pointerDown(stage, { pointerId: 5, button: 0, clientX: RECT.left + 10, clientY: RECT.top + 10 });
    fireEvent.pointerUp(stage, { pointerId: 5, button: 0, clientX: RECT.left + 10, clientY: RECT.top + 10 });
    fireEvent.click(stage, { clientX: RECT.left + 10, clientY: RECT.top + 10, detail: 1 });
    expect(stage.getAttribute('data-zoomed')).toBe('false');

    // now click extremely far beyond corner to test clamping
    fireEvent.pointerDown(stage, { pointerId: 6, button: 0, clientX: RECT.left + RECT.width * 10, clientY: RECT.top + RECT.height * 10 });
    fireEvent.pointerUp(stage, { pointerId: 6, button: 0, clientX: RECT.left + RECT.width * 10, clientY: RECT.top + RECT.height * 10 });
    fireEvent.click(stage, { clientX: RECT.left + RECT.width * 10, clientY: RECT.top + RECT.height * 10, detail: 1 });
    expect(stage.getAttribute('data-zoomed')).toBe('true');
    const parsed3 = parseTransform(img.parentElement!.style.transform || '');
    expect(parsed3).not.toBeNull();
    const maxPanX = (RECT.width * (1.9 - 1)) / 2;
    const maxPanY = (RECT.height * (1.9 - 1)) / 2;
    expect(Math.abs(parsed3!.x)).toBeLessThanOrEqual(maxPanX + 0.1);
    expect(Math.abs(parsed3!.y)).toBeLessThanOrEqual(maxPanY + 0.1);
  });

  it('zooming out after anchored zoom and pan returns directly to centered transform', () => {
    const { getByRole, getByTestId } = render(<ControlledGroundGlassStage />);
    const stage = getByRole('button');
    Object.defineProperty(stage, 'getBoundingClientRect', { value: () => RECT });
    const img = getByTestId('image-content');

    const clickX = RECT.left + RECT.width * 0.2;
    const clickY = RECT.top + RECT.height * 0.2;

    // zoom in anchored
    fireEvent.pointerDown(stage, { pointerId: 10, button: 0, clientX: clickX, clientY: clickY });
    fireEvent.pointerUp(stage, { pointerId: 10, button: 0, clientX: clickX, clientY: clickY });
    fireEvent.click(stage, { clientX: clickX, clientY: clickY, detail: 1 });

    expect(stage.getAttribute('data-zoomed')).toBe('true');
    const parsedIn = parseTransform(img.parentElement!.style.transform || '');
    expect(parsedIn!.scale).toBeCloseTo(1.9, 6);
    expect(parsedIn!.x).not.toBeCloseTo(0, 1);

    // drag to change pan
    fireEvent.pointerDown(stage, { pointerId: 11, button: 0, clientX: RECT.left + 250, clientY: RECT.top + 200 });
    fireEvent.pointerMove(stage, { pointerId: 11, button: 0, clientX: RECT.left + 300, clientY: RECT.top + 240 });
    fireEvent.pointerUp(stage, { pointerId: 11, button: 0, clientX: RECT.left + 300, clientY: RECT.top + 240 });

    const parsedAfterDrag = parseTransform(img.parentElement!.style.transform || '');
    expect(parsedAfterDrag!.x).not.toBe(parsedIn!.x);

    // click to zoom out
    fireEvent.pointerDown(stage, { pointerId: 12, button: 0, clientX: RECT.left + 10, clientY: RECT.top + 10 });
    fireEvent.pointerUp(stage, { pointerId: 12, button: 0, clientX: RECT.left + 10, clientY: RECT.top + 10 });
    fireEvent.click(stage, { clientX: RECT.left + 10, clientY: RECT.top + 10, detail: 1 });

    // should immediately show centered unzoomed transform
    expect(stage.getAttribute('data-zoomed')).toBe('false');
    const parsedOut = parseTransform(img.parentElement!.style.transform || '');
    expect(parsedOut).not.toBeNull();
    expect(parsedOut!.scale).toBeCloseTo(1, 6);
    expect(parsedOut!.x).toBeCloseTo(0, 1);
    expect(parsedOut!.y).toBeCloseTo(0, 1);
  });

  it('can zoom in immediately after zooming out (no lost clicks)', () => {
    const { getByRole, getByTestId } = render(<ControlledGroundGlassStage />);
    const stage = getByRole('button');
    Object.defineProperty(stage, 'getBoundingClientRect', { value: () => RECT });
    const img = getByTestId('image-content');

    // zoom in centered
    fireEvent.pointerDown(stage, { pointerId: 20, button: 0, clientX: RECT.left + 10, clientY: RECT.top + 10 });
    fireEvent.pointerUp(stage, { pointerId: 20, button: 0, clientX: RECT.left + 10, clientY: RECT.top + 10 });
    fireEvent.click(stage, { clientX: RECT.left + 10, clientY: RECT.top + 10, detail: 1 });
    expect(stage.getAttribute('data-zoomed')).toBe('true');

    // click to zoom out
    fireEvent.pointerDown(stage, { pointerId: 21, button: 0, clientX: 100, clientY: 80 });
    fireEvent.pointerUp(stage, { pointerId: 21, button: 0, clientX: 100, clientY: 80 });
    fireEvent.click(stage, { clientX: 100, clientY: 80, detail: 1 });
    expect(stage.getAttribute('data-zoomed')).toBe('false');

    // immediately click to zoom in again (off-center)
    const offX = RECT.left + RECT.width * 0.3;
    const offY = RECT.top + RECT.height * 0.3;
    fireEvent.pointerDown(stage, { pointerId: 22, button: 0, clientX: offX, clientY: offY });
    fireEvent.pointerUp(stage, { pointerId: 22, button: 0, clientX: offX, clientY: offY });
    fireEvent.click(stage, { clientX: offX, clientY: offY, detail: 1 });

    expect(stage.getAttribute('data-zoomed')).toBe('true');
    const parsed = parseTransform(img.parentElement!.style.transform || '');
    expect(parsed!.scale).toBeCloseTo(1.9, 6);
  });

  it('drag suppression is deterministic and does not rely on timers', () => {
    const { getByRole } = render(<ControlledGroundGlassStage />);
    const stage = getByRole('button');
    Object.defineProperty(stage, 'getBoundingClientRect', { value: () => RECT });

    // drag sequence where browser emits a click after drag
    fireEvent.pointerDown(stage, { pointerId: 30, button: 0, clientX: 120, clientY: 120 });
    fireEvent.pointerMove(stage, { pointerId: 30, button: 0, clientX: 200, clientY: 160 });
    fireEvent.pointerUp(stage, { pointerId: 30, button: 0, clientX: 200, clientY: 160 });
    // synthetic click should be suppressed
    fireEvent.click(stage, { clientX: 200, clientY: 160, detail: 1 });
    expect(stage.getAttribute('data-zoomed')).toBe('false');

    // Now simulate browser that does not emit click; start new gesture which must clear suppression
    fireEvent.pointerDown(stage, { pointerId: 31, button: 0, clientX: 100, clientY: 100 });
    fireEvent.pointerUp(stage, { pointerId: 31, button: 0, clientX: 100, clientY: 100 });
    fireEvent.click(stage, { clientX: 100, clientY: 100, detail: 1 });
    // click should now toggle
    expect(stage.getAttribute('data-zoomed')).toBe('true');
  });

  it('keyboard toggles use centered anchor', () => {
    const { getByRole, getByTestId } = render(<ControlledGroundGlassStage />);
    const stage = getByRole('button');
    Object.defineProperty(stage, 'getBoundingClientRect', { value: () => RECT });
    const img = getByTestId('image-content');

    // zoom in using off-center click
    fireEvent.pointerDown(stage, { pointerId: 40, button: 0, clientX: RECT.left + RECT.width * 0.2, clientY: RECT.top + RECT.height * 0.2 });
    fireEvent.pointerUp(stage, { pointerId: 40, button: 0, clientX: RECT.left + RECT.width * 0.2, clientY: RECT.top + RECT.height * 0.2 });
    fireEvent.click(stage, { clientX: RECT.left + RECT.width * 0.2, clientY: RECT.top + RECT.height * 0.2, detail: 1 });
    expect(stage.getAttribute('data-zoomed')).toBe('true');

    // Enter to zoom out
    fireEvent.keyDown(stage, { key: 'Enter' });
    expect(stage.getAttribute('data-zoomed')).toBe('false');
    const parsedOut = parseTransform(img.parentElement!.style.transform || '');
    expect(parsedOut!.scale).toBeCloseTo(1, 6);
    expect(parsedOut!.x).toBeCloseTo(0, 1);

    // Enter to zoom in centered
    fireEvent.keyDown(stage, { key: 'Enter' });
    expect(stage.getAttribute('data-zoomed')).toBe('true');
    const parsedIn = parseTransform(img.parentElement!.style.transform || '');
    expect(parsedIn!.scale).toBeCloseTo(1.9, 6);
    expect(parsedIn!.x).toBeCloseTo(0, 1);
  });
});
