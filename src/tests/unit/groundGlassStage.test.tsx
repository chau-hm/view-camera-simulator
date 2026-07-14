import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getGroundGlassPointerThresholdPx,
  GroundGlassStage,
} from "../../render/GroundGlassStage";
import {
  calculateGroundGlassAnchoredPan,
  denormalizeGroundGlassPan,
  normalizeGroundGlassPan,
} from "../../render/groundGlassStageTransform";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

let currentRect = {
  left: 100,
  top: 50,
  width: 500,
  height: 400,
  right: 600,
  bottom: 450,
  x: 100,
  y: 50,
  toJSON: () => ({}),
};

const getStage = (getByRole: ReturnType<typeof render>["getByRole"]) =>
  getByRole("button", { name: /Ground Glass$/ });

const configureStage = (stage: HTMLElement) => {
  Object.defineProperty(stage, "getBoundingClientRect", {
    configurable: true,
    value: () => currentRect,
  });
  Object.defineProperty(stage, "setPointerCapture", {
    configurable: true,
    value: vi.fn(),
  });
  Object.defineProperty(stage, "releasePointerCapture", {
    configurable: true,
    value: vi.fn(),
  });
};

const pointerGesture = (
  stage: HTMLElement,
  options: {
    pointerId: number;
    pointerType?: "mouse" | "pen" | "touch";
    startX: number;
    startY: number;
    endX?: number;
    endY?: number;
  },
) => {
  const {
    pointerId,
    pointerType = "mouse",
    startX,
    startY,
    endX = startX,
    endY = startY,
  } = options;
  fireEvent.pointerDown(stage, { pointerId, pointerType, button: 0, clientX: startX, clientY: startY });
  if (endX !== startX || endY !== startY) {
    fireEvent.pointerMove(stage, { pointerId, pointerType, clientX: endX, clientY: endY });
  }
  fireEvent.pointerUp(stage, { pointerId, pointerType, button: 0, clientX: endX, clientY: endY });
  // Browsers commonly emit this after pointer-up. It must never activate twice.
  fireEvent.click(stage, { detail: 1, clientX: endX, clientY: endY });
};

const ControlledGroundGlassStage = ({ resetKey = "route-a" }: { resetKey?: string }) => {
  const [zoomed, setZoomed] = useState(false);
  return (
    <GroundGlassStage
      zoomEnabled={zoomed}
      onZoomChange={setZoomed}
      interactionResetKey={resetKey}
      imageLayer={<div data-testid="image-content" />}
      fixedOverlayLayer={<div data-testid="overlay" />}
    />
  );
};

