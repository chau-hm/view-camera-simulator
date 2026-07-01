import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import { GroundGlassRenderer } from "../../render/GroundGlassRenderer";
import { architectureRiseScene } from "../../scenes/definitions/architecture-rise";
import { DEFAULT_CAMERA_STATE } from "../../utils/constants";

describe("GroundGlassRenderer", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders pipeline and settings overlays", () => {
    const opticsState = deriveOpticsState(DEFAULT_CAMERA_STATE, architectureRiseScene);
    render(
      <GroundGlassRenderer
        opticsState={opticsState}
        assistEnabled={false}
        focusAssistEnabled
        gridEnabled
        riseMm={DEFAULT_CAMERA_STATE.frontRiseMm}
        tiltDeg={DEFAULT_CAMERA_STATE.frontTiltDeg}
        swingDeg={DEFAULT_CAMERA_STATE.frontSwingDeg}
        focusDistanceMm={DEFAULT_CAMERA_STATE.focusDistanceMm}
        aperture={DEFAULT_CAMERA_STATE.aperture}
        renderQuality="standard"
      />,
    );

    expect(screen.getByText("Ground glass pipeline")).toBeInTheDocument();
    expect(screen.getByText("Current settings")).toBeInTheDocument();
    expect(screen.getByText("Focus targets")).toBeInTheDocument();
    expect(screen.getByText("Focus assist")).toBeInTheDocument();
    expect(screen.getByText(/Sharp|Near-sharp|Blurred/)).toBeInTheDocument();
  });

  it("supports zoom mode without changing camera state", () => {
    const opticsState = deriveOpticsState(DEFAULT_CAMERA_STATE, architectureRiseScene);
    render(
      <GroundGlassRenderer
        opticsState={opticsState}
        assistEnabled={false}
        focusAssistEnabled={false}
        gridEnabled={false}
        riseMm={10}
        tiltDeg={2}
        swingDeg={-1}
        focusDistanceMm={2500}
        aperture={11}
        renderQuality="low"
      />,
    );

    const zoomIn = screen.getByRole("button", { name: "Zoom in" });
    fireEvent.click(zoomIn);
    expect(screen.getByRole("button", { name: "Zoom out" })).toBeInTheDocument();
  });

  it("updates the preview when focus and movement controls change", () => {
    const opticsState = deriveOpticsState(DEFAULT_CAMERA_STATE, architectureRiseScene);
    const { rerender } = render(
      <GroundGlassRenderer
        opticsState={opticsState}
        assistEnabled={false}
        focusAssistEnabled={false}
        gridEnabled={false}
        riseMm={0}
        tiltDeg={0}
        swingDeg={0}
        focusDistanceMm={2000}
        aperture={11}
        renderQuality="standard"
      />,
    );

    const scene = screen.getByTestId("ground-glass-scene");
    const focusRing = screen.getByTestId("ground-glass-focus-ring");
    const beforeSceneTransform = scene.getAttribute("style");
    const beforeFocusRing = focusRing.getAttribute("style");

    rerender(
      <GroundGlassRenderer
        opticsState={opticsState}
        assistEnabled={false}
        focusAssistEnabled={false}
        gridEnabled={false}
        riseMm={24}
        tiltDeg={4}
        swingDeg={-3}
        focusDistanceMm={4200}
        aperture={32}
        renderQuality="standard"
      />,
    );

    expect(screen.getByTestId("ground-glass-scene").getAttribute("style")).not.toBe(beforeSceneTransform);
    expect(screen.getByTestId("ground-glass-focus-ring").getAttribute("style")).not.toBe(beforeFocusRing);
    expect(screen.getByText(/4200\.0 mm focus/)).toBeInTheDocument();
  });
});
