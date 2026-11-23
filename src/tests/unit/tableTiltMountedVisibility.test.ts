import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import {
  createRegisteredSceneAsset,
  disposeRegisteredSceneAsset,
  TABLE_TILT_ASSET_KEY,
} from "../../render/assets/sceneAssetRegistry";
import { configureGroundGlassCamera } from "../../render/configureGroundGlassCamera";
import { getGroundGlassClipRangeWorld } from "../../render/groundGlassRttScenes";
import { toWorld } from "../../render/rttUtils";
import { tableTiltScene } from "../../scenes/definitions/table-tilt";
import { TABLE_TILT_PRESENTATION } from "../../scenes/presentation/tableTilt";
import geometry, { getTabletopWorldCorners, type TableTiltVec3 } from "../../scenes/tableTiltGeometry";
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

const opticsFor = (frontTiltDeg: number, focusDistanceMm: number) =>
  deriveOpticsState({
    ...DEFAULT_CAMERA_STATE,
    ...tableTiltScene.cameraPreset,
    activeSceneId: tableTiltScene.id,
    frontTiltDeg,
    focusDistanceMm,
  }, tableTiltScene);

const lensFor = (frontTiltDeg: number, focusDistanceMm: number) =>
  vectorInWorld(opticsFor(frontTiltDeg, focusDistanceMm).lensCenterWorld);

