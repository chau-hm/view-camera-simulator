import { beforeEach, describe, expect, it } from "vitest";
import * as THREE from "three";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import { configureGroundGlassCamera } from "../../render/configureGroundGlassCamera";
import { projectWorldPointToFilmPlaneGroundGlass } from "../../render/groundGlassFilmPlaneProjection";
import { getGroundGlassClipRangeWorld } from "../../render/groundGlassRttScenes";
import {
  computeOpticalSectionData,
  resolveCameraBodyRailWorldEndpoints,
} from "../../components/geometry/opticalSectionProjection";
import {
  CAMERA_CONFIGURATION_COMPOSITION_TOLERANCE_UV,
  CAMERA_CONFIGURATION_DIRECT_SHIFT_MM,
  CAMERA_CONFIGURATION_PITCH_DEG,
  DEFAULT_CAMERA_CONFIGURATION_DIRECTION,
  DEFAULT_CAMERA_CONFIGURATION_MODE,
  resolveCameraConfigurationPreset,
  resolveSceneRiseRangeMm,
  UNDERSTANDING_CAMERA_MOVEMENTS_RISE_MAX_MM,
  UNDERSTANDING_CAMERA_MOVEMENTS_RISE_MIN_MM,
  type CameraConfigurationMode,
  type VerticalDirection,
} from "../../scenes/cameraConfigurationPresets";
import { understandingCameraMovementsScene } from "../../scenes/definitions/understanding-camera-movements";
import {
  CAMERA_BODY_PIVOT_WORLD,
  canonicalSubjectCubes,
} from "../../scenes/understandingCameraMovementsGeometry";
import { useAppStore } from "../../state/appStore";
import { DEFAULT_CAMERA_STATE, CAMERA_CONSTANTS } from "../../utils/constants";
import type { CameraState } from "../../types/camera";

