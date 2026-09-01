import { describe, expect, it } from "vitest";
import { getSceneById } from "../../scenes/definitions";
import { publicSceneCatalog } from "../../app/publicScenes";
import { useAppStore } from "../../state/appStore";
import { understandingCameraMovementsScene } from "../../scenes/definitions/understanding-camera-movements";
import { CAMERA_MOVEMENT_SCENE_CALIBRATION } from "../../scenes/cameraMovementSceneCalibration";
import { resolveCameraRigViewpointAnchors } from "../../scenes/cameraRigViewpointGeometry";
import {
  CAMERA_BODY_PIVOT_RIG_LOCAL,
  resolveCameraBodyBoundsWorld,
} from "../../scenes/understandingCameraMovementsGeometry";
import { CAMERA_MOVEMENT_LATTICE } from "../../scenes/cameraMovementLatticeGeometry";
import { CAMERA_MOVEMENT_PROVISIONAL_TEACHING_MOVEMENTS } from "../../scenes/cameraMovementTeachingCases";
import { resolveSceneViewportFraming } from "../../render/sceneViewFraming";
import type { CameraRigTransform } from "../../types/optics";

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
  });

  it("has a zero-movement camera preset", () => {
    const preset = understandingCameraMovementsScene.cameraPreset;
    expect(preset.frontRiseMm).toBe(0);
    expect(preset.rearRiseMm).toBe(0);
    expect(preset.frontTiltDeg).toBe(0);
    expect(preset.rearTiltDeg).toBe(0);
    expect(preset.frontSwingDeg).toBe(0);
    expect(preset.rearShiftMm).toBe(0);
    expect(preset.rearSwingDeg).toBe(0);
  });

  it("has a cube-and-grid subject with valid bounds", () => {
    const scene = understandingCameraMovementsScene;
    expect(scene.bounds.min.z).toBeLessThan(scene.bounds.max.z);
    expect(scene.cameraPreset.focusDistanceMm).toBeGreaterThan(0);
    expect(scene.cameraPreset.aperture).toBeGreaterThan(0);
  });
});

