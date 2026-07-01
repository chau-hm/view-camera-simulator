import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { formatPerformanceSample, scheduleNextPaintSample } from "../../utils/performance";
import { PerformancePanel } from "../../components/simulator/PerformancePanel";

describe("Performance utilities", () => {
  it("formats samples correctly", () => {
    expect(formatPerformanceSample(null, "ms")).toBe("n/a");
    expect(formatPerformanceSample(45.67, "ms")).toBe("45.7 ms");
    expect(formatPerformanceSample(30, "FPS")).toBe("30.0 FPS");
  });

  it("scheduleNextPaintSample triggers callback in requestAnimationFrame context", () => {
    if (typeof window !== "undefined") {
      const originalRaf = window.requestAnimationFrame;
      const mockRaf = vi.fn((cb: FrameRequestCallback) => {
        cb(100);
        return 0;
      });
      window.requestAnimationFrame = mockRaf;

      const callback = vi.fn();
      scheduleNextPaintSample(callback);

      expect(mockRaf).toHaveBeenCalled();
      window.requestAnimationFrame = originalRaf;
    }
  });
});

describe("PerformancePanel", () => {
  it("renders headers and correct latency values", () => {
    render(
      <PerformancePanel
        movementInputLatencyMs={12.5}
        groundGlassFps={45.2}
        sceneSwitchDurationMs={1500}
      />,
    );

    expect(screen.getByRole("heading", { name: "Performance" })).toBeInTheDocument();
    expect(screen.getByText("Movement input latency:")).toBeInTheDocument();
    expect(screen.getByText("12.5 ms")).toBeInTheDocument();
    expect(screen.getByText("Ground glass FPS:")).toBeInTheDocument();
    expect(screen.getByText("45.2 FPS")).toBeInTheDocument();
    expect(screen.getByText("Scene switch duration:")).toBeInTheDocument();
    expect(screen.getByText("1500.0 ms")).toBeInTheDocument();
  });

  it("handles null values gracefully", () => {
    render(
      <PerformancePanel
        movementInputLatencyMs={null}
        groundGlassFps={null}
        sceneSwitchDurationMs={null}
      />,
    );

    const naElements = screen.getAllByText("n/a");
    expect(naElements.length).toBe(3);
  });
});