const setup = () => {
  // Force a fresh route init so residual compound state never leaks between tests.
  useAppStore.setState({ lastInitializedRouteKey: null });
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

const cameraBase = (overrides: Partial<CameraState> = {}): CameraState => ({
  ...DEFAULT_CAMERA_STATE,
  ...understandingCameraMovementsScene.cameraPreset,
  cameraBodyPivotWorld: CAMERA_BODY_PIVOT_WORLD,
  activeSceneId: understandingCameraMovementsScene.id,
  ...overrides,
});

const projectTarget = (
  fields: Partial<CameraState>,
  target: { x: number; y: number; z: number },
) => {
  const optics = deriveOpticsState(cameraBase(fields), understandingCameraMovementsScene);
  return projectWorldPointToFilmPlaneGroundGlass({
    worldPoint: target,
    lensCenterWorld: optics.lensCenterWorld,
    filmPlaneCornersWorld: optics.filmPlaneCornersWorld,
  });
};

describe("scene rise/fall range", () => {
  it("exposes a signed -40…40 mm range only for Understanding Camera Movements", () => {
    expect(resolveSceneRiseRangeMm("understanding-camera-movements")).toEqual({
      minMm: UNDERSTANDING_CAMERA_MOVEMENTS_RISE_MIN_MM,
      maxMm: UNDERSTANDING_CAMERA_MOVEMENTS_RISE_MAX_MM,
    });
    expect(UNDERSTANDING_CAMERA_MOVEMENTS_RISE_MIN_MM).toBe(-40);
    expect(UNDERSTANDING_CAMERA_MOVEMENTS_RISE_MAX_MM).toBe(40);
    expect(resolveSceneRiseRangeMm("architecture-rise")).toEqual({
      minMm: CAMERA_CONSTANTS.riseMinMm,
      maxMm: CAMERA_CONSTANTS.riseMaxMm,
    });
    expect(CAMERA_CONSTANTS.riseMinMm).toBe(0);
  });

  it("accepts a negative direct-shift fall through the public rise setter", () => {
    setup();
    useAppStore.getState().setRise(-15.5);
    expect(useAppStore.getState().camera.frontRiseMm).toBe(-15.5);
    useAppStore.getState().setRise(-50);
    expect(useAppStore.getState().camera.frontRiseMm).toBe(-40);
    useAppStore.getState().setRise(50);
    expect(useAppStore.getState().camera.frontRiseMm).toBe(40);
  });
});

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
    "%s %s yields pitch=%s rise=%s tilt=%s/%s",
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

describe("nullable configuration selection truthfulness", () => {
  beforeEach(setup);

  it("starts with no complete preset selected", () => {
    const s = useAppStore.getState();
    expect(s.configurationMode).toBeNull();
    expect(s.configurationMode).toBe(DEFAULT_CAMERA_CONFIGURATION_MODE);
    expect(s.configurationDirection).toBe(DEFAULT_CAMERA_CONFIGURATION_DIRECTION);
    expect(s.camera.cameraBodyPitchDeg).toBe(0);
    expect(s.camera.frontRiseMm).toBe(0);
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
      expect(after.camera.focusDistanceMm).toBe(before.focusDistanceMm);
      expect(after.camera.aperture).toBe(before.aperture);
      expect(after.camera.focalLengthMm).toBe(before.focalLengthMm);
    }
  });

  it("clears the active preset when a manual movement is selected or edited", () => {
    useAppStore.getState().applyCameraConfiguration("indirect-shift", "upward");
    expect(useAppStore.getState().configurationMode).toBe("indirect-shift");

    useAppStore.getState().setSelectedMovement("frontTiltDeg");
    expect(useAppStore.getState().configurationMode).toBeNull();
    expect(useAppStore.getState().camera.cameraBodyPitchDeg).toBe(0);
  });

  it('manual body pitch invalidates active preset', () => {
    useAppStore.getState().applyCameraConfiguration('whole-camera-pitch', 'upward');
    expect(useAppStore.getState().configurationMode).toBe('whole-camera-pitch');
    expect(useAppStore.getState().camera.cameraBodyPitchDeg).toBe(-8);

    useAppStore.getState().setCameraBodyPitchDeg(-4);
    expect(useAppStore.getState().camera.cameraBodyPitchDeg).toBe(-4);
    expect(useAppStore.getState().configurationMode).toBeNull();
    expect(useAppStore.getState().configurationDirection).toBe('upward');
  });

  it('clears the active preset when a manual movement is edited', () => {
    useAppStore.getState().applyCameraConfiguration("direct-shift", "downward");
    expect(useAppStore.getState().configurationMode).toBe("direct-shift");
    useAppStore.getState().setRise(-12);
    expect(useAppStore.getState().configurationMode).toBeNull();
    expect(useAppStore.getState().camera.frontRiseMm).toBe(-12);
    expect(useAppStore.getState().camera.cameraBodyPitchDeg).toBe(0);
  });

  it("reset restores neutral values with no preset radio active", () => {
    useAppStore.getState().applyCameraConfiguration("indirect-shift", "downward");
    useAppStore.getState().resetMovements();
    const s = useAppStore.getState();
    expect(s.configurationMode).toBeNull();
    expect(s.configurationDirection).toBe("upward");
    expect(s.camera.cameraBodyPitchDeg).toBe(0);
    expect(s.camera.frontRiseMm).toBe(0);
    expect(s.camera.frontTiltDeg).toBe(0);
    expect(s.camera.rearTiltDeg).toBe(0);
    expect(s.camera.rearRiseMm).toBe(0);
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
});

describe("configuration geometry, framing calibration, and RTT", () => {
  beforeEach(setup);

  it("whole-camera pitch rotates rail and both standards together", () => {
    useAppStore.getState().applyCameraConfiguration("whole-camera-pitch", "upward");
    const o = opticsForStore();
    const pitch = -CAMERA_CONFIGURATION_PITCH_DEG;
    expect(o.cameraBodyTransform.pitchDeg).toBe(pitch);
    expectVecClose(o.lensNormalWorld, o.filmNormalWorld);
    expect(Math.abs(o.lensNormalWorld.y)).toBeGreaterThan(0.1);
    expect(o.lensNormalWorld.z).toBeLessThan(1);
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
    }
  });

  it("direct shift leaves body pitch at zero", () => {
    useAppStore.getState().applyCameraConfiguration("direct-shift", "upward");
    const o = opticsForStore();
    expect(o.cameraBodyTransform.pitchDeg).toBe(0);
    expect(o.lensCenterWorld.y).toBe(CAMERA_CONFIGURATION_DIRECT_SHIFT_MM);
    expectVecClose(o.lensNormalWorld, { x: 0, y: 0, z: 1 });
    expect(o.filmCenterWorld.y).toBe(0);
  });

  it.each(["upward", "downward"] as const)(
    "keeps shared composition target aligned within tolerance for %s",
    (direction) => {
      const target =
        direction === "upward"
          ? canonicalSubjectCubes.upper.center
          : canonicalSubjectCubes.lower.center;

      const modes: CameraConfigurationMode[] = [
        "whole-camera-pitch",
        "direct-shift",
        "indirect-shift",
      ];
      const projections = modes.map((mode) => {
        const fields = resolveCameraConfigurationPreset(mode, direction);
        const projected = projectTarget(fields, target);
        expect(projected.visible).toBe(true);
        expect(Number.isFinite(projected.uRaw)).toBe(true);
        expect(Number.isFinite(projected.vRaw)).toBe(true);
        return { mode, projected };
      });

      const reference = projections[0].projected;
      for (const { mode, projected } of projections) {
        expect(Math.abs(projected.uRaw - reference.uRaw)).toBeLessThanOrEqual(
          CAMERA_CONFIGURATION_COMPOSITION_TOLERANCE_UV,
        );
        expect(Math.abs(projected.vRaw - reference.vRaw)).toBeLessThanOrEqual(
          CAMERA_CONFIGURATION_COMPOSITION_TOLERANCE_UV,
        );
        // Keep intended optical differences even while framing matches.
        if (mode === "whole-camera-pitch") {
          const optics = deriveOpticsState(
            cameraBase(resolveCameraConfigurationPreset(mode, direction)),
            understandingCameraMovementsScene,
          );
          expect(Math.abs(optics.lensNormalWorld.y)).toBeGreaterThan(0.1);
        }
        if (mode === "direct-shift") {
          const optics = deriveOpticsState(
            cameraBase(resolveCameraConfigurationPreset(mode, direction)),
            understandingCameraMovementsScene,
          );
          expect(optics.cameraBodyTransform.pitchDeg).toBe(0);
        }
        if (mode === "indirect-shift") {
          const optics = deriveOpticsState(
            cameraBase(resolveCameraConfigurationPreset(mode, direction)),
            understandingCameraMovementsScene,
          );
          expect(Math.abs(optics.lensNormalWorld.y)).toBeLessThan(1e-10);
          expect(Math.abs(optics.cameraBodyTransform.pitchDeg)).toBe(
            CAMERA_CONFIGURATION_PITCH_DEG,
          );
        }
      }
    },
  );

  it("Ground Glass projection differs between whole-camera and corrected configs", () => {
    const measure = (mode: CameraConfigurationMode, direction: VerticalDirection) => {
      useAppStore.getState().applyCameraConfiguration(mode, direction);
      const optics = opticsForStore();
      const camera = new THREE.PerspectiveCamera();
      const clip = getGroundGlassClipRangeWorld(
        understandingCameraMovementsScene,
        optics.lensCenterWorld,
      );
      const result = configureGroundGlassCamera(camera, optics, clip.near, clip.far);
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error(result.reason);
      return {
        forwardY: result.pose.forwardWorld[1],
        upY: result.pose.upWorld[1],
        normalY: optics.lensNormalWorld.y,
        lensY: optics.lensCenterWorld.y,
      };
    };

    const whole = measure("whole-camera-pitch", "upward");
    const indirect = measure("indirect-shift", "upward");
    const direct = measure("direct-shift", "upward");

    expect(Math.abs(whole.normalY)).toBeGreaterThan(0.1);
    expect(Math.abs(indirect.normalY)).toBeLessThan(1e-10);
    expect(Math.abs(direct.normalY)).toBeLessThan(1e-10);
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
    expectVecClose(section.lensCenter, optics.lensCenterWorld);
    expect(rail?.rear.y).not.toBeCloseTo(rail?.front.y ?? 0, 6);

    const camera = new THREE.PerspectiveCamera();
    const clip = getGroundGlassClipRangeWorld(
      understandingCameraMovementsScene,
      optics.lensCenterWorld,
    );
    const gg = configureGroundGlassCamera(camera, optics, clip.near, clip.far);
    expect(gg.ok).toBe(true);
    if (gg.ok) {
      expect(gg.pose.upWorld[1]).toBeCloseTo(1, 6);
      expect(Math.abs(gg.pose.forwardWorld[1])).toBeLessThan(1e-6);
    }
  });
});

describe("configuration SPA switching", () => {
  beforeEach(setup);

  it("SPA scene switching clears compound configuration residues", () => {
    useAppStore.getState().applyCameraConfiguration("whole-camera-pitch", "upward");
    expect(useAppStore.getState().camera.cameraBodyPitchDeg).not.toBe(0);

    useAppStore.getState().initializeSimulatorRoute({
      mode: "free",
      sceneId: "architecture-rise",
    });
    const architecture = useAppStore.getState();
    expect(architecture.camera.cameraBodyPitchDeg).toBe(0);
    expect(architecture.configurationMode).toBeNull();

    useAppStore.getState().initializeSimulatorRoute({
      mode: "free",
      sceneId: "understanding-camera-movements",
    });
    const back = useAppStore.getState();
    expect(back.camera.cameraBodyPitchDeg).toBe(0);
    expect(back.camera.frontRiseMm).toBe(0);
    expect(back.configurationMode).toBeNull();
    expect(back.configurationDirection).toBe("upward");
  });
});
