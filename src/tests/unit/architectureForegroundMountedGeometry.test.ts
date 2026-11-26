import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import {
  ARCHITECTURE_FOREGROUND_ASSET_KEY,
  createRegisteredSceneAsset,
  disposeRegisteredSceneAsset,
} from "../../render/assets/sceneAssetRegistry";
import { toWorld, vecToWorld } from "../../render/rttUtils";
import geometry from "../../scenes/architectureForegroundGeometry";
import { architectureForegroundScene as scene } from "../../scenes/definitions/architecture-foreground";
import { ARCHITECTURE_FOREGROUND_PRESENTATION as presentation } from "../../scenes/presentation/architectureForeground";
import type { CameraState } from "../../types/camera";
import type { Vec3 } from "../../types/optics";
import type { FocusTarget } from "../../types/scene";
import { CAMERA_CONSTANTS, DEFAULT_CAMERA_STATE } from "../../utils/constants";

const assetKey = ARCHITECTURE_FOREGROUND_ASSET_KEY;
const groundName = "architecture-foreground-ground";
const courtyardName = "architecture-foreground-courtyard-environment";
const wallMaterial = "architecture-foreground-plaster";
const baseMaterial = "architecture-foreground-rusticated-stone";
const pierMaterial = "architecture-foreground-mullion";
const glazingMaterial = "architecture-foreground-glazing";
const worldPoint = (point: Vec3) => new THREE.Vector3(...vecToWorld(point));

function withMountedSubject(check: (subject: THREE.Group) => void) {
  const subject = createRegisteredSceneAsset(assetKey, { presentation });
  subject.updateMatrixWorld(true);
  try {
    check(subject);
  } finally {
    disposeRegisteredSceneAsset(assetKey, subject);
  }
}

function lensAt(overrides: Partial<CameraState>) {
  const camera: CameraState = {
    ...DEFAULT_CAMERA_STATE,
    ...scene.cameraPreset,
    ...overrides,
    activeSceneId: scene.id,
    activeTaskId: null,
    mode: "free",
  };
  return worldPoint(deriveOpticsState(camera, scene).lensCenterWorld);
}

function materialAt(hit: THREE.Intersection) {
  if (!(hit.object instanceof THREE.Mesh)) return undefined;
  const materials = hit.object.material;
  return (Array.isArray(materials) ? materials[hit.face?.materialIndex ?? 0] : materials)?.name;
}

function probeSurface(subject: THREE.Group, lens: THREE.Vector3, target: FocusTarget, sample: Vec3) {
  const direction = worldPoint(sample).sub(lens).normalize();
  const floor = target.id.startsWith("foreground-");
  // Ground guides are intentionally 12 mm above the paving. Extend the
  // physical ray to the actual plane; a radial tolerance around the guide
  // would permit raised seams that intercept the ray ahead of the paving.
  const expectedDistance = floor
    ? (toWorld(geometry.ground.y) - lens.y) / direction.y
    : (toWorld(sample.z) - lens.z) / direction.z;
  const ray = new THREE.Raycaster(lens, direction);
  const hit = ray.intersectObject(subject)[0];
  const expectedPoint = ray.ray.at(expectedDistance, new THREE.Vector3());
  const expectedMaterial = sample.x === 0
    ? pierMaterial
    : target.id === "building-base" ? baseMaterial : wallMaterial;
  const matchesSurface = hit && (floor ? hit.object.name === groundName : materialAt(hit) === expectedMaterial);
  const errorMm = hit ? hit.point.distanceTo(expectedPoint) / toWorld(1) : Infinity;
  const distanceErrorMm = hit ? (hit.distance - expectedDistance) / toWorld(1) : Infinity;
  return {
    pass: Boolean(matchesSurface && errorMm < 0.25 && Math.abs(distanceErrorMm) < 0.25),
    hit: hit?.object.name,
    material: hit && materialAt(hit),
    errorMm,
    distanceErrorMm,
    expectedDistanceMm: expectedDistance / toWorld(1),
    hitMm: hit?.point.toArray().map(value => value / toWorld(1)),
  };
}

