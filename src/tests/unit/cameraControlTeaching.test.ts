import { describe, expect, it } from "vitest";
import {
  CAMERA_CONTROL_TEACHING,
  resolveCameraControlTeachingCompletion,
} from "../../app/cameraControlTeaching";
import type { CameraState } from "../../types/camera";
import { DEFAULT_CAMERA_STATE } from "../../utils/constants";

const cameraWith = (overrides: Partial<CameraState>): CameraState => ({
  ...DEFAULT_CAMERA_STATE,
  activeSceneId: "view-camera-anatomy",
  ...overrides,
});

describe("camera control teaching registry", () => {
  it("keeps every Lesson 0 control mapped to a canonical field or control state", () => {
    expect(CAMERA_CONTROL_TEACHING).toMatchObject({
      "front-rise": {
        kind: "movement",
        movementField: "frontRiseMm",
        movementKind: "rise",
        anatomyTargets: ["front-standard"],
      },
      "front-shift": {
        kind: "movement",
        movementField: "frontShiftMm",
        movementKind: "shift",
        anatomyTargets: ["front-standard"],
      },
      "front-tilt": {
        kind: "movement",
        movementField: "frontTiltDeg",
        movementKind: "tilt",
        anatomyTargets: ["front-standard"],
      },
      "front-swing": {
        kind: "movement",
        movementField: "frontSwingDeg",
        movementKind: "swing",
        anatomyTargets: ["front-standard"],
      },
      "focus-front": {
        kind: "focus",
        focusStandard: "front",
        anatomyTargets: ["front-standard", "bellows"],
      },
      "focus-rear": {
        kind: "focus",
        focusStandard: "rear",
        anatomyTargets: ["rear-standard", "bellows"],
      },
      aperture: {
        kind: "aperture",
        anatomyTargets: ["aperture"],
      },
    });

    expect(CAMERA_CONTROL_TEACHING["rear-shift"]).toMatchObject({
      kind: "movement",
      movementField: "rearShiftMm",
    });
    expect(CAMERA_CONTROL_TEACHING["rear-swing"]).toMatchObject({
      kind: "movement",
      movementField: "rearSwingDeg",
    });
  });

  it("uses reachable canonical changes as completion evidence", () => {
    expect(resolveCameraControlTeachingCompletion("front-rise", cameraWith({}))).toBe(false);
    expect(
      resolveCameraControlTeachingCompletion("front-rise", cameraWith({ frontRiseMm: 8 })),
    ).toBe(true);
    expect(
      resolveCameraControlTeachingCompletion("front-shift", cameraWith({ frontShiftMm: -8 })),
    ).toBe(true);
    expect(
      resolveCameraControlTeachingCompletion("front-tilt", cameraWith({ frontTiltDeg: 2 })),
    ).toBe(true);
    expect(
      resolveCameraControlTeachingCompletion("front-swing", cameraWith({ frontSwingDeg: -2 })),
    ).toBe(true);
    expect(
      resolveCameraControlTeachingCompletion("focus-rear", cameraWith({
        focusStandard: "rear",
        focusDistanceMm: 2050,
      })),
    ).toBe(true);
    expect(
      resolveCameraControlTeachingCompletion("aperture", cameraWith({ aperture: 5.6 })),
    ).toBe(true);
  });
});
