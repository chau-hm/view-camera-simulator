import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import { DEFAULT_CAMERA_STATE } from "../../utils/constants";
import { architectureRiseScene } from "../../scenes/definitions/architecture-rise";
// Development-only experiment has no production declaration.
// @ts-expect-error JavaScript fixture has no production declaration.
import { createOpticalFixtureProfile } from "../../../experiments/room-at-dawn/optical-fixture.js";
// @ts-expect-error JavaScript fixture has no production declaration.
import { inspectOpticalFixture, measureVerticalEdgeRgba } from "../../../experiments/room-at-dawn/optical-measurement.js";

describe("experimental optical fixture", () => {
  it("mounts three distinct visible, unoccluded known targets and owns disposal", () => {
    const scene = new THREE.Scene();
    const profile = createOpticalFixtureProfile();
    const mounted = profile.mountSubject(scene);
    const camera = { ...DEFAULT_CAMERA_STATE, focalLengthMm: 90, focusDistanceMm: 2000, aperture: 5.6 as const };
    const optics = deriveOpticsState(camera, architectureRiseScene);
    const measurements = inspectOpticalFixture(mounted.group, optics, camera, { internalWidthPx: 960, displayWidthPx: 480, sampledFilmWidthMm: 127 });
    expect(measurements.map((x: { id: string }) => x.id)).toEqual(["near-edge", "middle-edge", "far-edge"]);
    for (const entry of measurements) {
      expect(entry).toMatchObject({ valid: true, unoccluded: true, rejection: null });
      expect(entry.firstHit).toBe(entry.id);
      expect(entry.footprint.valid).toBe(true);
      expect(entry.majorRadiusInternalPx).toBeGreaterThanOrEqual(0);
      expect(entry.majorRadiusDisplayPx).toBeCloseTo(entry.majorRadiusInternalPx! / 2);
    }
    for (let i = 0; i < measurements.length; i++) for (let j = i + 1; j < measurements.length; j++) {
      const a = measurements[i].projected, b = measurements[j].projected;
      expect(Math.hypot(a.uRaw - b.uRaw, a.vRaw - b.vRaw)).toBeGreaterThan(0.12);
    }
    const targets = mounted.group.children as THREE.Mesh[];
    const geometries = targets.map((mesh) => vi.spyOn(mesh.geometry, "dispose"));
    const material = targets[0].material as THREE.MeshBasicMaterial;
    const materialDispose = vi.spyOn(material, "dispose");
    const textureDispose = vi.spyOn(material.map!, "dispose");
    mounted.dispose();
    mounted.dispose();
    expect(scene.children).toHaveLength(0);
    for (const dispose of geometries) expect(dispose).toHaveBeenCalledOnce();
    expect(materialDispose).toHaveBeenCalledOnce();
    expect(textureDispose).toHaveBeenCalledOnce();
  });
  it("keeps target centers visible through isolated and combined tilt/swing", () => {
    const mounted = createOpticalFixtureProfile().mountSubject(new THREE.Scene());
    for (const [frontTiltDeg, frontSwingDeg] of [[5, 0], [-5, 0], [0, 5], [0, -5], [5, 5]]) {
      const camera = { ...DEFAULT_CAMERA_STATE, focalLengthMm: 90, focusDistanceMm: 2000, aperture: 5.6 as const, frontTiltDeg, frontSwingDeg };
      const optics = deriveOpticsState(camera, architectureRiseScene);
      const entries = inspectOpticalFixture(mounted.group, optics, camera, {});
      expect(entries.every((entry: { valid: boolean }) => entry.valid)).toBe(true);
    }
    mounted.dispose();
  });
  it("uses canonical footprints for focus ordering and aperture scaling", () => {
    const mounted = createOpticalFixtureProfile().mountSubject(new THREE.Scene());
    const get = (focusDistanceMm: number, aperture: 5.6 | 22) => {
      const camera = { ...DEFAULT_CAMERA_STATE, focalLengthMm: 90, focusDistanceMm, aperture };
      return inspectOpticalFixture(mounted.group, deriveOpticsState(camera, architectureRiseScene), camera, {});
    };
    const near = get(1100, 5.6), far = get(4000, 5.6), stopped = get(1100, 22);
    expect(near[0].footprint.majorRadiusMm).toBeLessThan(far[0].footprint.majorRadiusMm);
    expect(far[2].footprint.majorRadiusMm).toBeLessThan(near[2].footprint.majorRadiusMm);
    expect(stopped[2].footprint.majorRadiusMm / near[2].footprint.majorRadiusMm).toBeCloseTo(5.6 / 22, 8);
    mounted.dispose();
  });
  it("rejects an occluded target rather than treating projection as visibility", () => {
    const scene = new THREE.Scene();
    const mounted = createOpticalFixtureProfile().mountSubject(scene);
    const blocker = new THREE.Mesh(new THREE.PlaneGeometry(3, 3), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
    blocker.position.set(0, 0, 0.5);
    mounted.group.add(blocker);
    const camera = { ...DEFAULT_CAMERA_STATE, focalLengthMm: 90, focusDistanceMm: 2000, aperture: 5.6 as const };
    const optics = deriveOpticsState(camera, architectureRiseScene);
    const entries = inspectOpticalFixture(mounted.group, optics, camera, {});
    expect(entries.every((entry: { valid: boolean; rejection: string }) => !entry.valid && entry.rejection === "occluded or raycast missed target")).toBe(true);
    mounted.group.remove(blocker);
    blocker.geometry.dispose();
    (blocker.material as THREE.Material).dispose();
    mounted.dispose();
  });
  it("measures a broader edge as wider and rejects an unusably dark ROI", () => {
    const width = 40, height = 12;
    const create = (spread: number, multiplier = 1) => {
      const data = new Uint8Array(width * height * 4);
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        const value = Math.round((40 + 150 * Math.max(0, Math.min(1, (x - 20 + spread / 2) / spread))) * multiplier);
        const index = (y * width + x) * 4;
        data.set([value, value, value, 255], index);
      }
      return data;
    };
    const roi = { x: 0, y: 0, width, height };
    const sharp = measureVerticalEdgeRgba(create(4), width, height, roi);
    const blurred = measureVerticalEdgeRgba(create(12), width, height, roi);
    const dark = measureVerticalEdgeRgba(create(4, 0.01), width, height, roi);
    expect(sharp.valid).toBe(true);
    expect(blurred.valid).toBe(true);
    expect(blurred.width10to90Px).toBeGreaterThan(sharp.width10to90Px);
    expect(dark).toMatchObject({ valid: false, rejection: "dark or saturated ROI" });
  });
});
