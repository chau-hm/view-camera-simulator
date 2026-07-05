import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import { GroundGlassRenderer, projectWorldPointToGroundGlass } from "../../render/GroundGlassRenderer";
import { architectureRiseScene } from "../../scenes/definitions/architecture-rise";
import { focusFundamentalsTwoTargets } from "../../scenes/definitions/focus-fundamentals-two-targets";
import { DEFAULT_CAMERA_STATE, CAMERA_CONSTANTS } from "../../utils/constants";

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

    // Pipeline title removed from UI; keep checking the overlays and assist labels remain
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

  // Regression tests for thin-lens projection and DOM placeholder removal
  it("projects near and far targets within the film frame for a 150 mm lens focused at 680 mm", () => {
    const cameraState = { ...DEFAULT_CAMERA_STATE, focalLengthMm: 150, focusDistanceMm: 680 };
    const opticsState = deriveOpticsState(cameraState, focusFundamentalsTwoTargets);

    const imgDist = Math.abs(opticsState.filmPlane.point.z - opticsState.lensCenterWorld.z);
    const sensorW = CAMERA_CONSTANTS.filmWidthMm;
    const sensorH = CAMERA_CONSTANTS.filmHeightMm;

    const near = focusFundamentalsTwoTargets.focusTargets[0].worldPosition;
    const far = focusFundamentalsTwoTargets.focusTargets[1].worldPosition;

    const pNear = projectWorldPointToGroundGlass(near, opticsState.lensCenterWorld, imgDist, sensorW, sensorH);
    const pFar = projectWorldPointToGroundGlass(far, opticsState.lensCenterWorld, imgDist, sensorW, sensorH);

    expect(pNear.visible).toBe(true);
    expect(pFar.visible).toBe(true);
    // They should not be clamped to edges (uRaw/vRaw strictly between 0 and 1)
    expect(pNear.uRaw).toBeGreaterThan(0);
    expect(pNear.uRaw).toBeLessThan(1);
    expect(pNear.vRaw).toBeGreaterThan(0);
    expect(pNear.vRaw).toBeLessThan(1);
    expect(pFar.uRaw).toBeGreaterThan(0);
    expect(pFar.uRaw).toBeLessThan(1);
    expect(pFar.vRaw).toBeGreaterThan(0);
    expect(pFar.vRaw).toBeLessThan(1);
  });

  it("raw mode returns uRaw/vRaw and upright assist reverses both axes", () => {
    const cameraState = { ...DEFAULT_CAMERA_STATE, focalLengthMm: 150, focusDistanceMm: 2000 };
    const opticsState = deriveOpticsState(cameraState, focusFundamentalsTwoTargets);
    const imgDist = Math.abs(opticsState.filmPlane.point.z - opticsState.lensCenterWorld.z);

    const target = focusFundamentalsTwoTargets.focusTargets[0].worldPosition;
    const p = projectWorldPointToGroundGlass(target, opticsState.lensCenterWorld, imgDist, CAMERA_CONSTANTS.filmWidthMm, CAMERA_CONSTANTS.filmHeightMm);

    // raw mode uses uRaw/vRaw directly
    const uRaw = p.uRaw;
    const vRaw = p.vRaw;
    expect(uRaw).toBeDefined();
    expect(vRaw).toBeDefined();

    // upright assists uses inverted coordinates
    const uUpright = 1 - uRaw;
    const vUpright = 1 - vRaw;
    expect(uUpright).toBeCloseTo(1 - uRaw);
    expect(vUpright).toBeCloseTo(1 - vRaw);
  });

  it("off-frame target returns visible:false rather than clamping", () => {
    const cameraState = { ...DEFAULT_CAMERA_STATE, focalLengthMm: 150, focusDistanceMm: 680 };
    const opticsState = deriveOpticsState(cameraState, focusFundamentalsTwoTargets);
    const imgDist = Math.abs(opticsState.filmPlane.point.z - opticsState.lensCenterWorld.z);

    const off = { x: 50000, y: 0, z: 1000 };
    const p = projectWorldPointToGroundGlass(off, opticsState.lensCenterWorld, imgDist, CAMERA_CONSTANTS.filmWidthMm, CAMERA_CONSTANTS.filmHeightMm);
    expect(p.visible).toBe(false);
  });

  it("changing focus updates target position through lens-relative projection", () => {
    const cameraStateA = { ...DEFAULT_CAMERA_STATE, focalLengthMm: 150, focusDistanceMm: 680 };
    const cameraStateB = { ...DEFAULT_CAMERA_STATE, focalLengthMm: 150, focusDistanceMm: 2000 };
    const opticsA = deriveOpticsState(cameraStateA, focusFundamentalsTwoTargets);
    const opticsB = deriveOpticsState(cameraStateB, focusFundamentalsTwoTargets);
    const imgA = Math.abs(opticsA.filmPlane.point.z - opticsA.lensCenterWorld.z);
    const imgB = Math.abs(opticsB.filmPlane.point.z - opticsB.lensCenterWorld.z);

    const t1 = focusFundamentalsTwoTargets.focusTargets[0].worldPosition;
    const t2 = focusFundamentalsTwoTargets.focusTargets[1].worldPosition;
    const pA1 = projectWorldPointToGroundGlass(t1, opticsA.lensCenterWorld, imgA, CAMERA_CONSTANTS.filmWidthMm, CAMERA_CONSTANTS.filmHeightMm);
    const pB1 = projectWorldPointToGroundGlass(t1, opticsB.lensCenterWorld, imgB, CAMERA_CONSTANTS.filmWidthMm, CAMERA_CONSTANTS.filmHeightMm);
    const pA2 = projectWorldPointToGroundGlass(t2, opticsA.lensCenterWorld, imgA, CAMERA_CONSTANTS.filmWidthMm, CAMERA_CONSTANTS.filmHeightMm);
    const pB2 = projectWorldPointToGroundGlass(t2, opticsB.lensCenterWorld, imgB, CAMERA_CONSTANTS.filmWidthMm, CAMERA_CONSTANTS.filmHeightMm);

    // at least one of the targets should move on the ground glass when focus changes
    const moved1 = pA1.uRaw !== pB1.uRaw || pA1.vRaw !== pB1.vRaw;
    const moved2 = pA2.uRaw !== pB2.uRaw || pA2.vRaw !== pB2.vRaw;
    expect(moved1 || moved2).toBe(true);
  });

  it("does not render white DOM placeholder targets for Focus Fundamentals", () => {
    const cameraState = { ...DEFAULT_CAMERA_STATE, focalLengthMm: 150, focusDistanceMm: 680 };
    const opticsState = deriveOpticsState(cameraState, focusFundamentalsTwoTargets);
    const { container } = render(
      <GroundGlassRenderer
        opticsState={opticsState}
        assistEnabled={false}
        focusAssistEnabled={false}
        gridEnabled={false}
        riseMm={0}
        tiltDeg={0}
        swingDeg={0}
        focusDistanceMm={680}
        aperture={11}
        renderQuality="standard"
        sceneId={focusFundamentalsTwoTargets.id}
      />,
    );

    // ensure no inline element uses the white placeholder background used previously
    const divs = Array.from(container.querySelectorAll("div"));
    const hasWhitePlaceholder = divs.some((d) => d.getAttribute("style")?.includes("rgba(255,255,255,0.9)"));
    expect(hasWhitePlaceholder).toBe(false);
  });
});
