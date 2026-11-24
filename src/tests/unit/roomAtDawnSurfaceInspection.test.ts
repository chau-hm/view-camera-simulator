import { describe, expect, it } from "vitest";
import * as THREE from "three";
// @ts-expect-error Development-only experiment helper has no production declaration.
import { inspectRoomSurfaceProbes, measureRoomSurfacePatchRgba } from "../../../experiments/room-at-dawn/room-surface-inspection.js";

const preset = { origin: [3, 2, 1] };
const optics = {
  lensCenterWorld: { x: 0, y: 0, z: 0 },
  filmPlaneCornersWorld: {
    topLeft: { x: -50, y: 50, z: -100 },
    topRight: { x: 50, y: 50, z: -100 },
    bottomLeft: { x: -50, y: -50, z: -100 },
    bottomRight: { x: 50, y: -50, z: -100 },
  },
  focusPlane: { point: { x: 0, y: 0, z: 2000 }, normal: { x: 0, y: 0, z: 1 } },
};
const camera = { focusDistanceMm: 2000, aperture: 5.6 };

function createView({ withGi = true, transparent = false } = {}) {
  const view = new THREE.Group();
  view.position.set(-preset.origin[0], -preset.origin[1], -preset.origin[2]);
  const geometry = new THREE.PlaneGeometry(4, 4);
  const texture = new THREE.Texture();
  const material = new THREE.MeshStandardMaterial({ map: texture, side: THREE.DoubleSide, transparent });
  material.name = "original-room-material";
  if (withGi) {
    material.defines = { USE_GI: "" };
    geometry.setAttribute("gi", new THREE.BufferAttribute(new Float32Array(geometry.attributes.position.count * 3).fill(0.2), 3));
    geometry.setAttribute("gd", new THREE.BufferAttribute(new Float32Array(geometry.attributes.position.count * 3).fill(0.1), 3));
  }
  const surface = new THREE.Mesh(geometry, material);
  surface.name = "duvet";
  surface.position.set(preset.origin[0], preset.origin[1], preset.origin[2] + 2);
  view.add(surface);
  view.updateMatrixWorld(true);
  return { view, surface, geometry, material, texture };
}