describe("GroundGlassStage explicit zoom interaction", () => {
  it("normalizes anchored pan and clamps it to viewport bounds", () => {
    const anchored = calculateGroundGlassAnchoredPan(currentRect.left, currentRect.top, currentRect);
    expect(anchored).toEqual({ x: 1, y: 1 });
    const normalized = normalizeGroundGlassPan({ x: 999, y: -999 }, currentRect, 1.9);
    expect(normalized).toEqual({ x: 1, y: -1 });
    const denormalized = denormalizeGroundGlassPan(normalized, currentRect, 1.9);
    expect(denormalized.x).toBeCloseTo(225, 8);
    expect(denormalized.y).toBeCloseTo(-180, 8);
  });

  it("uses pointer-type-aware displacement thresholds", () => {
    expect(getGroundGlassPointerThresholdPx("mouse")).toBe(8);
    expect(getGroundGlassPointerThresholdPx("pen")).toBe(10);
    expect(getGroundGlassPointerThresholdPx("touch")).toBe(12);
    expect(getGroundGlassPointerThresholdPx()).toBe(8);
  });

  it("requests explicit zoom-in and ignores duplicate pointer/click activation", () => {
    const view = render(<ControlledGroundGlassStage />);
    const stage = getStage(view.getByRole);
    configureStage(stage);
    pointerGesture(stage, { pointerId: 1, startX: 350, startY: 250 });
    expect(stage).toHaveAttribute("data-zoomed", "true");
    expect(stage).toHaveAttribute("data-scale", "1.9");
    // A duplicate pointer-up for the completed gesture is inert.
    fireEvent.pointerUp(stage, { pointerId: 1, pointerType: "mouse", button: 0, clientX: 350, clientY: 250 });
    expect(stage).toHaveAttribute("data-zoomed", "true");
  });

  it("keeps repeated explicit zoom-out requests false", () => {
    const onZoomChange = vi.fn();
    const view = render(
      <GroundGlassStage zoomEnabled onZoomChange={onZoomChange} imageLayer={<div />} />,
    );
    onZoomChange.mockClear();
    const reset = view.getByRole("button", { name: "Reset Ground Glass view" });
    fireEvent.click(reset);
    fireEvent.click(reset);
    expect(onZoomChange.mock.calls).toEqual([[false], [false]]);
  });

  it("treats 3-5 px mouse jitter as a zoom-out click and resets atomically", () => {
    const view = render(<ControlledGroundGlassStage />);
    const stage = getStage(view.getByRole);
    configureStage(stage);
    pointerGesture(stage, { pointerId: 2, startX: 180, startY: 120 });
    expect(stage).toHaveAttribute("data-zoomed", "true");

    pointerGesture(stage, {
      pointerId: 3,
      startX: 350,
      startY: 250,
      endX: 354,
      endY: 253,
    });
    expect(stage).toHaveAttribute("data-zoomed", "false");
    expect(stage).toHaveAttribute("data-pan-x", "0");
    expect(stage).toHaveAttribute("data-pan-y", "0");
    expect(stage).toHaveAttribute("data-normalized-pan-x", "0");
    expect(stage).toHaveAttribute("data-normalized-pan-y", "0");
    expect(stage).toHaveAttribute("data-scale", "1");
    expect(stage).toHaveAttribute("data-dragging", "false");
    expect(stage).toHaveAttribute("data-pointer-active", "false");
    expect(stage).toHaveAttribute("data-pointer-captured", "false");
    expect(view.getByTestId("ground-glass-image-layer")).toHaveStyle({
      transform: "translate3d(0px, 0px, 0) scale(1)",
    });
  });

  it.each([
    ["mouse", 9],
    ["pen", 11],
    ["touch", 13],
  ] as const)("movement above the %s threshold pans without zooming out", (pointerType, movement) => {
    const view = render(<ControlledGroundGlassStage />);
    const stage = getStage(view.getByRole);
    configureStage(stage);
    pointerGesture(stage, { pointerId: 10, pointerType, startX: 350, startY: 250 });
    pointerGesture(stage, {
      pointerId: 11,
      pointerType,
      startX: 350,
      startY: 250,
      endX: 350 + movement,
      endY: 250,
    });
    expect(stage).toHaveAttribute("data-zoomed", "true");
    expect(Number(stage.getAttribute("data-pan-x"))).not.toBe(0);
  });

  it("a drag-generated click is inert and the next independent click works immediately", () => {
    const view = render(<ControlledGroundGlassStage />);
    const stage = getStage(view.getByRole);
    configureStage(stage);
    pointerGesture(stage, { pointerId: 20, startX: 350, startY: 250 });
    pointerGesture(stage, { pointerId: 21, startX: 350, startY: 250, endX: 390, endY: 275 });
    expect(stage).toHaveAttribute("data-zoomed", "true");
    pointerGesture(stage, { pointerId: 22, startX: 350, startY: 250, endX: 354, endY: 252 });
    expect(stage).toHaveAttribute("data-zoomed", "false");
  });

  it("classifies total pointer-up displacement even when no move event was delivered", () => {
    const view = render(<ControlledGroundGlassStage />);
    const stage = getStage(view.getByRole);
    configureStage(stage);
    pointerGesture(stage, { pointerId: 25, startX: 350, startY: 250 });
    fireEvent.pointerDown(stage, { pointerId: 26, pointerType: "mouse", button: 0, clientX: 350, clientY: 250 });
    fireEvent.pointerUp(stage, { pointerId: 26, pointerType: "mouse", button: 0, clientX: 370, clientY: 250 });
    fireEvent.click(stage, { detail: 1, clientX: 370, clientY: 250 });
    expect(stage).toHaveAttribute("data-zoomed", "true");
  });

  it("the fixed Reset view control clears pan, capture, and the transform", () => {
    const view = render(<ControlledGroundGlassStage />);
    const stage = getStage(view.getByRole);
    configureStage(stage);
    pointerGesture(stage, { pointerId: 30, startX: 180, startY: 120 });
    fireEvent.pointerDown(stage, { pointerId: 31, pointerType: "mouse", button: 0, clientX: 350, clientY: 250 });
    fireEvent.pointerMove(stage, { pointerId: 31, pointerType: "mouse", clientX: 410, clientY: 285 });
    expect(stage).toHaveAttribute("data-dragging", "true");
    expect(stage).toHaveAttribute("data-pointer-captured", "true");
    fireEvent.click(view.getByRole("button", { name: "Reset Ground Glass view" }));
    expect(stage).toHaveAttribute("data-zoomed", "false");
    expect(stage).toHaveAttribute("data-pointer-active", "false");
    expect(stage).toHaveAttribute("data-pointer-captured", "false");
    expect(stage).toHaveAttribute("data-normalized-pan-x", "0");
    expect(view.getByTestId("ground-glass-image-layer")).toHaveStyle({
      transform: "translate3d(0px, 0px, 0) scale(1)",
    });
    expect(stage.releasePointerCapture).toHaveBeenCalledWith(31);
  });

  it.each(["pointerCancel", "lostPointerCapture"] as const)("%s resets a captured gesture", (eventName) => {
    const view = render(<ControlledGroundGlassStage />);
    const stage = getStage(view.getByRole);
    configureStage(stage);
    pointerGesture(stage, { pointerId: 40, startX: 350, startY: 250 });
    fireEvent.pointerDown(stage, { pointerId: 41, pointerType: "mouse", button: 0, clientX: 350, clientY: 250 });
    fireEvent.pointerMove(stage, { pointerId: 41, pointerType: "mouse", clientX: 390, clientY: 270 });
    fireEvent[eventName](stage, { pointerId: 41, pointerType: "mouse" });
    expect(stage).toHaveAttribute("data-zoomed", "false");
    expect(stage).toHaveAttribute("data-pointer-active", "false");
    expect(stage).toHaveAttribute("data-dragging", "false");
    expect(stage).toHaveAttribute("data-pan-x", "0");
  });

  it("Escape resets while Enter uses the same explicit centered path", () => {
    const view = render(<ControlledGroundGlassStage />);
    const stage = getStage(view.getByRole);
    configureStage(stage);
    fireEvent.keyDown(stage, { key: "Enter" });
    expect(stage).toHaveAttribute("data-zoomed", "true");
    expect(stage).toHaveAttribute("data-pan-x", "0");
    fireEvent.keyDown(stage, { key: "Escape" });
    expect(stage).toHaveAttribute("data-zoomed", "false");
    expect(stage).toHaveAttribute("data-scale", "1");
  });

  it("scene/route reset keys discard zoom and pan", () => {
    const view = render(<ControlledGroundGlassStage resetKey="free:table-tilt" />);
    const stage = getStage(view.getByRole);
    configureStage(stage);
    pointerGesture(stage, { pointerId: 50, startX: 180, startY: 120 });
    expect(stage).toHaveAttribute("data-zoomed", "true");
    view.rerender(<ControlledGroundGlassStage resetKey="guided:table-tilt" />);
    expect(stage).toHaveAttribute("data-zoomed", "false");
    expect(stage).toHaveAttribute("data-normalized-pan-x", "0");
    expect(stage).toHaveAttribute("data-normalized-pan-y", "0");
  });

  it("resize re-clamps zoomed pan and leaves unzoomed state exactly centered", () => {
    let resizeCallback: ResizeObserverCallback | undefined;
    class ResizeObserverMock {
      constructor(callback: ResizeObserverCallback) {
        resizeCallback = callback;
      }
      observe() {}
      disconnect() {}
      unobserve() {}
    }
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
    currentRect = { ...currentRect, width: 500, height: 400, right: 600, bottom: 450 };
    const view = render(<ControlledGroundGlassStage />);
    const stage = getStage(view.getByRole);
    configureStage(stage);
    pointerGesture(stage, { pointerId: 60, startX: 100, startY: 50 });
    pointerGesture(stage, { pointerId: 61, startX: 350, startY: 250, endX: 900, endY: 700 });
    currentRect = { ...currentRect, width: 200, height: 160, right: 300, bottom: 210 };
    act(() => resizeCallback?.([], {} as ResizeObserver));
    expect(Math.abs(Number(stage.getAttribute("data-pan-x")))).toBeLessThanOrEqual(90);
    expect(Math.abs(Number(stage.getAttribute("data-pan-y")))).toBeLessThanOrEqual(72);

    fireEvent.click(view.getByRole("button", { name: "Reset Ground Glass view" }));
    act(() => resizeCallback?.([], {} as ResizeObserver));
    expect(stage).toHaveAttribute("data-pan-x", "0");
    expect(stage).toHaveAttribute("data-pan-y", "0");
    expect(stage).toHaveAttribute("data-scale", "1");
  });
});
