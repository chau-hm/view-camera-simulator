import { beforeEach, describe, expect, it } from "vitest";
import * as THREE from "three";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import { configureGroundGlassCamera } from "../../render/configureGroundGlassCamera";
import { getGroundGlassClipRangeWorld } from "../../render/groundGlassRttScenes";
import { computeOpticalSectionData, resolveCameraBodyRailWorldEndpoints } from "../../components/geometry/opticalSectionProjection";
import {
  CAMERA_CONFIGURATION_DIRECT_SHIFT_MM,
  CAMERA_CONFIGURATION_PITCH_DEG,
  DEFAULT_CAMERA_CONFIGURATION_DIRECTION,
  DEFAULT_CAMERA_CONFIGURATION_MODE,
  resolveCameraConfigurationPreset,
  type CameraConfigurationMode,
  type VerticalDirection,
} from "../../scenes/cameraConfigurationPresets";
import { understandingCameraMovementsScene } from "../../scenes/definitions/understanding-camera-movements";
import { useAppStore } from "../../state/appStore";

const setup = () => {
  useAppStore.getState().initializeSimulatorRoute({
    mode: "free",
    sceneId: "understanding-camera-movements",
  });
};

const opticsForStore = () =>
  deriveOpticsState(useAppStore.getState().camera, understandingCameraMovementsScene);

const expectVecClose = (
  actual: { x: number; y: number; z: number },
  expected: { x: number; y: number; z: number },
  digits = 10,
) => {
  expect(actual.x).toBeCloseTo(expected.x, digits);
  expect(actual.y).toBeCloseTo(expected.y, digits);
  expect(actual.z).toBeCloseTo(expected.z, digits);
};

describe("resolveCameraConfigurationPreset contract", () => {
  it.each([
    ["whole-camera-pitch", "upward", -CAMERA_CONFIGURATION_PITCH_DEG, 0, 0, 0],
    ["whole-camera-pitch", "downward", CAMERA_CONFIGURATION_PITCH_DEG, 0, 0, 0],
    ["direct-shift", "upward", 0, CAMERA_CONFIGURATION_DIRECT_SHIFT_MM, 0, 0],
    ["direct-shift", "downward", 0, -CAMERA_CONFIGURATION_DIRECT_SHIFT_MM, 0, 0],
    [
      "indirect-shift",
      "upward",
      -CAMERA_CONFIGURATION_PITCH_DEG,
      0,
      CAMERA_CONFIGURATION_PITCH_DEG,
      CAMERA_CONFIGURATION_PITCH_DEG,
    ],
    [
      "indirect-shift",
      "downward",
      CAMERA_CONFIGURATION_PITCH_DEG,
      0,
      -CAMERA_CONFIGURATION_PITCH_DEG,
      -CAMERA_CONFIGURATION_PITCH_DEG,
    ],
  ] as const)(
    "%s %s yields pitch=%i rise=%i tilt=%i/%i",
    (mode, direction, pitch, rise, frontTilt, rearTilt) => {
      const fields = resolveCameraConfigurationPreset(mode, direction);
      expect(fields).toEqual({
        cameraBodyPitchDeg: pitch,
        frontRiseMm: rise,
        frontTiltDeg: frontTilt,
        frontSwingDeg: 0,
        rearRiseMm: 0,
        rearTiltDeg: rearTilt,
      });
    },
  );
});

describe("applyCameraConfiguration atomic store updates", () => {
  beforeEach(setup);

  it("starts from the neutral direct-shift baseline", () => {
    const s = useAppStore.getState();
    expect(s.configurationMode).toBe(DEFAULT_CAMERA_CONFIGURATION_MODE);
    expect(s.configurationDirection).toBe(DEFAULT_CAMERA_CONFIGURATION_DIRECTION);
    expect(s.camera.cameraBodyPitchDeg).toBe(0);
    expect(s.camera.frontRiseMm).toBe(0);
    expect(s.camera.frontTiltDeg).toBe(0);
    expect(s.camera.rearTiltDeg).toBe(0);
  });

  it.each([
    "whole-camera-pitch",
    "direct-shift",
    "indirect-shift",
  ] as const)("applies %s upward and downward atomically", (mode) => {
    for (const direction of ["upward", "downward"] as const) {
      const before = useAppStore.getState().camera;
      useAppStore.getState().applyCameraConfiguration(mode, direction);
      const after = useAppStore.getState();
      const expected = resolveCameraConfigurationPreset(mode, direction);
      expect(after.configurationMode).toBe(mode);
      expect(after.configurationDirection).toBe(direction);
      expect(after.camera.cameraBodyPitchDeg).toBe(expected.cameraBodyPitchDeg);
      expect(after.camera.frontRiseMm).toBe(expected.frontRiseMm);
      expect(after.camera.frontTiltDeg).toBe(expected.frontTiltDeg);
      expect(after.camera.rearTiltDeg).toBe(expected.rearTiltDeg);
      expect(after.camera.rearRiseMm).toBe(0);
      expect(after.camera.frontSwingDeg).toBe(0);
      // Unrelated fields preserved
      expect(after.camera.focusDistanceMm).toBe(before.focusDistanceMm);
      expect(after.camera.aperture).toBe(before.aperture);
      expect(after.camera.focalLengthMm).toBe(before.focalLengthMm);
    }
  });

  it("does not apply configuration off the demo scene", () => {
    useAppStore.getState().initializeSimulatorRoute({
      mode: "free",
      sceneId: "architecture-rise",
    });
    useAppStore.getState().applyCameraConfiguration("whole-camera-pitch", "upward");
    const s = useAppStore.getState().camera;
    expect(s.cameraBodyPitchDeg).toBe(0);
    expect(s.frontTiltDeg).toBe(0);
  });

  it("manual single-active setters clear body pitch outside presets", () => {
    useAppStore.getState().applyCameraConfiguration("indirect-shift", "upward");
    expect(useAppStore.getState().camera.cameraBodyPitchDeg).not.toBe(0);
    useAppStore.getState().setRise(12);
    const s = useAppStore.getState();
    expect(s.camera.frontRiseMm).toBe(12);
    expect(s.camera.cameraBodyPitchDeg).toBe(0);
    expect(s.camera.frontTiltDeg).toBe(0);
    expect(s.camera.rearTiltDeg).toBe(0);
    expect(s.configurationMode).toBe("direct-shift");
  });
});

