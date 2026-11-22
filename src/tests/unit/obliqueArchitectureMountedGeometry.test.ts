import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import {
  createRegisteredSceneAsset,
  disposeRegisteredSceneAsset,
  OBLIQUE_ARCHITECTURE_ASSET_KEY,
} from "../../render/assets/sceneAssetRegistry";
import { toWorld, vecToWorld } from "../../render/rttUtils";
import { obliqueArchitectureScene as scene } from "../../scenes/definitions/oblique-architecture";
import geometry from "../../scenes/obliqueArchitectureGeometry";
import { OBLIQUE_ARCHITECTURE_PRESENTATION as presentation } from "../../scenes/presentation/obliqueArchitecture";
import { CAMERA_CONSTANTS, DEFAULT_CAMERA_STATE } from "../../utils/constants";
import type { CameraState } from "../../types/camera";

const mount = () => {
  const group = createRegisteredSceneAsset(OBLIQUE_ARCHITECTURE_ASSET_KEY, { presentation });
  group.updateMatrixWorld(true);
  return group;
};
const dispose = (group: THREE.Group) => disposeRegisteredSceneAsset(OBLIQUE_ARCHITECTURE_ASSET_KEY, group);

const physicalLens = (overrides: Partial<CameraState>) => {
  const camera: CameraState = {
    ...DEFAULT_CAMERA_STATE, ...scene.cameraPreset, ...overrides,
    activeSceneId: scene.id, activeTaskId: null, mode: "free",
  };
  return new THREE.Vector3(...vecToWorld(deriveOpticsState(camera, scene).lensCenterWorld));
};

function materialName(hit: THREE.Intersection | undefined): string | undefined {
  if (!(hit?.object instanceof THREE.Mesh)) return undefined;
  const material = hit.object.material;
  return (Array.isArray(material) ? material[hit.face?.materialIndex ?? 0] : material)?.name;
}

function firstFocusHit(group: THREE.Group, lens: THREE.Vector3, target: THREE.Vector3) {
  const direction = target.clone().sub(lens).normalize();
  const hit = new THREE.Raycaster(lens, direction).intersectObject(group)[0];
  return hit && {
    surface: hit.object.name,
    material: materialName(hit),
    errorMm: hit.point.distanceTo(target) / toWorld(1),
  };
}

function mountedResources(group: THREE.Group) {
  const resources = new Set<THREE.BufferGeometry | THREE.Material | THREE.Texture>();
  group.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    resources.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      resources.add(material);
      for (const property of Object.values(material)) {
        if (property instanceof THREE.Texture) resources.add(property);
      }
    }
  });
  const counts = new Map([...resources].map(resource => [resource, 0]));
  for (const resource of resources) {
    resource.addEventListener("dispose", () => counts.set(resource, counts.get(resource)! + 1));
  }
  return counts;
}

