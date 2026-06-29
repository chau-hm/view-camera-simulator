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

  it("renders side-view svg snapshot", () => {
    const opticsState = deriveOpticsState(DEFAULT_CAMERA_STATE, architectureRiseScene);
    const { container } = render(
      <GeometryViewport opticsState={opticsState} geometryView="side" scene={architectureRiseScene} />,
    );
    expect(container.querySelector('[data-testid="geometry-svg-side"]')).toMatchSnapshot();
  });

  it("renders top-view svg snapshot", () => {
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
    expect(container.querySelector('[data-testid="geometry-svg-top"]')).toMatchSnapshot();
  });
});