describe("configuration geometry and RTT", () => {
  beforeEach(setup);

  it("whole-camera pitch rotates rail and both standards together", () => {
    useAppStore.getState().applyCameraConfiguration("whole-camera-pitch", "upward");
    const o = opticsForStore();
    const pitch = -CAMERA_CONFIGURATION_PITCH_DEG;
    expect(o.cameraBodyTransform.pitchDeg).toBe(pitch);
    expectVecClose(o.lensNormalWorld, o.filmNormalWorld);
    // Normals are pitched away from +Z (convergence/keystoning source).
    expect(Math.abs(o.lensNormalWorld.y)).toBeGreaterThan(0.1);
    expect(o.lensNormalWorld.z).toBeLessThan(1);
    // Shared body pitch: film/lens normals match, standard ups match the pitch.
    expectVecClose(o.rearStandardFrame.upWorld, {
      x: 0,
      y: Math.cos((pitch * Math.PI) / 180),
      z: Math.sin((pitch * Math.PI) / 180),
    });
  });

  it("indirect shift keeps both standards vertical in world space", () => {
    for (const direction of ["upward", "downward"] as const) {
      useAppStore.getState().applyCameraConfiguration("indirect-shift", direction);
      const o = opticsForStore();
      expect(o.cameraBodyTransform.pitchDeg).not.toBe(0);
      expectVecClose(o.lensNormalWorld, { x: 0, y: 0, z: 1 });
      expectVecClose(o.filmNormalWorld, { x: 0, y: 0, z: 1 });
      expectVecClose(o.rearStandardFrame.upWorld, { x: 0, y: 1, z: 0 });
      // Parallel corrected planes
      expect(Math.abs(o.lensNormalWorld.y)).toBeLessThan(1e-10);
      expect(Math.abs(o.filmNormalWorld.y)).toBeLessThan(1e-10);
    }
  });

  it("direct shift leaves body pitch at zero and rail concepts level", () => {
    useAppStore.getState().applyCameraConfiguration("direct-shift", "upward");
    const o = opticsForStore();
    expect(o.cameraBodyTransform.pitchDeg).toBe(0);
    expect(o.lensCenterWorld.y).toBe(CAMERA_CONFIGURATION_DIRECT_SHIFT_MM);
    expectVecClose(o.lensNormalWorld, { x: 0, y: 0, z: 1 });
    expectVecClose(o.filmNormalWorld, { x: 0, y: 0, z: 1 });
    expect(o.filmCenterWorld.y).toBe(0);
  });

  it("Ground Glass projection differs between whole-camera and corrected configs", () => {
    const clipFor = (optics: ReturnType<typeof opticsForStore>) =>
      getGroundGlassClipRangeWorld(understandingCameraMovementsScene, optics.lensCenterWorld);

    const measure = (mode: CameraConfigurationMode, direction: VerticalDirection) => {
      useAppStore.getState().applyCameraConfiguration(mode, direction);
      const optics = opticsForStore();
      const camera = new THREE.PerspectiveCamera();
      const clip = clipFor(optics);
      const result = configureGroundGlassCamera(camera, optics, clip.near, clip.far);
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error(result.reason);
      expect(Number.isFinite(result.determinant)).toBe(true);
      expect(result.left).toBeLessThan(result.right);
      expect(Math.abs(result.pose.forwardWorld[1])).toBeGreaterThanOrEqual(0);
      return {
        forwardY: result.pose.forwardWorld[1],
        upY: result.pose.upWorld[1],
        left: result.left,
        right: result.right,
        top: result.top,
        bottom: result.bottom,
        lensY: optics.lensCenterWorld.y,
        normalY: optics.lensNormalWorld.y,
      };
    };

    const whole = measure("whole-camera-pitch", "upward");
    const indirect = measure("indirect-shift", "upward");
    const direct = measure("direct-shift", "upward");

    // Whole-camera aims upward (positive camera forward Y in world meters frame of GG pose).
    expect(Math.abs(whole.normalY)).toBeGreaterThan(0.1);
    expect(Math.abs(indirect.normalY)).toBeLessThan(1e-10);
    expect(Math.abs(direct.normalY)).toBeLessThan(1e-10);

    // Pose / frustum signatures must diverge: conventional pitch vs corrected straight standards.
    expect(whole.forwardY).not.toBeCloseTo(indirect.forwardY, 6);
    expect(whole.upY).not.toBeCloseTo(1, 6);
    expect(indirect.upY).toBeCloseTo(1, 6);
    expect(direct.lensY).toBe(CAMERA_CONFIGURATION_DIRECT_SHIFT_MM);
  });

  it("2D geometry, 3D optics and RTT consume the same canonical result", () => {
    useAppStore.getState().applyCameraConfiguration("indirect-shift", "upward");
    const optics = opticsForStore();
    const section = computeOpticalSectionData({
      opticsState: optics,
      scene: understandingCameraMovementsScene,
      svgWidth: 400,
      svgHeight: 260,
      depthWindow: { minMm: -250, maxMm: 6100 },
    });
    const rail = resolveCameraBodyRailWorldEndpoints(optics, understandingCameraMovementsScene);
    expect(rail).not.toBeNull();
    expect(optics.cameraBodyTransform.pitchDeg).toBe(-CAMERA_CONFIGURATION_PITCH_DEG);
    expectVecClose(optics.lensNormalWorld, { x: 0, y: 0, z: 1 });
    // 2D section lens centre matches canonical optics.
    expectVecClose(section.lensCenter, optics.lensCenterWorld);
    // Pitched rail endpoints share the same body transform as 3D optics.
    const pitch = optics.cameraBodyTransform.pitchDeg;
    expect(pitch).not.toBe(0);
    expect(rail?.rear.y).not.toBeCloseTo(rail?.front.y ?? 0, 6);

    const camera = new THREE.PerspectiveCamera();
    const clip = getGroundGlassClipRangeWorld(
      understandingCameraMovementsScene,
      optics.lensCenterWorld,
    );
    const gg = configureGroundGlassCamera(camera, optics, clip.near, clip.far);
    expect(gg.ok).toBe(true);
    if (gg.ok) {
      // RTT pose up aligns with vertical film up (+Y).
      expect(gg.pose.upWorld[1]).toBeCloseTo(1, 6);
      expect(Math.abs(gg.pose.forwardWorld[1])).toBeLessThan(1e-6);
    }
  });
});