describe("registered Oblique Architecture building", () => {
  it("puts the first visible teaching window surface at every scored station sample", () => {
    const group = mount();
    const solved = {
      frontSwingDeg: geometry.reachableFrontSwingDeg,
      focusDistanceMm: geometry.reachableFacadeFocusDistanceMm,
    };
    const rise = { frontRiseMm: geometry.reachableFrontRiseMm };
    const states: Partial<CameraState>[] = [{}, rise, solved, { ...solved, ...rise }];
    for (const frontRiseMm of [CAMERA_CONSTANTS.riseMinMm, CAMERA_CONSTANTS.riseMaxMm]) {
      for (const frontSwingDeg of [CAMERA_CONSTANTS.swingMinDeg, CAMERA_CONSTANTS.swingMaxDeg]) {
        for (const focusDistanceMm of [geometry.focusDistanceRangeMm.min, geometry.focusDistanceRangeMm.max]) {
          states.push({ frontRiseMm, frontSwingDeg, focusDistanceMm });
        }
      }
    }
    try {
      for (const state of states) {
        const lens = physicalLens(state);
        for (const station of scene.focusTargets) {
          for (const point of station.sampleWorldPositions ?? [station.worldPosition]) {
            const hit = firstFocusHit(group, lens, new THREE.Vector3(...vecToWorld(point)));
            const context = JSON.stringify({ station: station.id, point, state, hit });
            expect(hit?.material, context).toBe("oblique-architecture-glazing");
            expect(hit?.errorMm, context).toBeLessThan(0.25);
          }
        }
      }

      const lens = physicalLens({});
      const target = new THREE.Vector3(...vecToWorld(geometry.focusTargets[1].worldPosition));
      const blocker = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.02), new THREE.MeshBasicMaterial());
      blocker.name = "injected-occluding-ornament";
      blocker.position.copy(lens).lerp(target, 0.75);
      group.add(blocker);
      group.updateMatrixWorld(true);
      const blocked = firstFocusHit(group, lens, target);
      expect(blocked?.surface).toBe(blocker.name);
      expect(blocked?.errorMm).toBeGreaterThan(100);
    } finally {
      dispose(group);
    }
  });

  it("cuts both panes of every front and teaching window through the shell", () => {
    const group = mount();
    const b = geometry.building;
    const ray = new THREE.Raycaster();
    try {
      const walls = new THREE.Box3();
      for (const name of ["building", "target-facade", "foundation"]) {
        const mesh = group.getObjectByName("oblique-architecture-" + name);
        if (!(mesh instanceof THREE.Mesh)) throw new Error("Missing masonry assembly: " + name);
        walls.union(new THREE.Box3().setFromObject(mesh));
      }
      // Stone trim and storm glazing may project beyond the canonical structural envelope.
      const expectedMin = [b.leftX, geometry.ground.y, b.nearZ];
      const expectedMax = [b.rightX, geometry.ground.y + b.height, b.farZ];
      for (const [axis, value] of walls.min.toArray().entries()) {
        expect(value).toBeCloseTo(toWorld(expectedMin[axis]), 5);
        expect(walls.max.getComponent(axis)).toBeCloseTo(toWorld(expectedMax[axis]), 5);
      }
      for (const face of ["front", "side"] as const) {
        const isFront = face === "front";
        const columns = isFront ? geometry.frontWindowColumnCenters : geometry.sideWindowColumnCenters;
        const width = isFront ? b.frontWindowWidth : b.sideWindowWidth;
        const inward = isFront ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0);
        // Include the interior, so glazing pasted in front of a solid core also fails.
        ray.far = toWorld(250 + (isFront ? b.farZ - b.nearZ : b.width) / 2);
        for (const column of columns) {
          for (const row of geometry.windowRowCenters) {
            for (const pane of [-1, 1]) {
              const offset = column + pane * width * 0.22;
              const y = row + b.windowHeight * 0.18;
              const start = isFront
                ? { x: offset, y, z: b.nearZ - 250 }
                : { x: b.leftX - 250, y, z: offset };
              ray.set(new THREE.Vector3(...vecToWorld(start)), inward);
              const hits = ray.intersectObject(group).map(materialName);
              const context = JSON.stringify({ face, column, row, pane, hits });
              expect(hits[0], context).toBe("oblique-architecture-glazing");
              expect(hits.every(name => name === "oblique-architecture-glazing"), context).toBe(true);
            }
          }
        }
      }
    } finally {
      dispose(group);
    }
  });

  it("keeps the roof deck below continuous coping on all four elevations", () => {
    const group = mount();
    const b = geometry.building;
    const top = geometry.buildingTopY;
    const down = new THREE.Vector3(0, -1, 0);
    const firstFromAbove = (x: number, z: number) => {
      const origin = new THREE.Vector3(...vecToWorld({ x, y: top + 200, z }));
      return new THREE.Raycaster(origin, down).intersectObject(group)[0];
    };
    try {
      for (const fraction of [0.03, 0.5, 0.97]) {
        const x = b.leftX + b.width * fraction;
        const z = b.nearZ + (b.farZ - b.nearZ) * fraction;
        for (const [edgeX, edgeZ] of [[x, b.nearZ], [x, b.farZ], [b.leftX, z], [b.rightX, z]]) {
          const hit = firstFromAbove(edgeX, edgeZ);
          expect(hit?.object.name).toBe("oblique-architecture-parapet-coping");
          expect(hit?.point.y).toBeCloseTo(toWorld(top), 5);
        }
      }
      const deck = firstFromAbove(geometry.buildingCenter.x, geometry.buildingCenter.z);
      expect(deck?.object.name).toBe("oblique-architecture-roof");
      expect(deck?.point.y).toBeGreaterThan(toWorld(geometry.ground.y + b.height));
      expect(deck?.point.y).toBeLessThan(toWorld(top));
    } finally {
      dispose(group);
    }
  });

  it("disposes each mounted geometry, material and texture once and preserves a live sibling", () => {
    const observer = mount();
    const groundGlass = mount();
    const observerDisposals = mountedResources(observer);
    const groundGlassDisposals = mountedResources(groundGlass);
    try {
      expect([...observerDisposals.keys()].some(resource => resource instanceof THREE.Texture)).toBe(true);
      dispose(observer);
      expect(new Set(observerDisposals.values())).toEqual(new Set([1]));
      expect(new Set(groundGlassDisposals.values())).toEqual(new Set([0]));
    } finally {
      dispose(groundGlass);
    }
    expect(new Set(groundGlassDisposals.values())).toEqual(new Set([1]));
  });
});
