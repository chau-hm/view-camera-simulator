import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import {
  createRegisteredSceneAsset,
  disposeRegisteredSceneAsset,
  TABLE_TILT_ASSET_KEY,
} from "../../render/assets/sceneAssetRegistry";
import { toWorld } from "../../render/rttUtils";
import { tableTiltScene } from "../../scenes/definitions/table-tilt";
import { TABLE_TILT_PRESENTATION } from "../../scenes/presentation/tableTilt";
import geometry, { type TableTiltVec3 } from "../../scenes/tableTiltGeometry";
import { CAMERA_CONSTANTS, DEFAULT_CAMERA_STATE } from "../../utils/constants";

const registration = { presentation: TABLE_TILT_PRESENTATION };
const calibration = geometry.tableTiltCalibration;
const vectorInWorld = ({ x, y, z }: TableTiltVec3) =>
  new THREE.Vector3(toWorld(x), toWorld(y), toWorld(z));

function withMountedTableTilt(assert: (group: THREE.Group) => void) {
  const scene = new THREE.Scene();
  const subject = createRegisteredSceneAsset(TABLE_TILT_ASSET_KEY, registration);
  scene.add(subject);
  scene.updateMatrixWorld(true);
  try {
    assert(subject);
  } finally {
    scene.remove(subject);
    disposeRegisteredSceneAsset(TABLE_TILT_ASSET_KEY, subject);
  }
}

const lensFor = (frontTiltDeg: number, focusDistanceMm: number) =>
  vectorInWorld(deriveOpticsState({
    ...DEFAULT_CAMERA_STATE,
    ...tableTiltScene.cameraPreset,
    activeSceneId: tableTiltScene.id,
    frontTiltDeg,
    focusDistanceMm,
  }, tableTiltScene).lensCenterWorld);

const diagnosticNames = [
  /-focus-card-(?:surface|(?:fine-)?band-\d+)$/,
  /-(?:line-pattern-surface|(?:fine-)?line-\d+)$/,
  /-(?:focus-chart-surface|chart-\d+-\d+|fine-grid-\d+-\d+)$/,
];

function verifySampleRay(
  root: THREE.Group,
  lens: THREE.Vector3,
  target: THREE.Vector3,
  subjectName: string,
  diagnosticName: RegExp,
) {
  const isDiagnostic = (object: THREE.Object3D) =>
    object.name.startsWith(subjectName + "-") && diagnosticName.test(object.name);
  // The canonical markers are above the ink. Locate the rendered patch at the
  // exact sample X/Z before casting from the lens. Extending a shallow ray
  // through an elevated far-edge marker would overshoot the physical chart.
  const surface = new THREE.Raycaster(target, new THREE.Vector3(0, -1, 0), 0, toWorld(10))
    .intersectObject(root, true).find(({ object }) => isDiagnostic(object));
  if (!surface) throw new Error(subjectName + " has no diagnostic under its canonical sample");
  const direction = surface.point.clone().sub(lens).normalize();
  const ray = new THREE.Raycaster(lens, direction);
  const hit = ray.intersectObject(root, true).find(({ object }) =>
    object.visible && object instanceof THREE.Mesh &&
    [object.material].flat().some((material) => material.visible && material.opacity > 0),
  );
  if (!hit || !isDiagnostic(hit.object)) {
    throw new Error(subjectName + " diagnostic was occluded by " + (hit?.object.name ?? "a missing surface"));
  }
  const mesh = hit.object as THREE.Mesh<THREE.BoxGeometry>;
  mesh.geometry.computeBoundingBox();
  const inverse = mesh.matrixWorld.clone().invert();
  const localRay = ray.ray.clone().applyMatrix4(inverse);
  // Intersect the diagnostic's Float32 bounds independently of its triangles.
  // This includes the vertical faces of raised bands and chart cells.
  const localEntry = localRay.intersectBox(mesh.geometry.boundingBox!, new THREE.Vector3());
  expect(localEntry).not.toBeNull();
  const expected = mesh.localToWorld(localEntry!);
  expect(hit.point.distanceTo(expected)).toBeLessThan(1e-10);
  expect(hit.distance).toBeCloseTo(lens.distanceTo(expected), 10);
  expect(hit.distance).toBeLessThanOrEqual(lens.distanceTo(surface.point) + 1e-10);
  // Even the bottom of the deepest diagnostic panel is within 10 mm of the
  // canonical probe. A mesh with the right name but moved away must fail.
  expect(target.y - hit.point.y).toBeLessThanOrEqual(toWorld(10));
  return hit.distance;
}

