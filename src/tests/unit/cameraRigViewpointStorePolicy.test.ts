import { beforeEach, describe, expect, it } from "vitest";
import { useAppStore } from "../../state/appStore";
import { resetStoreForTest } from "../helpers/resetStore";

const init = (sceneId = "understanding-camera-movements") =>
  useAppStore.getState().initializeSimulatorRoute({ mode: "free", sceneId });

describe("camera-rig viewpoint store policy", () => {
  beforeEach(resetStoreForTest);

  it("starts and restarts at the mid resolved anchor", () => {
    init();
    expect(useAppStore.getState().camera.viewpointAnchor).toBe("mid");
    expect(useAppStore.getState().camera.cameraRigPlacement).toMatchObject({
      kind: "arc-anchor",
      anchor: "mid",
    });
    useAppStore.getState().setCameraMovementViewpointAnchor("high");
    useAppStore.getState().restartTask();
    expect(useAppStore.getState().camera.viewpointAnchor).toBe("mid");
    expect(useAppStore.getState().camera.cameraRigPlacement).toMatchObject({
      kind: "arc-anchor",
      anchor: "mid",
    });
  });

  it("resets on away/back and keeps target region independent", () => {
    init();
    useAppStore.setState((s) => ({ scene: { ...s.scene, targetRegion: "upper" } }));
    useAppStore.getState().setCameraMovementViewpointAnchor("low");
    init("architecture-rise");
    init();
    expect(useAppStore.getState().camera.viewpointAnchor).toBe("mid");
    expect(useAppStore.getState().camera.cameraRigPlacement).toMatchObject({
      kind: "arc-anchor",
      anchor: "mid",
    });
    expect(useAppStore.getState().scene.targetRegion).toBe("middle");
  });

  it("atomically zeros movements and body pitch while preserving camera settings", () => {
    init();
    const store = useAppStore.getState();
    useAppStore.setState((state) => ({
      scene: { ...state.scene, targetRegion: "upper" },
      ui: { ...state.ui, groundGlassAssistEnabled: true },
    }));
    store.setRise(10); store.setCameraBodyPitchDeg(3);
    const before = useAppStore.getState().camera;
    store.setCameraMovementViewpointAnchor("high");
    const next = useAppStore.getState();
    const camera = next.camera;
    expect(camera.frontRiseMm).toBe(0);
    expect(camera.frontTiltDeg).toBe(0);
    expect(camera.frontSwingDeg).toBe(0);
    expect(camera.rearRiseMm).toBe(0);
    expect(camera.rearTiltDeg).toBe(0);
    expect(camera.cameraBodyPitchDeg).toBe(0);
    expect(camera.focalLengthMm).toBe(before.focalLengthMm);
    expect(camera.focusDistanceMm).toBe(before.focusDistanceMm);
    expect(camera.aperture).toBe(before.aperture);
    expect(camera.groundGlassAssistEnabled).toBe(before.groundGlassAssistEnabled);
    expect(next.scene.targetRegion).toBe("upper");
    expect(next.ui.groundGlassAssistEnabled).toBe(true);
  });

  it("gates standard setters at high/low, permits body pitch, and mid re-enables without restore", () => {
    init();
    const store = useAppStore.getState();
    store.setCameraMovementViewpointAnchor("low");
    store.setRise(10); store.setTilt(2); store.setSwing(2); store.setRearRise(10); store.setRearTilt(2);
    const gated = useAppStore.getState().camera;
    expect({
      frontRiseMm: gated.frontRiseMm,
      frontTiltDeg: gated.frontTiltDeg,
      frontSwingDeg: gated.frontSwingDeg,
      rearRiseMm: gated.rearRiseMm,
      rearTiltDeg: gated.rearTiltDeg,
    }).toEqual({
      frontRiseMm: 0,
      frontTiltDeg: 0,
      frontSwingDeg: 0,
      rearRiseMm: 0,
      rearTiltDeg: 0,
    });
    store.setCameraBodyPitchDeg(2);
    expect(useAppStore.getState().camera.cameraBodyPitchDeg).toBe(2);
    store.setCameraMovementViewpointAnchor("mid");
    store.setRise(7);
    expect(useAppStore.getState().camera.frontRiseMm).toBe(7);
    expect(useAppStore.getState().camera.frontTiltDeg).toBe(0);
  });

  it("preserves placement on reset, rejects invalid anchors, and ignores other scenes", () => {
    init();
    const store = useAppStore.getState();
    store.setCameraMovementViewpointAnchor("high");
    const placement = useAppStore.getState().camera.cameraRigPlacement;
    store.setRise(4); store.setCameraBodyPitchDeg(2); store.resetMovements();
    expect(useAppStore.getState().camera.cameraRigPlacement).toEqual(placement);
    expect(useAppStore.getState().camera.cameraBodyPitchDeg).toBe(0);
    const before = useAppStore.getState().camera;
    store.setCameraMovementViewpointAnchor("bad" as never);
    expect(useAppStore.getState().camera).toEqual(before);
    init("architecture-rise");
    const otherBefore = useAppStore.getState().camera;
    store.setCameraMovementViewpointAnchor("low");
    expect(useAppStore.getState().camera).toEqual(otherBefore);
  });
});
