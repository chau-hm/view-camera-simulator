import * as THREE from "three";
import { describe, expect, it } from "vitest";
import {
  collectSceneGraphCapacity,
  isSceneCapacityProfilingEnabled,
  readSceneCapacityRendererResources,
  resolveSceneCapacityFrameCadence,
} from "../../render/sceneCapacityProfiling";
import type { GroundGlassProfilingSnapshot } from "../../render/groundGlassProfiling";

const makeIndexedQuad = (): THREE.BufferGeometry => {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(
      [-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0],
      3,
    ),
  );
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  return geometry;
};

describe("scene capacity collector", () => {
  it("deduplicates shared geometry, material, and texture resources", () => {
    const geometry = makeIndexedQuad();
    const texture = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
    const material = new THREE.MeshStandardMaterial({ map: texture });
    const root = new THREE.Group();
    root.add(
      new THREE.Mesh(geometry, material),
      new THREE.Mesh(geometry, material),
    );

    const metrics = collectSceneGraphCapacity(root);

    expect(metrics.meshCount).toBe(2);
    expect(metrics.uniqueGeometryCount).toBe(1);
    expect(metrics.uniqueMaterialCount).toBe(1);
    expect(metrics.uniqueTextureCount).toBe(1);
    expect(metrics.triangleCount).toBe(4);
    expect(metrics.effectiveTriangleCount).toBe(4);

    geometry.dispose();
    material.dispose();
    texture.dispose();
  });

  it("counts indexed and non-indexed mesh triangles", () => {
    const indexed = makeIndexedQuad();
    const nonIndexed = new THREE.BufferGeometry();
    nonIndexed.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(
        [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 1, 0, 0, 0, 1, 0],
        3,
      ),
    );
    const root = new THREE.Group();
    root.add(
      new THREE.Mesh(indexed, new THREE.MeshBasicMaterial()),
      new THREE.Mesh(nonIndexed, new THREE.MeshBasicMaterial()),
    );

    const metrics = collectSceneGraphCapacity(root);

    expect(metrics.triangleCount).toBe(4);
    expect(metrics.uniqueGeometryCount).toBe(2);

    indexed.dispose();
    nonIndexed.dispose();
    root.traverse((object) => {
      if (object instanceof THREE.Mesh) object.material.dispose();
    });
  });

  it("multiplies effective triangles for InstancedMesh without duplicating resources", () => {
    const geometry = makeIndexedQuad();
    const material = new THREE.MeshBasicMaterial();
    const root = new THREE.Group();
    root.add(new THREE.InstancedMesh(geometry, material, 5));

    const metrics = collectSceneGraphCapacity(root);

    expect(metrics.meshCount).toBe(1);
    expect(metrics.instancedMeshCount).toBe(1);
    expect(metrics.uniqueGeometryCount).toBe(1);
    expect(metrics.uniqueMaterialCount).toBe(1);
    expect(metrics.triangleCount).toBe(0);
    expect(metrics.instancedTriangleCount).toBe(10);
    expect(metrics.effectiveTriangleCount).toBe(10);

    geometry.dispose();
    material.dispose();
  });

  it("ignores non-mesh objects and safely handles missing position data", () => {
    const root = new THREE.Group();
    root.add(new THREE.Object3D(), new THREE.DirectionalLight());
    root.add(new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial()));

    const metrics = collectSceneGraphCapacity(root);

    expect(metrics.objectCount).toBe(4);
    expect(metrics.lightCount).toBe(1);
    expect(metrics.meshCount).toBe(1);
    expect(metrics.triangleCount).toBe(0);
    expect(metrics.effectiveTriangleCount).toBe(0);
  });

  it("reads renderer resource counts without presenting them as byte memory", () => {
    expect(
      readSceneCapacityRendererResources({ info: { memory: { geometries: 7, textures: 3 } } }),
    ).toEqual({ geometries: 7, textures: 3 });
    expect(readSceneCapacityRendererResources({ info: { memory: { geometries: 7 } } })).toBeNull();
  });

  it("keeps the benchmark switch opt-in and maps frame cadence from the existing profiler", () => {
    expect(isSceneCapacityProfilingEnabled("?sceneCapacityProfiling=1")).toBe(true);
    expect(isSceneCapacityProfilingEnabled("?dofProfiling=1")).toBe(false);
    expect(isSceneCapacityProfilingEnabled("")).toBe(false);

    expect(
      resolveSceneCapacityFrameCadence({
        frame: { p50Ms: 16, p95Ms: 20, count: 60 },
        approxFps: 62.5,
      } as unknown as GroundGlassProfilingSnapshot),
    ).toEqual({ p50Ms: 16, p95Ms: 20, approxFps: 62.5, count: 60 });
  });
});