describe("registered Architecture + Foreground geometry", () => {
  const solve = {
    frontTiltDeg: geometry.neutralCalibration.publicTiltFocusSolutionDeg,
    focusDistanceMm: geometry.neutralCalibration.publicTiltFocusFocusDistanceMm,
  };
  const rise = { frontRiseMm: geometry.neutralCalibration.futureRiseMm };
  const states: Partial<CameraState>[] = [{}, rise, solve, { ...rise, ...solve }];
  for (const frontRiseMm of [CAMERA_CONSTANTS.riseMinMm, CAMERA_CONSTANTS.riseMaxMm]) {
    for (const frontTiltDeg of [CAMERA_CONSTANTS.tiltMinDeg, CAMERA_CONSTANTS.tiltMaxDeg]) {
      for (const focusDistanceMm of [geometry.focusDistanceRangeMm.min, geometry.focusDistanceRangeMm.max]) {
        states.push({ frontRiseMm, frontTiltDeg, focusDistanceMm });
      }
    }
  }

  it.each(scene.focusTargets)("first sees the calibrated surface for $id at every scored sample", target => {
    withMountedSubject(subject => {
      for (const state of states) {
        const lens = lensAt(state);
        for (const sample of [target.worldPosition, ...(target.sampleWorldPositions ?? [])]) {
          const result = probeSurface(subject, lens, target, sample);
          expect(result.pass, JSON.stringify({ target: target.id, state, sample, ...result })).toBe(true);
        }
      }
    });
  });

  it.each(["foreground-near", "building-base"])("rejects an occluder in front of %s", id => {
    withMountedSubject(subject => {
      const lens = lensAt({});
      const target = geometry.focusTargetById(id);
      const sample = target.worldPosition;
      expect(probeSurface(subject, lens, target, sample).pass).toBe(true);
      const blocker = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.04), new THREE.MeshBasicMaterial());
      blocker.name = "injected-focus-blocker";
      blocker.position.copy(lens).lerp(worldPoint(sample), 0.75);
      subject.add(blocker);
      subject.updateMatrixWorld(true);
      try {
        const blocked = probeSurface(subject, lens, target, sample);
        expect(blocked.pass).toBe(false);
        expect(blocked.hit).toBe(blocker.name);
        expect(blocked.distanceErrorMm).toBeLessThan(-100);
      } finally {
        blocker.removeFromParent();
        blocker.geometry.dispose();
        blocker.material.dispose();
      }
      expect(probeSurface(subject, lens, target, sample).pass).toBe(true);
    });
  });

  it("keeps the courtyard's near and middle paving neighborhoods open", () => {
    withMountedSubject(subject => {
      expect(subject.getObjectByName(courtyardName)).toBeDefined();
      const lens = lensAt({ ...rise, ...solve });
      for (const id of ["foreground-near", "foreground-middle"]) {
        const { z } = geometry.focusTargetById(id).worldPosition;
        for (const dz of [-140, 0, 140]) {
          for (const x of [-1500, -750, 0, 750, 1500]) {
            const point = worldPoint({ x, y: geometry.ground.y, z: z + dz });
            const ray = new THREE.Raycaster(lens, point.clone().sub(lens).normalize());
            const [first] = ray.intersectObject(subject);
            expect(first?.object.name, `${id}: ${x}, ${z + dz}`).toBe(groundName);
            expect(first.point.distanceTo(point) / toWorld(1)).toBeLessThan(0.25);
          }
        }
      }
    });
  });

  it.each([
    { id: "foreground-middle", kind: "planter", size: [720, 690, 540], alongRay: 0.70 },
    { id: "building-middle", kind: "gallery pier", size: [210, 2680, 210], alongRay: 0.78 },
  ])("detects a grounded courtyard $kind on the $id ray", ({ id, kind, size, alongRay }) => {
    withMountedSubject(subject => {
      const courtyard = subject.getObjectByName(courtyardName)!;
      const lens = lensAt({ ...rise, ...solve });
      const target = geometry.focusTargetById(id);
      const sample = target.worldPosition;
      const before = probeSurface(subject, lens, target, sample);
      expect(before.pass).toBe(true);

      const [width, height, depth] = size;
      const blocker = new THREE.Mesh(
        new THREE.BoxGeometry(toWorld(width), toWorld(height), toWorld(depth)),
        new THREE.MeshStandardMaterial({ color: "#c3b498" }),
      );
      let disposedGeometry = 0;
      let disposedMaterial = 0;
      blocker.geometry.addEventListener("dispose", () => disposedGeometry++);
      blocker.material.addEventListener("dispose", () => disposedMaterial++);
      blocker.name = "injected-courtyard-" + kind;
      blocker.position.copy(lens).lerp(worldPoint(sample), alongRay);
      blocker.position.y = toWorld(geometry.ground.y + height / 2);
      courtyard.add(blocker);
      subject.updateMatrixWorld(true);
      try {
        const blocked = probeSurface(subject, lens, target, sample);
        expect(blocked.pass).toBe(false);
        expect(blocked.hit).toBe(blocker.name);
        expect(blocked.distanceErrorMm).toBeLessThan(-100);
      } finally {
        blocker.removeFromParent();
        blocker.geometry.dispose();
        blocker.material.dispose();
      }
      expect(probeSurface(subject, lens, target, sample)).toEqual(before);
      expect(disposedGeometry).toBe(1);
      expect(disposedMaterial).toBe(1);
    });
  });

  it("keeps near ground, middle ground and facade in physical depth order", () => {
    withMountedSubject(subject => {
      const lens = lensAt({ ...rise, ...solve });
      const points = scene.focusTargets.map(target => probeSurface(subject, lens, target, target.worldPosition));
      expect(points.every(point => point.pass)).toBe(true);
      expect(points[0].hitMm?.[2]).toBeLessThan(points[1].hitMm![2]);
      expect(points[1].hitMm?.[2]).toBeLessThan(points[2].hitMm![2]);
      expect(points[2].hitMm?.[2]).toBeCloseTo(points[3].hitMm![2], 2);
    });
  });

  it("recesses both lights of every canonical window in openings through the shell", () => {
    withMountedSubject(subject => {
      const planeZ = geometry.facade.frontFacadeZ;
      for (const window of geometry.getWindows()) {
        for (const side of [-1, 1]) {
          const origin = worldPoint({ x: window.x + side * window.width / 4, y: window.y - 68, z: planeZ - 200 });
          const ray = new THREE.Raycaster(origin, new THREE.Vector3(0, 0, 1), 0, toWorld(200 + geometry.building.depth / 2));
          const hits = ray.intersectObject(subject);
          expect(hits.length, window.id).toBeGreaterThan(0);
          expect(hits.map(materialAt), window.id).toEqual(hits.map(() => glazingMaterial));
          expect(hits[0].point.z, window.id).toBeGreaterThan(toWorld(planeZ + 40));
        }
      }
    });
  });

  it("has continuous coping at the canonical parapet height around a sunken roof", () => {
    withMountedSubject(subject => {
      const top = geometry.facade.parapetTopY;
      const fromAbove = (x: number, z: number) =>
        new THREE.Raycaster(worldPoint({ x, y: top + 200, z }), new THREE.Vector3(0, -1, 0))
          .intersectObject(subject)[0];
      const { center, width } = geometry.building;
      for (const [x, z] of [
        [center.x, geometry.facade.frontFacadeZ],
        [center.x, geometry.facade.backFacadeZ],
        [center.x - width / 2, center.z],
        [center.x + width / 2, center.z],
      ]) {
        const hit = fromAbove(x, z);
        expect(hit.object.name).toContain("parapet-coping");
        expect(hit.point.y).toBeCloseTo(toWorld(top), 5);
      }
      const deck = fromAbove(center.x, center.z);
      expect(deck.object.name).toBe("architecture-foreground-roof");
      expect(deck.point.y).toBeGreaterThanOrEqual(toWorld(geometry.facade.parapetBottomY));
      expect(deck.point.y).toBeLessThan(toWorld(top));
    });
  });

  it("disposes each owned resource once and preserves its mounted sibling", () => {
    function observe(subject: THREE.Group) {
      const resources = new Set<THREE.BufferGeometry | THREE.Material | THREE.Texture>();
      subject.traverse(object => {
        if (!(object instanceof THREE.Mesh)) return;
        resources.add(object.geometry);
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
          resources.add(material);
          for (const value of Object.values(material)) {
            if (value instanceof THREE.Texture) resources.add(value);
          }
        }
      });
      const counts = new Map([...resources].map(resource => [resource, 0]));
      for (const resource of resources) {
        resource.addEventListener("dispose", () => counts.set(resource, counts.get(resource)! + 1));
      }
      return counts;
    }

    const observer = createRegisteredSceneAsset(assetKey, { presentation });
    const rtt = createRegisteredSceneAsset(assetKey, { presentation });
    const observerCounts = observe(observer);
    const rttCounts = observe(rtt);
    try {
      disposeRegisteredSceneAsset(assetKey, observer);
      expect([...observerCounts.keys()].some(resource => resource instanceof THREE.Texture)).toBe(true);
      expect(new Set(observerCounts.values())).toEqual(new Set([1]));
      expect(new Set(rttCounts.values())).toEqual(new Set([0]));
    } finally {
      disposeRegisteredSceneAsset(assetKey, rtt);
    }
    expect(new Set(rttCounts.values())).toEqual(new Set([1]));
  });
});