describe("Room-at-Dawn original surface inspection", () => {
  it("transforms the normal through a rotated hit instance", () => {
    const { view, surface, geometry, material } = createView();
    view.remove(surface);
    const instances = new THREE.InstancedMesh(geometry, material, 1);
    instances.name = "rotated-instance";
    const matrix = new THREE.Matrix4().makeRotationY(Math.PI / 4);
    matrix.setPosition(preset.origin[0], preset.origin[1], preset.origin[2] + 2);
    instances.setMatrixAt(0, matrix);
    view.add(instances);
    view.updateMatrixWorld(true);
    const [hit] = inspectRoomSurfaceProbes({
      viewGroup: view, optics, camera, preset,
      probes: [{ id: "instance", filmUv: { u: 0.5, v: 0.5 } }],
    });
    expect(hit.mesh.instanceId).toBe(0);
    expect(hit.surfaceNormalWorld[0]).toBeCloseTo(Math.SQRT1_2, 6);
    expect(hit.surfaceNormalWorld[2]).toBeCloseTo(Math.SQRT1_2, 6);
  });

  it("raycasts a canonical film probe to a real GI-matched PBR surface and returns source coordinates", () => {
    const { view, geometry, material, texture } = createView();
    const [measurement] = inspectRoomSurfaceProbes({
      viewGroup: view,
      optics,
      camera,
      preset,
      probes: [{ id: "duvet-center", filmUv: { u: 0.5, v: 0.5 } }],
      frameIdentity: { generationId: "g7", requestId: "r12", frameId: "g7:frame:34" },
    });

    expect(measurement).toMatchObject({
      id: "duvet-center",
      valid: true,
      rejection: null,
      frameIdentity: { generationId: "g7", requestId: "r12", frameId: "g7:frame:34" },
      canonicalFilmUv: { u: 0.5, v: 0.5 },
      projectedRawFilmUv: { u: 0.5, v: 0.5 },
      sourceM: [3, 2, 3],
      distanceFromLensMm: 2000,
      mesh: { name: "duvet", giMeshKey: "duvet#0", hasMatchedBake: true },
      material: {
        name: "original-room-material",
        supportedPbr: true,
        textures: { map: { present: true } },
      },
    });
    expect(measurement.mesh.giAttributes.gi.count).toBe(geometry.attributes.position.count);
    expect(measurement.material.textures.map.width).toBeNull();
    expect(measurement.material.textures.map.height).toBeNull();
    expect(material.map).toBe(texture);
    expect(geometry.attributes.position.count).toBeGreaterThan(0);
  });

  it("maps displayed Raw coordinates through the existing RTT 180-degree orientation contract", () => {
    const { view } = createView();
    const [raw] = inspectRoomSurfaceProbes({
      viewGroup: view,
      optics,
      camera,
      preset,
      previewMode: "raw",
      probes: [{ id: "raw-upper-left-display", displayUv: { u: 0.6, v: 0.4 } }],
    });
    expect(raw.valid).toBe(true);
    expect(raw.canonicalFilmUv).toEqual({ u: 0.4, v: 0.6 });
    expect(raw.projectedRawFilmUv.u).toBeCloseTo(0.4, 6);
    expect(raw.projectedRawFilmUv.v).toBeCloseTo(0.6, 6);
    expect(raw.projectedDisplayUv).toEqual({ u: 0.6, v: 0.4 });
  });

  it("accepts a known upstream surface point only when the canonical ray reaches that point", () => {
    const { view } = createView();
    const [measurement] = inspectRoomSurfaceProbes({
      viewGroup: view,
      optics,
      camera,
      preset,
      probes: [{ id: "known-duvet-point", sourceM: [3, 2, 3], surfaceToleranceMm: 0.1 }],
    });
    expect(measurement.valid).toBe(true);
    expect(measurement.knownSourcePoint.surfaceErrorMm).toBeCloseTo(0, 8);
    expect(measurement.projectedRawFilmUv).toEqual({ u: 0.5, v: 0.5 });
  });

  it("uses the mounted render scene and rejects a mesh occluder outside the room view group", () => {
    const { view } = createView();
    const scene = new THREE.Scene();
    scene.add(view);
    const outsideBlocker = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.MeshStandardMaterial({ side: THREE.DoubleSide }),
    );
    outsideBlocker.name = "external-overlay-mesh";
    outsideBlocker.position.set(0, 0, 1);
    scene.add(outsideBlocker);

    const [measurement] = inspectRoomSurfaceProbes({
      viewGroup: view,
      optics,
      camera,
      preset,
      probes: [{ id: "scene-occlusion", filmUv: { u: 0.5, v: 0.5 } }],
    });
    expect(measurement).toMatchObject({
      valid: false,
      rejection: "probe ray is occluded by a visible mesh outside the mounted room group",
      raycastScope: "mounted-render-scene",
      externalOccluder: { name: "external-overlay-mesh" },
    });
  });

  it("rejects a non-GI occluder inside the room view group instead of reporting the surface behind it", () => {
    const { view } = createView();
    const blocker = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.MeshStandardMaterial({ side: THREE.DoubleSide }),
    );
    blocker.name = "non-baked-glass";
    blocker.position.set(preset.origin[0], preset.origin[1], preset.origin[2] + 1);
    view.add(blocker);
    view.updateMatrixWorld(true);

    const [measurement] = inspectRoomSurfaceProbes({
      viewGroup: view,
      optics,
      camera,
      preset,
      probes: [{ id: "blocked-center", filmUv: { u: 0.5, v: 0.5 } }],
    });
    expect(measurement.valid).toBe(false);
    expect(measurement.rejection).toBe("hit does not have a count-matched baked-GI mesh/material identity");
    expect(measurement.mesh.name).toBe("non-baked-glass");
  });

  it("reports display-space patch statistics with frame identity and explicit limits", () => {
    const width = 17, height = 17;
    const pixels = new Uint8Array(width * height * 4);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const value = x % 2 === 0 ? 40 : 200;
      const index = (y * width + x) * 4;
      pixels.set([value, value, value, 255], index);
    }
    const result = measureRoomSurfacePatchRgba(pixels, width, height, { u: 0.5, v: 0.5 }, {
      radiusPx: 4,
      frameIdentity: { generationId: "g2", requestId: "r8", frameId: "g2:frame:9" },
    });
    expect(result.valid).toBe(true);
    expect(result).toMatchObject({
      frameIdentity: { generationId: "g2", requestId: "r8", frameId: "g2:frame:9" },
      space: "display-referred RGB8",
      roi: { x: 4, y: 4, width: 9, height: 9 },
      darkPixelFraction: 0,
      highlightPixelFraction: 0,
      nonOpaquePixelFraction: 0,
    });
    expect(result.lumaStdDev8).toBeGreaterThan(50);
    expect(result.meanAbsoluteNeighborGradient8).toBeGreaterThan(0);
    expect(result.caveats).toContain("display-referred RGB8 values are not linear scene radiance");
    expect(measureRoomSurfacePatchRgba(pixels, width, height, { u: 0, v: 0 })).toMatchObject({
      valid: false,
      rejection: "surface patch crosses the captured canvas edge",
    });
  });

  it("rejects unsupported alpha surfaces and an unmodeled view transform", () => {
    const alphaView = createView({ transparent: true });
    const [alphaMeasurement] = inspectRoomSurfaceProbes({
      viewGroup: alphaView.view,
      optics,
      camera,
      preset,
      probes: [{ id: "alpha-surface", filmUv: { u: 0.5, v: 0.5 } }],
    });
    expect(alphaMeasurement.valid).toBe(false);
    expect(alphaMeasurement.rejection).toContain("alpha-tested or transparent");

    const scaled = createView();
    scaled.view.scale.x = 2;
    const [transformMeasurement] = inspectRoomSurfaceProbes({
      viewGroup: scaled.view,
      optics,
      camera,
      preset,
      probes: [{ id: "scaled-room", filmUv: { u: 0.5, v: 0.5 } }],
    });
    expect(transformMeasurement).toMatchObject({
      valid: false,
      rejection: "unsupported view transform; expected only T(-preset.origin) metres",
    });
  });
});