describe("the registered Table Tilt subject seen by the physical lens", () => {
  it.each([
    ["reset", DEFAULT_CAMERA_STATE.frontTiltDeg, DEFAULT_CAMERA_STATE.focusDistanceMm],
    ["calibrated", calibration.frontTiltDeg, calibration.focusDistanceMm],
    ["lower public stop", CAMERA_CONSTANTS.tiltMinDeg, calibration.focusDistanceMm],
    ["upper public stop", CAMERA_CONSTANTS.tiltMaxDeg, calibration.focusDistanceMm],
  ] as const)("keeps all 15 %s sample rays on their diagnostic surfaces", (_, tilt, focus) => {
    withMountedTableTilt((root) => {
      const lens = lensFor(tilt, focus);
      let precedingFarEdge = 0;
      for (const [index, subject] of geometry.subjects.entries()) {
        expect(subject.focusSamples).toHaveLength(5);
        const distances = subject.focusSamples.map((sample) => {
          const node = root.getObjectByName(subject.semanticName + "-focus-sample-" + sample.id);
          expect(node?.userData.focusTargetId).toBe(subject.id);
          const target = vectorInWorld(sample.worldPosition);
          expect(node!.getWorldPosition(new THREE.Vector3()).distanceTo(target)).toBeLessThan(1e-10);
          return verifySampleRay(root, lens, target, subject.semanticName, diagnosticNames[index]);
        });
        expect(Math.min(...distances)).toBeGreaterThan(precedingFarEdge);
        precedingFarEdge = Math.max(...distances);
      }
    });
  });

  it("rejects a temporary lens-side blocker and recovers when it is removed", () => {
    withMountedTableTilt((root) => {
      const lens = lensFor(calibration.frontTiltDeg, calibration.focusDistanceMm);
      const subject = geometry.nearSubject;
      const target = vectorInWorld(subject.focusDetailProbeWorld);
      const verify = () => verifySampleRay(root, lens, target, subject.semanticName, diagnosticNames[0]);
      expect(verify()).toBeGreaterThan(0);
      const blocker = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.02), new THREE.MeshBasicMaterial());
      blocker.name = "test-only blocker";
      blocker.position.copy(lens).lerp(target, 0.5);
      root.add(blocker);
      root.updateMatrixWorld(true);
      try {
        expect(verify).toThrow("diagnostic was occluded by test-only blocker");
      } finally {
        root.remove(blocker);
        blocker.geometry.dispose();
        blocker.material.dispose();
      }
      expect(verify()).toBeGreaterThan(0);
    });
  });

  it("mounts a horizontal tabletop at the canonical elevation and extents", () => {
    withMountedTableTilt((root) => {
      const tabletop = root.getObjectByName("table-tilt-tabletop")!;
      const bounds = new THREE.Box3().setFromObject(tabletop, true);
      const plane = geometry.tabletopTopSurfacePlane;
      const { center, width, depth, thickness } = geometry.tabletop;
      expect(bounds.min.x).toBeCloseTo(toWorld(center.x - width / 2), 7);
      expect(bounds.max.x).toBeCloseTo(toWorld(center.x + width / 2), 7);
      expect(bounds.min.z).toBeCloseTo(toWorld(center.z - depth / 2), 7);
      expect(bounds.max.z).toBeCloseTo(toWorld(center.z + depth / 2), 7);
      expect(bounds.min.y).toBeCloseTo(toWorld(plane.point.y - thickness), 7);
      expect(bounds.max.y).toBeCloseTo(toWorld(plane.point.y), 7);
      const down = vectorInWorld(plane.normal).normalize().negate();
      for (const z of [bounds.min.z + 0.1, center.z / 1000, bounds.max.z - 0.1]) {
        const [hit] = new THREE.Raycaster(new THREE.Vector3(0, 0, z), down).intersectObject(tabletop);
        expect(hit?.point.y).toBeCloseTo(toWorld(plane.point.y), 7);
      }
    });
  });
});
