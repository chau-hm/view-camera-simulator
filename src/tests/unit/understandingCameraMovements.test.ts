import { describe, expect, it } from "vitest";
import { distance } from "../../core/math/vec";
import { getSceneById } from "../../scenes/definitions";
import { publicSceneCatalog } from "../../app/publicScenes";
import { useAppStore } from "../../state/appStore";
import { understandingCameraMovementsScene } from "../../scenes/definitions/understanding-camera-movements";
import { CAMERA_MOVEMENT_SCENE_CALIBRATION } from "../../scenes/cameraMovementSceneCalibration";
import { resolveCameraRigViewpointAnchors } from "../../scenes/cameraRigViewpointGeometry";

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

describe("Understanding Camera Movements static observer framing", () => {
  const WORLD_SCALE = 0.001;
  const FOV_DEG = 45;
  const ASPECT = 1024 / 768;

  /**
   * World-space bounds of the rigid camera body at one anchor. The anchor only
   * translates the body to the rig origin on the viewpoint arc; the body is
   * not re-rotated by the anchor angle (only body/base pitch applies).
   */
  const rigBodyBoundsAt = (anchor: ReturnType<typeof resolveCameraRigViewpointAnchors>["mid"]) => ({
    min: {
      x: anchor.rigOriginWorld.x - 90,
      y: anchor.rigOriginWorld.y - 110,
      z: anchor.rigOriginWorld.z - 154,
    },
    max: {
      x: anchor.rigOriginWorld.x + 90,
      y: anchor.rigOriginWorld.y + 140,
      z: anchor.rigOriginWorld.z + 72,
    },
  });

  const cameraMovementsBounds = () => {
    const rig = resolveCameraRigViewpointAnchors(CAMERA_MOVEMENT_SCENE_CALIBRATION.cameraRig);
    const anchors = [rig.mid, rig.high, rig.low];
    const rigPoints = anchors.flatMap((anchor) => {
      const body = rigBodyBoundsAt(anchor);
      return [body.min, body.max];
    });
    const origin = CAMERA_MOVEMENT_SCENE_CALIBRATION.subject.originWorld;
    const latticePoints = [
      { x: origin.x - 390, y: origin.y - 650, z: origin.z - 390 },
      { x: origin.x + 390, y: origin.y + 650, z: origin.z + 390 },
    ];
    const points = [...rigPoints, ...latticePoints];
    return {
      min: {
        x: Math.min(...points.map((p) => p.x)),
        y: Math.min(...points.map((p) => p.y)),
        z: Math.min(...points.map((p) => p.z)),
      },
      max: {
        x: Math.max(...points.map((p) => p.x)),
        y: Math.max(...points.map((p) => p.y)),
        z: Math.max(...points.map((p) => p.z)),
      },
    };
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

  /** Fraction of the 8 bounds corners visible within the observer FOV. */
  const visibleFraction = (
    bounds: { min: { x: number; y: number; z: number }; max: { x: number; y: number; z: number } },
    positionWorld: [number, number, number],
    targetWorld: [number, number, number],
  ): number => {
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
    let visible = 0;
    let total = 0;
    for (const x of [bounds.min.x, bounds.max.x]) {
      for (const y of [bounds.min.y, bounds.max.y]) {
        for (const z of [bounds.min.z, bounds.max.z]) {
          total += 1;
          const w = {
            x: x * WORLD_SCALE - positionWorld[0],
            y: y * WORLD_SCALE - positionWorld[1],
            z: z * WORLD_SCALE - positionWorld[2],
          };
          const depth = w.x * unitDir.x + w.y * unitDir.y + w.z * unitDir.z;
          if (depth <= 0) continue;
          const px = w.x * unitRight.x + w.y * unitRight.y + w.z * unitRight.z;
          const py = w.x * unitUp.x + w.y * unitUp.y + w.z * unitUp.z;
          if (Math.abs(py) / depth <= Math.tan(halfV) && Math.abs(px) / depth <= Math.tan(halfH)) {
            visible += 1;
          }
        }
      }
    }
    return visible / total;
  };


  it("default 3D scene framing keeps the lattice and mid/low rig in frame and the high rig substantially visible", () => {
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
    const origin = CAMERA_MOVEMENT_SCENE_CALIBRATION.subject.originWorld;
    const latticeBounds = {
      min: { x: origin.x - 390, y: origin.y - 650, z: origin.z - 390 },
      max: { x: origin.x + 390, y: origin.y + 650, z: origin.z + 390 },
    };
    // The full lattice and the mid rig must be entirely in frame.
    expect(allCornersInView(latticeBounds, positionWorld, targetWorld)).toBe(true);
    expect(allCornersInView(rigBodyBoundsAt(rig.mid), positionWorld, targetWorld)).toBe(true);
    // The high and low rigs must be substantially visible (not nearly blank/clipped).
    expect(visibleFraction(rigBodyBoundsAt(rig.high), positionWorld, targetWorld)).toBeGreaterThanOrEqual(0.5);
    expect(visibleFraction(rigBodyBoundsAt(rig.low), positionWorld, targetWorld)).toBeGreaterThanOrEqual(0.5);
  });

  it("camera inspection framing keeps the camera centred and non-clipped at high and low anchors", () => {
    const inspection = understandingCameraMovementsScene.cameraInspectionPlacement!;
    const positionWorld: [number, number, number] = [
      inspection.position.x * WORLD_SCALE,
      inspection.position.y * WORLD_SCALE,
      inspection.position.z * WORLD_SCALE,
    ];
    const targetWorld: [number, number, number] = [
      inspection.target.x * WORLD_SCALE,
      inspection.target.y * WORLD_SCALE,
      inspection.target.z * WORLD_SCALE,
    ];
    const rig = resolveCameraRigViewpointAnchors(CAMERA_MOVEMENT_SCENE_CALIBRATION.cameraRig);
    for (const anchor of [rig.mid, rig.high, rig.low]) {
      expect(
        allCornersInView(rigBodyBoundsAt(anchor), positionWorld, targetWorld),
        `inspection framing must contain the ${anchor.metadata.identity} rig`,
      ).toBe(true);
    }
  });

  it("both views are pulled back far enough to fit the full rig arc and lattice span", () => {
    const bounds = cameraMovementsBounds();
    const scenePlacement = understandingCameraMovementsScene.cameraPlacement;
    const sceneDistance = distance(
      scenePlacement.position,
      scenePlacement.target,
    );
    const inspectionPlacement = understandingCameraMovementsScene.cameraInspectionPlacement!;
    const inspectionDistance = distance(
      inspectionPlacement.position,
      inspectionPlacement.target,
    );
    const combinedY = bounds.max.y - bounds.min.y;
    const combinedZ = bounds.max.z - bounds.min.z;
    const largestSpanMm = Math.max(combinedY, combinedZ, bounds.max.x - bounds.min.x);

    expect(sceneDistance).toBeGreaterThan(largestSpanMm * 0.9);
    expect(inspectionDistance).toBeGreaterThan(largestSpanMm * 0.9);
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
