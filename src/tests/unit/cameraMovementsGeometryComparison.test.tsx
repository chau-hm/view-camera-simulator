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

function buildCamera(overrides: Partial<ReturnType<typeof useAppStore.getState>['camera']> = {}) {
  return { ...useAppStore.getState().camera, ...overrides };
}

const profile = getGeometryPresentationProfile(understandingCameraMovementsScene);

describe("2D Original vs Current geometry data assertions", () => {
  beforeEach(initScene);

  function computeBoth(overrides: Partial<ReturnType<typeof useAppStore.getState>['camera']> = {}) {
    const currentCam = buildCamera(overrides);
    const originalCam = { ...currentCam, frontRiseMm: 0, rearRiseMm: 0, frontTiltDeg: 0, rearTiltDeg: 0, frontSwingDeg: 0 };
    const currentOptics = deriveOpticsState(currentCam, understandingCameraMovementsScene);
    const originalOptics = deriveOpticsState(originalCam, understandingCameraMovementsScene);
    const currentProj = computeOpticalSectionData({
      opticsState: currentOptics, scene: understandingCameraMovementsScene,
      svgWidth: 400, svgHeight: 260,
      depthWindow: { minMm: -250, maxMm: 6100 },
      lateralWindow: profile.lateralWindow, paddingPx: profile.diagramPaddingPx,
    });
    const originalProj = computeOpticalSectionData({
      opticsState: originalOptics, scene: understandingCameraMovementsScene,
      svgWidth: 400, svgHeight: 260,
      depthWindow: { minMm: -250, maxMm: 6100 },
      lateralWindow: profile.lateralWindow, paddingPx: profile.diagramPaddingPx,
    });
    return { currentOptics, originalOptics, currentProj, originalProj };
  }

  it("at zero: Original and Current centre coordinates completely overlap", () => {
    const { currentOptics, originalOptics } = computeBoth();
    expect(currentOptics.lensCenterWorld).toEqual(originalOptics.lensCenterWorld);
    expect(currentOptics.filmCenterWorld).toEqual(originalOptics.filmCenterWorld);
  });

  it("Front Rise: lens centre differs, film centre unchanged", () => {
    useAppStore.getState().setRise(20);
    const { currentOptics, originalOptics } = computeBoth({ frontRiseMm: 20 });

    expect(currentOptics.lensCenterWorld.y).toBeGreaterThan(originalOptics.lensCenterWorld.y);
    expect(currentOptics.filmCenterWorld).toEqual(originalOptics.filmCenterWorld);
  });

  it("Rear Rise: film centre differs, lens centre unchanged", () => {
    useAppStore.getState().setRearRise(20);
    const { currentOptics, originalOptics } = computeBoth({ rearRiseMm: 20 });

    expect(currentOptics.filmCenterWorld.y).toBeGreaterThan(originalOptics.filmCenterWorld.y);
    expect(currentOptics.lensCenterWorld).toEqual(originalOptics.lensCenterWorld);
  });

  it("Front Tilt: lens normal changes, lens centre unchanged", () => {
    useAppStore.getState().setTilt(5);
    const { currentOptics, originalOptics } = computeBoth({ frontTiltDeg: 5 });

    expect(currentOptics.lensNormalWorld).not.toEqual(originalOptics.lensNormalWorld);
    expect(currentOptics.lensCenterWorld).toEqual(originalOptics.lensCenterWorld);
  });

  it("Rear Tilt: film normal changes, film centre unchanged", () => {
    useAppStore.getState().setRearTilt(5);
    const { currentOptics, originalOptics } = computeBoth({ rearTiltDeg: 5 });

    expect(currentOptics.filmNormalWorld).not.toEqual(originalOptics.filmNormalWorld);
    expect(currentOptics.filmCenterWorld).toEqual(originalOptics.filmCenterWorld);
  });

  it("Reset: complete overlap after movement then reset", () => {
    useAppStore.getState().setRearRise(25);
    useAppStore.getState().resetMovements();
    const { currentOptics, originalOptics } = computeBoth();

    expect(currentOptics.lensCenterWorld).toEqual(originalOptics.lensCenterWorld);
    expect(currentOptics.filmCenterWorld).toEqual(originalOptics.filmCenterWorld);
    expect(currentOptics.lensNormalWorld).toEqual(originalOptics.lensNormalWorld);
    expect(currentOptics.filmNormalWorld).toEqual(originalOptics.filmNormalWorld);
  });

  it("Original optics remain unchanged while Current changes", () => {
    // Capture at rest
    const atRest = computeBoth();
    const restOrigLens = { ...atRest.originalOptics.lensCenterWorld };
    const restOrigFilm = { ...atRest.originalOptics.filmCenterWorld };

    // Apply movement
    useAppStore.getState().setRearRise(20);
    const moved = computeBoth({ rearRiseMm: 20 });

    // Original must NOT have changed
    expect(moved.originalOptics.lensCenterWorld).toEqual(restOrigLens);
    expect(moved.originalOptics.filmCenterWorld).toEqual(restOrigFilm);
  });

  it("both SVG layers render with referenceProjection", () => {
    const { currentOptics, originalOptics, currentProj, originalProj } = computeBoth();
    const r = render(
      <svg>
        <OpticalSectionDiagram projection={currentProj} geometryView="side" profile={profile}
          scene={understandingCameraMovementsScene} opticsState={currentOptics}
          svgWidth={400} svgHeight={260}
          referenceProjection={originalProj} referenceOpticsState={originalOptics} />
      </svg>,
    );
    expect(r.getByTestId("geometry-construction-original")).toBeDefined();
    expect(r.getByTestId("geometry-construction-current")).toBeDefined();
  });

  it("no reference produces no Original layer", () => {
    const { currentOptics, currentProj } = computeBoth();
    const r = render(
      <svg>
        <OpticalSectionDiagram projection={currentProj} geometryView="side" profile={profile}
          scene={understandingCameraMovementsScene} opticsState={currentOptics}
          svgWidth={400} svgHeight={260}
          referenceProjection={null} referenceOpticsState={null} />
      </svg>,
    );
    expect(r.queryByTestId("geometry-construction-original")).toBeNull();
    expect(r.getByTestId("geometry-construction-current")).toBeDefined();
  });
});
