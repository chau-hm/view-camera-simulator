import { afterEach, describe, expect, it } from "vitest";
import { useAppStore } from "../../state/appStore";
import geometry from "../../scenes/interiorCornerGeometry";

describe("Interior Corner neutral camera state", () => {
  afterEach(() => {
    useAppStore.getState().resetCamera();
  });

  it("initializes and resets the free scene to its deterministic neutral preset", () => {
    const store = useAppStore.getState();
    store.initializeSimulatorRoute({
      mode: "free",
      sceneId: "interior-corner",
      taskId: null,
    });

    expect(useAppStore.getState().camera).toMatchObject({
      activeSceneId: "interior-corner",
      activeTaskId: null,
      mode: "free",
      frontRiseMm: 0,
      frontTiltDeg: 0,
      frontSwingDeg: 0,
      rearRiseMm: 0,
      rearTiltDeg: 0,
      rearSwingDeg: 0,
      focusDistanceMm: geometry.canonicalFocusDistanceMm,
      aperture: 5.6,
      focusMode: "finite",
    });

    store.setRise(24);
    store.setSwing(3.2);
    store.setFocusDistance(geometry.wallDetails[0].z);
    store.setAperture(22);
    store.resetMovements();

    expect(useAppStore.getState().camera).toMatchObject({
      activeSceneId: "interior-corner",
      activeTaskId: null,
      frontRiseMm: 0,
      frontTiltDeg: 0,
      frontSwingDeg: 0,
      rearRiseMm: 0,
      rearTiltDeg: 0,
      rearSwingDeg: 0,
      focusDistanceMm: geometry.canonicalFocusDistanceMm,
      aperture: 5.6,
      focusMode: "finite",
    });
  });
});
