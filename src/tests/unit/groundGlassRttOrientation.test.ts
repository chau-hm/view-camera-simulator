import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import { configureGroundGlassCamera } from "../../render/configureGroundGlassCamera";
import { mapGroundGlassUvToDisplayUv } from "../../render/groundGlassTargetProjection";
import {
  applyGroundGlassRttDisplayTransform,
  resolveGroundGlassRttDisplayTransform,
} from "../../render/groundGlassRttOrientation";
import { focusFundamentalsTwoTargets } from "../../scenes/definitions/focus-fundamentals-two-targets";
import { focusFundamentalsPerspectiveReferencePoints } from "../../scenes/focusFundamentalsTargets";
import { WORLD_SCALE } from "../../render/rttUtils";
import { DEFAULT_CAMERA_STATE } from "../../utils/constants";

type Uv = { u: number; v: number };

const flip180 = ({ u, v }: Uv): Uv => ({ u: 1 - u, v: 1 - v });

const ASYMMETRIC_REFERENCE_POINTS = [
  { label: "A", upright: { u: 0.2, v: 0.2 } },
  { label: "B", upright: { u: 0.8, v: 0.2 } },
  { label: "C", upright: { u: 0.2, v: 0.8 } },
  { label: "D", upright: { u: 0.8, v: 0.8 } },
] as const;

describe("Ground Glass RTT orientation", () => {
  it("renders an asymmetric upright reference as a 180-degree Raw image", () => {
    for (const point of ASYMMETRIC_REFERENCE_POINTS) {
      const rawDisplay = applyGroundGlassRttDisplayTransform(
        point.upright,
        resolveGroundGlassRttDisplayTransform("raw"),
      );
      const uprightDisplay = applyGroundGlassRttDisplayTransform(
        point.upright,
        resolveGroundGlassRttDisplayTransform("upright"),
      );

      expect(rawDisplay, point.label).toEqual(flip180(point.upright));
      expect(uprightDisplay, point.label).toEqual(point.upright);
    }
  });

  it("keeps raster orientation, canonical target projection, and mode complement aligned", () => {
    for (const point of ASYMMETRIC_REFERENCE_POINTS) {
      // A physical raw film point is the 180-degree projection of the upright
      // scene reference. Target projection then places that raw point in the
      // selected visible mode.
      const physicalRawFilmUv = flip180(point.upright);
      const rasterRawDisplay = applyGroundGlassRttDisplayTransform(
        point.upright,
        resolveGroundGlassRttDisplayTransform("raw"),
      );
      const rasterUprightDisplay = applyGroundGlassRttDisplayTransform(
        point.upright,
        resolveGroundGlassRttDisplayTransform("upright"),
      );
      const projectedRawDisplay = mapGroundGlassUvToDisplayUv(
        physicalRawFilmUv,
        "raw",
      );
      const projectedUprightDisplay = mapGroundGlassUvToDisplayUv(
        physicalRawFilmUv,
        "upright",
      );

      expect(rasterRawDisplay.u, point.label).toBeCloseTo(projectedRawDisplay.u, 12);
      expect(rasterRawDisplay.v, point.label).toBeCloseTo(projectedRawDisplay.v, 12);
      expect(rasterUprightDisplay.u, point.label).toBeCloseTo(projectedUprightDisplay.u, 12);
      expect(rasterUprightDisplay.v, point.label).toBeCloseTo(projectedUprightDisplay.v, 12);
      expect(rasterUprightDisplay.u).toBeCloseTo(1 - rasterRawDisplay.u, 12);
      expect(rasterUprightDisplay.v).toBeCloseTo(1 - rasterRawDisplay.v, 12);
    }
  });

  it("maps the configured RTT camera and large frame through the display contract", () => {
    const cameraState = {
      ...DEFAULT_CAMERA_STATE,
      ...focusFundamentalsTwoTargets.cameraPreset,
      activeSceneId: focusFundamentalsTwoTargets.id,
      focusMode: "finite" as const,
    };
    const optics = deriveOpticsState(cameraState, focusFundamentalsTwoTargets);
    const camera = new THREE.PerspectiveCamera(50, 1, 0.01, 1000);
    const configuration = configureGroundGlassCamera(camera, optics, 0.01, 1000);
    expect(configuration.ok).toBe(true);
    if (!configuration.ok) return;

    for (const [surface, referencePoints] of Object.entries(
      focusFundamentalsPerspectiveReferencePoints,
    )) {
      for (const [label, worldPointMm] of Object.entries(referencePoints)) {
        const pointLabel = `${surface} ${label}`;
        const worldPoint = new THREE.Vector3(
          worldPointMm.x,
          worldPointMm.y,
          worldPointMm.z,
        ).multiplyScalar(WORLD_SCALE);
        const ndc = worldPoint.project(camera);
        const rttTextureUv = {
          u: (ndc.x + 1) / 2,
          v: (ndc.y + 1) / 2,
        };
        expect(rttTextureUv.u, pointLabel).toBeGreaterThan(0);
        expect(rttTextureUv.u, pointLabel).toBeLessThan(1);
        expect(rttTextureUv.v, pointLabel).toBeGreaterThan(0);
        expect(rttTextureUv.v, pointLabel).toBeLessThan(1);

        // The configured RTT camera supplies the asymmetric source raster.
        // Convert its bottom-origin V to the top-origin upright reference,
        // then derive the physical Raw film coordinate from that reference.
        const uprightReferenceUv = {
          u: rttTextureUv.u,
          v: 1 - rttTextureUv.v,
        };
        const physicalRawFilmUv = flip180(uprightReferenceUv);

        const renderedByMode = (previewMode: "raw" | "upright"): Uv => {
          const compositeSampleUv = applyGroundGlassRttDisplayTransform(
            rttTextureUv,
            resolveGroundGlassRttDisplayTransform(previewMode),
          );
          // WebGL texture V is bottom-origin; the visible Ground Glass
          // contract is expressed in top-origin display coordinates.
          return {
            u: compositeSampleUv.u,
            v: 1 - compositeSampleUv.v,
          };
        };

        const rawDisplayUv = renderedByMode("raw");
        const uprightDisplayUv = renderedByMode("upright");
        const projectedRawDisplay = mapGroundGlassUvToDisplayUv(
          physicalRawFilmUv,
          "raw",
        );
        const projectedUprightDisplay = mapGroundGlassUvToDisplayUv(
          physicalRawFilmUv,
          "upright",
        );

        expect(rawDisplayUv.u, pointLabel).toBeCloseTo(physicalRawFilmUv.u, 6);
        expect(rawDisplayUv.v, pointLabel).toBeCloseTo(physicalRawFilmUv.v, 6);
        expect(uprightDisplayUv.u, pointLabel).toBeCloseTo(uprightReferenceUv.u, 6);
        expect(uprightDisplayUv.v, pointLabel).toBeCloseTo(uprightReferenceUv.v, 6);
        expect(projectedRawDisplay.u, pointLabel).toBeCloseTo(physicalRawFilmUv.u, 6);
        expect(projectedRawDisplay.v, pointLabel).toBeCloseTo(physicalRawFilmUv.v, 6);
        expect(projectedUprightDisplay.u, pointLabel).toBeCloseTo(uprightReferenceUv.u, 6);
        expect(projectedUprightDisplay.v, pointLabel).toBeCloseTo(uprightReferenceUv.v, 6);
        expect(uprightDisplayUv.u, pointLabel).toBeCloseTo(1 - rawDisplayUv.u, 6);
        expect(uprightDisplayUv.v, pointLabel).toBeCloseTo(1 - rawDisplayUv.v, 6);
      }
    }
  });
});
