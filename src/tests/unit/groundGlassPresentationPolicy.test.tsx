import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { GroundGlassFocusRing } from "../../render/GroundGlassFocusRing";
import type { ProjectedGroundGlassTarget } from "../../render/groundGlassTargetProjection";

afterEach(() => {
  cleanup();
});

const projectedTarget: ProjectedGroundGlassTarget = {
  id: "target",
  visible: true,
  leftPercent: 25,
  topPercent: 35,
  blurStrengthAtTarget: 0.1,
  physicalFilmUv: { u: 0.25, v: 0.35 },
  displayUv: { u: 0.25, v: 0.35 },
};

describe("Ground Glass presentation components", () => {
  it("renders the focus ring from explicit projected-target inputs", () => {
    const { getByTestId, rerender } = render(
      <GroundGlassFocusRing
        primaryProjectedTarget={projectedTarget}
        focusRingSize={68}
        focusRingOpacity={0.8}
        swingDeg={0}
        tiltDeg={0}
      />,
    );

    expect(getByTestId("ground-glass-focus-ring")).toHaveStyle({
      left: "25%",
      top: "35%",
      display: "block",
    });

    rerender(
      <GroundGlassFocusRing
        primaryProjectedTarget={{ ...projectedTarget, visible: false }}
        focusRingSize={68}
        focusRingOpacity={0.8}
        swingDeg={4}
        tiltDeg={-6}
      />,
    );
    expect(getByTestId("ground-glass-focus-ring")).toHaveStyle({
      left: "52%",
      top: "53%",
      display: "none",
    });
  });
});
