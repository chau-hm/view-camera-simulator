import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { CameraMovementsSubject, createCameraMovementsGroup } from "../../render/CameraMovementsSubjectFactory";

afterEach(cleanup);

describe("Camera Movements subject factory", () => {
  it("creates a non-empty group with cube and grid", () => {
    const group = createCameraMovementsGroup();
    const children = Array.from(group.children);
    expect(children.length).toBeGreaterThanOrEqual(2);

    const cube = group.getObjectByName("camera-movements-cube");
    expect(cube).not.toBeNull();

    const grid = group.getObjectByName("camera-movements-grid");
    expect(grid).not.toBeNull();
  });

  it("renders the subject component without errors", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const view = render(<CameraMovementsSubject />);
    consoleError.mockRestore();
    expect(view.container).toBeDefined();
  });
});

import { useAppStore } from "../../state/appStore";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import { understandingCameraMovementsScene } from "../../scenes/definitions/understanding-camera-movements";

describe("Camera Movements optics derivation", () => {
  beforeAll(() => {
    useAppStore.getState().initializeSimulatorRoute({
      mode: "free",
      sceneId: "understanding-camera-movements",
    });
  });

  function buildCamera(overrides: Partial<ReturnType<typeof useAppStore.getState>["camera"]> = {}) {
    const base = useAppStore.getState().camera;
    return { ...base, ...overrides } as ReturnType<typeof useAppStore.getState>["camera"];
  }

  it("produces zero original and current overlap at rest", () => {
    const current = buildCamera();
    const currentOptics = deriveOpticsState(current, understandingCameraMovementsScene);

    const original = buildCamera({
      frontRiseMm: 0,
      rearRiseMm: 0,
      frontTiltDeg: 0,
      rearTiltDeg: 0,
      frontSwingDeg: 0,
    });
    const originalOptics = deriveOpticsState(original, understandingCameraMovementsScene);

    expect(currentOptics.lensCenterWorld).toEqual(originalOptics.lensCenterWorld);
    expect(currentOptics.filmCenterWorld).toEqual(originalOptics.filmCenterWorld);
  });

  it("front rise moves current lens but not original", () => {
    const original = buildCamera({
      frontRiseMm: 0,
      rearRiseMm: 0,
      frontTiltDeg: 0,
      rearTiltDeg: 0,
      frontSwingDeg: 0,
    });
    const originalOptics = deriveOpticsState(original, understandingCameraMovementsScene);

    const current = buildCamera({ frontRiseMm: 25 });
    const currentOptics = deriveOpticsState(current, understandingCameraMovementsScene);

    expect(currentOptics.lensCenterWorld.y).toBeGreaterThan(originalOptics.lensCenterWorld.y);
    expect(currentOptics.filmCenterWorld).toEqual(originalOptics.filmCenterWorld);
  });

  it("rear rise moves current film but not original", () => {
    const original = buildCamera({
      frontRiseMm: 0,
      rearRiseMm: 0,
      frontTiltDeg: 0,
      rearTiltDeg: 0,
      frontSwingDeg: 0,
    });
    const originalOptics = deriveOpticsState(original, understandingCameraMovementsScene);

    const current = buildCamera({ rearRiseMm: 20 });
    const currentOptics = deriveOpticsState(current, understandingCameraMovementsScene);

    expect(currentOptics.filmCenterWorld.y).toBeGreaterThan(originalOptics.filmCenterWorld.y);
    expect(currentOptics.lensCenterWorld).toEqual(originalOptics.lensCenterWorld);
  });

  it("front tilt changes lens normal but not original", () => {
    const original = buildCamera({
      frontRiseMm: 0,
      rearRiseMm: 0,
      frontTiltDeg: 0,
      rearTiltDeg: 0,
      frontSwingDeg: 0,
    });
    const originalOptics = deriveOpticsState(original, understandingCameraMovementsScene);

    const current = buildCamera({ frontTiltDeg: 5 });
    const currentOptics = deriveOpticsState(current, understandingCameraMovementsScene);

    expect(currentOptics.lensNormalWorld.y).not.toEqual(originalOptics.lensNormalWorld.y);
    expect(currentOptics.lensCenterWorld).toEqual(originalOptics.lensCenterWorld);
  });

  it("rear tilt changes film normal but not original", () => {
    const original = buildCamera({
      frontRiseMm: 0,
      rearRiseMm: 0,
      frontTiltDeg: 0,
      rearTiltDeg: 0,
      frontSwingDeg: 0,
    });
    const originalOptics = deriveOpticsState(original, understandingCameraMovementsScene);

    const current = buildCamera({ rearTiltDeg: 5 });
    const currentOptics = deriveOpticsState(current, understandingCameraMovementsScene);

    expect(currentOptics.filmNormalWorld.y).not.toEqual(originalOptics.filmNormalWorld.y);
  });

  it("cameraInspectionPlacement is present", () => {
    expect(understandingCameraMovementsScene.cameraInspectionPlacement).toBeDefined();
  });
});
