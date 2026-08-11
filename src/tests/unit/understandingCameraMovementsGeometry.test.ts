import { describe, expect, it } from "vitest";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import { cocDiameterMm, imageDistanceMm } from "../../core/optics/thinLensModel";
import { projectWorldPointToFilmPlaneGroundGlass } from "../../render/groundGlassFilmPlaneProjection";
import { CAMERA_MOVEMENT_LATTICE } from "../../scenes/cameraMovementLatticeGeometry";
import { CAMERA_MOVEMENT_SCENE_CALIBRATION } from "../../scenes/cameraMovementSceneCalibration";
import { architectureRiseScene } from "../../scenes/definitions/architecture-rise";
import { focusFundamentalsTwoTargets } from "../../scenes/definitions/focus-fundamentals-two-targets";
import { focusFundamentalsFocalLengthMm } from "../../scenes/focusFundamentalsTargets";
import { shelfSwingScene } from "../../scenes/definitions/shelf-swing";
import { tableTiltScene } from "../../scenes/definitions/table-tilt";
import { understandingCameraMovementsScene } from "../../scenes/definitions/understanding-camera-movements";
import geometry, {
  CAMERA_BODY_PIVOT_RIG_LOCAL,
  CAMERA_BODY_PIVOT_WORLD,
  CAMERA_BODY_RAIL_GEOMETRY,
  CAMERA_MOVEMENTS_FOCAL_CALIBRATION,
} from "../../scenes/understandingCameraMovementsGeometry";
import type { CameraState } from "../../types/camera";
import type { Bounds3, Vec3 } from "../../types/optics";
import { CAMERA_CONSTANTS, DEFAULT_CAMERA_STATE } from "../../utils/constants";

const isFinitePoint = (point: Readonly<Vec3>): boolean =>
  [point.x, point.y, point.z].every(Number.isFinite);

const containsPoint = (bounds: Readonly<Bounds3>, point: Readonly<Vec3>): boolean =>
  point.x >= bounds.min.x &&
  point.x <= bounds.max.x &&
  point.y >= bounds.min.y &&
  point.y <= bounds.max.y &&
  point.z >= bounds.min.z &&
  point.z <= bounds.max.z;

const cameraAtFocalLength = (
  focalLengthMm: number,
  overrides: Partial<CameraState> = {},
): CameraState => ({
  ...DEFAULT_CAMERA_STATE,
  ...understandingCameraMovementsScene.cameraPreset,
  viewpointAnchor: "mid",
  cameraRigPlacement: geometry.cameraRig.defaultViewpoint,
  focalLengthMm,
  activeSceneId: understandingCameraMovementsScene.id,
  ...overrides,
});

const projectCanonicalLattice = (focalLengthMm: number, overrides: Partial<CameraState> = {}) => {
  const optics = deriveOpticsState(
    cameraAtFocalLength(focalLengthMm, overrides),
    understandingCameraMovementsScene,
  );
  return CAMERA_MOVEMENT_LATTICE.vertices.map(({ positionWorld: worldPoint }) =>
    projectWorldPointToFilmPlaneGroundGlass({
      worldPoint,
      lensCenterWorld: optics.lensCenterWorld,
      filmPlaneCornersWorld: optics.filmPlaneCornersWorld,
    }),
  );
};

describe("Understanding Camera Movements canonical lattice integration", () => {
  it("publishes the central lattice and exact finite subject bounds", () => {
    expect(geometry.lattice).toBe(CAMERA_MOVEMENT_LATTICE);
    expect(geometry.subjectBounds).toBe(CAMERA_MOVEMENT_LATTICE.bounds);
    expect(isFinitePoint(geometry.subjectBounds.min)).toBe(true);
    expect(isFinitePoint(geometry.subjectBounds.max)).toBe(true);
    expect(
      CAMERA_MOVEMENT_LATTICE.vertices.every(({ positionWorld }) =>
        containsPoint(geometry.subjectBounds, positionWorld),
      ),
    ).toBe(true);
  });

  it("derives focus and provisional grid placement from central calibration", () => {
    const { subject, optics } = CAMERA_MOVEMENT_SCENE_CALIBRATION;
    expect(geometry.calibration).toBe(CAMERA_MOVEMENT_SCENE_CALIBRATION);
    expect(geometry.focusReferenceWorld).toEqual({
      x: subject.originWorld.x,
      y: subject.originWorld.y,
      z: optics.provisionalFocusDistanceMm,
    });
    expect(geometry.grid.center.x).toBe(subject.originWorld.x);
    expect(geometry.grid.center.z).toBe(subject.originWorld.z);
    expect(geometry.grid.center.y).toBeLessThan(CAMERA_MOVEMENT_LATTICE.bounds.min.y);
    expect(geometry.grid.cellSizeMm).toBe(subject.cubeSizeMm);
    expect(geometry.grid.halfExtentMm).toBeGreaterThan(
      (CAMERA_MOVEMENT_LATTICE.bounds.max.x - CAMERA_MOVEMENT_LATTICE.bounds.min.x) / 2,
    );
  });
});

