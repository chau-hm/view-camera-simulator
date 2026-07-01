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
});
