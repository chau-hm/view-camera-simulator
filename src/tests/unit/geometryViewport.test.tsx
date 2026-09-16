import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GeometryViewport } from "../../components/simulator/GeometryViewport";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import { architectureRiseScene } from "../../scenes/definitions/architecture-rise";
import { architectureForegroundScene } from "../../scenes/definitions/architecture-foreground";
import { mirrorShiftScene } from "../../scenes/definitions/mirror-shift";
import { obliqueArchitectureScene } from "../../scenes/definitions/oblique-architecture";
import { DEFAULT_CAMERA_STATE } from "../../utils/constants";
import { tableTiltScene } from "../../scenes/definitions/table-tilt";

const noopGeometryViewChange = () => undefined;

describe("GeometryViewport", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders side-view svg and has expected primitives", () => {
    const opticsState = deriveOpticsState(DEFAULT_CAMERA_STATE, architectureRiseScene);
    const { container } = render(
      <GeometryViewport
        opticsState={opticsState}
        geometryView="side"
        onGeometryViewChange={noopGeometryViewChange}
        focalLengthMm={DEFAULT_CAMERA_STATE.focalLengthMm}
        scene={architectureRiseScene}
        riseMm={0}
      />,
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

    const depthCaption = container.querySelector(".geometry-viewport__depth-caption");
    expect(depthCaption).toBeTruthy();
    expect(depthCaption).toHaveTextContent(/Optical axis/i);
  });

  it("renders Architecture + Foreground labels from scene Geometry metadata", () => {
    const opticsState = deriveOpticsState(
      {
        ...DEFAULT_CAMERA_STATE,
        ...architectureForegroundScene.cameraPreset,
        activeSceneId: architectureForegroundScene.id,
      },
      architectureForegroundScene,
    );
    const { container } = render(
      <GeometryViewport
        opticsState={opticsState}
        geometryView="side"
        onGeometryViewChange={noopGeometryViewChange}
        focalLengthMm={architectureForegroundScene.cameraPreset.focalLengthMm ?? DEFAULT_CAMERA_STATE.focalLengthMm}
        scene={architectureForegroundScene}
        riseMm={0}
      />,
    );
    const svg = container.querySelector('[data-testid="geometry-svg-side"]');
    expect(svg?.textContent).toContain("Foreground ground");
    expect(svg?.textContent).toContain("Building profile");
    expect(svg?.textContent).toContain("Near foreground");
    expect(svg?.textContent).toContain("Middle foreground");
    expect(svg?.textContent).toContain("Building base");
    expect(svg?.textContent).toContain("Building middle");
  });

  it("separates pure front-rise FOV boundaries, optical axis, and chief ray", () => {
    const opticsState = deriveOpticsState(
      {
        ...DEFAULT_CAMERA_STATE,
        ...architectureRiseScene.cameraPreset,
        activeSceneId: architectureRiseScene.id,
        frontRiseMm: 35,
        frontTiltDeg: 0,
        frontSwingDeg: 0,
        focusDistanceMm: 8890,
        aperture: 11,
      },
      architectureRiseScene,
    );
    const { container } = render(
      <GeometryViewport
        opticsState={opticsState}
        geometryView="side"
        onGeometryViewChange={noopGeometryViewChange}
        focalLengthMm={DEFAULT_CAMERA_STATE.focalLengthMm}
        scene={architectureRiseScene}
        riseMm={35}
      />,
    );

    const svg = container.querySelector('[data-testid="geometry-svg-side"]') as SVGElement | null;
    expect(svg).not.toBeNull();
    expect(svg!.querySelectorAll('[data-ray-role="film-edge-to-lens"]')).toHaveLength(2);
    expect(svg!.querySelectorAll('[data-ray-role="fov-boundary"]')).toHaveLength(2);
    expect(svg!.querySelector('[data-ray-role="optical-axis"]')).not.toBeNull();
    expect(svg!.querySelector('[data-ray-role="chief-ray"]')).not.toBeNull();
    expect(container).toHaveTextContent(/chief ray from film centre through lens centre/i);

    const axis = svg!.querySelector('[data-ray-role="optical-axis"]') as SVGLineElement;
    const chief = svg!.querySelector('[data-ray-role="chief-ray"]') as SVGLineElement;
    const lineVector = (line: SVGLineElement) => ({
      x: Number(line.getAttribute("x2")) - Number(line.getAttribute("x1")),
      y: Number(line.getAttribute("y2")) - Number(line.getAttribute("y1")),
    });
    const axisVector = lineVector(axis);
    const chiefVector = lineVector(chief);
    expect(Math.abs(axisVector.y / axisVector.x)).toBeLessThan(1e-8);
    expect(Math.abs(axisVector.x * chiefVector.y - axisVector.y * chiefVector.x)).toBeGreaterThan(1e-6);
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
      <GeometryViewport
        opticsState={opticsState}
        geometryView="top"
        onGeometryViewChange={noopGeometryViewChange}
        focalLengthMm={DEFAULT_CAMERA_STATE.focalLengthMm}
        scene={architectureRiseScene}
        riseMm={0}
      />,
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
      <GeometryViewport
        opticsState={opticsState}
        geometryView="side"
        onGeometryViewChange={noopGeometryViewChange}
        focalLengthMm={DEFAULT_CAMERA_STATE.focalLengthMm}
        scene={mirrorShiftScene}
      />,
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

  it("publishes view selections through the explicit callback", () => {
    const opticsState = deriveOpticsState(DEFAULT_CAMERA_STATE, tableTiltScene);
    const onGeometryViewChange = vi.fn();
    const view = render(
      <GeometryViewport
        opticsState={opticsState}
        geometryView="side"
        onGeometryViewChange={onGeometryViewChange}
        focalLengthMm={DEFAULT_CAMERA_STATE.focalLengthMm}
        scene={tableTiltScene}
        riseMm={0}
      />,
    );

    fireEvent.click(view.getByRole("button", { name: "Top" }));
    fireEvent.click(view.getByRole("button", { name: "Side" }));
    fireEvent.click(view.getByRole("button", { name: "Scheimpflug Section" }));

    expect(onGeometryViewChange.mock.calls).toEqual([["top"], ["side"], ["scheimpflug"]]);
  });

  it("requests the preferred view when Scheimpflug is unsupported", async () => {
    const opticsState = deriveOpticsState(DEFAULT_CAMERA_STATE, architectureRiseScene);
    const onGeometryViewChange = vi.fn();
    render(
      <GeometryViewport
        opticsState={opticsState}
        geometryView="scheimpflug"
        onGeometryViewChange={onGeometryViewChange}
        focalLengthMm={DEFAULT_CAMERA_STATE.focalLengthMm}
        scene={architectureRiseScene}
        riseMm={0}
      />,
    );

    await waitFor(() => expect(onGeometryViewChange).toHaveBeenCalledWith("side"));
  });

  it("uses the Oblique Architecture profile default for an unsupported Scheimpflug view", async () => {
    const opticsState = deriveOpticsState(DEFAULT_CAMERA_STATE, obliqueArchitectureScene);
    const onGeometryViewChange = vi.fn();
    const view = render(
      <GeometryViewport
        opticsState={opticsState}
        geometryView="scheimpflug"
        onGeometryViewChange={onGeometryViewChange}
        focalLengthMm={DEFAULT_CAMERA_STATE.focalLengthMm}
        scene={obliqueArchitectureScene}
        riseMm={0}
      />,
    );

    const viewport = view.container.querySelector("section[data-geometry-fit]");
    expect(viewport).toHaveAttribute("data-geometry-view", "top");
    await waitFor(() => expect(onGeometryViewChange).toHaveBeenCalledWith("top"));
  });
});
