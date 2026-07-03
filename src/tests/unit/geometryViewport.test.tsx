import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { GeometryViewport } from "../../components/simulator/GeometryViewport";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import { architectureRiseScene } from "../../scenes/definitions/architecture-rise";
import { DEFAULT_CAMERA_STATE } from "../../utils/constants";

describe("GeometryViewport", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders side-view svg and has expected primitives", () => {
    const opticsState = deriveOpticsState(DEFAULT_CAMERA_STATE, architectureRiseScene);
    const { container } = render(
      <GeometryViewport opticsState={opticsState} geometryView="side" scene={architectureRiseScene} />,
    );
    const svg = container.querySelector('[data-testid="geometry-svg-side"]') as SVGElement | null;
    expect(svg).toBeTruthy();

    // DOF region polygon exists and has 4 points
    const poly = svg!.querySelector("polygon") as SVGPolygonElement | null;
    expect(poly).toBeTruthy();
    const pts = (poly!.getAttribute("points") || "").trim().split(/\s+/);
    expect(pts.length).toBe(4);
    pts.forEach((p) => {
      const [x, y] = p.split(",");
      expect(Number.isFinite(parseFloat(x))).toBe(true);
      expect(Number.isFinite(parseFloat(y))).toBe(true);
    });

    // Film and Focus plane lines exist
    expect(svg!.querySelector('[data-testid="plane-line-film"]')).toBeTruthy();
    expect(svg!.querySelector('[data-testid="plane-line-focus"]')).toBeTruthy();

    // Optical axis label exists
    const axisText = Array.from(svg!.querySelectorAll("text")).find((t) => t.textContent === "Optical axis");
    expect(axisText).toBeTruthy();
  });

  it("renders top-view svg and has expected primitives", () => {
    const opticsState = deriveOpticsState(
      {
        ...DEFAULT_CAMERA_STATE,
        frontSwingDeg: 4,
      },
      architectureRiseScene,
    );
    const { container } = render(
      <GeometryViewport opticsState={opticsState} geometryView="top" scene={architectureRiseScene} />,
    );
    const svg = container.querySelector('[data-testid="geometry-svg-top"]') as SVGElement | null;
    expect(svg).toBeTruthy();

    const poly = svg!.querySelector("polygon") as SVGPolygonElement | null;
    expect(poly).toBeTruthy();
    const pts = (poly!.getAttribute("points") || "").trim().split(/\s+/);
    expect(pts.length).toBe(4);
    pts.forEach((p) => {
      const [x, y] = p.split(",");
      expect(Number.isFinite(parseFloat(x))).toBe(true);
      expect(Number.isFinite(parseFloat(y))).toBe(true);
    });

    expect(svg!.querySelector('[data-testid="plane-line-film"]')).toBeTruthy();
    expect(svg!.querySelector('[data-testid="plane-line-focus"]')).toBeTruthy();
  });
});