describe("Understanding Camera Movements focal calibration", () => {
  it("sources provisional focal candidates and preset values from central calibration", () => {
    const { optics } = CAMERA_MOVEMENT_SCENE_CALIBRATION;
    expect(CAMERA_MOVEMENTS_FOCAL_CALIBRATION.candidateFocalLengthsMm).toBe(
      optics.focalLengthCandidatesMm,
    );
    expect(CAMERA_MOVEMENTS_FOCAL_CALIBRATION.selectedFocalLengthMm).toBe(
      optics.provisionalFocalLengthMm,
    );
    expect(geometry.cameraPreset.focalLengthMm).toBe(optics.provisionalFocalLengthMm);
    expect(geometry.cameraPreset.focusDistanceMm).toBe(optics.provisionalFocusDistanceMm);
  });

  it.each(CAMERA_MOVEMENTS_FOCAL_CALIBRATION.candidateFocalLengthsMm)(
    "keeps every lattice projection finite for provisional candidate %i mm",
    (focalLengthMm) => {
      const projections = projectCanonicalLattice(focalLengthMm);
      expect(
        projections.every(
          ({ uRaw, vRaw, filmPointWorld }) =>
            Number.isFinite(uRaw) &&
            Number.isFinite(vRaw) &&
            filmPointWorld !== null &&
            isFinitePoint(filmPointWorld),
        ),
      ).toBe(true);
    },
  );

  it.each(CAMERA_MOVEMENTS_FOCAL_CALIBRATION.candidateFocalLengthsMm)(
    "places the finite-focus film at thin-lens image distance for %i mm",
    (focalLengthMm) => {
      const optics = deriveOpticsState(
        cameraAtFocalLength(focalLengthMm),
        understandingCameraMovementsScene,
      );
      const expectedImageDistanceMm = imageDistanceMm(
        focalLengthMm,
        CAMERA_MOVEMENT_SCENE_CALIBRATION.optics.provisionalFocusDistanceMm,
      );
      expect(optics.lensCenterWorld).toEqual({ x: 0, y: 0, z: 0 });
      expect(-optics.filmCenterWorld.z).toBeCloseTo(expectedImageDistanceMm, 10);
      expect(optics.focusPlane).not.toBeNull();
      expect(optics.focusPlane?.point.z).toBeCloseTo(geometry.focusReferenceWorld.z, 10);
      expect(
        cocDiameterMm(
          focalLengthMm,
          geometry.cameraPreset.aperture,
          -optics.filmCenterWorld.z,
          geometry.focusReferenceWorld.z,
        ),
      ).toBeCloseTo(0, 12);
    },
  );

  it("keeps the provisional lattice depth within the selected f/32 depth of field", () => {
    const focalLengthMm = CAMERA_MOVEMENT_SCENE_CALIBRATION.optics.provisionalFocalLengthMm;
    const optics = deriveOpticsState(
      cameraAtFocalLength(focalLengthMm),
      understandingCameraMovementsScene,
    );
    const nearSubjectSurfaceMm = CAMERA_MOVEMENT_LATTICE.bounds.min.z;
    const farSubjectSurfaceMm = CAMERA_MOVEMENT_LATTICE.bounds.max.z;
    const physicalCircleOfConfusionMm = 0.1;
    const focusImageDistanceMm = imageDistanceMm(focalLengthMm, geometry.focusReferenceWorld.z);

    expect(optics.diagnostics.nearU).not.toBeNull();
    expect(optics.diagnostics.farU).not.toBeNull();
    expect(optics.diagnostics.nearU as number).toBeLessThan(nearSubjectSurfaceMm);
    expect(optics.diagnostics.farU as number).toBeGreaterThan(farSubjectSurfaceMm);
    expect(
      cocDiameterMm(
        focalLengthMm,
        geometry.cameraPreset.aperture,
        focusImageDistanceMm,
        nearSubjectSurfaceMm,
      ),
    ).toBeLessThanOrEqual(physicalCircleOfConfusionMm);
    expect(
      cocDiameterMm(
        focalLengthMm,
        geometry.cameraPreset.aperture,
        focusImageDistanceMm,
        farSubjectSurfaceMm,
      ),
    ).toBeLessThanOrEqual(physicalCircleOfConfusionMm);
  });

  it("keeps every lattice projection finite at supported movement endpoints", () => {
    const endpoints: Partial<CameraState>[] = [
      { frontRiseMm: CAMERA_CONSTANTS.riseMinMm },
      { frontRiseMm: CAMERA_CONSTANTS.riseMaxMm },
      { rearRiseMm: CAMERA_CONSTANTS.riseMinMm },
      { rearRiseMm: CAMERA_CONSTANTS.riseMaxMm },
      { frontTiltDeg: CAMERA_CONSTANTS.tiltMinDeg },
      { frontTiltDeg: CAMERA_CONSTANTS.tiltMaxDeg },
      { rearTiltDeg: CAMERA_CONSTANTS.tiltMinDeg },
      { rearTiltDeg: CAMERA_CONSTANTS.tiltMaxDeg },
    ];

    for (const endpoint of endpoints) {
      const projections = projectCanonicalLattice(
        CAMERA_MOVEMENT_SCENE_CALIBRATION.optics.provisionalFocalLengthMm,
        endpoint,
      );
      expect(
        projections.every(
          ({ uRaw, vRaw, filmPointWorld }) =>
            Number.isFinite(uRaw) &&
            Number.isFinite(vRaw) &&
            filmPointWorld !== null &&
            isFinitePoint(filmPointWorld),
        ),
      ).toBe(true);
    }
  });

  it("publishes the provisional focal length only for this scene", () => {
    expect(understandingCameraMovementsScene.cameraPreset.focalLengthMm).toBe(
      CAMERA_MOVEMENT_SCENE_CALIBRATION.optics.provisionalFocalLengthMm,
    );
    expect(architectureRiseScene.cameraPreset.focalLengthMm).toBeUndefined();
    expect(tableTiltScene.cameraPreset.focalLengthMm).toBeUndefined();
    expect(shelfSwingScene.cameraPreset.focalLengthMm).toBeUndefined();
    expect(focusFundamentalsTwoTargets.cameraPreset.focalLengthMm).toBe(
      focusFundamentalsFocalLengthMm,
    );
    expect(DEFAULT_CAMERA_STATE.focalLengthMm).toBe(CAMERA_CONSTANTS.focalLengthMm);
    expect(CAMERA_CONSTANTS.focalLengthMm).toBe(150);
  });
});