describe("Understanding Camera Movements static observer framing", () => {
  const WORLD_SCALE = 0.001;
  const FOV_DEG = 45;
  const ASPECT = 1024 / 768;

  /** Canonical body-pitch for each teaching anchor (0 neutral, +34 high, -34 low). */
  const bodyPitchForAnchor: Record<"mid" | "high" | "low", number> = {
    mid: 0,
    high: CAMERA_MOVEMENT_PROVISIONAL_TEACHING_MOVEMENTS.bodyPitchDeg,
    low: -CAMERA_MOVEMENT_PROVISIONAL_TEACHING_MOVEMENTS.bodyPitchDeg,
  };

  /**
   * World-space AABB of the complete camera body for one anchor, after the
   * canonical anchor placement and body-pitch transforms.
   */
  const rigBoundsForAnchor = (
    anchor: ReturnType<typeof resolveCameraRigViewpointAnchors>["mid"],
  ): ReturnType<typeof resolveCameraBodyBoundsWorld> => {
    const transform: CameraRigTransform = {
      rigOriginWorld: anchor.rigOriginWorld,
      basePitchDeg: anchor.basePitchDeg,
      bodyPitchDeg: bodyPitchForAnchor[anchor.anchor],
      bodyPitchPivotRigLocal: CAMERA_BODY_PIVOT_RIG_LOCAL,
    };
    return resolveCameraBodyBoundsWorld(transform);
  };

  const rigBoundsForEachAnchor = () => {
    const rig = resolveCameraRigViewpointAnchors(CAMERA_MOVEMENT_SCENE_CALIBRATION.cameraRig);
    return [rig.mid, rig.high, rig.low].map(rigBoundsForAnchor);
  };

  /** True when every corner of the world-space bounds is inside the observer FOV. */
  const allCornersInView = (
    bounds: { min: { x: number; y: number; z: number }; max: { x: number; y: number; z: number } },
    positionWorld: [number, number, number],
    targetWorld: [number, number, number],
  ): boolean => {
    const dir = {
      x: targetWorld[0] - positionWorld[0],
      y: targetWorld[1] - positionWorld[1],
      z: targetWorld[2] - positionWorld[2],
    };
    const length = Math.hypot(dir.x, dir.y, dir.z);
    const unitDir = { x: dir.x / length, y: dir.y / length, z: dir.z / length };
    const up = { x: 0, y: 1, z: 0 };
    const right = {
      x: unitDir.z * up.y - unitDir.y * up.z,
      y: unitDir.x * up.z - unitDir.z * up.x,
      z: unitDir.y * up.x - unitDir.x * up.y,
    };
    const rightLength = Math.hypot(right.x, right.y, right.z);
    const unitRight = { x: right.x / rightLength, y: right.y / rightLength, z: right.z / rightLength };
    const unitUp = {
      x: unitRight.y * unitDir.z - unitRight.z * unitDir.y,
      y: unitRight.z * unitDir.x - unitRight.x * unitDir.z,
      z: unitRight.x * unitDir.y - unitRight.y * unitDir.x,
    };
    const halfV = (FOV_DEG / 2) * (Math.PI / 180);
    const halfH = Math.atan(Math.tan(halfV) * ASPECT);
    for (const x of [bounds.min.x, bounds.max.x]) {
      for (const y of [bounds.min.y, bounds.max.y]) {
        for (const z of [bounds.min.z, bounds.max.z]) {
          const w = {
            x: x * WORLD_SCALE - positionWorld[0],
            y: y * WORLD_SCALE - positionWorld[1],
            z: z * WORLD_SCALE - positionWorld[2],
          };
          const depth = w.x * unitDir.x + w.y * unitDir.y + w.z * unitDir.z;
          if (depth <= 0) return false;
          const px = w.x * unitRight.x + w.y * unitRight.y + w.z * unitRight.z;
          const py = w.x * unitUp.x + w.y * unitUp.y + w.z * unitUp.z;
          if (Math.abs(py) / depth > Math.tan(halfV)) return false;
          if (Math.abs(px) / depth > Math.tan(halfH)) return false;
        }
      }
    }
    return true;
  };


  it("default 3D scene framing keeps the lattice and all three rigs fully in frame", () => {
    const placement = understandingCameraMovementsScene.cameraPlacement;
    const positionWorld: [number, number, number] = [
      placement.position.x * WORLD_SCALE,
      placement.position.y * WORLD_SCALE,
      placement.position.z * WORLD_SCALE,
    ];
    const targetWorld: [number, number, number] = [
      placement.target.x * WORLD_SCALE,
      placement.target.y * WORLD_SCALE,
      placement.target.z * WORLD_SCALE,
    ];
    // The full lattice must be entirely in frame.
    expect(allCornersInView(CAMERA_MOVEMENT_LATTICE.bounds, positionWorld, targetWorld)).toBe(true);
    // Every transformed rig bounds corner of the neutral, C3, and D3 rigs must be in frame.
    for (const bounds of rigBoundsForEachAnchor()) {
      expect(allCornersInView(bounds, positionWorld, targetWorld)).toBe(true);
    }
  });

  it("camera inspection framing keeps the camera centred and non-clipped at high and low anchors", () => {
    const rig = resolveCameraRigViewpointAnchors(CAMERA_MOVEMENT_SCENE_CALIBRATION.cameraRig);
    for (const anchor of [rig.mid, rig.high, rig.low]) {
      const transform: CameraRigTransform = {
        rigOriginWorld: anchor.rigOriginWorld,
        basePitchDeg: anchor.basePitchDeg,
        bodyPitchDeg: bodyPitchForAnchor[anchor.anchor],
        bodyPitchPivotRigLocal: CAMERA_BODY_PIVOT_RIG_LOCAL,
      };
      const inspection = resolveSceneViewportFraming({
        scene: understandingCameraMovementsScene,
        focalLengthMm: CAMERA_MOVEMENT_SCENE_CALIBRATION.optics.provisionalFocalLengthMm,
        cameraRigTransform: transform,
      }).camera;
      expect(
        allCornersInView(rigBoundsForAnchor(anchor), inspection.position, inspection.target),
        "inspection framing must contain every transformed rig corner",
      ).toBe(true);
    }
  });

  it("fails when the high or low rig is only half visible in the default 3D view", () => {
    const placement = understandingCameraMovementsScene.cameraPlacement;
    const positionWorld: [number, number, number] = [
      placement.position.x * WORLD_SCALE,
      placement.position.y * WORLD_SCALE,
      placement.position.z * WORLD_SCALE,
    ];
    const targetWorld: [number, number, number] = [
      placement.target.x * WORLD_SCALE,
      placement.target.y * WORLD_SCALE,
      placement.target.z * WORLD_SCALE,
    ];
    const rig = resolveCameraRigViewpointAnchors(CAMERA_MOVEMENT_SCENE_CALIBRATION.cameraRig);
    // The transformed high/low rigs must be entirely in view. A rig that is
    // only half visible (e.g. clipped along the bottom of the frustum) would
    // leave at least one transformed corner outside the observer FOV.
    for (const anchor of [rig.high, rig.low]) {
      expect(
        allCornersInView(rigBoundsForAnchor(anchor), positionWorld, targetWorld),
        `default 3D framing must contain the complete ${anchor.metadata.identity} rig`,
      ).toBe(true);
    }
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
