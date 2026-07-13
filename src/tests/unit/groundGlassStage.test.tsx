import { render, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GroundGlassStage } from "../../render/GroundGlassStage";

afterEach(() => cleanup());

describe("GroundGlassStage pointer and keyboard interactions", () => {
  it("initial aria label and data-zoomed reflect zoom state", () => {
    const { getByRole, rerender } = render(<GroundGlassStage imageLayer={<div />} fixedOverlayLayer={<div />} zoomEnabled={false} />);
    const stage = getByRole('button');
    expect(stage.getAttribute('aria-label')).toBe('Zoom in Ground Glass');
    expect(stage.getAttribute('data-zoomed')).toBe('false');

    rerender(<GroundGlassStage imageLayer={<div />} fixedOverlayLayer={<div />} zoomEnabled={true} />);
    expect(stage.getAttribute('aria-label')).toBe('Zoom out Ground Glass');
    expect(stage.getAttribute('data-zoomed')).toBe('true');
  });

  it('pointerup alone does not toggle zoom', () => {
    const onToggle = vi.fn();
    const { getByRole } = render(<GroundGlassStage imageLayer={<div />} fixedOverlayLayer={<div />} zoomEnabled={false} onToggleZoom={onToggle} />);
    const stage = getByRole('button');

    fireEvent.pointerDown(stage, { pointerId: 1, button: 0, clientX: 100, clientY: 50 });
    fireEvent.pointerUp(stage, { pointerId: 1, button: 0, clientX: 100, clientY: 50 });

    expect(onToggle).toHaveBeenCalledTimes(0);
  });

  it('real click sequence toggles exactly once', () => {
    const onToggle = vi.fn();
    const { getByRole } = render(<GroundGlassStage imageLayer={<div />} fixedOverlayLayer={<div />} zoomEnabled={false} onToggleZoom={onToggle} />);
    const stage = getByRole('button');

    fireEvent.pointerDown(stage, { pointerId: 2, button: 0, clientX: 120, clientY: 80 });
    fireEvent.pointerUp(stage, { pointerId: 2, button: 0, clientX: 120, clientY: 80 });
    fireEvent.click(stage);

    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('direct click toggles exactly once', () => {
    const onToggle = vi.fn();
    const { getByRole } = render(<GroundGlassStage imageLayer={<div />} fixedOverlayLayer={<div />} zoomEnabled={false} onToggleZoom={onToggle} />);
    const stage = getByRole('button');

    fireEvent.click(stage);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('zoomed click toggles out when movement below threshold', () => {
    const onToggle = vi.fn();
    const { getByRole } = render(<GroundGlassStage imageLayer={<div />} fixedOverlayLayer={<div />} zoomEnabled={true} onToggleZoom={onToggle} />);
    const stage = getByRole('button');

    fireEvent.pointerDown(stage, { pointerId: 3, button: 0, clientX: 120, clientY: 80 });
    fireEvent.pointerUp(stage, { pointerId: 3, button: 0, clientX: 121, clientY: 82 }); // small movement
    fireEvent.click(stage);

    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('dragging while zoomed pans and does not toggle zoom (drag-suppresses click)', async () => {
    const onToggle = vi.fn();
    const { getByRole, getByTestId } = render(<GroundGlassStage imageLayer={<div data-testid="img">img</div>} fixedOverlayLayer={<div />} zoomEnabled={true} onToggleZoom={onToggle} />);
    const stage = getByRole('button');
    const img = getByTestId('img');

    // pointer down
    fireEvent.pointerDown(stage, { pointerId: 4, button: 0, clientX: 50, clientY: 50 });
    // move beyond threshold
    fireEvent.pointerMove(stage, { pointerId: 4, button: 0, clientX: 80, clientY: 90 });
    // up
    fireEvent.pointerUp(stage, { pointerId: 4, button: 0, clientX: 80, clientY: 90 });
    // synthetic click that browsers emit after drag
    fireEvent.click(stage);

    expect(onToggle).toHaveBeenCalledTimes(0);
    // transformed div (parent of img) should have scale(1.9)
    const transformed = img.parentElement as HTMLElement;
    expect(transformed.style.transform).toContain('scale(1.9)');
    // and translate should not be 0
    expect(transformed.style.transform).toMatch(/translate3d\(.+px,\s*.+px,\s*0\) scale/);
  });

  it('suppression does not affect the next genuine click after a drag', async () => {
    const onToggle = vi.fn();
    const { getByRole } = render(<GroundGlassStage imageLayer={<div />} fixedOverlayLayer={<div />} zoomEnabled={false} onToggleZoom={onToggle} />);
    const stage = getByRole('button');

    // first gesture: drag (should not toggle)
    fireEvent.pointerDown(stage, { pointerId: 5, button: 0, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(stage, { pointerId: 5, button: 0, clientX: 30, clientY: 10 });
    fireEvent.pointerUp(stage, { pointerId: 5, button: 0, clientX: 30, clientY: 10 });
    fireEvent.click(stage); // suppressed

    expect(onToggle).toHaveBeenCalledTimes(0);

    // allow the zero-delay suppression to clear (next tick)
    await new Promise((r) => setTimeout(r, 0));

    // next genuine click should toggle
    fireEvent.pointerDown(stage, { pointerId: 6, button: 0, clientX: 100, clientY: 50 });
    fireEvent.pointerUp(stage, { pointerId: 6, button: 0, clientX: 100, clientY: 50 });
    fireEvent.click(stage);

    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('tiny movement is treated as click', () => {
    const onToggle = vi.fn();
    const { getByRole } = render(<GroundGlassStage imageLayer={<div />} fixedOverlayLayer={<div />} zoomEnabled={false} onToggleZoom={onToggle} />);
    const stage = getByRole('button');

    fireEvent.pointerDown(stage, { pointerId: 7, button: 0, clientX: 200, clientY: 200 });
    fireEvent.pointerMove(stage, { pointerId: 7, button: 0, clientX: 202, clientY: 201 }); // below threshold
    fireEvent.pointerUp(stage, { pointerId: 7, button: 0, clientX: 202, clientY: 201 });
    fireEvent.click(stage);

    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('non-primary pointer does nothing', () => {
    const onToggle = vi.fn();
    const { getByRole } = render(<GroundGlassStage imageLayer={<div />} fixedOverlayLayer={<div />} zoomEnabled={false} onToggleZoom={onToggle} />);
    const stage = getByRole('button');

    fireEvent.pointerDown(stage, { pointerId: 8, button: 2, clientX: 10, clientY: 10 });
    fireEvent.pointerUp(stage, { pointerId: 8, button: 2, clientX: 10, clientY: 10 });

    expect(onToggle).toHaveBeenCalledTimes(0);
  });

  it('pointer cancel clears state and does not toggle', () => {
    const onToggle = vi.fn();
    const { getByRole } = render(<GroundGlassStage imageLayer={<div />} fixedOverlayLayer={<div />} zoomEnabled={false} onToggleZoom={onToggle} />);
    const stage = getByRole('button');

    fireEvent.pointerDown(stage, { pointerId: 9, button: 0, clientX: 60, clientY: 60 });
    fireEvent.pointerCancel(stage, { pointerId: 9 });
    fireEvent.pointerUp(stage, { pointerId: 9, button: 0, clientX: 60, clientY: 60 });

    expect(onToggle).toHaveBeenCalledTimes(0);
  });

  it('keyboard Enter and Space toggle zoom', () => {
    const onToggle = vi.fn();
    const { getByRole } = render(<GroundGlassStage imageLayer={<div />} fixedOverlayLayer={<div />} zoomEnabled={false} onToggleZoom={onToggle} />);
    const stage = getByRole('button');
    stage.focus();

    fireEvent.keyDown(stage, { key: 'Enter' });
    fireEvent.keyDown(stage, { key: ' ' });

    expect(onToggle).toHaveBeenCalledTimes(2);
  });

  it('wheel events do not toggle zoom and are not prevented', () => {
    const onToggle = vi.fn();
    const { getByRole } = render(<GroundGlassStage imageLayer={<div />} fixedOverlayLayer={<div />} zoomEnabled={false} onToggleZoom={onToggle} />);
    const stage = getByRole('button');

    const evt = new WheelEvent('wheel', { deltaY: 100, bubbles: true, cancelable: true });
    const prevented = !stage.dispatchEvent(evt);
    expect(onToggle).toHaveBeenCalledTimes(0);
    expect(prevented).toBe(false);
  });
});
