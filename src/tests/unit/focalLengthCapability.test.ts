import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CAMERA_MOVEMENT_FOCAL_LENGTH_CAPABILITY } from "../../scenes/cameraMovementLensCapability";
import { CAMERA_MOVEMENT_PUBLIC_TEACHING_CASES } from "../../scenes/cameraMovementPublicTeaching";
import { architectureRiseScene } from "../../scenes/definitions/architecture-rise";
import { understandingCameraMovementsScene } from "../../scenes/definitions/understanding-camera-movements";
import cameraMovementsGeometry from "../../scenes/understandingCameraMovementsGeometry";
import { useAppStore } from "../../state/appStore";

const initUnderstandingCameraMovements = () => {
  useAppStore.getState().clearSimulatorRouteInitialization();
  useAppStore.getState().initializeSimulatorRoute({
    mode: "free",
    sceneId: understandingCameraMovementsScene.id,
  });
};

afterEach(() => {
  useAppStore.getState().resetCamera();
});

describe("scene focal-length capability", () => {
  it("publishes only the 90 mm and 150 mm public choices with a 90 mm default", () => {
    expect(understandingCameraMovementsScene.focalLengthCapability).toEqual(
      CAMERA_MOVEMENT_FOCAL_LENGTH_CAPABILITY,
    );
    expect(understandingCameraMovementsScene.focalLengthCapability?.optionsMm).toEqual([
      90,
      150,
    ]);
    expect(understandingCameraMovementsScene.focalLengthCapability?.defaultMm).toBe(90);
  });

  it("does not opt unrelated scenes into focal-length selection", () => {
    expect(architectureRiseScene.focalLengthCapability).toBeUndefined();
  });
});

describe("canonical focal-length store policy", () => {
  beforeEach(initUnderstandingCameraMovements);

  it("updates only the canonical lens while preserving the camera state contract", () => {
    useAppStore.getState().applyCameraMovementTeachingCase("C3-high-viewpoint");
    const before = useAppStore.getState().camera;
    const railDimensionsBefore = { ...cameraMovementsGeometry.cameraBody.rail.dimensionsMm };
    useAppStore.getState().setFocalLength(150);
    const after = useAppStore.getState().camera;

    expect(after.focalLengthMm).toBe(150);
    expect(after.focusDistanceMm).toBe(2000);
    expect(after.aperture).toBe(11);
    expect(after.viewpointAnchor).toBe(before.viewpointAnchor);
    expect(after.cameraRigPlacement).toEqual(before.cameraRigPlacement);
    expect(after.frontRiseMm).toBe(before.frontRiseMm);
    expect(after.frontTiltDeg).toBe(before.frontTiltDeg);
    expect(after.rearRiseMm).toBe(before.rearRiseMm);
    expect(after.rearTiltDeg).toBe(before.rearTiltDeg);
    expect(after.cameraMovementLessonState).toEqual(before.cameraMovementLessonState);
    expect(cameraMovementsGeometry.cameraBody.rail.dimensionsMm).toEqual(railDimensionsBefore);
  });

  it("rejects unsupported values and scenes without the capability", () => {
    const store = useAppStore.getState();
    store.setFocalLength(150);
    const supportedBefore = useAppStore.getState().camera;
    store.setFocalLength(105);
    store.setFocalLength(Number.NaN);
    expect(useAppStore.getState().camera).toEqual(supportedBefore);

    store.clearSimulatorRouteInitialization();
    store.initializeSimulatorRoute({ mode: "free", sceneId: architectureRiseScene.id });
    const unrelatedBefore = useAppStore.getState().camera;
    store.setFocalLength(90);
    expect(useAppStore.getState().camera).toEqual(unrelatedBefore);
  });

  it("preserves the selected lens through every public teaching case and Reset Movements", () => {
    const store = useAppStore.getState();
    store.setFocalLength(150);

    for (const caseId of Object.keys(CAMERA_MOVEMENT_PUBLIC_TEACHING_CASES)) {
      store.applyCameraMovementTeachingCase(
        caseId as keyof typeof CAMERA_MOVEMENT_PUBLIC_TEACHING_CASES,
      );
      expect(useAppStore.getState().camera.focalLengthMm).toBe(150);
    }

    store.resetMovements();
    expect(useAppStore.getState().camera.focalLengthMm).toBe(150);
  });

  it("restores the scene default after fresh route initialization", () => {
    const store = useAppStore.getState();
    store.setFocalLength(150);
    store.clearSimulatorRouteInitialization();
    store.initializeSimulatorRoute({
      mode: "free",
      sceneId: understandingCameraMovementsScene.id,
    });
    expect(useAppStore.getState().camera.focalLengthMm).toBe(90);
  });
});