describe("configuration reset and scene switching", () => {
  beforeEach(setup);

  it("resetMovements restores neutral baseline configuration state", () => {
    useAppStore.getState().applyCameraConfiguration("indirect-shift", "downward");
    useAppStore.getState().resetMovements();
    const s = useAppStore.getState();
    expect(s.configurationMode).toBe("direct-shift");
    expect(s.configurationDirection).toBe("upward");
    expect(s.camera.cameraBodyPitchDeg).toBe(0);
    expect(s.camera.frontRiseMm).toBe(0);
    expect(s.camera.frontTiltDeg).toBe(0);
    expect(s.camera.rearTiltDeg).toBe(0);
    expect(s.camera.rearRiseMm).toBe(0);
  });

  it("SPA scene switching clears compound configuration residues", () => {
    useAppStore.getState().applyCameraConfiguration("whole-camera-pitch", "upward");
    expect(useAppStore.getState().camera.cameraBodyPitchDeg).not.toBe(0);

    useAppStore.getState().initializeSimulatorRoute({
      mode: "free",
      sceneId: "architecture-rise",
    });
    const architecture = useAppStore.getState();
    expect(architecture.camera.cameraBodyPitchDeg).toBe(0);
    expect(architecture.camera.frontTiltDeg).toBe(0);
    expect(architecture.camera.rearTiltDeg).toBe(0);
    expect(architecture.configurationMode).toBe("direct-shift");

    useAppStore.getState().initializeSimulatorRoute({
      mode: "free",
      sceneId: "understanding-camera-movements",
    });
    const back = useAppStore.getState();
    expect(back.camera.cameraBodyPitchDeg).toBe(0);
    expect(back.camera.frontRiseMm).toBe(0);
    expect(back.camera.frontTiltDeg).toBe(0);
    expect(back.camera.rearTiltDeg).toBe(0);
    expect(back.configurationMode).toBe("direct-shift");
    expect(back.configurationDirection).toBe("upward");
  });
});