const lensStates = [
  ["reset", DEFAULT_CAMERA_STATE.frontTiltDeg, DEFAULT_CAMERA_STATE.focusDistanceMm],
  ["calibrated", calibration.frontTiltDeg, calibration.focusDistanceMm],
  ["lower public stop", CAMERA_CONSTANTS.tiltMinDeg, calibration.focusDistanceMm],
  ["upper public stop", CAMERA_CONSTANTS.tiltMaxDeg, calibration.focusDistanceMm],
] as const;

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
  it.each(lensStates)("keeps all 15 %s sample rays on their diagnostic surfaces", (_, tilt, focus) => {
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


const studio = (root: THREE.Group) => root.getObjectByName("table-tilt-studio-environment")!;
const boundsOf = (object: THREE.Object3D) => new THREE.Box3().setFromObject(object, true);
const cornersOf = ({ min, max }: THREE.Box3) =>
  [min.x, max.x].flatMap(x => [min.y, max.y].flatMap(y =>
    [min.z, max.z].map(z => new THREE.Vector3(x, y, z)),
  ));

describe("the mounted Table Tilt studio", () => {
  it("joins two solid walls to the original single floor and clears the table and subjects", () => {
    withMountedTableTilt(root => {
      const room = studio(root);
      expect(room).toBeInstanceOf(THREE.Group);
      const mounted = [root, ...root.children, ...room.children];
      const unique = (name: string) => {
        const matches = mounted.filter(object => object.name === name);
        expect(matches, name).toHaveLength(1);
        return matches[0];
      };
      expect(unique("table-tilt-studio-environment")).toBe(room);
      const floor = unique("table-tilt-floor");
      const planes: THREE.Mesh[] = [];
      root.traverse(object => {
        if (object instanceof THREE.Mesh && object.geometry instanceof THREE.PlaneGeometry) planes.push(object);
      });
      expect(planes).toEqual([floor]);
      const floorBounds = boundsOf(floor);
      expect(floorBounds.min.y).toBeCloseTo(toWorld(geometry.floor.center.y), 7);
      expect(floorBounds.getSize(new THREE.Vector3()).toArray()).toEqual([
        toWorld(geometry.floor.width), expect.closeTo(0, 7), toWorld(geometry.floor.depth),
      ]);

      const rear = boundsOf(unique("table-tilt-studio-rear-wall"));
      const side = boundsOf(unique("table-tilt-studio-side-wall"));
      expect(rear.min.z).toBeCloseTo(side.max.z, 6);
      expect(rear.max.z).toBeCloseTo(floorBounds.max.z, 6);
      expect(side.min.x).toBeCloseTo(floorBounds.min.x, 6);
      expect(side.min.z).toBeCloseTo(floorBounds.min.z, 6);
      for (const wall of [rear, side]) {
        expect(wall.min.y).toBeCloseTo(floorBounds.max.y, 6);
        expect(wall.max.y - wall.min.y).toBeCloseTo(toWorld(3400), 6);
        expect(wall.getSize(new THREE.Vector3()).toArray().every(size => Number.isFinite(size) && size > 0)).toBe(true);
      }
      expect(rear.max.z - rear.min.z).toBeCloseTo(toWorld(180), 6);
      expect(side.max.x - side.min.x).toBeCloseTo(toWorld(180), 6);

      const occupied = [
        root.getObjectByName("table-tilt-tabletop")!,
        ...geometry.subjects.map(subject => root.getObjectByName(subject.semanticName + "-anchor")!),
      ];
      for (const part of room.children) {
        for (const subject of occupied) expect(boundsOf(part).intersectsBox(boundsOf(subject))).toBe(false);
      }
    });
  });

  it("opens the entire wall thickness and has outward solid geometry around the window", () => {
    withMountedTableTilt(root => {
      const ray = (origin: number[], direction: number[]) =>
        new THREE.Raycaster(new THREE.Vector3().fromArray(origin), new THREE.Vector3().fromArray(direction), 0, 2)
          .intersectObject(studio(root), true);
      expect(ray([-3.25, 0.10, 6.275], [-1, 0, 0])).toHaveLength(0);
      expect(ray([-4.4, 0.10, 6.275], [1, 0, 0])).toHaveLength(0);
      const [jamb] = ray([-3.25, 0.10, 5.38], [-1, 0, 0]);
      expect(jamb?.object.name).toBe("table-tilt-studio-window-frame");
      for (const [origin, direction, name, expectedNormal] of [
        [[-3.25, 1.25, 6.275], [-1, 0, 0], "side", [1, 0, 0]],
        [[0, 1.25, 8], [0, 0, 1], "rear", [0, 0, -1]],
      ] as const) {
        const [hit] = ray([...origin], [...direction]);
        expect(hit?.object.name).toBe(`table-tilt-studio-${name}-wall`);
        const normal = hit.face!.normal.clone().transformDirection(hit.object.matrixWorld);
        expect(normal.distanceTo(new THREE.Vector3(...expectedNormal))).toBeLessThan(1e-7);
      }
    });
  });

  it.each(lensStates)("fits mounted room depth and keeps the window outside the %s film", (_, tilt, focus) => {
    withMountedTableTilt(root => {
      const optics = opticsFor(tilt, focus);
      const initial = getGroundGlassClipRangeWorld(tableTiltScene, optics.lensCenterWorld);
      const camera = new THREE.PerspectiveCamera();
      const config = configureGroundGlassCamera(camera, optics, initial.near, initial.far);
      if (!config.ok) throw new Error(config.reason);
      const [x, y, z] = config.pose.forwardWorld;
      const clip = getGroundGlassClipRangeWorld(tableTiltScene, optics.lensCenterWorld, { x, y, z });
      expect(configureGroundGlassCamera(camera, optics, clip.near, clip.far).ok).toBe(true);
      const depths = cornersOf(boundsOf(studio(root))).map(point => -point.applyMatrix4(camera.matrixWorldInverse).z);
      expect(Math.max(...depths)).toBeLessThan(clip.far);
      const frame = root.getObjectByName("table-tilt-studio-window-frame")!;
      const windowXs = cornersOf(boundsOf(frame)).map(point => point.project(camera).x);
      expect(Math.min(...windowXs)).toBeGreaterThan(1);
    });
  });

  it("keeps the mounted architecture behind all tabletop and diagnostic sightlines", () => {
    withMountedTableTilt(root => {
      const positions = [
        vectorInWorld(geometry.observerCamera.position),
        new THREE.Vector3(-3.25, 0.8, 1.35),
        new THREE.Vector3(3.6, 1, 2.75),
        new THREE.Vector3(2.7, 3.3, 2.15),
      ];
      const targets = [
        ...getTabletopWorldCorners(),
        ...geometry.subjects.flatMap(subject => subject.focusSamples.map(sample => sample.worldPosition)),
      ].map(vectorInWorld);
      for (const position of positions) {
        for (const target of targets) {
          const direction = target.clone().sub(position).normalize();
          const ray = new THREE.Raycaster(position, direction, 0, position.distanceTo(target));
          expect(ray.intersectObject(studio(root), true)).toHaveLength(0);
        }
      }
    });
  });

  it("detects a wall inserted within the mounted environment", () => {
    withMountedTableTilt(root => {
      const lens = lensFor(calibration.frontTiltDeg, calibration.focusDistanceMm);
      const subject = geometry.farSubject;
      const target = vectorInWorld(subject.focusDetailProbeWorld);
      const verify = () => verifySampleRay(root, lens, target, subject.semanticName, diagnosticNames[2]);
      expect(verify()).toBeGreaterThan(0);
      const wall = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 0.18), new THREE.MeshStandardMaterial());
      wall.name = "test-only studio wall";
      wall.position.copy(lens).lerp(target, 0.5);
      studio(root).add(wall);
      root.updateMatrixWorld(true);
      try {
        expect(verify).toThrow("diagnostic was occluded by test-only studio wall");
      } finally {
        wall.removeFromParent();
        wall.geometry.dispose();
        wall.material.dispose();
      }
      expect(verify()).toBeGreaterThan(0);
    });
  });
});
