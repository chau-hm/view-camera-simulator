import { describe, expect, it } from "vitest";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import {
  OCCLUDED_PLANE_MATERIAL_SETTINGS,
} from "../../render/SceneRenderer";
import {
  createPlaneOrthonormalBasis,
  quaternionForPlaneNormal,
} from "../../render/planeOrientation";
import { createScheimpflugConstructionGeometry } from "../../render/scheimpflugConstructionGeometry";
import { tableTiltScene } from "../../scenes/definitions/table-tilt";
import tableTiltGeometry from "../../scenes/tableTiltGeometry";
import { DEFAULT_CAMERA_STATE } from "../../utils/constants";
import { Vector3 } from "three";

const signedDistance = (
  point: { x: number; y: number; z: number },
  plane: { point: { x: number; y: number; z: number }; normal: { x: number; y: number; z: number } },
) =>
  (point.x - plane.point.x) * plane.normal.x +
  (point.y - plane.point.y) * plane.normal.y +
  (point.z - plane.point.z) * plane.normal.z;

describe("Scheimpflug 3D construction", () => {
  const optics = deriveOpticsState(
    {
      ...DEFAULT_CAMERA_STATE,
      ...tableTiltScene.cameraPreset,
      activeSceneId: tableTiltScene.id,
      frontTiltDeg: tableTiltGeometry.tableTiltCalibration.frontTiltDeg,
      focusDistanceMm: tableTiltGeometry.tableTiltCalibration.focusDistanceMm,
    },
    tableTiltScene,
  );

  it("orients the lens helper from the derived lens-plane normal", () => {
    for (const movements of [
      { frontTiltDeg: 7, frontSwingDeg: 0 },
      { frontTiltDeg: 0, frontSwingDeg: 7 },
      { frontTiltDeg: 6, frontSwingDeg: 5 },
    ]) {
      const state = deriveOpticsState(
        {
          ...DEFAULT_CAMERA_STATE,
          ...tableTiltScene.cameraPreset,
          activeSceneId: tableTiltScene.id,
          ...movements,
        },
        tableTiltScene,
      );
      const normal = new Vector3(
        state.lensPlane.normal.x,
        state.lensPlane.normal.y,
        state.lensPlane.normal.z,
      ).normalize();
      const renderedNormal = new Vector3(0, 0, 1).applyQuaternion(
        quaternionForPlaneNormal(state.lensPlane.normal),
      );
      expect(renderedNormal.distanceTo(normal)).toBeLessThan(1e-10);
      const basis = createPlaneOrthonormalBasis(state.lensPlane.normal);
      const vectors = [basis.tangent, basis.bitangent, basis.normal].map(
        (value) => new Vector3(value.x, value.y, value.z),
      );
      vectors.forEach((value) => expect(value.length()).toBeCloseTo(1, 12));
      expect(Math.abs(vectors[0].dot(vectors[1]))).toBeLessThan(1e-12);
      expect(Math.abs(vectors[0].dot(vectors[2]))).toBeLessThan(1e-12);
      expect(Math.abs(vectors[1].dot(vectors[2]))).toBeLessThan(1e-12);
    }
  });

  it("keeps focus and DOF helper fills occluded by scene geometry", () => {
    expect(OCCLUDED_PLANE_MATERIAL_SETTINGS).toEqual({
      depthTest: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
  });

  it("clips one derived common line contained by film, lens, and focus planes", () => {
    const construction = createScheimpflugConstructionGeometry(optics, tableTiltScene);
    expect(construction).not.toBeNull();
    for (const endpoint of [construction!.commonLine.start, construction!.commonLine.end]) {
      expect(Math.abs(signedDistance(endpoint, optics.filmPlane))).toBeLessThan(1e-6);
      expect(Math.abs(signedDistance(endpoint, optics.lensPlane))).toBeLessThan(1e-6);
      expect(Math.abs(signedDistance(endpoint, optics.focusPlane!))).toBeLessThan(1e-6);
    }
    expect(construction!.filmPlane.verticesMm.length).toBeGreaterThanOrEqual(3);
    expect(construction!.lensPlane.verticesMm.length).toBeGreaterThanOrEqual(3);
    expect(construction!.focusPlane.verticesMm.length).toBeGreaterThanOrEqual(3);
  });
});
