import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useAppStore } from "../../state/appStore";
import { understandingCameraMovementsScene } from "../../scenes/definitions/understanding-camera-movements";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import { computeOpticalSectionData } from "../../components/geometry/opticalSectionProjection";
import { getGeometryPresentationProfile } from "../../components/geometry/geometryPresentationProfiles";

import OpticalSectionDiagram from "../../components/geometry/OpticalSectionDiagram";

afterEach(cleanup);

function initScene() {
  useAppStore.getState().initializeSimulatorRoute({
    mode: "free",
    sceneId: "understanding-camera-movements",
  });
}

function buildOptics(overrides: Partial<ReturnType<typeof useAppStore.getState>["camera"]> = {}) {
  const base = useAppStore.getState().camera;
  return deriveOpticsState({ ...base, ...overrides }, understandingCameraMovementsScene);
}

function buildOriginalOptics() {
  const base = useAppStore.getState().camera;
  return deriveOpticsState(
    {
      ...base,
      frontRiseMm: 0,
      rearRiseMm: 0,
      frontTiltDeg: 0,
      rearTiltDeg: 0,
      frontSwingDeg: 0,
    },
    understandingCameraMovementsScene,
  );
}

const profile = getGeometryPresentationProfile(understandingCameraMovementsScene);
const depthWindow = { minMm: -250, maxMm: 6100 };
const lateralWindow = profile.lateralWindow;
const svgWidth = 400;
const svgHeight = 260;

describe("2D Original vs Current construction", () => {
  beforeEach(initScene);

  function renderDiagram(currentOverride: Partial<ReturnType<typeof useAppStore.getState>["camera"]> = {}) {
    const currentOptics = buildOptics(currentOverride);
    const originalOptics = buildOriginalOptics();

    const currentProj = computeOpticalSectionData({
      opticsState: currentOptics,
      scene: understandingCameraMovementsScene,
      svgWidth,
      svgHeight,
      depthWindow,
      lateralWindow,
      paddingPx: profile.diagramPaddingPx,
    });

    const originalProj = computeOpticalSectionData({
      opticsState: originalOptics,
      scene: understandingCameraMovementsScene,
      svgWidth,
      svgHeight,
      depthWindow,
      lateralWindow,
      paddingPx: profile.diagramPaddingPx,
    });

    return render(
      <svg>
        <OpticalSectionDiagram
          projection={currentProj}
          geometryView="side"
          profile={profile}
          scene={understandingCameraMovementsScene}
          opticsState={currentOptics}
          svgWidth={svgWidth}
          svgHeight={svgHeight}
          referenceProjection={originalProj}
        />
      </svg>,
    );
  }

  it("renders both Original and Current layers", () => {
    const view = renderDiagram();
    expect(view.getByTestId("geometry-construction-original")).toBeDefined();
    expect(view.getByTestId("geometry-construction-current")).toBeDefined();
  });

  it("Original and Current overlap at zero movement", () => {
    const view = renderDiagram({ frontRiseMm: 0, frontTiltDeg: 0 });
    expect(view.getByTestId("geometry-construction-original")).toBeDefined();
    expect(view.getByTestId("geometry-construction-current")).toBeDefined();
  });

  it("Front Rise changes Current front construction only", () => {
    const view = renderDiagram({ frontRiseMm: 20 });
    // Both layers should exist
    expect(view.getByTestId("geometry-construction-original")).toBeDefined();
    expect(view.getByTestId("geometry-construction-current")).toBeDefined();
  });

  it("Rear Rise changes Current rear/film construction only", () => {
    const view = renderDiagram({ rearRiseMm: 15 });
    expect(view.getByTestId("geometry-construction-original")).toBeDefined();
    expect(view.getByTestId("geometry-construction-current")).toBeDefined();
  });

  it("Original layer renders at reduced opacity", () => {
    const view = renderDiagram({ frontRiseMm: 20 });
    const originalLayer = view.getByTestId("geometry-construction-original");
    const opacity = originalLayer.getAttribute("opacity");
    expect(Number(opacity)).toBeLessThan(1);
  });

  it("Current layer renders at full opacity", () => {
    const view = renderDiagram({ frontRiseMm: 20 });
    const currentLayer = view.getByTestId("geometry-construction-current");
    const opacity = currentLayer.getAttribute("opacity");
    expect(Number(opacity)).toBe(1);
  });

  it("no reference projection produces no Original layer", () => {
    const currentOptics = buildOptics();
    const currentProj = computeOpticalSectionData({
      opticsState: currentOptics,
      scene: understandingCameraMovementsScene,
      svgWidth,
      svgHeight,
      depthWindow,
      lateralWindow,
      paddingPx: profile.diagramPaddingPx,
    });

    const view = render(
      <svg>
        <OpticalSectionDiagram
          projection={currentProj}
          geometryView="side"
          profile={profile}
          scene={understandingCameraMovementsScene}
          opticsState={currentOptics}
          svgWidth={svgWidth}
          svgHeight={svgHeight}
          referenceProjection={null}
        />
      </svg>,
    );

    expect(view.queryByTestId("geometry-construction-original")).toBeNull();
    expect(view.getByTestId("geometry-construction-current")).toBeDefined();
  });
});
