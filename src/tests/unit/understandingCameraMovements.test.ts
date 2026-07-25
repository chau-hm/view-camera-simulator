import { describe, expect, it } from "vitest";
import { getSceneById } from "../../scenes/definitions";
import { publicSceneCatalog } from "../../app/publicScenes";
import { useAppStore } from "../../state/appStore";
import { understandingCameraMovementsScene } from "../../scenes/definitions/understanding-camera-movements";

describe("Understanding Camera Movements scene definition", () => {
  it("is registered in the scene registry", () => {
    const scene = getSceneById("understanding-camera-movements");
    expect(scene).toBeDefined();
    expect(scene?.id).toBe("understanding-camera-movements");
    expect(scene?.name).toBe("Understanding Camera Movements");
  });

  it("is in the public scene catalog", () => {
    const entry = publicSceneCatalog.find(
      (e) => e.id === "understanding-camera-movements",
    );
    expect(entry).toBeDefined();
    expect(entry?.availability).toBe("available");
    expect(entry?.availableModes).toEqual(["free"]);
    expect(entry?.guidedTaskId).toBeUndefined();
  });

  it("has movementCapabilities with four supported movements", () => {
    const capabilities =
      understandingCameraMovementsScene.movementCapabilities;
    expect(capabilities).toBeDefined();
    expect(capabilities?.available).toEqual([
      "frontRiseMm",
      "rearRiseMm",
      "frontTiltDeg",
      "rearTiltDeg",
    ]);
    expect(capabilities?.selectionMode).toBe("single");
    expect(capabilities?.defaultMovement).toBe("frontRiseMm");
  });

  it("has cameraInspectionPlacement", () => {
    const placement = understandingCameraMovementsScene.cameraInspectionPlacement;
    expect(placement).toBeDefined();
    expect(placement?.position).toBeDefined();
    expect(placement?.target).toBeDefined();
  });

  it("has a zero-movement camera preset", () => {
    const preset = understandingCameraMovementsScene.cameraPreset;
    expect(preset.frontRiseMm).toBe(0);
    expect(preset.rearRiseMm).toBe(0);
    expect(preset.frontTiltDeg).toBe(0);
    expect(preset.rearTiltDeg).toBe(0);
    expect(preset.frontSwingDeg).toBe(0);
  });

  it("has a cube-and-grid subject with valid bounds", () => {
    const scene = understandingCameraMovementsScene;
    expect(scene.bounds.min.z).toBeLessThan(scene.bounds.max.z);
    expect(scene.cameraPreset.focusDistanceMm).toBeGreaterThan(0);
    expect(scene.cameraPreset.aperture).toBeGreaterThan(0);
  });
});

describe("Understanding Camera Movements store invariants", () => {
  it("initializes with default movement selected", () => {
    const store = useAppStore.getState();
    store.initializeSimulatorRoute({
      mode: "free",
      sceneId: "understanding-camera-movements",
    });
    const state = useAppStore.getState();
    expect(state.selectedMovement).toBe("frontRiseMm");
  });

  it("setSelectedMovement zeros all four supported movements", () => {
    const store = useAppStore.getState();
    store.initializeSimulatorRoute({
      mode: "free",
      sceneId: "understanding-camera-movements",
    });

    // Set a non-zero value
    useAppStore.getState().setRise(15);
    expect(useAppStore.getState().camera.frontRiseMm).toBe(15);

    // Switch movement
    useAppStore.getState().setSelectedMovement("rearRiseMm");

    // Verify all are zero
    const state = useAppStore.getState();
    expect(state.camera.frontRiseMm).toBe(0);
    expect(state.camera.rearRiseMm).toBe(0);
    expect(state.camera.frontTiltDeg).toBe(0);
    expect(state.camera.rearTiltDeg).toBe(0);
    expect(state.selectedMovement).toBe("rearRiseMm");
  });

  it("resetMovements returns to default movement and zero values", () => {
    const store = useAppStore.getState();
    store.initializeSimulatorRoute({
      mode: "free",
      sceneId: "understanding-camera-movements",
    });

    useAppStore.getState().setSelectedMovement("rearTiltDeg");
    useAppStore.getState().setRearTilt(8);
    expect(useAppStore.getState().camera.rearTiltDeg).toBe(8);

    useAppStore.getState().resetMovements();

    const state = useAppStore.getState();
    expect(state.camera.frontRiseMm).toBe(0);
    expect(state.camera.rearRiseMm).toBe(0);
    expect(state.camera.frontTiltDeg).toBe(0);
    expect(state.camera.rearTiltDeg).toBe(0);
    expect(state.selectedMovement).toBe("frontRiseMm");
  });

  it("setRearRise only affects rear rise", () => {
    const store = useAppStore.getState();
    store.initializeSimulatorRoute({
      mode: "free",
      sceneId: "understanding-camera-movements",
    });
    store.setSelectedMovement("rearRiseMm");

    store.setRearRise(20);

    const state = useAppStore.getState();
    expect(state.camera.rearRiseMm).toBe(20);
    expect(state.camera.frontRiseMm).toBe(0);
    expect(state.camera.frontTiltDeg).toBe(0);
    expect(state.camera.rearTiltDeg).toBe(0);
  });

  it("setRearTilt only affects rear tilt", () => {
    const store = useAppStore.getState();
    store.initializeSimulatorRoute({
      mode: "free",
      sceneId: "understanding-camera-movements",
    });
    store.setSelectedMovement("rearTiltDeg");

    store.setRearTilt(5);

    const state = useAppStore.getState();
    expect(state.camera.rearTiltDeg).toBe(5);
    expect(state.camera.rearRiseMm).toBe(0);
    expect(state.camera.frontTiltDeg).toBe(0);
  });

  it("setFocusDistance exits infinity mode in non-locked scene", () => {
    // Use a scene without cameraControlPolicy to test infinity focus
    const store = useAppStore.getState();
    store.initializeSimulatorRoute({
      mode: "free",
      sceneId: "architecture-rise",
    });
    useAppStore.getState().setInfinityFocus();
    expect(useAppStore.getState().camera.focusMode).toBe("infinity");

    useAppStore.getState().setFocusDistance(3000);
    expect(useAppStore.getState().camera.focusMode).toBe("finite");
    expect(useAppStore.getState().camera.focusDistanceMm).toBe(3000);
  });
});