describe("Understanding Camera Movements body-pitch foundation", () => {
  it("preserves the calibrated pivot, rail, and local-then-rigid hierarchy", () => {
    const expectedImageDistanceMm = imageDistanceMm(
      CAMERA_MOVEMENT_SCENE_CALIBRATION.optics.provisionalFocalLengthMm,
      CAMERA_MOVEMENT_SCENE_CALIBRATION.optics.provisionalFocusDistanceMm,
    );
    expect(CAMERA_BODY_PIVOT_WORLD).toEqual({
      x: 0,
      y: -(CAMERA_CONSTANTS.frontStandardHeightMm / 2) - 20,
      z: -expectedImageDistanceMm / 2,
    });
    expect(CAMERA_BODY_PIVOT_WORLD).toBe(CAMERA_BODY_PIVOT_RIG_LOCAL);
    expect(CAMERA_BODY_RAIL_GEOMETRY.centerWorld).toBe(CAMERA_BODY_PIVOT_WORLD);
    expect(CAMERA_BODY_RAIL_GEOMETRY.dimensionsMm.z).toBeCloseTo(expectedImageDistanceMm + 120, 12);
    expect(geometry.coordinateContract.bodyPitch).toMatchObject({
      axis: "rig-local +X",
      positiveDirection: "rig-local +Z rotates toward rig-local -Y",
      hierarchy: "local standard movements, then local body pitch, then outer rig placement",
      pivotRigLocal: CAMERA_BODY_PIVOT_RIG_LOCAL,
    });
  });
});
