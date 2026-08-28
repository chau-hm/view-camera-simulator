import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { GroundGlassFocusRing } from "../../render/GroundGlassFocusRing";
import { GroundGlassTransformedOverlays } from "../../render/GroundGlassOverlays";
import { LegacyGroundGlassScene } from "../../render/LegacyGroundGlassScene";
import { resolveGroundGlassPresentationPolicy } from "../../render/groundGlassPresentationPolicy";
import type { ProjectedGroundGlassTarget } from "../../render/groundGlassTargetProjection";
import { architectureRiseScene } from "../../scenes/definitions/architecture-rise";
import { focusFundamentalsTwoTargets } from "../../scenes/definitions/focus-fundamentals-two-targets";

afterEach(() => {
  cleanup();
});

const projectedTarget: ProjectedGroundGlassTarget = {
  id: "target",
  visible: true,
  leftPercent: 25,
  topPercent: 35,
  blurStrengthAtTarget: 0.1,
  rawUv: { u: 0.25, v: 0.35 },
  displayUv: { u: 0.25, v: 0.35 },
};

describe("Ground Glass presentation policy", () => {
  it("suppresses the decorative vignette only for Focus Fundamentals", () => {
    expect(resolveGroundGlassPresentationPolicy(focusFundamentalsTwoTargets)).toEqual({
      showDecorativeVignette: false,
    });
    expect(resolveGroundGlassPresentationPolicy(architectureRiseScene)).toEqual({
      showDecorativeVignette: true,
    });
  });

  it("passes the vignette decision to overlays as presentation semantics", () => {
    const hasVignette = (container: HTMLElement) =>
      Array.from(container.querySelectorAll("div")).some((element) =>
        element.style.background.includes("radial-gradient"),
      );

    const { container, rerender } = render(
      <GroundGlassTransformedOverlays
        gridEnabled={false}
        rawDebug={false}
        showDecorativeVignette={false}
        blurOpacity={0.5}
      />,
    );
    expect(hasVignette(container)).toBe(false);

    rerender(
      <GroundGlassTransformedOverlays
        gridEnabled={false}
        rawDebug={false}
        showDecorativeVignette
        blurOpacity={0.5}
      />,
    );
    expect(hasVignette(container)).toBe(true);
  });
});

describe("legacy Ground Glass presentation components", () => {
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

  it("keeps generic legacy fallback artwork available without scene identity", () => {
    const { getByTestId } = render(
      <LegacyGroundGlassScene
        sceneHasFocusTargets={false}
        projectedTargets={[]}
        blurRadiusPx={0}
        sceneShiftX={0}
        sceneShiftY={0}
        sceneRotationDeg={0}
        focusScale={1}
        riseMm={0}
        tiltDeg={0}
        swingDeg={0}
      />,
    );

    expect(getByTestId("ground-glass-scene").children).toHaveLength(3);
  });
});
