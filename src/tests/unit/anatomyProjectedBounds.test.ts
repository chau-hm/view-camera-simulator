import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { calculateAnatomyProjectedBounds } from "../../render/anatomyProjectedBounds";

const cameraAtOrigin = () => {
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
  camera.position.set(0, 0, 10);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld(true);
  return camera;
};

const triangleGeometry = () => {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute([
    -1, -1, 0,
    1, -1, 0,
    0, 1, 0,
  ], 3));
  return geometry;
};

const translatePositionX = (geometry: THREE.BufferGeometry, amount: number) => {
  const position = geometry.getAttribute("position");
  for (let index = 0; index < position.count; index += 1) {
    position.setX(index, position.getX(index) + amount);
  }
  position.needsUpdate = true;
};

const boundsFrom = (box: THREE.Box3) => ({
  min: box.min.toArray(),
  max: box.max.toArray(),
});

describe("Anatomy audit projected bounds", () => {
  it("uses current vertices when a cached geometry bounding box is stale", () => {
    const geometry = triangleGeometry();
    geometry.computeBoundingBox();
    const initialCachedBounds = geometry.boundingBox?.clone();
    const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial());

    translatePositionX(geometry, 3);
    mesh.updateWorldMatrix(true, false);

    const oldDefaultBounds = new THREE.Box3().setFromObject(mesh);
    const measured = calculateAnatomyProjectedBounds(mesh, cameraAtOrigin());

    expect(boundsFrom(oldDefaultBounds)).toEqual({
      min: [-1, -1, 0],
      max: [1, 1, 0],
    });
    expect(measured.worldBounds).toEqual({
      min: [2, -1, 0],
      max: [4, 1, 0],
    });
    expect(geometry.boundingBox?.equals(initialCachedBounds ?? new THREE.Box3())).toBe(true);
  });

  it("includes current deformable child vertices and static meshes in parent bounds", () => {
    const parent = new THREE.Group();
    const staticMesh = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial(),
    );
    staticMesh.position.x = -3;

    const deformableGeometry = triangleGeometry();
    deformableGeometry.computeBoundingBox();
    const deformableMesh = new THREE.Mesh(deformableGeometry, new THREE.MeshBasicMaterial());
    translatePositionX(deformableGeometry, 5);
    parent.add(staticMesh, deformableMesh);

    const measured = calculateAnatomyProjectedBounds(parent, cameraAtOrigin());

    expect(measured.worldBounds).toEqual({
      min: [-3.5, -1, -0.5],
      max: [6, 1, 0.5],
    });
  });

  it("returns stable world bounds for unchanged geometry", () => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 3), new THREE.MeshBasicMaterial());
    const camera = cameraAtOrigin();

    expect(calculateAnatomyProjectedBounds(mesh, camera))
      .toEqual(calculateAnatomyProjectedBounds(mesh, camera));
  });

  it("accounts for current parent and child transforms", () => {
    const parent = new THREE.Group();
    parent.position.set(4, 2, -3);
    parent.rotation.z = Math.PI / 2;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 1), new THREE.MeshBasicMaterial());
    mesh.position.x = 1;
    parent.add(mesh);

    const measured = calculateAnatomyProjectedBounds(parent, cameraAtOrigin());
    const bounds = measured.worldBounds;
    expect(bounds).not.toBeNull();
    if (!bounds) throw new Error("Expected transformed mesh bounds");

    expect(bounds.min[0]).toBeCloseTo(3.5);
    expect(bounds.max[0]).toBeCloseTo(4.5);
    expect(bounds.min[1]).toBeCloseTo(2);
    expect(bounds.max[1]).toBeCloseTo(4);
    expect(bounds.min[2]).toBeCloseTo(-3.5);
    expect(bounds.max[2]).toBeCloseTo(-2.5);
  });

  it("does not mutate vertex data, cached bounds, material, local transform, or visibility", () => {
    const geometry = triangleGeometry();
    geometry.computeBoundingBox();
    const initialVertices = Array.from(geometry.getAttribute("position").array);
    const initialBoundingBox = geometry.boundingBox?.clone();
    const material = new THREE.MeshStandardMaterial();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(2, 3, 4);
    mesh.rotation.set(0.1, 0.2, 0.3);
    mesh.scale.set(2, 3, 4);
    mesh.visible = false;
    const initialTransform = {
      position: mesh.position.toArray(),
      rotation: mesh.rotation.toArray(),
      quaternion: mesh.quaternion.toArray(),
      scale: mesh.scale.toArray(),
    };

    calculateAnatomyProjectedBounds(mesh, cameraAtOrigin());

    expect(Array.from(geometry.getAttribute("position").array)).toEqual(initialVertices);
    expect(geometry.boundingBox?.equals(initialBoundingBox ?? new THREE.Box3())).toBe(true);
    expect(mesh.material).toBe(material);
    expect({
      position: mesh.position.toArray(),
      rotation: mesh.rotation.toArray(),
      quaternion: mesh.quaternion.toArray(),
      scale: mesh.scale.toArray(),
    }).toEqual(initialTransform);
    expect(mesh.visible).toBe(false);

    const uncachedGeometry = triangleGeometry();
    const uncachedMesh = new THREE.Mesh(uncachedGeometry, new THREE.MeshBasicMaterial());
    expect(uncachedGeometry.boundingBox).toBeNull();
    calculateAnatomyProjectedBounds(uncachedMesh, cameraAtOrigin());
    expect(uncachedGeometry.boundingBox).toBeNull();
  });

  it("does not populate cached bounds when a descendant cannot use precise vertex bounds", () => {
    const geometry = new THREE.BufferGeometry();
    const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());

    const measured = calculateAnatomyProjectedBounds(mesh, cameraAtOrigin());

    expect(measured).toEqual({ worldBounds: null, projectedBounds: null });
    expect(geometry.boundingBox).toBeNull();
  });

  it("moves the projected ROI when only the current mesh vertices move", () => {
    const geometry = new THREE.BoxGeometry(1, 1, 0.2);
    geometry.computeBoundingBox();
    const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
    const camera = cameraAtOrigin();
    const before = calculateAnatomyProjectedBounds(mesh, camera);

    translatePositionX(geometry, 3);
    const after = calculateAnatomyProjectedBounds(mesh, camera);

    expect(before.projectedBounds).not.toBeNull();
    expect(after.projectedBounds).not.toBeNull();
    if (!before.projectedBounds || !after.projectedBounds) {
      throw new Error("Expected both projected ROIs to be visible");
    }
    expect(after.projectedBounds.left).toBeGreaterThan(before.projectedBounds.left);
    expect(after.projectedBounds.right).toBeGreaterThan(before.projectedBounds.right);
    expect(after.worldBounds?.min[0]).toBeCloseTo(2.5);
    expect(after.worldBounds?.max[0]).toBeCloseTo(3.5);
  });
});
