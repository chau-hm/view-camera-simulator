import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import { GroundGlassRenderer, projectWorldPointToGroundGlass } from "../../render/GroundGlassRenderer";
import { projectSceneFocusTargetsToGroundGlass, mapGroundGlassUvToDisplayUv } from "../../render/groundGlassTargetProjection";
import { GroundGlassViewport } from "../../components/simulator/GroundGlassViewport";
import { architectureRiseScene } from "../../scenes/definitions/architecture-rise";
import { focusFundamentalsTwoTargets } from "../../scenes/definitions/focus-fundamentals-two-targets";
import { tableTiltScene } from "../../scenes/definitions/table-tilt";
import { shelfSwingScene } from "../../scenes/definitions/shelf-swing";
import { mirrorShiftScene } from "../../scenes/definitions/mirror-shift";
import { viewCameraAnatomyScene } from "../../scenes/definitions/view-camera-anatomy";
import { DEFAULT_CAMERA_STATE, CAMERA_CONSTANTS } from "../../utils/constants";
import { isGroundGlassRttScene } from "../../render/groundGlassRttScenes";
import { useAppStore } from "../../state/appStore";
import type { GroundGlassRttRuntimeInfo } from "../../render/groundGlassRttDimensions";

describe("GroundGlassRenderer", () => {
  afterEach(() => {
    cleanup();
    useAppStore.getState().setGroundGlassRttRuntimeInfo(null);
  });

  it("renders pipeline and settings overlays", () => {
    const opticsState = deriveOpticsState(DEFAULT_CAMERA_STATE, architectureRiseScene);
    render(
      <GroundGlassRenderer
        opticsState={opticsState}
        assistEnabled={false}
        gridEnabled
        riseMm={DEFAULT_CAMERA_STATE.frontRiseMm}
        tiltDeg={DEFAULT_CAMERA_STATE.frontTiltDeg}
        swingDeg={DEFAULT_CAMERA_STATE.frontSwingDeg}
        focusDistanceMm={DEFAULT_CAMERA_STATE.focusDistanceMm}
        aperture={DEFAULT_CAMERA_STATE.aperture}
        renderQuality="standard"
        scene={architectureRiseScene}
        focalLengthMm={DEFAULT_CAMERA_STATE.focalLengthMm}
        previewMode="raw"
      />,
    );

    // The preview and physical focus-distance overlays remain visible.
    expect(screen.getByText("Ground glass preview")).toBeInTheDocument();
    expect(screen.getByTestId("ground-glass-focus-label")).toBeInTheDocument();
    expect(screen.queryByText("Focus assist")).not.toBeInTheDocument();
  });

  it("supports zoom mode (control belongs to viewport) without changing camera state", () => {
    const opticsState = deriveOpticsState(DEFAULT_CAMERA_STATE, architectureRiseScene);
    const onGroundGlassAssistEnabledChange = vi.fn();
    render(
      <GroundGlassViewport
        opticsState={opticsState}
        runtimeInfoByChannel={{
          default: null,
          "camera-movement-original": null,
          "camera-movement-current": null,
        }}
        onRuntimeInfoChange={() => undefined}
        groundGlassAssistEnabled={false}
        onGroundGlassAssistEnabledChange={onGroundGlassAssistEnabledChange}
        gridEnabled={false}
        canToggleGrid={true}
        riseMm={10}
        tiltDeg={2}
        swingDeg={-1}
        focusDistanceMm={2500}
        aperture={11}
        renderQuality="low"
        scene={architectureRiseScene}
        focalLengthMm={DEFAULT_CAMERA_STATE.focalLengthMm}
        expanded={false}
        restoreFocusOnCollapse={true}
        onRequestExpand={() => undefined}
        onRequestRestore={() => undefined}
      />,
    );

    const zoomIn = screen.getByRole("button", { name: "Zoom in Ground Glass" });
    fireEvent.click(zoomIn);
    expect(screen.getByRole("button", { name: "Reset Ground Glass view" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "Upright Assist" }));
    expect(onGroundGlassAssistEnabledChange).toHaveBeenCalledWith(true);
  });

  it("updates the preview when focus and movement controls change", () => {
    const opticsState = deriveOpticsState(DEFAULT_CAMERA_STATE, architectureRiseScene);
    const { rerender } = render(
      <GroundGlassRenderer
        opticsState={opticsState}
        assistEnabled={false}
        gridEnabled={false}
        riseMm={0}
        tiltDeg={0}
        swingDeg={0}
        focusDistanceMm={2000}
        aperture={11}
        renderQuality="standard"
        previewMode="raw"
        scene={architectureRiseScene}
        focalLengthMm={DEFAULT_CAMERA_STATE.focalLengthMm}
      />,
    );

    // Architecture Rise uses the canonical RTT surface without DOM focus overlays.
    expect(screen.getByTestId("ground-glass-rtt")).toBeInTheDocument();
    expect(screen.queryByTestId("ground-glass-focus-ring")).not.toBeInTheDocument();

    rerender(
      <GroundGlassRenderer
        opticsState={opticsState}
        assistEnabled={false}
        gridEnabled={false}
        riseMm={24}
        tiltDeg={4}
        swingDeg={-3}
        focusDistanceMm={4200}
        aperture={32}
        renderQuality="standard"
        previewMode="raw"
        scene={architectureRiseScene}
        focalLengthMm={DEFAULT_CAMERA_STATE.focalLengthMm}
      />,
    );

    expect(screen.getByTestId("ground-glass-rtt")).toBeInTheDocument();
    expect(screen.getByText(/4200\.0 mm focus/)).toBeInTheDocument();
  });

  it("routes Table Tilt exclusively through RTT", () => {
    const camera = {
      ...DEFAULT_CAMERA_STATE,
      ...tableTiltScene.cameraPreset,
      activeSceneId: tableTiltScene.id,
    };
    const opticsState = deriveOpticsState(camera, tableTiltScene);
    const { rerender } = render(
      <GroundGlassRenderer
        opticsState={opticsState}
        assistEnabled={false}
        gridEnabled={false}
        riseMm={camera.frontRiseMm}
        tiltDeg={camera.frontTiltDeg}
        swingDeg={camera.frontSwingDeg}
        focusDistanceMm={camera.focusDistanceMm}
        aperture={camera.aperture}
        renderQuality="standard"
        previewMode="raw"
        scene={tableTiltScene}
        focalLengthMm={camera.focalLengthMm}
      />,
    );

    expect(screen.getAllByTestId("ground-glass-rtt")).toHaveLength(1);
    expect(screen.queryByTestId("ground-glass-focus-ring")).not.toBeInTheDocument();
    tableTiltScene.focusTargets.forEach((target) => {
      expect(screen.queryByTestId(`ground-glass-target-${target.id}`)).not.toBeInTheDocument();
    });

    rerender(
      <GroundGlassRenderer
        opticsState={opticsState}
        assistEnabled={false}
        gridEnabled={false}
        riseMm={camera.frontRiseMm}
        tiltDeg={camera.frontTiltDeg}
        swingDeg={camera.frontSwingDeg}
        focusDistanceMm={camera.focusDistanceMm}
        aperture={camera.aperture}
        renderQuality="standard"
        previewMode="upright"
        scene={tableTiltScene}
        focalLengthMm={camera.focalLengthMm}
      />,
    );
    expect(screen.getAllByTestId("ground-glass-rtt")).toHaveLength(1);
    expect(screen.queryByTestId("ground-glass-focus-ring")).not.toBeInTheDocument();
  });

  it("routes Shelf Swing exclusively through RTT", () => {
    const camera = {
      ...DEFAULT_CAMERA_STATE,
      ...shelfSwingScene.cameraPreset,
      activeSceneId: shelfSwingScene.id,
    };
    const opticsState = deriveOpticsState(camera, shelfSwingScene);
    render(
      <GroundGlassRenderer
        opticsState={opticsState}
        assistEnabled={false}
        gridEnabled={false}
        riseMm={camera.frontRiseMm}
        tiltDeg={camera.frontTiltDeg}
        swingDeg={camera.frontSwingDeg}
        focusDistanceMm={camera.focusDistanceMm}
        aperture={camera.aperture}
        renderQuality="standard"
        previewMode="raw"
        scene={shelfSwingScene}
        focalLengthMm={camera.focalLengthMm}
      />,
    );

    expect(isGroundGlassRttScene(shelfSwingScene.id)).toBe(true);
    expect(screen.getAllByTestId("ground-glass-rtt")).toHaveLength(1);
    expect(screen.queryByTestId("ground-glass-focus-ring")).not.toBeInTheDocument();
    shelfSwingScene.focusTargets.forEach((target) => {
      expect(screen.queryByTestId(`ground-glass-target-${target.id}`)).not.toBeInTheDocument();
    });
  });

  it("routes Mirror Shift through the normal RTT surface", () => {
    const camera = {
      ...DEFAULT_CAMERA_STATE,
      ...mirrorShiftScene.cameraPreset,
      activeSceneId: mirrorShiftScene.id,
      activeTaskId: null,
      mode: "free" as const,
    };
    const opticsState = deriveOpticsState(camera, mirrorShiftScene);
    render(
      <GroundGlassRenderer
        opticsState={opticsState}
        assistEnabled={false}
        gridEnabled={false}
        riseMm={0}
        tiltDeg={0}
        swingDeg={0}
        focusDistanceMm={camera.focusDistanceMm}
        aperture={camera.aperture}
        renderQuality="standard"
        previewMode="raw"
        scene={mirrorShiftScene}
        focalLengthMm={camera.focalLengthMm}
      />,
    );

    expect(isGroundGlassRttScene(mirrorShiftScene.id)).toBe(true);
    expect(screen.getAllByTestId("ground-glass-rtt")).toHaveLength(1);
  });

  it("routes Lesson 0 through RTT", () => {
    const camera = {
      ...DEFAULT_CAMERA_STATE,
      ...viewCameraAnatomyScene.cameraPreset,
      activeSceneId: viewCameraAnatomyScene.id,
      activeTaskId: null,
      mode: "free" as const,
    };
    const opticsState = deriveOpticsState(camera, viewCameraAnatomyScene);

    render(
      <GroundGlassRenderer
        opticsState={opticsState}
        assistEnabled={false}
        gridEnabled={false}
        riseMm={camera.frontRiseMm}
        tiltDeg={camera.frontTiltDeg}
        swingDeg={camera.frontSwingDeg}
        focusDistanceMm={camera.focusDistanceMm}
        aperture={camera.aperture}
        renderQuality="standard"
        previewMode="raw"
        scene={viewCameraAnatomyScene}
        focalLengthMm={camera.focalLengthMm}
      />,
    );

    expect(isGroundGlassRttScene(viewCameraAnatomyScene.id)).toBe(true);
    expect(screen.getByTestId("ground-glass-rtt")).toHaveAttribute(
      "data-rtt-scene-id",
      viewCameraAnatomyScene.id,
    );
  });

  it("preserves an explicit null diagnostics value instead of consulting application state", () => {
    useAppStore
      .getState()
      .setGroundGlassRttRuntimeInfo({ resourceGeneration: 99 } as GroundGlassRttRuntimeInfo, "store-owner");
    const opticsState = deriveOpticsState(DEFAULT_CAMERA_STATE, architectureRiseScene);

    render(
      <GroundGlassRenderer
        opticsState={opticsState}
        assistEnabled={false}
        gridEnabled={false}
        riseMm={0}
        tiltDeg={0}
        swingDeg={0}
        focusDistanceMm={DEFAULT_CAMERA_STATE.focusDistanceMm}
        aperture={DEFAULT_CAMERA_STATE.aperture}
        renderQuality="standard"
        scene={architectureRiseScene}
        focalLengthMm={DEFAULT_CAMERA_STATE.focalLengthMm}
        runtimeInfo={null}
        previewMode="raw"
      />,
    );

    expect(screen.getByTestId("ground-glass-rtt")).not.toHaveAttribute(
      "data-rtt-resource-generation",
    );
  });

  it("uses matching physical point and patch metrics in Table Tilt labels", () => {
    const camera = {
      ...DEFAULT_CAMERA_STATE,
      ...tableTiltScene.cameraPreset,
      activeSceneId: tableTiltScene.id,
    };
    const derived = deriveOpticsState(camera, tableTiltScene);
    const opticsState = {
      ...derived,
      focusTargets: derived.focusTargets.map((target, index) =>
        index === 0
          ? {
              ...target,
              pointSharpness: 0.1,
              pointNormalizedDefocus: 4,
              patchSharpness: 0.9,
              patchNormalizedDefocus: 0.1,
              normalizedDefocus: 0.1,
              physicalPointSharpness: 1,
              physicalPointStatus: "sharp" as const,
              pointEquivalentCoCDiameterMm: 0,
              physicalPatchSharpness: 0,
              physicalPatchStatus: "soft" as const,
              patchEquivalentCoCDiameterMm: 0.2,
            }
          : target,
      ),
    };
    const props = {
      opticsState,
      assistEnabled: false,
      gridEnabled: false,
      riseMm: camera.frontRiseMm,
      tiltDeg: camera.frontTiltDeg,
      swingDeg: camera.frontSwingDeg,
      focusDistanceMm: camera.focusDistanceMm,
      aperture: camera.aperture,
      renderQuality: "standard" as const,
      previewMode: "raw" as const,
      scene: tableTiltScene,
      focalLengthMm: camera.focalLengthMm,
    };
    const view = render(<GroundGlassRenderer {...props} focusMetric="point" />);
    expect(screen.getByText(/CoC 0\.000 mm \(100%\)/)).toBeInTheDocument();
    view.rerender(<GroundGlassRenderer {...props} focusMetric="patch" />);
    expect(screen.getByText(/CoC 0\.200 mm \(0%\)/)).toBeInTheDocument();
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

  it("display mapping: raw applies physical inversion; upright uses non-inverted coordinates", () => {
    // Test A: mapGroundGlassUvToDisplayUv produces expected raw/upright mapping
    const raw = { u: 0.25, v: 0.4 };
    const mappedRaw = mapGroundGlassUvToDisplayUv(raw, "raw");
    expect(mappedRaw.u).toBeCloseTo(0.75);
    expect(mappedRaw.v).toBeCloseTo(0.6);
    const mappedUpright = mapGroundGlassUvToDisplayUv(raw, "upright");
    expect(mappedUpright.u).toBeCloseTo(0.25);
    expect(mappedUpright.v).toBeCloseTo(0.4);

    // Legacy assertions for backward compatibility using projectWorldPointToGroundGlass
    const cameraState = { ...DEFAULT_CAMERA_STATE, focalLengthMm: 150, focusDistanceMm: 2000 };
    const opticsState = deriveOpticsState(cameraState, focusFundamentalsTwoTargets);
    const imgDist = Math.abs(opticsState.filmPlane.point.z - opticsState.lensCenterWorld.z);

    const target = focusFundamentalsTwoTargets.focusTargets[0].worldPosition;
    const p = projectWorldPointToGroundGlass(target, opticsState.lensCenterWorld, imgDist, CAMERA_CONSTANTS.filmWidthMm, CAMERA_CONSTANTS.filmHeightMm);

    // raw display mapping in this app uses physical inversion (1 - u/v)
    const uRaw = p.uRaw;
    const vRaw = p.vRaw;
    const displayRawU = 1 - uRaw;
    const displayRawV = 1 - vRaw;
    expect(displayRawU).toBeGreaterThanOrEqual(0);
    expect(displayRawU).toBeLessThanOrEqual(1);
    expect(displayRawV).toBeGreaterThanOrEqual(0);
    expect(displayRawV).toBeLessThanOrEqual(1);

    // upright mapping is non-inverted (same as uRaw/vRaw)
    const displayUprightU = uRaw;
    const displayUprightV = vRaw;
    expect(displayUprightU).toBeCloseTo(uRaw);
    expect(displayUprightV).toBeCloseTo(vRaw);
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

  // New Test: shared projection returns valid raw UV for Focus Fundamentals RTT target
  it("shared projection returns valid raw UV for Focus Fundamentals RTT target", () => {
    const cameraState = {
      ...DEFAULT_CAMERA_STATE,
      focalLengthMm: 150,
      focusDistanceMm: 680,
    };

    const opticsState = deriveOpticsState(cameraState, focusFundamentalsTwoTargets);

    const projected = projectSceneFocusTargetsToGroundGlass({
      sceneDef: focusFundamentalsTwoTargets,
      opticsState,
      aperture: cameraState.aperture,
      previewMode: "raw",
    });

    expect(projected.length).toBeGreaterThan(0);
    expect(projected[0].visible).toBe(true);
    expect(projected[0].rawUv.u).toBeGreaterThanOrEqual(0);
    expect(projected[0].rawUv.u).toBeLessThanOrEqual(1);
    expect(projected[0].rawUv.v).toBeGreaterThanOrEqual(0);
    expect(projected[0].rawUv.v).toBeLessThanOrEqual(1);
  });

  // Test B: projected targets expose rawUv and displayUv
  it("projected targets include rawUv and displayUv fields", () => {
    const opticsState = deriveOpticsState(DEFAULT_CAMERA_STATE, architectureRiseScene);
    const projected = projectSceneFocusTargetsToGroundGlass({ sceneDef: architectureRiseScene, opticsState, aperture: DEFAULT_CAMERA_STATE.aperture, previewMode: "upright" });
    expect(projected.length).toBeGreaterThan(0);
    for (const pt of projected) {
      expect(pt).toHaveProperty("id");
      expect(pt).toHaveProperty("visible");
      expect(pt).toHaveProperty("rawUv");
      expect(pt).toHaveProperty("displayUv");
      expect(pt).toHaveProperty("leftPercent");
      expect(pt).toHaveProperty("topPercent");
      expect(pt).toHaveProperty("blurStrengthAtTarget");
    }
  });

  // Test C: RTT and focus-ring projection remain available from the same inputs.
  it("keeps Architecture RTT projection targets available", () => {
    const opticsState = deriveOpticsState(DEFAULT_CAMERA_STATE, architectureRiseScene);
    const projected = projectSceneFocusTargetsToGroundGlass({ sceneDef: architectureRiseScene, opticsState, aperture: DEFAULT_CAMERA_STATE.aperture, previewMode: "raw" });
    expect(projected.length).toBeGreaterThan(0);

    render(
      <GroundGlassRenderer
        opticsState={opticsState}
        assistEnabled={false}
        gridEnabled={false}
        riseMm={0}
        tiltDeg={0}
        swingDeg={0}
        focusDistanceMm={2000}
        aperture={DEFAULT_CAMERA_STATE.aperture}
        renderQuality="standard"
        previewMode="raw"
        scene={architectureRiseScene}
        focalLengthMm={DEFAULT_CAMERA_STATE.focalLengthMm}
      />,
    );

    // Architecture Rise should route to RTT without DOM focus overlays.
    expect(screen.getByTestId("ground-glass-rtt")).toBeInTheDocument();
    expect(screen.queryByTestId("ground-glass-focus-ring")).not.toBeInTheDocument();
    const placeholders = Array.from(document.querySelectorAll('[data-testid^="ground-glass-target-"]')) as HTMLElement[];
    expect(placeholders.length).toBe(0);
  });

  it("does not render white DOM placeholder targets for Focus Fundamentals", () => {
    const cameraState = { ...DEFAULT_CAMERA_STATE, focalLengthMm: 150, focusDistanceMm: 680 };
    const opticsState = deriveOpticsState(cameraState, focusFundamentalsTwoTargets);
    const { container } = render(
      <GroundGlassRenderer
        opticsState={opticsState}
        assistEnabled={false}
        gridEnabled={false}
        riseMm={0}
        tiltDeg={0}
        swingDeg={0}
        focusDistanceMm={680}
        aperture={11}
        renderQuality="standard"
        scene={focusFundamentalsTwoTargets}
        focalLengthMm={cameraState.focalLengthMm}
        previewMode="raw"
      />,
    );

    // ensure no inline element uses the white placeholder background used previously
    const divs = Array.from(container.querySelectorAll("div"));
    const hasWhitePlaceholder = divs.some((d) => d.getAttribute("style")?.includes("rgba(255,255,255,0.9)"));
    expect(hasWhitePlaceholder).toBe(false);
  });

  it('extracted renderer structure preserves visible renderer pieces', () => {
    const opticsState = deriveOpticsState(DEFAULT_CAMERA_STATE, architectureRiseScene);
    render(
      <GroundGlassRenderer
        opticsState={opticsState}
        assistEnabled={false}
        gridEnabled={false}
        riseMm={0}
        tiltDeg={0}
        swingDeg={0}
        focusDistanceMm={DEFAULT_CAMERA_STATE.focusDistanceMm}
        aperture={DEFAULT_CAMERA_STATE.aperture}
        renderQuality="standard"
        previewMode="raw"
        scene={architectureRiseScene}
        focalLengthMm={DEFAULT_CAMERA_STATE.focalLengthMm}
      />,
    );

    // Architecture Rise uses RTT.
    expect(screen.getByTestId("ground-glass-rtt")).toBeInTheDocument();
    expect(screen.queryByTestId("ground-glass-focus-ring")).not.toBeInTheDocument();
    expect(screen.getByText("Ground glass preview")).toBeInTheDocument();
  });

  it('focus fundamentals still routes to RTT only', () => {
    const cameraState = { ...DEFAULT_CAMERA_STATE, focalLengthMm: 150, focusDistanceMm: 680 };
    const opticsState = deriveOpticsState(cameraState, focusFundamentalsTwoTargets);
    const { container } = render(
      <GroundGlassRenderer
        opticsState={opticsState}
        assistEnabled={false}
        gridEnabled={false}
        riseMm={0}
        tiltDeg={0}
        swingDeg={0}
        focusDistanceMm={680}
        aperture={11}
        renderQuality="standard"
        scene={focusFundamentalsTwoTargets}
        focalLengthMm={cameraState.focalLengthMm}
        previewMode="raw"
      />,
    );

    expect(screen.getByTestId("ground-glass-rtt")).toBeInTheDocument();
    expect(screen.queryByTestId("ground-glass-focus-ring")).not.toBeInTheDocument();
    expect(
      Array.from(container.querySelectorAll("div")).some((element) =>
        element.getAttribute("style")?.includes("radial-gradient"),
      ),
    ).toBe(false);
  });
});
