import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { GeometryViewport } from "../../components/simulator/GeometryViewport";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import { architectureRiseScene } from "../../scenes/definitions/architecture-rise";
import { mirrorShiftScene } from "../../scenes/definitions/mirror-shift";
import { DEFAULT_CAMERA_STATE } from "../../utils/constants";

describe("GeometryViewport", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders side-view svg and has expected primitives", () => {
    const opticsState = deriveOpticsState(DEFAULT_CAMERA_STATE, architectureRiseScene);
    const { container } = render(
      <GeometryViewport opticsState={opticsState} geometryView="side" scene={architectureRiseScene} riseMm={0} />,
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

    // There should be multiple lines (film, lens, axis etc.)
    const lines = svg!.querySelectorAll("line");
    expect(lines.length).toBeGreaterThanOrEqual(2);

    // Optical axis annotation exists in annotations layer
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
      <GeometryViewport opticsState={opticsState} geometryView="top" scene={architectureRiseScene} riseMm={0} />,
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

    const lines = svg!.querySelectorAll("line");
    expect(lines.length).toBeGreaterThanOrEqual(2);
  });

  it("renders Mirror Shift's scene-specific top-view teaching construction", () => {
    const opticsState = deriveOpticsState(
      {
        ...DEFAULT_CAMERA_STATE,
        ...mirrorShiftScene.cameraPreset,
        activeSceneId: mirrorShiftScene.id,
        activeTaskId: null,
        mode: "free",
        mirrorShiftLessonState: { rigLateralMm: 2000 },
        frontShiftMm: -55,
      },
      mirrorShiftScene,
    );
    const { container } = render(
      <GeometryViewport opticsState={opticsState} geometryView="side" scene={mirrorShiftScene} />,
    );
    const viewport = container.querySelector("section[data-geometry-fit]");
    expect(viewport).toHaveAttribute("data-geometry-view", "top");
    expect(container.querySelector('[data-testid="mirror-shift-teaching-svg"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="mirror-shift-mirror-plane"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="mirror-shift-neutral-camera"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="mirror-shift-current-camera"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="mirror-shift-front-shift-cue"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="mirror-shift-current-chief-ray"]')).not.toBeNull();
  });
});
