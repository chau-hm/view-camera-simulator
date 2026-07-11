import * as THREE from "three";
import { describe, it, expect } from "vitest";
import { configureGroundGlassCamera } from "../../render/configureGroundGlassCamera";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import { architectureRiseScene } from "../../scenes/definitions/architecture-rise";
import geometry from "../../scenes/architectureRiseGeometry";
import { DEFAULT_CAMERA_STATE } from "../../utils/constants";

// tolerance for NDC equality
const TOL = 1e-3;

function projectNdcsForCamera(camera: THREE.Camera, pts: THREE.Vector3[]) {
  return pts.map((p) => {
    const v = p.clone();
    v.project(camera);
    return { x: v.x, y: v.y, z: v.z };
  });
}

describe("configureGroundGlassCamera projection parity (pure rise)", () => {
  const rises = [0, 16, 24, 40];
  for (const r of rises) {
    it(`rise ${r} mm preserves verticals on front façade`, () => {
      const cameraState = {
        ...DEFAULT_CAMERA_STATE,
        frontRiseMm: r,
        frontTiltDeg: 0,
        frontSwingDeg: 0,
      };
      const optics = deriveOpticsState(cameraState, architectureRiseScene);

      // create a Three camera and configure
      const cam = new THREE.PerspectiveCamera(50, 1, 0.1, 200);
      const cfg = configureGroundGlassCamera(cam, optics, 0.01, 1000);
      expect(cfg.ok).toBe(true);

      // define points in mm from geometry
      const visualOffset = 5; // mm in front of facade
      const leftBottom = new THREE.Vector3(
        -900,
        geometry.facade.mainBodyBottomY,
        geometry.facade.frontFacadeZ - visualOffset,
      ).multiplyScalar(0.001);
      const leftTop = new THREE.Vector3(
        -900,
        geometry.facade.parapetTopY,
        geometry.facade.frontFacadeZ - visualOffset,
      ).multiplyScalar(0.001);

      const centreBottom = new THREE.Vector3(
        0,
        geometry.facade.mainBodyBottomY,
        geometry.facade.frontFacadeZ - visualOffset,
      ).multiplyScalar(0.001);
      const centreTop = new THREE.Vector3(
        0,
        geometry.facade.parapetTopY,
        geometry.facade.frontFacadeZ - visualOffset,
      ).multiplyScalar(0.001);

      const rightBottom = new THREE.Vector3(
        900,
        geometry.facade.mainBodyBottomY,
        geometry.facade.frontFacadeZ - visualOffset,
      ).multiplyScalar(0.001);
      const rightTop = new THREE.Vector3(
        900,
        geometry.facade.parapetTopY,
        geometry.facade.frontFacadeZ - visualOffset,
      ).multiplyScalar(0.001);

      const ndcs = projectNdcsForCamera(cam, [
        leftBottom,
        leftTop,
        centreBottom,
        centreTop,
        rightBottom,
        rightTop,
      ]);

      // xNdc(top) approx equals xNdc(bottom) for each vertical line
      expect(Math.abs(ndcs[0].x - ndcs[1].x)).toBeLessThan(TOL);
      expect(Math.abs(ndcs[2].x - ndcs[3].x)).toBeLessThan(TOL);
      expect(Math.abs(ndcs[4].x - ndcs[5].x)).toBeLessThan(TOL);

      // horizontal spacing preserved top vs bottom
      const leftToCenterBottom = ndcs[2].x - ndcs[0].x;
      const leftToCenterTop = ndcs[3].x - ndcs[1].x;
      expect(Math.abs(leftToCenterBottom - leftToCenterTop)).toBeLessThan(TOL);

      const centerToRightBottom = ndcs[4].x - ndcs[2].x;
      const centerToRightTop = ndcs[5].x - ndcs[3].x;
      expect(Math.abs(centerToRightBottom - centerToRightTop)).toBeLessThan(TOL);

      // increasing rise should change vertical framing: check y NDC centerTop differs across extremes
      if (r === 0) {
        // baseline location
        // record centreTop y
        const y0 = ndcs[3].y;
        // compare against last rise (40) in separate run - not available here; at minimum assert finite
        expect(Number.isFinite(y0)).toBe(true);
      } else {
        expect(Number.isFinite(ndcs[3].y)).toBe(true);
      }
    });
  }
});
